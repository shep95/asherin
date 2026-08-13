/**
 * ZOPHIEL RESOLVE — intelligence layer over the web engine's result corpus.
 * ---------------------------------------------------------------------------
 * Input:  { query, results: [{title, url, snippet}], harvest?: boolean }
 * Output: SerpIntel — typed entities, resolved identities, hop rings 0-3,
 *         a timeline and per-source exposure classification.
 *
 * The function performs a bounded body harvest (concurrency-capped, per-fetch
 * timeout, byte cap, SSRF-guarded) then hands the corpus to a deterministic
 * engine. No model is involved: every returned claim traces back to a URL in
 * the corpus, which is what makes the output auditable rather than plausible.
 */

import { getCorsHeaders } from "../_shared/cors.ts";
import { buildSerpIntel, type SerpDoc } from "../_shared/serpEntityEngine.ts";

const MAX_DOCS = 40;
const HARVEST_LIMIT = 18;       // pages whose bodies we attempt to fetch
const FETCH_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 7_000;
const MAX_BYTES = 600_000;
const GLOBAL_DEADLINE_MS = 45_000;

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?|metadata\.google\.internal)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (PRIVATE_HOST.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]{0,200000}?<\/script>/gi, " ")
    .replace(/<style[\s\S]{0,200000}?<\/style>/gi, " ")
    .replace(/<!--[\s\S]{0,50000}?-->/g, " ")
    .replace(/<[^>]{0,2000}>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d{1,6});/g, (_, d) => String.fromCharCode(Number(d)))
    // Framework hydration islands (Astro/Next/Nuxt) survive tag stripping as
    // serialized JSON. Left in place, their quoted keys read as prose context
    // and promote nav labels to "people", so the structural punctuation is
    // scrubbed before any matcher sees the text.
    .replace(/"[A-Za-z_$][A-Za-z0-9_$]{0,40}"\s*:/g, " ")
    .replace(/[[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBody(url: URL, signal: AbortSignal): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return "";
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ctype)) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); total += value.byteLength; }
    }
    try { await reader.cancel(); } catch { /* stream already closed */ }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, total - off)), off); off += c.length; }
    return stripHtml(new TextDecoder("utf-8", { fatal: false }).decode(buf));
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Bounded worker pool — never more than FETCH_CONCURRENCY sockets in flight. */
async function harvest(urls: URL[], signal: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < urls.length && !signal.aborted) {
      const idx = cursor++;
      const u = urls[idx];
      const body = await fetchBody(u, signal);
      if (body.length > 200) out.set(u.toString(), body);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, urls.length) }, worker),
  );
  return out;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const started = Date.now();
  try {
    const payload = await req.json().catch(() => null);
    const query = typeof payload?.query === "string" ? payload.query.trim() : "";
    const rawResults = Array.isArray(payload?.results) ? payload.results : [];
    const doHarvest = payload?.harvest !== false;

    if (!query || rawResults.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "query and results are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Normalise + de-duplicate the corpus by URL.
    const seen = new Set<string>();
    const docs: SerpDoc[] = [];
    for (const r of rawResults) {
      const u = safeUrl(String(r?.url ?? ""));
      if (!u || seen.has(u.toString())) continue;
      seen.add(u.toString());
      docs.push({
        url: u.toString(),
        title: String(r?.title ?? "").slice(0, 300),
        snippet: String(r?.snippet ?? r?.description ?? "").slice(0, 2000),
        domain: u.hostname.replace(/^www\./, ""),
        snippetOnly: true,
      });
      if (docs.length >= MAX_DOCS) break;
    }

    if (docs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "no fetchable results in corpus" }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let bodies = new Map<string, string>();
    if (doHarvest) {
      const deadline = new AbortController();
      const t = setTimeout(() => deadline.abort(), GLOBAL_DEADLINE_MS);
      try {
        const targets = docs.slice(0, HARVEST_LIMIT).map((d) => new URL(d.url));
        bodies = await harvest(targets, deadline.signal);
      } finally {
        clearTimeout(t);
      }
      for (const d of docs) {
        const body = bodies.get(d.url);
        if (body) { d.body = body; d.snippetOnly = false; }
      }
    }

    const intel = buildSerpIntel(query, docs);
    const elapsed = Date.now() - started;

    console.log(JSON.stringify({
      fn: "zophiel-resolve", query: query.slice(0, 80),
      docs: docs.length, bodies: bodies.size,
      entities: intel.entities.length, edges: intel.edges.length,
      rings: [intel.coverage.ring1, intel.coverage.ring2, intel.coverage.ring3],
      ms: elapsed,
    }));

    return new Response(JSON.stringify({ success: true, intel, elapsedMs: elapsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("zophiel-resolve failed", err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ success: false, error: "intelligence layer failed" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
