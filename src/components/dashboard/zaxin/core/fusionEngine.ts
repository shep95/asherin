// ZAXIN FUSION ENGINE — elite-tier multi-sensor track fusion.
// ───────────────────────────────────────────────────────────
// Supersedes the naive per-contact bearing Kalman (BearingSlam).
//
// What it fixes over the previous filter:
//   1. Confidence could only ever RISE (`Math.max(conf, prev)`), so a track
//      that went stale kept advertising the confidence it had at its best
//      moment. Here confidence is derived from the *live* posterior sigma,
//      so coasting tracks decay honestly.
//   2. Fixed process noise regardless of how fast the operator or the contact
//      was moving. Here Q is adaptive: driven by measured angular rate and by
//      RSSI volatility.
//   3. No range state at all — distance was a raw path-loss point value with
//      no smoothing and no uncertainty. Here range is filtered in log-space
//      (which is where path-loss noise is actually Gaussian) with its own
//      covariance, and range-rate (closing / opening) falls out of it.
//   4. No track lifecycle — one advert produced a full-strength reticle. Here
//      tracks are M-of-N confirmed and transition
//      tentative → confirmed → coasting → lost.
//   5. No cross-modal correction. Optical detections (MediaPipe bboxes) carry
//      a far tighter bearing than any RSSI inference, but were never used to
//      correct the radio track. Here optical detections are gated by
//      Mahalanobis distance and applied as a low-noise bearing measurement.
//
// Physics note: contact bearings are ABSOLUTE compass bearings (0 = N), so
// operator rotation does not translate the state — but it does degrade the
// measurement (compass lag / magnetometer smear), so ego angular rate inflates
// R rather than shifting x.

import type { Contact } from "./types";
import type { OpticalContact } from "./opticalContacts";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export type TrackState = "tentative" | "confirmed" | "coasting" | "lost";

export interface FusedTrack {
  id: string;
  /** Filtered absolute bearing, degrees 0..360. */
  bearing: number | null;
  /** 1σ bearing uncertainty in degrees. */
  bearingSigmaDeg: number;
  /** Filtered angular velocity, deg/s (signed, + = clockwise). */
  bearingRateDegS: number;
  /** Filtered range in metres (log-space Kalman over path-loss). */
  rangeM: number | null;
  /** 1σ range uncertainty in metres. */
  rangeSigmaM: number;
  /** Range rate, m/s. Negative = closing on the operator. */
  rangeRateMS: number;
  /** Fused track quality 0..1 — decays while coasting. */
  confidence: number;
  state: TrackState;
  hits: number;
  misses: number;
  /** Optical contact this radio track is currently bound to (T3 fusion). */
  opticalId: string | null;
  /** True when the last bearing update came from optics, not RSSI. */
  opticalCorrected: boolean;
  lastUpdate: number;
}

/** Contact decorated with its fused track — what the HUD renders. */
export type FusedContact = Contact & { track: FusedTrack };

interface Tuning {
  /** Field of view of the AR camera, degrees. */
  fov: number;
  /** M-of-N: hits required before a track is CONFIRMED. */
  confirmHits: number;
  /** Consecutive misses before a track is declared LOST. */
  lostMisses: number;
  /** Gate width in sigmas for optical↔radio association. */
  gateSigmas: number;
  /**
   * Hard absolute gate (degrees) for optical↔radio association. The
   * Mahalanobis gate alone is not sufficient: an immature track with a wide
   * posterior will happily swallow a detection 25°+ away. Physical bearing
   * disagreement past this bound is never the same object.
   */
  gateHardDeg: number;
  /** Path-loss exponent for the RSSI→range model. */
  pathLossN: number;
  /** RSSI at 1 m for the RSSI→range model. */
  txPower: number;
}

const DEFAULT_TUNING: Tuning = {
  fov: 62,
  confirmHits: 3,
  lostMisses: 8,
  gateSigmas: 3,
  gateHardDeg: 18,
  pathLossN: 2.2,
  txPower: -59,
};


/* ══════════════════════════════════════════════════════════
 * Bearing filter — 2-state EKF on a circular manifold.
 * x = [theta (rad), omega (rad/s)]
 * ══════════════════════════════════════════════════════════ */
class BearingEkf {
  private x: [number, number] | null = null;
  // Covariance as a symmetric 2x2 [p00, p01, p11].
  private p00 = 1;
  private p01 = 0;
  private p11 = 1;
  private lastTs = 0;

  /** Propagate the state forward by dt seconds with adaptive process noise. */
  predict(dt: number, agility: number) {
    if (!this.x) return;
    const d = clamp(dt, 0, 3);
    // Constant-angular-velocity model.
    this.x[0] = wrapPi(this.x[0] + this.x[1] * d);
    // Piecewise-white-noise acceleration: q scales with how erratic the
    // target/operator pair currently is (0..1 agility).
    const sigmaA = (14 + agility * 90) * DEG; // rad/s²
    const q = sigmaA * sigmaA;
    const d2 = d * d, d3 = d2 * d, d4 = d2 * d2;
    this.p00 += 2 * this.p01 * d + this.p11 * d2 + (q * d4) / 4;
    this.p01 += this.p11 * d + (q * d3) / 2;
    this.p11 += q * d2;
  }

  /** Fold in a bearing measurement (radians) with 1σ = sigma (radians). */
  update(zRad: number, sigma: number) {
    if (!this.x) {
      this.x = [wrapPi(zRad), 0];
      this.p00 = sigma * sigma;
      this.p01 = 0;
      this.p11 = (120 * DEG) ** 2;
      return;
    }
    const r = Math.max(1e-4, sigma * sigma);
    const y = wrapPi(zRad - this.x[0]);       // circular innovation
    const s = this.p00 + r;
    const k0 = this.p00 / s;
    const k1 = this.p01 / s;
    this.x[0] = wrapPi(this.x[0] + k0 * y);
    this.x[1] = this.x[1] + k1 * y;
    const p00 = this.p00, p01 = this.p01;
    this.p00 = (1 - k0) * p00;
    this.p01 = (1 - k0) * p01;
    this.p11 = this.p11 - k1 * p01;
    // Numerical hygiene — keep the matrix positive definite.
    this.p00 = Math.max(this.p00, 1e-6);
    this.p11 = Math.max(this.p11, 1e-6);
  }

  /** Squared Mahalanobis distance of a candidate measurement. */
  mahalanobis2(zRad: number, sigma: number): number {
    if (!this.x) return 0;
    const y = wrapPi(zRad - this.x[0]);
    return (y * y) / (this.p00 + sigma * sigma);
  }

  get ready() { return this.x != null; }
  get bearingDeg() { return this.x ? (this.x[0] * RAD + 360) % 360 : null; }
  get rateDegS() { return this.x ? this.x[1] * RAD : 0; }
  get sigmaDeg() { return Math.sqrt(this.p00) * RAD; }
  touch(ts: number) { this.lastTs = ts; }
  get ts() { return this.lastTs; }
}

/* ══════════════════════════════════════════════════════════
 * Range filter — 1-D Kalman in log10 space.
 * Path loss is linear in log-distance, so the noise is Gaussian THERE,
 * not in metres. Filtering in metres biases every estimate long.
 * ══════════════════════════════════════════════════════════ */
class LogRangeKf {
  private x: number | null = null;   // log10(metres)
  private v = 0;                     // log10(m)/s
  private p = 1;
  private lastM: number | null = null;
  private lastTs = 0;

  update(meters: number, sigmaDb: number, dt: number, now = Date.now()) {
    const z = Math.log10(Math.max(0.05, meters));
    // Measurement sigma in log-space: dB error / (10 n) with n≈2.2.
    const sigma = Math.max(0.03, sigmaDb / 22);
    if (this.x == null) { this.x = z; this.p = sigma * sigma; this.lastM = meters; return; }
    const d = clamp(dt, 0, 3);
    this.p += 0.05 * d + 0.02;               // process noise
    const k = this.p / (this.p + sigma * sigma);
    const prev = this.x;
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    if (d > 0.05) {
      const inst = (this.x - prev) / d;
      this.v = this.v * 0.7 + inst * 0.3;     // smoothed log-rate
    }
    this.lastM = 10 ** this.x;
    this.lastTs = now;
  }

  get meters() { return this.x == null ? null : 10 ** this.x; }
  /** 1σ in metres, derived from the log-space covariance. */
  get sigmaM() {
    if (this.x == null) return 0;
    const m = 10 ** this.x;
    return Math.abs(m * Math.LN10 * Math.sqrt(this.p));
  }
  /** d(range)/dt in m/s. Negative = closing. */
  get rateMS() {
    if (this.x == null) return 0;
    return (10 ** this.x) * Math.LN10 * this.v;
  }
}

/* ══════════════════════════════════════════════════════════
 * Track container
 * ══════════════════════════════════════════════════════════ */
class Track {
  readonly id: string;
  readonly bearing = new BearingEkf();
  readonly range = new LogRangeKf();
  hits = 0;
  misses = 0;
  state: TrackState = "tentative";
  opticalId: string | null = null;
  opticalCorrected = false;
  lastSeen = 0;
  lastStep = 0;

  constructor(id: string) { this.id = id; }
}

/* ══════════════════════════════════════════════════════════
 * FusionTracker — the public engine.
 * ══════════════════════════════════════════════════════════ */
export class FusionTracker {
  private tracks = new Map<string, Track>();
  private tuning: Tuning;
  private lastHeading: number | null = null;
  private lastHeadingTs = 0;
  /** Measured operator angular rate, deg/s — drives adaptive R and Q. */
  private egoRateDegS = 0;

  constructor(tuning: Partial<Tuning> = {}) {
    this.tuning = { ...DEFAULT_TUNING, ...tuning };
  }

  /** Feed the compass so the engine can measure ego-motion smear. */
  observeHeading(heading: number | null, now = Date.now()) {
    if (heading == null) { this.lastHeading = null; this.egoRateDegS *= 0.8; return; }
    if (this.lastHeading != null && this.lastHeadingTs) {
      const dt = (now - this.lastHeadingTs) / 1000;
      if (dt > 0.02 && dt < 2) {
        const inst = Math.abs(wrap180(heading - this.lastHeading)) / dt;
        this.egoRateDegS = this.egoRateDegS * 0.6 + Math.min(inst, 400) * 0.4;
      }
    }
    this.lastHeading = heading;
    this.lastHeadingTs = now;
  }

  get operatorAngularRate() { return this.egoRateDegS; }

  /**
   * One fusion cycle. Order matters:
   *   1. predict every track forward
   *   2. apply radio (RSSI/bearing) measurements
   *   3. associate + apply optical measurements (tighter R, so applied last)
   *   4. run lifecycle bookkeeping
   */
  step(
    contacts: Contact[],
    optical: OpticalContact[],
    heading: number | null,
    /**
     * Injectable clock. The live AR loop omits it; replay, backtests and
     * simulations pass a virtual timestamp so rate estimation never depends
     * on how fast the caller happens to iterate.
     */
    nowMs?: number,
  ): FusedContact[] {
    const now = Number.isFinite(nowMs) ? (nowMs as number) : Date.now();
    this.observeHeading(heading, now);
    const seen = new Set<string>();
    const agility = clamp(this.egoRateDegS / 140, 0, 1);

    // ── 1 + 2. Predict, then radio update ──────────────────────────────
    for (const c of contacts) {
      seen.add(c.id);
      let t = this.tracks.get(c.id);
      if (!t) { t = new Track(c.id); this.tracks.set(c.id, t); }

      const dt = t.lastStep ? (now - t.lastStep) / 1000 : 0;
      t.lastStep = now;
      const rssiSigmaDb = rssiVolatility(c);
      t.bearing.predict(dt, Math.max(agility, clamp(rssiSigmaDb / 14, 0, 1)));

      let got = false;

      if (c.bearing != null && Number.isFinite(c.bearing)) {
        // Measurement noise: a weak declared confidence, a volatile RSSI trail,
        // or a fast-rotating operator all widen the gate honestly.
        const declared = clamp(c.bearingConfidence ?? 0.4, 0.05, 1);
        const base = 26 / (0.3 + declared);          // 20°..~75°
        const egoPenalty = Math.min(35, this.egoRateDegS * 0.22);
        const rssiPenalty = Math.min(30, rssiSigmaDb * 1.6);
        const sigmaDeg = clamp(base + egoPenalty + rssiPenalty, 6, 110);
        t.bearing.update(c.bearing * DEG, sigmaDeg * DEG);
        t.opticalCorrected = false;
        got = true;
      }

      const meters = pathLossRange(c, this.tuning);
      if (meters != null) {
        t.range.update(meters, Math.max(3, rssiSigmaDb), dt, now);
        got = true;
      }

      if (got) {
        t.hits++;
        t.misses = 0;
        t.lastSeen = now;
        t.bearing.touch(now);
      }
    }

    // ── 3. Optical association (global nearest neighbour under a gate) ──
    this.associateOptical(optical, heading);

    // ── 4. Lifecycle ───────────────────────────────────────────────────
    for (const [id, t] of this.tracks) {
      if (!seen.has(id)) {
        // Coast: predict only. Covariance grows, confidence decays.
        const dt = t.lastStep ? (now - t.lastStep) / 1000 : 0;
        t.lastStep = now;
        t.bearing.predict(dt, agility);
        t.misses++;
      }
      t.state =
        t.misses >= this.tuning.lostMisses ? "lost"
        : t.misses > 0 ? "coasting"
        : t.hits >= this.tuning.confirmHits ? "confirmed"
        : "tentative";
      // Reap tracks that have been lost for a full minute.
      if (t.state === "lost" && now - t.lastSeen > 60_000) this.tracks.delete(id);
    }

    // ── Emit ───────────────────────────────────────────────────────────
    return contacts.map((c) => {
      const t = this.tracks.get(c.id)!;
      const sigmaDeg = t.bearing.ready ? t.bearing.sigmaDeg : 180;
      // Confidence collapses out of the live posterior — not a running max.
      const geometric = Math.exp(-sigmaDeg / 30);
      const maturity = clamp(t.hits / this.tuning.confirmHits, 0, 1);
      const decay = t.state === "coasting" ? 0.55 : t.state === "lost" ? 0.15 : 1;
      const opticalBonus = t.opticalId ? 1.25 : 1;
      const confidence = clamp(geometric * (0.45 + 0.55 * maturity) * decay * opticalBonus, 0, 1);

      const track: FusedTrack = {
        id: c.id,
        bearing: t.bearing.bearingDeg,
        bearingSigmaDeg: sigmaDeg,
        bearingRateDegS: t.bearing.rateDegS,
        rangeM: t.range.meters,
        rangeSigmaM: t.range.sigmaM,
        rangeRateMS: t.range.rateMS,
        confidence,
        state: t.state,
        hits: t.hits,
        misses: t.misses,
        opticalId: t.opticalId,
        opticalCorrected: t.opticalCorrected,
        lastUpdate: t.lastSeen,
      };

      return {
        ...c,
        bearing: track.bearing ?? c.bearing,
        bearingConfidence: confidence,
        distanceMeters: track.rangeM ?? c.distanceMeters,
        track,
      };
    });
  }

  /** Drop all state (operator hit RESET / left the AR tab). */
  reset() { this.tracks.clear(); this.egoRateDegS = 0; this.lastHeading = null; }

  /* ── Optical ↔ radio association ─────────────────────────────────── */
  private associateOptical(optical: OpticalContact[], heading: number | null) {
    // Clear stale bindings every cycle; they must be re-earned.
    for (const t of this.tracks.values()) t.opticalId = null;
    if (heading == null || optical.length === 0) return;

    const fov = this.tuning.fov;
    const candidates: Array<{ trackId: string; opt: OpticalContact; zRad: number; sigma: number; d2: number }> = [];

    for (const o of optical) {
      // Bearing implied by the bbox centre under a rectilinear FOV model.
      const cx = o.x + o.w / 2;
      const bearingDeg = heading + (cx - 0.5) * fov;
      const zRad = wrapPi(bearingDeg * DEG);
      // Optics are tight: base 4°, widened by low detector score and by
      // bbox width (a big box is a fuzzy centroid).
      const sigmaDeg = clamp(4 + (1 - clamp(o.score, 0, 1)) * 10 + o.w * 18, 3, 26);
      const sigma = sigmaDeg * DEG;
      for (const [id, t] of this.tracks) {
        if (!t.bearing.ready || t.state === "lost") continue;
        // Hard physical gate first — cheap, and it rejects the wide-posterior
        // false binds that a pure Mahalanobis test lets through.
        const tb = t.bearing.bearingDeg;
        if (tb == null || Math.abs(wrap180(bearingDeg - tb)) > this.tuning.gateHardDeg) continue;
        const d2 = t.bearing.mahalanobis2(zRad, sigma);
        if (d2 <= this.tuning.gateSigmas ** 2) candidates.push({ trackId: id, opt: o, zRad, sigma, d2 });
      }
    }

    // Greedy global nearest neighbour — cheapest pairs win, one-to-one.
    candidates.sort((a, b) => a.d2 - b.d2);
    const usedTracks = new Set<string>();
    const usedOptical = new Set<string>();
    for (const cand of candidates) {
      if (usedTracks.has(cand.trackId) || usedOptical.has(cand.opt.id)) continue;
      const t = this.tracks.get(cand.trackId);
      if (!t) continue;
      t.bearing.update(cand.zRad, cand.sigma);
      t.opticalId = cand.opt.id;
      t.opticalCorrected = true;
      usedTracks.add(cand.trackId);
      usedOptical.add(cand.opt.id);
    }
  }
}

/* ══════════════════════════════════════════════════════════
 * Helpers
 * ══════════════════════════════════════════════════════════ */

/** Standard deviation of the recent RSSI trail, in dB. */
export function rssiVolatility(c: Contact): number {
  const s = (c.samples ?? []).slice(-16).map((x) => x.rssi).filter(Number.isFinite);
  if (s.length < 3) return 8;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const varc = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length;
  return Math.sqrt(varc);
}

/** Log-distance path-loss inversion, preferring an already-computed range. */
function pathLossRange(c: Contact, t: Tuning): number | null {
  if (c.distanceMeters != null && Number.isFinite(c.distanceMeters)) return c.distanceMeters;
  if (c.rssi == null || !Number.isFinite(c.rssi)) return null;
  return 10 ** ((t.txPower - c.rssi) / (10 * t.pathLossN));
}

function wrapPi(r: number) {
  let x = r % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

export function wrap180(deg: number) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
