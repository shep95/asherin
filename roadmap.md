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

## consumer dashboard audit — staged repair (2026-09-12)
- [x] stage 1 truth pass: nav regrouped into 7 jobs, asherin.pages merged (page/deck/book), asherin.activity merged (usage + trail), activity free
- [x] stage 3 nav rebuild: pattern-analysis/notebooks now have rows; asherinx.eng row removed (the engine is retired, so its row was a dead click); v2 keep-list includes pages + activity
- [x] stage 4 settings: five lazy tabs (now six with spend), wallpaper charge removed
- [x] subscription verified real (manage card: period end, cancel, resume, billing portal) — not a shell
- [x] stage 5 usage + cost ledger: ai_usage_events + tool_api_switches (owner-only), recorded at the single AI call gate, per-room off switch + monthly budget in settings > spend. money is always an estimate from published list prices, never a bill; tokens shown only when the provider reported them
- [x] stage 6 weak-workflow repairs: /dashboard/stats was silently redirected to chat by an old retired-route list — activity now opens; activity/pages deep links (activity, asherin.activity, ebook, slideshow, pages) all resolve; no paid-copy leftovers remain
- [x] stage 7 signed-in verification: live session, pages tabs (page/deck/book), activity room, settings tabs, spend panel, and a real write/read of the usage ledger + off switch against live data (test rows deleted after)
- [x] database security pass: 111 -> 68 linter items. fixed function search paths, locked 3 internal tables, revoked call access on 30 internal helpers. the remaining 67 are helpers the access rules themselves must call plus pgvector living in public — moving it risks the stored vector columns, so it stays deliberately
- [x] stage 2 remainder: saved code has one home — artifact files save into the same code library the snippets room reads (src/lib/library/snippets.ts, "save to code library" on the artifact surface)
- [x] artifact gaps closed: a follow-up in the same conversation appends a version to the existing session instead of opening a new artifact; gate decisions are now recorded and promoted/candidate patterns stored (verified live: snippet write, two-version lineage, learning event — test rows deleted)

