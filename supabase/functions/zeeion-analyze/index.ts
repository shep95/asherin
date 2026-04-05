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

    const { fileName, fileType, fileContent, currency, fiscalStart } = await req.json();
    if (!fileName || !fileContent) throw new Error("Missing file data");

    // Extract raw data preview for AI
    let dataPreview = "";
    if (fileType === "csv" || fileType === "json" || fileType === "xml") {
      dataPreview = fileContent.substring(0, 50000);
    } else {
      // For binary/base64 files, we describe what we received
      dataPreview = `[Binary file: ${fileName}, type: ${fileType}, size: ${fileContent.length} chars]`;
    }

    // Call AI for analysis
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI service not configured");

    const systemPrompt = `You are Zeeion, an elite Financial Intelligence AI. Analyze the uploaded financial data and produce a comprehensive analysis.

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
  "executiveSummary": "<3-4 paragraph executive summary>",
  "wastefulItems": [{"description":"...","annualCost":<number>,"recommendation":"...","severity":"high|medium|low"}],
  "savingsOpportunities": [{"category":"...","description":"...","currentCost":<number>,"projectedSavings":<number>,"confidence":<0-100>}],
  "departmentPerformance": [{"department":"...","totalSpending":<number>,"budget":<number>,"variance":<number>,"efficiencyScore":<0-100>}],
  "anomalies": [{"type":"...","severity":"high|medium|low","description":"...","recommendation":"..."}],
  "categoryBreakdown": [{"category":"...","amount":<number>,"percentage":<number>}]
}

If the data is insufficient, generate reasonable estimates based on what you can extract.
Currency: ${currency}. Fiscal year starts: ${fiscalStart}.
Be thorough, realistic, and actionable. Identify real patterns, not generic advice.`;

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this financial data from file "${fileName}":\n\n${dataPreview}` },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI analysis failed: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

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
      // Fallback with reasonable defaults
      analysis = {
        summary: {
          totalRecords: 0,
          totalSpending: 0,
          potentialSavings: 0,
          efficiencyScore: 50,
          anomalyCount: 0,
          wastefulSpending: 0,
          departmentCount: 0,
        },
        executiveSummary: "Unable to fully parse the uploaded data. Please ensure the file contains structured financial records (transactions, budgets, or expense reports) in a supported format.",
        wastefulItems: [],
        savingsOpportunities: [],
        departmentPerformance: [],
        anomalies: [],
        categoryBreakdown: [],
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
