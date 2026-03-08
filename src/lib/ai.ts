import type { ChatMode, FileAttachment } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const SUGGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest`;

type Msg = { role: "user" | "assistant"; content: string; attachments?: FileAttachment[] };

export interface UserProfile {
  tone_preference?: string;
  topics_of_interest?: string[];
  inferred_traits?: Record<string, unknown>;
}

export async function streamChat({
  messages,
  mode,
  personaId,
  personaSystemPrompt,
  depth,
  userProfile,
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

  // Load BYOK preferences from localStorage cache (set by AIKeysSettings)
  let byokProvider: string | undefined;
  let byokModel: string | undefined;
  try {
    const cached = localStorage.getItem("aureon_byok_active");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.provider && parsed.provider !== "default") {
        byokProvider = parsed.provider;
        byokModel = parsed.model;
      }
    }
  } catch { /* ignore */ }

  // Get auth token for BYOK key lookup
  let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authToken = session.access_token;
  } catch { /* fallback to anon key */ }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ messages: apiMessages, mode, personaId, personaSystemPrompt, depth, userProfile, byokProvider, byokModel }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
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
}

export interface ConsensusResult {
  consensus: boolean;
  similarity: number;
  modelCount: number;
  successCount: number;
  responses: ConsensusResponse[];
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
