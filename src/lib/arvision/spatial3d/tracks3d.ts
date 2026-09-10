// asherin.eye — 3d tracks, spatial relationships and cross-camera handoff.
//
// A track becomes a 3d track only when a MEASURING sensor produced its
// position. An image-space box from a colour camera stays an image-space box.
//
// Relationships here are geometry: inside, near, above, approaching. They are
// never a judgement about a person. Nothing in this file returns a threat, an
// intent, an identity or a category of person.

import type { TrackedObject } from "../sensors/types";
import type {
  HandoffCandidate, HandoffStatus, RelationFinding, SpatialRelation, SpatialTrack3D,
} from "./types";

const MEASURING = new Set(["depth", "lidar"]);

/**
 * Lift a tracked object into a 3d track, or refuse. `null` means the position
 * was never measured — the caller must keep showing the image-space box.
 */
export function toSpatialTrack(track: TrackedObject, sourceDeviceId: string): SpatialTrack3D | null {
  const w = track.world;
  if (!w || !MEASURING.has(w.source)) return null;

  const u = w.uncertainty;
  return {
    trackId: track.trackId,
    sourceDeviceId,
    position: { ...w.value },
    measuredBy: w.source,
    atMs: w.atMs,
    firstSeenMs: track.firstSeenMs,
    lastSeenMs: track.lastSeenMs,
    velocityMps: track.velocityMps ? { ...track.velocityMps.value } : null,
    headingDeg: track.headingDeg ? track.headingDeg.value : null,
    uncertaintyM: { x: u, y: u, z: u },
    occlusion: track.occlusion,
    confidence: w.confidence,
    trajectory: track.history
      .filter((p) => p.world && MEASURING.has(p.world.source))
      .map((p) => ({ atMs: p.atMs, ...(p.world as NonNullable<typeof p.world>).value })),
    spatialState: "real_sensor_3d",
  };
}

export interface ZoneVolume {
  id: string;
  name: string;
  /** polygon in the same metric frame as the tracks, [x, z] pairs. */
  polygonXZ: Array<[number, number]>;
  /** vertical extent in the same frame. null when the operator entered none. */
  heightRangeM: { min: number; max: number } | null;
}

function pointInPolygon(x: number, z: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const hits = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (hits) inside = !inside;
  }
  return inside;
}

export const NEAR_THRESHOLD_M = 3;
export const STATIONARY_MPS = 0.2;

/** Relationship of a 3d track to a configured zone volume. Geometry only. */
export function relationToZone(track: SpatialTrack3D, zone: ZoneVolume): RelationFinding {
  const inside2d = pointInPolygon(track.position.x, track.position.z, zone.polygonXZ);
  const h = zone.heightRangeM;
  const insideHeight = !h || (track.position.y >= h.min && track.position.y <= h.max);
  if (inside2d && insideHeight) {
    return { relation: "inside", basis: `measured position falls inside the ${zone.name} volume`, valueM: null };
  }
  if (inside2d && h && track.position.y > h.max) {
    return { relation: "above", basis: `measured height ${track.position.y.toFixed(2)} m is above the zone ceiling`, valueM: track.position.y - h.max };
  }
  if (inside2d && h && track.position.y < h.min) {
    return { relation: "below", basis: `measured height ${track.position.y.toFixed(2)} m is below the zone floor`, valueM: h.min - track.position.y };
  }
  return { relation: "outside", basis: `measured position falls outside the ${zone.name} footprint`, valueM: null };
}

/** Relationships between two 3d tracks. Distances only, never intent. */
export function relationsBetween(a: SpatialTrack3D, b: SpatialTrack3D): RelationFinding[] {
  const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
  const out: RelationFinding[] = [
    { relation: d <= NEAR_THRESHOLD_M ? "near" : "outside", basis: `measured separation ${d.toFixed(2)} m`, valueM: d },
  ];

  if (a.position.y - b.position.y > 0.5) out.push({ relation: "above", basis: "measured height difference", valueM: a.position.y - b.position.y });
  if (b.position.y - a.position.y > 0.5) out.push({ relation: "below", basis: "measured height difference", valueM: b.position.y - a.position.y });

  if (a.velocityMps) {
    const speed = Math.hypot(a.velocityMps.x, a.velocityMps.y, a.velocityMps.z);
    if (speed < STATIONARY_MPS) {
      out.push({ relation: "stationary", basis: `measured speed ${speed.toFixed(2)} m/s`, valueM: null });
    } else {
      out.push({ relation: "moving", basis: `measured speed ${speed.toFixed(2)} m/s`, valueM: null });
      // closing rate along the line between the two measured positions.
      const ux = (b.position.x - a.position.x) / (d || 1);
      const uy = (b.position.y - a.position.y) / (d || 1);
      const uz = (b.position.z - a.position.z) / (d || 1);
      const closing = a.velocityMps.x * ux + a.velocityMps.y * uy + a.velocityMps.z * uz;
      if (closing > 0.3) out.push({ relation: "approaching", basis: `closing at ${closing.toFixed(2)} m/s`, valueM: d });
      else if (closing < -0.3) out.push({ relation: "departing", basis: `separating at ${Math.abs(closing).toFixed(2)} m/s`, valueM: d });
      else out.push({ relation: "crossing", basis: "movement is across the line between the two positions, not along it", valueM: d });
    }
  }
  return out;
}

export function relationLabel(r: SpatialRelation): string {
  return r.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// cross-camera handoff
// ---------------------------------------------------------------------------

export interface HandoffInput {
  from: SpatialTrack3D;
  candidates: SpatialTrack3D[];
  /** both cameras registered to one site frame? */
  sharedFrame: boolean;
  /** both cameras time-synchronised against a common source? */
  timeSynchronised: boolean;
  maxGapMs?: number;
  maxDistanceM?: number;
  /** appearance evidence is optional and must be supplied by a real matcher. */
  appearanceScores?: Record<string, number>;
}

/**
 * Possible continuations only. A merge is never performed here, and a match is
 * never an identity claim: two anonymous tracks may be the same object, and the
 * console says exactly that.
 */
export function handoffCandidates(input: HandoffInput): HandoffCandidate[] {
  const maxGap = input.maxGapMs ?? 15_000;
  const maxDist = input.maxDistanceM ?? 25;

  return input.candidates.map((c) => {
    const gapMs = c.firstSeenMs - input.from.lastSeenMs;
    const distanceM = input.sharedFrame
      ? Math.hypot(
          c.position.x - input.from.position.x,
          c.position.y - input.from.position.y,
          c.position.z - input.from.position.z,
        )
      : null;
    const reasons: string[] = [];
    let status: HandoffStatus = "possible_match";

    if (!input.timeSynchronised) {
      status = "insufficient_evidence";
      reasons.push("the two cameras are not synchronised to a common clock, so the order of these observations is not established.");
    }
    if (!input.sharedFrame) {
      status = status === "possible_match" ? "insufficient_evidence" : status;
      reasons.push("the two cameras are not registered to one site frame, so no distance between these tracks can be computed.");
    }
    if (gapMs < 0) {
      status = "not_confirmed";
      reasons.push("the candidate track was already running before the first track ended, so it cannot be its continuation.");
    } else if (gapMs > maxGap) {
      status = "not_confirmed";
      reasons.push(`the gap of ${Math.round(gapMs / 1000)} s exceeds the configured ${Math.round(maxGap / 1000)} s window.`);
    }
    if (distanceM != null && distanceM > maxDist) {
      status = "not_confirmed";
      reasons.push(`the measured separation of ${distanceM.toFixed(1)} m exceeds the configured ${maxDist} m window.`);
    }
    const appearance = input.appearanceScores?.[c.trackId];
    if (typeof appearance === "number") reasons.push(`appearance similarity ${appearance.toFixed(2)} from the configured matcher.`);

    if (status === "possible_match" && reasons.length === 0) {
      reasons.push(
        `temporal gap ${Math.round(gapMs / 1000)} s and measured separation ${distanceM == null ? "unknown" : `${distanceM.toFixed(1)} m`} both fall inside the configured windows.`,
      );
    }

    return {
      fromTrackId: input.from.trackId,
      toTrackId: c.trackId,
      fromDeviceId: input.from.sourceDeviceId,
      toDeviceId: c.sourceDeviceId,
      status,
      gapMs,
      distanceM,
      reasons,
    };
  });
}
