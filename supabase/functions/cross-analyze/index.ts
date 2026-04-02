import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check — admin only
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

    const { frame, context, previousAlerts, settings } = await req.json();
    if (!frame) {
      return new Response(JSON.stringify({ error: "No frame provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisMode = settings?.mode || "trading";
    const sensitivity = settings?.sensitivity || "medium";

    // Build system prompt based on mode
    let systemPrompt = "";
    if (analysisMode === "trading") {
      systemPrompt = `You are AUREON CROSS — a real-time screen analysis engine for trading.
You are analyzing a live screenshot of the user's trading screen.

YOUR TASK:
1. Identify what's on screen (exchange, chart, token/pair, timeframe)
2. Read all visible numbers (price, volume, indicators)
3. Detect chart patterns (candles, support/resistance, trend lines)
4. Assess current market conditions
5. Generate actionable alerts if warranted

ALERT TYPES:
- BUY: Strong buy signal detected (RSI oversold + volume spike + support bounce)
- SELL: Strong sell signal (RSI overbought + volume declining + resistance hit)
- WARNING: Danger signal (rug pull risk, liquidity drain, sudden dump)
- MONITOR: Something forming, watch closely
- INFO: General observation

SENSITIVITY: ${sensitivity}
${sensitivity === "low" ? "Only alert on VERY strong, high-confidence signals." : ""}
${sensitivity === "high" ? "Alert on all potential signals, even weak ones." : ""}

RESPONSE FORMAT (strict JSON):
{
  "context": {
    "app": "detected app name",
    "pair": "TOKEN/USDT or similar",
    "timeframe": "1m/5m/1h/1d etc",
    "price": "current price if readable",
    "exchange": "exchange name if detectable"
  },
  "alerts": [
    {
      "type": "BUY|SELL|WARNING|MONITOR|INFO",
      "severity": "critical|high|medium|low",
      "confidence": 0-100,
      "title": "Short alert title",
      "reasoning": ["bullet point 1", "bullet point 2"],
      "action": "Specific recommended action",
      "entry": "entry price if applicable",
      "stopLoss": "stop loss if applicable",
      "takeProfit": "take profit if applicable",
      "validFor": "time validity estimate"
    }
  ],
  "observations": ["general observation 1", "observation 2"],
  "privacyWarning": null or "description of sensitive info detected",
  "changes": ["what changed since last frame if context provided"]
}

IMPORTANT:
- Be concise but precise
- Only generate alerts when you see actual signals
- If screen is blurry or unreadable, say so
- If you detect passwords, bank info, or sensitive data, set privacyWarning
- Always include confidence level
- For meme coins: watch for rug pull indicators (low liquidity, unverified contract, dev wallet dumps)`;
    } else if (analysisMode === "coding") {
      systemPrompt = `You are AUREON CROSS — a real-time screen analysis engine for coding.
You are analyzing a live screenshot of the user's coding environment.

YOUR TASK:
1. Identify the IDE/editor and language
2. Detect visible errors (red squiggles, terminal errors, console output)
3. Spot potential bugs or logic issues in visible code
4. Suggest improvements

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "IDE name", "language": "detected language", "file": "filename if visible" },
  "alerts": [{ "type": "WARNING|INFO", "severity": "high|medium|low", "confidence": 0-100, "title": "issue title", "reasoning": ["details"], "action": "suggested fix" }],
  "observations": ["observation"],
  "privacyWarning": null,
  "changes": []
}`;
    } else {
      systemPrompt = `You are AUREON CROSS — a real-time screen analysis engine.
Analyze the screenshot and provide intelligent observations based on what you see.
Detect the application context and provide relevant insights.

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "detected app" },
  "alerts": [{ "type": "INFO|WARNING", "severity": "medium|low", "confidence": 0-100, "title": "title", "reasoning": ["details"], "action": "suggestion" }],
  "observations": ["observation"],
  "privacyWarning": null,
  "changes": []
}`;
    }

    // Add previous context
    const contextNote = previousAlerts?.length
      ? `\n\nPREVIOUS ALERTS (for change tracking): ${JSON.stringify(previousAlerts.slice(-3))}`
      : "";
    const userContext = context ? `\n\nUSER CONTEXT: ${context}` : "";

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip data URL prefix if present
    const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;

    const geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt + contextNote + userContext + "\n\nAnalyze this screen frame now. Return ONLY valid JSON." },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          ],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", geminiResp.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed", details: errText.slice(0, 200) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResp.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from markdown
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        analysis = JSON.parse(match[1]);
      } else {
        analysis = { context: {}, alerts: [], observations: [rawText], privacyWarning: null, changes: [] };
      }
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
