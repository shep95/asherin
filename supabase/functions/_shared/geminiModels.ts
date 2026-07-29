// Single source of truth for Google Generative Language (v1beta) model ids.
//
// Why this exists: Google retires model ids on the direct v1beta endpoint.
// A user's BYOK model id is persisted (user_model_preferences / localStorage)
// the day they pick it and then replayed forever. When Google retires that id
// the call returns 404 NOT_FOUND ("This model is no longer available") and the
// whole feature fails with an opaque "AI error" — the exact symptom users hit.
//
// Every Gemini call site must normalize through `normalizeGeminiModel()` and
// fall back to `GEMINI_ROLLING_FALLBACK` on a 404, so a stale saved model can
// never dead-end a request.

/** Retired / deprecated id → currently served equivalent. */
export const GEMINI_MODEL_ALIASES: Record<string, string> = {
  // 1.x family — fully retired on v1beta
  "gemini-pro": "gemini-flash-latest",
  "gemini-1.0-pro": "gemini-flash-latest",
  "gemini-1.0-pro-latest": "gemini-flash-latest",
  "gemini-1.5-pro": "gemini-pro-latest",
  "gemini-1.5-pro-latest": "gemini-pro-latest",
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-1.5-flash-latest": "gemini-flash-latest",
  "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
  "gemini-1.5-flash-8b-latest": "gemini-2.5-flash-lite",
  // 2.5 pinned ids — retired in favour of the rolling aliases
  "gemini-2.5-pro": "gemini-pro-latest",
  "gemini-2.5-pro-latest": "gemini-pro-latest",
  "gemini-2.5-pro-exp": "gemini-pro-latest",
  "gemini-2.5-flash": "gemini-flash-latest",
  "gemini-2.5-flash-latest": "gemini-flash-latest",
  "gemini-2.5-flash-preview": "gemini-flash-latest",
  // Experimental ids that were never promoted
  "gemini-2.0-flash-exp": "gemini-2.0-flash",
  "gemini-2.0-pro-exp": "gemini-pro-latest",
};

/** Rolling alias Google keeps pointed at a live model. Last-resort retry target. */
export const GEMINI_ROLLING_FALLBACK = "gemini-flash-latest";

/**
 * Map a possibly-stale saved model id onto one that is currently served.
 * Unknown ids pass through untouched (users may bring a newer preview id we
 * don't know about yet — the 404 retry still protects them).
 */
export function normalizeGeminiModel(model: string | null | undefined): string {
  const id = (model || "").trim();
  if (!id) return GEMINI_ROLLING_FALLBACK;
  // Tolerate "google/gemini-..." / "models/gemini-..." prefixes.
  const bare = id.replace(/^models\//, "").replace(/^google\//, "");
  return GEMINI_MODEL_ALIASES[bare] || bare;
}

/** True when the saved id is known-retired (useful for UI nudges / logging). */
export function isRetiredGeminiModel(model: string | null | undefined): boolean {
  const bare = (model || "").replace(/^models\//, "").replace(/^google\//, "");
  return Object.prototype.hasOwnProperty.call(GEMINI_MODEL_ALIASES, bare);
}
