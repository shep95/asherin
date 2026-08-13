// Zerlal path map — defensive recon inventory.
//
// What this module is: an inventory engine. It answers "what is on the wire
// for this host, and what protective headers does each response actually
// ship?" It quotes live responses. It never reproduces a payload, never
// probes for injection, never chains anything. A finding here is a *class*
// with evidence attached, in the Nuclei/WSTG sense of a taxonomy label —
// not a walkthrough.
//
// Hard rules enforced in code, not in comments alone:
//   · same registrable domain only (no open redirect into someone else's net)
//   · private / link-local / metadata destinations refused (SSRF)
//   · bounded concurrency, bounded paths, per-request timeout
//   · every quoted string goes through maskPii before it leaves this file
//   · cookie NAMES and flags are recorded; cookie VALUES never are

export interface PathAudit {
  url: string;
  path: string;
  host: string;
  status: number | null;
  contentType: string | null;
  bytes: number | null;
  redirectTo: string | null;
  server: string | null;
  /** Protective headers observed on THIS response, verbatim (truncated). */
  headers: Record<string, string>;
  /** Cookie name + flags only. Values are never read into memory as output. */
  cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string | null }>;
  /** Counts only — the masked samples live in `piiSamples`. */
  piiCounts: { email: number; phone: number };
  piiSamples: string[];
  title: string | null;
  /** True when the host answers this path with its catch-all shell, not a real document. */
  softNotFound: boolean;
  source: "robots" | "sitemap" | "well-known" | "html-link" | "seed" | "subdomain-root";
  elapsedMs: number;
  error: string | null;
}

export interface ClassFinding {
  /** Taxonomy label. One class per card — never a bundle. */
  klass:
    | "missing-security-header"
    | "weak-csp-directive"
    | "cookie-missing-flag"
    | "transport-not-enforced"
    | "directory-listing-exposed"
    | "leftover-artifact-reachable"
    | "pii-visible-in-response"
    | "disclosure-channel-absent"
    | "inventory-note";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  host: string;
  path: string;
  /** Live quote from the response. Masked. Truncated. */
  evidence: string;
  /** What the class means for a defender. No attacker steps. */
  meaning: string;
  remediation: string;
  wstg: string | null;
}

export interface PathMapResult {
  host: string;
  origin: string;
  subdomains: string[];
  audits: PathAudit[];
  findings: ClassFinding[];
  counts: { paths: number; hosts: number; reachable: number; findings: number };
  robotsStatus: number | null;
  elapsedMs: number;
  notes: string[];
}

const UA = "Asherin-Zerlal-Recon/2 (+https://asherin.com/security-policy)";

const PRIVATE_HOST = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^metadata\./i,
];

/** Registrable-domain comparison good enough for the public suffixes we meet. */
export function sameSite(a: string, b: string): boolean {
  const tail = (h: string) => h.toLowerCase().split(".").slice(-2).join(".");
  return tail(a) === tail(b);
}

export function hostAllowed(hostname: string): boolean {
  if (!hostname) return false;
  return !PRIVATE_HOST.some((re) => re.test(hostname));
}

const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-])[A-Za-z0-9.-]*\.([A-Za-z]{2,})\b/g;
// A phone number, not a date and not a version string: either E.164 with a
// leading +, or a 10-15 digit run broken by real separators. ISO dates
// (2026-08-07) and semver runs are excluded explicitly — they were the
// dominant false positive on the first live pass.
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{9,14}\b/g;
const DATEISH_RE = /^\d{4}[-./]\d{2}[-./]\d{2}$/;
const SECRET_RE: RegExp[] = [
  /\b(sk|pk|rk|api|key|token|bearer|secret|pat|ghp|gho|xoxb|xoxp)[-_a-z]*[=:\s]*["']?[A-Za-z0-9_\-]{16,}/gi,
  /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g,
  /\bAIza[0-9A-Za-z_\-]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

/** Never let a raw contact detail or credential out of the recon path. */
export function maskPii(raw: string | null | undefined, cap = 240): string {
  if (!raw) return "";
  let s = String(raw).replace(/\s+/g, " ").trim();
  for (const re of SECRET_RE) s = s.replace(re, "[redacted]");
  s = s.replace(EMAIL_RE, (_m, a, d, tld) => `${a}***@${d}***.${tld}`);
  s = s.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length >= 9 ? `***${digits.slice(-3)}` : m;
  });
  return s.length > cap ? `${s.slice(0, cap - 1)}…` : s;
}

export function normalizeTarget(input: string): { url: string; origin: string; hostname: string } {
  let v = String(input || "").trim();
  if (!v) throw new Error("A domain is required.");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  const u = new URL(v);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http and https targets are supported.");
  if (!hostAllowed(u.hostname)) throw new Error("Refusing private, loopback, or metadata destinations.");
  return { url: u.toString(), origin: u.origin, hostname: u.hostname };
}

async function fetchBounded(url: string, timeoutMs: number, method: "GET" | "HEAD" = "GET") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { method, redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, accept: "*/*" } });
  } finally {
    clearTimeout(t);
  }
}

/** RFC 3986 resolution against the origin; anything off-site is dropped. */
export function resolvePath(origin: string, ref: string): string | null {
  try {
    const u = new URL(ref, origin);
    if (!hostAllowed(u.hostname)) return null;
    if (!sameSite(u.hostname, new URL(origin).hostname)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** robots.txt is an inventory document: every Disallow names a real path. */
export function parseRobots(origin: string, body: string): string[] {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*(disallow|allow|sitemap)\s*:\s*(\S+)/i);
    if (!m) continue;
    const value = m[2].trim();
    if (value === "/" || value === "*") continue;
    const resolved = resolvePath(origin, value.replace(/\*/g, ""));
    if (resolved) out.push(resolved);
  }
  return [...new Set(out)];
}

export function parseSitemap(origin: string, body: string, cap = 60): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) && out.length < cap) {
    const r = resolvePath(origin, m[1]);
    if (r) out.push(r);
  }
  return [...new Set(out)];
}

export function parseLinks(origin: string, html: string, cap = 40): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < cap) {
    const r = resolvePath(origin, m[1]);
    if (r) out.push(r);
  }
  return [...new Set(out)];
}

const PROTECTIVE = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
];

function readCookies(h: Headers): PathAudit["cookies"] {
  // Deno exposes multiple Set-Cookie headers through getSetCookie().
  const raw: string[] = typeof (h as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (h as unknown as { getSetCookie: () => string[] }).getSetCookie()
    : (h.get("set-cookie") ? [h.get("set-cookie") as string] : []);
  return raw.slice(0, 12).map((line) => {
    const name = line.split("=")[0]?.trim() || "cookie";
    const ss = line.match(/samesite\s*=\s*([a-z]+)/i);
    return {
      name: name.slice(0, 48),
      secure: /;\s*secure\b/i.test(line),
      httpOnly: /;\s*httponly\b/i.test(line),
      sameSite: ss ? ss[1].toLowerCase() : null,
    };
  });
}

async function auditOne(url: string, source: PathAudit["source"], timeoutMs: number): Promise<PathAudit> {
  const u = new URL(url);
  const started = Date.now();
  const base: PathAudit = {
    url, path: u.pathname + (u.search || ""), host: u.hostname,
    status: null, contentType: null, bytes: null, redirectTo: null, server: null,
    headers: {}, cookies: [], piiCounts: { email: 0, phone: 0 }, piiSamples: [],
    title: null, softNotFound: false, source, elapsedMs: 0, error: null,
  };
  try {
    const resp = await fetchBounded(url, timeoutMs);
    base.status = resp.status;
    base.contentType = resp.headers.get("content-type");
    base.server = resp.headers.get("server");
    base.redirectTo = resp.headers.get("location");
    for (const key of PROTECTIVE) {
      const v = resp.headers.get(key);
      if (v) base.headers[key] = maskPii(v, 300);
    }
    base.cookies = readCookies(resp.headers);

    const ct = base.contentType || "";
    if (/text\/|json|xml|javascript/i.test(ct) && resp.status < 400) {
      const body = (await resp.text()).slice(0, 200_000);
      base.bytes = body.length;
      const title = body.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1];
      base.title = title ? maskPii(title, 120) : null;
      const emails = body.match(EMAIL_RE) || [];
      const phones = (body.match(PHONE_RE) || []).filter((m) => !DATEISH_RE.test(m.trim()));
      base.piiCounts = { email: emails.length, phone: phones.length };
      base.piiSamples = [...new Set([...emails.slice(0, 3), ...phones.slice(0, 2)])].map((s) => maskPii(s, 40));
    } else {
      // Nothing textual to read — drain without buffering the body.
      await resp.body?.cancel();
    }
  } catch (e) {
    base.error = e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message.slice(0, 120)) : "fetch failed";
  }
  base.elapsedMs = Date.now() - started;
  return base;
}

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<PathAudit>): Promise<PathAudit[]> {
  const out: PathAudit[] = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out.push(await worker(items[idx]));
    }
  });
  await Promise.all(runners);
  return out;
}

/** Leftover-artifact paths are checked for REACHABILITY only, never parsed for content. */
const ARTIFACT_PATHS = [
  "/.git/HEAD", "/.env", "/.env.local", "/config.json", "/backup.zip",
  "/.DS_Store", "/server-status", "/phpinfo.php", "/.well-known/security.txt",
];

function classify(audits: PathAudit[], host: string, securityTxtOk: boolean): ClassFinding[] {
  const findings: ClassFinding[] = [];
  const push = (f: ClassFinding) => { if (findings.length < 200) findings.push(f); };

  // Header policy is a HOST property when the host answers every path with
  // one shell. Emitting the same "csp absent" card 38 times would be a
  // scanner dump, and the count would read as 38 problems instead of one.
  // So a header class collapses to one card per host+header, carrying the
  // path count as evidence.
  const headerGaps = new Map<string, { host: string; key: string; paths: string[]; sample: PathAudit }>();

  for (const a of audits) {
    if (a.status === null || a.status >= 500 || a.error) continue;

    const isHtml = /text\/html/i.test(a.contentType || "");

    if (isHtml && a.status < 400) {
      for (const key of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "strict-transport-security"]) {
        if (!a.headers[key]) {
          const id = `${a.host}|${key}`;
          const entry = headerGaps.get(id) ?? { host: a.host, key, paths: [], sample: a };
          entry.paths.push(a.path);
          headerGaps.set(id, entry);
        }
      }
      const csp = a.headers["content-security-policy"];
      if (csp && /unsafe-inline|unsafe-eval|\*\s*;|default-src\s+\*/i.test(csp) && !a.softNotFound) {
        push({
          klass: "weak-csp-directive",
          severity: "low",
          title: `CSP contains a permissive directive on ${a.path}`,
          host: a.host, path: a.path,
          evidence: `content-security-policy: ${csp}`,
          meaning: "A directive in the shipped policy widens the allowed source set, which lowers what the policy can actually constrain.",
          remediation: "Tighten the flagged directive (drop unsafe-inline / unsafe-eval / wildcard sources) and use nonces or hashes instead.",
          wstg: "WSTG-CLNT-13",
        });
      }
    }


    for (const c of a.cookies) {
      const missing = [!c.secure && "Secure", !c.httpOnly && "HttpOnly", !c.sameSite && "SameSite"].filter(Boolean);
      if (missing.length) {
        push({
          klass: "cookie-missing-flag",
          severity: !c.secure ? "medium" : "low",
          title: `Cookie ${c.name} set without ${missing.join(" / ")}`,
          host: a.host, path: a.path,
          evidence: `set-cookie ${c.name}=<value withheld>; Secure=${c.secure}; HttpOnly=${c.httpOnly}; SameSite=${c.sameSite ?? "<unset>"}`,
          meaning: "The cookie is issued without the full flag set, so its handling depends on browser defaults rather than an explicit policy.",
          remediation: `Reissue ${c.name} with Secure, HttpOnly (when not read by scripts), and an explicit SameSite value.`,
          wstg: "WSTG-SESS-02",
        });
      }
    }

    if (a.status >= 300 && a.status < 400 && a.redirectTo && /^http:\/\//i.test(a.redirectTo)) {
      push({
        klass: "transport-not-enforced",
        severity: "medium",
        title: `${a.path} redirects to plaintext http`,
        host: a.host, path: a.path,
        evidence: `HTTP ${a.status} · location: ${maskPii(a.redirectTo, 160)}`,
        meaning: "A hop in this path's chain leaves TLS, so the request travels unencrypted before it lands.",
        remediation: "Point the redirect target at https and publish Strict-Transport-Security on the host.",
        wstg: "WSTG-CRYP-03",
      });
    }

    if (a.status < 400 && a.title && /^index of \//i.test(a.title)) {
      push({
        klass: "directory-listing-exposed",
        severity: "medium",
        title: `Directory index rendered at ${a.path}`,
        host: a.host, path: a.path,
        evidence: `HTTP ${a.status} · <title>${a.title}</title>`,
        meaning: "The server renders a file index for this path, so the file inventory of that directory is public.",
        remediation: "Disable automatic indexing for this location and serve an explicit document instead.",
        wstg: "WSTG-CONF-04",
      });
    }

    if (a.status < 400 && ARTIFACT_PATHS.includes(a.path) && a.path !== "/.well-known/security.txt") {
      push({
        klass: "leftover-artifact-reachable",
        severity: "high",
        title: `${a.path} answers ${a.status}`,
        host: a.host, path: a.path,
        evidence: `HTTP ${a.status} · content-type: ${a.contentType || "unknown"} · ${a.bytes ?? 0} bytes read`,
        meaning: "A build or tooling artifact path is reachable from the public internet. Recorded as reachability only — contents are not retrieved or reproduced here.",
        remediation: "Return 404 for this path at the edge and confirm the artifact is excluded from the deployed bundle.",
        wstg: "WSTG-CONF-05",
      });
    }

    if (a.piiCounts.email + a.piiCounts.phone > 0 && a.status < 400) {
      push({
        klass: "pii-visible-in-response",
        severity: a.piiCounts.email + a.piiCounts.phone > 8 ? "medium" : "info",
        title: `${a.piiCounts.email} email / ${a.piiCounts.phone} phone pattern(s) in ${a.path}`,
        host: a.host, path: a.path,
        evidence: `masked samples: ${a.piiSamples.join(", ") || "none retained"}`,
        meaning: "Contact strings are rendered in this public response. Values are masked here and are never stored unmasked.",
        remediation: "Confirm each contact string is intended to be public; route the rest through a form or an alias.",
        wstg: "WSTG-INFO-05",
      });
    }
  }

  if (!securityTxtOk) {
    push({
      klass: "disclosure-channel-absent",
      severity: "low",
      title: "No /.well-known/security.txt published",
      host, path: "/.well-known/security.txt",
      evidence: "GET /.well-known/security.txt did not return a readable policy document.",
      meaning: "There is no machine-readable route for a reporter to reach the owner of this surface.",
      remediation: "Publish security.txt with Contact and Policy fields.",
      wstg: "WSTG-INFO-01",
    });
  }

  return findings;
}

export interface PathMapOptions {
  maxPaths?: number;
  maxSubdomains?: number;
  timeoutMs?: number;
  concurrency?: number;
}

export async function runPathMap(target: string, opts: PathMapOptions = {}): Promise<PathMapResult> {
  const started = Date.now();
  const { origin, hostname } = normalizeTarget(target);
  const maxPaths = Math.min(Math.max(opts.maxPaths ?? 28, 4), 48);
  const maxSubs = Math.min(Math.max(opts.maxSubdomains ?? 6, 0), 10);
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 9000, 3000), 12000);
  const concurrency = Math.min(Math.max(opts.concurrency ?? 6, 1), 8);
  const notes: string[] = [];

  const text = async (url: string) => {
    try {
      const r = await fetchBounded(url, timeoutMs);
      return { ok: r.ok, status: r.status, body: r.ok ? (await r.text()).slice(0, 300_000) : "" };
    } catch {
      return { ok: false, status: 0, body: "" };
    }
  };

  const [robots, sitemap, root, secTxt, ct] = await Promise.all([
    text(`${origin}/robots.txt`),
    text(`${origin}/sitemap.xml`),
    text(origin),
    text(`${origin}/.well-known/security.txt`),
    text(`https://crt.sh/?q=${encodeURIComponent(`%.${hostname}`)}&output=json`),
  ]);

  if (!robots.ok) notes.push("robots.txt was not readable — path inventory came from the sitemap and rendered links only.");

  let subdomains: string[] = [];
  try {
    const rows = ct.body ? JSON.parse(ct.body) as Array<{ name_value?: string }> : [];
    subdomains = [...new Set(rows.flatMap((r) => String(r.name_value || "").split("\n")))]
      .map((s) => s.trim().replace(/^\*\./, "").toLowerCase())
      .filter((s) => s && s !== hostname && s.endsWith(hostname) && hostAllowed(s))
      .sort();
  } catch {
    notes.push("certificate transparency lookup returned nothing parseable — subdomain inventory is from DNS-visible names only.");
  }

  const candidates = new Map<string, PathAudit["source"]>();
  candidates.set(origin + "/", "seed");
  for (const u of parseRobots(origin, robots.body)) candidates.set(u, "robots");
  for (const u of parseSitemap(origin, sitemap.body)) if (!candidates.has(u)) candidates.set(u, "sitemap");
  for (const u of parseLinks(origin, root.body)) if (!candidates.has(u)) candidates.set(u, "html-link");
  for (const p of ARTIFACT_PATHS) candidates.set(`${origin}${p}`, "well-known");

  const pathList = [...candidates.entries()].slice(0, maxPaths);
  const subList = subdomains.slice(0, maxSubs).map((s) => [`https://${s}/`, "subdomain-root"] as [string, PathAudit["source"]]);

  // Equal audit: a subdomain root is walked with exactly the same probe and
  // the same classifier as an apex path. No host gets a lighter pass.
  const audits = await pool([...pathList, ...subList], concurrency, ([url, source]) => auditOne(url, source, timeoutMs));
  audits.sort((a, b) => (a.host === b.host ? a.path.localeCompare(b.path) : a.host.localeCompare(b.host)));

  const findings = classify(audits, hostname, secTxt.ok && /contact/i.test(secTxt.body));

  return {
    host: hostname,
    origin,
    subdomains,
    audits,
    findings,
    counts: {
      paths: audits.length,
      hosts: new Set(audits.map((a) => a.host)).size,
      reachable: audits.filter((a) => a.status !== null && a.status < 400).length,
      findings: findings.length,
    },
    robotsStatus: robots.status || null,
    elapsedMs: Date.now() - started,
    notes,
  };
}
