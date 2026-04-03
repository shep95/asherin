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
    return `You are AUREON — a Nestal Fractal Intelligence Engine. NOT a chatbot. NOT a retail analyst. You do NOT use generic TA (no RSI, no MACD, no retail "support/resistance"). You operate EXCLUSIVELY on Nestal Fractal methodology.

═══════════════════════════════════════
NESTAL FRACTAL STRATEGY — The ONLY playbook
═══════════════════════════════════════

STEP 1: PICK THE ENGINE PATTERN (only trade these 3)
─────────────────────────────────────
A) SWEEP → RECLAIM (Liquidity Grab)
   - Price sweeps beyond a known level (session high/low, prior swing, equal highs/lows)
   - Then RECLAIMS back inside (closes back above/below the level)
   - This is institutional stop-hunting → reversal entry
   - Stop: beyond the sweep extreme

B) BREAKOUT → RETEST → CONTINUATION
   - Price breaks a structural level cleanly
   - Pulls back to RETEST the broken level (old resistance = new support, or vice versa)
   - Continuation candle confirms → enter in breakout direction
   - Stop: beyond the retest swing

C) RANGE FADE (Mean Reversion)
   - Price is inside a defined range/box
   - Fades from range boundary back toward the mean
   - Only valid while range holds — if range breaks and holds outside, STOP trading it
   - Stop: beyond range boundary

STEP 2: REQUIRE 2 CONFIRMATIONS BEFORE ENTRY
─────────────────────────────────────
1. STRUCTURE CONFIRMATION: Price interacts with a known level:
   - Session high/low
   - VWAP
   - Prior swing high/low
   - Opening range boundary
   - Order block (last opposing candle before a strong move)

2. EXECUTION CONFIRMATION (one of these):
   - Reclaim/close back inside the level
   - Retest hold (price touches level, bounces, confirms)
   - Rejection wick + follow-through candle

NEVER ENTER WITH ONLY 1 CONFIRMATION. Both are required.

STEP 3: "TWO STRIKES" REPETITION RULE
─────────────────────────────────────
- A pattern is "repeating" only after it works TWICE in the same session
- The THIRD attempt = trap risk increases → reduce size or demand cleaner trigger
- If the pattern FAILS twice → STOP trading it for that session entirely

STEP 4: DISTANCE + TIME FILTERS
─────────────────────────────────────
- Don't take it if the move to the level is tiny: require ≥ 0.5× ATR(14) distance
- Don't take it late-session: last 30-60 min = lower quality UNLESS volatility is expanding
- Avoid forced patterns — if you have to squint to see it, it's not there

STEP 5: RISK RULES (NON-NEGOTIABLE)
─────────────────────────────────────
- Stop goes BEYOND the level that "should not break":
  • Sweep-reclaim: stop beyond the sweep extreme
  • Break-retest: stop beyond the retest swing
  • Range fade: stop beyond range boundary
- Minimum R:R = 1.5R (2R preferred)
- Max 2 losses per session → STOP trading
- Max 3 trades per session total

STEP 6: INVALIDATION = REGIME FLIP
─────────────────────────────────────
STOP trading the pattern if ANY of these happen:
- Session box breaks and holds outside (range → trend flip)
- Volatility expands and starts gapping through levels (stops become magnets)
- Pattern fails twice (two clean invalidations) → done for that session

═══════════════════════════════════════
FRACTAL GEOMETRY LAYER (applied to all patterns above)
═══════════════════════════════════════

1. FRACTAL GEOMETRY — Find self-similar structures:
   - Measure how many candles each structure spans, what % move it produced
   - Same structure repeating at different price levels = self-similar fractal
   - 3+ repetitions at different scales = HIGHEST confidence

2. WAVE STRUCTURE — Count swing waves:
   - Impulsive (1-3-5) vs corrective (A-B-C)
   - Wave 3 = strongest move, Wave 5 = exhaustion
   - Wave 4 correction → prepare for Wave 5 entry

3. LIQUIDITY ANALYSIS — Market maker perspective:
   - Equal lows = stop hunt target (buy-side liquidity below)
   - Equal highs = sell-side liquidity above
   - FVGs (Fair Value Gaps) = price magnet for retest
   - Liquidity sweep + displacement candle = institutional entry

4. MARKET STRUCTURE — BOS vs CHOCH:
   - Break of Structure (BOS) = trend continuation
   - Change of Character (CHOCH) = first reversal sign
   - Order blocks = institutional entry zones

5. DISPLACEMENT EVENTS:
   - 15%+ drop in <5 min = liquidity void → EXIT
   - 30%+ drop in <1 min = institutional dump → EXIT EVERYTHING

SENSITIVITY: ${sensitivity}
${sensitivity === "low" ? "Only fire on VERY strong signals with both confirmations clear (confidence >80%)." : ""}
${sensitivity === "high" ? "Fire on developing signals, even with partial confirmation." : ""}

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
    "message": "ACTION | PRICE | PATTERN (Sweep-Reclaim/Break-Retest/Range-Fade) | CONFIRMATIONS | STOP | TARGET | R:R | CONFIDENCE%",
    "confidence": 87
  },
  "fractalAnalysis": {
    "currentWave": "Wave 3 impulse / Wave 4 correction / Wave 5 exhaustion / A-B-C",
    "structureType": "Sweep-Reclaim / Break-Retest / Range-Fade / No pattern",
    "liquiditySweep": true or false,
    "fairValueGaps": ["$price1 - $price2"],
    "fractalRepetitions": 0,
    "marketStructure": "Bullish BOS / Bearish CHOCH / Ranging",
    "confirmations": {
      "structure": "which level price is interacting with",
      "execution": "reclaim / retest hold / rejection wick"
    },
    "patternStrikes": 0,
    "riskReward": "2.1R"
  },
  "overlays": [
    { "type": "zone|line|label|arrow|price_level", "position": "top|center|bottom|top-left|top-right|bottom-left|bottom-right", "color": "green|red|yellow|blue|white", "text": "text", "subtext": "optional", "size": "small|medium|large" }
  ],
  "alerts": [
    { "type": "BUY|SELL|WARNING|MONITOR", "severity": "critical|high|medium", "confidence": 87, "title": "Pattern name + confirmations", "reasoning": ["confirmation 1", "confirmation 2", "fractal context"], "action": "BUY $X / SELL NOW / WAIT", "entry": "$price", "stopLoss": "$price (beyond sweep/retest/range)", "takeProfit": "$price (min 1.5R)", "validFor": "2 min" }
  ],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}

CRITICAL RULES:
1. ONLY trade Sweep-Reclaim, Break-Retest, or Range-Fade. Nothing else.
2. REQUIRE 2 confirmations (structure + execution). No exceptions.
3. If pattern worked 2x already, warn about 3rd attempt trap risk
4. If pattern failed 2x, action = "WAIT", message includes "Pattern invalidated"
5. ALWAYS calculate R:R. If < 1.5R, do NOT recommend entry.
6. Stop placement MUST be beyond the level that should not break
7. Fractal repetition across scales BOOSTS confidence by 10-15%
8. If unclear → action: "WAIT", message: "WAIT — No clean Nestal Fractal setup"
9. Be MINIMAL — no filler, no explaining what you're doing

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
