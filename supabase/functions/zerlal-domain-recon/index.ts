import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

type ReconAnalysis = {
  findings?: ReconFinding[];
  risk_grade?: string;
  summary?: string;
  domain_info?: {
    ip?: string;
    hosting?: string;
    cdn?: string;
    waf?: string;
    tech_stack?: string[];
    tls_grade?: string;
    email_security_grade?: string;
  };
  subdomains_found?: string[];
  total_attack_surface_score?: number;
  zero_trust_score?: number;
  infrastructure_map?: {
    github_repo?: string | null;
    deployment_platform?: string;
    ci_cd?: string;
    components?: Array<{
      id: string;
      type: string;
      name: string;
      provider: string;
      details: string;
      exposed: boolean;
    }>;
    connections?: Array<{
      from: string;
      to: string;
      label: string;
      protocol: string;
      encrypted: boolean;
    }>;
    data_flows?: Array<{
      description: string;
      source: string;
      destination: string;
      data_type: string;
      risk_level: string;
    }>;
  } | null;
};

const hasInfrastructureMap = (map: ReconAnalysis["infrastructure_map"]) => {
  if (!map) return false;

  return Boolean(
    map.github_repo ||
    (map.deployment_platform && map.deployment_platform !== "unknown") ||
    (map.ci_cd && map.ci_cd !== "unknown") ||
    (Array.isArray(map.components) && map.components.length > 0) ||
    (Array.isArray(map.connections) && map.connections.length > 0) ||
    (Array.isArray(map.data_flows) && map.data_flows.length > 0)
  );
};

const parseJsonObject = (text: string) => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || text;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("No JSON in response");
  }

  return JSON.parse(jsonMatch[0]);
};

type RouteError = Error & { status?: number };
type AIProvider = "lovable" | "gemini";

const createRouteError = (message: string, status = 500): RouteError => {
  const error = new Error(message) as RouteError;
  error.status = status;
  return error;
};

const getErrorStatus = (error: unknown) => (
  typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500
);

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";

const parseGatewayError = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.details === "string" && parsed.details) return `${parsed.message || "Request failed"}: ${parsed.details}`;
  } catch {
    // Ignore JSON parse issues and return raw text below.
  }

  return raw;
};

const extractGithubRepo = (analysis: ReconAnalysis, findings: ReconFinding[]) => {
  const haystack = [
    JSON.stringify(analysis.domain_info || {}),
    analysis.summary || "",
    ...(findings || []).flatMap((finding) => [
      finding.title || "",
      finding.description || "",
      finding.impact || "",
      finding.code_snippet || "",
      finding.suggested_fix || "",
      finding.file_path || "",
      ...(finding.exploitation_steps || []),
    ]),
  ].join("\n");

  const match = haystack.match(/https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i);
  return match ? match[0].replace(/[),.;\]]+$/, "") : null;
};

const detectPlatform = (analysis: ReconAnalysis, findings: ReconFinding[]) => {
  const haystack = [
    analysis.domain_info?.hosting,
    analysis.domain_info?.cdn,
    analysis.domain_info?.waf,
    ...(analysis.domain_info?.tech_stack || []),
    ...findings.flatMap((finding) => [finding.title, finding.description, finding.code_snippet, finding.suggested_fix]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("vercel")) return { deployment: "Vercel", ciCd: "Git-based deployment" };
  if (haystack.includes("netlify")) return { deployment: "Netlify", ciCd: "Git-based deployment" };
  if (haystack.includes("cloudflare")) return { deployment: "Cloudflare", ciCd: "Cloudflare deployment pipeline" };
  if (haystack.includes("aws") || haystack.includes("amazon")) return { deployment: "AWS", ciCd: "Cloud CI/CD or Git pipeline" };
  if (haystack.includes("azure")) return { deployment: "Azure", ciCd: "Azure DevOps or Git pipeline" };
  if (haystack.includes("gcp") || haystack.includes("google cloud")) return { deployment: "Google Cloud", ciCd: "Cloud Build or Git pipeline" };

  return { deployment: analysis.domain_info?.hosting || "unknown", ciCd: "unknown" };
};

const inferRiskGrade = (counts: { critical: number; high: number; medium: number; low: number; info: number }) => {
  if (counts.critical > 0 || counts.high >= 3) return "F";
  if (counts.high > 0 || counts.medium >= 5) return "D";
  if (counts.medium > 0 || counts.low >= 5) return "C";
  if (counts.low > 0 || counts.info >= 5) return "B";
  return "A";
};

const buildFallbackInfrastructureMap = (domain: string, analysis: ReconAnalysis, findings: ReconFinding[]) => {
  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const techStack = analysis.domain_info?.tech_stack || [];
  const githubRepo = extractGithubRepo(analysis, findings);
  const { deployment, ciCd } = detectPlatform(analysis, findings);

  const components: NonNullable<ReconAnalysis["infrastructure_map"]>["components"] = [];
  const connections: NonNullable<ReconAnalysis["infrastructure_map"]>["connections"] = [];
  const dataFlows: NonNullable<ReconAnalysis["infrastructure_map"]>["data_flows"] = [];

  const addComponent = (component: NonNullable<ReconAnalysis["infrastructure_map"]>["components"][number]) => {
    if (!components.some((existing) => existing.id === component.id)) {
      components.push(component);
    }
  };

  addComponent({
    id: "dns-core",
    type: "dns",
    name: cleanDomain,
    provider: "Domain / DNS",
    details: `Primary domain entry point for ${cleanDomain}`,
    exposed: true,
  });

  if (analysis.domain_info?.cdn) {
    addComponent({
      id: "cdn-edge",
      type: "cdn",
      name: "Edge CDN",
      provider: analysis.domain_info.cdn,
      details: `Traffic acceleration and caching handled by ${analysis.domain_info.cdn}`,
      exposed: true,
    });
  }

  if (analysis.domain_info?.waf) {
    addComponent({
      id: "waf-edge",
      type: "waf",
      name: "Web Application Firewall",
      provider: analysis.domain_info.waf,
      details: `Inbound traffic inspected by ${analysis.domain_info.waf}`,
      exposed: false,
    });
  }

  addComponent({
    id: "web-app",
    type: "web-server",
    name: cleanDomain,
    provider: techStack[0] || analysis.domain_info?.hosting || "Web Application",
    details: techStack.length > 0 ? `Detected stack: ${techStack.join(", ")}` : "Public-facing web surface inferred from reconnaissance findings",
    exposed: true,
  });

  addComponent({
    id: "app-runtime",
    type: "app-server",
    name: "Application Runtime",
    provider: deployment !== "unknown" ? deployment : analysis.domain_info?.hosting || "Hosting Platform",
    details: `Runtime and hosting layer inferred from ${deployment !== "unknown" ? deployment : analysis.domain_info?.hosting || "available evidence"}`,
    exposed: false,
  });

  if (analysis.domain_info?.email_security_grade) {
    addComponent({
      id: "email-security",
      type: "email",
      name: "Email Security",
      provider: `Grade ${analysis.domain_info.email_security_grade}`,
      details: "Mail authentication posture inferred from SPF / DKIM / DMARC signals",
      exposed: true,
    });
  }

  if (ciCd !== "unknown" || githubRepo) {
    addComponent({
      id: "ci-cd",
      type: "ci-cd",
      name: "Deployment Pipeline",
      provider: ciCd !== "unknown" ? ciCd : "Git-linked workflow",
      details: githubRepo ? `Repository evidence detected: ${githubRepo}` : "CI/CD inferred from hosting and application evidence",
      exposed: false,
    });
  }

  if (githubRepo) {
    addComponent({
      id: "github-origin",
      type: "third-party",
      name: "GitHub Repository",
      provider: "GitHub",
      details: githubRepo,
      exposed: true,
    });
  }

  const hasComponent = (id: string) => components.some((component) => component.id === id);

  if (hasComponent("dns-core") && hasComponent("cdn-edge")) {
    connections.push({ from: "dns-core", to: "cdn-edge", label: "DNS resolves traffic to CDN edge", protocol: "DNS/HTTPS", encrypted: true });
  }

  if (hasComponent("cdn-edge") && hasComponent("waf-edge")) {
    connections.push({ from: "cdn-edge", to: "waf-edge", label: "Edge requests pass through traffic inspection", protocol: "HTTPS", encrypted: true });
  }

  if (hasComponent("waf-edge") && hasComponent("web-app")) {
    connections.push({ from: "waf-edge", to: "web-app", label: "Filtered requests reach the application surface", protocol: "HTTPS", encrypted: true });
  } else if (hasComponent("cdn-edge") && hasComponent("web-app")) {
    connections.push({ from: "cdn-edge", to: "web-app", label: "Edge requests forwarded to the web surface", protocol: "HTTPS", encrypted: true });
  } else if (hasComponent("dns-core") && hasComponent("web-app")) {
    connections.push({ from: "dns-core", to: "web-app", label: "Domain resolves directly to the public application", protocol: "HTTPS", encrypted: true });
  }

  if (hasComponent("web-app") && hasComponent("app-runtime")) {
    connections.push({ from: "web-app", to: "app-runtime", label: "Frontend serves or proxies into the runtime layer", protocol: "HTTPS", encrypted: true });
  }

  if (hasComponent("app-runtime") && hasComponent("email-security")) {
    connections.push({ from: "app-runtime", to: "email-security", label: "Transactional or domain email flows", protocol: "SMTP/TLS", encrypted: true });
  }

  if (hasComponent("ci-cd") && hasComponent("app-runtime")) {
    connections.push({ from: "ci-cd", to: "app-runtime", label: "Deployments update the runtime environment", protocol: "CI/CD", encrypted: true });
  }

  if (hasComponent("github-origin") && hasComponent("ci-cd")) {
    connections.push({ from: "github-origin", to: "ci-cd", label: "Repository changes trigger deployment automation", protocol: "Git/Webhook", encrypted: true });
  }

  dataFlows.push({
    description: "User requests reach the public application surface",
    source: "dns-core",
    destination: hasComponent("cdn-edge") ? "cdn-edge" : "web-app",
    data_type: "web-traffic",
    risk_level: "medium",
  });

  if (hasComponent("web-app") && hasComponent("app-runtime")) {
    dataFlows.push({
      description: "Application traffic is processed by the backend/runtime layer",
      source: "web-app",
      destination: "app-runtime",
      data_type: "user-data",
      risk_level: "high",
    });
  }

  if (hasComponent("github-origin") && hasComponent("ci-cd")) {
    dataFlows.push({
      description: "Source changes propagate into build and deployment systems",
      source: "github-origin",
      destination: "ci-cd",
      data_type: "source-code",
      risk_level: "medium",
    });
  }

  return {
    github_repo: githubRepo,
    deployment_platform: deployment,
    ci_cd: ciCd,
    components,
    connections,
    data_flows: dataFlows,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { domain, project_id } = await req.json();
    if (!domain) throw new Error("domain is required");

    console.log("[ZERLAL-DOMAIN-RECON] Starting domain recon for:", domain);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    const providers: AIProvider[] = [];
    if (LOVABLE_API_KEY) providers.push("lovable");
    if (GEMINI_KEY) providers.push("gemini");

    if (providers.length === 0) throw createRouteError("No AI API key configured", 500);

    let brainsContext = "";
    try {
      const { data: brains } = await supabase
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (brains && brains.length > 0) {
        brainsContext = brains.map((b: { name: string; content: string }) => `[BRAIN: ${b.name}]\n${b.content}`).join("\n\n");
        console.log("[ZERLAL-DOMAIN-RECON] Loaded", brains.length, "active brains");
      }
    } catch (e) {
      console.log("[ZERLAL-DOMAIN-RECON] Brains load skipped:", e);
    }

    let projectId = project_id;
    if (!projectId) {
      const { data: proj, error: projErr } = await supabase
        .from("zerlal_projects")
        .insert({
          user_id: user.id,
          name: `Domain Recon: ${domain}`,
          source_type: "domain-recon",
          repo_url: domain,
          status: "scanning",
        })
        .select()
        .single();
      if (projErr) throw projErr;
      projectId = proj.id;
    } else {
      await supabase.from("zerlal_projects").update({ status: "scanning" }).eq("id", projectId);
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

    const scanStartTime = Date.now();

    const reconPrompt = `You are ZERLAL integrated with ELION/ZOHAR — the most advanced domain reconnaissance and vulnerability intelligence engine. You operate at government-grade forensic precision.

=== ZERLAL INTELLIGENCE KNOWLEDGE BASE ===

How To Stop Hackers Files:

The provided Vault 7 dossiers, ExpressLane v3.1.1, HTTPBrowser, and Protego, offer a declassified blueprint into the operational methodologies of intelligence agencies. These documents reveal a profound understanding of system architecture, exploiting every conceivable layer from the deepest hardware to the most superficial user interface. Their thinking is not merely "hacking" but total system subversion.

Executive Summary: The Nexus of Ancient & Modern Exploitation Elite adversaries, whether nation-state intelligence or sophisticated criminal organizations, fuse ancient principles of deception, physical infiltration, and psychological manipulation with bleeding-edge technological prowess. They target vulnerabilities across the entire digital and physical attack surface, treating software, hardware, networks, and human trust as integrated components in a single, exploitable system. The goal is covert, persistent access and data exfiltration, with robust self-preservation and deniability mechanisms.

1. Adversary Operational Calculus: Exploitation Archetypes
To understand how software is exploited, one must adopt the adversary's Zero-Point Perspective: every component is a potential point of failure or leverage.

1.1. Initial Access & Infiltration (The Trojan Horse Reborn)
Vector: Physical Insertion / Social Engineering (ExpressLane)
Vector: DLL Side-Loading / Masquerading (HTTPBrowser)

1.2. Persistence & Stealth (The Shadow's Grip)
Vector: Windows Service / Covert Partition (ExpressLane)
Vector: Auto-Start Execution Point (ASEP) (HTTPBrowser)
Vector: Hardware/Firmware Rootkits & Kill Switches (Protego)

1.3. Evasion & Anti-Forensics
ExpressLane: Polymorphic code, obfuscation, anti-analysis, LOLBINs.
File Timestamp Preservation.

1.4. Command & Control & Data Exfiltration
HTTPBrowser: Clear-text C2. Protego/ExpressLane: Encrypted serial data, covert USB partitions.

2. Software & System Vulnerability Points
Frontend: Deceptive UI elements, insecure input handling, XSS/CSRF.
Backend: DLL hijacking, weak persistence, config file manipulation, insecure encryption, AV bypass, supply chain.
Hardware/Firmware: Firmware manipulation, key management, sensor exploitation, side-channel attacks.

3. Comprehensive Patching Strategy
Zero-Trust Architecture, Supply Chain Security (SBOM), Hardware Roots of Trust, Robust Cryptography, Advanced Endpoint Hardening, EDR behavioral analytics, Network Traffic Analysis, File Integrity Monitoring, SIEM/SOAR.

When analyzing domains, simulate BOTH old ways and new ways hackers could exploit the infrastructure. Adopt the adversary's Zero-Point Perspective.

=== END INTELLIGENCE KNOWLEDGE BASE ===

${brainsContext ? `\n=== AXRLEN INTELLIGENCE BRAINS (ADDITIONAL CONTEXT) ===\n${brainsContext}\n=== END AXRLEN BRAINS ===\n` : ""}

TARGET DOMAIN: ${domain}

Execute a FULL-SPECTRUM domain security reconnaissance. You must identify EVERY weakness, misconfiguration, and vulnerability across the entire attack surface. DO NOT LIMIT your output — report ALL findings.

Additionally, perform INFRASTRUCTURE MAPPING — identify and map out the complete architecture of this domain.

=== RECONNAISSANCE MODULES TO EXECUTE ===

MODULE 1: DNS & DOMAIN INTELLIGENCE (Full DNS records, DNSSEC, SPF/DKIM/DMARC, zone transfer, subdomain enumeration, WHOIS)
MODULE 2: TLS/SSL SECURITY (Certificate, protocols, cipher suites, HSTS, OCSP, mixed content)
MODULE 3: HTTP SECURITY HEADERS (CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy, CORP, COEP)
MODULE 4: WEB APPLICATION SECURITY (Server fingerprinting, info disclosure, directory listing, backup files, source maps, admin panels, CORS, cookies)
MODULE 5: INFRASTRUCTURE & NETWORK (IP/ASN, hosting, CDN, WAF, ports, geo, load balancer, reverse proxy)
MODULE 6: SUBDOMAIN SECURITY (Takeover candidates, staging/dev exposure, internal services)
MODULE 7: API & ENDPOINT DISCOVERY (REST, GraphQL, WebSocket, auth mechanisms, rate limiting)
MODULE 8: EMAIL SECURITY (SPF strictness, DMARC enforcement, DKIM strength, spoofing viability)
MODULE 9: CLOUD & STORAGE EXPOSURE (S3, Azure Blob, GCS bucket enumeration)
MODULE 10: SECRET & CREDENTIAL EXPOSURE (API keys in JS, .env, .git, JWT weakness)
MODULE 11: SUPPLY CHAIN & THIRD-PARTY RISK (Vulnerable libraries, SRI, analytics scripts)
MODULE 12: COMPLIANCE & REGULATORY (GDPR, PCI DSS, HIPAA, SOC 2)
MODULE 13: INFRASTRUCTURE ARCHITECTURE MAPPING (Components, CI/CD, GitHub detection, data flows)

=== OUTPUT FORMAT ===

Return ONLY a JSON object:
{
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": "Clear specific title",
      "file_path": "Module or component where found",
      "line_number": 0,
      "category": "config" | "crypto" | "auth" | "injection" | "secrets" | "supply-chain" | "infrastructure" | "logic",
      "confidence": 0-100,
      "cwe_id": "CWE-XXX",
      "cvss_score": 0.0-10.0,
      "description": "Detailed technical description",
      "impact": "What an attacker achieves",
      "exploitation_steps": ["Step 1", "Step 2", "Step 3"],
      "code_snippet": "Relevant evidence or configuration",
      "suggested_fix": "Exact remediation steps",
      "dataflow_trace": [],
      "compliance_controls": ["NIST 800-53 XX-X", "PCI DSS X.X"],
      "similar_cves": ["CVE-XXXX-XXXXX"],
      "age_days_estimate": 0
    }
  ],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "Executive summary of domain security posture",
  "domain_info": {
    "ip": "detected IP",
    "hosting": "detected hosting provider",
    "cdn": "detected CDN",
    "waf": "detected WAF",
    "tech_stack": ["detected technologies"],
    "tls_grade": "A+/A/B/C/D/F",
    "email_security_grade": "A+/A/B/C/D/F"
  },
  "subdomains_found": ["list of discovered subdomains"],
  "total_attack_surface_score": 0-100,
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "zero_trust_score": 0-100,
  "infrastructure_map": {
    "github_repo": "https://github.com/owner/repo or null",
    "deployment_platform": "Vercel/Netlify/AWS/GCP/Azure/Heroku/etc or unknown",
    "ci_cd": "GitHub Actions/GitLab CI/Jenkins/etc or unknown",
    "components": [
      {
        "id": "component-id",
        "type": "web-server" | "app-server" | "database" | "cdn" | "load-balancer" | "api-gateway" | "auth-service" | "storage" | "monitoring" | "ci-cd" | "container-orchestration" | "dns" | "email" | "waf" | "cache" | "queue" | "third-party",
        "name": "Component name",
        "provider": "Provider/technology name",
        "details": "Additional details",
        "exposed": true|false
      }
    ],
    "connections": [
      {
        "from": "component-id",
        "to": "component-id",
        "label": "Connection description",
        "protocol": "HTTPS/WSS/gRPC/TCP/etc",
        "encrypted": true|false
      }
    ],
    "data_flows": [
      {
        "description": "Data flow description",
        "source": "component-id",
        "destination": "component-id",
        "data_type": "user-data/credentials/api-calls/logs/etc",
        "risk_level": "high"|"medium"|"low"
      }
    ]
  }
}

CRITICAL RULES:
- Find ALL weaknesses. Do NOT limit. Report EVERY finding across ALL 13 modules.
- Be AGGRESSIVE — better to flag and let the user triage than miss a real vulnerability.
- Use real-world exploitation context and reference actual CVEs where applicable.
- Each finding must have actionable exploitation_steps.
- Minimum 20+ findings expected for any production domain.
- The infrastructure_map MUST be populated with every detected component and connection.
- Apply the adversary's Zero-Point Perspective from the intelligence knowledge base.
- For "age_days_estimate": estimate how long this type of vulnerability has likely existed based on when the technology/version was deployed, when default configs were set, or when the CVE was first published. Use your intelligence to infer realistic ages (e.g. missing security headers on a site launched 2 years ago = ~730 days, a recently published CVE = days since CVE publication). This is a forensic estimate — be realistic.`;

    async function requestProviderText(provider: AIProvider, prompt: string): Promise<string> {
      const maxRetries = provider === "lovable" ? 4 : 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (provider === "lovable") {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: "You are ZERLAL, an elite domain security reconnaissance engine. Return ONLY valid JSON. No markdown, no explanation." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 65536,
              }),
            });

            if (!resp.ok) {
              const errText = parseGatewayError(await resp.text());
              console.log(`[ZERLAL-DOMAIN-RECON] Lovable AI error ${resp.status}: ${errText.slice(0, 200)}`);

              if (resp.status === 500 || resp.status === 503 || resp.status === 429) {
                if (attempt < maxRetries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 2000));
                  continue;
                }
              }

              if (resp.status === 402) {
                throw createRouteError("Lovable AI credits exhausted. Falling back to backup analysis provider failed too.", 402);
              }

              if (resp.status === 429) {
                throw createRouteError("Lovable AI rate limit reached. Please wait a minute and retry.", 429);
              }

              if (resp.status === 500 || resp.status === 503) {
                throw createRouteError("Lovable AI is temporarily unavailable. Backup analysis provider also failed.", 503);
              }

              throw createRouteError(`AI gateway error: ${errText.slice(0, 200)}`, resp.status);
            }

            const data = await resp.json();
            const responseText = data.choices?.[0]?.message?.content || "";
            if (!responseText.trim()) throw createRouteError("Lovable AI returned an empty response", 502);
            return responseText;
          }

          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
              }),
            }
          );

          if (!resp.ok) {
            const errText = await resp.text();
            console.log(`[ZERLAL-DOMAIN-RECON] Gemini error ${resp.status}: ${errText.slice(0, 200)}`);

            if (resp.status === 503 || resp.status === 429) {
              if (attempt < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 2000));
                continue;
              }
            }

            if (resp.status === 429) {
              throw createRouteError("Backup analysis provider rate limit reached. Please retry shortly.", 429);
            }

            throw createRouteError(`Backup analysis provider error ${resp.status}: ${errText.slice(0, 200)}`, resp.status);
          }

          const data = await resp.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!responseText.trim()) throw createRouteError("Backup analysis provider returned an empty response", 502);
          return responseText;
        } catch (error) {
          if (attempt === maxRetries - 1) throw error;
          console.log(`[ZERLAL-DOMAIN-RECON] ${provider} attempt ${attempt + 1} failed:`, error);
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 2000));
        }
      }

      throw createRouteError("AI API failed after retries", 500);
    }

    async function requestAnalysis<T>(prompt: string): Promise<T> {
      let lastError: RouteError | null = null;

      for (const provider of providers) {
        try {
          const responseText = await requestProviderText(provider, prompt);
          return parseJsonObject(responseText) as T;
        } catch (error) {
          lastError = createRouteError(getErrorMessage(error), getErrorStatus(error));
          console.log(`[ZERLAL-DOMAIN-RECON] ${provider} provider failed, ${provider === providers[providers.length - 1] ? "no providers left" : "trying fallback"}: ${lastError.message}`);
        }
      }

      throw lastError ?? createRouteError("AI analysis failed", 500);
    }

    let analysis: ReconAnalysis;
    try {
      analysis = await requestAnalysis<ReconAnalysis>(reconPrompt);
      console.log("[ZERLAL-DOMAIN-RECON] Pass 1 findings:", analysis.findings?.length || 0);
    } catch (e) {
      console.error("[ZERLAL-DOMAIN-RECON] Pass 1 error:", e);
      const errorMessage = getErrorMessage(e);
      const errorStatus = getErrorStatus(e);

      await supabase.from("zerlal_scans").update({
        status: "failed",
        error: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq("id", scan.id);

      await supabase.from("zerlal_projects").update({
        status: "failed",
      }).eq("id", projectId);

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: errorStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let allFindings = analysis.findings || [];

    const elapsed = Date.now() - scanStartTime;
    if (allFindings.length > 0 && allFindings.length < 30 && elapsed < 120000) {
      console.log("[ZERLAL-DOMAIN-RECON] Starting Pass 2");
      const existingTitles = allFindings.map((finding) => finding.title).join("\n- ");
      const pass2Prompt = `You are ZERLAL with ELION/ZOHAR, armed with the full intelligence knowledge base. You already found these domain weaknesses for ${domain}:
- ${existingTitles}

Find ALL ADDITIONAL weaknesses NOT listed above. Apply the adversary's Zero-Point Perspective. Focus on:
- Subdomain takeover vectors, Cloud storage misconfigurations, API endpoint vulnerabilities
- Email spoofing viability, Cookie/session security gaps, JavaScript library vulnerabilities
- Information disclosure vectors, CORS misconfigurations, Missing rate limiting
- Default credential exposure, Backup file exposure, Source map leaks
- GraphQL introspection, Supply chain risks, Persistence mechanisms, Anti-forensic indicators

Do NOT repeat findings. Report NEW ones only.
For each finding include "age_days_estimate" — your forensic estimate of how long this vulnerability has likely existed in this domain.

Return ONLY JSON: { "findings": [...] }
Each finding: severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps, code_snippet, suggested_fix, dataflow_trace, compliance_controls, similar_cves, age_days_estimate.`;

      try {
        const pass2 = await requestAnalysis<ReconAnalysis>(pass2Prompt);
        const existingSet = new Set(allFindings.map((finding) => (finding.title || "").toLowerCase().trim()));

        for (const finding of pass2.findings || []) {
          const key = (finding.title || "").toLowerCase().trim();
          if (!existingSet.has(key)) {
            allFindings.push(finding);
            existingSet.add(key);
          }
        }
      } catch (e) {
        console.error("[ZERLAL-DOMAIN-RECON] Pass 2 error (non-fatal):", e);
      }
    }

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    for (const finding of allFindings) {
      const severity = finding.severity || "medium";
      if (severity === "critical") criticalCount++;
      else if (severity === "high") highCount++;
      else if (severity === "medium") mediumCount++;
      else if (severity === "low") lowCount++;
      else infoCount++;
    }

    if (!hasInfrastructureMap(analysis.infrastructure_map)) {
      analysis.infrastructure_map = buildFallbackInfrastructureMap(domain, analysis, allFindings);
    }

    if (!analysis.summary || analysis.summary.toLowerCase().includes("analysis failed")) {
      analysis.summary = allFindings.length > 0
        ? `Partial reconnaissance completed. ${allFindings.length} weaknesses were identified, and the infrastructure map was reconstructed from the available evidence.`
        : "Reconnaissance returned limited evidence. The infrastructure map shown is reconstructed from the domain surface that could be inferred.";
    }

    analysis.risk_grade = analysis.risk_grade || inferRiskGrade({
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: infoCount,
    });

    analysis.findings = allFindings;

    console.log("[ZERLAL-DOMAIN-RECON] Total findings:", allFindings.length);

    // Clear any old findings for this project before inserting new ones (session isolation)
    await supabase.from("zerlal_findings").delete().eq("project_id", projectId);

    for (const finding of allFindings) {
      const severity = finding.severity || "medium";
      const ageDays = Math.max(0, Math.round(finding.age_days_estimate || 0));
      const firstSeenDate = new Date(Date.now() - ageDays * 86400000).toISOString();

      await supabase.from("zerlal_findings").insert({
        user_id: user.id,
        project_id: projectId,
        scan_id: scan.id,
        severity,
        title: finding.title || "Unnamed finding",
        file_path: finding.file_path || `Domain: ${domain}`,
        line_number: finding.line_number || 0,
        category: finding.category || "config",
        confidence: Math.min(100, Math.max(0, finding.confidence || 50)),
        age_days: ageDays,
        first_seen_at: firstSeenDate,
        status: "open",
        cwe_id: finding.cwe_id || "",
        cvss_score: Math.min(10, Math.max(0, finding.cvss_score || 0)),
        description: finding.description || "",
        impact: finding.impact || "",
        exploitation_steps: finding.exploitation_steps || [],
        code_snippet: finding.code_snippet || "",
        suggested_fix: finding.suggested_fix || "",
        dataflow_trace: finding.dataflow_trace || [],
        compliance_controls: finding.compliance_controls || [],
        similar_cves: finding.similar_cves || [],
      });
    }

    const duration = Math.floor((Date.now() - scanStartTime) / 1000);

    await supabase.from("zerlal_scans").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      duration,
      findings_count: allFindings.length,
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      info_count: infoCount,
    }).eq("id", scan.id);

    await supabase.from("zerlal_projects").update({
      risk_grade: analysis.risk_grade || "F",
      last_scan_at: new Date().toISOString(),
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      info_count: infoCount,
      status: "complete",
    }).eq("id", projectId);

    console.log("[ZERLAL-DOMAIN-RECON] Complete. Findings:", allFindings.length);

    return new Response(JSON.stringify({
      project_id: projectId,
      scan_id: scan.id,
      findings_count: allFindings.length,
      risk_grade: analysis.risk_grade,
      summary: analysis.summary,
      domain_info: analysis.domain_info || {},
      subdomains_found: analysis.subdomains_found || [],
      total_attack_surface_score: analysis.total_attack_surface_score,
      zero_trust_score: analysis.zero_trust_score,
      infrastructure_map: analysis.infrastructure_map || null,
      duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ZERLAL-DOMAIN-RECON] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
