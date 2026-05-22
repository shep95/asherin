/**
 * LIFE SEQUENCE PREDICTOR
 *
 * Answers three ordered life-questions by fusing Vimshottari Dasha lords with
 * future Karmic Windows (transit-derived):
 *   1. Will the person become rich BEFORE meeting their soulmate?
 *   2. When will they meet their soulmate?
 *   3. When will they become rich?
 *
 * "Real event" = a transit window (positive score) whose firing planets are
 * ALSO active as Vimshottari lords (Maha or Antar) at the same instant —
 * the classical "Dasha supports + Transit triggers" combo.
 */
import type { SweVedicPlanet } from "./sweChart";
import type { DashaPeriod } from "./dasha";
import type { KarmicWindow } from "./wealthSoulmateWindows";

const SIGN_LORD: Record<number, string> = {
  0: "Mars", 1: "Venus", 2: "Mercury", 3: "Moon", 4: "Sun",
  5: "Mercury", 6: "Venus", 7: "Mars", 8: "Jupiter",
  9: "Saturn", 10: "Saturn", 11: "Jupiter",
};

function signOf(deg: number) { return Math.floor(((deg % 360) + 360) % 360 / 30); }
function degInSign(deg: number) { return ((deg % 30) + 30) % 30; }

export interface DashaActivePeriod {
  start: Date;
  end: Date;
  mahaLord: string;
  antarLord: string;
  /** Which of the topic's lords are firing in this period (maha and/or antar). */
  lords: string[];
  /** Weight: 3 (maha lord match) + 2 (antar lord match). */
  weight: number;
}

export interface LifeEvent {
  /** Center date of the convergence (transit window's start). */
  date: Date;
  start: Date;
  end: Date;
  window: KarmicWindow;
  /** Active dasha context at the event. */
  dasha: DashaActivePeriod | null;
  /** Lords from this topic that are BOTH transiting AND dasha-active. */
  convergingLords: string[];
  /** 0..6+ combined confidence (transit score + dasha weight). */
  confidence: number;
  grade: "peak" | "strong" | "moderate";
}

export interface WealthPotential {
  /** 0..100 raw natal-strength score for wealth/dhana yogas. */
  score: number;
  /** Tier the chart supports. "none" → hide rich predictions. */
  tier: "billionaire" | "millionaire" | "comfortable" | "none";
  /** Plain-English reasons that drove the score. */
  reasons: string[];
}

export interface WealthVelocity {
  /** How wealth tends to arrive for this chart, based on event spread. */
  kind: "overnight" | "fast-window" | "slow-build" | "staircase" | "unknown";
  label: string;
  detail: string;
}

export interface LifeSequence {
  wealthLords: string[];
  soulmateLords: string[];
  wealthEvent: LifeEvent | null;
  soulmateEvent: LifeEvent | null;
  /** All dasha-supported wealth windows in scan range, earliest first. */
  wealthCandidates: LifeEvent[];
  soulmateCandidates: LifeEvent[];
  order: "wealth-first" | "soulmate-first" | "simultaneous" | "wealth-only" | "soulmate-only" | "neither";
  /** Months between the two events (positive = wealth first). */
  gapMonths: number | null;
  /** Plain English answer to Q1. */
  q1Verdict: string;
  /** Future dasha-only wealth/soulmate periods (no transit confirmation yet). */
  futureDashaWealth: DashaActivePeriod[];
  futureDashaSoulmate: DashaActivePeriod[];
  /** Natal-chart capacity for wealth. */
  wealthPotential: WealthPotential;
  /** Tempo classification (overnight vs slow-build). */
  wealthVelocity: WealthVelocity;
}

const KARAKAS = {
  wealth: ["Jupiter", "Venus"],
  soulmate: ["Venus", "Jupiter"],
};

// Classical own/exaltation signs (0=Aries..11=Pisces)
const OWN_SIGNS: Record<string, number[]> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10],
};
const EXALT_SIGN: Record<string, number> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6,
};
const DEBIL_SIGN: Record<string, number> = {
  Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0,
};
const WEALTH_HOUSES = new Set([1, 2, 5, 9, 10, 11]);

/** Score natal dhana-yoga strength. Returns 0..100 and a tier. */
function computeWealthPotential(planets: SweVedicPlanet[], ascendant: number): WealthPotential {
  const ascSign = signOf(ascendant);
  const houseOf = (deg: number) => ((signOf(deg) - ascSign + 12) % 12) + 1;
  const lordOfHouse = (h: number) => SIGN_LORD[(ascSign + (h - 1)) % 12];

  let score = 0;
  const reasons: string[] = [];

  // 1. Jupiter + Venus (wealth karakas) condition
  for (const k of ["Jupiter", "Venus"]) {
    const p = planets.find((x) => x.name === k);
    if (!p) continue;
    const s = signOf(p.sid);
    const h = houseOf(p.sid);
    if (EXALT_SIGN[k] === s) { score += 18; reasons.push(`${k} exalted (royal wealth karaka)`); }
    else if (OWN_SIGNS[k]?.includes(s)) { score += 12; reasons.push(`${k} in own sign`); }
    else if (DEBIL_SIGN[k] === s) { score -= 10; reasons.push(`${k} debilitated (wealth-karaka weak)`); }
    if (WEALTH_HOUSES.has(h)) { score += 10; reasons.push(`${k} sits in dhana house ${h}`); }
  }

  // 2. Wealth-house lords (2/5/9/11) placed in dhana houses
  let dhanaLordsInDhana = 0;
  for (const h of [2, 5, 9, 10, 11]) {
    const lordName = lordOfHouse(h);
    const lord = planets.find((p) => p.name === lordName);
    if (!lord) continue;
    const lordHouse = houseOf(lord.sid);
    if (WEALTH_HOUSES.has(lordHouse)) {
      score += 7;
      dhanaLordsInDhana += 1;
    }
    // Exaltation/own boost
    const s = signOf(lord.sid);
    if (EXALT_SIGN[lordName] === s) score += 6;
    else if (OWN_SIGNS[lordName]?.includes(s)) score += 4;
    else if (DEBIL_SIGN[lordName] === s) score -= 4;
  }
  if (dhanaLordsInDhana >= 3) reasons.push(`${dhanaLordsInDhana} wealth-lords parked in dhana houses (dhana-yoga stack)`);
  else if (dhanaLordsInDhana >= 1) reasons.push(`${dhanaLordsInDhana} wealth-lord(s) in dhana houses`);

  // 3. Atmakaraka identity (Jupiter/Venus/Sun AK = ultra-wealth flavor)
  const karakaPool = planets.filter((p) =>
    ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"].includes(p.name));
  const ak = [...karakaPool].sort((a, b) => degInSign(b.sid) - degInSign(a.sid))[0]?.name;
  if (ak && ["Jupiter", "Venus", "Sun"].includes(ak)) {
    score += 10;
    reasons.push(`Atmakaraka = ${ak} (soul-aligned with wealth/legacy)`);
  }

  // 4. L11 lord (gains house) explicit boost
  const l11 = planets.find((p) => p.name === lordOfHouse(11));
  if (l11) {
    const s = signOf(l11.sid);
    if (EXALT_SIGN[l11.name] === s || OWN_SIGNS[l11.name]?.includes(s)) {
      score += 8;
      reasons.push(`Lord of 11th (gains) is strong by sign`);
    }
  }

  // Cap
  score = Math.max(0, Math.min(100, Math.round(score)));

  let tier: WealthPotential["tier"];
  if (score >= 65) tier = "billionaire";
  else if (score >= 40) tier = "millionaire";
  else if (score >= 22) tier = "comfortable";
  else tier = "none";

  return { score, tier, reasons: reasons.slice(0, 6) };
}

/** Classify how wealth arrives: overnight burst vs slow staircase. */
function classifyWealthVelocity(candidates: LifeEvent[]): WealthVelocity {
  if (candidates.length === 0) {
    return { kind: "unknown", label: "No confirmed window", detail: "No dasha+transit wealth convergence inside the scan horizon." };
  }
  const first = candidates[0];
  const firstMs = first.start.getTime();
  const firstDurDays = (first.end.getTime() - first.start.getTime()) / 86_400_000;
  // Look at follow-ups within 5 years of first event
  const fiveYearMs = 5 * 365 * 86_400_000;
  const followUps = candidates.filter((c) => {
    const dt = c.start.getTime() - firstMs;
    return dt > 0 && dt <= fiveYearMs;
  });
  const peakHits = candidates.filter((c) => c.grade === "peak").length;

  // Overnight: lone peak/strong event, narrow window (<60 days), <=1 followup
  if ((first.grade === "peak" || first.grade === "strong") && firstDurDays <= 60 && followUps.length <= 1) {
    return {
      kind: "overnight",
      label: "Overnight-success pattern",
      detail: `Chart fires one tight ${first.grade} window (${Math.round(firstDurDays)}d) with no immediate follow-ups — wealth tends to arrive as a sudden break, not a grind.`,
    };
  }
  // Fast window: peak/strong but slightly wider
  if ((first.grade === "peak" || first.grade === "strong") && followUps.length <= 2) {
    return {
      kind: "fast-window",
      label: "Fast-window breakthrough",
      detail: `Strong primary window (${first.grade}) with ${followUps.length} follow-up(s) inside 5 years — quick scale once the first window opens.`,
    };
  }
  // Staircase: 3-5 windows over 2-5 years
  if (followUps.length >= 2 && followUps.length <= 5 && peakHits >= 1) {
    return {
      kind: "staircase",
      label: "Staircase ascent",
      detail: `${followUps.length + 1} convergence windows in 5 years, ${peakHits} at peak grade — wealth climbs in distinct steps.`,
    };
  }
  // Slow build: many moderate windows
  return {
    kind: "slow-build",
    label: "Slow-build accumulation",
    detail: `${candidates.length} convergence windows spread across the horizon, most moderate — wealth compounds steadily rather than overnight.`,
  };
}


function deriveTopicLords(planets: SweVedicPlanet[], ascendant: number) {
  const ascSign = signOf(ascendant);
  const lordOfHouse = (h: number) => SIGN_LORD[(ascSign + (h - 1)) % 12];

  const karakaPool = planets.filter((p) =>
    ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"].includes(p.name)
  );
  const sortedByDeg = [...karakaPool].sort((a, b) => degInSign(b.sid) - degInSign(a.sid));
  const ak = sortedByDeg[0]?.name;
  const dk = sortedByDeg[sortedByDeg.length - 1]?.name;

  // Upapada Lagna lord (sign of L2 lord, count 12th from it → ruler of that sign)
  const sign2 = (ascSign + 1) % 12;
  const lord2Name = SIGN_LORD[sign2];
  const lord2Planet = planets.find((p) => p.name === lord2Name);
  const lord2Sign = lord2Planet ? signOf(lord2Planet.sid) : sign2;
  const ulSign = (lord2Sign + 11) % 12;
  const ulLord = SIGN_LORD[ulSign];

  const wealth = new Set<string>([
    lordOfHouse(2), lordOfHouse(5), lordOfHouse(9), lordOfHouse(11),
    ...KARAKAS.wealth,
  ]);
  if (ak) wealth.add(ak);

  const soulmate = new Set<string>([
    lordOfHouse(7), ulLord,
    ...KARAKAS.soulmate, "Moon",
  ]);
  if (dk) soulmate.add(dk);

  return { wealth: Array.from(wealth), soulmate: Array.from(soulmate) };
}

/** Walk maha periods + their antar children, collect periods where lord ∈ topicLords. */
function collectDashaPeriods(
  mahaPeriods: DashaPeriod[],
  topicLords: string[],
  fromMs: number,
): DashaActivePeriod[] {
  const set = new Set(topicLords);
  const out: DashaActivePeriod[] = [];
  for (const maha of mahaPeriods) {
    if (maha.end.getTime() < fromMs) continue;
    const mahaHit = set.has(maha.lord);
    const antars = maha.children || [];
    if (antars.length === 0) {
      if (mahaHit) {
        out.push({
          start: maha.start, end: maha.end,
          mahaLord: maha.lord, antarLord: maha.lord,
          lords: [maha.lord], weight: 3,
        });
      }
      continue;
    }
    for (const antar of antars) {
      if (antar.end.getTime() < fromMs) continue;
      const antarHit = set.has(antar.lord);
      if (!mahaHit && !antarHit) continue;
      const lords: string[] = [];
      let weight = 0;
      if (mahaHit) { lords.push(maha.lord); weight += 3; }
      if (antarHit && antar.lord !== maha.lord) { lords.push(antar.lord); weight += 2; }
      else if (antarHit) { weight += 2; }
      out.push({
        start: antar.start, end: antar.end,
        mahaLord: maha.lord, antarLord: antar.lord,
        lords, weight,
      });
    }
  }
  return out;
}

function findDashaAt(dashaPeriods: DashaActivePeriod[], whenMs: number): DashaActivePeriod | null {
  for (const p of dashaPeriods) {
    if (whenMs >= p.start.getTime() && whenMs <= p.end.getTime()) return p;
  }
  return null;
}

function rankCandidates(
  windows: KarmicWindow[],
  dashaPeriods: DashaActivePeriod[],
  topicLords: string[],
): LifeEvent[] {
  const topicSet = new Set(topicLords);
  const out: LifeEvent[] = [];
  for (const w of windows) {
    if (w.score <= 0) continue; // only positive (favourable) for "will happen"
    const dasha = findDashaAt(dashaPeriods, w.start.getTime())
      ?? findDashaAt(dashaPeriods, (w.start.getTime() + w.end.getTime()) / 2);
    if (!dasha) continue; // require dasha support for an "event"
    // converging lords = window-firing planets that are also topic lords AND dasha-active
    const firing = new Set(w.hits.filter((h) => h.weight > 0).map((h) => h.planet));
    const converge = Array.from(firing).filter(
      (p) => topicSet.has(p) && dasha.lords.includes(p),
    );
    const confidence = w.score + dasha.weight + converge.length * 1.5;
    const grade: LifeEvent["grade"] =
      confidence >= 14 ? "peak" : confidence >= 8 ? "strong" : "moderate";
    out.push({
      date: w.start, start: w.start, end: w.end,
      window: w, dasha, convergingLords: converge,
      confidence, grade,
    });
  }
  // Earliest first (chronological — we want WHEN it first fires).
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

export function computeLifeSequence(
  natalPlanets: SweVedicPlanet[],
  ascendant: number,
  mahaPeriods: DashaPeriod[],
  wealthWindows: KarmicWindow[],
  soulmateWindows: KarmicWindow[],
  nowMs: number = Date.now(),
): LifeSequence {
  const lords = deriveTopicLords(natalPlanets, ascendant);
  const wealthDasha = collectDashaPeriods(mahaPeriods, lords.wealth, nowMs);
  const soulmateDasha = collectDashaPeriods(mahaPeriods, lords.soulmate, nowMs);

  const wealthCandidates = rankCandidates(wealthWindows, wealthDasha, lords.wealth);
  const soulmateCandidates = rankCandidates(soulmateWindows, soulmateDasha, lords.soulmate);

  // Pick FIRST event that has at least 1 converging lord; fall back to first candidate.
  const pickFirst = (list: LifeEvent[]): LifeEvent | null => {
    const converged = list.find((e) => e.convergingLords.length > 0);
    return converged ?? list[0] ?? null;
  };
  const wealthEvent = pickFirst(wealthCandidates);
  const soulmateEvent = pickFirst(soulmateCandidates);

  let order: LifeSequence["order"] = "neither";
  let gapMonths: number | null = null;
  let q1: string;
  if (wealthEvent && soulmateEvent) {
    const dw = wealthEvent.start.getTime();
    const ds = soulmateEvent.start.getTime();
    const diffMs = ds - dw;
    gapMonths = Math.round(diffMs / (30 * 86400_000));
    if (Math.abs(gapMonths) < 1) { order = "simultaneous"; q1 = "Wealth and soulmate hit at the same time — they arrive together."; }
    else if (gapMonths > 0)      { order = "wealth-first"; q1 = `Yes — wealth arrives ~${gapMonths} month${gapMonths === 1 ? "" : "s"} before soulmate.`; }
    else                          { order = "soulmate-first"; q1 = `No — soulmate arrives ~${Math.abs(gapMonths)} month${Math.abs(gapMonths) === 1 ? "" : "s"} before wealth.`; }
  } else if (wealthEvent) {
    order = "wealth-only"; q1 = "Wealth fires in this horizon, but no dasha-backed soulmate window appears — extend your scan to see if soulmate comes later.";
  } else if (soulmateEvent) {
    order = "soulmate-only"; q1 = "Soulmate fires in this horizon, but no dasha-backed wealth window appears — extend your scan.";
  } else {
    q1 = "Neither event has a dasha+transit convergence inside the current scan horizon. Extend scan or check long-range dasha-only signals below.";
  }

  return {
    wealthLords: lords.wealth,
    soulmateLords: lords.soulmate,
    wealthEvent,
    soulmateEvent,
    wealthCandidates,
    soulmateCandidates,
    order,
    gapMonths,
    q1Verdict: q1,
    futureDashaWealth: wealthDasha,
    futureDashaSoulmate: soulmateDasha,
  };
}
