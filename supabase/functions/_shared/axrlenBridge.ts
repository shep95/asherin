// AXRLEN BRIDGE — activates the AXRLEN prediction engine inline inside
// Aureon Chat (link-extract-chat) and Asher Chat (asher-ai) when the user
// asks a forecast-shaped question. Verified admin or Aureon Pro
// ($399/mo, monthly_pro / pro / lifetime / algorithm) callers only —
// everyone else gets a single clean upgrade line, never a fake forecast.
//
// The bridge:
//   1. Classifies the last user message → { fired, tier: 1|2|3 }.
//   2. Verifies caller access via proTierGate.
//   3. Loads matching axrlen_brains (primary Vedic/Zophiel + top-scored
//      secondaries) using the exact same rules as supabase/functions/axrlen-chat.
//   4. Builds the AXRLEN BASE_IDENTITY system prompt.
//   5. Streams the response through Gemini (AXRLEN_GEMINI_API_KEY when set,
//      otherwise the caller's already-resolved key) as an SSE that the
//      caller re-emits in its native format (plain-text for
//      link-extract-chat, OpenAI-compat for asher-ai).
//
// Zero cost when intent doesn't fire (fast regex check, no DB, no network).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveAxrlenAccess, type AxrlenAccess } from "./proTierGate.ts";
import { nexusPrimeCore, AXRLEN_INLINE_ADDENDUM, AXRLEN_MARKET_ADDENDUM, AXRLEN_SPECIFICITY_ADDENDUM, detectMarketIntent } from "./axrlenSystemPrompt.ts";

// ── Region detection — mirrors axrlen-analyze's REGION_MAP so the bridge
// feeds regionally-scoped Vedic context when the user names a country. Keeps
// Aureon/Asher forecasts on the same Vedic frame as the standalone endpoint.
const REGION_LOOKUP: Array<[RegExp, string]> = [
  [/\b(united states|u\.?s\.?a?|america|washington)\b/i, "US"],
  [/\b(china|beijing|prc)\b/i, "CN"],
  [/\b(russia|moscow|kremlin|putin)\b/i, "RU"],
  [/\b(india|delhi|modi)\b/i, "IN"],
  [/\b(brazil|brasilia)\b/i, "BR"],
  [/\b(germany|berlin)\b/i, "DE"],
  [/\b(france|paris|macron)\b/i, "FR"],
  [/\b(uk|united kingdom|britain|london)\b/i, "GB"],
  [/\b(japan|tokyo)\b/i, "JP"],
  [/\b(south korea|seoul)\b/i, "KR"],
  [/\b(mexico)\b/i, "MX"],
  [/\b(nigeria|abuja|lagos)\b/i, "NG"],
  [/\b(south africa|pretoria|johannesburg)\b/i, "ZA"],
  [/\b(egypt|cairo)\b/i, "EG"],
  [/\b(turkey|ankara|istanbul|erdogan)\b/i, "TR"],
  [/\b(iran|tehran|khamenei)\b/i, "IR"],
  [/\b(saudi arabia|riyadh|mbs)\b/i, "SA"],
  [/\b(australia|canberra)\b/i, "AU"],
  [/\b(indonesia|jakarta)\b/i, "ID"],
  [/\b(pakistan|islamabad)\b/i, "PK"],
  [/\b(canada|ottawa)\b/i, "CA"],
  [/\b(ukraine|kyiv|kiev|zelensky)\b/i, "UA"],
  [/\b(israel|jerusalem|tel aviv|netanyahu)\b/i, "IL"],
  [/\b(palestine|gaza|west bank|hamas)\b/i, "PS"],
  [/\b(taiwan|taipei)\b/i, "TW"],
  [/\b(north korea|pyongyang|kim jong)\b/i, "KP"],
  [/\b(syria|damascus)\b/i, "SY"],
];

function detectRegionCode(text: string): string | undefined {
  for (const [re, code] of REGION_LOOKUP) if (re.test(text)) return code;
  return undefined;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AxrlenIntent {
  fired: boolean;
  tier: 1 | 2 | 3;
  subject: string;
}

export interface AxrlenBridgeArgs {
  req: Request;
  messages: Array<{ role: string; content: string }>;
  /** Extra live evidence to inject as sessionContext (Aureon's OSINT block). */
  liveEvidence?: string;
  /** Which chat surface is calling — controls upgrade-line wording. */
  surface: "aureon" | "asher";
  /** Fallback API key if AXRLEN_GEMINI_API_KEY is not set. */
  fallbackGeminiKey?: string;
  fallbackModel?: string;
  /**
   * Access policy for this surface.
   *   - 'pro' (default)         → admin OR $399 Aureon Pro subscribers only.
   *   - 'authenticated'         → any signed-in user, regardless of tier.
   * Aureon chat uses 'authenticated' so every subscription tier can invoke
   * inline AXRLEN forecasting. Asher chat and the standalone AXRLEN endpoint
   * keep the Pro gate.
   */
  accessMode?: "pro" | "authenticated";
}

export type AxrlenBridgeResult =
  | { kind: "not_fired" }
  | { kind: "denied"; access: AxrlenAccess; message: string; intent: AxrlenIntent }
  | { kind: "stream"; access: AxrlenAccess; intent: AxrlenIntent; textStream: ReadableStream<Uint8Array>; brainsLoaded: number };

// ── 1. Intent detection ─────────────────────────────────────────────────────

const EXPLICIT_INVOKE_RE = /(?:^|\s)(?:@axrlen|\/axrlen|run\s+axrlen|axrlen\s+(?:forecast|analysis|prediction))/i;

// Broad forecast verbs / probability language.
const FORECAST_VOCAB_RE =
  /\b(predict|prediction|forecast|forecasted|forecasting|will\s+(?:win|beat|lose|happen|rise|fall|drop|crash|rally|dump|pump|moon|reach|hit|break|bounce|reverse)|who\s+wins|odds\s+(?:of|on)|probability|likelihood|most\s+likely|base\s+case|bear\s+case|bull\s+case|tripwire|endgame|scenario\s+(?:a|b|c|analysis|breakdown)|deep\s+dive|full\s+analysis|nexus\s+verdict)\b/i;

// Asset + timeframe patterns (e.g. "BTC in 72h", "NVDA next week", "gold by Friday").
const TICKER_RE = /\b([A-Z]{2,6}|BTC|ETH|SOL|XRP|EUR\/USD|USD\/JPY|GBP\/USD|GOLD|OIL|SPX|NDX|DXY)\b/;
const TIMEFRAME_RE =
  /\b(?:in\s+)?(?:\d+\s*)?(?:h(?:ours?)?|d(?:ays?)?|w(?:eeks?)?|m(?:onths?)?|by\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*|by\s+(?:tomorrow|next\s+\w+|end\s+of\s+\w+)|next\s+\w+|tonight|today|tomorrow|this\s+week)\b/i;

// Event/outcome patterns ("France vs Iraq", "Trump vs …", "Russia Ukraine 2027").
const VERSUS_RE = /\b([A-Z][A-Za-z0-9.'-]{1,25})\s+(?:vs\.?|versus)\s+([A-Z][A-Za-z0-9.'-]{1,25})\b/;

// Anti-triggers — cheap negative controls so casual chat never invokes AXRLEN.
const ANTI_TRIGGERS_RE =
  /\b(weather|recipe|joke|translate|spell|define|what\s+time\s+is\s+it|how\s+do\s+i\s+(?:use|install|set\s+up))\b/i;

export function detectAxrlenIntent(text: string): AxrlenIntent {
  const trimmed = (text || "").trim();
  if (!trimmed) return { fired: false, tier: 1, subject: "" };

  // Explicit invocation ALWAYS fires (tier 3 unless casual language).
  if (EXPLICIT_INVOKE_RE.test(trimmed)) {
    const casual = /\b(short|brief|quick|one\s+line|tl;dr)\b/i.test(trimmed);
    return {
      fired: true,
      tier: casual ? 1 : /\b(full|deep|complete|comprehensive|scenario)\b/i.test(trimmed) ? 3 : 2,
      subject: trimmed.replace(EXPLICIT_INVOKE_RE, "").trim().slice(0, 200),
    };
  }

  if (ANTI_TRIGGERS_RE.test(trimmed) && !FORECAST_VOCAB_RE.test(trimmed)) {
    return { fired: false, tier: 1, subject: "" };
  }

  const hasForecastVocab = FORECAST_VOCAB_RE.test(trimmed);
  const hasVersus = VERSUS_RE.test(trimmed);
  const hasAssetTime = TICKER_RE.test(trimmed) && TIMEFRAME_RE.test(trimmed);
  const fired = hasForecastVocab || hasVersus || hasAssetTime;
  if (!fired) return { fired: false, tier: 1, subject: "" };

  // Tier inference. Rule #1 (simple question → simple answer) governs
  // downstream — the tier only caps the reply length.
  let tier: 1 | 2 | 3 = 2;
  if (/\b(full|deep|complete|comprehensive|breakdown|scenario\s+(?:a|b|c|analysis|breakdown)|nexus\s+verdict|deep\s+dive)\b/i.test(trimmed)) {
    tier = 3;
  } else if (
    // Ultra-short questions: "who wins X vs Y?", "will BTC go up?", bare pick asks.
    trimmed.split(/\s+/).length <= 8 &&
    (hasVersus || /\b(who\s+wins|will\s+\w+\s+(?:win|beat|lose|rise|fall)|pick|call)\b/i.test(trimmed))
  ) {
    tier = 1;
  }

  return { fired: true, tier, subject: trimmed.slice(0, 200) };
}

// ── 2. Brain loading (mirrors axrlen-chat exactly) ──────────────────────────

// 60s in-memory cache keyed by primary+secondary content hash. Cold-start
// reloads it; between invocations on a warm isolate we avoid re-pulling
// ~200KB of brain text on every message.
let brainCache: {
  loadedAt: number;
  primary: string;
  secondaryList: Array<{ name: string; content: string; file_name?: string }>;
} | null = null;
const BRAIN_CACHE_TTL_MS = 60_000;

async function loadAxrlenBrains(userMessage: string): Promise<{ primary: string; secondary: string; matched: number }> {
  const now = Date.now();
  let primary = "";
  let secondaryList: typeof brainCache extends null ? never : Array<{ name: string; content: string; file_name?: string }> = [];

  if (brainCache && now - brainCache.loadedAt < BRAIN_CACHE_TTL_MS) {
    primary = brainCache.primary;
    secondaryList = brainCache.secondaryList as typeof secondaryList;
  } else {
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } },
      );
      const { data: brains } = await sb
        .from("axrlen_brains")
        .select("name, content, file_name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      const primaryPatterns = [
        /vadic.*global.*prediction/i,
        /vadic.*prediction/i,
        /zophiel.*supreme.*architecture/i,
        /zophiel.*architecture.*briefi/i,
      ];
      const secondary: typeof secondaryList = [];
      for (const b of brains || []) {
        const nameCheck = `${b.name} ${b.file_name || ""}`;
        if (primaryPatterns.some((p) => p.test(nameCheck))) {
          primary += `\n════════════════════════════════════════\nPRIMARY PREDICTION FRAMEWORK: ${String(b.name).toUpperCase()}\n════════════════════════════════════════\n\n${b.content}\n\n`;
        } else {
          secondary.push(b as any);
        }
      }
      secondaryList = secondary;
      brainCache = { loadedAt: now, primary, secondaryList };
    } catch (_e) {
      // No brains available — AXRLEN still answers using BASE_IDENTITY only.
    }
  }

  // Score secondaries against the user message for supplementary selection.
  const queryTerms = (userMessage || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const scored = secondaryList.map((b) => {
    const contentLower = (b.content || "").toLowerCase();
    let score = 0;
    let hits = 0;
    for (const term of queryTerms) {
      const matches = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      score += matches;
      if (matches > 0) hits++;
    }
    if (/occult|vedic|vadic|prediction|consciousness|pattern|philosophy|war|strategy|hermetic|kabbal/i.test(b.name)) {
      score += 8;
      hits = Math.max(hits, 2);
    }
    return { ...b, score, hits };
  });
  scored.sort((a, b) => b.score - a.score);
  const topSecondary = scored.filter((b) => b.score > 0).slice(0, 10);

  let secondary = "";
  for (const b of topSecondary) {
    secondary += `\n────────────────────────────────────────\nSUPPLEMENTARY BRAIN: ${String(b.name).toUpperCase()}\n────────────────────────────────────────\n\n${b.content}\n\n`;
  }
  return { primary, secondary, matched: (primary ? 1 : 0) + topSecondary.length };
}

// ── 3. AXRLEN system prompt ────────────────────────────────────────────────
// Uses the SHARED NEXUS-PRIME core (same doctrine axrlen-analyze uses) plus
// the inline addendum that enforces Rule #1 + prose output for chat surfaces.
// See supabase/functions/_shared/axrlenSystemPrompt.ts.



// Market-intent detector + market-first addendum live in the shared
// axrlenSystemPrompt module (imported at top) so the standalone axrlen-chat
// endpoint uses the same detector + addendum.


// ── 4. Streaming call ───────────────────────────────────────────────────────


async function callGeminiStreamAsText(apiKey: string, model: string, sys: string, msgs: Array<{ role: string; content: string }>, temperature = 0.3): Promise<ReadableStream<Uint8Array>> {
  const contents = msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
    },
  );
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    throw new Error(`axrlen_gemini_${r.status}: ${txt.slice(0, 220)}`);
  }

  const upstream = r.body;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const d = JSON.parse(json);
              const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (t) controller.enqueue(encoder.encode(t));
            } catch { /* ignore partial */ }
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[axrlen stream error: ${String((e as any)?.message || e)}]`));
      } finally {
        controller.close();
      }
    },
  });
}

// ── 5. Public bridge entrypoint ─────────────────────────────────────────────

export async function runAxrlenBridge(args: AxrlenBridgeArgs): Promise<AxrlenBridgeResult> {
  const last = [...args.messages].reverse().find((m) => m.role === "user");
  const userMessage = String(last?.content || "");
  const intent = detectAxrlenIntent(userMessage);
  if (!intent.fired) return { kind: "not_fired" };

  const access = await resolveAxrlenAccess(args.req);
  const mode = args.accessMode ?? "pro";
  // In 'authenticated' mode, any signed-in caller (any subscription tier)
  // is allowed. Only anonymous callers get a sign-in nudge.
  const allowed = mode === "authenticated"
    ? (access.granted || access.reason === "denied")   // signed-in but non-pro still allowed
    : access.granted;
  if (!allowed) {
    const msg = access.reason === "anonymous"
      ? "AXRLEN forecasting requires sign-in. Sign in and try again."
      : "AXRLEN forecasting is an Aureon Pro ($399/mo) capability. Upgrade at /pricing to unlock inline predictions in "
        + (args.surface === "asher" ? "Asher" : "Aureon")
        + " chat.";
    return { kind: "denied", access, intent, message: msg };
  }

  const { primary, secondary, matched } = await loadAxrlenBrains(userMessage);
  const tierNote = `\n\nCLASSIFIED TIER FOR THIS TURN: TIER ${intent.tier}. Cap your reply length accordingly. Rule #1 still overrides.`;
  const evidenceBlock = args.liveEvidence
    ? `\n\nHOST-CHAT LIVE EVIDENCE (already fetched — use it, cite domains inline):\n${args.liveEvidence.slice(0, 6000)}`
    : "";
  // Market intent → swap in market-first addendum and raise temperature.
  const isMarket = detectMarketIntent(userMessage);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const systemPrompt =
    nexusPrimeCore(today) +
    AXRLEN_INLINE_ADDENDUM +
    (isMarket ? AXRLEN_MARKET_ADDENDUM : "") +
    AXRLEN_SPECIFICITY_ADDENDUM +
    tierNote +
    "\n" + primary + secondary + evidenceBlock;

  const temperature = isMarket ? 0.6 : 0.3;

  const axrlenKey = Deno.env.get("AXRLEN_GEMINI_API_KEY") || "";
  const apiKey = axrlenKey || args.fallbackGeminiKey || "";
  const model = axrlenKey ? "gemini-flash-latest" : (args.fallbackModel || "gemini-flash-latest");
  if (!apiKey) {
    return {
      kind: "denied",
      access,
      intent,
      message: "AXRLEN could not obtain an inference key (AXRLEN_GEMINI_API_KEY missing and no fallback).",
    };
  }

  const textStream = await callGeminiStreamAsText(apiKey, model, systemPrompt, args.messages, temperature);

  return { kind: "stream", access, intent, textStream, brainsLoaded: matched };
}

// ── 6. Helper to wrap the raw text stream for OpenAI-compat SSE consumers ──

export function textStreamToOpenAiSse(text: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const sse = (payload: unknown) =>
    `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = text.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const t = decoder.decode(value);
          if (t) controller.enqueue(encoder.encode(sse({
            choices: [{ delta: { content: t }, index: 0, finish_reason: null }],
          })));
        }
      } finally {
        controller.enqueue(encoder.encode(sse("[DONE]")));
        controller.close();
      }
    },
  });
}
