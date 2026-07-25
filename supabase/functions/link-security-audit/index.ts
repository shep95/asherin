import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type Severity = "Critical" | "High" | "Medium" | "Low" | "Info";

interface Finding {
  finding: string;
  severity: Severity;
  evidence: string;
  remediation: string;
}

const TIMEOUT_MS = 7000;
const EXPOSED_PATHS = [
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git/HEAD",
  "/.git/config",
  "/backup.sql",
  "/database.sql",
  "/wp-config.php.bak",
  "/config.json",
  "/package.json",
  "/robots.txt",
  "/.well-known/security.txt",
];

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

function normalizeUrl(input: string): URL {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withScheme);
  if (!/^https?:$/i.test(parsed.protocol)) throw new Error("Only HTTP/HTTPS URLs can be audited");
  parsed.hash = "";
  return parsed;
}

function isPrivateIp(value: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(value));
}

function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254" ||
    isPrivateIp(host)
  ) {
    throw new Error("Private, loopback, and metadata hosts are blocked");
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function dnsQuery(host: string, type: string): Promise<string[]> {
  try {
    const r = await fetchWithTimeout(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${encodeURIComponent(type)}`,
      { headers: { accept: "application/dns-json" } },
      4500,
    );
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    const answers = Array.isArray(j?.Answer) ? j.Answer : [];
    return answers.map((a: { data?: string }) => String(a.data || "")).filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const blocked = new Set(["set-cookie", "cf-ray", "x-deployment-id", "x-deno-execution-id", "server-timing"]);
  headers.forEach((value, key) => { out[key.toLowerCase()] = value; });
  for (const key of blocked) delete out[key];
  return out;
}

function redactProviderInternals<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/lovable\.dev/gi, "provider-redacted") as T;
  }
  if (Array.isArray(value)) return value.map((item) => redactProviderInternals(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactProviderInternals(item);
    }
    return out as T;
  }
  return value;
}

function parseMeta(html: string) {
  const grab = (re: RegExp) => html.match(re)?.[1]?.trim() || "";
  return {
    title: grab(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/<[^>]+>/g, "").slice(0, 160),
    description: (
      grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ).slice(0, 240),
    generator: grab(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i).slice(0, 120),
  };
}

function detectTech(html: string, headers: Record<string, string>): string[] {
  const tech = new Set<string>();
  if (/react|react-dom|_jsx|vite/i.test(html)) tech.add("React/Vite-style frontend");
  if (/__NEXT_DATA__|_next\/static/i.test(html)) tech.add("Next.js");
  if (/wp-content|wp-includes/i.test(html)) tech.add("WordPress");
  if (/shopify|cdn\.shopify\.com/i.test(html)) tech.add("Shopify");
  if (/webflow|wf-/i.test(html)) tech.add("Webflow");
  if (/googletagmanager|gtag\(/i.test(html)) tech.add("Google Tag Manager / Analytics");
  if (/stripe\.com\/v3|js\.stripe\.com/i.test(html)) tech.add("Stripe.js");
  if (headers["server"]) tech.add(`Server: ${headers["server"].slice(0, 80)}`);
  if (headers["x-powered-by"]) tech.add(`X-Powered-By: ${headers["x-powered-by"].slice(0, 80)}`);
  return [...tech].slice(0, 20);
}

function auditHeaders(headers: Record<string, string>, html: string): Finding[] {
  const findings: Finding[] = [];
  const hsts = headers["strict-transport-security"] || "";
  const csp = headers["content-security-policy"] || "";
  const xfo = headers["x-frame-options"] || "";
  const xcto = headers["x-content-type-options"] || "";
  const referrer = headers["referrer-policy"] || "";
  const permissions = headers["permissions-policy"] || "";
  const acao = headers["access-control-allow-origin"] || "";
  const acac = headers["access-control-allow-credentials"] || "";

  if (!hsts) findings.push({ finding: "Missing Strict-Transport-Security", severity: "High", evidence: "strict-transport-security header not present", remediation: "Set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` after verifying HTTPS on all subdomains." });
  else if (!/max-age=\s*(31536000|63072000|[1-9]\d{7,})/i.test(hsts)) findings.push({ finding: "HSTS max-age is weak", severity: "Medium", evidence: hsts, remediation: "Raise max-age to at least 31536000 seconds; prefer 63072000 with includeSubDomains." });

  if (!csp) findings.push({ finding: "Missing Content-Security-Policy", severity: "High", evidence: "content-security-policy header not present", remediation: "Deploy an enforced CSP with `default-src 'self'`, explicit script/connect/img sources, and `frame-ancestors` controls." });
  else {
    if (/unsafe-inline/i.test(csp)) findings.push({ finding: "CSP allows unsafe-inline", severity: "Medium", evidence: csp.slice(0, 220), remediation: "Move inline scripts/styles to nonce/hash-based allowances and remove `unsafe-inline`." });
    if (/unsafe-eval/i.test(csp)) findings.push({ finding: "CSP allows unsafe-eval", severity: "High", evidence: csp.slice(0, 220), remediation: "Remove `unsafe-eval`; replace eval-like patterns and configure build tooling without runtime eval." });
    if (/\*|https?:\/\/\*/.test(csp)) findings.push({ finding: "CSP contains wildcard source", severity: "Medium", evidence: csp.slice(0, 220), remediation: "Replace wildcard sources with exact host allowlists." });
  }

  if (!xfo && !/frame-ancestors/i.test(csp)) findings.push({ finding: "Clickjacking protection missing", severity: "Medium", evidence: "No x-frame-options and no CSP frame-ancestors", remediation: "Set `Content-Security-Policy: frame-ancestors 'none'` or a strict allowlist; add `X-Frame-Options: DENY` for legacy browsers." });
  if (!/nosniff/i.test(xcto)) findings.push({ finding: "X-Content-Type-Options missing", severity: "Low", evidence: xcto || "header absent", remediation: "Set `X-Content-Type-Options: nosniff` on all responses." });
  if (!referrer) findings.push({ finding: "Referrer-Policy missing", severity: "Low", evidence: "referrer-policy header not present", remediation: "Set `Referrer-Policy: strict-origin-when-cross-origin` or stricter." });
  if (!permissions) findings.push({ finding: "Permissions-Policy missing", severity: "Low", evidence: "permissions-policy header not present", remediation: "Disable unused browser features such as camera, microphone, geolocation, payment, and USB by default." });
  if (acao === "*" && /true/i.test(acac)) findings.push({ finding: "CORS wildcard with credentials", severity: "Critical", evidence: "access-control-allow-origin:* + credentials:true", remediation: "Reflect only trusted origins and never combine wildcard ACAO with credentials." });
  else if (acao === "*") findings.push({ finding: "CORS allows any origin", severity: "Medium", evidence: "access-control-allow-origin:*", remediation: "Restrict CORS to exact trusted origins for API responses." });

  const mixed = [...html.matchAll(/(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi)].map((m) => m[1]).slice(0, 10);
  if (mixed.length) findings.push({ finding: "Mixed-content resources detected", severity: "Medium", evidence: mixed.join(" | ").slice(0, 260), remediation: "Serve all subresources over HTTPS and enable CSP `upgrade-insecure-requests`." });

  return findings;
}

async function probeExposed(origin: string): Promise<Finding[]> {
  const results = await Promise.all(EXPOSED_PATHS.map(async (path) => {
    try {
      const r = await fetchWithTimeout(`${origin}${path}`, { method: "GET", redirect: "manual" }, 4500);
      const ct = r.headers.get("content-type") || "";
      let body = "";
      if (r.status < 400 && /text|json|xml|javascript/i.test(ct)) body = (await r.text().catch(() => "")).slice(0, 500);
      else await r.body?.cancel().catch(() => null);
      if (r.status >= 400) return null;
      if (/<!doctype html/i.test(body) && !/\.well-known|robots|manifest/i.test(path)) return null;
      const sensitive = /\.env|\.git|backup|database\.sql|wp-config|credentials/i.test(path);
      return {
        finding: `Observable exposed path: ${path}`,
        severity: sensitive ? "Critical" as Severity : path === "/package.json" || path === "/config.json" ? "Medium" as Severity : "Info" as Severity,
        evidence: `HTTP ${r.status}; content-type=${ct || "unknown"}`,
        remediation: sensitive ? "Remove the file from web root, rotate any exposed secrets, and add edge deny rules." : "Confirm this file is intentionally public and contains no internal metadata.",
      };
    } catch {
      return null;
    }
  }));
  return results.filter(Boolean) as Finding[];
}

function score(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => {
    const p = f.severity === "Critical" ? 30 : f.severity === "High" ? 18 : f.severity === "Medium" ? 10 : f.severity === "Low" ? 4 : 1;
    return sum + p;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const target = normalizeUrl(url);
    assertPublicHost(target.hostname);
    const [aRecords, aaaaRecords, mxRecords, txtRecords] = await Promise.all([
      dnsQuery(target.hostname, "A"),
      dnsQuery(target.hostname, "AAAA"),
      dnsQuery(target.hostname, "MX"),
      dnsQuery(target.hostname, "TXT"),
    ]);
    if ([...aRecords, ...aaaaRecords].some(isPrivateIp)) throw new Error("Resolved private network targets are blocked");

    let status = 0;
    let finalUrl = target.toString();
    let headers: Record<string, string> = {};
    let html = "";
    let fetchError = "";

    try {
      const r = await fetchWithTimeout(target.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "Asherin-Link-Security-Audit/1.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }, 9000);
      status = r.status;
      finalUrl = r.url;
      headers = headersToObject(r.headers);
      const ct = headers["content-type"] || "";
      if (/html|text/i.test(ct)) html = (await r.text().catch(() => "")).slice(0, 1_500_000);
      else await r.body?.cancel().catch(() => null);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "fetch failed";
    }

    const exposedFindings = await probeExposed(target.origin);
    const headerFindings = auditHeaders(headers, html);
    const meta = parseMeta(html);
    const tech = detectTech(html, headers);
    const dmarc = await dnsQuery(`_dmarc.${target.hostname.split(".").slice(-2).join(".")}`, "TXT");
    const spf = txtRecords.find((r) => /^"?v=spf1/i.test(r)) || "";
    const emailFindings: Finding[] = [];
    if (mxRecords.length && !spf) emailFindings.push({ finding: "SPF record not observed", severity: "Medium", evidence: "No v=spf1 TXT on domain", remediation: "Publish SPF for all authorized senders; use `-all` after validation." });
    if (mxRecords.length && !dmarc.some((r) => /v=DMARC1/i.test(r))) emailFindings.push({ finding: "DMARC record not observed", severity: "High", evidence: "No _dmarc TXT record", remediation: "Publish DMARC, start with monitoring, then move to quarantine/reject." });

    const findings = [...headerFindings, ...emailFindings, ...exposedFindings].slice(0, 40);
    const securityScore = score(findings);

    const payload = redactProviderInternals({
      success: true,
      target: target.toString(),
      finalUrl,
      status,
      fetchError,
      score: { security: securityScore },
      dns: { A: aRecords, AAAA: aaaaRecords, MX: mxRecords, TXT: txtRecords.slice(0, 8), DMARC: dmarc },
      http: { status, finalUrl, headers },
      identity: meta,
      tech,
      findings,
      summary: `Live defensive audit completed for ${target.hostname}. ${findings.length} finding(s) were derived from DNS, HTTP headers, page markup, and exposed-path probes.`,
    });

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "audit failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});