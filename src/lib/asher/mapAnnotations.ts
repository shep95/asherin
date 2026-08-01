// mapAnnotations — the operator-editable overlay model for the Asher
// Intelligence Map. Every annotation the operator (or Asher AI) drops on the
// map is a typed, persisted, exportable object. Storage is local-first
// (localStorage, per-browser) so the layer survives reloads without requiring
// a backend round-trip; export produces standards-compliant GeoJSON.

export type AnnoKind = "marker" | "circle" | "polygon" | "line" | "label";

export interface MapAnnotation {
  id: string;
  kind: AnnoKind;
  label: string;
  /** Free-form operator/AI note rendered in the popup. */
  note?: string;
  /** Intel classification — drives colour when no explicit colour is set. */
  category?: "target" | "asset" | "hostile" | "friendly" | "observation" | "route" | "zone";
  color?: string;
  /** marker / circle / label anchor */
  lat?: number;
  lng?: number;
  /** circle radius, metres */
  radiusM?: number;
  /** polygon / line vertices */
  path?: Array<{ lat: number; lng: number }>;
  createdAt: number;
  updatedAt: number;
  source: "operator" | "asher-ai";
  /* ── Provenance & confidence ──────────────────────────────────────────
     Nothing on an elite-tier map is unsourced. `confidence` (0-100) drives
     stroke styling: low-confidence objects render dashed and translucent so
     an analyst can never mistake an assertion for a verified fact. */
  confidence?: number;
  sourceUrl?: string;
  harvestedAt?: number;
  /** Analytical products the layer renders differently (e.g. viewshed rings). */
  role?: "viewshed" | "profile" | "roadroute" | "colocation";
}

/** Clamp an untrusted confidence value into [0,100]; undefined stays undefined. */
export function normConfidence(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
}


export const CATEGORY_COLORS: Record<NonNullable<MapAnnotation["category"]>, string> = {
  target: "#ef4444",
  hostile: "#f97316",
  asset: "#22d3ee",
  friendly: "#22c55e",
  observation: "#a855f7",
  route: "#eab308",
  zone: "#38bdf8",
};

export function annoColor(a: MapAnnotation): string {
  if (a.color && /^#[0-9a-f]{3,8}$/i.test(a.color)) return a.color;
  const named: Record<string, string> = {
    red: "#ef4444", orange: "#f97316", amber: "#f59e0b", yellow: "#eab308",
    green: "#22c55e", emerald: "#10b981", cyan: "#22d3ee", blue: "#3b82f6",
    purple: "#a855f7", magenta: "#e879f9", pink: "#ec4899", white: "#e4e4e7",
  };
  const key = (a.color || "").toLowerCase().trim();
  if (named[key]) return named[key];
  return CATEGORY_COLORS[a.category ?? "observation"] ?? "#a855f7";
}

const STORAGE_KEY = "asher:map:annotations:v1";
const MAX_ANNOTATIONS = 500;

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Defensive read — a corrupted or foreign payload must never crash the map. */
export function loadAnnotations(): MapAnnotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidAnnotation).slice(0, MAX_ANNOTATIONS);
  } catch {
    return [];
  }
}

export function saveAnnotations(list: MapAnnotation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ANNOTATIONS)));
  } catch {
    /* quota / private-mode — the in-memory layer still works */
  }
}

export function isValidAnnotation(a: any): a is MapAnnotation {
  if (!a || typeof a !== "object") return false;
  if (typeof a.id !== "string" || typeof a.label !== "string") return false;
  switch (a.kind) {
    case "marker":
    case "label":
      return isFiniteNum(a.lat) && isFiniteNum(a.lng);
    case "circle":
      return isFiniteNum(a.lat) && isFiniteNum(a.lng) && isFiniteNum(a.radiusM) && a.radiusM > 0;
    case "polygon":
      return Array.isArray(a.path) && a.path.length >= 3 && a.path.every((p: any) => isFiniteNum(p?.lat) && isFiniteNum(p?.lng));
    case "line":
      return Array.isArray(a.path) && a.path.length >= 2 && a.path.every((p: any) => isFiniteNum(p?.lat) && isFiniteNum(p?.lng));
    default:
      return false;
  }
}

export function makeAnnotation(input: Partial<MapAnnotation> & { kind: AnnoKind; label: string }): MapAnnotation {
  const now = Date.now();
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? `anno_${now}_${Math.random().toString(36).slice(2)}`),
    createdAt: now,
    updatedAt: now,
    source: "operator",
    ...input,
  } as MapAnnotation;
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

const R_EARTH_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathLengthM(path: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineM(path[i - 1], path[i]);
  return total;
}

/** Spherical-excess-free planar approximation, adequate at parcel/city scale. */
export function polygonAreaM2(path: Array<{ lat: number; lng: number }>): number {
  if (path.length < 3) return 0;
  const lat0 = toRad(path.reduce((s, p) => s + p.lat, 0) / path.length);
  const xy = path.map((p) => ({
    x: toRad(p.lng) * Math.cos(lat0) * R_EARTH_M,
    y: toRad(p.lat) * R_EARTH_M,
  }));
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    sum += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
  }
  return Math.abs(sum / 2);
}

export function fmtDistance(m: number): string {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

export function fmtArea(m2: number): string {
  if (m2 < 10_000) return `${m2.toFixed(0)} m²`;
  const ha = m2 / 10_000;
  return `${ha.toFixed(2)} ha (${(ha * 2.47105).toFixed(2)} ac)`;
}

/** Centroid used for fly-to and label anchoring. */
export function annoCenter(a: MapAnnotation): { lat: number; lng: number } | null {
  if (isFiniteNum(a.lat) && isFiniteNum(a.lng)) return { lat: a.lat, lng: a.lng };
  if (a.path?.length) {
    const lat = a.path.reduce((s, p) => s + p.lat, 0) / a.path.length;
    const lng = a.path.reduce((s, p) => s + p.lng, 0) / a.path.length;
    return { lat, lng };
  }
  return null;
}

/** Human-readable metric line shown in popups and the AI reply. */
export function annoMetric(a: MapAnnotation): string | null {
  if (a.kind === "circle" && isFiniteNum(a.radiusM)) {
    const areaM2 = Math.PI * a.radiusM * a.radiusM;
    return `radius ${fmtDistance(a.radiusM)} · ${fmtArea(areaM2)}`;
  }
  if (a.kind === "line" && a.path) return `length ${fmtDistance(pathLengthM(a.path))} · ${a.path.length} nodes`;
  if (a.kind === "polygon" && a.path) return `${fmtArea(polygonAreaM2(a.path))} · perimeter ${fmtDistance(pathLengthM([...a.path, a.path[0]]))}`;
  return null;
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export function toGeoJSON(list: MapAnnotation[]) {
  return {
    type: "FeatureCollection" as const,
    features: list.map((a) => {
      const props = {
        id: a.id, label: a.label, note: a.note ?? null,
        category: a.category ?? null, color: annoColor(a),
        source: a.source, createdAt: new Date(a.createdAt).toISOString(),
      };
      if (a.kind === "polygon" && a.path) {
        const ring = [...a.path.map((p) => [p.lng, p.lat]), [a.path[0].lng, a.path[0].lat]];
        return { type: "Feature" as const, properties: { ...props, kind: a.kind }, geometry: { type: "Polygon" as const, coordinates: [ring] } };
      }
      if (a.kind === "line" && a.path) {
        return { type: "Feature" as const, properties: { ...props, kind: a.kind }, geometry: { type: "LineString" as const, coordinates: a.path.map((p) => [p.lng, p.lat]) } };
      }
      return {
        type: "Feature" as const,
        properties: { ...props, kind: a.kind, radiusM: a.radiusM ?? null },
        geometry: { type: "Point" as const, coordinates: [a.lng ?? 0, a.lat ?? 0] },
      };
    }),
  };
}
