import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { project_id, scan_profile, code_content, file_name } = await req.json();
    if (!project_id) throw new Error("project_id is required");

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

    if (scanErr) throw scanErr;

    // Use Gemini to analyze the code
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY_APP") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("No Gemini API key configured");

    const codeToAnalyze = code_content || "No code content provided";
    const truncatedCode = codeToAnalyze.substring(0, 60000);

    const analysisPrompt = `You are ZERLAL, an elite vulnerability intelligence engine. Analyze this codebase for security vulnerabilities.

SCAN PROFILE: ${scan_profile || "security-audit"}
FILE: ${file_name || "unknown"}

ANALYSIS REQUIREMENTS:
1. Find ALL vulnerabilities - do NOT limit or cut off. Report every single one.
2. For each vulnerability provide:
   - severity: "critical", "high", "medium", "low", or "info"
   - title: Clear description
   - file_path: File where found
   - line_number: Approximate line
   - category: "injection", "memory-safety", "secrets", "dependencies", "logic", "crypto", "auth", "config", "supply-chain", "ai-security", "zero-trust", "ot-ics"
   - confidence: 0-100
   - cwe_id: CWE identifier
   - cvss_score: 0.0-10.0
   - description: Detailed explanation
   - impact: What an attacker would do
   - exploitation_steps: Array of step-by-step strings showing EXACTLY how a hacker would exploit this
   - code_snippet: The vulnerable code
   - suggested_fix: The fixed code
   - dataflow_trace: Array of {file, line, label} showing data flow
   - compliance_controls: Array of compliance frameworks affected (CMMC, NIST, SOC2, PCI DSS, HIPAA, FedRAMP, ISO27001, DORA, NIS2)
   - similar_cves: Array of similar CVE IDs
   - age_estimate_days: How long this vulnerability pattern has likely existed based on code patterns

3. Also assess:
   - Quantum vulnerability (are crypto primitives quantum-safe?)
   - Supply chain risks (dependency issues)
   - Zero-trust gaps
   - AI/LLM security issues if applicable
   - Secrets exposure

Return ONLY a JSON object with this exact structure:
{
  "findings": [...],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "brief summary",
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "supply_chain_risks": number,
  "compliance_gaps": ["framework names"]
}

CODE TO ANALYZE:
\`\`\`
${truncatedCode}
\`\`\``;

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
      console.error("Gemini error:", errText);
      throw new Error(`Gemini API error: ${geminiResp.status}`);
    }

    const geminiData = await geminiResp.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
      console.error("Parse error:", parseErr, "Response:", responseText.substring(0, 500));
      analysis = { findings: [], risk_grade: "F", summary: "Analysis failed to parse" };
    }

    const findings = analysis.findings || [];

    // Insert all findings - NO LIMIT
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

    for (const f of findings) {
      const severity = f.severity || "medium";
      if (severity === "critical") criticalCount++;
      else if (severity === "high") highCount++;
      else if (severity === "medium") mediumCount++;
      else if (severity === "low") lowCount++;
      else infoCount++;

      await supabase.from("zerlal_findings").insert({
        user_id: user.id,
        project_id,
        scan_id: scan.id,
        severity,
        title: f.title || "Unnamed finding",
        file_path: f.file_path || file_name,
        line_number: f.line_number || 0,
        category: f.category || "logic",
        confidence: f.confidence || 50,
        age_days: f.age_estimate_days || 0,
        first_seen_at: new Date().toISOString(),
        status: "open",
        cwe_id: f.cwe_id || "",
        cvss_score: f.cvss_score || 0,
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

    // Update scan
    await supabase.from("zerlal_scans").update({
      status: "complete",
      completed_at: new Date().toISOString(),
      duration: Math.floor((Date.now() - new Date(scan.created_at).getTime()) / 1000),
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

    return new Response(JSON.stringify({
      scan_id: scan.id,
      findings_count: findings.length,
      risk_grade: analysis.risk_grade,
      summary: analysis.summary,
      quantum_status: analysis.quantum_status,
      supply_chain_risks: analysis.supply_chain_risks,
      compliance_gaps: analysis.compliance_gaps,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Zerlal scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
