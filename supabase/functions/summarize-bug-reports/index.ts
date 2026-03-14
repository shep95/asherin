import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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
    if (!user || user.email !== "ashernewtonx@gmail.com") {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are Aureon's internal QA analyst. Summarize bug reports and feature requests into actionable developer prompts. Group by priority, categorize by type (bug vs feature), and provide clear reproduction steps for bugs and implementation guidance for features. Be detailed, structured, and direct. Use markdown formatting.`
          },
          {
            role: "user",
            content: `Summarize these ${newReports.length} new reports (${bugs.length} bugs, ${features.length} features) into a developer-ready action plan:\n\n${reportText}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI summarization failed");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "Summary generation failed.";
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
