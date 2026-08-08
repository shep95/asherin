import { ADMIN_EMAIL } from "@/lib/adminEmail";
import type { ChatMode, FileAttachment } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import { detectRelevantSkills, buildSkillInjectionPrompt } from "@/lib/autoSkillInjection";
import { buildSwarmContext } from "@/lib/swarmOrchestrator";
import { buildExactContinuationPrompt, MAX_STREAM_CONTINUATIONS, stitchAiContinuation } from "@/lib/aiContinuation";
import {
  buildThinkingPrompt,
  buildAnswerPromptWithThinking,
  extractThinking,
  stripThinkingTags,
  shouldRunThinkingPass,
} from "@/lib/aureonThinking";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const SUGGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`;

type Msg = { role: "user" | "assistant"; content: string; attachments?: FileAttachment[] };

export interface UserProfile {
  tone_preference?: string;
  topics_of_interest?: string[];
  inferred_traits?: Record<string, unknown>;
}

export interface BrainContext {
  prompt: string;
  fileContents: { name: string; content: string }[];
}

export async function streamChat({
  messages,
  mode,
  personaId,
  personaSystemPrompt,
  depth,
  userProfile,
  brainContext,
  conversationId,
  signal,
  onDelta,
  onReplace,
  onDone,
  onThinkingStart,
  onThinkingDelta,
  onThinkingDone,
}: {
  messages: Msg[];
  mode: ChatMode;
  personaId?: string | null;
  personaSystemPrompt?: string | null;
  depth?: ResponseDepth;
  userProfile?: UserProfile | null;
  brainContext?: BrainContext | null;
  conversationId?: string | null;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onReplace?: (text: string) => void;
  onDone: () => void;
  /** Ghost Chain phase 1 hooks — omit them and the reasoning pass is skipped entirely. */
  onThinkingStart?: () => void;
  onThinkingDelta?: (text: string) => void;
  onThinkingDone?: (fullThinking: string) => void;
}) {
  // Transform attachments for the backend
  const apiMessages = messages.map(m => {
    if (m.attachments?.length) {
      return {
        role: m.role,
        content: m.content,
        attachments: m.attachments.map(a => ({
          name: a.name,
          type: a.type,
          base64: a.base64,
        })),
      };
    }
    return { role: m.role, content: m.content };
  });

  // Load BYOK preferences from localStorage cache (set by AIKeysSettings).
  // BYOK-ONLY: users must connect their own provider key. If no key is
  // selected, byokProvider stays undefined and the /chat edge function
  // returns 403 BYOK_REQUIRED, which the client surfaces via the
  // ByokRequiredDialog. No in-house fallback model is used.
  let byokProvider: string | undefined;
  let byokModel: string | undefined;
  try {
    const cached = localStorage.getItem("aureon_byok_active");
    if (cached) {
      const parsed = JSON.parse(cached);
      // Ignore legacy in-house engine entries ("aureon" / "default").
      if (parsed?.provider && parsed.provider !== "aureon" && parsed.provider !== "default") {
        byokProvider = parsed.provider;
        byokModel = parsed.model;
      }
    }
  } catch { /* no selection */ }

  // Per-conversation API toggle: a globally-selected BYOK provider (set in Settings)
  // applies to ALL conversations by default. Users can EXPLICITLY disable it for a
  // single conversation by toggling it off in ConversationApiToggles (stored as `false`).
  // Only `=== false` blocks BYOK — undefined/missing means "respect global setting".
  if (conversationId && byokProvider) {
    try {
      const all = JSON.parse(localStorage.getItem("aureon_conv_api_toggles") || "{}");
      const convToggles = all[conversationId] || {};
      if (convToggles[byokProvider] === false) {
        byokProvider = undefined;
        byokModel = undefined;
      }
    } catch { /* respect global setting */ }
  }

  // Get auth token for BYOK key lookup
  let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let userEmail: string | null = null;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authToken = session.access_token;
    userEmail = session?.user?.email ?? null;
    if (!byokProvider && session?.user?.id) {
      const { data: pref } = await supabase
        .from("user_model_preferences")
        .select("active_provider, active_model")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const provider = pref?.active_provider;
      if (provider && provider !== "default" && provider !== "aureon") {
        byokProvider = provider;
        byokModel = pref?.active_model || undefined;
        localStorage.setItem("aureon_byok_active", JSON.stringify({ provider: byokProvider, model: byokModel }));
      }
    }
  } catch { /* fallback to anon key */ }



  // Auto-detect and inject domain skills based on conversation context
  const detectedSkills = detectRelevantSkills(messages.map(m => ({ role: m.role, content: m.content })));
  const skillInjection = buildSkillInjectionPrompt(detectedSkills);

  // Swarm Agent Orchestration — select best specialist agent for the conversation
  const swarmContext = buildSwarmContext(messages.map(m => ({ role: m.role, content: m.content })));
  const swarmInjection = swarmContext.swarmPrompt;
  const activeAgentId = swarmContext.activeAgent.id;

  let assistantAccum = "";
  const wrappedDelta = (t: string) => { assistantAccum += t; onDelta(t); };
  const outputLimitMarker = /\n?\n?\[GENERATION_INCOMPLETE:[^\]]+\]/gi;

  const numberedFormat = (() => {
    try {
      const m = JSON.parse(localStorage.getItem("aureon_numbered_format_off") || "{}");
      return !(conversationId && m[conversationId] === true);
    } catch { return true; }
  })();

  const looksIncomplete = (text: string, latestChunk = text) => {
    if (!text) return false;
    if (/GENERATION_INCOMPLETE|stopped at the output-token limit|finish_reason\s*[:=]\s*(?:length|max_tokens)/i.test(latestChunk)) return true;
    if (((text.match(/```/g) || []).length % 2) === 1) return true;
    if (/\{\s*"files"\s*:\s*\[/i.test(text) && !/\]\s*}\s*```?\s*$/s.test(text.trim())) return true;
    return false;
  };

  const fetchAndRead = async (requestMessages: typeof apiMessages, onText?: (text: string) => void) => {
    // Transient upstream congestion (the provider is busy, not the key) is
    // retried silently here. Only a genuine key problem — missing, invalid,
    // revoked, out of quota — is allowed to raise the BYOK dialog, so a heavy
    // person-search turn no longer looks like "your API key is broken".
    const TRANSIENT_ATTEMPTS = 3;
    let resp!: Response;

    for (let attempt = 0; attempt < TRANSIENT_ATTEMPTS; attempt++) {
      resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages: requestMessages, mode, personaId, personaSystemPrompt, depth, userProfile, byokProvider, byokModel, brainContext, skillInjection, swarmInjection, activeAgentId, numberedFormat }),
        signal,
      });

      if (resp.ok) break;

      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      const transient = err?.code === "UPSTREAM_BUSY" || resp.status === 502 || resp.status === 503 || resp.status === 504;

      if (transient && attempt < TRANSIENT_ATTEMPTS - 1 && !signal?.aborted) {
        const waitMs = Math.max(1200, Number(err?.retryAfterMs) || 0) * (attempt + 1);
        await new Promise((r) => setTimeout(r, waitMs + Math.random() * 400));
        continue;
      }

      if (!transient && (err?.code === "BYOK_REQUIRED" || resp.status === 403)) {
        try {
          const { triggerByokRequired } = await import("@/components/ByokRequiredDialog");
          triggerByokRequired({ source: "aureon-chat", reason: err?.error || "An API key is required." });
        } catch { /* noop */ }
      }

      throw new Error(err?.error || `HTTP ${resp.status}`);
    }

    if (!resp.body) throw new Error("No response body");


    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let passText = "";
    let passIncomplete = false;
    const consumePassContent = (content: string) => {
      const cleaned = content.replace(outputLimitMarker, () => {
        passIncomplete = true;
        return "";
      });
      if (!cleaned) return;
      passText += cleaned;
      onText?.(cleaned);
    };

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) consumePassContent(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) consumePassContent(content);
        } catch { /* ignore */ }
      }
    }

    return { text: passText, incompleteSignal: passIncomplete };
  };

  // ── GHOST CHAIN — PHASE 1: the thinking call ────────────────────────────
  // The model reasons inside <thinking> tags; tokens stream straight into the
  // reasoning panel. Its output is then injected as hidden context for the
  // answer call. Fail-soft by design: if the reasoning pass errors, times out
  // or is gated off, the answer call runs exactly as before.
  const lastUserIdx = (() => {
    for (let i = apiMessages.length - 1; i >= 0; i--) if (apiMessages[i].role === "user") return i;
    return -1;
  })();
  const lastUserContent = lastUserIdx >= 0 ? String(apiMessages[lastUserIdx].content ?? "") : "";

  let thinkingText = "";
  if (onThinkingDelta && lastUserIdx >= 0 && shouldRunThinkingPass(lastUserContent)) {
    onThinkingStart?.();
    try {
      const thinkingMessages = apiMessages.map((m, i) =>
        i === lastUserIdx ? { ...m, content: buildThinkingPrompt(lastUserContent) } : m,
      );
      let rawThinking = "";
      let closed = false;
      const pass = await fetchAndRead(thinkingMessages, (chunk) => {
        rawThinking += chunk;
        if (closed) return;
        if (/<\/thinking>/i.test(rawThinking)) closed = true;
        // Re-derive from the accumulator so a tag split across chunks never leaks.
        const visible = stripThinkingTags(extractThinking(rawThinking));
        const delta = visible.slice(thinkingText.length);
        if (delta) { thinkingText = visible; onThinkingDelta(delta); }
      });
      const finalThinking = extractThinking(rawThinking || pass.text);
      if (finalThinking.length > thinkingText.length) {
        onThinkingDelta(finalThinking.slice(thinkingText.length));
      }
      thinkingText = finalThinking;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") throw e;
      thinkingText = ""; // degrade to the single-call path
    }
    onThinkingDone?.(thinkingText);
  }

  // ── GHOST CHAIN — PHASE 2: the answer call ──────────────────────────────
  if (thinkingText && lastUserIdx >= 0) {
    apiMessages[lastUserIdx] = {
      ...apiMessages[lastUserIdx],
      content: buildAnswerPromptWithThinking(lastUserContent, thinkingText),
    };
  }

  let requestMessages = apiMessages;
  for (let attempt = 0; attempt <= MAX_STREAM_CONTINUATIONS; attempt++) {
    const before = assistantAccum.length;
    const pass = await fetchAndRead(requestMessages, attempt === 0 ? wrappedDelta : undefined);
    if (attempt > 0) {
      const stitched = stitchAiContinuation(assistantAccum, pass.text);
      assistantAccum = stitched.text;
      if (stitched.strategy === "restart-replace" && onReplace) {
        onReplace(stitched.text);
      } else if (stitched.delta) {
        onDelta(stitched.delta);
      }
    }
    const latestChunk = assistantAccum.slice(before);
    const mustContinue = pass.incompleteSignal || looksIncomplete(assistantAccum, latestChunk);
    if (!mustContinue || (assistantAccum.length === before && !pass.text)) break;
    requestMessages = [
      ...apiMessages,
      { role: "assistant" as const, content: assistantAccum },
      {
        role: "user" as const,
        content: buildExactContinuationPrompt(assistantAccum),
      },
    ];
  }

  onDone();

  // ── Fire-and-forget memory extraction (cross-chat persistent rules) ──
  // Only mine the LAST user message; skip if no auth token (anon).
  try {
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (lastUser?.content && authToken && authToken !== import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      const EXTRACT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-extract`;
      fetch(EXTRACT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          userMessage: lastUser.content,
          assistantMessage: assistantAccum,
          conversationId,
        }),
      }).catch(() => { /* silent */ });
    }
  } catch { /* silent */ }
}

// ── Multi-Model Consensus ──────────────────────────────────────────────
const CONSENSUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-consensus`;

export interface ConsensusModel {
  provider: string;
  model: string;
}

export interface ConsensusResponse {
  provider: string;
  model: string;
  content: string;
  error: string | null;
  latencyMs: number;
}

export interface ConsensusResult {
  consensus: boolean;
  confidence: {
    overallConfidence: number;
    level: "high" | "medium" | "low" | "critical_divergence";
    needsHumanReview: boolean;
    reasons: string[];
    jaccardSimilarity: number;
  };
  crossValidation: {
    provider: string;
    model: string;
    totalClaims: number;
    validatedClaims: number;
    unvalidatedClaims: string[];
    validationRate: number;
  }[];
  ensemble: {
    agreedFacts: string[];
    contestedFacts: string[];
    agreementRatio: number;
  };
  verdict: { index: number; provider: string; model: string } | null;
  responses: ConsensusResponse[];
  timing: { parallelMs: number; totalMs: number };
  // Legacy compat
  similarity?: number;
  modelCount?: number;
  successCount?: number;
}

export async function fetchConsensus({
  messages,
  models,
  mode,
}: {
  messages: Msg[];
  models: ConsensusModel[];
  mode: ChatMode;
}): Promise<ConsensusResult> {
  let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authToken = session.access_token;
  } catch { /* fallback */ }

  const resp = await fetch(CONSENSUS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      models,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  return resp.json();
}

export async function fetchSuggestions(lastMessage: string): Promise<string[]> {
  try {
    const resp = await fetch(SUGGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ lastAssistantMessage: lastMessage }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}
