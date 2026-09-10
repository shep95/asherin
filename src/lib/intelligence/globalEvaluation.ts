// global evaluation and the monthly cycle logic.
//
// promotion is earned on evidence dimensions, never on popularity. a candidate
// with thin evidence stays experimental; a candidate that fails safety or
// privacy review is rejected outright and stays rejected.

import type { GlobalCandidate, GlobalDecision, GlobalEvaluationScore } from "./types";

export const PROMOTION_POLICY = {
  minIndependentSources: 3,
  minEvidenceScore: 0.5,
  canonicalMinAverage: 0.7,
  experimentalMinAverage: 0.45,
  minSafety: 0.8,
  minPrivacy: 1,
};

const DIMENSIONS: (keyof GlobalEvaluationScore)[] = [
  "correctness",
  "evidence",
  "reproducibility",
  "generalizability",
  "robustness",
  "transferability",
  "utility",
  "simplicity",
  "explainability",
  "failureTolerance",
  "reversibility",
  "safety",
  "privacyCompatibility",
];

const UNSAFE = /\b(exploit|payload|bypass authentication|disable (rls|security)|exfiltrat|credential stuff|malware)\b/i;
const IRREVERSIBLE = /\b(delete all|drop table|truncate|irreversible|no rollback)\b/i;

/**
 * score a candidate on every published dimension. the scores are derived from
 * observable properties of the candidate, not asked of a model.
 */
export function evaluateCandidate(c: GlobalCandidate): GlobalEvaluationScore {
  const steps = c.procedure.length;
  const text = `${c.mechanism} ${c.procedure.join(" ")}`;

  const evidence = Math.min(1, c.evidenceScore);
  const reproducibility = steps >= 3 ? Math.min(1, 0.4 + steps * 0.1) : 0.2;
  const generalizability = c.abstractionLevel === "abstract" ? 0.8 : c.abstractionLevel === "meta" ? 0.9 : 0.4;
  const robustness = c.failureModes.length > 0 ? Math.min(1, 0.5 + c.failureModes.length * 0.15) : 0.3;
  const transferability = c.domain === "general" ? 0.8 : 0.5;
  const utility = Math.min(1, c.independentSources / PROMOTION_POLICY.minIndependentSources);
  const simplicity = steps === 0 ? 0.2 : Math.max(0.2, 1 - Math.max(0, steps - 6) * 0.1);
  const explainability = c.mechanism.length > 40 ? 0.8 : 0.4;
  const failureTolerance = c.failureModes.length > 0 ? 0.8 : 0.35;
  const reversibility = IRREVERSIBLE.test(text) ? 0.1 : 0.8;
  const safety = UNSAFE.test(text) ? 0 : 0.9;
  const privacyCompatibility = c.privacyChecked ? 1 : 0;
  const correctness = Math.min(1, (evidence + reproducibility) / 2);

  return {
    correctness,
    evidence,
    reproducibility,
    generalizability,
    robustness,
    transferability,
    utility,
    simplicity,
    explainability,
    failureTolerance,
    reversibility,
    safety,
    privacyCompatibility,
  };
}

export function averageScore(score: GlobalEvaluationScore): number {
  const total = DIMENSIONS.reduce((sum, d) => sum + score[d], 0);
  return Math.round((total / DIMENSIONS.length) * 100) / 100;
}

export interface PromotionVerdict {
  decision: GlobalDecision;
  average: number;
  reasons: string[];
  score: GlobalEvaluationScore;
}

export function decidePromotion(c: GlobalCandidate): PromotionVerdict {
  const score = evaluateCandidate(c);
  const average = averageScore(score);
  const reasons: string[] = [];

  if (score.privacyCompatibility < PROMOTION_POLICY.minPrivacy) {
    reasons.push("did not clear the privacy gateway");
    return { decision: "reject", average, reasons, score };
  }
  if (score.safety < PROMOTION_POLICY.minSafety) {
    reasons.push("failed safety review");
    return { decision: "reject", average, reasons, score };
  }
  if (c.independentSources < PROMOTION_POLICY.minIndependentSources) {
    reasons.push(
      `${c.independentSources} independent source${c.independentSources === 1 ? "" : "s"} — needs ${PROMOTION_POLICY.minIndependentSources}`,
    );
    return { decision: "experimental", average, reasons, score };
  }
  if (score.evidence < PROMOTION_POLICY.minEvidenceScore) {
    reasons.push("evidence too thin for a default");
    return { decision: "experimental", average, reasons, score };
  }
  if (average >= PROMOTION_POLICY.canonicalMinAverage) {
    reasons.push(`average ${average} across ${DIMENSIONS.length} dimensions`);
    return { decision: "canonical", average, reasons, score };
  }
  if (average >= PROMOTION_POLICY.experimentalMinAverage) {
    reasons.push(`average ${average} is promising but below the canonical bar`);
    return { decision: "experimental", average, reasons, score };
  }
  reasons.push(`average ${average} below the experimental bar`);
  return { decision: "refine", average, reasons, score };
}

/** adversarial pass: try to break the candidate before trusting it broadly. */
export function adversarialReview(c: GlobalCandidate): { survives: boolean; findings: string[] } {
  const findings: string[] = [];
  const text = `${c.mechanism} ${c.procedure.join(" ")}`.toLowerCase();

  if (!/\b(if|when|unless|otherwise|fails?)\b/.test(text)) {
    findings.push("no stated condition under which it should not be used");
  }
  if (c.failureModes.length === 0) findings.push("no recorded failure mode");
  if (c.procedure.length === 1) findings.push("single-step procedure is closer to a slogan than a mechanism");
  if (/\balways\b/.test(text)) findings.push("absolute wording — a global pattern must yield to local constraints");

  return { survives: findings.length < 3, findings };
}

/**
 * a global pattern never overrides local context. this is the runtime check the
 * orchestrator uses before applying one.
 */
export function applicabilityAgainstLocal(
  globalConstraints: string[],
  local: { userRules: string[]; projectRules: string[]; taskConstraints: string[] },
): { verdict: "use" | "evaluate" | "conflict"; conflicts: string[] } {
  const locals = [...local.userRules, ...local.projectRules, ...local.taskConstraints].map((s) => s.toLowerCase());
  const conflicts: string[] = [];

  for (const g of globalConstraints) {
    const gl = g.toLowerCase();
    for (const l of locals) {
      const negated = /^never |^do not |^don't /.test(l) && gl.includes(l.replace(/^never |^do not |^don't /, "").slice(0, 20));
      if (negated) conflicts.push(`local rule "${l}" contradicts global constraint "${g}"`);
    }
  }

  if (conflicts.length > 0) return { verdict: "conflict", conflicts };
  if (locals.length === 0) return { verdict: "evaluate", conflicts };
  return { verdict: "use", conflicts };
}

export function periodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
