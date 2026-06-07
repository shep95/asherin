// DOMAIN HARVEST — Given a root domain (and optional seed URLs from
// domain-map), BFS-crawl pages on the same host and extract every link
// that points to a downloadable document (PDF, Office, eBook, archive,
// text data, media). Returns results grouped by file extension so the
// UI can filter and bundle them into a ZIP.
//
// Pure-fetch, no AI. Public information only.

import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

const UA = "Mozilla/5.0 (compatible; AureonZophielHarvest/1.0; +https://aureonai.app)";
const FETCH_TIMEOUT_MS = 12000;
const MAX_PAGES = 120;          // hard cap on HTML pages crawled
const MAX_DOCS  = 4000;         // hard cap on documents returned
const MAX_DEPTH = 3;             // BFS depth from seeds
const CONCURRENCY = 8;

// Categories of "documents" we hunt for.
const DOC_EXT_CATEGORIES: Record<string, string[]> = {
  pdf:        ["pdf"],
  word:       ["doc", "docx", "rtf", "odt"],
  excel:      ["xls", "xlsx", "ods", "csv", "tsv"],
  powerpoint: ["ppt", "pptx", "odp", "key"],
  text:       ["txt", "md", "log", "json", "xml", "yaml", "yml"],
  ebook:      ["epub", "mobi", "azw", "azw3", "fb2"],
  archive:    ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"],
  image:      ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff", "tif"],
  audio:      ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
  video:      ["mp4", "mkv", "mov", "avi", "webm", "m4v"],
  data:       ["sqlite", "db", "parquet", "avro"],
  code:       ["py", "js", "ts", "go", "rs", "java", "c", "cpp", "rb", "php"],
};
const EXT_TO_CAT = new Map<string, string>();
for (const [cat, exts] of Object.entries(DOC_EXT_CATEGORIES)) {
  for (const e of exts) EXT_TO_CAT.set(e, cat);
}
const ALL_DOC_EXTS = new Set(EXT_TO_CAT.keys());

function timedFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    ...init,
    signal: ctl.signal,
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept": "*/*", ...(init?.headers || {}) },
  })
    .then((r) => r)
    .catch(() => null)
    .finally(() => clearTimeout(t));
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

function extOf(url: string): string | null {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.([a-z0-9]{1,6})$/);
    return m ? m[1] : null;
  } catch { return null; }
}

function looksLikeHtml(url: string): boolean {
  const e = extOf(url);
  return !e || ["html", "htm", "php", "aspx", "asp", "jsp"].includes(e);
}

function extractAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base).toString().split("#")[0];
      if (/^https?:/i.test(abs)) out.push(abs);
    } catch { /* ignore */ }
  }
  // Also catch embedded iframe/object/embed/source data URLs that point to files
  const re2 = /\b(?:src|data)\s*=\s*["']([^"']+\.(?:pdf|docx?|xlsx?|pptx?|csv|epub|zip|mp3|mp4))["']/gi;
  while ((m = re2.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base).toString().split("#")[0];
      if (/^https?:/i.test(abs)) out.push(abs);
    } catch { /* ignore */ }
  }
  return out;
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as {
      domain?: string;
      seedUrls?: string[];
      maxPages?: number;
      maxDepth?: number;
      extensions?: string[]; // optional restriction (e.g. ["pdf","docx"])
    };
    if (!body.domain) {
      return new Response(JSON.stringify({ error: "domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const root = normalizeRoot(body.domain);
    if (!root) {
      return new Response(JSON.stringify({ error: "invalid domain" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantExts = body.extensions?.length
      ? new Set(body.extensions.map((s) => s.toLowerCase().replace(/^\./, "")))
      : null;
    const maxPages = Math.min(MAX_PAGES, Math.max(10, body.maxPages ?? MAX_PAGES));
    const maxDepth = Math.min(5, Math.max(1, body.maxDepth ?? MAX_DEPTH));

    // Seed queue: provided seeds (filtered to same host + HTML) + homepage
    const seeds = new Set<string>([root.origin + "/"]);
    for (const s of body.seedUrls || []) {
      if (sameHost(s, root.host) && looksLikeHtml(s)) seeds.add(s);
    }

    type QItem = { url: string; depth: number };
    const queue: QItem[] = [...seeds].map((u) => ({ url: u, depth: 0 }));
    const visited = new Set<string>();
    const docs = new Map<string, { url: string; ext: string; category: string; foundOn: string }>();
    let pagesCrawled = 0;

    async function processPage(item: QItem): Promise<QItem[]> {
      if (pagesCrawled >= maxPages || docs.size >= MAX_DOCS) return [];
      if (visited.has(item.url)) return [];
      visited.add(item.url);
      const r = await timedFetch(item.url);
      if (!r?.ok) return [];
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("html") && !ct.includes("xml") && ct !== "") return [];
      pagesCrawled++;
      const html = await r.text().catch(() => "");
      if (!html) return [];
      const anchors = extractAnchors(html, item.url);
      const next: QItem[] = [];
      for (const a of anchors) {
        if (!sameHost(a, root.host)) continue;
        const e = extOf(a);
        if (e && ALL_DOC_EXTS.has(e)) {
          if (wantExts && !wantExts.has(e)) continue;
          if (!docs.has(a) && docs.size < MAX_DOCS) {
            docs.set(a, {
              url: a,
              ext: e,
              category: EXT_TO_CAT.get(e) || "other",
              foundOn: item.url,
            });
          }
        } else if (item.depth < maxDepth && looksLikeHtml(a) && !visited.has(a)) {
          next.push({ url: a, depth: item.depth + 1 });
        }
      }
      return next;
    }

    // Parallel BFS workers
    while (queue.length && pagesCrawled < maxPages && docs.size < MAX_DOCS) {
      const batch = queue.splice(0, CONCURRENCY);
      const results = await Promise.all(batch.map(processPage));
      for (const list of results) {
        for (const it of list) {
          if (!visited.has(it.url)) queue.push(it);
        }
      }
    }

    // Group by category, then by extension
    const byCategory: Record<string, { ext: string; count: number; urls: string[] }[]> = {};
    const extTally: Record<string, number> = {};
    for (const d of docs.values()) {
      extTally[d.ext] = (extTally[d.ext] || 0) + 1;
      byCategory[d.category] ||= [];
    }
    for (const cat of Object.keys(byCategory)) {
      const map = new Map<string, string[]>();
      for (const d of docs.values()) {
        if (d.category !== cat) continue;
        if (!map.has(d.ext)) map.set(d.ext, []);
        map.get(d.ext)!.push(d.url);
      }
      byCategory[cat] = [...map.entries()]
        .map(([ext, urls]) => ({ ext, count: urls.length, urls: urls.sort() }))
        .sort((a, b) => b.count - a.count);
    }

    const allDocs = [...docs.values()].map((d) => d.url).sort();

    return new Response(JSON.stringify({
      success: true,
      domain: root.host,
      origin: root.origin,
      pagesCrawled,
      totalDocs: docs.size,
      truncated: docs.size >= MAX_DOCS || pagesCrawled >= maxPages,
      maxPages,
      maxDepth,
      extTally,
      categories: byCategory,
      allDocs,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
