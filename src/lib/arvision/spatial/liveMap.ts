// asherin.arvision — live map around the operator.
//
// The room shipped with one scanned indoor export, which is fine as a reference
// but is not where anybody actually is. This builds the same NavigationData
// structure from the real world instead: OpenStreetMap ways around a GPS fix
// become the walkable graph, named places become destinations, and the anchor
// records where local (0,0) sits on earth so a live fix can be plotted on it.
//
// Nothing here invents geometry. If Overpass answers with nothing walkable, the
// caller is told that plainly rather than handed an empty map that pretends.

import { geoToLocal, type GeoAnchor } from "./geo";
import type { MapBounds, NavigationData, NavigationPOI, NavigationWaypoint, Vec3 } from "./types";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 30_000;

/** Ways a person can actually walk. Motorways and their links are left out. */
const WALKABLE =
  "^(footway|path|pedestrian|steps|corridor|living_street|residential|service|unclassified|track|tertiary|secondary|primary|cycleway)$";

export interface LiveMapResult {
  data: NavigationData | null;
  anchor: GeoAnchor;
  message: string;
  waypointCount: number;
  poiCount: number;
}

interface OverpassGeom {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: "way" | "node";
  id: number;
  lat?: number;
  lon?: number;
  geometry?: OverpassGeom[];
  tags?: Record<string, string>;
}

function query(lat: number, lon: number, radius: number): string {
  const around = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:25];
(
  way["highway"~"${WALKABLE}"]${around};
  node["amenity"]["name"]${around};
  node["shop"]["name"]${around};
  node["tourism"]["name"]${around};
  node["emergency"="fire_hydrant"]${around};
  node["highway"="bus_stop"]["name"]${around};
);
out geom tags;`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The public map service is shared and rate limits hard, so a 429 or 504 is a
// normal event rather than a failure: rotate to the next mirror, honour any
// Retry-After it hands back, and only then wait a growing pause before trying
// again. A 400 is our own bad query and never worth retrying.
async function callOverpass(body: string): Promise<OverpassElement[]> {
  let lastError = "the map service is unreachable right now";
  for (let attempt = 0; attempt < ENDPOINTS.length * 2; attempt += 1) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: `data=${encodeURIComponent(body)}`,
        signal: controller.signal,
      });
      if (res.status === 400) throw new Error("the map query was rejected as malformed");
      if (!res.ok) {
        lastError =
          res.status === 429 || res.status === 504
            ? "the public map service is busy and asked us to slow down"
            : `the map service answered ${res.status}`;
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 8) * 1000 : 800 * 2 ** Math.floor(attempt / ENDPOINTS.length);
        await sleep(Math.min(wait, 6000));
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("json")) {
        lastError = "the map service returned something that was not map data";
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return Array.isArray(json.elements) ? json.elements : [];
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("the map query")) throw error;
      lastError = error instanceof Error && error.name === "AbortError" ? "the map request timed out" : "the map request failed";
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}


/** Grid key used to weld nearby samples so ways that meet share a waypoint. */
function cellKey(p: Vec3, cell: number): string {
  return `${Math.round(p.x / cell)}:${Math.round(p.z / cell)}`;
}

export async function buildLiveMap(
  lat: number,
  lon: number,
  radiusM = 400,
  spacing = 10,
): Promise<LiveMapResult> {
  const anchor: GeoAnchor = { lat, lon };
  const elements = await callOverpass(query(lat, lon, Math.round(radiusM)));

  const waypoints: NavigationWaypoint[] = [];
  const byCell = new Map<string, number>();
  const cell = spacing * 0.6;

  const weld = (p: Vec3): number => {
    const key = cellKey(p, cell);
    const existing = byCell.get(key);
    if (existing !== undefined) return existing;
    const id = waypoints.length + 1;
    waypoints.push({ id, position: p, connectedWaypoints: [] });
    byCell.set(key, id);
    return id;
  };

  const link = (a: number, b: number) => {
    if (a === b) return;
    const wa = waypoints[a - 1];
    const wb = waypoints[b - 1];
    if (!wa || !wb) return;
    if (!wa.connectedWaypoints.includes(b)) wa.connectedWaypoints.push(b);
    if (!wb.connectedWaypoints.includes(a)) wb.connectedWaypoints.push(a);
  };

  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const points = el.geometry.map((g) => geoToLocal(anchor, g.lat, g.lon));

    // resample the way at the chosen spacing so waypoint density is uniform
    // regardless of how finely the way happens to be drawn in OSM
    let previousId = weld(points[0]);
    let carried = 0;
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      const segment = Math.hypot(to.x - from.x, to.z - from.z);
      if (segment <= 0) continue;
      let travelled = spacing - carried;
      while (travelled < segment) {
        const t = travelled / segment;
        const id = weld({ x: from.x + (to.x - from.x) * t, y: 0, z: from.z + (to.z - from.z) * t });
        link(previousId, id);
        previousId = id;
        travelled += spacing;
      }
      carried = segment - (travelled - spacing);
      if (i === points.length - 1) {
        const id = weld(to);
        link(previousId, id);
        previousId = id;
      }
    }
  }

  if (waypoints.length < 2) {
    return {
      data: null,
      anchor,
      message: "no walkable ways are mapped around this position, so there is nothing to route on here",
      waypointCount: 0,
      poiCount: 0,
    };
  }

  const nearestWaypoint = (p: Vec3): number => {
    let best = waypoints[0].id;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const w of waypoints) {
      const d = Math.hypot(w.position.x - p.x, w.position.z - p.z);
      if (d < bestDist) {
        bestDist = d;
        best = w.id;
      }
    }
    return best;
  };

  const pois: NavigationPOI[] = [];
  for (const el of elements) {
    if (el.type !== "node" || el.lat === undefined || el.lon === undefined) continue;
    const tags = el.tags ?? {};
    const name = tags.name ?? (tags.emergency === "fire_hydrant" ? "fire hydrant" : "");
    if (!name) continue;
    const position = geoToLocal(anchor, el.lat, el.lon);
    if (Math.hypot(position.x, position.z) > radiusM * 1.2) continue;
    pois.push({
      id: pois.length + 1,
      name: name.slice(0, 60).toLowerCase(),
      description: (tags.amenity ?? tags.shop ?? tags.tourism ?? tags.highway ?? "place").replace(/_/g, " "),
      type: (tags.amenity ?? tags.shop ?? tags.tourism ?? tags.highway ?? "place").replace(/_/g, " "),
      position,
      nearestWaypointId: nearestWaypoint(position),
      arrivalRadius: 8,
    });
    if (pois.length >= 120) break;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const w of waypoints) {
    minX = Math.min(minX, w.position.x);
    maxX = Math.max(maxX, w.position.x);
    minZ = Math.min(minZ, w.position.z);
    maxZ = Math.max(maxZ, w.position.z);
  }
  const pad = spacing;
  const min: Vec3 = { x: minX - pad, y: -2, z: minZ - pad };
  const max: Vec3 = { x: maxX + pad, y: 2, z: maxZ + pad };
  const bounds: MapBounds = {
    min,
    max,
    center: { x: (min.x + max.x) / 2, y: 0, z: (min.z + max.z) / 2 },
    size: { x: max.x - min.x, y: 4, z: max.z - min.z },
  };

  const data: NavigationData = {
    mapCode: `LIVE_${lat.toFixed(4)}_${lon.toFixed(4)}`,
    exportedAt: new Date().toISOString(),
    waypointSpacing: spacing,
    bounds,
    pois,
    waypoints,
    paths: [], // routes are solved live by A* over this graph
    origin: anchor,
  };

  return {
    data,
    anchor,
    message: `live map built from openstreetmap · ${waypoints.length} waypoints · ${pois.length} destinations within ${Math.round(radiusM)}m`,
    waypointCount: waypoints.length,
    poiCount: pois.length,
  };
}
