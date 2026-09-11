# roadmap

## standing instruction
Convert each incoming request into a deep step-by-step plan with human reasoning patterns before building. No questions, no partial builds.

## asherin.health — full narrative parity (in progress)
- [x] health record extended: settings (reference sex, detail level, life phase), snapshots, wearables, live sessions
- [x] A. deep anatomy catalogue: every narrative layer incl. female reproductive + mammary, fascia, meninges/CSF, microcirculation, cavities, autonomic/enteric/cranial nerves, brain/cord functional maps, dermatomes, myotomes, vascular territories, organ zones, immune distribution, embryology, microbiome, aging
- [x] B. intake: genetics files (23andMe/VCF), wearable + CGM + sleep imports, lab document parsing, nutrition/exposure/surgical/family depth
- [x] C. functional layers: inflammation, stress, circadian, posture, interdependency network, symptom reverse-mapping, causal chains, timeline, trajectory, comparison
- [x] D. headphone brain system: real BLE/motion/audio contact only, contact quality, state machine, live + detail views, longitudinal patterns, honest unavailable states
- [x] E. pain interview depth (points, radiation, depth, adaptive questions, red flags, output package), herbal traditions depth + safety cross-check, clinical export package, family atlas
- [x] integration into AsherinHealthView + live browser verification

## asherin.health parity — done 2026-09-07
all twelve panels mounted and verified live: layers, anatomy, body model, record, intake, pain, herbs, systems, over time, live, share, read-out. typecheck clean, 51 vitest cases pass, production build ok.

- [x] functional body maps expanded (dermatomes, myotomes, peripheral nerve, vascular, lymphatic, referred pain, homunculus, brainstem nuclei, organ zones) + tests
- [x] headphone contact quality / baseline / longitudinal patterns: wired into the live panel, tested (86 cases), build ok

## Open
- [x] unify asherin.cyber, extract, briefing, data, snippets, design, slides and ebooks under the cold cinematic room system
- [ ] asherin.arvision thermal camera view: infrared-style heat visualization from camera, honest RGB-derived labeling (not true LWIR; no through-wall/through-glass claims)

- [ ] asherin.arvision: add third mode "eagle.eye" — full behavioral detection engine from arvision-engine-v2.ts (all patterns, no picking), plug-and-play on any device camera

## asherin.health — photo reading + findings tab (requested 2026-09-07)
- [x] body model reacts to measurements + sex (bodyShape.ts, AnatomyScene shape affine)
- [x] upload photos in the health room and have the assistant read them, adjust the view/filters from what it reads (photos tab + photo.read action)
- [x] read-out organised by category/severity, quotable into the room assistant

## asherin.arvision / eagle.eye (requested 2026-09-07)
- [x] eagle.eye gets every filter the optical hud has (spectral added alongside thermal/lowlight/edge)
- [x] object detector boxes drawn in eagle.eye (coco-ssd classes + unattended flag)
- [x] quad view: one square per camera, four renderings at once, any pane taps to full screen
- [x] tile border flashes white/black 5 times and holds until acknowledged when a pattern is captured
- [ ] thermal is a sensor path, not a filter: pick a real thermal video stream when the device exposes one, calibrate raw -> temperature -> palette; visible-light version stays labelled an estimate
- [ ] pop-out gallery rail: every feed/filter/camera live at once, switchable, screenshot on detection

- [x] asherin.health photos: replace or delete an uploaded image and its reading

## asherin.acatalepsy — local deterministic analytics (requested 2026-09-09)
- [ ] public no-login `/asherin.acatalepsy` route with visible wallpaper and privacy exclusions
- [ ] local multi-file/folder/paste/url ingestion queue with honest format validation
- [ ] deterministic domain/rank/visual matching from uploaded architecture specification
- [ ] organized tree, preview/search/statistics, filters, cross-file analysis, downloads and exports
- [ ] advanced SEO, automated tests, and live desktop/mobile workflow verification

- [x] Fix all current preview typecheck errors from observability log

## asherin.software — phase 1 completion (2026-09-11)
- [x] artifact files persisted per artifact (owner scoped, path-normalised, credential-safe)
- [x] code pane: real editing, add/delete, starter page + script, unsaved marker, read-only for viewers
- [x] preview pane: real sandbox execution with live console/error/render observations and stated limits
- [x] html artifacts inline their own scripts/styles (the frame has no file server) and report unloadable references
- [x] test pane: saved checks, dom probes, recorded run history, pass/fail/inconclusive without false passes
- [x] checkpoints carry file contents so a restore brings the work back
- [ ] phase 2: installation/permission UI, settings, update + rollback flows
- [ ] project-wide database security-linter findings (109) still unresolved
