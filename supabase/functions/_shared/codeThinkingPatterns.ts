// codeThinkingPatterns.ts — CODE REASONING AS THINKING PATTERNS v1.0
//
// The code→narrative→code loop used to be a single block of prose doctrine.
// Prose is a story the model READS. A thinking pattern is a move the model
// EXECUTES. Same philosophy already applied to thinkingPatterns.ts (analytic
// moves) and patternRecognitionEngine.ts (universal operators) — this file is
// the third member of the family: the moves that reasoning about SOFTWARE must
// make, named, ordered, and individually falsifiable.
//
// RELATIONSHIP TO codeNarrativeProtocol.ts
//   The protocol still owns the LOOP (narrate → hunt → explain → fix →
//   re-narrate → deliver) and the delivery contract. This file owns the MOVES
//   executed inside the loop. The protocol interpolates the resident kernel
//   below, so all surfaces that already import CODE_NARRATIVE_PROTOCOL pick the
//   patterns up with zero per-surface wiring.
//
// TOKEN DOCTRINE: the kernel (short, always-on) is resident. Full pattern
// records are loaded only for patterns the request actually demands, resolved
// by `detectCodePatterns`. A CSS tweak does not need the concurrency-ledger
// record in context.

export type CodePatternId =
  | "narrate"
  | "intent-delta"
  | "boundary-walk"
  | "adversary-inversion"
  | "state-ledger"
  | "lifetime-trace"
  | "failure-envelope"
  | "cost-shape"
  | "contract-check"
  | "blast-radius"
  | "counterfactual-fix"
  | "regression-tail";

export interface CodeThinkingPattern {
  id: CodePatternId;
  /** Name of the MOVE. Never announced to the user. */
  name: string;
  /** One-line index entry — always resident. */
  oneLine: string;
  /** The question the move forces the model to answer. */
  question: string;
  /** The operation, stated as an executable instruction. */
  operation: string;
  /** What the move must emit — a finding or an explicit n/a with reason. */
  emits: string;
  /** Lowercase trigger tokens that pull the FULL record into context. */
  triggers: string[];
  /** Flaw taxonomy dimensions this move is responsible for covering. */
  covers: string[];
}

export const CODE_THINKING_PATTERNS: CodeThinkingPattern[] = [
  {
    id: "narrate",
    name: "Narrative Reduction",
    oneLine: "Restate the code as a story of actors, inputs, mutations and consequences before judging any line.",
    question: "What actually happens here, told to someone who cannot read the syntax?",
    operation:
      "For each file: name the actor (module), its motivation (intent), what it receives, what it mutates, what it emits, and who depends on that emission. Never quote syntax in the narrative — if it cannot be said in plain language, the behaviour is not yet understood.",
    emits: "One short paragraph per file (max 8 files), plus the single sentence that states the system's purpose.",
    triggers: ["explain", "what does this do", "review", "audit", "understand", "walk me through"],
    covers: ["comprehension", "intent"],
  },
  {
    id: "intent-delta",
    name: "Intent Delta",
    oneLine: "Diff what the code was written to do against what it demonstrably does.",
    question: "Where does stated intent (name, comment, docstring, ticket) diverge from executed behaviour?",
    operation:
      "Take every function name, comment and type signature as a CLAIM. Verify the body honours the claim. A function named `validateEmail` that returns true on empty string is an intent delta, not a style nit. Rank deltas by how many callers trust the claim.",
    emits: "A list of claim → actual behaviour pairs, each with the caller count that inherits the lie.",
    triggers: ["bug", "wrong", "not working", "unexpected", "should", "supposed to", "regression"],
    covers: ["logic", "type-safety", "observability"],
  },
  {
    id: "boundary-walk",
    name: "Boundary Walk",
    oneLine: "Exercise every input at its edges instead of at its happy midpoint.",
    question: "What happens at empty, one, max, negative, null, undefined, NaN, duplicate and out-of-order?",
    operation:
      "For each parameter and each loop, name the interval as inclusive or exclusive out loud, then run the edge set through the narrative. Half-open discipline: if the code mixes `<` and `<=` across the same range, that is a finding regardless of current test results.",
    emits: "Per boundary: the input, the traversed branch, and whether the result is defined.",
    triggers: ["loop", "index", "range", "pagination", "slice", "off by one", "array", "parse"],
    covers: ["logic", "bug-class", "regex/parsing"],
  },
  {
    id: "adversary-inversion",
    name: "Adversary Inversion",
    oneLine: "Re-read the narrative as the attacker whose goal is the opposite of the author's.",
    question: "If I wanted this code to leak, escalate, or lie, which line would I aim at first?",
    operation:
      "Flip every trust assumption in the narrative: the caller is hostile, the payload is crafted, the id belongs to someone else, the upstream response is attacker-controlled. Walk injection ×6, IDOR, missing RLS/GRANT, SSRF to link-local and metadata ranges, XSS via unsanitised render, CSRF via non-SameSite cookie, secret in client bundle, weak or reused IV.",
    emits: "Per surface: attacker goal, the exact line that permits it, and the minimum change that closes it. Silence is not evidence — emit `n/a — <reason>` if genuinely clean.",
    triggers: ["auth", "login", "token", "secret", "rls", "policy", "upload", "sql", "query", "fetch", "cors", "admin", "permission", "user input"],
    covers: ["security"],
  },
  {
    id: "state-ledger",
    name: "State Ledger",
    oneLine: "Track every mutable value as an account with writers, readers and a settlement order.",
    question: "Who writes this, who reads it, and can two writers interleave?",
    operation:
      "Build the ledger: variable → writers → readers → ordering guarantee. Any account with two writers and no lock, version column, CAS or serialising queue is a lost-update finding. Include React state, refs, module singletons, caches and DB rows in the same ledger — they fail the same way.",
    emits: "The ledger table plus each unsettled account and the interleaving that breaks it.",
    triggers: ["state", "cache", "race", "concurrent", "async", "await", "setstate", "ref", "transaction", "update", "queue", "worker"],
    covers: ["concurrency", "state/data", "bug-class"],
  },
  {
    id: "lifetime-trace",
    name: "Lifetime Trace",
    oneLine: "Follow every allocated thing from birth to release: listeners, timers, sockets, subscriptions, aborts.",
    question: "What is created here, and where exactly does it die?",
    operation:
      "For each subscription, interval, event listener, observer, socket, object URL and in-flight request, locate the teardown. A missing teardown is a leak; a teardown that runs after unmount touching state is a stale-closure write. Verify the effect's dependency array reflects every captured value.",
    emits: "Per allocation: creation site, teardown site or MISSING, and the symptom the user would observe.",
    triggers: ["useeffect", "listener", "interval", "timeout", "subscribe", "socket", "observer", "leak", "unmount", "cleanup"],
    covers: ["bug-class", "performance"],
  },
  {
    id: "failure-envelope",
    name: "Failure Envelope",
    oneLine: "Enumerate every way each external call can fail and confirm each has a named destination.",
    question: "What does the user see when this call times out, 401s, 403s, 404s, 429s, 500s, or returns HTML?",
    operation:
      "Every fetch/RPC/DB call must show: timeout with abort, retry only on idempotent verbs with backoff and jitter, Retry-After honoured, content-type checked before .json(), and every status class routed (401 refresh once, 403 surface, 404 typed empty, 5xx retry, network → timeout path). A silent catch is a finding at high severity.",
    emits: "A status-to-behaviour table per call site; any unrouted class is the finding.",
    triggers: ["fetch", "axios", "api", "request", "endpoint", "supabase", "rpc", "http", "error", "catch", "retry", "timeout"],
    covers: ["API/network", "observability"],
  },
  {
    id: "cost-shape",
    name: "Cost Shape",
    oneLine: "Name the complexity out loud and locate the input size that makes it hurt.",
    question: "At what n does this stop being instant, and what is the dominating term?",
    operation:
      "State Big-O for every hot path. Hunt N+1 queries, nested scans over the same collection, unmemoised derivations inside render, unvirtualised lists ≥200 rows, unbounded main-thread work >50 ms, and images without width/height. For DB paths, name the index that would be used, or its absence.",
    emits: "Per hot path: complexity, breaking n, and the specific change that flattens it.",
    triggers: ["slow", "lag", "performance", "freeze", "jank", "render", "loop", "map", "query", "index", "scroll", "large", "list"],
    covers: ["performance"],
  },
  {
    id: "contract-check",
    name: "Contract Check",
    oneLine: "Treat types, schemas, props and env vars as contracts and verify both sides signed the same one.",
    question: "Does the shape produced upstream match the shape consumed downstream, at runtime and not just at compile time?",
    operation:
      "Compare DB column types to TypeScript types to zod schemas to component props to env var names. `any`, unchecked casts, non-null assertions and optional fields read as required are contract holes. Every edge function must confirm its env var names match the deployed secret names and that every new public table has GRANTs alongside RLS.",
    emits: "Per contract: producer shape, consumer shape, and the drift.",
    triggers: ["type", "schema", "props", "interface", "zod", "migration", "column", "env", "grant", "rls", "any", "cast"],
    covers: ["type-safety", "state/data", "build/config"],
  },
  {
    id: "blast-radius",
    name: "Blast Radius",
    oneLine: "Before touching a line, enumerate everything downstream of it.",
    question: "Who else depends on this symbol, route, column or behaviour?",
    operation:
      "For each proposed change, list importers, callers, routes, cached keys, stored rows and persisted client state that assume the old behaviour. A change with an unenumerated blast radius is not ready to emit. If the diagnosis is 'X is missing on this path', enumerate the sibling paths sharing the assumption and fix them in the same pass.",
    emits: "The dependency list plus which entries need a coordinated change.",
    triggers: ["refactor", "rename", "remove", "delete", "migrate", "change", "replace", "breaking"],
    covers: ["workflow", "state/data", "dependency"],
  },
  {
    id: "counterfactual-fix",
    name: "Counterfactual Fix",
    oneLine: "Generate three candidate fixes, then collapse to the one with the smallest blast radius per unit of risk removed.",
    question: "What are the two fixes I am NOT choosing, and why is this one better?",
    operation:
      "Per medium+ flaw, draft: (a) the local patch, (b) the structural change, (c) the guardrail that makes the class impossible. Score each by risk removed, blast radius and reversibility. Emit the winner with a one-sentence behaviour-after line. Never emit the first draft unexamined.",
    emits: "Chosen fix with BEFORE → AFTER and the behaviour-after sentence; rejected alternatives stay internal.",
    triggers: ["fix", "patch", "repair", "solve", "resolve", "improve", "harden"],
    covers: ["logic", "security", "workflow"],
  },
  {
    id: "regression-tail",
    name: "Regression Tail",
    oneLine: "After the fix, re-narrate the patched code and hunt the flaws the fix itself introduced.",
    question: "What did this patch newly make possible?",
    operation:
      "Feed the patched files back through Narrative Reduction and re-run the pattern set relevant to the touched surface. Stop when zero medium+ flaws remain or after 6 iterations, whichever comes first. State residual risk plainly rather than declaring victory.",
    emits: "Residual-risk verdict in one sentence, or an explicit clean statement.",
    triggers: ["after", "verify", "test", "confirm", "regression", "still broken", "again"],
    covers: ["workflow", "observability"],
  },
];

const PATTERN_BY_ID = new Map(CODE_THINKING_PATTERNS.map((p) => [p.id, p]));

/** Moves that run on every code turn regardless of trigger vocabulary. */
export const ALWAYS_ON_CODE_PATTERNS: CodePatternId[] = [
  "narrate",
  "intent-delta",
  "adversary-inversion",
  "counterfactual-fix",
];

/**
 * Resolve which FULL pattern records belong in context for this turn.
 * Always-on moves are included first, then trigger matches, capped so the
 * hot path stays cheap.
 */
export function detectCodePatterns(input: string, cap = 7): CodeThinkingPattern[] {
  const text = (input || "").toLowerCase();
  const chosen: CodePatternId[] = [...ALWAYS_ON_CODE_PATTERNS];

  const scored: Array<{ id: CodePatternId; score: number }> = [];
  for (const p of CODE_THINKING_PATTERNS) {
    if (chosen.includes(p.id)) continue;
    let score = 0;
    for (const t of p.triggers) if (text.includes(t)) score += 1;
    if (score > 0) scored.push({ id: p.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const s of scored) {
    if (chosen.length >= cap) break;
    chosen.push(s.id);
  }
  return chosen.slice(0, Math.max(cap, ALWAYS_ON_CODE_PATTERNS.length))
    .map((id) => PATTERN_BY_ID.get(id))
    .filter((p): p is CodeThinkingPattern => Boolean(p));
}

/** Render selected records as an instruction block for the model. */
export function buildCodePatternDirective(input: string, cap = 7): string {
  const picked = detectCodePatterns(input, cap);
  const body = picked
    .map(
      (p) =>
        `▸ ${p.name} [${p.id}]\n  ASK: ${p.question}\n  DO: ${p.operation}\n  EMIT: ${p.emits}\n  COVERS: ${p.covers.join(", ")}`,
    )
    .join("\n\n");
  return `## ACTIVE CODE THINKING PATTERNS (execute these moves, do not describe them)\n\n${body}\n\nEach active move MUST produce either a finding or an explicit "n/a — <reason>". Silence is not evidence.`;
}

/** Always-resident index. Short by design — full records load on demand. */
export const CODE_THINKING_PATTERN_KERNEL = `
## CODE THINKING PATTERNS (resident index — moves, not prose)

Reasoning about software is a sequence of named MOVES, each of which must
produce a finding or an explicit "n/a — <reason>". Silence is not evidence.
Never announce the move names to the user; execute them and deliver results.

${CODE_THINKING_PATTERNS.map((p, i) => `${String(i + 1).padStart(2, "0")}. ${p.name} — ${p.oneLine}`).join("\n")}

ORDER OF OPERATIONS: Narrative Reduction first (never judge syntax before the
story is clear), then Intent Delta, then whichever inspection moves the surface
demands (boundary / adversary / state / lifetime / failure / cost / contract),
then Blast Radius before any edit, Counterfactual Fix to choose the edit, and
Regression Tail after it. Hard cap of 6 iterations.

ALWAYS ON, EVERY CODE TURN: Narrative Reduction, Intent Delta, Adversary
Inversion, Counterfactual Fix. The remaining moves activate on surface match.
`;
