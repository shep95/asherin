// asher-street-cameras — live public traffic-camera catalogue resolver.
//
// Why server-side: agency CCTV catalogues (Caltrans, and the OSM Overpass
// mirror for privately-tagged surveillance) do not send CORS headers, so the
// browser cannot read them. This function reads them, geo-filters against the
// operator's point or route corridor, and returns a normalised camera list.
// The browser then loads each still frame directly in an <img>, which is a
// cross-origin *render* and needs no CORS.
//
// Coverage honesty: only jurisdictions that publish an OPEN feed are returned.
// Where no open feed exists we say so in `coverageNote` instead of returning an
// empty list that reads as "no cameras here".

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Pt { lat: number; lng: number }

interface Camera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  roadway?: string;
  direction?: string;
  imageUrl?: string;
  streamUrl?: string;
  source: string;
  operator?: string;
  distanceM?: number;
}

const R_EARTH = 6_371_000;
function haversineM(a: Pt, b: Pt): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bbox(points: Pt[], padM: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const padLat = padM / 111_320;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLng = padM / (111_320 * Math.max(0.15, Math.cos((midLat * Math.PI) / 180)));
  return {
    south: Math.min(...lats) - padLat,
    north: Math.max(...lats) + padLat,
    west: Math.min(...lngs) - padLng,
    east: Math.max(...lngs) + padLng,
  };
}

/** Nearest distance from a camera to any sampled corridor vertex. */
function nearestM(cam: Pt, anchors: Pt[]): number {
  let best = Infinity;
  for (const a of anchors) {
    const d = haversineM(cam, a);
    if (d < best) best = d;
    if (best < 25) break;
  }
  return best;
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "AsherinMaps/1.0 (+https://asherin.com)", Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/* ── Caltrans CCTV (open, no key, 12 districts) ─────────────────────────── */

const CALTRANS_DISTRICTS = ["3", "4", "5", "6", "7", "8", "10", "11", "12"];
const CALTRANS_URL = (d: string) =>
  `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${d.padStart(2, "0")}.json`;

/** Districts are cached in module memory: the catalogue changes hourly at most
 *  and each cold pull is ~1 MB. */
const caltransCache = new Map<string, { at: number; cams: Camera[] }>();
const CALTRANS_TTL_MS = 10 * 60 * 1000;

async function caltransDistrict(d: string): Promise<Camera[]> {
  const hit = caltransCache.get(d);
  if (hit && Date.now() - hit.at < CALTRANS_TTL_MS) return hit.cams;
  try {
    const j = await fetchJson(CALTRANS_URL(d));
    const rows: any[] = Array.isArray(j?.data) ? j.data : [];
    const cams: Camera[] = [];
    for (const row of rows) {
      const c = row?.cctv;
      const loc = c?.location;
      const lat = Number(loc?.latitude);
      const lng = Number(loc?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      const img = c?.imageData?.static?.currentImageURL || "";
      const stream = c?.imageData?.streamingVideoURL || "";
      if (!img && !stream) continue;
      cams.push({
        id: `caltrans-${d}-${c?.index ?? `${lat},${lng}`}`,
        lat, lng,
        name: [loc?.locationName, loc?.nearbyPlace].filter(Boolean).join(" · ") || "Caltrans CCTV",
        roadway: loc?.route ? `${loc.route}` : undefined,
        direction: loc?.direction || undefined,
        imageUrl: img || undefined,
        streamUrl: stream || undefined,
        source: "Caltrans CCTV",
        operator: "California DOT",
      });
    }
    caltransCache.set(d, { at: Date.now(), cams });
    return cams;
  } catch {
    return [];
  }
}

/** California bounding box — skip the whole Caltrans fan-out elsewhere. */
function inCalifornia(b: { south: number; north: number; west: number; east: number }): boolean {
  return b.north > 32.4 && b.south < 42.1 && b.east > -124.5 && b.west < -114.0;
}

/* ── 511NY (NYSDOT statewide CCTV, open catalogue, HLS streams) ─────────── */

const nyCache: { at: number; cams: Camera[] } = { at: 0, cams: [] };
const NY_TTL_MS = 10 * 60 * 1000;

async function nyCameras(): Promise<Camera[]> {
  if (Date.now() - nyCache.at < NY_TTL_MS && nyCache.cams.length) return nyCache.cams;
  try {
    const rows: any[] = await fetchJson("https://511ny.org/api/getcameras?key=public&format=json", 15_000);
    const cams: Camera[] = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      const lat = Number(r?.Latitude), lng = Number(r?.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (r?.Disabled === true || r?.Blocked === true) continue;
      if (!r?.VideoUrl) continue; // position-only rows add noise; OSM already covers those
      cams.push({
        id: `511ny-${r.ID}`,
        lat, lng,
        name: String(r.Name || "NYSDOT CCTV"),
        roadway: r.RoadwayName || undefined,
        direction: r.DirectionOfTravel && r.DirectionOfTravel !== "Unknown" ? r.DirectionOfTravel : undefined,
        streamUrl: String(r.VideoUrl),
        source: "511NY CCTV",
        operator: "New York State DOT",
      });
    }
    if (cams.length) { nyCache.at = Date.now(); nyCache.cams = cams; }
    return cams;
  } catch { return nyCache.cams; }
}

function inNewYork(b: { south: number; north: number; west: number; east: number }): boolean {
  return b.north > 40.4 && b.south < 45.1 && b.east > -79.9 && b.west < -71.8;
}

/* ── Transport for London JamCams (open, still frame + short clip) ──────── */

const tflCache: { at: number; cams: Camera[] } = { at: 0, cams: [] };
const TFL_TTL_MS = 10 * 60 * 1000;

async function tflCameras(): Promise<Camera[]> {
  if (Date.now() - tflCache.at < TFL_TTL_MS && tflCache.cams.length) return tflCache.cams;
  try {
    const rows: any[] = await fetchJson("https://api.tfl.gov.uk/Place/Type/JamCam", 15_000);
    const cams: Camera[] = [];
    for (const p of Array.isArray(rows) ? rows : []) {
      const lat = Number(p?.lat), lng = Number(p?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const props: Record<string, string> = {};
      for (const a of p?.additionalProperties || []) if (a?.key) props[a.key] = String(a.value ?? "");
      if (props.available === "false") continue;
      if (!props.imageUrl && !props.videoUrl) continue;
      cams.push({
        id: `tfl-${p.id}`,
        lat, lng,
        name: String(p.commonName || "TfL JamCam"),
        direction: props.view || undefined,
        imageUrl: props.imageUrl || undefined,
        streamUrl: props.videoUrl || undefined,
        source: "TfL JamCams",
        operator: "Transport for London",
      });
    }
    if (cams.length) { tflCache.at = Date.now(); tflCache.cams = cams; }
    return cams;
  } catch { return tflCache.cams; }
}

function inLondon(b: { south: number; north: number; west: number; east: number }): boolean {
  return b.north > 51.2 && b.south < 51.75 && b.east > -0.62 && b.west < 0.35;
}

/* ── OpenStreetMap surveillance cameras (global positions, no imagery) ──── */

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function osmCameras(b: { south: number; north: number; west: number; east: number }): Promise<Camera[]> {
  const q =
    `[out:json][timeout:20];` +
    `(node["man_made"="surveillance"](${b.south},${b.west},${b.north},${b.east});` +
    `node["highway"="speed_camera"](${b.south},${b.west},${b.north},${b.east}););` +
    `out 400;`;
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        signal: ctrl.signal,
      });
      if (!r.ok) continue;
      const j = await r.json();
      const out: Camera[] = [];
      for (const el of j?.elements || []) {
        if (typeof el.lat !== "number" || typeof el.lon !== "number") continue;
        const tg = el.tags || {};
        out.push({
          id: `osm-${el.id}`,
          lat: el.lat,
          lng: el.lon,
          name: tg.name || (tg.highway === "speed_camera" ? "Speed camera" : `Surveillance camera${tg["surveillance:type"] ? ` (${tg["surveillance:type"]})` : ""}`),
          roadway: tg["camera:direction"] ? `facing ${tg["camera:direction"]}°` : undefined,
          source: "OpenStreetMap",
          operator: tg.operator || tg.surveillance || undefined,
        });
      }
      return out;
    } catch {
      /* try next mirror */
    } finally {
      clearTimeout(t);
    }
  }
  return [];
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const center: Pt | undefined = body?.center && Number.isFinite(body.center.lat) && Number.isFinite(body.center.lng)
      ? { lat: Number(body.center.lat), lng: Number(body.center.lng) }
      : undefined;
    const rawPath: Pt[] = Array.isArray(body?.path)
      ? body.path.filter((p: any) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
          .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
          .slice(0, 120)
      : [];
    const anchors: Pt[] = rawPath.length ? rawPath : center ? [center] : [];
    if (!anchors.length) {
      return new Response(JSON.stringify({ success: false, error: "center or path required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const radiusM = Math.max(150, Math.min(8000, Number(body?.radiusM) || 1200));
    const limit = Math.max(1, Math.min(200, Number(body?.limit) || 60));
    const b = bbox(anchors, radiusM);

    const sources: string[] = [];
    const tasks: Promise<Camera[]>[] = [];

    if (inCalifornia(b)) {
      tasks.push(
        Promise.all(CALTRANS_DISTRICTS.map(caltransDistrict))
          .then((lists) => lists.flat())
          .catch(() => []),
      );
    }
    if (inNewYork(b)) tasks.push(nyCameras().catch(() => []));
    if (inLondon(b)) tasks.push(tflCameras().catch(() => []));
    tasks.push(osmCameras(b).catch(() => []));

    const settled = await Promise.allSettled(tasks);
    const all: Camera[] = [];
    for (const s of settled) if (s.status === "fulfilled") all.push(...s.value);

    const near = all
      .map((c) => ({ ...c, distanceM: Math.round(nearestM(c, anchors)) }))
      .filter((c) => (c.distanceM as number) <= radiusM)
      .sort((a, b2) => {
        // Cameras with a live frame outrank position-only OSM records.
        const av = a.imageUrl || a.streamUrl ? 0 : 1;
        const bv = b2.imageUrl || b2.streamUrl ? 0 : 1;
        return av - bv || (a.distanceM! - b2.distanceM!);
      })
      .slice(0, limit);

    for (const c of near) if (!sources.includes(c.source)) sources.push(c.source);

    const hasLiveFrames = near.some((c) => c.imageUrl || c.streamUrl);
    const coverageNote = hasLiveFrames
      ? undefined
      : near.length
        ? "Camera positions only. No transport agency in this area publishes an open live feed, so no frames are available — positions are OpenStreetMap-tagged devices."
        : "No open public camera feed covers this corridor. Live frames are currently available where an agency publishes an unauthenticated CCTV catalogue (California, New York State and Greater London today); everywhere else only OpenStreetMap-tagged camera positions exist.";

    return new Response(JSON.stringify({ success: true, cameras: near, sources, coverageNote }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[asher-street-cameras]", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
