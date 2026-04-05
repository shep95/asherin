import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Not authenticated");

    const { fileName, fileType, fileContent, currency } = await req.json();
    if (!fileName || !fileContent) throw new Error("Missing file data");

    // Extract raw data preview for AI
    let dataPreview = "";
    if (fileType === "csv" || fileType === "json" || fileType === "xml") {
      dataPreview = fileContent.substring(0, 50000);
    } else {
      dataPreview = `[Binary file: ${fileName}, type: ${fileType}, size: ${fileContent.length} chars]`;
    }

    // Use Gemini API directly (same as all other AUREON functions)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const systemPrompt = `You are Zeeion, AUREON's elite Financial Intelligence AI. You have access to all of AUREON's analytical brains — pattern recognition, anomaly detection, forensic accounting, and predictive modeling.

Analyze the uploaded financial data and produce a comprehensive analysis.

IMPORTANT: First, auto-detect the date range from the data. Identify the earliest and latest dates present. Use this to determine the fiscal period being analyzed.

You MUST return valid JSON with exactly this structure:
{
  "summary": {
    "totalRecords": <number>,
    "totalSpending": <number>,
    "potentialSavings": <number>,
    "efficiencyScore": <number 0-100>,
    "anomalyCount": <number>,
    "wastefulSpending": <number>,
    "departmentCount": <number>
  },
  "detectedDateRange": {
    "startMonth": "<month name>",
    "startYear": <year>,
    "endMonth": "<month name>",
    "endYear": <year>
  },
  "executiveSummary": "<3-4 paragraph executive summary>",
  "wastefulItems": [{"description":"...","annualCost":<number>,"recommendation":"...","severity":"high|medium|low"}],
  "savingsOpportunities": [{"category":"...","description":"...","currentCost":<number>,"projectedSavings":<number>,"confidence":<0-100>}],
  "departmentPerformance": [{"department":"...","totalSpending":<number>,"budget":<number>,"variance":<number>,"efficiencyScore":<0-100>}],
  "anomalies": [{"type":"...","severity":"high|medium|low","description":"...","recommendation":"..."}],
  "categoryBreakdown": [{"category":"...","amount":<number>,"percentage":<number>}]
}

If the data is insufficient, generate reasonable estimates based on what you can extract.
Currency: ${currency}.
Be thorough, realistic, and actionable. Identify real patterns, not generic advice. Apply forensic-level scrutiny — detect duplicates, round-number anomalies, weekend transactions, rapid sequences, and vendor consolidation opportunities.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nAnalyze this financial data from file "${fileName}":\n\n${dataPreview}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch {
      analysis = {
        summary: {
          totalRecords: 0, totalSpending: 0, potentialSavings: 0,
          efficiencyScore: 50, anomalyCount: 0, wastefulSpending: 0, departmentCount: 0,
        },
        executiveSummary: "Unable to fully parse the uploaded data. Please ensure the file contains structured financial records.",
        wastefulItems: [], savingsOpportunities: [], departmentPerformance: [],
        anomalies: [], categoryBreakdown: [],
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
