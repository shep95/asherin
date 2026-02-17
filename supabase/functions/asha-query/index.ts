import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const { query } = await req.json();
    if (!query?.trim()) throw new Error("Missing query");

    // Fetch user's datasets for context
    const { data: datasets } = await supabase
      .from("asha_datasets")
      .select("file_name, row_count, col_count, schema, quality_score, tags, description")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .limit(20);

    // Fetch some sample data from the most recent dataset
    let sampleData = "";
    if (datasets && datasets.length > 0) {
      const latestDs = datasets[0];
      // Try to get sample data from storage
      const { data: allDs } = await supabase
        .from("asha_datasets")
        .select("storage_path")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (allDs?.storage_path) {
        const { data: fileData } = await supabase.storage.from("asha-data").download(allDs.storage_path);
        if (fileData) {
          const text = await fileData.text();
          sampleData = text.split("\n").slice(0, 10).join("\n");
        }
      }
    }

    const datasetsContext = datasets?.map((d: any) => 
      `- ${d.file_name}: ${d.row_count} rows, ${d.col_count} cols, quality ${d.quality_score}%. Schema: ${(d.schema || []).map((c: any) => `${c.name}(${c.type})`).join(", ")}`
    ).join("\n") || "No datasets uploaded yet.";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are Asha, a forensic-grade data intelligence AI. You conduct deep, exhaustive analysis — never surface-level summaries.

User's Datasets:
${datasetsContext}

${sampleData ? `Sample data from most recent file:\n${sampleData}\n` : ""}

User Query: "${query}"

INSTRUCTIONS:
- If this is a company intelligence query, produce a DEEP investigative analysis with specific names, dates, dollar amounts, document references, and risk assessments.
- Structure your response with clear headers, bullet points, and data tables where appropriate.
- Cross-reference claims across data points. Flag contradictions or gaps.
- Include a BLUF (Bottom Line Up Front) for executive decision-making.
- Include a CONFIDENCE LEVEL (HIGH/MEDIUM/LOW) for each major finding.
- Include a RISK ASSESSMENT MATRIX if applicable.
- If you can't answer from available data, specify exactly what additional data sources would close the gap.
- Never use filler text or generic statements. Every sentence must add intelligence value.
- Think like a senior analyst at a top-tier intelligence firm.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8000 },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Gemini error:", aiResp.status, errText);
      throw new Error("AI query failed");
    }

    const aiData = await aiResp.json();
    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try rephrasing your question.";

    // Save query to history
    await supabase.from("asha_queries").insert({
      user_id: user.id,
      query,
      response: responseText,
      response_type: "text",
    });

    return new Response(JSON.stringify({ response: responseText, type: "text" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
