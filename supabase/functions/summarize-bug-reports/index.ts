import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { isStaffEmail } from "../_shared/identityHash.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user || !isStaffEmail(user.email)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get the last summary's report_ids to find unread reports
    const { data: lastSummary } = await supabase
      .from("bug_report_summaries")
      .select("report_ids")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const previousIds: string[] = lastSummary?.report_ids || [];

    // Get all unsummarized reports
    const { data: reports } = await supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ summary: "No reports to summarize.", reportIds: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newReports = reports.filter((r: any) => !previousIds.includes(r.id));
    if (newReports.length === 0) {
      return new Response(JSON.stringify({ summary: "No new reports since last summary.", reportIds: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bugs = newReports.filter((r: any) => r.type === "bug");
    const features = newReports.filter((r: any) => r.type === "feature");

    const reportText = newReports.map((r: any) =>
      `[${r.type.toUpperCase()}] (${r.severity}) "${r.title}": ${r.description} — Status: ${r.status} — ${new Date(r.created_at).toLocaleDateString()}`
    ).join("\n");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `You are Aureon's internal QA analyst. Summarize bug reports and feature requests into actionable developer prompts. Group by priority, categorize by type (bug vs feature), and provide clear reproduction steps for bugs and implementation guidance for features. Be detailed, structured, and direct. Use markdown formatting.` }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `Summarize these ${newReports.length} new reports (${bugs.length} bugs, ${features.length} features) into a developer-ready action plan:\n\n${reportText}` }],
          }
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI summarization failed");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim() || "Summary generation failed.";
    const reportIds = newReports.map((r: any) => r.id);

    // Save summary session
    await supabase.from("bug_report_summaries").insert({
      summary,
      report_ids: reportIds,
      bug_count: bugs.length,
      feature_count: features.length,
    });

    return new Response(JSON.stringify({ summary, reportIds, bugCount: bugs.length, featureCount: features.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-bug-reports error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
