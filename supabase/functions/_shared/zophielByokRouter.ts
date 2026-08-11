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

import { getModelCapability, tierPrompts, extractJson } from './modelCapability.ts';

export type ZophielByokProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'deepseek'
  | 'mistral'
  | 'perplexity'
  | 'venice';

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

// ─────────────────────── Per-key adaptive rate-limit brain ───────────────────
//
// Edge invocations are short-lived, but a single invocation (e.g. Zerlal
// iterating files, Cross running multi-step analysis) can fire many BYOK calls
// in a row. When one hits 429, we now:
//   1. Read the provider's Retry-After header / Gemini retryDelay body,
//   2. Park that specific (provider, key-fingerprint) in a cooldown map so the
//      next call in this invocation *waits* instead of blindly re-hitting the
//      limit,
//   3. Retry with a much longer, provider-informed backoff on 429/503,
//   4. Surface a structured RATE_LIMITED error carrying `retryAfterMs` so the
//      client can resume automatically instead of forcing the user to restart.
//
// Key fingerprint is a non-reversible hash prefix — never store or log the raw
// API key.
const cooldowns = new Map<string, number>(); // fingerprint → resume-at epoch ms
const MAX_COOLDOWN_MS = 90_000;

async function keyFingerprint(provider: string, apiKey: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(`${provider}:${apiKey}`);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(hash).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${provider}:${hex}`;
  } catch {
    return `${provider}:${apiKey.slice(-6)}`;
  }
}

function parseRetryAfterMs(headers: Headers, body: string): number | null {
  const ra = headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.min(MAX_COOLDOWN_MS, Math.max(500, secs * 1000));
    const date = Date.parse(ra);
    if (!Number.isNaN(date)) return Math.min(MAX_COOLDOWN_MS, Math.max(500, date - Date.now()));
  }
  // Gemini embeds retry hints inside the JSON error body.
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (m) return Math.min(MAX_COOLDOWN_MS, Math.max(500, Math.round(parseFloat(m[1]) * 1000)));
  return null;
}

async function respectCooldown(fp: string): Promise<void> {
  const until = cooldowns.get(fp);
  if (!until) return;
  const wait = until - Date.now();
  if (wait <= 0) { cooldowns.delete(fp); return; }
  await new Promise((r) => setTimeout(r, Math.min(wait, MAX_COOLDOWN_MS)));
  cooldowns.delete(fp);
}

function armCooldown(fp: string, ms: number) {
  cooldowns.set(fp, Date.now() + Math.min(MAX_COOLDOWN_MS, ms));
}


/**
 * Generic non-streaming JSON-mode AI call routed through the user's BYOK provider.
 *
 * Two model-awareness layers run here so every caller inherits them:
 *
 *  1. PROMPT TIERING — the doctrine stack is sized against the selected model's
 *     real context window. Oversized payloads are compressed by us (contract
 *     blocks pinned, illustrative blocks dropped) instead of being blind-cut by
 *     the provider, which is what made small BYOK models answer like generic
 *     chat assistants.
 *  2. JSON DISCIPLINE — `response_format` is only sent to providers that honor
 *     it; everywhere else the instruction is carried in the prompt and the
 *     response goes through a fence/balance/repair extractor before returning.
 */
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

  const cap = getModelCapability(cfg.provider, cfg.model, maxOutputTokens);
  const tiered = tierPrompts(systemPrompt, userPrompt, cap.inputBudgetChars);
  if (tiered.compressed) {
    console.warn(
      `[byok:${cfg.provider}] prompt tiered for ${cfg.model} (${cap.tier}): ` +
      `${tiered.originalChars} → ${tiered.finalChars} chars (budget ${cap.inputBudgetChars})`,
    );
  }
  const sys = tiered.system;
  const usr = tiered.user;
  // Native json_object only where the provider actually enforces it. Elsewhere
  // the instruction rides in the prompt and `extractJson` does the enforcing.
  const nativeJson = jsonMode && cap.nativeJsonMode;

  const raw = await (() => {
    switch (cfg.provider) {
      case 'google':
        return callGemini(cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode: nativeJson,
        });
      case 'openai':
        return callOpenAICompat('https://api.openai.com/v1', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson,
        });
      case 'anthropic':
        return callAnthropic(cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, maxOutputTokens, jsonMode,
        });
      case 'xai':
        return callOpenAICompat('https://api.x.ai/v1', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson,
        });
      case 'deepseek':
        return callOpenAICompat('https://api.deepseek.com/v1', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson,
        });
      case 'mistral':
        return callOpenAICompat('https://api.mistral.ai/v1', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson,
        });
      case 'perplexity':
        // Perplexity does not honor response_format=json_object; prompt discipline only.
        return callOpenAICompat('https://api.perplexity.ai', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson: false,
        });
      case 'venice':
        // Venice AI is OpenAI-compatible and hosts open-weights models. It
        // accepts response_format but honors it inconsistently per model, so
        // JSON is enforced on our side via extractJson below.
        return callOpenAICompat('https://api.venice.ai/api/v1', cfg.apiKey, cfg.model, sys, usr, {
          timeoutMs, temperature, maxOutputTokens, jsonMode, nativeJson: false,
        });
      default:
        throw new Error(`unsupported_byok_provider_${(cfg as { provider: string }).provider}`);
    }
  })();

  if (!jsonMode) return raw;

  const repaired = extractJson(raw);
  if (repaired) return repaired;
  // Nothing JSON-shaped came back. Return the raw text so callers keep their
  // own prose fallbacks instead of receiving a fabricated object.
  console.warn(`[byok:${cfg.provider}] json extraction failed for ${cfg.model}; returning raw text`);
  return raw;
}


// ────────────────────────── Provider implementations ──────────────────────────

// Google periodically retires model ids on the direct Generative Language API
// (v1beta). When a user's saved BYOK model is one of the retired ids, the call
// returns 404 NOT_FOUND ("This model models/<id> is no longer available"), which
// breaks Aureon chat with no auto-recovery. We map known-retired ids to their
// current stable equivalent BEFORE the request, and additionally auto-fallback
// on a 404 to `gemini-flash-latest` (Google's rolling alias) so a stale saved
// model never dead-ends a user's chat.
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  // Retired / deprecated → current stable
  "gemini-pro": "gemini-flash-latest",
  "gemini-1.0-pro": "gemini-flash-latest",
  "gemini-1.5-pro": "gemini-pro-latest",
  "gemini-1.5-pro-latest": "gemini-pro-latest",
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-1.5-flash-latest": "gemini-flash-latest",
  "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
};
const GEMINI_404_FALLBACK = "gemini-flash-latest";

async function geminiFetch(apiKey: string, model: string, body: unknown, signal: AbortSignal) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify(body) },
  );
}

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
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
      generationConfig: {
        ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      },
    };

    const primary = GEMINI_MODEL_ALIASES[model] || model;
    let r = await geminiFetch(apiKey, primary, body, ctl.signal);

    // Auto-fallback: model retired on user's key → retry once on rolling alias.
    if (r.status === 404 && primary !== GEMINI_404_FALLBACK) {
      const _drain = await r.text().catch(() => '');
      console.warn(`[byok:google] model ${primary} returned 404; falling back to ${GEMINI_404_FALLBACK}`);
      r = await geminiFetch(apiKey, GEMINI_404_FALLBACK, body, ctl.signal);
    }

    if (!r.ok) {
      const txt = await r.text();
      throw makeRetryableError(r.status, `gemini_${primary}_${r.status}: ${txt.slice(0, 200)}`, parseRetryAfterMs(r.headers, txt));
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
  opts: { timeoutMs: number; temperature: number; maxOutputTokens?: number; jsonMode: boolean; nativeJson?: boolean },
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
        ...(opts.nativeJson ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw makeRetryableError(r.status, `byok_${r.status}: ${txt.slice(0, 200)}`, parseRetryAfterMs(r.headers, txt));
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
      throw makeRetryableError(r.status, `anthropic_${r.status}: ${txt.slice(0, 200)}`, parseRetryAfterMs(r.headers, txt));
    }
    const d = await r.json();
    const parts = Array.isArray(d?.content) ? d.content : [];
    return parts.filter((p: { type?: string }) => p?.type === 'text').map((p: { text?: string }) => p.text || '').join('') || '';
  } finally { clearTimeout(t); }
}

function makeRetryableError(
  status: number,
  message: string,
  retryAfterMs: number | null = null,
): Error & { retryable?: boolean; status?: number; retryAfterMs?: number; code?: string } {
  const e: Error & { retryable?: boolean; status?: number; retryAfterMs?: number; code?: string } = new Error(message);
  e.status = status;
  e.retryable = status === 429 || status === 503 || status >= 500;
  if (status === 429) e.code = "RATE_LIMITED";
  if (retryAfterMs != null) e.retryAfterMs = retryAfterMs;
  return e;
}

/**
 * Run `callByokJson` with per-key adaptive retries.
 * - Honors Retry-After / Gemini retryDelay hints.
 * - Parks the specific API key in a shared cooldown map so the *next* call in
 *   this invocation waits instead of blindly re-hitting the limit.
 * - Retries 429/503/5xx up to `attempts` (default 5) with jittered backoff.
 * - On terminal 429, throws an error carrying `code=RATE_LIMITED` and
 *   `retryAfterMs` so the caller can render a resume-in-Ns state instead of
 *   forcing the user to restart the whole flow.
 */
export async function callByokJsonWithRetry(
  cfg: ZophielByokConfig,
  systemPrompt: string,
  userPrompt: string,
  opts: JsonCallOptions & { attempts?: number } = {},
): Promise<string> {
  const attempts = opts.attempts ?? 5;
  const fp = await keyFingerprint(cfg.provider, cfg.apiKey);
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    // If the previous call from this invocation parked this key, wait it out
    // before hammering the provider again.
    await respectCooldown(fp);
    try {
      return await callByokJson(cfg, systemPrompt, userPrompt, opts);
    } catch (e) {
      lastErr = e;
      const err = e as { retryable?: boolean; status?: number; retryAfterMs?: number };
      if (!err.retryable || i === attempts - 1) break;
      // Prefer server hint; otherwise exponential backoff capped at 30s.
      const backoff = Math.min(30_000, 900 * Math.pow(2, i) + Math.random() * 400);
      const wait = err.retryAfterMs && err.retryAfterMs > 0 ? err.retryAfterMs : backoff;
      // Park the key: no other in-flight call in this invocation should try
      // sooner than this — that's what turns "keeps hitting the rate limit"
      // into "waits once, resumes".
      if (err.status === 429 || err.status === 503) armCooldown(fp, wait);
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
