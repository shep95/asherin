/**
 * Asherin Maps — nearby public organs.
 *
 * Arriving at a target IS the request for local public context. Wave 8 pulled
 * one organ (street cameras). This module pulls the rest of the public-index
 * sensor field in parallel on the same choke, and it is built on one law:
 *
 *   an organ is LIVE only when a public endpoint answered with rows,
 *   GAP when it answered empty / failed / has no open feed here,
 *   ENGINE when it is a local capability, not a fetch,
 *   REFUSED when we deliberately do not fetch it.
 *
 * Nothing here infers, models, or fills. Empty is printed as empty.
 */

export type OrganStatus = "live" | "gap" | "engine" | "refused";

export interface OrganPoint {
  lat: number;
  lng: number;
  label: string;
  kind: string;
}

export interface OrganResult {
  id: string;
  label: string;
  status: OrganStatus;
  /** Rows the public endpoint actually returned. */
  count: number;
  /** Short honest note — why a gap is a gap, or what the source was. */
  note: string;
  /** Paintable points, capped by the collector. */
  points?: OrganPoint[];
}

const TIMEOUT_MS = 8_000;
/** Hard cap on painted markers so a dense city cannot freeze the canvas. */
const MAX_POINTS_PER_ORGAN = 60;

async function getJson<T = any>(url: string, signal?: AbortSignal, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const gap = (id: string, label: string, note: string): OrganResult => ({ id, label, status: "gap", count: 0, note });
const live = (id: string, label: string, count: number, note: string, points?: OrganPoint[]): OrganResult => ({
  id, label, status: "live", count, note, points: points?.slice(0, MAX_POINTS_PER_ORGAN),
});

/** Metres between two WGS84 points (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ─────────────────────────── OSM / Overpass ─────────────────────────── */

interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

/**
 * One Overpass round trip feeds ten organs. Ten separate queries would rate-
 * limit the public instance on the second fly; one query with a tag union does
 * not, and the buckets are split client-side.
 */
async function pullOverpass(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<OrganResult[]> {
  const r = Math.round(Math.min(2000, Math.max(250, radiusM)));
  const q = `[out:json][timeout:20];(
    node(around:${r},${lat},${lng})["man_made"="surveillance"];
    node(around:${r},${lat},${lng})["highway"="speed_camera"];
    node(around:${r},${lat},${lng})["amenity"~"^(fire_station|police|school|hospital|clinic)$"];
    way(around:${r},${lat},${lng})["amenity"~"^(fire_station|police|school|hospital)$"];
    node(around:${r},${lat},${lng})["highway"="bus_stop"];
    node(around:${r},${lat},${lng})["railway"~"^(station|halt|tram_stop)$"];
    node(around:${r},${lat},${lng})["railway"="level_crossing"];
    node(around:${r},${lat},${lng})["amenity"="charging_station"];
    node(around:${r},${lat},${lng})["man_made"~"^(mast|tower)$"]["tower:type"="communication"];
    node(around:${r},${lat},${lng})["highway"="street_lamp"];
    node(around:${r},${lat},${lng})["amenity"="parking"];
    way(around:${r},${lat},${lng})["amenity"="parking"];
    node(around:${r},${lat},${lng})["amenity"="vending_machine"]["vending"="parking_tickets"];
    way(around:${r},${lat},${lng})["landuse"="construction"];
    way(around:${r},${lat},${lng})["building"="construction"];
  );out center ${MAX_POINTS_PER_ORGAN * 12};`;

  const j = await getJson<{ elements?: OsmEl[] }>("https://overpass-api.de/api/interpreter", signal, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(q)}`,
  });

  const els = j?.elements ?? [];
  const pt = (e: OsmEl, kind: string): OrganPoint | null => {
    const la = e.lat ?? e.center?.lat;
    const lo = e.lon ?? e.center?.lon;
    if (typeof la !== "number" || typeof lo !== "number") return null;
    const t = e.tags ?? {};
    return { lat: la, lng: lo, kind, label: t.name || t.operator || t.amenity || t.railway || t.man_made || t.highway || kind };
  };
  const bucket = (kind: string, match: (t: Record<string, string>) => boolean) =>
    els.map((e) => ({ e, t: e.tags ?? {} })).filter(({ t }) => match(t)).map(({ e }) => pt(e, kind)).filter(Boolean) as OrganPoint[];

  /* Overpass unreachable is not the same as "nothing is here" — say which. */
  if (!j) {
    const dead = (id: string, label: string) => gap(id, label, "Overpass did not answer — not fetched, not empty.");
    return [
      dead("osm-surveillance", "OSM surveillance"),
      dead("red-light-cameras", "Speed / red-light cameras"),
      dead("civic-fire-police-school", "Fire / police / school / hospital"),
      dead("transit-stops", "Transit stops"),
      dead("rail-crossings", "Rail crossings"),
      dead("ev-chargers", "EV chargers"),
      dead("cell-towers-osm", "Cell masts (OSM)"),
      dead("street-lighting", "Street lighting"),
      dead("parking-meters", "Parking"),
      dead("construction", "Construction"),
    ];
  }

  const defs: Array<[string, string, (t: Record<string, string>) => boolean]> = [
    ["osm-surveillance", "OSM surveillance", (t) => t.man_made === "surveillance"],
    ["red-light-cameras", "Speed / red-light cameras", (t) => t.highway === "speed_camera" || !!t.enforcement],
    ["civic-fire-police-school", "Fire / police / school / hospital", (t) => ["fire_station", "police", "school", "hospital", "clinic"].includes(t.amenity)],
    ["transit-stops", "Transit stops", (t) => t.highway === "bus_stop" || ["station", "halt", "tram_stop"].includes(t.railway)],
    ["rail-crossings", "Rail crossings", (t) => t.railway === "level_crossing"],
    ["ev-chargers", "EV chargers", (t) => t.amenity === "charging_station"],
    ["cell-towers-osm", "Cell masts (OSM)", (t) => (t.man_made === "mast" || t.man_made === "tower") && t["tower:type"] === "communication"],
    ["street-lighting", "Street lighting", (t) => t.highway === "street_lamp"],
    ["parking-meters", "Parking", (t) => t.amenity === "parking" || t.vending === "parking_tickets"],
    ["construction", "Construction", (t) => t.landuse === "construction" || t.building === "construction"],
  ];

  return defs.map(([id, label, match]) => {
    const pts = bucket(id, match);
    return pts.length
      ? live(id, label, pts.length, `OpenStreetMap tags within ${r} m`, pts)
      : gap(id, label, `None tagged in OpenStreetMap within ${r} m`);
  });
}

/* ─────────────────────────── point feeds ─────────────────────────── */

async function pullWeatherAlerts(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const j = await getJson<{ features?: any[] }>(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, signal,
  );
  if (!j) return gap("weather-alerts", "NWS alerts", "api.weather.gov did not answer (US-only service).");
  const f = j.features ?? [];
  if (!f.length) return gap("weather-alerts", "NWS alerts", "No active NWS alert at this point.");
  const names = f.slice(0, 3).map((x) => String(x?.properties?.event ?? "alert")).join(", ");
  return live("weather-alerts", "NWS alerts", f.length, `Active: ${names}`);
}

async function pullQuakes(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const j = await getJson<{ features?: any[] }>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", signal,
  );
  if (!j) return gap("earthquakes", "Earthquakes 24h", "USGS feed did not answer.");
  const near = (j.features ?? [])
    .map((f) => ({ f, c: f?.geometry?.coordinates as number[] }))
    .filter(({ c }) => Array.isArray(c) && distanceM(lat, lng, c[1], c[0]) < 300_000)
    .map(({ f, c }) => ({ lat: c[1], lng: c[0], kind: "quake", label: String(f?.properties?.title ?? "quake") }));
  return near.length
    ? live("earthquakes", "Earthquakes 24h", near.length, "USGS all-day feed within 300 km", near)
    : gap("earthquakes", "Earthquakes 24h", "No USGS event in the last 24 h within 300 km.");
}

async function pullAircraft(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const d = 0.35;
  const j = await getJson<{ states?: any[][] }>(
    `https://opensky-network.org/api/states/all?lamin=${(lat - d).toFixed(3)}&lomin=${(lng - d).toFixed(3)}&lamax=${(lat + d).toFixed(3)}&lomax=${(lng + d).toFixed(3)}`,
    signal,
  );
  if (!j) return gap("aircraft-overhead", "Aircraft overhead", "OpenSky anonymous quota refused or timed out.");
  const pts = (j.states ?? [])
    .filter((s) => typeof s?.[6] === "number" && typeof s?.[5] === "number")
    .map((s) => ({ lat: s[6] as number, lng: s[5] as number, kind: "aircraft", label: String(s[1] ?? s[0] ?? "aircraft").trim() }));
  return pts.length
    ? live("aircraft-overhead", "Aircraft overhead", pts.length, "OpenSky live state vectors", pts)
    : gap("aircraft-overhead", "Aircraft overhead", "No OpenSky state vector in this box right now.");
}

async function pullAirQuality(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const j = await getJson<any>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=pm2_5,pm10,us_aqi`,
    signal,
  );
  const c = j?.current;
  if (!c || typeof c.pm2_5 !== "number") return gap("air-quality", "Air quality", "No modelled air-quality value for this point.");
  return live("air-quality", "Air quality", 1, `PM2.5 ${c.pm2_5} µg/m³ · US AQI ${c.us_aqi ?? "—"} (Open-Meteo CAMS model, not a ground station)`);
}

async function pullStreamGauges(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const d = 0.25;
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((v) => v.toFixed(4)).join(",");
  const j = await getJson<any>(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00065&siteStatus=active`, signal,
  );
  const ts = j?.value?.timeSeries;
  if (!Array.isArray(ts) || !ts.length) return gap("stream-gauges", "USGS water gauges", "No active USGS gauge in this box.");
  const pts = ts.map((t: any) => {
    const g = t?.sourceInfo?.geoLocation?.geogLocation;
    return g ? { lat: Number(g.latitude), lng: Number(g.longitude), kind: "gauge", label: String(t?.sourceInfo?.siteName ?? "gauge") } : null;
  }).filter(Boolean) as OrganPoint[];
  return live("stream-gauges", "USGS water gauges", ts.length, "USGS instantaneous-values service", pts);
}

async function pullPanoramax(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const d = 0.004;
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((v) => v.toFixed(5)).join(",");
  const j = await getJson<{ features?: any[] }>(
    `https://api.panoramax.xyz/api/search?bbox=${bbox}&limit=25`, signal,
  );
  if (!j) return gap("panoramax-stills", "Panoramax street stills", "Panoramax did not answer.");
  const f = j.features ?? [];
  if (!f.length) return gap("panoramax-stills", "Panoramax street stills", "No Panoramax capture within ~400 m.");
  const pts = f.map((x) => {
    const c = x?.geometry?.coordinates;
    return Array.isArray(c) ? { lat: c[1], lng: c[0], kind: "pano", label: "Panoramax still" } : null;
  }).filter(Boolean) as OrganPoint[];
  return live("panoramax-stills", "Panoramax street stills", f.length, "Panoramax open street imagery", pts);
}

async function pullFloodZone(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const url =
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query" +
    `?geometry=${lng.toFixed(5)},${lat.toFixed(5)}&geometryType=esriGeometryPoint&inSR=4326` +
    "&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json";
  const j = await getJson<any>(url, signal);
  if (!j) return gap("flood-zone", "FEMA flood zone", "FEMA NFHL did not answer (US-only service).");
  const a = j?.features?.[0]?.attributes;
  if (!a?.FLD_ZONE) return gap("flood-zone", "FEMA flood zone", "No NFHL polygon covers this point.");
  return live("flood-zone", "FEMA flood zone", 1, `Zone ${a.FLD_ZONE}${a.ZONE_SUBTY ? ` · ${a.ZONE_SUBTY}` : ""} (FEMA NFHL)`);
}

async function pullMetar(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const d = 0.9;
  const bbox = [lat - d, lng - d, lat + d, lng + d].map((v) => v.toFixed(2)).join(",");
  const j = await getJson<any[]>(
    `https://aviationweather.gov/api/data/metar?format=json&bbox=${bbox}`, signal,
  );
  if (!Array.isArray(j)) return gap("airport-metar", "Airport METAR", "aviationweather.gov did not answer.");
  if (!j.length) return gap("airport-metar", "Airport METAR", "No reporting station within ~100 km.");
  const first = j[0];
  return live("airport-metar", "Airport METAR", j.length, `${first?.icaoId ?? "station"}: ${String(first?.rawOb ?? "").slice(0, 90)}`);
}

async function pullWildfire(lat: number, lng: number, signal?: AbortSignal): Promise<OrganResult> {
  const url =
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query" +
    `?geometry=${lng.toFixed(4)},${lat.toFixed(4)}&geometryType=esriGeometryPoint&inSR=4326&distance=150000&units=esriSRUnit_Meter` +
    "&spatialRel=esriSpatialRelIntersects&outFields=IncidentName,DailyAcres&returnGeometry=true&f=json&resultRecordCount=25";
  const j = await getJson<any>(url, signal);
  if (!j) return gap("wildfire-perimeters", "Wildfire incidents", "NIFC WFIGS did not answer.");
  const f = j?.features ?? [];
  if (!f.length) return gap("wildfire-perimeters", "Wildfire incidents", "No current NIFC incident within 150 km.");
  const pts = f.map((x: any) => (x?.geometry ? { lat: x.geometry.y, lng: x.geometry.x, kind: "fire", label: String(x?.attributes?.IncidentName ?? "incident") } : null)).filter(Boolean) as OrganPoint[];
  return live("wildfire-perimeters", "Wildfire incidents", f.length, "NIFC WFIGS current incidents within 150 km", pts);
}

/* ─────────────────────────── collector ─────────────────────────── */

export interface OrganPull {
  results: OrganResult[];
  /** All paintable points, flattened and capped. */
  points: OrganPoint[];
}

/**
 * Pull every browser-reachable public organ for a point, in parallel.
 * Never throws: a dead endpoint becomes a gap, never a broken map.
 */
export async function pullNearbyOrgans(
  lat: number,
  lng: number,
  opts: { radiusM?: number; signal?: AbortSignal } = {},
): Promise<OrganPull> {
  const radiusM = opts.radiusM ?? 800;
  const s = opts.signal;

  const settled = await Promise.allSettled<OrganResult | OrganResult[]>([
    pullOverpass(lat, lng, radiusM, s),
    pullWeatherAlerts(lat, lng, s),
    pullQuakes(lat, lng, s),
    pullAircraft(lat, lng, s),
    pullAirQuality(lat, lng, s),
    pullStreamGauges(lat, lng, s),
    pullPanoramax(lat, lng, s),
    pullFloodZone(lat, lng, s),
    pullMetar(lat, lng, s),
    pullWildfire(lat, lng, s),
  ]);

  const results: OrganResult[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    if (Array.isArray(r.value)) results.push(...r.value);
    else results.push(r.value);
  }

  const points = results.flatMap((r) => r.points ?? []).slice(0, 400);
  return { results, points };
}

/* ────────────────── digest over the full organ roster ────────────────── */

/**
 * The roster the operator asked to be counted against. Anything not fetched on
 * this fly is a gap — the digest never paints an unfetched organ green.
 */
export const ORGAN_ROSTER: Array<{ id: string; label: string; kind: "fetch" | "dossier" | "engine" | "refused" }> = [
  { id: "street-cameras", label: "Street cameras", kind: "fetch" },
  { id: "osm-surveillance", label: "OSM surveillance", kind: "fetch" },
  { id: "weather-alerts", label: "NWS alerts", kind: "fetch" },
  { id: "civic-fire-police-school", label: "Fire / police / school", kind: "fetch" },
  { id: "year-built", label: "Year built", kind: "dossier" },
  { id: "ownership", label: "Ownership", kind: "dossier" },
  { id: "occupants", label: "Occupants", kind: "dossier" },
  { id: "crime-at-address", label: "Crime at address", kind: "dossier" },
  { id: "crime-nearby", label: "Crime nearby", kind: "dossier" },
  { id: "parcel-outline", label: "Parcel outline", kind: "dossier" },
  { id: "census-block", label: "Census block", kind: "dossier" },
  { id: "permits", label: "Permits", kind: "dossier" },
  { id: "liens", label: "Liens", kind: "dossier" },
  { id: "last-sale", label: "Last sale", kind: "dossier" },
  { id: "zoning", label: "Zoning", kind: "dossier" },
  { id: "school-catchment", label: "School catchment", kind: "dossier" },
  { id: "flood-zone", label: "Flood zone", kind: "fetch" },
  { id: "roof-color", label: "Roof colour", kind: "fetch" },
  { id: "solar-pool-outbuilding", label: "Solar / pool / outbuilding", kind: "dossier" },
  { id: "units-in-building", label: "Units in building", kind: "dossier" },
  { id: "3hop-from-house", label: "3-hop from house", kind: "dossier" },
  { id: "who-lives-graph", label: "Who-lives graph", kind: "dossier" },
  { id: "vehicles-public", label: "Vehicles (public)", kind: "dossier" },
  { id: "business-license", label: "Business licence", kind: "dossier" },
  { id: "lane-closures", label: "Lane closures", kind: "fetch" },
  { id: "traffic-incidents", label: "Traffic incidents", kind: "fetch" },
  { id: "air-quality", label: "Air quality", kind: "fetch" },
  { id: "stream-gauges", label: "Stream gauges", kind: "fetch" },
  { id: "tide-marine", label: "Tide / marine", kind: "fetch" },
  { id: "wildfire-perimeters", label: "Wildfire incidents", kind: "fetch" },
  { id: "earthquakes", label: "Earthquakes", kind: "fetch" },
  { id: "aircraft-overhead", label: "Aircraft overhead", kind: "fetch" },
  { id: "transit-stops", label: "Transit stops", kind: "fetch" },
  { id: "rail-crossings", label: "Rail crossings", kind: "fetch" },
  { id: "311-issues", label: "311 issues", kind: "dossier" },
  { id: "power-outages", label: "Power outages", kind: "dossier" },
  { id: "nps-noaa-webcams", label: "NPS / NOAA webcams", kind: "dossier" },
  { id: "airport-metar", label: "Airport METAR", kind: "fetch" },
  { id: "ev-chargers", label: "EV chargers", kind: "fetch" },
  { id: "cell-towers-osm", label: "Cell masts (OSM)", kind: "fetch" },
  { id: "street-lighting", label: "Street lighting", kind: "fetch" },
  { id: "parking-meters", label: "Parking", kind: "fetch" },
  { id: "construction", label: "Construction", kind: "fetch" },
  { id: "india-mca-courts", label: "India MCA / courts", kind: "dossier" },
  { id: "panoramax-stills", label: "Panoramax stills", kind: "fetch" },
  { id: "caltrans-still-history", label: "Caltrans still history", kind: "engine" },
  { id: "compare-two-properties", label: "Compare two properties", kind: "engine" },
  { id: "tile-cache", label: "Tile cache", kind: "engine" },
  { id: "keep-warm-server", label: "Keep-warm server", kind: "engine" },
  { id: "last-frame-under-glass", label: "Last frame under glass", kind: "engine" },
  { id: "identity-tags-lookalike", label: "Identity tags / lookalike", kind: "engine" },
  { id: "area-code-geoint", label: "Area-code GEOINT", kind: "engine" },
  { id: "red-light-cameras", label: "Red-light / speed cameras", kind: "fetch" },
  { id: "change-ping-append", label: "Change-ping append", kind: "engine" },
  { id: "sex-offender-distance-tagged", label: "Sex-offender distance", kind: "refused" },
];

export interface OrganDigest {
  live: number;
  gap: number;
  engine: number;
  refused: number;
  total: number;
  rows: OrganResult[];
}

/**
 * Fold the fetched organs plus the dossier's own fields into the roster.
 * `dossierLive` carries the ids the public-index record actually filled.
 */
export function buildOrganDigest(fetched: OrganResult[], dossierLive: Set<string> = new Set()): OrganDigest {
  const byId = new Map(fetched.map((r) => [r.id, r]));
  const rows = ORGAN_ROSTER.map<OrganResult>((o) => {
    const hit = byId.get(o.id);
    if (hit) return hit;
    if (o.kind === "refused") return { id: o.id, label: o.label, status: "refused", count: 0, note: "Not fetched by policy." };
    if (o.kind === "engine") return { id: o.id, label: o.label, status: "engine", count: 0, note: "Local capability, not a public feed." };
    if (dossierLive.has(o.id)) return { id: o.id, label: o.label, status: "live", count: 1, note: "Filled from the public-index dossier." };
    return { id: o.id, label: o.label, status: "gap", count: 0, note: "not in public index" };
  });
  return {
    live: rows.filter((r) => r.status === "live").length,
    gap: rows.filter((r) => r.status === "gap").length,
    engine: rows.filter((r) => r.status === "engine").length,
    refused: rows.filter((r) => r.status === "refused").length,
    total: rows.length,
    rows,
  };
}
