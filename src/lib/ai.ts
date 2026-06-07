import { ADMIN_EMAIL } from "@/lib/adminEmail";
import type { ChatMode, FileAttachment } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import { detectRelevantSkills, buildSkillInjectionPrompt } from "@/lib/autoSkillInjection";
import { buildSwarmContext } from "@/lib/swarmOrchestrator";

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
  onDone,
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
  onDone: () => void;
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
  // DEFAULT ENGINE = Aureon Algorithm. If nothing is stored, or the user
  // hasn't explicitly chosen a BYOK provider, we route through the Aureon
  // Algorithm (Railway SOLIA brain). Lovable AI / Gemini is NOT used.
  let byokProvider: string | undefined = "aureon";
  let byokModel: string | undefined = "aureon-algorithm";
  try {
    const cached = localStorage.getItem("aureon_byok_active");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.provider) {
        byokProvider = parsed.provider;
        byokModel = parsed.model;
      }
    }
  } catch { /* default to aureon */ }

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
  } catch { /* fallback to anon key */ }

  // UNIFIED PIPELINE: free, paid, and admin all flow through /chat by default
  // (same system prompt, skill injection, swarm orchestrator, archive grounding).
  // The /chat edge function enforces its own tier gating and rate limits.
  // Users can still EXPLICITLY pick the Aureon Algorithm (Railway SOLIA brain)
  // via the AureonEngineToggle — that sets byokProvider="aureon" themselves.
  // Previously free users were force-routed to Railway, which produced
  // off-topic news-feed answers for general queries. Removed.

  // ── AUREON ALGORITHM ROUTING ──────────────────────────────────────────
  // When the user picks "aureon" as their provider, proxy to the dedicated
  // /aureon-algorithm-chat function (Railway-hosted open-weight Aureon LLM).
  // It handles its own rate limiting + subscription gating.
  if (byokProvider === "aureon") {
    const ALGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aureon-algorithm-chat`;
    const lastUser = [...apiMessages].reverse().find(m => m.role === "user")?.content || "";
    const resp = await fetch(ALGO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ message: lastUser, messages: apiMessages, session_id: conversationId ?? undefined }),
      signal,
    });
    const data = await resp.json().catch(() => ({ error: "Invalid response" }));
    if (!resp.ok) throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
    const reply: string = data?.reply || "(empty response)";
    // Simulate streaming for a smooth UI experience
    const tokens = reply.match(/\S+\s*|\s+/g) || [reply];
    for (const tok of tokens) {
      if (signal?.aborted) break;
      onDelta(tok);
      await new Promise(r => setTimeout(r, 12));
    }
    onDone();
    return;
  }

  // Auto-detect and inject domain skills based on conversation context
  const detectedSkills = detectRelevantSkills(messages.map(m => ({ role: m.role, content: m.content })));
  const skillInjection = buildSkillInjectionPrompt(detectedSkills);

  // Swarm Agent Orchestration — select best specialist agent for the conversation
  const swarmContext = buildSwarmContext(messages.map(m => ({ role: m.role, content: m.content })));
  const swarmInjection = swarmContext.swarmPrompt;
  const activeAgentId = swarmContext.activeAgent.id;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ messages: apiMessages, mode, personaId, personaSystemPrompt, depth, userProfile, byokProvider, byokModel, brainContext, skillInjection, swarmInjection, activeAgentId }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    if (resp.status === 503 || resp.status === 502 || /overload/i.test(err?.error || "")) {
      try {
        const { triggerByokRequired } = await import("@/components/ByokRequiredDialog");
        triggerByokRequired({ source: "aureon-chat", reason: "AUREON LLM API is overloaded right now." });
      } catch { /* noop */ }
    }
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

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
        if (content) onDelta(content);
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
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
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
