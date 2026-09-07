// ─────────────────────────────────────────────────────────────────────────────
// body shape — turning the numbers a person typed into a body that actually
// looks like theirs.
//
// The atlas mesh is one fixed adult reference body. Before this file existed,
// typing a height, a waist, or choosing a sex changed the arithmetic panel and
// nothing else: the figure on screen stayed the same stranger. That is a lie of
// omission, because a person reads the picture, not the table.
//
// What this does, honestly:
//   • height scales the figure vertically against the reference stature.
//   • each measured circumference scales the girth of the body AT THAT BAND
//     only, against the circumference a reference body of the same height would
//     carry there. no measurement at a band → that band is left alone (or moved
//     by bmi, if that is all we have).
//   • sex applies the typical proportional differences (pelvis, shoulder, chest,
//     neck) to the same reference mesh.
//
// What this is NOT: a scan, and not a second body. The underlying geometry is a
// male reference dataset, so a female setting reshapes proportions — it does not
// add or remove sex-specific organs. `shapeNotes` says so out loud, and the room
// prints it.
// ─────────────────────────────────────────────────────────────────────────────

import type { BodyMeasurements, BodySolve, Sex } from "./bodyModel";

/** stature of the reference mesh, in cm. */
export const REFERENCE_HEIGHT_CM = 175;

/**
 * circumference each band carries on the reference body, as a fraction of
 * stature. these are proportional anchors, not claims about any one person.
 */
const REF_RATIO = {
  neck: 0.216,
  chest: 0.535,
  waist: 0.47,
  hip: 0.53,
  thigh: 0.31,
} as const;

/** typical proportional difference of a female body at the same stature. */
const FEMALE_FACTOR = {
  neck: 0.92,
  shoulder: 0.94,
  chest: 0.99,
  waist: 0.95,
  hip: 1.07,
  thigh: 1.05,
} as const;

const MALE_FACTOR = {
  neck: 1,
  shoulder: 1,
  chest: 1,
  waist: 1,
  hip: 1,
  thigh: 1,
} as const;

/** bands up the body, as a fraction of standing height from the soles. */
export const SHAPE_BANDS = [
  { key: "ankle", y: 0.04 },
  { key: "calf", y: 0.14 },
  { key: "knee", y: 0.27 },
  { key: "thigh", y: 0.35 },
  { key: "hip", y: 0.5 },
  { key: "waist", y: 0.6 },
  { key: "chest", y: 0.71 },
  { key: "shoulder", y: 0.8 },
  { key: "neck", y: 0.87 },
  { key: "head", y: 0.95 },
] as const;

export type ShapeBandKey = (typeof SHAPE_BANDS)[number]["key"];

export interface BodyShape {
  sex: Sex;
  /** vertical scale of the whole figure against the reference stature. */
  heightScale: number;
  /** girth multiplier per band, in SHAPE_BANDS order. */
  scales: number[];
  /** true when at least one input actually moved the figure. */
  personalised: boolean;
  notes: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * the solve carries estimates with a source; a measured value outranks an
 * estimated one, and an estimate is still better than nothing because it came
 * from the person's own photographs.
 */
function fromSolve(solve: BodySolve | null, key: keyof BodySolve["vector"]): number | null {
  const e = solve?.vector?.[key];
  return e && Number.isFinite(e.value) && e.value > 0 ? e.value : null;
}

export function bodyShape(measurements: BodyMeasurements, solve: BodySolve | null = null): BodyShape {
  const sex: Sex = measurements.sex ?? "unspecified";
  const factor = sex === "female" ? FEMALE_FACTOR : sex === "male" ? MALE_FACTOR : MALE_FACTOR;
  const notes: string[] = [];

  const heightCm = positive(measurements.heightCm) ?? fromSolve(solve, "heightCm");
  const heightScale = heightCm ? clamp(heightCm / REFERENCE_HEIGHT_CM, 0.78, 1.25) : 1;
  if (heightCm && Math.abs(heightScale - 1) > 0.005) {
    notes.push(`stature set from your ${Math.round(heightCm)} cm against a ${REFERENCE_HEIGHT_CM} cm reference body.`);
  }

  // reference stature for the ratios: use the person's own height when known,
  // so a wide waist on a short body reads as wide rather than average.
  const refHeight = heightCm ?? REFERENCE_HEIGHT_CM;

  // bmi is the fallback when no tape has been round anything: it moves the
  // trunk and thighs together rather than pretending to know one band.
  const weightKg = positive(measurements.weightKg);
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;
  const bmiGirth = bmi ? clamp(Math.sqrt(bmi / 22.5), 0.82, 1.3) : null;

  const measured: Partial<Record<ShapeBandKey, number>> = {};
  let personalised = false;

  const band = (key: ShapeBandKey, cm: number | null, refRatio: number, sexFactor: number) => {
    if (cm) {
      const scale = clamp(cm / refHeight / (refRatio * sexFactor), 0.7, 1.45);
      measured[key] = scale;
      personalised = true;
      return;
    }
    // no tape here: sex proportion first, then bmi as a whole-body girth hint.
    measured[key] = clamp(sexFactor * (bmiGirth ?? 1), 0.7, 1.45);
    if (sexFactor !== 1 || bmiGirth) personalised = true;
  };

  const neck = positive(measurements.neckCm) ?? fromSolve(solve, "neckCm");
  const chest = positive(measurements.chestCm) ?? fromSolve(solve, "chestCm");
  const waist = positive(measurements.waistCm) ?? fromSolve(solve, "waistCm");
  const hip = positive(measurements.hipCm) ?? fromSolve(solve, "hipCm");
  const thigh = fromSolve(solve, "thighCm");

  band("neck", neck, REF_RATIO.neck, factor.neck);
  band("chest", chest, REF_RATIO.chest, factor.chest);
  band("waist", waist, REF_RATIO.waist, factor.waist);
  band("hip", hip, REF_RATIO.hip, factor.hip);
  band("thigh", thigh, REF_RATIO.thigh, factor.thigh);
  // the shoulder has no tape field in the room, so it follows the chest with
  // the sex difference applied on top.
  measured.shoulder = clamp((measured.chest ?? 1) * (factor.shoulder / (factor.chest || 1)), 0.7, 1.45);
  // limbs and head follow the trunk gently: a body does not change waist alone.
  const trunk = (measured.waist ?? 1 + (measured.hip ?? 1)) / 2 || 1;
  measured.knee = clamp(1 + ((measured.thigh ?? 1) - 1) * 0.5, 0.8, 1.3);
  measured.calf = clamp(1 + ((measured.thigh ?? 1) - 1) * 0.6, 0.8, 1.3);
  measured.ankle = clamp(1 + ((measured.thigh ?? 1) - 1) * 0.25, 0.85, 1.2);
  measured.head = clamp(1 + (trunk - 1) * 0.12, 0.92, 1.1);

  if (sex === "female") {
    notes.push(
      "female proportions are applied to the reference mesh — pelvis wider, shoulders and neck narrower. the underlying geometry is a male reference dataset, so sex-specific organs are not swapped in; those live in the deep anatomy panel.",
    );
  }
  if (!heightCm && !weightKg && !waist && !chest && !hip && !neck && sex === "unspecified") {
    notes.push("nothing has been measured yet, so this is the reference body, unchanged.");
  } else if (bmiGirth && !waist && !chest && !hip) {
    notes.push("no circumferences yet — trunk girth is following your height and weight, which is a coarse guide.");
  }

  return {
    sex,
    heightScale,
    scales: SHAPE_BANDS.map((b) => clamp(measured[b.key] ?? 1, 0.7, 1.45)),
    personalised: personalised || Math.abs(heightScale - 1) > 0.005,
    notes,
  };
}

/** a stable key so the renderer only re-uploads uniforms when something moved. */
export function shapeKey(shape: BodyShape): string {
  return `${shape.sex}|${shape.heightScale.toFixed(4)}|${shape.scales.map((s) => s.toFixed(4)).join(",")}`;
}
