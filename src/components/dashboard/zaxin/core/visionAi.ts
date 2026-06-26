// Zaxin Vision — live AI subsystems wired into AR Vision.
// Implements working code for theories T2, T5, T6, T7.
// T1 (RSSI reticle) lives in ZaxinView ArTab; T3 (visual-BLE fusion) in drawFrame;
// T4 (AXRLEN narrator) reuses AiBriefPanel.

import type { Contact } from "./types";

/* ============================================================
 * T2 — Inverse-RSSI SLAM (1-D circular Kalman over bearing).
 * Each contact gets its own filter; we feed the engine-provided
 * bearing samples and emit a smoothed bearing + confidence.
 * ============================================================ */

class CircularKalman {
  private x: number | null = null;     // state (radians)
  private p = 1;                       // covariance
  private readonly q = 0.04;           // process noise (~11°/step)
  private readonly r0 = 0.25;          // base measurement noise

  step(measDeg: number, measVar = 1): { deg: number; confidence: number } {
    const z = (measDeg * Math.PI) / 180;
    if (this.x == null) { this.x = z; this.p = 1; }
    // predict
    this.p += this.q;
    // wrap innovation into [-pi, pi]
    let y = z - this.x;
    while (y > Math.PI)  y -= 2 * Math.PI;
    while (y < -Math.PI) y += 2 * Math.PI;
    const r = this.r0 / Math.max(0.05, measVar);
    const k = this.p / (this.p + r);
    this.x = this.x + k * y;
    this.p = (1 - k) * this.p;
    // normalise
    while (this.x! > Math.PI)  this.x! -= 2 * Math.PI;
    while (this.x! < -Math.PI) this.x! += 2 * Math.PI;
    const deg = ((this.x! * 180) / Math.PI + 360) % 360;
    const confidence = Math.max(0, Math.min(1, 1 - this.p));
    return { deg, confidence };
  }
}

export class BearingSlam {
  private filters = new Map<string, CircularKalman>();

  /** Returns a NEW contact array with smoothed bearings + confidences. */
  apply(contacts: Contact[]): Contact[] {
    const seen = new Set<string>();
    const out = contacts.map((c) => {
      if (c.bearing == null) return c;
      seen.add(c.id);
      let f = this.filters.get(c.id);
      if (!f) { f = new CircularKalman(); this.filters.set(c.id, f); }
      const { deg, confidence } = f.step(c.bearing, c.bearingConfidence ?? 0.5);
      return { ...c, bearing: deg, bearingConfidence: Math.max(confidence, c.bearingConfidence ?? 0) };
    });
    // gc
    for (const id of [...this.filters.keys()]) if (!seen.has(id)) this.filters.delete(id);
    return out;
  }
}

/* ============================================================
 * T5 — Behavior fingerprinting from RSSI time-series.
 * Classifies a contact's motion intent without any new sensors.
 * ============================================================ */

export type DeviceBehavior =
  | "stationary-beacon"
  | "carried-on-person"
  | "vehicle-mounted"
  | "unknown";

export function classifyBehavior(c: Contact): DeviceBehavior {
  const s = c.samples ?? [];
  if (s.length < 6) return "unknown";
  const tail = s.slice(-24).map((x) => x.rssi);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const variance = tail.reduce((a, b) => a + (b - mean) ** 2, 0) / tail.length;
  const sigma = Math.sqrt(variance);

  // First-derivative magnitude — how fast RSSI changes per sample.
  let driftSum = 0;
  for (let i = 1; i < tail.length; i++) driftSum += Math.abs(tail[i] - tail[i - 1]);
  const drift = driftSum / (tail.length - 1);

  if (sigma < 2.2 && drift < 1.4) return "stationary-beacon";
  if (drift > 6 || sigma > 9)     return "vehicle-mounted";
  return "carried-on-person";
}

/* ============================================================
 * T6 — Photogrammetric / heading anchor.
 * When a contact's bearing exits the camera FOV, we still know
 * where it was last seen — pin it as an "edge ghost" reticle
 * that points the operator back towards the contact.
 * ============================================================ */

export interface Anchor {
  contactId: string;
  bearing: number;
  ts: number;
}

export class VisualAnchors {
  private anchors = new Map<string, Anchor>();
  private readonly ttlMs = 45_000;

  update(contacts: Contact[], heading: number | null, fov: number) {
    const now = Date.now();
    for (const c of contacts) {
      if (c.bearing == null) continue;
      if (heading == null) { this.anchors.set(c.id, { contactId: c.id, bearing: c.bearing, ts: now }); continue; }
      const delta = wrap180(c.bearing - heading);
      // Drop a fresh anchor whenever the contact is in-FOV with a confident bearing.
      if (Math.abs(delta) <= fov / 2 && (c.bearingConfidence ?? 0) >= 0.35) {
        this.anchors.set(c.id, { contactId: c.id, bearing: c.bearing, ts: now });
      }
    }
    for (const [id, a] of this.anchors) {
      if (now - a.ts > this.ttlMs) this.anchors.delete(id);
    }
  }

  /** Anchors whose contact is currently out-of-FOV — render as edge ghosts. */
  ghosts(contacts: Contact[], heading: number | null, fov: number): Anchor[] {
    if (heading == null) return [];
    const live = new Set(contacts.filter((c) => c.bearing != null).map((c) => c.id));
    const out: Anchor[] = [];
    for (const a of this.anchors.values()) {
      const visibleNow = live.has(a.contactId);
      const c = contacts.find((x) => x.id === a.contactId);
      if (!c) continue;
      if (!visibleNow || Math.abs(wrap180((c.bearing ?? a.bearing) - heading)) > fov / 2) {
        out.push(a);
      }
    }
    return out;
  }
}

function wrap180(deg: number) {
  let d = deg % 360;
  if (d > 180)  d -= 360;
  if (d < -180) d += 360;
  return d;
}

/* ============================================================
 * T7 — Audio cross-check (18–22 kHz ultrasonic chirp detector).
 * Uses WebAudio AnalyserNode FFT. Returns a tiny RxJS-free
 * subscription with a live "active" flag.
 * ============================================================ */

export interface ChirpHandle {
  stop: () => void;
  isActive: () => boolean;
  lastLevel: () => number;
}

export async function startChirpDetector(onTick: (active: boolean, level: number) => void): Promise<ChirpHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctxClass: typeof AudioContext =
    (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new ctxClass();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.4;
  src.connect(analyser);

  const bins = new Uint8Array(analyser.frequencyBinCount);
  const sr = ctx.sampleRate;
  const binHz = sr / analyser.fftSize;
  const lo = Math.floor(18_000 / binHz);
  const hi = Math.min(bins.length - 1, Math.floor(22_000 / binHz));

  let raf = 0; let active = false; let level = 0; let stopped = false;
  const loop = () => {
    if (stopped) return;
    analyser.getByteFrequencyData(bins);
    let sum = 0, n = 0;
    for (let i = lo; i <= hi; i++) { sum += bins[i]; n++; }
    level = n ? sum / n / 255 : 0;
    active = level > 0.18; // empirical: room noise ≈ 0.05, real chirp pops to >0.25
    onTick(active, level);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try { src.disconnect(); } catch { /* ignore */ }
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      try { void ctx.close(); } catch { /* ignore */ }
    },
    isActive: () => active,
    lastLevel: () => level,
  };
}
