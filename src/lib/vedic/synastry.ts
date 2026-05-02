/**
 * SYNASTRY PREDICTIONS — deterministic relationship event timeline.
 *
 * Pure math: combines TWO charts' Vimshottari periods + cross-chart contacts
 * (Moon-Moon, Asc-Asc, Venus↔Mars, 7H lord exchange) to forecast dated
 * relationship events between any two people, OR between a person and a
 * country foundation chart.
 *
 * No AI. Output is a set of dated, chart-grounded predictions.
 */

import type { SweVedicChart } from "./sweChart";
import { compareCharts, type CompatResult } from "./compatibility";
import { computeMahadasha, ensureChildren, type DashaPeriod, type DashaLord } from "./dasha";

export type SynastryCategory =
  | "harmony" | "passion" | "conflict" | "growth" | "separation"
  | "commitment" | "travel_together" | "wealth_together" | "trial";

export interface SynastryEvent {
  date: Date;
  start: Date;
  end: Date;
  era: "past" | "future";
  category: SynastryCategory;
  title: string;
  description: string;
  intensity: number;          // 0-100
  chainA: string;             // "Jupiter MD → Venus AD" (chart A)
  chainB: string;
}

const HARMONIC_PAIRS: Record<DashaLord, DashaLord[]> = {
  Sun:     ["Moon", "Mars", "Jupiter"],
  Moon:    ["Sun", "Mercury", "Venus"],
  Mars:    ["Sun", "Moon", "Jupiter", "Venus"],
  Mercury: ["Venus", "Sun", "Saturn"],
  Jupiter: ["Sun", "Moon", "Mars", "Venus"],
  Venus:   ["Mercury", "Saturn", "Mars", "Jupiter"],
  Saturn:  ["Venus", "Mercury", "Rahu"],
  Rahu:    ["Saturn", "Mercury", "Venus"],
  Ketu:    ["Mars", "Jupiter"],
};

const HOSTILE_PAIRS: Record<DashaLord, DashaLord[]> = {
  Sun:     ["Saturn", "Venus", "Rahu"],
  Moon:    ["Saturn", "Rahu", "Ketu"],
  Mars:    ["Mercury", "Saturn"],
  Mercury: ["Moon", "Mars"],
  Jupiter: ["Venus", "Mercury", "Rahu"],
  Venus:   ["Sun", "Moon"],
  Saturn:  ["Sun", "Moon", "Mars"],
  Rahu:    ["Sun", "Moon", "Jupiter"],
  Ketu:    ["Venus", "Moon"],
};

function chainLabel(parents: DashaPeriod[], p: DashaPeriod): string {
  return [...parents, p].map((x) => `${x.lord} ${x.level === "maha" ? "MD" : "AD"}`).join(" → ");
}

/** Walk both charts; for each overlapping (Maha,Antar) pair, score interaction. */
export function buildSynastryTimeline(
  chartA: SweVedicChart,
  chartB: SweVedicChart,
  opts: { pastYears?: number; futureYears?: number; maxEvents?: number } = {},
): SynastryEvent[] {
  const pastYears = opts.pastYears ?? 30;
  const futureYears = opts.futureYears ?? 30;
  const maxEvents = opts.maxEvents ?? 60;
  const nowMs = Date.now();
  const minMs = nowMs - pastYears * 365.25 * 86400_000;
  const maxMs = nowMs + futureYears * 365.25 * 86400_000;

  const mahasA = computeMahadasha(chartA.dashaBirthUtc, chartA.dashaMoonSid, 12);
  const mahasB = computeMahadasha(chartB.dashaBirthUtc, chartB.dashaMoonSid, 12);

  // Flatten to (Maha,Antar) windows.
  type Window = { lord: DashaLord; parent: DashaLord; start: number; end: number; chain: string };
  function flatten(mahas: DashaPeriod[]): Window[] {
    const out: Window[] = [];
    for (const md of mahas) {
      const ads = ensureChildren(md, nowMs);
      for (const ad of ads) {
        out.push({
          lord: ad.lord, parent: md.lord,
          start: ad.start.getTime(), end: ad.end.getTime(),
          chain: chainLabel([md], ad),
        });
      }
    }
    return out;
  }
  const wa = flatten(mahasA);
  const wb = flatten(mahasB);

  const events: SynastryEvent[] = [];

  // For every overlap window, compute interaction.
  let i = 0, j = 0;
  while (i < wa.length && j < wb.length) {
    const a = wa[i], b = wb[j];
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    if (end > start && start <= maxMs && end >= minMs) {
      const center = new Date((start + end) / 2);
      const era: "past" | "future" = end < nowMs ? "past" : "future";

      const harmA = HARMONIC_PAIRS[a.lord]?.includes(b.lord) ?? false;
      const harmB = HARMONIC_PAIRS[b.lord]?.includes(a.lord) ?? false;
      const hostA = HOSTILE_PAIRS[a.lord]?.includes(b.lord) ?? false;
      const hostB = HOSTILE_PAIRS[b.lord]?.includes(a.lord) ?? false;

      const samePair = a.lord === b.lord;
      const harmonic = harmA || harmB || samePair;
      const hostile = hostA || hostB;

      const intensityBase = Math.min(100, 40 + Math.log10(Math.max(1, (end - start) / 86400_000)) * 14);

      // Commitment: Venus or Jupiter on either side
      if ((a.lord === "Venus" || b.lord === "Venus" || a.lord === "Jupiter" || b.lord === "Jupiter") && harmonic) {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "commitment",
          title: era === "past" ? "Bonding / Commitment Window (past)" : "Commitment / Engagement Window",
          description: `${a.lord} (theirs/yours) meets ${b.lord} (the other) in a harmonic exchange. Classical Venus/Jupiter activation between two people — vows, engagements, or deepened pledges occur in windows like this.`,
          intensity: Math.max(intensityBase, 70),
          chainA: a.chain, chainB: b.chain,
        });
      }

      // Passion / sexual chemistry: Mars + Venus cross
      if ((a.lord === "Mars" && b.lord === "Venus") || (a.lord === "Venus" && b.lord === "Mars")) {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "passion",
          title: "Passion / Chemistry Spike",
          description: "Mars ↔ Venus running on opposite sides — physical attraction and intensity peak. Excellent for romance, risky for impulsivity.",
          intensity: 78, chainA: a.chain, chainB: b.chain,
        });
      }

      // Conflict / separation: hostile pair, especially Saturn/Rahu/Mars cross
      if (hostile) {
        const sepLikely = (a.lord === "Saturn" && b.lord === "Sun") || (a.lord === "Rahu" && b.lord === "Moon") || samePair === false && (a.lord === "Mars" && b.lord === "Saturn");
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: sepLikely ? "separation" : "conflict",
          title: sepLikely ? "Separation Risk Window" : "Friction Window",
          description: `${a.lord} ↔ ${b.lord} forms a hostile cross-chart resonance. Expect arguments, distance, or reduced communication. ${sepLikely ? "Higher-than-usual breakup probability if patterns are already strained." : "Workable with conscious effort."}`,
          intensity: sepLikely ? 80 : 62,
          chainA: a.chain, chainB: b.chain,
        });
      }

      // Wealth-together: both sides hit a wealth lord (Jup/Mer/Ven) harmonically
      const wealthLords: DashaLord[] = ["Jupiter", "Mercury", "Venus"];
      if (wealthLords.includes(a.lord) && wealthLords.includes(b.lord) && harmonic) {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "wealth_together",
          title: "Joint Wealth / Business Window",
          description: `Both periods run wealth significators (${a.lord} & ${b.lord}). Strong window for joint ventures, shared assets, or partnership-driven income.`,
          intensity: 74, chainA: a.chain, chainB: b.chain,
        });
      }

      // Travel together: Rahu / 12H lord involvement
      if ((a.lord === "Rahu" || b.lord === "Rahu") && harmonic) {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "travel_together",
          title: "Foreign Move / Travel Together",
          description: "Rahu in one chart's chain + harmonic resonance with the other → relocation, long travel, or living abroad together.",
          intensity: 68, chainA: a.chain, chainB: b.chain,
        });
      }

      // Trial / karmic test: Saturn cross
      if ((a.lord === "Saturn" || b.lord === "Saturn") && hostile) {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "trial",
          title: "Karmic Trial Period",
          description: "Saturn cross stress-tests the bond — slow grind, responsibility shifts, or distance-by-duty.",
          intensity: 70, chainA: a.chain, chainB: b.chain,
        });
      }

      // Generic harmony if nothing else fired
      if (harmonic && a.lord !== "Saturn" && b.lord !== "Saturn") {
        events.push({
          date: center, start: new Date(start), end: new Date(end), era,
          category: "harmony",
          title: "Harmonic Resonance",
          description: `${a.lord} ↔ ${b.lord} are mutually friendly. Smooth communication, easy compromise, shared mood.`,
          intensity: 58, chainA: a.chain, chainB: b.chain,
        });
      }
    }
    if (a.end < b.end) i++; else j++;
  }

  // Dedupe (same title within 60 days, keep strongest)
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  const deduped: SynastryEvent[] = [];
  for (const e of events) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.title === e.title && Math.abs(prev.date.getTime() - e.date.getTime()) < 60 * 86400_000) {
      if (e.intensity > prev.intensity) deduped[deduped.length - 1] = e;
      continue;
    }
    deduped.push(e);
  }

  if (deduped.length > maxEvents) {
    const byInt = [...deduped].sort((a, b) => b.intensity - a.intensity).slice(0, maxEvents);
    const keep = new Set(byInt);
    return deduped.filter((e) => keep.has(e));
  }
  return deduped;
}

export interface SynastryReport {
  base: CompatResult;
  events: SynastryEvent[];
  past: SynastryEvent[];
  future: SynastryEvent[];
}

export async function buildSynastryReport(a: SweVedicChart, b: SweVedicChart): Promise<SynastryReport> {
  const base = await compareCharts(a, b);
  const events = buildSynastryTimeline(a, b);
  return {
    base, events,
    past: events.filter((e) => e.era === "past"),
    future: events.filter((e) => e.era === "future"),
  };
}
