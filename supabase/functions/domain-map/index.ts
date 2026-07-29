// DOMAIN MAP — given a root domain, enumerate every URL we can find
// on it (via sitemap.xml + robots.txt + homepage HTML links + optional
// shallow recurse), then return them grouped by the first path segment
// so the UI can filter (e.g. /document/, /book/, /user/).
//
// No AI, no BYOK — pure fetch + parse. Public information only.

import { getCorsHeaders } from "../_shared/cors.ts";


const UA = "Mozilla/5.0 (compatible; AureonZophielMap/1.0; +https://aureonai.app)";
const MAX_URLS = 4000;
const MAX_SITEMAPS = 25;
const FETCH_TIMEOUT_MS = 12000;

async function timedFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "User-Agent": UA, "Accept": "*/*", ...(init?.headers || {}) },
      redirect: "follow",
    });
    return r;
  } catch { return null; } finally { clearTimeout(t); }
}

function normalizeRoot(input: string): { origin: string; host: string } | null {
  try {
    const raw = input.trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    return { origin: u.origin, host: u.hostname.replace(/^www\./, "") };
  } catch { return null; }
}

function sameHost(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "").toLowerCase();
    return ha === b.toLowerCase() || ha.endsWith("." + b.toLowerCase());
  } catch { return false; }
}

// crude but effective <loc> extractor for sitemaps + sitemap index files
function extractSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function extractAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base).toString();
      if (/^https?:/i.test(abs)) out.push(abs.split("#")[0]);
    } catch { /* ignore */ }
  }
  return out;
}

function categorize(urls: string[], host: string) {
  const buckets: Record<string, string[]> = {};
  const all = new Set<string>();
  for (const raw of urls) {
    if (!sameHost(raw, host)) continue;
    let u: URL;
    try { u = new URL(raw); } catch { continue; }
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (all.has(u.origin + path + u.search)) continue;
    all.add(u.origin + path + u.search);
    const seg = (path.split("/").filter(Boolean)[0] || "root").toLowerCase();
    (buckets[seg] ||= []).push(u.origin + path + (u.search || ""));
  }
  // sort buckets by size desc, urls inside alpha
  const ordered = Object.entries(buckets)
    .map(([k, v]) => ({ category: k, count: v.length, urls: v.sort().slice(0, 1500) }))
    .sort((a, b) => b.count - a.count);
  return { totalUnique: all.size, categories: ordered };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { domain } = await req.json().catch(() => ({} as { domain?: string }));
    if (!domain || typeof domain !== "string") {
      return new Response(JSON.stringify({ error: "domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const root = normalizeRoot(domain);
    if (!root) {
      return new Response(JSON.stringify({ error: "invalid domain" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const collected = new Set<string>();
    const sources: { source: string; found: number }[] = [];

    // 1) robots.txt → discover sitemap URLs
    const sitemapsToCheck: string[] = [];
    const robotsResp = await timedFetch(`${root.origin}/robots.txt`);
    if (robotsResp?.ok) {
      const txt = await robotsResp.text();
      const lines = txt.split(/\r?\n/);
      for (const ln of lines) {
        const m = ln.match(/^\s*Sitemap:\s*(\S+)/i);
        if (m) sitemapsToCheck.push(m[1].trim());
      }
      sources.push({ source: "robots.txt", found: sitemapsToCheck.length });
    }
    // default candidates
    for (const cand of [
      `${root.origin}/sitemap.xml`,
      `${root.origin}/sitemap_index.xml`,
      `${root.origin}/sitemap-index.xml`,
    ]) if (!sitemapsToCheck.includes(cand)) sitemapsToCheck.push(cand);

    // 2) walk sitemaps (index → child sitemaps → urls)
    const visitedSitemaps = new Set<string>();
    const queue = [...sitemapsToCheck];
    let sitemapUrlsFound = 0;
    while (queue.length && visitedSitemaps.size < MAX_SITEMAPS && collected.size < MAX_URLS) {
      const sm = queue.shift()!;
      if (visitedSitemaps.has(sm)) continue;
      visitedSitemaps.add(sm);
      const r = await timedFetch(sm);
      if (!r?.ok) continue;
      const body = await r.text();
      const locs = extractSitemapLocs(body);
      for (const loc of locs) {
        if (collected.size >= MAX_URLS) break;
        if (/\.xml(\.gz)?($|\?)/i.test(loc) || /sitemap/i.test(loc) && /\.xml/i.test(loc)) {
          if (!visitedSitemaps.has(loc)) queue.push(loc);
        } else if (sameHost(loc, root.host)) {
          collected.add(loc.split("#")[0]);
          sitemapUrlsFound++;
        }
      }
    }
    if (sitemapUrlsFound > 0) sources.push({ source: "sitemap.xml", found: sitemapUrlsFound });

    // 3) homepage HTML anchors (always — gives nav + featured content)
    const homeResp = await timedFetch(root.origin + "/");
    if (homeResp?.ok) {
      const html = await homeResp.text();
      const anchors = extractAnchors(html, root.origin + "/");
      let added = 0;
      for (const a of anchors) {
        if (collected.size >= MAX_URLS) break;
        if (sameHost(a, root.host) && !collected.has(a)) { collected.add(a); added++; }
      }
      sources.push({ source: "homepage", found: added });
    }

    const categorized = categorize([...collected], root.host);

    return new Response(JSON.stringify({
      success: true,
      domain: root.host,
      origin: root.origin,
      totalUnique: categorized.totalUnique,
      sources,
      categories: categorized.categories,
      truncated: collected.size >= MAX_URLS,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
