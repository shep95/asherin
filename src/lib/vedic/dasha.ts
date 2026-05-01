/**
 * VIMSHOTTARI MAHADASHA — 120-year planetary cycle keyed off Moon nakshatra.
 * Each Mahadasha period is owned by a planet for a fixed number of years.
 * Birth dasha lord = ruler of Moon's nakshatra; remainder = portion of nakshatra unfinished.
 */
const DASHA_ORDER = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
] as const;

export type DashaLord = (typeof DASHA_ORDER)[number];

const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

// Nakshatra index (0..26) → ruling planet (matches Vimshottari sequence).
const NAK_LORDS: DashaLord[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

const NAK_SPAN = 360 / 27; // 13.3333°
const YEAR_MS = 365.2425 * 86400000;

export interface MahadashaPeriod {
  lord: DashaLord;
  start: Date;
  end: Date;
  years: number;
  isCurrent: boolean;
  antardashas: AntardashaPeriod[];
}

export interface AntardashaPeriod {
  lord: DashaLord;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

/**
 * Compute Vimshottari Mahadasha sequence from birth, returning periods that
 * span from birth to (now + futureYears).
 *
 * @param birthUtc        Birth datetime in UTC
 * @param moonSiderealDeg Moon sidereal longitude in degrees (0..360)
 * @param futureYears     How many years past today to project
 */
export function computeMahadasha(
  birthUtc: Date,
  moonSiderealDeg: number,
  futureYears = 30,
): MahadashaPeriod[] {
  const nakIndex = Math.floor(moonSiderealDeg / NAK_SPAN);
  const degInNak = moonSiderealDeg - nakIndex * NAK_SPAN;
  const fractionElapsed = degInNak / NAK_SPAN;

  const birthLord = NAK_LORDS[nakIndex];
  const birthLordYears = DASHA_YEARS[birthLord];
  const remainingYears = birthLordYears * (1 - fractionElapsed);

  const horizon = new Date(Date.now() + futureYears * YEAR_MS);

  const periods: MahadashaPeriod[] = [];
  let cursor = new Date(birthUtc);
  let lordIdx = DASHA_ORDER.indexOf(birthLord);
  let yearsForThis = remainingYears;
  const now = Date.now();

  while (cursor < horizon) {
    const lord = DASHA_ORDER[lordIdx];
    const end = new Date(cursor.getTime() + yearsForThis * YEAR_MS);
    const isCurrent = now >= cursor.getTime() && now < end.getTime();
    periods.push({
      lord,
      start: new Date(cursor),
      end,
      years: yearsForThis,
      isCurrent,
      antardashas: computeAntardashas(lord, cursor, yearsForThis, now),
    });
    cursor = end;
    lordIdx = (lordIdx + 1) % DASHA_ORDER.length;
    yearsForThis = DASHA_YEARS[DASHA_ORDER[lordIdx]];
  }

  return periods;
}

/** Antardasha (sub-period) sequence inside a Mahadasha. Sums to mahadasha years. */
function computeAntardashas(
  mahaLord: DashaLord,
  mahaStart: Date,
  mahaYears: number,
  nowMs: number,
): AntardashaPeriod[] {
  const startIdx = DASHA_ORDER.indexOf(mahaLord);
  const result: AntardashaPeriod[] = [];
  let cursor = new Date(mahaStart);
  for (let i = 0; i < DASHA_ORDER.length; i++) {
    const sub = DASHA_ORDER[(startIdx + i) % DASHA_ORDER.length];
    // Antardasha length = mahaYears * (subYears / 120)
    const subYears = (mahaYears * DASHA_YEARS[sub]) / 120;
    const end = new Date(cursor.getTime() + subYears * YEAR_MS);
    result.push({
      lord: sub,
      start: new Date(cursor),
      end,
      isCurrent: nowMs >= cursor.getTime() && nowMs < end.getTime(),
    });
    cursor = end;
  }
  return result;
}

export function findCurrentDasha(periods: MahadashaPeriod[]): {
  maha: MahadashaPeriod | null;
  antar: AntardashaPeriod | null;
} {
  const maha = periods.find((p) => p.isCurrent) ?? null;
  const antar = maha?.antardashas.find((a) => a.isCurrent) ?? null;
  return { maha, antar };
}
