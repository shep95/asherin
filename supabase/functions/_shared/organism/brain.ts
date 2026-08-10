// ═══════════════════════════════════════════════════════════════════════════
// THE BRAIN — one correlation layer reading one bloodstream
//
// Pure function. No I/O, no clock reads except the one passed in, so the same
// window always produces the same stories and the whole thing is testable
// against replayed blood.
//
// Its only job is the thing no single organ can do: notice when several
// unrelated sensations are actually ONE event. Three findings from three
// organs in the same hour are not three problems, they are one story — and
// the story is the unit the operator is shown.
//
// Rules it may not break:
//   • a story needs a falsifier, or it does not ship
//   • ACT requires ≥2 independent organs (corroboration law, confidence.ts)
//   • absence is a finding, never a blank
//   • a reflex that later fails corroboration must be stood down, not buried
// ═══════════════════════════════════════════════════════════════════════════

import { clamp01, grade, tierFor } from "./confidence.ts";
import type { EntityRow, EventRow } from "./bloodstream.ts";

export interface BrainEvent extends EventRow {
  entity?: EntityRow;
}

export interface Story {
  storyKey: string;
  title: string;
  narrative: string;
  severity: "low" | "medium" | "high" | "critical";
  tier: "log" | "advise" | "act";
  confidence: number;
  corroboration: number;
  organs: string[];
  entityIds: string[];
  eventIds: string[];
  falsifier: string;
  reflexOrigin: boolean;
}

/** Organs whose silence is meaningful once they have ever reported. */
const EXPECTED_CADENCE_HOURS: Record<string, number> = {
  op: 6,
  sentinel: 12,
  shield: 24,
  postmark: 48,
  mesh: 72,
  voiceprint: 96,
  ghost: 168,
};

const HOSTILE = new Set(["anomalous", "hostile"]);

function severityFor(confidence: number, corroboration: number, hostile: number): Story["severity"] {
  if (corroboration >= 3 && confidence >= 0.8) return "critical";
  if (corroboration >= 2 && confidence >= 0.65) return "high";
  if (hostile >= 2 || confidence >= 0.5) return "medium";
  return "low";
}

function hourBucket(iso: string): string {
  return iso.slice(0, 13);
}

export interface BrainInput {
  events: BrainEvent[];
  entities: EntityRow[];
  /** Which organs have ever reported for this account (for silence checks). */
  organHistory: { organ: string; lastSeen: string }[];
  now: number;
  calibration?: number;
}

export function think(input: BrainInput): Story[] {
  const { events, entities, organHistory, now } = input;
  const cal = clamp01(input.calibration ?? 0.5);
  const stories: Story[] = [];

  // ── 1. CONVERGENCE — one entity, several independent organs ────────────
  const byEntity = new Map<string, BrainEvent[]>();
  for (const ev of events) {
    if (!ev.entity_id) continue;
    const list = byEntity.get(ev.entity_id) ?? [];
    list.push(ev);
    byEntity.set(ev.entity_id, list);
  }

  for (const [entityId, evs] of byEntity) {
    const concerning = evs.filter((e) => HOSTILE.has(e.verdict));
    if (!concerning.length) continue;
    const organs = [...new Set(concerning.map((e) => e.organ))];
    if (organs.length < 2) continue; // one witness is a sensation, not a story

    const entity = entities.find((e) => e.id === entityId);
    const label = entity?.label || entity?.entity_key || "an unnamed subject";
    const peak = concerning.reduce((m, e) => Math.max(m, Number(e.confidence)), 0);
    const confidence = clamp01(peak * (0.7 + 0.6 * cal));
    const corroboration = organs.length;

    stories.push({
      storyKey: `convergence:${entityId}`,
      title: `${organs.length} organs independently flagged ${label}`,
      narrative:
        `${organs.map((o) => o.toUpperCase()).join(", ")} each reported concerning activity for ` +
        `${label} (${entity?.kind ?? "entity"}) inside the shared window. These were filed as ` +
        `separate sensations by separate collectors; the bloodstream resolves them to one subject, ` +
        `so this is one story rather than ${concerning.length} unrelated alerts. ` +
        `Graded ${grade(confidence, corroboration).label}.`,
      severity: severityFor(confidence, corroboration, concerning.length),
      tier: tierFor(confidence, corroboration),
      confidence,
      corroboration,
      organs,
      entityIds: [entityId],
      eventIds: concerning.map((e) => e.id),
      falsifier:
        `A clean read of ${label} from any two of ${organs.join(", ")} within the next 48 hours ` +
        `collapses this story and stands the response down.`,
      reflexOrigin: concerning.some((e) => e.reflex),
    });
  }

  // ── 2. TEMPORAL CLUSTER — different subjects, same hour, one event ─────
  const byHour = new Map<string, BrainEvent[]>();
  for (const ev of events) {
    if (!HOSTILE.has(ev.verdict)) continue;
    const b = hourBucket(ev.observed_at);
    const list = byHour.get(b) ?? [];
    list.push(ev);
    byHour.set(b, list);
  }

  for (const [bucket, evs] of byHour) {
    const organs = [...new Set(evs.map((e) => e.organ))];
    const subjects = [...new Set(evs.map((e) => e.entity_id).filter(Boolean))] as string[];
    if (organs.length < 2 || evs.length < 3) continue;
    // Skip if a convergence story already tells this exact story
    if (subjects.length === 1 && stories.some((s) => s.storyKey === `convergence:${subjects[0]}`)) continue;

    const peak = evs.reduce((m, e) => Math.max(m, Number(e.confidence)), 0);
    const confidence = clamp01(peak * 0.9 * (0.7 + 0.6 * cal));
    const corroboration = organs.length;

    stories.push({
      storyKey: `cluster:${bucket}`,
      title: `${evs.length} concerning signals across ${organs.length} organs inside one hour`,
      narrative:
        `Between ${bucket}:00Z and the following hour, ${organs.map((o) => o.toUpperCase()).join(", ")} ` +
        `each surfaced concerning activity against ${subjects.length || "no resolved"} subject(s). ` +
        `Individually each is unremarkable; arriving together in one hour across unrelated collectors ` +
        `is the shape of a single incident rather than coincidence.`,
      severity: severityFor(confidence, corroboration, evs.length),
      tier: tierFor(confidence, corroboration),
      confidence,
      corroboration,
      organs,
      entityIds: subjects,
      eventIds: evs.map((e) => e.id),
      falsifier:
        `If the same hour-of-day shows a comparable burst in the next seven days with no incident, ` +
        `this is the account's normal rhythm and the cluster should be reclassified as baseline.`,
      reflexOrigin: evs.some((e) => e.reflex),
    });
  }

  // ── 3. IMMUNE — exposed credential meeting an unrecognised presence ────
  const credentialHits = events.filter(
    (e) => e.entity?.kind === "credential" && HOSTILE.has(e.verdict),
  );
  const strangers = events.filter(
    (e) => (e.entity?.kind === "device" || e.entity?.kind === "person") && e.entity?.self_status === "unknown",
  );
  if (credentialHits.length && strangers.length) {
    const window = 24 * 3_600_000;
    const pairs = credentialHits.flatMap((c) =>
      strangers
        .filter((s) => Math.abs(Date.parse(s.observed_at) - Date.parse(c.observed_at)) <= window)
        .map((s) => [c, s] as const),
    );
    if (pairs.length) {
      const evs = [...new Set(pairs.flat())];
      const organs = [...new Set(evs.map((e) => e.organ))];
      const confidence = clamp01(0.72 * (0.7 + 0.6 * cal));
      stories.push({
        storyKey: `immune:credential-stranger:${hourBucket(pairs[0][0].observed_at)}`,
        title: "Exposed credential and an unrecognised presence in the same window",
        narrative:
          `A credential this account owns was surfaced as exposed while an entity the immune model does ` +
          `not recognise as self appeared within 24 hours. Neither fact is decisive alone; together they ` +
          `are the ordinary sequence of an account takeover attempt.`,
        severity: severityFor(confidence, organs.length, evs.length),
        tier: tierFor(confidence, organs.length),
        confidence,
        corroboration: organs.length,
        organs,
        entityIds: [...new Set(evs.map((e) => e.entity_id).filter(Boolean))] as string[],
        eventIds: evs.map((e) => e.id),
        falsifier:
          `The unrecognised entity being confirmed as the operator's own (marked self or trusted) ` +
          `removes the pairing and this story with it.`,
        reflexOrigin: evs.some((e) => e.reflex),
      });
    }
  }

  // ── 4. SILENCE IS DATA — an organ that stopped reporting ───────────────
  for (const { organ, lastSeen } of organHistory) {
    const cadence = EXPECTED_CADENCE_HOURS[organ];
    if (!cadence) continue;
    const hours = (now - Date.parse(lastSeen)) / 3_600_000;
    if (!Number.isFinite(hours) || hours < cadence * 2) continue;

    const confidence = clamp01(Math.min(0.6, 0.25 + hours / (cadence * 20)));
    stories.push({
      storyKey: `silence:${organ}`,
      title: `${organ.toUpperCase()} has not reported in ${Math.round(hours)} hours`,
      narrative:
        `This collector normally reports about every ${cadence} hours. It has been silent for ` +
        `${Math.round(hours)}. Absence is stated rather than assumed safe: the account's posture is ` +
        `currently blind to whatever this organ senses, and any score that depended on it is ` +
        `correspondingly weaker.`,
      severity: hours > cadence * 8 ? "medium" : "low",
      tier: "advise",
      confidence,
      corroboration: 1,
      organs: [organ],
      entityIds: [],
      eventIds: [],
      falsifier: `One fresh report from ${organ} clears this immediately.`,
      reflexOrigin: false,
    });
  }

  // ── 5. STAND-DOWN — a reflex the considered layer no longer supports ───
  for (const [entityId, evs] of byEntity) {
    const reflexHostile = evs.filter((e) => e.reflex && HOSTILE.has(e.verdict));
    if (!reflexHostile.length) continue;
    const consideredAfter = evs.filter(
      (e) =>
        !e.reflex &&
        Date.parse(e.observed_at) > Math.min(...reflexHostile.map((r) => Date.parse(r.observed_at))),
    );
    if (consideredAfter.length < 2 || consideredAfter.some((e) => HOSTILE.has(e.verdict))) continue;

    const entity = entities.find((e) => e.id === entityId);
    const organs = [...new Set(consideredAfter.map((e) => e.organ))];
    stories.push({
      storyKey: `standdown:${entityId}`,
      title: `Reflex reaction to ${entity?.label || entity?.entity_key || "a subject"} is no longer supported`,
      narrative:
        `A local reflex fired against this subject before the correlation layer had evidence. ` +
        `${consideredAfter.length} subsequent considered reads from ${organs.join(", ")} came back clean. ` +
        `The reflex did its job — it protected the device first and asked later — but the considered ` +
        `layer now overrides it and the reaction should be stood down.`,
      severity: "low",
      tier: "advise",
      confidence: clamp01(0.5 + 0.1 * consideredAfter.length),
      corroboration: organs.length,
      organs,
      entityIds: [entityId],
      eventIds: [...reflexHostile, ...consideredAfter].map((e) => e.id),
      falsifier: `Any fresh hostile read of this subject re-arms the reflex and voids the stand-down.`,
      reflexOrigin: true,
    });
  }

  return stories.sort(
    (a, b) =>
      ({ critical: 3, high: 2, medium: 1, low: 0 })[b.severity] -
        ({ critical: 3, high: 2, medium: 1, low: 0 })[a.severity] || b.confidence - a.confidence,
  );
}

/** Whole-organism vitals, derived only from what the bloodstream contains. */
export function vitals(input: { events: BrainEvent[]; entities: EntityRow[]; stories: Story[] }) {
  const organs = [...new Set(input.events.map((e) => e.organ))];
  const hostile = input.events.filter((e) => HOSTILE.has(e.verdict)).length;
  const total = input.events.length || 1;
  // Posture: 100 is healthy. Weighted by story severity, never by raw volume.
  const penalty = input.stories.reduce(
    (sum, s) => sum + ({ critical: 34, high: 20, medium: 9, low: 3 })[s.severity] * s.confidence,
    0,
  );
  return {
    posture: Math.max(0, Math.round(100 - penalty)),
    organsReporting: organs.length,
    organs,
    circulation: input.events.length,
    memory: input.entities.length,
    hostileRatio: Number((hostile / total).toFixed(3)),
    selfKnown: input.entities.filter((e) => e.self_status === "self" || e.self_status === "trusted").length,
    strangers: input.entities.filter((e) => e.self_status === "unknown").length,
  };
}
