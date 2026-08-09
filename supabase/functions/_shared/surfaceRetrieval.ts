// ─────────────────────────────────────────────────────────────────────────────
// SURFACE RETRIEVAL TIER
//
// The open-web layer used to be a set of independent HTML scrapers called
// blindly in parallel. From edge (datacenter) IPs most of them are now either
// bot-blocked outright (Mojeek 403, MetaGer, Yandex) or served a soft challenge
// page with a 2xx status (DuckDuckGo returns HTTP 202 with the homepage). A 202
// passes `response.ok`, so the parser found zero result blocks and reported
// "no hits" instead of "blocked" — the run silently collapsed onto the API
// registries (Wikipedia / EDGAR / Crossref), which is the "everything is a gov
// site" symptom.
//
// This module replaces blind fan-out with a graded retrieval tier:
//   1. Providers that survive datacenter egress lead the wave — Bing RSS,
//      Google News RSS, Marginalia's public JSON API, Brave's current SERP DOM.
//   2. Every response is challenge-checked, not just status-checked.
//   3. Per-provider circuit breakers stop paying latency for a source that is
//      currently blocking this isolate.
//   4. If the lead wave lands under the yield floor, a reserve wave fires
//      instead of letting the run fall through to registries only.
//   5. Every call emits telemetry so a thin run can say *why* it was thin.
// ─────────────────────────────────────────────────────────────────────────────

export interface SurfaceHit {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  publishDate?: string;
}

export interface ProviderStat {
  engine: string;
  ok: boolean;
  hits: number;
  ms: number;
  status?: number;
  reason?: string;      // "blocked" | "challenge" | "empty" | "timeout" | "breaker" | error text
}

export interface SurfaceWave {
  hits: SurfaceHit[];
  telemetry: ProviderStat[];
  /** Distinct providers that returned at least one hit. */
  liveProviders: number;
  escalated: boolean;
}

// ── Egress shaping ───────────────────────────────────────────────────────────
// A single frozen UA across every provider is itself a fingerprint. Rotating a
// small pool of real, current desktop UAs with a matching header set costs
// nothing and measurably survives longer.
const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

function browserHeaders(accept: string, referer?: string): Record<string, string> {
  const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
  const h: Record<string, string> = {
    "User-Agent": ua,
    "Accept": accept,
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Upgrade-Insecure-Requests": "1",
  };
  if (referer) h["Referer"] = referer;
  return h;
}

// ── Circuit breakers (isolate-scoped) ────────────────────────────────────────
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60_000;
const breakers = new Map<string, { fails: number; openUntil: number }>();

function breakerOpen(engine: string): boolean {
  const b = breakers.get(engine);
  return !!b && b.openUntil > Date.now();
}
function noteFailure(engine: string) {
  const b = breakers.get(engine) ?? { fails: 0, openUntil: 0 };
  b.fails += 1;
  if (b.fails >= FAIL_THRESHOLD) { b.openUntil = Date.now() + COOLDOWN_MS; b.fails = 0; }
  breakers.set(engine, b);
}
function noteSuccess(engine: string) {
  breakers.set(engine, { fails: 0, openUntil: 0 });
}

/** Soft-block detection. A 2xx challenge page is a failure, not an empty index. */
const CHALLENGE = /(unusual traffic|are you a robot|captcha|cf-browser-verification|challenge-platform|Access Denied|detected unusual|blocked by|anomaly)/i;

function isChallenge(body: string, expectResultMarker?: RegExp): boolean {
  if (body.length < 1500) return true;
  if (CHALLENGE.test(body.slice(0, 4000))) return true;
  if (expectResultMarker && !expectResultMarker.test(body)) return true;
  return false;
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

const jitter = (base: number) => base + Math.floor(Math.random() * 250);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fetcher = (query: string, limit: number) => Promise<SurfaceHit[]>;

/** Wraps a provider with breaker, timing, one retry, and telemetry. */
async function runProvider(
  engine: string,
  fn: Fetcher,
  query: string,
  limit: number,
): Promise<{ hits: SurfaceHit[]; stat: ProviderStat }> {
  if (breakerOpen(engine)) {
    return { hits: [], stat: { engine, ok: false, hits: 0, ms: 0, reason: "breaker" } };
  }
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const hits = await fn(query, limit);
      if (hits.length) {
        noteSuccess(engine);
        return { hits, stat: { engine, ok: true, hits: hits.length, ms: Date.now() - started } };
      }
      if (attempt === 0) { await sleep(jitter(200)); continue; }
      noteFailure(engine);
      return { hits: [], stat: { engine, ok: false, hits: 0, ms: Date.now() - started, reason: "empty" } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 0 && !/blocked|challenge/i.test(msg)) { await sleep(jitter(300)); continue; }
      noteFailure(engine);
      return {
        hits: [],
        stat: { engine, ok: false, hits: 0, ms: Date.now() - started, reason: msg.slice(0, 120) },
      };
    }
  }
  return { hits: [], stat: { engine, ok: false, hits: 0, ms: Date.now() - started, reason: "empty" } };
}

const decode = (s: string) =>
  s.replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

function xmlItems(xml: string): string[] {
  const out: string[] = [];
  const re = /<item\b[\s\S]{0,6000}?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}
function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]{0,4000}?)</${tag}>`, "i"));
  if (!m) return "";
  return decode(m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, ""));
}

// ── Providers ────────────────────────────────────────────────────────────────

/**
 * Bing RSS. Microsoft still serves the classic RSS SERP without a challenge
 * from datacenter ranges, which makes it the most reliable general-web index
 * available to an edge function.
 */
export const bingRss: Fetcher = async (query, limit) => {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&count=${Math.min(limit, 30)}`;
  const r = await timedFetch(url, { headers: browserHeaders("application/rss+xml,text/xml;q=0.9") }, 8000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const xml = await r.text();
  return xmlItems(xml).slice(0, limit).map((b) => ({
    title: xmlTag(b, "title"),
    url: xmlTag(b, "link"),
    snippet: xmlTag(b, "description"),
    publishDate: xmlTag(b, "pubDate") || undefined,
    engine: "bing-rss",
  })).filter((h) => /^https?:\/\//.test(h.url) && h.title);
};

/** Google News RSS — the only Google surface that answers datacenter IPs. */
export const googleNewsRss: Fetcher = async (query, limit) => {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const r = await timedFetch(url, { headers: browserHeaders("application/rss+xml,text/xml;q=0.9") }, 8000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const xml = await r.text();
  return xmlItems(xml).slice(0, limit).map((b) => ({
    title: xmlTag(b, "title"),
    url: xmlTag(b, "link"),
    snippet: xmlTag(b, "source") || xmlTag(b, "description"),
    publishDate: xmlTag(b, "pubDate") || undefined,
    engine: "google-news",
  })).filter((h) => /^https?:\/\//.test(h.url) && h.title);
};

/** Marginalia — an independent crawler with a public JSON API, no key, no gate. */
export const marginalia: Fetcher = async (query, limit) => {
  const url = `https://api.marginalia.nu/public/search/${encodeURIComponent(query)}`;
  const r = await timedFetch(url, { headers: { Accept: "application/json", "User-Agent": UA_POOL[0] } }, 8000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const j = await r.json().catch(() => null);
  const rows: unknown[] = Array.isArray(j?.results) ? j.results : [];
  return rows.slice(0, limit).map((raw) => {
    const r2 = raw as Record<string, unknown>;
    return {
      title: String(r2.title ?? ""),
      url: String(r2.url ?? ""),
      snippet: String(r2.description ?? ""),
      engine: "marginalia",
    };
  }).filter((h) => /^https?:\/\//.test(h.url) && h.title);
};

/**
 * Brave SERP. Brave rebuilt its result DOM on Svelte, so the old
 * `result-header` regex matched nothing and Brave looked permanently dead
 * while actually returning a full 190 KB page of results.
 */
export const braveHtml: Fetcher = async (query, limit) => {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const r = await timedFetch(url, { headers: browserHeaders("text/html,application/xhtml+xml") }, 9000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const html = await r.text();
  if (isChallenge(html, /data-type="web"/)) throw new Error("challenge");

  const out: SurfaceHit[] = [];
  const blocks = html.split(/<div class="snippet[^"]*"/).slice(1);
  for (const block of blocks) {
    if (!/data-type="web"/.test(block.slice(0, 200))) continue;
    const href = block.match(/href="(https?:\/\/[^"]+)"/);
    if (!href) continue;
    const title = block.match(/class="title search-snippet-title[^"]*"[^>]*>([\s\S]{0,400}?)<\/div>/);
    const desc = block.match(/class="content [^"]*"[^>]*>([\s\S]{0,900}?)<\/div>/);
    const t = title ? decode(title[1]) : "";
    if (!t) continue;
    out.push({ title: t, url: href[1], snippet: desc ? decode(desc[1]) : "", engine: "brave" });
    if (out.length >= limit) break;
  }
  if (!out.length) throw new Error("challenge");
  return out;
};

/** Mojeek — independent index. 403s from most edge ranges; kept behind a breaker. */
export const mojeekHtml: Fetcher = async (query, limit) => {
  const url = `https://www.mojeek.com/search?q=${encodeURIComponent(query)}`;
  const r = await timedFetch(url, { headers: browserHeaders("text/html,application/xhtml+xml") }, 7000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const html = await r.text();
  if (isChallenge(html, /class="ob"/)) throw new Error("challenge");
  const out: SurfaceHit[] = [];
  const re = /<a[^>]*class="ob"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>([\s\S]{0,900}?)<p[^>]*class="s"[^>]*>([\s\S]{0,700}?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    out.push({ title: decode(m[2]), url: m[1], snippet: decode(m[4]), engine: "mojeek" });
  }
  if (!out.length) throw new Error("challenge");
  return out;
};

/**
 * DuckDuckGo HTML. Now answers edge IPs with HTTP 202 and the homepage — a
 * 2xx that carries no results. Status alone cannot detect that, so the body is
 * checked for the result marker before parsing.
 */
export const ddgHtml: Fetcher = async (query, limit) => {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await timedFetch(url, {
    method: "POST",
    headers: {
      ...browserHeaders("text/html,application/xhtml+xml", "https://duckduckgo.com/"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
  }, 8000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const html = await r.text();
  if (isChallenge(html, /class="result__a"/)) throw new Error("challenge");
  const out: SurfaceHit[] = [];
  const blocks = html.split(/class="result\s/).slice(1);
  for (const b of blocks) {
    const t = b.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]{0,400}?)<\/a>/);
    if (!t) continue;
    let u = t[1];
    const uddg = u.match(/uddg=([^&]*)/);
    if (uddg) u = decodeURIComponent(uddg[1]);
    if (!/^https?:\/\//.test(u)) continue;
    const s = b.match(/class="result__snippet"[^>]*>([\s\S]{0,900}?)<\/a>/);
    out.push({ title: decode(t[2]), url: u, snippet: s ? decode(s[1]) : "", engine: "ddg" });
    if (out.length >= limit) break;
  }
  if (!out.length) throw new Error("challenge");
  return out;
};

/**
 * Firecrawl — server-side search backend. Not a scraper, so it is immune to
 * the edge-IP problem, but it is rate-limited, which is why it leads only the
 * reserve wave rather than every query.
 */
export const firecrawlSearch: Fetcher = async (query, limit) => {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("no-key");
  const r = await timedFetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: Math.min(limit, 20) }),
  }, 12_000);
  if (!r.ok) throw new Error(`blocked:${r.status}`);
  const j = await r.json().catch(() => null);
  const items: unknown[] = Array.isArray(j?.data?.web) ? j.data.web
    : Array.isArray(j?.web) ? j.web
    : Array.isArray(j?.data) ? j.data : [];
  return items.map((raw) => {
    const it = raw as Record<string, unknown>;
    return {
      title: String(it.title ?? it.url ?? ""),
      url: String(it.url ?? ""),
      snippet: String(it.description ?? it.snippet ?? ""),
      engine: "firecrawl",
    };
  }).filter((h) => /^https?:\/\//.test(h.url) && h.title);
};

// ── Waves ────────────────────────────────────────────────────────────────────
// LEAD: verified to answer datacenter egress. RESERVE: worth trying, but each
// has a real chance of being blocked, so they only cost latency when the lead
// wave under-delivers.
const LEAD: Array<[string, Fetcher]> = [
  ["bing-rss", bingRss],
  ["brave", braveHtml],
  ["marginalia", marginalia],
  ["google-news", googleNewsRss],
];

const RESERVE: Array<[string, Fetcher]> = [
  ["firecrawl", firecrawlSearch],
  ["ddg", ddgHtml],
  ["mojeek", mojeekHtml],
];

export interface WaveOptions {
  limit?: number;
  /** Minimum unique URLs before the reserve wave is considered satisfied. */
  yieldFloor?: number;
  /** Minimum distinct live providers; corroboration needs more than one voice. */
  providerFloor?: number;
  includeReserve?: boolean;
}

function dedupe(hits: SurfaceHit[]): SurfaceHit[] {
  const seen = new Set<string>();
  const out: SurfaceHit[] = [];
  for (const h of hits) {
    const k = h.url.replace(/[#?].*$/, "").replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

/**
 * Run the surface tier. Never throws: a fully blocked wave returns zero hits
 * plus the telemetry explaining that it was blocked rather than empty.
 */
export async function runSurfaceWave(query: string, opts: WaveOptions = {}): Promise<SurfaceWave> {
  const limit = opts.limit ?? 15;
  const yieldFloor = opts.yieldFloor ?? 6;
  const providerFloor = opts.providerFloor ?? 2;
  const q = (query || "").trim();
  if (!q) return { hits: [], telemetry: [], liveProviders: 0, escalated: false };

  const telemetry: ProviderStat[] = [];
  const hits: SurfaceHit[] = [];

  const lead = await Promise.all(LEAD.map(([name, fn]) => runProvider(name, fn, q, limit)));
  for (const r of lead) { telemetry.push(r.stat); hits.push(...r.hits); }

  let merged = dedupe(hits);
  let live = telemetry.filter((t) => t.ok).length;
  let escalated = false;

  if (opts.includeReserve !== false && (merged.length < yieldFloor || live < providerFloor)) {
    escalated = true;
    const reserve = await Promise.all(RESERVE.map(([name, fn]) => runProvider(name, fn, q, limit)));
    for (const r of reserve) { telemetry.push(r.stat); hits.push(...r.hits); }
    merged = dedupe(hits);
    live = telemetry.filter((t) => t.ok).length;
  }

  console.log(JSON.stringify({
    fn: "surface-retrieval",
    q: q.slice(0, 90),
    hits: merged.length,
    live,
    escalated,
    providers: telemetry.map((t) => `${t.engine}:${t.ok ? t.hits : (t.reason ?? "fail")}`),
  }));

  return { hits: merged, telemetry, liveProviders: live, escalated };
}
