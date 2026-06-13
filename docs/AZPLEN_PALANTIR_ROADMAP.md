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

================================================================
ADDENDUM — EXPANDED IDEAS (full vision, ingested 2026-06-13)
================================================================

AZPLEN — EXPANDED IDEAS
Every New Direction, System, and Capability Layer
Compiled by Zophiel · House of Asher
==============================================================


==============================================================
SECTION 1 — THE INTELLIGENCE OPERATING SYSTEM
Turning AZPLEN from a tool into the platform operators live in
==============================================================

Right now AZPLEN is a place operators go to do analysis.
The vision is to make it the place operators LIVE — the environment
that knows everything they know, tracks what they are working on,
suggests what to do next, and remembers every investigation they have
ever run. Call this the Intelligence Operating System layer.

--------------------------------------------------------------
OPERATOR MEMORY ENGINE
--------------------------------------------------------------

WHAT IT IS:
Every analyst has years of institutional knowledge in their head —
patterns they have seen before, sources they trust, entities they
have investigated in other contexts. Right now AZPLEN forgets this
between sessions. The Operator Memory Engine makes it permanent.

HOW IT WORKS:
After every investigation session is closed or a report is published,
the Memory Engine runs an extraction pass over the entire session.
It pulls out:

  — Entity profiles: every entity investigated with a summary of
    what was learned, what the confidence was, and which sessions
    involved them.
  — Source assessments: which data sources provided reliable intel
    and which proved unreliable or incomplete.
  — Pattern signatures: recurring structural patterns the analyst
    encountered (shell company network signatures, sanctions evasion
    typologies, supply chain fraud indicators).
  — Investigation templates: the sequence of steps the analyst took
    to reach their conclusions — extractable as a reusable playbook.

These memories are stored in an operator-specific knowledge base.
In every new session, the AI has access to this memory and surfaces
it proactively: "In your March investigation of similar entities,
you found a pattern of triangular ownership structures. I see the
same pattern beginning to emerge here."

The memory is visible to the operator in a dedicated Memory panel —
browsable, searchable, and editable. They can tag memories, mark
them as outdated, or promote them to team-level institutional memory
(with consent).

--------------------------------------------------------------
INVESTIGATION TEMPLATES & PLAYBOOKS
--------------------------------------------------------------

WHAT IT IS:
Every investigation type has a known structure. Corporate due diligence
follows a specific sequence. Sanctions compliance checks have a defined
methodology. Fraud investigations have established steps. Right now
every AZPLEN session starts blank — the operator rebuilds the workflow
from memory every time.

Playbooks codify these workflows as reusable templates.

PLAYBOOK LIBRARY:
  CORPORATE DUE DILIGENCE
    Step 1: Ingest corporate filings, news coverage, legal records
    Step 2: Entity extract → identify officers, shareholders, subsidiaries
    Step 3: Enrich all persons against PEP / sanctions lists
    Step 4: Run company graph → identify hidden ownership structure
    Step 5: Geographic analysis → flag offshore jurisdictions
    Step 6: Temporal analysis → flag recent ownership changes
    Step 7: Hypothesis: is this a legitimate operating company?
    Step 8: ACH analysis
    Step 9: Report generation

  SANCTIONS EVASION INVESTIGATION
    Step 1: Ingest transaction records, shipping manifests, communications
    Step 2: Entity extract → identify parties, amounts, dates, goods
    Step 3: OFAC/UN/EU auto-check on all persons and organizations
    Step 4: Network graph → identify intermediary chains
    Step 5: Geographic analysis → flag jurisdiction patterns
    Step 6: Temporal analysis → match transaction dates to sanctions dates
    Step 7: Hypothesis: is sanctions evasion occurring?

  SUPPLY CHAIN INTELLIGENCE
  FINANCIAL CRIME
  COUNTER-NARCOTICS
  COUNTER-PROLIFERATION
  FOREIGN INVESTMENT SCREENING
  HUMAN TRAFFICKING INDICATORS

Each playbook auto-configures the session when selected:
  — Sets the collection plan with the appropriate intelligence questions
  — Pre-configures the monitoring rules for entities of interest
  — Loads the relevant ontology templates (what entity types to expect)
  — Stages the recommended enrichment connectors
  — Sets the report template to the appropriate format

The operator starts a session, selects a playbook, and begins with
a structured environment purpose-built for their investigation type.
They can deviate from the playbook at any point — it is a guide,
not a constraint.

--------------------------------------------------------------
CASE MANAGEMENT
--------------------------------------------------------------

WHAT IT IS:
A single investigation is rarely standalone. Real intelligence work
involves cases — ongoing matters that span weeks or months, involve
multiple analysts, generate multiple investigation sessions, and
accumulate a growing body of evidence over time.

AZPLEN's session model is a single investigation. The Case Management
layer wraps sessions into cases.

A Case has:
  — A case number (auto-generated, human-readable: CASE-2024-0047)
  — A case name and description
  — A classification level
  — A lead analyst and a team
  — A status: Open / Active / Pending / Closed / Archived
  — An associated objective (what are we trying to determine?)
  — All investigation sessions that belong to this case
  — A shared evidence vault — documents and entities shared across sessions
  — A case timeline — a unified chronology across all sessions
  — A case graph — a merged graph across all sessions
  — A case report — the authoritative final product
  — An SLA indicator — how many days until this case must be closed

Case Dashboard: the landing page for a case shows all of this at a glance.
A case can be in multiple phases simultaneously — some sessions still
collecting while others are in analysis.

Integration: sessions within a case share their entity resolution.
When Session 3 discovers that "Zhang Wei" is the same person as
"Wei Zhang" from Session 1, this deconfliction propagates across
all sessions in the case.

--------------------------------------------------------------
ANALYST WORKLOAD MANAGEMENT
--------------------------------------------------------------

WHAT IT IS:
When multiple analysts work in AZPLEN simultaneously, there is no
coordination. Two analysts might investigate the same entity independently,
drawing the same conclusions twice and wasting effort.

The Workload Panel gives team leaders visibility into what every analyst
is working on and enables structured task assignment.

Features:
  — Active sessions view: see every open session across the team,
    who is in it, what stage it is at, when it was last updated.
  — Task assignment: assign specific investigation tasks to analysts
    (e.g., "Investigate the financial records for this entity" →
    assigned to Analyst B with a due date and priority).
  — Deconfliction: before starting an investigation, search whether
    any other analyst or session has investigated the same entity.
    "This entity was last investigated in Case-2024-0031 (Analyst Chen,
    March 15). Would you like to see their findings before proceeding?"
  — Throughput metrics: how many investigations per analyst per week,
    average time to close, report quality scores.


==============================================================
SECTION 2 — DATA INGESTION & PROCESSING EXPANSION
Everything that can get data into AZPLEN and everything that
can be done to it before analysis begins
==============================================================

--------------------------------------------------------------
LIVE DATA STREAM INGESTION
--------------------------------------------------------------

AZPLEN currently ingests static files — CSVs, PDFs, Word documents,
JSONs. The world generates data in streams.

STREAM CONNECTORS:
  — RSS/Atom feeds: ingest news sources, government press releases,
    regulatory announcements, on a configurable polling interval
    (every 15 minutes, hourly, daily). New articles are automatically
    entity-extracted and added to the session.

  — Webhooks: receive POST requests from external systems that push
    data into AZPLEN. A compliance system flags a transaction → the
    transaction record is automatically ingested into the active case.

  — WebSocket feeds: for near-real-time data (market data, shipping
    tracking, flight data) — a persistent WebSocket connection with
    automatic reconnection and back-pressure control.

  — Email monitoring: connect an email account (via IMAP/OAuth).
    New emails matching a filter are automatically ingested, entity-
    extracted, and added to the session. Useful for monitoring
    communications from specific domains or containing specific keywords.

  — Social media monitoring: connect monitored Twitter/X searches,
    LinkedIn company updates, or Reddit threads. New posts matching
    keywords are ingested and entity-extracted.

STREAM INTELLIGENCE:
  Every incoming stream item is:
  1. Entity-extracted and merged into the session ontology
  2. Checked against all monitoring rules
  3. Scored for relevance to the active intelligence questions
  4. Surfaced in the Investigation Dashboard if highly relevant
  5. Added to the session timeline at the correct date

--------------------------------------------------------------
MULTI-LANGUAGE DOCUMENT INTELLIGENCE
--------------------------------------------------------------

Investigations cross borders. Documents arrive in Chinese, Russian,
Arabic, Spanish, German, and dozens of other languages. The current
document intelligence panel assumes English.

TRANSLATION PIPELINE:
  Every document is language-detected (langdetect or fastText).
  Non-English documents are translated before entity extraction
  using DeepL API (highest quality for cross-lingual analysis) or
  a local translation model for sensitive materials.
  Both the original text and the translation are stored.
  The operator can view either — side by side in the document viewer.

CROSS-LANGUAGE ENTITY RESOLUTION:
  "Пекинский университет" (Russian) and "北京大学" (Chinese) and
  "Peking University" (English) are the same entity. Cross-language
  entity resolution detects these equivalences using multilingual
  embedding models (sentence-transformers multilingual models).

NAMED ENTITY RECOGNITION PER LANGUAGE:
  NER models trained for each language perform significantly better
  than translated text run through English NER. The pipeline routes
  each document to the appropriate language-specific model.

--------------------------------------------------------------
STRUCTURED DATA QUALITY ENGINE
--------------------------------------------------------------

The existing DataIssue type already defines: duplicate, null, outlier,
format, conflict. The auto-fix flag exists on each issue. But the
actual fix logic is not implemented — "autoFixAvailable" is a flag
with no backend.

THE QUALITY ENGINE MAKES THIS REAL:

  DUPLICATE DETECTION AND MERGE
    Exact duplicate rows: deterministic — remove all but one.
    Near-duplicate rows (fuzzy match on key columns): surface to operator
    with a side-by-side comparison and a "Merge" action.
    Merge keeps the most complete row (fewest nulls) and logs the merge.

  NULL IMPUTATION
    For numeric columns: mean/median imputation with operator choice.
    For categorical columns: mode imputation or "Unknown" category.
    For date columns: interpolation if the column is a time series.
    For all: mark imputed values with an "imputed" flag column so
    the operator knows which values were added.

  OUTLIER DETECTION AND INVESTIGATION
    Z-score based (values > 3σ from mean flagged).
    IQR based (values outside 1.5×IQR flagged).
    Isolation forest for multivariate outliers (requires 2+ columns).
    Flagged outliers appear in the table with an amber highlight.
    The operator can: Accept (keep as-is), Cap (replace with boundary
    value), Remove (delete the row), or Investigate (open in Workshop
    for AI analysis).

  FORMAT STANDARDIZATION
    Phone numbers → E.164 format.
    Dates → ISO 8601.
    Currencies → ISO 4217 code + decimal amount.
    Country names → ISO 3166-1 alpha-2.
    Company names → canonical form (run through OpenCorporates fuzzy search).
    All transformations are reversible — stored as transformation steps
    in the Data Lineage panel.

  CONFLICT RESOLUTION
    When the same entity has conflicting attribute values across two
    sources (e.g., Company A has different headquarters addresses in
    two documents), the conflict is surfaced to the operator with
    both source documents shown side by side. The operator selects
    the authoritative value and records the rationale.

--------------------------------------------------------------
DATA TRANSFORMATION STUDIO
--------------------------------------------------------------

Beyond the Pipeline Builder (which is node-based), AZPLEN needs a
direct transformation interface for analysts who think in terms of
operations rather than pipelines.

THE TRANSFORMATION STUDIO is a spreadsheet-meets-code interface:
  — Every column has a transformation bar above it (like Excel's
    formula bar, but for the entire column)
  — Operations: split, merge, extract regex, replace, cast type,
    normalize, apply lookup table, apply enrichment, filter
  — The transformation is expressed in a simple DSL:
      EXTRACT(column, regex, group)
      SPLIT(column, delimiter, index)
      MERGE(col1, col2, separator)
      LOOKUP(column, table, match_col, return_col)
      NORMALIZE(column, method: "zscore"|"minmax"|"log")
  — Transformations stack — each one is a step in the lineage chain
  — The operator can preview the result before committing
  — Undo is available for every step
  — The transformation history exports as a reproducible script

--------------------------------------------------------------
DOCUMENT CLUSTERING ENGINE
--------------------------------------------------------------

When 500 documents are ingested, the operator needs to know:
what are the major themes? which documents are about the same thing?
where are the clusters of related content?

THE CLUSTERING ENGINE:
  — Embeds every document using a sentence-transformer model
    (all-MiniLM-L6-v2 or similar — runs in the browser via
    transformers.js or on the server)
  — Clusters the embeddings using k-means or HDBSCAN
  — AI names each cluster based on its most representative documents
    ("Financial irregularities," "Corporate structure," "Sanctions history")
  — The clusters appear as a visual cluster map: a 2D scatter plot
    (UMAP dimensionality reduction) where similar documents cluster
    together and each cluster is colored and labeled
  — Clicking a cluster filters the document panel to only those documents
  — Clicking a document on the scatter plot shows its neighbors —
    the most similar documents in the corpus

This is the fastest way to understand a large document collection.
Instead of reading 500 documents, the operator reads the cluster map
and immediately knows where to focus.


==============================================================
SECTION 3 — ANALYSIS EXPANSION
New analytical capabilities beyond what Palantir currently offers
==============================================================

--------------------------------------------------------------
BEHAVIORAL PATTERN ENGINE
--------------------------------------------------------------

WHAT IT IS:
Pattern-of-life analysis — understanding the behavioral signature
of an entity from its recorded activities. Used in law enforcement,
counterterrorism, and fraud investigation to detect anomalies and
predict future behavior.

FOR PEOPLE:
  Where do they appear? (location patterns)
  When do they appear? (temporal patterns)
  Who do they appear with? (association patterns)
  What communication patterns do they show?
  When does their behavior deviate from their baseline?

FOR ORGANIZATIONS:
  What is their transaction volume baseline?
  When do they hire and when do they contract?
  What is their normal supplier network?
  When do they change their ownership structure?
  When does their public communications volume change?

THE ENGINE:
  Requires temporal data (transactions, communications, movements)
  with timestamps. The engine builds a baseline behavioral model
  for each entity from their historical data. It then flags
  deviations: when an entity behaves outside their normal pattern,
  how significant is the deviation, and what does the deviation
  look like relative to known typologies.

Example: A company that normally has 50 outgoing transactions per
month suddenly has 500 in a single week, all to first-time counterparties
in three jurisdictions that are known offshore centers.
The engine flags this as a pattern deviation of 10σ and matches it
against the "layering phase of money laundering" typology.

--------------------------------------------------------------
NETWORK RESILIENCE ANALYSIS
--------------------------------------------------------------

WHAT IT IS:
For intelligence targeting and operational planning, understanding
which nodes in a network are critical is essential. Remove the
wrong node and the network adapts. Remove the right node and the
network collapses.

Network resilience analysis answers: if we remove this entity from
the network, what happens? How does the network degrade?

SIMULATION TYPES:
  Targeted removal: select specific entities to remove and see
  which communities fragment, which paths are destroyed, how
  centrality scores redistribute.

  Random removal: simulate random disruption of X% of entities.
  How many entities must be removed before the network fragments?
  This is the network's resilience threshold.

  Cascade failure: some entities, when removed, cause other entities
  to fail (a company that goes bankrupt drags its dependent suppliers).
  Model these cascade effects through the network.

  Reconstitution: after simulating network degradation, model how
  the network might reconstitute — which alternative paths would be
  used, which backup entities would activate.

OUTPUT:
  Critical nodes ranked by impact of removal.
  Network fragmentation threshold.
  Cascade failure tree.
  Reconstitution timeline estimate.
  Visualization of the network at each stage of degradation.

--------------------------------------------------------------
FINANCIAL FLOW ANALYSIS
--------------------------------------------------------------

WHAT IT IS:
Following the money. Given financial transaction records (bank transfers,
invoices, payments, cryptocurrency transactions), trace flows from
source to destination through any number of intermediaries.

THE FLOW ENGINE:
  TRANSACTION GRAPH
    Every transaction becomes an edge in a directed graph.
    Source account → target account, labeled with amount, currency,
    date, and reference.

  MONEY FLOW TRACING
    Select a source account (or entity). The engine traces all
    downstream flows — where did the money go, through what
    intermediaries, and where did it ultimately land.
    Configurable to a depth of N hops.

  REVERSE TRACING
    Select a destination. Trace backward — where did this money
    come from? Through what intermediaries? What was the original source?

  AGGREGATION BY BENEFICIAL OWNER
    Group accounts by their beneficial owner (person or organization).
    Shows the total flow between beneficial owners even when they
    use many accounts.

  TYPOLOGY MATCHING
    Compare the observed flow pattern against known money laundering
    typologies:
    — Smurfing (many small transactions aggregating to one large one)
    — Layering (rapid movement through multiple intermediaries)
    — Integration (flow into legitimate business)
    — Round-tripping (money leaving and returning disguised as investment)
    — Trade-based laundering (over/under-invoicing)

  SANKEY VISUALIZATION
    The financial flow renders as a Sankey diagram — the width of
    each band proportional to the amount flowing. The operator can
    immediately see where the money concentrates and disperses.

  CRYPTOCURRENCY TRACING
    Bitcoin, Ethereum, and other blockchain transactions are fully
    public and fully traceable. For investigations involving crypto,
    connect to a blockchain explorer API and trace wallet-to-wallet
    transactions. Map wallet addresses to known entities where
    possible. Flag high-risk wallets (known scam addresses,
    darknet market wallets, sanctioned addresses).

--------------------------------------------------------------
COMMUNICATIONS INTELLIGENCE ANALYSIS
--------------------------------------------------------------

WHAT IT IS:
When communications data is available (email metadata, call records,
message metadata — NOT content, just who communicated with whom when),
the communications pattern is often more revealing than the content.

THE COMMUNICATIONS ENGINE:
  COMMUNICATION GRAPH
    Every communication becomes a directed edge.
    Source → Recipient, labeled with channel, timestamp, frequency.
    For email: thread tracking groups replies.

  ROLE DETECTION
    Based on communication patterns, the AI infers roles:
    — Coordinator (many outgoing, receives from many)
    — Executor (many outgoing, few incoming)
    — Gatekeeper (sits between groups that rarely communicate directly)
    — Peripheral (low volume, primarily receives)
    — Bridge (connects otherwise disconnected groups)

  TEMPORAL COMMUNICATION ANALYSIS
    When did communication volume change? Spikes in communication
    often precede events. Sudden silence after consistent communication
    may indicate operational security awareness.
    The engine maps communication volume against external events:
    did communication spike the day before a known event?

  ENCRYPTED CHANNEL DETECTION
    Metadata showing sudden shifts to encrypted channels or
    the appearance of new communication accounts may indicate
    operational security responses to perceived surveillance.

--------------------------------------------------------------
PREDICTIVE THREAT INTELLIGENCE
--------------------------------------------------------------

WHAT IT IS:
Moving from "what happened" to "what is likely to happen next."
Using the patterns identified in historical intelligence to predict
future threat actor behavior, sanctions evasion attempts,
financial crimes, or geopolitical developments.

HOW IT WORKS:
  HISTORICAL PATTERN LIBRARY
    A curated library of documented threat actor behaviors,
    organized as feature sets:
    — Shell company networks: typical structure, typical jurisdictions,
      typical sector targets, typical lifecycle
    — Sanctions evasion networks: typical intermediary types,
      typical commodity types, typical financial mechanisms
    — Supply chain infiltration: typical entry points, typical
      insider recruitment patterns, typical data exfiltration methods

  CURRENT INVESTIGATION MATCHING
    As an investigation proceeds, the current network/entity set
    is compared against the historical pattern library using
    embedding similarity. The system surfaces: "This pattern
    resembles three historical cases of [threat type] with 78%
    structural similarity. Based on those cases, the next likely
    development is [X]."

  EARLY WARNING INDICATORS
    For each threat type, a set of early warning indicators is defined.
    The monitoring system watches incoming data for these indicators
    and alerts when they appear.

  CONFIDENCE-WEIGHTED PROBABILITY ESTIMATES
    The AI produces structured probability estimates:
    "Based on current evidence, there is a 72% probability that
    [entity] is involved in [activity]. Key factors supporting
    this assessment: [list]. Key factors against: [list].
    This estimate would change significantly if [X] were confirmed
    or refuted."

--------------------------------------------------------------
AUTOMATED REGULATORY FILING ANALYSIS
--------------------------------------------------------------

WHAT IT IS:
Government and corporate entities generate massive volumes of
regulatory filings — SEC filings, customs declarations, UBO registers,
land registry records, corporate annual reports. These are public
and free but too voluminous for manual analysis.

THE REGULATORY FILING ANALYZER:
  AUTOMATED RETRIEVAL
    Given a company name or registration number, automatically
    retrieve filings from:
    — SEC EDGAR (US public companies)
    — Companies House (UK)
    — OpenCorporates (global company registry aggregator)
    — EU VAT register
    — US Patent and Trademark Office

  STRUCTURED EXTRACTION
    From each filing, extract:
    — Beneficial owners and percentage stakes
    — Officers and directors with appointment/resignation dates
    — Addresses (registered office, trading address, director home addresses)
    — Financial summary (revenue, profit, assets, liabilities)
    — Related party transactions
    — Material risks (from the risk factors section)
    — Legal proceedings (from the litigation disclosure section)
    — Auditor changes (significant red flag)

  FILING ANOMALY DETECTION
    Flag unusual patterns in filing history:
    — Auditor changes
    — Director resignation clusters (many directors leaving at once)
    — Revenue restatements
    — Going concern qualifications
    — Unusual related party transaction volumes
    — Jurisdictional changes in registration

  CROSS-FILING ENTITY RESOLUTION
    The same person appears as a director across 47 different companies.
    The same address is used as the registered office for 200 companies.
    Flag these networks of shared officers, addresses, and accountants —
    the signature of nominee director and shelf company networks.

--------------------------------------------------------------
SIGNAL CORRELATION ENGINE
--------------------------------------------------------------

WHAT IT IS:
Intelligence analysis requires correlating signals across disparate
data types. A shipment arrives in a port on the same day that a known
financial intermediary makes a large transfer, which coincides with
a burst of encrypted communications between two previously unconnected
entities. None of these alone is significant. Together they suggest
a coordinated operation.

THE CORRELATION ENGINE:
  Define signal types: financial event, movement event, communication
  event, document publication, corporate change, regulatory action.

  For each signal, define: who, what, where, when, how much.

  The engine computes temporal correlations: events that cluster
  in time within a configurable window (default: 48 hours).

  The engine computes entity correlations: events that share entities.

  The engine ranks correlation clusters by significance:
  more entities shared × smaller time window = higher significance.

  High-significance correlations are surfaced as "Signal Clusters"
  in the Intelligence feed with an AI-generated narrative:
  "Three simultaneous events on March 14 involving Entity A, B, and C
  suggest coordinated activity. The probability of this co-occurrence
  being coincidental is less than 2%."

--------------------------------------------------------------
DECEPTION DETECTION
--------------------------------------------------------------

WHAT IT IS:
Documents and data submitted by subjects under investigation
may be falsified, manipulated, or selectively true. The deception
detection layer analyzes the evidence corpus for internal
inconsistencies, statistical anomalies, and document manipulation.

TECHNIQUES:
  BENFORD'S LAW ANALYSIS
    For any financial dataset, the first digits of amounts should
    follow Benford's distribution (1 appears most often, 9 least).
    Significant deviation from Benford's Law in a financial dataset
    is a red flag for fabrication or manipulation.

  CROSS-SOURCE CONSISTENCY CHECK
    Extract the same fact from multiple sources (e.g., company revenue
    from their annual report, their SEC filing, and a news article).
    Flag inconsistencies between sources that should agree.
    Rank inconsistencies by magnitude and significance.

  DOCUMENT METADATA ANALYSIS
    PDF and Word documents carry metadata: creation date, modification
    date, author, software version, embedded GPS coordinates (for
    scanned documents). Flag documents whose metadata is inconsistent
    with their claimed date or origin.

  WRITING STYLE ANALYSIS
    When multiple documents are claimed to come from the same author,
    verify stylistic consistency using authorship attribution models.
    If writing style changes significantly, the author may have changed
    — suggesting fabrication or modification.

  STATISTICAL ANOMALIES
    Round number clustering (all figures are round numbers — suspicious
    in naturally-generated financial data), zero clustering (too many
    zero values), digit repetition (suspicious patterns in the data).


==============================================================
SECTION 4 — COLLABORATION AND OPERATIONS
Making AZPLEN a team platform, not a solo tool
==============================================================

--------------------------------------------------------------
SHARED INTELLIGENCE LIBRARY
--------------------------------------------------------------

WHAT IT IS:
When an analyst finishes an investigation of "ACME Corp," the next
analyst who investigates "ACME Corp" should start from where the
first one left off — not from zero. The Shared Intelligence Library
is an organization-wide repository of established intelligence
findings.

HOW IT WORKS:
  When an investigation is closed and a report is published,
  the analyst can promote findings to the Shared Library.
  A "finding" is a structured object:
    — Entity (who the finding is about)
    — Finding type (beneficial owner, location, relationship, activity)
    — Finding content (what was found)
    — Classification level
    — Confidence level
    — Evidence links (source documents)
    — Date assessed
    — Expiry date (when this finding should be re-verified)

  The Shared Library is searchable. When a new session starts,
  the system automatically searches the library for relevant findings.
  "You are investigating [entity]. 7 findings exist in the library.
  [3 are still within their validity period. 4 have expired and should
  be re-verified.] Import them into this session?"

  Findings can be challenged: another analyst can log a dissent
  with their reasoning, creating a structured disagreement record.

--------------------------------------------------------------
COLLABORATIVE ANALYSIS SESSIONS
--------------------------------------------------------------

WHAT IT IS:
Multiple analysts working on the same session simultaneously,
seeing each other's actions in real time.

HOW IT WORKS:
  Real-time presence indicators: who else is in this session,
  shown as colored user avatars with their name.

  Live cursor positions: in the graph, an entity being hovered
  by another analyst shows their colored avatar label.
  In the table, cells being viewed by others are highlighted.

  Collaborative annotations: any analyst can add a sticky note
  to any entity or relationship visible to all collaborators.

  Action broadcasting: "Analyst Chen just merged 3 entities"
  appears as a live activity feed, updating for all collaborators.

  Conflict resolution: if two analysts edit the same entity
  attribute simultaneously, CRDT-based conflict resolution
  (last write from the highest-clearance analyst wins, or
  a merge prompt is shown).

  Session chat: a persistent chat panel within the session
  for discussion without leaving AZPLEN. Messages reference
  entities, documents, and relationships as clickable links.

--------------------------------------------------------------
INTELLIGENCE REVIEW BOARD WORKFLOW
--------------------------------------------------------------

WHAT IT IS:
Before intelligence is acted upon, it must be reviewed. In structured
intelligence organizations, all significant assessments go through
a review process: peer review, senior review, legal review.

AZPLEN builds this workflow natively:

  SUBMISSION
    Analyst submits a completed report for review.
    Specifies the review track: peer / senior / legal / all three.
    The report is locked for editing during review.

  PEER REVIEW
    Assigned peer reviewer receives the submission.
    They can annotate any section, ask questions, and approve or
    return for revision. Their comments are visible to the analyst.

  SENIOR REVIEW
    After peer review, the senior reviewer receives the draft.
    They approve or return with comments.
    The senior reviewer can adjust the overall confidence rating.

  LEGAL REVIEW
    For reports involving legally sensitive matters (potential
    criminal activity, litigation support, regulatory matters),
    a legal reviewer checks for appropriate caveating, correct
    handling of privileged information, and compliance with
    reporting obligations.

  FINAL PUBLICATION
    After all required reviews pass, the report is published.
    The publication record shows who reviewed it, when, and
    what changes were made at each stage.

  DISSENT REGISTER
    A reviewer who disagrees with a conclusion but cannot block
    publication can file a formal dissent that is included in
    the published report: "Note: Reviewer [X] disagrees with
    the assessment in Section 3 for the following reasons: [Y]."

--------------------------------------------------------------
EVIDENCE MANAGEMENT SYSTEM
--------------------------------------------------------------

WHAT IT IS:
In legal and regulatory proceedings, evidence must be handled in
a legally defensible way. The chain of custody must be documented.
Evidence must be preserved in its original form. Analysis must be
auditable. AZPLEN's current approach to documents is functional
for analysis but not legally defensible.

THE EVIDENCE MANAGEMENT SYSTEM:

  INTAKE HASHING
    Every document is SHA-256 hashed on ingestion. The hash and
    the original file bytes are both stored. At any future point,
    the operator can prove that a document has not been modified
    since ingestion by recomputing the hash.

  CHAIN OF CUSTODY LOG
    Every action on every document is logged: who uploaded it,
    when, from what source, who has accessed it, who has analyzed it,
    what transformations were applied to it.

  LEGAL HOLD
    Mark specific documents as under legal hold. Documents on legal
    hold cannot be deleted, cannot be modified, and cannot be
    excluded from the session even if the session is closed.
    Legal hold is logged with the date and the authorizing official.

  EXHIBIT PACKAGING
    When preparing evidence for legal proceedings, the operator
    selects documents and packages them as an "exhibit set":
    a numbered, indexed, hashed collection with a chain of custody
    document, a manifest listing all included documents, and
    a cover page identifying the case and the exhibit set.

  REDACTION WORKFLOW
    For documents containing privileged or protected information,
    a redaction workflow allows the operator to manually mark
    regions for redaction. The redacted version is stored separately
    from the original. The original is preserved under access control.

--------------------------------------------------------------
ANALYST TRAINING ENVIRONMENT
--------------------------------------------------------------

WHAT IT IS:
New analysts need to learn how to use AZPLEN and how to conduct
investigations. The AIPBootcamps panel exists but is currently
a stub. A real training environment is a significant value-add.

THE TRAINING ENVIRONMENT:
  SYNTHETIC INVESTIGATION SCENARIOS
    Pre-built investigation scenarios with synthetic data —
    fake companies, fake people, fake financial records, fake
    documents — designed to illustrate specific analytical concepts
    and techniques. The synthetic data is indistinguishable from
    real data in structure and complexity.

    Scenario types:
    — Shell company identification (beginner)
    — Sanctions evasion via trade finance (intermediate)
    — Complex beneficial ownership chain (intermediate)
    — Multi-jurisdictional fraud network (advanced)
    — Counter-proliferation financing (advanced)
    — State-sponsored corporate espionage (expert)

  GUIDED WALKTHROUGHS
    Each scenario has a guided mode: the system explains what to do
    at each step, why it is important, and what to look for.
    The analyst completes each step before the next is revealed.

  ASSESSMENT MODE
    Each scenario has an assessment mode: the analyst completes
    the investigation independently. The system evaluates their
    conclusions against the ground truth hidden in the synthetic data.
    Scoring: did they find the key entities? Did they correctly
    assess the relationships? Did they identify the primary threat?

  ANALYST CERTIFICATION
    Completing a defined set of scenarios at passing scores
    generates an analyst certification: AZPLEN Certified Analyst
    (Level 1 / 2 / 3) — visible on their profile.

  TECHNIQUE LIBRARY
    Beyond scenarios, a searchable library of intelligence analysis
    techniques: what they are, when to use them, how to use them
    in AZPLEN, and example cases where they produced results.


==============================================================
SECTION 5 — INTEGRATION ECOSYSTEM
Every system AZPLEN should talk to
==============================================================

--------------------------------------------------------------
GOVERNMENT AND REGULATORY DATABASES
--------------------------------------------------------------

  — SAM.gov (US government contractor database)
  — PACER (US federal court records)
  — European Business Register
  — World Bank debarment list
  — FATF grey/black list countries
  — Financial Crimes Enforcement Network (FinCEN) advisories
  — Interpol Red Notice database (public notices)
  — US Department of Justice press releases (via RSS)
  — BIS Entity List (US export controls)
  — CAATSA/EO sanctions lists (US)

Each integration delivers data as enrichment attributes on entities,
checked automatically whenever an entity is created or imported.

--------------------------------------------------------------
INTELLIGENCE COMMUNITY STANDARDS
--------------------------------------------------------------

  STIX/TAXII INTEGRATION
    The Structured Threat Information eXpression (STIX) format is the
    standard for sharing threat intelligence. AZPLEN should be able to:
    — Import STIX 2.1 bundles (threat actors, malware, indicators of
      compromise, campaign data, relationships)
    — Export AZPLEN sessions as STIX 2.1 bundles for sharing with
      other platforms
    — Connect to TAXII 2.1 servers (public and private threat intel feeds)
      and automatically ingest new intelligence objects

  MISP INTEGRATION
    MISP (Malware Information Sharing Platform) is widely used in
    both government and private sector intelligence sharing.
    Connect to MISP instances to import and export events.

  OpenCTI INTEGRATION
    OpenCTI is an open-source threat intelligence platform. Integration
    allows sharing findings with organizations using OpenCTI.

--------------------------------------------------------------
ANALYST TOOLCHAIN INTEGRATIONS
--------------------------------------------------------------

  MALTEGO INTEGRATION
    Maltego is the standard link analysis tool in professional
    intelligence communities. Export AZPLEN entities and relationships
    as a Maltego graph (.mtz format) for analysts who use both tools.

  i2 ANALYST'S NOTEBOOK INTEGRATION
    The IBM i2 Analyst's Notebook (.anb format) is used by law
    enforcement and intelligence agencies worldwide. Export/import
    support makes AZPLEN interoperable with existing infrastructure.

  LINK ANALYSIS FORMATS
    Export entity and relationship data as:
    — GraphML (standard graph format, importable by many tools)
    — GDF (GUESS graph format)
    — GEXF (Gephi format — the gold standard for academic network analysis)
    — Pajek .net format (used in social network analysis research)

--------------------------------------------------------------
VISUALIZATION AND REPORTING INTEGRATIONS
--------------------------------------------------------------

  POWER BI CONNECTOR
    A custom Power BI connector that allows organizations with existing
    BI infrastructure to pull AZPLEN analysis results directly into
    their Power BI dashboards.

  TABLEAU INTEGRATION
    Export AZPLEN data in Tableau-compatible formats (.hyper files)
    or connect via the Tableau Web Data Connector standard.

  GOOGLE LOOKER STUDIO
    A Looker Studio connector for organizations in the Google ecosystem.

  JUPYTER NOTEBOOK INTEGRATION
    For data science teams, a Python SDK that allows AZPLEN sessions
    to be accessed programmatically from Jupyter notebooks:
    ```python
    from azplen import Session
    session = Session("session-id")
    entities = session.entities.filter(type="organization")
    graph = session.graph.as_networkx()
    ```

--------------------------------------------------------------
COMMUNICATION AND WORKFLOW INTEGRATIONS
--------------------------------------------------------------

  SLACK / TEAMS INTEGRATION
    Send AZPLEN alerts to Slack or Teams channels.
    A monitoring rule fires → a Slack message appears with the
    alert details and a link directly to the triggering entity in AZPLEN.

  JIRA / SERVICENOW INTEGRATION
    Create investigation tasks in Jira or ServiceNow from AZPLEN.
    When a new entity is flagged as high-risk, automatically create
    a ticket in the organization's case management system.

  EMAIL REPORT DELIVERY
    Schedule weekly or daily report digests delivered to specified
    email addresses. The digest includes: new entities detected,
    monitoring alerts triggered, investigation status updates,
    and newly generated insights.

  WEBHOOK OUTBOUND
    When a significant event occurs in AZPLEN (high-confidence entity
    detected, monitoring threshold exceeded, case status changed),
    fire a configurable webhook to any external system. This is the
    universal integration layer for systems without native connectors.


==============================================================
SECTION 6 — THE MOBILE AND FIELD INTELLIGENCE LAYER
AZPLEN beyond the desktop
==============================================================

--------------------------------------------------------------
MOBILE INTELLIGENCE READER
--------------------------------------------------------------

Full AZPLEN on mobile is impractical — the graph, the table,
the pipeline builder require screen real estate that a phone cannot
provide. But a mobile-optimized intelligence reader serves the analyst
who needs to consume and annotate findings in the field.

MOBILE FEATURES:
  — Session status overview: entity count, document count, alert status
  — Active alerts: new monitoring alerts, with one-tap acknowledge
  — Entity search: find any entity in the session and view its profile
  — Report reader: read generated reports in a mobile-optimized format
  — Quick ingest: photograph a document with the device camera and
    ingest it into the active session. OCR runs automatically.
  — Audio notes: record an audio note linked to a specific entity.
    The note is transcribed automatically and attached as an attribute.
  — Offline mode: cache the active session's entity and relationship
    data locally. Continue reading and annotating without connectivity.
    Changes sync when connectivity is restored.

--------------------------------------------------------------
FIELD COLLECTION APP
--------------------------------------------------------------

For investigations that involve field collection — interviews,
site visits, document handoffs — a dedicated collection interface:

  INTERVIEW TEMPLATE
    Structured form for recording interview notes.
    The interviewer selects which entities are being discussed.
    Their notes are linked to those entities and ingested as a
    document with the interview date, location, and interviewer identity.

  SITE VISIT LOG
    Record observations from a physical location visit.
    GPS coordinates automatically captured.
    Photos taken become ingested documents linked to the location entity.

  DOCUMENT RECEIPT
    When a physical document is received, photograph it and create
    a chain of custody record: who provided it, when, where, in what
    format, with what condition notes.

  BIOMETRIC LOGGING (ADVANCED)
    For organizations with the appropriate legal frameworks:
    voice-print logging of field interviews (with consent), facial
    recognition against watchlists for in-person subject identification.


==============================================================
SECTION 7 — AI CAPABILITIES BEYOND CURRENT IMPLEMENTATION
What the AI should do that it does not do today
==============================================================

--------------------------------------------------------------
MULTI-DOCUMENT SYNTHESIS ENGINE
--------------------------------------------------------------

CURRENT STATE: The Insights panel runs AI analysis on individual
datasets. There is no AI capability that reads across the entire
document corpus simultaneously and synthesizes a unified picture.

THE SYNTHESIS ENGINE:
  When the operator triggers a synthesis run, the engine:
  1. Retrieves all documents in the session
  2. For large sessions, chunks and embeds all document content
  3. Uses a Retrieval-Augmented Generation (RAG) architecture:
     the AI retrieves relevant passages from the corpus in response
     to its own internally-generated analytical questions
  4. Synthesizes a comprehensive intelligence assessment covering:
     — Key entities and their roles
     — Key relationships and their significance
     — Timeline of events
     — Identified patterns
     — Intelligence gaps
     — Confidence assessment
     — Key judgments

  The synthesis cites specific documents and passages for every claim.
  The operator can click any citation to go directly to that passage.

--------------------------------------------------------------
CONTRADICTIONS DETECTOR
--------------------------------------------------------------

CURRENT STATE: No capability to identify when sources disagree.

THE CONTRADICTIONS DETECTOR:
  The AI reads all documents looking for statements that contradict
  each other. Sources: document A says company X is headquartered
  in London. Document B says company X is headquartered in Singapore.
  The AI surfaces this as a contradiction, provides both statements
  with their source documents, and asks: "Which source is authoritative?
  Or does this indicate that the headquarters changed?"

  Contradiction types detected:
  — Factual contradictions (different values for the same attribute)
  — Temporal contradictions (event A said to predate B in one source,
    but follow B in another)
  — Relationship contradictions (A said to control B in one source,
    B said to control A in another)
  — Status contradictions (entity A said to be active in one source,
    dissolved in another)

--------------------------------------------------------------
AUTOMATED INTELLIGENCE QUESTIONS
--------------------------------------------------------------

CURRENT STATE: The operator must formulate their own analytical questions.

AUTOMATED INTELLIGENCE QUESTIONS:
  As documents are ingested and entities extracted, the AI
  continuously generates analytical questions that the current
  evidence does not answer:

  "You have identified 14 transactions totaling $4.2M between
  Entity A and Entity B between 2021-2023. However:
  1. What was the stated business purpose of these transactions?
  2. Are Entity A and Entity B related parties?
  3. Were these transactions disclosed in Entity A's regulatory filings?
  4. What is the source of funds for Entity A?"

  These questions are displayed in the Intelligence Gaps panel.
  For each question, the AI suggests what type of document or
  data source would answer it.

--------------------------------------------------------------
ADVERSARIAL RED TEAM
--------------------------------------------------------------

CURRENT STATE: No challenge function.

THE ADVERSARIAL RED TEAM:
  Before a report is published, the analyst can request a red team.
  The AI takes the position of an adversary who is trying to refute
  the assessment. It generates the strongest possible counter-argument
  to each key judgment:

  ANALYST JUDGMENT: "Entity A is the beneficial owner of Shell Corp B."
  RED TEAM CHALLENGE: "The evidence for this conclusion rests on three
  sources: Document 1 (which is a secondary source citing Document 2),
  Document 2 (which was produced by Entity A's own legal counsel),
  and Document 3 (which dates from 2019 — three ownership changes ago).
  Alternative explanation: the current beneficial owner is unknown and
  may differ significantly from what the documents suggest."

  The analyst must address each red team challenge before the report
  is finalized. This forces explicit acknowledgment of evidentiary
  weaknesses and alternative explanations.

--------------------------------------------------------------
INTELLIGENCE FUSION AI
--------------------------------------------------------------

WHAT IT IS:
The ultimate AI capability — fusing signals from all sources
(documents, entities, relationships, financial flows, communications
patterns, behavioral patterns, external enrichment, temporal data)
into a unified assessment with explicit uncertainty quantification.

THE FUSION AI:
  Processes all available evidence
  Builds a probabilistic model of the investigation scenario
  Outputs structured assessments with confidence levels at each level:
    — Entity-level: "We assess with HIGH confidence that..."
    — Relationship-level: "We assess with MODERATE confidence that..."
    — Scenario-level: "We assess with LOW-MODERATE confidence that..."
  Explicit uncertainty: "The following unknowns materially affect
  this assessment: [list]. If [X] were confirmed, confidence would
  increase to HIGH. If [Y] were confirmed, this assessment would
  be substantially revised."
  Tracks how the assessment changes as new evidence is ingested.
  Historical assessment audit: every version of the AI assessment,
  at every stage of the investigation, is preserved.

This is not a single-shot AI response. It is a continuously updated
intelligence picture that evolves with every new piece of evidence —
the core promise of the Palantir platform, built natively into AZPLEN.

==============================================================
END — AZPLEN EXPANDED IDEAS
Zophiel · House of Asher
==============================================================