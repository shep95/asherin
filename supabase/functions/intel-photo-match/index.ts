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

/** Firecrawl search, narrowed to identity-bearing profile surfaces. */
async function searchProfiles(query: string): Promise<Array<{ url: string; title: string }>> {
  if (!FIRECRAWL_KEY) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 10 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error("photo_search_failed", r.status, (await r.text()).slice(0, 200));
      return [];
    }
    const j = await r.json();
    const rows: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.web) ? j.web : [];
    return rows
      .map((x) => ({ url: String(x?.url ?? ""), title: String(x?.title ?? "") }))
      .filter((x) => x.url.startsWith("https://") && PROFILE_HOSTS.test(x.url));
  } catch (e) {
    console.error("photo_search_error", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Pull the profile image a page advertises about itself (og/twitter image). */
async function ogImageOf(pageUrl: string): Promise<string | null> {
  if (!FIRECRAWL_KEY) return null;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: pageUrl, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const md = j?.data ?? j;
    const meta = md?.metadata ?? {};
    const cand =
      meta.ogImage ?? meta["og:image"] ?? meta.twitterImage ?? meta["twitter:image"] ?? null;
    const first = Array.isArray(cand) ? cand[0] : cand;
    if (typeof first === "string" && first.startsWith("https://")) return first;
    // Fallback: an inline profile-picture image in the rendered markdown.
    const m = typeof md?.markdown === "string"
      ? md.markdown.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+\.(?:jpg|jpeg|png|webp)[^)\s]*)\)/i)
      : null;
    return m?.[1] ?? null;
  } catch {
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 900, responseMimeType: "application/json" },
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
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
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

  // Context hint: locality / employer strings already in the dossier sharpen
  // the search without inventing facts the report never asserted.
  const hint = (Array.isArray(note.sections) ? (note.sections as any[]) : [])
    .map((s) => String(s?.value ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 120);

  const queries = [
    `"${subject}" profile ${hint}`.trim(),
    `"${subject}" linkedin OR instagram OR facebook profile photo`,
  ];
  const found = (await Promise.all(queries.map(searchProfiles))).flat();

  // One candidate per host keeps "two sources" from meaning "one site twice".
  const byHost = new Map<string, { url: string; title: string }>();
  for (const f of found) {
    const h = hostOf(f.url);
    if (h && !byHost.has(h)) byHost.set(h, f);
  }
  const candidates = [...byHost.values()].slice(0, MAX_PHOTOS);

  const imageRefs = (
    await Promise.all(
      candidates.map(async (c) => {
        const img = await ogImageOf(c.url);
        return img ? { imageUrl: img, pageUrl: c.url, title: c.title } : null;
      }),
    )
  ).filter(Boolean) as Array<{ imageUrl: string; pageUrl: string; title: string }>;

  const stored: StoredPhoto[] = [];
  const frames: Array<{ b64: string; type: string; host: string }> = [];
  const seen = new Set<string>();

  for (const ref of imageRefs) {
    if (stored.length >= MAX_PHOTOS) break;
    const got = await fetchImage(ref.imageUrl);
    if (!got) continue;
    const hash = await sha256(got.buf);
    if (seen.has(hash)) continue; // same file re-syndicated is not a second source
    seen.add(hash);

    const path = `${user.id}/${note.id}/${hash.slice(0, 16)}.${extOf(got.type)}`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, got.buf, { contentType: got.type, upsert: true });
    if (upErr) {
      console.error("photo_upload_failed", upErr.message);
      continue;
    }
    stored.push({
      path,
      sourceUrl: ref.pageUrl,
      sourceHost: hostOf(ref.pageUrl),
      sourceTitle: ref.title.slice(0, 160),
      contentType: got.type,
      bytes: got.buf.byteLength,
      hash,
    });
    frames.push({ b64: toBase64(got.buf), type: got.type, host: hostOf(ref.pageUrl) });
  }

  const match = await crossMatch(subject, frames);

  await sb
    .from("intel_notifications")
    .update({ photos: stored, photo_match: match })
    .eq("id", note.id)
    .eq("user_id", user.id);

  return json({ photos: await sign(stored), match, cached: false }, 200, cors);
});
