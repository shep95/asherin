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
