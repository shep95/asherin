// BLE Ranging — honest RF physics for Zaxin.
//
// BLE is NOT radar. Peripherals are *active transmitters* — they broadcast
// their own signal; nothing "bounces back" we can measure. So we cannot
// emit a ping and time an echo from a web browser.
//
// What we *can* compute legitimately from the RSSI a BLE advert arrives at:
//
//   1. Distance         — log-distance path-loss model (calibrated per tx)
//   2. Range confidence — variance of recent RSSI samples (multipath check)
//   3. Bearing          — gradient of RSSI as the operator rotates
//   4. Elevation hint   — operator device pitch when lock-on RSSI peaks
//                          (NOT a real elevation measurement; an approximation
//                          assuming the operator points at the source)
//   5. Synthetic-aperture position — solve (x,y) from 3+ RSSI samples taken
//                          at different operator positions (passive trilateration)
//
// All distances in meters. All angles in degrees [0, 360).

export interface RangingSample {
  rssi: number;        // dBm, negative
  ts: number;          // ms
  heading?: number;    // operator compass heading at sample time
  pitch?: number;      // operator device pitch (deviceorientation.beta) at sample time
  /** Operator world position in *meters* relative to session origin (optional). */
  ox?: number;
  oy?: number;
}

export interface RangingEstimate {
  distanceMeters: number;
  /** 0..1 — higher when recent RSSI variance is low (stable path). */
  confidence: number;
  /** Best bearing estimate this rangeer has seen (peak RSSI heading). */
  bearingDeg: number | null;
  /** Best elevation hint (operator pitch at peak RSSI). null if unknown. */
  elevationDeg: number | null;
  /** Synthetic-aperture XY in meters, when ≥3 distinct operator positions seen. */
  xy: { x: number; y: number } | null;
  /** Operator-readable one-liner. */
  summary: string;
}

const DEFAULT_TX_POWER_DBM = -59;  // RSSI at 1m for a typical BLE peripheral
const DEFAULT_PATH_LOSS_N = 2.4;   // 2.0 = free space, 3-4 = indoor walls/people
const RING_MAX = 30;               // ~30s @ 1Hz

/** Log-distance path loss: d = 10 ^ ((TxPower − RSSI) / (10·n)). */
export function rssiToDistance(
  rssi: number,
  txPowerDbm = DEFAULT_TX_POWER_DBM,
  n = DEFAULT_PATH_LOSS_N,
): number {
  if (!isFinite(rssi)) return NaN;
  const d = Math.pow(10, (txPowerDbm - rssi) / (10 * n));
  // Clamp to a sane indoor envelope — RSSI is noisy and can go absurd.
  return Math.max(0.1, Math.min(80, d));
}

export class BleRanger {
  private ring: RangingSample[] = [];
  private peakRssi = -200;
  private peakHeading: number | null = null;
  private peakPitch: number | null = null;

  constructor(
    private txPowerDbm: number = DEFAULT_TX_POWER_DBM,
    private pathLossN: number = DEFAULT_PATH_LOSS_N,
  ) {}

  /** Push a fresh RSSI reading. Returns the up-to-date estimate. */
  push(sample: RangingSample): RangingEstimate {
    this.ring.push(sample);
    if (this.ring.length > RING_MAX) this.ring.shift();
    if (sample.rssi > this.peakRssi) {
      this.peakRssi = sample.rssi;
      if (typeof sample.heading === "number") this.peakHeading = sample.heading;
      if (typeof sample.pitch === "number")   this.peakPitch   = sample.pitch;
    }
    return this.estimate();
  }

  /** Calibrate Tx-power live: hold target at 1m, call calibrateAt1m(currentRssi). */
  calibrateAt1m(rssi: number) {
    if (isFinite(rssi)) this.txPowerDbm = rssi;
  }

  /** Adjust path-loss exponent (2.0 open space → ~3.5 dense indoor). */
  setEnvironment(n: number) {
    this.pathLossN = Math.max(1.6, Math.min(4.5, n));
  }

  /** Synthetic-aperture trilateration from operator motion. */
  private trilaterate(): { x: number; y: number } | null {
    const pts = this.ring
      .filter(s => typeof s.ox === "number" && typeof s.oy === "number")
      .slice(-8);
    if (pts.length < 3) return null;
    // Weighted least-squares around the strongest reading.
    let sx = 0, sy = 0, sw = 0;
    for (const p of pts) {
      const d = rssiToDistance(p.rssi, this.txPowerDbm, this.pathLossN);
      const w = 1 / Math.max(0.25, d);          // closer samples weigh more
      // Each sample says "target is within radius d of (ox, oy)".
      // Approximate target by the weighted centroid of operator positions
      // pulled toward the heading line (if heading known).
      let tx = p.ox!, ty = p.oy!;
      if (typeof p.heading === "number") {
        const rad = (p.heading * Math.PI) / 180;
        tx += Math.sin(rad) * d;
        ty += Math.cos(rad) * d;
      }
      sx += tx * w; sy += ty * w; sw += w;
    }
    if (sw <= 0) return null;
    return { x: sx / sw, y: sy / sw };
  }

  estimate(): RangingEstimate {
    const recent = this.ring.slice(-6);
    if (recent.length === 0) {
      return {
        distanceMeters: NaN,
        confidence: 0,
        bearingDeg: null,
        elevationDeg: null,
        xy: null,
        summary: "no samples",
      };
    }
    const avgRssi = recent.reduce((a, s) => a + s.rssi, 0) / recent.length;
    const distanceMeters = rssiToDistance(avgRssi, this.txPowerDbm, this.pathLossN);

    // Variance → confidence (low variance = stable path, high confidence).
    const mean = avgRssi;
    const variance = recent.reduce((a, s) => a + (s.rssi - mean) ** 2, 0) / recent.length;
    // 0 dB² var → 1.0, 36 dB² var → ~0.0
    const confidence = Math.max(0, Math.min(1, 1 - variance / 36));

    const xy = this.trilaterate();
    const summary =
      `~${distanceMeters.toFixed(1)}m` +
      (this.peakHeading !== null ? ` @ ${Math.round(this.peakHeading)}°` : "") +
      (this.peakPitch !== null ? ` / pitch ${Math.round(this.peakPitch)}°` : "") +
      ` (conf ${(confidence * 100).toFixed(0)}%)`;

    return {
      distanceMeters,
      confidence,
      bearingDeg: this.peakHeading,
      elevationDeg: this.peakPitch,
      xy,
      summary,
    };
  }
}

/** Shared registry — one ranger per contact id. */
const RANGERS = new Map<string, BleRanger>();
export function getRanger(id: string): BleRanger {
  let r = RANGERS.get(id);
  if (!r) { r = new BleRanger(); RANGERS.set(id, r); }
  return r;
}
export function dropRanger(id: string) { RANGERS.delete(id); }
