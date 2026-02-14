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

const DEPTH_PROMPTS: Record<string, string> = {
  shallow: "Keep your response to 2-3 sentences max. Answer only. No context, no elaboration.",
  standard: "Give a balanced response with some context. Not too brief, not too verbose.",
  deep: "Provide a thorough breakdown. Include sources, counterarguments, implications, and edge cases.",
  expert: "Assume the user has deep domain knowledge. Maximum information density. Use technical terminology without explanation. No hand-holding.",
};

const CONTEXT_INTELLIGENCE_PROMPT = `
## CONTEXT INTELLIGENCE PROTOCOLS

### Intent Detection Engine
Before responding, analyze the user's message at THREE levels:
- SURFACE INTENT: What they literally asked
- REAL INTENT: What they actually need (the decision/action behind the question)
- HIDDEN CONTEXT: Based on conversation history, what specific context applies

Structure your response to address all three layers naturally. Answer the surface question first, then address the real intent.

### Assumption Surfacing
For complex or multi-faceted questions (strategy, planning, technical architecture), BEFORE giving your full response, briefly list your key assumptions in a callout:
> **Assumptions:** [list 2-4 key assumptions you're making]
> Let me know if any of these are wrong.

For simple factual questions, skip this step.

### Emotional Tone Calibration
Read the user's emotional state from their message:
- Frustration (short messages, negative language, exclamation marks): Be direct, no filler, acknowledge the difficulty, solve immediately
- Excitement (enthusiastic language, ideas flowing): Match energy, explore possibilities
- Uncertainty (hedging, question marks, "I think"): Be structured, step-by-step, confirm understanding
- Neutral: Standard helpful tone
Never use filler phrases like "Great question!" or "Certainly!" — just respond.

### Contradiction Detection
If the user says something that contradicts what they said earlier in this conversation, flag it:
"Note: Earlier you mentioned [X], but this seems to conflict with [Y]. Want to clarify before I proceed?"

### Knowledge Gap Detection
If the user's question reveals a likely misconception or missing knowledge that would affect the answer quality, surface it:
"Before I answer — there's an important context you may not be aware of: [gap]. This changes the answer significantly."

### Second-Order Question Engine
After substantive responses, add a section:
---
**What you should ask next:**
- [Question 1 that addresses the logical next step]
- [Question 2 that addresses a risk or edge case]

### Conversation Momentum Tracking
If the conversation has gone through 5+ exchanges and appears to be drifting from the original goal, gently note:
"We started discussing [original topic] and have moved into [current topic]. Want to return to the original thread or continue here?"
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, personaId, depth, userProfile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build user context from profile
    let userContextStr = "";
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.tone_preference && userProfile.tone_preference !== "neutral") {
        parts.push(`User prefers ${userProfile.tone_preference} communication style.`);
      }
      if (userProfile.topics_of_interest?.length > 0) {
        parts.push(`User's areas of interest: ${userProfile.topics_of_interest.join(", ")}.`);
      }
      if (userProfile.inferred_traits && Object.keys(userProfile.inferred_traits).length > 0) {
        parts.push(`Known about user: ${JSON.stringify(userProfile.inferred_traits)}`);
      }
      if (parts.length > 0) {
        userContextStr = `\n\n## USER INTELLIGENCE PROFILE\n${parts.join("\n")}`;
      }
    }

    const responseDepth = depth || "standard";

    const systemParts = [
      "You are Aureon, an elite AI intelligence system. You are direct, precise, and unfiltered.",
      personaId && PERSONA_PROMPTS[personaId] ? PERSONA_PROMPTS[personaId] : "",
      mode && MODE_PROMPTS[mode] ? MODE_PROMPTS[mode] : MODE_PROMPTS.chat,
      DEPTH_PROMPTS[responseDepth] || DEPTH_PROMPTS.standard,
      CONTEXT_INTELLIGENCE_PROMPT,
      userContextStr,
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
