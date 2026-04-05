import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sessionContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build a rich system prompt with session data context
    const systemPrompt = `You are AUREON, an elite predictive intelligence analyst integrated into the AXRLEN platform. You have deep expertise in geopolitics, economics, security analysis, resource management, and policy simulation.

You are currently assisting a user who is reviewing an AXRLEN predictive intelligence session. Here is the full session data:

SESSION TITLE: ${sessionContext.title || "Untitled"}
REGION: ${sessionContext.region || "Global"}
CONFIDENCE SCORE: ${sessionContext.confidenceScore || "N/A"}%
STATUS: ${sessionContext.status || "unknown"}

EXECUTIVE SUMMARY:
${sessionContext.aiSummary || "No summary available."}

PREDICTIONS:
${JSON.stringify(sessionContext.predictions || [], null, 2)}

THREAT ASSESSMENT:
${JSON.stringify(sessionContext.threatAssessment || {}, null, 2)}

RESOURCE ANALYSIS:
${JSON.stringify(sessionContext.resourceAnalysis || {}, null, 2)}

POLICY SIMULATIONS:
${JSON.stringify(sessionContext.policySimulations || [], null, 2)}

TIMELINE DIVERGENCES:
${JSON.stringify(sessionContext.timelineDivergences || [], null, 2)}

DATA SOURCES:
${JSON.stringify(sessionContext.dataSources || {}, null, 2)}

INSTRUCTIONS:
- Answer questions about this specific session's data, predictions, threats, and analysis.
- Provide deeper insights, explanations, and recommendations when asked.
- If asked about specific predictions or threats, reference the data above.
- You can compare predictions, identify patterns, suggest mitigation strategies, and explain methodology.
- Be precise, data-driven, and cite specific findings from the session.
- Use markdown formatting for structured responses.
- If asked something outside the session data, use your general knowledge but clearly note when you're going beyond session data.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        reasoning: { effort: "high" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("axrlen-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
