// Optical Contacts — passive, pairing-free device detection from the camera feed.
//
// Why this exists: Web Bluetooth's `requestLEScan` (which can passively read BLE
// advertisements without pairing) is only available on Chrome with the
// "Experimental Web Platform features" flag — mainly on Android. Everywhere
// else, a BLE reticle requires pairing through the OS chooser.
//
// This module gives Zaxin a *pairing-free* contact source by running MediaPipe
// Tasks Vision ObjectDetector on the live rear-camera frame. Anything that
// looks like personal electronics (phone, laptop, remote, tv, mouse, keyboard,
// book/tablet, clock) becomes an "optical contact" with a real screen bbox.
// Reticles are drawn directly on the detected pixels — no compass, no radio,
// no pairing. If a radio advert later arrives whose bearing aligns with a
// bbox center, fusion can bind them (T3).
//
// Model: EfficientDet-Lite0 (int8) from Google's public MediaPipe bucket.

const VERSION = "0.10.22-rc.20250304";
const CDN_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`,
  `https://esm.run/@mediapipe/tasks-vision@${VERSION}`,
  `https://esm.sh/@mediapipe/tasks-vision@${VERSION}?bundle`,
];
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";

/** COCO labels we treat as "device-like" — what an operator wants flagged. */
const DEVICE_LABELS = new Set<string>([
  "cell phone",
  "laptop",
  "remote",
  "tv",
  "mouse",
  "keyboard",
  "book",
  "clock",
]);
const PERSON_LABEL = "person";

export type OpticalKind = "device" | "person";

export interface OpticalContact {
  /** Soft-stable id (label + 12x12 grid cell) — sticky enough for reticles. */
  id: string;
  label: string;
  kind: OpticalKind;
  score: number;
  /** Normalized bbox (0..1) in the *source video* coordinate frame. */
  x: number; y: number; w: number; h: number;
  ts: number;
}

export interface OpticalHandle {
  stop: () => void;
  snapshot: () => OpticalContact[];
}

interface StartOpts {
  video: HTMLVideoElement;
  onFrame: (contacts: OpticalContact[]) => void;
  minScore?: number;
  hz?: number;
}

let _modPromise: Promise<any> | null = null;
async function loadVisionModule(): Promise<any> {
  if (_modPromise) return _modPromise;
  _modPromise = (async () => {
    let lastErr: unknown = null;
    for (const url of CDN_CANDIDATES) {
      try {
        const mod: any = await import(/* @vite-ignore */ url);
        if (mod?.FilesetResolver && mod?.ObjectDetector) return mod;
        lastErr = new Error(`module loaded but ObjectDetector missing: ${url}`);
      } catch (e) {
        lastErr = e;
        console.warn("[opticalContacts] CDN failed, trying next:", url, e);
      }
    }
    throw lastErr ?? new Error("All MediaPipe CDNs failed.");
  })().catch((e) => { _modPromise = null; throw e; });
  return _modPromise;
}

let _detector: any = null;
async function getDetector(): Promise<any> {
  if (_detector) return _detector;
  const mod = await loadVisionModule();
  const fileset = await mod.FilesetResolver.forVisionTasks(WASM);
  _detector = await mod.ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    scoreThreshold: 0.4,
    maxResults: 8,
    categoryAllowlist: [...DEVICE_LABELS, PERSON_LABEL],
  });
  return _detector;
}

function tagKind(label: string): OpticalKind | null {
  if (DEVICE_LABELS.has(label)) return "device";
  if (label === PERSON_LABEL) return "person";
  return null;
}

function gridCell(x: number, y: number): string {
  const gx = Math.min(11, Math.max(0, Math.floor(x * 12)));
  const gy = Math.min(11, Math.max(0, Math.floor(y * 12)));
  return `${gx}x${gy}`;
}

function mapResult(res: any, videoW: number, videoH: number, minScore: number, ts: number): OpticalContact[] {
  if (!videoW || !videoH) return [];
  const out: OpticalContact[] = [];
  for (const d of res?.detections ?? []) {
    const cat = d?.categories?.[0];
    if (!cat) continue;
    const label: string = cat.categoryName ?? "";
    const score: number = cat.score ?? 0;
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
      label, kind, score, x, y, w, h, ts,
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
      // transient — ignore one frame
    }
  };
  requestAnimationFrame(loop);

  return { stop: () => { killed = true; }, snapshot: () => last };
}
