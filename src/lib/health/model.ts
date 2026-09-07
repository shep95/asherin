// shared shapes for every asherin.health intelligence layer.
import type { AtlasHighlight } from "./atlas";
import { territoryParts, type TerritoryIndex } from "./territory";

export type LayerId =
  | "lab"
  | "medication"
  | "gene"
  | "nutrition"
  | "exposure"
  | "surgery"
  | "family"
  | "pain"
  | "symptom"
  | "herb"
  | "inflammation"
  | "stress"
  | "circadian"
  | "aging"
  | "live";

export type Direction = "elevated" | "low" | "risk" | "absent" | "active" | "neutral";

export interface Finding {
  id: string;
  layer: LayerId;
  label: string;
  /** what was observed, in plain language. never a diagnosis. */
  detail: string;
  /** physiological meaning: why this territory lights up. */
  mechanism: string;
  /** what the person can do next. every concern carries a next step. */
  nextStep: string;
  territoryKeys: string[];
  direction: Direction;
  /** 0..1 confidence-weighted salience used for opacity on the atlas. */
  weight: number;
  source: string;
  /** true when the pattern warrants prompt clinical evaluation. */
  redFlag?: boolean;
}

export const DIRECTION_COLOR: Record<Direction, string> = {
  elevated: "#c9622f",
  low: "#4f83b3",
  risk: "#b39348",
  absent: "#7b7f86",
  active: "#4f9e86",
  neutral: "#8b9099",
};

export function findingHighlights(findings: Finding[], index: TerritoryIndex | null): AtlasHighlight[] {
  if (!index) return [];
  const out: AtlasHighlight[] = [];
  for (const f of findings) {
    const partIds = territoryParts(index, f.territoryKeys);
    if (partIds.length === 0) continue;
    out.push({
      partIds,
      color: DIRECTION_COLOR[f.direction],
      intensity: Math.max(0.15, Math.min(1, f.weight)),
      label: f.label,
      reason: f.mechanism,
      source: f.source,
    });
  }
  return out;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => Number(!!b.redFlag) - Number(!!a.redFlag) || b.weight - a.weight);
}
