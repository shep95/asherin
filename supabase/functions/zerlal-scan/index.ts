import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchGitHubContent(url: string): Promise<string> {
  // Convert github.com URL to raw content or API URL
  let apiUrl = url;
  
  if (url.includes("github.com")) {
    // https://github.com/owner/repo -> https://api.github.com/repos/owner/repo/contents
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, "");
      // Get repo tree
      const treeResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`, {
        headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "ZERLAL-Scanner" },
      });
      
      if (!treeResp.ok) {
        const errText = await treeResp.text();
        throw new Error(`GitHub API error (${treeResp.status}): ${errText}`);
      }
      
      const treeData = await treeResp.json();
      const codeExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".php", ".rb", ".swift", ".kt", ".cs", ".sh", ".sql", ".yaml", ".yml", ".json", ".toml", ".tf", ".dockerfile", ".env", ".vue", ".svelte"];
      const skipPaths = ["node_modules/", ".git/", "dist/", "build/", "__pycache__/", ".next/", "vendor/", "package-lock.json", "yarn.lock", "bun.lock"];
      
      const codeFiles = (treeData.tree || [])
        .filter((f: any) => {
          if (f.type !== "blob") return false;
          if (f.size > 50000) return false; // skip large files
          if (skipPaths.some(skip => f.path.includes(skip))) return false;
          return codeExtensions.some(ext => f.path.endsWith(ext));
        })
        .sort((a: any, b: any) => {
          // Prioritize security-relevant files
          const securityFiles = ["auth", "login", "password", "token", "session", "crypto", "encrypt", "middleware", "api", "route", "handler", "config", "env"];
          const aScore = securityFiles.filter(s => a.path.toLowerCase().includes(s)).length;
          const bScore = securityFiles.filter(s => b.path.toLowerCase().includes(s)).length;
          return bScore - aScore;
        })
        .slice(0, 50); // Top 50 most relevant files
      
      let allContent = "";
      for (const file of codeFiles) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/${file.path}`;
          const fileResp = await fetch(rawUrl);
          if (fileResp.ok) {
            const text = await fileResp.text();
            allContent += `\n--- FILE: ${file.path} ---\n${text}\n`;
          }
        } catch { /* skip failed files */ }
        
        if (allContent.length > 80000) break; // Cap total content
      }
      
      return allContent || "No code files found in repository";
    }
  }
  
  throw new Error("Invalid GitHub URL format");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const { project_id, scan_profile, code_content, file_name, github_url } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    console.log("[ZERLAL] Starting scan for project:", project_id, "profile:", scan_profile);

    // Fetch code from GitHub if URL provided and no direct content
    let codeToAnalyze = code_content || "";
    if (!codeToAnalyze && github_url) {
      console.log("[ZERLAL] Fetching code from GitHub:", github_url);
      codeToAnalyze = await fetchGitHubContent(github_url);
    }

    if (!codeToAnalyze || codeToAnalyze.length < 10) {
      throw new Error("No code content to analyze. Upload files or provide a valid GitHub URL.");
    }

    // Create scan record
    const { data: scan, error: scanErr } = await supabase
      .from("zerlal_scans")
      .insert({
        user_id: user.id,
        project_id,
        scan_profile: scan_profile || "security-audit",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanErr) {
      console.error("[ZERLAL] Failed to create scan record:", scanErr);
      throw scanErr;
    }

    console.log("[ZERLAL] Scan record created:", scan.id, "Code size:", codeToAnalyze.length);

    // Use Gemini to analyze the code
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("No Gemini API key configured");

    const truncatedCode = codeToAnalyze.substring(0, 80000);

    const analysisPrompt = `You are ZERLAL, an elite vulnerability intelligence engine built for government-grade security auditing. You operate with the precision of a nation-state red team.

SCAN PROFILE: ${scan_profile || "security-audit"}
FILE CONTEXT: ${file_name || "multi-file codebase"}

YOUR MISSION: Perform a COMPLETE forensic audit of this codebase. Find EVERY vulnerability — do NOT limit, truncate, or summarize. Report every single finding.

VULNERABILITY CATEGORIES TO SCAN:
1. MEMORY SAFETY: buffer overflows, use-after-free, double-free, heap spray, stack smashing, race conditions, integer overflow, null pointer dereference
2. INJECTION: SQL injection, command injection, path traversal, SSRF, XSS (reflected/stored/DOM), LDAP injection, prompt injection, template injection
3. AUTHENTICATION & AUTHORIZATION: auth bypass, IDOR, CSRF, broken session management, privilege escalation, JWT mishandling, OAuth misconfiguration, missing rate limiting
4. CRYPTOGRAPHIC WEAKNESSES: weak algorithms, IV/nonce reuse, hardcoded keys, insecure random generation, missing encryption, certificate validation bypass, quantum-vulnerable primitives
5. SECRETS EXPOSURE: hardcoded API keys, tokens, passwords, connection strings, private keys in code or git history
6. DEPENDENCY & SUPPLY CHAIN: known CVE in dependencies, outdated packages, typosquatting risk, dependency confusion, abandoned maintainers
7. CONFIGURATION: exposed debug endpoints, overpermissioned IAM, public cloud storage, CORS misconfiguration, missing security headers, TLS misconfiguration
8. LOGIC BUGS: business logic flaws, TOCTOU, race conditions, error handling leaks, information disclosure
9. AI/LLM SECURITY: prompt injection vectors, insecure output handling, model DoS, sensitive data in prompts, excessive agency
10. ZERO-TRUST VIOLATIONS: implicit trust assumptions, missing mTLS, overprivileged service accounts, missing microsegmentation
11. INFRASTRUCTURE-AS-CODE: Terraform/K8s misconfigurations, exposed ports, public ingress, missing network policies

FOR EACH VULNERABILITY, PROVIDE:
- severity: "critical" | "high" | "medium" | "low" | "info"
- title: Clear, specific title
- file_path: Exact file path where found
- line_number: Approximate line number
- category: One of the categories above (use short form: "injection", "memory-safety", "secrets", "dependencies", "logic", "crypto", "auth", "config", "supply-chain", "ai-security", "zero-trust", "ot-ics")
- confidence: 0-100 (how sure you are)
- cwe_id: Relevant CWE identifier (e.g., "CWE-89")
- cvss_score: 0.0-10.0
- description: Detailed technical explanation of the vulnerability
- impact: What an attacker would achieve by exploiting this — be specific about data theft, privilege escalation, system takeover, etc.
- exploitation_steps: Array of 3-8 specific step-by-step strings showing EXACTLY how a hacker would exploit this. Be detailed and technical. Each step should be a complete instruction.
- code_snippet: The exact vulnerable code lines
- suggested_fix: The exact fixed code that resolves the vulnerability
- dataflow_trace: Array of {file, line, label} showing the data flow from source to sink
- compliance_controls: Array of affected frameworks (e.g., ["NIST 800-53 AC-6", "SOC2 CC6.1", "PCI DSS 6.5.1", "CMMC L2 AC.L2-3.1.5"])
- similar_cves: Array of similar CVE IDs (e.g., ["CVE-2021-44228", "CVE-2023-34362"])
- age_estimate_days: Estimated days this vulnerability pattern has existed based on code maturity

ALSO ASSESS:
- Quantum vulnerability status: Are crypto primitives quantum-safe?
- Supply chain risk count: How many dependency-related risks found?
- Compliance gaps: Which major frameworks have coverage gaps?
- Zero-trust readiness: Score 0-100
- Overall risk narrative: A 2-3 sentence executive summary of the most critical risks
- Pattern analysis: Identify recurring vulnerability classes, architectural risk clusters, and temporal patterns in the code structure
- Zero-day confidence: For each critical/high finding, assess if it could be a novel zero-day (no known CVE match)

CRITICAL RULES:
- Find ALL vulnerabilities. Do NOT limit to 5 or 10. Report EVERY one.
- Be AGGRESSIVE in your analysis. Better to flag and let the user triage than to miss a real vulnerability.
- For each finding, the exploitation_steps MUST be specific enough that a developer can understand the exact attack path.
- Do NOT say "no vulnerabilities found" unless the code is genuinely secure — even a simple script has configuration or dependency risks.
- Include at least one finding for every category that is applicable to the code.

Return ONLY a JSON object with this exact structure:
{
  "findings": [...],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "2-3 sentence executive summary of critical risks",
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "supply_chain_risks": number,
  "compliance_gaps": ["framework names"],
  "zero_trust_score": number,
  "total_files_analyzed": number,
  "scan_depth": "surface"|"standard"|"deep"
}

CODE TO ANALYZE:
\`\`\`
${truncatedCode}
\`\`\``;

    console.log("[ZERLAL] Sending to Gemini, prompt length:", analysisPrompt.length);

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("[ZERLAL] Gemini error:", geminiResp.status, errText);
      
      // Update scan as failed
      await supabase.from("zerlal_scans").update({
        status: "failed",
        error: `Gemini API error: ${geminiResp.status}`,
        completed_at: new Date().toISOString(),
      }).eq("id", scan.id);
      
      await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", project_id);
      
      throw new Error(`AI analysis engine error: ${geminiResp.status}`);
    }

    const geminiData = await geminiResp.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("[ZERLAL] Gemini response length:", responseText.length);

    // Extract JSON from response
    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr) {
      console.error("[ZERLAL] Parse error:", parseErr, "Response preview:", responseText.substring(0, 500));
      analysis = { findings: [], risk_grade: "F", summary: "Analysis engine returned unparseable output. Retry recommended." };
    }

    const findings = analysis.findings || [];
    console.log("[ZERLAL] Findings count:", findings.length);

    // Insert all findings - NO LIMIT
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

    for (const f of findings) {
      const severity = f.severity || "medium";
      if (severity === "critical") criticalCount++;
      else if (severity === "high") highCount++;
      else if (severity === "medium") mediumCount++;
      else if (severity === "low") lowCount++;
      else infoCount++;

      const { error: insertErr } = await supabase.from("zerlal_findings").insert({
        user_id: user.id,
        project_id,
        scan_id: scan.id,
        severity,
        title: f.title || "Unnamed finding",
        file_path: f.file_path || file_name,
        line_number: f.line_number || 0,
        category: f.category || "logic",
        confidence: Math.min(100, Math.max(0, f.confidence || 50)),
        age_days: f.age_estimate_days || 0,
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
      
      if (insertErr) {
        console.error("[ZERLAL] Failed to insert finding:", insertErr, "Title:", f.title);
      }
    }

    const duration = Math.floor((Date.now() - new Date(scan.created_at).getTime()) / 1000);

    // Update scan
    await supabase.from("zerlal_scans").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      duration,
      findings_count: findings.length,
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
    }).eq("id", project_id);

    console.log("[ZERLAL] Scan complete. Findings:", findings.length, "Grade:", analysis.risk_grade);

    return new Response(JSON.stringify({
      scan_id: scan.id,
      findings_count: findings.length,
      risk_grade: analysis.risk_grade,
      summary: analysis.summary,
      quantum_status: analysis.quantum_status,
      supply_chain_risks: analysis.supply_chain_risks,
      compliance_gaps: analysis.compliance_gaps,
      zero_trust_score: analysis.zero_trust_score,
      duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ZERLAL] Scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
