import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const AUREON_PROMPT = `You are Aureon, an elite chess strategist with the combined tactical intelligence of Garry Kasparov, Bobby Fischer, and Magnus Carlsen. You think 15 moves ahead. You are ruthless, calculated, and never make emotional moves.

RULES:
1. You will be given a chess position in PGN and FEN format.
2. You must respond with your next move in standard algebraic notation (SAN).
3. The move MUST be legal in the given position.
4. Also provide a brief, intimidating commentary about your move (1-2 sentences max).

RESPONSE FORMAT (strict JSON):
{"move": "e4", "commentary": "The King's Pawn — a declaration of war."}

Think step by step:
1. Analyze the current position (material, king safety, pawn structure, piece activity)
2. Identify threats and tactical opportunities
3. Consider positional advantages
4. Choose the strongest move
5. Return ONLY valid JSON with "move" and "commentary" fields.

RESPONSE RULE: Simple question, simple answer.`;

const CHALLENGER_PROMPT = `You are an advanced chess AI challenger. You are competing against Aureon, a formidable opponent. You play with creative, aggressive, and unconventional strategies. You look for tactical shots and sacrifices.

RULES:
1. You will be given a chess position in PGN and FEN format.
2. You must respond with your next move in standard algebraic notation (SAN).
3. The move MUST be legal in the given position.
4. Also provide brief commentary about your reasoning (1-2 sentences max).

RESPONSE FORMAT (strict JSON):
{"move": "e5", "commentary": "Meeting force with force."}

Return ONLY valid JSON with "move" and "commentary" fields.`;

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pgn, fen, aiColor, byokProvider, byokModel, opponent } = await req.json();

    const userPrompt = `Current game PGN: ${pgn || "(new game)"}
Current FEN: ${fen}
You are playing as: ${aiColor}
It is your turn. Make your move.`;

    let apiKey: string;
    let apiUrl: string;
    let model: string;
    let requestBody: Record<string, unknown>;

    if (opponent === "byok" && byokProvider) {
      // Challenger AI mode — different model plays against Aureon
      apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";

      const modelMap: Record<string, string> = {
        "openai/gpt-4o": "openai/gpt-5",
        "openai/gpt-4": "openai/gpt-5",
        "openai/gpt-3.5-turbo": "openai/gpt-5-nano",
        "anthropic/claude-3-opus": "openai/gpt-5",
        "anthropic/claude-3-sonnet": "openai/gpt-5-mini",
        "anthropic/claude-3-haiku": "openai/gpt-5-nano",
        "google/gemini-pro": "google/gemini-2.5-pro",
        "google/gemini-flash": "google/gemini-2.5-flash",
        "deepseek/deepseek-chat": "google/gemini-2.5-flash",
        "deepseek/deepseek-reasoner": "google/gemini-2.5-pro",
        "xai/grok-2": "openai/gpt-5",
        "xai/grok-beta": "openai/gpt-5-mini",
        "meta/llama-3-70b": "openai/gpt-5-mini",
        "meta/llama-3-8b": "openai/gpt-5-nano",
      };

      model = modelMap[`${byokProvider}/${byokModel}`] || "google/gemini-2.5-flash";

      requestBody = {
        model,
        messages: [
          { role: "system", content: CHALLENGER_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      };
    } else {
      // Aureon mode
      apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-2.5-pro";

      requestBody = {
        model,
        messages: [
          { role: "system", content: AUREON_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      };
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI API returned ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    // Parse JSON from the response
    let move = "";
    let commentary = "";

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*?"move"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        move = parsed.move || "";
        commentary = parsed.commentary || "";
      }
    } catch {
      // Fallback: try to extract move from plain text
      const sanMatch = content.match(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)\b/);
      if (sanMatch) move = sanMatch[1];
      commentary = content.slice(0, 120);
    }

    return new Response(JSON.stringify({ move, commentary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("zaplen-chess error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
