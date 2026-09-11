# Universal artifact runtime + adaptive pattern learning

Asherin chat can already answer, plan a workspace, and learn scoped patterns. What it cannot do is produce a **concrete inspectable result** that is built, run or rendered, observed, validated against a stated contract, repaired, versioned, and then fed back into pattern learning. This adds that as a new lane inside the existing loop — not a new app, not an IDE.

The snake game is one scenario. The runtime is modality-independent: web artifacts, documents, data views, research outputs, designs, image workflows, simulations, plans, workflows.

## What already exists and gets reused (not rebuilt)

| Existing | Reused as |
|---|---|
| `src/lib/intelligence/orchestrator.ts` (`prepareTurn` / `completeTurn`) | the loop the artifact lane hangs off — no second orchestrator |
| `contextResolver.ts`, `intentRouter.ts`, `taskFrame.ts` | context + intent; artifact intent is a new route, not a new router |
| `store.ts`, `patternLifecycle.ts`, `learningGate.ts`, `creator.ts`, `forge.ts`, `governance.ts` | pattern registry, gate, adaptive creator, transfer — untouched |
| `validator.ts` | base checks; artifact validator extends it, does not replace it |
| `src/lib/workspace/*` (planner, orchestrator, state, types, `useChatWorkspace`) | artifact becomes a **new surface kind and lane** in the same plan |
| `WorkspacePanel.tsx` and siblings | artifact panel renders inside the same panel, same visual system |
| `ide/IdePreviewPanel.tsx` (babel + `srcDoc` sandboxed iframe) | the browser execution environment; extracted, not duplicated |
| `_shared/artifactLedger.ts` (observations, reports, drift, diff) | file/asset assessment + provenance for uploaded artifacts |
| `ArtifactCanvas.tsx` | absorbed as a render mode; not a second artifact system |
| `asherinKernel.ts` / `asherin-kernel-proxy` | pattern-card retrieval stays exactly as is, kernel-offline honesty preserved |

## New modules

`src/lib/artifact/`

- `types.ts` — `ArtifactSession`, `ArtifactManifest`, `ArtifactFile`, `ArtifactContract`, `ArtifactVersion`, `Observation`, `Defect`, `RepairPlan`, `ValidationReport`, lifecycle union.
- `contract.ts` — derive goals, requirements, expected behavior, interface/outputs, constraints, invariants, acceptance criteria, test model from the request or from reverse reconstruction.
- `modality.ts` — routes a contract to a capability: `execute` (browser bundle), `render` (markup/doc/chart/image), `compute` (data transform, simulation step), `validate_only` (plan, research, design). Anything with no real capability resolves to `unavailable` + reason.
- `runtimes/browserSandbox.ts` — the extracted iframe runtime (`srcDoc`, `sandbox="allow-scripts"`, no same-origin, no network unless the artifact declares and the user allows).
- `runtimes/renderRuntime.ts`, `runtimes/computeRuntime.ts` — deterministic, in-page.
- `observer.ts` — normalizes runtime errors, console, unhandled rejections, postMessage state, timing, test results into `Observation[]`. Never synthesizes an observation. Missing channel = `unobserved` with reason.
- `audit.ts` — universal model audit before construction: contradiction, missing requirement, ambiguity, assumptions, dependencies, state coverage, edge cases, failure modes, data/control/temporal flow, security/privacy, performance, a11y, scalability, evidence, counterexamples. Each dimension emits a finding or explicit `n/a — reason`.
- `validate.ts` — expected model vs actual observations, defect classification (`missing`, `wrong_value`, `wrong_behavior`, `crash`, `contract_violation`, `unobservable`).
- `repair.ts` — scope decision first (`property | component | module | subsystem | architecture | whole`), minimal valid repair, rerun only affected validation.
- `reverse.ts` — intent → narrative → state → workflow → flows → invariants → expected vs observed → hypotheses → discriminating tests → root cause → repair, for uploaded files / existing code.
- `versioning.ts` — immutable lineage, compare, rollback, restore.
- `experience.ts` — builds the structured experience record and hands it to the **existing** learning gate + adaptive creator. No parallel learning path.
- `store.ts` — owner-scoped persistence via the existing supabase client.

`src/lib/workspace/` gains `artifact` as a `SurfaceKind` + `LaneKind`; `planner.ts` and `runners.ts` learn the artifact lane; `state.ts` tracks the active artifact session so follow-ups mutate it.

## UI (workspace surface, not an IDE)

`src/components/dashboard/workspace/artifact/`
- `ArtifactSurface.tsx` — status header (modeling / building / running / rendered / validating / repairing / verified / failed / unavailable) with truthful reason text.
- `ArtifactStage.tsx` — the sandbox or render target.
- `ArtifactValidationReport.tsx` — expected vs actual, defects, repairs applied.
- `ArtifactVersions.tsx` — lineage, compare, rollback.
- `ArtifactInspector.tsx` — files, contract, observations, provenance.

Dark cinematic system only: existing tokens, Inter extralight / Cormorant, rounded-2xl, translucent glass. No new palette, no chain-of-thought exposure — decisions and reasoning summaries only.

## Data model (new tables, owner-scoped, RLS + GRANTs)

| Table | Purpose |
|---|---|
| `artifact_session` | user_id, conversation_id, project_id, title, modality, lifecycle state, active_version, capability + reason |
| `artifact_version` | immutable snapshot: manifest, files, dependencies, runtime metadata, change summary, reason, feedback source, parent_version |
| `artifact_contract` | goals, requirements, expected behavior, interface, constraints, invariants, acceptance criteria, test model |
| `artifact_observation` | normalized observation rows with channel + source, never fabricated |
| `artifact_validation` | expected vs actual, defects, verdict, per-check availability |
| `artifact_repair` | scope, diagnosis, hypotheses, change set, rerun result |
| `artifact_experience` | structured experience record linking to `ai_pattern`, `ai_learning_event`, `ai_pattern_outcome` |

Same RLS shape as the `ai_*` tables: `user_id = auth.uid()`, GRANTs to `authenticated` + `service_role`, no anon.

## Data flow

```text
message
  -> prepareTurn (context, memory, intent, pattern retrieval via kernel/registry)
  -> artifact intent? -> contract.ts -> audit.ts -> repair of the model
  -> pattern synthesis (forge.ts) -> construction (model gateway, existing BYOK boundary)
  -> modality.ts -> runtime (execute | render | compute | validate_only | unavailable)
  -> observer.ts -> validate.ts -> defects?
        yes -> repair.ts (scope) -> rerun affected validation
        no  -> verified
  -> version snapshot -> experience.ts
  -> learningGate + creator -> retain / refine / quarantine -> future retrieval
```

Follow-ups reuse the same session: contract diff → targeted repair → new version. Never a cold rebuild.

## Hidden skill artifact

`.agents/skills/pattern-creator/` — SKILL.md plus references covering discover → create → evaluate → retain → retrieve → compose → adapt → evolve, with provenance, scope, testing, quarantine, retirement and transfer constraints. Retrieval-triggered and exportable on explicit request; never injected wholesale into chat prompts.

## Execution boundaries and honest limits

- The browser sandbox runs **client-side only**: HTML/CSS/JS/TS/React via in-page babel. No npm install, no server processes, no native builds, no arbitrary language runtimes.
- No planetary-scale execution, no live crawling, no fabricated test results. Anything not actually run reports `unobserved` / `unavailable` with the reason.
- Visual/render observation is limited to what the iframe can report; there is no screenshot diffing.
- Model calls stay behind the existing BYOK credential boundary. No secrets in prompts, patterns, memory or logs. Kernel offline is stated, never faked.
- No model-weight training. Adaptation remains context, retrieval, memory, patterns, strategy.
- Non-browser modalities (documents, data, research, design, image workflows) validate and render; they do not pretend to execute.

## Tests (`src/test/artifact*.test.ts`)

Lifecycle transitions, contract creation, expected-vs-actual comparison, observer normalization (including missing channels), repair scope selection, minimal-repair-not-rebuild, version lineage + rollback, follow-up mutation of an existing session, build/runtime/validation failure recovery, learning-gate integration, pattern attribution from user feedback, modality routing incl. `unavailable`, and regression of current chat + workspace behavior.

## Phases

1. Contracts, types, tables + RLS, isolation tests.
2. Contract + audit + reverse reconstruction (no runtime yet; `validate_only`).
3. Modality router + render/compute runtimes + observer.
4. Browser sandbox runtime extracted from `IdePreviewPanel`, with network denied by default.
5. Validator + defect classification + repair engine with scope.
6. Versioning, compare, rollback.
7. Workspace lane + planner/runner + artifact surface UI.
8. Experience records → learning gate → adaptive creator → attribution from feedback.
9. `pattern-creator` skill bundle.
10. Full test pass, typecheck, build, live authenticated verification of at least one artifact per modality that is genuinely supported.
