// Ghost Engine — search-surface formatting helpers.
//
// The backend already ranks and snippets; these helpers exist so the client can
// render, group and re-suggest without a second round-trip, and so the same
// projection can be rebuilt locally from a plain `sweep` response.

import type { GhostIndex, GhostRecord } from "./types";

export type SearchScope = "all" | "web" | "buffer";

export interface GhostSearchResult {
  id: string;
  /**
   * Which layer produced the row.
   *   web    — probed shell, metadata carved
   *   lead   — surfaced by the harvest, beyond this round's probe budget
   *   buffer — retained body already on the shelf
   */
  source: "web" | "lead" | "buffer";
  title: string;
  url: string;
  host: string;
  snippet: string;
  badges: string[];
  score: number;
  session_id?: string;
  entity_id?: string;
  /** Fan-out leg that surfaced the URL. */
  via?: string;
  /** Distinct legs that independently returned this URL. */
  corroboration?: number;
}

/** Normalized selector the backend resolved from the typed query. */
export interface GhostIdentity {
  kind: "email" | "phone" | "domain" | "name" | "handle" | "freeform";
  key: string;
  label: string;
  parts: Record<string, string>;
}

export interface GhostHarvestSummary {
  leads: number;
  legs: number;
  probed: number;
  unprobed: number;
}

/** One past lookup of one entity. */
export interface GhostHistoryRun {
  id: string;
  entity_key: string;
  entity_kind: string;
  entity_label: string;
  query: string;
  scope: string;
  leads_found: number;
  probed: number;
  anomalies: number;
  elapsed_ms: number;
  created_at: string;
  results?: GhostSearchResult[];
  summary?: { legs?: number; hosts?: string[]; facets?: { field: string; value: string; count: number }[] };
}

/** Runs collapsed by entity — the HISTORY rail's row model. */
export interface GhostHistoryEntity {
  entity_key: string;
  entity_kind: string;
  entity_label: string;
  runs: number;
  first_seen: string;
  last_seen: string;
  total_leads: number;
  total_anomalies: number;
  queries: string[];
}

export interface GhostSearchResponse {
  action?: string;
  scope?: SearchScope;
  query: string;
  mode: "sweep" | "target";
  elapsedMs: number;
  tier?: string;
  identity?: GhostIdentity;
  harvest?: GhostHarvestSummary;
  index: GhostIndex | null;
  results?: GhostSearchResult[];
  suggestions?: string[];
  scanned?: number;
  error?: string;
  buffer: { captured: number; expiresAt: string; ttlMinutes: number; errors: string[] } | null;
}


const fmtTs = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace("T", " ")}Z` : null);

/**
 * Local fallback projection. If a response arrives without `results` (an older
 * cached sweep, or a direct `sweep` call), the list still renders rather than
 * showing an empty page — absence of a projection is not absence of findings.
 */
export function projectRecords(index: GhostIndex): GhostSearchResult[] {
  const anomalyByEntity = new Map<string, number>();
  for (const a of index.anomalies) {
    if (a.entity_id) anomalyByEntity.set(a.entity_id, (anomalyByEntity.get(a.entity_id) ?? 0) + 1);
  }
  return index.records
    .map((r) => projectRecord(r, anomalyByEntity.get(r.entity_id) ?? 0))
    .sort((a, b) => b.score - a.score);
}

function projectRecord(r: GhostRecord, anomalies: number): GhostSearchResult {
  const badges = [
    r.status ? String(r.status) : "unreachable",
    (r.source_type || "").split(";")[0],
    r.tls ? "TLS" : "no TLS",
    r.asn || "",
    r.geo_source === "exif" ? "EXIF GPS" : "",
    r.author ? `author: ${r.author}` : "",
    r.software || "",
    anomalies ? `${anomalies} anomal${anomalies === 1 ? "y" : "ies"}` : "",
  ].filter(Boolean);

  const facts = [
    r.server ? `served by ${r.server}` : null,
    r.network_origin_ip ? `origin ${r.network_origin_ip}${r.geo_label ? ` — ${r.geo_label}` : ""}` : null,
    r.created_at ? `created ${fmtTs(r.created_at)}` : null,
    r.modified_at ? `modified ${fmtTs(r.modified_at)}` : null,
    r.device_id ? `device ${r.device_id}` : null,
    r.redirect_chain.length ? `${r.redirect_chain.length} redirect hop${r.redirect_chain.length === 1 ? "" : "s"}` : null,
    r.dns.ns.length ? `ns ${r.dns.ns.slice(0, 2).join(", ")}` : null,
  ].filter(Boolean) as string[];

  const score =
    (r.status && r.status < 400 ? 20 : 0) +
    (r.author ? 30 : 0) + (r.device_id ? 25 : 0) + (r.software ? 12 : 0) +
    (r.geo_lat != null ? 25 : 0) + (r.created_at ? 10 : 0) +
    anomalies * 18 + Math.min(facts.length, 6) * 3;

  return {
    id: `web:${r.entity_id}`,
    source: "web",
    title: r.host || r.url,
    url: r.url,
    host: r.host,
    snippet: facts.join(" · ") || "Shell reachable, nothing embedded — the publisher strips metadata on upload.",
    badges,
    score,
    entity_id: r.entity_id,
  };
}

/** Facet-derived related searches, for responses that predate `suggestions`. */
export function suggestFromIndex(index: GhostIndex): string[] {
  return index.facets
    .filter((f) => f.count > 1 && f.value && f.value !== "unknown")
    .slice(0, 10)
    .map((f) => `${f.field}:${/\s/.test(f.value) ? `"${f.value}"` : f.value}`);
}

/** Facet filters the operator can toggle over an already-returned result set. */
export interface ResultFilters {
  host?: string;
  sourceType?: string;
  asn?: string;
  onlyAnomalies?: boolean;
  onlyBuffer?: boolean;
}

export function applyFilters(results: GhostSearchResult[], f: ResultFilters): GhostSearchResult[] {
  return results.filter((r) => {
    if (f.onlyBuffer && r.source !== "buffer") return false;
    if (f.host && r.host !== f.host) return false;
    if (f.asn && !r.badges.includes(f.asn)) return false;
    if (f.sourceType && !r.badges.some((b) => b === f.sourceType)) return false;
    if (f.onlyAnomalies && !r.badges.some((b) => /anomal/.test(b))) return false;
    return true;
  });
}

/** Distinct facet values present in the current result set, with counts. */
export function resultFacets(results: GhostSearchResult[]) {
  const tally = (pick: (r: GhostSearchResult) => string | undefined) => {
    const m = new Map<string, number>();
    for (const r of results) {
      const v = pick(r);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  return {
    hosts: tally((r) => r.host),
    sourceTypes: tally((r) => r.badges.find((b) => b.includes("/"))),
    asns: tally((r) => r.badges.find((b) => /^AS\d/.test(b))),
    anomalies: results.filter((r) => r.badges.some((b) => /anomal/.test(b))).length,
    buffered: results.filter((r) => r.source === "buffer").length,
  };
}
