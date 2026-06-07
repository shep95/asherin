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

// Well-known URL path segments that mean "this page IS a document"
// (e.g. https://scribd.com/document/123/Title  → a PDF document page).
// We treat these like docs even when the URL has no file extension.
const DEFAULT_DOC_PATH_SEGMENTS = new Set([
  "document", "documents", "doc", "docs",
  "book", "books", "ebook", "ebooks",
  "audiobook", "audiobooks",
  "presentation", "presentations", "slides", "slide",
  "sheet-music", "sheets", "sheet",
  "paper", "papers",
  "article", "articles",
  "publication", "publications",
  "report", "reports",
  "magazine", "magazines",
  "podcast", "podcasts", "episode",
  "file", "files",
  "download", "downloads",
  "pdf", "pdfs",
  "manual", "manuals",
  "thesis", "dissertation",
  "issue", "issues",
  "chapter", "chapters",
]);

function firstPathSegment(url: string): string | null {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean);
    return p[0]?.toLowerCase() ?? null;
  } catch { return null; }
}


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
  // Embedded iframe/object/embed/source/data attributes pointing to files
  const re2 = /\b(?:src|data)\s*=\s*["']([^"']+\.(?:pdf|docx?|xlsx?|pptx?|csv|epub|zip|mp3|mp4))["']/gi;
  while ((m = re2.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base).toString().split("#")[0];
      if (/^https?:/i.test(abs)) out.push(abs);
    } catch { /* ignore */ }
  }
  return out;
}

// Hunt the raw HTML (including JSON inside <script> tags used by SPAs like
// Next.js / React) for URLs that look like document landing pages or direct
// file downloads. This is what catches Scribd / Issuu / Slideshare cards
// that aren't rendered as <a href> in the initial HTML.
function extractEmbeddedUrls(html: string, base: string, docPathPatterns: Set<string>): string[] {
  const out = new Set<string>();
  let baseOrigin = "";
  try { baseOrigin = new URL(base).origin; } catch { /* ignore */ }

  // 1) Doc-page paths anywhere in the document: "/document/123/Title",
  //    "\u002Fdocument\u002F456\u002FFoo", "https://host/document/789/..."
  for (const seg of docPathPatterns) {
    const esc = seg.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    // Matches: /seg/<anything-but-slash-or-quote>/<anything-but-quote>
    // Allows backslash-escaped slashes (\u002F or \/) used in JSON.
    const re = new RegExp(
      `(?:https?:(?:\\\\?\\/){2}[^"'\\s\\\\]+)?(?:\\\\?\\/)${esc}(?:\\\\?\\/)[^"'\\s\\\\<>]{1,250}`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let raw = m[0]
        .replace(/\\u002[Ff]/g, "/")
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&");
      try {
        const abs = new URL(raw, baseOrigin || base).toString().split("#")[0];
        if (/^https?:/i.test(abs)) out.add(abs);
      } catch { /* ignore */ }
      if (out.size > 4000) break;
    }
  }

  // 2) Direct file downloads anywhere in the markup or JSON
  const fileRe = /(?:https?:(?:\\?\/){2}[^"'\s\\]+|(?:\\?\/)[^\s"'<>]+)\.(?:pdf|docx?|xlsx?|pptx?|csv|tsv|epub|mobi|azw3?|zip|rar|7z|tar|gz|tgz|mp3|mp4|m4a|wav|flac|jpg|jpeg|png|gif|webp|svg|json|xml|txt|rtf|odt|ods|odp)\b/gi;
  let fm: RegExpExecArray | null;
  while ((fm = fileRe.exec(html)) !== null) {
    let raw = fm[0]
      .replace(/\\u002[Ff]/g, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
    try {
      const abs = new URL(raw, baseOrigin || base).toString().split("#")[0];
      if (/^https?:/i.test(abs)) out.add(abs);
    } catch { /* ignore */ }
    if (out.size > 4000) break;
  }

  return [...out];
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
      docPathPatterns?: string[]; // first path segments to treat as document pages (e.g. "document","book")
      entryUrl?: string; // exact URL the user typed — used as the priority seed
    
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

    // Doc-page path segments: defaults + caller-supplied (from mapper categories).
    const docPathPatterns = new Set<string>(DEFAULT_DOC_PATH_SEGMENTS);
    for (const p of body.docPathPatterns || []) {
      const seg = p.toLowerCase().replace(/^\/+|\/+$/g, "").split("/")[0];
      if (seg) docPathPatterns.add(seg);
    }

    // Seed queue: caller's exact entry URL (HIGHEST priority — this is the
    // page the user actually typed, e.g. /search?query=military), plus any
    // additional seeds from the mapper, plus the homepage as a fallback.
    const seeds: string[] = [];
    const entryUrl = typeof body.entryUrl === "string" ? body.entryUrl.trim() : "";
    if (entryUrl) {
      try {
        const u = new URL(/^https?:\/\//i.test(entryUrl) ? entryUrl : `https://${entryUrl}`);
        if (sameHost(u.toString(), root.host)) seeds.push(u.toString());
      } catch { /* ignore */ }
    }
    for (const s of body.seedUrls || []) {
      if (sameHost(s, root.host) && looksLikeHtml(s) && !seeds.includes(s)) seeds.push(s);
    }
    if (!seeds.length) seeds.push(root.origin + "/");

    type QItem = { url: string; depth: number };
    const queue: QItem[] = seeds.map((u) => ({ url: u, depth: 0 }));
    const visited = new Set<string>();
    const docs = new Map<string, { url: string; ext: string; category: string; foundOn: string }>();
    let pagesCrawled = 0;

    function addDoc(url: string, ext: string, category: string, foundOn: string) {
      if (docs.has(url) || docs.size >= MAX_DOCS) return;
      if (wantExts && !wantExts.has(ext)) return;
      docs.set(url, { url, ext, category, foundOn });
    }

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
      // Combine standard <a href> anchors with URLs hidden inside embedded
      // JSON / script tags (Next.js __NEXT_DATA__, React state, etc.) —
      // SPAs like Scribd render their cards from JSON, not <a> tags.
      const anchors = extractAnchors(html, item.url);
      const embedded = extractEmbeddedUrls(html, item.url, docPathPatterns);
      const allLinks = [...new Set([...anchors, ...embedded])];
      const next: QItem[] = [];
      for (const a of allLinks) {
        if (!sameHost(a, root.host)) continue;
        const e = extOf(a);
        const seg = firstPathSegment(a);
        // 1) Direct file download (.pdf, .docx, .zip, etc.)
        if (e && ALL_DOC_EXTS.has(e)) {
          addDoc(a, e, EXT_TO_CAT.get(e) || "other", item.url);
          continue;
        }
        // 2) Document landing page (e.g. /document/123/Title, /book/456/Foo)
        if (seg && docPathPatterns.has(seg)) {
          // Only count "real" doc pages — must have at least one extra path segment
          // (e.g. /document/123/... not just /document or /document/)
          try {
            const path = new URL(a).pathname.split("/").filter(Boolean);
            if (path.length >= 2) {
              addDoc(a, "html", `page:${seg}`, item.url);
              // Also keep crawling deeper inside doc collections (helps pagination
              // on /docs, /books pages where individual items live one click away)
              if (item.depth < maxDepth && !visited.has(a)) {
                next.push({ url: a, depth: item.depth + 1 });
              }
              continue;
            }
          } catch { /* ignore */ }
        }
        // 3) Otherwise enqueue for crawling if HTML and within depth budget
        if (item.depth < maxDepth && looksLikeHtml(a) && !visited.has(a)) {
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
