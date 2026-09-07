// ─────────────────────────────────────────────────────────────────────────────
// asherin.health — visible surface observation.
//
// The honest framing: a camera can see colour, texture, contour, vascular
// pattern, asymmetry and geometry. It cannot see a diagnosis. So this module
// records FEATURES with values, compares each value against that person's own
// earlier values, and reports the CHANGE — because for a person watching their
// own body, deviation from their own baseline carries far more information than
// any single frame compared against a population.
//
// Every observation carries two separate confidences, which are not the same
// thing and collapsing them would be a lie:
//   imageConfidence         — how well the camera could see the feature
//   interpretationConfidence— how much the feature actually means anything
// and a clinicalRelevance flag that decides whether the room says "watch this"
// or "have someone look at this".
// ─────────────────────────────────────────────────────────────────────────────

export type SurfaceModule =
  | "body"
  | "skin"
  | "face"
  | "eyes"
  | "ears"
  | "nose"
  | "mouth"
  | "teeth"
  | "gums"
  | "tongue"
  | "hair"
  | "hands"
  | "feet";

export const SURFACE_MODULES: { id: SurfaceModule; label: string; capture: string; watchFor: string }[] = [
  { id: "body", label: "whole body", capture: "front, both sides, back, even light", watchFor: "posture, symmetry, contour, proportion" },
  { id: "skin", label: "skin", capture: "close, in focus, with a ruler or coin for scale", watchFor: "colour, texture, lesion border and size over time" },
  { id: "face", label: "face", capture: "straight on, neutral expression, no filter", watchFor: "symmetry, swelling, colour, sagging on one side" },
  { id: "eyes", label: "eyes", capture: "both eyes open, lower lid gently pulled down", watchFor: "sclera colour, conjunctival pallor, lid swelling, pupil size" },
  { id: "ears", label: "ears", capture: "each ear from the side and behind", watchFor: "colour, discharge, swelling, skin change on the rim" },
  { id: "nose", label: "nose", capture: "front and each side", watchFor: "shape change, skin texture, persistent redness" },
  { id: "mouth", label: "mouth", capture: "lips relaxed, then open in good light", watchFor: "lip colour, cracking at the corners, sores that do not heal" },
  { id: "teeth", label: "teeth", capture: "smile wide, then bite together", watchFor: "wear, chipping, staining pattern, alignment drift" },
  { id: "gums", label: "gums", capture: "lip lifted, upper and lower", watchFor: "colour, swelling at the margin, recession over months" },
  { id: "tongue", label: "tongue", capture: "tongue out, relaxed, natural light", watchFor: "coating, colour, fissures, edge scalloping, patches" },
  { id: "hair", label: "hair and scalp", capture: "parted at crown and temples", watchFor: "density, part width, scalp visibility, flaking" },
  { id: "hands", label: "hands and nails", capture: "palms then backs, nails flat to camera", watchFor: "nail colour, ridging, lunula, joint contour, swelling" },
  { id: "feet", label: "feet and toenails", capture: "tops, soles, between the toes", watchFor: "nail thickening or colour, skin breaks, swelling, callus pattern" },
];

export type SurfaceFeature =
  | "colour"
  | "texture"
  | "lesion"
  | "vascular"
  | "swelling"
  | "asymmetry"
  | "geometry"
  | "density";

export const FEATURE_LABEL: Record<SurfaceFeature, string> = {
  colour: "colour",
  texture: "texture",
  lesion: "lesion",
  vascular: "vascular pattern",
  swelling: "swelling / contour",
  asymmetry: "asymmetry",
  geometry: "geometry",
  density: "density",
};

export interface SurfaceObservation {
  id: string;
  module: SurfaceModule;
  /** anatomical region in the person's own words, e.g. "left forearm". */
  region: string;
  feature: SurfaceFeature;
  /** normalised 0..1 reading of the feature, so it can be compared to itself over time. */
  value: number;
  /** free text of what was actually seen. never a diagnosis. */
  detail: string;
  imageConfidence: number;
  interpretationConfidence: number;
  /** "routine" | "watch" | "clinician" — the only three actions this room offers. */
  clinicalRelevance: "routine" | "watch" | "clinician";
  capturedAt: string;
  /** stable key for a tracked lesion so its size and border can be followed. */
  lesionKey?: string;
  /** longest visible dimension in millimetres when a scale reference was present. */
  lesionMm?: number;
}

export interface SurfaceDelta {
  observation: SurfaceObservation;
  baseline: number | null;
  change: number | null;
  /** how the change reads in plain language. */
  direction: "new" | "stable" | "increasing" | "decreasing";
  /** true when the change exceeds observation noise. */
  meaningful: boolean;
  priorCount: number;
}

const NOISE = 0.08; // frame-to-frame variation a phone camera produces on its own

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The baseline is the person's own median for that region and feature across
 * everything captured before this observation — not a population norm, and not
 * the single previous frame, which would make lighting noise look like change.
 */
export function baselineFor(
  observations: SurfaceObservation[],
  target: SurfaceObservation,
): { baseline: number | null; priorCount: number } {
  const priors = observations.filter(
    (o) =>
      o.id !== target.id &&
      o.module === target.module &&
      o.region.trim().toLowerCase() === target.region.trim().toLowerCase() &&
      o.feature === target.feature &&
      (target.lesionKey ? o.lesionKey === target.lesionKey : true) &&
      o.capturedAt < target.capturedAt,
  );
  if (priors.length === 0) return { baseline: null, priorCount: 0 };
  return { baseline: median(priors.map((p) => p.value)), priorCount: priors.length };
}

export function surfaceDeltas(observations: SurfaceObservation[]): SurfaceDelta[] {
  const ordered = [...observations].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  return ordered.map((observation) => {
    const { baseline, priorCount } = baselineFor(observations, observation);
    if (baseline === null) {
      return { observation, baseline: null, change: null, direction: "new" as const, meaningful: false, priorCount };
    }
    const change = observation.value - baseline;
    const meaningful = Math.abs(change) > NOISE / Math.max(0.35, observation.imageConfidence);
    return {
      observation,
      baseline,
      change: Math.round(change * 100) / 100,
      direction: !meaningful ? ("stable" as const) : change > 0 ? ("increasing" as const) : ("decreasing" as const),
      meaningful,
      priorCount,
    };
  });
}

/** lesions get their own thread: size and border matter more than a single value. */
export interface LesionTrack {
  lesionKey: string;
  region: string;
  first: SurfaceObservation;
  latest: SurfaceObservation;
  mmChange: number | null;
  days: number;
  /** flagged when a tracked lesion is growing measurably, which is a "have this looked at" signal. */
  growing: boolean;
}

export function lesionTracks(observations: SurfaceObservation[]): LesionTrack[] {
  const groups = new Map<string, SurfaceObservation[]>();
  for (const o of observations) {
    if (!o.lesionKey) continue;
    const list = groups.get(o.lesionKey) ?? [];
    list.push(o);
    groups.set(o.lesionKey, list);
  }
  const out: LesionTrack[] = [];
  groups.forEach((list, lesionKey) => {
    const ordered = list.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    const days = Math.max(0, (Date.parse(latest.capturedAt) - Date.parse(first.capturedAt)) / 86_400_000);
    const mmChange = first.lesionMm && latest.lesionMm ? Math.round((latest.lesionMm - first.lesionMm) * 10) / 10 : null;
    out.push({
      lesionKey,
      region: latest.region,
      first,
      latest,
      mmChange,
      days: Math.round(days),
      growing: mmChange !== null && mmChange >= 1 && days >= 7,
    });
  });
  return out.sort((a, b) => Number(b.growing) - Number(a.growing));
}

/** the room only ever speaks in likelihood, never in diagnosis. */
export function phraseObservation(d: SurfaceDelta): string {
  const o = d.observation;
  if (d.direction === "new") return `${o.detail} — first reading, so there is nothing yet to compare it against.`;
  if (d.direction === "stable") return `${o.detail} — unchanged against your own previous readings.`;
  const word = d.direction === "increasing" ? "more pronounced" : "less pronounced";
  const strength = o.interpretationConfidence > 0.65 ? "clearly" : "possibly";
  return `${o.detail} — ${strength} ${word} than your own baseline across ${d.priorCount} earlier reading${d.priorCount === 1 ? "" : "s"}.`;
}

export const SURFACE_LIMITS = [
  "a photograph carries colour, texture, contour and change over time. it does not carry depth, blood flow, tissue below the surface, or a diagnosis.",
  "camera, lighting and white balance change what a surface looks like far more than most real change does, which is why everything here is read against your own earlier photos rather than against anyone else.",
  "anything that bleeds, will not heal, changes shape or colour quickly, or worries you, goes to a clinician regardless of what this room says.",
];
