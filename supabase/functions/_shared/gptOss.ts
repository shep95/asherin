// ──────────────────────────────────────────────────────────────────────────
// gpt-oss (Responses API) client — for the self-hosted Railway backend at
//   https://gpt-oss-production-f1f5.up.railway.app
//
// The backend speaks the OpenAI **Responses API** (`POST /v1/responses`), not
// the Chat Completions API. This helper:
//   1. Converts OpenAI-style chat messages → Responses request shape
//      (system → `instructions`, rest → `input` items)
//   2. Calls the upstream with retries + exponential backoff
//   3. Transforms the SSE event stream into the OpenAI Chat-Completions delta
//      format the rest of the app (and the browser client) already understands
//      (`data: {"choices":[{"delta":{"content":"..."}}]}\n\n` + `data: [DONE]`)
// ──────────────────────────────────────────────────────────────────────────

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GptOssConfig {
  baseUrl?: string;      // e.g. https://host/v1
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export function resolveGptOssConfig(overrides: GptOssConfig = {}): Required<GptOssConfig> {
  const baseUrlRaw = (overrides.baseUrl
    || Deno.env.get("GPT_OSS_URL")
    || "https://gpt-oss-production-f1f5.up.railway.app/v1").trim();
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  return {
    baseUrl,
    apiKey: overrides.apiKey ?? (Deno.env.get("GPT_OSS_API_KEY") || ""),
    model: overrides.model ?? (Deno.env.get("GPT_OSS_MODEL") || "gpt-oss-120b"),
    temperature: overrides.temperature ?? 0.7,
    maxOutputTokens: overrides.maxOutputTokens ?? 8192,
    reasoningEffort: overrides.reasoningEffort ?? "low",
  };
}

/** Convert OpenAI Chat messages into a Responses API request body. */
export function buildResponsesPayload(messages: ChatMsg[], cfg: Required<GptOssConfig>, stream: boolean) {
  const systemParts: string[] = [];
  const input: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string") continue;
    if (m.role === "system") {
      systemParts.push(m.content);
    } else if (m.role === "user" || m.role === "assistant") {
      input.push({ role: m.role, content: m.content });
    }
  }
  if (input.length === 0) input.push({ role: "user", content: "Hello" });

  return {
    model: cfg.model,
    instructions: systemParts.join("\n\n") || undefined,
    input,
    stream,
    temperature: cfg.temperature,
    max_output_tokens: cfg.maxOutputTokens,
    reasoning: { effort: cfg.reasoningEffort },
  };
}

export interface CallOpts {
  retries?: number;
  signal?: AbortSignal;
}

/** POST to /v1/responses with streaming. Returns the raw upstream Response (SSE). */
export async function callGptOssStream(
  messages: ChatMsg[],
  overrides: GptOssConfig = {},
  opts: CallOpts = {},
): Promise<Response> {
  const cfg = resolveGptOssConfig(overrides);
  const url = `${cfg.baseUrl}/responses`;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  const body = JSON.stringify(buildResponsesPayload(messages, cfg, true));

  const max = opts.retries ?? 2;
  let last: Response | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      last = await fetch(url, { method: "POST", headers, body, signal: opts.signal });
      if (last.ok) return last;
      if (last.status !== 429 && last.status < 500) return last;
      lastErr = await last.text().catch(() => "");
      console.warn(`[gpt-oss] ${last.status} attempt ${attempt + 1}: ${lastErr.slice(0, 200)}`);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[gpt-oss] threw attempt ${attempt + 1}: ${lastErr}`);
      last = null;
    }
    if (attempt < max) {
      await new Promise((r) => setTimeout(r, Math.min(400 * 2 ** attempt + Math.random() * 200, 2500)));
    }
  }
  if (last) return last;
  // Synthesize a failed response so callers can inspect status uniformly.
  return new Response(lastErr || "upstream unreachable", { status: 502 });
}

/** Non-streaming call — returns the assembled assistant text. */
export async function callGptOssText(messages: ChatMsg[], overrides: GptOssConfig = {}, opts: CallOpts = {}): Promise<string> {
  const cfg = resolveGptOssConfig(overrides);
  const url = `${cfg.baseUrl}/responses`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  const body = JSON.stringify(buildResponsesPayload(messages, cfg, false));
  const r = await fetch(url, { method: "POST", headers, body, signal: opts.signal });
  if (!r.ok) throw new Error(`gpt-oss ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const out = Array.isArray(data?.output) ? data.output : [];
  let text = "";
  for (const item of out) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c.text === "string") text += c.text;
        else if (c?.type === "text" && typeof c.text === "string") text += c.text;
      }
    }
  }
  return text || "(empty response)";
}

/**
 * Transform a Responses-API SSE stream into Chat-Completions delta SSE.
 * Only `response.output_text.delta` events surface as user-visible content;
 * reasoning_text deltas are intentionally dropped (model's hidden scratchpad).
 */
export function responsesSseToChatCompletionsSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buf = "";
      let currentEvent = "";
      const flushLine = (raw: string) => {
        const line = raw.replace(/\r$/, "");
        if (line === "") {
          currentEvent = "";
          return;
        }
        if (line.startsWith(":")) return; // SSE comment / heartbeat
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
          return;
        }
        if (!line.startsWith("data:")) return;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) return;
        // The Responses API ALWAYS sends data lines with a `type` field, so we can
        // dispatch on the JSON payload itself — but we also honor `currentEvent`
        // when present (some proxies strip the `event:` prefix).
        let parsed: any;
        try { parsed = JSON.parse(jsonStr); } catch { return; }
        const type = parsed?.type || currentEvent;
        if (type === "response.output_text.delta") {
          const delta = parsed?.delta;
          if (typeof delta === "string" && delta.length > 0) {
            // Detect upstream "backend not configured" sentinel and surface a clean message
            if (/\[backend not configured\]/i.test(delta)) {
              const friendly = "Aureon's free-tier engine is temporarily offline. Add your own API key in Settings → BYOK to continue uninterrupted, or try again in a few minutes.";
              const chunk = JSON.stringify({ choices: [{ delta: { content: friendly }, index: 0, finish_reason: "stop" }] });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              return;
            }
            const chunk = JSON.stringify({ choices: [{ delta: { content: delta }, index: 0, finish_reason: null }] });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        } else if (type === "response.completed" || type === "response.failed" || type === "response.incomplete") {
          // emit nothing extra; [DONE] is appended below
        } else if (type === "error") {
          const msg = parsed?.error?.message || parsed?.message || "upstream error";
          const chunk = JSON.stringify({ choices: [{ delta: { content: `\n\n[error] ${msg}` }, index: 0, finish_reason: "stop" }] });
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        // Everything else (reasoning_text.delta, output_item.added, etc.) is ignored.
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            flushLine(line);
          }
        }
        if (buf.length) flushLine(buf);
      } catch (e) {
        console.error("[gpt-oss] stream transform error:", e);
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
