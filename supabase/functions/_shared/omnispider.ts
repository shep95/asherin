// ════════════════════════════════════════════════════════════════════════════
// OMNISPIDER — Multi-engine crawl orchestrator (Deno edge port).
// Source: github.com/shep95/web-crawlers (Omnispider TS).
// Adapted: no Playwright in edge runtime, so JS-render engine is stubbed and
// requests flagged jsRender are routed to the HTTP engine (best-effort) or
// to the Internet Archive when a snapshot exists.
//
// Implements the 5-layer pipeline:
//   INPUT   → seeds, sitemap/robots, wayback CDX, global ccTLD seeds
//   CORE    → SQLite-less in-memory frontier (priority + depth) + policy gate
//   ENGINES → http, archive (wayback), sitemap, katana-style link extraction
//   OUTPUT  → CrawledPage[] + extracted links + per-engine counts
// ════════════════════════════════════════════════════════════════════════════

export interface OmniCrawlConfig {
  seeds: string[];
  maxPages?: number;          // default 12
  maxDepth?: number;          // default 1
  allowedDomains?: string[];  // if set, frontier restricted to these
  sameOriginOnly?: boolean;   // restrict to seed origins
  respectRobots?: boolean;    // default true
  perDomainDelayMs?: number;  // politeness, default 250
  useSitemaps?: boolean;      // seed via sitemap.xml
  useWayback?: boolean;       // fall back to Wayback if live fetch fails
  useKatana?: boolean;        // aggressive link extraction (forms, JSON, JS)
  timeoutMs?: number;         // per-request, default 8000
  totalBudgetMs?: number;     // hard wall-clock cap, default 20000
  userAgent?: string;
}

export interface OmniCrawledPage {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  text: string;            // cleaned, trimmed
  links: string[];         // unique outbound URLs
  engine: 'http' | 'archive' | 'sitemap';
  fetchedAt: string;
  depth: number;
  bytes: number;
}

export interface OmniCrawlResult {
  pages: OmniCrawledPage[];
  skipped: { url: string; reason: string }[];
  engineCounts: Record<string, number>;
  durationMs: number;
  frontierRemaining: number;
}

const DEFAULT_UA = 'Mozilla/5.0 (compatible; OmnispiderEdge/1.0; +https://github.com/shep95/web-crawlers)';

// ── Utilities ────────────────────────────────────────────────────────────────
function safeUrl(u: string, base?: string): string | null {
  try { return new URL(u, base).toString(); } catch { return null; }
}
function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function origin(u: string): string {
  try { return new URL(u).origin; } catch { return ''; }
}
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]*>/g, '').trim().slice(0, 240) : '';
}
function extractLinks(html: string, base: string, katana = false): string[] {
  const out = new Set<string>();
  const reHref = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = reHref.exec(html)) !== null) {
    const u = safeUrl(m[1], base);
    if (u && /^https?:/i.test(u)) out.add(u.split('#')[0]);
  }
  if (katana) {
    // Katana-style: also grab form actions, src, data-href, and absolute URLs in JS/JSON blobs
    const reAttr = /(?:action|src|data-href|data-url)=["']([^"']+)["']/gi;
    while ((m = reAttr.exec(html)) !== null) {
      const u = safeUrl(m[1], base);
      if (u && /^https?:/i.test(u)) out.add(u.split('#')[0]);
    }
    const reAbs = /https?:\/\/[\w.\-]+(?:\/[^\s"'<>)]*)?/gi;
    while ((m = reAbs.exec(html)) !== null) {
      const u = safeUrl(m[0]);
      if (u) out.add(u.split('#')[0]);
    }
  }
  return Array.from(out);
}

// ── Robots.txt policy gate ───────────────────────────────────────────────────
const robotsCache = new Map<string, { disallows: string[]; fetchedAt: number }>();
async function loadRobots(originUrl: string, ua: string, timeoutMs: number): Promise<string[]> {
  const cached = robotsCache.get(originUrl);
  if (cached && Date.now() - cached.fetchedAt < 5 * 60_000) return cached.disallows;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), Math.min(timeoutMs, 4000));
    const r = await fetch(`${originUrl}/robots.txt`, { headers: { 'User-Agent': ua }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) { robotsCache.set(originUrl, { disallows: [], fetchedAt: Date.now() }); return []; }
    const txt = await r.text();
    const disallows: string[] = [];
    let appliesTo = false;
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      if (/^user-agent$/i.test(k)) appliesTo = v === '*' || ua.toLowerCase().includes(v.toLowerCase());
      else if (appliesTo && /^disallow$/i.test(k) && v) disallows.push(v);
    }
    robotsCache.set(originUrl, { disallows, fetchedAt: Date.now() });
    return disallows;
  } catch {
    robotsCache.set(originUrl, { disallows: [], fetchedAt: Date.now() });
    return [];
  }
}
function robotsAllows(url: string, disallows: string[]): boolean {
  if (!disallows.length) return true;
  let path = '/';
  try { path = new URL(url).pathname || '/'; } catch { /* */ }
  for (const d of disallows) { if (d === '/' || path.startsWith(d)) return false; }
  return true;
}

// ── Engines ──────────────────────────────────────────────────────────────────
async function engineHTTP(url: string, ua: string, timeoutMs: number): Promise<Response | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, {
      headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: ctl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

async function engineArchive(url: string, ua: string, timeoutMs: number): Promise<Response | null> {
  // Internet Archive availability API → Wayback snapshot.
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const avail = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': ua }, signal: ctl.signal,
    });
    clearTimeout(t);
    if (!avail.ok) return null;
    const j = await avail.json();
    const snap = j?.archived_snapshots?.closest?.url;
    if (!snap) return null;
    return await engineHTTP(snap, ua, timeoutMs);
  } catch { return null; }
}

async function discoverSitemap(originUrl: string, ua: string, timeoutMs: number, cap = 30): Promise<string[]> {
  const tryUrls = [`${originUrl}/sitemap.xml`, `${originUrl}/sitemap_index.xml`];
  const out: string[] = [];
  for (const u of tryUrls) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(u, { headers: { 'User-Agent': ua }, signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const xml = await r.text();
      const re = /<loc>([^<]+)<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null && out.length < cap) {
        const v = m[1].trim();
        if (/^https?:/i.test(v)) out.push(v);
      }
      if (out.length) break;
    } catch { /* next */ }
  }
  return out;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
export async function omnispiderCrawl(cfg: OmniCrawlConfig): Promise<OmniCrawlResult> {
  const started = Date.now();
  const ua = cfg.userAgent || DEFAULT_UA;
  const maxPages = Math.max(1, Math.min(cfg.maxPages ?? 12, 30));
  const maxDepth = Math.max(0, Math.min(cfg.maxDepth ?? 1, 3));
  const perDomainDelay = cfg.perDomainDelayMs ?? 250;
  const respectRobots = cfg.respectRobots !== false;
  const timeoutMs = cfg.timeoutMs ?? 8000;
  const budget = cfg.totalBudgetMs ?? 20000;

  const allowed = new Set((cfg.allowedDomains || []).map((d) => d.replace(/^www\./, '')));
  const seedHosts = new Set(cfg.seeds.map(host).filter(Boolean));

  type FrontierItem = { url: string; depth: number; priority: number };
  const frontier: FrontierItem[] = [];
  const seen = new Set<string>();
  const lastHit = new Map<string, number>();
  const pages: OmniCrawledPage[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const engineCounts: Record<string, number> = { http: 0, archive: 0, sitemap: 0 };

  const enqueue = (url: string, depth: number, priority = 5) => {
    const n = safeUrl(url);
    if (!n) return;
    const key = n.split('#')[0];
    if (seen.has(key)) return;
    if (depth > maxDepth) return;
    const h = host(key); if (!h) return;
    if (allowed.size && !allowed.has(h)) return;
    if (cfg.sameOriginOnly && !seedHosts.has(h)) return;
    seen.add(key);
    frontier.push({ url: key, depth, priority });
  };

  // INPUT layer — seeds
  for (const s of cfg.seeds) enqueue(s, 0, 0);

  // INPUT layer — sitemap discovery for each seed origin
  if (cfg.useSitemaps !== false) {
    const origins = Array.from(new Set(cfg.seeds.map(origin).filter(Boolean)));
    const sitemapBatches = await Promise.allSettled(
      origins.slice(0, 4).map((o) => discoverSitemap(o, ua, timeoutMs, 12)),
    );
    for (const b of sitemapBatches) {
      if (b.status !== 'fulfilled') continue;
      for (const u of b.value) enqueue(u, 0, 3);
      if (b.value.length) engineCounts.sitemap += b.value.length;
    }
  }

  // CORE loop — pop by (priority asc, depth asc)
  while (pages.length < maxPages && frontier.length && (Date.now() - started) < budget) {
    frontier.sort((a, b) => a.priority - b.priority || a.depth - b.depth);
    const item = frontier.shift()!;
    const url = item.url;
    const o = origin(url); if (!o) { skipped.push({ url, reason: 'bad-origin' }); continue; }

    // POLICY — robots.txt
    if (respectRobots) {
      const dis = await loadRobots(o, ua, timeoutMs);
      if (!robotsAllows(url, dis)) { skipped.push({ url, reason: 'robots-disallow' }); continue; }
    }

    // POLICY — per-domain politeness
    const h = host(url);
    const last = lastHit.get(h) || 0;
    const wait = perDomainDelay - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 400)));
    lastHit.set(h, Date.now());

    // ENGINE ROUTER — auto: http first, archive on failure/403/404
    let resp = await engineHTTP(url, ua, timeoutMs);
    let engine: OmniCrawledPage['engine'] = 'http';
    if ((!resp || !resp.ok || resp.status >= 400) && cfg.useWayback !== false) {
      const arc = await engineArchive(url, ua, timeoutMs);
      if (arc && arc.ok) { resp = arc; engine = 'archive'; }
    }
    if (!resp) { skipped.push({ url, reason: 'fetch-failed' }); continue; }
    const ct = resp.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml|application\/xml/i.test(ct)) {
      skipped.push({ url, reason: `non-html:${ct.split(';')[0]}` });
      try { await resp.body?.cancel(); } catch { /* */ }
      continue;
    }
    const html = await resp.text();
    const text = cleanHtml(
      (html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]) ||
      (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]) ||
      (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]) || html
    ).slice(0, 5000);
    const links = extractLinks(html, url, cfg.useKatana === true);

    pages.push({
      url,
      finalUrl: resp.url || url,
      status: resp.status,
      title: extractTitle(html),
      text,
      links: links.slice(0, 50),
      engine,
      fetchedAt: new Date().toISOString(),
      depth: item.depth,
      bytes: html.length,
    });
    engineCounts[engine] = (engineCounts[engine] || 0) + 1;

    // OUTPUT → LINKS → expand frontier
    for (const l of links) enqueue(l, item.depth + 1, 5 + item.depth);
  }

  return {
    pages,
    skipped,
    engineCounts,
    durationMs: Date.now() - started,
    frontierRemaining: frontier.length,
  };
}
