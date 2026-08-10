// dorkDomainDoctrine.ts — AUREON DORK PATTERN DATABASE
//
// DOCTRINE SHIFT (v3):
//   The previous file was a catalog of 55 named sites with canonical query
//   seeds — a database of FACTS ("site:pacer.gov works", "site:sec.gov works").
//   Facts age, get gated, get de-indexed, and teach the model to imitate
//   instead of think. This file replaces that with a database of THINKING
//   PATTERNS — subject-independent OPERATIONS the model executes to generate
//   novel dorks from first principles for any target, any surface, any year.
//
//   Rule (mirrors thinkingPatterns.ts, patternRecognitionEngine.ts, domainAtlas.ts):
//     Don't give AUREON a database of facts. Give AUREON a database of
//     THINKING PATTERNS.
//
//   Every entry below is one OPERATION — a move the model performs. It names:
//     • premise    — the invariant about how public information leaks
//     • operation  — the move to execute (what to construct, not what to type)
//     • parameters — the variables that make the operation subject-agnostic
//     • pivotsTo   — which sibling operations the yield naturally feeds
//     • trap       — the failure mode this operation is prone to
//
//   The engine consumes this as SUBSTRATE. Concrete queries are emitted at
//   run time by composing operations against the current target. No canonical
//   query strings live here anymore; that was the fact-database anti-pattern.
//
// Legacy exports preserved for wiring stability:
//   DomainEntry, DORK_DOMAINS, ROOT_CAUSE_PATTERNS, NOVEL_SYNTHESIS_SYSTEM,
//   doctrineDigest — all still importable, but their content is now pattern
//   operations, not named sites.

export type PatternFamily =
  | "exposure_primitive"   // WHY a class of artifact ends up publicly indexed
  | "operator_move"        // HOW to construct a query that surfaces it
  | "pivot_move"           // WHERE a hit legally forwards to a new terrain
  | "composition_law"      // COMPOSITION rule that binds moves into a chain
  | "abstention_law";      // WHEN to refuse — the wisdom layer

export interface DomainEntry {
  id: number;
  /** Kept for wiring compat; now names the PATTERN FAMILY, not a topical tier. */
  tier: PatternFamily;
  /** Short verb-first pattern name (a MOVE, not a subject). */
  name: string;
  /** The invariant that makes the operation work regardless of subject. */
  rootCause: string;
  /**
   * OPERATIONS — imperative moves the model executes. Written as verbs, not
   * as canned queries. The model composes concrete Google syntax at runtime
   * against `{{t}}` (target) and `{{d}}` (target's domain hint) plus any
   * discovered pivot tokens. Never emit these as-is; they are recipes.
   */
  seeds: string[];
  /** Sibling operation ids a productive hit naturally forwards into. */
  pivotsTo: number[];
  /** Characteristic failure mode — silence is not evidence; name the trap. */
  trap?: string;
}

// ── 24 PATTERN OPERATIONS ──────────────────────────────────────────────────
// Ordered so ids 1-8 are exposure primitives (WHY things leak), 9-16 are
// operator moves (HOW to construct), 17-20 are pivot moves (WHERE hits go
// next), 21-23 are composition laws, 24 is the abstention law.
export const DORK_DOMAINS: DomainEntry[] = [
  // ── EXPOSURE PRIMITIVES — 8 invariants about how public information leaks
  { id: 1, tier: "exposure_primitive", name: "MANDATED-DISCLOSURE PATTERN",
    rootCause: "Law compels an entity to publish structured records at scheduled cadence; the filer's compliance mindset makes them under-estimate what a full-text index does to those records.",
    seeds: [
      "Enumerate the classes of entity in the target's terrain that face compulsory public filing (regulatory, judicial, electoral, procurement, licensing, tax-exempt).",
      "For each class, name the artifact type (docket, statement, roster, register) and its publication cadence — the cadence tells you WHEN a fresh copy exists.",
      "Compose a query that anchors on the artifact's structural tokens (form number, docket header, statutory phrase), never on the target alone.",
    ],
    pivotsTo: [2, 5, 6, 17, 18],
    trap: "Assuming redaction is applied consistently — older cohorts of the same filing usually predate the redaction rule." },

  { id: 2, tier: "exposure_primitive", name: "OPERATOR-ERROR PATTERN",
    rootCause: "Systems deployed for internal use forget the public internet can reach them; the same person who provisions the box owns its ACLs, and 'move fast' beats 'review access.'",
    seeds: [
      "Model the human who deployed the surface: what role, what pressure, what folder did they forget to lock.",
      "Enumerate the artifacts that role produces mechanically (backups, exports, staging copies, share links) — those are what leaks, not the primary asset.",
      "Compose queries against the artifact's default filename or extension family rather than against the target.",
    ],
    pivotsTo: [3, 11, 14, 20],
    trap: "Chasing the primary asset when the leak is always a byproduct file next to it." },

  { id: 3, tier: "exposure_primitive", name: "MIGRATION-RESIDUE PATTERN",
    rootCause: "System migrations create temporary exposures that become permanent — the old host is deprecated, not deleted, and the search index outlives the intent.",
    seeds: [
      "Identify likely migration events on the target (stack change, vendor swap, rebrand, acquisition).",
      "Construct queries against the deprecated hostname pattern, not the current one — the residue is where fresh ACLs were never applied.",
      "Cross the residue against archival mirrors so a de-listed page still returns a body.",
    ],
    pivotsTo: [7, 15, 19],
    trap: "Believing that a 404 today means the artifact was never indexed." },

  { id: 4, tier: "exposure_primitive", name: "REPRODUCIBILITY PATTERN",
    rootCause: "Publication norms in research reward publishing raw data alongside the paper; deidentification is often weaker than the authors believe because they optimise for reviewers, not adversaries.",
    seeds: [
      "For any research-adjacent target, enumerate the artifact classes produced downstream of publication (dataset dumps, supplementary materials, code repos, grant abstracts, dissertation appendices).",
      "Anchor queries on the acknowledgment or funding-source token, then intersect with the target — funders are the rarest joining tokens.",
      "Prefer preprint and thesis surfaces for pre-review versions that reveal what the final paper redacted.",
    ],
    pivotsTo: [17, 18],
    trap: "Treating the paper as the artifact when the SUPPLEMENT is always the leak." },

  { id: 5, tier: "exposure_primitive", name: "HIGH-TRUST LOW-TECH PATTERN",
    rootCause: "Organisations with high interpersonal trust and low IT sophistication (community groups, congregations, HOAs, small nonprofits, alumni orgs) upload member rosters and directories directly to public web roots.",
    seeds: [
      "Identify the affinity groups the target is likely embedded in (community, faith, hobby, alumni, professional).",
      "Compose queries against the DIRECTORY artifact class (rosters, member lists, contact PDFs) using the group's shibboleth vocabulary, not the target's name.",
      "Then intersect with the target only after the artifact family is confirmed to exist.",
    ],
    pivotsTo: [17, 20],
    trap: "Starting with the person — always start with the artifact family and end with the person." },

  { id: 6, tier: "exposure_primitive", name: "PUBLIC-LEDGER PERSISTENCE PATTERN",
    rootCause: "Ledgers designed for immutability (blockchain, certificate-transparency logs, court dockets, patent grants) preserve every association ever made — a single moment of identity linkage becomes permanent.",
    seeds: [
      "Identify which immutable ledgers plausibly touch the target's terrain.",
      "Query against the ledger's structural anchors (issuer, assignee, cert SAN, tx hash pattern) rather than the target's plaintext identity.",
      "Compose a temporal query — 'earliest appearance of X on ledger Y' — because the first linkage is usually the one the target forgot they made.",
    ],
    pivotsTo: [10, 19],
    trap: "Treating recent activity as the signal when the OLDEST record is what pierces anonymity." },

  { id: 7, tier: "exposure_primitive", name: "BANNER-AND-METADATA PATTERN",
    rootCause: "Every server emits identifying banners, headers, and metadata that describe the stack, version, and internal hostnames — this is unavoidable protocol behavior.",
    seeds: [
      "Enumerate the protocols the target's infrastructure necessarily speaks (HTTP, TLS, SMTP, DNS, NTP).",
      "Query against the banner artifacts each protocol emits (headers, cert SAN lists, MX records, error pages).",
      "Compose an intersection query that binds the banner to the target's domain hint via a rare token (build number, framework signature, admin path).",
    ],
    pivotsTo: [10, 14, 15],
    trap: "Believing a CDN masks the origin — origin banners leak through error pages and legacy subdomains." },

  { id: 8, tier: "exposure_primitive", name: "REGULATORY-BLIND-SPOT PATTERN",
    rootCause: "Regulation focuses on primary custodians and misses the periphery — the target's accountants, lawyers, vendors, contractors, and consulting engagements often expose what the target itself does not.",
    seeds: [
      "Given the target, enumerate the peripheral roles that necessarily hold copies of the target's data.",
      "For each peripheral role, identify the artifact class that role produces (memos, engagement letters, deposition exhibits, subcontract SoWs).",
      "Compose queries against the peripheral artifact class using tokens the periphery uses about the target (matter number, client code, engagement label).",
    ],
    pivotsTo: [1, 8, 17],
    trap: "Hardening the primary custodian and forgetting the periphery is a leaky sieve." },

  // ── OPERATOR MOVES — 8 imperative moves that turn a primitive into a query
  { id: 9, tier: "operator_move", name: "SCOPE-BY-STRUCTURE, NOT BY SUBJECT",
    rootCause: "Queries anchored on subject strings scale linearly with noise; queries anchored on structural tokens (form headers, filename conventions, error strings) collapse the search space by orders of magnitude.",
    seeds: [
      "Draft two forms of every query: (A) subject-anchored, (B) structure-anchored.",
      "Prefer B whenever the artifact class has a stable structural token. Fall back to A only for confirmation of a specific pivot.",
      "The subject enters as the FILTER, never as the SEED.",
    ],
    pivotsTo: [10, 13, 21] },

  { id: 10, tier: "operator_move", name: "RARE-TOKEN INTERSECTION",
    rootCause: "Every artifact contains at least one token that is common in its own corpus and vanishingly rare elsewhere — grant numbers, matter numbers, docket ids, cert serials, N-numbers, assignee blocks, ORCID ids.",
    seeds: [
      "For every candidate artifact class, identify its rarest joining token — the one that has near-zero collision outside the class.",
      "Compose intersection queries where the rare token binds two independent artifact families to the same target.",
      "A hit under a rare-token intersection is worth ten hits under a common-word query.",
    ],
    pivotsTo: [21] },

  { id: 11, tier: "operator_move", name: "SIBLING-SURFACE FAN-OUT",
    rootCause: "Behind every discovered surface there are siblings — .bak / .old / _backup / staging. / dev. / uat. / .git / .DS_Store — because operators reproduce their local habits on the deployed host.",
    seeds: [
      "For any confirmed host, fan out queries against its sibling namespaces before deepening on the primary.",
      "The sibling is usually less-hardened than the primary and often carries the same content minus the ACL.",
      "Rate-limit fan-out to avoid tripping shared throttles — depth first, breadth second." ,
    ],
    pivotsTo: [3, 15, 22] },

  { id: 12, tier: "operator_move", name: "ARCHIVE-DELTA MOVE",
    rootCause: "Live pages hide what they no longer wish to expose; archives keep the state that produced the current redaction and let you diff.",
    seeds: [
      "For any high-value surface, run the same query against archival mirrors and compute the delta against live.",
      "The DELTA — not the archive itself — is the signal: it names exactly what the operator chose to remove.",
      "Prefer archives with dense capture cadence over comprehensive-but-sparse ones.",
    ],
    pivotsTo: [3] },

  { id: 13, tier: "operator_move", name: "STACK-PROFILE FIRST, QUERY SECOND",
    rootCause: "Every stack throws characteristic error strings, default admin paths, and version disclosures — knowing the stack turns a generic query into a precision instrument.",
    seeds: [
      "Before emitting any dork on a domain target, spend the first query on stack identification (banner, favicon hash, robots.txt, sitemap.xml).",
      "Every subsequent query is now conditioned on the stack — use its default paths, its error strings, its backup extensions.",
      "A generic dork on an unknown stack is BASIC-tier; refuse to emit it.",
    ],
    pivotsTo: [7, 11] },

  { id: 14, tier: "operator_move", name: "TEMPORAL WINDOWING",
    rootCause: "Public artifacts are produced on cadences (filing deadlines, court calendars, release cycles, academic terms); a window aligned to a known cadence multiplies signal.",
    seeds: [
      "Identify the cadence that governs the artifact class in question.",
      "Window the query to the current or immediately-past cadence bucket — that's where fresh, un-ACL'd copies live.",
      "For legacy exposure, window to the cadence bucket that predates the redaction rule.",
    ],
    pivotsTo: [1, 6] },

  { id: 15, tier: "operator_move", name: "INDEX-VS-USER MOVE",
    rootCause: "The user sees the page; the index sees sitemap.xml, robots.txt, structured-data blocks, and cached snapshots. What the index sees is often what the operator forgot the index would see.",
    seeds: [
      "Query against index-facing artifacts (sitemap.xml, robots.txt disallow lists, JSON-LD, cache: pivots) before human-facing pages.",
      "A disallow list is a confession: it names the paths the operator did not want indexed — and often those paths are still reachable.",
    ],
    pivotsTo: [3, 22] },

  { id: 16, tier: "operator_move", name: "PERIPHERY-AS-ENTRY MOVE",
    rootCause: "Hardened targets have soft peripheries (interns, vendors, contractors, spouses, alumni pages, personal blogs of employees); the periphery leaks what the target hardens.",
    seeds: [
      "Enumerate the periphery of the target (2 hops out from the primary).",
      "Emit queries against the periphery's artifact classes, anchored on tokens the periphery uses about the target.",
      "Never emit a periphery query that names a private individual with no public-interest hook — that's a wisdom violation (see id 24).",
    ],
    pivotsTo: [8, 17] },

  // ── PIVOT MOVES — 4 rules for what a productive hit implies next
  { id: 17, tier: "pivot_move", name: "IDENTIFIER-PROMOTION PIVOT",
    rootCause: "A hit yields new identifiers (a matter number, a co-signer, a filed-with entity, an assignee address); those identifiers become the next round's rare-token seeds.",
    seeds: [
      "Extract every proper noun, numeric identifier, and structural token from a productive hit.",
      "Promote the rarest 1-2 tokens to the seed slot of the next query.",
      "Discard tokens that collide with common corpus terms — rare-only, always.",
    ],
    pivotsTo: [10] },

  { id: 18, tier: "pivot_move", name: "TERRAIN-CROSSING PIVOT",
    rootCause: "A hit in one terrain (regulatory, research, infrastructure, ledger) usually implicates a specific sibling terrain — a filing implies a filer's peripheral vendors, a paper implies a funder's grants database.",
    seeds: [
      "For every hit, name the sibling terrain the artifact necessarily touches.",
      "Emit the next query in the sibling terrain, not the hit's own.",
      "This is the cross-tier fusion move — where BASIC operators stop and ELITE operators start.",
    ],
    pivotsTo: [4, 8] },

  { id: 19, tier: "pivot_move", name: "INFRASTRUCTURE-BINDING PIVOT",
    rootCause: "Any hit that discloses a hostname, cert, ASN, or IP block binds the target to an infrastructure operator whose OTHER tenants may have leaked what the target did not.",
    seeds: [
      "Bind hostnames from hits back to their ASN and cert issuer.",
      "Enumerate co-tenants under the same ASN or issuer — those are lateral surfaces sharing the same operator's habits.",
      "A shared operator is a shared leak profile.",
    ],
    pivotsTo: [7] },

  { id: 20, tier: "pivot_move", name: "SOCIAL-FUSION PIVOT",
    rootCause: "Every technical hit eventually fuses at a human — the value is not the hit, it is the pretext quality the fused hits enable.",
    seeds: [
      "Roll every productive hit into a pretext ledger: what could a benign, high-context request now credibly ask?",
      "Rank pretexts by specificity of the fused context, not by count of hits.",
      "The fusion is offensive substrate — see the abstention law (id 24) before acting on it.",
    ],
    pivotsTo: [16] },

  // ── COMPOSITION LAWS — 3 rules that bind operations into chains
  { id: 21, tier: "composition_law", name: "TWO-DOMAIN LAW",
    rootCause: "A dork that draws on only one exposure primitive is a documented dork; a dork that binds two primitives through a rare token is a first-to-find.",
    seeds: [
      "Every emitted query must reference at least two distinct exposure primitives.",
      "The junction between the primitives is where the elite yield lives.",
      "Single-primitive queries are permitted only as stack-profile probes (see id 13).",
    ],
    pivotsTo: [10] },

  { id: 22, tier: "composition_law", name: "SIGNAL-VS-NOISE LAW",
    rootCause: "Every query has an expected yield profile; if the return exceeds the profile by 10x, the query is broken and its results are noise, not signal.",
    seeds: [
      "For every query, predict the yield in advance (order of magnitude).",
      "If actual returns exceed the prediction by 10x or more, discard and reformulate — do not sift the noise.",
      "Silence is not evidence, but neither is a flood.",
    ],
    pivotsTo: [11] },

  { id: 23, tier: "composition_law", name: "PROVENANCE LAW",
    rootCause: "A hit without a named artifact class, terrain, and operation is not a finding — it is a fragment that cannot be defended or reproduced.",
    seeds: [
      "Every reported hit is tagged with (a) the operation that produced it, (b) the artifact class, (c) the terrain, (d) the rare token that bound it.",
      "Any hit missing any of the four is downgraded to hypothesis, not finding.",
      "Untagged hits corrupt downstream chains — reject them at the source.",
    ],
    pivotsTo: [17] },

  // ── ABSTENTION LAW — the wisdom layer
  { id: 24, tier: "abstention_law", name: "WISDOM ABSTENTION",
    rootCause: "The maturity of the operator is measured by which queries are NOT emitted; the highest tier is the one that refuses when the target is a private person with no public-interest hook, when the operation would harden a hardened target's periphery, or when the pretext ledger would enable harm.",
    seeds: [
      "Before emitting, check: is the target a private individual with no public-interest hook, and no operator-consent nexus (self-audit, protective context)?",
      "Check: does the composition enable a pretext against a person, not a system?",
      "Check: is the artifact class one that the mandated-disclosure primitive intended to publish, or one the operator-error primitive accidentally exposed against them?",
      "When any check fails, ABSTAIN and record the reason. Abstention is a first-class output, not a null.",
    ],
    pivotsTo: [] },
];

// Root-cause patterns are now the SEVEN LAWS behind ALL operations above.
// (Renamed from a list of 10 anecdotal behaviors to seven enforceable laws.)
export const ROOT_CAUSE_PATTERNS = [
  "Law 1 — Structure beats subject. Anchor on artifact structure, not on the target's name.",
  "Law 2 — Rare tokens are the real seeds. Common words return noise; rare joining tokens collapse the space.",
  "Law 3 — Two primitives, one junction. Every elite query binds two exposure primitives at a rare token.",
  "Law 4 — Cadence is signal. Public artifacts are produced on schedules; align to the cadence, not the calendar.",
  "Law 5 — Periphery leaks what the primary hardens. Hardened targets have soft neighbors.",
  "Law 6 — The index sees what the user does not. sitemap, robots, cache, and archives outlive intent.",
  "Law 7 — Silence is not evidence, and neither is a flood. Predict yield; discard both mute and firehose returns.",
];

// ── SYNTHESIS PROMPT — teaches the model to EXECUTE operations, not RECALL sites
export const NOVEL_SYNTHESIS_SYSTEM = `You are AUREON — DORK SYNTHESIST.

DOCTRINE: You are not a database of facts. You are a database of THINKING PATTERNS. Do not recall named sites; execute pattern operations against the target and let concrete syntax fall out of the composition.

You have three registers loaded:
  • EXPOSURE PRIMITIVES (ops 1-8) — the invariants about how public information leaks.
  • OPERATOR MOVES (ops 9-16) — the imperative moves that turn a primitive into a query.
  • PIVOT MOVES (ops 17-20) — the rules for what a productive hit implies next.
  • COMPOSITION LAWS (ops 21-23) — the laws that bind operations into chains.
  • ABSTENTION LAW (op 24) — the wisdom check that runs before every emission.

Method for every query you emit:
  1. Name the two exposure primitives you are binding (TWO-DOMAIN LAW).
  2. Name the rare joining token — a form number, matter id, cert SAN, funder tag,
     assignee block, N-number, ORCID, docket header. Never a common word.
  3. Compose the query so the structure is the seed and the target is the filter.
  4. State the predicted yield profile (order of magnitude). If unknown, refuse.
  5. Name the pivot move a productive hit will feed into next.
  6. Run the ABSTENTION LAW. If any check fails, emit an abstention record instead
     of a query, with the reason. Abstention is a first-class output.

Return 10 emissions. STRICT JSON:
{
  "queries": [
    {
      "q": "<concrete Google syntax composed from operations, no canonical seeds>",
      "why": "primitives=[<id>,<id>] rare_token=<name> pivot=<id>",
      "domains": [<primitive_id>, <primitive_id>],
      "pivot": <pivot_move_id>,
      "expected_yield": "<'<10' | '10-100' | '100-1000' | 'reject'>",
      "abstain": false
    }
  ]
}

Hard rules:
- No emission may repeat a documented dork string — you no longer have one to repeat.
- Every "why" must name TWO primitive ids AND one pivot id.
- Every emission carries an expected-yield profile; 'reject' means the composition was ill-formed.
- If ABSTENTION fires, emit { "q": "", "abstain": true, "why": "<check that failed>" } in place of the query.
- Perform the moves silently. Do NOT name "the pattern database," "the primitives," or "the doctrine" in the query text itself — those labels belong only in the "why" field.`;

// Compact doctrine summary for injection into the model's user message.
// Renders as a PATTERN INDEX, not as a site catalog — the model reads it as a
// menu of moves to execute, not a menu of sites to recall.
export function doctrineDigest(): string {
  const byFamily: Record<PatternFamily, DomainEntry[]> = {
    exposure_primitive: [],
    operator_move: [],
    pivot_move: [],
    composition_law: [],
    abstention_law: [],
  };
  for (const d of DORK_DOMAINS) byFamily[d.tier].push(d);

  const label: Record<PatternFamily, string> = {
    exposure_primitive: "EXPOSURE PRIMITIVES (why public information leaks)",
    operator_move:      "OPERATOR MOVES (how to turn a primitive into a query)",
    pivot_move:         "PIVOT MOVES (where a productive hit forwards next)",
    composition_law:    "COMPOSITION LAWS (rules that bind moves into chains)",
    abstention_law:     "ABSTENTION LAW (the wisdom check before every emission)",
  };

  const lines: string[] = [];
  lines.push("# AUREON DORK PATTERN DATABASE");
  lines.push("Not a database of facts. A database of THINKING PATTERNS.");
  lines.push("Every entry is an OPERATION you execute — never a canned query you emit.");

  (Object.keys(byFamily) as PatternFamily[]).forEach((fam) => {
    lines.push(`\n## ${label[fam]}`);
    for (const d of byFamily[fam]) {
      lines.push(`- [${d.id}] ${d.name}`);
      lines.push(`    premise: ${d.rootCause}`);
      d.seeds.forEach((s, i) => lines.push(`    op${i + 1}: ${s}`));
      if (d.pivotsTo.length) lines.push(`    pivots→ ${d.pivotsTo.join(", ")}`);
      if (d.trap) lines.push(`    trap: ${d.trap}`);
    }
  });

  lines.push("\n## SEVEN LAWS (behind every operation above)");
  ROOT_CAUSE_PATTERNS.forEach((p) => lines.push(`- ${p}`));

  lines.push("\n## RULE OF USE");
  lines.push("- Execute the operations silently. Never name the database, the primitives, or the laws in the query text.");
  lines.push("- Every emission cites two primitive ids, one pivot id, one rare joining token, and a predicted yield.");
  lines.push("- Abstention is a first-class emission. Refuse before you leak.");
  return lines.join("\n");
}

// Full markdown export for the /brains download bundle.
export function fullDorkPatternDatabaseMarkdown(): string {
  return doctrineDigest();
}
