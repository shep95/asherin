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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    
    const useLovableGateway = !!LOVABLE_API_KEY;
    if (!useLovableGateway && !GEMINI_KEY) throw new Error("No AI API key configured");

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

    // Call AI via Lovable Gateway or Gemini direct
    async function callAI(prompt: string): Promise<string> {
      const maxRetries = 4;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          let responseText = "";
          
          if (useLovableGateway) {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You are ZERLAL, an elite domain security reconnaissance engine. Return ONLY valid JSON. No markdown, no explanation." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 65536,
              }),
            });

            if (!resp.ok) {
              const errText = await resp.text();
              console.log(`[ZERLAL-DOMAIN-RECON] Gateway error ${resp.status}: ${errText.slice(0, 200)}`);
              if (resp.status === 503 || resp.status === 429 || resp.status === 500) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
                continue;
              }
              throw new Error(`AI Gateway error ${resp.status}: ${errText.slice(0, 200)}`);
            }

            const data = await resp.json();
            responseText = data.choices?.[0]?.message?.content || "";
          } else {
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
              if (resp.status === 503 || resp.status === 429) {
                console.log(`[ZERLAL-DOMAIN-RECON] Retry ${attempt + 1} after ${resp.status}`);
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
                continue;
              }
              const errText = await resp.text();
              throw new Error(`Gemini error ${resp.status}: ${errText}`);
            }
            const data = await resp.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }

          return responseText;
        } catch (e) {
          if (attempt === maxRetries - 1) throw e;
          console.log(`[ZERLAL-DOMAIN-RECON] Attempt ${attempt + 1} failed:`, e);
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
        }
      }
      throw new Error("AI API failed after retries");
    }

    // Pass 1: Full recon
    let analysis: any;
    try {
      const responseText = await callAI(reconPrompt);
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
        const pass2Text = await callAI(pass2Prompt);
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

      const ageDays = Math.max(0, Math.round(f.age_days_estimate || 0));
      const firstSeenDate = new Date(Date.now() - ageDays * 86400000).toISOString();

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
        age_days: ageDays,
        first_seen_at: firstSeenDate,
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
