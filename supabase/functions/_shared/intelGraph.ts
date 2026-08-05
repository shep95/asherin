// intelGraph.ts — BOUNDED THREE-HOP RELATIONSHIP GRAPH
//
// NARRATIVE
// ---------
// A three-hop expansion is combinatorial: ~40 → ~1,600 → ~2,500,000. Enumerating
// ring 3 is neither possible inside a chat deadline nor useful — a 2.5M-node
// cloud carries no signal. What carries signal is the SHAPE of the near graph:
//   RING 1  full fanout of everything the subject's own documents assert
//           (relatives, co-residents, LLC co-officers, employers).
//   RING 2  a PRUNED expansion — only the ring-1 nodes with the highest
//           information gain are queried, and only their own extracted
//           entities are admitted.
//   RING 3  INTERSECTION ONLY. Ring 3 is never enumerated. Instead the engine
//           performs an O(n^2) comparison across ring-2 sets: when two distinct
//           ring-1 branches both reach the same node, that closed triangle is
//           a hidden cross-link and is emitted as an INFERRED edge. Everything
//           else in ring 3 is discarded unread.
//
// Flaw taxonomy applied:
//  - performance: node cap (MAX_NODES) and edge cap enforced on every insert;
//    intersection is O(r2^2) over a set already bounded by the node cap.
//  - data honesty: inferred edges are typed `inferred: true` and carry the two
//    paths that produced them; they are never presented as asserted facts.
//  - logic: canonical keys prevent "Robert Newton"/"ROBERT NEWTON" splitting a
//    node in two; self-edges and duplicate edges are rejected at insert time.
//  - security: pure, synchronous, no I/O — the caller owns every network call.

import {
  canonicalizeName, canonicalizeAddress,
  type FieldLedger, type ResolvedField, type Confidence,
} from "./intelExtract.ts";

export type NodeKind = "subject" | "person" | "address" | "entity" | "employer";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** 0 = subject, 1 = direct contact, 2 = contact-of-contact */
  ring: 0 | 1 | 2;
  canonical: string;
  confidence: Confidence;
  independentDomains: number;
  authoritative: boolean;
  /** typed attributes carried up from the ledger for card rendering */
  attributes: Array<{ label: string; value: string }>;
  sources: Array<{ domain: string; url: string }>;
  /** information-gain score — drives ring-2 seed selection */
  gain: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  confidence: Confidence;
  /** count of independent domains asserting this edge */
  weight: number;
  /** true when the edge was derived from a ring-2 intersection, not asserted */
  inferred?: boolean;
  rationale?: string;
  sources: Array<{ domain: string; url: string }>;
}

export interface IntelGraph {
  subjectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** closed triangles discovered by the ring-3 intersection pass */
  crossLinks: Array<{ node: string; viaA: string; viaB: string; strength: number }>;
  truncated: boolean;
}

export const MAX_NODES = 250;
const MAX_EDGES = 600;

const CONF_RANK: Record<Confidence, number> = { VERIFIED: 3, CORROBORATED: 2, REPORTED: 1 };

const KIND_OF: Partial<Record<string, NodeKind>> = {
  relative: "person",
  address: "address",
  entity: "entity",
  employer: "employer",
};

const EDGE_LABEL: Record<NodeKind, string> = {
  subject: "self",
  person: "relative / associate",
  address: "resides / owned",
  entity: "officer / registered agent",
  employer: "employment",
};

function keyFor(kind: NodeKind, value: string): string {
  const canon = kind === "address" ? canonicalizeAddress(value) : canonicalizeName(value);
  return `${kind}:${canon}`;
}

/**
 * Information gain of a candidate node: how much NEW graph a query against it
 * is likely to return. Corroboration and authority raise it; generic names and
 * already-saturated node kinds lower it.
 */
export function informationGain(kind: NodeKind, f: ResolvedField): number {
  let g = CONF_RANK[f.confidence] * 12 + Math.min(f.independentDomains, 6) * 8;
  if (f.authoritative) g += 18;
  // Name rarity: a two-token common name is a poor seed, a three-token or
  // uncommon-surname name is a strong one.
  if (kind === "person") {
    const parts = f.display.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 3) g += 10;
    if (parts.length <= 1) g -= 25;
    const surname = (parts[parts.length - 1] || "").toUpperCase();
    if (["SMITH", "JOHNSON", "BROWN", "JONES", "WILLIAMS", "DAVIS", "MILLER"].includes(surname)) g -= 12;
  }
  if (kind === "address") g += 6;      // addresses unlock co-residents + deeds
  if (kind === "entity") g += 4;       // registries unlock co-officers
  if (kind === "employer") g -= 8;     // rarely reciprocal
  return g;
}

/**
 * A branch document that names the original target is reciprocal confirmation
 * of an edge we already hold — never a new node. Matching is canonical and
 * token-based so "Asher Newton" collapses into "Asher Shepherd Newton".
 */
function isSubjectAlias(g: IntelGraph, kind: NodeKind, value: string): boolean {
  if (kind !== "person") return false;
  const subj = canonicalizeName(g.nodes[0].label).split(/\s+/).filter(Boolean);
  const cand = canonicalizeName(value).split(/\s+/).filter(Boolean);
  if (!subj.length || !cand.length) return false;
  if (subj.join(" ") === cand.join(" ")) return true;
  // first + last agreement with one side carrying a middle token
  return subj[0] === cand[0] && subj[subj.length - 1] === cand[cand.length - 1];
}


function fieldAttributes(kind: NodeKind, f: ResolvedField): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Confidence", value: f.confidence },
    { label: "Sources", value: `${f.independentDomains} independent domain${f.independentDomains === 1 ? "" : "s"}` },
  ];
  if (f.authoritative) rows.push({ label: "Authority", value: "government / registry asserted" });
  if (f.context) rows.push({ label: "Context", value: f.context.slice(0, 220) });
  if (kind === "address") rows.push({ label: "Canonical", value: f.canonical });
  return rows;
}

export function createGraph(subject: string): IntelGraph {
  return {
    subjectId: "subject",
    nodes: [{
      id: "subject",
      kind: "subject",
      label: subject,
      ring: 0,
      canonical: canonicalizeName(subject),
      confidence: "VERIFIED",
      independentDomains: 0,
      authoritative: false,
      attributes: [],
      sources: [],
      gain: 0,
    }],
    edges: [],
    crossLinks: [],
    truncated: false,
  };
}

function upsertNode(g: IntelGraph, node: GraphNode): GraphNode | null {
  const existing = g.nodes.find((n) => n.id === node.id);
  if (existing) {
    // Keep the strongest observation; a ring-1 sighting always outranks ring-2.
    if (CONF_RANK[node.confidence] > CONF_RANK[existing.confidence]) existing.confidence = node.confidence;
    existing.independentDomains = Math.max(existing.independentDomains, node.independentDomains);
    existing.authoritative = existing.authoritative || node.authoritative;
    existing.gain = Math.max(existing.gain, node.gain);
    if (node.ring < existing.ring) existing.ring = node.ring;
    return existing;
  }
  if (g.nodes.length >= MAX_NODES) { g.truncated = true; return null; }
  g.nodes.push(node);
  return node;
}

function addEdge(g: IntelGraph, edge: GraphEdge): void {
  if (edge.from === edge.to) return;
  if (g.edges.length >= MAX_EDGES) { g.truncated = true; return; }
  const dup = g.edges.find((e) =>
    (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from));
  if (dup) {
    dup.weight = Math.max(dup.weight, edge.weight);
    if (CONF_RANK[edge.confidence] > CONF_RANK[dup.confidence]) dup.confidence = edge.confidence;
    if (!edge.inferred) dup.inferred = false;
    return;
  }
  g.edges.push(edge);
}

const RING_KINDS: Array<[keyof FieldLedger["confirmed"], NodeKind]> = [
  ["relative", "person"],
  ["address", "address"],
  ["entity", "entity"],
  ["employer", "employer"],
];

/**
 * RING 1 — full fanout. Every relative, co-resident address, business entity
 * and employer asserted by the subject's own documents becomes a node.
 * Candidate-band fields are admitted but marked REPORTED, never promoted.
 */
export function ingestRing1(g: IntelGraph, ledger: FieldLedger, limitPerKind = 12): void {
  for (const [family, kind] of RING_KINDS) {
    const fields = [...ledger.confirmed[family], ...ledger.candidate[family]].slice(0, limitPerKind);
    for (const f of fields) {
      if (!f.display || f.display.length < 3) continue;
      const id = keyFor(kind, f.display);
      if (isSubjectAlias(g, kind, f.display)) continue; // subject re-assertion
      const node = upsertNode(g, {
        id, kind, label: f.display, ring: 1,
        canonical: f.canonical,
        confidence: f.confidence,
        independentDomains: f.independentDomains,
        authoritative: f.authoritative,
        attributes: fieldAttributes(kind, f),
        sources: f.sources.slice(0, 4).map((s) => ({ domain: s.domain, url: s.url })),
        gain: informationGain(kind, f),
      });
      if (!node) return;
      addEdge(g, {
        from: g.subjectId, to: id,
        label: EDGE_LABEL[kind],
        confidence: f.confidence,
        weight: f.independentDomains,
        sources: node.sources,
      });
    }
  }
}

/** Ring-1 nodes ranked by information gain — the only ones worth a ring-2 query. */
export function ring2Seeds(g: IntelGraph, max = 6): GraphNode[] {
  return g.nodes
    .filter((n) => n.ring === 1 && (n.kind === "person" || n.kind === "address" || n.kind === "entity"))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, max);
}

/**
 * RING 2 — pruned expansion. `ledger` is built ONLY from the documents that the
 * seed's own query returned, so every node admitted here is attributable to
 * that branch rather than to the subject.
 */
export function ingestRing2(g: IntelGraph, parent: GraphNode, ledger: FieldLedger, limitPerKind = 6): string[] {
  const added: string[] = [];
  for (const [family, kind] of RING_KINDS) {
    const fields = [...ledger.confirmed[family], ...ledger.candidate[family]].slice(0, limitPerKind);
    for (const f of fields) {
      if (!f.display || f.display.length < 3) continue;
      const id = keyFor(kind, f.display);
      if (id === parent.id || id === g.subjectId) continue;
      // A branch re-asserting the subject ("Asher Newton" found on the father's
      // record) is reciprocal confirmation of an existing edge, not a new node.
      if (isSubjectAlias(g, kind, f.display)) continue;

      const node = upsertNode(g, {
        id, kind, label: f.display, ring: 2,
        canonical: f.canonical,
        confidence: f.confidence,
        independentDomains: f.independentDomains,
        authoritative: f.authoritative,
        attributes: fieldAttributes(kind, f),
        sources: f.sources.slice(0, 3).map((s) => ({ domain: s.domain, url: s.url })),
        gain: informationGain(kind, f),
      });
      if (!node) return added;
      addEdge(g, {
        from: parent.id, to: id,
        label: EDGE_LABEL[kind],
        confidence: f.confidence,
        weight: f.independentDomains,
        sources: node.sources,
      });
      added.push(id);
    }
  }
  return added;
}

/**
 * RING 3 — INTERSECTION ONLY. Ring 3 is never enumerated. For every pair of
 * ring-1 branches we intersect their ring-2 reach; a node reached from two
 * different branches closes a triangle and is emitted as an INFERRED edge
 * between the two ring-1 nodes.
 */
export function intersectBranches(g: IntelGraph, branches: Map<string, string[]>): void {
  const parents = [...branches.keys()];
  for (let i = 0; i < parents.length; i++) {
    for (let j = i + 1; j < parents.length; j++) {
      const a = parents[i], b = parents[j];
      const setB = new Set(branches.get(b) || []);
      // Only genuinely NEW (ring-2) nodes count. Two branches both re-reaching
      // a node the subject already asserts is redundancy, not a hidden link.
      const shared = (branches.get(a) || [])
        .filter((id) => setB.has(id))
        .filter((id) => g.nodes.find((x) => x.id === id)?.ring === 2);

      if (!shared.length) continue;
      for (const nodeId of shared) {
        const n = g.nodes.find((x) => x.id === nodeId);
        g.crossLinks.push({
          node: n?.label || nodeId,
          viaA: g.nodes.find((x) => x.id === a)?.label || a,
          viaB: g.nodes.find((x) => x.id === b)?.label || b,
          strength: n?.independentDomains ?? 1,
        });
      }
      addEdge(g, {
        from: a, to: b,
        label: "closed triangle",
        confidence: shared.length >= 2 ? "CORROBORATED" : "REPORTED",
        weight: shared.length,
        inferred: true,
        rationale: `both branches independently reach ${shared.length} shared node${shared.length === 1 ? "" : "s"}`,
        sources: [],
      });
    }
  }
}

// ── Render for the model ───────────────────────────────────────────────────

export function formatGraph(g: IntelGraph): string {
  const ring = (r: 0 | 1 | 2) => g.nodes.filter((n) => n.ring === r);
  const r1 = ring(1), r2 = ring(2);
  const line = (n: GraphNode) => {
    const parents = g.edges.filter((e) => e.to === n.id && !e.inferred).map((e) =>
      g.nodes.find((x) => x.id === e.from)?.label).filter(Boolean);
    return `  - [${n.kind}] ${n.label} — ${n.confidence}, ${n.independentDomains} domain(s)${n.authoritative ? ", AUTHORITATIVE" : ""}${parents.length ? ` — via ${parents.join(" / ")}` : ""}`;
  };

  const out = [
    "### THREE-HOP RELATIONSHIP GRAPH (bounded)",
    `Nodes: ${g.nodes.length}${g.truncated ? " (CAP REACHED — graph truncated)" : ""} · Edges: ${g.edges.length} · Cross-links: ${g.crossLinks.length}`,
    "",
    `RING 1 — direct contacts (${r1.length}):`,
    r1.length ? r1.map(line).join("\n") : "  (none extracted)",
    "",
    `RING 2 — contacts of contacts, pruned expansion (${r2.length}):`,
    r2.length ? r2.map(line).join("\n") : "  (not reached — insufficient wall clock or no qualifying seeds)",
  ];

  if (g.crossLinks.length) {
    out.push("", `RING 3 — INTERSECTION FINDINGS (closed triangles, ${g.crossLinks.length}):`);
    out.push(...g.crossLinks.slice(0, 20).map((c) =>
      `  - ${c.viaA} ⟷ ${c.viaB} both reach ${c.node} (strength ${c.strength}) — INFERRED, not asserted by any single source`));
  } else {
    out.push("", "RING 3 — INTERSECTION FINDINGS: none. No two ring-1 branches converged on a shared node.");
  }

  out.push(
    "",
    "GRAPH RENDERING DIRECTIVE:",
    "  • Emit a ```card:relationship fence carrying these nodes and edges verbatim. Every node object MUST include `ring` (0/1/2); every edge MUST include `weight` and, where applicable, `inferred: true`.",
    "  • Inferred cross-links are HYPOTHESES produced by set intersection. Label them as inferred in prose. Never state them as confirmed relationships.",
    "  • Ring-2 nodes are contact-of-contact. Never attribute a ring-2 attribute to the subject.",
  );
  return out.join("\n");
}
