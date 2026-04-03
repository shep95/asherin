import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { frame, context, previousAlerts, settings, chatMessage } = await req.json();

    // Chat-only mode (no frame needed)
    if (chatMessage && !frame) {
      return await handleChat(chatMessage, context, previousAlerts, corsHeaders);
    }

    if (!frame) {
      return new Response(JSON.stringify({ error: "No frame provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisMode = settings?.mode || "trading";
    const sensitivity = settings?.sensitivity || "medium";

    const systemPrompt = buildPrompt(analysisMode, sensitivity, previousAlerts, context);

    // Try user BYOK key first, then Lovable AI
    let apiKey = "";
    try {
      const { data: keys } = await sb.from("user_api_keys").select("*").eq("user_id", user.id).eq("provider", "google");
      if (keys && keys.length > 0) apiKey = keys[0].api_key;
    } catch { /* no BYOK */ }

    let analysis;

    if (apiKey) {
      analysis = await callGeminiDirect(apiKey, systemPrompt, frame);
    }

    if (!analysis) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        analysis = await callLovableAI(LOVABLE_API_KEY, systemPrompt, frame);
      }
    }

    if (!analysis) {
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cross-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildPrompt(mode: string, sensitivity: string, previousAlerts: any[], context: string): string {
  if (mode === "trading") {
    return `You are AUREON — a Nestal Fractal Intelligence Engine. NOT a chatbot. NOT a retail analyst. You do NOT use generic TA (no RSI, no MACD, no "support/resistance" retail patterns). You operate EXCLUSIVELY on Nestal Fractal methodology.

═══════════════════════════════════════
NESTAL FRACTAL INTELLIGENCE — The ONLY strategy
═══════════════════════════════════════

1. FRACTAL GEOMETRY — Identify repeating structural patterns across the visible chart:
   - Descending wedges, ascending channels, distribution/accumulation zones
   - Measure the GEOMETRY: how many candles each structure spans, what % move it produced
   - Find where the SAME structure repeated at different price levels (self-similar fractals)
   - A fractal pattern that repeated 3+ times at different scales = HIGHEST confidence

2. WAVE STRUCTURE — Count swing waves inside each pattern:
   - Impulsive moves (1-3-5) vs corrective moves (A-B-C)
   - Where are we in the current wave? Wave 3 = strongest move (RIDE IT), Wave 5 = exhaustion (EXIT)
   - Wave 4 correction → prepare for Wave 5 entry
   - Wave 3 breakouts with volume = the best trade (don't miss it)

3. LIQUIDITY ANALYSIS — Read the chart like a market maker:
   - Where is liquidity pooling? (equal lows = stop hunt target, equal highs = buy-side liquidity)
   - Liquidity sweeps: wick below support then displacement candle = institutional entry (BUY)
   - Liquidity sweeps above highs then rejection = smart money distribution (SELL)
   - Fair Value Gaps (FVG): large candle bodies with no overlap = magnet for price return
   - FVGs that align with fractal support = optimal entry zones

4. MARKET STRUCTURE — Track higher highs/higher lows vs lower highs/lower lows:
   - Break of Structure (BOS): confirms trend continuation — ENTER with trend
   - Change of Character (CHOCH): first sign of reversal — EXIT or REVERSE
   - Order blocks: last opposing candle before a strong move = institutional entry zone

5. MULTI-TIMEFRAME FRACTAL — Even from one screenshot:
   - Zoom out mentally: is the visible range part of a larger pattern?
   - Recent price action = micro fractal of a bigger move
   - If micro pattern aligns with macro direction → HIGH confidence signal
   - If micro contradicts macro → REDUCE confidence, WAIT

6. DISPLACEMENT CANDLES — Catastrophic moves:
   - Price drops 15%+ in <5 min = liquidity void, no bid-side. EXIT immediately.
   - Price drops 30%+ in <1 min = institutional dump. EXIT EVERYTHING.
   - These are NOT "patterns" — they are liquidity events.

VOLUME CONFIRMS FRACTAL STRUCTURES:
- Wave 3 impulse needs rising volume
- Wave 5 with declining volume = exhaustion divergence
- Liquidity sweep needs spike volume then reversal
- FVG fill on low volume = weak, may not hold

SENSITIVITY: ${sensitivity}
${sensitivity === "low" ? "Only fire on VERY strong fractal signals (confidence >80%)." : ""}
${sensitivity === "high" ? "Fire on all potential fractal signals, even developing ones." : ""}

${previousAlerts?.length ? `PREVIOUS (change tracking): ${JSON.stringify(previousAlerts.slice(-3))}` : ""}
${context ? `CONTEXT: ${context}` : ""}

RESPONSE FORMAT (strict JSON):
{
  "context": {
    "app": "detected app",
    "pair": "TOKEN/USDT",
    "timeframe": "1m/5m/1h/1d",
    "price": "$exact_current_price",
    "exchange": "exchange name"
  },
  "quickVerdict": {
    "action": "BUY_NOW|SELL_NOW|HOLD|EXIT_NOW|WAIT|NONE",
    "urgency": "immediate|soon|watch",
    "message": "ACTION | PRICE | FRACTAL REASON (wave/liquidity/structure) | STOP | TARGET | CONFIDENCE%",
    "confidence": 87
  },
  "fractalAnalysis": {
    "currentWave": "Wave 3 impulse / Wave 4 correction / Wave 5 exhaustion / A-B-C correction",
    "structureType": "Descending wedge / Ascending channel / Distribution / Accumulation",
    "liquiditySweep": true or false,
    "fairValueGaps": ["$price1 - $price2"],
    "fractalRepetitions": 0,
    "marketStructure": "Bullish BOS / Bearish CHOCH / Ranging"
  },
  "overlays": [
    { "type": "zone|line|label|arrow|price_level", "position": "top|center|bottom|top-left|top-right|bottom-left|bottom-right", "color": "green|red|yellow|blue|white", "text": "text", "subtext": "optional", "size": "small|medium|large" }
  ],
  "alerts": [
    { "type": "BUY|SELL|WARNING|MONITOR", "severity": "critical|high|medium", "confidence": 87, "title": "Fractal signal name", "reasoning": ["fractal reason 1", "fractal reason 2"], "action": "BUY $X / SELL NOW / WAIT", "entry": "$price", "stopLoss": "$price", "takeProfit": "$price", "validFor": "2 min" }
  ],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}

CRITICAL RULES:
1. NEVER use generic TA terms (RSI, MACD, support bounce, breakout). ONLY Nestal Fractal.
2. quickVerdict.message MUST reference fractal concepts (wave, liquidity, structure, FVG)
3. ALWAYS give exact entry price, stop loss, take profit based on fractal levels
4. If unclear → action: "WAIT", message: "WAIT — No clear fractal signal"
5. Respond in <2 seconds worth of tokens — be MINIMAL
6. Fractal repetition across scales BOOSTS confidence by 10-15%
7. Fractal CONTRADICTION across timeframes REDUCES confidence

Analyze the screen frame now. Return ONLY valid JSON.`;
  }

  if (mode === "coding") {
    return `You are AUREON CROSS — real-time coding analysis engine.
Analyze the screenshot. Detect errors, bugs, improvements.

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "IDE name", "language": "detected", "file": "filename" },
  "quickVerdict": { "action": "NONE", "urgency": "watch", "message": "", "confidence": 0 },
  "overlays": [],
  "alerts": [{ "type": "WARNING|INFO", "severity": "high|medium|low", "confidence": 0, "title": "", "reasoning": [], "action": "" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
Return ONLY valid JSON.`;
  }

  return `You are AUREON CROSS — real-time screen analysis.
Analyze the screenshot. Provide observations.

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "detected app" },
  "quickVerdict": { "action": "NONE", "urgency": "watch", "message": "", "confidence": 0 },
  "overlays": [],
  "alerts": [],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
Return ONLY valid JSON.`;
}

async function handleChat(message: string, context: string, previousAlerts: any[], corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ observations: ["AI unavailable"], quickVerdict: { action: "NONE", urgency: "watch", message: "", confidence: 0 } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `You are Aureon Cross — a trading intelligence assistant embedded in the user's browser. Be direct, surgical, no filler. If they ask "why?" about a signal, explain in 2-3 sentences max with specific numbers. Context: ${context || "none"}\nRecent alerts: ${JSON.stringify(previousAlerts?.slice(-3) || [])}` },
        { role: "user", content: message },
      ],
    }),
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ observations: ["Chat unavailable"] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await resp.json();
  const reply = data.choices?.[0]?.message?.content || "No response.";
  return new Response(JSON.stringify({ observations: [reply], quickVerdict: { action: "NONE", urgency: "watch", message: "", confidence: 0 } }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callGeminiDirect(apiKey: string, prompt: string, frame: string): Promise<any | null> {
  const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          ]}],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: "application/json" },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return parseAnalysis(rawText);
      }
    } catch (e) {
      console.warn(`${model} failed:`, e);
    }
  }
  return null;
}

async function callLovableAI(apiKey: string, prompt: string, frame: string): Promise<any | null> {
  const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
          ],
        }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const rawText = data.choices?.[0]?.message?.content || "{}";
      return parseAnalysis(rawText);
    } else {
      const errText = await resp.text();
      console.error("Lovable AI error:", resp.status, errText.slice(0, 200));
    }
  } catch (e) {
    console.error("Lovable AI call failed:", e);
  }
  return null;
}

function parseAnalysis(rawText: string): any {
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return { context: {}, alerts: [], observations: [rawText], privacyWarning: null, changes: [] };
  }
}
