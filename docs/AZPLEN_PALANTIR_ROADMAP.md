# AZPLEN — Palantir-Level Upgrade Roadmap
_Source: Zophiel · House of Asher_

This document is the authoritative scope for raising AZPLEN to Palantir
Gotham + Foundry parity. Items are tracked by status.

## Shipped in this pass
- Mission-phase grouped tab bar (Collection / Processing / Analysis / Intelligence / Operations / Reporting)
- Investigation Dashboard (status strip, entity treemap heatmap, activity timeline, open questions)
- Canvas (investigation workspace — drag entities, build argument structure, persisted per-session)
- Collection Plan tab (objectives, intelligence questions, coverage tracking)
- Hypothesis Testing tab (ACH-style competing hypotheses, evidence-for/evidence-against, probability)
- Classification badge in session header (UNCLASS → TS/SCI), persisted per session
- Cmd+K command palette scoped to Azplen — entities, documents, tabs, reports

## Backlog — UI
- Permanent left sidebar navigator (current pass uses grouped tab bar)
- Entity detail drawer with Profile / Relationships / Documents / Timeline / Intelligence / Connections Map
- Document viewer with inline entity highlighting + side-by-side evidence + annotations
- Operational dark theme override (deeper palette than platform default)

## Backlog — Workflow & Function
- Automated investigation pipeline (ingest → extract → ontology → graph → monitor → insights chain)
- Cross-session entity resolution (persistent entities across sessions)
- Automated deconfliction (fuzzy + type-constrained + AI-assisted merge with audit log)
- Intelligence production workflow (Draft → Edit → Review → Publish → Dissemination Control)
- Enrichment connectors:
  - OpenCorporates, SEC EDGAR, Companies House
  - OFAC SDN, UN Security Council, EU Consolidated sanctions (passive XML feeds)
  - WhoisXML, DNS, CT logs, IP reputation
  - Chainalysis / Elliptic crypto wallet tracing
  - Court records, public LinkedIn
- Temporal Intelligence Engine (timeline reconstruction, relationship dating, change detection, time slider)
- Structured Analytical Methods (ACH matrix, Key Assumptions Check, Devil's Advocacy, Indicators & Warnings)

## Backlog — Security
- Classification enforcement at RLS level (not just UI badge)
- Need-to-know session ACLs (owner / collaborator / reader / no-access, compartmented sessions)
- Immutable audit trail (append-only, no DELETE RLS)
- Data provenance everywhere (source attribution, info age, analyst caveats, chain of custody)
- OPSEC features (proxy rotation, attribution scrubbing, Passive-Only Mode, query delay jitter)
- Encrypted sessions (PBKDF2 client-side, key never leaves device)
- Export controls (format restrictions, hidden watermarking, export approval workflow)

## Backlog — Mapping & Graphing
- Replace custom SVG graph engine with Sigma.js + Graphology OR Cytoscape.js
- Layout algorithms beyond force-directed:
  - Hierarchical (Dagre)
  - Radial (concentric / BFS)
  - Geographic (Leaflet overlay)
  - Temporal (horizontal-by-date)
  - Cluster (Louvain community detection, AI-named communities)
  - Bipartite (two-mode networks)
- Graph algorithms: betweenness / degree / closeness centrality, shortest path, anomaly detection, link prediction
- Live graph editing (right-click add, drag-to-connect)
- Multi-hop expansion (animated 1-hop fetch)
- Evidence threading (click edge → see source documents → jump to passage)
- Graph difference view (diff two snapshots)
- Subgraph export (CSV / GeoJSON / PDF chart)
- Graph snapshots (named, restorable, shareable)
- Hybrid geospatial graph (Mapbox/Leaflet + arc overlays + bounding-box filter + temporal animation)
- Chart upgrades: Sankey (d3-sankey), Chord (d3-chord), Treemaps, Temporal heatmap, Confidence distribution, Enrichment coverage
