/**
 * WEALTH & SOULMATE WINDOW DETECTOR
 *
 * Given the user's sensitive points and the list of upcoming planetary
 * sign-ingresses, this module extracts the SPECIFIC future windows where
 * either (a) millionaire-grade wealth karmas activate, or (b) the soulmate
 * / marriage karmas activate — based on which natal point the transiting
 * sign actually hits, NOT generic "Jupiter in 9th house" platitudes.
 *
 * Wealth axis  : L2 (Dhana), L5 (Purva Punya), L9 (Bhagya), L11 (Labha), AK
 * Soulmate axis: UL (Upapada), DK (Darakaraka), L7 (7th lord), Chandra (Moon)
 *
 * Window strength = sum of activator weights stacked inside the same
 * 6-month period. Multiple benefics hitting wealth points in the same
 * window = "millionaire-grade" stack.
 */
import type { SignIngress } from "./transits";
import type { SensitivePoints, PointCode } from "./sensitivePoints";
import { whyTransitMatters } from "./sensitivePoints";

export type WindowKind = "wealth" | "soulmate" | "health";

export interface ActivationHit {
  date: Date;
  planet: string;
  symbol: string;
  retrograde: boolean;
  pointCode: PointCode;
  pointLabel: string;
  signName: string;
  weight: number;
  reasoning: string;
}

export interface KarmicWindow {
  kind: WindowKind;
  start: Date;
  end: Date;
  score: number;
  grade: "Peak — once-a-decade" | "Strong" | "Moderate" | "Background";
  headline: string;
  hits: ActivationHit[];
}

const WEALTH_POINTS = new Set<PointCode>(["L2", "L5", "L9", "L11", "AK"]);
const SOULMATE_POINTS = new Set<PointCode>(["UL", "DK", "L7", "Chandra"]);

// Per-planet weight on each axis. Higher = bigger structural mover.
const WEALTH_WEIGHT: Record<string, number> = {
  Jupiter: 5, Venus: 3, Rahu: 4, Sun: 1, Mercury: 1, Mars: 1,
  Saturn: -2, Ketu: -2, Moon: 1,
};
const SOULMATE_WEIGHT: Record<string, number> = {
  Jupiter: 5, Venus: 5, Rahu: 2, Mars: 1, Mercury: 1, Sun: 1, Moon: 1,
  Saturn: -2, Ketu: -3,
};

// Extra weight when point is high-impact (L9, L11, UL, AK)
const POINT_BONUS: Partial<Record<PointCode, number>> = {
  L9: 3, L11: 2, L2: 1, AK: 2, UL: 3, DK: 2, L7: 1,
};

function applyRetro(w: number, retro: boolean): number {
  return retro ? Math.round(w * 0.6) : w;
}

function gradeScore(score: number): KarmicWindow["grade"] {
  const s = Math.abs(score);
  if (s >= 14) return "Peak — once-a-decade";
  if (s >= 8)  return "Strong";
  if (s >= 4)  return "Moderate";
  return "Background";
}

function makeHit(
  ing: SignIngress,
  pointCode: PointCode,
  pointLabel: string,
  signName: string,
  weight: number,
  reasoning: string,
): ActivationHit {
  return {
    date: ing.date,
    planet: ing.planet,
    symbol: ing.symbol,
    retrograde: ing.retrograde,
    pointCode, pointLabel, signName, weight, reasoning,
  };
}

/**
 * Scan upcoming ingresses, cluster them into 6-month windows, and rank.
 */
export function detectWindows(
  ingresses: SignIngress[],
  points: SensitivePoints | null,
  kind: WindowKind,
  opts: { clusterDays?: number; minScore?: number } = {},
): KarmicWindow[] {
  if (!points || !ingresses.length) return [];
  const clusterMs = (opts.clusterDays ?? 180) * 86400_000;
  const minScore = opts.minScore ?? 3;
  const interesting = kind === "wealth" ? WEALTH_POINTS : SOULMATE_POINTS;
  const planetWeights = kind === "wealth" ? WEALTH_WEIGHT : SOULMATE_WEIGHT;

  // 1. Pull only the ingresses that actually hit a relevant point
  const raw: ActivationHit[] = [];
  for (const ing of ingresses) {
    const whys = whyTransitMatters(ing.planet, ing.toSignIndex, points);
    for (const w of whys) {
      if (!interesting.has(w.pointCode)) continue;
      const baseW = planetWeights[ing.planet];
      if (baseW === undefined) continue;
      const bonus = POINT_BONUS[w.pointCode] ?? 0;
      const weight = applyRetro(baseW + Math.sign(baseW) * bonus, ing.retrograde);
      if (weight === 0) continue;
      raw.push(makeHit(ing, w.pointCode, w.pointLabel, w.signName, weight, w.text));
    }
  }
  if (!raw.length) return [];

  // 2. Cluster by proximity in time (greedy walk through sorted list)
  raw.sort((a, b) => a.date.getTime() - b.date.getTime());
  const windows: KarmicWindow[] = [];
  let bucket: ActivationHit[] = [];
  for (const hit of raw) {
    if (!bucket.length) { bucket.push(hit); continue; }
    const first = bucket[0].date.getTime();
    if (hit.date.getTime() - first <= clusterMs) {
      bucket.push(hit);
    } else {
      pushWindow(windows, bucket, kind, minScore);
      bucket = [hit];
    }
  }
  pushWindow(windows, bucket, kind, minScore);

  windows.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  return windows;
}

function pushWindow(
  windows: KarmicWindow[],
  bucket: ActivationHit[],
  kind: WindowKind,
  minScore: number,
) {
  if (!bucket.length) return;
  const score = bucket.reduce((s, h) => s + h.weight, 0);
  if (Math.abs(score) < minScore) return;
  const start = bucket[0].date;
  const end = bucket[bucket.length - 1].date;
  const grade = gradeScore(score);
  const headline = buildHeadline(bucket, kind, score);
  windows.push({ kind, start, end, score, grade, headline, hits: bucket });
}

function buildHeadline(hits: ActivationHit[], kind: WindowKind, score: number): string {
  const planets = Array.from(new Set(hits.map((h) => h.planet))).join(" + ");
  const points = Array.from(new Set(hits.map((h) => h.pointLabel))).join(", ");
  if (kind === "wealth") {
    if (score >= 14) return `Millionaire-grade wealth stack — ${planets} igniting ${points}`;
    if (score >= 8)  return `Strong wealth window — ${planets} on ${points}`;
    if (score >= 4)  return `Wealth window — ${planets} activating ${points}`;
    if (score <= -4) return `Wealth pruning phase — ${planets} testing ${points}`;
    return `Wealth-axis activity — ${planets} on ${points}`;
  }
  if (score >= 12) return `Peak soulmate / marriage window — ${planets} on ${points}`;
  if (score >= 7)  return `Strong relationship window — ${planets} on ${points}`;
  if (score >= 3)  return `Romance / partnership opening — ${planets} on ${points}`;
  if (score <= -3) return `Relationship pressure — ${planets} on ${points}`;
  return `Partnership-axis activity — ${planets} on ${points}`;
}
