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

export interface BodyMetrics {
  /** estimated standing height in meters (rough — monocular, no depth). */
  heightM: number;
  /** estimated mass in kg via BMI=22 anthropometric assumption. */
  weightKg: number;
  /** 0..1 — how confident the estimate is (full body visible, vertical pose). */
  confidence: number;
  /** how the estimate was anchored, for the HUD. */
  anchor: "shoulder+head" | "shoulder-breadth" | "head-width" | "frame-fill" | "unstable";
  /** rough distance from the camera in meters (inter-ocular baseline, 60° FoV). */
  distanceFromCameraM?: number;
  /** torso tilt from vertical in degrees — >30° means "not standing upright." */
  torsoTiltDeg?: number;
  /** true when the two anchors (shoulder vs head) disagreed by >2× and we clamped. */
  unstable?: boolean;
}

export type WearableZoneKind = "wrist-L" | "wrist-R" | "ear-L" | "ear-R";
export interface WearableZone {
  kind: WearableZoneKind;
  /** normalized center + radius, video coords (0..1). */
  cx: number; cy: number; r: number;
  /** landmark visibility 0..1 — hide the zone below ~0.4. */
  visibility: number;
}

export interface PoseHit {
  kind: "body" | "face" | "left-hand" | "right-hand";
  /** normalized bbox of this region (0..1, video coords) */
  bbox: { x: number; y: number; w: number; h: number };
  /** raw landmark list in normalized video coords, with per-point visibility */
  points: Array<{ x: number; y: number; v?: number }>;
  /** body-only: anthropometric estimate, when full body keypoints are visible. */
  metrics?: BodyMetrics;
  /** body-only: wearable-device candidate zones (wrists, ears). */
  wearableZones?: WearableZone[];
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

function estimateBodyMetrics(
  pts: Array<{ x: number; y: number }>,
  aspect: number, // videoWidth / videoHeight
): BodyMetrics | undefined {
  // BlazePose 33-pt indices we rely on.
  const NOSE = 0, L_SH = 11, R_SH = 12, L_HIP = 23, R_HIP = 24, L_AN = 27, R_AN = 28;
  const need = [NOSE, L_SH, R_SH, L_HIP, R_HIP, L_AN, R_AN];
  if (need.some((i) => !pts[i])) return undefined;

  // Normalize so x is "real" by multiplying by aspect (square space → wide).
  const P = (i: number) => ({ x: pts[i].x * aspect, y: pts[i].y });
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const shoulderBreadth = dist(P(L_SH), P(R_SH));
  const head = P(NOSE);
  const ankleY = Math.max(pts[L_AN].y, pts[R_AN].y);
  const headToAnkle = ankleY - head.y;            // pure-vertical span (normalized)
  const torsoLen = ((P(L_HIP).y + P(R_HIP).y) / 2) - ((P(L_SH).y + P(R_SH).y) / 2);

  // Reject crouching / partial frames.
  if (headToAnkle < 0.25) return undefined;
  if (torsoLen <= 0) return undefined;

  // Anchor strategy.
  // Adult mean biacromial (shoulder) breadth ≈ 0.40 m.
  // Anchor 1 (preferred): use shoulder breadth in normalized-square to back out a
  // "meters per normalized unit", then multiply head→ankle by it.
  // Anchor 2 (fallback): assume the subject fills ~85 % of the frame and a 1.70 m
  // adult stands at that fill ratio.
  let heightM: number;
  let anchor: BodyMetrics["anchor"];
  let confidence: number;
  if (shoulderBreadth > 0.05) {
    const metersPerUnit = 0.40 / shoulderBreadth;
    heightM = headToAnkle * metersPerUnit;
    anchor = "shoulder-breadth";
    confidence = 0.55;
  } else {
    heightM = (headToAnkle / 0.85) * 1.70;
    anchor = "frame-fill";
    confidence = 0.3;
  }

  // Clamp to physically plausible adult/child range so a partial detection
  // never reports "12 m tall".
  heightM = Math.min(2.3, Math.max(0.9, heightM));

  // Frontal-pose bonus: shoulder-to-torso ratio should sit in a sane band.
  const shoulderToTorso = shoulderBreadth / torsoLen;
  if (shoulderToTorso > 0.8 && shoulderToTorso < 2.4) confidence += 0.2;

  // BMI=22 → weight = 22 × h² (kg). Tag slight build-factor from shoulder ratio.
  const buildAdj = Math.min(1.15, Math.max(0.85, shoulderToTorso / 1.45));
  const weightKg = Math.round(22 * heightM * heightM * buildAdj);

  return {
    heightM: Math.round(heightM * 100) / 100,
    weightKg,
    confidence: Math.min(1, confidence),
    anchor,
  };
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

    const aspect = video.videoWidth / Math.max(1, video.videoHeight);

    const hits: PoseHit[] = [];
    try {
      if (modes.has("full")) {
        const r = models.pose.detectForVideo(video, ts);
        const lm = r?.landmarks?.[0];
        if (lm?.length) {
          const pts = lm.map((p: any) => ({ x: p.x, y: p.y }));
          hits.push({
            kind: "body",
            points: pts,
            bbox: bboxOf(pts),
            metrics: estimateBodyMetrics(pts, aspect),
          });
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
