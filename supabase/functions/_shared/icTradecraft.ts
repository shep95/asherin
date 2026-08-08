// ═══════════════════════════════════════════════════════════════════════════
// IC TRADECRAFT — the single analytic standard every Asherin intelligence
// product is written to.
//
// Before this module existed each surface invented its own dialect: the
// rideshare dossier shouted verdicts, the sentinel emitted risk scores, the
// contact sweep emitted prose. A reader had to learn three grammars and none
// of them told him how much to trust the line he was reading. That is the
// exact failure ICD 203 was written to end.
//
// What is mimicked here, and why:
//
//   ICD 203 (Analytic Standards, 9 tradecraft standards) — sources are
//   characterised, uncertainty is expressed, evidence is separated from
//   assumption, alternatives are carried, argument is logical, judgments are
//   consistent over time or the change is explained.
//
//   ICD 206 (Sourcing Requirements) — every disseminated product carries a
//   Source Summary Statement, and sourcing is traceable at the judgment level
//   rather than waved at document level.
//
//   ODNI likelihood ladder — seven terms, fixed probability bands, one term
//   per judgment. No hedge-stacking ("likely but possibly unlikely").
//
//   Confidence scale — low / moderate / high, on a SEPARATE axis from
//   likelihood. High confidence in an unlikely outcome is a coherent, common
//   and important statement; collapsing the two axes destroys it.
//
//   Admiralty / NATO grading (A–F reliability × 1–6 credibility) — the source
//   annotation used by NATO and Five Eyes, and the template FM 2-22.3 uses.
//
//   Portion marking — this is a commercial open-source product, so there is no
//   classification authority and pretending otherwise would be theatre. The
//   marking slot therefore carries PROVENANCE, not secrecy: (U) for open
//   source, (U//LIMDIS) for restricted-feed or account-private telemetry.
//
// Two hard rules govern everything below:
//
//   1. NEVER FABRICATE CALIBRATION. If a producing module did not supply a
//      likelihood, a confidence or a source grade, this layer says so in
//      plain words. It does not invent a percentage to look rigorous. An
//      unearned "85% — high confidence" is worse than an admitted gap.
//   2. SILENCE IS NOT EVIDENCE. A required section that has no content is
//      rendered with the reason it is empty, never dropped.
// ═══════════════════════════════════════════════════════════════════════════

// ── Likelihood: ODNI words of estimative probability ───────────────────────

export type LikelihoodTerm =
  | "almost no chance"
  | "very unlikely"
  | "unlikely"
  | "roughly even chance"
  | "likely"
  | "very likely"
  | "almost certain";

export interface LikelihoodBand {
  term: LikelihoodTerm;
  /** inclusive lower bound, percent */
  lo: number;
  /** exclusive upper bound, percent (inclusive at the top of the ladder) */
  hi: number;
}

/** Ordered low → high. Bands are half-open [lo, hi) except the final rung. */
export const LIKELIHOOD_LADDER: readonly LikelihoodBand[] = [
  { term: "almost no chance", lo: 1, hi: 5 },
  { term: "very unlikely", lo: 5, hi: 20 },
  { term: "unlikely", lo: 20, hi: 45 },
  { term: "roughly even chance", lo: 45, hi: 55 },
  { term: "likely", lo: 55, hi: 80 },
  { term: "very likely", lo: 80, hi: 95 },
  { term: "almost certain", lo: 95, hi: 99 },
] as const;

/**
 * Map a probability onto the ladder. Accepts 0–1 or 0–100; a value of exactly
 * 1 is read as 100% only when the caller passes `scale: "percent"`, because
 * `1` on a 0–1 scale is certainty and `1` on a percent scale is almost nothing
 * — an ambiguity that silently inverted judgments in earlier ad-hoc code.
 */
export function likelihoodFor(
  p: number,
  scale: "unit" | "percent" | "auto" = "auto",
): LikelihoodBand & { percent: number } {
  if (!Number.isFinite(p)) return { ...LIKELIHOOD_LADDER[3], percent: 50 };
  const pct = scale === "percent" ? p : scale === "unit" ? p * 100 : p <= 1 ? p * 100 : p;
  const clamped = Math.min(99, Math.max(1, pct));
  const band =
    LIKELIHOOD_LADDER.find((b) => clamped >= b.lo && clamped < b.hi) ??
    LIKELIHOOD_LADDER[LIKELIHOOD_LADDER.length - 1];
  return { ...band, percent: Math.round(clamped) };
}

/** "likely (55–80%)" — the parenthetical band ODNI permits for precision. */
export function estimative(p: number, scale?: "unit" | "percent" | "auto"): string {
  const b = likelihoodFor(p, scale);
  return `${b.term} (${b.lo}\u2013${b.hi}%)`;
}

const LADDER_TERMS = LIKELIHOOD_LADDER.map((b) => b.term);

/** Does this sentence already carry exactly one ladder term? */
export function hasEstimativeTerm(text: string): boolean {
  const t = text.toLowerCase();
  return LADDER_TERMS.some((term) => t.includes(term));
}

// ── Confidence: the second, independent axis ───────────────────────────────

export type ConfidenceLevel = "low" | "moderate" | "high";

export const CONFIDENCE_RUBRIC: Record<ConfidenceLevel, string> = {
  high:
    "High confidence \u2014 multiple independent sources of good quality corroborate the judgment; no material source conflicts.",
  moderate:
    "Moderate confidence \u2014 credibly sourced and plausible, but corroboration is partial and alternative explanations remain open.",
  low:
    "Low confidence \u2014 information is scant, fragmentary, single-sourced or contested; the judgment is a lead, not a finding.",
};

export interface SourcingProfile {
  /** count of genuinely independent sources behind the judgment */
  independentSources?: number;
  /** any source directly contradicts the judgment */
  contradicted?: boolean;
  /** the source is the account's own telemetry (first-party, high access) */
  firstParty?: boolean;
}

/**
 * Derive a confidence level from sourcing. Deliberately conservative: two
 * independent sources is the floor for "high", and a single contradiction
 * caps the product at low regardless of volume, because volume of agreeing
 * low-quality sources is the classic circular-reporting trap.
 */
export function confidenceFromSourcing(s: SourcingProfile): ConfidenceLevel {
  if (s.contradicted) return "low";
  const n = Math.max(0, Math.floor(s.independentSources ?? 0));
  if (s.firstParty && n >= 1) return "high";
  if (n >= 3) return "high";
  if (n === 2) return "moderate";
  if (n === 1) return s.firstParty ? "moderate" : "low";
  return "low";
}

// ── Admiralty / NATO source grading ────────────────────────────────────────

export const ADMIRALTY_RELIABILITY: Record<string, string> = {
  A: "Completely reliable",
  B: "Usually reliable",
  C: "Fairly reliable",
  D: "Not usually reliable",
  E: "Unreliable",
  F: "Reliability cannot be judged",
};

export const ADMIRALTY_CREDIBILITY: Record<string, string> = {
  "1": "Confirmed by independent sources",
  "2": "Probably true",
  "3": "Possibly true",
  "4": "Doubtful",
  "5": "Improbable",
  "6": "Credibility cannot be judged",
};

export type AdmiraltyReliability = "A" | "B" | "C" | "D" | "E" | "F";
export type AdmiraltyCredibility = "1" | "2" | "3" | "4" | "5" | "6";

export function admiralty(
  reliability: AdmiraltyReliability,
  credibility: AdmiraltyCredibility,
): string {
  return `${reliability}${credibility} \u2014 ${ADMIRALTY_RELIABILITY[reliability]} / ${ADMIRALTY_CREDIBILITY[credibility]}`;
}

/**
 * Grade a source class the way an analyst would, not the way a scraper would.
 * A government registry is not "the internet"; a content farm is not a source.
 */
export type SourceClass =
  | "government_registry"   // TLC, SOS, court docket, regulator
  | "first_party_telemetry" // the account's own device / connected mailbox
  | "primary_operator"      // the named organisation's own site
  | "established_media"     // masthead outlet with corrections policy
  | "platform_profile"      // social profile, self-asserted
  | "aggregator"            // people-search / scraped resale
  | "anonymous";            // forum, paste, unattributed

const RELIABILITY_BY_CLASS: Record<SourceClass, AdmiraltyReliability> = {
  government_registry: "A",
  first_party_telemetry: "A",
  primary_operator: "B",
  established_media: "B",
  platform_profile: "C",
  aggregator: "D",
  anonymous: "F",
};

export function gradeSource(
  cls: SourceClass,
  sourcing: SourcingProfile = {},
): { code: string; label: string; reliability: AdmiraltyReliability; credibility: AdmiraltyCredibility } {
  const reliability = RELIABILITY_BY_CLASS[cls] ?? "F";
  const n = Math.max(0, Math.floor(sourcing.independentSources ?? 0));
  const credibility: AdmiraltyCredibility = sourcing.contradicted
    ? "5"
    : n >= 2
    ? "1"
    : n === 1
    ? reliability === "A" || reliability === "B"
      ? "2"
      : "3"
    : reliability === "F"
    ? "6"
    : "3";
  return {
    code: `${reliability}${credibility}`,
    label: admiralty(reliability, credibility),
    reliability,
    credibility,
  };
}

// ── Portion marking (provenance, not secrecy) ──────────────────────────────

export type PortionTag = "U" | "U//LIMDIS";

export const PRODUCT_BANNER = "OPEN SOURCE \u00B7 UNCLASSIFIED//OSINT \u00B7 ADDRESSEE EYES ONLY";

/** Prefix a portion with its provenance mark, idempotently. */
export function portionMark(text: string, tag: PortionTag = "U"): string {
  const t = text.trim();
  if (/^\((?:U|U\/\/LIMDIS|C|S|TS)[^)]*\)\s/.test(t)) return t;
  return `(${tag}) ${t}`;
}

export function stripPortionMark(text: string): string {
  return text.replace(/^\((?:U|U\/\/LIMDIS|C|S|TS)[^)]*\)\s*/, "").trim();
}

// ── Canonical product skeleton ─────────────────────────────────────────────

/**
 * The order an IC finished product is read in. Anything a module supplies that
 * is not on this list is a supporting fact and sorts into DISCUSSION, in the
 * order the module emitted it — module ordering carries meaning and must not
 * be alphabetised away.
 */
export const IC_SECTION_ORDER: readonly string[] = [
  "SCOPE NOTE",
  "SOURCE SUMMARY",
  "DISCUSSION",
  "OUTLOOK",
  "ALTERNATIVE ANALYSIS",
  "INTELLIGENCE GAPS",
  "CONFIDENCE",
  "HANDLING",
] as const;

const RANK = new Map<string, number>(IC_SECTION_ORDER.map((s, i) => [s, i]));
// Supporting facts land between SOURCE SUMMARY and OUTLOOK, i.e. inside the
// discussion body, which is index 2.
const DISCUSSION_RANK = RANK.get("DISCUSSION") ?? 2;

export interface IcSection {
  label: string;
  value: string;
}

/** Stable IC ordering. Equal ranks keep producer order (Array#sort is stable). */
export function orderIcSections(sections: IcSection[]): IcSection[] {
  return sections
    .map((s, i) => ({ s, i, r: RANK.get(s.label.toUpperCase()) ?? DISCUSSION_RANK }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((x) => x.s);
}

// ── The doctrine block injected into every analytic model call ─────────────

/**
 * Injected verbatim into the system prompt of every module that asks a model
 * to produce analytic prose. It governs WORDING and EPISTEMICS only — it never
 * overrides a module's JSON output schema, so no downstream parser breaks.
 */
export const IC_ANALYTIC_DOCTRINE = `
═══ ANALYTIC STANDARD — ICD 203 / ICD 206 (MANDATORY) ═══
You write finished intelligence. Every prose field you emit is judged against
the nine ICD 203 tradecraft standards. Violating any rule below invalidates the
product.

1. BLUF. Lead with the judgment. Never build up to it. The first sentence of
   any summary field is the answer, not the context.

2. CALIBRATED LIKELIHOOD. Express every forward-looking or inferential judgment
   with EXACTLY ONE term from this ladder, and no other probability words:
     almost no chance (1–5%) · very unlikely (5–20%) · unlikely (20–45%)
     roughly even chance (45–55%) · likely (55–80%) · very likely (80–95%)
     almost certain (95–99%)
   Never stack terms ("likely but possibly unlikely"). Never say "may", "could",
   "might", "possibly" as a substitute — those are uncalibrated and banned.

3. CONFIDENCE IS A SEPARATE AXIS. State low / moderate / high confidence based
   on the QUALITY of the evidence, not on how probable the outcome is. High
   confidence in an unlikely outcome is valid and expected. Canonical form:
     "We assess with moderate confidence that X is likely (55–80%) to Y."

4. FACT vs ASSESSMENT vs ASSUMPTION — lexically distinct, always:
     fact        → stated plainly, no hedge verb, source attached
     assessment  → "we assess" / "we judge" / "we estimate"
     assumption  → "we assume" — and it must be flagged as an unverified premise
   Never present an assessment in the grammar of a fact.

5. SOURCING (ICD 206). Every non-obvious factual assertion carries its source.
   Grade sources Admiralty-style where you can: letter A–F for source
   reliability, digit 1–6 for information credibility, e.g. [B2]. A judgment
   resting on one uncorroborated source must say so in the same sentence.
   Distinguish raw reporting from prior finished analysis.

6. ALTERNATIVE ANALYSIS. Carry at least one competing explanation and name the
   specific observable that would flip your judgment ("what would change our
   mind"). An assessment with no falsifier is not an assessment.

7. INTELLIGENCE GAPS. State plainly what you do not know and what collection
   would resolve it. Absence of a record is NEVER evidence of absence, and must
   never be reported as a clearance, an all-clear, or a negative finding.

8. CONSISTENCY. If this judgment differs from a prior one on the same subject,
   say so and say why.

9. STYLE. Active voice. Short declarative sentences. No marketing register, no
   exclamation, no rhetorical questions. Never use "will", "proves" or
   "confirms" unless the evidence is genuinely dispositive.

PROVENANCE MARKING. This is an open-source commercial product. Where a field is
a prose paragraph, portion-mark it (U) for open-source-derived, or (U//LIMDIS)
where it rests on the account's own private telemetry or a restricted feed.

PROHIBITED ABSOLUTELY: inventing a percentage, a confidence level, a source
grade or a citation you did not derive from the collected evidence. A stated
gap is correct output. A fabricated calibration is a failed product.
═══════════════════════════════════════════════════════════════`.trim();

// ── Product assembly ───────────────────────────────────────────────────────

export interface IcProductInput {
  kind: string;
  title: string;
  /** BLUF paragraph */
  body: string;
  subjectName?: string | null;
  source?: string | null;
  severity?: string;
  /** raw supporting facts from the producing module */
  sections?: IcSection[];
  /** the module's findings — promoted to Key Judgments */
  findings?: string[];
  /** optional, module-supplied IC fields */
  scopeNote?: string | null;
  sourceSummary?: string | null;
  gaps?: string[] | null;
  alternatives?: string[] | null;
  outlook?: string | null;
  confidence?: ConfidenceLevel | null;
  reportingCutoff?: string | null;
  handling?: string | null;
  /** stable id used to derive the report serial */
  serial?: string | null;
  generatedAt?: Date;
}

export interface IcProduct {
  banner: string;
  reportNumber: string;
  keyJudgments: string[];
  sections: IcSection[];
  confidence: ConfidenceLevel | null;
  generatedAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ASH-SENTINEL-20260808-4F2A — serial, not a random uuid, so retries match. */
export function reportNumber(kind: string, serial: string | null | undefined, at: Date): string {
  const tag = (kind || "INTEL").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "INTEL";
  const day = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
  const suffix = (serial ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `ASH-${tag}-${day}-${suffix}`;
}

const DEFAULT_SOURCE_SUMMARY =
  "Derived from open sources and from telemetry the account itself is connected to. Lines carrying an Admiralty grade are graded; ungraded lines are single-source and uncorroborated. No classified, intercepted or unlawfully obtained material is used, and no source here establishes legal identity.";

const DEFAULT_HANDLING =
  "Addressee eyes only. Not to be republished or redistributed. Not a consumer report: must not be used for any employment, tenancy, credit, insurance or licensing decision.";

const ABSENCE_CAVEAT =
  "Absence of a record is not evidence of absence and is not a clearance. Every line is a lead to verify, not a fact to act on.";

/**
 * Normalise any module's payload into an IC-shaped finished product.
 *
 * This runs on the delivery bus, so a module that has not been individually
 * upgraded still ships to standard: it gains the banner, the serial, the
 * canonical section order, the Source Summary and the mandated gap and
 * handling statements. What it does NOT gain is invented calibration — a
 * module that supplied no confidence is reported as uncalibrated, out loud.
 */
export function buildIcProduct(input: IcProductInput): IcProduct {
  const at = input.generatedAt ?? new Date();

  const keyJudgments = (input.findings ?? [])
    .map((f) => (typeof f === "string" ? f.trim() : ""))
    .filter(Boolean)
    .map((f) => portionMark(f, "U"))
    .slice(0, 14);

  const facts = (input.sections ?? []).filter((s) => s?.label && s?.value);

  const out: IcSection[] = [...facts];

  const upper = new Set(facts.map((s) => s.label.toUpperCase()));

  if (input.scopeNote && !upper.has("SCOPE NOTE")) {
    out.push({ label: "SCOPE NOTE", value: input.scopeNote });
  } else if (!upper.has("SCOPE NOTE")) {
    const subject = input.subjectName ? `Subject: ${input.subjectName}. ` : "";
    out.push({
      label: "SCOPE NOTE",
      value:
        `${subject}Produced by ${input.source || "Asherin Intelligence"} in response to activity on this account. ` +
        `Information available as of ${input.reportingCutoff || at.toUTCString()} was used. ` +
        `Out of scope: any non-public record, and any determination of legal identity.`,
    });
  }

  if (!upper.has("SOURCE SUMMARY")) {
    out.push({ label: "SOURCE SUMMARY", value: input.sourceSummary || DEFAULT_SOURCE_SUMMARY });
  }

  if (input.outlook && !upper.has("OUTLOOK")) {
    out.push({ label: "OUTLOOK", value: input.outlook });
  }

  const alts = (input.alternatives ?? []).filter(Boolean);
  if (!upper.has("ALTERNATIVE ANALYSIS")) {
    out.push({
      label: "ALTERNATIVE ANALYSIS",
      value: alts.length
        ? alts.join(" \u00B7 ")
        : "No competing explanation was recorded by the producing module. Treat the assessment above as one hypothesis among others until a second independent source is obtained.",
    });
  }

  const gaps = (input.gaps ?? []).filter(Boolean);
  if (!upper.has("INTELLIGENCE GAPS")) {
    out.push({
      label: "INTELLIGENCE GAPS",
      value: gaps.length ? gaps.join(" \u00B7 ") : `Not enumerated by the producing module. ${ABSENCE_CAVEAT}`,
    });
  }

  if (!upper.has("CONFIDENCE")) {
    out.push({
      label: "CONFIDENCE",
      value: input.confidence
        ? CONFIDENCE_RUBRIC[input.confidence]
        : "Uncalibrated \u2014 the producing module did not return a confidence level, so no confidence is asserted here. Read every judgment as unverified.",
    });
  }

  if (!upper.has("HANDLING")) {
    out.push({ label: "HANDLING", value: input.handling || DEFAULT_HANDLING });
  }

  return {
    banner: PRODUCT_BANNER,
    reportNumber: reportNumber(input.kind, input.serial, at),
    keyJudgments,
    sections: orderIcSections(out),
    confidence: input.confidence ?? null,
    generatedAt: at.toUTCString(),
  };
}
