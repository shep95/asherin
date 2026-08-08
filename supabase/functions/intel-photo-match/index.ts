// ═══════════════════════════════════════════════════════════════════════════
// INTEL PHOTO MATCH — facial corroboration layer for an intelligence dossier.
//
// A dossier that names a person on the strength of one scraped avatar is an
// assertion, not a corroboration. This function harvests INDEPENDENT profile
// images for the subject from separate platforms, stores them privately under
// the requesting user's own storage folder (never hotlinked, never public),
// and asks the vision model one narrow question: are these the same face?
//
// Doctrine:
//   • Two images minimum. One image can never corroborate itself.
//   • Independence is scored: two photos from the same host are one source.
//   • The verdict is advisory, always carries a confidence, and always cites
//     the source URL each frame came from. Silence is not evidence — when a
//     stage yields nothing it says so explicitly.
//   • Ownership is enforced on the notification row before a single byte of
//     egress happens, so this can never be used as an open image proxy.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";

const BUCKET = "intel-photos";
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 6;
const SIGN_TTL = 3600;

// An allow-list of social hosts starves this pipeline: LinkedIn, Instagram and
// X serve login walls whose og:image is the site logo, while the pages that
// actually publish a usable portrait — encyclopaedias, newsrooms, faculty and
// company bios, conference speaker pages — were being discarded before they
// were ever looked at. So the filter inverts: reject surfaces that cannot
// carry a person-specific image, and rank what remains by likelihood.
const JUNK_HOSTS =
  /(google\.|bing\.com|duckduckgo\.com|yahoo\.|pinterest\.|shutterstock\.|gettyimages\.|istockphoto\.|alamy\.|amazon\.|ebay\.|reddit\.com|quora\.com|archive\.org|youtube\.com\/results|\.pdf$)/i;
// Login-walled hosts are kept as *evidence of presence* but never lead the
// harvest, because their og:image is almost always a brand asset, not a face.
const WALLED_HOSTS = /(linkedin\.com|instagram\.com|facebook\.com|x\.com|twitter\.com|threads\.net|tiktok\.com)/i;
// Surfaces that habitually publish a real portrait with the subject's name.
const PORTRAIT_HOSTS =
  /(wikipedia\.org|wikidata\.org|britannica\.com|imdb\.com|muckrack\.com|crunchbase\.com|github\.com|about\.me|gravatar\.com|\.edu|\.gov|substack\.com|medium\.com|forbes\.com|bloomberg\.com|reuters\.com|nytimes\.com|theguardian\.com)/i;

interface StoredPhoto {
  path: string;
  sourceUrl: string;
  sourceHost: string;
  sourceTitle: string;
  contentType: string;
  bytes: number;
  hash: string;
}

interface PhotoMatch {
  verdict: "same_person" | "likely_same" | "inconclusive" | "conflict" | "unavailable";
  confidence: number;
  independentSources: number;
  reasoning: string;
  observations: string[];
  falsifier: string;
  assessedAt: string;
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Firecrawl search over surfaces that can plausibly carry a portrait. */
async function searchProfiles(query: string): Promise<Array<{ url: string; title: string }>> {
  if (!FIRECRAWL_KEY) {
    console.error("photo_search_skipped", "no_firecrawl_key");
    return [];
  }
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 12 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error("photo_search_failed", r.status, (await r.text()).slice(0, 300));
      return [];
    }
    const j = await r.json();
    const rows: any[] = Array.isArray(j?.data)
      ? j.data
      : Array.isArray(j?.data?.web)
        ? j.data.web
        : Array.isArray(j?.web)
          ? j.web
          : [];
    const kept = rows
      .map((x) => ({ url: String(x?.url ?? ""), title: String(x?.title ?? "") }))
      .filter((x) => x.url.startsWith("https://") && !JUNK_HOSTS.test(x.url));
    console.log("photo_search", JSON.stringify({ query: query.slice(0, 80), raw: rows.length, kept: kept.length }));
    return kept;
  } catch (e) {
    console.error("photo_search_error", e instanceof Error ? e.message : e);
    return [];
  }
}


/**
 * Pull the portrait a page advertises about itself.
 *
 * Routing every candidate through the paid scraper spent a dozen credits per
 * run and, once the per-minute ceiling was hit, every call failed silently and
 * the dossier reported "nothing found" when the pages were plainly there. A
 * plain GET reads the same og:image tag for free on the vast majority of
 * public bio pages, so it leads; the scraper is the fallback for the pages
 * that refuse an anonymous client.
 */
async function ogImageOf(pageUrl: string): Promise<string | null> {
  const fromHtml = (html: string): string | null => {
    const meta =
      html.match(
        /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i,
      );
    const raw = meta?.[1];
    if (!raw) return null;
    try {
      const abs = new URL(raw, pageUrl).toString();
      return abs.startsWith("https://") ? abs : null;
    } catch {
      return null;
    }
  };

  // 1) Free path: read the head directly.
  try {
    const r = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AsherinIntel/1.0; +https://asherin.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (r.ok) {
      // Only the head is needed; capping the read keeps a 5 MB article cheap.
      const html = (await r.text()).slice(0, 250_000);
      const hit = fromHtml(html);
      if (hit) return hit;
    } else {
      console.log("photo_og_direct_blocked", JSON.stringify({ host: hostOf(pageUrl), status: r.status }));
    }
  } catch (e) {
    console.log("photo_og_direct_error", JSON.stringify({ host: hostOf(pageUrl), err: String(e).slice(0, 80) }));
  }

  // 2) Paid path: only for pages that refused the anonymous client.
  if (!FIRECRAWL_KEY) return null;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: pageUrl, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      console.log("photo_og_scrape_failed", JSON.stringify({ host: hostOf(pageUrl), status: r.status }));
      return null;
    }
    const j = await r.json();
    const md = j?.data ?? j;
    const meta = md?.metadata ?? {};
    const cand =
      meta.ogImage ?? meta["og:image"] ?? meta.twitterImage ?? meta["twitter:image"] ?? null;
    const first = Array.isArray(cand) ? cand[0] : cand;
    if (typeof first === "string" && first.startsWith("https://")) return first;
    const m = typeof md?.markdown === "string"
      ? md.markdown.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+\.(?:jpg|jpeg|png|webp)[^)\s]*)\)/i)
      : null;
    return m?.[1] ?? null;
  } catch (e) {
    console.log("photo_og_scrape_error", JSON.stringify({ host: hostOf(pageUrl), err: String(e).slice(0, 80) }));
    return null;
  }
}


/** Fetch image bytes with hard size, type and time bounds. */
async function fetchImage(url: string): Promise<{ buf: ArrayBuffer; type: string } | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "AsherinIntel/1.0 (+https://asherin.com)", Accept: "image/*" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;
    const len = Number(r.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES || buf.byteLength < 1024) return null;
    return { buf, type };
  } catch {
    return null;
  }
}

const extOf = (type: string) =>
  type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  // Chunked to avoid blowing the argument limit on large frames.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * Parse model JSON, tolerating a response truncated by the token ceiling.
 * A cut-off object still carries the verdict and most of the reasoning, and
 * discarding it loses a real assessment over a missing brace.
 */
function safeParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through to salvage */
  }
  const field = (k: string): string => {
    const m = raw.match(new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, "i"));
    return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() : "";
  };
  const verdict = field("verdict");
  if (!verdict) return null;
  const conf = raw.match(/"confidence"\s*:\s*([0-9.]+)/i);
  const obsBlock = raw.match(/"observations"\s*:\s*\[([\s\S]*?)(\]|$)/i)?.[1] ?? "";
  const observations = [...obsBlock.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  return {
    verdict,
    confidence: conf ? Number(conf[1]) : 0,
    reasoning: field("reasoning"),
    observations,
    falsifier: field("falsifier"),
  };
}


async function crossMatch(
  subject: string,
  frames: Array<{ b64: string; type: string; host: string }>,
): Promise<PhotoMatch> {
  const independent = new Set(frames.map((f) => f.host)).size;
  const base: PhotoMatch = {
    verdict: "unavailable",
    confidence: 0,
    independentSources: independent,
    reasoning: "",
    observations: [],
    falsifier: "",
    assessedAt: new Date().toISOString(),
  };
  if (frames.length < 2) {
    return {
      ...base,
      verdict: "inconclusive",
      reasoning:
        "n/a — fewer than two independently sourced frames were recoverable, so no corroboration is possible. A single image cannot confirm itself.",
      falsifier: "A second image from a different host would make this assessable.",
    };
  }
  if (!GEMINI_KEY) {
    return {
      ...base,
      reasoning: "n/a — the vision comparator is not configured on this deployment.",
      falsifier: "Configure the vision key and re-run the cross-match.",
    };
  }

  const parts: any[] = [
    {
      text:
        `SUBJECT OF RECORD: ${subject || "unnamed"}\n\n` +
        `You are a forensic facial-comparison analyst. You are given ${frames.length} images harvested from ` +
        frames.map((f, i) => `frame ${i + 1} = ${f.host}`).join(", ") +
        `.\n\nCompare the primary face in each frame. Ground every claim in a visible observable ` +
        `(interpupillary ratio, nasal bridge, philtrum length, ear helix shape, hairline, jaw contour, ` +
        `permanent marks). Lighting, pose, weight, age and grooming are NOT identity evidence.\n\n` +
        `Return STRICT JSON only, no prose, no code fences:\n` +
        `{"verdict":"same_person|likely_same|inconclusive|conflict","confidence":0.0-1.0,` +
        `"reasoning":"two sentences","observations":["cited observable per frame pair"],` +
        `"falsifier":"what single observation would overturn this"}\n\n` +
        `Rules: if any frame contains no discernible face, say so in observations and downgrade to ` +
        `inconclusive. Never assert same_person above 0.85 confidence unless at least three concordant ` +
        `hard observables are cited. Absence of contradiction is not confirmation.`,
    },
    ...frames.map((f) => ({ inline_data: { mime_type: f.type, data: f.b64 } })),
  ];

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          // A 900-token ceiling truncated the JSON mid-string on multi-frame
          // comparisons, and a truncated object throws in JSON.parse — which
          // surfaced to the reader as "comparator unreachable" when the model
          // had in fact answered. Budget for the real answer, then salvage.
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!r.ok) {
      const body = (await r.text()).slice(0, 300);
      console.error("photo_vision_failed", r.status, body);
      return { ...base, reasoning: `n/a — the comparator returned ${r.status}.`, falsifier: "Retry the cross-match." };
    }
    const j = await r.json();
    const text: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    const cleaned = text.replace(/^```json\s*|```$/g, "").trim();
    const parsed = safeParse(cleaned);
    if (!parsed) {
      console.error("photo_vision_unparsable", cleaned.slice(0, 200));
      return {
        ...base,
        reasoning: "n/a — the comparator returned a malformed assessment.",
        falsifier: "Retry the cross-match.",
      };
    }
    const v = String(parsed?.verdict ?? "inconclusive");
    return {
      verdict: (["same_person", "likely_same", "inconclusive", "conflict"].includes(v) ? v : "inconclusive") as PhotoMatch["verdict"],
      confidence: Math.max(0, Math.min(1, Number(parsed?.confidence) || 0)),
      independentSources: independent,
      reasoning: String(parsed?.reasoning ?? "").slice(0, 800),
      observations: (Array.isArray(parsed?.observations) ? parsed.observations : [])
        .map((o: unknown) => String(o).slice(0, 300))
        .slice(0, 10),
      falsifier: String(parsed?.falsifier ?? "").slice(0, 400),
      assessedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("photo_vision_error", e instanceof Error ? e.message : e);
    return { ...base, reasoning: "n/a — the comparator could not be reached.", falsifier: "Retry the cross-match." };
  }
}

// ── Subject qualification ──────────────────────────────────────────────────
// A mononym is not a person reference. Searching `"Marcus" photo` returns the
// emperor, the book cover and the stock portrait, and the comparator then
// dutifully reports that a marble bust and a stranger are not the same face —
// which reads to the operator as intelligence when it is only noise. When the
// dossier has not bound an identity, the honest output is refusal.
const HONORIFIC = /^(mr|mrs|ms|miss|dr|prof|sir|rev|driver)\.?$/i;

function nameTokens(subject: string): string[] {
  return subject
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^\p{L}\p{M}'-]/gu, ""))
    .filter((t) => t.length >= 2 && !HONORIFIC.test(t));
}

/** A subject is corroboratable only when it carries a family name. */
function isQualifiedSubject(subject: string): boolean {
  return nameTokens(subject).length >= 2;
}

// Only person-locating context sharpens a portrait search. Verdict prose,
// percentages, plate strings and vehicle descriptions actively poison it —
// they pull the index toward car listings and toward whatever page happens to
// quote the same number.
const ANCHOR_LABELS =
  /(city|locality|location|based|residence|employer|company|organisation|organization|affiliation|role|title|occupation|school|university)/i;
const ANCHOR_NOISE =
  /(\d|verdict|confidence|watch|clear|thin|plate|vin|vehicle|do not board|registry|mismatch|unbound|%)/i;

function anchorsFrom(sections: unknown): string {
  const rows = Array.isArray(sections) ? (sections as any[]) : [];
  const kept: string[] = [];
  for (const s of rows) {
    const label = String(s?.label ?? s?.key ?? "");
    const value = String(s?.value ?? "").trim();
    if (!value || value.length > 48) continue;
    if (!ANCHOR_LABELS.test(label)) continue;
    if (ANCHOR_NOISE.test(value)) continue;
    kept.push(value);
    if (kept.length >= 2) break;
  }
  return kept.join(" ");
}

// ── Face gate ──────────────────────────────────────────────────────────────
// og:image is a page's *social card*, not a portrait. Left ungated it admits
// sculpture, book jackets, logos and landscape art into an evidence gallery,
// and a gallery of non-faces is worse than an empty one: it manufactures the
// appearance of corroboration. Every harvested frame must first prove it
// contains a real, photographic human face before it is stored or shown.
async function faceGate(
  frames: Array<{ b64: string; type: string; host: string }>,
): Promise<boolean[]> {
  if (!frames.length) return [];
  if (!GEMINI_KEY) return frames.map(() => false);
  const parts: any[] = [
    {
      text:
        `You are screening ${frames.length} images for use as facial-comparison evidence.\n` +
        `For EACH image in order, decide whether it is a PHOTOGRAPH OF A REAL LIVING HUMAN FACE ` +
        `that is large enough and clear enough to compare (face occupies a meaningful part of the frame, ` +
        `eyes and nose visible).\n\n` +
        `Answer false for: sculpture, statues, busts, paintings, drawings, illustrations, cartoons, ` +
        `AI-generated art, book covers, posters, logos, screenshots, product shots, landscapes, ` +
        `buildings, vehicles, crowd scenes with no dominant face, and any image with no discernible face.\n\n` +
        `Answer with ONE line containing exactly ${frames.length} characters, no spaces, no punctuation, ` +
        `no explanation: "T" if that image qualifies, "F" if it does not, in image order.`,
    },
    ...frames.map((f) => ({ inline_data: { mime_type: f.type, data: f.b64 } })),
  ];
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          // Two failure modes were folded into one answer shape. A 512-token
          // ceiling truncated a pretty-printed JSON array mid-write (the model
          // spends latent reasoning tokens against the same budget), and
          // `thinkingConfig` is rejected outright by this alias on v1beta. A
          // bare T/F string costs a handful of tokens and cannot truncate into
          // something that parses as a different answer.
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!r.ok) {
      console.error("face_gate_failed", r.status, (await r.text()).slice(0, 200));
      return frames.map(() => false); // fail CLOSED: unscreened frames are not evidence
    }
    const j = await r.json();
    const text: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    const flags = (text.toUpperCase().match(/[TF]/g) ?? []);
    if (flags.length < frames.length) {
      console.error("face_gate_unparsable", JSON.stringify({ got: flags.length, want: frames.length, text: text.slice(0, 120) }));
      return frames.map(() => false);
    }
    const out = frames.map((_, i) => flags[i] === "T");
    console.log("face_gate", JSON.stringify({ screened: frames.length, kept: out.filter(Boolean).length }));
    return out;
  } catch (e) {
    console.error("face_gate_error", e instanceof Error ? e.message : e);
    return frames.map(() => false);
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    return authErrorResponse(e, cors);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: any = {};
  try {
    body = await req.json();
  } catch { /* empty body is a valid "sign only" call */ }

  const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
  const refresh = body?.refresh === true;
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return json({ error: "notificationId required" }, 400, cors);
  }

  // Ownership gate BEFORE any outbound egress.
  const { data: note, error: noteErr } = await sb
    .from("intel_notifications")
    .select("id, user_id, subject_name, title, body, sections, photos, photo_match")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (noteErr) return json({ error: "lookup failed" }, 500, cors);
  if (!note) return json({ error: "not found" }, 404, cors);

  const sign = async (photos: StoredPhoto[]) => {
    const out: Array<StoredPhoto & { url: string | null }> = [];
    for (const p of photos) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(p.path, SIGN_TTL);
      out.push({ ...p, url: data?.signedUrl ?? null });
    }
    return out;
  };

  const existing: StoredPhoto[] = Array.isArray(note.photos) ? (note.photos as StoredPhoto[]) : [];
  if (existing.length && note.photo_match && !refresh) {
    return json({ photos: await sign(existing), match: note.photo_match, cached: true }, 200, cors);
  }

  const subject = String(note.subject_name || "").trim();
  if (!subject) {
    const match: PhotoMatch = {
      verdict: "inconclusive",
      confidence: 0,
      independentSources: 0,
      reasoning: "n/a — this report has no named subject, so there is nothing to corroborate visually.",
      observations: [],
      falsifier: "Name the subject and re-run the cross-match.",
      assessedAt: new Date().toISOString(),
    };
    await sb.from("intel_notifications").update({ photo_match: match }).eq("id", note.id);
    return json({ photos: [], match }, 200, cors);
  }

  // A first name alone cannot be corroborated. Running the harvest anyway is
  // how a dossier ends up illustrated with strangers, so refuse and say why.
  if (!isQualifiedSubject(subject)) {
    const match: PhotoMatch = {
      verdict: "unavailable",
      confidence: 0,
      independentSources: 0,
      reasoning:
        `n/a — the subject of record is "${subject}", a given name with no family name. ` +
        `An open-web image search on a given name alone returns unrelated people and non-photographic ` +
        `artwork, so any gallery it produced would be decoration, not corroboration. No frames were harvested.`,
      observations: [],
      falsifier: "Supply a full name (or a registry-resolved surname) and re-run the cross-match.",
      assessedAt: new Date().toISOString(),
    };
    await sb
      .from("intel_notifications")
      .update({ photos: [], photo_match: match })
      .eq("id", note.id)
      .eq("user_id", user.id);
    return json({ photos: [], match }, 200, cors);
  }

  // Only person-locating context is carried into the query. Verdict prose and
  // vehicle/plate strings are excluded — they steer the index toward listings.
  const hint = anchorsFrom(note.sections);

  const queries = [
    `"${subject}" photo ${hint}`.trim(),
    `"${subject}" profile biography portrait`,
  ];
  const found = (await Promise.all(queries.map(searchProfiles))).flat();

  // One candidate per host keeps "two sources" from meaning "one site twice",
  // and portrait-bearing surfaces are attempted before login-walled ones so a
  // short candidate budget is never spent entirely on brand logos.
  const byHost = new Map<string, { url: string; title: string }>();
  for (const f of found) {
    const h = hostOf(f.url);
    if (h && !byHost.has(h)) byHost.set(h, f);
  }
  const rank = (u: string) => (PORTRAIT_HOSTS.test(u) ? 0 : WALLED_HOSTS.test(u) ? 2 : 1);
  const candidates = [...byHost.values()]
    .sort((a, b) => rank(a.url) - rank(b.url))
    .slice(0, MAX_PHOTOS * 2);
  console.log(
    "photo_candidates",
    JSON.stringify({ found: found.length, hosts: candidates.map((c) => hostOf(c.url)) }),
  );


  const imageRefs = (
    await Promise.all(
      candidates.map(async (c) => {
        const img = await ogImageOf(c.url);
        return img ? { imageUrl: img, pageUrl: c.url, title: c.title } : null;
      }),
    )
  ).filter(Boolean) as Array<{ imageUrl: string; pageUrl: string; title: string }>;
  console.log("photo_images", JSON.stringify({ refs: imageRefs.length }));


  // Harvest into memory first. Nothing is written to storage or shown to the
  // operator until the face gate has cleared it, so the gallery can never
  // contain a bust, a book cover or a logo.
  type Pending = { buf: ArrayBuffer; type: string; hash: string; ref: { imageUrl: string; pageUrl: string; title: string } };
  const pending: Pending[] = [];
  const seen = new Set<string>();

  for (const ref of imageRefs) {
    if (pending.length >= MAX_PHOTOS) break;
    const got = await fetchImage(ref.imageUrl);
    if (!got) continue;
    const hash = await sha256(got.buf);
    if (seen.has(hash)) continue; // same file re-syndicated is not a second source
    seen.add(hash);
    pending.push({ buf: got.buf, type: got.type, hash, ref });
  }

  const gate = await faceGate(
    pending.map((p) => ({ b64: toBase64(p.buf), type: p.type, host: hostOf(p.ref.pageUrl) })),
  );
  const admitted = pending.filter((_, i) => gate[i]);
  const rejected = pending.length - admitted.length;
  console.log("photo_face_gate", JSON.stringify({ harvested: pending.length, admitted: admitted.length, rejected }));

  const stored: StoredPhoto[] = [];
  const frames: Array<{ b64: string; type: string; host: string }> = [];

  for (const p of admitted) {
    const path = `${user.id}/${note.id}/${p.hash.slice(0, 16)}.${extOf(p.type)}`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, p.buf, { contentType: p.type, upsert: true });
    if (upErr) {
      console.error("photo_upload_failed", upErr.message);
      continue;
    }
    stored.push({
      path,
      sourceUrl: p.ref.pageUrl,
      sourceHost: hostOf(p.ref.pageUrl),
      sourceTitle: p.ref.title.slice(0, 160),
      contentType: p.type,
      bytes: p.buf.byteLength,
      hash: p.hash,
    });
    frames.push({ b64: toBase64(p.buf), type: p.type, host: hostOf(p.ref.pageUrl) });
  }

  const match = await crossMatch(subject, frames);
  // Silence is not evidence: if the gate discarded frames, the report says so
  // rather than letting a thin gallery look like a thin internet.
  if (rejected > 0) {
    match.reasoning =
      `${match.reasoning} ${rejected} harvested image${rejected === 1 ? " was" : "s were"} discarded by the face gate ` +
      `(no comparable human face — artwork, logo, product or scene).`.trim();
  }

  await sb
    .from("intel_notifications")
    .update({ photos: stored, photo_match: match })
    .eq("id", note.id)
    .eq("user_id", user.id);

  return json({ photos: await sign(stored), match, cached: false }, 200, cors);
});
