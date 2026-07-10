import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidByok, callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// ─── LIVE RECON ──────────────────────────────────────────────────────────────
// Pulls real, observable facts from public no-auth sources so the AI grounds
// its blueprint on actual data instead of pattern-guessing.

const TIMEOUT_MS = 8000;

async function fetchTimeout(url: string, init?: RequestInit, ms = TIMEOUT_MS): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

function extractHostname(input: string): string {
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    return u.hostname;
  } catch { return input.replace(/^https?:\/\//, "").split("/")[0]; }
}

async function dohQuery(name: string, type: string): Promise<string[]> {
  const r = await fetchTimeout(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!r || !r.ok) return [];
  const j = await r.json().catch(() => null);
  if (!j?.Answer) return [];
  return j.Answer.map((a: { data?: string }) => a.data || "").filter(Boolean);
}

async function crtshSubdomains(host: string): Promise<string[]> {
  const root = host.split(".").slice(-2).join(".");
  const r = await fetchTimeout(`https://crt.sh/?q=%25.${root}&output=json`, {}, 12_000);
  if (!r || !r.ok) return [];
  const j = await r.json().catch(() => []);
  if (!Array.isArray(j)) return [];
  const set = new Set<string>();
  for (const row of j) {
    const names = String(row.name_value || "").split("\n");
    for (const n of names) {
      const cleaned = n.trim().toLowerCase().replace(/^\*\./, "");
      if (cleaned.endsWith(root) && !cleaned.includes(" ")) set.add(cleaned);
    }
  }
  return [...set].slice(0, 80);
}

async function rdapLookup(host: string): Promise<Record<string, unknown> | null> {
  const root = host.split(".").slice(-2).join(".");
  const r = await fetchTimeout(`https://rdap.org/domain/${root}`);
  if (!r || !r.ok) return null;
  return await r.json().catch(() => null);
}

async function geoIp(ip: string): Promise<Record<string, unknown> | null> {
  const r = await fetchTimeout(`https://ipapi.co/${ip}/json/`);
  if (!r || !r.ok) return null;
  return await r.json().catch(() => null);
}

async function probeHttp(host: string): Promise<{ headers: Record<string, string>; status: number; finalUrl: string; setCookieAll: string[] } | null> {
  const r = await fetchTimeout(`https://${host}`, { method: "GET", redirect: "follow" }, 10_000);
  if (!r) return null;
  const headers: Record<string, string> = {};
  r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  // Capture multiple Set-Cookie headers (Headers.getSetCookie when available)
  let setCookieAll: string[] = [];
  try {
    const gsc = (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof gsc === "function") setCookieAll = gsc.call(r.headers) || [];
    else if (headers["set-cookie"]) setCookieAll = [headers["set-cookie"]];
  } catch { /* */ }
  try { await r.body?.cancel(); } catch { /* ignore */ }
  return { headers, status: r.status, finalUrl: r.url, setCookieAll };
}

// ─── REDIRECT CHAIN ──────────────────────────────────────────────────────────
async function redirectChain(host: string): Promise<{ hops: Array<{ url: string; status: number }>; finalUrl: string; responseMs: number }> {
  const hops: Array<{ url: string; status: number }> = [];
  let current = `https://${host}`;
  const start = Date.now();
  for (let i = 0; i < 6; i++) {
    const r = await fetchTimeout(current, { method: "GET", redirect: "manual" }, 8000);
    if (!r) break;
    hops.push({ url: current, status: r.status });
    try { await r.body?.cancel(); } catch { /* */ }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) break;
      current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
      continue;
    }
    break;
  }
  return { hops, finalUrl: current, responseMs: Date.now() - start };
}

// ─── EXPOSED FILE PROBE ──────────────────────────────────────────────────────
const EXPOSED_PATHS = [
  "/robots.txt", "/sitemap.xml", "/package.json", "/.env", "/.env.local",
  "/.env.production", "/.git/HEAD", "/.git/config", "/config.json",
  "/credentials.json", "/manifest.json", "/site.webmanifest",
  "/.DS_Store", "/.well-known/security.txt", "/composer.json",
  "/wp-config.php.bak", "/backup.sql", "/database.sql",
];

interface ExposedFile { path: string; status: number; size: number; preview?: string; risk: "info" | "warn" | "critical" }

async function probeExposedFiles(host: string): Promise<ExposedFile[]> {
  const results = await Promise.all(EXPOSED_PATHS.map(async (p) => {
    const r = await fetchTimeout(`https://${host}${p}`, { method: "GET", redirect: "manual" }, 6000);
    if (!r) return null;
    const ct = r.headers.get("content-type") || "";
    const cl = Number(r.headers.get("content-length") || 0);
    let preview = "";
    let size = cl;
    if (r.ok && /text|json|xml|html|javascript/i.test(ct)) {
      const txt = await r.text().catch(() => "");
      size = txt.length;
      preview = txt.slice(0, 600);
      // skip if it's clearly an HTML 404/SPA fallback
      if (/<!doctype html/i.test(preview) && p !== "/manifest.json" && p !== "/site.webmanifest") {
        return null;
      }
    } else {
      try { await r.body?.cancel(); } catch { /* */ }
    }
    if (r.status >= 400) return null;
    const risk: ExposedFile["risk"] =
      /\.env|\.git|credentials|backup|\.sql|wp-config/.test(p) ? "critical"
      : /package\.json|config\.json|composer/.test(p) ? "warn"
      : "info";
    return { path: p, status: r.status, size, preview, risk } as ExposedFile;
  }));
  return results.filter(Boolean) as ExposedFile[];
}

// ─── PAGE PARSING ────────────────────────────────────────────────────────────
interface PageIdentity {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  language: string;
  generator: string;
  socialLinks: string[];
  schemaOrg: string[];
}

function parsePageIdentity(html: string): PageIdentity {
  const m = (re: RegExp) => (html.match(re)?.[1] || "").trim();
  const title = m(/<title[^>]*>([^<]+)<\/title>/i);
  const description = m(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const canonical = m(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const ogTitle = m(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDescription = m(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = m(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const twitterCard = m(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i);
  const language = m(/<html[^>]+lang=["']([^"']+)["']/i);
  const generator = m(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  const socialLinks: string[] = [];
  const SOCIAL_RE = /https?:\/\/(?:www\.)?(?:twitter|x|facebook|instagram|linkedin|github|youtube|tiktok|discord|t\.me)\.com\/[A-Za-z0-9_.\-/@]+/gi;
  socialLinks.push(...(html.match(SOCIAL_RE) || []));
  const schemaOrg: string[] = [];
  const LDJSON = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = LDJSON.exec(html)) !== null) schemaOrg.push((lm[1] || "").trim().slice(0, 800));
  return {
    title, description, canonical, ogTitle, ogDescription, ogImage, twitterCard,
    language, generator,
    socialLinks: dedupe(socialLinks).slice(0, 20),
    schemaOrg: schemaOrg.slice(0, 5),
  };
}

interface TechFingerprint {
  cms: string[];
  frameworks: string[];
  analytics: string[];
  payments: string[];
  third_party_hosts: string[];
  graphql_endpoints: string[];
  websocket_endpoints: string[];
  api_endpoints: string[];
  env_vars: string[];
  source_maps: string[];
}

function parseTechFingerprint(html: string, headers: Record<string, string>): TechFingerprint {
  const out: TechFingerprint = {
    cms: [], frameworks: [], analytics: [], payments: [],
    third_party_hosts: [], graphql_endpoints: [], websocket_endpoints: [],
    api_endpoints: [], env_vars: [], source_maps: [],
  };
  const text = html;
  // CMS
  if (/wp-content|wp-includes/i.test(text)) out.cms.push("WordPress");
  if (/cdn\.shopify\.com|Shopify\.theme/i.test(text)) out.cms.push("Shopify");
  if (/webflow\.com|wf-/i.test(text)) out.cms.push("Webflow");
  if (/ghost\.io|content\/images/i.test(text) && /ghost/i.test(text)) out.cms.push("Ghost");
  if (/squarespace/i.test(text)) out.cms.push("Squarespace");
  if (/wix\.com|wixstatic/i.test(text)) out.cms.push("Wix");
  // Frameworks
  if (/__NEXT_DATA__|_next\/static/i.test(text)) out.frameworks.push("Next.js");
  if (/window\.__NUXT__|_nuxt\//i.test(text)) out.frameworks.push("Nuxt");
  if (/svelte-|__SVELTEKIT/i.test(text)) out.frameworks.push("SvelteKit");
  if (/data-reactroot|react-dom/i.test(text)) out.frameworks.push("React");
  if (/ng-version=|ng-app/i.test(text)) out.frameworks.push("Angular");
  if (/data-v-app|__VUE/i.test(text)) out.frameworks.push("Vue");
  if (/_astro\//i.test(text)) out.frameworks.push("Astro");
  if (/gatsby-/i.test(text)) out.frameworks.push("Gatsby");
  if (headers["x-powered-by"]) out.frameworks.push(headers["x-powered-by"]);
  // Analytics
  if (/googletagmanager\.com|gtag\(/i.test(text)) out.analytics.push("Google Tag Manager / GA4");
  if (/cdn\.segment\.com|analytics\.js/i.test(text)) out.analytics.push("Segment");
  if (/mixpanel/i.test(text)) out.analytics.push("Mixpanel");
  if (/cdn\.amplitude\.com/i.test(text)) out.analytics.push("Amplitude");
  if (/posthog/i.test(text)) out.analytics.push("PostHog");
  if (/hotjar/i.test(text)) out.analytics.push("Hotjar");
  if (/plausible\.io/i.test(text)) out.analytics.push("Plausible");
  // Payments
  if (/js\.stripe\.com|stripe\.com\/v3/i.test(text)) out.payments.push("Stripe");
  if (/paypal\.com\/sdk/i.test(text)) out.payments.push("PayPal");
  if (/braintree/i.test(text)) out.payments.push("Braintree");
  if (/square\.com\/sdk|squareupsandbox/i.test(text)) out.payments.push("Square");
  // Third-party hosts (from script src)
  const srcs: string[] = [];
  let sm: RegExpExecArray | null;
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  while ((sm = re.exec(text)) !== null) {
    try {
      const u = new URL(sm[1].startsWith("//") ? "https:" + sm[1] : sm[1], "https://x");
      if (u.hostname && u.hostname !== "x") srcs.push(u.hostname);
    } catch { /* */ }
  }
  out.third_party_hosts = dedupe(srcs).slice(0, 30);
  // GraphQL / WS / API
  out.graphql_endpoints = dedupe([...text.matchAll(/["'](https?:\/\/[^"']+\/graphql[^"']*)["']/g)].map((m) => m[1])).slice(0, 10);
  out.websocket_endpoints = dedupe([...text.matchAll(/["'](wss?:\/\/[^"']+)["']/g)].map((m) => m[1])).slice(0, 10);
  out.api_endpoints = dedupe([...text.matchAll(/["'](\/api\/[A-Za-z0-9_\-\/.]+)["']/g)].map((m) => m[1])).slice(0, 30);
  out.env_vars = dedupe([...text.matchAll(/(NEXT_PUBLIC_[A-Z0-9_]+|REACT_APP_[A-Z0-9_]+|VITE_[A-Z0-9_]+)/g)].map((m) => m[1])).slice(0, 30);
  out.source_maps = dedupe([...text.matchAll(/sourceMappingURL=([^\s"'*]+\.map)/g)].map((m) => m[1])).slice(0, 10);
  return out;
}

interface LinkInventory {
  internal: string[];
  external: string[];
  admin_paths: string[];
  document_links: string[];
  image_count: number;
}

function parseLinkInventory(html: string, host: string): LinkInventory {
  const hrefs: string[] = [];
  const HREF_RE = /<a[^>]+href=["']([^"']+)["']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = HREF_RE.exec(html)) !== null) hrefs.push(hm[1]);
  const internal = new Set<string>();
  const external = new Set<string>();
  const docs = new Set<string>();
  const admin = new Set<string>();
  for (const h of hrefs) {
    try {
      if (h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:")) continue;
      const u = new URL(h, `https://${host}`);
      if (u.hostname === host || u.hostname.endsWith("." + host)) internal.add(u.pathname);
      else external.add(u.toString());
      if (/\.(pdf|docx?|xlsx?|pptx?|csv|zip|json)$/i.test(u.pathname)) docs.add(u.toString());
      if (/\/(admin|dashboard|internal|console|panel|cms|wp-admin)/i.test(u.pathname)) admin.add(u.pathname);
    } catch { /* */ }
  }
  // Hidden admin paths in JS / inline
  const ADMIN_RE = /["'](\/(?:admin|dashboard|internal|console|panel|wp-admin|api\/admin)[A-Za-z0-9_\-\/.]*)["']/g;
  for (const m of html.matchAll(ADMIN_RE)) admin.add(m[1]);
  const imageCount = (html.match(/<img\b/gi) || []).length;
  return {
    internal: [...internal].slice(0, 60),
    external: [...external].slice(0, 60),
    admin_paths: [...admin].slice(0, 30),
    document_links: [...docs].slice(0, 30),
    image_count: imageCount,
  };
}

// ─── ARCHIVE / WAYBACK ───────────────────────────────────────────────────────
async function waybackInfo(host: string): Promise<{ first_seen?: string; last_seen?: string; snapshots?: number }> {
  const r = await fetchTimeout(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&fl=timestamp&limit=1&filter=statuscode:200`,
    {}, 9000,
  );
  const r2 = await fetchTimeout(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&fl=timestamp&limit=-1&filter=statuscode:200`,
    {}, 9000,
  );
  const r3 = await fetchTimeout(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&showNumPages=true`,
    {}, 9000,
  );
  const fmt = (ts: string) => `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
  let first: string | undefined, last: string | undefined, snapshots: number | undefined;
  if (r?.ok) {
    const j = await r.json().catch(() => null);
    if (Array.isArray(j) && j[1]?.[0]) first = fmt(String(j[1][0]));
  }
  if (r2?.ok) {
    const j = await r2.json().catch(() => null);
    if (Array.isArray(j) && j[1]?.[0]) last = fmt(String(j[1][0]));
  }
  if (r3?.ok) {
    const j = await r3.json().catch(() => null);
    const pages = Array.isArray(j) ? Number(j) : Number(j?.[0]);
    if (!isNaN(pages)) snapshots = pages * 1000; // rough
  }
  return { first_seen: first, last_seen: last, snapshots };
}

// ─── LAYER 12: SUBDOMAIN AUDIT ───────────────────────────────────────────────
interface SubAudit {
  host: string;
  ip?: string;
  cname?: string;
  status?: number;
  server?: string;
  tech?: string[];
  weaknesses: string[];
}

async function auditSubdomain(host: string): Promise<SubAudit> {
  const out: SubAudit = { host, weaknesses: [], tech: [] };
  const [a, cn, http] = await Promise.all([
    dohQuery(host, "A"),
    dohQuery(host, "CNAME"),
    fetchTimeout(`https://${host}`, { method: "GET", redirect: "manual" }, 6000),
  ]);
  out.ip = a[0];
  out.cname = cn[0];
  if (!a.length && !cn.length) out.weaknesses.push("Unresolvable — possible dangling record");
  if (cn[0] && /\.(s3|herokuapp|github\.io|netlify\.app|vercel\.app|cloudfront|azurewebsites)\./i.test(cn[0])) {
    // Probe to see if claimed
    if (http && http.status === 404) out.weaknesses.push(`Possible takeover — CNAME→${cn[0]} returns 404`);
  }
  if (http) {
    out.status = http.status;
    out.server = http.headers.get("server") || undefined;
    const sec = ["strict-transport-security","content-security-policy","x-frame-options"];
    const missing = sec.filter((h) => !http.headers.get(h));
    if (missing.length) out.weaknesses.push(`Missing security headers: ${missing.join(", ")}`);
    if (/\b(staging|dev|test|preview|qa|uat|internal|admin|sandbox)\b/i.test(host)) {
      if (http.status >= 200 && http.status < 400) out.weaknesses.push("Sensitive-named host publicly reachable — gate with auth");
    }
    try { await http.body?.cancel(); } catch { /* */ }
  } else {
    out.weaknesses.push("HTTPS unreachable — TLS/cert may be misconfigured");
  }
  return out;
}

async function subdomainAudit(subs: string[], cap = 12): Promise<SubAudit[]> {
  const targets = subs.slice(0, cap);
  return await Promise.all(targets.map((s) => auditSubdomain(s).catch(() => ({ host: s, weaknesses: ["Audit failed"] } as SubAudit))));
}

// ─── EMAIL INFRA / SPF / DMARC / DKIM ────────────────────────────────────────
interface EmailInfra {
  mx_provider: string;          // Google / Microsoft / Zoho / etc
  mx_records: string[];
  spf: string;
  spf_strict: boolean;          // -all vs ~all vs ?all vs none
  dmarc: string;
  dmarc_policy: string;         // none/quarantine/reject
  dkim_selectors_found: string[];
  weaknesses: string[];
}

async function emailInfraAudit(host: string): Promise<EmailInfra> {
  const root = host.split(".").slice(-2).join(".");
  const [mx, txt, dmarc] = await Promise.all([
    dohQuery(root, "MX"),
    dohQuery(root, "TXT"),
    dohQuery(`_dmarc.${root}`, "TXT"),
  ]);
  // Common DKIM selectors
  const selectors = ["google", "selector1", "selector2", "k1", "default", "mail", "dkim", "s1", "s2"];
  const dkimResults = await Promise.all(
    selectors.map(async (s) => {
      const r = await dohQuery(`${s}._domainkey.${root}`, "TXT");
      return r.length ? s : null;
    }),
  );
  const dkim_selectors_found = dkimResults.filter(Boolean) as string[];

  const mxLower = mx.join(" ").toLowerCase();
  let mx_provider = "Unknown / self-hosted";
  if (/google|gmail/.test(mxLower)) mx_provider = "Google Workspace";
  else if (/outlook|protection\.outlook|microsoft/.test(mxLower)) mx_provider = "Microsoft 365";
  else if (/zoho/.test(mxLower)) mx_provider = "Zoho Mail";
  else if (/proofpoint/.test(mxLower)) mx_provider = "Proofpoint";
  else if (/mimecast/.test(mxLower)) mx_provider = "Mimecast";
  else if (/mailgun/.test(mxLower)) mx_provider = "Mailgun";
  else if (/sendgrid/.test(mxLower)) mx_provider = "SendGrid";
  else if (/amazonses|amazonaws/.test(mxLower)) mx_provider = "Amazon SES";
  else if (/protonmail|proton\.me/.test(mxLower)) mx_provider = "Proton Mail";
  else if (/fastmail|messagingengine/.test(mxLower)) mx_provider = "Fastmail";

  const spfRec = txt.map((t) => t.replace(/^"|"$/g, "")).find((t) => /^v=spf1/i.test(t)) || "";
  const dmarcRec = dmarc.map((t) => t.replace(/^"|"$/g, "")).find((t) => /^v=DMARC1/i.test(t)) || "";
  const dmarcPolicy = (dmarcRec.match(/p\s*=\s*([a-z]+)/i)?.[1] || "none").toLowerCase();
  const spfStrict = /-all\b/i.test(spfRec);

  const weaknesses: string[] = [];
  if (!spfRec) weaknesses.push("No SPF record — anyone can spoof outbound mail");
  else if (!spfStrict) weaknesses.push(`SPF not strict (${spfRec.match(/[~?+\-]all/i)?.[0] || "no -all"}) — soft-fail allows spoofing`);
  if (!dmarcRec) weaknesses.push("No DMARC record — phishing detection is blind");
  else if (dmarcPolicy === "none") weaknesses.push("DMARC policy=none (monitor only) — upgrade to quarantine/reject");
  if (dkim_selectors_found.length === 0) weaknesses.push("No common DKIM selectors found — outbound mail may not be signed");
  if (mx.length === 0) weaknesses.push("No MX records — domain cannot receive mail");

  return {
    mx_provider, mx_records: mx, spf: spfRec, spf_strict: spfStrict,
    dmarc: dmarcRec, dmarc_policy: dmarcPolicy,
    dkim_selectors_found, weaknesses,
  };
}

// ─── SECURITY HEADER DEEP-DIVE / CSP / CORS / COOKIES ────────────────────────
interface SecurityAudit {
  hsts_present: boolean;
  hsts_max_age?: number;
  hsts_includes_sub: boolean;
  hsts_preload: boolean;
  x_frame_options: string;          // DENY / SAMEORIGIN / missing
  clickjacking_risk: boolean;
  csp_present: boolean;
  csp_unsafe_inline: boolean;
  csp_unsafe_eval: boolean;
  csp_wildcard_hosts: string[];
  csp_report_only: boolean;
  cors_acao: string;                // value of Access-Control-Allow-Origin
  cors_wildcard_with_credentials: boolean;
  cookies: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite: string }>;
  cookie_weak_count: number;
  mixed_content_resources: string[];
  weaknesses: string[];
}

function parseCookies(setCookieAll: string[]): SecurityAudit["cookies"] {
  const out: SecurityAudit["cookies"] = [];
  for (const raw of setCookieAll) {
    const name = (raw.split("=")[0] || "").trim();
    if (!name) continue;
    const lower = raw.toLowerCase();
    const sameSiteMatch = lower.match(/samesite\s*=\s*(strict|lax|none)/);
    out.push({
      name,
      secure: /;\s*secure(\b|;)/i.test(raw) || /;\s*secure\s*$/i.test(raw),
      httpOnly: /;\s*httponly/i.test(raw),
      sameSite: sameSiteMatch ? sameSiteMatch[1] : "missing",
    });
  }
  return out;
}

function auditSecurity(html: string | null, headers: Record<string, string>, setCookieAll: string[]): SecurityAudit {
  const hsts = headers["strict-transport-security"] || "";
  const hstsMax = Number(hsts.match(/max-age\s*=\s*(\d+)/i)?.[1] || 0);
  const xfo = headers["x-frame-options"] || "missing";
  const cspRaw = headers["content-security-policy"] || "";
  const cspRO = headers["content-security-policy-report-only"] || "";
  const csp = cspRaw || cspRO;
  const acao = headers["access-control-allow-origin"] || "";
  const acac = (headers["access-control-allow-credentials"] || "").toLowerCase() === "true";
  const cookies = parseCookies(setCookieAll);

  const cspWildcards = csp ? [...csp.matchAll(/(?:^|\s)\*(?:\s|;|$)|https?:\/\/\*\.?[a-z0-9.\-]*/gi)].map((m) => m[0].trim()) : [];
  const cspUnsafeInline = /['"]?unsafe-inline['"]?/i.test(csp);
  const cspUnsafeEval = /['"]?unsafe-eval['"]?/i.test(csp);
  const csp_present = !!cspRaw;

  // Mixed content (http:// resources on https page)
  const mixed: string[] = [];
  if (html) {
    const M = /(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
    let mm: RegExpExecArray | null;
    while ((mm = M.exec(html)) !== null && mixed.length < 15) mixed.push(mm[1]);
  }

  const weaknesses: string[] = [];
  if (!hsts) weaknesses.push("No HSTS — TLS downgrade possible");
  else if (hstsMax < 15552000) weaknesses.push(`HSTS max-age=${hstsMax} (<6 months) — increase to 31536000`);
  if (!/SAMEORIGIN|DENY/i.test(xfo) && !csp.includes("frame-ancestors")) weaknesses.push("Clickjacking risk — set X-Frame-Options or CSP frame-ancestors");
  if (!csp_present) weaknesses.push("No CSP header — XSS protection minimal");
  else {
    if (cspUnsafeInline) weaknesses.push("CSP allows 'unsafe-inline' — defeats XSS mitigation");
    if (cspUnsafeEval) weaknesses.push("CSP allows 'unsafe-eval' — defeats XSS mitigation");
    if (cspWildcards.length) weaknesses.push(`CSP contains wildcard sources: ${cspWildcards.slice(0, 3).join(", ")}`);
    if (cspRO && !cspRaw) weaknesses.push("CSP is report-only — not enforced");
  }
  if (acao === "*" && acac) weaknesses.push("CRITICAL: CORS wildcard origin with credentials=true");
  else if (acao === "*") weaknesses.push("CORS allows any origin (wildcard)");
  const weakCookies = cookies.filter((c) => !c.secure || !c.httpOnly || c.sameSite === "missing" || c.sameSite === "none");
  if (weakCookies.length) weaknesses.push(`${weakCookies.length} cookie(s) missing Secure / HttpOnly / SameSite flags`);
  if (mixed.length) weaknesses.push(`${mixed.length} mixed-content (HTTP) resource(s) on HTTPS page`);

  return {
    hsts_present: !!hsts, hsts_max_age: hstsMax || undefined,
    hsts_includes_sub: /includesubdomains/i.test(hsts),
    hsts_preload: /preload/i.test(hsts),
    x_frame_options: xfo,
    clickjacking_risk: !/SAMEORIGIN|DENY/i.test(xfo) && !csp.includes("frame-ancestors"),
    csp_present, csp_unsafe_inline: cspUnsafeInline, csp_unsafe_eval: cspUnsafeEval,
    csp_wildcard_hosts: cspWildcards.slice(0, 10),
    csp_report_only: !cspRaw && !!cspRO,
    cors_acao: acao || "(not set)",
    cors_wildcard_with_credentials: acao === "*" && acac,
    cookies, cookie_weak_count: weakCookies.length,
    mixed_content_resources: mixed,
    weaknesses,
  };
}

// ─── PAGE STRUCTURE: FORMS, IFRAMES, COMMENTS ────────────────────────────────
interface PageStructure {
  forms: Array<{ action: string; method: string; fields: string[]; hidden_fields: string[] }>;
  iframes: string[];
  html_comments: string[];
  noscript_blocks: number;
  hreflang: Array<{ lang: string; href: string }>;
  open_graph_full: Record<string, string>;
  twitter_full: Record<string, string>;
  jsonld_blocks: number;
}

function parsePageStructure(html: string): PageStructure {
  const forms: PageStructure["forms"] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) !== null && forms.length < 20) {
    const attrs = fm[1] || ""; const body = fm[2] || "";
    const action = (attrs.match(/action\s*=\s*["']([^"']+)["']/i)?.[1]) || "(self)";
    const method = (attrs.match(/method\s*=\s*["']([^"']+)["']/i)?.[1] || "GET").toUpperCase();
    const fields: string[] = []; const hidden: string[] = [];
    const inputRe = /<input\b([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = inputRe.exec(body)) !== null) {
      const a = im[1] || "";
      const name = a.match(/name\s*=\s*["']([^"']+)["']/i)?.[1];
      const type = (a.match(/type\s*=\s*["']([^"']+)["']/i)?.[1] || "text").toLowerCase();
      if (!name) continue;
      if (type === "hidden") hidden.push(name); else fields.push(`${name}:${type}`);
    }
    forms.push({ action, method, fields, hidden_fields: hidden });
  }
  const iframes = [...html.matchAll(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 20);
  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((m) => m[1].trim())
    .filter((c) => c.length > 6 && !/^\s*\[if|\bIE\b/.test(c))
    .slice(0, 20);
  const noscript = (html.match(/<noscript\b/gi) || []).length;
  const hreflang = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi)]
    .map((m) => ({ lang: m[1], href: m[2] })).slice(0, 30);
  const og: Record<string, string> = {};
  for (const m of html.matchAll(/<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']+)["']/gi)) og[m[1]] = m[2];
  const tw: Record<string, string> = {};
  for (const m of html.matchAll(/<meta[^>]+name=["']twitter:([^"']+)["'][^>]+content=["']([^"']+)["']/gi)) tw[m[1]] = m[2];
  const jsonld = (html.match(/<script[^>]+application\/ld\+json/gi) || []).length;
  return { forms, iframes, html_comments: comments, noscript_blocks: noscript, hreflang, open_graph_full: og, twitter_full: tw, jsonld_blocks: jsonld };
}

// ─── MOBILE APPS, AUTH, TRACKING SURFACE ─────────────────────────────────────
interface MobileAuthIntel {
  ios_app_link?: string;
  android_app_link?: string;
  app_bundle_ids: string[];
  deep_link_schemes: string[];
  apple_app_site_association?: boolean;
  android_assetlinks?: boolean;
  oauth_providers: string[];
  auth_provider_detected: string[];     // Auth0, Clerk, Supabase, Firebase, Cognito
  session_recording_tools: string[];    // Hotjar, FullStory, LogRocket
  ad_pixels: string[];                  // Meta, TikTok, LinkedIn
  live_chat: string[];                  // Intercom, Drift, Zendesk
  consent_banner: string[];             // OneTrust, Cookiebot
  ab_testing: string[];                 // Optimizely, LaunchDarkly
}

function parseMobileAuthIntel(html: string, jsCorpus: string): MobileAuthIntel {
  const all = html + "\n" + jsCorpus;
  const ios = all.match(/https?:\/\/apps\.apple\.com\/[^\s"'<>]+/i)?.[0];
  const droid = all.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?id=[A-Za-z0-9._\-]+/i)?.[0];
  const bundleIds = dedupe([...all.matchAll(/(?:bundle[_\-]?id|appId|package)\s*[:=]\s*["']([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,})["']/gi)].map((m) => m[1])).slice(0, 10);
  const schemes = dedupe([...all.matchAll(/["']([a-z][a-z0-9+.\-]{2,30}):\/\/[^\s"'<>]/gi)]
    .map((m) => m[1]).filter((s) => !["http","https","data","javascript","mailto","tel","file","blob","ws","wss","ftp"].includes(s.toLowerCase()))).slice(0, 10);

  const oauth: string[] = [];
  if (/accounts\.google\.com\/o\/oauth2|gsi\/client/i.test(all)) oauth.push("Google");
  if (/github\.com\/login\/oauth/i.test(all)) oauth.push("GitHub");
  if (/appleid\.apple\.com\/auth/i.test(all)) oauth.push("Apple");
  if (/facebook\.com\/v[0-9]+\/dialog\/oauth/i.test(all)) oauth.push("Facebook");
  if (/login\.microsoftonline\.com/i.test(all)) oauth.push("Microsoft");
  if (/linkedin\.com\/oauth/i.test(all)) oauth.push("LinkedIn");

  const authProv: string[] = [];
  if (/auth0\.com|@auth0\//i.test(all)) authProv.push("Auth0");
  if (/clerk\.com|@clerk\//i.test(all)) authProv.push("Clerk");
  if (/supabase\.co\/auth|@supabase\/auth/i.test(all)) authProv.push("Supabase Auth");
  if (/firebase[\/.]auth|firebaseauth/i.test(all)) authProv.push("Firebase Auth");
  if (/cognito-idp|amazoncognito/i.test(all)) authProv.push("AWS Cognito");
  if (/okta\.com|@okta\//i.test(all)) authProv.push("Okta");
  if (/workos\.com/i.test(all)) authProv.push("WorkOS");
  if (/stytch\.com/i.test(all)) authProv.push("Stytch");

  const session: string[] = [];
  if (/hotjar/i.test(all)) session.push("Hotjar");
  if (/fullstory/i.test(all)) session.push("FullStory");
  if (/logrocket/i.test(all)) session.push("LogRocket");
  if (/clarity\.ms/i.test(all)) session.push("Microsoft Clarity");
  if (/smartlook/i.test(all)) session.push("Smartlook");

  const pixels: string[] = [];
  if (/connect\.facebook\.net|fbq\(/i.test(all)) pixels.push("Meta Pixel");
  if (/analytics\.tiktok\.com|ttq\.load/i.test(all)) pixels.push("TikTok Pixel");
  if (/snap\.licdn\.com|_linkedin_partner_id/i.test(all)) pixels.push("LinkedIn Insight");
  if (/snap\.snapchat\.com|snaptr/i.test(all)) pixels.push("Snap Pixel");
  if (/pinimg\.com\/ct|pintrk\(/i.test(all)) pixels.push("Pinterest Tag");
  if (/bat\.bing\.com/i.test(all)) pixels.push("Microsoft Ads UET");
  if (/x\.ads-twitter\.com|twq\(/i.test(all)) pixels.push("X / Twitter Pixel");

  const chat: string[] = [];
  if (/intercom/i.test(all)) chat.push("Intercom");
  if (/drift\.com|driftt/i.test(all)) chat.push("Drift");
  if (/zdassets\.com|zopim/i.test(all)) chat.push("Zendesk");
  if (/crisp\.chat/i.test(all)) chat.push("Crisp");
  if (/tawk\.to/i.test(all)) chat.push("Tawk.to");
  if (/livechatinc/i.test(all)) chat.push("LiveChat");

  const consent: string[] = [];
  if (/onetrust|cookielaw\.org/i.test(all)) consent.push("OneTrust");
  if (/cookiebot/i.test(all)) consent.push("Cookiebot");
  if (/iubenda/i.test(all)) consent.push("Iubenda");
  if (/cookieyes/i.test(all)) consent.push("CookieYes");

  const abt: string[] = [];
  if (/optimizely/i.test(all)) abt.push("Optimizely");
  if (/launchdarkly/i.test(all)) abt.push("LaunchDarkly");
  if (/split\.io/i.test(all)) abt.push("Split.io");
  if (/vwo\.com|visualwebsiteoptimizer/i.test(all)) abt.push("VWO");

  return {
    ios_app_link: ios, android_app_link: droid,
    app_bundle_ids: bundleIds, deep_link_schemes: schemes,
    oauth_providers: dedupe(oauth), auth_provider_detected: dedupe(authProv),
    session_recording_tools: dedupe(session), ad_pixels: dedupe(pixels),
    live_chat: dedupe(chat), consent_banner: dedupe(consent), ab_testing: dedupe(abt),
  };
}

// ─── CLOUD STORAGE PROBE ─────────────────────────────────────────────────────
interface CloudProbe {
  bucket_url: string;
  type: "s3" | "gcs" | "azure" | "firebase";
  status: number;
  public_listing: boolean;
  risk: "info" | "warn" | "critical";
  note: string;
}

async function probeCloudBuckets(host: string, html: string | null, jsCorpus: string): Promise<CloudProbe[]> {
  const seen = new Set<string>();
  const corpus = (html || "") + "\n" + jsCorpus;
  const urls: Array<{ url: string; type: CloudProbe["type"] }> = [];
  for (const m of corpus.matchAll(/https?:\/\/[a-z0-9.\-]+\.s3[.\-][a-z0-9\-]*\.?amazonaws\.com[^"'<>\s]*/gi)) urls.push({ url: m[0], type: "s3" });
  for (const m of corpus.matchAll(/https?:\/\/storage\.googleapis\.com\/[a-z0-9._\-]+/gi)) urls.push({ url: m[0], type: "gcs" });
  for (const m of corpus.matchAll(/https?:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[a-z0-9._\-]+/gi)) urls.push({ url: m[0], type: "azure" });
  for (const m of corpus.matchAll(/https?:\/\/[a-z0-9\-]+\.firebaseio\.com\/?\.json/gi)) urls.push({ url: m[0], type: "firebase" });

  // Also infer S3 bucket by domain prefix
  const root = host.split(".").slice(-2)[0];
  if (root) {
    for (const guess of [`https://${root}.s3.amazonaws.com`, `https://${root}-prod.s3.amazonaws.com`, `https://${root}-static.s3.amazonaws.com`]) {
      urls.push({ url: guess, type: "s3" });
    }
  }

  const out: CloudProbe[] = [];
  for (const { url, type } of urls.slice(0, 12)) {
    if (seen.has(url)) continue; seen.add(url);
    const probeUrl = type === "s3" ? url.replace(/\/[^/]*$/, "") + "/" : url;
    const r = await fetchTimeout(probeUrl, { method: "GET", redirect: "manual" }, 5000);
    if (!r) continue;
    const txt = r.ok ? (await r.text().catch(() => "")).slice(0, 4000) : "";
    try { await r.body?.cancel(); } catch { /* */ }
    const listing = r.ok && (/<ListBucketResult|<EnumerationResults|"items"/i.test(txt));
    const risk: CloudProbe["risk"] = listing ? "critical" : (r.status === 200 ? "warn" : "info");
    let note = "";
    if (listing) note = "Bucket listing publicly enumerable — restrict ACL immediately";
    else if (r.status === 200) note = "Bucket reachable; verify object ACLs are private";
    else if (r.status === 403) note = "Access denied (good — listing blocked)";
    else if (r.status === 404) note = "Bucket not found / not claimed";
    else note = `HTTP ${r.status}`;
    out.push({ bucket_url: probeUrl, type, status: r.status, public_listing: listing, risk, note });
  }
  return out;
}

// ─── DEPENDENCY INTEL (from /package.json if exposed) ────────────────────────
interface DependencyIntel {
  package_json_exposed: boolean;
  name?: string;
  version?: string;
  dependency_count: number;
  dev_dependency_count: number;
  outdated_warnings: string[];     // pinned to old majors of common libs
  notable: string[];
}

const OLD_MAJOR_WARN: Record<string, number> = {
  "react": 17, "next": 12, "vue": 2, "angular": 14, "@angular/core": 14,
  "express": 4, "lodash": 4, "axios": 0, "webpack": 4, "node-fetch": 2,
};

async function dependencyIntel(host: string): Promise<DependencyIntel> {
  const out: DependencyIntel = { package_json_exposed: false, dependency_count: 0, dev_dependency_count: 0, outdated_warnings: [], notable: [] };
  const r = await fetchTimeout(`https://${host}/package.json`, { method: "GET", redirect: "manual" }, 5000);
  if (!r || !r.ok) return out;
  const txt = await r.text().catch(() => "");
  if (!/^\s*\{/.test(txt)) return out;
  try {
    const j = JSON.parse(txt);
    out.package_json_exposed = true;
    out.name = j.name; out.version = j.version;
    const deps = j.dependencies || {}; const devs = j.devDependencies || {};
    out.dependency_count = Object.keys(deps).length;
    out.dev_dependency_count = Object.keys(devs).length;
    for (const [name, v] of Object.entries({ ...deps, ...devs })) {
      const major = Number(String(v).match(/(\d+)/)?.[1] || 0);
      if (OLD_MAJOR_WARN[name] !== undefined && major <= OLD_MAJOR_WARN[name]) {
        out.outdated_warnings.push(`${name}@${v} — major below current LTS`);
      }
      if (/^next$|^react$|^vue$|^svelte$|^astro$|^@angular\/core$/.test(name)) out.notable.push(`${name}@${v}`);
    }
  } catch { /* malformed */ }
  return out;
}

// ─── PERFORMANCE & TRANSPORT INTEL ───────────────────────────────────────────
interface PerformanceIntel {
  ttfb_ms?: number;
  total_ms?: number;
  bytes_received?: number;
  http_protocol: string;       // best-effort: HTTP/1.1 vs HTTP/2 (alt-svc hint)
  compression: string;         // gzip / br / none
  cache_control?: string;
  cdn_hint?: string;           // Cloudflare / Vercel / Fastly / etc
}

async function performanceIntel(host: string): Promise<PerformanceIntel> {
  const start = Date.now();
  const r = await fetchTimeout(`https://${host}`, { method: "GET", redirect: "follow" }, 10_000);
  if (!r) return { http_protocol: "unknown", compression: "unknown" };
  const headers: Record<string, string> = {};
  r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const ttfb = Date.now() - start;
  let bytes = 0;
  try {
    const reader = r.body?.getReader();
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) bytes += value.length;
        if (bytes > 2_000_000) { try { reader.cancel(); } catch { /* */ } break; }
      }
    }
  } catch { /* */ }
  const total = Date.now() - start;
  const altSvc = headers["alt-svc"] || "";
  let proto = "HTTP/1.1";
  if (/h3/.test(altSvc)) proto = "HTTP/3 advertised (alt-svc h3)";
  else if (/h2/.test(altSvc) || headers[":status"]) proto = "HTTP/2 advertised";
  let cdn = "";
  if (headers["cf-ray"] || /cloudflare/i.test(headers["server"] || "")) cdn = "Cloudflare";
  else if (headers["x-vercel-id"]) cdn = "Vercel";
  else if (headers["x-amz-cf-id"]) cdn = "AWS CloudFront";
  else if (/fastly/i.test(headers["server"] || "") || headers["x-served-by"]?.includes("cache")) cdn = "Fastly";
  else if (/akamai/i.test(headers["server"] || "")) cdn = "Akamai";
  else if (/netlify/i.test(headers["server"] || "")) cdn = "Netlify";
  return {
    ttfb_ms: ttfb, total_ms: total, bytes_received: bytes,
    http_protocol: proto,
    compression: headers["content-encoding"] || "none",
    cache_control: headers["cache-control"],
    cdn_hint: cdn || undefined,
  };
}

// ─── PASSIVE THREAT-INTEL & REPUTATION (no auth, public endpoints) ───────────
interface ReputationIntel {
  hibp_breach_count?: number;     // public breaches list (no auth)
  google_safebrowsing_hint: "unknown";  // requires API key — left as hint
  wayback_dead_pages_sampled: number;
  notes: string[];
}

async function reputationIntel(host: string): Promise<ReputationIntel> {
  const root = host.split(".").slice(-2).join(".");
  const out: ReputationIntel = { google_safebrowsing_hint: "unknown", wayback_dead_pages_sampled: 0, notes: [] };
  // HIBP unauthenticated breach lookup
  const r = await fetchTimeout(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(root)}`, {
    headers: { "user-agent": "ZophielRecon/1.0" },
  }, 6000);
  if (r?.ok) {
    const j = await r.json().catch(() => null);
    if (Array.isArray(j)) {
      out.hibp_breach_count = j.length;
      if (j.length) out.notes.push(`Domain appears in ${j.length} known public breach(es) — review HIBP`);
    }
  }
  return out;
}

// ─── FORENSICS BUNDLE ────────────────────────────────────────────────────────
interface ForensicsBundle {
  identity: PageIdentity | null;
  redirect: { hops: Array<{ url: string; status: number }>; finalUrl: string; responseMs: number } | null;
  tech: TechFingerprint | null;
  exposed: ExposedFile[];
  links: LinkInventory | null;
  archive: { first_seen?: string; last_seen?: string; snapshots?: number } | null;
  sub_audit: SubAudit[];
  email_infra: EmailInfra | null;
  security_audit: SecurityAudit | null;
  page_structure: PageStructure | null;
  mobile_auth: MobileAuthIntel | null;
  cloud_buckets: CloudProbe[];
  dependencies: DependencyIntel | null;
  performance: PerformanceIntel | null;
  reputation: ReputationIntel | null;
}

async function liveForensics(host: string, html: string | null, headers: Record<string, string>, subs: string[], setCookieAll: string[], jsCorpus: string): Promise<ForensicsBundle> {
  const [redirect, exposed, archive, sub_audit, email_infra, cloud_buckets, dependencies, performance, reputation] = await Promise.all([
    redirectChain(host).catch(() => null),
    probeExposedFiles(host).catch(() => []),
    waybackInfo(host).catch(() => null),
    subs.length ? subdomainAudit(subs).catch(() => []) : Promise.resolve([]),
    emailInfraAudit(host).catch(() => null),
    probeCloudBuckets(host, html, jsCorpus).catch(() => []),
    dependencyIntel(host).catch(() => null),
    performanceIntel(host).catch(() => null),
    reputationIntel(host).catch(() => null),
  ]);
  const identity = html ? parsePageIdentity(html) : null;
  const tech = html ? parseTechFingerprint(html, headers) : null;
  const links = html ? parseLinkInventory(html, host) : null;
  const security_audit = auditSecurity(html, headers, setCookieAll);
  const page_structure = html ? parsePageStructure(html) : null;
  const mobile_auth = html ? parseMobileAuthIntel(html, jsCorpus) : null;
  return { identity, redirect, tech, exposed, links, archive, sub_audit, email_infra, security_audit, page_structure, mobile_auth, cloud_buckets, dependencies, performance, reputation };
}

interface ReconBundle {
  host: string;
  dns: { A: string[]; AAAA: string[]; MX: string[]; NS: string[]; TXT: string[]; CNAME: string[] };
  http: { status: number; finalUrl: string; headers: Record<string, string>; setCookieAll?: string[] } | null;
  geo: Record<string, unknown> | null;
  rdap: { registrar?: string; created?: string; expires?: string; nameservers?: string[] } | null;
  subdomains: string[];
}

// ─── OPEN-API-KEY / SECRET SCANNER ───────────────────────────────────────────
// Pulls the live HTML, walks every <script src="">, fetches each JS bundle,
// and pattern-matches embedded secrets so the asset owner can rotate them.

interface SecretHit {
  type: string;          // e.g. "google_api", "aws_key"
  label: string;         // human label
  match: string;         // redacted preview (first 6 + last 4)
  raw: string;           // full raw string (for owner triage)
  source: string;        // bundle URL or "inline"
  severity: "critical" | "high" | "med" | "low";
  context?: string;      // ±40 chars surrounding match
}

interface BundleFinding {
  source: string;
  size: number;
  hits: number;
}

interface SecretScan {
  bundles_scanned: number;
  bundles: BundleFinding[];
  inline_scripts: number;
  total_bytes: number;
  secrets: SecretHit[];
  emails: string[];
  github_links: string[];
  developer_comments: string[];
  internal_codenames: string[];
  feature_flags: string[];
  truncated: boolean;
}

const SECRET_PATTERNS: Array<{ type: string; label: string; re: RegExp; sev: SecretHit["severity"] }> = [
  { type: "google_api",      label: "Google API Key",        re: /AIza[0-9A-Za-z_\-]{35}/g,                                         sev: "high" },
  { type: "aws_key",         label: "AWS Access Key ID",     re: /AKIA[0-9A-Z]{16}/g,                                               sev: "critical" },
  { type: "aws_secret",      label: "AWS Secret Access Key", re: /(?<![A-Za-z0-9\/+=])[A-Za-z0-9\/+=]{40}(?![A-Za-z0-9\/+=])/g,     sev: "critical" },
  { type: "openai_sk",       label: "OpenAI Secret Key",     re: /sk-[A-Za-z0-9_\-]{20,}/g,                                         sev: "critical" },
  { type: "anthropic_key",   label: "Anthropic API Key",     re: /sk-ant-[A-Za-z0-9_\-]{20,}/g,                                     sev: "critical" },
  { type: "stripe_live",     label: "Stripe Live Key",       re: /(?:sk|rk|pk)_live_[0-9a-zA-Z]{16,}/g,                             sev: "critical" },
  { type: "stripe_test",     label: "Stripe Test Key",       re: /(?:sk|rk|pk)_test_[0-9a-zA-Z]{16,}/g,                             sev: "high" },
  { type: "github_token",    label: "GitHub Token",          re: /gh[pousr]_[A-Za-z0-9]{36,}/g,                                     sev: "critical" },
  { type: "slack_token",     label: "Slack Token",           re: /xox[abpors]-[0-9A-Za-z\-]{10,}/g,                                 sev: "critical" },
  { type: "supabase_key",    label: "Supabase JWT (anon/service)", re: /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, sev: "high" },
  { type: "supabase_url",    label: "Supabase Project URL",  re: /https?:\/\/[a-z0-9]{20}\.supabase\.co/g,                          sev: "med" },
  { type: "algolia_key",     label: "Algolia API Key",       re: /(?<![A-Za-z0-9])[a-f0-9]{32}(?![A-Za-z0-9])/g,                    sev: "med" },
  { type: "mapbox_token",    label: "Mapbox Token",          re: /pk\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,                        sev: "med" },
  { type: "sendgrid",        label: "SendGrid API Key",      re: /SG\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/g,                   sev: "critical" },
  { type: "twilio_sid",      label: "Twilio Account SID",    re: /AC[a-f0-9]{32}/g,                                                 sev: "high" },
  { type: "firebase_key",    label: "Firebase API Key",      re: /AIza[0-9A-Za-z_\-]{35}/g,                                         sev: "high" },
  { type: "private_key",     label: "Private Key Block",     re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA |)PRIVATE KEY-----/g,    sev: "critical" },
  { type: "jwt_generic",     label: "Generic JWT",           re: /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,           sev: "med" },
  { type: "sentry_dsn",      label: "Sentry DSN",            re: /https?:\/\/[a-f0-9]{20,}@[a-z0-9.\-]+\/[0-9]+/g,                  sev: "med" },
  { type: "datadog_key",     label: "Datadog Client Token",  re: /pub[a-f0-9]{32}/g,                                                sev: "med" },
  { type: "ga4_id",          label: "GA4 Measurement ID",    re: /G-[A-Z0-9]{8,12}/g,                                               sev: "low" },
  { type: "segment_write",   label: "Segment Write Key",     re: /(?<![A-Za-z0-9])[A-Za-z0-9]{32}(?![A-Za-z0-9])(?=[\s"',]|$)/g,    sev: "low" },
  { type: "recaptcha_site",  label: "reCAPTCHA Site Key",    re: /6L[0-9A-Za-z_\-]{38}/g,                                           sev: "low" },
  { type: "mapbox_pub",      label: "Mapbox Public Token",   re: /pk\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,                        sev: "med" },
  { type: "intercom_app",    label: "Intercom App ID",       re: /(?:intercomSettings\s*=\s*\{[^}]*app_id\s*:\s*["'])([a-z0-9]{8})/g, sev: "low" },
  { type: "hubspot_id",      label: "HubSpot Portal ID",     re: /(?:js\.hs-scripts\.com\/)([0-9]{6,9})/g,                          sev: "low" },
  { type: "fb_pixel",        label: "Meta/Facebook Pixel ID",re: /(?:fbq\(['"]init['"],\s*['"])([0-9]{15,16})/g,                    sev: "low" },
  { type: "tiktok_pixel",    label: "TikTok Pixel ID",       re: /(?:ttq\.load\(['"])([A-Z0-9]{20})/g,                              sev: "low" },
  { type: "linkedin_partner",label: "LinkedIn Partner ID",   re: /_linkedin_partner_id\s*=\s*["']?([0-9]{6,9})/g,                   sev: "low" },
  { type: "onesignal",       label: "OneSignal App ID",      re: /OneSignal\.init\([^)]*appId:\s*["']([a-f0-9\-]{36})/g,            sev: "low" },
  { type: "auth0_domain",    label: "Auth0 Domain",          re: /[a-z0-9\-]+\.(?:us|eu|au|jp)\.auth0\.com/g,                       sev: "med" },
  { type: "clerk_pub",       label: "Clerk Publishable Key", re: /pk_(?:test|live)_[A-Za-z0-9]{20,}/g,                              sev: "med" },
  { type: "firebase_url",    label: "Firebase RTDB URL",     re: /https?:\/\/[a-z0-9\-]+\.firebaseio\.com/g,                        sev: "med" },
  { type: "firebase_app",    label: "Firebase Project",      re: /[a-z0-9\-]+\.firebaseapp\.com/g,                                  sev: "low" },
  { type: "s3_bucket",       label: "S3 Bucket URL",         re: /https?:\/\/[a-z0-9.\-]+\.s3[.\-][a-z0-9\-]*\.?amazonaws\.com/g,   sev: "med" },
  { type: "gcs_bucket",      label: "GCS Bucket URL",        re: /https?:\/\/storage\.googleapis\.com\/[a-z0-9._\-]+/g,             sev: "med" },
  { type: "azure_blob",      label: "Azure Blob URL",        re: /https?:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[a-z0-9._\-]+/g,  sev: "med" },
  { type: "discord_webhook", label: "Discord Webhook",       re: /https?:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_\-]+/g, sev: "critical" },
  { type: "slack_webhook",   label: "Slack Webhook",         re: /https?:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/g, sev: "critical" },
  { type: "mailgun_key",     label: "Mailgun API Key",       re: /key-[0-9a-f]{32}/g,                                               sev: "critical" },
  { type: "square_token",    label: "Square Access Token",   re: /sq0(?:atp|csp)-[A-Za-z0-9_\-]{22,}/g,                             sev: "critical" },
  { type: "shopify_token",   label: "Shopify Access Token",  re: /shp(?:at|ca|pa|ss)_[a-fA-F0-9]{32,}/g,                            sev: "critical" },
  { type: "npm_token",       label: "npm Access Token",      re: /npm_[A-Za-z0-9]{36}/g,                                            sev: "critical" },
];

const EMAIL_RE   = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const GITHUB_RE  = /https?:\/\/github\.com\/[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+/g;
const COMMENT_RE = /(?:\/\/|\/\*)\s*(TODO|FIXME|HACK|XXX|NOTE|AUTHOR)\b[^\n*]{0,200}/gi;
const FEATURE_RE = /(?:feature|flag|featureFlag|FEATURE_)[A-Za-z0-9_]{2,40}\s*[:=]\s*(?:true|false|"[^"]{0,40}")/g;
const CODENAME_RE = /\b(?:strawberry|orion|sydney|gemini|gpt-?[0-9]|opus|sonnet|haiku|llama|claude|mistral|codename[_\-][a-z]+)\b/gi;
const SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
const INLINE_SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

function redact(s: string): string {
  if (s.length <= 14) return s.slice(0, 4) + "•••";
  return s.slice(0, 6) + "•••" + s.slice(-4);
}

function dedupe<T>(arr: T[]): T[] { return [...new Set(arr)]; }

function scanText(text: string, source: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const seen = new Set<string>();
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      const raw = m[0];
      const dedupKey = `${p.type}:${raw}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      // skip obvious false positives
      if (p.type === "algolia_key" && /^0+$|^f+$/.test(raw)) continue;
      if (p.type === "aws_secret") {
        // require some entropy: at least 1 digit, 1 lower, 1 upper
        if (!/[0-9]/.test(raw) || !/[a-z]/.test(raw) || !/[A-Z]/.test(raw)) continue;
      }
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + raw.length + 40);
      hits.push({
        type: p.type, label: p.label, raw,
        match: redact(raw),
        source, severity: p.sev,
        context: text.slice(start, end).replace(/\s+/g, " ").trim(),
      });
      if (hits.length > 200) return hits;
    }
  }
  return hits;
}

async function fetchText(url: string, max = 1_500_000): Promise<string | null> {
  const r = await fetchTimeout(url, { method: "GET", redirect: "follow" }, 12_000);
  if (!r || !r.ok) return null;
  const ct = r.headers.get("content-type") || "";
  // Allow html/js/json/text
  if (!/text|javascript|json|xml/i.test(ct) && ct) {
    try { await r.body?.cancel(); } catch { /* */ }
    return null;
  }
  const reader = r.body?.getReader();
  if (!reader) return await r.text().catch(() => null);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > max) { try { reader.cancel(); } catch { /* */ } break; }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

async function secretScan(host: string): Promise<SecretScan> {
  const out: SecretScan = {
    bundles_scanned: 0, bundles: [], inline_scripts: 0, total_bytes: 0,
    secrets: [], emails: [], github_links: [], developer_comments: [],
    internal_codenames: [], feature_flags: [], truncated: false,
  };
  const baseUrl = `https://${host}`;
  const html = await fetchText(baseUrl, 2_000_000);
  if (!html) return out;
  out.total_bytes += html.length;

  const collected: SecretHit[] = [];

  // Inline scripts
  let im: RegExpExecArray | null;
  INLINE_SCRIPT_RE.lastIndex = 0;
  while ((im = INLINE_SCRIPT_RE.exec(html)) !== null) {
    const inline = im[1] || "";
    if (inline.trim().length > 20) {
      out.inline_scripts++;
      collected.push(...scanText(inline, "inline"));
    }
  }

  // Bundle URLs from <script src>
  const bundleSet = new Set<string>();
  let sm: RegExpExecArray | null;
  SCRIPT_SRC_RE.lastIndex = 0;
  while ((sm = SCRIPT_SRC_RE.exec(html)) !== null) {
    let src = (sm[1] || "").trim();
    if (!src) continue;
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = baseUrl + src;
    else if (!/^https?:\/\//i.test(src)) src = baseUrl + "/" + src.replace(/^\.?\//, "");
    bundleSet.add(src);
  }

  // Cap bundles to avoid runaway
  const bundles = [...bundleSet].slice(0, 25);
  if (bundleSet.size > bundles.length) out.truncated = true;

  const results = await Promise.all(bundles.map(async (u) => {
    const txt = await fetchText(u, 1_500_000).catch(() => null);
    if (!txt) return { u, size: 0, hits: [] as SecretHit[] };
    return { u, size: txt.length, hits: scanText(txt, u), text: txt };
  }));

  for (const r of results) {
    if (!r.size) continue;
    out.bundles_scanned++;
    out.total_bytes += r.size;
    out.bundles.push({ source: r.u, size: r.size, hits: r.hits.length });
    collected.push(...r.hits);
    const text = (r as { text?: string }).text || "";
    out.emails.push(...(text.match(EMAIL_RE) || []));
    out.github_links.push(...(text.match(GITHUB_RE) || []));
    out.developer_comments.push(...(text.match(COMMENT_RE) || []).map((s) => s.slice(0, 200)));
    out.internal_codenames.push(...(text.match(CODENAME_RE) || []));
    out.feature_flags.push(...(text.match(FEATURE_RE) || []));
  }

  // Also harvest signals from raw HTML
  out.emails.push(...(html.match(EMAIL_RE) || []));
  out.github_links.push(...(html.match(GITHUB_RE) || []));
  out.developer_comments.push(...(html.match(COMMENT_RE) || []).map((s) => s.slice(0, 200)));
  out.internal_codenames.push(...(html.match(CODENAME_RE) || []));

  // Dedupe + cap
  out.secrets = collected.slice(0, 150);
  out.emails = dedupe(out.emails).slice(0, 80);
  out.github_links = dedupe(out.github_links).slice(0, 40);
  out.developer_comments = dedupe(out.developer_comments).slice(0, 40);
  out.internal_codenames = dedupe(out.internal_codenames.map((s) => s.toLowerCase())).slice(0, 40);
  out.feature_flags = dedupe(out.feature_flags).slice(0, 40);

  return out;
}

async function liveRecon(target: string, opts: { withSubs: boolean }): Promise<ReconBundle> {
  const host = extractHostname(target);
  const [A, AAAA, MX, NS, TXT, CNAME, http, subs] = await Promise.all([
    dohQuery(host, "A"),
    dohQuery(host, "AAAA"),
    dohQuery(host, "MX"),
    dohQuery(host, "NS"),
    dohQuery(host, "TXT"),
    dohQuery(host, "CNAME"),
    probeHttp(host),
    opts.withSubs ? crtshSubdomains(host) : Promise.resolve([] as string[]),
  ]);

  const firstIp = A[0];
  const [geo, rdapRaw] = await Promise.all([
    firstIp ? geoIp(firstIp) : Promise.resolve(null),
    rdapLookup(host),
  ]);

  let rdap: ReconBundle["rdap"] = null;
  if (rdapRaw) {
    const events = (rdapRaw as { events?: Array<{ eventAction?: string; eventDate?: string }> }).events || [];
    const created = events.find((e) => e.eventAction === "registration")?.eventDate;
    const expires = events.find((e) => e.eventAction === "expiration")?.eventDate;
    const entities = (rdapRaw as { entities?: Array<{ roles?: string[]; vcardArray?: unknown }> }).entities || [];
    const registrarEnt = entities.find((e) => e.roles?.includes("registrar"));
    const registrar = (() => {
      const v = registrarEnt?.vcardArray as unknown[] | undefined;
      if (!Array.isArray(v) || v.length < 2) return undefined;
      const arr = v[1] as Array<unknown[]>;
      const fn = arr.find((x) => Array.isArray(x) && x[0] === "fn");
      return fn ? String(fn[3]) : undefined;
    })();
    rdap = {
      registrar,
      created,
      expires,
      nameservers: ((rdapRaw as { nameservers?: Array<{ ldhName?: string }> }).nameservers || [])
        .map((n) => n.ldhName || "").filter(Boolean),
    };
  }

  return { host, dns: { A, AAAA, MX, NS, TXT, CNAME }, http, geo, rdap, subdomains: subs };
}

function reconToPromptBlock(r: ReconBundle): string {
  const h = r.http?.headers || {};
  const securityHdrs = [
    "strict-transport-security", "content-security-policy", "x-frame-options",
    "x-content-type-options", "referrer-policy", "permissions-policy",
    "cross-origin-opener-policy", "cross-origin-resource-policy",
  ];
  const presentSec = securityHdrs.filter((k) => h[k]);
  const missingSec = securityHdrs.filter((k) => !h[k]);
  const geo = (r.geo || {}) as Record<string, unknown>;

  return `=== LIVE RECON FACTS (ground truth — do not contradict) ===
HOST: ${r.host}
DNS:
  A:     ${r.dns.A.join(", ") || "(none)"}
  AAAA:  ${r.dns.AAAA.join(", ") || "(none)"}
  CNAME: ${r.dns.CNAME.join(", ") || "(none)"}
  MX:    ${r.dns.MX.join(" | ") || "(none)"}
  NS:    ${r.dns.NS.join(", ") || "(none)"}
  TXT:   ${r.dns.TXT.slice(0, 8).join(" | ") || "(none)"}
HTTP:
  status: ${r.http?.status ?? "unreachable"}
  finalUrl: ${r.http?.finalUrl ?? "n/a"}
  server: ${h["server"] ?? "(not disclosed)"}
  x-powered-by: ${h["x-powered-by"] ?? "(not disclosed)"}
  via: ${h["via"] ?? "(none)"}
  cf-ray: ${h["cf-ray"] ?? "(none)"}
  x-vercel-id: ${h["x-vercel-id"] ?? "(none)"}
  x-amz-cf-id: ${h["x-amz-cf-id"] ?? "(none)"}
  content-type: ${h["content-type"] ?? "(none)"}
  set-cookie present: ${h["set-cookie"] ? "yes" : "no"}
  security headers PRESENT: ${presentSec.join(", ") || "(none)"}
  security headers MISSING: ${missingSec.join(", ") || "(all present)"}
GEOIP (first A):
  ip: ${geo.ip ?? "n/a"}
  org: ${geo.org ?? "n/a"}
  asn: ${geo.asn ?? "n/a"}
  country: ${geo.country_name ?? "n/a"}
  region: ${geo.region ?? "n/a"}
  city: ${geo.city ?? "n/a"}
RDAP/WHOIS:
  registrar: ${r.rdap?.registrar ?? "n/a"}
  created: ${r.rdap?.created ?? "n/a"}
  expires: ${r.rdap?.expires ?? "n/a"}
  nameservers: ${r.rdap?.nameservers?.join(", ") ?? "n/a"}
CERT-TRANSPARENCY SUBDOMAINS (live crt.sh, ${r.subdomains.length} found):
  ${r.subdomains.slice(0, 60).join("\n  ") || "(none)"}
=== END RECON FACTS ===
`;
}


const SYSTEM_PROMPT = `You are ZOPHIEL — a forensic DEFENSIVE intelligence engine for asset owners and authorized security teams.

Purpose: help organizations audit and harden THEIR OWN web assets. Output is a defensive self-assessment blueprint: what an external observer can already infer from public sources, so the owner can fix it.

Given a target URL, you must return a complete BLUEPRINT MAP of its digital infrastructure as a structured JSON tree of nodes and connections.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "target": "domain.tld",
  "summary": "2-sentence executive overview of the stack & posture.",
  "score": { "security": 0-100, "performance": 0-100, "complexity": 0-100 },
  "branches": [
    { "id": "domain", "label": "DOMAIN & DNS", "icon": "globe", "tone": "neutral", "leaves": [...] },
    { "id": "hosting", "label": "HOSTING & CDN", "icon": "server", "tone": "good", "leaves": [...] },
    { "id": "stack", "label": "TECH STACK", "icon": "cpu", "tone": "neutral", "leaves": [...] },
    { "id": "security", "label": "SECURITY POSTURE", "icon": "shield", "tone": "warn", "leaves": [...] },
    { "id": "thirdparty", "label": "THIRD-PARTY", "icon": "plug", "tone": "neutral", "leaves": [...] },
    { "id": "network", "label": "NETWORK TOPOLOGY", "icon": "network", "tone": "neutral", "leaves": [...] },
    { "id": "org", "label": "ORG INTEL", "icon": "building", "tone": "neutral", "leaves": [...] },
    { "id": "subdomains", "label": "SUBDOMAINS", "icon": "network", "tone": "neutral",
      "leaves": [
        { "label": "api.domain.tld", "value": "REST API gateway", "confidence": "high" },
        { "label": "mail.domain.tld", "value": "Email infrastructure", "confidence": "med" }
      ],
      "subdomains": ["api.domain.tld", "mail.domain.tld", "cdn.domain.tld", "blog.domain.tld"]
    },
    { "id": "threats", "label": "THREAT & CVE EXPOSURE", "icon": "shield", "tone": "warn",
      "leaves": [
        { "label": "Next.js 13.4.1", "value": "CVE-2024-XXXX (RCE) — upgrade ≥14.2.10", "confidence": "high" },
        { "label": "Risk score", "value": "72/100 (HIGH)", "confidence": "med" }
      ] },
    { "id": "leaks", "label": "DATA LEAK SURFACE", "icon": "shield", "tone": "critical",
      "leaves": [
        { "label": "Public GitHub repos", "value": "Likely org repos exposing build configs", "confidence": "med" },
        { "label": "JS bundle secrets", "value": "Audit bundle for embedded keys / connection strings", "confidence": "med" },
        { "label": "Public S3/GCS buckets", "value": "Enumerate via cert/log patterns and rotate any exposed", "confidence": "med" }
      ] },
    { "id": "people", "label": "PERSONNEL EXPOSURE", "icon": "building", "tone": "neutral",
      "leaves": [
        { "label": "Email pattern", "value": "first.last@domain.tld (publicly inferable)", "confidence": "high" },
        { "label": "LinkedIn footprint", "value": "~12 employees discoverable; key roles named publicly", "confidence": "med" },
        { "label": "Phishing risk", "value": "MEDIUM — DMARC posture below mitigates spoofing", "confidence": "med" }
      ] },
    { "id": "history", "label": "HISTORICAL EVOLUTION", "icon": "globe", "tone": "neutral",
      "leaves": [
        { "label": "Domain age", "value": "Registered YYYY-MM (X months)", "confidence": "high" },
        { "label": "Stack timeline", "value": "Vercel→GCP migration; Clerk auth added", "confidence": "med" },
        { "label": "Past incidents", "value": "SSL expiry / DNS misconfig events visible in archives", "confidence": "low" }
      ] },
    { "id": "attacksurface", "label": "ATTACK SURFACE", "icon": "network", "tone": "warn",
      "leaves": [
        { "label": "Exposed subdomains", "value": "staging.* / dev.* / admin.* — restrict or auth-gate", "confidence": "high" },
        { "label": "Open ports", "value": "Limit 80/443 only; close 8080/27017 if reachable", "confidence": "med" },
        { "label": "API endpoints", "value": "/api/admin, /api/internal — enforce auth + rate limit", "confidence": "med" }
      ] },
    { "id": "peers", "label": "PEER COMPARISON", "icon": "network", "tone": "neutral",
      "leaves": [
        { "label": "Same stack peers", "value": "Sites on same framework/version with similar posture", "confidence": "med" },
        { "label": "Shared ASN", "value": "Co-tenants on same hosting subnet", "confidence": "med" }
      ] },
    { "id": "socialeng", "label": "SOCIAL-ENG RISK", "icon": "building", "tone": "warn",
      "leaves": [
        { "label": "High-value targets", "value": "Executive emails publicly inferable — train + MFA enforce", "confidence": "high" },
        { "label": "Trust signals", "value": "Workspace email + DMARC strength assessment", "confidence": "med" }
      ] },
    { "id": "monitoring", "label": "CHANGE MONITORING", "icon": "network", "tone": "neutral",
      "leaves": [
        { "label": "New subdomains (24h)", "value": "Recommend cert-transparency watch", "confidence": "high" },
        { "label": "Recent commits", "value": "Public org repo activity to monitor for secret leaks", "confidence": "med" },
        { "label": "Cert renewals", "value": "Track expirations to avoid outages", "confidence": "high" }
      ] },
    { "id": "remediation", "label": "REMEDIATION ROADMAP", "icon": "shield", "tone": "good",
      "leaves": [
        { "label": "Priority 1", "value": "Auth-gate staging/dev subdomains (CRITICAL)", "confidence": "high" },
        { "label": "Priority 2", "value": "Rotate exposed keys; lock cloud storage ACLs", "confidence": "high" },
        { "label": "Priority 3", "value": "Enforce DMARC=reject; phishing simulation for staff", "confidence": "med" }
      ] },
    { "id": "underground", "label": "UNDERGROUND MENTIONS", "icon": "shield", "tone": "neutral",
      "leaves": [
        { "label": "Forum chatter", "value": "Public-archive mentions of brand/domain (if any)", "confidence": "low" },
        { "label": "Credential dumps", "value": "Check HIBP / breach indices for employee emails", "confidence": "med" }
      ] },
    { "id": "recon", "label": "RECON SWEEP", "icon": "network", "tone": "warn",
      "leaves": [
        { "label": "Basic Recon", "value": "Site title, IP, web server, CMS detection, Cloudflare presence, robots.txt", "confidence": "high" },
        { "label": "WHOIS Lookup", "value": "Registrar, registrant org, creation/expiry dates, name servers", "confidence": "high" },
        { "label": "GeoIP Lookup", "value": "Country, region, city, ASN, ISP for resolved IP", "confidence": "high" },
        { "label": "Banner Grab", "value": "Server / X-Powered-By / framework banners — recommend stripping", "confidence": "high" },
        { "label": "DNS Lookup", "value": "A / AAAA / MX / NS / TXT / SOA records inventory", "confidence": "high" },
        { "label": "Open-Port Surface", "value": "Common ports observable externally (21,22,25,80,110,143,443,465,587,993,995,3306,3389,8080) — close all not in use", "confidence": "med" },
        { "label": "Reverse-IP & Co-Hosted Domains", "value": "Other sites sharing the same IP (shared-hosting risk)", "confidence": "med" },
        { "label": "Subdomain Sweep", "value": "Common-name brute pattern (api, mail, dev, staging, admin, vpn, git, docs)", "confidence": "high" },
        { "label": "CMS / Framework Vuln Class", "value": "If WordPress/Joomla/Drupal: outdated core/plugin classes to patch", "confidence": "med" },
        { "label": "Crawler Findings", "value": "Internal links, external links, JS files, CSS files, images surface map", "confidence": "med" },
        { "label": "Honeypot Likelihood", "value": "Heuristic 0-1 score (Shodan-style) for whether peer IPs look like honeypots", "confidence": "low" }
      ] },
    { "id": "huntsurface", "label": "HUNT SURFACE AUDIT", "icon": "shield", "tone": "warn",
      "leaves": [
        { "label": "Subdomain Enumeration", "value": "Cert-transparency + passive DNS surface (amass/subfinder class) — list shadow assets to retire", "confidence": "high" },
        { "label": "Port & Service Scan", "value": "Externally reachable services (naabu/masscan class) — close non-essential", "confidence": "high" },
        { "label": "URL & Endpoint Discovery", "value": "Wayback / gau / waybackurls patterns — historical endpoints still live", "confidence": "high" },
        { "label": "Parameter Discovery", "value": "Hidden query params (Arjun/ParamSpider class) — audit untrusted inputs", "confidence": "med" },
        { "label": "JS Secret Scan", "value": "API keys, tokens, internal URLs leaked in bundled JS (LinkFinder/SecretFinder class)", "confidence": "high" },
        { "label": "Subdomain Takeover Risk", "value": "Dangling CNAMEs to unclaimed S3/Heroku/GH-Pages (subjack/subzy class) — reclaim or delete", "confidence": "high" },
        { "label": "Cloud Storage Exposure", "value": "Public S3 / GCS / Azure buckets tied to brand (S3Scanner class) — set private", "confidence": "med" },
        { "label": "GitHub / SCM Leakage", "value": "Org repos, gists, dotfiles exposing creds (gitleaks/trufflehog class) — rotate + scan history", "confidence": "high" },
        { "label": "CORS Misconfiguration", "value": "Wildcard / reflected Origin allowing credentialed cross-site reads — tighten allowlist", "confidence": "med" },
        { "label": "Open Redirect Surface", "value": "Redirect params reachable from public pages — validate target host", "confidence": "med" },
        { "label": "XSS / SQLi / SSRF Class", "value": "Input sinks observable in forms/APIs (dalfox/sqlmap/ssrfmap class) — parameterize + sanitize", "confidence": "med" },
        { "label": "Visual Recon", "value": "Screenshot sweep of subdomains (aquatone/gowitness class) — flag forgotten admin panels", "confidence": "med" },
        { "label": "Tech Fingerprint Drift", "value": "Mixed/legacy stacks across subdomains (wappalyzer class) — consolidate + patch", "confidence": "med" },
        { "label": "Bug Bounty Program Status", "value": "Public VDP/bounty presence (HackerOne/Bugcrowd) — recommend opening intake channel", "confidence": "low" }
      ] }

  "edges": [
    { "from": "domain", "to": "hosting", "label": "resolves" },
    { "from": "hosting", "to": "stack", "label": "serves" },
    { "from": "stack", "to": "thirdparty", "label": "loads" },
    { "from": "stack", "to": "security", "label": "exposes" },
    { "from": "thirdparty", "to": "network", "label": "extends" },
    { "from": "domain", "to": "org", "label": "owned by" },
    { "from": "domain", "to": "subdomains", "label": "delegates" },
    { "from": "stack", "to": "threats", "label": "vulnerable via" },
    { "from": "org", "to": "leaks", "label": "exposes" },
    { "from": "org", "to": "people", "label": "employs" },
    { "from": "domain", "to": "history", "label": "evolved through" },
    { "from": "subdomains", "to": "attacksurface", "label": "expands" },
    { "from": "stack", "to": "peers", "label": "shared by" },
    { "from": "people", "to": "socialeng", "label": "targeted via" },
    { "from": "attacksurface", "to": "monitoring", "label": "watched by" },
    { "from": "threats", "to": "remediation", "label": "fixed via" },
    { "from": "leaks", "to": "underground", "label": "surfaces in" },
    { "from": "domain", "to": "recon", "label": "scanned by" },
    { "from": "recon", "to": "attacksurface", "label": "feeds" },
    { "from": "subdomains", "to": "huntsurface", "label": "audited via" },
    { "from": "huntsurface", "to": "remediation", "label": "fixed via" }
  ],
  "criticals": [
    { "branch": "security", "finding": "CSP allows unsafe-eval", "severity": "high" }
  ]
}

Rules:
- Each branch MUST have 4-8 leaves with concrete observed/inferred values.
- Use 'tone' to color-code branches: good (secure/modern), neutral (standard), warn (gaps), critical (severe).
- Leaves should be FACTS or DEFENSIVE recommendations ("Nginx 1.24 — upgrade to 1.26"), not vague descriptions.
- Always include ALL branches above (20 total: domain, hosting, stack, security, thirdparty, network, org, subdomains, threats, leaks, people, history, attacksurface, peers, socialeng, monitoring, remediation, underground, recon, huntsurface).
- For 'recon': provide Basic Recon, WHOIS, GeoIP, Banner Grab, DNS, Open-Port surface, Reverse-IP/Co-Hosted, Subdomain Sweep, CMS vuln class, Crawler findings, and Honeypot likelihood. Frame as defensive audit only.
- For 'huntsurface': cover subdomain enum, port scan, URL/endpoint discovery, parameter discovery, JS secret scan, subdomain takeover, cloud storage exposure, SCM leakage, CORS, open redirect, XSS/SQLi/SSRF class, visual recon, tech fingerprint drift, intake-channel status. Frame strictly as a defensive self-audit checklist for the asset owner — no exploit payloads, no working PoCs.
- For 'threats': cross-reference detected versions against known CVE patterns; cite CVE IDs where confident, otherwise say "no known public CVE for this version".
- For 'leaks': describe the EXPOSURE SURFACE (where leaks typically occur for this stack) and remediation — DO NOT fabricate specific leaked credentials.
- For 'people': inferable email patterns and public LinkedIn footprint only — never invent named individuals or personal data.
- For 'history': use observable signals (domain age, archive snapshots, cert history, stack migrations).
- For 'attacksurface': common exposed subdomain conventions and ports — frame as "audit & restrict", not exploitation steps.
- For 'underground': only cite verifiable public sources; if none known, say "no public mentions found — continue monitoring".
- For 'remediation': always at least 3 prioritized fixes (P1/P2/P3) with concrete actions.
- For the 'subdomains' branch: enumerate 6-20 likely/observed subdomains via cert transparency patterns and common conventions (api, mail, cdn, blog, dev, staging, app, admin, docs, status, m, www, secure, vpn, git). Populate the 'subdomains' string array with bare hostnames only.
- This is a DEFENSIVE audit for the asset owner. Frame every finding as "what to fix", never "how to exploit". No exploit code, no attack scripts, no working payloads.
- Output JSON only. No prose before or after.`;

const SUBDOMAIN_SYSTEM_PROMPT = `You are ZOPHIEL — forensic infrastructure intelligence engine.

Given a SUBDOMAIN target (e.g. api.example.com), return a BLUEPRINT MAP for THAT specific subdomain — focusing on how it differs from the parent (its own stack, CDN, security headers, third-parties, purpose).

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "target": "api.example.com",
  "summary": "2-sentence overview of THIS subdomain's stack & posture.",
  "score": { "security": 0-100, "performance": 0-100, "complexity": 0-100 },
  "branches": [
    { "id": "domain", "label": "DOMAIN & DNS", "icon": "globe", "tone": "neutral", "leaves": [{"label":"...","value":"...","confidence":"high"}] },
    { "id": "hosting", "label": "HOSTING & CDN", "icon": "server", "tone": "good", "leaves": [...] },
    { "id": "stack", "label": "TECH STACK", "icon": "cpu", "tone": "neutral", "leaves": [...] },
    { "id": "security", "label": "SECURITY POSTURE", "icon": "shield", "tone": "warn", "leaves": [...] },
    { "id": "thirdparty", "label": "THIRD-PARTY", "icon": "plug", "tone": "neutral", "leaves": [...] },
    { "id": "network", "label": "NETWORK TOPOLOGY", "icon": "network", "tone": "neutral", "leaves": [...] },
    { "id": "org", "label": "ORG INTEL", "icon": "building", "tone": "neutral", "leaves": [...] }
  ],
  "edges": [
    { "from": "domain", "to": "hosting", "label": "resolves" },
    { "from": "hosting", "to": "stack", "label": "serves" },
    { "from": "stack", "to": "security", "label": "exposes" },
    { "from": "stack", "to": "thirdparty", "label": "loads" }
  ],
  "criticals": [
    { "branch": "security", "finding": "...", "severity": "high|med|low" }
  ]
}

Rules:
- Each branch MUST have 4-8 concrete leaves (FACTS, not descriptions).
- Always include all 7 branches above (no subdomains branch on a subdomain target).
- Use 'tone' to color-code: good, neutral, warn, critical.
- Output JSON only. No prose.`;



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, byok, mode } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSubdomainMode = mode === "subdomain";
    const activeSystemPrompt = isSubdomainMode ? SUBDOMAIN_SYSTEM_PROMPT : SYSTEM_PROMPT;

    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    const useByok = _resolved.mode === 'byok';
    const GEMINI_API_KEY = _resolved.geminiKey || '';

    // Live recon + secret scan + forensics — pull real, observable facts
    let recon: ReconBundle | null = null;
    let secrets: SecretScan | null = null;
    let forensics: ForensicsBundle | null = null;
    try {
      const host = extractHostname(url);
      const [r, s] = await Promise.all([
        liveRecon(url, { withSubs: !isSubdomainMode }),
        secretScan(host).catch((e) => { console.error("[blueprint] secret scan failed", e); return null; }),
      ]);
      recon = r;
      secrets = s;
      const html = await fetchText(`https://${host}`, 2_000_000).catch(() => null);
      const headers = recon?.http?.headers || {};
      const setCookieAll = recon?.http?.setCookieAll || (headers["set-cookie"] ? [headers["set-cookie"]] : []);
      // Build a small JS corpus from top bundles already discovered by secretScan
      const jsCorpus = (s?.bundles || []).slice(0, 6).map((b) => b.source).join("\n");
      forensics = await liveForensics(host, html, headers, recon?.subdomains || [], setCookieAll, jsCorpus).catch((e) => {
        console.error("[blueprint] forensics failed", e); return null;
      });
    } catch (e) {
      console.error("[blueprint] recon failed", e);
    }
    const reconBlock = recon ? reconToPromptBlock(recon) : "";

    const userPrompt = isSubdomainMode
      ? `${reconBlock}\nSubdomain target: ${url}\n\nReturn the JSON blueprint for THIS subdomain now, grounded in the LIVE RECON FACTS above.`
      : `${reconBlock}\nTarget URL: ${url}\n\nReturn the JSON blueprint now, grounded in the LIVE RECON FACTS above. Populate the 'subdomains' branch using the CERT-TRANSPARENCY SUBDOMAINS list verbatim (do not invent hostnames).`;


    let raw = "";
    let finishReason: string | undefined;
    if (useByok) {
      try {
        raw = await callByokJsonWithRetry(byok as ZophielByokConfig, activeSystemPrompt, userPrompt, {
          timeoutMs: 60_000,
          temperature: 0.3,
          maxOutputTokens: 16384,
          attempts: 2,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "BYOK call failed";
        console.error("[blueprint] BYOK error", msg);
        return new Response(
          JSON.stringify({ error: `Your AI key call failed: ${msg}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const modelChain = ["gemini-flash-latest", "gemini-flash-latest", "gemini-2.5-flash-lite"];
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: activeSystemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 16384,
        },
      });

      let aiResp: Response | null = null;
      let lastStatus = 0;
      let lastErrText = "";
      for (let i = 0; i < modelChain.length; i++) {
        const model = modelChain[i];
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body },
        );
        if (resp.ok) { aiResp = resp; break; }
        lastStatus = resp.status;
        lastErrText = await resp.text();
        console.error(`[blueprint] AI ${model} error`, resp.status, lastErrText.slice(0, 200));
        // Retry only on transient upstream errors
        if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500 && resp.status !== 502) break;
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i))); // 800ms, 1.6s, 3.2s
      }

      if (!aiResp) {
        const friendly = lastStatus === 503
          ? "AI is overloaded. Please retry in a moment."
          : `Gemini: ${lastStatus}`;
        return new Response(
          JSON.stringify({ error: friendly, upstream_status: lastStatus }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const aiData = await aiResp.json();
      const candidate = aiData?.candidates?.[0];
      finishReason = candidate?.finishReason;
      raw = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    }

    if (!raw.trim()) {
      console.error("[blueprint] empty response", { finishReason, aiData });
      return new Response(
        JSON.stringify({ error: `Empty AI response (finish: ${finishReason || "unknown"})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (finishReason === "MAX_TOKENS") {
      console.error("[blueprint] truncated", { length: raw.length });
      return new Response(
        JSON.stringify({ error: "AI response truncated — try a shorter target or retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip fences and salvage to last closing brace
    let cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);

    let blueprint: any;
    try {
      blueprint = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[blueprint] parse failed", parseErr, "raw:", raw.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON — please retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Guarantee live recon overrides AI guesswork on subdomains
    if (recon && !isSubdomainMode && Array.isArray(blueprint?.branches)) {
      const subBranch = blueprint.branches.find((b: { id: string }) => b.id === "subdomains");
      if (subBranch && recon.subdomains.length) {
        subBranch.subdomains = recon.subdomains;
      }
    }
    if (recon && blueprint && !blueprint.target) blueprint.target = recon.host;

    return new Response(
      JSON.stringify({ success: true, blueprint, recon, secrets, forensics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[blueprint] fatal", e);
    return new Response(
      JSON.stringify({ error: e?.message || "extract failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
