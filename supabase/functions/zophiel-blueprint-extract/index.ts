import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidByok, callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

async function probeHttp(host: string): Promise<{ headers: Record<string, string>; status: number; finalUrl: string } | null> {
  const r = await fetchTimeout(`https://${host}`, { method: "GET", redirect: "follow" }, 10_000);
  if (!r) return null;
  const headers: Record<string, string> = {};
  r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  try { await r.body?.cancel(); } catch { /* ignore */ }
  return { headers, status: r.status, finalUrl: r.url };
}

interface ReconBundle {
  host: string;
  dns: { A: string[]; AAAA: string[]; MX: string[]; NS: string[]; TXT: string[]; CNAME: string[] };
  http: { status: number; finalUrl: string; headers: Record<string, string> } | null;
  geo: Record<string, unknown> | null;
  rdap: { registrar?: string; created?: string; expires?: string; nameservers?: string[] } | null;
  subdomains: string[];
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

    const useByok = isValidByok(byok);
    const GEMINI_API_KEY = useByok ? "" : (Deno.env.get("GEMINI_API_KEY_APP") || "");
    if (!useByok && !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY_APP missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Live recon — pull real, observable facts before AI synthesis
    let recon: ReconBundle | null = null;
    try {
      recon = await liveRecon(url, { withSubs: !isSubdomainMode });
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
      const aiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: activeSystemPrompt }] },
            contents: [
              { role: "user", parts: [{ text: userPrompt }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              maxOutputTokens: 16384,
            },
          }),
        },
      );
      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("[blueprint] AI error", aiResp.status, errText);
        return new Response(
          JSON.stringify({ error: `Gemini: ${aiResp.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    return new Response(
      JSON.stringify({ success: true, blueprint }),
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
