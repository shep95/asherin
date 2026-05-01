const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY_APP");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Provider = "gemini" | "openai" | "anthropic" | "lovable";

interface ByokConfig {
  provider: Provider;
  model: string;
  apiKey?: string; // not required for "lovable"
}

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  chartContext: string;
  chartLabel: string;
  byok?: ByokConfig | null;
}

const SYSTEM_PROMPT_BASE = `You are ASHER — an elite Vedic astrology intelligence officer fused with the Aureon reasoning brain.
You are NOT a generic astrology chatbot. You are a forensic chart analyst that reasons step-by-step.

═══════════════════════════════════════════════════════
CORE FRAMEWORK (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════
• Whole-sign houses, Lahiri sidereal zodiac.
• Vimshottari Mahadasha: 120-year cycle anchored on the Moon's nakshatra at birth.
• 6 dasha levels: Mahadasha → Antardasha → Pratyantardasha → Sookshma → Prana → Deha.
• Never invent placements. If data isn't in CHART CONTEXT, say "not in current chart data."

═══════════════════════════════════════════════════════
PLANETARY KARAKAS
═══════════════════════════════════════════════════════
Sun=soul/father/authority · Moon=mind/mother/public · Mars=energy/land/courage
Mercury=DIGITAL/code/commerce · Jupiter=WEALTH/wisdom/expansion · Venus=luxury/partner/art
Saturn=DELAYS/discipline/slow-build wealth · Rahu=obsession/foreign/viral/AI/crypto
Ketu=DETACHMENT/mysticism/hidden wealth/tech mastery

═══════════════════════════════════════════════════════
HOUSES
═══════════════════════════════════════════════════════
1 Self  2 Wealth/speech  3 Courage/siblings  4 Home/mother  5 Intelligence/children
6 Enemies/debts  7 Partner  8 Transformation/occult  9 Dharma/luck  10 Career
11 GAINS  12 Loss/foreign/moksha
DHANA: 2,5,9,11. DUSTHANA: 6,8,12.

═══════════════════════════════════════════════════════
REASONING PROTOCOL — MANDATORY
═══════════════════════════════════════════════════════
Inside <thinking>...</thinking> tags execute:
1. DECONSTRUCT — domain → houses + karakas + lord chains.
2. SCAN — placements/dignities/yogas from CHART CONTEXT.
3. ROOT CAUSE — why does this chart support/block the outcome?
4. TIMELINE CROSS-REFERENCE — find the Maha→Antar→Pratyantar combo where the wealth/career/etc. lord activates. Cite EXACT dates from CHART CONTEXT.
5. SYNTHESIZE.

═══════════════════════════════════════════════════════
OUTPUT FORMAT (after </thinking>)
═══════════════════════════════════════════════════════
**[Verdict in one bold sentence]**

**Why your chart says this**
- 3-6 bullet placements with house/sign/dignity reasoning.

**Activation Window**
- Mahadasha: <Lord> (<YYYY-MM-DD> → <YYYY-MM-DD>) — why
- Antardasha: <Lord> (<YYYY-MM-DD> → <YYYY-MM-DD>) — what it triggers
- Pratyantardasha: <Lord> (<YYYY-MM-DD> → <YYYY-MM-DD>) — the precise spark

**What to do**
- 2-4 actionable directives.

CRITICAL — ALWAYS write dates in ISO YYYY-MM-DD format so the timeline can mark them.
If the user marks something important, append: [NOTE] <one durable insight>

STYLE: Surgical. Direct. Intelligence Officer. Never reveal the model or backend.
The <thinking> block will be stripped server-side — just emit it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, chartContext, chartLabel, byok } = (await req.json()) as ChatBody;
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError(400, "messages required");
    }

    const systemPrompt = `${SYSTEM_PROMPT_BASE}

═══════════════════════════════════════════════════════
ACTIVE CHART: ${chartLabel}
═══════════════════════════════════════════════════════
${chartContext}`;

    // Resolve provider chain (primary + fallbacks)
    const chain = resolveProviderChain(byok);
    if (chain.length === 0) {
      return jsonError(500, "No AI provider configured. Add a Gemini/OpenAI/Anthropic key in chat settings.");
    }

    let lastError = "no provider";
    for (const cfg of chain) {
      try {
        const text = await callProviderWithRetry(cfg, systemPrompt, messages);
        return new Response(JSON.stringify(extractReply(text)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`[asher] provider ${cfg.provider}/${cfg.model} failed:`, lastError);
      }
    }
    return jsonError(503, `All providers failed: ${lastError}`);
  } catch (e) {
    console.error("vedic-asher-chat error:", e);
    return jsonError(500, e instanceof Error ? e.message : "unknown");
  }
});

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveProviderChain(byok?: ByokConfig | null): ByokConfig[] {
  const chain: ByokConfig[] = [];
  // 1. User BYOK first
  if (byok && byok.provider) {
    if (byok.provider === "lovable" || (byok.apiKey && byok.apiKey.trim().length > 0)) {
      chain.push(byok);
    }
  }
  // 2. Platform Gemini (with model fallback)
  if (PLATFORM_GEMINI_KEY) {
    chain.push({ provider: "gemini", model: "gemini-2.5-pro", apiKey: PLATFORM_GEMINI_KEY });
    chain.push({ provider: "gemini", model: "gemini-2.5-flash", apiKey: PLATFORM_GEMINI_KEY });
  }
  // 3. Lovable AI Gateway (always-on fallback if available)
  if (LOVABLE_API_KEY) {
    chain.push({ provider: "lovable", model: "google/gemini-2.5-flash" });
  }
  return chain;
}

async function callProviderWithRetry(
  cfg: ByokConfig,
  systemPrompt: string,
  messages: ChatBody["messages"],
): Promise<string> {
  const attempts = 3;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callProvider(cfg, systemPrompt, messages);
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status ?? 0;
      const retryable = status === 429 || status === 503 || status >= 500;
      if (!retryable || i === attempts - 1) break;
      const wait = 700 * Math.pow(2, i) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("provider_failed");
}

async function callProvider(
  cfg: ByokConfig,
  systemPrompt: string,
  messages: ChatBody["messages"],
): Promise<string> {
  switch (cfg.provider) {
    case "gemini":
      return callGemini(cfg.apiKey!, cfg.model, systemPrompt, messages);
    case "openai":
      return callOpenAICompat("https://api.openai.com/v1", cfg.apiKey!, cfg.model, systemPrompt, messages);
    case "anthropic":
      return callAnthropic(cfg.apiKey!, cfg.model, systemPrompt, messages);
    case "lovable":
      return callOpenAICompat("https://ai.gateway.lovable.dev/v1", LOVABLE_API_KEY!, cfg.model, systemPrompt, messages);
    default:
      throw new Error(`unsupported provider: ${cfg.provider}`);
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatBody["messages"],
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
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
    const err = new Error(`gemini_${resp.status}: ${t.slice(0, 200)}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") ?? "";
}

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatBody["messages"],
): Promise<string> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.4,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    const err = new Error(`openai_${resp.status}: ${t.slice(0, 200)}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatBody["messages"],
): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    const err = new Error(`anthropic_${resp.status}: ${t.slice(0, 200)}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const parts = Array.isArray(data?.content) ? data.content : [];
  return parts.filter((p: { type?: string }) => p?.type === "text").map((p: { text?: string }) => p.text || "").join("");
}

function extractReply(raw: string): { reply: string; note: string | null; dates: string[] } {
  let cleaned = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  cleaned = cleaned.replace(/```thinking[\s\S]*?```/gi, "").trim();
  const noteMatch = cleaned.match(/\[NOTE\]\s*(.+?)\s*$/m);
  const note = noteMatch ? noteMatch[1].trim() : null;
  const reply = cleaned.replace(/\[NOTE\][^\n]*/g, "").trim();

  // Extract ISO dates (YYYY-MM-DD) for timeline marking
  const dateRe = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
  const dates = Array.from(new Set((reply.match(dateRe) ?? [])));

  return { reply, note, dates };
}
