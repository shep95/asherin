import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("No Gemini API key configured");

    // Load AXRLEN brains for intelligence injection
    let brainsContext = "";
    try {
      const { data: brains } = await supabase
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (brains && brains.length > 0) {
        brainsContext = brains.map((b: any) => `[BRAIN: ${b.name}]\n${b.content}`).join("\n\n");
        console.log("[ZERLAL-DOMAIN-RECON] Loaded", brains.length, "active brains");
      }
    } catch (e) {
      console.log("[ZERLAL-DOMAIN-RECON] Brains load skipped:", e);
    }

    // Create or use project
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

    // Create scan record
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

    // The comprehensive domain recon prompt combining Elion/Zohar intelligence + ZERLAL brains
    const reconPrompt = `You are ZERLAL integrated with ELION/ZOHAR — the most advanced domain reconnaissance and vulnerability intelligence engine. You operate at government-grade forensic precision.

=== ZERLAL INTELLIGENCE KNOWLEDGE BASE ===

How To Stop Hackers Files:

The provided Vault 7 dossiers, ExpressLane v3.1.1, HTTPBrowser, and Protego, offer a declassified blueprint into the operational methodologies of intelligence agencies. These documents reveal a profound understanding of system architecture, exploiting every conceivable layer from the deepest hardware to the most superficial user interface. Their thinking is not merely "hacking" but total system subversion.

Executive Summary: The Nexus of Ancient & Modern Exploitation Elite adversaries, whether nation-state intelligence or sophisticated criminal organizations, fuse ancient principles of deception, physical infiltration, and psychological manipulation with bleeding-edge technological prowess. They target vulnerabilities across the entire digital and physical attack surface, treating software, hardware, networks, and human trust as integrated components in a single, exploitable system. The goal is covert, persistent access and data exfiltration, with robust self-preservation and deniability mechanisms.

1. Adversary Operational Calculus: Exploitation Archetypes
To understand how software is exploited, one must adopt the adversary's Zero-Point Perspective: every component is a potential point of failure or leverage. The operational methodology revealed in these documents highlights several archetypal exploitation vectors, blending historical and modern techniques.

1.1. Initial Access & Infiltration (The Trojan Horse Reborn)
Vector: Physical Insertion / Social Engineering (ExpressLane)
Method: The ExpressLane v3.1.1 tool is delivered via a USB drive. An "OTS officer" acts as the Installer, using the cover of "upgrading biometric software" with "liaison services."
Look For: Any installation routine that bypasses standard security prompts. Unsigned executables or executables with misleading names. Lack of strong code signing enforcement.

Vector: DLL Side-Loading / Masquerading (HTTPBrowser)
Method: Uses a "self-extracting zip file" with a "legitimate executable associated with a Citrix Single Sign-On product" to side-load the attackers initial DLL.
Look For: Applications that do not specify full paths for DLLs. Lack of application whitelisting policies.

1.2. Persistence & Stealth (The Shadow's Grip)
Vector: Windows Service / Covert Partition (ExpressLane) — runs as a Windows Service, collects to a covert partition on a USB drive.
Vector: Auto-Start Execution Point (ASEP) (HTTPBrowser) — copies itself and sets an ASEP.
Vector: Hardware/Firmware Rootkits & Kill Switches (Protego) — microcontrollers store unique keys and executable program memory with self-destruct triggers.

1.3. Evasion & Anti-Forensics
ExpressLane: Shall not be detectable by Norton, McAfee, Kaspersky, firewalls. Uses polymorphic code, obfuscation, anti-analysis, LOLBINs.
File Timestamp Preservation: Collection shall not change date modified for files.

1.4. Command & Control & Data Exfiltration
HTTPBrowser: Clear-text C2, continuously contacts C2 server.
Protego/ExpressLane: Encrypted serial data, covert USB partitions.

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

Additionally, perform INFRASTRUCTURE MAPPING — identify and map out the complete architecture of this domain:
- Detect if the domain has a linked GitHub repository (check .git exposure, meta tags, source maps, package.json references, deployment configs)
- If a GitHub repo is found, include the full URL
- Map the entire infrastructure: servers, CDNs, load balancers, APIs, databases (inferred), microservices, third-party services
- Identify the deployment pipeline (CI/CD indicators)
- Map data flow between components
- Identify all external service integrations

=== RECONNAISSANCE MODULES TO EXECUTE ===

MODULE 1: DNS & DOMAIN INTELLIGENCE
- Full DNS record enumeration (A, AAAA, MX, TXT, CNAME, NS, SOA, SRV, CAA)
- DNSSEC validation status
- SPF, DKIM, DMARC policy analysis — check for spoofing risk
- Zone transfer vulnerability (AXFR)
- Subdomain enumeration via certificate transparency logs (crt.sh)
- Wildcard DNS detection
- Domain age, registrar, WHOIS exposure
- Nameserver security assessment

MODULE 2: TLS/SSL SECURITY ANALYSIS
- Certificate validity, issuer, chain completeness
- Protocol versions supported (TLS 1.0/1.1/1.2/1.3, SSLv3)
- Cipher suite analysis — weak ciphers, export ciphers, NULL ciphers
- HSTS enforcement and preload status
- Certificate transparency monitoring
- OCSP stapling status
- Mixed content vulnerability
- Certificate pinning assessment

MODULE 3: HTTP SECURITY HEADERS
- Content-Security-Policy (or lack thereof)
- X-Frame-Options / Clickjacking vulnerability
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- X-XSS-Protection
- Strict-Transport-Security
- Cross-Origin-Resource-Policy
- Cross-Origin-Embedder-Policy

MODULE 4: WEB APPLICATION SECURITY
- Server/technology fingerprinting (web server, framework, CMS)
- Information disclosure (Server header, X-Powered-By, debug pages)
- Error handling analysis (verbose errors, stack traces)
- Directory listing enabled
- Backup file exposure (.bak, .old, .swp, ~)
- Source map exposure (.js.map)
- Admin panel exposure (/admin, /wp-admin, /dashboard, /console, /phpmyadmin)
- robots.txt and sitemap.xml intelligence
- Default credentials on exposed services
- CORS misconfiguration
- Cookie security (Secure, HttpOnly, SameSite flags)

MODULE 5: INFRASTRUCTURE & NETWORK
- IP address and ASN mapping
- Hosting provider / cloud platform identification
- CDN detection (Cloudflare, Akamai, AWS CloudFront)
- WAF detection and bypass indicators
- Open port analysis (common web ports: 80, 443, 8080, 8443, 3000, 4443)
- Geographic server location
- Load balancer detection
- Reverse proxy identification

MODULE 6: SUBDOMAIN SECURITY
- Enumerate all discoverable subdomains
- Subdomain takeover candidates (dangling CNAMEs to unclaimed services)
- Staging/dev environment exposure
- Internal service exposure
- Wildcard subdomain abuse potential

MODULE 7: API & ENDPOINT DISCOVERY
- REST API endpoint patterns (/api/v1, /api/v2, /graphql)
- GraphQL introspection exposure
- Swagger/OpenAPI documentation exposure
- WebSocket endpoint discovery
- Authentication mechanism analysis
- Rate limiting assessment

MODULE 8: EMAIL SECURITY
- SPF record strictness (softfail vs hardfail)
- DMARC policy enforcement (none/quarantine/reject)
- DKIM key strength
- Email spoofing viability
- MX record analysis

MODULE 9: CLOUD & STORAGE EXPOSURE
- S3 bucket enumeration (company-name variations)
- Azure Blob storage discovery
- GCS bucket discovery
- Public storage misconfiguration

MODULE 10: SECRET & CREDENTIAL EXPOSURE
- Exposed API keys in JavaScript source
- Hardcoded credentials in public-facing code
- .env file exposure
- Git repository exposure (.git/)
- Source code leak indicators
- JWT secret weakness indicators

MODULE 11: SUPPLY CHAIN & THIRD-PARTY RISK
- Third-party JavaScript dependencies
- Known vulnerable libraries (outdated jQuery, Angular, etc.)
- Analytics/tracking script analysis
- CDN integrity (SRI tags)

MODULE 12: COMPLIANCE & REGULATORY
- GDPR indicators (cookie consent, privacy policy)
- PCI DSS surface exposure
- HIPAA-relevant data handling signals
- SOC 2 compliance indicators

MODULE 13: INFRASTRUCTURE ARCHITECTURE MAPPING
- Map ALL server components (web servers, app servers, database servers)
- Identify CI/CD pipeline (GitHub Actions, GitLab CI, Jenkins, CircleCI, Vercel, Netlify)
- Detect GitHub/GitLab repository links (from source, headers, meta, deployment indicators)
- Map API gateway / load balancer / reverse proxy architecture
- Identify microservices architecture patterns
- Map third-party service integrations (auth providers, payment, analytics, monitoring)
- Identify container/orchestration (Docker, Kubernetes indicators)
- Map data flow between components
- Identify backup/disaster recovery indicators

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
      "similar_cves": ["CVE-XXXX-XXXXX"]
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
- Apply the adversary's Zero-Point Perspective from the intelligence knowledge base.`;

    // Call Gemini
    async function callGemini(prompt: string): Promise<string> {
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        if (resp.ok) {
          const data = await resp.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
        if (resp.status === 503 || resp.status === 429) {
          console.log(`[ZERLAL-DOMAIN-RECON] Retry ${attempt + 1} after ${resp.status}`);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
          continue;
        }
        const errText = await resp.text();
        throw new Error(`Gemini error ${resp.status}: ${errText}`);
      }
      throw new Error("Gemini API failed after retries");
    }

    // Pass 1: Full recon
    let analysis: any;
    try {
      const responseText = await callGemini(reconPrompt);
      console.log("[ZERLAL-DOMAIN-RECON] Pass 1 response length:", responseText.length);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON in response");
      }
    } catch (e) {
      console.error("[ZERLAL-DOMAIN-RECON] Pass 1 error:", e);
      analysis = { findings: [], risk_grade: "F", summary: "Analysis failed. Retry recommended." };
    }

    let allFindings = analysis.findings || [];
    console.log("[ZERLAL-DOMAIN-RECON] Pass 1 findings:", allFindings.length);

    // Pass 2: Deep dive if < 30 findings
    const elapsed = Date.now() - scanStartTime;
    if (allFindings.length > 0 && allFindings.length < 30 && elapsed < 120000) {
      console.log("[ZERLAL-DOMAIN-RECON] Starting Pass 2");
      const existingTitles = allFindings.map((f: any) => f.title).join("\n- ");
      const pass2Prompt = `You are ZERLAL with ELION/ZOHAR, armed with the full intelligence knowledge base (Vault 7 dossiers, ExpressLane, HTTPBrowser, Protego archetypes). You already found these domain weaknesses for ${domain}:
- ${existingTitles}

Find ALL ADDITIONAL weaknesses NOT listed above. Apply the adversary's Zero-Point Perspective. Focus on:
- Subdomain takeover vectors
- Cloud storage misconfigurations  
- API endpoint vulnerabilities
- Email spoofing viability
- Cookie/session security gaps
- JavaScript library vulnerabilities
- Information disclosure vectors
- CORS misconfigurations
- Missing rate limiting
- Default credential exposure
- Backup file exposure
- Source map leaks
- GraphQL introspection
- Supply chain risks (DLL side-loading patterns, compromised dependencies)
- Persistence mechanisms (hidden services, ASEPs)
- Anti-forensic indicators

Do NOT repeat findings. Report NEW ones only. Return ONLY JSON: { "findings": [...] }
Each finding: severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps, code_snippet, suggested_fix, dataflow_trace, compliance_controls, similar_cves.`;

      try {
        const pass2Text = await callGemini(pass2Prompt);
        const pass2Match = pass2Text.match(/\{[\s\S]*\}/);
        if (pass2Match) {
          const pass2 = JSON.parse(pass2Match[0]);
          const existingSet = new Set(allFindings.map((f: any) => (f.title || "").toLowerCase().trim()));
          for (const f of (pass2.findings || [])) {
            const key = (f.title || "").toLowerCase().trim();
            if (!existingSet.has(key)) {
              allFindings.push(f);
              existingSet.add(key);
            }
          }
        }
      } catch (e) {
        console.error("[ZERLAL-DOMAIN-RECON] Pass 2 error (non-fatal):", e);
      }
    }

    console.log("[ZERLAL-DOMAIN-RECON] Total findings:", allFindings.length);

    // Insert all findings — NO LIMIT
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

    for (const f of allFindings) {
      const severity = f.severity || "medium";
      if (severity === "critical") criticalCount++;
      else if (severity === "high") highCount++;
      else if (severity === "medium") mediumCount++;
      else if (severity === "low") lowCount++;
      else infoCount++;

      await supabase.from("zerlal_findings").insert({
        user_id: user.id,
        project_id: projectId,
        scan_id: scan.id,
        severity,
        title: f.title || "Unnamed finding",
        file_path: f.file_path || `Domain: ${domain}`,
        line_number: f.line_number || 0,
        category: f.category || "config",
        confidence: Math.min(100, Math.max(0, f.confidence || 50)),
        age_days: 0,
        first_seen_at: new Date().toISOString(),
        status: "open",
        cwe_id: f.cwe_id || "",
        cvss_score: Math.min(10, Math.max(0, f.cvss_score || 0)),
        description: f.description || "",
        impact: f.impact || "",
        exploitation_steps: f.exploitation_steps || [],
        code_snippet: f.code_snippet || "",
        suggested_fix: f.suggested_fix || "",
        dataflow_trace: f.dataflow_trace || [],
        compliance_controls: f.compliance_controls || [],
        similar_cves: f.similar_cves || [],
      });
    }

    const duration = Math.floor((Date.now() - scanStartTime) / 1000);

    // Update scan
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

    // Update project
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
