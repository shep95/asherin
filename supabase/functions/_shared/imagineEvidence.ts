// IMAGINE INTELLIGENCE — EVIDENCE CONTRACT
//
// The old Imagine engine did one thing: it looked at an image and asserted a
// coordinate. An assertion without cited observables is an impression, not
// intelligence — it cannot be audited, it cannot be falsified, and it degrades
// silently when the model is uncertain.
//
// This contract forces the five-stage discipline:
//   1 STRIP       — hard metadata (client-side EXIF) enters as ground truth.
//   2 READ        — every claim must name the pixels it came from.
//   3 CORRELATE   — observables are bridged to named, checkable referents.
//   4 ADJUDICATE  — ranked hypotheses, each with an explicit falsifier.
//   5 VERIFY      — astronomical + overhead self-consistency, computed server-side.
//
// Silence is not evidence: every stage must emit a finding or an explicit
// "n/a — <reason>".

export interface ExifHint {
  hasExif?: boolean;
  gps?: { latitude: number; longitude: number; altitudeMeters?: number; hPositioningErrorMeters?: number };
  capturedAtLocal?: string;
  capturedAtUtc?: string;
  make?: string;
  model?: string;
  software?: string;
  focalLengthMm?: number;
  orientation?: number;
  notes?: string[];
}

/** Render the STRIP stage into a prompt block the model must reason against. */
export function renderExifBlock(exif?: ExifHint | null): string {
  if (!exif || (!exif.hasExif && !exif.gps)) {
    return `STAGE 1 — STRIP (metadata layer)
n/a — no EXIF container was recoverable from this file. Absence is itself an observable: platform-reuploaded images (social media, messaging apps, screenshots) are stripped, which weakly indicates the image is a re-share rather than an original capture. Do NOT invent metadata.`;
  }
  const lines: string[] = ["STAGE 1 — STRIP (metadata layer, HARD EVIDENCE — outranks any inference you make)"];
  if (exif.gps) {
    lines.push(
      `- GPS FIX PRESENT: ${exif.gps.latitude.toFixed(6)}, ${exif.gps.longitude.toFixed(6)}` +
        (exif.gps.altitudeMeters !== undefined ? ` @ ${exif.gps.altitudeMeters} m` : "") +
        (exif.gps.hPositioningErrorMeters !== undefined ? ` (device-reported ±${exif.gps.hPositioningErrorMeters} m)` : ""),
      `  MANDATE: return this coordinate as estimated_location. Your visual analysis is now a CORROBORATION task — state explicitly whether the scene content agrees with this fix, and if it does NOT, say so loudly (it would indicate a spoofed or transplanted metadata block).`,
    );
  } else {
    lines.push("- No GPS fix in EXIF — the coordinate must be earned from image content.");
  }
  if (exif.capturedAtUtc) lines.push(`- GPS timestamp (UTC): ${exif.capturedAtUtc} — use this for solar geometry, not a guess.`);
  if (exif.capturedAtLocal) lines.push(`- DateTimeOriginal (camera-local): ${exif.capturedAtLocal}`);
  if (exif.make || exif.model) lines.push(`- Capture device: ${[exif.make, exif.model].filter(Boolean).join(" ")}`);
  if (exif.focalLengthMm) lines.push(`- Focal length: ${exif.focalLengthMm} mm — constrains field of view and therefore apparent object scale.`);
  if (exif.software) lines.push(`- Software signature: ${exif.software}`);
  for (const n of exif.notes || []) lines.push(`- Note: ${n}`);
  return lines.join("\n");
}

/** The stages 2-5 protocol appended to the geolocation brain. */
export const IMAGINE_EVIDENCE_PROTOCOL = `
═══════════════════════════════════════════════════════
IMAGINE EVIDENCE PIPELINE — MANDATORY OUTPUT DISCIPLINE
═══════════════════════════════════════════════════════

STAGE 2 — READ (cited observables)
Emit an "observables" array. Each entry is one atomic, checkable thing you can
actually SEE. Rules that make an observable admissible:
 - "where" must locate it in the frame (e.g. "upper-left facade", "foreground kerb").
 - "reading" is the literal perception, transcribed, not interpreted. If it is text,
   transcribe it verbatim including script; mark it [partially legible] when unsure.
 - "inference" is what it implies, stated separately from the reading — never fuse them.
 - "weight" is how much it constrains location: "decisive" (near-unique: a named
   business, a plate format, a monument), "strong", "moderate", "weak".
 - Never list an observable you cannot point at. Never pad the list.
Cover, when present: signage & script, business names, phone/postal formats, licence
plates, road markings & driving side, utility pole and wire style, kerb/gutter/tactile
paving, bollards, hydrants, traffic-signal mounting, roofline & building materials,
window/balcony style, vegetation species & management, terrain and geology, sky and
haze, vehicle makes, street furniture, and any water/coast/rail/air infrastructure.

STAGE 3 — CORRELATE (observable → referent)
Emit "correlations": for the strongest observables, name the specific real-world
referent the observable points at and what it eliminates. Example shape:
{ "observable": "octagonal red stop sign reading ALTO", "referent": "Mexico / Central
America regulatory signage standard", "eliminates": "US (STOP), Spain (STOP), all
right-hand-drive markets", "strength": "strong" }
If an observable points at a searchable string (business name, phone number, plate
serial, street name), put that exact string in "pivot_query" — it is what a human
analyst would type next.

STAGE 4 — ADJUDICATE (ranked, falsifiable hypotheses)
Emit "hypotheses": 2 to 4 ranked candidate locations, most probable first. Each:
 - "label": human place name, most specific you can defend.
 - "latitude"/"longitude": the best point estimate FOR THAT HYPOTHESIS.
 - "probability": INTEGER 0-100. The set must sum to ≤ 100; the remainder is
   "none of the above" and you must leave it if you are genuinely unsure.
 - "supporting_observables": indexes (0-based) into your observables array. An
   hypothesis with zero supporting observables is not permitted.
 - "wrong_if": ONE concrete, checkable statement that would kill this hypothesis
   (e.g. "Wrong if: the kerbside utility poles are concrete rather than creosote wood").
 - "next_check": the single cheapest action that would resolve it (a street-view
   heading, a specific query, a document to pull).
Your top-level estimated_location MUST equal hypothesis[0]'s coordinate, and
confidence_score MUST equal hypothesis[0]'s probability. No divergence.

STAGE 5 — VERIFY (self-consistency)
Emit "self_consistency": project the overhead signature your top hypothesis implies
(road grid orientation, block size, coastline, vegetation) and state whether the
ground image agrees. State any contradiction plainly rather than smoothing it over.
Also supply, inside time_estimation, a "shadow_direction" field: the compass bearing
the shadows FALL TOWARD ("NE", "WSW", or degrees). This is checked against real
solar geometry by a deterministic astronomical calculator after you respond —
a fabricated bearing WILL be caught and will reduce the published confidence.

HONESTY CLAUSE
Confidence is a claim about evidence, not enthusiasm. Fewer than three independent
moderate-or-better observables means confidence_score must not exceed 35, and the
error radius must widen accordingly. If the frame genuinely cannot be placed, say
so via the insufficient_data path — a clean refusal outranks a confident guess.
`;

/** JSON schema fragment appended to the response contract. */
export const IMAGINE_EVIDENCE_SCHEMA = `,
  "observables": [
    { "where": "string", "reading": "string", "inference": "string", "weight": "decisive|strong|moderate|weak" }
  ],
  "correlations": [
    { "observable": "string", "referent": "string", "eliminates": "string", "strength": "decisive|strong|moderate|weak", "pivot_query": "string or null" }
  ],
  "hypotheses": [
    {
      "label": "string",
      "latitude": number,
      "longitude": number,
      "probability": number,
      "supporting_observables": [number],
      "wrong_if": "string",
      "next_check": "string"
    }
  ],
  "self_consistency": "string"`;

export interface ImagineHypothesis {
  label: string;
  latitude: number;
  longitude: number;
  probability: number;
  supporting_observables?: number[];
  wrong_if?: string;
  next_check?: string;
}

/**
 * Post-model integrity pass. The model is capable of contradicting itself
 * (top hypothesis ≠ estimated_location, probabilities summing past 100,
 * confidence inflated past its own evidence). We repair deterministically
 * rather than trusting.
 */
export function reconcileHypotheses(analysis: Record<string, unknown>): string[] {
  const notes: string[] = [];
  const raw = analysis.hypotheses;
  if (!Array.isArray(raw) || raw.length === 0) {
    notes.push("Model returned no ranked hypotheses — adjudication stage degraded to single-point estimate.");
    return notes;
  }

  const hyps = (raw as ImagineHypothesis[])
    .filter(
      (h) =>
        h &&
        Number.isFinite(Number(h.latitude)) &&
        Number.isFinite(Number(h.longitude)) &&
        Math.abs(Number(h.latitude)) <= 90 &&
        Math.abs(Number(h.longitude)) <= 180,
    )
    .map((h) => ({
      ...h,
      latitude: Number(h.latitude),
      longitude: Number(h.longitude),
      probability: Math.max(0, Math.min(100, Math.round(Number(h.probability) || 0))),
    }))
    .sort((a, b) => b.probability - a.probability);

  if (hyps.length === 0) {
    notes.push("All returned hypotheses carried invalid coordinates — discarded.");
    analysis.hypotheses = [];
    return notes;
  }

  const sum = hyps.reduce((s, h) => s + h.probability, 0);
  if (sum > 100) {
    // Normalise rather than drop: the ranking is the signal, the scale is the error.
    const scale = 100 / sum;
    for (const h of hyps) h.probability = Math.round(h.probability * scale);
    notes.push(`Hypothesis probabilities summed to ${sum}% and were renormalised to 100%.`);
  }

  const observableCount = Array.isArray(analysis.observables) ? (analysis.observables as unknown[]).length : 0;
  const strongCount = Array.isArray(analysis.observables)
    ? (analysis.observables as { weight?: string }[]).filter((o) => o?.weight === "decisive" || o?.weight === "strong" || o?.weight === "moderate").length
    : 0;
  if (strongCount < 3 && hyps[0].probability > 35) {
    notes.push(
      `Confidence capped at 35% — only ${strongCount} moderate-or-better observable(s) of ${observableCount} were cited, which cannot support a stronger claim.`,
    );
    hyps[0].probability = 35;
  }

  analysis.hypotheses = hyps;

  const top = hyps[0];
  const loc = analysis.estimated_location as { latitude?: number; longitude?: number } | undefined;
  const drift =
    loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
      ? Math.abs((loc.latitude as number) - top.latitude) + Math.abs((loc.longitude as number) - top.longitude)
      : Infinity;
  if (drift > 0.01) {
    analysis.estimated_location = { latitude: top.latitude, longitude: top.longitude };
    notes.push(`Point estimate realigned to the top-ranked hypothesis ("${top.label}") — the model's headline coordinate disagreed with its own ranking.`);
  }
  if (Number(analysis.confidence_score) !== top.probability) {
    analysis.confidence_score = top.probability;
    notes.push(`Confidence set to the top hypothesis probability (${top.probability}%) to remove headline/ranking divergence.`);
  }

  return notes;
}
