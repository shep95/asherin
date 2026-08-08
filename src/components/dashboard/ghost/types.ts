// Ghost Engine — client-side mirror of the edge function's index contract.
// Kept structural only: nothing here ever holds page content.

export interface GhostRecord {
  entity_id: string;
  url: string;
  host: string;
  source_type: string;
  status: number | null;
  created_at: string | null;
  modified_at: string | null;
  author: string | null;
  device_id: string | null;
  software: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_label: string | null;
  geo_source: "exif" | "network" | null;
  file_size_bytes: number | null;
  network_origin_ip: string | null;
  asn: string | null;
  server: string | null;
  tls: boolean;
  hsts: boolean;
  csp: boolean;
  redirect_chain: string[];
  response_ms: number | null;
  dns: { a: string[]; ns: string[]; mx: string[]; txt_spf: string | null };
  headers: Record<string, string>;
  container: Record<string, string | number>;
  errors: string[];
}

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
  activity_window: string | null;
  geo_clusters: { lat: number; lng: number; count: number; label: string | null }[];
  software: string[];
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

export interface GhostResponse {
  query: string;
  mode: "sweep" | "target";
  elapsedMs: number;
  tier?: string;
  index: GhostIndex | null;
  error?: string;
}

export const SEVERITY_STYLE: Record<Anomaly["severity"], string> = {
  critical: "border-foreground/40 text-foreground",
  high: "border-foreground/25 text-foreground/85",
  medium: "border-foreground/15 text-foreground/70",
  low: "border-foreground/10 text-muted-foreground",
};
