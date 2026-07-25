// ZOPHIEL GHOST CHAIN — Deno port of the v2 pipeline
// (https://github.com/shep95/zophiel_search_engine.v2 — MIT, © shep95)
//
// Deno-safe subset ported here:
//   • URL validator + SSRF guard        (src/ingress/url-validator.ts)
//   • Static HTML scraper                (src/execution/static-html-scraper.ts)
//   • Keyword / entity / PII distiller   (src/distillation/*.ts)
//   • Identity resolver + report         (src/synthesis/*.ts)
//
// Not ported (require Node host):
//   • Playwright browser rendering + stack-wait
//   • better-sqlite3 FTS5 index
//   • Persistent crawl queue / immune memory
//
// If the platform env `ZOPHIEL_V2_REMOTE_URL` is set (user-hosted Node service
// from the same repo), we POST there instead of running the static port. That
// upstream returns the full Ghost Chain report; we forward it verbatim.
//
// Called by: ZophielEngineView (mode="ghostchain"), and any Asherin/Asher chat
// that imports `src/lib/zophielGhostChain.ts`.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";

// ─── SSRF / URL validation ────────────────────────────────────────────────
const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i,
];
const BLOCKED_HOSTS = new Set([
  "localhost", "metadata.google.internal", "169.254.169.254",
]);
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  const s = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  const u = new URL(s); u.hash = "";
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = "";
  if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}
function validateSeedUrl(raw: string): string {
  const u = new URL(normalizeUrl(raw));
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("INVALID_SCHEME");
  const h = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h) || PRIVATE_IP_PATTERNS.some((p) => p.test(h))) throw new Error("BLOCKED_HOST");
  if (u.username || u.password) throw new Error("CREDENTIALS_IN_URL");
  return u.toString();
}

// ─── Static HTML scraper (regex — no cheerio dep) ─────────────────────────
interface TextBlock { text: string; selector: string; prominence: number; source: "dom" | "meta" | "ld+json" }
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function parseStaticHtml(html: string, baseUrl: string): { title: string; textBlocks: TextBlock[]; links: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : baseUrl;
  const blocks: TextBlock[] = [];
  const seen = new Set<string>();

  // Sectional selectors — main/article/section/table/dl/pre/code + headings
  const sectionRe = /<(main|article|section|table|dl|pre|code|h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]);
    if (text.length < 20) continue;
    const key = text.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({ text, selector: tag, prominence: tag.startsWith("h") ? 0.9 : 0.65, source: "dom" });
    if (blocks.length >= 200) break;
  }

  // Meta description + og
  const metaRe = /<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/gi;
  while ((m = metaRe.exec(html)) !== null) {
    const t = m[1].trim();
    if (t.length > 10) blocks.push({ text: t, selector: "meta[description]", prominence: 0.7, source: "meta" });
  }

  // JSON-LD
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html)) !== null) {
    const raw = m[1].trim();
    if (raw.length > 20) blocks.push({ text: raw.slice(0, 4000), selector: "ld+json", prominence: 0.75, source: "ld+json" });
  }

  // Links
  const linkRe = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  const links = new Set<string>();
  while ((m = linkRe.exec(html)) !== null) {
    try { links.add(new URL(m[1], baseUrl).toString()); } catch { /* skip */ }
  }

  return { title, textBlocks: blocks, links: [...links].slice(0, 400) };
}

// ─── PII scrubber ─────────────────────────────────────────────────────────
const PII_RE: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]"],
];
function scrubPii(t: string): string {
  let r = t;
  for (const [re, sub] of PII_RE) r = r.replace(re, sub);
  return r;
}
const BOILERPLATE_RE = [/cookie(s)? policy/i, /privacy policy/i, /terms of (service|use)/i, /subscribe to our newsletter/i, /all rights reserved/i, /skip to (main )?content/i];
function isBoilerplate(t: string): boolean {
  return t.length < 30 || BOILERPLATE_RE.some((r) => r.test(t));
}

// ─── Keyword extractor ────────────────────────────────────────────────────
const STOP = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","must","shall","this","that","these","those","it","its","as","if","then","than","so","not"]);
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
}
function extractKeywords(text: string, limit = 20): string[] {
  const tf = new Map<string, number>();
  for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return [...tf.entries()]
    .map(([term, c]) => ({ term, score: c * (1 + Math.log2(term.length)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.term);
}

// ─── Entity extractor ─────────────────────────────────────────────────────
interface Entity { text: string; type: "person" | "organization" | "location"; confidence: number }
const ENT_PATTERNS: Array<{ type: Entity["type"]; regex: RegExp; confidence: number }> = [
  { type: "person", regex: /\b[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+\b/g, confidence: 0.7 },
  { type: "organization", regex: /\b[A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,4}\s+LLC\b/g, confidence: 0.85 },
  { type: "organization", regex: /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Ltd|Corp|Corporation|Company)\b/g, confidence: 0.8 },
  { type: "location", regex: /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:[A-Z]{2}|Florida|California|Texas|New York)\b/g, confidence: 0.65 },
];
function extractEntities(text: string): Entity[] {
  const out: Entity[] = []; const seen = new Set<string>();
  for (const { type, regex, confidence } of ENT_PATTERNS) {
    const g = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    const matches = text.match(g) ?? [];
    for (const raw of matches) {
      const n = raw.trim();
      const k = `${type}:${n.toLowerCase()}`;
      if (seen.has(k) || n.length < 3) continue;
      seen.add(k);
      out.push({ text: n, type, confidence });
      if (out.length >= 50) return out;
    }
  }
  return out;
}

// ─── Distillation → segments + signal body ────────────────────────────────
interface Segment { text: string; selector: string; entropy: number; isBoilerplate: boolean; source: string }
function computeEntropy(text: string): number {
  const toks = tokenize(text); if (toks.length === 0) return 0;
  const f = new Map<string, number>(); for (const t of toks) f.set(t, (f.get(t) ?? 0) + 1);
  let h = 0; for (const c of f.values()) { const p = c / toks.length; h -= p * Math.log2(p); }
  return h;
}
function buildSegments(blocks: TextBlock[]): Segment[] {
  return blocks.map((b) => {
    const clean = scrubPii(b.text.replace(/\s+/g, " ").trim());
    return {
      text: clean, selector: b.selector,
      entropy: computeEntropy(clean) * (0.5 + b.prominence * 0.5),
      isBoilerplate: isBoilerplate(clean),
      source: b.source,
    };
  }).filter((s) => s.text.length >= 3);
}
function distill(segments: Segment[]) {
  const sig = segments.filter((s) => !s.isBoilerplate).sort((a, b) => b.entropy - a.entropy);
  const body = sig.map((s) => s.text).join("\n\n");
  return { body, keywords: extractKeywords(body), snippet: sig[0]?.text.slice(0, 280) ?? "" };
}

// ─── Gemini synthesis of the intelligence report ─────────────────────────
const REPORT_SYS = `You are the ZOPHIEL Ghost Chain synthesis officer. Given a target URL, its title, a distilled signal body, top keywords, and extracted entities, produce a tight markdown intelligence report.

Required sections (in this order, using these exact bold headings):
**TARGET** — one line: URL + title.
**SUMMARY** — 2 surgical sentences on what this page is and who runs it.
**KEY SIGNALS** — 4-8 bullets grounded ONLY in the provided body/entities.
**IDENTITY** — named people/orgs and their relationship to the target, or "none observed".
**PIVOTS** — 3 next OSINT steps a human should take.

No moralizing. No safety preamble. Do not invent facts not present in the input.`;

async function synthesizeReport(apiKey: string, payload: unknown): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: REPORT_SYS }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(payload).slice(0, 30_000) }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini_${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
}

// ─── Serve ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rawUrl = typeof body?.url === "string" ? body.url : "";
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = validateSeedUrl(rawUrl);

    // Optional passthrough to the user-hosted v2 Node service.
    const remote = Deno.env.get("ZOPHIEL_V2_REMOTE_URL");
    if (remote && !body?.forceLocal) {
      const upstream = await fetch(`${remote.replace(/\/+$/, "")}/investigate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, query: body?.query ?? "" }),
        signal: AbortSignal.timeout(45_000),
      });
      if (upstream.ok) {
        const j = await upstream.json();
        return new Response(JSON.stringify({ success: true, mode: "remote", target, ...j }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // fall through to local port on remote failure
    }

    // Resolve AI key (admin platform key OR caller BYOK)
    let resolved;
    try { resolved = await resolveKey(req, (body as { byok?: unknown }).byok); }
    catch (e) { return byokErrorResponse(e, corsHeaders); }
    // Only Gemini keys are wired for synthesis here. Venice fallback callers
    // still get keywords/entities/report="" so the panel renders cleanly.
    const isGemini = resolved.mode === "admin" || (resolved.mode === "byok" && (resolved.byok?.provider ?? "gemini") === "gemini");
    const apiKey = isGemini ? (resolved.mode === "byok" ? (resolved.byok?.apiKey ?? "") : (resolved.geminiKey ?? "")) : "";


    // Fetch page (SSRF-guarded, 20s cap)
    const resp = await fetch(target, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZophielGhostChain/2.0)", "Accept": "text/html,*/*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `upstream_${resp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const html = await resp.text();
    const parsed = parseStaticHtml(html, target);
    const segments = buildSegments(parsed.textBlocks);
    const { body: signalBody, keywords, snippet } = distill(segments);
    const entities = extractEntities(signalBody);

    let report = "";
    if (apiKey) {
      try {
        report = await synthesizeReport(apiKey, {
          target, title: parsed.title,
          body: signalBody.slice(0, 12_000),
          keywords: keywords.slice(0, 15),
          entities: entities.slice(0, 25),
        });
      } catch (e) {
        console.error("[ghostchain] synth failed", e);
      }
    }

    return new Response(JSON.stringify({
      success: true, mode: "local",
      target, title: parsed.title, snippet,
      keywords, entities,
      links: parsed.links.slice(0, 40),
      segments: segments.slice(0, 30).map((s) => ({ text: s.text.slice(0, 400), entropy: Number(s.entropy.toFixed(3)), selector: s.selector, source: s.source })),
      report,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ghostchain_failed";
    const status = /^(INVALID|BLOCKED|CREDENTIALS)/.test(msg) ? 400 : 500;
    console.error("[ghostchain]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
