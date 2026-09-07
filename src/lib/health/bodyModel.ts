// ─────────────────────────────────────────────────────────────────────────────
// asherin.health — body modelling subsystem.
//
// This is not "upload a photo and get a number". Photographs give shape ratios,
// not scale; a tape measure gives scale, not shape. So the pipeline treats them
// as two different classes of evidence and never lets the weaker one overwrite
// the stronger one:
//
//   capture  → four guided views (front, left, right, back)
//   normalise→ same pixel scale, upright, subject height spans a known fraction
//   landmark → shoulder / chest / waist / hip / thigh / neck bands per view
//   geometry → front width + side depth per band → elliptical cross-section
//   scale    → measured height converts pixels to centimetres
//   fuse     → any measured circumference REPLACES the image estimate and is
//              marked as measured; image values stay as estimates with a band
//   track    → every solve is a snapshot; change is read across snapshots
//
// Everything leaves here with a confidence interval and the reason the interval
// is that wide. Nothing here is a diagnosis and nothing here is presented as
// clinical measurement.
// ─────────────────────────────────────────────────────────────────────────────

export type BodyView = "front" | "left" | "right" | "back";

export const BODY_VIEWS: { id: BodyView; label: string; guidance: string }[] = [
  { id: "front", label: "front", guidance: "face the camera, arms slightly away from the body, feet a hand apart." },
  { id: "left", label: "left side", guidance: "turn a quarter left, arms hanging naturally, stand tall." },
  { id: "right", label: "right side", guidance: "turn a quarter right, same distance from the camera." },
  { id: "back", label: "back", guidance: "face away, same posture, heels level." },
];

export interface CapturedView {
  view: BodyView;
  /** data url held on this device only. */
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
}

export type Sex = "female" | "male" | "unspecified";

export interface BodyMeasurements {
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: Sex;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  neckCm?: number;
}

/** one horizontal band read off a view, in fractions of subject height (0 = crown). */
export interface BandWidth {
  band: BodyBand;
  /** width across the silhouette at that band, as a fraction of subject height. */
  widthFraction: number;
  confidence: number;
}

export type BodyBand = "neck" | "shoulder" | "chest" | "waist" | "hip" | "thigh" | "calf" | "upperArm";

export const BANDS: { id: BodyBand; label: string; heightFraction: number }[] = [
  { id: "neck", label: "neck", heightFraction: 0.13 },
  { id: "shoulder", label: "shoulders", heightFraction: 0.19 },
  { id: "chest", label: "chest", heightFraction: 0.27 },
  { id: "waist", label: "waist", heightFraction: 0.39 },
  { id: "hip", label: "hips", heightFraction: 0.48 },
  { id: "thigh", label: "thigh", heightFraction: 0.6 },
  { id: "calf", label: "calf", heightFraction: 0.82 },
  { id: "upperArm", label: "upper arm", heightFraction: 0.29 },
];

export interface ViewAnalysis {
  view: BodyView;
  /** vertical fraction of the frame occupied by the subject; scale sanity check. */
  subjectFrameFraction: number;
  bands: BandWidth[];
  posture: { note: string; confidence: number }[];
  quality: { lighting: number; pose: number; clothing: number; framing: number };
}

export type EstimateSource = "measured" | "image" | "population";

export interface Estimate {
  value: number;
  low: number;
  high: number;
  source: EstimateSource;
  confidence: number;
}

export interface BodyStateVector {
  heightCm: Estimate | null;
  weightKg: Estimate | null;
  neckCm: Estimate | null;
  shoulderCm: Estimate | null;
  chestCm: Estimate | null;
  waistCm: Estimate | null;
  hipCm: Estimate | null;
  thighCm: Estimate | null;
  bmi: Estimate | null;
  waistToHip: Estimate | null;
  waistToHeight: Estimate | null;
  bodyFatPercent: Estimate | null;
}

export interface BodySolve {
  id: string;
  solvedAt: string;
  views: BodyView[];
  measurements: BodyMeasurements;
  vector: BodyStateVector;
  /** plain-language reasons the intervals are as wide as they are. */
  uncertainty: string[];
  /** scale factor: centimetres per unit of subject height fraction. */
  scaleCmPerFraction: number | null;
}

export interface BodyModelState {
  captures: CapturedView[];
  measurements: BodyMeasurements;
  analyses: ViewAnalysis[];
  solves: BodySolve[];
}

export const EMPTY_BODY_MODEL: BodyModelState = { captures: [], measurements: {}, analyses: [], solves: [] };

// ── geometry ────────────────────────────────────────────────────────────────

/** Ramanujan's second approximation — accurate to ~1e-5 for human aspect ratios. */
export function ellipseCircumference(semiA: number, semiB: number): number {
  const a = Math.max(semiA, 1e-6);
  const b = Math.max(semiB, 1e-6);
  const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * A torso band is not an ellipse and pretending otherwise is the single largest
 * error in photo anthropometry. Empirically the elliptical value under-reads the
 * true tape circumference at soft bands (waist, hip) and over-reads at bony ones
 * (shoulder). These correction factors carry that, and the interval below carries
 * the fact that they are corrections rather than truth.
 */
const BAND_CORRECTION: Record<BodyBand, number> = {
  neck: 1.02,
  shoulder: 0.94,
  chest: 1.03,
  waist: 1.06,
  hip: 1.04,
  thigh: 1.03,
  calf: 1.02,
  upperArm: 1.02,
};

export function bandCircumferenceCm(
  band: BodyBand,
  frontWidthFraction: number,
  sideDepthFraction: number,
  heightCm: number,
): number {
  const widthCm = frontWidthFraction * heightCm;
  const depthCm = sideDepthFraction * heightCm;
  return ellipseCircumference(widthCm / 2, depthCm / 2) * BAND_CORRECTION[band];
}

function interval(value: number, relative: number, source: EstimateSource, confidence: number): Estimate {
  return {
    value: round(value, 1),
    low: round(value * (1 - relative), 1),
    high: round(value * (1 + relative), 1),
    source,
    confidence: clamp01(confidence),
  };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function bandOf(analysis: ViewAnalysis | undefined, band: BodyBand): BandWidth | undefined {
  return analysis?.bands.find((b) => b.band === band);
}

/**
 * US Navy circumference method. It is a population regression, not a measurement,
 * so it is only ever emitted with a wide band and the reason attached.
 */
function navyBodyFat(sex: Sex, heightCm: number, neck: number, waist: number, hip: number | null): number | null {
  if (!(heightCm > 0) || !(neck > 0) || !(waist > 0)) return null;
  if (sex === "male") {
    const v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
    return Number.isFinite(v) ? v : null;
  }
  if (sex === "female") {
    if (!hip) return null;
    const v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// ── the solve ───────────────────────────────────────────────────────────────

export function solveBodyModel(
  analyses: ViewAnalysis[],
  measurements: BodyMeasurements,
  id: string,
): BodySolve {
  const front = analyses.find((a) => a.view === "front");
  const back = analyses.find((a) => a.view === "back");
  const sides = analyses.filter((a) => a.view === "left" || a.view === "right");
  const uncertainty: string[] = [];

  const heightCm = measurements.heightCm && measurements.heightCm > 80 && measurements.heightCm < 250 ? measurements.heightCm : null;
  if (!heightCm) uncertainty.push("no height was entered, so every circumference below is a proportion rather than a size in centimetres.");
  if (!front) uncertainty.push("no front view was captured, so widths could not be read at all.");
  if (sides.length === 0) uncertainty.push("no side view was captured, so depth is assumed from population proportion instead of measured.");
  if (!back) uncertainty.push("no back view was captured, so left/right symmetry is read from one side only.");

  const quality = analyses.map((a) => a.quality);
  const avg = (pick: (q: ViewAnalysis["quality"]) => number) =>
    quality.length ? quality.reduce((s, q) => s + pick(q), 0) / quality.length : 0;
  const lighting = avg((q) => q.lighting);
  const pose = avg((q) => q.pose);
  const clothing = avg((q) => q.clothing);
  const framing = avg((q) => q.framing);
  if (analyses.length && lighting < 0.55) uncertainty.push("the lighting is uneven, which blurs the silhouette edge and widens every width estimate.");
  if (analyses.length && pose < 0.55) uncertainty.push("the posture varies between views, so bands may not line up at the same anatomical level.");
  if (analyses.length && clothing < 0.55) uncertainty.push("loose clothing hides the true outline; measured values will be much stronger than these.");
  if (analyses.length && framing < 0.55) uncertainty.push("the subject does not fill the frame consistently, so scale differs between views.");

  const evidence = clamp01((analyses.length / 4) * 0.5 + (lighting + pose + clothing + framing) / 8);
  const relative = 0.16 - 0.09 * evidence; // 16% down to ~7% as evidence improves

  const circumference = (band: BodyBand, measured?: number): Estimate | null => {
    if (measured && measured > 10) return interval(measured, 0.01, "measured", 0.97);
    if (!heightCm) return null;
    const f = bandOf(front, band);
    if (!f) return null;
    const depths = sides.map((s) => bandOf(s, band)?.widthFraction).filter((d): d is number => typeof d === "number");
    // Without a side view, human torso bands run roughly 0.68× as deep as wide.
    const depth = depths.length ? depths.reduce((s, d) => s + d, 0) / depths.length : f.widthFraction * 0.68;
    const value = bandCircumferenceCm(band, f.widthFraction, depth, heightCm);
    const conf = clamp01(f.confidence * (depths.length ? 1 : 0.7) * (0.5 + evidence / 2));
    return interval(value, depths.length ? relative : relative + 0.06, "image", conf);
  };

  const neck = circumference("neck", measurements.neckCm);
  const shoulder = circumference("shoulder");
  const chest = circumference("chest", measurements.chestCm);
  const waist = circumference("waist", measurements.waistCm);
  const hip = circumference("hip", measurements.hipCm);
  const thigh = circumference("thigh");

  const height = heightCm ? interval(heightCm, 0.005, "measured", 0.98) : null;
  const weight = measurements.weightKg && measurements.weightKg > 20 ? interval(measurements.weightKg, 0.005, "measured", 0.98) : null;

  const bmi =
    height && weight ? interval(weight.value / Math.pow(height.value / 100, 2), 0.02, "measured", 0.95) : null;
  const whr = waist && hip ? interval(waist.value / hip.value, relative * 0.9, waist.source === "measured" && hip.source === "measured" ? "measured" : "image", Math.min(waist.confidence, hip.confidence)) : null;
  const wht = waist && height ? interval(waist.value / height.value, relative * 0.9, waist.source === "measured" ? "measured" : "image", waist.confidence) : null;

  const sex = measurements.sex ?? "unspecified";
  let fat: Estimate | null = null;
  if (height && neck && waist) {
    const v = navyBodyFat(sex, height.value, neck.value, waist.value, hip?.value ?? null);
    if (v !== null && v > 2 && v < 70) {
      const measuredInputs = neck.source === "measured" && waist.source === "measured" && (sex !== "female" || hip?.source === "measured");
      fat = interval(v, measuredInputs ? 0.12 : 0.2, measuredInputs ? "measured" : "image", measuredInputs ? 0.6 : 0.35);
      uncertainty.push(
        "body fat here comes from a population circumference regression, not from a scan. it moves usefully over time for one person, and should not be compared against someone else's scan.",
      );
    }
  } else if (sex === "unspecified" && height && neck && waist) {
    uncertainty.push("sex was left unspecified, so the body fat regression — which is sex-specific — was not run.");
  }

  return {
    id,
    solvedAt: new Date().toISOString(),
    views: analyses.map((a) => a.view),
    measurements,
    vector: {
      heightCm: height,
      weightKg: weight,
      neckCm: neck,
      shoulderCm: shoulder,
      chestCm: chest,
      waistCm: waist,
      hipCm: hip,
      thighCm: thigh,
      bmi,
      waistToHip: whr,
      waistToHeight: wht,
      bodyFatPercent: fat,
    },
    uncertainty,
    scaleCmPerFraction: heightCm,
  };
}

// ── longitudinal reading ────────────────────────────────────────────────────

export interface BodyTrend {
  key: keyof BodyStateVector;
  label: string;
  from: number;
  to: number;
  deltaPerWeek: number;
  days: number;
  /** true when the change is larger than the combined uncertainty of both solves. */
  meaningful: boolean;
}

const VECTOR_LABEL: Record<keyof BodyStateVector, string> = {
  heightCm: "height",
  weightKg: "weight",
  neckCm: "neck",
  shoulderCm: "shoulders",
  chestCm: "chest",
  waistCm: "waist",
  hipCm: "hips",
  thighCm: "thigh",
  bmi: "bmi",
  waistToHip: "waist to hip",
  waistToHeight: "waist to height",
  bodyFatPercent: "body fat",
};

export function bodyTrends(solves: BodySolve[]): BodyTrend[] {
  if (solves.length < 2) return [];
  const ordered = [...solves].sort((a, b) => a.solvedAt.localeCompare(b.solvedAt));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const days = Math.max(0.5, (Date.parse(last.solvedAt) - Date.parse(first.solvedAt)) / 86_400_000);
  const out: BodyTrend[] = [];
  (Object.keys(VECTOR_LABEL) as (keyof BodyStateVector)[]).forEach((key) => {
    const a = first.vector[key];
    const b = last.vector[key];
    if (!a || !b) return;
    const delta = b.value - a.value;
    const noise = (a.high - a.low) / 2 + (b.high - b.low) / 2;
    out.push({
      key,
      label: VECTOR_LABEL[key],
      from: a.value,
      to: b.value,
      deltaPerWeek: round((delta / days) * 7, 2),
      days: Math.round(days),
      meaningful: Math.abs(delta) > noise,
    });
  });
  return out.sort((x, y) => Number(y.meaningful) - Number(x.meaningful) || Math.abs(y.deltaPerWeek) - Math.abs(x.deltaPerWeek));
}

export function describeEstimate(e: Estimate | null, unit: string): string {
  if (!e) return "—";
  const band = e.source === "measured" ? "" : ` (${e.low}–${e.high})`;
  return `${e.value}${unit}${band}`;
}
