// Vehicle Tracking — turn optical vehicle detections into speed/range/heading.
//
// NARRATIVE
// ---------
// COCO-SSD emits `car | truck | bus | motorcycle | bicycle` bounding boxes.
// A bbox by itself is just a rectangle. To answer the operator's real questions
// ("how far, how fast, closing or receding, what class of vehicle") we need
// scale, a persistent identity between frames, and a smoothed derivative.
//
// FLAW → FIX
// ----------
//  1. No scale bar → estimate distance via focal-length × real-world width /
//     bbox width. Real widths per class: car 1.82m, truck 2.55m, bus 2.90m,
//     motorcycle 0.82m, bicycle 0.60m, train 3.10m, boat 2.60m, airplane 5.0m.
//  2. Frame-to-frame identity churns → nearest-centroid matcher with an IOU
//     tiebreaker inside a class group and a 900 ms dropout window.
//  3. Raw derivatives are jittery → exponential-moving average on distance and
//     speed (α = 0.35).
//  4. Sub-pixel bbox jitter fakes speed at rest → dead-band |Δd| < 0.15 m and
//     |vSurface| < 0.3 m/s are clamped to zero.
//  5. Bearing must be in the same compass frame as everything else in Zaxin →
//     bbox centre-x → sensor angle → world compass by adding operator heading.

import type { OpticalContact } from "./opticalContacts";

export interface VehicleTrack {
  id: string;
  label: string;
  score: number;
  /** Normalized bbox in the source video (0..1). */
  x: number; y: number; w: number; h: number;
  /** Estimated distance to camera (m). */
  distanceM: number;
  /** Signed range rate: negative = closing, positive = receding (m/s). */
  rangeRateMS: number;
  /** Ground-plane lateral speed of the bbox centre (m/s). */
  lateralSpeedMS: number;
  /** Compass bearing (deg, 0=N) if operator heading is known — else null. */
  bearingDeg: number | null;
  /** Estimated total speed magnitude (m/s). */
  speedMS: number;
  /** Age in ms since first sighting. */
  ageMs: number;
  /** Rolling confidence in the speed number (0..1). */
  speedConfidence: number;
}

const REAL_WIDTH_M: Record<string, number> = {
  car: 1.82, truck: 2.55, bus: 2.90, motorcycle: 0.82, bicycle: 0.60,
  train: 3.10, boat: 2.60, airplane: 5.0,
};

const DROP_MS = 900;
const ALPHA = 0.35;
const CAMERA_HFOV_DEG = 60;

interface Internal {
  id: string;
  label: string;
  lastTs: number;
  firstTs: number;
  cx: number; cy: number; w: number; h: number; score: number;
  distEma: number | null;
  rangeRateEma: number;
  lateralEma: number;
  lastDist: number | null;
  lastCx: number | null;
  lastTsForVel: number;
}

const _tracks = new Map<string, Internal>();
let _idSeq = 0;

function iou(a: { x: number; y: number; w: number; h: number }, b: Internal) {
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx1 = b.cx - b.w / 2, by1 = b.cy - b.h / 2, bx2 = bx1 + b.w, by2 = by1 + b.h;
  const ix1 = Math.max(a.x, bx1), iy1 = Math.max(a.y, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni <= 0 ? 0 : inter / uni;
}

export function updateVehicleTracks(
  optical: OpticalContact[],
  videoW: number,
  videoH: number,
  operatorHeadingDeg: number | null,
  nowMs: number = Date.now(),
): VehicleTrack[] {
  if (!videoW || !videoH) return [];
  const vehicles = optical.filter((c) => c.kind === "vehicle");
  const focalPx = (videoW / 2) / Math.tan((CAMERA_HFOV_DEG * Math.PI) / 360);

  // Drop stale tracks.
  for (const [id, t] of _tracks) if (nowMs - t.lastTs > DROP_MS) _tracks.delete(id);

  // Greedy match new detections to existing tracks by class + IOU/proximity.
  const claimed = new Set<string>();
  for (const v of vehicles) {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    let best: Internal | null = null;
    let bestScore = 0;
    for (const t of _tracks.values()) {
      if (claimed.has(t.id)) continue;
      if (t.label !== v.label) continue;
      const overlap = iou(v, t);
      const distScore = 1 - Math.min(1, Math.hypot(cx - t.cx, cy - t.cy) * 3);
      const combined = overlap * 0.7 + distScore * 0.3;
      if (combined > bestScore && combined > 0.15) { best = t; bestScore = combined; }
    }
    const bboxWpx = v.w * videoW;
    const realW = REAL_WIDTH_M[v.label] ?? 1.8;
    const distanceM = bboxWpx > 4 ? Math.max(0.5, Math.min(400, (realW * focalPx) / bboxWpx)) : 100;

    if (best) {
      claimed.add(best.id);
      const dt = Math.max(0.05, (nowMs - best.lastTsForVel) / 1000);
      const dDist = best.lastDist != null ? (distanceM - best.lastDist) / dt : 0;
      // Lateral speed in metres per second — convert bbox drift (fraction of
      // frame width) into metres using the target's current distance and FOV.
      const metersPerFractionAtDist =
        distanceM * 2 * Math.tan((CAMERA_HFOV_DEG * Math.PI) / 360);
      const dLatFraction = best.lastCx != null ? (cx - best.lastCx) : 0;
      const dLatM = dLatFraction * metersPerFractionAtDist;
      const rawLatMS = dLatM / dt;
      const rangeRate = Math.abs(dDist) < 0.15 ? 0 : dDist;
      const latMS = Math.abs(rawLatMS) < 0.3 ? 0 : rawLatMS;
      best.distEma = best.distEma == null ? distanceM : best.distEma * (1 - ALPHA) + distanceM * ALPHA;
      best.rangeRateEma = best.rangeRateEma * (1 - ALPHA) + rangeRate * ALPHA;
      best.lateralEma = best.lateralEma * (1 - ALPHA) + latMS * ALPHA;
      best.cx = cx; best.cy = cy; best.w = v.w; best.h = v.h; best.score = v.score;
      best.lastTs = nowMs; best.lastTsForVel = nowMs;
      best.lastDist = distanceM; best.lastCx = cx;
    } else {
      const id = `veh-${v.label}-${++_idSeq}`;
      _tracks.set(id, {
        id, label: v.label, lastTs: nowMs, firstTs: nowMs,
        cx, cy, w: v.w, h: v.h, score: v.score,
        distEma: distanceM, rangeRateEma: 0, lateralEma: 0,
        lastDist: distanceM, lastCx: cx, lastTsForVel: nowMs,
      });
      claimed.add(id);
    }
  }

  const out: VehicleTrack[] = [];
  for (const t of _tracks.values()) {
    const dist = t.distEma ?? 0;
    const speed = Math.hypot(t.rangeRateEma, t.lateralEma);
    // Bearing: bbox centre-x → angle offset from optical axis.
    const bearingDeg = operatorHeadingDeg == null
      ? null
      : ((operatorHeadingDeg + (t.cx - 0.5) * CAMERA_HFOV_DEG) + 360) % 360;
    const ageMs = t.lastTs - t.firstTs;
    const speedConfidence = Math.max(0, Math.min(1, ageMs / 1500)) * Math.min(1, t.score * 1.3);
    out.push({
      id: t.id,
      label: t.label,
      score: t.score,
      x: t.cx - t.w / 2, y: t.cy - t.h / 2, w: t.w, h: t.h,
      distanceM: Math.round(dist * 10) / 10,
      rangeRateMS: Math.round(t.rangeRateEma * 10) / 10,
      lateralSpeedMS: Math.round(t.lateralEma * 10) / 10,
      bearingDeg: bearingDeg == null ? null : Math.round(bearingDeg),
      speedMS: Math.round(speed * 10) / 10,
      ageMs,
      speedConfidence: Math.round(speedConfidence * 100) / 100,
    });
  }
  return out;
}

export function formatSpeed(mps: number, unit: "kmh" | "mph" = "mph"): string {
  const v = unit === "kmh" ? mps * 3.6 : mps * 2.23694;
  return `${v.toFixed(v < 10 ? 1 : 0)} ${unit === "kmh" ? "km/h" : "mph"}`;
}

export function resetVehicleTracks() { _tracks.clear(); }
