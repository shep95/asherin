// Body-vision brain — on-device pose / face / hand landmark detection.
// Runs MediaPipe Tasks Vision in the browser (WASM), no install, no server.
//
// What it gives us:
//  • PoseLandmarker → 33 body keypoints (shoulders, elbows, hips, knees, ankles).
//  • FaceLandmarker → 478 face mesh keypoints (we render the silhouette).
//  • HandLandmarker → up to 2 hands × 21 finger keypoints.
//
// Why: a camera can't see BLE radio. So we detect the *human* in the frame and
// let the operator tap a presence to bind it to a Bluetooth identity.

export type BodyMode = "full" | "face" | "fingers";

export interface PoseHit {
  kind: "body" | "face" | "left-hand" | "right-hand";
  /** normalized bbox of this region (0..1, video coords) */
  bbox: { x: number; y: number; w: number; h: number };
  /** raw landmark list in normalized video coords */
  points: Array<{ x: number; y: number }>;
}

export interface BodyFrame {
  hits: PoseHit[];
  ts: number;
}

const VERSION = "0.10.22-rc.20250304";
// Try multiple CDNs — esm.sh sometimes fails to transpile the MediaPipe bundle.
const CDN_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`,
  `https://esm.run/@mediapipe/tasks-vision@${VERSION}`,
  `https://esm.sh/@mediapipe/tasks-vision@${VERSION}?bundle`,
];
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = {
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

let cache: {
  pose: any; face: any; hand: any;
} | null = null;

async function loadVisionModule(): Promise<any> {
  let lastErr: unknown = null;
  for (const url of CDN_CANDIDATES) {
    try {
      const mod: any = await import(/* @vite-ignore */ url);
      if (mod?.FilesetResolver) return mod;
      lastErr = new Error(`module loaded but FilesetResolver missing: ${url}`);
    } catch (e) {
      lastErr = e;
      console.warn("[bodyvision] CDN failed, trying next:", url, e);
    }
  }
  throw lastErr ?? new Error("All MediaPipe CDNs failed to load.");
}

async function loadModels() {
  if (cache) return cache;
  const mod = await loadVisionModule();
  const fileset = await mod.FilesetResolver.forVisionTasks(WASM);

  const [pose, face, hand] = await Promise.all([
    mod.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL.pose, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
    mod.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL.face, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
    }),
    mod.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL.hand, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    }),
  ]);
  cache = { pose, face, hand };
  return cache;
}

function bboxOf(points: Array<{ x: number; y: number }>) {
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0;
  for (const p of points) {
    if (p.x < x1) x1 = p.x; if (p.x > x2) x2 = p.x;
    if (p.y < y1) y1 = p.y; if (p.y > y2) y2 = p.y;
  }
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

export interface BodyVisionHandle {
  stop: () => void;
  setModes: (m: Set<BodyMode>) => void;
}

export async function startBodyVision(
  video: HTMLVideoElement,
  onFrame: (f: BodyFrame) => void,
  initialModes: Set<BodyMode>,
): Promise<BodyVisionHandle> {
  const models = await loadModels();
  let modes = new Set(initialModes);
  let alive = true;
  let raf = 0;
  let lastTs = -1;

  const loop = () => {
    if (!alive) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      raf = requestAnimationFrame(loop); return;
    }
    const ts = performance.now();
    if (ts === lastTs) { raf = requestAnimationFrame(loop); return; }
    lastTs = ts;

    const hits: PoseHit[] = [];
    try {
      if (modes.has("full")) {
        const r = models.pose.detectForVideo(video, ts);
        const lm = r?.landmarks?.[0];
        if (lm?.length) {
          const pts = lm.map((p: any) => ({ x: p.x, y: p.y }));
          hits.push({ kind: "body", points: pts, bbox: bboxOf(pts) });
        }
      }
      if (modes.has("face")) {
        const r = models.face.detectForVideo(video, ts);
        const lm = r?.faceLandmarks?.[0];
        if (lm?.length) {
          const pts = lm.map((p: any) => ({ x: p.x, y: p.y }));
          hits.push({ kind: "face", points: pts, bbox: bboxOf(pts) });
        }
      }
      if (modes.has("fingers")) {
        const r = models.hand.detectForVideo(video, ts);
        const handed: string[] = (r?.handednesses ?? []).map((h: any) => h?.[0]?.categoryName ?? "Right");
        (r?.landmarks ?? []).forEach((lm: any, i: number) => {
          const pts = lm.map((p: any) => ({ x: p.x, y: p.y }));
          const side = (handed[i] ?? "Right").toLowerCase();
          hits.push({
            kind: side === "left" ? "left-hand" : "right-hand",
            points: pts,
            bbox: bboxOf(pts),
          });
        });
      }
    } catch { /* swallow per-frame errors, keep loop alive */ }

    onFrame({ hits, ts: Date.now() });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    stop: () => { alive = false; cancelAnimationFrame(raf); },
    setModes: (m) => { modes = new Set(m); },
  };
}

/* Skeleton edges — minimal, matches BlazePose 33-point output. */
export const POSE_EDGES: Array<[number, number]> = [
  // arms
  [11, 13], [13, 15], [12, 14], [14, 16],
  // shoulders + torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // legs
  [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32],
  // face base
  [0, 11], [0, 12],
];

// Hand skeleton (MediaPipe spec) — 21 points, 5 fingers.
export const HAND_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
