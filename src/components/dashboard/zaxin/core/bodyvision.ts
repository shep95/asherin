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

// BlazePose 33-pt landmark indices we care about.
const NOSE = 0, L_EYE = 2, R_EYE = 5, L_EAR = 7, R_EAR = 8;
const L_SH = 11, R_SH = 12, L_ELB = 13, R_ELB = 14, L_WR = 15, R_WR = 16;
const L_HIP = 23, R_HIP = 24, L_AN = 27, R_AN = 28;

/** Rough horizontal FoV of a phone rear camera; used to convert inter-ocular
 *  pixel distance into a metric range. Real value varies 55°–75°; 60° is the
 *  honest midpoint and we surface the number as a *rough* distance. */
const CAMERA_HFOV_DEG = 60;
/** Real-world adult inter-pupillary distance (m). */
const IPD_M = 0.063;
/** Real-world mean adult biacromial (shoulder) breadth — averaged M/F. */
const SHOULDER_BREADTH_M = 0.38;
/** Real-world mean adult ear-to-ear head width. */
const HEAD_WIDTH_M = 0.155;
/** Landmark visibility below this is treated as "not seen." */
const V_MIN = 0.5;

function vis(p: any): number {
  const v = typeof p?.visibility === "number" ? p.visibility : (typeof p?.v === "number" ? p.v : 1);
  return Number.isFinite(v) ? v : 0;
}

function estimateBodyMetrics(
  pts: Array<{ x: number; y: number; v?: number }>,
  aspect: number,           // videoWidth / videoHeight
  videoWidth: number,
): BodyMetrics | undefined {
  const need = [NOSE, L_SH, R_SH, L_HIP, R_HIP, L_AN, R_AN];
  if (need.some((i) => !pts[i])) return undefined;

  // Visibility gate — reject if any critical vertical landmark is unreliable.
  const critVis = Math.min(vis(pts[NOSE]), vis(pts[L_AN]), vis(pts[R_AN]));
  if (critVis < V_MIN) return undefined;
  const shoulderVis = Math.min(vis(pts[L_SH]), vis(pts[R_SH]));
  const earVis = pts[L_EAR] && pts[R_EAR]
    ? Math.min(vis(pts[L_EAR]), vis(pts[R_EAR])) : 0;

  // "Square" x-space so pixel distances in x and y have the same meaning.
  const P = (i: number) => ({ x: pts[i].x * aspect, y: pts[i].y });
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const midSh  = { x: (P(L_SH).x + P(R_SH).x) / 2,  y: (P(L_SH).y + P(R_SH).y) / 2  };
  const midHip = { x: (P(L_HIP).x + P(R_HIP).x) / 2, y: (P(L_HIP).y + P(R_HIP).y) / 2 };
  const ankleY = Math.max(pts[L_AN].y, pts[R_AN].y);
  const headToAnkle = ankleY - P(NOSE).y;
  if (headToAnkle < 0.25) return undefined;

  // Verticality — angle between shoulders→hips vector and world-down (+y).
  const torsoDx = midHip.x - midSh.x;
  const torsoDy = midHip.y - midSh.y;
  if (torsoDy <= 0) return undefined;
  const torsoTiltDeg = Math.abs((Math.atan2(torsoDx, torsoDy) * 180) / Math.PI);

  // Two independent metric anchors.
  const shoulderBreadth = d(P(L_SH), P(R_SH));               // in videoHeight units
  const headWidth = earVis >= V_MIN ? d(P(L_EAR), P(R_EAR)) : 0;
  const anchors: Array<{ mpu: number; w: number }> = [];
  if (shoulderBreadth > 0.03 && shoulderVis >= V_MIN) {
    anchors.push({ mpu: SHOULDER_BREADTH_M / shoulderBreadth, w: shoulderVis });
  }
  if (headWidth > 0.02) {
    anchors.push({ mpu: HEAD_WIDTH_M / headWidth, w: earVis });
  }

  let heightM: number;
  let anchor: BodyMetrics["anchor"];
  let confidence: number;
  let unstable = false;

  if (anchors.length >= 2) {
    // Cross-check: if anchors disagree by >2×, distrust both.
    const [a, b] = anchors;
    const ratio = Math.max(a.mpu, b.mpu) / Math.min(a.mpu, b.mpu);
    const wSum = a.w + b.w;
    const mpu = (a.mpu * a.w + b.mpu * b.w) / wSum;
    heightM = headToAnkle * mpu;
    if (ratio > 2) {
      unstable = true;
      anchor = "unstable";
      confidence = 0.15;
    } else {
      anchor = "shoulder+head";
      // High confidence when anchors agree (ratio→1) and both visible.
      confidence = Math.max(0.35, Math.min(0.9, (1.05 - (ratio - 1)) * 0.55 * ((a.w + b.w) / 2)));
    }
  } else if (anchors.length === 1) {
    heightM = headToAnkle * anchors[0].mpu;
    anchor = shoulderBreadth > 0 ? "shoulder-breadth" : "head-width";
    confidence = 0.4 * anchors[0].w;
  } else {
    heightM = (headToAnkle / 0.85) * 1.70;
    anchor = "frame-fill";
    confidence = 0.2;
  }

  // Verticality gate: >30° from vertical means the "vertical span" isn't vertical.
  if (torsoTiltDeg > 30) {
    unstable = true;
    confidence *= Math.max(0.15, 1 - (torsoTiltDeg - 30) / 45);
  }

  // Physical clamp — humans, not skyscrapers.
  heightM = Math.min(2.3, Math.max(0.6, heightM));

  // Distance from camera via inter-ocular baseline (rough, single-camera).
  let distanceFromCameraM: number | undefined;
  if (
    pts[L_EYE] && pts[R_EYE] &&
    vis(pts[L_EYE]) >= V_MIN && vis(pts[R_EYE]) >= V_MIN &&
    videoWidth > 0
  ) {
    const eyePx = Math.hypot(
      (pts[L_EYE].x - pts[R_EYE].x) * videoWidth,
      (pts[L_EYE].y - pts[R_EYE].y) * videoWidth, // y in same px scale via square
    );
    if (eyePx > 2) {
      const focalPx = (videoWidth / 2) / Math.tan((CAMERA_HFOV_DEG * Math.PI) / 360);
      distanceFromCameraM = (IPD_M * focalPx) / eyePx;
      // Clamp to indoor / short outdoor range.
      distanceFromCameraM = Math.max(0.2, Math.min(20, distanceFromCameraM));
    }
  }

  // Weight from BMI 22 (median healthy adult) with a mild build adjustment
  // from shoulder-to-torso ratio when we have shoulders. Toddlers/children
  // get a softer BMI floor via the smaller height clamp.
  const torsoLen = midHip.y - midSh.y;
  const shoulderToTorso = shoulderBreadth > 0 && torsoLen > 0 ? shoulderBreadth / torsoLen : 1.45;
  const buildAdj = Math.min(1.15, Math.max(0.85, shoulderToTorso / 1.45));
  const weightKg = Math.round(22 * heightM * heightM * buildAdj);

  return {
    heightM: Math.round(heightM * 100) / 100,
    weightKg,
    confidence: Math.max(0, Math.min(1, confidence)),
    anchor,
    distanceFromCameraM: distanceFromCameraM
      ? Math.round(distanceFromCameraM * 10) / 10
      : undefined,
    torsoTiltDeg: Math.round(torsoTiltDeg),
    unstable,
  };
}

/** Wearable-device candidate zones synthesised from body pose landmarks.
 *  Rationale: COCO has no smartwatch/earbud class, and Web Bluetooth cannot
 *  passively see radio. So we mark the pixels where a wearable *would* sit
 *  (wrists, ears) and let the operator tap-to-bond a paired BLE id there. */
function computeWearableZones(
  pts: Array<{ x: number; y: number; v?: number }>,
  aspect: number,
): WearableZone[] {
  const zones: WearableZone[] = [];
  const push = (kind: WearableZoneKind, i: number, refI: number, scale: number) => {
    const p = pts[i], ref = pts[refI];
    if (!p || !ref) return;
    const v = vis(p);
    if (v < 0.4) return;
    // Reticle radius: scaled off the neighbouring segment length so it stays
    // proportional to how big the person is in the frame.
    const seg = Math.hypot((p.x - ref.x) * aspect, p.y - ref.y);
    const r = Math.max(0.015, Math.min(0.08, seg * scale));
    zones.push({ kind, cx: p.x, cy: p.y, r, visibility: v });
  };
  // Wrist zones ~ half the forearm length.
  push("wrist-L", L_WR, L_ELB, 0.45);
  push("wrist-R", R_WR, R_ELB, 0.45);
  // Ear zones ~ a third of the ear-to-nose distance.
  push("ear-L", L_EAR, NOSE, 0.35);
  push("ear-R", R_EAR, NOSE, 0.35);
  return zones;
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
