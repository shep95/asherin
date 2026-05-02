/**
 * LIFE TIMELINE ENGINE — pure deterministic personal predictions.
 *
 * No AI. Pure math + planetary positions + Vimshottari period chain.
 *
 * Generates dated life-event predictions:
 *   • Past:   childhood phases, school years, early career, formative crises
 *   • Future: wealth windows, soulmate windows, power peaks, health flags,
 *             relocation/foreign travel, spiritual turns, billionaire windows
 *
 * Method: walk every Mahadasha + every Antardasha (sub) inside it. For each
 * sub-period (window), score the dasha-lord chain against the natal chart
 * using the same dignity/house logic as `dashaReading.ts`, then emit a
 * concrete dated event when score thresholds are crossed. All timestamps
 * come from Bishop's Vimshottari math — they are exact.
 */

import { computeMahadasha, ensureChildren, type DashaPeriod, type DashaLord } from "./dasha";
import { buildDashaInsight, type DashaInsight, type LifeFlag } from "./dashaReading";
import type { SweVedicChart } from "./sweChart";

export type LifePhase =
  | "infancy"      // 0-3
  | "childhood"    // 3-12
  | "adolescence"  // 12-18
  | "young_adult"  // 18-30
  | "adult"        // 30-50
  | "midlife"      // 50-65
  | "elder";       // 65+

export type EventCategory =
  | "wealth" | "career" | "love" | "marriage" | "education"
  | "health" | "spiritual" | "travel" | "loss" | "power"
  | "milestone" | "crisis";

export interface LifeEvent {
  /** Centered timestamp of the window */
  date: Date;
  start: Date;
  end: Date;
  /** "past" if end < now, else "future" */
  era: "past" | "future";
  ageYears: number;            // user age at event center
  phase: LifePhase;
  category: EventCategory;
  title: string;               // e.g. "Wealth Activation Window"
  description: string;         // chart-grounded sentence(s)
  intensity: number;           // 0-100
  dashaChain: string;          // "Jupiter MD → Venus AD"
  flags: LifeFlag[];
}

const PHASE_RANGES: { phase: LifePhase; min: number; max: number }[] = [
  { phase: "infancy",     min: 0,  max: 3 },
  { phase: "childhood",   min: 3,  max: 12 },
  { phase: "adolescence", min: 12, max: 18 },
  { phase: "young_adult", min: 18, max: 30 },
  { phase: "adult",       min: 30, max: 50 },
  { phase: "midlife",     min: 50, max: 65 },
  { phase: "elder",       min: 65, max: 200 },
];

function phaseFor(age: number): LifePhase {
  return PHASE_RANGES.find((r) => age >= r.min && age < r.max)?.phase ?? "elder";
}

function ageAt(birth: Date, when: Date): number {
  return (when.getTime() - birth.getTime()) / (365.25 * 86400_000);
}

/** Convert a Vimshottari sub-period (Maha/Antar) into 0..n LifeEvents. */
function eventsForPeriod(
  period: DashaPeriod,
  parents: DashaPeriod[],
  chart: SweVedicChart,
  birth: Date,
  nowMs: number,
): LifeEvent[] {
  const insight = buildDashaInsight(period, parents, chart);
  const center = new Date((period.start.getTime() + period.end.getTime()) / 2);
  const age = ageAt(birth, center);
  const phase = phaseFor(age);
  const era: "past" | "future" = period.end.getTime() < nowMs ? "past" : "future";
  const chainLabel = [...parents, period].map((p) => `${p.lord} ${p.level === "maha" ? "MD" : "AD"}`).join(" → ");

  const out: LifeEvent[] = [];

  const baseEvent = (
    cat: EventCategory, title: string, description: string, intensity: number, flags: LifeFlag[] = [],
  ): LifeEvent => ({
    date: center, start: period.start, end: period.end, era,
    ageYears: Math.max(0, age), phase, category: cat,
    title, description, intensity: Math.round(Math.max(0, Math.min(100, intensity))),
    dashaChain: chainLabel, flags,
  });

  // ── Phase-specific past events (childhood / school / formative) ────────
  if (era === "past") {
    if (phase === "infancy") {
      out.push(baseEvent(
        "milestone",
        "Foundation Imprint",
        `Earliest neural and emotional patterning runs under ${period.lord}. ${insight.headline}`,
        45,
      ));
    } else if (phase === "childhood") {
      const learnTone = insight.wealth >= 60 ? "abundance-coded" : insight.wealth <= 35 ? "scarcity-coded" : "mixed";
      out.push(baseEvent(
        "education",
        "School / Formative Years",
        `Childhood learning environment is ${learnTone}. ${insight.mechanics[0]} This shaped how you relate to authority and learning.`,
        50 + (insight.power - 50) * 0.4,
      ));
      if (insight.relationship <= 35) {
        out.push(baseEvent(
          "crisis",
          "Early Relational Strain",
          `Low relational signal during childhood — likely friction with primary caregivers or peer isolation, sourced from ${period.lord}'s natal weakness.`,
          60,
        ));
      }
    } else if (phase === "adolescence") {
      out.push(baseEvent(
        "milestone",
        "Identity Formation",
        `Adolescence runs through ${period.lord}. ${insight.headline} Themes: ${insight.themes.join(", ")}.`,
        55,
      ));
    } else if (phase === "young_adult") {
      out.push(baseEvent(
        "career",
        "Early Career Imprint",
        `${insight.mechanics[0]} Career direction was set by these ${period.lord}-driven choices.`,
        50 + (insight.power - 50) * 0.5,
      ));
    }
  }

  // ── Universal life-flag events (past or future) ─────────────────────────
  if (insight.flags.includes("soulmate")) {
    out.push(baseEvent(
      era === "past" ? "love" : "love",
      era === "past" ? "Soulmate Encounter (Past Window)" : "Soulmate Window",
      `Venus / Moon / Jupiter pattern in chain → high probability of meeting a karmic partner. ${insight.headline}`,
      Math.max(70, insight.relationship),
      ["soulmate"],
    ));
  }
  if (insight.flags.includes("millionaire")) {
    out.push(baseEvent(
      "wealth",
      "Millionaire-Class Wealth Window",
      `Wealth lord chain (${chainLabel}) activates 2H/11H significations. ${insight.mechanics[insight.mechanics.length - 1] ?? insight.headline}`,
      Math.max(72, insight.wealth),
      ["millionaire"],
    ));
  }
  if (insight.flags.includes("billionaire")) {
    out.push(baseEvent(
      "wealth",
      "Billionaire-Tier Window (Lakshmi-Yoga)",
      `Jupiter + Saturn + (Mercury or Rahu) chain — rare expansion-with-structure window. Wealth karaka is amplified through digital/foreign channels.`,
      Math.max(85, insight.wealth),
      ["billionaire"],
    ));
  }
  if (insight.flags.includes("power_peak")) {
    out.push(baseEvent(
      "power",
      "Power Peak / Recognition",
      `${period.lord} (Sun/Mars/Saturn/Rahu class) lights up Kendra/10H. ${insight.headline}`,
      Math.max(75, insight.power),
      ["power_peak"],
    ));
  }

  // ── Threshold-based future predictions ──────────────────────────────────
  if (era === "future") {
    if (insight.wealth >= 70 && !insight.flags.includes("millionaire") && !insight.flags.includes("billionaire")) {
      out.push(baseEvent(
        "wealth",
        "Income Expansion",
        `Wealth score ${insight.wealth}/100. ${insight.mechanics[0]} Likely raise, business win, or asset appreciation.`,
        insight.wealth,
      ));
    }
    if (insight.power >= 70 && !insight.flags.includes("power_peak")) {
      out.push(baseEvent(
        "career",
        "Career Visibility Surge",
        `Authority signature active. ${insight.headline}`,
        insight.power,
      ));
    }
    if (insight.relationship >= 70 && !insight.flags.includes("soulmate")) {
      out.push(baseEvent(
        "love",
        "Relational Magnetism Window",
        `Venus/Moon/Jupiter strength + 7H resonance. Likely deepening of an existing bond or a meaningful new connection.`,
        insight.relationship,
      ));
    }
    if (insight.power <= 30 && period.level === "maha") {
      out.push(baseEvent(
        "crisis",
        "Low-Visibility Recalibration",
        `${period.lord} is low-amplitude in your chart. Period of withdrawal, study, or rebuilding rather than public wins.`,
        70,
      ));
    }
    if (insight.wealth <= 30 && period.level === "maha") {
      out.push(baseEvent(
        "crisis",
        "Financial Tightening",
        `Wealth significators dimmed under ${period.lord}. Conserve, restructure debt, avoid speculation.`,
        65,
      ));
    }
    // Spiritual / detachment turn
    if ((period.lord === "Ketu" || period.lord === "Saturn") && period.level === "maha") {
      out.push(baseEvent(
        "spiritual",
        period.lord === "Ketu" ? "Detachment & Inner Turn" : "Karmic Discipline Phase",
        period.lord === "Ketu"
          ? "Ketu Mahadasha: dissolves attachments, often via loss-then-gain. Research/occult/solitude amplified."
          : "Saturn Mahadasha: structure, delay, and karmic accountability. Slow-built foundations now harden.",
        70,
      ));
    }
    // Foreign travel / relocation (Rahu, 12H, Jupiter chain)
    if (period.lord === "Rahu" && period.level === "maha") {
      out.push(baseEvent(
        "travel",
        "Foreign / Tech / Reinvention Window",
        "Rahu Mahadasha: foreign lands, technology amplification, fame hunger, and unconventional gains.",
        72,
      ));
    }
  }

  // ── Marriage window: Venus/Jupiter/7H lord triggered between 22-38 ──────
  if (
    age >= 21 && age <= 40 &&
    (period.lord === "Venus" || period.lord === "Jupiter") &&
    insight.relationship >= 60
  ) {
    out.push(baseEvent(
      "marriage",
      era === "past" ? "Marriage / Major Union (Past)" : "Marriage Window",
      `${period.lord} period inside age 21-40 + relational score ${insight.relationship}/100 → classical marriage trigger.`,
      Math.max(70, insight.relationship),
    ));
  }

  return out;
}

export interface BuildOptions {
  /** Years before today to include (default 80 — covers full childhood). */
  pastYears?: number;
  /** Years after today to include (default 60). */
  futureYears?: number;
  /** Cap total events to keep UI snappy (default 80). */
  maxEvents?: number;
}

export interface LifeTimeline {
  birth: Date;
  events: LifeEvent[];
  past: LifeEvent[];
  future: LifeEvent[];
}

/**
 * Build the full deterministic timeline.
 */
export function buildLifeTimeline(
  chart: SweVedicChart,
  birth: Date,
  opts: BuildOptions = {},
): LifeTimeline {
  const pastYears = opts.pastYears ?? 80;
  const futureYears = opts.futureYears ?? 60;
  const maxEvents = opts.maxEvents ?? 80;
  const nowMs = Date.now();
  const minMs = nowMs - pastYears * 365.25 * 86400_000;
  const maxMs = nowMs + futureYears * 365.25 * 86400_000;

  const mahas = computeMahadasha(chart.dashaBirthUtc, chart.dashaMoonSid, 14);
  const events: LifeEvent[] = [];

  for (const md of mahas) {
    if (md.end.getTime() < minMs || md.start.getTime() > maxMs) continue;
    // emit at Maha level
    events.push(...eventsForPeriod(md, [], chart, birth, nowMs));
    // and walk Antardashas inside
    const ads = ensureChildren(md, nowMs);
    for (const ad of ads) {
      if (ad.end.getTime() < minMs || ad.start.getTime() > maxMs) continue;
      events.push(...eventsForPeriod(ad, [md], chart, birth, nowMs));
    }
  }

  // Sort by date, dedupe near-identical entries (same title within 30 days),
  // then keep the strongest N.
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  const deduped: LifeEvent[] = [];
  for (const e of events) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.title === e.title &&
      Math.abs(prev.date.getTime() - e.date.getTime()) < 30 * 86400_000
    ) {
      if (e.intensity > prev.intensity) deduped[deduped.length - 1] = e;
      continue;
    }
    deduped.push(e);
  }

  // Trim to maxEvents by intensity if needed, but preserve chronological order.
  let final = deduped;
  if (deduped.length > maxEvents) {
    const byIntensity = [...deduped].sort((a, b) => b.intensity - a.intensity).slice(0, maxEvents);
    const keep = new Set(byIntensity);
    final = deduped.filter((e) => keep.has(e));
  }

  return {
    birth,
    events: final,
    past: final.filter((e) => e.era === "past"),
    future: final.filter((e) => e.era === "future"),
  };
}
