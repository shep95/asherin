# Asherin Chat as a Workspace, not a text box

Turn the chat into an orchestration surface: it reads what the request needs, calls only the subsystems that can actually answer it, and lays out the answer as a workspace (text + cards + map + timeline + graph + evidence), all linked to each other.

## The logical system

```text
message
   |
[1] intent + context resolver        (reuses existing intent router + conversation state)
   |
[2] capability planner               ->  which surfaces are needed, and are they available?
   |
[3] tool orchestrator (parallel)
        research / OSINT   map+geocode   eye (cameras, tracks)   sentinel (audio, radio)   files/db
   |
[4] evidence fabric                  ->  source -> evidence -> claim -> entity -> relationship
   |
[5] workspace composer               ->  { text, cards[], map?, timeline?, graph?, evidence? }
   |
[6] workspace state                  ->  survives follow-ups ("only show the cameras")
```

Two rules run through all of it:

- Nothing is rendered that no subsystem actually returned. A missing capability renders an explicit `unavailable — reason` tile (no fake thermal, no fake tracks, no invented coordinates).
- Every card carries where it came from. Cards are built from structured results, never hand-written per answer.

## Routing examples

- "what happened at the warehouse entrance between 2 and 3pm" -> sensor lane: incident/camera/audio cards + map with cameras and zones + timeline + actions (open investigation, view evidence, rewind). Anything without spatial calibration is listed but not plotted.
- "research this company and show me its locations" -> research lane: source/entity/relationship cards + geographic map + 3-hop trail + contradictions. No camera panel.
- "what is a good name for this" -> answer only. No map, no cards.

## What gets built

**1. Workspace contract** (`src/lib/workspace/types.ts`)
A single `WorkspacePlan` describing surfaces (`answer | cards | map | timeline | graph | table | evidence | cameras`), each either `ready` with data or `unavailable` with a reason string. Card kinds: entity, person, company, location, camera, sensor, incident, event, evidence, source, document, relationship, timeline-event, track, investigation.

**2. Capability planner** (`src/lib/workspace/planner.ts`)
Pure function: intent route + task frame + live capability registry (existing ARVision/Eye/integration matrix + investigation providers) -> the surface list, with each unavailable surface given a truthful reason. Deterministically testable.

**3. Tool orchestrator** (`src/lib/workspace/orchestrator.ts`)
Runs the planned calls in parallel with per-call timeouts and `allSettled`, normalizes each result into fabric records, and marks any failed lane as degraded with its own reason rather than dropping it silently. Reuses existing investigation coordinator, geocoder, sensor fabric and Eye/Sentinel hooks — no new acquisition path.

**4. Map as a callable capability** (`src/lib/workspace/mapOps.ts`)
Typed operations `OPEN, CENTER, SEARCH, ADD_ENTITY, ADD_LOCATION, ADD_CAMERA, ADD_TRACK, ADD_ZONE, SHOW_ROUTE, SHOW_RELATIONSHIPS, FILTER_TIME, REWIND`, each validated against available data before executing; unsupported ops return a refusal reason that the UI shows.

**5. Workspace state** (`src/lib/workspace/state.ts` + a context provider)
Holds current investigation, entities, locations, viewport, time window, filters, selected card/evidence/camera/track, hypotheses, history. Follow-up turns mutate this state instead of starting over, and the state is part of the next turn's context.

**6. UI**
- `WorkspacePanel.tsx` — right-hand resizable surface stack rendered per message, collapsible per surface.
- `WorkspaceCards.tsx` — one renderer per card kind, driven by the contract, plugged into the existing `ChatCardRenderer` registry so current cards keep working.
- `WorkspaceMap.tsx` — wraps the existing map module, consumes map ops, emits selection back into chat.
- `WorkspaceTimeline.tsx`, `WorkspaceGraph.tsx` (entity/relationship graph), `EvidencePanel.tsx`.
- Bidirectional linking: clicking a card centers/highlights on the map and vice-versa, via the shared state's selection.

**7. Chat wiring**
`Dashboard.tsx` send path calls the planner + orchestrator alongside the existing intelligence turn, attaches the resulting plan to the message, and `ChatView.tsx` renders the workspace next to the answer. Streaming text is untouched; the workspace fills in as lanes return.

## Truth and safety

- No identity inference from appearance, no emotion/dangerousness scoring, no fabricated geometry, temperature, or distance — carried over from existing Eye/ARVision rules.
- Evidence keeps provenance, confidence and contradiction state; weak claims stay claims.
- Every subsystem call is owner-scoped and authenticated; nothing new is exposed to the browser.

## Validation

Deterministic tests for: research vs sensor vs answer-only routing; unavailable-capability reasons; parallel lane failure -> degraded not dropped; map op refusal when data absent; card generation from structured results; selection linking; follow-up narrowing preserving state. Then typecheck, full test run, production build, and one live signed-in chat turn in each lane.

## Scope note

This is a large build. It lands in one coherent pass: contract + planner + orchestrator + state first, then the UI surfaces, then the chat wiring — each with its tests, nothing stubbed as a placeholder.
