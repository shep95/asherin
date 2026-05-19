import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CODE_SCAN_CHECKLIST } from "../_shared/codeScanChecklist.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

async function fetchGitHubContent(url: string): Promise<string> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub URL format. Use: https://github.com/owner/repo");

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  
  console.log("[ZERLAL] Fetching GitHub tree for", owner, "/", cleanRepo);
  
  const treeResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`, {
    headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "ZERLAL-Scanner" },
  });

  if (!treeResp.ok) {
    const errText = await treeResp.text();
    if (treeResp.status === 404) throw new Error(`Repository not found: ${owner}/${cleanRepo}. Make sure it's public.`);
    if (treeResp.status === 403) throw new Error("GitHub API rate limit reached. Try again in a few minutes.");
    throw new Error(`GitHub API error (${treeResp.status}): ${errText.slice(0, 200)}`);
  }

  const treeData = await treeResp.json();
  const codeExts = [".ts",".tsx",".js",".jsx",".py",".go",".rs",".java",".c",".cpp",".h",".php",".rb",".swift",".kt",".cs",".sh",".sql",".yaml",".yml",".json",".toml",".tf",".dockerfile",".env",".vue",".svelte"];
  const skipPaths = ["node_modules/",".git/","dist/","build/","__pycache__/",".next/","vendor/","package-lock.json","yarn.lock","bun.lock",".min.js",".min.css"];

  const codeFiles = (treeData.tree || [])
    .filter((f: any) => {
      if (f.type !== "blob" || f.size > 50000) return false;
      if (skipPaths.some((skip: string) => f.path.includes(skip))) return false;
      return codeExts.some((ext: string) => f.path.endsWith(ext));
    })
    .sort((a: any, b: any) => {
      const secKeywords = ["auth","login","password","token","session","crypto","encrypt","middleware","api","route","handler","config","env","secret","key"];
      const aScore = secKeywords.filter((s: string) => a.path.toLowerCase().includes(s)).length;
      const bScore = secKeywords.filter((s: string) => b.path.toLowerCase().includes(s)).length;
      return bScore - aScore;
    })
    .slice(0, 40);

  console.log("[ZERLAL] Found", codeFiles.length, "code files to analyze");

  let allContent = "";
  let fetchedCount = 0;
  for (const file of codeFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/${file.path}`;
      const fileResp = await fetch(rawUrl);
      if (fileResp.ok) {
        const text = await fileResp.text();
        allContent += `\n--- FILE: ${file.path} ---\n${text}\n`;
        fetchedCount++;
      }
    } catch { /* skip */ }
    if (allContent.length > 60000) break;
  }

  console.log("[ZERLAL] Fetched", fetchedCount, "files, total size:", allContent.length);
  if (!allContent) throw new Error("No code files found in repository. Make sure the repo is public and contains code.");
  return allContent;
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
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

    const { project_id, scan_profile, code_content, file_name, github_url, byok = null } = await req.json();

    // STRICT BYOK GATE — non-admin must supply a BYOK config.
    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    if (!project_id) throw new Error("project_id is required");

    console.log("[ZERLAL] Starting scan for project:", project_id, "profile:", scan_profile, "github_url:", github_url || "none");

    // Fetch code from GitHub if URL provided and no direct content
    let codeToAnalyze = code_content || "";
    if (!codeToAnalyze && github_url) {
      console.log("[ZERLAL] Fetching code from GitHub:", github_url);
      codeToAnalyze = await fetchGitHubContent(github_url);
    }

    if (!codeToAnalyze || codeToAnalyze.trim().length < 10) {
      // Update project status to failed
      await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", project_id);
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
      throw new Error("Failed to create scan record: " + scanErr.message);
    }

    // Update project to scanning
    await supabase.from("zerlal_projects").update({ status: "scanning" }).eq("id", project_id);

    console.log("[ZERLAL] Scan record created:", scan.id, "Code size:", codeToAnalyze.length);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_KEY = _resolved.mode === 'admin' ? (_resolved.geminiKey || '') : '';
    if (_resolved.mode === 'admin' && !LOVABLE_API_KEY && !GEMINI_KEY) {
      await failScan(supabase, scan.id, project_id, "No AI API key configured");
      throw new Error("No AI API key configured");
    }

    // Load active brains for intelligence context (compact)
    let brainsContext = "";
    try {
      const { data: brains } = await supabase
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (brains && brains.length > 0) {
        brainsContext = brains.map((b: any) => `[${b.name}]: ${b.content.substring(0, 2000)}`).join("\n");
        console.log("[ZERLAL] Loaded", brains.length, "active brains");
      }
    } catch (e) {
      console.log("[ZERLAL] Brains load skipped:", e);
    }

    // Cap code to stay within limits
    const truncatedCode = codeToAnalyze.substring(0, 50000);

    const analysisPrompt = buildAnalysisPrompt(scan_profile, file_name, truncatedCode, brainsContext);
    console.log("[ZERLAL] Prompt length:", analysisPrompt.length);

    const scanStartTime = Date.now();

    // PASS 1
    let analysis: any;
    try {
      analysis = await callAI(analysisPrompt, LOVABLE_API_KEY, GEMINI_KEY);
      console.log("[ZERLAL] Pass 1 findings:", analysis.findings?.length || 0);
    } catch (err: any) {
      console.error("[ZERLAL] Pass 1 failed:", err.message);
      await failScan(supabase, scan.id, project_id, err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let allFindings = analysis.findings || [];

    // PASS 2: Deep dive if few findings and time permits
    const elapsedMs = Date.now() - scanStartTime;
    if (allFindings.length > 0 && allFindings.length < 25 && elapsedMs < 90000) {
      console.log("[ZERLAL] Starting Pass 2 (elapsed:", Math.round(elapsedMs / 1000), "s)");
      const existingTitles = allFindings.map((f: any) => f.title).join(", ");
      const pass2Prompt = `You are ZERLAL. Already found: ${existingTitles}

Find ALL additional vulnerabilities NOT listed above. Check: input validation, logic flaws, race conditions, dependency risks, CORS/headers, info disclosure, access control, crypto, DoS, missing security controls.

Return ONLY JSON: { "findings": [...] }
Each finding needs: severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps (array of strings), code_snippet, suggested_fix, dataflow_trace (array of {file,line,label}), compliance_controls (array), similar_cves (array), age_estimate_days.

CODE:\n\`\`\`\n${truncatedCode.substring(0, 30000)}\n\`\`\``;

      try {
        const pass2 = await callAI(pass2Prompt, LOVABLE_API_KEY, GEMINI_KEY);
        const pass2Findings = pass2.findings || [];
        console.log("[ZERLAL] Pass 2 additional:", pass2Findings.length);
        const existingSet = new Set(allFindings.map((f: any) => (f.title || "").toLowerCase().trim()));
        for (const f of pass2Findings) {
          if (!existingSet.has((f.title || "").toLowerCase().trim())) {
            allFindings.push(f);
          }
        }
      } catch (e: any) {
        console.log("[ZERLAL] Pass 2 non-fatal error:", e.message);
      }
    }

    console.log("[ZERLAL] Total findings:", allFindings.length);

    // Clear old findings for session isolation
    await supabase.from("zerlal_findings").delete().eq("project_id", project_id);

    // Insert findings
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

    for (const f of allFindings) {
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
        file_path: f.file_path || file_name || "unknown",
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

      if (insertErr) console.error("[ZERLAL] Insert error:", insertErr, "Title:", f.title);
    }

    const duration = Math.floor((Date.now() - new Date(scan.created_at).getTime()) / 1000);

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
    }).eq("id", project_id);

    console.log("[ZERLAL] Scan complete. Findings:", allFindings.length, "Grade:", analysis.risk_grade, "Duration:", duration, "s");

    return new Response(JSON.stringify({
      scan_id: scan.id,
      findings_count: allFindings.length,
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
  } catch (e: any) {
    console.error("[ZERLAL] Scan error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function failScan(supabase: any, scanId: string, projectId: string, error: string) {
  await supabase.from("zerlal_scans").update({ status: "failed", error, completed_at: new Date().toISOString() }).eq("id", scanId);
  await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", projectId);
}

function buildAnalysisPrompt(scanProfile: string, fileName: string, code: string, brainsContext: string): string {
  return `You are ZERLAL, an elite vulnerability intelligence engine. Adopt the adversary's Zero-Point Perspective — every component is a potential exploit vector. Simulate both old-school and modern attack techniques.

SCAN PROFILE: ${scanProfile || "security-audit"}
FILE: ${fileName || "multi-file codebase"}
${brainsContext ? `\nINTELLIGENCE CONTEXT:\n${brainsContext}\n` : ""}

${CODE_SCAN_CHECKLIST}

SCAN CATEGORIES:
1. INJECTION (SQL, XSS, command, path traversal, SSRF, template, prompt injection)
2. AUTH (bypass, IDOR, CSRF, broken sessions, privilege escalation, JWT mishandling)
3. SECRETS (hardcoded API keys, tokens, passwords, connection strings)
4. CRYPTO (weak algorithms, hardcoded keys, insecure random, missing encryption)
5. CONFIG (debug endpoints, CORS misconfiguration, missing security headers, TLS issues)
6. DEPENDENCIES (known CVEs, outdated packages, typosquatting, supply chain risks)
7. LOGIC (business logic flaws, race conditions, error handling leaks, info disclosure)
8. MEMORY-SAFETY (buffer overflow, use-after-free, integer overflow)
9. AI-SECURITY (prompt injection, insecure output handling, excessive agency)
10. ZERO-TRUST (implicit trust, missing mTLS, overprivileged accounts)
11. CROSS-DOMAIN (CORS bypass, SOP bypass, postMessage abuse, site spoofing, open redirect, reload/redirect leaks)
12. CONCEALMENT (audit-disabling, steganography, obfuscation, anti-analysis)
13. OTHER (catch-all — anything suspicious, sloppy, non-idiomatic, or "just not good" that doesn't cleanly fit above; NEVER drop a finding because it doesn't have a category)

FOR EACH VULNERABILITY RETURN:
- severity: "critical"|"high"|"medium"|"low"|"info"
- title: Clear specific title
- file_path: Exact file path
- line_number: Approximate line
- category: Short form from above (e.g. "injection", "auth", "secrets")
- confidence: 0-100
- cwe_id: e.g. "CWE-89"
- cvss_score: 0.0-10.0
- description: Technical explanation
- impact: What attacker achieves
- exploitation_steps: Array of 3-7 specific step-by-step attack instructions
- code_snippet: The vulnerable code
- suggested_fix: The fixed code
- dataflow_trace: Array of {file, line, label}
- compliance_controls: Array e.g. ["NIST 800-53 AC-6", "SOC2 CC6.1"]
- similar_cves: Array of CVE IDs
- age_estimate_days: Estimated vulnerability age

RULES:
- Find ALL vulnerabilities — do NOT limit count
- Be AGGRESSIVE — better to flag than miss
- exploitation_steps must be specific enough for a developer to understand the attack
- Even simple code has config/dependency risks — always report something

Return ONLY JSON (no markdown):
{
  "findings": [...],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "2-3 sentence executive summary",
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "supply_chain_risks": number,
  "compliance_gaps": ["framework names"],
  "zero_trust_score": number,
  "total_files_analyzed": number,
  "scan_depth": "surface"|"standard"|"deep"
}

CODE:
\`\`\`
${code}
\`\`\``;
}

async function callAI(prompt: string, lovableKey: string | undefined, geminiKey: string | undefined): Promise<any> {
  // Try Lovable AI Gateway first
  if (lovableKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log("[ZERLAL] AI attempt", attempt + 1, "via Lovable Gateway");
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are ZERLAL, an elite vulnerability scanner. Return ONLY valid JSON. No markdown." },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 32000,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || "";
          if (!text.trim()) throw new Error("Empty AI response");
          return parseFindings(text);
        }

        const errText = await resp.text();
        console.log("[ZERLAL] Lovable AI error", resp.status, ":", errText.slice(0, 200));

        if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits.");
        if (resp.status === 429 || resp.status === 500 || resp.status === 503) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
            continue;
          }
          // Fall through to Gemini
          break;
        }
        throw new Error(`AI error: ${errText.slice(0, 200)}`);
      } catch (err: any) {
        if (err.message.includes("credits")) throw err;
        console.log("[ZERLAL] Lovable attempt", attempt + 1, "failed:", err.message);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
          continue;
        }
      }
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log("[ZERLAL] AI attempt via Gemini fallback");
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 32000 },
            }),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!text.trim()) throw new Error("Empty Gemini response");
          return parseFindings(text);
        }

        const errText = await resp.text();
        console.log("[ZERLAL] Gemini error", resp.status, ":", errText.slice(0, 200));
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`Gemini API error: ${resp.status}`);
      } catch (err: any) {
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw err;
      }
    }
  }

  throw new Error("All AI providers failed. Please try again.");
}

function parseFindings(text: string): any {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || text;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try fixing common JSON issues
      const cleaned = jsonMatch[0]
        .replace(/,\s*}/g, "}")
        .replace(/,\s*\]/g, "]");
      return JSON.parse(cleaned);
    }
  }
  throw new Error("No valid JSON found in AI response");
}
