// ============================================================================
// ZOPHIEL SHADOW LAYER
// ----------------------------------------------------------------------------
// Proactive discovery of live-but-un-indexed hosts. NOT another search wrapper.
//
// Design (narrative-audited):
//   • Never fetches from an unbounded IP space — anchors on a seed the user
//     already supplied (domain, keyword, or TLD).
//   • Only speaks HTTP(S). No socket-level port scan. Non-HTTP ports would
//     return silence anyway from an edge function.
//   • Only probes HTTP-adjacent ports (80/443/8080/8443/8888/3000/5000/7000/
//     8000/9000/9090). No auth attempts. No POST during probe.
//   • Passive legs (crt.sh, hackertarget, otx, wayback-cdx, urlscan, grep.app)
//     run in parallel with `Promise.allSettled` + per-leg 8s abort.
//   • Optional BYOK legs: Shodan, FOFA (base64 query), Netlas.
//   • Obscurity score fuses: no-wayback × non-standard-port × obscure-tld
//     × open-directory-body × zero-cert-neighbors.
// ----------------------------------------------------------------------------

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// -------- constants -----------------------------------------------------------
const OBSCURE_TLDS = new Set([
  "xyz","top","icu","buzz","country","cf","ml","gq","tk","ru","su","cc","ws",
  "info","site","online","click","link","live","pw","surf","fun","host","space",
  "monster","rest","quest","cyou","sbs","world","today","zone","press","party",
  "loan","review","stream","download","science","racing","win","men","date",
]);
const HTTP_ADJACENT_PORTS = [443, 80, 8080, 8443, 8888, 3000, 5000, 7000, 8000, 9000, 9090];
const LEG_TIMEOUT_MS = 18_000;
const PROBE_TIMEOUT_MS = 3_000;
const MAX_HOSTS_TO_PROBE = 60;
const MAX_BODY_BYTES = 32 * 1024;

// -------- utilities -----------------------------------------------------------
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
function timedFetch(url: string, opts: RequestInit = {}, ms = LEG_TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal, redirect: "follow" })
    .finally(() => clearTimeout(t));
}
function tldOf(host: string) { const p = host.split("."); return p[p.length - 1]?.toLowerCase() || ""; }
function isObscureTld(host: string) { return OBSCURE_TLDS.has(tldOf(host)); }
function looksIndexOf(body: string) {
  return /index of \//i.test(body) || /<title>index of/i.test(body);
}

// -------- passive discovery legs ---------------------------------------------
async function legCrtSh(seed: string): Promise<string[]> {
  const q = encodeURIComponent(`%.${seed}`);
  const r = await timedFetch(`https://crt.sh/?q=${q}&output=json`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return [];
  const j = await r.json().catch(() => []);
  const set = new Set<string>();
  for (const row of Array.isArray(j) ? j : []) {
    for (const n of String(row?.name_value || "").split(/\n/)) {
      const h = n.trim().toLowerCase().replace(/^\*\./, "");
      if (h && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) set.add(h);
    }
  }
  return [...set];
}
async function legHackerTarget(seed: string): Promise<string[]> {
  const r = await timedFetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(seed)}`);
  if (!r.ok) return [];
  const txt = await r.text();
  return txt.split(/\r?\n/).map(l => l.split(",")[0]?.trim().toLowerCase()).filter(Boolean) as string[];
}
async function legOtx(seed: string): Promise<string[]> {
  const r = await timedFetch(`https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(seed)}/passive_dns`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const rows = Array.isArray(j?.passive_dns) ? j.passive_dns : [];
  return [...new Set<string>(rows.map((r: any) => String(r?.hostname || "").toLowerCase()).filter(Boolean))];
}
async function legWaybackCdx(seed: string): Promise<{host: string; url: string}[]> {
  // Original URLs Wayback saw *once* and never again — good "forgotten" signal.
  const u = `https://web.archive.org/cdx/search/cdx?url=*.${encodeURIComponent(seed)}/*&output=json&fl=original&collapse=urlkey&limit=200`;
  const r = await timedFetch(u);
  if (!r.ok) return [];
  const rows = (await r.json().catch(() => [])) as string[][];
  const out: {host: string; url: string}[] = [];
  for (const row of rows.slice(1)) {
    try { const p = new URL(row[0]); out.push({ host: p.hostname.toLowerCase(), url: row[0] }); } catch {}
  }
  return out;
}
async function legUrlscan(seed: string): Promise<{host: string; url: string}[]> {
  const r = await timedFetch(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(`domain:${seed}`)}&size=100`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const rows = Array.isArray(j?.results) ? j.results : [];
  return rows.map((x: any) => ({
    host: String(x?.page?.domain || "").toLowerCase(),
    url:  String(x?.page?.url || ""),
  })).filter((x: any) => x.host);
}
async function legGrepApp(seed: string): Promise<{host: string; url: string; snippet: string}[]> {
  // GitHub-wide code search for "seed:PORT" leaks — surfaces hosts written in
  // source but never linked in HTML pages.
  const r = await timedFetch(`https://grep.app/api/search?q=${encodeURIComponent(seed)}&limit=30`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const hits = Array.isArray(j?.hits?.hits) ? j.hits.hits : [];
  const out: {host: string; url: string; snippet: string}[] = [];
  for (const h of hits) {
    const snippet = String(h?.content?.snippet || "").slice(0, 300);
    const m = snippet.match(/([a-z0-9-]+\.(?:[a-z0-9-]+\.)+[a-z]{2,})(?::(\d{2,5}))?/i);
    if (m) out.push({ host: m[1].toLowerCase(), url: `https://${m[1]}${m[2] ? `:${m[2]}` : ""}`, snippet });
  }
  return out;
}

// -------- BYOK legs (optional) -----------------------------------------------
async function legShodan(seed: string, key: string): Promise<{host: string; url: string; port: number}[]> {
  const q = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(seed) ? `hostname:${seed}` : seed;
  const r = await timedFetch(`https://api.shodan.io/shodan/host/search?key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&limit=50`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  const matches = Array.isArray(j?.matches) ? j.matches : [];
  const out: {host: string; url: string; port: number}[] = [];
  for (const m of matches) {
    const host = (m?.hostnames?.[0] as string) || m?.ip_str;
    const port = Number(m?.port) || 80;
    if (!host) continue;
    const scheme = port === 443 || port === 8443 ? "https" : "http";
    out.push({ host, port, url: `${scheme}://${host}:${port}` });
  }
  return out;
}
async function legFofa(seed: string, key: string, email: string): Promise<string[]> {
  const q = btoa(`domain="${seed}"`);
  const r = await timedFetch(`https://fofa.info/api/v1/search/all?email=${encodeURIComponent(email)}&key=${encodeURIComponent(key)}&qbase64=${encodeURIComponent(q)}&size=50&fields=host`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (Array.isArray(j?.results) ? j.results.flat() : []).filter(Boolean) as string[];
}

// -------- liveness probe -----------------------------------------------------
interface Probe {
  url: string; host: string; port: number; scheme: "http"|"https";
  status: number; server?: string; title?: string;
  bytes: number; contentType?: string;
  openDirectory: boolean; obscureTld: boolean; nonStandardPort: boolean;
  latencyMs: number;
}
async function probeOne(host: string, port: number): Promise<Probe | null> {
  const scheme: "http"|"https" = (port === 443 || port === 8443) ? "https" : "http";
  const url = `${scheme}://${host}${(port === 80 || port === 443) ? "" : `:${port}`}/`;
  const t0 = Date.now();
  try {
    const r = await timedFetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Zophiel-Shadow/1.0 discovery)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.5",
      },
    }, PROBE_TIMEOUT_MS);
    const ct = r.headers.get("content-type") || "";
    const server = r.headers.get("server") || undefined;
    // Read at most 32KB
    let body = ""; let bytes = 0;
    try {
      const reader = r.body?.getReader();
      if (reader) {
        while (bytes < MAX_BODY_BYTES) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          bytes += value.byteLength;
          if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml")) {
            body += new TextDecoder().decode(value);
          }
          if (bytes >= MAX_BODY_BYTES) { try { reader.cancel(); } catch {} break; }
        }
      }
    } catch {}
    const titleMatch = body.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    return {
      url, host, port, scheme,
      status: r.status,
      server,
      title: titleMatch?.[1]?.trim(),
      bytes, contentType: ct || undefined,
      openDirectory: looksIndexOf(body),
      obscureTld: isObscureTld(host),
      nonStandardPort: !(port === 80 || port === 443),
      latencyMs: Date.now() - t0,
    };
  } catch {
    return null;
  }
}

// bounded-concurrency map
async function pool<T,R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

// -------- obscurity scoring --------------------------------------------------
function scoreObscurity(p: Probe, waybackHosts: Set<string>, ctNeighborCount: Map<string, number>) {
  let s = 0;
  if (!waybackHosts.has(p.host)) s += 40;                  // never archived
  if (p.nonStandardPort) s += 20;
  if (p.obscureTld) s += 15;
  if (p.openDirectory) s += 15;
  const nb = ctNeighborCount.get(p.host.split(".").slice(-2).join(".")) ?? 0;
  if (nb <= 3) s += 10;                                    // small cert neighborhood
  return Math.min(100, s);
}

// -------- request handler ----------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const seedRaw = String(body?.seed || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!seedRaw || seedRaw.length > 253) {
    return new Response(JSON.stringify({ error: "seed required (domain or keyword)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // Reject raw CIDR / IP-block scans — safety guard from narrative flaw #3.
  if (/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(seedRaw)) {
    return new Response(JSON.stringify({ error: "raw IP/CIDR seeds are refused — supply a domain or keyword" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const isDomainSeed = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(seedRaw);
  const shodanKey = typeof body?.shodanKey === "string" ? body.shodanKey : null;
  const fofaKey   = typeof body?.fofaKey   === "string" ? body.fofaKey   : null;
  const fofaEmail = typeof body?.fofaEmail === "string" ? body.fofaEmail : null;

  const started = Date.now();
  const legStatus: Record<string, { ok: boolean; count: number; ms: number; error?: string }> = {};

  const legWrap = async <T,>(name: string, p: Promise<T>): Promise<T | null> => {
    const t0 = Date.now();
    try {
      const v = await withTimeout(p, LEG_TIMEOUT_MS + 500, name);
      const count = Array.isArray(v as any) ? (v as any).length : v ? 1 : 0;
      legStatus[name] = { ok: true, count, ms: Date.now() - t0 };
      return v;
    } catch (e) {
      legStatus[name] = { ok: false, count: 0, ms: Date.now() - t0, error: (e as Error).message };
      return null;
    }
  };

  // ---------- passive fan-out (parallel) ----------
  const [ct, ht, otx, wb, us, gp, sh, ff] = await Promise.all([
    isDomainSeed ? legWrap("crt.sh", legCrtSh(seedRaw)) : Promise.resolve<string[]>([]),
    isDomainSeed ? legWrap("hackertarget", legHackerTarget(seedRaw)) : Promise.resolve<string[]>([]),
    isDomainSeed ? legWrap("otx", legOtx(seedRaw)) : Promise.resolve<string[]>([]),
    legWrap("wayback_cdx", legWaybackCdx(seedRaw)),
    legWrap("urlscan", legUrlscan(seedRaw)),
    legWrap("grep_app", legGrepApp(seedRaw)),
    shodanKey ? legWrap("shodan", legShodan(seedRaw, shodanKey)) : Promise.resolve(null),
    (fofaKey && fofaEmail && isDomainSeed) ? legWrap("fofa", legFofa(seedRaw, fofaKey, fofaEmail)) : Promise.resolve(null),
  ]);

  // ---------- fuse host universe ----------
  const hostSet = new Set<string>();
  const shodanTargets: {host: string; port: number}[] = [];
  const waybackHosts = new Set<string>();
  const ctNeighborCount = new Map<string, number>();

  (ct || []).forEach(h => {
    hostSet.add(h);
    const root = h.split(".").slice(-2).join(".");
    ctNeighborCount.set(root, (ctNeighborCount.get(root) || 0) + 1);
  });
  (ht || []).forEach(h => hostSet.add(h));
  (otx || []).forEach(h => hostSet.add(h));
  (wb || []).forEach(r => { hostSet.add(r.host); waybackHosts.add(r.host); });
  (us || []).forEach(r => { hostSet.add(r.host); });
  (gp || []).forEach(r => hostSet.add(r.host));
  (sh || []).forEach(r => { hostSet.add(r.host); shodanTargets.push({ host: r.host, port: r.port }); });
  (ff || []).forEach(entry => {
    const s = String(entry);
    const m = s.match(/^(?:https?:\/\/)?([a-z0-9.-]+)(?::(\d+))?/i);
    if (m) { hostSet.add(m[1].toLowerCase()); if (m[2]) shodanTargets.push({ host: m[1].toLowerCase(), port: Number(m[2]) }); }
  });

  // Seed itself is not the target — we want NEW hosts. Keep it if it's a keyword.
  const hostList = [...hostSet]
    .filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h))
    .filter(h => !h.startsWith("www.") || !hostSet.has(h.slice(4)))  // dedup www.
    .slice(0, MAX_HOSTS_TO_PROBE);

  // ---------- liveness probe ----------
  // Build target list: prefer explicit shodan (host,port) pairs, then each host
  // gets probed on 443 + 80. If shodan gave no probes, expand top-10 hosts to
  // include one non-standard port (8080) — hard-capped to keep under budget.
  const probeTargets = new Map<string, {host:string; port:number}>();
  for (const s of shodanTargets.slice(0, 40)) probeTargets.set(`${s.host}:${s.port}`, s);
  for (const h of hostList) {
    probeTargets.set(`${h}:443`, { host: h, port: 443 });
  }
  for (const h of hostList.slice(0, 20)) {
    probeTargets.set(`${h}:80`, { host: h, port: 80 });
  }
  for (const h of hostList.slice(0, 10)) {
    probeTargets.set(`${h}:8080`, { host: h, port: 8080 });
    probeTargets.set(`${h}:8443`, { host: h, port: 8443 });
    probeTargets.set(`${h}:8888`, { host: h, port: 8888 });
  }
  const targets = [...probeTargets.values()].slice(0, 180);

  const probeResults = (await pool(targets, 20, ({ host, port }) => probeOne(host, port)))
    .filter((x): x is Probe => !!x && x.status < 500 && x.status !== 404);

  // Dedup: prefer https over http on same host+port pair; keep best-status.
  const byUrl = new Map<string, Probe>();
  for (const p of probeResults) {
    const key = `${p.host}:${p.port}`;
    const cur = byUrl.get(key);
    if (!cur || (cur.status >= 400 && p.status < 400)) byUrl.set(key, p);
  }
  const alive = [...byUrl.values()];

  // Score + sort by obscurity desc
  const scored = alive.map(p => ({
    ...p,
    obscurity: scoreObscurity(p, waybackHosts, ctNeighborCount),
    signals: [
      !waybackHosts.has(p.host) ? "never-in-wayback" : null,
      p.nonStandardPort ? `non-std-port:${p.port}` : null,
      p.obscureTld ? `obscure-tld:.${tldOf(p.host)}` : null,
      p.openDirectory ? "open-directory" : null,
      ((ctNeighborCount.get(p.host.split(".").slice(-2).join(".")) ?? 0) <= 3) ? "small-cert-neighborhood" : null,
    ].filter(Boolean) as string[],
  })).sort((a, b) => b.obscurity - a.obscurity);

  return new Response(JSON.stringify({
    success: true,
    seed: seedRaw,
    seedType: isDomainSeed ? "domain" : "keyword",
    hostsDiscovered: hostList.length,
    hostsAlive: scored.length,
    elapsedMs: Date.now() - started,
    legs: legStatus,
    hits: scored,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
