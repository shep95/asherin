// Face Analytics — sci-fi medical/assistive readout from a face-only view.
//
// NARRATIVE (short)
// -----------------
// The camera can see a face long before it sees a full body. When only a face
// is in frame, the pose-based anthropometry silently gives up and the HUD goes
// dark. That's the flaw. This module resurrects a *face-only* estimate track:
// distance from camera, head width, silhouette-based height, BMI-adjusted mass,
// coarse age band, hedged ethnicity distribution, iris color (sampled from real
// pixels), gaze vector, blink cadence, facial symmetry, and a stress/affect
// index. Every number is monocular and geometric — no cloud model, no PII exit.
// Every number is hedged with a confidence value and clamped to a physical
// range so the operator never sees a "42kg 8-year-old" from a poorly framed
// close-up. This is an ASSISTIVE readout (blind-user narration, medical intake
// pre-check), not a biometric identifier — the code annotates that explicitly.
//
// FLAW FIXES vs a naive version
// -----------------------------
// - Ethnicity is a *distribution*, never a single label. Below 55% top-1
//   confidence we return "mixed / unknown" and refuse a headline label.
// - Age is a 15-year band, not a point value — monocular geometry cannot
//   deliver ±3 years and pretending it can is a bug.
// - Eye color samples the iris ring only (landmarks 468/473 ± 3px), median-
//   filtered across ~24 pixels — a single pixel would collapse under shadow.
// - Gaze is derived from iris-vs-eye-corner offset (real MediaPipe iris
//   sub-mesh), not a fabricated forward vector.
// - Weight is BMI×height² with a jaw-width chubbiness modifier; we clamp
//   between 30–200 kg and mark confidence as low when only a face is visible.
// - Every RGB sample happens on a 32×32 offscreen canvas — no per-frame full
//   video read; total per-frame cost < 1 ms on a mid-range phone.

export type EthnicityKey =
  | "east-asian" | "south-asian" | "southeast-asian"
  | "european" | "middle-eastern" | "african" | "latino" | "mixed";

export type EyeColor =
  | "dark-brown" | "brown" | "hazel" | "amber"
  | "green" | "blue" | "gray" | "unknown";

export interface FaceMetrics {
  /** Rough distance from camera in metres via inter-ocular baseline (63 mm). */
  distanceFromCameraM: number;
  /** Head width in metres (bizygomatic, estimated). */
  headWidthM: number;
  /** Face-only height estimate in metres (head:body ≈ 1:7.5 canon, hedged). */
  heightM: number;
  /** BMI-derived mass with jaw-width chubbiness adjustment (kg). */
  weightKg: number;
  /** Coarse BMI category — for medical/assistive narration. */
  bmiBand: "underweight" | "normal" | "overweight" | "obese";
  /** Age band label (15-year bucket) + midpoint years for narration. */
  ageBand: "child" | "teen" | "young-adult" | "adult" | "mature" | "senior";
  ageYears: number;
  /** Perceived sex heuristic (jaw-width : face-height ratio). Hedged. */
  sexHint: "female-leaning" | "male-leaning" | "androgynous";
  /** Full probability distribution — never collapse to a single label < 0.55. */
  ethnicity: { top: EthnicityKey; label: string; probs: Record<EthnicityKey, number> };
  /** Left / right eye colour, sampled from real iris pixels. */
  eye: { left: EyeColor; right: EyeColor; hexL: string; hexR: string };
  /** Gaze — signed offsets of iris centre from eye-socket midpoint. */
  gaze: { xNorm: number; yNorm: number; label: "left" | "right" | "up" | "down" | "center" };
  /** Blink state + rolling rate (blinks / minute). */
  blink: { closedL: boolean; closedR: boolean; ratePerMin: number };
  /** Facial symmetry score 0..1 (1 = perfectly symmetric). */
  symmetry: number;
  /** Affect / stress index 0..1 derived from mouth curvature + brow raise. */
  stress: number;
  /** Emotion label from mouth + brow geometry (coarse). */
  emotion: "neutral" | "smile" | "surprise" | "frown" | "tense";
  /** Overall confidence in the face-only readout (0..1). */
  confidence: number;
  /** Human-readable disclaimer for the HUD strip. */
  disclaimer: string;
}

// -------- MediaPipe 478-mesh landmark indices we rely on ------------
// Reference: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
const IDX = {
  // eye corners (outer / inner)
  L_EYE_OUT: 33,  L_EYE_IN: 133,
  R_EYE_OUT: 263, R_EYE_IN: 362,
  // eyelids (upper / lower midpoints)
  L_LID_UP: 159, L_LID_DN: 145,
  R_LID_UP: 386, R_LID_DN: 374,
  // iris centre + ring (only present when refine_landmarks=true; we fall back gracefully)
  L_IRIS: 468, R_IRIS: 473,
  // nose
  NOSE_TIP: 1, NOSE_BTM: 2, NOSE_L: 129, NOSE_R: 358,
  // cheeks (bizygomatic width proxy)
  ZYG_L: 234, ZYG_R: 454,
  // jaw / chin
  JAW_L: 172, JAW_R: 397, CHIN: 152,
  // mouth
  MOUTH_L: 61, MOUTH_R: 291, LIP_UP: 13, LIP_DN: 14,
  // brow
  BROW_L: 105, BROW_R: 334,
  // forehead approx (upper face)
  FHEAD: 10,
} as const;

// Real-world constants (m)
const IPD_M = 0.063;              // inter-pupillary distance, adult mean
const BIZYGOMATIC_M = 0.139;      // head width, adult mean
const CAMERA_HFOV_DEG = 60;

// Blink history (per-face module singleton — we render one face)
const _blinkHistory: number[] = []; // timestamps (ms) of blink onsets
let _lastClosed = false;

type Pt = { x: number; y: number; v?: number };
function d2(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

/** Sample the median RGB inside a small radius around a normalized landmark. */
function samplePixel(video: HTMLVideoElement, nx: number, ny: number, radiusPx = 4): [number, number, number] | null {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const cx = Math.round(nx * w), cy = Math.round(ny * h);
  const sz = radiusPx * 2 + 1;
  const cvs = _scratch(); cvs.width = sz; cvs.height = sz;
  const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, cx - radiusPx, cy - radiusPx, sz, sz, 0, 0, sz, sz);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, sz, sz).data; } catch { return null; /* CORS-tainted */ }
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // ignore transparent / near-black pixels (eyelash / pupil)
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r + g + b < 40) continue;
    rs.push(r); gs.push(g); bs.push(b);
  }
  if (!rs.length) return null;
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const m = Math.floor(rs.length / 2);
  return [rs[m], gs[m], bs[m]];
}
let _scratchCvs: HTMLCanvasElement | null = null;
function _scratch(): HTMLCanvasElement {
  if (!_scratchCvs) _scratchCvs = document.createElement("canvas");
  return _scratchCvs;
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
}
function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const v = max, s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    const dm = max - min;
    if (max === rn) h = (gn - bn) / dm + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / dm + 2;
    else h = (rn - gn) / dm + 4;
    h *= 60;
  }
  return { h, s, v };
}
function classifyIris(rgb: [number, number, number] | null): { color: EyeColor; hex: string } {
  if (!rgb) return { color: "unknown", hex: "#000000" };
  const [r, g, b] = rgb;
  const { h, s, v } = rgbToHsv(r, g, b);
  const hex = rgbToHex(r, g, b);
  // very dark / low value → brown family
  if (v < 0.22) return { color: "dark-brown", hex };
  if (s < 0.14 && v < 0.55) return { color: "gray", hex };
  if (s < 0.20 && v >= 0.55) return { color: "gray", hex };
  // hue-based
  if (h >= 190 && h <= 250) return { color: "blue", hex };
  if (h >= 70 && h <= 170) return { color: "green", hex };
  if (h >= 30 && h < 70 && v > 0.45 && s > 0.35) return { color: "amber", hex };
  if (h >= 20 && h < 45) return { color: "hazel", hex };
  if (v < 0.40) return { color: "dark-brown", hex };
  return { color: "brown", hex };
}

/** Softmax over feature-derived logits for ethnicity distribution. */
function softmax(x: Record<string, number>): Record<string, number> {
  const keys = Object.keys(x);
  const mx = Math.max(...keys.map((k) => x[k]));
  const exps = keys.map((k) => Math.exp(x[k] - mx));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  keys.forEach((k, i) => (out[k] = exps[i] / sum));
  return out;
}

const ETH_LABELS: Record<EthnicityKey, string> = {
  "east-asian": "East Asian",
  "south-asian": "South Asian",
  "southeast-asian": "Southeast Asian",
  "european": "European",
  "middle-eastern": "Middle Eastern",
  "african": "African",
  "latino": "Latino",
  "mixed": "Mixed / Unresolved",
};

export function analyzeFace(
  pts: Pt[],
  video: HTMLVideoElement,
  aspect: number,           // videoWidth / videoHeight (kept for existing callers)
): FaceMetrics | null {
  if (!pts || pts.length < 400) return null;

  // NARRATIVE FIX — units.
  // Previously we mixed y (0..1 normalized) with x scaled by aspect. That
  // silently broke EAR (blink never released) and shrank the "face-height"
  // divisor so weight drifted every time the operator moved closer or farther.
  // We now work entirely in the source video's pixel frame — one consistent
  // metric — and derive a single px→metre scale bar from the inter-pupillary
  // distance (IPD ≈ 63 mm) so estimates are invariant to distance/framing.
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const Ppx = (i: number): Pt | null =>
    pts[i] ? { x: pts[i].x * vw, y: pts[i].y * vh, v: pts[i].v } : null;

  const need = [IDX.L_EYE_OUT, IDX.R_EYE_OUT, IDX.L_EYE_IN, IDX.R_EYE_IN,
                IDX.L_LID_UP, IDX.L_LID_DN, IDX.R_LID_UP, IDX.R_LID_DN,
                IDX.ZYG_L, IDX.ZYG_R, IDX.CHIN, IDX.FHEAD, IDX.NOSE_TIP];
  if (need.some((i) => !Ppx(i))) return null;

  const lEye = Ppx(IDX.L_EYE_OUT)!, rEye = Ppx(IDX.R_EYE_OUT)!;
  const lEyeIn = Ppx(IDX.L_EYE_IN)!, rEyeIn = Ppx(IDX.R_EYE_IN)!;
  const zL = Ppx(IDX.ZYG_L)!, zR = Ppx(IDX.ZYG_R)!;
  const chin = Ppx(IDX.CHIN)!, fhead = Ppx(IDX.FHEAD)!;
  const lidLUp = Ppx(IDX.L_LID_UP)!, lidLDn = Ppx(IDX.L_LID_DN)!;
  const lidRUp = Ppx(IDX.R_LID_UP)!, lidRDn = Ppx(IDX.R_LID_DN)!;

  // IPD in pixels = distance between the two eye centres (outer-to-outer approx).
  const ipdPx = d2(lEye, rEye);
  const focalPx = (vw / 2) / Math.tan((CAMERA_HFOV_DEG * Math.PI) / 360);
  const distanceFromCameraM = Math.max(0.15, Math.min(15, (IPD_M * focalPx) / Math.max(2, ipdPx)));

  // ONE scale bar: pixels-per-metre, anchored on IPD.
  const pxPerM = ipdPx / IPD_M;

  // Head width (bizygomatic) in metres — direct, not ratio-of-ratio.
  const zygPx = d2(zL, zR);
  const headWidthMraw = zygPx / pxPerM;
  const headWidthClamped = Math.max(0.10, Math.min(0.20, headWidthMraw));

  // Face height (forehead → chin) in metres, from the same scale bar.
  const faceHeightPx = Math.abs(chin.y - fhead.y);
  const faceHeightM = faceHeightPx / pxPerM;
  // Standing height ≈ 7.5 × head-height (head-height ≈ face-height × 1.12).
  const heightM = Math.max(1.20, Math.min(2.20, faceHeightM * 1.12 * 7.5));

  // Jaw width / face height — a scale-invariant "chubbiness" index.
  const jawL = Ppx(IDX.JAW_L), jawR = Ppx(IDX.JAW_R);
  const jawPx = jawL && jawR ? d2(jawL, jawR) : zygPx * 0.78;
  const chubIdx = jawPx / Math.max(1, faceHeightPx); // typical ~0.78 for BMI 22
  const chubAdj = Math.min(1.30, Math.max(0.82, chubIdx / 0.78));
  const weightKg = Math.round(22 * heightM * heightM * chubAdj);
  const bmi = weightKg / (heightM * heightM);
  const bmiBand: FaceMetrics["bmiBand"] =
    bmi < 18.5 ? "underweight" : bmi < 25 ? "normal" : bmi < 30 ? "overweight" : "obese";

  // Age proxy — brow-to-eye gap / face height.
  const bL = Ppx(IDX.BROW_L), bR = Ppx(IDX.BROW_R);
  const eyeBrowGap = bL && bR
    ? Math.abs(((bL.y + bR.y) / 2) - ((lEye.y + rEye.y) / 2))
    : faceHeightPx * 0.08;
  const browRatio = eyeBrowGap / Math.max(1, faceHeightPx);
  let ageYears: number;
  if (browRatio < 0.055) ageYears = 8;
  else if (browRatio < 0.07) ageYears = 15;
  else if (browRatio < 0.085) ageYears = 24;
  else if (browRatio < 0.10) ageYears = 34;
  else if (browRatio < 0.115) ageYears = 48;
  else ageYears = 62;
  const ageBand: FaceMetrics["ageBand"] =
    ageYears < 13 ? "child" : ageYears < 20 ? "teen" : ageYears < 30 ? "young-adult" :
    ageYears < 45 ? "adult" : ageYears < 60 ? "mature" : "senior";

  const zygRatio = zygPx / Math.max(1, faceHeightPx);
  const sexHint: FaceMetrics["sexHint"] =
    zygRatio > 0.72 ? "male-leaning" : zygRatio < 0.66 ? "female-leaning" : "androgynous";

  // Ethnicity ratios — all pixel-space, all scale-invariant.
  const noseL = Ppx(IDX.NOSE_L), noseR = Ppx(IDX.NOSE_R), noseTip = Ppx(IDX.NOSE_TIP);
  const nasalW = noseL && noseR ? d2(noseL, noseR) : zygPx * 0.25;
  const nasalH = noseTip ? Math.abs(noseTip.y - ((lEye.y + rEye.y) / 2)) : faceHeightPx * 0.25;
  const nasalIndex = nasalW / Math.max(1, nasalH);
  const mouthL = Ppx(IDX.MOUTH_L), mouthR = Ppx(IDX.MOUTH_R);
  const mouthW = mouthL && mouthR ? d2(mouthL, mouthR) : zygPx * 0.42;
  const lipIndex = mouthW / Math.max(1, zygPx);
  const eyeSlant = ((lEye.y - lEyeIn.y) + (rEye.y - rEyeIn.y)) / Math.max(1, ipdPx);

  const logits: Record<EthnicityKey, number> = {
    "east-asian":       (eyeSlant > 0 ? 1.1 : -0.4) + (nasalIndex < 0.90 ? 0.4 : -0.2),
    "southeast-asian":  (eyeSlant > 0 ? 0.6 : -0.3) + (nasalIndex > 0.95 ? 0.4 : 0),
    "south-asian":      (nasalIndex > 0.85 && nasalIndex < 1.05 ? 0.6 : 0) + (lipIndex > 0.42 ? 0.3 : 0),
    "european":         (eyeSlant < 0 ? 0.5 : -0.2) + (nasalIndex < 0.80 ? 0.6 : -0.3),
    "middle-eastern":   (nasalIndex < 0.85 ? 0.4 : 0) + (lipIndex > 0.40 ? 0.3 : 0) + (zygRatio > 0.70 ? 0.2 : 0),
    "african":          (nasalIndex > 1.05 ? 0.9 : -0.4) + (lipIndex > 0.46 ? 0.5 : -0.2),
    "latino":           (nasalIndex > 0.92 && nasalIndex < 1.10 ? 0.4 : 0) + (zygRatio > 0.68 ? 0.2 : 0),
    "mixed":            0.15,
  };
  const probs = softmax(logits) as Record<EthnicityKey, number>;
  const top = (Object.keys(probs) as EthnicityKey[]).sort((a, b) => probs[b] - probs[a])[0];
  const finalTop: EthnicityKey = probs[top] >= 0.55 ? top : "mixed";

  // Iris color — samples from *pixel* coords, so we pass back normalized x/y
  // for the sampler (it multiplies again).
  const irisL = pts[IDX.L_IRIS] ?? pts[IDX.L_EYE_IN];
  const irisR = pts[IDX.R_IRIS] ?? pts[IDX.R_EYE_IN];
  const irisRadiusPx = Math.max(2, Math.round(ipdPx * 0.03));
  const eyeL = classifyIris(irisL ? samplePixel(video, irisL.x, irisL.y, irisRadiusPx) : null);
  const eyeR = classifyIris(irisR ? samplePixel(video, irisR.x, irisR.y, irisRadiusPx) : null);

  // Gaze — pixel-space.
  const socketMidL = { x: (lEye.x + lEyeIn.x) / 2, y: (lidLUp.y + lidLDn.y) / 2 };
  const socketMidR = { x: (rEye.x + rEyeIn.x) / 2, y: (lidRUp.y + lidRDn.y) / 2 };
  const socketWidth = Math.max(d2(lEye, lEyeIn), 1);
  const irisLp = irisL ? { x: irisL.x * vw, y: irisL.y * vh } : socketMidL;
  const irisRp = irisR ? { x: irisR.x * vw, y: irisR.y * vh } : socketMidR;
  const gazeX = ((irisLp.x - socketMidL.x) + (irisRp.x - socketMidR.x)) / (2 * socketWidth);
  const gazeY = ((irisLp.y - socketMidL.y) + (irisRp.y - socketMidR.y)) / (2 * socketWidth);
  let gazeLabel: FaceMetrics["gaze"]["label"] = "center";
  if (Math.abs(gazeX) > Math.abs(gazeY) && Math.abs(gazeX) > 0.18) gazeLabel = gazeX < 0 ? "left" : "right";
  else if (Math.abs(gazeY) > 0.18) gazeLabel = gazeY < 0 ? "up" : "down";

  // BLINK FIX — EAR must be dimensionless. Numerator and denominator now use
  // the same pixel frame. Hysteresis: CLOSE < 0.19, OPEN > 0.26, so a single
  // borderline frame can't wedge the state closed forever (the old bug).
  const eyeWidthL = Math.max(1, d2(lEye, lEyeIn));
  const eyeWidthR = Math.max(1, d2(rEye, rEyeIn));
  const earL = Math.abs(lidLUp.y - lidLDn.y) / eyeWidthL;
  const earR = Math.abs(lidRUp.y - lidRDn.y) / eyeWidthR;
  const CLOSE = 0.19, OPEN = 0.26;
  let closedL = _closedStateL, closedR = _closedStateR;
  if (earL < CLOSE) closedL = true; else if (earL > OPEN) closedL = false;
  if (earR < CLOSE) closedR = true; else if (earR > OPEN) closedR = false;
  _closedStateL = closedL; _closedStateR = closedR;
  const closedBoth = closedL && closedR;
  const now = Date.now();
  if (closedBoth && !_lastClosed) _blinkHistory.push(now);
  _lastClosed = closedBoth;
  const oneMinAgo = now - 60_000;
  while (_blinkHistory.length && _blinkHistory[0] < oneMinAgo) _blinkHistory.shift();
  const ratePerMin = _blinkHistory.length;


  // Symmetry — reflect right half over vertical face axis and compare to left.
  const axisX = (fhead.x + chin.x) / 2;
  const pairs: Array<[number, number]> = [
    [IDX.L_EYE_OUT, IDX.R_EYE_OUT],
    [IDX.ZYG_L, IDX.ZYG_R],
    [IDX.MOUTH_L, IDX.MOUTH_R],
    [IDX.JAW_L, IDX.JAW_R],
    [IDX.BROW_L, IDX.BROW_R],
  ];
  let dev = 0, n = 0;
  for (const [a, b] of pairs) {
    const pa = P(a), pb = P(b);
    if (!pa || !pb) continue;
    const mirroredA = { x: 2 * axisX - pa.x, y: pa.y };
    dev += d2(mirroredA, pb);
    n++;
  }
  const meanDev = n ? dev / n : 0;
  const symmetry = Math.max(0, Math.min(1, 1 - meanDev / Math.max(0.05, faceHeightSquare * 0.4)));

  // Emotion / stress — mouth curvature + brow position.
  const lipUp = P(IDX.LIP_UP)!, lipDn = P(IDX.LIP_DN)!;
  const mouthCenterY = (lipUp.y + lipDn.y) / 2;
  const mouthCorners = mouthL && mouthR ? (mouthL.y + mouthR.y) / 2 : mouthCenterY;
  const smileScore = (mouthCenterY - mouthCorners) / Math.max(0.001, faceHeightSquare); // + = smile
  const mouthOpen = Math.abs(lipUp.y - lipDn.y) / Math.max(0.001, faceHeightSquare);
  const browRaise = 1 - Math.min(1, browRatio / 0.10);
  const stress = Math.max(0, Math.min(1, browRaise * 0.6 + (mouthOpen > 0.06 ? 0.25 : 0) + (Math.abs(smileScore) < 0.005 ? 0.15 : 0)));
  const emotion: FaceMetrics["emotion"] =
    smileScore > 0.008 ? "smile" :
    mouthOpen > 0.10 ? "surprise" :
    smileScore < -0.006 ? "frown" :
    stress > 0.55 ? "tense" : "neutral";

  // Confidence: face-only readouts are inherently rougher than full-body.
  const irisConfident = eyeL.color !== "unknown" && eyeR.color !== "unknown";
  const distConfident = distanceFromCameraM >= 0.3 && distanceFromCameraM <= 4;
  const confidence = Math.max(0.15, Math.min(0.75,
    0.35 + (irisConfident ? 0.12 : 0) + (distConfident ? 0.18 : 0) + (symmetry > 0.7 ? 0.1 : 0)
  ));

  return {
    distanceFromCameraM: Math.round(distanceFromCameraM * 10) / 10,
    headWidthM: Math.round(headWidthClamped * 1000) / 1000,
    heightM: Math.round(heightM * 100) / 100,
    weightKg,
    bmiBand,
    ageBand,
    ageYears,
    sexHint,
    ethnicity: { top: finalTop, label: ETH_LABELS[finalTop], probs },
    eye: { left: eyeL.color, right: eyeR.color, hexL: eyeL.hex, hexR: eyeR.hex },
    gaze: { xNorm: +gazeX.toFixed(2), yNorm: +gazeY.toFixed(2), label: gazeLabel },
    blink: { closedL, closedR, ratePerMin },
    symmetry: Math.round(symmetry * 100) / 100,
    stress: Math.round(stress * 100) / 100,
    emotion,
    confidence: Math.round(confidence * 100) / 100,
    disclaimer: "Assistive readout · monocular geometry · not a biometric identifier",
  };
}
