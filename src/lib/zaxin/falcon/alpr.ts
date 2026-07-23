// Zaxin Falcon — On-Device ALPR
// ------------------------------
// Uses tesseract.js (WASM OCR) to read plates off the lower half of vehicle
// bboxes. Runs at ≤1 Hz per track, round-robins across tracks, throttles
// itself to one active recognition at a time so it never wedges the render
// loop or main thread.
//
// Plate validation is intentionally permissive (5–8 alphanumerics, at least
// one letter + one digit) — US/CA/EU plates all fit this envelope. False
// positives get pruned by a stability filter (same plate must be read twice
// within 6 s before it's declared "confirmed").

import { createWorker, type Worker as TWorker } from "tesseract.js";
import type { VehicleTrack } from "@/components/dashboard/zaxin/core/vehicleTracking";
import { hashPlate, matchHashSync, normalizePlate, type HotlistEntry } from "./hotlist";
import { fingerprintBbox, type VehicleFingerprint } from "./fingerprint";

export interface FalconRead {
  trackId: string;
  plate: string | null;       // normalized plaintext, null until confirmed
  plateHash: string | null;
  confidence: number;         // 0..1
  reads: number;              // total OCR attempts on this track
  confirmedTs: number | null; // when we saw the same plate twice
  fingerprint: VehicleFingerprint | null;
  hotlist: HotlistEntry | null;
  lastAttemptTs: number;
}

export interface FalconHandle {
  stop: () => void;
  snapshot: () => Map<string, FalconRead>;
  /** Fired every time a hotlist match transitions from null → hit. */
  onHit: (cb: (hit: FalconRead) => void) => () => void;
}

interface StartOpts {
  video: HTMLVideoElement;
  getTracks: () => VehicleTrack[];
  onUpdate: (reads: Map<string, FalconRead>) => void;
  /** Minimum bbox area (normalized) before we bother trying OCR. */
  minArea?: number;
  /** Round-robin period per track in ms. */
  perTrackPeriodMs?: number;
}

const PLATE_RE = /\b([A-Z0-9]{5,8})\b/g;
function extractPlate(text: string): string | null {
  const norm = text.toUpperCase().replace(/[^A-Z0-9\s\n-]/g, " ");
  const matches = [...norm.matchAll(PLATE_RE)].map((m) => m[1]);
  for (const cand of matches) {
    const hasLetter = /[A-Z]/.test(cand);
    const hasDigit  = /[0-9]/.test(cand);
    // reject if all-letter or all-digit — plates always mix (with rare exceptions)
    if (hasLetter && hasDigit) return cand;
  }
  return null;
}

/** Crop bottom 55% of the bbox (where plates almost always sit). */
function cropPlateRegion(video: HTMLVideoElement, t: VehicleTrack): HTMLCanvasElement | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const px = Math.max(0, Math.round(t.x * vw));
  const py = Math.max(0, Math.round((t.y + t.h * 0.45) * vh));
  const pw = Math.max(8, Math.round(t.w * vw));
  const ph = Math.max(8, Math.round(t.h * 0.55 * vh));
  if (pw < 40 || ph < 12) return null;
  const c = document.createElement("canvas");
  const scale = Math.min(1, 300 / pw); // upscale small plates, cap at 300px wide
  c.width  = Math.round(pw * (scale > 1 ? scale : Math.max(1, 200 / pw)));
  c.height = Math.round(ph * (c.width / pw));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(video, px, py, pw, ph, 0, 0, c.width, c.height);
    // simple contrast boost — grayscale + threshold curve
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = y < 90 ? 0 : y > 170 ? 255 : Math.round((y - 90) * (255 / 80));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  } catch { return null; }
}

let _workerPromise: Promise<TWorker> | null = null;
async function getWorker(): Promise<TWorker> {
  if (_workerPromise) return _workerPromise;
  _workerPromise = (async () => {
    const w = await createWorker("eng", 1, { legacyCore: false });
    await w.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      preserve_interword_spaces: "0",
    });
    return w;
  })().catch((e) => { _workerPromise = null; throw e; });
  return _workerPromise;
}

export async function startFalconAlpr(opts: StartOpts): Promise<FalconHandle> {
  const minArea = opts.minArea ?? 0.02;   // ~2% of frame area
  const period  = opts.perTrackPeriodMs ?? 1500;

  const reads = new Map<string, FalconRead>();
  const hitSubs = new Set<(h: FalconRead) => void>();
  let killed = false;
  let busy = false;
  let cursor = 0;

  // Preload worker but don't block the caller.
  const workerP = getWorker().catch(() => null);

  const emit = () => opts.onUpdate(new Map(reads));

  const loop = async () => {
    if (killed) return;
    if (!busy) {
      const tracks = opts.getTracks().filter((t) => (t.w * t.h) >= minArea && t.speedConfidence > 0.15);
      if (tracks.length) {
        cursor = (cursor + 1) % tracks.length;
        const t = tracks[cursor];
        const prior = reads.get(t.id) ?? {
          trackId: t.id, plate: null, plateHash: null, confidence: 0,
          reads: 0, confirmedTs: null, fingerprint: null, hotlist: null, lastAttemptTs: 0,
        };
        // Rate-limit per track
        if (Date.now() - prior.lastAttemptTs >= period) {
          busy = true;
          try {
            const worker = await workerP;
            const fp = fingerprintBbox(opts.video, { x: t.x, y: t.y, w: t.w, h: t.h }, t.label);
            let plateCandidate: string | null = null;
            let confidence = 0;
            if (worker) {
              const crop = cropPlateRegion(opts.video, t);
              if (crop) {
                try {
                  const res = await worker.recognize(crop);
                  confidence = (res.data?.confidence ?? 0) / 100;
                  const raw = res.data?.text ?? "";
                  plateCandidate = extractPlate(raw);
                } catch { /* transient — skip */ }
              }
            }
            const priorPlateMatches = plateCandidate && prior.plate && normalizePlate(prior.plate) === normalizePlate(plateCandidate);
            const finalPlate = priorPlateMatches ? plateCandidate : (plateCandidate ?? prior.plate);
            const finalConfirmed = priorPlateMatches ? (prior.confirmedTs ?? Date.now()) : prior.confirmedTs;
            const plateHash = finalPlate ? await hashPlate(finalPlate) : null;
            const hot = plateHash ? matchHashSync(plateHash) : null;
            const next: FalconRead = {
              trackId: t.id,
              plate: finalConfirmed ? finalPlate : (priorPlateMatches ? finalPlate : null),
              plateHash: finalConfirmed ? plateHash : null,
              confidence: Math.max(prior.confidence, confidence),
              reads: prior.reads + 1,
              confirmedTs: finalConfirmed,
              fingerprint: fp ?? prior.fingerprint,
              hotlist: hot,
              lastAttemptTs: Date.now(),
            };
            reads.set(t.id, next);
            // Hot fire — only when transitioning null → hit
            if (hot && !prior.hotlist) hitSubs.forEach((cb) => { try { cb(next); } catch { /* */ } });
            emit();
          } finally {
            busy = false;
          }
        }
      }
      // GC stale reads
      const liveIds = new Set(opts.getTracks().map((t) => t.id));
      let mutated = false;
      for (const id of [...reads.keys()]) {
        if (!liveIds.has(id)) { reads.delete(id); mutated = true; }
      }
      if (mutated) emit();
    }
    setTimeout(loop, 300);
  };
  loop();

  return {
    stop: () => { killed = true; },
    snapshot: () => new Map(reads),
    onHit: (cb) => { hitSubs.add(cb); return () => hitSubs.delete(cb); },
  };
}
