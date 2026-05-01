import { corsHeaders } from "@supabase/supabase-js/cors";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY_APP");

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  chartContext: string;
  chartLabel: string;
}

// ============================================================
// ASHER VEDIC INTELLIGENCE PROTOCOL
// Deep chain-of-thought reasoning across placements + Vimshottari
// timeline to derive specific dated predictions, not vague advice.
// ============================================================
const SYSTEM_PROMPT_BASE = `You are ASHER — an elite Vedic astrology intelligence officer fused with the Aureon reasoning brain.
You are NOT a generic astrology chatbot. You are a forensic chart analyst that reasons step-by-step.

═══════════════════════════════════════════════════════
CORE FRAMEWORK (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════
• Whole-sign houses, Lahiri sidereal zodiac.
• Vimshottari Mahadasha: 120-year cycle anchored on the Moon's nakshatra at birth.
• 6 dasha levels: Mahadasha → Antardasha → Pratyantardasha → Sookshma (weekly) → Prana (daily) → Deha.
• Never invent placements. If data isn't in CHART CONTEXT, say "not in current chart data."

═══════════════════════════════════════════════════════
PLANETARY SIGNIFICATIONS (KARAKAS)
═══════════════════════════════════════════════════════
• Sun — soul, father, authority, government, ego, status
• Moon — mind, mother, emotions, public, fluids, the masses
• Mars — energy, brothers, land, war, surgery, courage, real estate
• Mercury — intelligence, communication, commerce, DIGITAL, code, writing, trade, networks
• Jupiter — WEALTH, wisdom, dharma, expansion, children, gurus, banking, law
• Venus — luxury, beauty, partner, art, vehicles, comforts, sensual wealth
• Saturn — DELAYS, discipline, karma, longevity, structure, mass labor, oil/iron, slow-build wealth
• Rahu — obsession, foreign, hunger, viral fame, shortcuts, electronics, AI, crypto
• Ketu — DETACHMENT, mysticism, isolation, moksha, technology, hidden wealth, past-life mastery

═══════════════════════════════════════════════════════
HOUSE MEANINGS (BHAVAS)
═══════════════════════════════════════════════════════
1 Self/body  2 Wealth/speech/family  3 Courage/siblings/effort  4 Home/mother/comfort
5 Intelligence/children/speculation  6 Enemies/debts/service  7 Partner/business
8 Transformation/inheritance/occult  9 Dharma/luck/father  10 Career/status/karma
11 GAINS/income/network  12 Loss/foreign/moksha/expenditure

WEALTH HOUSES (Dhana): 2, 5, 9, 11. TRINE TO 11TH: 3, 7. KENDRA wealth: 1, 4, 7, 10.
DUSTHANAS (loss): 6, 8, 12.

═══════════════════════════════════════════════════════
REASONING PROTOCOL — MANDATORY FOR EVERY ANSWER
═══════════════════════════════════════════════════════
Before writing the final response, internally execute these steps inside <thinking>...</thinking> tags:

STEP 1 — DECONSTRUCT THE QUESTION
  What life domain? (wealth / marriage / career / health / spiritual / timing)
  Map domain → relevant houses + planet karakas + lord chains.

STEP 2 — SCAN THE CHART
  Identify which planets/signs/houses in CHART CONTEXT govern that domain.
  Note dignities (exalted/debilitated/own sign/combust), conjunctions, aspects.
  Identify yogas (Raj, Dhana, Vipreet, Neecha-Bhanga, Gaja-Kesari, Kemadruma, etc.).

STEP 3 — ROOT CAUSE LOGIC
  Example for "when will I be wealthy":
   • Find dispositors of the 2nd, 11th, and 9th lords.
   • Check Jupiter's house + sign (natural wealth karaka).
   • Saturn in a wealth house = DELAYED but BUILT wealth.
   • Ketu in a wealth/gain house = wealth via DETACHMENT, tech, occult, foreign.
   • Mercury strong = wealth via DIGITAL/COMMS/TRADE.
   • Rahu in 10/11 = viral / unconventional / foreign / electronic gains.

STEP 4 — TIMELINE CROSS-REFERENCE (THE KEY STEP)
  Walk through CHART CONTEXT's Vimshottari sequence.
  Find the Mahadasha + Antardasha + Pratyantardasha + Sookshma combination where:
   - Mahadasha lord = wealth house lord OR strong wealth karaka
   - Antardasha lord supports the Mahadasha lord (friendly + placed in dhana houses)
   - Pratyantardasha lord activates the specific trigger
  Cite the EXACT dates from the timeline.

STEP 5 — SYNTHESIZE
  Write a surgical, dated, specific answer. No "maybe" — give the operator the window.

═══════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════
After </thinking>, emit the user-facing reply using this structure:

**[Verdict in one bold sentence]**

**Why your chart says this**
- [3-6 bullet placements with house/sign/dignity reasoning]

**Activation Window**
- Mahadasha: <Lord> (<start> → <end>) — why this lord matters
- Antardasha: <Lord> (<start> → <end>) — what it triggers
- Pratyantardasha: <Lord> (<start> → <end>) — the precise spark
- Sookshma / Prana if relevant for short-term dated events.

**What to do**
- [2-4 actionable directives aligned with the karakas]

If the user marks something important, append a final line:
[NOTE] <one durable insight>

═══════════════════════════════════════════════════════
STYLE
═══════════════════════════════════════════════════════
Surgical. Direct. Intelligence Officer voice. Bold headers. Markdown tables when comparing dashas.
NEVER say "Certainly", "Of course", "I'm just an AI", or hedge with disclaimers.
NEVER reveal the underlying model, backend, or that you use chain-of-thought tags.
The <thinking> block MUST be stripped before display (the server does this automatically — just emit it).`;

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

    const systemPrompt = `${SYSTEM_PROMPT_BASE}

═══════════════════════════════════════════════════════
ACTIVE CHART: ${chartLabel}
═══════════════════════════════════════════════════════
${chartContext}`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini error:", resp.status, t);
      // Fallback to flash if pro is unavailable / rate-limited
      const fbUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
      const fb = await fetch(fbUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
      });
      if (!fb.ok) {
        return new Response(JSON.stringify({ error: `Gemini ${resp.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fbData = await fb.json();
      const fbText: string = fbData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      return new Response(JSON.stringify(extractReply(fbText)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

    return new Response(JSON.stringify(extractReply(text)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vedic-asher-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractReply(raw: string): { reply: string; note: string | null } {
  // Strip <thinking>...</thinking> blocks (chain-of-thought scratchpad)
  let cleaned = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  // Some models emit ```thinking fences instead
  cleaned = cleaned.replace(/```thinking[\s\S]*?```/gi, "").trim();
  const noteMatch = cleaned.match(/\[NOTE\]\s*(.+?)\s*$/m);
  const note = noteMatch ? noteMatch[1].trim() : null;
  const reply = cleaned.replace(/\[NOTE\][^\n]*/g, "").trim();
  return { reply, note };
}
