// Optical Contacts — passive, pairing-free device detection from the camera feed.
//
// Why this exists: Web Bluetooth's `requestLEScan` (which can passively read BLE
// advertisements without pairing) is only available on Chrome with the
// "Experimental Web Platform features" flag, mainly on Android. On every other
// browser the only path to a BLE reticle is pairing through the OS chooser.
//
// This module gives Zaxin a *pairing-free* contact source by running MediaPipe
// Tasks Vision ObjectDetector on the live rear-camera frame. Anything that
// looks like a personal-electronics object (phone, laptop, remote, tv, mouse,
// keyboard, book) becomes an "optical contact" with a real screen bbox.
// Reticles are drawn directly on the detected pixels — no compass math, no
// radio, no pairing. If we later get an RSSI advert whose bearing aligns with
// the bbox center, fusion can bind them (T3).
//
// Model: EfficientDet-Lite0 (int8) from MediaPipe — small, fast, runs on CPU.

import {
  ObjectDetector,
  FilesetResolver,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";

/** COCO labels we treat as "device-like" — the things a tactical operator
 *  would actually want flagged in-frame. */
const DEVICE_LABELS = new Set<string>([
  "cell phone",
  "laptop",
  "remote",
  "tv",
  "mouse",
  "keyboard",
  "book",       // covers e-readers / tablets w/ covers
  "clock",      // smart clocks / hub displays
]);

/** Bonus tag for situational awareness. */
const PERSON_LABEL = "person";

export type OpticalKind = "device" | "person";

export interface OpticalContact {
  /** Stable-ish id across frames (label + grid cell). */
  id: string;
  label: string;          // raw COCO label
  kind: OpticalKind;
  score: number;          // 0..1
  /** Normalized bbox (0..1) relative to the video's *display* surface. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Last seen ts. */
  ts: number;
}

export interface OpticalHandle {
  stop: () => void;
  /** Last frame's contacts, mutated in place each detection tick. */
  snapshot: () => OpticalContact[];
}

interface StartOpts {
  video: HTMLVideoElement;
  /** Called every detection tick (~6-10 Hz). */
  onFrame: (contacts: OpticalContact[]) => void;
  /** Minimum confidence to surface a contact. Default 0.45. */
  minScore?: number;
  /** Target detection rate (Hz). Default 8. */
  hz?: number;
}

let _detectorPromise: Promise<ObjectDetector> | null = null;
async function getDetector(): Promise<ObjectDetector> {
  if (_detectorPromise) return _detectorPromise;
  _detectorPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    return ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      scoreThreshold: 0.4,
      maxResults: 8,
      categoryAllowlist: [...DEVICE_LABELS, PERSON_LABEL],
    });
  })().catch((e) => {
    _detectorPromise = null;
    throw e;
  });
  return _detectorPromise;
}

function tagKind(label: string): OpticalKind | null {
  if (DEVICE_LABELS.has(label)) return "device";
  if (label === PERSON_LABEL) return "person";
  return null;
}

function gridCell(x: number, y: number): string {
  // 12x12 spatial bucket — gives a soft persistent id across frames
  // without needing IoU tracking. Cheap and good enough for reticle stickiness.
  const gx = Math.min(11, Math.max(0, Math.floor(x * 12)));
  const gy = Math.min(11, Math.max(0, Math.floor(y * 12)));
  return `${gx}x${gy}`;
}

function mapResult(
  res: ObjectDetectorResult,
  videoW: number,
  videoH: number,
  minScore: number,
  ts: number,
): OpticalContact[] {
  if (!videoW || !videoH) return [];
  const out: OpticalContact[] = [];
  for (const d of res.detections ?? []) {
    const cat = d.categories?.[0];
    if (!cat) continue;
    const label = cat.categoryName ?? "";
    const score = cat.score ?? 0;
    if (score < minScore) continue;
    const kind = tagKind(label);
    if (!kind) continue;
    const b = d.boundingBox;
    if (!b) continue;
    const x = b.originX / videoW;
    const y = b.originY / videoH;
    const w = b.width / videoW;
    const h = b.height / videoH;
    if (!isFinite(x) || !isFinite(y) || w <= 0 || h <= 0) continue;
    out.push({
      id: `${label}:${gridCell(x + w / 2, y + h / 2)}`,
      label,
      kind,
      score,
      x, y, w, h,
      ts,
    });
  }
  return out;
}

export async function startOpticalScan(opts: StartOpts): Promise<OpticalHandle> {
  const { video, onFrame } = opts;
  const minScore = opts.minScore ?? 0.45;
  const hz = Math.max(2, Math.min(15, opts.hz ?? 8));
  const periodMs = 1000 / hz;

  const detector = await getDetector();
  let killed = false;
  let last: OpticalContact[] = [];
  let lastTs = 0;

  const loop = (now: number) => {
    if (killed) return;
    requestAnimationFrame(loop);
    if (now - lastTs < periodMs) return;
    lastTs = now;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    try {
      const res = detector.detectForVideo(video, now);
      last = mapResult(res, video.videoWidth, video.videoHeight, minScore, Date.now());
      onFrame(last);
    } catch {
      // Detector can throw transiently on resize / track switch — ignore one frame.
    }
  };
  requestAnimationFrame(loop);

  return {
    stop: () => { killed = true; },
    snapshot: () => last,
  };
}
