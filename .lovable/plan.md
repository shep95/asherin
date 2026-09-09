# asherin.acatalepsy — local deterministic analytics workspace

## outcome
Create a new public page at `/asherin.acatalepsy` that accepts data without an account, processes it in browser memory, detects its structure and domain with deterministic rules, and turns supported evidence into usable charts. The selected landing wallpaper remains visible beneath a restrained near-black workspace.

## product boundaries
- No authentication, account lookup, AI call, model, backend database, analytics tracker, cookie, or persistent browser storage on this route.
- Uploaded contents live only in React/browser memory and are cleared on page unload or explicit “clear all.”
- URL import is direct browser fetch only; blocked cross-origin URLs explain the browser restriction instead of proxying data through a server.
- Share links encode filters/layout only, never uploaded file contents; this avoids leaking private data into browser history and keeps links below practical URL limits.
- The 100 MB client limit is enforced. The requested server-side path above 100 MB is excluded because it conflicts with “all locally hosted on user device” and “no server storage.”
- Unsupported specialist/binary formats are rejected plainly rather than displayed as working. Formats supported by installed local parsers will be enabled now; companion-based formats such as shapefiles require their required files together.
- “Intelligence” and “military” are complexity labels, not claims of intelligence access. They unlock only when the uploaded files contain the necessary linked fields.

## implementation

### 1. deterministic analysis core
- Add an acatalepsy-specific typed engine, separate from the authenticated `asherin.data` room.
- Normalize supported files into local tables while preserving filename, path, batch, bytes, parser, warnings, and original file handles in memory.
- Score financial, cybersecurity, behavioral, geopolitical/social, health/biological, operational, geospatial, temporal, and text domains from header signatures plus value-shape evidence.
- Assign beginner/intermediate/senior/elite/intelligence/military complexity from row/column/type/relationship/multi-file criteria.
- Select visuals from the uploaded architecture rulebook only when required columns exist; otherwise use an honest generic chart or explain why no visual can be drawn.
- Produce “what we detected,” quoted evidence from actual rows, and “why this visual” with fixed plain-language templates.
- Compute column statistics, missing values, duplicate counts, anomalies, correlations, date ranges, common join keys, and geospatial points locally.

### 2. ingestion and organization
- Full-window drag state, click-to-browse, multi-file and folder selection, clipboard table paste, and public URL import.
- A 50-file queue with isolated per-file status and bounded parallel parsing.
- Immediate extension/size/readability checks and plain corrective errors.
- Organize files by visible format groups, date, and upload batch while domain classification remains internal.
- Searchable, collapsible tree with file actions: preview, visuals, download original, remove.
- Group actions: expand/collapse, view group visuals, and download selected/all as an organized ZIP with a generated manifest.

### 3. visualization workspace
- Responsive 30/70 split workspace, collapsing into a drawer/stack on narrow screens.
- Tabs for supported visuals derived from each real dataset, including line/bar/area/scatter/bubble/donut/histogram/box/heatmap/correlation/candlestick/funnel/sankey/network/map and KPI views where evidence supports them.
- One cold-green trust signal only. Data series use monochrome opacity, line styles, hatching, shape, and thickness so charts remain distinguishable without breaking the palette.
- Local maps plot uploaded coordinates with labeled monochrome markers, connection lines when origin/destination fields exist, and a sidebar legend derived from the data.
- Filters for date, numeric range, and categories update charts locally.
- Export visuals to PNG, SVG where the renderer provides vector output, and PDF.

### 4. preview and inspection
- First-100-row table with typed column markers, dataset summary, and across-row search/highlighting.
- Clickable columns open statistics: min, max, mean, median, standard deviation, missing, unique, common values, and local mini-distribution.
- Multi-file “combine and analyze” appears only when deterministic overlap finds credible shared keys or compatible schemas; the user chooses the proposed merge.

### 5. page, privacy, and discoverability
- Add the public dotted route, host rewrites, route metadata, sitemap entry, and advanced software-application/dataset-capability structured data.
- Exclude the analytics visit tracker and other global background services from this privacy route.
- Use the existing wallpaper system with a stronger translucent veil, no gradients, thin lowercase type, layered black surfaces, restrained motion, keyboard focus, screen-reader labels, and reduced-motion behavior.
- Empty state contains the upload surface, three factual use cases, and an explicit local example-data action.

### 6. verification
- Add deterministic unit tests for domain scoring, rank boundaries, visual matching, evidence quoting, filters, and safe merge suggestions.
- Test live with generated real CSV/JSON/GeoJSON/financial fixtures: upload, multi-file isolation, paste, file tree, preview search, statistics, chart selection, filtering, exports, ZIP manifest, removal, and clear-on-refresh behavior.
- Verify desktop and mobile layouts, keyboard navigation, no network upload/model calls during local analysis, route metadata, and a clean production build.
