// ═══════════════════════════════════════════════════════════════════════════
// THE IMMUNE SYSTEM — self / not-self recognition, and it must LEARN
//
// A fixed blocklist wearing a metaphor is not an immune system. What makes
// this adaptive is that the model of "self" is rebuilt from the organism's own
// accumulated experience every metabolism pass:
//
//   • things the operator has repeatedly and reciprocally engaged with become
//     SELF (their own devices, their own networks, their own correspondents)
//   • things seen often, benignly, but without reciprocity become TRUSTED
//   • things seen once, cold, reaching inward, stay UNKNOWN — the state that
//     lets the brain pair them with an exposure
//   • things repeatedly graded hostile across MORE THAN ONE organ become
//     SUSPECT, then HOSTILE — never on one organ's say-so
//
// And critically: antibodies fade. An entity that has been quiet and clean for
// long enough relaxes back down a step, so the organism cannot drift into
// permanent paranoia about something that stopped being a threat.
// ═══════════════════════════════════════════════════════════════════════════

import type { EntityRow, EventRow } from "./bloodstream.ts";

export type SelfStatus = "self" | "trusted" | "unknown" | "suspect" | "hostile";

export interface ImmuneVerdict {
  entityId: string;
  from: SelfStatus;
  to: SelfStatus;
  reason: string;
}

const RANK: Record<SelfStatus, number> = { self: 0, trusted: 1, unknown: 2, suspect: 3, hostile: 4 };

/** How long an entity must be clean before an antibody relaxes one step. */
const RELAX_AFTER_HOURS = 24 * 21;

export function classify(
  entity: EntityRow,
  history: EventRow[],
  now: number,
): ImmuneVerdict | null {
  const from = (entity.self_status as SelfStatus) ?? "unknown";
  // The operator's explicit designation is sovereign — the model never
  // overrides a human saying "this is mine".
  if (from === "self") return null;

  const mine = history.filter((e) => e.entity_id === entity.id);
  const hostileOrgans = [...new Set(mine.filter((e) => e.verdict === "hostile" || e.verdict === "anomalous").map((e) => e.organ))];
  const cleanCount = mine.filter((e) => e.verdict === "clean" || e.verdict === "benign").length;
  const lastHostile = mine
    .filter((e) => e.verdict === "hostile" || e.verdict === "anomalous")
    .reduce((m, e) => Math.max(m, Date.parse(e.observed_at)), 0);
  const hoursQuiet = lastHostile ? (now - lastHostile) / 3_600_000 : Infinity;

  let to: SelfStatus = from;
  let reason = "";

  // ── escalation requires independent agreement ─────────────────────────
  if (hostileOrgans.length >= 2 && Number(entity.confidence) >= 0.65) {
    to = "hostile";
    reason = `${hostileOrgans.length} independent organs (${hostileOrgans.join(", ")}) graded this hostile`;
  } else if (hostileOrgans.length === 1) {
    to = RANK[from] > RANK.suspect ? from : "suspect";
    reason = `single-organ hostile read from ${hostileOrgans[0]} — suspect, not hostile, until corroborated`;
  } else if (entity.corroboration >= 2 && cleanCount >= 4 && Number(entity.confidence) >= 0.6) {
    // repeated, multi-organ, benign familiarity is what "self" is made of
    to = entity.kind === "device" || entity.kind === "network" ? "self" : "trusted";
    reason = `${cleanCount} clean observations across ${entity.corroboration} organs — recognised as part of the operator`;
  } else if (cleanCount >= 2 && from === "unknown") {
    to = "trusted";
    reason = `${cleanCount} benign observations without any hostile read`;
  }

  // ── antibodies fade ───────────────────────────────────────────────────
  if (to === from && (from === "hostile" || from === "suspect") && hoursQuiet > RELAX_AFTER_HOURS) {
    to = from === "hostile" ? "suspect" : "unknown";
    reason = `no hostile read in ${Math.round(hoursQuiet / 24)} days — antibody relaxed one step`;
  }

  if (to === from) return null;
  return { entityId: entity.id, from, to, reason };
}

/** Run the immune pass across the whole roster of remembered entities. */
export function immunePass(entities: EntityRow[], events: EventRow[], now: number): ImmuneVerdict[] {
  const verdicts: ImmuneVerdict[] = [];
  for (const entity of entities) {
    const v = classify(entity, events, now);
    if (v) verdicts.push(v);
  }
  return verdicts;
}
