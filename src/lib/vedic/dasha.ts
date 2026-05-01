/**
 * VIMSHOTTARI DASHA — 120-year planetary cycle keyed off Moon nakshatra.
 *
 * Hierarchy (each level subdivides the parent the same way):
 *   1. Mahadasha       (years)
 *   2. Antardasha      (months)
 *   3. Pratyantardasha (weeks)
 *   4. Sookshma        (days)        — "weekly" granularity in practice
 *   5. Prana           (hours)       — "daily" granularity in practice
 *
 * Sub-period length = parentLength * (subLordYears / 120)
 */
const DASHA_ORDER = [
  "Ketu", "Venus", "Sun", "Moon", "Mars",
  "Rahu", "Jupiter", "Saturn", "Mercury",
] as const;

export type DashaLord = (typeof DASHA_ORDER)[number];

const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};
const TOTAL_CYCLE = 120;

const NAK_LORDS: DashaLord[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

const NAK_SPAN = 360 / 27;
const YEAR_MS = 365.2425 * 86400000;

export type DashaLevel = "maha" | "antar" | "pratyantar" | "sookshma" | "prana";

export interface DashaPeriod {
  level: DashaLevel;
  lord: DashaLord;
  start: Date;
  end: Date;
  years: number;          // duration in fractional years
  isCurrent: boolean;
  /** Children one level deeper. Computed lazily — empty until expanded. */
  children?: DashaPeriod[];
}

const NEXT_LEVEL: Record<DashaLevel, DashaLevel | null> = {
  maha: "antar",
  antar: "pratyantar",
  pratyantar: "sookshma",
  sookshma: "prana",
  prana: null,
};

/**
 * Build the sub-period sequence inside a parent period.
 * Order starts from the parent's own lord and follows the standard Vimshottari cycle.
 */
function buildSubPeriods(
  parentLord: DashaLord,
  parentStart: Date,
  parentYears: number,
  level: DashaLevel,
  nowMs: number,
): DashaPeriod[] {
  const startIdx = DASHA_ORDER.indexOf(parentLord);
  const periods: DashaPeriod[] = [];
  let cursorMs = parentStart.getTime();
  for (let i = 0; i < DASHA_ORDER.length; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % DASHA_ORDER.length];
    const subYears = (parentYears * DASHA_YEARS[lord]) / TOTAL_CYCLE;
    const endMs = cursorMs + subYears * YEAR_MS;
    periods.push({
      level,
      lord,
      start: new Date(cursorMs),
      end: new Date(endMs),
      years: subYears,
      isCurrent: nowMs >= cursorMs && nowMs < endMs,
    });
    cursorMs = endMs;
  }
  return periods;
}

/** Recursively populate `children` on the *current* period at each level, down to `prana`. */
export function expandCurrentPath(period: DashaPeriod, nowMs = Date.now()): DashaPeriod {
  const nextLevel = NEXT_LEVEL[period.level];
  if (!nextLevel) return period;
  if (!period.children) {
    period.children = buildSubPeriods(period.lord, period.start, period.years, nextLevel, nowMs);
  }
  const cur = period.children.find((c) => c.isCurrent);
  if (cur) expandCurrentPath(cur, nowMs);
  return period;
}

/** Ensure a specific period has its direct children built (for on-demand UI expansion). */
export function ensureChildren(period: DashaPeriod, nowMs = Date.now()): DashaPeriod[] {
  const nextLevel = NEXT_LEVEL[period.level];
  if (!nextLevel) return [];
  if (!period.children) {
    period.children = buildSubPeriods(period.lord, period.start, period.years, nextLevel, nowMs);
  }
  return period.children;
}

export interface MahadashaTimeline {
  /** Moon nakshatra index 0..26 used as the dasha seed. */
  moonNakIndex: number;
  /** Birth-lord Mahadasha (often partial). */
  birthLord: DashaLord;
  periods: DashaPeriod[];
}

/**
 * Compute the Vimshottari Mahadasha sequence.
 *
 * @param birthUtc      Birth datetime (UTC)
 * @param moonSidDeg    Moon sidereal longitude (0..360)
 * @param mahaCount     Number of Mahadashas to return (birth lord + following). Default 14.
 *                      Pass `Infinity` to keep historical behaviour of "until horizon".
 */
export function computeMahadasha(
  birthUtc: Date,
  moonSidDeg: number,
  mahaCount = 14,
): DashaPeriod[] {
  const nakIndex = Math.floor(moonSidDeg / NAK_SPAN);
  const degInNak = moonSidDeg - nakIndex * NAK_SPAN;
  const fractionElapsed = degInNak / NAK_SPAN;

  const birthLord = NAK_LORDS[nakIndex];
  const remainingYears = DASHA_YEARS[birthLord] * (1 - fractionElapsed);

  const nowMs = Date.now();
  const periods: DashaPeriod[] = [];
  let cursorMs = birthUtc.getTime();
  let lordIdx = DASHA_ORDER.indexOf(birthLord);
  let yearsForThis = remainingYears;

  for (let i = 0; i < mahaCount; i++) {
    const lord = DASHA_ORDER[lordIdx];
    const endMs = cursorMs + yearsForThis * YEAR_MS;
    const period: DashaPeriod = {
      level: "maha",
      lord,
      start: new Date(cursorMs),
      end: new Date(endMs),
      years: yearsForThis,
      isCurrent: nowMs >= cursorMs && nowMs < endMs,
    };
    if (period.isCurrent) {
      // Pre-expand the active branch all the way down to Prana for instant display.
      expandCurrentPath(period, nowMs);
    } else {
      // Eagerly build Antardashas only — cheap and useful in the timeline.
      ensureChildren(period, nowMs);
    }
    periods.push(period);
    cursorMs = endMs;
    lordIdx = (lordIdx + 1) % DASHA_ORDER.length;
    yearsForThis = DASHA_YEARS[DASHA_ORDER[lordIdx]];
  }
  return periods;
}

export interface CurrentDashaPath {
  maha: DashaPeriod | null;
  antar: DashaPeriod | null;
  pratyantar: DashaPeriod | null;
  sookshma: DashaPeriod | null;
  prana: DashaPeriod | null;
}

export function findCurrentDasha(periods: DashaPeriod[]): CurrentDashaPath {
  const empty: CurrentDashaPath = { maha: null, antar: null, pratyantar: null, sookshma: null, prana: null };
  const maha = periods.find((p) => p.isCurrent) ?? null;
  if (!maha) return empty;
  const antar = maha.children?.find((c) => c.isCurrent) ?? null;
  const pratyantar = antar?.children?.find((c) => c.isCurrent) ?? null;
  const sookshma = pratyantar?.children?.find((c) => c.isCurrent) ?? null;
  const prana = sookshma?.children?.find((c) => c.isCurrent) ?? null;
  return { maha, antar, pratyantar, sookshma, prana };
}

export const DASHA_LEVEL_LABEL: Record<DashaLevel, string> = {
  maha: "Mahadasha",
  antar: "Antardasha",
  pratyantar: "Pratyantardasha",
  sookshma: "Sookshma (Weekly)",
  prana: "Prana (Daily)",
};
