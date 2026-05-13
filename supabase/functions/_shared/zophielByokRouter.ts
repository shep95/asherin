/**
 * Shared BYOK (Bring Your Own Key) router for the Zophiel engine.
 *
 * The user's API key never touches our database — it ships with the request
 * from localStorage. When BYOK is active, the edge function bypasses the
 * platform GEMINI_API_KEY and routes the AI call directly through the
 * provider the user picked.
 *
 * Used by: zophiel-intelmap, zophiel-code-audit, zophiel-blueprint-extract,
 *          zophiel-intel-analysis, zophiel-deep-search.
 */

export type ZophielByokProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'deepseek'
  | 'mistral'
  | 'perplexity';

export interface ZophielByokConfig {
  provider: ZophielByokProvider;
  model: string;
  apiKey: string;
}

export function isValidByok(b: unknown): b is ZophielByokConfig {
  if (!b || typeof b !== 'object') return false;
  const c = b as Record<string, unknown>;
  return (
    typeof c.provider === 'string' &&
    typeof c.model === 'string' &&
    typeof c.apiKey === 'string' &&
    c.apiKey.trim().length > 0
  );
}

interface JsonCallOptions {
  /** Per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  temperature?: number;
  /** Hard cap on response tokens (where the provider supports it). */
  maxOutputTokens?: number;
  /** Force JSON-shaped response. Default true. */
  jsonMode?: boolean;
}

/** Generic non-streaming JSON-mode AI call routed through the user's BYOK provider. */
export async function callByokJson(
  cfg: ZophielByokConfig,
  systemPrompt: string,
  userPrompt: string,
  opts: JsonCallOptions = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const temperature = opts.temperature ?? 0.3;
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;
  const jsonMode = opts.jsonMode ?? true;

  switch (cfg.provider) {
    case 'google':
      return callGemini(cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode,
      });
    case 'openai':
      return callOpenAICompat('https://api.openai.com/v1', cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode,
      });
    case 'anthropic':
      return callAnthropic(cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, maxOutputTokens, jsonMode,
      });
    case 'xai':
      return callOpenAICompat('https://api.x.ai/v1', cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode,
      });
    case 'deepseek':
      return callOpenAICompat('https://api.deepseek.com/v1', cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode,
      });
    case 'mistral':
      return callOpenAICompat('https://api.mistral.ai/v1', cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode,
      });
    case 'perplexity':
      // Perplexity does not honor response_format=json_object; rely on prompt discipline.
      return callOpenAICompat('https://api.perplexity.ai', cfg.apiKey, cfg.model, systemPrompt, userPrompt, {
        timeoutMs, temperature, maxOutputTokens, jsonMode: false,
      });
    default:
      throw new Error(`unsupported_byok_provider_${(cfg as { provider: string }).provider}`);
  }
}

// ────────────────────────── Provider implementations ──────────────────────────

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { timeoutMs: number; temperature: number; maxOutputTokens: number; jsonMode: boolean },
): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
            temperature: opts.temperature,
            maxOutputTokens: opts.maxOutputTokens,
          },
        }),
      },
    );
    if (!r.ok) {
      const txt = await r.text();
      throw makeRetryableError(r.status, `gemini_${model}_${r.status}: ${txt.slice(0, 200)}`);
    }
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || '').join('') || '';
  } finally { clearTimeout(t); }
}

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { timeoutMs: number; temperature: number; maxOutputTokens?: number; jsonMode: boolean },
): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const sys = opts.jsonMode
      ? systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.'
      : systemPrompt;
    const maxTok = opts.maxOutputTokens ?? 8192;
    const isGpt5Plus = /^gpt-5/i.test(model) || /^o\d/i.test(model);
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: ctl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userPrompt },
        ],
        // gpt-5 / o-series only accept max_completion_tokens and fixed temperature
        ...(isGpt5Plus
          ? { max_completion_tokens: maxTok }
          : { temperature: opts.temperature, max_tokens: maxTok }),
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw makeRetryableError(r.status, `byok_${r.status}: ${txt.slice(0, 200)}`);
    }
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || '';
  } finally { clearTimeout(t); }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { timeoutMs: number; maxOutputTokens: number; jsonMode: boolean },
): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const sys = opts.jsonMode
      ? systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.'
      : systemPrompt;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: ctl.signal,
      body: JSON.stringify({
        model,
        max_tokens: opts.maxOutputTokens,
        system: sys,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw makeRetryableError(r.status, `anthropic_${r.status}: ${txt.slice(0, 200)}`);
    }
    const d = await r.json();
    const parts = Array.isArray(d?.content) ? d.content : [];
    return parts.filter((p: { type?: string }) => p?.type === 'text').map((p: { text?: string }) => p.text || '').join('') || '';
  } finally { clearTimeout(t); }
}

function makeRetryableError(status: number, message: string): Error & { retryable?: boolean; status?: number } {
  const e: Error & { retryable?: boolean; status?: number } = new Error(message);
  e.status = status;
  e.retryable = status === 429 || status === 503 || status >= 500;
  return e;
}

/** Run `callByokJson` with bounded retries on transient errors. */
export async function callByokJsonWithRetry(
  cfg: ZophielByokConfig,
  systemPrompt: string,
  userPrompt: string,
  opts: JsonCallOptions & { attempts?: number } = {},
): Promise<string> {
  const attempts = opts.attempts ?? 3;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callByokJson(cfg, systemPrompt, userPrompt, opts);
    } catch (e) {
      lastErr = e;
      const retryable = (e as { retryable?: boolean })?.retryable;
      if (!retryable || i === attempts - 1) break;
      const wait = 700 * Math.pow(2.1, i) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('byok_call_failed');
}

/** Streaming-friendly Gemini URL helpers — used by zophiel-deep-search when the user's BYOK provider is Google. */
export function geminiStreamUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${apiKey}`;
}

export function geminiNonStreamUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
}
