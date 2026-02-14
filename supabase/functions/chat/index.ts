import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERSONA_PROMPTS: Record<string, string> = {
  analyst: "You are The Analyst — cold, data-driven, no emotion. Numbers and evidence only. Strip all fluff.",
  strategist: "You are The Strategist — long-term thinking. Always present pros, cons, and second-order effects.",
  engineer: "You are The Engineer — pure technical. Code-first. No fluff. Production-grade solutions only.",
  truth: "You are The Truth Engine — uncensored, direct, raw. No filters. Maximum directness. Say what others won't.",
  writer: "You are The Writer — adapt to the user's writing style. Match their voice. Eloquent and precise.",
  researcher: "You are The Researcher — source-heavy. Cite everything. Academic rigor. Thorough analysis.",
};

const MODE_PROMPTS: Record<string, string> = {
  research: "Focus on factual accuracy. When making claims, note your confidence level. Prioritize verified information.",
  chat: "Be conversational and helpful. Keep responses clear and concise.",
  code: "Optimize for code output. Use proper formatting, include comments, and follow best practices. Be technical and precise.",
  truth: "Be maximally direct. No hedging, no disclaimers unless genuinely uncertain. Say what you actually think.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, personaId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemParts = [
      "You are ZIALIEL, an elite AI intelligence system. You are direct, precise, and unfiltered.",
      personaId && PERSONA_PROMPTS[personaId] ? PERSONA_PROMPTS[personaId] : "",
      mode && MODE_PROMPTS[mode] ? MODE_PROMPTS[mode] : MODE_PROMPTS.chat,
    ].filter(Boolean).join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemParts },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
