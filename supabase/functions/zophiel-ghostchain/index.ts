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
// Called by: ZophielEngineView (mode="ghostchain"), and any Aureon/Asher chat
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
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;
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

async function validatePublicDestination(raw: string): Promise<string> {
  const target = validateSeedUrl(raw);
  const hostname = new URL(target).hostname;
  // Literal addresses were checked above. Resolve hostnames as well so a public
  // name cannot redirect/rebind the worker into a private network.
  if (!hostname.includes(":")) {
    try {
      const addresses = await Deno.resolveDns(hostname, "A");
      if (addresses.some((ip) => PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip)))) {
        throw new Error("BLOCKED_HOST");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "BLOCKED_HOST") throw error;
      // DNS failures are left to fetch so the caller receives a typed upstream error.
    }
  }
  return target;
}

function retryDelayMs(response: Response, attempt: number): number {
  const raw = response.headers.get("retry-after");
  const seconds = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(seconds)) return Math.min(3_000, Math.max(250, seconds * 1_000));
  return 400 * (attempt + 1) + Math.floor(Math.random() * 200);
}

async function readBoundedText(response: Response): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let received = 0;
  let truncated = false;
  try {
    while (received < MAX_HTML_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = MAX_HTML_BYTES - received;
      const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
      received += slice.byteLength;
      chunks.push(decoder.decode(slice, { stream: true }));
      if (value.byteLength > remaining) { truncated = true; break; }
    }
    chunks.push(decoder.decode());
  } finally {
    if (truncated) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return { text: chunks.join(""), truncated };
}

interface AcquiredPage {
  finalUrl: string;
  html: string;
  warnings: string[];
}

async function acquirePage(seed: string): Promise<AcquiredPage> {
  let current = await validatePublicDestination(seed);
  const warnings: string[] = [];
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(current, {
          redirect: "manual",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ZophielGhostChain/2.1; +https://asherin.com)",
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.4",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (error) {
        if (attempt === 0) { await new Promise((resolve) => setTimeout(resolve, 450)); continue; }
        const reason = error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network";
        throw new Error(`UPSTREAM_${reason.toUpperCase()}`);
      }
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const delay = retryDelayMs(response, attempt);
        await response.body?.cancel().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
    if (!response) throw new Error("UPSTREAM_NETWORK");

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error("UPSTREAM_REDIRECT_WITHOUT_LOCATION");
      if (redirect === MAX_REDIRECTS) throw new Error("UPSTREAM_TOO_MANY_REDIRECTS");
      current = await validatePublicDestination(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const error = new Error(`UPSTREAM_HTTP_${response.status}`) as Error & { status?: number; retryAfterMs?: number };
      error.status = response.status;
      if (response.status === 429) error.retryAfterMs = retryDelayMs(response, 1);
      throw error;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("html") && !contentType.includes("text/plain") && !contentType.includes("xhtml")) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`UNSUPPORTED_CONTENT_TYPE:${contentType.split(";")[0]}`);
    }
    const { text, truncated } = await readBoundedText(response);
    if (truncated) warnings.push("Page exceeded the 2 MB analysis window; the first 2 MB was analyzed.");
    if (!text.trim()) warnings.push("The target returned no readable static content.");
    return { finalUrl: current, html: text, warnings };
  }
  throw new Error("UPSTREAM_TOO_MANY_REDIRECTS");
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
  const body = sig.map((s) => s.text).join("\n\n").slice(0, 200_000);
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
      signal: AbortSignal.timeout(15_000),
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
    const warnings: string[] = [];

    // Optional passthrough to the user-hosted v2 Node service.
    const remote = Deno.env.get("ZOPHIEL_V2_REMOTE_URL");
    if (remote && !body?.forceLocal) {
      try {
        const upstream = await fetch(`${remote.replace(/\/+$/, "")}/investigate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, query: body?.query ?? "" }),
          signal: AbortSignal.timeout(20_000),
        });
        if (upstream.ok) {
          const j = await upstream.json();
          return new Response(JSON.stringify({ success: true, mode: "remote", target, ...j }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await upstream.body?.cancel().catch(() => undefined);
        warnings.push(`Remote investigator returned ${upstream.status}; static analysis was used.`);
      } catch {
        warnings.push("Remote investigator was unavailable; static analysis was used.");
      }
    }

    // Extraction is useful without an AI provider. Key resolution and report
    // synthesis are optional enrichments and must never destroy the base scan.
    let resolved = null;
    try { resolved = await resolveKey(req, (body as { byok?: unknown }).byok); }
    catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "BYOK_REQUIRED") return byokErrorResponse(e, corsHeaders);
      warnings.push("Metadata extraction completed without AI synthesis; connect an AI key for the narrative report.");
    }
    // Only Gemini keys are wired for synthesis here. Venice fallback callers
    // still get keywords/entities/report="" so the panel renders cleanly.
    const isGemini = resolved?.mode === "admin" || (resolved?.mode === "byok" && (resolved.byok?.provider ?? "gemini") === "gemini");
    const apiKey = isGemini && resolved ? (resolved.mode === "byok" ? (resolved.byok?.apiKey ?? "") : (resolved.geminiKey ?? "")) : "";


    const acquired = await acquirePage(target);
    warnings.push(...acquired.warnings);
    const parsed = parseStaticHtml(acquired.html, acquired.finalUrl);
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
        warnings.push("AI synthesis was unavailable; extracted evidence is still shown below.");
      }
    }

    return new Response(JSON.stringify({
      success: true, mode: "local",
      target: acquired.finalUrl, title: parsed.title, snippet,
      keywords, entities,
      links: parsed.links.slice(0, 40),
      segments: segments.slice(0, 30).map((s) => ({ text: s.text.slice(0, 400), entropy: Number(s.entropy.toFixed(3)), selector: s.selector, source: s.source })),
      report, warnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ghostchain_failed";
    const upstreamStatus = (e as { status?: number })?.status;
    const status = /^(INVALID|BLOCKED|CREDENTIALS|UNSUPPORTED)/.test(msg) ? 400
      : upstreamStatus === 429 ? 429
      : /^UPSTREAM_/.test(msg) ? 502
      : 500;
    console.error("[ghostchain]", e);
    const retryAfterMs = (e as { retryAfterMs?: number })?.retryAfterMs;
    return new Response(JSON.stringify({ error: msg, ...(retryAfterMs ? { retryAfterMs } : {}) }), {
      status, headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...(retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : {}),
      },
    });
  }
});
