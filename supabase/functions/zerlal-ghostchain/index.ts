// ZERLAL · GhostChain port — defensive exposure scanner
// Source: https://github.com/shep95/link-backend-scrapper
// Ported to Deno edge runtime. Performs DNS, TLS SAN discovery via crt.sh,
// bounded crawl, wordlist discovery, passive audits, secret scan,
// live API-key testing, and AI-driven narrative + exploit map.

import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey } from "../_shared/adminGate.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;

type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type FindingType =
  | "SECURITY_HEADERS" | "COOKIE_MISCONFIG" | "CORS_MISCONFIG"
  | "REDIRECT_HYGIENE" | "DIR_LISTING" | "SOURCEMAP_EXPOSED"
  | "SECRET_POSSIBLE" | "EXPOSED_BACKUP" | "EXPOSED_LOG"
  | "EXPOSED_CONFIG" | "DEBUG_ENDPOINT" | "OPENAPI_EXPOSED"
  | "TLS_POSTURE" | "INFO";

interface Finding {
  id: string; target: string; url: string; type: FindingType;
  severity: Severity; confidence: number;
  evidence: { summary: string; anchors?: Record<string, string>; sample?: string };
  created_at: string;
}

interface ApiKeyProbe {
  id: string; key_type: string; source: string; masked_key: string;
  format_valid: boolean; live_tested: boolean;
  test_result: "valid" | "invalid" | "restricted" | "dangerous_public" | "unknown";
  details: string; recommendation: string;
}

interface CodeFlaw {
  id: string; file: string; line: number; pattern: string;
  title: string; severity: Severity; category: string;
  evidence: string; remediation: string;
}

interface ExploitScenario {
  id: string; title: string; severity: Severity; attack_vector: string;
  takedown_risk: string; prerequisites: string[]; steps: string[];
  patches: string[]; related_flaws: string[]; related_findings: string[];
}

// =================== HTTP CLIENT (with rate-limit & timeout) =====================
const HOST_BUCKETS = new Map<string, { tokens: number; last: number; inflight: number }>();
const MAX_RPS_PER_HOST = 5;
const MAX_CONCURRENCY_PER_HOST = 8;

async function safeFetch(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response | null> {
  const host = (() => { try { return new URL(url).hostname; } catch { return "_"; } })();
  const b = HOST_BUCKETS.get(host) || { tokens: MAX_RPS_PER_HOST, last: Date.now(), inflight: 0 };
  while (b.inflight >= MAX_CONCURRENCY_PER_HOST) await new Promise(r => setTimeout(r, 50));
  const now = Date.now();
  const refill = ((now - b.last) / 1000) * MAX_RPS_PER_HOST;
  b.tokens = Math.min(MAX_RPS_PER_HOST, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) {
    await new Promise(r => setTimeout(r, Math.ceil(((1 - b.tokens) / MAX_RPS_PER_HOST) * 1000)));
    b.tokens = 1;
  }
  b.tokens -= 1;
  b.inflight += 1;
  HOST_BUCKETS.set(host, b);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      ...init,
      signal: ctl.signal,
      headers: { "User-Agent": "GhostChain-ZERLAL/1.0 (+aureonai.app)", ...(init.headers || {}) },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
    b.inflight -= 1;
    HOST_BUCKETS.set(host, b);
  }
}

function headersToObj(h: Headers): Record<string, string> {
  const o: Record<string, string> = {};
  h.forEach((v, k) => { o[k.toLowerCase()] = v; });
  return o;
}

// =================== AUDITS (port of packages/engine/src/audits/*) ===============
function auditSecurityHeaders(sid: string, t: string, url: string, h: Record<string, string>): Finding[] {
  const needed = ["content-security-policy", "strict-transport-security", "x-frame-options", "referrer-policy"];
  const missing = needed.filter(n => !h[n]);
  if (!missing.length) return [];
  return [{
    id: uid("finding"), target: t, url, type: "SECURITY_HEADERS",
    severity: missing.includes("content-security-policy") ? "MEDIUM" : "LOW",
    confidence: 0.9, created_at: nowIso(),
    evidence: { summary: `Missing security headers: ${missing.join(", ")}`,
      anchors: Object.fromEntries(missing.map(m => [m, "missing"])) },
  }];
}

function auditCookies(sid: string, t: string, url: string, h: Record<string, string>): Finding[] {
  const sc = h["set-cookie"]; if (!sc) return [];
  const out: Finding[] = [];
  for (const c of sc.split("\n").map(s => s.trim()).filter(Boolean)) {
    const low = c.toLowerCase();
    const bad: string[] = [];
    if (!low.includes("httponly")) bad.push("HttpOnly");
    if (!low.includes("secure")) bad.push("Secure");
    if (!low.includes("samesite")) bad.push("SameSite");
    if (bad.length) out.push({
      id: uid("finding"), target: t, url, type: "COOKIE_MISCONFIG", severity: "MEDIUM",
      confidence: 0.75, created_at: nowIso(),
      evidence: { summary: `Cookie missing attributes: ${bad.join(", ")}`, anchors: { cookie: c.slice(0, 200) } },
    });
  }
  return out;
}

function auditCors(sid: string, t: string, url: string, h: Record<string, string>): Finding[] {
  const aco = h["access-control-allow-origin"]; const acc = h["access-control-allow-credentials"];
  if (!aco) return [];
  if (!(aco.trim() === "*" && acc?.toLowerCase().trim() === "true")) return [];
  return [{
    id: uid("finding"), target: t, url, type: "CORS_MISCONFIG", severity: "HIGH",
    confidence: 0.95, created_at: nowIso(),
    evidence: { summary: "CORS allows '*' with credentials=true",
      anchors: { "access-control-allow-origin": aco, "access-control-allow-credentials": acc ?? "" } },
  }];
}

const SUSP_PARAMS = ["next","redirect","return","url","continue","redirect_uri","dest","target","return_url","callback"];
function auditRedirectHygiene(sid: string, t: string, url: string, h: Record<string, string>): Finding[] {
  const loc = h["location"]; if (!loc) return [];
  let external = false;
  try { const l = new URL(loc, url); external = l.hostname.toLowerCase() !== new URL(url).hostname.toLowerCase(); } catch { /* */ }
  const suspicious = SUSP_PARAMS.some(p => loc.toLowerCase().includes(`${p}=`));
  if (!external && !suspicious) return [];
  return [{
    id: uid("finding"), target: t, url, type: "REDIRECT_HYGIENE",
    severity: external ? "MEDIUM" : "LOW", confidence: external ? 0.85 : 0.65,
    created_at: nowIso(),
    evidence: { summary: external ? "External redirect — review for open-redirect risk" : "Suspicious redirect parameter", anchors: { location: loc, url } },
  }];
}

const DIR_SIGS = ["index of /", "directory listing for", "<title>index of", "parent directory</a>"];
function auditDirListing(sid: string, t: string, url: string, status: number, body: string): Finding[] {
  if (status !== 200) return [];
  const low = body.slice(0, 50_000).toLowerCase();
  const hit = DIR_SIGS.find(s => low.includes(s));
  if (!hit) return [];
  return [{
    id: uid("finding"), target: t, url, type: "DIR_LISTING", severity: "HIGH",
    confidence: 0.85, created_at: nowIso(),
    evidence: { summary: "Possible directory listing detected", anchors: { signature: hit, url } },
  }];
}

function auditSourcemaps(sid: string, t: string, url: string, status: number, ct: string): Finding[] {
  if (status !== 200) return [];
  const isMap = /\.map($|\?)/i.test(url) && (url.endsWith(".map") || ct.includes("application/json"));
  if (!isMap) return [];
  return [{
    id: uid("finding"), target: t, url, type: "SOURCEMAP_EXPOSED", severity: "MEDIUM",
    confidence: 0.8, created_at: nowIso(),
    evidence: { summary: "Source map publicly accessible", anchors: { url, contentType: ct } },
  }];
}

const SECRET_PATTERNS: Array<{ re: RegExp; t: FindingType; s: Severity }> = [
  { re: /AKIA[0-9A-Z]{16}/, t: "SECRET_POSSIBLE", s: "CRITICAL" },
  { re: /ghp_[A-Za-z0-9]{20,}/, t: "SECRET_POSSIBLE", s: "CRITICAL" },
  { re: /sk_live_[A-Za-z0-9]{20,}/, t: "SECRET_POSSIBLE", s: "CRITICAL" },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, t: "SECRET_POSSIBLE", s: "CRITICAL" },
  { re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, t: "SECRET_POSSIBLE", s: "CRITICAL" },
];
const PATH_HINTS: Array<{ re: RegExp; t: FindingType }> = [
  { re: /\.(bak|backup|old|swp)$/i, t: "EXPOSED_BACKUP" },
  { re: /\.(log|logs)$/i, t: "EXPOSED_LOG" },
  { re: /\.(env|config|ini|yaml|yml|toml)$/i, t: "EXPOSED_CONFIG" },
  { re: /\/swagger|\/openapi|\/api-docs/i, t: "OPENAPI_EXPOSED" },
  { re: /\/debug|\/actuator|\/\.env/i, t: "DEBUG_ENDPOINT" },
];

function auditSecrets(sid: string, t: string, url: string, status: number, body: string): Finding[] {
  if (status < 200 || status >= 400) return [];
  const out: Finding[] = [];
  const sample = body.slice(0, 100_000);
  for (const p of SECRET_PATTERNS) {
    const m = sample.match(p.re); if (!m) continue;
    out.push({
      id: uid("finding"), target: t, url, type: p.t, severity: p.s, confidence: 0.7,
      created_at: nowIso(),
      evidence: { summary: "Possible secret material in response body", anchors: { pattern: p.re.source }, sample: m[0].slice(0, 12) + "…" },
    });
  }
  for (const p of PATH_HINTS) {
    if (!p.re.test(url)) continue;
    out.push({
      id: uid("finding"), target: t, url, type: p.t,
      severity: p.t === "DEBUG_ENDPOINT" ? "HIGH" : "MEDIUM",
      confidence: 0.65, created_at: nowIso(),
      evidence: { summary: `Sensitive path pattern matched: ${p.t}`, anchors: { url } },
    });
  }
  return out;
}

// =================== DNS (DoH via Cloudflare) ====================================
async function dnsLookup(host: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [] };
  for (const type of Object.keys(out)) {
    const res = await safeFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { headers: { Accept: "application/dns-json" } }, 5000);
    if (!res) continue;
    try {
      const j = await res.json();
      for (const a of j?.Answer ?? []) {
        const v = String(a.data).replace(/^"|"$/g, "");
        out[type].push(v);
      }
    } catch { /* */ }
  }
  return out;
}

// =================== TLS SANs (via crt.sh certificate transparency) ==============
async function tlsSans(host: string): Promise<string[]> {
  const res = await safeFetch(`https://crt.sh/?q=${encodeURIComponent(host)}&output=json`, {}, 10000);
  if (!res || !res.ok) return [];
  try {
    const arr = await res.json();
    const set = new Set<string>();
    for (const r of arr.slice(0, 200)) {
      String(r.name_value || "").split(/\r?\n/).forEach((n: string) => {
        const v = n.trim().toLowerCase();
        if (v && !v.startsWith("*.")) set.add(v);
      });
    }
    return [...set].slice(0, 100);
  } catch { return []; }
}

// =================== PORT PROBE (HTTPS-only via fetch) ===========================
async function portProbe(host: string): Promise<Array<{ port: number; service: string; open: boolean }>> {
  const ports = [{ port: 80, service: "http" }, { port: 443, service: "https" }];
  const out = [];
  for (const p of ports) {
    const url = `${p.service}://${host}:${p.port}/`;
    const r = await safeFetch(url, { method: "HEAD" }, 5000);
    out.push({ ...p, open: !!r });
  }
  return out;
}

// =================== CRAWL + DISCOVERY ===========================================
const SMALL_WORDLIST = [
  ".env", ".env.local", ".env.production", ".git/config", ".git/HEAD",
  "robots.txt", "sitemap.xml", "admin", "api", "api/health", "health",
  "phpinfo.php", "config.json", "config.yml", "swagger.json", "openapi.json",
  "api-docs", ".DS_Store", "backup.zip", "backup.sql", "dump.sql",
  "wp-admin", "wp-login.php", "actuator", "debug", "server-status",
  "package.json", ".well-known/security.txt", "vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
];

function extractLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try { out.add(new URL(m[1], base).toString()); } catch { /* */ }
  }
  const scriptRe = /<script[^>]+src=["']([^"'#]+)["']/gi;
  while ((m = scriptRe.exec(html))) {
    try { out.add(new URL(m[1], base).toString()); } catch { /* */ }
  }
  return [...out];
}

async function crawlAndAudit(target: string, maxDepth: number, maxUrls: number): Promise<{ findings: Finding[]; bodies: Array<{ source: string; content: string }>; visited: string[] }> {
  const root = new URL(target.startsWith("http") ? target : `https://${target}`);
  const base = root.origin;
  const queue: Array<{ url: string; depth: number }> = [{ url: base + "/", depth: 0 }];
  // seed wordlist
  for (const w of SMALL_WORDLIST) queue.push({ url: `${base}/${w}`, depth: 1 });
  const visited = new Set<string>();
  const findings: Finding[] = [];
  const bodies: Array<{ source: string; content: string }> = [];
  const sid = uid("scan");

  while (queue.length && visited.size < maxUrls) {
    const next = queue.shift()!;
    if (visited.has(next.url)) continue;
    visited.add(next.url);
    let u: URL; try { u = new URL(next.url); } catch { continue; }
    if (u.hostname !== root.hostname) continue;

    const res = await safeFetch(next.url, {}, 8000);
    if (!res) continue;
    const h = headersToObj(res.headers);
    const status = res.status;
    const ct = h["content-type"] || "";
    let body = "";
    try {
      if (status < 400 && ct.match(/text|json|javascript|xml/i)) {
        const buf = await res.arrayBuffer();
        body = dec.decode(buf.slice(0, 250_000));
      } else { await res.body?.cancel(); }
    } catch { /* */ }

    findings.push(...auditSecurityHeaders(sid, target, next.url, h));
    findings.push(...auditCookies(sid, target, next.url, h));
    findings.push(...auditCors(sid, target, next.url, h));
    findings.push(...auditRedirectHygiene(sid, target, next.url, h));
    findings.push(...auditDirListing(sid, target, next.url, status, body));
    findings.push(...auditSourcemaps(sid, target, next.url, status, ct));
    findings.push(...auditSecrets(sid, target, next.url, status, body));

    if (body) bodies.push({ source: next.url, content: body });

    if (status === 200 && next.depth < maxDepth && ct.includes("text/html")) {
      for (const link of extractLinks(body, next.url)) {
        if (!visited.has(link) && queue.length + visited.size < maxUrls) {
          queue.push({ url: link, depth: next.depth + 1 });
        }
      }
    }
  }
  return { findings, bodies, visited: [...visited] };
}

// =================== API KEY EXTRACTION + LIVE TESTING ===========================
const KEY_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "aws_access_key", re: /AKIA[0-9A-Z]{16}/g },
  { type: "github_pat", re: /ghp_[A-Za-z0-9]{36,}/g },
  { type: "github_oauth", re: /gho_[A-Za-z0-9]{36,}/g },
  { type: "stripe_live", re: /sk_live_[A-Za-z0-9]{20,}/g },
  { type: "stripe_test", re: /sk_test_[A-Za-z0-9]{20,}/g },
  { type: "slack_token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: "supabase_jwt", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { type: "openai_key", re: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g },
];

function maskKey(k: string) { return k.length <= 8 ? "***" : `${k.slice(0, 4)}…${k.slice(-4)}`; }

function decodeJwt(t: string): Record<string, unknown> | null {
  try {
    const p = t.split("."); if (p.length < 2) return null;
    const b64 = p[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "===".slice((b64.length + 3) % 4)));
  } catch { return null; }
}

async function testKey(k: { key_type: string; raw_key: string; source: string }): Promise<ApiKeyProbe> {
  const base: ApiKeyProbe = {
    id: uid("keyprobe"), key_type: k.key_type, source: k.source, masked_key: maskKey(k.raw_key),
    format_valid: true, live_tested: false, test_result: "unknown",
    details: "", recommendation: "Rotate the key and move it to env vars.",
  };
  try {
    if (k.key_type === "github_pat" || k.key_type === "github_oauth") {
      base.live_tested = true;
      const r = await safeFetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${k.raw_key}` } }, 8000);
      if (!r) return base;
      if (r.status === 200) { base.test_result = "valid"; base.details = "GitHub accepted token — full account access."; base.recommendation = "Revoke immediately in GitHub settings."; }
      else if (r.status === 401) { base.test_result = "invalid"; base.details = "GitHub rejected token."; }
      else { base.test_result = "restricted"; base.details = `GitHub returned ${r.status}.`; }
      return base;
    }
    if (k.key_type === "stripe_live" || k.key_type === "stripe_test") {
      base.live_tested = true;
      const r = await safeFetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${k.raw_key}` } }, 8000);
      if (!r) return base;
      if (r.status === 200) { base.test_result = "valid"; base.details = "Stripe accepted secret key."; base.recommendation = "Roll key immediately in Stripe dashboard."; }
      else if (r.status === 401) { base.test_result = "invalid"; base.details = "Stripe rejected secret."; }
      else { base.test_result = "restricted"; base.details = `Stripe returned ${r.status}.`; }
      return base;
    }
    if (k.key_type === "supabase_jwt") {
      base.live_tested = true;
      const p = decodeJwt(k.raw_key);
      const role = String(p?.role ?? "unknown"); const ref = String(p?.ref ?? "unknown");
      base.details = `JWT role=${role}, ref=${ref}`;
      if (role === "service_role") {
        base.test_result = "dangerous_public";
        base.recommendation = "Service role key must never be client-exposed; rotate immediately.";
      } else if (role === "anon") {
        base.test_result = "restricted";
        base.details += "; Anon keys are public by design — enforce RLS.";
        base.recommendation = "Ensure RLS blocks anonymous access on all tables.";
      }
      return base;
    }
    base.details = "Key pattern matched; no live validator for this type.";
    return base;
  } catch (e) {
    base.details = `Live test error: ${e instanceof Error ? e.message : String(e)}`;
    return base;
  }
}

async function testAllApiKeys(sources: Array<{ source: string; content: string }>): Promise<ApiKeyProbe[]> {
  const found: Array<{ key_type: string; raw_key: string; source: string }> = [];
  const seen = new Set<string>();
  for (const { source, content } of sources) {
    for (const { type, re } of KEY_PATTERNS) {
      re.lastIndex = 0;
      for (const m of content.matchAll(re)) {
        const raw = m[1] ?? m[0]; const k = `${type}:${raw}`;
        if (seen.has(k)) continue; seen.add(k);
        found.push({ key_type: type, raw_key: raw, source });
      }
    }
  }
  const out: ApiKeyProbe[] = [];
  for (const k of found.slice(0, 25)) out.push(await testKey(k));
  return out;
}

// =================== EXPLOIT MAP (rule-based) ====================================
function buildExploitMap(findings: Finding[], flaws: CodeFlaw[], probes: ApiKeyProbe[]): ExploitScenario[] {
  const out: ExploitScenario[] = [];
  const has = (t: FindingType) => findings.some(f => f.type === t);
  const validKeys = probes.filter(p => p.test_result === "valid" || p.test_result === "dangerous_public");

  if (has("CORS_MISCONFIG")) out.push({
    id: uid("exploit"), title: "Credentialed CORS abuse from attacker origin",
    severity: "HIGH", attack_vector: "browser_origin_abuse",
    takedown_risk: "Authenticated victim browsers leak cookies/tokens to attacker-controlled JS.",
    prerequisites: ["Victim authenticated", "Access-Control-Allow-Origin reflects/wildcards with credentials=true"],
    steps: ["Host malicious page on attacker domain", "Victim visits while logged in", "Attacker JS reads cross-origin responses including session data"],
    patches: ["Echo only allow-listed origins", "Never combine `*` with credentials=true", "Add Vary: Origin"],
    related_flaws: [], related_findings: findings.filter(f => f.type === "CORS_MISCONFIG").map(f => f.id),
  });
  if (has("SECURITY_HEADERS")) out.push({
    id: uid("exploit"), title: "Clickjacking / XSS amplification from missing headers",
    severity: "MEDIUM", attack_vector: "browser_policy_gap",
    takedown_risk: "Attacker iframes the app for clickjacking or runs arbitrary script under weak CSP.",
    prerequisites: ["Target page renders sensitive UI", "Missing CSP or X-Frame-Options"],
    steps: ["Embed target in attacker iframe", "Overlay invisible controls", "Trick user into clicking sensitive actions"],
    patches: ["Add CSP with strict default-src", "Set X-Frame-Options: DENY", "Add Referrer-Policy and HSTS"],
    related_flaws: [], related_findings: findings.filter(f => f.type === "SECURITY_HEADERS").map(f => f.id),
  });
  if (has("DIR_LISTING") || has("EXPOSED_BACKUP") || has("EXPOSED_CONFIG") || has("DEBUG_ENDPOINT")) out.push({
    id: uid("exploit"), title: "Source/config exfiltration via exposed paths",
    severity: "HIGH", attack_vector: "data_disclosure",
    takedown_risk: "Attacker downloads source, env, or backups — pivots to full takeover.",
    prerequisites: ["Directory listing on or sensitive paths reachable"],
    steps: ["Enumerate exposed paths", "Fetch .env / backup / config", "Reuse credentials for lateral movement"],
    patches: ["Disable directory indexes", "Block /.env, /.git, /backup, /debug, /actuator", "Move secrets out of webroot"],
    related_flaws: [], related_findings: findings.filter(f => ["DIR_LISTING","EXPOSED_BACKUP","EXPOSED_CONFIG","DEBUG_ENDPOINT"].includes(f.type)).map(f => f.id),
  });
  if (has("SECRET_POSSIBLE") || validKeys.length) out.push({
    id: uid("exploit"), title: "Credential takeover via exposed key material",
    severity: "CRITICAL", attack_vector: "credential_disclosure",
    takedown_risk: "Live API keys grant attacker full programmatic access to upstream account.",
    prerequisites: ["Secrets present in response body or live keys confirmed"],
    steps: ["Harvest key from response", "Authenticate to upstream provider", "Drain data, escalate, persist"],
    patches: ["Rotate every exposed key", "Move secrets to server-side env", "Add scanning gates to CI"],
    related_flaws: [], related_findings: findings.filter(f => f.type === "SECRET_POSSIBLE").map(f => f.id),
  });
  if (has("SOURCEMAP_EXPOSED")) out.push({
    id: uid("exploit"), title: "Reverse engineer client + leak internals via source maps",
    severity: "MEDIUM", attack_vector: "code_disclosure",
    takedown_risk: "Attacker reads original TS/comments/paths, finds private endpoints and logic flaws.",
    prerequisites: [".map files reachable from public origin"],
    steps: ["Download .map", "Reconstruct source with sourcemap-cli", "Map private API surface"],
    patches: ["Strip sourcemaps in production build", "Or restrict .map to internal IPs / behind auth"],
    related_flaws: [], related_findings: findings.filter(f => f.type === "SOURCEMAP_EXPOSED").map(f => f.id),
  });
  if (has("REDIRECT_HYGIENE")) out.push({
    id: uid("exploit"), title: "Open-redirect chained with OAuth / phishing",
    severity: "MEDIUM", attack_vector: "trust_chain_abuse",
    takedown_risk: "Attacker abuses trusted domain to redirect victims to phishing or steal OAuth tokens.",
    prerequisites: ["Endpoint accepts user-controlled redirect target"],
    steps: ["Craft URL with redirect=attacker.tld", "Send via email/OAuth flow", "Victim trusts source, lands on attacker page"],
    patches: ["Allow-list redirect destinations", "Reject absolute URLs in redirect params", "Use signed state tokens"],
    related_flaws: [], related_findings: findings.filter(f => f.type === "REDIRECT_HYGIENE").map(f => f.id),
  });
  return out;
}

// =================== NARRATIVE PIPELINE (AI-driven) ==============================
async function runNarrative(
  apiKey: string,
  target: string,
  findings: Finding[],
  probes: ApiKeyProbe[],
  visited: string[],
): Promise<{ original: string; revised: string; remediation: string[] }> {
  const prompt = `You are GhostChain's narrative analyst. Target: ${target}
URLs visited: ${visited.length}
Findings: ${JSON.stringify(findings.slice(0, 30).map(f => ({ t: f.type, s: f.severity, sum: f.evidence.summary })))}
Live key probes: ${JSON.stringify(probes.map(p => ({ k: p.key_type, r: p.test_result, d: p.details })))}

Produce JSON with exactly these keys:
  "original_narrative" — 2-paragraph description of what this target appears to be and how it is built.
  "revised_narrative" — 2-paragraph rewrite that fixes every flaw and incorporates secure defaults.
  "remediation" — array of 5-10 prioritised, surgical fix instructions. Each entry one sentence, action verb first.
Return JSON only, no markdown.`;

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const p = JSON.parse(txt);
    return {
      original: String(p.original_narrative || ""),
      revised: String(p.revised_narrative || ""),
      remediation: Array.isArray(p.remediation) ? p.remediation.map(String) : [],
    };
  } catch (e) {
    return {
      original: `GhostChain crawled ${visited.length} URLs on ${target} and surfaced ${findings.length} findings.`,
      revised: `Apply the remediation list to close gaps. AI narrative unavailable: ${e instanceof Error ? e.message : String(e)}`,
      remediation: findings.slice(0, 8).map(f => `Address ${f.type}: ${f.evidence.summary}`),
    };
  }
}

// =================== AUTH + MAIN HANDLER =========================================
async function authUserEmail(req: Request): Promise<{ userId: string; email: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { userId: String(j.id), email: String(j.email || "") };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

    const auth = await authUserEmail(req);
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const targetRaw = String(body.target || "").trim();
    const mode = (body.mode === "surface" || body.mode === "web" || body.mode === "full") ? body.mode : "full";
    const maxDepth = Math.min(3, Math.max(0, Number(body.maxDepth) || 2));
    const maxUrls = Math.min(120, Math.max(5, Number(body.maxUrls) || 60));
    if (!targetRaw) return new Response(JSON.stringify({ error: "target required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    // Normalise target
    let host: string;
    try {
      const u = new URL(targetRaw.startsWith("http") ? targetRaw : `https://${targetRaw}`);
      host = u.hostname;
    } catch { return new Response(JSON.stringify({ error: "invalid target" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

    // SSRF guard — refuse private/loopback/meta hosts.
    const blocked = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)/i;
    if (blocked.test(host)) return new Response(JSON.stringify({ error: "private/internal host blocked" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    console.log(`[ghostchain] ${auth.email} → ${host} mode=${mode}`);

    // Resolve AI key (Aureon Team / BYOK / Venice fallback handled in adminGate)
    let aiKey = "";
    try {
      const keyResolution = await resolveKey(req, body.byok ?? null, { strict: false });
      if (keyResolution.mode === "admin") aiKey = keyResolution.geminiKey || "";
      else if (keyResolution.mode === "byok" && keyResolution.byok?.provider === "gemini") {
        aiKey = keyResolution.byok.apiKey || "";
      }
    } catch { /* narrative will degrade gracefully */ }

    // Surface
    const dns = (mode === "surface" || mode === "full") ? await dnsLookup(host) : {};
    const sans = (mode === "surface" || mode === "full") ? await tlsSans(host) : [];
    const ports = (mode === "surface" || mode === "full") ? await portProbe(host) : [];

    // Web crawl + audits
    const web = (mode === "web" || mode === "full")
      ? await crawlAndAudit(targetRaw, maxDepth, maxUrls)
      : { findings: [] as Finding[], bodies: [] as Array<{ source: string; content: string }>, visited: [] as string[] };

    // API key extraction + live testing
    const probes = await testAllApiKeys(web.bodies);

    // Exploit map
    const exploitMap = buildExploitMap(web.findings, [], probes);

    // Narrative
    const narrative = aiKey
      ? await runNarrative(aiKey, host, web.findings, probes, web.visited)
      : { original: "AI narrative skipped (no key available).", revised: "", remediation: [] };

    const sevRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 } as const;
    const summary = {
      total: web.findings.length,
      critical: web.findings.filter(f => f.severity === "CRITICAL").length,
      high: web.findings.filter(f => f.severity === "HIGH").length,
      medium: web.findings.filter(f => f.severity === "MEDIUM").length,
      low: web.findings.filter(f => f.severity === "LOW").length,
      info: web.findings.filter(f => f.severity === "INFO").length,
    };

    return new Response(JSON.stringify({
      ok: true,
      target: host,
      mode,
      started_at: nowIso(),
      surface: { dns, tls_sans: sans, ports },
      crawl: { visited_count: web.visited.length, visited: web.visited.slice(0, 100) },
      findings: web.findings.sort((a, b) => sevRank[b.severity] - sevRank[a.severity]),
      api_key_probes: probes,
      exploit_map: exploitMap,
      narrative,
      summary,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ghostchain] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
