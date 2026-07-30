import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

type ReconFinding = {
  severity?: string;
  title?: string;
  file_path?: string;
  line_number?: number;
  category?: string;
  confidence?: number;
  cwe_id?: string;
  cvss_score?: number;
  description?: string;
  impact?: string;
  exploitation_steps?: string[];
  code_snippet?: string;
  suggested_fix?: string;
  dataflow_trace?: unknown[];
  compliance_controls?: string[];
  similar_cves?: string[];
  age_days_estimate?: number;
};

type InfrastructureComponent = {
  id: string;
  type: string;
  name: string;
  provider: string;
  details: string;
  exposed: boolean;
};

type InfrastructureConnection = {
  from: string;
  to: string;
  label: string;
  protocol: string;
  encrypted: boolean;
};

type DataFlow = {
  description: string;
  source: string;
  destination: string;
  data_type: string;
  risk_level: string;
};

type ReconAnalysis = {
  findings: ReconFinding[];
  risk_grade: string;
  summary: string;
  domain_info: {
    ip?: string;
    hosting?: string;
    cdn?: string;
    waf?: string;
    tech_stack?: string[];
    tls_grade?: string;
    email_security_grade?: string;
  };
  subdomains_found: string[];
  total_attack_surface_score: number;
  zero_trust_score: number;
  infrastructure_map: {
    github_repo: string | null;
    deployment_platform: string;
    ci_cd: string;
    components: InfrastructureComponent[];
    connections: InfrastructureConnection[];
    data_flows: DataFlow[];
  } | null;
};

type DnsAnswer = { data?: string };
type DnsResponse = { Answer?: DnsAnswer[] };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const uniq = <T>(items: T[]) => [...new Set(items.filter(Boolean))];

const normalizeDomain = (input: string) => {
  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const parsed = new URL(value);
  return {
    url: parsed.toString(),
    origin: parsed.origin,
    hostname: parsed.hostname,
  };
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDnsRecord(name: string, type: string): Promise<DnsResponse> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const resp = await fetchWithTimeout(url, {
    headers: {
      accept: "application/dns-json",
      "user-agent": "ZERLAL-Recon/1.0",
    },
  }, 12000);

  if (!resp.ok) return {};
  return await resp.json();
}

async function fetchOptionalText(url: string) {
  try {
    const resp = await fetchWithTimeout(url, { headers: { "user-agent": "ZERLAL-Recon/1.0" } }, 12000);
    return {
      ok: resp.ok,
      status: resp.status,
      text: await resp.text(),
      headers: resp.headers,
    };
  } catch {
    return { ok: false, status: 0, text: "", headers: new Headers() };
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function extractAttributeList(html: string, tag: string, attr: string) {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) values.push(match[1]);
  return uniq(values);
}

/**
 * Parse every <meta http-equiv="X" content="Y"> from the rendered HTML
 * and return a lowercase-keyed bag. Used so the scanner can tell the
 * difference between "policy completely absent" and "policy shipped via
 * meta tag" (which browsers honor partially, or not at all, depending
 * on the directive — see callers for the exact carve-outs).
 */
function extractMetaHttpEquiv(html: string): Record<string, string> {
  const bag: Record<string, string> = {};
  const regex = /<meta\b[^>]*http-equiv=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  const altRegex = /<meta\b[^>]*content=["']([^"']*)["'][^>]*http-equiv=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) bag[m[1].toLowerCase()] = m[2];
  while ((m = altRegex.exec(html))) {
    const key = m[2].toLowerCase();
    if (!bag[key]) bag[key] = m[1];
  }
  return bag;
}

function computeRiskGrade(counts: Record<string, number>) {
  if ((counts.critical || 0) > 0 || (counts.high || 0) >= 2) return "F";
  if ((counts.high || 0) > 0 || (counts.medium || 0) >= 3) return "D";
  if ((counts.medium || 0) > 0 || (counts.low || 0) >= 3) return "C";
  if ((counts.low || 0) > 0 || (counts.info || 0) >= 2) return "B";
  return "A";
}

function computeEmailGrade(hasSpf: boolean, dmarcPolicies: string[]) {
  const policySet = uniq(dmarcPolicies);
  if (hasSpf && policySet.length === 1 && policySet[0] === "reject") return "A";
  if (hasSpf && policySet.length === 1 && (policySet[0] === "quarantine" || policySet[0] === "reject")) return "B";
  if (hasSpf && policySet.length >= 1) return "C";
  if (policySet.length >= 1) return "D";
  return "F";
}

function computeTlsGrade(headers: Headers, tlsCipher: string | null) {
  const hasHsts = Boolean(headers.get("strict-transport-security"));
  if (hasHsts && tlsCipher?.includes("TLS_AES_256_GCM_SHA384")) return "A";
  if (hasHsts) return "B";
  return "C";
}

function buildInfrastructureMap(hostname: string, techStack: string[], signal: {
  hosting: string;
  cdn: string;
  waf: string;
  emailProvider: string;
  githubRepo: string | null;
}) {
  const components: InfrastructureComponent[] = [
    {
      id: "dns-core",
      type: "dns",
      name: hostname,
      provider: "Domain / DNS",
      details: `Primary DNS entry for ${hostname}`,
      exposed: true,
    },
    {
      id: "cdn-edge",
      type: "cdn",
      name: "Edge Network",
      provider: signal.cdn || signal.hosting || "Cloud Edge",
      details: "Public traffic is terminated and accelerated at the edge.",
      exposed: true,
    },
    {
      id: "waf-edge",
      type: "waf",
      name: "Traffic Shield",
      provider: signal.waf || signal.cdn || "Edge Protection",
      details: "Bot management / WAF controls inferred from the edge headers and cookies.",
      exposed: false,
    },
    {
      id: "web-app",
      type: "web-server",
      name: hostname,
      provider: techStack[0] || "Web Application",
      details: `Detected client stack: ${techStack.join(", ") || "Single-page application"}`,
      exposed: true,
    },
    {
      id: "app-runtime",
      type: "app-server",
      name: "Application Backend",
      provider: signal.hosting || "Managed backend",
      details: "Runtime and API layer inferred from the frontend bundle fingerprints.",
      exposed: false,
    },
    {
      id: "auth-service",
      type: "auth-service",
      name: "Authentication Service",
      provider: techStack.includes("Supabase") ? "Supabase Auth" : "Managed Auth",
      details: "Authentication provider inferred from the shipped frontend SDK.",
      exposed: false,
    },
  ];

  if (signal.emailProvider) {
    components.push({
      id: "email-security",
      type: "email",
      name: "Email Gateway",
      provider: signal.emailProvider,
      details: "Inbound or transactional email layer inferred from MX records.",
      exposed: true,
    });
  }

  if (signal.githubRepo) {
    components.push({
      id: "github-origin",
      type: "third-party",
      name: "GitHub Repository",
      provider: "GitHub",
      details: signal.githubRepo,
      exposed: true,
    });
  }

  const connections: InfrastructureConnection[] = [
    { from: "dns-core", to: "cdn-edge", label: "DNS routes traffic to the edge network", protocol: "DNS/HTTPS", encrypted: true },
    { from: "cdn-edge", to: "waf-edge", label: "Inbound traffic is filtered before application delivery", protocol: "HTTPS", encrypted: true },
    { from: "waf-edge", to: "web-app", label: "Clean traffic reaches the SPA surface", protocol: "HTTPS", encrypted: true },
    { from: "web-app", to: "app-runtime", label: "Frontend calls backend services", protocol: "HTTPS", encrypted: true },
    { from: "web-app", to: "auth-service", label: "Frontend authenticates against managed identity", protocol: "HTTPS", encrypted: true },
  ];

  if (signal.emailProvider) {
    connections.push({ from: "app-runtime", to: "email-security", label: "Application email flows traverse the mail gateway", protocol: "SMTP/TLS", encrypted: true });
  }

  if (signal.githubRepo) {
    connections.push({ from: "github-origin", to: "app-runtime", label: "Repository changes likely feed deployment automation", protocol: "Git/Webhook", encrypted: true });
  }

  const dataFlows: DataFlow[] = [
    { description: "User requests enter through DNS and edge delivery", source: "dns-core", destination: "cdn-edge", data_type: "web-traffic", risk_level: "medium" },
    { description: "Application traffic reaches the public SPA", source: "cdn-edge", destination: "web-app", data_type: "user-traffic", risk_level: "medium" },
    { description: "Frontend exchanges session and application data with backend services", source: "web-app", destination: "app-runtime", data_type: "user-data", risk_level: "high" },
    { description: "Authentication tokens are exchanged with the identity provider", source: "web-app", destination: "auth-service", data_type: "credentials", risk_level: "high" },
  ];

  return {
    github_repo: signal.githubRepo,
    deployment_platform: signal.hosting || "Cloudflare",
    ci_cd: signal.githubRepo ? "Git-linked deployment" : "unknown",
    components,
    connections,
    data_flows: dataFlows,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: ReturnType<typeof createClient> | null = null;
  let projectId: string | null = null;
  let scanId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const normalized = normalizeDomain(body.domain || "");
    const requestedProjectId = typeof body.project_id === "string" ? body.project_id : null;

    projectId = requestedProjectId;
    if (!projectId) {
      const { data: project, error } = await supabase
        .from("zerlal_projects")
        .insert({
          user_id: user.id,
          name: `Domain Recon: ${normalized.url}`,
          source_type: "domain-recon",
          repo_url: normalized.url,
          status: "scanning",
        })
        .select()
        .single();
      if (error) throw error;
      projectId = project.id;
    } else {
      const { error } = await supabase.from("zerlal_projects").update({ status: "scanning" }).eq("id", projectId);
      if (error) throw error;
    }

    const { data: scan, error: scanErr } = await supabase
      .from("zerlal_scans")
      .insert({
        user_id: user.id,
        project_id: projectId,
        scan_profile: "domain-recon",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (scanErr) throw scanErr;
    scanId = scan.id;

    const started = Date.now();

    const [pageResp, robotsResp, manifestResp, securityTxtResp, aRecord, txtRecord, dmarcRecord, mxRecord, ctResp] = await Promise.all([
      fetchWithTimeout(normalized.url, { headers: { "user-agent": "ZERLAL-Recon/1.0" } }, 15000),
      fetchOptionalText(`${normalized.origin}/robots.txt`),
      fetchOptionalText(`${normalized.origin}/manifest.json`),
      fetchOptionalText(`${normalized.origin}/.well-known/security.txt`),
      fetchDnsRecord(normalized.hostname, "A"),
      fetchDnsRecord(normalized.hostname, "TXT"),
      fetchDnsRecord(`_dmarc.${normalized.hostname}`, "TXT"),
      fetchDnsRecord(normalized.hostname, "MX"),
      fetchOptionalText(`https://crt.sh/?q=${encodeURIComponent(normalized.hostname)}&output=json`),
    ]);

    const html = await pageResp.text();
    const headers = pageResp.headers;
    const headerBag = Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    const metaBag = extractMetaHttpEquiv(html);
    const scriptSources = extractAttributeList(html, "script", "src");
    const linkSources = extractAttributeList(html, "link", "href");

    const firstBundle = scriptSources.find((src) => src.endsWith(".js") || src.includes(".js?"));
    const bundleUrl = firstBundle ? new URL(firstBundle, normalized.origin).toString() : null;
    const bundleText = bundleUrl ? (await fetchOptionalText(bundleUrl)).text.slice(0, 250000) : "";

    const manifest = manifestResp.ok ? (() => {
      try { return JSON.parse(manifestResp.text); } catch { return null; }
    })() : null;

    const ctEntries = ctResp.ok ? (() => {
      try { return JSON.parse(ctResp.text) as Array<{ name_value?: string; not_before?: string; entry_timestamp?: string }>; } catch { return []; }
    })() : [];

    const aRecords = uniq((aRecord.Answer || []).map((entry) => entry.data || ""));
    const txtRecords = uniq((txtRecord.Answer || []).map((entry) => entry.data?.replace(/^"|"$/g, "") || ""));
    const dmarcRecords = uniq((dmarcRecord.Answer || []).map((entry) => entry.data?.replace(/^"|"$/g, "") || ""));
    const mxRecords = uniq((mxRecord.Answer || []).map((entry) => entry.data || ""));
    const dmarcPolicies = uniq(dmarcRecords
      .map((record) => record.match(/\bp=([a-z]+)/i)?.[1]?.toLowerCase() || "")
      .filter(Boolean));
    const hasSpf = txtRecords.some((record) => /v=spf1/i.test(record));

    // No artificial cap on CT-discovered subdomains — operators asked for the full surface.
    const subdomains = uniq(ctEntries
      .flatMap((entry) => (entry.name_value || "").split("\n"))
      .map((name) => name.replace(/^\*\./, "").trim().toLowerCase())
      .filter((name) => name && name.endsWith(normalized.hostname) && name !== normalized.hostname));

    const ctDates = ctEntries
      .map((entry) => entry.not_before || entry.entry_timestamp || "")
      .map((value) => Date.parse(value))
      .filter((value) => Number.isFinite(value)) as number[];
    const siteAgeDays = ctDates.length > 0 ? Math.max(1, Math.round((Date.now() - Math.min(...ctDates)) / 86400000)) : 90;

    const techStack = uniq([
      /react/i.test(bundleText) ? "React" : "",
      /vite/i.test(html + bundleText) || /\/assets\/index-[\w-]+\.(js|css)/i.test(html) ? "Vite" : "",
      /supabase/i.test(bundleText) && /createClient/i.test(bundleText) ? "Supabase" : "",
      headerBag.server?.toLowerCase().includes("cloudflare") ? "Cloudflare" : "",
      manifest?.display ? "PWA" : "",
    ]);

    const githubRepoMatch = (html + "\n" + bundleText).match(/https?:\/\/github\.com\/(?!orgs\/|features\/|enterprise\/)[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i);
    const githubRepo = githubRepoMatch ? githubRepoMatch[0].replace(/[),.;\]]+$/, "") : null;

    const hosting = techStack.includes("Supabase") ? "Cloudflare edge + Supabase-backed app" : (headerBag.server || "Web hosting platform");
    const cdn = headerBag.server?.toLowerCase().includes("cloudflare") ? "Cloudflare" : "Unknown";
    const waf = headerBag["cf-ray"] || headerBag["set-cookie"]?.includes("__cf_bm") ? "Cloudflare Bot Management / WAF" : "Unknown";
    const emailProvider = mxRecords.find((record) => /amazonaws\.com/i.test(record)) ? "AWS SES" : (mxRecords[0] || "");

    const findings: ReconFinding[] = [];
    const pushFinding = (finding: ReconFinding) => findings.push(finding);

    // ── CSP ───────────────────────────────────────────────────────────────
    // Browsers honor CSP delivered via <meta http-equiv>, but per the CSP
    // spec the following directives are IGNORED inside a meta CSP:
    // frame-ancestors, report-uri/report-to, sandbox. So a meta CSP is
    // partial protection — we downgrade severity rather than ignoring it.
    const cspHeader = headerBag["content-security-policy"] || "";
    const cspMeta   = metaBag["content-security-policy"]   || "";
    const cspEffectiveHeader = cspHeader.length > 0;
    const cspEffectiveMeta   = !cspEffectiveHeader && cspMeta.length > 0;

    if (!cspEffectiveHeader && !cspEffectiveMeta) {
      pushFinding({
        severity: "medium",
        title: "Missing Content-Security-Policy on primary application response",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 96,
        cwe_id: "CWE-693",
        cvss_score: 6.4,
        description: "The primary HTML response does not ship a Content-Security-Policy header and no <meta http-equiv=\"Content-Security-Policy\"> tag is present in the rendered HTML, so the browser has no script, frame, or resource execution policy to contain injected markup or hostile third-party content.",
        impact: "Any successful XSS or script injection bug will have a much larger blast radius because the browser is not constrained by an explicit execution policy.",
        exploitation_steps: [
          "Find any reflected, stored, or DOM-based injection point in the application.",
          "Inject hostile JavaScript or hostile remote resources into the rendered page.",
          "Leverage the lack of CSP to execute code, exfiltrate tokens, or pivot across user sessions.",
        ],
        code_snippet: "content-security-policy: <missing in both HTTP headers and meta tags>",
        suggested_fix: "Add a strict Content-Security-Policy at the CDN/edge layer (Cloudflare Transform Rule, Worker, or hosting headers config) with default-src 'self', explicit script-src/style-src directives, and frame-ancestors 'none' or a narrowly scoped allowlist.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 SI-10", "PCI DSS 6.4.3"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    } else if (cspEffectiveMeta) {
      pushFinding({
        severity: "low",
        title: "Content-Security-Policy delivered via <meta> only — partial enforcement",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 94,
        cwe_id: "CWE-693",
        cvss_score: 3.4,
        description: "A CSP is present in the rendered HTML via <meta http-equiv=\"Content-Security-Policy\">, which browsers honor for script-src, style-src, default-src, connect-src, etc. However, the CSP specification explicitly ignores frame-ancestors, report-uri/report-to, and sandbox directives when delivered via meta tag. Promote the policy to an HTTP response header to enable full enforcement and reporting.",
        impact: "Script/style/resource execution policy is enforced, but clickjacking protection (frame-ancestors) and CSP violation reporting cannot be activated from the meta layer.",
        exploitation_steps: [
          "Attempt to embed the page in an iframe to verify framing controls.",
          "Confirm no CSP violation reports are being collected (no report-uri/report-to honored).",
        ],
        code_snippet: `content-security-policy (meta): ${cspMeta.slice(0, 300)}${cspMeta.length > 300 ? "…" : ""}`,
        suggested_fix: "Move the existing CSP from <meta> to an HTTP response header at the CDN/edge (Cloudflare Transform Rule or Worker). Keep the meta tag as a fallback. Once the header ships, frame-ancestors and report-uri become enforceable.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 SI-10", "PCI DSS 6.4.3"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── Clickjacking ──────────────────────────────────────────────────────
    // X-Frame-Options is HTTP-only — browsers IGNORE it in meta tags.
    // frame-ancestors is IGNORED when CSP is delivered via meta.
    // So only an HTTP header (XFO or CSP with frame-ancestors) counts.
    const xfoHeader = headerBag["x-frame-options"] || "";
    const cspHeaderHasFrameAncestors = /frame-ancestors\s+/i.test(cspHeader);
    const xfoMetaPresent = Boolean(metaBag["x-frame-options"]);
    const cspMetaHasFrameAncestors = /frame-ancestors\s+/i.test(cspMeta);
    const clickjackingProtected = Boolean(xfoHeader) || cspHeaderHasFrameAncestors;

    if (!clickjackingProtected) {
      const ineffectiveSignals: string[] = [];
      if (xfoMetaPresent) ineffectiveSignals.push("<meta http-equiv=\"X-Frame-Options\"> is ignored by browsers (header-only directive)");
      if (cspMetaHasFrameAncestors) ineffectiveSignals.push("frame-ancestors inside a meta CSP is ignored per CSP spec");

      pushFinding({
        severity: "medium",
        title: "Clickjacking protection not enforceable from current response",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 92,
        cwe_id: "CWE-1021",
        cvss_score: 5.8,
        description: `The response lacks an X-Frame-Options HTTP header and the CSP HTTP header does not contain a frame-ancestors directive, so framing policy is unenforced.${ineffectiveSignals.length ? " Detected but ineffective: " + ineffectiveSignals.join("; ") + "." : ""}`,
        impact: "Attackers can attempt UI redressing or clickjacking flows against authenticated users if sensitive actions are reachable in-frame.",
        exploitation_steps: [
          "Host the target page inside an attacker-controlled iframe.",
          "Overlay decoy controls that trick the victim into clicking the framed application.",
          "Abuse authenticated clicks to trigger state-changing actions.",
        ],
        code_snippet: `x-frame-options (header): ${xfoHeader || "<missing>"}\nframe-ancestors (header CSP): ${cspHeaderHasFrameAncestors ? "present" : "<missing>"}\nmeta signals: ${ineffectiveSignals.join(", ") || "<none>"}`,
        suggested_fix: "Set X-Frame-Options: DENY at the CDN/edge (Cloudflare Transform Rule or Worker) or — preferred — move the CSP to an HTTP header and include frame-ancestors 'none'. Meta-tag delivery does not satisfy this control.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 SC-18"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── Permissions-Policy ────────────────────────────────────────────────
    // Permissions-Policy is HTTP-only. Browsers ignore <meta http-equiv>
    // for this header. Detect meta to give the user a precise fix path.
    const ppHeader = headerBag["permissions-policy"] || "";
    const ppMeta   = metaBag["permissions-policy"]   || "";

    if (!ppHeader) {
      pushFinding({
        severity: ppMeta ? "low" : "low",
        title: ppMeta
          ? "Permissions-Policy shipped via <meta> only — not enforced by browsers"
          : "Permissions-Policy header is absent",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 95,
        cwe_id: "CWE-693",
        cvss_score: 3.7,
        description: ppMeta
          ? "A Permissions-Policy is present in the HTML via <meta http-equiv=\"Permissions-Policy\">, but browsers only honor this header when delivered as an HTTP response header. The meta variant is silently ignored."
          : "The application does not define a Permissions-Policy, so browser capabilities are governed only by defaults.",
        impact: "If future code paths or third-party widgets request powerful browser features, they may inherit broader access than intended.",
        exploitation_steps: [
          "Introduce or compromise a client-side component that requests browser capabilities.",
          "Rely on browser defaults because no enforceable feature deny-list is present.",
          "Abuse granted capabilities for tracking, social engineering, or data capture.",
        ],
        code_snippet: ppMeta
          ? `permissions-policy (meta, IGNORED by browsers): ${ppMeta}`
          : "permissions-policy: <missing>",
        suggested_fix: "Promote the Permissions-Policy to an HTTP response header at the CDN/edge layer (Cloudflare Transform Rule or Worker). Use a restrictive value disabling unused capabilities such as camera, microphone, geolocation, and payment.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 CM-7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }


    if (!securityTxtResp.ok) {
      pushFinding({
        severity: "low",
        title: "No security.txt disclosure channel detected",
        file_path: "Compliance / Security Contact",
        line_number: 0,
        category: "config",
        confidence: 90,
        cwe_id: "CWE-200",
        cvss_score: 3.1,
        description: "The standard /.well-known/security.txt file is not present, so there is no machine-readable disclosure path for researchers.",
        impact: "Vulnerability reporters have less guidance on how to report issues responsibly, increasing the chance of missed reports or delayed triage.",
        exploitation_steps: [
          "A researcher identifies a vulnerability in the domain.",
          "No disclosure policy or security contact is discoverable at the expected location.",
          "The report is delayed, misrouted, or never submitted.",
        ],
        code_snippet: `${normalized.origin}/.well-known/security.txt -> ${securityTxtResp.status || "unreachable"}`,
        suggested_fix: "Publish a security.txt file with contact, disclosure, and policy metadata.",
        dataflow_trace: [],
        compliance_controls: ["ISO 29147", "SOC 2 CC7.1"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    if (!hasSpf) {
      pushFinding({
        severity: "medium",
        title: "SPF record not detected on apex domain",
        file_path: "Email Security",
        line_number: 0,
        category: "config",
        confidence: 88,
        cwe_id: "CWE-346",
        cvss_score: 5.3,
        description: "TXT lookups for the apex domain did not return an SPF policy, leaving sender validation incomplete.",
        impact: "Spoofed mail claiming to originate from the domain is easier to deliver because receiver-side SPF checks have no policy to validate against.",
        exploitation_steps: [
          "Forge a message using an @domain sender address.",
          "Target recipients or internal staff with phishing or reset workflows.",
          "Exploit the lack of SPF policy enforcement to improve delivery success.",
        ],
        code_snippet: txtRecords.join("\n") || "TXT: <no SPF record detected>",
        suggested_fix: "Publish an SPF record covering every legitimate outbound mail sender and keep it aligned with DMARC policy.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-177", "SOC 2 CC6.7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    if (dmarcPolicies.length > 1) {
      pushFinding({
        severity: "medium",
        title: "Conflicting DMARC policies published",
        file_path: "Email Security",
        line_number: 0,
        category: "config",
        confidence: 95,
        cwe_id: "CWE-16",
        cvss_score: 5.6,
        description: "The domain publishes multiple DMARC TXT records with different enforcement values, creating ambiguous policy resolution for receivers.",
        impact: "Mail receivers may ignore or inconsistently interpret DMARC enforcement, weakening anti-spoofing protections.",
        exploitation_steps: [
          "Review the published _dmarc TXT answers and note the conflicting policy values.",
          "Send spoofed mail and rely on inconsistent receiver behavior when DMARC parsing is ambiguous.",
          "Use the weaker interpretation to improve phishing deliverability.",
        ],
        code_snippet: dmarcRecords.join("\n"),
        suggested_fix: "Collapse DMARC into a single authoritative TXT record with one explicit policy and aligned SPF/DKIM posture.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-177", "PCI DSS 4.0 5.4.1"],
        similar_cves: [],
        age_days_estimate: Math.max(30, Math.round(siteAgeDays / 2)),
      });
    }

    if (subdomains.length > 0) {
      pushFinding({
        severity: "low",
        title: `Additional public subdomains exposed in certificate transparency logs (${subdomains.length})`,
        file_path: "Subdomain Intelligence",
        line_number: 0,
        category: "infrastructure",
        confidence: 93,
        cwe_id: "CWE-200",
        cvss_score: 3.9,
        description: `Certificate transparency entries expose ${subdomains.length} additional hostnames associated with the domain, expanding the externally visible attack surface. Every CT-disclosed hostname is enumerated below as an individual finding so nothing is truncated.`,
        impact: "Attackers can pivot into forgotten or softer targets such as billing, staging, or legacy subdomains discovered from passive CT intelligence.",
        exploitation_steps: [
          "Enumerate certificate transparency entries for the domain.",
          `Extract the published hostnames such as ${subdomains.slice(0, 3).join(", ") || "discovered subdomains"}.`,
          "Probe each hostname for weaker controls, outdated deployments, or takeover conditions.",
        ],
        code_snippet: subdomains.join("\n"),
        suggested_fix: "Continuously inventory CT-disclosed hostnames and retire, redirect, or harden anything that should not remain public.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 CA-3", "SOC 2 CC7.1"],
        similar_cves: [],
        age_days_estimate: Math.max(7, Math.round(siteAgeDays / 2)),
      });

      // Emit one finding per subdomain so the operator sees every host
      // individually — no aggregation cap, no slice.
      for (const sub of subdomains) {
        pushFinding({
          severity: "info",
          title: `CT-disclosed subdomain in scope: ${sub}`,
          file_path: `Subdomain Intelligence / ${sub}`,
          line_number: 0,
          category: "infrastructure",
          confidence: 92,
          cwe_id: "CWE-200",
          cvss_score: 2.0,
          description: `Hostname ${sub} appears in public certificate transparency logs under ${normalized.hostname}. Treat it as in-scope until proven otherwise.`,
          impact: "Forgotten, staging, or vendor subdomains often run with weaker controls than the apex and become the easiest pivot point.",
          exploitation_steps: [
            `Resolve ${sub} and check whether it is live, parked, or dangling.`,
            "Probe for default credentials, outdated software, or subdomain takeover conditions.",
            "Map any authenticated routes or admin interfaces exposed at this host.",
          ],
          code_snippet: sub,
          suggested_fix: `Decide whether ${sub} should remain public; if not, retire the DNS record and revoke its certificate. If it must stay, apply the same hardening baseline as the apex.`,
          dataflow_trace: [],
          compliance_controls: ["NIST 800-53 CA-3"],
          similar_cves: [],
          age_days_estimate: Math.max(7, Math.round(siteAgeDays / 2)),
        });
      }
    }

    // ── HSTS ──────────────────────────────────────────────────────────────
    const hstsHeader = headerBag["strict-transport-security"] || "";
    if (!hstsHeader) {
      pushFinding({
        severity: "medium",
        title: "Strict-Transport-Security header is missing",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 95,
        cwe_id: "CWE-319",
        cvss_score: 5.4,
        description: "The response does not advertise HSTS, so browsers will not automatically upgrade subsequent visits from HTTP to HTTPS or refuse to honor invalid certificates.",
        impact: "Attackers on a hostile network can downgrade the first visit to HTTP and intercept credentials or session tokens.",
        exploitation_steps: [
          "Stand between the victim and the origin on an untrusted network.",
          "Strip the first HTTPS redirect and serve a cloned HTTP version of the site.",
          "Capture submitted credentials or session cookies in cleartext.",
        ],
        code_snippet: "strict-transport-security: <missing>",
        suggested_fix: "Ship `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` at the edge and submit the domain to the HSTS preload list once stable.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-52", "PCI DSS 4.0 4.2.1"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    } else if (!/max-age=\s*[1-9]\d{6,}/i.test(hstsHeader)) {
      pushFinding({
        severity: "low",
        title: "Strict-Transport-Security max-age is too short",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 90,
        cwe_id: "CWE-319",
        cvss_score: 3.1,
        description: "HSTS is published but with a max-age below the commonly recommended one-year minimum, weakening protection against downgrade attacks.",
        impact: "Browsers forget the HTTPS-only directive quickly, widening the window where a downgrade attack can succeed.",
        exploitation_steps: [
          "Wait for the short max-age window to lapse on the victim's browser.",
          "Execute an SSL strip attack on the next session.",
        ],
        code_snippet: `strict-transport-security: ${hstsHeader}`,
        suggested_fix: "Set `max-age=63072000; includeSubDomains; preload` and pursue HSTS preload submission.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-52"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── X-Content-Type-Options ────────────────────────────────────────────
    const xctoHeader = headerBag["x-content-type-options"] || "";
    if (!/nosniff/i.test(xctoHeader)) {
      pushFinding({
        severity: "low",
        title: "X-Content-Type-Options: nosniff is missing",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 94,
        cwe_id: "CWE-430",
        cvss_score: 3.4,
        description: "Without `X-Content-Type-Options: nosniff`, browsers may MIME-sniff responses and execute attacker-supplied content with the wrong Content-Type.",
        impact: "Increases the blast radius of any uploaded or reflected content by allowing browsers to reinterpret it as HTML/JS.",
        exploitation_steps: [
          "Upload or reflect a payload served with a benign Content-Type.",
          "Let the browser sniff and execute it as HTML or JavaScript.",
        ],
        code_snippet: `x-content-type-options: ${xctoHeader || "<missing>"}`,
        suggested_fix: "Send `X-Content-Type-Options: nosniff` on every response at the edge.",
        dataflow_trace: [],
        compliance_controls: ["OWASP ASVS 14.4.4"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── Referrer-Policy ───────────────────────────────────────────────────
    const refPolHeader = headerBag["referrer-policy"] || "";
    if (!refPolHeader) {
      pushFinding({
        severity: "low",
        title: "Referrer-Policy header is missing",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 90,
        cwe_id: "CWE-200",
        cvss_score: 2.7,
        description: "No Referrer-Policy is set, so browsers fall back to `strict-origin-when-cross-origin` only on HTTPS and may leak full URLs (including tokens) to third parties on HTTP downgrades.",
        impact: "Authenticated URLs and query-string tokens can leak to embedded third-party assets or external links.",
        exploitation_steps: [
          "Host an external resource (image, script, link) reachable from the app.",
          "Receive the victim's full referring URL — including any tokens — in your access logs.",
        ],
        code_snippet: "referrer-policy: <missing>",
        suggested_fix: "Send `Referrer-Policy: strict-origin-when-cross-origin` or stricter on every response.",
        dataflow_trace: [],
        compliance_controls: ["OWASP ASVS 14.4.6"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── Cross-Origin Isolation (COOP / COEP / CORP) ────────────────────────
    const coopHeader = headerBag["cross-origin-opener-policy"] || "";
    const coepHeader = headerBag["cross-origin-embedder-policy"] || "";
    const corpHeader = headerBag["cross-origin-resource-policy"] || "";
    if (!coopHeader) {
      pushFinding({
        severity: "low",
        title: "Cross-Origin-Opener-Policy is not set",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 88,
        cwe_id: "CWE-1021",
        cvss_score: 2.6,
        description: "COOP is absent, so popups and cross-origin openers share a browsing context group with this page, enabling cross-window scripting in some attack chains (e.g. XS-Leaks).",
        impact: "Attackers can leverage shared browsing contexts to read window references and execute side-channel leaks.",
        exploitation_steps: [
          "Open the target in a popup from an attacker-controlled origin.",
          "Use the resulting window reference to probe state or leak cross-origin data.",
        ],
        code_snippet: "cross-origin-opener-policy: <missing>",
        suggested_fix: "Send `Cross-Origin-Opener-Policy: same-origin` on document responses.",
        dataflow_trace: [],
        compliance_controls: ["OWASP ASVS 14.4.7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }
    if (!coepHeader) {
      pushFinding({
        severity: "info",
        title: "Cross-Origin-Embedder-Policy is not set",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 86,
        cwe_id: "CWE-693",
        cvss_score: 1.9,
        description: "COEP is absent, so the document is not cross-origin isolated and cannot safely use APIs like SharedArrayBuffer or high-resolution timers.",
        impact: "No direct compromise, but the app cannot opt into hardened isolation primitives that protect against Spectre-class side channels.",
        exploitation_steps: [
          "Mount a timing-based side-channel that requires high-resolution timers.",
          "Rely on the absence of cross-origin isolation to keep those APIs available in a downgraded form.",
        ],
        code_snippet: "cross-origin-embedder-policy: <missing>",
        suggested_fix: "Ship `Cross-Origin-Embedder-Policy: require-corp` once every embedded asset declares CORP/CORS.",
        dataflow_trace: [],
        compliance_controls: ["OWASP ASVS 14.4.7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }
    if (!corpHeader) {
      pushFinding({
        severity: "info",
        title: "Cross-Origin-Resource-Policy is not set",
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 86,
        cwe_id: "CWE-200",
        cvss_score: 1.9,
        description: "CORP is absent, so cross-origin documents can embed this resource without restriction.",
        impact: "Sensitive responses may be embedded as images, scripts, or fetched from hostile origins for side-channel measurement.",
        exploitation_steps: [
          "Embed the resource from an attacker-controlled origin.",
          "Measure load timing or response shape to infer authenticated state.",
        ],
        code_snippet: "cross-origin-resource-policy: <missing>",
        suggested_fix: "Send `Cross-Origin-Resource-Policy: same-origin` (or `same-site`) on sensitive responses.",
        dataflow_trace: [],
        compliance_controls: ["OWASP ASVS 14.4.7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    // ── Server / X-Powered-By fingerprint leakage ─────────────────────────
    const serverBanner = headerBag["server"] || "";
    const poweredBy    = headerBag["x-powered-by"] || "";
    if (serverBanner && !/cloudflare|vercel|netlify/i.test(serverBanner)) {
      pushFinding({
        severity: "info",
        title: `Server banner discloses backend identity: ${serverBanner}`,
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 90,
        cwe_id: "CWE-200",
        cvss_score: 2.1,
        description: "The Server response header advertises the backend product and version, which accelerates attacker fingerprinting.",
        impact: "Reduces attacker reconnaissance cost and steers exploits toward known CVEs for the disclosed version.",
        exploitation_steps: [
          "Read the Server header from any response.",
          "Look up known CVEs for the named product and version.",
        ],
        code_snippet: `server: ${serverBanner}`,
        suggested_fix: "Strip or generalize the Server header at the edge.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 CM-7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }
    if (poweredBy) {
      pushFinding({
        severity: "info",
        title: `X-Powered-By discloses runtime: ${poweredBy}`,
        file_path: "HTTP Security Headers",
        line_number: 0,
        category: "config",
        confidence: 90,
        cwe_id: "CWE-200",
        cvss_score: 2.1,
        description: "The X-Powered-By header reveals the framework or runtime stack.",
        impact: "Helps attackers target framework-specific exploits and deserialization gadgets.",
        exploitation_steps: [
          "Read X-Powered-By from any response.",
          "Pull known CVEs and gadget chains for the named runtime.",
        ],
        code_snippet: `x-powered-by: ${poweredBy}`,
        suggested_fix: "Disable X-Powered-By in the framework or strip it at the edge.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 CM-7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    if (/supabase/i.test(bundleText) && /createClient/i.test(bundleText)) {
      pushFinding({
        severity: "info",
        title: "Frontend bundle reveals managed backend SDK usage",
        file_path: "Client Bundle",
        line_number: 0,
        category: "infrastructure",
        confidence: 98,
        cwe_id: "CWE-200",
        cvss_score: 1.8,
        description: "The shipped JavaScript bundle exposes clear backend SDK fingerprints, which helps adversaries profile the authentication and data plane used by the application.",
        impact: "This is primarily reconnaissance value: it shortens attacker profiling time and highlights which backend surfaces to probe first.",
        exploitation_steps: [
          "Download the public JavaScript bundle from the application.",
          "Search for provider-specific SDK strings and client initialization patterns.",
          "Use the identified stack to focus follow-on testing and configuration review.",
        ],
        code_snippet: "Bundle fingerprint: supabase + createClient detected in public asset",
        suggested_fix: "Treat this as expected public metadata, but pair it with tight backend policy enforcement and avoid leaking unnecessary environment details in client bundles.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 SA-15"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    if (manifest?.start_url && manifest.start_url !== "/") {
      pushFinding({
        severity: "info",
        title: "PWA manifest exposes authenticated application entrypoint",
        file_path: "PWA Manifest",
        line_number: 0,
        category: "infrastructure",
        confidence: 90,
        cwe_id: "CWE-200",
        cvss_score: 1.6,
        description: "The public manifest advertises a non-root application start_url, which provides passive intelligence about the product surface and expected authenticated route structure.",
        impact: "This does not create direct compromise, but it gives attackers additional mapping context for automation and social engineering.",
        exploitation_steps: [
          "Fetch the public manifest.json file.",
          "Read the declared start_url and application metadata.",
          "Use the route structure to guide enumeration and phishing pretext design.",
        ],
        code_snippet: `start_url: ${manifest.start_url}`,
        suggested_fix: "Only expose route metadata that is operationally necessary in the public manifest.",
        dataflow_trace: [],
        compliance_controls: ["NIST 800-53 CM-7"],
        similar_cves: [],
        age_days_estimate: siteAgeDays,
      });
    }

    const severityCounts = findings.reduce<Record<string, number>>((acc, finding) => {
      const key = finding.severity || "info";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });

    const riskGrade = computeRiskGrade(severityCounts);
    const attackSurfaceScore = clamp(
      20 +
      severityCounts.critical * 20 +
      severityCounts.high * 15 +
      severityCounts.medium * 10 +
      severityCounts.low * 5 +
      severityCounts.info * 2 +
      Math.min(subdomains.length * 2, 10),
      0,
      100,
    );
    const zeroTrustScore = clamp(100 - (severityCounts.critical * 22 + severityCounts.high * 16 + severityCounts.medium * 10 + severityCounts.low * 5), 0, 100);

    const analysis: ReconAnalysis = {
      findings,
      risk_grade: riskGrade,
      summary: [
        `Reconnaissance completed against ${normalized.hostname} with ${findings.length} findings derived from live HTTP, DNS, TLS, manifest, certificate-transparency, and client-bundle signals.`,
        `The application appears to sit behind ${cdn || "an edge provider"} and presents as a ${techStack.join("/") || "web application"}${techStack.includes("Supabase") ? " using a Supabase-backed service plane" : ""}.`,
        `The strongest issues are the missing browser execution policy controls (CSP / anti-clickjacking) and the weakened email-authentication posture caused by ${!hasSpf ? "missing SPF" : ""}${!hasSpf && dmarcPolicies.length > 1 ? " plus " : ""}${dmarcPolicies.length > 1 ? "conflicting DMARC records" : ""}.`,
      ].join(" "),
      domain_info: {
        ip: aRecords[0] || undefined,
        hosting,
        cdn,
        waf,
        tech_stack: techStack,
        tls_grade: computeTlsGrade(headers, null),
        email_security_grade: computeEmailGrade(hasSpf, dmarcPolicies),
      },
      subdomains_found: subdomains,
      total_attack_surface_score: attackSurfaceScore,
      zero_trust_score: zeroTrustScore,
      infrastructure_map: buildInfrastructureMap(normalized.hostname, techStack, {
        hosting,
        cdn,
        waf,
        emailProvider,
        githubRepo,
      }),
    };

    const firstSeenBase = new Date().toISOString();
    await supabase.from("zerlal_findings").delete().eq("project_id", projectId);

    if (findings.length > 0) {
      const rows = findings.map((finding) => {
        const ageDays = Math.max(0, Math.round(finding.age_days_estimate || 0));
        const firstSeenAt = new Date(Date.now() - ageDays * 86400000).toISOString();
        return {
          user_id: user.id,
          project_id: projectId,
          scan_id: scanId,
          severity: finding.severity || "info",
          title: finding.title || "Unnamed finding",
          file_path: finding.file_path || `Domain: ${normalized.hostname}`,
          line_number: finding.line_number || 0,
          category: finding.category || "config",
          confidence: clamp(finding.confidence || 75, 0, 100),
          age_days: ageDays,
          first_seen_at: firstSeenAt || firstSeenBase,
          status: "open",
          cwe_id: finding.cwe_id || "",
          cvss_score: clamp(finding.cvss_score || 0, 0, 10),
          description: finding.description || "",
          impact: finding.impact || "",
          exploitation_steps: finding.exploitation_steps || [],
          code_snippet: finding.code_snippet || "",
          suggested_fix: finding.suggested_fix || "",
          dataflow_trace: finding.dataflow_trace || [],
          compliance_controls: finding.compliance_controls || [],
          similar_cves: finding.similar_cves || [],
        };
      });

      const { error: insertErr } = await supabase.from("zerlal_findings").insert(rows);
      if (insertErr) throw insertErr;
    }

    const duration = Math.max(1, Math.floor((Date.now() - started) / 1000));

    const { error: scanUpdateErr } = await supabase
      .from("zerlal_scans")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        duration,
        findings_count: findings.length,
        critical_count: severityCounts.critical,
        high_count: severityCounts.high,
        medium_count: severityCounts.medium,
        low_count: severityCounts.low,
        info_count: severityCounts.info,
        error: null,
      })
      .eq("id", scanId);
    if (scanUpdateErr) throw scanUpdateErr;

    const { error: projectUpdateErr } = await supabase
      .from("zerlal_projects")
      .update({
        risk_grade: analysis.risk_grade,
        last_scan_at: new Date().toISOString(),
        scan_duration: duration,
        critical_count: severityCounts.critical,
        high_count: severityCounts.high,
        medium_count: severityCounts.medium,
        low_count: severityCounts.low,
        info_count: severityCounts.info,
        status: "complete",
      })
      .eq("id", projectId);
    if (projectUpdateErr) throw projectUpdateErr;

    return new Response(JSON.stringify({
      project_id: projectId,
      scan_id: scanId,
      findings_count: findings.length,
      risk_grade: analysis.risk_grade,
      summary: analysis.summary,
      domain_info: analysis.domain_info,
      subdomains_found: analysis.subdomains_found,
      total_attack_surface_score: analysis.total_attack_surface_score,
      zero_trust_score: analysis.zero_trust_score,
      infrastructure_map: analysis.infrastructure_map,
      duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (supabase && scanId) {
      await supabase.from("zerlal_scans").update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      }).eq("id", scanId);
    }

    if (supabase && projectId) {
      await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", projectId);
    }

    console.error("[ZERLAL-DOMAIN-RECON] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
