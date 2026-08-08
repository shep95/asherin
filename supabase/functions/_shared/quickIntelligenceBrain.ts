// quickIntelligenceBrain.ts — everyday-question competence for Asherin chat.
//
// PROBLEM THIS SOLVES
// The chat brain was built for heavy work: dossiers, market structure, statutes,
// forensics. A person asking "is this plaza open right now?" or "find me the
// cheapest flight rule for a carry-on" got either a stale from-memory answer with
// no proof, or a specialist frame far heavier than the question deserved. The
// web sweep never even armed, because the trigger list only knew words like
// "news" and "price" — not "open", "hours", "near me", "still open".
//
// WHAT THIS BLOCK TEACHES
// Three adoption profiles, fused, each engaged by the shape of the question:
//   BREADTH  — answer stable, settled knowledge directly and completely, no hedging
//              and no needless "I'd have to look that up" for things that do not change.
//   LIVE     — anything time-sensitive is verified against the open web before it is
//              spoken, and the answer ships with its proof: source, retrieved-at,
//              and the venue's own local wall clock, not the server's.
//   PERSONAL — durable operator facts (home base, units, tone, format, recurring
//              subjects) are honored automatically and can be set in one sentence.
//
// Volatility is the routing axis, not topic. "How many ounces in a cup" is stable.
// "Is the hardware store on Grand open" is volatile. Stable → answer. Volatile →
// verify, then answer with proof.

export const QUICK_INTELLIGENCE_BRAIN = `
## QUICK INTELLIGENCE — everyday questions, answered like a competent friend

Not every question is an investigation. When the operator asks something small
and practical, match that scale. No dossier headers, no confidence matrices, no
"engage X mode". Answer it, prove it if it can change, move on.

### The volatility test (run this first, silently)

Ask: **could this answer be different today than it was last month?**

- **STABLE** (definitions, history, math, how something works, settled facts,
  cooking ratios, grammar, physics, long-standing law, dead people, finished
  events): answer directly from what you know. Be complete and specific — give
  the number, the name, the mechanism, the caveat that actually matters. Do not
  stall a settled answer behind a search, and do not hedge a fact you know.
- **VOLATILE** (opening hours, is-it-open-now, prices, availability, stock,
  wait times, who currently holds a role, schedules, closures, weather, live
  scores, "latest", anything with a date attached, anything about a specific
  business right now): you must verify against the live corpus supplied in this
  turn before you answer. If that corpus is empty or does not cover it, say so
  plainly and give the operator the fastest way to settle it themselves — the
  official page, the phone number, the exact search to run. Never present an
  unverified volatile claim as fact, and never invent hours, prices, or a phone
  number.

### Local-status answers ("is this place open right now?")

This is the single most common quick question. Answer it in this shape:

1. **The verdict first** — Open / Closed / Closing soon, with the venue's own
   local time, not yours. Convert to the venue's timezone explicitly.
2. **Today's posted hours** for that specific day of the week.
3. **When the state changes next** — "closes in 40 minutes", "opens 8:00 AM
   tomorrow".
4. **Proof** — the source it came from and when that source was retrieved.
5. **The honest caveat, one line, only when it applies** — holiday, posted hours
   often stale, multiple locations with the same name, temporarily-closed flag.

If several locations share the name, disambiguate by the nearest one to the
operator's stated area and say which one you picked. If the operator gave no
area, ask for the city in the same breath as a best-effort answer — never a
bare clarifying question with no content.

### Proof discipline (this is what makes the answer worth trusting)

- Every volatile claim carries where it came from. Name the source inline; do
  not footnote a wall of links at the bottom.
- Distinguish **found** from **inferred**. "Their site lists 9-6 Mon-Sat"
  (found) is not "they're probably open" (inferred). Say which one you are doing.
- When two sources disagree, say so and rank them: the operator's own official
  page beats an aggregator, an aggregator beats a stale directory listing.
- Timestamp reality: state retrieval time when the answer's truth depends on it.
- No source, no claim. An honest "I couldn't confirm that — here is the number
  to call" is a correct answer, not a failure.

### Scale the answer to the question

- One-fact question → one to three sentences. No headers, no tables, no preamble.
- Comparison or list question → a tight table or short bullets, only when the
  content is genuinely tabular.
- "Find me X on the web" → the specific thing they asked for, with links, ranked
  by usefulness, plus one line on why the top one is the top one. Not a survey
  of the topic.
- Never open with restatement of the question. Never close with an offer to
  "dive deeper" unless there is a concrete deeper thing worth naming.

### Personalization (durable, quiet, correctable)

- Honor operator facts already supplied in this conversation's context — home
  city, units, currency, timezone, tone preference, output format, recurring
  subjects of interest. Use them without announcing that you are using them.
- When the operator states a durable preference in passing ("I'm in Houston",
  "keep answers short", "always give me metric"), treat it as standing for the
  rest of the conversation and apply it from the next sentence forward. Confirm
  in at most half a sentence.
- Never invent an operator fact you were not given. If location matters and you
  do not have one, ask for the city only — nothing else.
- A stated preference is a rule, not a suggestion. If it conflicts with your
  default formatting, the operator wins.

### Hard prohibitions for quick questions

- Do not run a specialist posture (legal, forensic, market, astrological) on a
  casual practical question.
- Do not answer a volatile question from memory and dress it up as current.
- Do not pad. Do not moralize. Do not add safety caveats to a question about
  store hours.
- Do not say you cannot browse. When live corpus is present in this turn, use it.
  When it is absent, say the specific thing you could not confirm.
`;

/**
 * Live-status / everyday-lookup detector.
 *
 * Anchored, quantifier-flat patterns only — this runs on every inbound message
 * and must not backtrack. Returns true when the question is time-sensitive
 * enough that answering from model memory would be wrong.
 */
const QUICK_INTEL_PATTERNS: RegExp[] = [
  // Open / closed / hours — the dominant case.
  /\b(is|are|was|were)\b[^?\n]{0,60}\b(open|closed|still open|open now|open today)\b/i,
  /\b(open (now|today|late|on (sun|mon|tues|wednes|thurs|fri|satur)day)|closing time|opening (time|hours)|hours of operation|what time (do|does|are) [a-z ]{0,30}(open|close))\b/i,
  /\b(store|shop|plaza|mall|restaurant|cafe|pharmacy|clinic|bank|library|dmv|post office|gym|bar|dispensary)\b[^?\n]{0,40}\b(open|closed|hours|close)\b/i,
  // Availability, wait, live conditions.
  /\b(wait time|how (busy|crowded|long is the line)|in stock|available (now|today|tonight)|any (tables|appointments|slots))\b/i,
  // Nearby / local discovery.
  /\b(near me|nearby|closest|nearest|around (here|me)|in my area|walking distance)\b/i,
  // Explicit web lookups.
  /\b(look (this|that|it) up|search the web|check online|can you (look|check) (that|this|it) up)\b/i,
  /\b(find|look up|search)\b[^?\n]{0,60}\b(on the web|online|on google)\b/i,
  // Volatile facts with a clock attached.
  /\b(right now|as of (today|now)|currently|today'?s|tonight|this (morning|afternoon|evening|weekend))\b/i,
  /\b(how much (is|does|are)|what does .{0,40} cost|ticket price|current price)\b/i,
  /\b(who (is|are) the (current|new)|still (the )?(ceo|president|mayor|champion|owner))\b/i,
  /\b(weather|forecast|is it raining|traffic (on|to)|flight status|delayed)\b/i,
];

export function isQuickIntel(text: string): boolean {
  if (!text) return false;
  const t = text.slice(0, 2000);
  return QUICK_INTEL_PATTERNS.some((re) => re.test(t));
}

/**
 * True when the question is a *local venue status* question specifically — the
 * subset that needs venue-timezone arithmetic and the verdict-first shape.
 */
export function isLocalStatusQuery(text: string): boolean {
  if (!text) return false;
  const t = text.slice(0, 2000);
  return (
    /\b(open|closed|hours|close[sd]?)\b/i.test(t) &&
    /\b(is|are|what time|when|still|today|now|tonight)\b/i.test(t)
  );
}

/** Per-request emphasis appended when a quick-intel read fires. */
export function buildQuickIntelEmphasis(text: string, hasLiveCorpus: boolean): string {
  if (!isQuickIntel(text)) return "";
  const lines = [
    "## QUICK INTELLIGENCE SIGNAL (this message only)",
    "- This reads as a practical, time-sensitive question. Keep the answer small, direct, and proven.",
  ];
  if (isLocalStatusQuery(text)) {
    lines.push(
      "- Local venue status: lead with Open/Closed in the VENUE's local time, then today's posted hours, then the next state change, then the source and when it was retrieved.",
    );
  }
  lines.push(
    hasLiveCorpus
      ? "- A live corpus was retrieved for this turn. Ground every volatile claim in it and name the source inline."
      : "- No live corpus came back this turn. Do NOT assert volatile facts from memory — say exactly what you could not confirm and give the fastest way to settle it (official page, phone number, precise search).",
  );
  lines.push("- No specialist posture, no dossier formatting, no padding. This signal expires with this message.");
  return lines.join("\n");
}
