// ZAXIN SCENE REASONER — deterministic cross-modal threat synthesis.
// ─────────────────────────────────────────────────────────────────
// The BYOK vision panel already produces per-object identifications and an
// environment scan. What was missing is the layer above it: nothing correlated
// what the MODEL saw with what the RADIO heard and what the DETECTOR boxed, so
// the operator got three unlinked lists and had to fuse them in their head.
//
// This module does that fusion in code — deliberately WITHOUT a second model
// call, because a scoring rule cannot hallucinate. It follows the same laws the
// visual-intelligence doctrine imposes on the model:
//
//   ANCHOR LAW       every entity cites the concrete signals behind its score
//   OBSTRUCTION LAW  degrading conditions are logged and penalise confidence
//   HALLUCINATION LAW anything the sensors cannot settle is CANNOT_RESOLVE,
//                    never a confident guess
//
// The interesting output is cross-modal disagreement:
//   • radio present, nothing visible  → concealed emitter
//   • visible device, no radio        → passive/airplane-mode or non-BLE
//   • all three agree                 → corroborated, high confidence
//   • closing range + person + AI threat flag → the case that matters

import type { Contact } from "./types";
import type { OpticalContact } from "./opticalContacts";
import type { FusedTrack } from "./fusionEngine";

export type ThreatLevel = "none" | "low" | "elevated" | "high" | "unresolved";
export type Posture = "clear" | "watch" | "elevated" | "critical";

/** Minimal structural shape this module needs from the BYOK vision panel. */
export interface VisionIdentLike {
  label: string;
  device_type?: string | null;
  brand?: string | null;
  has_bluetooth?: boolean | null;
  matched_optical_id?: string | null;
  matched_ble_id?: string | null;
  bbox_pct?: { x: number; y: number; w: number; h: number } | null;
  est_distance_m?: number | null;
  confidence?: number | null;
  person?: { threat?: string | null; posture?: string | null; accessories?: string[] | null } | null;
  narration?: string | null;
  _ts?: number;
}

export interface EnvScanLike {
  scene?: string | null;
  indoor?: boolean | null;
  occupants?: number | null;
  visibility_m?: number | null;
  hazards?: string[] | null;
  lighting?: { type?: string | null; intensity_lux_est?: number | null } | null;
}

export interface SceneEntity {
  key: string;
  kind: "person" | "device" | "vehicle" | "object" | "emitter";
  label: string;
  /** Which sensors contributed — the corroboration triad. */
  modalities: { radio: boolean; optical: boolean; ai: boolean };
  bleId: string | null;
  opticalId: string | null;
  rangeM: number | null;
  /** Negative = closing on the operator, m/s. */
  rangeRateMS: number | null;
  bearing: number | null;
  threat: ThreatLevel;
  /** 0..100 — the raw score behind the tier. */
  score: number;
  /** Confidence in the assessment itself, 0..1. */
  confidence: number;
  /** Cited evidence. One line per contributing signal. */
  anchors: string[];
  /** Conditions degrading this read. */
  obstructions: string[];
}

export interface SceneAssessment {
  ts: number;
  posture: Posture;
  entities: SceneEntity[];
  /** Signals present but unattributable to any entity. */
  cannotResolve: string[];
  /** Cross-modal contradictions worth the operator's attention. */
  discrepancies: string[];
  summary: string;
  /** Overall assessment confidence, 0..1 — obstruction-penalised. */
  confidence: number;
  counts: { people: number; devices: number; vehicles: number; emitters: number };
}

/** Vision identifications older than this are treated as stale evidence. */
const IDENT_STALE_MS = 25_000;
/** Bearing agreement window for binding an AI ident to a radio track. */
const BIND_BEARING_DEG = 14;

interface ReasonInput {
  contacts: Array<Contact & { track?: FusedTrack }>;
  optical: OpticalContact[];
  idents: VisionIdentLike[];
  env: EnvScanLike | null;
  heading: number | null;
  fov: number;
  /** Ids the operator has flagged. */
  watchlist?: string[];
  /** Emitters this device has met before (from ContactMemory). */
  knownIds?: Set<string>;
}

export function reasonScene(input: ReasonInput): SceneAssessment {
  const now = Date.now();
  const { contacts, optical, env, heading, fov } = input;
  const watchlist = new Set(input.watchlist ?? []);
  const known = input.knownIds ?? new Set<string>();

  /* ── Obstruction audit runs FIRST; it caps every confidence below. ── */
  const globalObstructions: string[] = [];
  const lux = env?.lighting?.intensity_lux_est ?? null;
  if (lux != null && lux < 60) globalObstructions.push(`low light (~${Math.round(lux)} lux)`);
  if (env?.visibility_m != null && env.visibility_m < 8) globalObstructions.push(`restricted visibility (~${env.visibility_m}m)`);
  if (heading == null) globalObstructions.push("no compass fix — bearings unanchored");
  if (!optical.length) globalObstructions.push("optical detector returned no boxes");
  const freshIdents = input.idents.filter((i) => !i._ts || now - i._ts < IDENT_STALE_MS);
  if (input.idents.length && !freshIdents.length) globalObstructions.push("AI identifications stale");

  const obstructionPenalty = Math.min(0.55, globalObstructions.length * 0.14);

  /* ── Build the entity set, radio-first (radio has a stable id). ── */
  const entities: SceneEntity[] = [];
  const usedOptical = new Set<string>();
  const usedIdents = new Set<VisionIdentLike>();

  for (const c of contacts) {
    const tr = c.track;
    if (tr && tr.state === "lost") continue;
    const opticalId = tr?.opticalId ?? null;
    if (opticalId) usedOptical.add(opticalId);
    const bearing = tr?.bearing ?? c.bearing ?? null;
    const rangeM = tr?.rangeM ?? c.distanceMeters ?? null;

    // Bind an AI ident by explicit match, then by bearing agreement.
    const ident =
      freshIdents.find((i) => i.matched_ble_id && i.matched_ble_id === c.id) ??
      (opticalId ? freshIdents.find((i) => i.matched_optical_id === opticalId) : undefined) ??
      (bearing != null && heading != null
        ? freshIdents.find((i) => {
            if (!i.bbox_pct) return false;
            const cx = i.bbox_pct.x + i.bbox_pct.w / 2;
            const b = heading + (cx - 0.5) * fov;
            return Math.abs(wrap180(b - bearing)) <= BIND_BEARING_DEG && !usedIdents.has(i);
          })
        : undefined);
    if (ident) usedIdents.add(ident);

    const anchors: string[] = [];
    const obstructions = [...globalObstructions];
    let score = 8;

    anchors.push(`radio: ${c.displayName}${c.rssi != null ? ` @ ${c.rssi} dBm` : ""}`);
    if (tr) anchors.push(`track ${tr.state.toUpperCase()} · σ${tr.bearingSigmaDeg.toFixed(0)}° · ${tr.hits} hits`);
    if (tr?.opticalCorrected) anchors.push("bearing corrected by optics");

    // Proximity — the single strongest driver.
    if (rangeM != null) {
      anchors.push(`range ${rangeM.toFixed(1)}m ±${(tr?.rangeSigmaM ?? 0).toFixed(1)}`);
      if (rangeM < 2) score += 26;
      else if (rangeM < 6) score += 16;
      else if (rangeM < 15) score += 8;
    }
    // Closing geometry.
    const rate = tr?.rangeRateMS ?? null;
    if (rate != null && rate < -0.35) { score += 18; anchors.push(`closing at ${Math.abs(rate).toFixed(1)} m/s`); }

    // Corroboration and its absence.
    const hasOptical = !!opticalId;
    const hasAi = !!ident;
    if (hasOptical && hasAi) { anchors.push("corroborated across radio + optical + AI"); }
    else if (!hasOptical && rangeM != null && rangeM < 8 && optical.length > 0) {
      score += 14;
      anchors.push("emitter within 8m with no matching optical detection — possible concealment");
    }

    // Provenance.
    if (watchlist.has(c.id) || c.watchlisted) { score += 30; anchors.push("operator watchlist"); }
    if (c.threatTier === "breach") { score += 40; anchors.push("threat tier BREACH"); }
    else if (c.threatTier === "priority") { score += 24; anchors.push("threat tier PRIORITY"); }
    else if (c.threatTier === "friendly") { score -= 25; anchors.push("IFF friendly"); }
    if (c.behavior === "clone-suspect") { score += 22; anchors.push("clone-suspect: duplicate display name"); }
    if (!known.has(c.id)) { score += 6; anchors.push("first encounter on this device"); }
    else { anchors.push("previously encountered — dossier on file"); }

    // AI-supplied person threat.
    const aiThreat = ident?.person?.threat?.toLowerCase() ?? null;
    if (aiThreat === "high") { score += 32; anchors.push("AI person-threat: high"); }
    else if (aiThreat === "elevated") { score += 18; anchors.push("AI person-threat: elevated"); }

    const kind: SceneEntity["kind"] =
      ident?.device_type === "person" ? "person"
      : hasOptical ? "device"
      : "emitter";

    // Uncertainty gate: if the track cannot settle a bearing at all and there
    // is no range either, we refuse to score it as a threat.
    const unresolved = bearing == null && rangeM == null;
    if (unresolved) obstructions.push("no bearing and no range — position unresolved");

    const confidence = clamp(
      (tr ? clamp(tr.confidence, 0, 1) : 0.3) * (hasOptical ? 1.15 : 1) * (hasAi ? 1.1 : 1) - obstructionPenalty,
      0.05, 1,
    );

    entities.push({
      key: `ble:${c.id}`,
      kind,
      label: ident?.label || c.displayName,
      modalities: { radio: true, optical: hasOptical, ai: hasAi },
      bleId: c.id,
      opticalId,
      rangeM,
      rangeRateMS: rate,
      bearing,
      threat: unresolved ? "unresolved" : tier(score),
      score: clamp(Math.round(score), 0, 100),
      confidence,
      anchors,
      obstructions,
    });
  }

  /* ── Optical detections with no radio track of their own. ── */
  for (const o of optical) {
    if (usedOptical.has(o.id)) continue;
    const cx = o.x + o.w / 2;
    const bearing = heading != null ? (heading + (cx - 0.5) * fov + 360) % 360 : null;
    const ident =
      freshIdents.find((i) => i.matched_optical_id === o.id && !usedIdents.has(i)) ??
      freshIdents.find((i) => {
        if (!i.bbox_pct || usedIdents.has(i)) return false;
        const ix = i.bbox_pct.x + i.bbox_pct.w / 2;
        return Math.abs(ix - cx) < 0.12;
      });
    if (ident) usedIdents.add(ident);

    const anchors = [`optical: ${o.label} (score ${(o.score * 100).toFixed(0)}%)`];
    const obstructions = [...globalObstructions];
    if (o.score < 0.45) obstructions.push("weak detector score");

    let score = o.kind === "person" ? 16 : o.kind === "vehicle" ? 12 : 6;
    // Bbox area is a crude range proxy when no radio range exists.
    const area = o.w * o.h;
    if (area > 0.25) { score += 16; anchors.push("large in frame — close range"); }
    else if (area > 0.08) { score += 8; }

    const aiThreat = ident?.person?.threat?.toLowerCase() ?? null;
    if (aiThreat === "high") { score += 30; anchors.push("AI person-threat: high"); }
    else if (aiThreat === "elevated") { score += 16; anchors.push("AI person-threat: elevated"); }
    if (ident?.has_bluetooth) {
      score += 10;
      anchors.push(`AI expects a BLE radio (${ident.brand ?? ident.label}) but none is tracked — silent or non-BLE`);
    }
    if (ident?.narration) anchors.push(ident.narration);

    entities.push({
      key: `opt:${o.id}`,
      kind: o.kind === "person" ? "person" : o.kind === "vehicle" ? "vehicle" : "device",
      label: ident?.label || o.label,
      modalities: { radio: false, optical: true, ai: !!ident },
      bleId: null,
      opticalId: o.id,
      rangeM: ident?.est_distance_m ?? null,
      rangeRateMS: null,
      bearing,
      threat: tier(score),
      score: clamp(Math.round(score), 0, 100),
      confidence: clamp(clamp(o.score, 0, 1) * (ident ? 1.15 : 0.9) - obstructionPenalty, 0.05, 1),
      anchors,
      obstructions,
    });
  }

  /* ── Anything the AI saw that neither radio nor detector confirmed. ── */
  const cannotResolve: string[] = [];
  for (const i of freshIdents) {
    if (usedIdents.has(i)) continue;
    cannotResolve.push(`AI reported "${i.label}" with no corroborating radio or optical detection`);
  }
  if (env?.occupants != null) {
    const seenPeople = entities.filter((e) => e.kind === "person").length;
    if (env.occupants > seenPeople) {
      cannotResolve.push(`environment scan counts ${env.occupants} occupants; only ${seenPeople} tracked`);
    }
  }

  /* ── Cross-modal discrepancies. ── */
  const discrepancies: string[] = [];
  const concealed = entities.filter((e) => e.modalities.radio && !e.modalities.optical && (e.rangeM ?? 99) < 8);
  if (concealed.length) discrepancies.push(`${concealed.length} close emitter(s) with no line of sight`);
  const silent = entities.filter((e) => !e.modalities.radio && e.modalities.ai && e.kind === "device");
  if (silent.length) discrepancies.push(`${silent.length} visible device(s) broadcasting nothing`);

  /* ── Posture. ── */
  entities.sort((a, b) => b.score - a.score);
  const top = entities[0]?.score ?? 0;
  const posture: Posture =
    top >= 70 ? "critical" : top >= 45 ? "elevated" : top >= 25 ? "watch" : "clear";

  const counts = {
    people: entities.filter((e) => e.kind === "person").length,
    devices: entities.filter((e) => e.kind === "device").length,
    vehicles: entities.filter((e) => e.kind === "vehicle").length,
    emitters: entities.filter((e) => e.kind === "emitter").length,
  };

  const scene = env?.scene ? `${env.scene}. ` : "";
  const summary = entities.length
    ? `${scene}${counts.people} person(s), ${counts.devices} device(s), ${counts.emitters} unseen emitter(s) tracked. ` +
      `Highest-scoring entity: ${entities[0].label} (${entities[0].threat.toUpperCase()}, ${entities[0].score}/100).` +
      (discrepancies.length ? ` Discrepancies: ${discrepancies.join("; ")}.` : "")
    : `${scene}No contacts resolved. ${globalObstructions.length ? `Obstructions: ${globalObstructions.join("; ")}.` : "Sensors nominal, field clear."}`;

  return {
    ts: now,
    posture,
    entities,
    cannotResolve,
    discrepancies,
    summary,
    confidence: clamp(
      (entities.length ? entities.reduce((a, e) => a + e.confidence, 0) / entities.length : 0.5) - obstructionPenalty * 0.5,
      0.05, 1,
    ),
    counts,
  };
}

function tier(score: number): ThreatLevel {
  if (score >= 70) return "high";
  if (score >= 45) return "elevated";
  if (score >= 25) return "low";
  return "none";
}

function wrap180(deg: number) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
