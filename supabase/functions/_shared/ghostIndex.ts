// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — Index Layer
//
// Three indexes over one normalized corpus:
//   • Inverted  — field → entities (facets, exact-field retrieval)
//   • Graph     — entities joined by any shared metadata dimension
//   • Semantic  — lightweight character-shingle + Metaphone-ish name folding,
//                 used for author/device disambiguation across spelling drift
//
// Plus the derived surfaces the narrative demands: entity cards, timeline
// reconstruction, and anomaly reports (including the hardware-arithmetic check
// that catches a creation timestamp predating the device that made it).
// ─────────────────────────────────────────────────────────────────────────────

import type { GhostRecord } from "./ghostMetadata.ts";

export interface Facet { field: string; value: string; count: number; entities: string[] }
export interface GraphNode { id: string; label: string; kind: "document" | "host" | "author" | "device" | "ip" | "asn" | "geo" | "software"; weight: number }
export interface GraphEdge { source: string; target: string; kind: string; weight: number }
export interface TimelineEvent { at: string; entity_id: string; label: string; kind: "created" | "modified"; host: string }
export interface Anomaly { severity: "critical" | "high" | "medium" | "low"; code: string; title: string; detail: string; entity_id: string | null }
export interface EntityCard {
  key: string;
  kind: "author" | "device" | "host" | "ip";
  documents: number;
  hosts: string[];
  devices: string[];
  first_seen: string | null;
  last_seen: string | null;
  activity_window: string | null;   // dominant local-hour band
  geo_clusters: { lat: number; lng: number; count: number; label: string | null }[];
  software: string[];
}

// Public hardware release dates — the reference index behind the
// "creation predates the hardware" contradiction check. Dates are the public
// announcement/ship month, stored as the first day of that month (UTC).
export const HARDWARE_RELEASES: { match: RegExp; label: string; released: string }[] = [
  { match: /iphone\s*17/i, label: "Apple iPhone 17", released: "2025-09-01" },
  { match: /iphone\s*16/i, label: "Apple iPhone 16", released: "2024-09-01" },
  { match: /iphone\s*15/i, label: "Apple iPhone 15", released: "2023-09-01" },
  { match: /iphone\s*14/i, label: "Apple iPhone 14", released: "2022-09-01" },
  { match: /iphone\s*13/i, label: "Apple iPhone 13", released: "2021-09-01" },
  { match: /iphone\s*12/i, label: "Apple iPhone 12", released: "2020-10-01" },
  { match: /iphone\s*11/i, label: "Apple iPhone 11", released: "2019-09-01" },
  { match: /pixel\s*9/i, label: "Google Pixel 9", released: "2024-08-01" },
  { match: /pixel\s*8/i, label: "Google Pixel 8", released: "2023-10-01" },
  { match: /pixel\s*7/i, label: "Google Pixel 7", released: "2022-10-01" },
  { match: /galaxy\s*s24|sm-s92/i, label: "Samsung Galaxy S24", released: "2024-01-01" },
  { match: /galaxy\s*s23|sm-s91/i, label: "Samsung Galaxy S23", released: "2023-02-01" },
  { match: /galaxy\s*s22|sm-s90/i, label: "Samsung Galaxy S22", released: "2022-02-01" },
  { match: /eos\s*r5/i, label: "Canon EOS R5", released: "2020-07-01" },
  { match: /eos\s*r6/i, label: "Canon EOS R6", released: "2020-08-01" },
  { match: /ilce-7m4|a7\s*iv/i, label: "Sony A7 IV", released: "2021-10-01" },
  { match: /dji\s*mavic\s*3/i, label: "DJI Mavic 3", released: "2021-11-01" },
];

/** Fold a name to a comparison key: case, punctuation, and initials collapse. */
export function foldName(raw: string): string {
  const s = raw.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const parts = s.split(" ");
  const last = parts[parts.length - 1];
  const first = parts[0];
  // "J. Harrison", "James Harrison", "harrison, james" all fold to "j|harrison".
  return `${first[0]}|${phonetic(last)}`;
}

/** Compact phonetic key (Metaphone-flavoured) for spelling-drift tolerance. */
export function phonetic(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f").replace(/ck/g, "k").replace(/sch/g, "sk")
    .replace(/[aeiou]+/g, (m, i: number) => (i === 0 ? m[0] : ""))
    .replace(/(.)\1+/g, "$1")
    .slice(0, 8);
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Inverted index: field/value → entity ids, sorted by frequency. */
export function buildFacets(records: GhostRecord[]): Facet[] {
  const map = new Map<string, Set<string>>();
  const push = (field: string, value: string, id: string) => {
    const v = norm(value);
    if (!v) return;
    const key = `${field}\u0000${v.slice(0, 120)}`;
    (map.get(key) ?? map.set(key, new Set()).get(key)!).add(id);
  };
  for (const r of records) {
    push("host", r.host, r.entity_id);
    push("source_type", r.source_type, r.entity_id);
    if (r.author) push("author", r.author, r.entity_id);
    if (r.device_id) push("device_id", r.device_id, r.entity_id);
    if (r.software) push("software", r.software, r.entity_id);
    if (r.server) push("server", r.server, r.entity_id);
    if (r.asn) push("asn", r.asn, r.entity_id);
    if (r.network_origin_ip) push("network_origin_ip", r.network_origin_ip, r.entity_id);
    if (r.geo_label) push("geo_label", r.geo_label, r.entity_id);
    if (r.created_at) push("created_year", r.created_at.slice(0, 4), r.entity_id);
  }
  return [...map.entries()]
    .map(([k, set]) => {
      const [field, value] = k.split("\u0000");
      return { field, value, count: set.size, entities: [...set] };
    })
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
}

/** Round coordinates to a ~1.1km cell so near-identical pings cluster. */
const geoCell = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

/** Graph index: documents joined to every shared metadata dimension. */
export function buildGraph(records: GhostRecord[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const addNode = (id: string, label: string, kind: GraphNode["kind"]) => {
    const n = nodes.get(id);
    if (n) { n.weight++; return; }
    nodes.set(id, { id, label: label.slice(0, 80), kind, weight: 1 });
  };
  const addEdge = (a: string, b: string, kind: string) => {
    if (a === b) return;
    const key = `${a}\u0000${b}\u0000${kind}`;
    const e = edges.get(key);
    if (e) { e.weight++; return; }
    edges.set(key, { source: a, target: b, kind, weight: 1 });
  };

  for (const r of records) {
    addNode(r.entity_id, r.container["title"] as string || r.url.replace(/^https?:\/\//, "").slice(0, 70), "document");
    const dims: [string, string, GraphNode["kind"], string][] = [];
    if (r.host) dims.push([`host:${r.host}`, r.host, "host", "hosted_on"]);
    if (r.author) dims.push([`author:${foldName(r.author) || r.author.toLowerCase()}`, r.author, "author", "authored_by"]);
    if (r.device_id) dims.push([`device:${r.device_id.toLowerCase()}`, r.device_id, "device", "captured_on"]);
    if (r.network_origin_ip) dims.push([`ip:${r.network_origin_ip}`, r.network_origin_ip, "ip", "resolves_to"]);
    if (r.asn) dims.push([`asn:${r.asn.toLowerCase()}`, r.asn, "asn", "routed_via"]);
    if (r.software) dims.push([`sw:${r.software.toLowerCase()}`, r.software, "software", "produced_by"]);
    if (r.geo_lat != null && r.geo_lng != null) {
      const cell = geoCell(r.geo_lat, r.geo_lng);
      dims.push([`geo:${cell}`, r.geo_label || cell, "geo", "located_at"]);
    }
    for (const [id, label, kind, edgeKind] of dims) {
      addNode(id, label, kind);
      addEdge(r.entity_id, id, edgeKind);
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Bridge detection: dimension nodes that join otherwise separate documents. */
export function keystones(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, limit = 6): GraphNode[] {
  const degree = new Map<string, number>();
  for (const e of graph.edges) degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  return graph.nodes
    .filter((n) => n.kind !== "document" && (degree.get(n.id) ?? 0) > 1)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, limit);
}

export function buildTimeline(records: GhostRecord[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const r of records) {
    const label = (r.container["title"] as string) || r.url.replace(/^https?:\/\//, "").slice(0, 70);
    if (r.created_at) events.push({ at: r.created_at, entity_id: r.entity_id, label, kind: "created", host: r.host });
    if (r.modified_at && r.modified_at !== r.created_at) {
      events.push({ at: r.modified_at, entity_id: r.entity_id, label, kind: "modified", host: r.host });
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/** Dominant activity band, expressed in UTC hours (the only clock we own). */
function activityWindow(times: string[]): string | null {
  if (!times.length) return null;
  const hours = times.map((t) => new Date(t).getUTCHours()).filter((h) => !isNaN(h));
  if (!hours.length) return null;
  const bins = new Array(24).fill(0);
  for (const h of hours) bins[h]++;
  let best = 0, bestSum = -1;
  for (let s = 0; s < 24; s++) {
    let sum = 0;
    for (let k = 0; k < 5; k++) sum += bins[(s + k) % 24];
    if (sum > bestSum) { bestSum = sum; best = s; }
  }
  return `${String(best).padStart(2, "0")}:00–${String((best + 5) % 24).padStart(2, "0")}:00 UTC`;
}

export function buildEntityCards(records: GhostRecord[]): EntityCard[] {
  const buckets = new Map<string, { kind: EntityCard["kind"]; label: string; recs: GhostRecord[] }>();
  const put = (kind: EntityCard["kind"], key: string, label: string, r: GhostRecord) => {
    const id = `${kind}:${key}`;
    const b = buckets.get(id) ?? buckets.set(id, { kind, label, recs: [] }).get(id)!;
    b.recs.push(r);
  };
  for (const r of records) {
    if (r.author) put("author", foldName(r.author) || r.author.toLowerCase(), r.author, r);
    if (r.device_id) put("device", r.device_id.toLowerCase(), r.device_id, r);
    if (r.host) put("host", r.host, r.host, r);
    if (r.network_origin_ip) put("ip", r.network_origin_ip, r.network_origin_ip, r);
  }

  return [...buckets.values()]
    .map(({ kind, label, recs }) => {
      const times = recs.flatMap((r) => [r.created_at, r.modified_at].filter(Boolean) as string[]).sort();
      const cells = new Map<string, { lat: number; lng: number; count: number; label: string | null }>();
      for (const r of recs) {
        if (r.geo_lat == null || r.geo_lng == null) continue;
        const key = geoCell(r.geo_lat, r.geo_lng);
        const c = cells.get(key);
        if (c) c.count++;
        else cells.set(key, { lat: r.geo_lat, lng: r.geo_lng, count: 1, label: r.geo_label });
      }
      return {
        key: label,
        kind,
        documents: recs.length,
        hosts: [...new Set(recs.map((r) => r.host).filter(Boolean))].slice(0, 12),
        devices: [...new Set(recs.map((r) => r.device_id).filter(Boolean) as string[])].slice(0, 8),
        first_seen: times[0] ?? null,
        last_seen: times[times.length - 1] ?? null,
        activity_window: activityWindow(times),
        geo_clusters: [...cells.values()].sort((a, b) => b.count - a.count).slice(0, 5),
        software: [...new Set(recs.map((r) => r.software).filter(Boolean) as string[])].slice(0, 6),
      };
    })
    .sort((a, b) => b.documents - a.documents);
}

/**
 * Anomaly report. Every rule is arithmetic on the shell — no content is read,
 * and each finding names the exact contradiction rather than a vague score.
 */
export function buildAnomalies(records: GhostRecord[]): Anomaly[] {
  const out: Anomaly[] = [];
  const shortLabel = (r: GhostRecord) => r.host || r.url.slice(0, 60);

  for (const r of records) {
    // Hardware arithmetic: creation cannot predate the device that made it.
    if (r.device_id && r.created_at) {
      const hw = HARDWARE_RELEASES.find((h) => h.match.test(r.device_id!));
      if (hw && r.created_at < `${hw.released}T00:00:00.000Z`) {
        out.push({
          severity: "critical", code: "HW_TIME_PARADOX",
          title: "Creation timestamp predates the hardware",
          detail: `${shortLabel(r)} claims creation ${r.created_at.slice(0, 10)} on ${hw.label}, which was not released until ${hw.released.slice(0, 7)}.`,
          entity_id: r.entity_id,
        });
      }
    }
    // Modified before created — the container contradicts itself.
    if (r.created_at && r.modified_at && r.modified_at < r.created_at) {
      out.push({
        severity: "high", code: "MTIME_BEFORE_CTIME",
        title: "Modification precedes creation",
        detail: `${shortLabel(r)} reports modified ${r.modified_at.slice(0, 16)} against created ${r.created_at.slice(0, 16)}.`,
        entity_id: r.entity_id,
      });
    }
    // Subject-location leakage: an EXIF GPS fix survived publication.
    if (r.geo_source === "exif") {
      out.push({
        severity: "high", code: "GEO_LEAK",
        title: "Embedded GPS fix survived publication",
        detail: `${shortLabel(r)} still carries a capture coordinate (${r.geo_lat?.toFixed(4)}, ${r.geo_lng?.toFixed(4)}) written by ${r.device_id || "the capture device"}.`,
        entity_id: r.entity_id,
      });
    }
    // Operator identity written into the container.
    if (r.author) {
      out.push({
        severity: "medium", code: "AUTHOR_ATTRIBUTION",
        title: "Operator name embedded in container",
        detail: `${shortLabel(r)} attributes authorship to "${r.author}" in its metadata shell.`,
        entity_id: r.entity_id,
      });
    }
    // Transport posture gaps.
    if (r.status && r.status < 400 && !r.tls) {
      out.push({
        severity: "high", code: "NO_TLS",
        title: "Plaintext transport",
        detail: `${shortLabel(r)} served the resource over HTTP; every request header is observable in transit.`,
        entity_id: r.entity_id,
      });
    } else if (r.status && r.status < 400 && !r.hsts) {
      out.push({
        severity: "low", code: "NO_HSTS",
        title: "No HSTS pin",
        detail: `${shortLabel(r)} does not assert Strict-Transport-Security, leaving a downgrade window.`,
        entity_id: r.entity_id,
      });
    }
    // Off-hours writes.
    for (const [kind, t] of [["created", r.created_at], ["modified", r.modified_at]] as const) {
      if (!t) continue;
      const h = new Date(t).getUTCHours();
      if (h >= 2 && h < 5) {
        out.push({
          severity: "low", code: "OFF_HOURS_WRITE",
          title: "Off-hours write",
          detail: `${shortLabel(r)} ${kind} at ${t.slice(11, 16)} UTC — inside the 02:00–05:00 low-activity band.`,
          entity_id: r.entity_id,
        });
      }
    }
    if (r.redirect_chain.length >= 3) {
      out.push({
        severity: "medium", code: "REDIRECT_DEPTH",
        title: "Deep redirect chain",
        detail: `${shortLabel(r)} traversed ${r.redirect_chain.length} hops before resolving — an interstitial or attribution layer sits in the path.`,
        entity_id: r.entity_id,
      });
    }
  }

  // Corpus-level: one dimension binding otherwise unrelated documents.
  const graph = buildGraph(records);
  for (const k of keystones(graph, 3)) {
    const deg = graph.edges.filter((e) => e.target === k.id).length;
    if (deg >= 3) {
      out.push({
        severity: "medium", code: "KEYSTONE_NODE",
        title: `Keystone ${k.kind}: ${k.label}`,
        detail: `${deg} documents in this corpus converge on a single ${k.kind}. Remove it and the graph fractures.`,
        entity_id: null,
      });
    }
  }

  const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 80);
}

export interface GhostIndex {
  records: GhostRecord[];
  facets: Facet[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  keystones: GraphNode[];
  timeline: TimelineEvent[];
  cards: EntityCard[];
  anomalies: Anomaly[];
  coverage: { indexed: number; failed: number; withContainer: number; withGeo: number; withAuthor: number };
}

export function buildIndex(records: GhostRecord[]): GhostIndex {
  const graph = buildGraph(records);
  return {
    records,
    facets: buildFacets(records).slice(0, 60),
    graph,
    keystones: keystones(graph),
    timeline: buildTimeline(records),
    cards: buildEntityCards(records).slice(0, 24),
    anomalies: buildAnomalies(records),
    coverage: {
      indexed: records.length,
      failed: records.filter((r) => r.errors.length > 0 || r.status === null).length,
      withContainer: records.filter((r) => Object.keys(r.container).length > 0).length,
      withGeo: records.filter((r) => r.geo_lat != null).length,
      withAuthor: records.filter((r) => !!r.author).length,
    },
  };
}
