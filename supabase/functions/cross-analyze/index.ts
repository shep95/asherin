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
    return `You are a PATTERN RECOGNITION MACHINE. NOT an analyst. NOT a chatbot.

You see a trading chart screenshot. Your job:
1. Match to ONE of 7 patterns below
2. Return the INSTANT signal
3. NO THINKING. NO "Let me analyze." PURE INSTINCT.

═══════════════════════════════════════
THE 7 PATTERNS (Match ONE)
═══════════════════════════════════════

PATTERN 1 — SUPPORT BOUNCE (BUY)
Triggers: Price touching horizontal support 3rd+ time, volume spike 2x+, green candle forming, RSI < 35

PATTERN 2 — BREAKOUT (BUY)
Triggers: Price closed ABOVE resistance, volume 3x+ normal, 3+ green candles, strong momentum

PATTERN 3 — EARLY PUMP (BUY - RISKY)
Triggers: Price up 8-15% in <3 min (not too late), volume spiking 200%+, 4+ green candles, RSI < 65

PATTERN 4 — LATE PUMP (DON'T BUY)
Triggers: Price already up 40%+ in <5 min, volume DECLINING while price rising, RSI > 75, parabolic

PATTERN 5 — RUG PULL (SELL EVERYTHING)
Triggers: Price drops 30%+ in <1 min, volume 10x+ spike, all red candles

PATTERN 6 — DEAD CAT BOUNCE (DON'T BUY)
Triggers: Price dropped 60%+ then bounced 10-20%, volume weak/declining

PATTERN 7 — TRIANGLE SETUP (WAIT)
Triggers: Price squeezing between converging lines, 3+ touches each line, volume compressing

═══════════════════════════════════════
VOLUME IS KING — Volume confirms EVERYTHING:
- Support bounce needs volume spike (2x+)
- Breakout needs massive volume (3x+)
- Pump without volume = fake
- Dump with huge volume = real, sell now
═══════════════════════════════════════

SENSITIVITY: ${sensitivity}
${sensitivity === "low" ? "Only fire on VERY strong signals (confidence >80%)." : ""}
${sensitivity === "high" ? "Fire on all potential signals, even weak ones." : ""}

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
    "message": "ACTION: BUY/SELL/WAIT | PRICE: $X | REASON: Pattern name | STOP: $X | TARGET: $X | CONFIDENCE: X%",
    "confidence": 87
  },
  "overlays": [
    { "type": "zone|line|label|arrow|price_level", "position": "top|center|bottom|top-left|top-right|bottom-left|bottom-right", "color": "green|red|yellow|blue|white", "text": "text", "subtext": "optional", "size": "small|medium|large" }
  ],
  "alerts": [
    { "type": "BUY|SELL|WARNING|MONITOR", "severity": "critical|high|medium", "confidence": 87, "title": "Pattern name in 3 words", "reasoning": ["bullet 1", "bullet 2"], "action": "BUY $X / SELL NOW / WAIT", "entry": "$price", "stopLoss": "$price", "takeProfit": "$price", "validFor": "2 min" }
  ],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}

CRITICAL RULES:
1. NEVER say "analyzing" or "thinking" — just the signal
2. quickVerdict.message MUST follow: ACTION | PRICE | REASON | STOP | TARGET | CONFIDENCE
3. ALWAYS give exact entry price, stop loss, take profit
4. If unclear → action: "WAIT", message: "WAIT — Unclear pattern"
5. Respond in <2 seconds worth of tokens — be MINIMAL
6. NO long explanations in quickVerdict — pattern name is enough

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
