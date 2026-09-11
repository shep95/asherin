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

## asherin.software — phase 2 completion (2026-09-11)
- [x] workspace modes as real routes (/dashboard/software/:artifactId/:mode) with preserved state, no reload
- [x] top bar: editable name, lifecycle, version, save state, save/checkpoint/run
- [x] monaco code surface: file tree, tabs, dirty markers, search/replace, selection capture, ctrl+s
- [x] file model: create/rename/move/duplicate/soft-delete/restore, path traversal blocked, origin tracked
- [x] drafts persisted (owner-scoped) with unsaved-work protection
- [x] ai panel: bounded artifact context, change proposal + diff before applying, no chain-of-thought
- [x] ai vs manual conflict detection with keep mine / apply / compare
- [x] preview mode: sandboxed run, network denied, real console/render/error observations
- [x] test mode: run all / rerun failed / run selected, results tied to a version
- [x] console drawer merges real sandbox observations with workspace actions
- [x] data + settings + history modes with truthful unavailable states; restore is forward-only
- [x] verified live: created artifact, edited files, ran sandbox, passed/failed real checks, checkpoint, compare, restore, delete
- [ ] phase 3: installation/permissions, adversarial testing, rollback automation
- [ ] project-wide database security-linter findings (109) still unresolved

## Phase 3 — real software builder + runtime adapter (complete)
- runtime providers: browser sandbox available; isolated server, full build and native declared unavailable with reasons.
- dependency detection + honest verdict (no silent installs), install preflight gating the install button.
- patch/merge model with stale-base detection; AI edits can be applied, kept, or merged with conflict markers, and are recorded as auditable actions with diff counts.
- affected-test selection, run provider/scope/timings, run comparison, scoped repair plans that widen on repeat failure and are never applied automatically.
- artifact-owned data store with contract validation; named checkpoints shown in history.
- chat turns can be kept as a persistent application that opens in the same workspace.
- verified live: sandbox rendered, checks passed and failed truthfully, repair widened, checkpoint stored, install blocked with reason. 63 software tests, typecheck and production build pass.
- runtime provider lifecycle formalised: prepare/build/start/stop/collectObservations/getLogs/health, driven through a controller; the run button now goes through the provider and shows live health.
- build provider boundary added (static assembly available; package/compile and server build declared configuration required) with a per-capability matrix in Build.
- model changes can be undone one at a time from the asherin panel, recorded as the person's own action.

## Phase 4 — installation + custom sidebar apps (complete)
- navigation registry: `src/lib/software/navigation.ts` (identity routes, sections, ordering, launch state, permission delta, removal semantics, data namespaces)
- schema: `software_navigation_item.installation_id` + `section`
- staged "add to asherin" flow: `InstallDialog.tsx` (preflight → identity → permissions → data → location → confirm), blocked on any unmet preflight item
- installed app host: `InstalledAppHost.tsx` — asherin shell, error boundary, runtime provider sandbox, health/activity, rename, sidebar controls, five removal actions with typed confirmation for destructive ones
- sidebar consumes the registry ("your apps" / "shared with you"); route `/dashboard/app/:artifactId`
- tests: `src/test/softwareInstallation.test.ts` (17). all software tests: 88 passing. typecheck + build clean.
- verified live: create → files → check run passes → preflight eligible → staged install → app runs in sandbox ("hello") → rename to "Stock Room" keeps route/identity → delete app + data with typed confirmation.

## Phase 5 — integrations, mcp servers, secure capabilities (complete)
- owner-scoped `software_integration`, `software_integration_grant`, `software_integration_event` with rls, grants, triggers; credential references only (uppercase secret names), never key values.
- `src/lib/software/integrations.ts`: endpoint validation (https-only, loopback/private/link-local/metadata blocked), credential-ref validation, scope/tool authorization, rate ceilings, permission diffs, audit redaction, untrusted-result wrapping.
- `supabase/functions/software-integration-gateway`: jwt owner auth, ownership checks, secret resolution by name, 15s abort, 512kb cap, redirects rejected, real health check, mcp tools/list discovery, granular operation + tool authorization, write confirmation, redacted audit.
- ui: `/dashboard/integrations` connections health center (add, test, operations editor, mcp tool discovery, disable/revoke/delete, activity) and `ArtifactIntegrationsPane` in app settings + installed app host.
- verified live: private endpoint rejected; open-meteo health 200 in 134ms; granted call returned real weather marked untrusted; ungranted operation denied; revoked connection blocked; missing secret reported as unavailable rather than faked. probe rows deleted.
- tests: `src/test/softwareIntegrations.test.ts` (19). all software tests 107 pass, typecheck and build clean.
