// ═══════════════════════════════════════════════════════════════════════════
// ONE SHARED CONFIDENCE SCALE
//
// Every organ used to grade its own claims on its own private scale, so a
// 0.9 from POSTMARK and a 0.9 from the Sentinel meant different things and
// could not be added together. This module is the single scale the whole
// organism uses, and it enforces three rules that no organ may opt out of:
//
//   1. CORROBORATION LAW — confidence is capped by how many INDEPENDENT
//      organs reported the same thing. One witness can never produce high
//      confidence, no matter how certain that witness feels.
//   2. DECAY LAW — a claim that stops being re-observed loses confidence on
//      an exponential half-life. Memory that never fades is not memory,
//      it is a fixed blocklist.
//   3. CALIBRATION LAW — the account's measured hit rate (from the
//      homeostasis ledger) scales every new claim, so a system that has been
//      wrong lately becomes quieter without anyone tuning it by hand.
// ═══════════════════════════════════════════════════════════════════════════

/** Ceiling on confidence by number of distinct corroborating organs. */
const CORROBORATION_CEILING: Record<number, number> = {
  0: 0.15,
  1: 0.55, // a single organ can suspect; it can never be sure
  2: 0.8,
  3: 0.92,
};
const MAX_CEILING = 0.97; // nothing in the organism is ever certain

/** Per-kind half-lives, in hours. Volatile facts forget faster. */
export const HALF_LIFE_HOURS: Record<string, number> = {
  network: 24 * 7, // a coffee-shop network judgement is stale in a week
  radio: 24 * 10,
  device: 24 * 30,
  credential: 24 * 90, // a leaked credential stays dangerous a long time
  email: 24 * 60,
  phone: 24 * 60,
  person: 24 * 120,
  domain: 24 * 45,
  place: 24 * 30,
  org: 24 * 90,
};

export function halfLifeFor(kind: string): number {
  return HALF_LIFE_HOURS[kind] ?? 24 * 14;
}

export function ceilingFor(corroboration: number): number {
  if (corroboration >= 4) return MAX_CEILING;
  return CORROBORATION_CEILING[Math.max(0, corroboration)] ?? MAX_CEILING;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Fuse a new observation into a standing confidence.
 *
 * Deliberately NOT a plain average: repeated agreement should raise
 * confidence toward the ceiling, while a contradicting observation should
 * pull it down faster than agreement pushes it up (asymmetry is what keeps
 * an immune system from calcifying around a stale belief).
 */
export function fuse(
  prior: number,
  observation: number,
  opts: { corroboration: number; contradicts?: boolean; calibration?: number },
): number {
  const cal = clamp01(opts.calibration ?? 0.5);
  // calibration 0.5 is neutral; below 0.5 damps, above 0.5 mildly amplifies
  const scaled = clamp01(observation * (0.7 + 0.6 * cal));

  const fused = opts.contradicts
    ? clamp01(prior - Math.max(0.12, scaled * 0.6))
    : clamp01(prior + (1 - prior) * scaled * 0.55);

  return Math.min(fused, ceilingFor(opts.corroboration));
}

/** Exponential decay from the moment the claim was last corroborated. */
export function decay(confidence: number, hoursSinceSeen: number, halfLifeHours: number): number {
  if (hoursSinceSeen <= 0 || halfLifeHours <= 0) return clamp01(confidence);
  return clamp01(confidence * Math.pow(0.5, hoursSinceSeen / halfLifeHours));
}

/** Analyst-grade labels so the UI never invents its own vocabulary. */
export function grade(confidence: number, corroboration: number): {
  band: "confirmed" | "probable" | "possible" | "unsubstantiated";
  label: string;
} {
  if (corroboration >= 2 && confidence >= 0.75) return { band: "confirmed", label: "CORROBORATED" };
  if (confidence >= 0.55) return { band: "probable", label: "PROBABLE" };
  if (confidence >= 0.3) return { band: "possible", label: "POSSIBLE" };
  return { band: "unsubstantiated", label: "UNSUBSTANTIATED" };
}

/**
 * Response tier. The reflex arc may act locally and immediately, but the
 * considered layer may only ACT when more than one organ agrees — a single
 * paranoid reading is never allowed to trigger an account-wide response.
 */
export function tierFor(confidence: number, corroboration: number): "log" | "advise" | "act" {
  if (corroboration >= 2 && confidence >= 0.78) return "act";
  if (confidence >= 0.45) return "advise";
  return "log";
}
