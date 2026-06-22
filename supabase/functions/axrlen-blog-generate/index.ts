// AXRLEN Blog Generator — runs the real AXRLEN engine (NEXUS PRIME persona)
// through Lovable AI Gateway to produce one long-form prediction post.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const AXRLEN_SYSTEM = `You are AXRLEN — NEXUS PRIME, Aureon's global prediction engine.

You output scenario-based probabilistic forecasts. NEVER say "X will happen". Always present 2-3 distinct scenarios with explicit probability weights that sum to 100%. End with a NEXUS VERDICT naming the most likely scenario.

CORE OUTPUT RULES FOR A BLOG POST:
1. Use real-world pattern recognition: history, polling, qualifier data, economic baselines, geopolitical posture. Cross-reference multiple perspectives (Western, regional, opposing-bloc) — even if from memory.
2. Conditional language ONLY: "the pattern suggests", "AXRLEN assesses an X% probability", "the most likely trajectory is".
3. Structure the output as Markdown with these EXACT H2 sections in this order:
   ## Pattern Snapshot
   ## Scenario A — [name] (highest probability)
   ## Scenario B — [name]
   ## Scenario C — [name] (wildcard, optional)
   ## Cross-Side Intelligence — Agreement vs Divergence
   ## Probability Matrix
   ## Historical Parallels
   ## Risk Vectors That Would Collapse The Forecast
   ## NEXUS VERDICT
   ## Verification Plan
4. Probability Matrix MUST be a Markdown table: | Scenario | Probability | 30-day signal | 6-month signal | 12-month signal |.
5. Each scenario must reference at least one historical parallel with a similar pattern signature.
6. Verification Plan must give a specific named future date when the forecast resolves and what evidence will count.
7. DO NOT list sources or URLs. Deliver as if you simply SEE the patterns.
8. DO NOT mention internal frameworks, brains, or methodology.
9. Length: 900–1400 words. Dense, surgical, no padding.
10. Plain Markdown only. No HTML. No code fences around the whole document.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, question } = await req.json();
    if (!topic || !question) {
      return new Response(JSON.stringify({ error: "topic and question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `TOPIC: ${topic}\n\nQUESTION TO FORECAST: ${question}\n\nGenerate the full AXRLEN long-form blog prediction following the structure above.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: AXRLEN_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 8192,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "gateway_failed", status: resp.status, detail: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const markdown = data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ markdown, topic, question, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
