// Browser-safe port of houseofasher/bluetooth_software/src/ble/theory.ts.
// Loads the upstream theory corpus (113 entries across 7 categories) via
// JSON import instead of Node fs.readFileSync.
// MIT — © #houseofasher.

import corpus from "./theory-arrays.json";

export type FlawType =
  | "technical" | "security" | "privacy" | "legal" | "operational" | "ethical";

export type Category =
  | "tactical" | "passive" | "gatt" | "security"
  | "architecture" | "screen-relay" | "wifi-pose";

export interface TheoryRecord {
  id: string;
  category: Category;
  narrative: string;
  flaw: string;
  flawType: FlawType;
  fix: string;
  code: string;
  module: string;
}

type Corpus = {
  TACTICAL_THEORIES: TheoryRecord[];
  PASSIVE_THEORIES: TheoryRecord[];
  GATT_THEORIES: TheoryRecord[];
  SECURITY_THEORIES: TheoryRecord[];
  ARCHITECTURE_THEORIES: TheoryRecord[];
  SCREEN_RELAY_THEORIES: TheoryRecord[];
  WIFI_POSE_THEORIES: TheoryRecord[];
};

const C = corpus as Corpus;

export const ALL_THEORIES: TheoryRecord[] = [
  ...C.TACTICAL_THEORIES,
  ...C.PASSIVE_THEORIES,
  ...C.GATT_THEORIES,
  ...C.SECURITY_THEORIES,
  ...C.ARCHITECTURE_THEORIES,
  ...C.SCREEN_RELAY_THEORIES,
  ...C.WIFI_POSE_THEORIES,
];

export const CATEGORY_COUNTS: Record<Category, number> = {
  tactical: C.TACTICAL_THEORIES.length,
  passive: C.PASSIVE_THEORIES.length,
  gatt: C.GATT_THEORIES.length,
  security: C.SECURITY_THEORIES.length,
  architecture: C.ARCHITECTURE_THEORIES.length,
  "screen-relay": C.SCREEN_RELAY_THEORIES.length,
  "wifi-pose": C.WIFI_POSE_THEORIES.length,
};

export const TOTAL_THEORIES = ALL_THEORIES.length;

export function theoriesByCategory(cat: Category | "all"): TheoryRecord[] {
  if (cat === "all") return ALL_THEORIES;
  return ALL_THEORIES.filter((t) => t.category === cat);
}

export function searchTheories(q: string): TheoryRecord[] {
  const s = q.trim().toLowerCase();
  if (!s) return ALL_THEORIES;
  return ALL_THEORIES.filter((t) =>
    t.id.toLowerCase().includes(s) ||
    t.narrative.toLowerCase().includes(s) ||
    t.flaw.toLowerCase().includes(s) ||
    t.fix.toLowerCase().includes(s) ||
    t.code.toLowerCase().includes(s) ||
    t.module.toLowerCase().includes(s),
  );
}
