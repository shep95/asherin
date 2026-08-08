# Ghost Engine — Search-Engine Front End

Make the Ghost Engine feel like a Google/ChatGPT-style search on the surface, while the backend keeps doing metadata carving + short-take buffer + soft selection. The user types one thing in one box, hits Enter, and gets a ranked list of hits with previews. All the "shells / entities / graph / anomalies" power stays available, but tucked behind the results view instead of being the first thing.

## What changes for the user

- One search box, one Enter key. No mode picker up front.
- Google-style results list: title, URL/host, snippet-style metadata line, small badges (TLS, EXIF, ASN, PDF producer, anomaly).
- Right/lower **preview panel** on click — shows shell, container metadata, redirect chain, and (if the body was buffered) a text preview + "open payload" link.
- **Autocomplete** from recent queries + host suggestions from the current buffer.
- **Suggested queries** ("related searches") built from facets of the last sweep (e.g. `asn:AS15169`, `host:example.com`, `producer:"Microsoft Word"`).
- **Left rail filters** collapsed by default: host, ASN, source type, has EXIF, has anomaly, date range — every one is just a facet from the existing index.
- **Scope switch** in the box, unobtrusive: `All · Web (sweep) · Buffer (soft select)`. Default = `All`, which runs a sweep and, if bodies are retained, also runs a content pass over the buffer and merges hits.
- Existing tabs (Shells / Entities / Graph / Timeline / Anomalies / Facets / Buffer) move to a secondary tab strip **under** the results, for the operator who wants to go deep. Not the landing surface.

## Backend

No schema changes. Add one thin action to `ghost-engine`:

- `action: "search"` — accepts `{ q, scope: "all"|"web"|"buffer", capture, limit }`.
  - `web` / `all` → runs the existing sweep path, returns `index` plus a flat `results[]` (mapped from `index.records` with a computed snippet + badge set).
  - `buffer` / `all` → also runs `selectContent` over the live buffer with `q` as a dictionary term and merges hits into `results[]` marked `source:"buffer"`.
  - Returns `suggestions[]` derived from top facets so the UI can render "related searches" without a second round-trip.

Everything else (`sweep`, `buffer`, `content`, `payload`, `purge`) stays as-is so the existing console keeps working.

## Frontend

- New component `src/components/dashboard/ghost/GhostSearchResults.tsx` — Google-style results list + preview drawer + related searches.
- Rework `src/components/dashboard/GhostEngineView.tsx`:
  - Replace the hero "Shells" landing with the results view.
  - Keep the command bar; add scope pill (`All / Web / Buffer`) and autocomplete dropdown fed by `recent[]` + live buffer hosts.
  - Move the seven power tabs into a `Details` disclosure below the results (same components, no rewrite).
- Small helpers in `src/components/dashboard/ghost/searchFormat.ts` — snippet builder, badge selector, related-query derivation from `index.facets`.

## Not in scope

- No new tables, no new gating (still Pro).
- No changes to `ghostMetadata`, `ghostIndex`, `ghostBuffer` internals.
- No changes to the chat bridge.

## Verify

- Live sweep of a public host with `scope=all, capture=on`: results list renders, preview drawer opens shell, buffer hits appear inline.
- Live sweep with `scope=buffer` and a term known to exist in the buffered body: only buffer hits render, "open payload" works.
- Empty query: shows recent queries + a "Retained sessions" strip drawn from the buffer.
