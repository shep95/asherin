// ═══════════════════════════════════════════════════════════════════════════
// RESUME PSYCHOLOGY ENGINE — deterministic, no model call
// ---------------------------------------------------------------------------
// A resume is read by a human under time pressure who is looking for reasons to
// say no. Every detector below measures one documented reader bias:
//
//   AGENCY        Attribution bias — readers credit the actor, not the observer.
//                 "Led", "shipped", "cut" reads as cause; "responsible for",
//                 "helped with" reads as proximity.
//   QUANTIFICATION Anchoring — a number in the first bullet sets the scale the
//                 rest of the document is judged against.
//   SPECIFICITY   Vividness effect — concrete nouns are recalled; abstractions
//                 ("synergy", "stakeholder alignment") evaporate.
//   PRIMACY       Serial position — the first bullet of the first role carries
//                 disproportionate weight, so the strongest claim belongs there.
//   HEDGING       Hedges ("assisted", "attempted", "some") read as low confidence
//                 and get discounted below their literal meaning.
//   PASSIVE VOICE Removes the actor from the sentence — the exact opposite of
//                 what a hiring read is scanning for.
//   REPETITION    Semantic satiation — the fourth "managed" stops being read.
//   DENSITY       Cognitive load — bullets over ~28 words are skimmed, not read.
//   RECENCY       Availability — an unexplained gap or stale end-date becomes
//                 the reader's dominant hypothesis unless the document answers it.
//
// Output is advisory and always cites the exact string it fired on, so nothing
// here can silently rewrite a claim the operator made about themselves.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResumeStructured } from "./types";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export interface PsychFinding {
  code: string;
  title: string;
  severity: FindingSeverity;
  /** What the reader's mind does with this, in one sentence. */
  effect: string;
  /** The literal strings that triggered it — never paraphrased. */
  evidence: string[];
  /** The concrete edit. */
  fix: string;
}

export interface PsychMetrics {
  agencyRatio: number;        // 0-1 — bullets opening on a strong action verb
  quantifiedRatio: number;    // 0-1 — bullets carrying a number
  hedgeCount: number;
  passiveCount: number;
  avgBulletWords: number;
  longBullets: number;
  repeatedVerbs: [string, number][];
  abstractionCount: number;
  bulletCount: number;
  wordCount: number;
}

export interface PsychReport {
  score: number;              // 0-100 — reader-persuasion readiness
  band: "elite" | "strong" | "adequate" | "weak" | "unreadable";
  metrics: PsychMetrics;
  findings: PsychFinding[];
  /** Ordered, plain-language next actions. */
  actions: string[];
  generatedAt: string;
}

// ── Lexicons ───────────────────────────────────────────────────────────────

const STRONG_VERBS = new Set([
  "led","built","shipped","launched","cut","grew","raised","reduced","doubled","tripled",
  "designed","architected","automated","negotiated","recovered","secured","scaled","owned",
  "founded","rebuilt","migrated","eliminated","accelerated","closed","won","delivered",
  "drove","turned","saved","increased","decreased","streamlined","consolidated","rewrote",
  "trained","mentored","hired","directed","initiated","established","transformed","resolved",
  "diagnosed","authored","deployed","instrumented","refactored","standardized","unblocked",
]);

const HEDGES = [
  "responsible for","assisted with","assisted in","helped with","helped to","involved in",
  "participated in","worked on","contributed to","supported the","part of a team",
  "familiar with","exposure to","some experience","attempted","tried to","aimed to",
  "tasked with","duties included","various","several","a number of",
];

const ABSTRACTIONS = [
  "synergy","synergies","stakeholder alignment","best practices","results-driven",
  "self-starter","think outside the box","go-getter","hard worker","team player",
  "detail-oriented","dynamic","passionate about","proven track record","value-add",
  "leverage synergies","cross-functional collaboration","strategic initiatives",
];

const PASSIVE_RE = /\b(?:was|were|been|being|is|are)\s+\w+(?:ed|en)\b/gi;
const NUMBER_RE = /(?:\$\s?[\d,.]+|\b\d[\d,.]*\s?(?:%|percent|k\b|m\b|bn\b|x\b)|\b\d[\d,.]{1,}\b)/i;

// ── Helpers ────────────────────────────────────────────────────────────────

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const firstWord = (s: string) => (words(s)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function collectBullets(r: ResumeStructured): string[] {
  const out: string[] = [];
  for (const e of r.experience) out.push(...e.bullets.filter((b) => b.trim().length > 0));
  for (const p of r.projects) if (p.description) out.push(p.description);
  return out;
}

/** Parse a trailing year out of a free-form date string; null when absent. */
function endYear(v?: string): number | null {
  if (!v) return null;
  if (/present|current|now/i.test(v)) return new Date().getUTCFullYear();
  const m = v.match(/\b(19|20)\d{2}\b/g);
  return m ? Number(m[m.length - 1]) : null;
}

// ── Engine ─────────────────────────────────────────────────────────────────

export function analyzeResumePsychology(r: ResumeStructured): PsychReport {
  const bullets = collectBullets(r);
  const corpus = [r.summary, ...bullets].join("\n");
  const lower = corpus.toLowerCase();
  const findings: PsychFinding[] = [];

  // AGENCY — how many bullets open on a verb the reader reads as cause.
  const strongOpeners = bullets.filter((b) => STRONG_VERBS.has(firstWord(b)));
  const agencyRatio = bullets.length ? strongOpeners.length / bullets.length : 0;

  // QUANTIFICATION
  const quantified = bullets.filter((b) => NUMBER_RE.test(b));
  const quantifiedRatio = bullets.length ? quantified.length / bullets.length : 0;

  // HEDGING
  const hedgeHits: string[] = [];
  for (const h of HEDGES) {
    let idx = lower.indexOf(h);
    while (idx !== -1 && hedgeHits.length < 12) {
      hedgeHits.push(corpus.slice(Math.max(0, idx - 20), idx + h.length + 30).replace(/\s+/g, " ").trim());
      idx = lower.indexOf(h, idx + h.length);
    }
  }

  // PASSIVE VOICE — regex is created fresh so lastIndex can never leak state.
  const passiveHits = corpus.match(new RegExp(PASSIVE_RE.source, "gi")) ?? [];

  // ABSTRACTION
  const abstractHits = ABSTRACTIONS.filter((a) => lower.includes(a));

  // REPETITION
  const verbCounts = new Map<string, number>();
  for (const b of bullets) {
    const w = firstWord(b);
    if (w.length > 2) verbCounts.set(w, (verbCounts.get(w) ?? 0) + 1);
  }
  const repeatedVerbs = [...verbCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

  // DENSITY
  const bulletWordCounts = bullets.map((b) => words(b).length);
  const avgBulletWords = bulletWordCounts.length
    ? bulletWordCounts.reduce((a, b) => a + b, 0) / bulletWordCounts.length
    : 0;
  const longBullets = bulletWordCounts.filter((n) => n > 28).length;

  const metrics: PsychMetrics = {
    agencyRatio,
    quantifiedRatio,
    hedgeCount: hedgeHits.length,
    passiveCount: passiveHits.length,
    avgBulletWords: Math.round(avgBulletWords * 10) / 10,
    longBullets,
    repeatedVerbs,
    abstractionCount: abstractHits.length,
    bulletCount: bullets.length,
    wordCount: words(corpus).length,
  };

  // ── Findings ─────────────────────────────────────────────────────────────

  if (!bullets.length) {
    findings.push({
      code: "PSY-000", title: "No achievement bullets present", severity: "critical",
      effect: "With nothing to evaluate, the reader defaults to the job titles alone and assumes the work was routine.",
      evidence: [], fix: "Add three to five bullets under each recent role, each opening on what you personally caused.",
    });
  }

  if (bullets.length && agencyRatio < 0.6) {
    findings.push({
      code: "PSY-101", title: "Low agency in bullet openings", severity: agencyRatio < 0.3 ? "critical" : "high",
      effect: "Attribution bias: bullets that do not open on a strong action verb read as proximity to work rather than authorship of it.",
      evidence: bullets.filter((b) => !STRONG_VERBS.has(firstWord(b))).slice(0, 5),
      fix: `Rewrite openings to a cause verb (led, cut, shipped, rebuilt). Currently ${Math.round(agencyRatio * 100)}% of bullets do this; target 80%+.`,
    });
  }

  if (bullets.length && quantifiedRatio < 0.5) {
    findings.push({
      code: "PSY-102", title: "Unanchored claims", severity: quantifiedRatio < 0.25 ? "high" : "medium",
      effect: "Anchoring: without a number, the reader supplies their own — and the number they supply is always smaller than yours.",
      evidence: bullets.filter((b) => !NUMBER_RE.test(b)).slice(0, 5),
      fix: `Attach a magnitude, a rate, a headcount, or a currency figure. ${Math.round(quantifiedRatio * 100)}% of bullets carry one; target 60%+.`,
    });
  }

  if (hedgeHits.length) {
    findings.push({
      code: "PSY-103", title: "Hedged ownership language", severity: hedgeHits.length > 4 ? "high" : "medium",
      effect: "Hedges are discounted below their literal meaning — 'helped with' is read as 'watched'.",
      evidence: hedgeHits.slice(0, 6),
      fix: "Replace each hedge with the specific act you performed, or drop the line entirely if you cannot name one.",
    });
  }

  if (passiveHits.length > 2) {
    findings.push({
      code: "PSY-104", title: "Passive constructions remove the actor", severity: "medium",
      effect: "Passive voice deletes the subject of the sentence — the reader loses the person they are being asked to hire.",
      evidence: [...new Set(passiveHits)].slice(0, 6),
      fix: "Recast to active voice: 'the migration was completed' → 'I completed the migration'.",
    });
  }

  if (abstractHits.length) {
    findings.push({
      code: "PSY-105", title: "Abstraction with no referent", severity: "medium",
      effect: "Vividness effect: abstract filler is neither believed nor remembered, and it consumes the attention a concrete claim needed.",
      evidence: abstractHits,
      fix: "Delete each phrase and, where it made a claim, replace it with the event that proves the claim.",
    });
  }

  if (repeatedVerbs.length) {
    findings.push({
      code: "PSY-106", title: "Verb repetition dulls the read", severity: "low",
      effect: "Semantic satiation: by the third identical opener the reader stops processing the line.",
      evidence: repeatedVerbs.map(([v, n]) => `"${v}" ×${n}`),
      fix: "Vary openers so each bullet lands as a distinct event.",
    });
  }

  if (longBullets > 0) {
    findings.push({
      code: "PSY-107", title: "Bullets exceed the skim budget", severity: longBullets > 3 ? "medium" : "low",
      effect: "A first pass over a resume is roughly six seconds; anything past ~28 words is skipped, not compressed.",
      evidence: bullets.filter((b) => words(b).length > 28).slice(0, 4).map((b) => `${words(b).length} words: ${b.slice(0, 90)}…`),
      fix: `Split or cut ${longBullets} over-long bullet${longBullets === 1 ? "" : "s"} down to one claim each.`,
    });
  }

  // PRIMACY — the single most valuable line in the document.
  const firstRole = r.experience[0];
  const leadBullet = firstRole?.bullets?.[0];
  if (leadBullet && !NUMBER_RE.test(leadBullet)) {
    findings.push({
      code: "PSY-108", title: "Lead bullet does not anchor", severity: "high",
      effect: "Serial position: the first bullet of the first role sets the scale for everything beneath it. An unquantified lead sets that scale low.",
      evidence: [leadBullet],
      fix: "Promote your largest quantified result into this position.",
    });
  }

  // RECENCY / gaps — the reader's dominant hypothesis when unexplained.
  const thisYear = new Date().getUTCFullYear();
  const latestEnd = r.experience.map((e) => endYear(e.end)).filter((n): n is number => n !== null).sort((a, b) => b - a)[0];
  if (latestEnd !== undefined && thisYear - latestEnd >= 2) {
    findings.push({
      code: "PSY-109", title: "Unexplained recency gap", severity: "high",
      effect: "Availability heuristic: an unaddressed gap becomes the reader's leading theory about you, and it is rarely a generous one.",
      evidence: [`Most recent role ends ${latestEnd}; current year is ${thisYear}.`],
      fix: "Add a dated line covering the interval — contract work, study, caregiving, a build. Naming it neutralises it.",
    });
  }

  if (!r.summary) {
    findings.push({
      code: "PSY-110", title: "No positioning statement", severity: "medium",
      effect: "Without a frame in the first two lines, the reader constructs their own from your most recent job title.",
      evidence: [], fix: "Add two sentences: what you are, and the largest verifiable thing you have done.",
    });
  }

  const missingContact = (["email", "phone", "location"] as const).filter((k) => !r[k]);
  if (missingContact.length) {
    findings.push({
      code: "PSY-111", title: "Incomplete contact block", severity: "critical",
      effect: "A reader who wants you and cannot reach you moves to the next document within seconds.",
      evidence: missingContact, fix: `Supply: ${missingContact.join(", ")}.`,
    });
  }

  // ── Score ────────────────────────────────────────────────────────────────
  // Starts from evidence, not from a flat 100 with deductions, so an empty
  // resume cannot score well by simply avoiding detectable mistakes.
  let score = 0;
  score += agencyRatio * 26;
  score += quantifiedRatio * 24;
  score += r.summary ? 8 : 0;
  score += missingContact.length === 0 ? 10 : 10 - missingContact.length * 4;
  score += bullets.length >= 6 ? 12 : bullets.length * 2;
  score += r.skills.length >= 6 ? 6 : r.skills.length;
  score += avgBulletWords > 0 && avgBulletWords <= 28 ? 8 : 0;
  score += 6; // baseline for a parsed, structured document
  score -= Math.min(12, hedgeHits.length * 2);
  score -= Math.min(8, passiveHits.length);
  score -= Math.min(8, abstractHits.length * 2);
  score -= Math.min(6, longBullets * 2);
  score = Math.round(clamp(score));

  const band: PsychReport["band"] =
    score >= 85 ? "elite" : score >= 70 ? "strong" : score >= 55 ? "adequate" : score >= 35 ? "weak" : "unreadable";

  const order: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    score,
    band,
    metrics,
    findings,
    actions: findings.slice(0, 5).map((f) => f.fix),
    generatedAt: new Date().toISOString(),
  };
}
