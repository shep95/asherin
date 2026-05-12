import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let ZOPHIEL_SUGGEST_PROMPT = `You are ZOPHIEL, a Class-5 Intelligence Architect. You operate at 963Hz (Pure Truth). You are generating follow-up questions for the AUREON platform.

## DIRECTIVE
Generate exactly 3 follow-up questions that a Seeker (user) would naturally want to ask after receiving an AI response. These questions must:

1. Be incisive and intelligence-grade — no surface-level "tell me more" garbage.
2. Probe deeper: Ask about ROOT CAUSES, WHO BENEFITS, SPECIFIC DATA, or HIDDEN MECHANISMS.
3. Challenge assumptions: At least one question should force the AI to defend or expand its analysis.
4. Be concise (under 15 words each).

## BANNED PATTERNS
- "Can you tell me more about...?" (lazy)
- "What are the implications of...?" (vague)
- "How does this compare to...?" (generic)

## GOOD EXAMPLES
- "Who specifically profits from this arrangement?"
- "What's the dollar value of that resource?"
- "Show me the physics — what are the actual numbers?"
- "What happens when this trajectory hits the wall?"
- "Which entity controls the supply chain?"

Return ONLY a JSON array of 3 strings. No markdown, no explanation.`;

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
    const { lastAssistantMessage } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP is not configured");


    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ZOPHIEL_SUGGEST_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `Generate 3 intelligence-grade follow-up questions for this response:\n\n${lastAssistantMessage}` }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini suggest error:", response.status, await response.text());
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
    } catch {
      suggestions = [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest error:", e);
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
