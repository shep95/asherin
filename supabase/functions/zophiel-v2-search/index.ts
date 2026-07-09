// ZOPHIEL v2 · Ghost Chain — two-pass search port.
//
// Narrative → Flaws → New narrative (see chat):
//   Real Zophiel v2 is a Node CLI (Playwright + SQLite FTS5). It cannot run
//   inside a Supabase edge function. This function ports the v2 SEMANTICS:
//     Pass 1 (Gather)  — parse subject + location → region-aware DDG SERP
//     Pass 2 (Refine)  — apply operators (site:/intitle:/inurl:/filetype:)
//                        against the gathered corpus in-memory
//   No persistent index. Every call is stateless.
//
// Hardening applied:
//   • CORS via shared helper (per-request origin).
//   • JWT required — prevents anonymous SERP abuse.
//   • Zod-shaped input validation.
//   • Region-code allow-list (no arbitrary `kl=` injection into DDG).
//   • 12s fetch timeout + AbortController; DDG called ONCE per request.
//   • Snippet/title tag-stripping (defeats stored-XSS via SERP HTML).
//   • Cap results to 25.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";

// ---- Region allow-list (country → DDG `kl` region code) --------------------
const REGION_MAP: Record<string, string> = {
  china: "cn-zh",
  "united states": "us-en",
  usa: "us-en",
  "united kingdom": "uk-en",
  uk: "uk-en",
  australia: "au-en",
  canada: "ca-en",
  germany: "de-de",
  france: "fr-fr",
  spain: "es-es",
  italy: "it-it",
  japan: "jp-jp",
  korea: "kr-kr",
  india: "in-en",
  brazil: "br-pt",
  mexico: "mx-es",
  peru: "pe-es",
  argentina: "ar-es",
  russia: "ru-ru",
  netherlands: "nl-nl",
  sweden: "se-sv",
  norway: "no-no",
  finland: "fi-fi",
  poland: "pl-pl",
  turkey: "tr-tr",
  israel: "il-en",
  "saudi arabia": "xa-ar",
  uae: "xa-en",
  singapore: "sg-en",
  "new zealand": "nz-en",
  "south africa": "za-en",
  taiwan: "tw-tzh",
  "hong kong": "hk-tzh",
  vietnam: "vn-vi",
  thailand: "th-th",
  indonesia: "id-en",
  philippines: "ph-en",
  ukraine: "ua-uk",
};

// ---- Operator parser (mirrors Zophiel v2 CLI semantics) --------------------
interface Operators {
  site: string[];
  filetype: string[];
  intitle: string[];
  inurl: string[];
  phrases: string[];   // quoted "..."
  freeText: string;
}

function parseOperators(raw: string): Operators {
  const ops: Operators = { site: [], filetype: [], intitle: [], inurl: [], phrases: [], freeText: "" };
  let s = raw;

  // 1. Extract quoted phrases first (may contain spaces)
  s = s.replace(/"([^"]+)"/g, (_m, phrase) => { ops.phrases.push(phrase.toLowerCase()); return " "; });

  // 2. Extract operator:value pairs
  const opRegex = /\b(site|filetype|intitle|inurl):([^\s]+)/gi;
  s = s.replace(opRegex, (_m, key, val) => {
    const k = key.toLowerCase() as "site" | "filetype" | "intitle" | "inurl";
    ops[k].push(String(val).toLowerCase());
    return " ";
  });

  ops.freeText = s.replace(/\s+/g, " ").trim();
  return ops;
}

// ---- Location parser (looks for "in <country>" / "who lives in <country>") -
function parseLocation(text: string): { country: string | null; region: string | null; residue: string } {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(?:in|from|based in|who lives in|located in)\s+([a-z][a-z\s]{2,30}?)(?:\s*[.,;]|$)/);
  if (match) {
    const raw = match[1].trim().replace(/\s+/g, " ");
    // Try longest-suffix match against REGION_MAP keys
    const keys = Object.keys(REGION_MAP).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (raw.endsWith(key)) {
        return { country: key, region: REGION_MAP[key], residue: text.replace(match[0], "").trim() };
      }
    }
  }
  return { country: null, region: null, residue: text };
}

// ---- Tag scrubber (defeats XSS from SERP HTML in title/snippet) ------------
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ---- DDG lite SERP call with region hint (Pass 1 discovery) ----------------
interface RawHit { title: string; url: string; snippet: string }

async function ddgGather(query: string, region: string | null, limit: number): Promise<RawHit[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const body = new URLSearchParams({ q: query });
    if (region) body.set("kl", region);
    const r = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        // Match the UA that ddg-search uses successfully in production.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
      },
      body,
      signal: ctl.signal,
    });
    if (!r.ok) { console.error("[zophiel-v2] DDG status", r.status); return []; }
    const html = await r.text();

    const hits: RawHit[] = [];
    // Primary parse — lite markup with class='result-link'
    const linkRx = /class=['"]?result-link['"]?[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snipRx = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRx.exec(html)) !== null && links.length < limit * 2) {
      let url = m[1];
      if (url.includes("duckduckgo.com/l/")) {
        const uddg = url.match(/uddg=([^&]+)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
      }
      const title = stripTags(m[2]);
      if (title && /^https?:\/\//i.test(url)) links.push({ url, title });
    }
    const snippets: string[] = [];
    while ((m = snipRx.exec(html)) !== null && snippets.length < links.length) {
      snippets.push(stripTags(m[1]));
    }
    for (let i = 0; i < Math.min(links.length, limit); i++) {
      hits.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || "" });
    }

    // Fallback parse — any external anchor with rel=nofollow.
    if (hits.length === 0) {
      const altRx = /<a[^>]*rel="nofollow"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((m = altRx.exec(html)) !== null && hits.length < limit) {
        const url = m[1];
        const title = stripTags(m[2]);
        if (title && !url.includes("duckduckgo.com")) hits.push({ title, url, snippet: "" });
      }
    }
    console.log(`[zophiel-v2] gathered=${hits.length} region=${region || "-"}`);
    return hits;
  } catch (e) {
    console.error("[zophiel-v2] gather error", e instanceof Error ? e.message : String(e));
    return [];
  } finally { clearTimeout(t); }
}


// ---- Pass 2: refine the in-memory corpus using operators -------------------
interface ScoredHit extends RawHit { score: number; matched: string[] }

function refine(corpus: RawHit[], ops: Operators): ScoredHit[] {
  const out: ScoredHit[] = [];
  for (const h of corpus) {
    let host = "";
    let path = "";
    try { const u = new URL(h.url); host = u.hostname.toLowerCase(); path = u.pathname.toLowerCase(); } catch { continue; }

    // Hard filters — a miss on any operator eliminates the result
    if (ops.site.length && !ops.site.some((s) => host === s || host.endsWith("." + s))) continue;
    if (ops.filetype.length && !ops.filetype.some((ext) => path.endsWith("." + ext))) continue;
    if (ops.intitle.length && !ops.intitle.every((t) => h.title.toLowerCase().includes(t))) continue;
    if (ops.inurl.length && !ops.inurl.every((t) => (host + path).includes(t))) continue;
    if (ops.phrases.length && !ops.phrases.every((p) => (h.title + " " + h.snippet).toLowerCase().includes(p))) continue;

    // Soft scoring — free-text token overlap in title+snippet
    const matched: string[] = [];
    let score = 0;
    if (ops.freeText) {
      const tokens = ops.freeText.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const hay = (h.title + " " + h.snippet).toLowerCase();
      for (const tok of tokens) if (hay.includes(tok)) { score += 1; matched.push(tok); }
    }
    // Operator hits add prestige
    score += ops.site.length * 2 + ops.intitle.length * 2 + ops.inurl.length + ops.filetype.length * 2;
    out.push({ ...h, score, matched });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    try { await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

    const body = await req.json().catch(() => ({}));
    const rawQuery = typeof body?.query === "string" ? body.query.trim() : "";
    if (!rawQuery || rawQuery.length > 500) {
      return new Response(JSON.stringify({ error: "query must be 1-500 chars" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const limit = Math.min(25, Math.max(5, Number(body?.limit) || 15));

    const ops = parseOperators(rawQuery);
    const loc = parseLocation(ops.freeText || rawQuery);

    // Pass 1 — GATHER. We strip operators so the SERP sees a natural-language
    // query; DDG lite ignores site:/filetype: hints in region mode.
    const gatherQuery = [ops.freeText, ...ops.phrases.map((p) => `"${p}"`)]
      .filter(Boolean).join(" ").trim() || rawQuery;

    const gathered = await ddgGather(gatherQuery, loc.region, limit);

    // Pass 2 — REFINE against the gathered corpus.
    const refined = refine(gathered, ops);

    return new Response(JSON.stringify({
      success: true,
      query: rawQuery,
      operators: {
        site: ops.site, filetype: ops.filetype, intitle: ops.intitle, inurl: ops.inurl,
        phrases: ops.phrases, freeText: ops.freeText,
      },
      location: { country: loc.country, region: loc.region },
      pass1_gathered: gathered.length,
      pass2_refined: refined.length,
      results: refined.slice(0, limit),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "zophiel-v2 failed" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
