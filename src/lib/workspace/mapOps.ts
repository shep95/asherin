// map as a callable capability.
//
// Chat may request a map operation; the operation only executes when the data
// it needs genuinely exists. Otherwise it returns a refusal with a reason the
// UI shows verbatim — never a silent no-op and never an invented coordinate.

import type { MapPayload, MapMarker, MapTrackLine } from "./types";

export type MapOpKind =
  | "OPEN"
  | "CENTER"
  | "SEARCH"
  | "ADD_ENTITY"
  | "ADD_LOCATION"
  | "ADD_CAMERA"
  | "ADD_TRACK"
  | "ADD_ZONE"
  | "SHOW_ROUTE"
  | "SHOW_RELATIONSHIPS"
  | "FILTER_TIME"
  | "REWIND";

export interface MapOp {
  kind: MapOpKind;
  marker?: MapMarker;
  track?: MapTrackLine;
  center?: { lat: number; lng: number };
  zoom?: number;
  window?: { fromMs: number; toMs: number };
  query?: string;
}

export interface MapOpResult {
  ok: boolean;
  reason?: string;
  map: MapPayload;
}

export const EMPTY_MAP: MapPayload = { markers: [], tracks: [], center: null, zoom: 13, unplotted: [] };

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validCoord(c?: { lat?: number; lng?: number } | null): boolean {
  return !!c && finite(c.lat) && finite(c.lng) && Math.abs(c.lat!) <= 90 && Math.abs(c.lng!) <= 180;
}

export function applyMapOp(map: MapPayload, op: MapOp): MapOpResult {
  switch (op.kind) {
    case "OPEN":
      return { ok: true, map };

    case "CENTER": {
      if (!validCoord(op.center)) {
        return { ok: false, reason: "no coordinate available to centre on", map };
      }
      return { ok: true, map: { ...map, center: op.center!, zoom: op.zoom ?? map.zoom } };
    }

    case "SEARCH": {
      if (!op.query || !op.query.trim()) return { ok: false, reason: "no search text supplied", map };
      // the geocode itself happens in the adapter; the op only validates intent.
      return { ok: true, map };
    }

    case "ADD_ENTITY":
    case "ADD_LOCATION":
    case "ADD_CAMERA":
    case "ADD_ZONE": {
      const m = op.marker;
      if (!m) return { ok: false, reason: "no marker supplied", map };
      if (!validCoord(m)) {
        return {
          ok: false,
          reason: `${m.label}: no usable coordinate, so it is listed rather than plotted`,
          map: { ...map, unplotted: [...map.unplotted, { label: m.label, reason: "no coordinate in the source record" }] },
        };
      }
      if (map.markers.some((x) => x.id === m.id)) return { ok: true, map };
      const markers = [...map.markers, m];
      return { ok: true, map: { ...map, markers, center: map.center ?? { lat: m.lat, lng: m.lng } } };
    }

    case "ADD_TRACK": {
      const t = op.track;
      if (!t) return { ok: false, reason: "no track supplied", map };
      const points = (t.points || []).filter((p) => validCoord(p));
      if (points.length < 2) {
        return {
          ok: false,
          reason: `${t.label}: fewer than two calibrated points, so no trajectory can be drawn`,
          map,
        };
      }
      if (map.tracks.some((x) => x.id === t.id)) return { ok: true, map };
      return { ok: true, map: { ...map, tracks: [...map.tracks, { ...t, points }] } };
    }

    case "SHOW_ROUTE":
      return { ok: false, reason: "routing is not wired to a routing provider in this session", map };

    case "SHOW_RELATIONSHIPS": {
      if (map.markers.length < 2) {
        return { ok: false, reason: "fewer than two plotted entities, so no relationship can be drawn on the map", map };
      }
      return { ok: true, map };
    }

    case "FILTER_TIME": {
      const w = op.window;
      if (!w || !finite(w.fromMs) || !finite(w.toMs) || w.toMs <= w.fromMs) {
        return { ok: false, reason: "no valid time window supplied", map };
      }
      const tracks = map.tracks
        .map((t) => ({ ...t, points: t.points.filter((p) => p.atMs >= w.fromMs && p.atMs <= w.toMs) }))
        .filter((t) => t.points.length >= 2);
      return { ok: true, map: { ...map, tracks } };
    }

    case "REWIND": {
      if (!map.tracks.length) {
        return { ok: false, reason: "no recorded trajectory is available to rewind", map };
      }
      return { ok: true, map };
    }

    default:
      return { ok: false, reason: "unsupported map operation", map };
  }
}

export function applyMapOps(map: MapPayload, ops: MapOp[]): { map: MapPayload; refusals: string[] } {
  let current = map;
  const refusals: string[] = [];
  for (const op of ops) {
    const res = applyMapOp(current, op);
    current = res.map;
    if (!res.ok && res.reason) refusals.push(res.reason);
  }
  return { map: current, refusals };
}
