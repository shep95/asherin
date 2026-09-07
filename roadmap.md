# roadmap

## asherin.health — personal biological intelligence room ($18 tier)

Narrative source: `the_personal_human_atlas` + `the_headphone_brain_system` (user uploads, treated as
data). The atlas is the canvas; the intelligence is the product. Nothing simulated is ever presented
as measured.

### step 1 — base atlas (done)
- BodyParts3D 4.0 male reference, 2,234 meshes / 3,432 concepts / 15 systems.
- 31 binary chunks moved to the Lovable CDN (`src/assets/atlas/*.asset.json`), manifest rewritten to
  CDN urls. No binaries in the repo.
- three.js scene ported to Asherin dark glass: orbit, explode/inventory layout, tap-to-inspect,
  per-part GPU state texture, system layers, isolate, search.

### step 2 — overlay engine
- `overlay.ts`: territory = list of concept-name matchers resolved against the loaded atlas once.
- Every intelligence layer (lab, medication, gene, nutrition, exposure, surgery, family, pain,
  symptom, herb, inflammation, stress, circadian, live signal) emits `AtlasHighlight[]`
  (`{partIds, color, intensity, reason, source}`) which the scene paints on the anatomy.
- Every highlight carries provenance text; nothing lights up without a stated reason.

### step 3 — personal record layers
Labs (paste/enter, reference ranges, direction + severity), medications (target / metabolic / risk
territory + interaction table), genetics (clinically-actionable snps), nutrition patterns,
environmental + occupational exposure, surgical history (absent organ rendering), family history.
Persisted per user in `health_records` with RLS.

### step 4 — pain interview
Spatially anchored marker → character → onset → pattern → modifiers → radiation → associated
symptoms → context. Continuous red-flag monitor. Output package: plain + clinical wording,
territory map, pattern list, questions for the clinician, saved to the timeline.

### step 5 — symptom reverse map, functional overlays
Fatigue-class reverse mapping with weighting from the personal record; inflammation, acute/chronic
stress, circadian hour, aging decade, interdependency network.

### step 6 — herbal layer
Tradition-first database, constituent → mechanism → tissue chains, atlas affinities, and a safety
filter that runs before any recommendation is shown (medication interactions, conditions,
pregnancy). Not bypassable.

### step 7 — live signals (honest)
- Real in a browser: bluetooth heart-rate + rr intervals (hrv rmssd/sdnn, respiratory sinus
  arrhythmia), device motion (postural sway, 8–12 Hz microtremor), ambient sound level.
- Hardware-required and reported as such, never faked: ear eeg, ppg spo2, ear-canal temperature,
  otoacoustic emissions, sleep staging, bruxism.
- Sessions saved to `health_sessions` with computed summary.

### step 8 — timeline + clinical package
Longitudinal record, compare two points, printable clinician document.

### safety law
Observation not diagnosis. No "you have". Every concern states what was observed, what it means
physiologically, and the next step. Red flags direct to care, never diagnose.

Status: complete (see step list; capability states surfaced in-room).

## asherin.arvision — spectral filter (requested 2026-09-07)
Full-screen camera stays the primary surface. A rounded picture-in-picture box in the bottom-left
holds the second view and can be tapped to swap into the full screen. A simple switch toggles the
primary between colour and spectral. The spectral view is the identifying layer: a band-isolating
transform that separates materials by how differently they reflect across the channels the camera
gives us, labelled as spectral filtering rather than as true near-infrared. Detections overlay on
both views, in the same coordinates, so nothing is lost when swapping.
