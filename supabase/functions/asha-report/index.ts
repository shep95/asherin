import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const user = { id: claimsData.claims.sub as string };

    const { reportId } = await req.json();
    if (!reportId) throw new Error("Missing reportId");

    // Get report
    const { data: report, error: rErr } = await supabase
      .from("asha_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (rErr || !report) throw new Error("Report not found");

    // Get datasets for context — scoped to session if report has session_id
    let dsQuery = supabase
      .from("asha_datasets")
      .select("file_name, row_count, col_count, schema, quality_score, issues")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .limit(10);
    if (report.session_id) dsQuery = dsQuery.eq("session_id", report.session_id);
    const { data: datasets } = await dsQuery;

    // Get insights — scoped to session
    let insQuery = supabase
      .from("asha_insights")
      .select("type, title, description")
      .eq("user_id", user.id)
      .eq("dismissed", false)
      .limit(10);
    if (report.session_id) insQuery = insQuery.eq("session_id", report.session_id);
    const { data: insights } = await insQuery;

    const datasetsContext = datasets?.map((d: any) =>
      `${d.file_name}: ${d.row_count} rows, ${d.col_count} cols, quality ${d.quality_score}%`
    ).join("\n") || "No datasets.";

    const insightsContext = insights?.map((i: any) => `[${i.type}] ${i.title}: ${i.description}`).join("\n") || "No insights.";

    const typePrompts: Record<string, string> = {
      executive: "Write a professional executive summary report with key metrics, trends, and recommendations.",
      audit: "Write a data quality audit report covering completeness, accuracy, consistency, and recommendations.",
      analysis: "Write a detailed analysis report with findings, methodology, and actionable insights.",
      comparison: "Write a comparison report analyzing differences, trends, and benchmarks.",
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are Azplen, a data intelligence AI. ${typePrompts[report.type] || typePrompts.executive}

Report Title: "${report.name}"

Available Datasets:
${datasetsContext}

Active Insights:
${insightsContext}

Generate a comprehensive, professional report in Markdown format. Include sections with headers, bullet points, and data-driven conclusions. Make it 4-8 pages worth of content.` }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 4000 },
      }),
    });

    if (!aiResp.ok) throw new Error("AI report generation failed");

    const aiData = await aiResp.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Report generation failed.";
    const pages = Math.max(1, Math.round(content.length / 3000));

    await supabase
      .from("asha_reports")
      .update({ status: "ready", content, pages })
      .eq("id", reportId);

    return new Response(JSON.stringify({ success: true, pages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
