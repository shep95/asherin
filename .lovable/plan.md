# Asherin intelligence infrastructure

Build the adaptive intelligence layer that sits *above* the model: conversation state, scoped memory, a real pattern registry with lifecycle and provenance, an adaptive pattern creator, a model gateway with a credential boundary, a learning gate, and a privacy-filtered global learning cycle.

## What the audit found

- Chat runs through one 3,832-line backend function. Pattern "cards" exist but are a hardcoded array in `_shared/asherinPatternIndex.ts` — no registry, no lifecycle, no learning, no persistence.
- No memory tables at all for chat. `conversations` / `messages` exist. `projects` exists. Nothing stores user memory, project memory, patterns, candidates, or outcomes.
- `user_api_keys` already holds encrypted BYOK credentials; provider routing lives in `_shared/adminGate.ts`. That is the credential boundary to reuse — no second key store.
- Frontend memory code is a taxonomy file only (`src/lib/memory/memoryKinds.ts`) with a good secret-shape guard worth reusing.

Conclusion: conversation state, memory, patterns and learning must be built as real database-backed subsystems, not prompt text.

## Data model (new tables, all owner-scoped with RLS + grants)

| Table | Purpose |
|---|---|
| `ai_conversation_state` | per-conversation goal, topic, decisions, assumptions, constraints, observed preferences, patterns used/created/rejected, unresolved questions, confidence |
| `ai_user_memory` | promoted durable user facts/preferences, with scope, confidence, evidence count, source |
| `ai_project_memory` | project-scoped knowledge, keyed to existing `projects` |
| `ai_memory_candidate` | everything the model proposes; nothing persists to memory without passing the gate |
| `ai_pattern` | full pattern object: identity, domain, abstraction, scope, trigger, mechanism, procedure, constraints, failure modes, evidence, confidence, success/failure counts, status, provenance, version |
| `ai_pattern_edge` | the registry graph: derived_from, analogous_to, conflicts_with, specializes, repairs, supersedes, fails_under, transfers_to |
| `ai_pattern_version` | immutable version history; new versions never overwrite |
| `ai_pattern_outcome` | per-use outcome records feeding confidence |
| `ai_learning_event` | audit trail of every gate decision |
| `ai_global_candidate` | quarantined, abstracted, anonymous candidates |
| `ai_global_pattern` + `ai_global_manifest` | canonical / experimental / retired layers, monthly run manifest |

Isolation is enforced in SQL: user rows carry `user_id`, project rows carry `project_id`, global tables carry **no** user or project identifiers and are written only by the abstraction gateway.

## Subsystems (frontend `src/lib/intelligence/`, backend `supabase/functions/_shared/intelligence/`)

- **context resolver** — assembles the runtime context for a turn: conversation state + relevant memory + relevant project knowledge + retrieved patterns, ranked and budgeted. Relevance-based retrieval, never dump-everything.
- **memory** — candidate creation, classifier, scope assignment (task / conversation / project / user / domain / global), promotion policy, on/off boundary. Memory OFF writes nothing durable; conversation state still works.
- **pattern registry** — CRUD, graph edges, retrieval by trigger/domain/context, relevance scoring, versioning, provenance, lifecycle transitions (observed → candidate → testing → validated → active → refined → superseded / failed / archived).
- **pattern forge** — composition algebra (combine, sequence, nest, mutate, generalize, specialize, domain-swap, add feedback/redundancy), cross-domain transfer pipeline (source → function → mechanism → invariant → abstract → target), coverage check.
- **adaptive pattern creator** — unknown detection when coverage is insufficient, discovery mode, decomposition, candidate synthesis, formalization, testing, validation, failure recording, scope assignment.
- **model gateway** — provider-neutral invoke + capability descriptor (text/vision/image/audio/tools/structured/context window). Credentials stay behind references; raw keys never leave the gateway, never enter prompts, patterns, memory, or logs.
- **critic / validator** — modality-appropriate checks (code, research, planning, design, conversation) before output is accepted.
- **learning gate** — the hard boundary: model proposes, system decides. Outcome observer → classifier → candidate → policy → validation → promotion.
- **global learning** — abstraction gateway (strips identifiers, rewrites to mechanism), quarantine, dedup, independence analysis, evidence aggregation, adversarial + safety review, promotion/refine/retire, versioned manifest. Run by a monthly scheduled function, also runnable on demand.

## Orchestration

`context → memory → pattern intelligence → forge → orchestrator → capability router → model gateway → tools → validator → outcome → learning gate`

Wired into the existing chat function so real turns flow through it. Pattern Forge decides the approach; the model executes it. Nothing is domain-limited to coding — the same loop serves conversation, research, writing, planning, analysis and image work.

## UI

A management surface in the dashboard: memory on/off, what is stored (view/edit/delete), project context, active provider + detected capabilities, credential configuration (reusing existing BYOK settings), pattern list with status/confidence/provenance, and global-learning participation control. Reasoning summaries and decisions are shown; hidden chain-of-thought is not.

## Testing

Deterministic tests for: conversation isolation, user isolation, project isolation, memory OFF writes nothing, memory ON follows the gate, scope preservation, unknown → discovery, candidates start as hypotheses, validation required before active, feedback → scoped candidate, failure conditions recorded, versioning preserves history, credentials absent from prompts/patterns/memory/logs, global privacy filtering, global promotion eligibility, monthly cycle execution, provider switching preserves memory/patterns, capability routing, cross-domain (non-coding) patterns, and regression of existing chat behavior.

Plus typecheck, full test run, and production build.

## Phasing

Each phase lands complete and tested before the next.

1. Schema + RLS + isolation tests
2. Conversation state + context resolver
3. Memory (vaults, candidates, gate, on/off)
4. Model gateway + capability resolution + credential boundary
5. Pattern registry + forge (graph, lifecycle, versioning, composition, transfer)
6. Adaptive pattern creator (unknown, discovery, validation, failure)
7. Orchestration into the live chat path
8. Global learning + monthly cycle + manifest
9. UI management surface
10. Full test pass + requirement-to-implementation audit table

## Honest limits up front

- No model-weight training. Adaptation is context, retrieval, memory, patterns and strategy — this will be stated in the UI, not implied otherwise.
- Chat needs a saved provider key (current platform policy). Without one the gateway reports unavailable rather than falling back.
- Global learning starts with an empty registry; canonical patterns appear only after real candidates pass the cycle. No seeded fake "global knowledge".
- Shepherd and Pattern Forge material is integrated as reasoning procedures and ontology, never as a persona.
