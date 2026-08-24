/**
 * MODEL CAPABILITY LEDGER  —  provider/model-aware prompt tiering.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Every Asherin AI surface ships the same doctrine stack to the model:
 * the pattern-recognition kernel, the thinking-pattern database, the domain
 * atlas, verdict contracts, dork ladders. On Gemini (1M-token window) the
 * whole stack lands intact and the model reasons with it. On a 24B open-weights
 * BYOK model with a 32k window, the provider silently truncates the tail of the
 * prompt — which is exactly where the OUTPUT CONTRACT lives. The model then
 * answers as a generic chat assistant and the operator sees "basic" output with
 * no idea why.
 *
 * Silent provider-side truncation is the flaw. The fix is deterministic
 * client-side tiering: we know each model's window, we measure the payload, and
 * when it does not fit we COMPRESS THE DOCTRINE OURSELVES — dropping the lowest
 * -signal blocks and guaranteeing the contract survives — instead of letting the
 * provider cut a blind suffix.
 *
 * Second flaw covered here: `response_format: json_object` is an OpenAI
 * extension. Several OpenAI-compatible hosts accept the field and ignore it, or
 * reject it with a 400. Both are recorded per provider so the router can adapt.
 *
 * Budgets are expressed in CHARACTERS (≈ 4 chars/token, conservative) because
 * that is what we can measure without a tokenizer in the edge runtime.
 */

export type CapProvider =
  | "google" | "openai" | "anthropic" | "xai"
  | "deepseek" | "mistral" | "perplexity" | "venice" | "openrouter";

export interface ModelCapability {
  /** Usable INPUT budget in characters (window minus output reserve minus safety margin). */
  inputBudgetChars: number;
  /** Provider honors `response_format: { type: "json_object" }` reliably. */
  nativeJsonMode: boolean;
  /** Human label for logs / telemetry. */
  tier: "frontier" | "large" | "mid" | "small";
}

/** ≈4 chars per token; deliberately pessimistic so we under-fill rather than overflow. */
export const CHARS_PER_TOKEN = 4;

const T = (tokens: number) => tokens * CHARS_PER_TOKEN;

/**
 * Reserve for the completion + provider overhead. We never spend the whole
 * window on input: the model still needs room to answer.
 */
function budgetFrom(windowTokens: number, maxOutTokens = 8192): number {
  const usable = Math.max(4_000, windowTokens - maxOutTokens - 1_000);
  return T(usable);
}

/** Per-model overrides, matched by case-insensitive substring on the model id. */
interface ModelRule { match: RegExp; windowTokens: number; tier: ModelCapability["tier"] }

const MODEL_RULES: Record<CapProvider, ModelRule[]> = {
  google: [
    { match: /gemini-(1\.0|1\.5-flash-8b)/i, windowTokens: 32_000, tier: "small" },
    { match: /gemini-2\.0/i, windowTokens: 1_000_000, tier: "large" },
    { match: /gemini/i, windowTokens: 1_000_000, tier: "frontier" },
  ],
  openai: [
    { match: /gpt-3\.5/i, windowTokens: 16_000, tier: "small" },
    { match: /^gpt-4($|-)/i, windowTokens: 8_000, tier: "small" },
    { match: /gpt-4-turbo|gpt-4o/i, windowTokens: 128_000, tier: "large" },
    { match: /gpt-4\.1|gpt-5|^o\d/i, windowTokens: 400_000, tier: "frontier" },
  ],
  anthropic: [
    { match: /claude-3-(haiku|sonnet)-20/i, windowTokens: 200_000, tier: "mid" },
    { match: /claude/i, windowTokens: 200_000, tier: "frontier" },
  ],
  xai: [
    { match: /grok-(4|5)/i, windowTokens: 256_000, tier: "frontier" },
    { match: /grok/i, windowTokens: 128_000, tier: "large" },
  ],
  deepseek: [
    { match: /deepseek/i, windowTokens: 64_000, tier: "large" },
  ],
  mistral: [
    { match: /ministral-3b|open-mixtral|nemo/i, windowTokens: 32_000, tier: "small" },
    { match: /mistral-(large|medium)|magistral|codestral|pixtral/i, windowTokens: 128_000, tier: "large" },
    { match: /mistral|ministral/i, windowTokens: 32_000, tier: "mid" },
  ],
  perplexity: [
    { match: /sonar-(pro|reasoning|deep)/i, windowTokens: 128_000, tier: "large" },
    { match: /sonar|llama/i, windowTokens: 32_000, tier: "mid" },
  ],
  venice: [
    // Venice hosts open-weights models. Windows are far below Gemini's and the
    // small ones are where doctrine truncation actually bites operators.
    { match: /llama-3-8b|8b/i, windowTokens: 8_000, tier: "small" },
    { match: /llama-3\.1-405b/i, windowTokens: 64_000, tier: "large" },
    { match: /mistral-31-24b|24b/i, windowTokens: 128_000, tier: "mid" },
    { match: /dolphin-72b|72b/i, windowTokens: 32_000, tier: "mid" },
    { match: /venice-uncensored/i, windowTokens: 32_000, tier: "mid" },
  ],
  openrouter: [
    // OpenRouter proxies other vendors; the id carries the real model.
    { match: /ox-alpha/i, windowTokens: 256_000, tier: "frontier" },
    { match: /gpt-4o-mini|mini|flash/i, windowTokens: 128_000, tier: "large" },
    { match: /gpt-5|claude-opus|gemini-3|o\d/i, windowTokens: 200_000, tier: "frontier" },
    { match: /./, windowTokens: 128_000, tier: "large" },
  ],
};

/** Providers whose OpenAI-compatible surface honors json_object reliably. */
const NATIVE_JSON: Record<CapProvider, boolean> = {
  google: true,       // responseMimeType: application/json — native
  openai: true,
  anthropic: false,   // no response_format; prompt discipline + repair
  xai: true,
  deepseek: true,
  mistral: true,
  perplexity: false,
  venice: false,      // accepted by the API, inconsistently honored per model
  openrouter: true,   // normalizes response_format across routed vendors
};

const DEFAULT_WINDOW: Record<CapProvider, number> = {
  google: 1_000_000, openai: 128_000, anthropic: 200_000, xai: 128_000,
  deepseek: 64_000, mistral: 32_000, perplexity: 32_000, venice: 32_000,
  openrouter: 128_000,
};

export function getModelCapability(
  provider: string,
  model: string,
  maxOutputTokens = 8192,
): ModelCapability {
  const p = (provider as CapProvider);
  const rules = MODEL_RULES[p];
  let windowTokens = DEFAULT_WINDOW[p] ?? 32_000;
  let tier: ModelCapability["tier"] = "mid";
  if (rules) {
    for (const r of rules) {
      if (r.match.test(model)) { windowTokens = r.windowTokens; tier = r.tier; break; }
    }
  }
  return {
    inputBudgetChars: budgetFrom(windowTokens, maxOutputTokens),
    nativeJsonMode: NATIVE_JSON[p] ?? false,
    tier,
  };
}

// ───────────────────────── Doctrine compression ─────────────────────────────
//
// The system prompt is a stack of blocks separated by blank lines. When it does
// not fit we keep the blocks that carry the OPERATING CONTRACT and drop the
// blocks that are illustrative. Order is always preserved so the surviving
// prompt still reads as one coherent instruction set.

const HIGH_SIGNAL = /\b(MUST|NEVER|ALWAYS|CONTRACT|OUTPUT|FORMAT|RETURN|REQUIRED|FORBIDDEN|SCHEMA|JSON|VERDICT|FALSIFIER|RESOLUTION|CORROBORATION|RULE|STEP|DO NOT)\b/g;

function blockScore(block: string, index: number, total: number): number {
  const matches = block.match(HIGH_SIGNAL)?.length ?? 0;
  // Density beats raw count so a short imperative block outranks a long essay.
  const density = matches / Math.max(1, block.length / 200);
  // Head and tail of a doctrine stack carry role definition and output contract.
  const positional = index < 2 || index >= total - 3 ? 6 : 0;
  const headerish = /^[A-Z0-9 ─—\-#*_.:()\/]{6,80}$/m.test(block.split("\n")[0] ?? "") ? 1.5 : 0;
  return density * 3 + matches * 0.35 + positional + headerish;
}

export interface TieredPrompts {
  system: string;
  user: string;
  /** True when either prompt was compressed to fit the model's window. */
  compressed: boolean;
  /** Diagnostic: original vs final char counts. */
  originalChars: number;
  finalChars: number;
}

/**
 * Fit (system, user) inside `budgetChars`.
 *
 * Priority order, because losing the wrong thing is worse than losing volume:
 *   1. The user's actual question/evidence is never dropped below 40% of budget.
 *   2. The first two and last three doctrine blocks are pinned (role + contract).
 *   3. Remaining doctrine blocks are admitted highest-signal-first.
 *   4. If the user prompt alone still overflows, it is elided from the MIDDLE
 *      so both the instruction head and the trailing evidence survive.
 */
export function tierPrompts(
  systemPrompt: string,
  userPrompt: string,
  budgetChars: number,
): TieredPrompts {
  const originalChars = systemPrompt.length + userPrompt.length;
  if (originalChars <= budgetChars) {
    return { system: systemPrompt, user: userPrompt, compressed: false, originalChars, finalChars: originalChars };
  }

  const userFloor = Math.floor(budgetChars * 0.40);
  const userBudget = Math.max(userFloor, Math.min(userPrompt.length, Math.floor(budgetChars * 0.55)));
  const systemBudget = Math.max(1_000, budgetChars - userBudget);

  const system = systemPrompt.length <= systemBudget
    ? systemPrompt
    : compressDoctrine(systemPrompt, systemBudget);

  // Reclaim anything the doctrine compressor did not spend.
  const user = elideMiddle(userPrompt, Math.max(userBudget, budgetChars - system.length));

  const finalChars = system.length + user.length;
  return { system, user, compressed: true, originalChars, finalChars };
}

export function compressDoctrine(systemPrompt: string, budgetChars: number): string {
  const blocks = systemPrompt.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length <= 4) return elideMiddle(systemPrompt, budgetChars);

  const total = blocks.length;
  const pinned = new Set<number>();
  for (let i = 0; i < Math.min(2, total); i++) pinned.add(i);
  for (let i = Math.max(0, total - 3); i < total; i++) pinned.add(i);

  const NOTE = "\n\n[DOCTRINE COMPRESSED FOR THIS MODEL'S CONTEXT WINDOW — the operating contract above and below is complete and binding.]\n\n";
  let used = NOTE.length;
  const keep = new Set<number>();

  // Pinned blocks first — they may already exceed budget, in which case we
  // still keep them and let the final elide trim the result.
  for (const i of pinned) { keep.add(i); used += blocks[i].length + 2; }

  const ranked = blocks
    .map((b, i) => ({ i, score: blockScore(b, i, total), len: b.length }))
    .filter((x) => !pinned.has(x.i))
    .sort((a, b) => b.score - a.score);

  for (const cand of ranked) {
    if (used + cand.len + 2 > budgetChars) continue;
    keep.add(cand.i);
    used += cand.len + 2;
  }

  const out: string[] = [];
  let elided = false;
  for (let i = 0; i < total; i++) {
    if (keep.has(i)) {
      if (elided) { out.push(NOTE.trim()); elided = false; }
      out.push(blocks[i]);
    } else {
      elided = true;
    }
  }
  return elideMiddle(out.join("\n\n"), budgetChars);
}

/** Hard character clamp that removes the MIDDLE, never the tail. */
export function elideMiddle(text: string, budgetChars: number): string {
  if (text.length <= budgetChars) return text;
  const marker = "\n\n…[TRUNCATED FOR CONTEXT WINDOW]…\n\n";
  const room = Math.max(200, budgetChars - marker.length);
  const head = Math.floor(room * 0.6);
  const tail = room - head;
  return text.slice(0, head) + marker + text.slice(text.length - tail);
}

// ────────────────────────── JSON extraction / repair ─────────────────────────
//
// Models without native JSON mode wrap output in prose or code fences, or emit
// trailing commentary. This recovers the JSON value without a second model call
// in the overwhelming majority of cases.

export function extractJson(raw: string): string | null {
  if (!raw) return null;
  const text = raw.trim();

  const direct = tryParse(text);
  if (direct !== null) return direct;

  // Fenced block: ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) {
    const inner = tryParse(fence[1].trim());
    if (inner !== null) return inner;
  }

  // First balanced { } or [ ] region, string- and escape-aware.
  for (const open of ["{", "["] as const) {
    const close = open === "{" ? "}" : "]";
    const start = text.indexOf(open);
    if (start === -1) continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          const parsed = tryParse(candidate) ?? tryParse(looseFix(candidate));
          if (parsed !== null) return parsed;
          break;
        }
      }
    }
  }

  const loose = tryParse(looseFix(text));
  if (loose !== null) return loose;

  // Last resort: the response was cut off mid-object by the output-token cap
  // (common on reasoning models that spend budget before emitting). Close what
  // is open rather than discarding a nearly complete payload.
  return repairTruncatedJson(text);
}

/**
 * Rebuild a parseable value from JSON that stops mid-stream.
 * Chops back to the last position that can be legally closed, then closes it.
 * Never invents keys or values — only terminates open strings/containers.
 */
export function repairTruncatedJson(raw: string, maxChops = 600): string | null {
  const start = Math.min(
    ...[raw.indexOf("{"), raw.indexOf("[")].filter((i) => i >= 0),
  );
  if (!Number.isFinite(start)) return null;
  const body = raw.slice(start);

  for (let chop = 0; chop <= Math.min(maxChops, body.length - 1); chop++) {
    const slice = body.slice(0, body.length - chop).replace(/[\s,:]+$/, "");
    if (!slice) break;
    const closed = closeOpenStructures(slice);
    if (closed === null) continue;
    const parsed = tryParse(closed) ?? tryParse(looseFix(closed));
    if (parsed !== null) return parsed;
  }
  return null;
}

function closeOpenStructures(s: string): string | null {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      const open = stack.pop();
      if (!open) return null;
      if ((ch === "}") !== (open === "{")) return null;
    }
  }
  let out = s;
  if (esc) out = out.slice(0, -1);
  if (inStr) out += '"';
  out = out.replace(/[\s,:]+$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}

function tryParse(s: string): string | null {
  if (!s) return null;
  try { JSON.parse(s); return s; } catch { return null; }
}

/** Conservative syntactic repairs that never invent values. */
function looseFix(s: string): string {
  return s
    .replace(/^[^{[]*/, "")            // strip prose preamble
    .replace(/[^}\]]*$/, "")           // strip prose epilogue
    .replace(/,\s*([}\]])/g, "$1")     // trailing commas
    .replace(/\bNaN\b|\bInfinity\b/g, "null")
    .replace(/'([^'\\]*)'(\s*:)/g, '"$1"$2'); // single-quoted keys
}
