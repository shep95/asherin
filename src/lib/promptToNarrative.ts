// promptToNarrative.ts — deterministic client-side narrative expansion.
//
// Rationale: raw user prompts are often terse, elliptical, or context-poor.
// The "nar" toggle on Aureon chat wraps the raw prompt in a narrative frame
// BEFORE sending it to the model, so the model receives (a) explicit intent,
// (b) stated context, (c) the literal question, and (d) an instruction to
// think in narrative form. This is pure text transformation — no network,
// no model call. Safe to run on every send.
//
// The wrapper is designed to be composable: if the raw prompt is already
// long-form (>1200 chars) we skip the frame and only prepend the directive,
// because re-narrating an already-narrative prompt hurts quality.

const NARRATIVE_DIRECTIVE = `You are Aureon operating in NARRATIVE-FIRST mode.

Before you answer, reason through the request as a short first-person narrative:
1. What is the user actually asking? (State the underlying intent, not just the surface phrasing.)
2. What context is implied but unstated? (Assume the operator is intelligent — infer the frame.)
3. What are the flaws in the request as-written? (Ambiguity, missing constraints, unstated assumptions.)
4. What would the ideal answer look like? (Structure, depth, format.)

Then produce the answer. Do not output the narrative itself — use it only as internal reasoning. The final response should be complete, direct, and formatted for the operator.`;

const SHORT_PROMPT_LIMIT = 1200;

export interface NarrativeExpansion {
  transformed: string;
  wrapped: boolean;
  originalLength: number;
}

export function expandPromptToNarrative(raw: string): NarrativeExpansion {
  const trimmed = raw.trim();
  if (!trimmed) return { transformed: raw, wrapped: false, originalLength: 0 };

  // Long prompts: prepend directive only. Wrapping would distort a
  // deliberately structured request (specs, code, briefs).
  if (trimmed.length > SHORT_PROMPT_LIMIT) {
    return {
      transformed: `${NARRATIVE_DIRECTIVE}\n\n────────\nUSER REQUEST\n────────\n\n${trimmed}`,
      wrapped: false,
      originalLength: trimmed.length,
    };
  }

  // Short prompt: wrap with narrative frame.
  return {
    transformed: `${NARRATIVE_DIRECTIVE}

────────
USER REQUEST (raw)
────────

${trimmed}

────────
NARRATIVE FRAME
────────

The operator has sent the request above. Treat it as a hypothesis to be
resolved rather than a literal command. Reason through what they actually
need — infer the missing context, name the assumptions, expose the flaws
in the phrasing — and only then produce the answer.`,
    wrapped: true,
    originalLength: trimmed.length,
  };
}

const STORAGE_KEY = "aureon.chat.narrativeMode";

export function loadNarrativeMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch { return false; }
}

export function saveNarrativeMode(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch { /* quota — silently drop */ }
}
