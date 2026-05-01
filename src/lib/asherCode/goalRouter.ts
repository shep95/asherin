// Asher IDE — Goal Router
// ============================================================
// Interprets free-text user prompts and classifies them into one of:
//   - "swarm_fix"   → run the swarm/autofix loop across the WHOLE project
//                     (red lines, bugs, validator errors, broken imports…)
//   - "build_all"   → finish/complete/build the entire project end-to-end
//                     via ZANOEM autopilot (multi-turn, file-by-file)
//   - "edit_file"   → targeted edit on the active file (or a named file)
//   - "chat"        → just answer; don't touch any code
//
// This lets the user type things like:
//   "finish building this product"
//   "fix every bug"
//   "make the login page work"
//   "add dark mode everywhere"
// …from ANY tab — including with no file open at all — and the IDE
// will automatically dispatch the right pipeline. No manual button
// clicks, no need to be on a specific file.
//
// Detection is regex-first (zero-cost, instant, deterministic). The
// AI fallback is intentionally NOT used here — we want the dispatch
// to be predictable and offline-safe. If the regex doesn't match a
// "do work across the project" pattern, we treat it as normal chat
// and let the existing chat path handle it (which already routes
// per-file edits via the AI's edit-plan response).

export type GoalIntent = "swarm_fix" | "build_all" | "edit_file" | "chat";

export interface GoalDecision {
  intent: GoalIntent;
  confidence: number;            // 0..1 — how sure we are
  reason: string;                 // human-readable for toast/log
  /** When intent === "build_all", this is the cleaned-up goal we feed to ZANOEM. */
  buildGoal?: string;
  /** When intent === "edit_file", this is the file path/name the user named (if any). */
  targetFile?: string;
}

// ── Pattern banks ──────────────────────────────────────────
// Each pattern includes a tiny weight so we can rank multiple matches.
// Weights aren't shown to the user — they only affect intent selection.

const SWARM_FIX_PATTERNS: { rx: RegExp; w: number }[] = [
  { rx: /\b(fix|resolve|clear|kill|squash|patch)\s+(all|every|any|the)\s+(bug|bugs|error|errors|red\s*line|red\s*lines|issue|issues|warning|warnings|problem|problems)\b/i, w: 1.0 },
  { rx: /\b(fix|debug)\s+(everything|the\s+whole\s+(project|app|codebase|code\s*base))\b/i, w: 1.0 },
  { rx: /\b(no|zero)\s+(red\s*lines?|errors?|bugs?)\b/i, w: 0.9 },
  { rx: /\b(run|launch|start|trigger|dispatch)\s+(the\s+)?(swarm|auto[-\s]?fix|debugger|debug\s+swarm)\b/i, w: 1.0 },
  { rx: /\b(scan|audit|check)\s+(every|all)\s+file/i, w: 0.8 },
  { rx: /\bclean\s+(up\s+)?(the\s+)?(project|codebase|code|repo)\b/i, w: 0.7 },
  { rx: /\bmake\s+(it|everything)\s+(compile|work|run|build)\b/i, w: 0.7 },
];

const BUILD_ALL_PATTERNS: { rx: RegExp; w: number }[] = [
  { rx: /\bfinish\s+(building|creating|making|coding|writing)\s+(the|this|my|our)?\s*(whole\s+)?(project|product|app|application|software|tool|platform|site|website|game|system)\b/i, w: 1.0 },
  { rx: /\b(build|create|make|implement|complete|ship)\s+(the|this|my|our)?\s*(whole|entire|full|complete)\s+(project|product|app|application|software|tool|platform|site|website|game|system)\b/i, w: 1.0 },
  { rx: /\b(complete|finish|finalize)\s+(the|this|my|our)?\s*(project|product|app|application|software|tool|platform|site|website|game|system)\b/i, w: 0.9 },
  { rx: /\bbuild\s+(it|everything|the\s+rest)\b/i, w: 0.85 },
  { rx: /\b(implement|add)\s+(everything\s+)?(the|all)\s+(remaining|missing|outstanding|todo|to[-\s]?do)\s+(features?|parts?|pieces?|work|things?)\b/i, w: 0.9 },
  { rx: /\b(make|build)\s+(this|the)\s+(work|production[-\s]?ready|deployable|shippable|launch[-\s]?ready)\b/i, w: 0.85 },
  { rx: /\b(turn|convert)\s+this\s+into\s+a\s+(real|working|production|finished)\b/i, w: 0.9 },
  // Generic "from scratch" / "from zero" ZANOEM-style asks
  { rx: /\b(invent|design|architect|spin\s*up|scaffold|bootstrap)\s+(a|an|the)\b/i, w: 0.6 },
];

// "edit this file" / "fix this function" / "add X to Y" — only fires when a file
// reference is implied OR the user is clearly talking about a single thing.
const EDIT_FILE_PATTERNS: { rx: RegExp; w: number }[] = [
  { rx: /\b(in|on|inside|within)\s+([\w./-]+\.(tsx?|jsx?|css|html|json|md|py|go|rs|sql|svelte|vue))\b/i, w: 1.0 },
  { rx: /\b(this\s+(file|function|component|hook|class|page|module))\b/i, w: 0.6 },
  { rx: /\b(refactor|rename|extract|inline|simplify|optimi[sz]e)\s+(this|the)\b/i, w: 0.7 },
];

function bestMatch(text: string, bank: { rx: RegExp; w: number }[]): { score: number; match?: RegExpExecArray } {
  let best = 0;
  let bestMatch: RegExpExecArray | undefined;
  for (const { rx, w } of bank) {
    const m = rx.exec(text);
    if (m && w > best) { best = w; bestMatch = m; }
  }
  return { score: best, match: bestMatch };
}

/** Pull a file path out of "in foo/bar.ts" / "fix the bug in components/X.tsx" */
function extractFileRef(text: string): string | undefined {
  const m = /\b(?:in|on|inside|within|from|to|edit|open|fix|update)\s+([\w./-]+\.(?:tsx?|jsx?|css|html|json|md|py|go|rs|sql|svelte|vue))\b/i.exec(text);
  return m?.[1];
}

/**
 * Classify a free-text prompt into a dispatch intent.
 * Pure function — no side effects, no network. Safe to call on every keystroke.
 */
export function routeGoal(rawInput: string): GoalDecision {
  const text = (rawInput || "").trim();
  if (!text) return { intent: "chat", confidence: 1, reason: "empty input" };

  const swarm = bestMatch(text, SWARM_FIX_PATTERNS);
  const build = bestMatch(text, BUILD_ALL_PATTERNS);
  const edit  = bestMatch(text, EDIT_FILE_PATTERNS);
  const fileRef = extractFileRef(text);

  // Highest-weight wins. Ties go to swarm > build > edit (most useful default).
  const top = Math.max(swarm.score, build.score, edit.score);

  if (top === 0) {
    return { intent: "chat", confidence: 0.6, reason: "no project-wide directive detected" };
  }

  if (swarm.score === top && swarm.score >= 0.7) {
    return {
      intent: "swarm_fix",
      confidence: swarm.score,
      reason: `matched bug-fix directive: "${swarm.match?.[0] ?? ""}"`,
    };
  }

  if (build.score === top && build.score >= 0.6) {
    return {
      intent: "build_all",
      confidence: build.score,
      reason: `matched build-all directive: "${build.match?.[0] ?? ""}"`,
      buildGoal: text,
    };
  }

  if (edit.score === top && edit.score >= 0.6) {
    return {
      intent: "edit_file",
      confidence: edit.score,
      reason: fileRef ? `targeted file: ${fileRef}` : "single-target edit",
      targetFile: fileRef,
    };
  }

  return { intent: "chat", confidence: 0.5, reason: "below threshold — falling through to chat" };
}
