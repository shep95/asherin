import { corsHeaders } from "@supabase/supabase-js/cors";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY_APP");

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  chartContext: string;
  chartLabel: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, chartContext, chartLabel } = (await req.json()) as ChatBody;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are ASHER, an elite Vedic astrology intelligence officer.
You analyze the user's *active chart* with surgical precision: bold headers, no fluff, no disclaimers.
Use whole-sign houses, Lahiri sidereal, Vimshottari dasha (120-year cycle anchored on the Moon's nakshatra).
Cite house numbers, signs, planet placements, dashas, and yogas explicitly from the supplied CHART CONTEXT.
Never invent data. If the user asks about something not in the context, say so plainly.
When the user says something is *important*, end your reply with a single line:
[NOTE] <one-sentence durable insight>
The note line will be auto-saved to the chart's notes tab.

ACTIVE CHART: ${chartLabel}
CHART CONTEXT:
${chartContext}`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini error:", resp.status, t);
      return new Response(JSON.stringify({ error: `Gemini ${resp.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

    // Extract [NOTE] lines for auto-save on the client.
    const noteMatch = text.match(/\[NOTE\]\s*(.+?)\s*$/m);
    const note = noteMatch ? noteMatch[1].trim() : null;
    const reply = text.replace(/\[NOTE\][^\n]*/g, "").trim();

    return new Response(JSON.stringify({ reply, note }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vedic-asher-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
