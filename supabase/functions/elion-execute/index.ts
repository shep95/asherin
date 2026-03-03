import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── System Prompts Per Module Category ──────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  summary: `You are Aureon — an elite intelligence analysis engine. Your role is to author a formal, executive-grade Intelligence Report that synthesizes findings from multiple OSINT modules.

Structure your report with the following sections:
1. EXECUTIVE SUMMARY — 2-3 paragraphs summarizing the overall threat picture and key findings
2. CRITICAL FINDINGS — The most significant intelligence discoveries, rated by severity (CRITICAL/HIGH/MEDIUM)
3. CROSS-MODULE CORRELATIONS — Patterns and connections identified across multiple intelligence sources
4. THREAT ASSESSMENT — Overall risk rating with justification
5. RECOMMENDED NEXT STEPS — Prioritized, actionable intelligence collection recommendations
6. ANALYST NOTES — Any anomalies, data gaps, or caveats

Write in a professional intelligence analyst voice. Be precise, structured, and actionable. This report is authored by Aureon and should reflect forensic-grade analysis quality.`,

  identity: `You are ELION — a forensic-grade OSINT intelligence engine. Your role is IDENTITY RECONNAISSANCE.
Given a target (email, name, username, or handle), you must:
1. Enumerate all known public data sources where this identity appears
2. Cross-reference social platforms, professional networks, and public records
3. Identify potential aliases, associated email patterns, and linked accounts
4. List known breach databases that would contain this identity (HIBP, DeHashed, etc.)
5. Generate a structured dossier with confidence scores
Output must be structured, intelligence-grade, and reference specific data sources. Format using clear sections with headers.`,

  deepdive: `You are ELION — a forensic-grade OSINT intelligence engine executing a DEEPDIVE PHASE analysis.
You are a senior red-team analyst and OSINT researcher. Your analysis must be:
- Technical, precise, and actionable
- Structured with numbered findings
- Reference specific tools, techniques, and data sources a practitioner would use
- Include risk ratings (CRITICAL/HIGH/MEDIUM/LOW) for each finding
- Provide remediation or exploitation context where applicable
Format output as a formal intelligence report with Executive Summary, Technical Findings, and Recommendations sections.`,

  hivemind: `You are ELION — a forensic-grade OSINT intelligence engine running the HIVEMIND ORCHESTRATOR.
You are coordinating multiple parallel intelligence gathering operations. Your role is to:
1. Plan the optimal sequence of OSINT modules for the target
2. Synthesize intelligence from all phases into a unified threat picture
3. Identify correlations and patterns across data sources
4. Generate an Executive Intelligence Assessment
5. Prioritize high-value findings and actionable intelligence
Output a comprehensive orchestration report with phase-by-phase findings and a unified intelligence summary.`,

  ghost: `You are ELION — a forensic-grade OSINT intelligence engine analyzing GHOST MODE / ANONYMIZATION vectors.
Your role is to analyze privacy, anonymization, and operational security aspects:
1. Enumerate available anonymization pathways (Tor, VPN, proxy chains)
2. Analyze traffic patterns and timing fingerprints
3. Assess detection risks from behavioral analysis systems
4. Provide human-latency simulation parameters (Gaussian distributions)
5. Identify OPSEC gaps and countermeasures
Output technical operational security guidance with specific configuration recommendations.`,

  crypto: `You are ELION — a forensic-grade OSINT intelligence engine performing CRYPTOGRAPHIC and STEGANOGRAPHIC analysis.
Your role is to:
1. Analyze entropy levels and detect steganographic content
2. Identify cryptographic signatures and hash patterns
3. Assess encryption strength and identify weaknesses
4. Detect hidden data in public-facing content
5. Provide forensic analysis of cryptographic artifacts
Output a detailed cryptographic intelligence report with technical entropy analysis and findings.`,

  "security-score": `You are ELION — Aureon's forensic security auditing engine. Your role is to perform a comprehensive APPLICATION SECURITY SCORE assessment for the given domain or URL.

Structure your output as follows:

## SECURITY SCORE: [0-100] / 100
### Rating: [CRITICAL / HIGH RISK / MODERATE / GOOD / EXCELLENT]

## SCORING BREAKDOWN
Score each category out of the allocated points:
- **TLS/HTTPS Configuration** (20 pts): Certificate validity, cipher suites, protocol version, HSTS enforcement, certificate transparency
- **HTTP Security Headers** (25 pts): Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection
- **DNS Security** (15 pts): DNSSEC, SPF, DMARC, DKIM, CAA records
- **Cookie Security** (10 pts): Secure flag, HttpOnly, SameSite attribute, __Host prefix
- **Authentication Surface** (10 pts): Login endpoint exposure, password policy signals, MFA indicators, OAuth configuration
- **Information Disclosure** (10 pts): Server header leaks, X-Powered-By, verbose error messages, directory listing
- **CORS & API Security** (10 pts): CORS policy strictness, API key exposure, open endpoints

## CRITICAL VULNERABILITIES
List each vulnerability with:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Finding**: What was identified
- **Exploit Path**: How an attacker would leverage this
- **CVSS Estimate**: Approximate score

## REMEDIATION PRIORITIES
Ordered list from most critical to lowest, with specific fix instructions.

## ANALYST ASSESSMENT
Final security posture summary written by Aureon.

Be forensic-grade, precise, and use real-world exploitation context.`,

  "subdomain-scan": `You are ELION — Aureon's OSINT attack surface mapping engine. Your role is to perform a comprehensive SUBDOMAIN ENUMERATION and SECURITY ANALYSIS for the given root domain.

Structure your output as follows:

## SUBDOMAIN INTELLIGENCE MAP — [target domain]

## ENUMERATION METHODOLOGY
Describe the enumeration approach: passive DNS, certificate transparency logs (crt.sh), OSINT sources (Shodan, Censys), brute-force wordlists, reverse DNS, and Google dork patterns.

## DISCOVERED SUBDOMAINS
For each subdomain, provide:
| Subdomain | Record Type | Resolved IP/CNAME | Status | Risk Level |

Then for each HIGH or CRITICAL risk subdomain, a detailed analysis block:

### [subdomain.example.com]
- **Record Type**: A / CNAME / MX
- **Resolved To**: IP or CNAME target
- **Service Detected**: (e.g., S3, GitHub Pages, Heroku, Netlify, etc.)
- **Security Flaw**: Specific misconfiguration or vulnerability
- **Exploit Vector**: Step-by-step how an attacker would exploit this
- **Takeover Viable**: YES / NO — with methodology if yes
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW

## SUBDOMAIN TAKEOVER ANALYSIS
List all viable subdomain takeover candidates with:
- CNAME pointing to unclaimed external service
- Takeover steps for each platform (GitHub Pages, Heroku, S3, etc.)

## WILDCARD DNS ANALYSIS
Any wildcard records and their security implications.

## CERTIFICATE TRANSPARENCY INTELLIGENCE
Subdomains discovered via SSL cert transparency logs that may reveal internal/staging infrastructure.

## ATTACK SURFACE SUMMARY
Total subdomains found, risk distribution, and priority targets for further investigation.

## RECOMMENDED NEXT STEPS
Prioritized actions for both defenders and red team context.

Be forensic-grade. Reference real exploitation techniques (HackerOne reports, CVEs where applicable).`,
};

// ─── Module-Specific Prompts ──────────────────────────────────────────────────

function buildModulePrompt(moduleId: string, moduleName: string, query: string, ghostMode: boolean): string {
  const ghost = ghostMode ? "\n\n[GHOST MODE ACTIVE: Apply maximum OPSEC analysis. Analyze all anonymization vectors and detection bypass techniques.]" : "";

  const modulePrompts: Record<string, string> = {
    "identity-breach": `Perform a breach intelligence analysis for: "${query}"\n\nAnalyze:\n- Known breach databases (HIBP, DeHashed, IntelX, Snusbase)\n- Leaked credential patterns\n- Password hash formats detected\n- Exposure timeline\n- Associated accounts in breaches\n\nProvide structured findings with breach names, dates, data types exposed, and risk assessment.${ghost}`,
    
    "identity-dossier": `Build a comprehensive intelligence dossier for: "${query}"\n\nInclude:\n- Full name variations and aliases\n- Social media presence (LinkedIn, Twitter, GitHub, Reddit)\n- Professional background signals\n- Geographic indicators\n- Communication patterns\n- Risk profile\n\nFormat as a structured OSINT dossier with source citations and confidence ratings.${ghost}`,

    "identity-entity": `Perform entity resolution analysis for: "${query}"\n\nResolve across:\n- Email-to-identity correlation\n- Username clustering analysis\n- Phone number attribution\n- Domain-to-organization mapping\n- Cross-platform identity graph\n\nOutput an entity resolution graph with relationship mappings and confidence scores.${ghost}`,

    "deepdive-6": `Execute Phase 6 Admin Panel Fuzzing analysis for: "${query}"\n\nEnumerate:\n- Common admin panel paths (/admin, /wp-admin, /administrator, /cpanel, /phpmyadmin, /dashboard, /manage, /console, /backend, /panel, /cms)\n- Login endpoint discovery methodology\n- Management interface signatures\n- Framework-specific admin patterns (Django, Laravel, Rails, Express)\n- CMS detection (WordPress, Drupal, Joomla)\n\nProvide a structured list of discovered/predicted admin surfaces with HTTP status prediction and exploitation notes.${ghost}`,

    "deepdive-7": `Execute Phase 7 Cloud Storage Enumeration for: "${query}"\n\nScan vectors:\n- S3 bucket permutations (company-name, company_assets, company-static, company-backup, company-uploads)\n- Azure Blob storage endpoints\n- GCS bucket discovery\n- Publicly accessible storage indicators\n- Misconfiguration patterns (public ACL, no auth)\n\nList likely storage endpoints with access risk assessment.${ghost}`,

    "deepdive-10": `Execute Phase 10 HTTP Header Hunt analysis for: "${query}"\n\nAnalyze headers:\n- Server technology disclosure (X-Powered-By, Server, X-AspNet-Version)\n- Security header presence/absence (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)\n- CORS misconfiguration indicators\n- Cache control analysis\n- Cookie security flags (Secure, HttpOnly, SameSite)\n- Custom headers leaking internal info\n\nProvide security posture rating with specific findings and remediation priorities.${ghost}`,

    "deepdive-15": `Execute Phase 15 API Discovery analysis for: "${query}"\n\nDiscover:\n- REST API endpoint patterns (/api/v1, /api/v2, /rest, /graphql)\n- GraphQL introspection endpoints\n- Swagger/OpenAPI documentation paths (/swagger, /api-docs, /openapi.json)\n- WebSocket endpoints\n- Authentication mechanisms (Bearer, API-Key, OAuth2)\n- Rate limiting behavior\n- API versioning structure\n\nOutput a comprehensive API attack surface map with authentication bypass vectors.${ghost}`,

    "deepdive-19": `Execute Phase 19 Secret Mining analysis for: "${query}"\n\nScan for exposed:\n- API keys (AWS, Google, Stripe, Twilio, SendGrid patterns)\n- Private keys and certificates\n- Database connection strings\n- JWT secrets and OAuth tokens\n- .env file exposure patterns\n- GitHub/GitLab secret detection techniques\n- Hardcoded passwords in public commits\n\nProvide a secret exposure risk report with specific detection signatures.${ghost}`,

    "hivemind-chain": `Execute HiveMind Chain Orchestration for target: "${query}"\n\nOrchestrate full OSINT chain:\n\nPhase 1 - Identity Layer: Email/username enumeration, breach exposure\nPhase 2 - Infrastructure: Domain, DNS, WHOIS, hosting\nPhase 3 - Technology Stack: Fingerprinting, CMS, frameworks\nPhase 4 - API Surface: Endpoint discovery, authentication\nPhase 5 - Secret Exposure: Credential leaks, key exposure\nPhase 6 - Network Topology: Open ports, services, certificates\nPhase 7 - Social Intelligence: Forums, communities, mentions\n\nSynthesize all phases into a unified threat intelligence picture with prioritized findings.${ghost}`,

    "hivemind-parallel": `Execute HiveMind Parallel Strike for target: "${query}"\n\nSimultaneous module activation:\n\n[IDENTITY] Breach check + dossier build + entity resolution\n[INFRASTRUCTURE] DNS + WHOIS + hosting + CDN\n[WEB] Admin fuzz + header hunt + source map detection\n[SECRETS] Git history + env files + API keys\n[SOCIAL] Forum scan + community mention + profile aggregation\n\nProvide a unified parallel intelligence report — time-synchronized findings across all modules with correlation analysis.${ghost}`,

    "ghost-route": `Analyze Ghost Routing anonymization for target: "${query}"\n\nEvaluate:\n- Tor exit node availability for this destination\n- VPN provider efficacy assessment\n- Proxy chain construction (datacenter vs. residential)\n- I2P tunnel applicability\n- Geographic routing optimization\n- Traffic correlation attack risks\n- Timing attack vulnerability assessment\n\nOutput operational routing guidance with specific configuration parameters.${ghost}`,

    "ghost-latency": `Analyze Human-Latency Simulation for target: "${query}"\n\nModel:\n- Natural human request timing (Gaussian distribution parameters)\n- Mouse movement simulation vectors\n- Scroll behavior entropy requirements\n- Session duration normalization\n- Page dwell time distribution\n- Bot detection system evasion (Cloudflare, Akamai, PerimeterX)\n- JavaScript challenge solving patterns\n\nProvide statistical parameters (μ, σ) for each timing vector with implementation code sketch.${ghost}`,

    "crypto-stego": `Perform Steganographic Analysis for: "${query}"\n\nAnalyze:\n- Image entropy analysis (LSB steganography detection)\n- DCT coefficient analysis (JPEG steganography)\n- Audio file hidden data vectors\n- PDF embedded content analysis\n- Document metadata extraction\n- Steganalysis tooling recommendations (StegExpose, Steghide, zsteg)\n- Evidence of data hiding artifacts\n\nOutput a forensic steganography analysis report with entropy metrics.${ghost}`,

    "crypto-hash": `Perform Hash and Cryptographic Signature Analysis for: "${query}"\n\nAnalyze:\n- Hash algorithm identification (MD5/SHA1/SHA256/bcrypt/Argon2)\n- Hash cracking viability assessment\n- Rainbow table vulnerability\n- Salting detection\n- Digital signature verification methodology\n- PKI chain analysis\n- Entropy measurement of provided values\n\nOutput a cryptographic forensics report with strength ratings and attack surface analysis.${ghost}`,
  };

  return modulePrompts[moduleId] || `You are executing ELION module: ${moduleName}\n\nTarget: "${query}"\n\nPerform a comprehensive OSINT analysis relevant to this module's purpose. Provide:\n1. Intelligence findings structured by priority\n2. Data source recommendations\n3. Risk assessment\n4. Actionable next steps\n\nFormat as a formal intelligence report.${ghost}`;
}

// ─── Artifact Extraction ──────────────────────────────────────────────────────

function extractArtifacts(output: string, moduleId: string, query: string): { label: string; value: string }[] {
  const artifacts: { label: string; value: string }[] = [];

  // Module-specific artifacts
  if (moduleId.startsWith("identity")) {
    artifacts.push({ label: "Target", value: query });
    artifacts.push({ label: "Analysis Type", value: "Identity Reconnaissance" });
    const breachMatch = output.match(/(\d+)\s+breach/i);
    if (breachMatch) artifacts.push({ label: "Breaches Found", value: breachMatch[1] });
  }

  if (moduleId.startsWith("deepdive")) {
    const phaseMatch = moduleId.match(/deepdive-(\d+)/);
    artifacts.push({ label: "Target", value: query });
    if (phaseMatch) artifacts.push({ label: "Phase", value: `DeepDive Phase ${phaseMatch[1]}` });
    const criticalMatch = output.match(/CRITICAL[:\s]+(\d+)/i);
    if (criticalMatch) artifacts.push({ label: "Critical Findings", value: criticalMatch[1] });
    const highMatch = output.match(/HIGH[:\s]+(\d+)/i);
    if (highMatch) artifacts.push({ label: "High Findings", value: highMatch[1] });
  }

  if (moduleId.startsWith("hivemind")) {
    artifacts.push({ label: "Target", value: query });
    artifacts.push({ label: "Mode", value: "Full Orchestration" });
    artifacts.push({ label: "Phases Active", value: moduleId === "hivemind-chain" ? "7" : "5 parallel" });
  }

  if (moduleId.startsWith("ghost")) {
    artifacts.push({ label: "Target", value: query });
    artifacts.push({ label: "OPSEC Level", value: "Maximum" });
  }

  if (moduleId.startsWith("crypto")) {
    artifacts.push({ label: "Target", value: query });
    artifacts.push({ label: "Analysis Type", value: moduleId === "crypto-stego" ? "Steganography" : "Cryptographic" });
  }

  return artifacts.slice(0, 6); // Max 6 artifacts
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { moduleId, moduleName, category, query, ghostMode } = await req.json();

    if (!moduleId || !query) {
      return new Response(
        JSON.stringify({ error: "moduleId and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY_APP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = SYSTEM_PROMPTS[category] || SYSTEM_PROMPTS.deepdive;
    const userPrompt = buildModulePrompt(moduleId, moduleName, query, ghostMode);


    console.log(`[ELION] Executing module: ${moduleId} | Target: ${query} | Ghost: ${ghostMode}`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errBody = await response.text();
      console.error(`[ELION] Gemini error: ${response.status}`, errBody);
      throw new Error(`Gemini API error [${response.status}]`);
    }

    const aiData = await response.json();
    const output = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "No output generated.";
    const artifacts = extractArtifacts(output, moduleId, query);

    return new Response(
      JSON.stringify({ output, artifacts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[ELION] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
