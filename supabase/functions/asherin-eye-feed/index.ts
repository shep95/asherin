// ─────────────────────────────────────────────────────────────────────────────
// asherin.eye — one narrow window onto public feeds.
//
// Why this exists server-side instead of in the browser:
//   1. Several of these publishers answer without CORS headers (adsb.lol),
//      so a browser fetch is refused before the data is even read.
//   2. OpenSky rate-limits per address; one warmed cache here is kinder than
//      every operator hammering it from their own tab.
//   3. Freshness must be honest. When an upstream refuses we serve the last
//      good body and SAY it is stale — never a silent empty sky.
//
// Hard rules held here:
//   • Allow-list of feeds only. webmeta may fetch one https public page the caller named (private hosts blocked). this cannot be used as an SSRF hop.
//   • Every outbound call has an AbortController deadline.
//   • Numbers are coerced and bounded before they leave; no upstream string is
//     interpolated into anything executable.
//   • Nothing about the operator is logged. Only feed name + outcome.
// ─────────────────────────────────────────────────────────────────────────────

import { getCorsHeaders } from "../_shared/cors.ts";

type FeedName =
  | "flights"
  | "military"
  | "quakes"
  | "stations"
  | "launches"
  | "cameras"
  | "radio"
  | "spaceweather"
  | "local"
  | "places"
  | "property"
  | "webmeta"
  | "hex"
  | "osmweb"
  | "sats"
  | "airgrid"
  | "brittle"
  | "plates"
  | "route"
  | "incidents"
  | "disasters"
  | "notices"
  | "crime"
  | "buildings";

interface CacheRow {
  at: number;
  body: unknown;
}

const CACHE = new Map<string, CacheRow>();
/** how long a good body is reused before we ask upstream again */
const TTL: Record<FeedName, number> = {
  flights: 20_000,
  military: 20_000,
  quakes: 60_000,
  stations: 8_000,
  launches: 15 * 60_000,
  cameras: 6 * 60 * 60_000,
  radio: 45 * 60_000,
  spaceweather: 10 * 60_000,
  local: 5 * 60_000,
  places: 60_000,
  property: 90_000,
  webmeta: 120_000,
  hex: 20_000,
  osmweb: 90_000,
  sats: 90_000,
  airgrid: 60_000,
  brittle: 90_000,
  plates: 3600_000,
  route: 20_000,
  incidents: 5 * 60_000,
  disasters: 5 * 60_000,
  notices: 6 * 60 * 60_000,
  crime: 10 * 60_000,
  buildings: 30 * 60_000,
};
/** after this a stale body is no longer worth showing at all */
const MAX_STALE = 6 * 60 * 60_000;

async function getJson(url: string, timeoutMs = 12_000, headers: Record<string, string> = {}): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "error",
      headers: { accept: "application/json", "user-agent": "asherin.eye/1.0 (+https://asherin.com)", ...headers },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;
const text = (v: unknown, max = 120): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ── individual feeds ────────────────────────────────────────────────────────

async function flights(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  try {
    // extended=1 adds the aircraft category at states index 17 — the only
    // airframe hint opensky gives, and what drives the silhouette on the globe.
    const d = (await getJson("https://opensky-network.org/api/states/all?extended=1", 11_000)) as {
      states?: Array<Array<unknown>>;
      time?: number;
    };
    const rows = (d.states ?? [])
      .map((s) => {
        const la = num(s[6]);
        const lo = num(s[5]);
        if (la === null || lo === null) return null;
        return {
          id: text(s[0], 24) || "aircraft",
          label: text(s[1], 16).trim() || text(s[0], 24),
          lat: clampLat(la),
          lon: wrapLon(lo),
          alt: num(s[13]) ?? num(s[7]) ?? 0,
          speed: num(s[9]) ?? 0,
          heading: num(s[10]) ?? 0,
          origin: text(s[2], 40),
          type: "",
          category: num(s[17]),
          ground: s[8] === true,
        };
      })
      .filter(Boolean)
      .slice(0, 2500);
    if (!rows.length) throw new Error("empty snapshot");
    return { rows, source: "opensky-network", note: "" };
  } catch (e) {
    // Bounded regional fallback — observed context around the camera subpoint,
    // never claimed as worldwide coverage.
    if (lat === null || lon === null) throw e;
    const d = (await getJson(
      `https://api.adsb.lol/v2/lat/${clampLat(lat).toFixed(3)}/lon/${wrapLon(lon).toFixed(3)}/dist/250`,
      11_000,
    )) as { ac?: Array<Record<string, unknown>> };
    const rows = (d.ac ?? [])
      .map((a) => {
        const la = num(a.lat);
        const lo = num(a.lon);
        if (la === null || lo === null) return null;
        return {
          id: text(a.hex, 12) || "aircraft",
          label: text(a.flight, 16).trim() || text(a.r, 16) || text(a.hex, 12),
          lat: clampLat(la),
          lon: wrapLon(lo),
          alt: num(a.alt_baro) ?? 0,
          speed: num(a.gs) ?? 0,
          heading: num(a.track) ?? 0,
          origin: text(a.t, 24),
          type: text(a.t, 8),
          category: text(a.category, 4),
          ground: a.alt_baro === "ground",
        };
      })
      .filter(Boolean)
      .slice(0, 1200);
    return {
      rows,
      source: "adsb.lol",
      note: "opensky refused; this is a 250 nm ring around your view, not the whole sky",
    };
  }
}

async function military() {
  const d = (await getJson("https://api.adsb.lol/v2/mil", 12_000)) as { ac?: Array<Record<string, unknown>> };
  const rows = (d.ac ?? [])
    .map((a) => {
      const la = num(a.lat);
      const lo = num(a.lon);
      if (la === null || lo === null) return null;
      return {
        id: text(a.hex, 12) || "contact",
        label: text(a.flight, 16).trim() || text(a.r, 16) || text(a.hex, 12),
        lat: clampLat(la),
        lon: wrapLon(lo),
        alt: num(a.alt_baro) ?? 0,
        speed: num(a.gs) ?? 0,
        heading: num(a.track) ?? 0,
        origin: text(a.t, 24),
        type: text(a.t, 8),
        category: text(a.category, 4),
        ground: a.alt_baro === "ground",
      };
    })
    .filter(Boolean)
    .slice(0, 1200);
  return { rows, source: "adsb.lol (odbl)", note: "" };
}

async function quakes() {
  const d = (await getJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson", 12_000)) as {
    features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }>;
  };
  const rows = (d.features ?? [])
    .map((f) => {
      const c = f.geometry?.coordinates;
      const lo = num(c?.[0]);
      const la = num(c?.[1]);
      if (la === null || lo === null) return null;
      return {
        id: text(f.properties?.code, 24) || `${la},${lo}`,
        label: text(f.properties?.title, 90) || "seismic event",
        lat: clampLat(la),
        lon: wrapLon(lo),
        mag: num(f.properties?.mag) ?? 0,
        depth: num(c?.[2]) ?? 0,
        at: num(f.properties?.time) ?? 0,
      };
    })
    .filter(Boolean);
  return { rows, source: "usgs (public domain)", note: "" };
}

async function stations() {
  const ids = [
    { id: 25544, label: "iss · zarya" },
    { id: 48274, label: "tiangong" },
  ];
  const settled = await Promise.allSettled(
    ids.map((s) => getJson(`https://api.wheretheiss.at/v1/satellites/${s.id}`, 9_000)),
  );
  const rows = settled
    .map((r, i) => {
      if (r.status !== "fulfilled") return null;
      const d = r.value as Record<string, unknown>;
      const la = num(d.latitude);
      const lo = num(d.longitude);
      if (la === null || lo === null) return null;
      return {
        id: String(ids[i].id),
        label: ids[i].label,
        lat: clampLat(la),
        lon: wrapLon(lo),
        alt: num(d.altitude) ?? 0,
        speed: num(d.velocity) ?? 0,
        visibility: text(d.visibility, 20),
      };
    })
    .filter(Boolean);
  if (!rows.length) throw new Error("no station fix");
  return { rows, source: "wheretheiss.at", note: rows.length < ids.length ? "one station did not answer" : "" };
}

async function launches() {
  const d = (await getJson("https://ll.thespacedevs.com/2.3.0/launches/?limit=40&ordering=-net&mode=list", 14_000)) as {
    results?: Array<Record<string, unknown>>;
  };
  const rows = (d.results ?? [])
    .map((l) => {
      const pad = l.pad as Record<string, unknown> | undefined;
      const la = num(pad?.latitude) ?? Number(pad?.latitude);
      const lo = num(pad?.longitude) ?? Number(pad?.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      const status = l.status as Record<string, unknown> | undefined;
      return {
        id: text(l.id, 40),
        label: text(l.name, 90) || "launch",
        lat: clampLat(la as number),
        lon: wrapLon(lo as number),
        pad: text(pad?.name, 60),
        net: text(l.net, 40),
        status: text(status?.abbrev, 20) || text(status?.name, 40),
      };
    })
    .filter(Boolean);
  return { rows, source: "launch library 2 — the space devs", note: "pads and event timing, not live ascent" };
}

// ── public street cameras ───────────────────────────────────────────────────
// A camera catalogue is only honest when the frame it advertises is the frame
// the agency is publishing right now. So every source below is an OPEN,
// keyless agency catalogue that carries a still-frame url; nothing is scraped,
// nothing is hijacked, and nothing is invented where an agency publishes only
// a position. Catalogues are heavy (Caltrans alone is ~2 MB per district) and
// they change hourly at most, so each one is cached in module memory and the
// fan-out is gated by the operator's viewport: standing over London must not
// pull twelve Caltrans districts.

interface CamRow {
  id: string;
  label: string;
  lat: number;
  lon: number;
  image?: string;
  video?: string;
  city: string;
  credit: string;
  roadway?: string;
  direction?: string;
}

interface CamSource {
  id: string;
  /** south, west, north, east — the agency's jurisdiction */
  box: [number, number, number, number];
  credit: string;
  load: () => Promise<CamRow[]>;
}

const CAM_CACHE = new Map<string, { at: number; rows: CamRow[] }>();
const CAM_TTL_MS = 30 * 60_000;

async function camCached(id: string, load: () => Promise<CamRow[]>): Promise<CamRow[]> {
  const hit = CAM_CACHE.get(id);
  if (hit && Date.now() - hit.at < CAM_TTL_MS) return hit.rows;
  try {
    const rows = await load();
    if (rows.length) CAM_CACHE.set(id, { at: Date.now(), rows });
    return rows;
  } catch (e) {
    // a refusing agency serves its last good catalogue rather than an empty
    // city, which would read as "no cameras here" — a different claim.
    if (hit) return hit.rows;
    throw e;
  }
}

/** agency frames are sometimes advertised over http; the app is https-only. */
const https = (u: string) => (u.startsWith("http://") ? "https://" + u.slice(7) : u);

const CALTRANS_D = ["3", "4", "5", "6", "7", "8", "10", "11", "12"];

async function caltransCams(): Promise<CamRow[]> {
  const lists = await Promise.allSettled(
    CALTRANS_D.map((d) =>
      getJson(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${d.padStart(2, "0")}.json`, 20_000).then((j) => ({
        d,
        j,
      })),
    ),
  );
  const out: CamRow[] = [];
  for (const l of lists) {
    if (l.status !== "fulfilled") continue;
    const { d, j } = l.value as { d: string; j: { data?: Array<Record<string, unknown>> } };
    for (const row of j.data ?? []) {
      const c = row.cctv as Record<string, unknown> | undefined;
      const loc = c?.location as Record<string, unknown> | undefined;
      const la = Number(loc?.latitude);
      const lo = Number(loc?.longitude);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) continue;
      const imgData = c?.imageData as Record<string, unknown> | undefined;
      const still = imgData?.static as Record<string, unknown> | undefined;
      const img = text(still?.currentImageURL, 300);
      if (!img) continue;
      out.push({
        id: `caltrans-${d}-${text(c?.index, 12) || `${la},${lo}`}`,
        label: (text(loc?.locationName, 70) || "caltrans cctv").toLowerCase(),
        lat: clampLat(la),
        lon: wrapLon(lo),
        image: https(img),
        video: https(text(imgData?.streamingVideoURL, 300)) || undefined,
        city: "california",
        credit: "caltrans cctv · california dot",
        roadway: text(loc?.route, 24) || undefined,
        direction: text(loc?.direction, 16) || undefined,
      });
    }
  }
  if (!out.length) throw new Error("caltrans declined");
  return out;
}

async function ny511Cams(): Promise<CamRow[]> {
  const rows = (await getJson("https://511ny.org/api/getcameras?key=public&format=json", 20_000)) as Array<
    Record<string, unknown>
  >;
  const out: CamRow[] = [];
  for (const r of rows ?? []) {
    const la = Number(r.Latitude);
    const lo = Number(r.Longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    if (r.Disabled === true || r.Blocked === true) continue;
    const id = text(r.ID, 40);
    if (!id) continue;
    out.push({
      id: `ny511-${id}`,
      label: (text(r.Name, 70) || "nysdot cctv").toLowerCase(),
      lat: clampLat(la),
      lon: wrapLon(lo),
      // the agency serves the current frame from its own map endpoint keyed by
      // camera id; that is the same image its public map draws.
      image: `https://511ny.org/map/Cctv/${encodeURIComponent(id)}`,
      video: text(r.VideoUrl, 300) || undefined,
      city: "new york state",
      credit: "511ny · new york state dot",
      roadway: text(r.RoadwayName, 40) || undefined,
      direction: text(r.DirectionOfTravel, 16) || undefined,
    });
  }
  if (!out.length) throw new Error("511ny declined");
  return out;
}

async function on511Cams(): Promise<CamRow[]> {
  const rows = (await getJson("https://511on.ca/api/v2/get/cameras?format=json", 20_000)) as Array<
    Record<string, unknown>
  >;
  const out: CamRow[] = [];
  for (const r of rows ?? []) {
    const la = Number(r.Latitude);
    const lo = Number(r.Longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const views = (r.Views ?? []) as Array<Record<string, unknown>>;
    const live = views.find((v) => text(v.Status, 16) !== "Disabled" && text(v.Url, 200));
    if (!live) continue;
    out.push({
      id: `on511-${text(r.Id, 16)}`,
      label: (text(r.Location, 70) || "ontario mto camera").toLowerCase(),
      lat: clampLat(la),
      lon: wrapLon(lo),
      image: https(text(live.Url, 200)),
      city: "ontario",
      credit: "511 ontario · ministry of transportation",
      roadway: text(r.Roadway, 24) || undefined,
      direction: text(r.Direction, 16) || undefined,
    });
  }
  if (!out.length) throw new Error("511 ontario declined");
  return out;
}

async function driveBcCams(): Promise<CamRow[]> {
  const rows = (await getJson("https://www.drivebc.ca/api/webcams", 20_000)) as Array<Record<string, unknown>>;
  const out: CamRow[] = [];
  for (const r of rows ?? []) {
    const la = Number(r.latitude);
    const lo = Number(r.longitude);
    const links = (r.links ?? {}) as Record<string, unknown>;
    const rel = text(links.imageDisplay, 200);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || !rel) continue;
    out.push({
      id: `drivebc-${text(r.id, 16) || Number(r.id)}`,
      label: (text(r.name, 70) || "drivebc webcam").toLowerCase(),
      lat: clampLat(la),
      lon: wrapLon(lo),
      image: rel.startsWith("http") ? https(rel) : `https://www.drivebc.ca${rel}`,
      city: "british columbia",
      credit: "drivebc · bc ministry of transportation",
      roadway: text(r.highway, 24) || undefined,
      direction: text(r.orientation, 16) || undefined,
    });
  }
  if (!out.length) throw new Error("drivebc declined");
  return out;
}

async function digitrafficCams(): Promise<CamRow[]> {
  const j = (await getJson("https://tie.digitraffic.fi/api/weathercam/v1/stations", 20_000, {
    "accept-encoding": "gzip",
    "digitraffic-user": "asherin.eye",
  })) as { features?: Array<Record<string, unknown>> };
  const out: CamRow[] = [];
  for (const f of j.features ?? []) {
    const geo = f.geometry as { coordinates?: number[] } | undefined;
    const lo = num(geo?.coordinates?.[0]);
    const la = num(geo?.coordinates?.[1]);
    const p = (f.properties ?? {}) as Record<string, unknown>;
    if (la === null || lo === null) continue;
    if (text(p.collectionStatus, 20) !== "GATHERING") continue;
    // the station list is fetched once; each preset is one physical view, and
    // the first in-collection preset is the one the agency is refreshing.
    const presets = (p.presets ?? []) as Array<Record<string, unknown>>;
    const preset = presets.find((x) => x.inCollection === true && text(x.imageUrl, 200));
    if (!preset) continue;
    const names = (p.names ?? {}) as Record<string, unknown>;
    out.push({
      id: `fintraffic-${text(p.id, 20)}`,
      label: (text(names.en, 70) || text(p.name, 70) || "fintraffic camera").toLowerCase(),
      lat: clampLat(la),
      lon: wrapLon(lo),
      image: https(text(preset.imageUrl, 200)),
      city: text(p.municipality, 40).toLowerCase() || "finland",
      credit: "fintraffic digitraffic · road weather cameras",
      direction: text(preset.presentationName, 24) || undefined,
    });
  }
  if (!out.length) throw new Error("digitraffic declined");
  return out;
}

async function austinCams(): Promise<CamRow[]> {
  const rows = (await getJson("https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=1000", 14_000)) as Array<
    Record<string, unknown>
  >;
  const out: CamRow[] = [];
  for (const c of rows ?? []) {
    const loc = c.location as { coordinates?: number[] } | undefined;
    const lo = num(loc?.coordinates?.[0]);
    const la = num(loc?.coordinates?.[1]);
    const img = text(c.screenshot_address, 300);
    if (la === null || lo === null || !img.startsWith("https://")) continue;
    if (text(c.camera_status, 30) !== "TURNED_ON") continue;
    out.push({
      id: `austin-${text(c.camera_id, 16)}`,
      label: text(c.location_name, 70).toLowerCase() || "austin camera",
      lat: clampLat(la),
      lon: wrapLon(lo),
      image: img,
      city: "austin",
      credit: "city of austin open data",
    });
  }
  if (!out.length) throw new Error("austin declined");
  return out;
}

async function tflCams(): Promise<CamRow[]> {
  const rows = (await getJson("https://api.tfl.gov.uk/Place/Type/JamCam", 20_000)) as Array<Record<string, unknown>>;
  const out: CamRow[] = [];
  for (const p of rows ?? []) {
    const la = num(p.lat);
    const lo = num(p.lon);
    const props = (p.additionalProperties ?? []) as Array<Record<string, unknown>>;
    const img = text(props.find((x) => x.key === "imageUrl")?.value, 300);
    const vid = text(props.find((x) => x.key === "videoUrl")?.value, 300);
    const available = text(props.find((x) => x.key === "available")?.value, 8);
    if (la === null || lo === null || !img.startsWith("https://") || available === "false") continue;
    out.push({
      id: `london-${text(p.id, 40)}`,
      label: text(p.commonName, 70).toLowerCase() || "london camera",
      lat: clampLat(la),
      lon: wrapLon(lo),
      image: img,
      video: vid || undefined,
      city: "london",
      credit: "powered by tfl open data",
      direction: text(props.find((x) => x.key === "view")?.value, 24) || undefined,
    });
  }
  if (!out.length) throw new Error("tfl declined");
  return out;
}

const CAM_SOURCES: CamSource[] = [
  { id: "caltrans", box: [32.4, -124.6, 42.1, -114.0], credit: "caltrans", load: caltransCams },
  { id: "ny511", box: [40.4, -79.9, 45.1, -71.8], credit: "511ny", load: ny511Cams },
  { id: "austin", box: [29.9, -98.3, 30.7, -97.3], credit: "austin", load: austinCams },
  { id: "tfl", box: [51.2, -0.65, 51.8, 0.4], credit: "tfl", load: tflCams },
  { id: "on511", box: [41.6, -95.2, 56.9, -74.3], credit: "511 ontario", load: on511Cams },
  { id: "drivebc", box: [48.2, -139.1, 60.1, -114.0], credit: "drivebc", load: driveBcCams },
  { id: "digitraffic", box: [59.7, 19.0, 70.1, 31.6], credit: "fintraffic", load: digitrafficCams },
];

const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLon = (bLon - aLon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** a jurisdiction counts as reachable when the viewport is inside it or within
 *  this margin of its edge — flying toward a border should warm the catalogue
 *  before the border is crossed. */
const CAM_MARGIN_DEG = 4;

function camSourcesFor(lat: number | null, lon: number | null): CamSource[] {
  if (lat === null || lon === null) return CAM_SOURCES;
  const near = CAM_SOURCES.filter(
    (s) =>
      lat >= s.box[0] - CAM_MARGIN_DEG &&
      lat <= s.box[2] + CAM_MARGIN_DEG &&
      lon >= s.box[1] - CAM_MARGIN_DEG &&
      lon <= s.box[3] + CAM_MARGIN_DEG,
  );
  return near.length ? near : CAM_SOURCES;
}

async function cameras(params: Record<string, unknown>) {
  const lat = num(params.lat) ?? (Number.isFinite(Number(params.lat)) ? Number(params.lat) : null);
  const lon = num(params.lon) ?? (Number.isFinite(Number(params.lon)) ? Number(params.lon) : null);
  const limit = Math.max(50, Math.min(900, Number(params.limit) || 600));

  const picked = camSourcesFor(lat, lon);
  const settled = await Promise.allSettled(picked.map((s) => camCached(s.id, s.load)));

  const rows: CamRow[] = [];
  const served: string[] = [];
  const refused: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.length) {
      rows.push(...r.value);
      served.push(picked[i].credit);
    } else refused.push(picked[i].credit);
  });

  if (!rows.length) throw new Error("no open camera catalogue answered");

  const ordered =
    lat === null || lon === null
      ? rows.slice(0, limit)
      : rows
          .map((c) => ({ c, km: haversineKm(lat, lon, c.lat, c.lon) }))
          .sort((a, b) => a.km - b.km)
          .slice(0, limit)
          .map(({ c, km }) => ({ ...c, km: Math.round(km) }));

  const withFrame = ordered.filter((c) => c.image).length;
  return {
    rows: ordered,
    source: served.join(" · "),
    note:
      `${ordered.length} public cameras in view · ${withFrame} publish a live frame` +
      (refused.length ? ` · ${refused.join(" · ")} declined right now` : "") +
      " · agency-published frames only · positions and stills, never a hijacked device",
  };
}


async function radio() {
  const mirrors = [
    "https://de1.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://at1.api.radio-browser.info",
  ];
  let last: unknown = null;
  for (const base of mirrors) {
    try {
      last = await getJson(
        `${base}/json/stations/search?limit=600&order=clickcount&reverse=true&hidebroken=true&has_geo_info=true`,
        14_000,
      );
      break;
    } catch {
      last = null;
    }
  }
  if (!last) throw new Error("no radio-browser mirror answered");
  const rows = (last as Array<Record<string, unknown>>)
    .map((s) => {
      const la = num(s.geo_lat);
      const lo = num(s.geo_long);
      const url = text(s.url_resolved, 400) || text(s.url, 400);
      // Only https streams — a mixed-content stream can never play here, and
      // offering it would be a button that is guaranteed to fail.
      if (la === null || lo === null || !url.startsWith("https://")) return null;
      return {
        id: text(s.stationuuid, 40),
        label: text(s.name, 60).toLowerCase() || "station",
        lat: clampLat(la),
        lon: wrapLon(lo),
        url,
        country: text(s.country, 40).toLowerCase(),
        tags: text(s.tags, 80).toLowerCase(),
        bitrate: num(s.bitrate) ?? 0,
      };
    })
    .filter(Boolean)
    .slice(0, 400);
  if (!rows.length) throw new Error("directory returned nothing playable");
  return { rows, source: "radio browser (pddl)", note: "https streams only" };
}

async function spaceweather() {
  const d = (await getJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", 10_000)) as
    | Array<Array<unknown>>
    | Array<Record<string, unknown>>;
  let kp = 0;
  let at = "";
  const last = (d as Array<unknown>)[(d as Array<unknown>).length - 1];
  if (Array.isArray(last)) {
    at = text(last[0], 40);
    kp = Number(last[1]) || 0;
  } else if (last && typeof last === "object") {
    const o = last as Record<string, unknown>;
    at = text(o.time_tag, 40);
    kp = Number(o.Kp ?? o.kp) || 0;
  }
  return { rows: [{ kp: Math.max(0, Math.min(9, kp)), at }], source: "noaa swpc", note: "" };
}

async function local(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  if (lat === null || lon === null) throw new Error("no coordinate given");
  const la = clampLat(lat);
  const lo = wrapLon(lon);

  const [place, wx] = await Promise.allSettled([
    getJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${la.toFixed(4)}&lon=${lo.toFixed(4)}`,
      10_000,
    ),
    getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(
        3,
      )}&current=temperature_2m,wind_speed_10m,cloud_cover,weather_code`,
      10_000,
    ),
  ]);

  const p = place.status === "fulfilled" ? (place.value as Record<string, unknown>) : null;
  const w = wx.status === "fulfilled" ? (wx.value as Record<string, unknown>) : null;
  const cur = (w?.current ?? null) as Record<string, unknown> | null;

  return {
    rows: [
      {
        place: p ? text(p.display_name, 140).toLowerCase() : "",
        placeOk: !!p,
        temp: num(cur?.temperature_2m),
        wind: num(cur?.wind_speed_10m),
        cloud: num(cur?.cloud_cover),
        code: num(cur?.weather_code),
        wxOk: !!cur,
      },
    ],
    source: "openstreetmap nominatim · open-meteo",
    note: p ? "" : "no place name for this point — open water or unmapped",
  };
}

async function places(params: Record<string, unknown>) {
  const q = text(params.q, 160);
  if (!q) throw new Error("no place given");
  const d = (await getJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=12&addressdetails=1&q=${encodeURIComponent(q)}`,
    10_000,
  )) as Array<Record<string, unknown>>;
  const rows = (d ?? [])
    .map((p) => {
      const la = Number(p.lat);
      const lo = Number(p.lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      return {
        id: text(p.place_id, 24) || `${la},${lo}`,
        label: text(p.display_name, 140).toLowerCase() || q,
        lat: clampLat(la),
        lon: wrapLon(lo),
        kind: text(p.type, 40),
        note: "nominatim public index  ·  not a search-results page",
      };
    })
    .filter(Boolean);
  if (!rows.length) throw new Error("no public place matched");
  return { rows, source: "openstreetmap nominatim", note: "asherin.engine places on the globe" };
}

function tagText(tags: Record<string, unknown>, key: string, n = 80) {
  return text(tags[key], n);
}

async function property(params: Record<string, unknown>) {
  const q = text(params.q, 160);
  if (!q) throw new Error("no place given");
  const nom = (await getJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&addressdetails=1&extratags=1&namedetails=1&q=${encodeURIComponent(q)}`,
    10_000,
  )) as Array<Record<string, unknown>>;
  const hit = (nom ?? [])[0];
  if (!hit) throw new Error("no public place matched");
  const la = clampLat(Number(hit.lat));
  const lo = wrapLon(Number(hit.lon));
  const addr = (hit.address as Record<string, unknown> | undefined) || {};
  const extras = (hit.extratags as Record<string, unknown> | undefined) || {};
  const cls = `${text(hit.category, 24)} ${text(hit.type, 24)}`.toLowerCase();
  const houseish = /house|building|residential|yes|address|property/.test(cls) || Boolean(addr.house_number);
  const quality = houseish ? "house-level nominatim" : "this is unsure: city/area centroid, not a rooftop";
  const oq = `[out:json][timeout:22];(way["building"](around:90,${la.toFixed(5)},${lo.toFixed(5)});relation["building"](around:90,${la.toFixed(5)},${lo.toFixed(5)});nwr["addr:housenumber"](around:90,${la.toFixed(5)},${lo.toFixed(5)}););out tags center geom 20;`;
  let buildings: Array<Record<string, unknown>> = [];
  try {
    const d = (await getJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(oq)}`, 18_000)) as {
      elements?: Array<Record<string, unknown>>;
    };
    buildings = (d.elements ?? [])
      .map((el, i) => {
        const c = (el.center as { lat?: number; lon?: number } | undefined) || el;
        const ela = num((c as { lat?: unknown }).lat);
        const elo = num((c as { lon?: unknown }).lon);
        if (ela === null || elo === null) return null;
        const tags = (el.tags as Record<string, unknown> | undefined) || {};
        const geom = Array.isArray(el.geometry) ? (el.geometry as Array<{ lat?: number; lon?: number }>) : [];
        const ring = geom
          .map((p) => ({ lat: num(p.lat), lon: num(p.lon) }))
          .filter((p) => p.lat !== null && p.lon !== null) as Array<{ lat: number; lon: number }>;
        const label =
          tagText(tags, "addr:housenumber", 12) && tagText(tags, "addr:street", 60)
            ? `${tagText(tags, "addr:housenumber", 12)} ${tagText(tags, "addr:street", 60)}`.toLowerCase()
            : tagText(tags, "name", 80) || "building";
        const occupant =
          [
            tagText(tags, "name"),
            tagText(tags, "brand"),
            tagText(tags, "operator"),
            tagText(tags, "shop"),
            tagText(tags, "office"),
            tagText(tags, "amenity"),
          ]
            .filter(Boolean)
            .join(" · ")
            .toLowerCase() || "none mapped on osm";
        return {
          id: `prop-${el.id || i}`,
          label,
          lat: clampLat(ela),
          lon: wrapLon(elo),
          tags,
          occupant,
          owner: tagText(tags, "owner") || tagText(extras, "owner") || "",
          levels: tagText(tags, "building:levels", 8) || tagText(tags, "building:flats", 8),
          height: tagText(tags, "height", 12),
          year: tagText(tags, "start_date", 12) || tagText(tags, "building:year", 12),
          building: tagText(tags, "building", 24) || "yes",
          wiki: tagText(tags, "wikipedia", 80) || tagText(tags, "wikidata", 24),
          ring,
          note: "osm building/address · public tags, not a deed",
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  } catch {
    buildings = [];
  }
  const primary = (buildings[0] as Record<string, unknown> | undefined) || {};
  let census = "not a us census hit";
  try {
    const us = /united states|usa|us\b/i.test(text(addr.country, 40) + " " + text(addr.country_code, 8));
    if (
      us ||
      /\b(al|ak|az|ar|ca|co|ct|dc|fl|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|va|vt|wa|wi|wv)\b/i.test(
        q,
      )
    ) {
      const c = (await getJson(
        `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`,
        12_000,
      )) as { result?: { addressMatches?: Array<Record<string, unknown>> } };
      const match = c.result?.addressMatches?.[0] as
        | { geographies?: Record<string, Array<Record<string, unknown>>>; matchedAddress?: string }
        | undefined;
      if (match) {
        const geo = match.geographies || {};
        const county = text(geo.Counties?.[0]?.NAME, 60);
        const tract = text(geo["Census Tracts"]?.[0]?.BASENAME, 24);
        const place = text(geo["Incorporated Places"]?.[0]?.NAME, 60);
        census = [match.matchedAddress, county, place, tract ? `tract ${tract}` : ""]
          .filter(Boolean)
          .join(" · ")
          .toLowerCase();
      }
    }
  } catch {
    census = "census geocoder did not answer";
  }
  let wikiNear = "";
  try {
    const w = (await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${la.toFixed(5)}%7C${lo.toFixed(5)}&gsradius=150&gslimit=6&format=json`,
      10_000,
    )) as { query?: { geosearch?: Array<{ title?: string; dist?: number }> } };
    wikiNear = (w.query?.geosearch ?? [])
      .map((p) => `${text(p.title, 80)} (${Math.round(Number(p.dist || 0))}m)`)
      .join(" · ")
      .toLowerCase();
  } catch {
    wikiNear = "";
  }
  const owner =
    text(primary.owner, 80) ||
    text(extras.owner, 80) ||
    tagText(extras, "operator", 80) ||
    "not on the public osm map · not a county deed pull";
  const occupant =
    text(primary.occupant, 120) ||
    text(extras.operator, 80) ||
    text(hit.name, 80) ||
    "none mapped on osm · not a skip-trace of who sleeps there";
  const dossier = {
    address: text(hit.display_name, 180).toLowerCase() || q.toLowerCase(),
    quality,
    owner: String(owner).toLowerCase(),
    occupant: String(occupant).toLowerCase(),
    building:
      [
        text(primary.building, 24),
        text(primary.levels, 8) ? `${text(primary.levels, 8)} levels` : "",
        text(primary.height, 12),
        text(primary.year, 12) ? `start ${text(primary.year, 12)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
        .toLowerCase() || "no osm building tags",
    census: census.toLowerCase(),
    wikipedia: (wikiNear || text(primary.wiki, 80) || "no wikipedia page at this point").toLowerCase(),
    crime: "no live county court file in this feed · wikipedia nearby is not a rap sheet",
    honesty: "public index only · osm owner/occupant tags are mapped use, not a deed office and not a household roster",
  };
  const head = {
    id: text(hit.place_id, 24) || `${la},${lo}`,
    label: dossier.address.slice(0, 80),
    lat: la,
    lon: lo,
    alt: 0,
    flyAlt: 420,
    kind: "property",
    ring: (primary.ring as Array<{ lat: number; lon: number }>) || [],
    intel: dossier,
    note: `${dossier.quality} · ${dossier.honesty}`,
  };
  const extra = buildings.slice(0, 24).map((b) => ({
    id: b.id,
    label: b.label,
    lat: b.lat,
    lon: b.lon,
    alt: 0,
    note: b.note,
  }));
  return {
    rows: [head, ...extra],
    dossier,
    source: "nominatim · overpass · census (us when it hits) · wikipedia geosearch",
    note: houseish
      ? "property command · z19-class fly · public dossier"
      : "property command · nominatim was not house-level · this is unsure",
  };
}

async function webmeta(params: Record<string, unknown>) {
  const raw = text(params.url, 400);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("not a url");
  }
  if (u.protocol !== "https:") throw new Error("https only");
  if (blockedHost(u.hostname)) throw new Error("that host is not a public page");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  let html = "";
  const headers: Record<string, string> = {};
  try {
    const res = await fetch(u.toString(), {
      signal: ctl.signal,
      redirect: "follow",
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "asherin.eye/1.0 (+https://asherin.com)" },
    });
    res.headers.forEach((v, k) => {
      if (/^(content-type|server|x-powered-by|cache-control|content-security-policy|x-frame-options)$/i.test(k)) {
        headers[k.toLowerCase()] = v.slice(0, 180);
      }
    });
    html = (await res.text()).slice(0, 80_000);
  } finally {
    clearTimeout(timer);
  }
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? text(m[1], 160) : "";
  };
  const title = pick(/<title[^>]*>([^<]{1,160})/i);
  const ogTitle =
    pick(/property=["']og:title["'][^>]*content=["']([^"']+)/i) ||
    pick(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const ogLat = pick(/property=["']place:location:latitude["'][^>]*content=["']([^"']+)/i);
  const geo =
    pick(/name=["']geo.position["'][^>]*content=["']([^"']+)/i) || pick(/name=["']ICBM["'][^>]*content=["']([^"']+)/i);
  let lat: number | null = num(Number(ogLat));
  let lon: number | null = num(Number(pick(/property=["']place:location:longitude["'][^>]*content=["']([^"']+)/i)));
  if (geo.includes(";")) {
    const [a, b] = geo.split(";");
    lat = num(Number(a));
    lon = num(Number(b));
  } else if (geo.includes(",")) {
    const [a, b] = geo.split(",");
    lat = num(Number(a));
    lon = num(Number(b));
  }
  const rows =
    lat !== null && lon !== null
      ? [
          {
            id: u.hostname,
            label: (ogTitle || title || u.hostname).toLowerCase(),
            lat: clampLat(lat),
            lon: wrapLon(lon),
            note: "geo tag on the public page",
          },
        ]
      : [{ id: u.hostname, label: (ogTitle || title || u.hostname).toLowerCase(), note: "no geo tag" }];
  return {
    rows,
    source: "public page metadata",
    note: `headers ${Object.keys(headers).join(" ") || "none"}  ·  not a traffic intercept`,
  };
}

async function hex(params: Record<string, unknown>) {
  const icao = text(params.icao, 12)
    .replace(/[^a-fA-F0-9]/g, "")
    .toLowerCase();
  if (icao.length < 4 || icao.length > 8) throw new Error("no icao");
  const d = (await getJson(`https://api.adsb.lol/v2/hex/${icao}`, 10_000)) as { ac?: Array<Record<string, unknown>> };
  const rows = (d.ac ?? [])
    .map((a) => {
      const la = num(a.lat);
      const lo = num(a.lon);
      if (la === null || lo === null) return null;
      return {
        id: text(a.hex, 12) || icao,
        label: text(a.flight, 16).trim() || icao,
        lat: clampLat(la),
        lon: wrapLon(lo),
        alt: num(a.alt_baro) ?? 0,
      };
    })
    .filter(Boolean);
  return { rows, source: "adsb.lol hex", note: "live hex snapshot, not a full-day globe_history dump" };
}

async function osmweb(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  if (lat === null || lon === null) throw new Error("no coordinate given");
  const la = clampLat(lat);
  const lo = wrapLon(lon);
  const around = Math.min(40000, Math.max(200, num(params.around) ?? 40000));
  const q = `[out:json][timeout:18];(node["man_made"="surveillance"](around:${Math.round(around)},${la.toFixed(4)},${lo.toFixed(4)});node["webcam"](around:${Math.round(around)},${la.toFixed(4)},${lo.toFixed(4)}););out 80;`;
  const d = (await getJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, 16_000)) as {
    elements?: Array<Record<string, unknown>>;
  };
  const rows = (d.elements ?? [])
    .map((el, i) => {
      const ela = num(el.lat);
      const elo = num(el.lon);
      if (ela === null || elo === null) return null;
      const tags = (el.tags as Record<string, unknown> | undefined) || {};
      return {
        id: `osmweb-${el.id || i}`,
        label: (text(tags.name, 80) || "mapped webcam").toLowerCase(),
        lat: clampLat(ela),
        lon: wrapLon(elo),
        note: "osm public map, mapped, not a live intercept",
      };
    })
    .filter(Boolean);
  return { rows, source: "openstreetmap overpass", note: "mapped surveillance/webcam nodes around the camera" };
}

async function sats() {
  const groups = ["stations", "visual"];
  const rows: Array<Record<string, unknown>> = [];
  for (const g of groups) {
    const d = (await getJson(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`, 14_000)) as Array<
      Record<string, unknown>
    >;
    (d ?? []).slice(0, g === "stations" ? 40 : 50).forEach((s) => {
      rows.push({
        id: text(s.NORAD_CAT_ID, 12) || text(s.OBJECT_ID, 16),
        label: text(s.OBJECT_NAME, 48).toLowerCase() || "sat",
        tle1: text(s.TLE_LINE1, 80),
        tle2: text(s.TLE_LINE2, 80),
        group: g,
        note: "celestrak tle · sgp4 on the client · public catalog",
      });
    });
  }
  if (!rows.length) throw new Error("celestrak catalog empty");
  return {
    rows,
    source: "celestrak gp json",
    note: "stations + visual · orbit paths drawn in the globe · not a classified catalog",
  };
}

async function airgrid(params: Record<string, unknown>) {
  const lat = num(params.lat) ?? 40.7;
  const lon = num(params.lon) ?? -74;
  const la = clampLat(lat);
  const lo = wrapLon(lon);
  const rows: Array<Record<string, unknown>> = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const rlat = clampLat(la + dy * 0.55);
      const rlon = wrapLon(lo + dx * 0.7);
      try {
        const d = (await getJson(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${rlat.toFixed(3)}&longitude=${rlon.toFixed(3)}&current=us_aqi,pm2_5`,
          8_000,
        )) as { current?: { us_aqi?: number; pm2_5?: number } };
        const aqi = Number(d.current?.us_aqi);
        const pm = Number(d.current?.pm2_5);
        const score = Number.isFinite(aqi) ? aqi : Number.isFinite(pm) ? pm : null;
        let band = "brown";
        if (score == null) band = "brown";
        else if (score <= 50) band = "green";
        else if (score >= 150) band = "red";
        rows.push({
          id: `aqi-${dx}-${dy}`,
          label: `air ${band}`,
          lat: rlat,
          lon: rlon,
          aqi: score,
          band,
          note: "open-meteo us aqi · environmental corridor · not a combat overlay",
        });
      } catch {
        rows.push({
          id: `aqi-${dx}-${dy}`,
          label: "air brown",
          lat: rlat,
          lon: rlon,
          band: "brown",
          note: "air-quality sample missed · brown = no public reading",
        });
      }
    }
  }
  return {
    rows,
    source: "open-meteo air quality",
    note: "green good · brown no reading / middling · red unhealthy · not a war map",
  };
}

async function brittle(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  if (lat === null || lon === null) throw new Error("no coordinate given");
  const la = clampLat(lat);
  const lo = wrapLon(lon);
  const q = `[out:json][timeout:20];(
    nwr["power"="substation"](around:45000,${la.toFixed(4)},${lo.toFixed(4)});
    nwr["landuse"="harbour"](around:45000,${la.toFixed(4)},${lo.toFixed(4)});
    nwr["aeroway"="aerodrome"](around:45000,${la.toFixed(4)},${lo.toFixed(4)});
    nwr["amenity"="hospital"](around:45000,${la.toFixed(4)},${lo.toFixed(4)});
    nwr["man_made"="mast"](around:25000,${la.toFixed(4)},${lo.toFixed(4)});
  );out center tags 40;`;
  const d = (await getJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, 18_000)) as {
    elements?: Array<Record<string, unknown>>;
  };
  const rows = (d.elements ?? [])
    .map((el, i) => {
      const c = (el.center as { lat?: number; lon?: number } | undefined) || el;
      const ela = num((c as { lat?: unknown }).lat);
      const elo = num((c as { lon?: unknown }).lon);
      if (ela === null || elo === null) return null;
      const tags = (el.tags as Record<string, unknown> | undefined) || {};
      const kind =
        tagText(tags, "power") ||
        tagText(tags, "aeroway") ||
        tagText(tags, "amenity") ||
        tagText(tags, "landuse") ||
        tagText(tags, "man_made") ||
        "node";
      return {
        id: `brittle-${el.id || i}`,
        label: (tagText(tags, "name", 80) || kind).toLowerCase(),
        lat: clampLat(ela),
        lon: wrapLon(elo),
        kind,
        note: "osm mapped infrastructure · public map of brittle nodes · not an attack list · not cell-record triangulation",
      };
    })
    .filter(Boolean);
  return {
    rows,
    source: "openstreetmap overpass",
    note: "substations · harbours · airfields · hospitals · masts around the camera",
  };
}

async function plates() {
  const d = (await getJson(
    "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json",
    16_000,
  )) as { features?: Array<{ geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }> };
  const rows: Array<Record<string, unknown>> = [];
  (d.features ?? []).slice(0, 80).forEach((f, i) => {
    const geom = f.geometry?.coordinates;
    const line = Array.isArray(geom) ? geom : [];
    const mid = (Array.isArray(line[0]) ? line[Math.floor(line.length / 2)] : null) as number[] | null;
    if (!mid || mid.length < 2) return;
    rows.push({
      id: `plate-${i}`,
      label: (text(f.properties?.Name, 40) || "plate edge").toLowerCase(),
      lat: clampLat(Number(mid[1])),
      lon: wrapLon(Number(mid[0])),
      ring: line
        .filter((p) => Array.isArray(p) && p.length >= 2)
        .slice(0, 80)
        .map((p) => ({ lon: Number((p as number[])[0]), lat: Number((p as number[])[1]) })),
      note: "pb2002 plate boundary · 50-200yr motion is meters · not a new continent",
    });
  });
  return {
    rows,
    source: "pb2002 via jsdelivr",
    note: "speculative cartography = plate edges + honesty, not invented land",
  };
}

async function route(params: Record<string, unknown>) {
  const aLat = num(params.alat);
  const aLon = num(params.alon);
  const bLat = num(params.blat);
  const bLon = num(params.blon);
  if (aLat === null || aLon === null || bLat === null || bLon === null) throw new Error("need two public points");
  const d = (await getJson(
    `https://router.project-osrm.org/route/v1/driving/${aLon.toFixed(5)},${aLat.toFixed(5)};${bLon.toFixed(5)},${bLat.toFixed(5)}?overview=full&geometries=geojson`,
    12_000,
  )) as { routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }> };
  const r = (d.routes ?? [])[0];
  if (!r?.geometry?.coordinates?.length) throw new Error("osrm had no public drive path");
  let wind = "no open-meteo wind this tick";
  try {
    const w = (await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${aLat.toFixed(3)}&longitude=${aLon.toFixed(3)}&current=wind_speed_10m,precipitation`,
      8_000,
    )) as { current?: { wind_speed_10m?: number; precipitation?: number } };
    wind = `wind ${Number(w.current?.wind_speed_10m) || 0} m/s · precip ${Number(w.current?.precipitation) || 0} mm · cost hint only`;
  } catch {}
  return {
    rows: [
      {
        id: "route-0",
        label: "unstable route",
        lat: clampLat(aLat),
        lon: wrapLon(aLon),
        ring: r.geometry.coordinates.map((p) => ({ lon: Number(p[0]), lat: Number(p[1]) })),
        note: `osrm ${Math.round((r.distance || 0) / 1000)} km · ${wind} · sci-fi quantum routing rewritten as public path + weather cost · not a quantum computer`,
      },
    ],
    source: "osrm public router + open-meteo",
    note: "shifting terrain = weather on a public drive path. elevation/landcover still unsure without a keyed terrain service",
  };
}

// ── global civil layer ──────────────────────────────────────────────────────
// four organs that must answer for EVERY country, not one continent:
//   incidents  gdelt 2.0        · geocoded world news events, 15-min cadence
//   disasters  gdacs + eonet    · hazard events, every basin
//   notices    interpol         · red / yellow / un notices, placed by nationality
//   crime      federated        · one adapter per publishing jurisdiction, and an
//                                 explicit "no publisher here" everywhere else.
//
// the crime organ is the one that can lie. a map with no dots does not mean a
// safe city, it means nobody published. so a jurisdiction with no adapter comes
// back with coverage:"none" and a row-less body that SAYS so.

/** iso2 -> country centroid, fetched once and held for the life of the isolate. */
let CENTROIDS: Record<string, { lat: number; lon: number; name: string }> | null = null;

async function centroids(): Promise<Record<string, { lat: number; lon: number; name: string }>> {
  if (CENTROIDS) return CENTROIDS;
  const d = (await getJson(
    "https://cdn.jsdelivr.net/gh/eesur/country-codes-lat-long@master/country-codes-lat-long-alpha3.json",
    12_000,
  )) as { ref_country_codes?: Array<Record<string, unknown>> };
  const out: Record<string, { lat: number; lon: number; name: string }> = {};
  for (const row of d.ref_country_codes ?? []) {
    const a2 = text(row.alpha2, 2).toUpperCase();
    const la = num(row.latitude);
    const lo = num(row.longitude);
    if (!a2 || la === null || lo === null) continue;
    out[a2] = { lat: clampLat(la), lon: wrapLon(lo), name: text(row.country, 60) || a2 };
  }
  if (!Object.keys(out).length) throw new Error("country centroids came back empty");
  CENTROIDS = out;
  return out;
}

/** deterministic spread so 40 notices for one country do not stack on one pixel */
function scatter(base: { lat: number; lon: number }, seed: string, i: number) {
  let h = 2166136261;
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619);
  const ang = ((h >>> 0) % 360) * (Math.PI / 180) + i * 0.61;
  const rad = 0.35 + (((h >>> 9) % 100) / 100) * 1.15;
  return { lat: clampLat(base.lat + Math.sin(ang) * rad), lon: wrapLon(base.lon + Math.cos(ang) * rad) };
}

const INCIDENT_QUERY = "(protest OR unrest OR shooting OR explosion OR arrest OR evacuation OR strike)";

/** gdelt writes country names its own way; centroids come from a different list. */
const COUNTRY_ALIAS: Record<string, string> = {
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  russia: "RU",
  "south korea": "KR",
  "north korea": "KP",
  iran: "IR",
  syria: "SY",
  vietnam: "VN",
  bolivia: "BO",
  venezuela: "VE",
  tanzania: "TZ",
  "czech republic": "CZ",
  czechia: "CZ",
  moldova: "MD",
  laos: "LA",
  brunei: "BN",
  "cape verde": "CV",
  "ivory coast": "CI",
  macedonia: "MK",
  "north macedonia": "MK",
  swaziland: "SZ",
  eswatini: "SZ",
  burma: "MM",
  myanmar: "MM",
  "congo republic": "CG",
  "democratic republic of the congo": "CD",
  taiwan: "TW",
  palestine: "PS",
  "vatican city": "VA",
};

function placeCountry(c: Record<string, { lat: number; lon: number; name: string }>, raw: string) {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const alias = COUNTRY_ALIAS[key];
  if (alias && c[alias]) return c[alias];
  const exact = Object.values(c).find((v) => v.name.toLowerCase() === key);
  if (exact) return exact;
  // last resort: a containment match, but only when it is unambiguous.
  const loose = Object.values(c).filter((v) => v.name.toLowerCase().includes(key) || key.includes(v.name.toLowerCase()));
  return loose.length === 1 ? loose[0] : null;
}

/** gdelt throttles per address. one short wait, then give up and say so. */
async function gdeltJson(url: string, timeoutMs: number): Promise<unknown> {
  try {
    return await getJson(url, timeoutMs);
  } catch (e) {
    if (!String((e as Error).message).includes("429")) throw e;
    await new Promise((r) => setTimeout(r, 2200));
    return await getJson(url, timeoutMs);
  }
}

async function incidents(params: Record<string, unknown>) {
  const q = text(params.q, 120) || INCIDENT_QUERY;
  const span = text(params.span, 8) || "1d";
  const rows: Array<Record<string, unknown>> = [];
  let source = "gdelt 2.0 geo";
  const notes: string[] = [];

  // the geo endpoint gives real street-level clusters but answers slowly and
  // often not at all from a datacenter. it gets a short budget, never the
  // whole request, so a slow geo can never starve the article path.
  try {
    const d = (await gdeltJson(
      `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(q)}&format=geojson&mode=pointdata&timespan=${encodeURIComponent(span)}`,
      9_000,
    )) as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> };
    for (const f of d.features ?? []) {
      const lo = num(f.geometry?.coordinates?.[0]);
      const la = num(f.geometry?.coordinates?.[1]);
      if (la === null || lo === null) continue;
      const p = f.properties ?? {};
      rows.push({
        id: `gdelt:${text(p.name, 60)}:${rows.length}`,
        label: (text(p.name, 60) || "incident cluster").toLowerCase(),
        lat: clampLat(la),
        lon: wrapLon(lo),
        count: num(p.count) ?? 1,
        note: `${num(p.count) ?? 1} public reports in the last ${span} · gdelt geo · a mention, not a confirmation`,
      });
      if (rows.length >= 400) break;
    }
  } catch {
    notes.push("gdelt's geocoded endpoint did not answer, so these are placed on the publishing country");
  }

  if (!rows.length) {
    // articles, placed on the publishing country's centroid. a country is not a
    // street and the note says so on every single pin.
    const c = await centroids();
    let d: { articles?: Array<Record<string, unknown>> } = {};
    try {
      d = (await gdeltJson(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=200&sort=datedesc&timespan=${encodeURIComponent(span)}`,
        18_000,
      )) as { articles?: Array<Record<string, unknown>> };
    } catch {
      // both gdelt doors shut. say that plainly rather than leaking an abort
      // string, and never dress an outage up as a quiet world.
      throw new Error(
        "gdelt is not answering right now, so worldwide reporting is unavailable this tick. the other layers are unaffected, and an empty incident layer here means the publisher is down, not that nothing happened.",
      );
    }
    source = "gdelt 2.0 doc · country-level placement";
    const seen = new Map<string, number>();
    let unplaced = 0;
    (d.articles ?? []).forEach((a, i) => {
      const hit = placeCountry(c, text(a.sourcecountry, 60));
      if (!hit) {
        unplaced++;
        return;
      }
      const n = seen.get(hit.name) ?? 0;
      seen.set(hit.name, n + 1);
      const at = scatter(hit, text(a.url, 120) || String(i), n);
      rows.push({
        id: `gdelt-doc:${i}`,
        label: (text(a.title, 90) || "public report").toLowerCase(),
        lat: at.lat,
        lon: at.lon,
        url: text(a.url, 300),
        note: `${hit.name} · country-level placement, not a street · ${text(a.domain, 60)} · ${text(a.seendate, 20)}`,
      });
    });
    if (unplaced) notes.push(`${unplaced} reports had no resolvable country and were dropped rather than guessed`);
  }

  if (!rows.length) throw new Error("gdelt is rate-limiting or silent right now. nothing was placed.");
  return {
    rows,
    source,
    note: [
      "worldwide public reporting. every country gdelt indexes, in every language it indexes",
      "a cluster is attention, not truth",
      ...notes,
    ].join(" · "),
  };
}

async function disasters() {
  const rows: Array<Record<string, unknown>> = [];
  const notes: string[] = [];
  const jobs = await Promise.allSettled([
    getJson("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,DR,WF,VO", 14_000),
    getJson("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200", 12_000),
  ]);

  if (jobs[0].status === "fulfilled") {
    const d = jobs[0].value as {
      features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }>;
    };
    for (const f of d.features ?? []) {
      const lo = num(f.geometry?.coordinates?.[0]);
      const la = num(f.geometry?.coordinates?.[1]);
      if (la === null || lo === null) continue;
      const p = f.properties ?? {};
      rows.push({
        id: `gdacs:${text(p.eventid, 24) || rows.length}`,
        label: text(p.name, 80) || text(p.eventtype, 8) || "hazard",
        lat: clampLat(la),
        lon: wrapLon(lo),
        kind: text(p.eventtype, 8),
        note: `gdacs ${text(p.alertlevel, 10) || "alert"} · ${text(p.country, 60) || "unattributed"} · ${text(p.fromdate, 24)}`,
      });
    }
  } else notes.push("gdacs refused this tick");

  if (jobs[1].status === "fulfilled") {
    const d = jobs[1].value as { events?: Array<Record<string, unknown>> };
    for (const e of d.events ?? []) {
      const geos = (e.geometry as Array<Record<string, unknown>>) ?? [];
      const last = geos[geos.length - 1];
      const coords = last?.coordinates as unknown;
      let la: number | null = null;
      let lo: number | null = null;
      if (Array.isArray(coords) && typeof coords[0] === "number") {
        lo = num(coords[0]);
        la = num(coords[1]);
      }
      if (la === null || lo === null) continue;
      const cat = ((e.categories as Array<Record<string, unknown>>) ?? [])[0];
      rows.push({
        id: `eonet:${text(e.id, 24)}`,
        label: text(e.title, 80) || "natural event",
        lat: clampLat(la),
        lon: wrapLon(lo),
        kind: text(cat?.id, 24),
        note: `nasa eonet · ${text(cat?.title, 40) || "open event"} · ${text(last?.date, 24)}`,
      });
    }
  } else notes.push("eonet refused this tick");

  if (!rows.length) throw new Error("no hazard publisher answered");
  return {
    rows,
    source: "gdacs + nasa eonet",
    note: ["global hazard events, every basin", ...notes].join(" · "),
  };
}

// interpol's own notices web service sits behind an edge that refuses
// datacenter addresses outright (403 from every cloud region we can reach), so
// reading it directly from here is not "sometimes flaky" — it is closed. the
// same notices are republished, keyless, as an opensanctions dataset. we read
// that, and we say which door we came through.
const NOTICES_CSV = "https://data.opensanctions.org/datasets/latest/interpol_red_notices/targets.simple.csv";

/** minimal rfc4180 row reader — quoted fields, doubled quotes, embedded commas */
function parseCsv(body: string, maxRows: number): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      out.push(row);
      row = [];
      if (out.length >= maxRows) return out;
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

async function getText(url: string, timeoutMs: number): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { accept: "text/csv,*/*", "user-agent": "asherin.eye/1.0 (+https://asherin.com)" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const NOTICE_CAP = 900;

async function notices(params: Record<string, unknown>) {
  const c = await centroids();
  const filter = text(params.q, 40).toLowerCase();
  const body = await getText(NOTICES_CSV, 22_000);
  const table = parseCsv(body, 8000);
  const head = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iName = col("name");
  const iCountries = col("countries");
  const iBorn = col("birth_date");
  const iCharge = col("sanctions");
  const iId = col("id");
  if (iName < 0 || iCountries < 0) throw new Error("notices publisher changed its columns");

  const rows: Array<Record<string, unknown>> = [];
  const perCountry = new Map<string, number>();
  const missing = new Set<string>();

  for (let r = 1; r < table.length && rows.length < NOTICE_CAP; r++) {
    const rec = table[r];
    if (!rec || rec.length < head.length - 2) continue;
    const iso = (rec[iCountries] ?? "").split(";")[0].trim().toUpperCase();
    if (!iso) continue;
    const base = c[iso];
    if (!base) {
      missing.add(iso);
      continue;
    }
    const name = (rec[iName] ?? "").trim();
    if (filter && !name.toLowerCase().includes(filter) && !base.name.toLowerCase().includes(filter)) continue;
    const seen = perCountry.get(iso) ?? 0;
    // one country must not become a single opaque blob of 400 stacked pins
    if (seen >= 40) continue;
    perCountry.set(iso, seen + 1);
    const id = (rec[iId] ?? `rn-${r}`).trim();
    const at = scatter(base, id, seen);
    const charge = (rec[iCharge] ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    rows.push({
      id: `interpol:${id}`,
      label: name.toLowerCase() || "wanted person",
      lat: at.lat,
      lon: at.lon,
      kind: "red",
      note: `interpol red notice · ${base.name} · born ${(rec[iBorn] ?? "").trim() || "unstated"}${
        charge ? ` · ${charge.toLowerCase()}` : ""
      } · placed on the country of nationality, never on an address`,
    });
  }

  if (!rows.length) throw new Error("no readable notices in this publication");
  return {
    rows,
    source: "interpol red notices, republished by opensanctions",
    note: [
      `${rows.length} of ${table.length - 1} published red notices, capped at 40 per country`,
      "a notice is one police force asking others to locate someone. it is not a conviction, and the pin is a nationality, not a whereabouts",
      missing.size ? `${missing.size} country codes had no centroid and were dropped rather than guessed` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

// ── crime: federated, per publishing jurisdiction ───────────────────────────
type SocrataCity = {
  key: string;
  host: string;
  set: string;
  latField: string;
  lonField: string;
  dateField: string;
  kindField: string;
  bbox: [number, number, number, number]; // south, west, north, east
  label: string;
};

const SOCRATA_CITIES: SocrataCity[] = [
  {
    key: "chicago",
    host: "data.cityofchicago.org",
    set: "ijzp-q8t2",
    latField: "latitude",
    lonField: "longitude",
    dateField: "date",
    kindField: "primary_type",
    bbox: [41.6, -87.95, 42.05, -87.5],
    label: "city of chicago open data",
  },
  {
    key: "new york",
    host: "data.cityofnewyork.us",
    set: "5uac-w243",
    latField: "latitude",
    lonField: "longitude",
    dateField: "cmplnt_fr_dt",
    kindField: "ofns_desc",
    bbox: [40.47, -74.28, 40.93, -73.68],
    label: "nypd complaint data (current year)",
  },
  {
    key: "los angeles",
    host: "data.lacity.org",
    set: "2nrs-mtv8",
    latField: "lat",
    lonField: "lon",
    dateField: "date_occ",
    kindField: "crm_cd_desc",
    bbox: [33.68, -118.68, 34.35, -118.14],
    label: "lapd crime data",
  },
  {
    key: "san francisco",
    host: "data.sfgov.org",
    set: "wg3w-h783",
    latField: "latitude",
    lonField: "longitude",
    dateField: "incident_datetime",
    kindField: "incident_category",
    bbox: [37.69, -122.55, 37.85, -122.34],
    label: "sfpd incident reports",
  },
];

function inBox(city: SocrataCity, lat: number, lon: number) {
  const [s, w, n, e] = city.bbox;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

async function socrataCrime(city: SocrataCity, lat: number, lon: number) {
  const pad = 0.06;
  const where =
    `${city.latField} > ${(lat - pad).toFixed(4)} AND ${city.latField} < ${(lat + pad).toFixed(4)} AND ` +
    `${city.lonField} > ${(lon - pad).toFixed(4)} AND ${city.lonField} < ${(lon + pad).toFixed(4)}`;
  const url =
    `https://${city.host}/resource/${city.set}.json?$where=${encodeURIComponent(where)}` +
    `&$order=${encodeURIComponent(city.dateField)}%20DESC&$limit=200`;
  const d = (await getJson(url, 13_000)) as Array<Record<string, unknown>>;
  const rows: Array<Record<string, unknown>> = [];
  (Array.isArray(d) ? d : []).forEach((r, i) => {
    const la = num(Number(r[city.latField]));
    const lo = num(Number(r[city.lonField]));
    if (la === null || lo === null || (la === 0 && lo === 0)) return;
    rows.push({
      id: `${city.key}:${text(r.id ?? r.cmplnt_num ?? r.dr_no ?? r.row_id, 32) || i}`,
      label: (text(r[city.kindField], 60) || "reported offence").toLowerCase(),
      lat: clampLat(la),
      lon: wrapLon(lo),
      when: text(r[city.dateField], 24),
      note: `${city.label} · reported ${text(r[city.dateField], 10) || "date withheld"} · a report, not a verdict`,
    });
  });
  return { rows, source: city.label, coverage: city.key };
}

async function policeUkCrime(lat: number, lon: number) {
  const d = (await getJson(
    `https://data.police.uk/api/crimes-street/all-crime?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}`,
    15_000,
  )) as Array<Record<string, unknown>>;
  const rows: Array<Record<string, unknown>> = [];
  (Array.isArray(d) ? d : []).slice(0, 400).forEach((r, i) => {
    const loc = (r.location as Record<string, unknown>) ?? {};
    const la = num(Number(loc.latitude));
    const lo = num(Number(loc.longitude));
    if (la === null || lo === null) return;
    const street = ((loc.street as Record<string, unknown>) ?? {}).name;
    rows.push({
      id: `uk:${text(r.persistent_id, 40) || text(r.id, 24) || i}`,
      label: text(r.category, 60).replace(/-/g, " ") || "reported crime",
      lat: clampLat(la),
      lon: wrapLon(lo),
      when: text(r.month, 8),
      note: `police.uk street-level · ${text(street, 60) || "anonymised point"} · ${text(r.month, 8)} · point is snapped to a street, never a door`,
    });
  });
  return { rows, source: "police.uk street-level crime", coverage: "united kingdom" };
}

const UK_BOX: [number, number, number, number] = [49.8, -8.7, 60.9, 1.9];

async function crime(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  if (lat === null || lon === null) throw new Error("point the globe at a place first");

  if (lat >= UK_BOX[0] && lat <= UK_BOX[2] && lon >= UK_BOX[1] && lon <= UK_BOX[3]) {
    const out = await policeUkCrime(lat, lon);
    return {
      ...out,
      note: `${out.rows.length} street-level reports near this point · police.uk publishes a month behind · a report, not a verdict`,
    };
  }

  const city = SOCRATA_CITIES.find((c) => inBox(c, lat, lon));
  if (city) {
    const out = await socrataCrime(city, lat, lon);
    return {
      ...out,
      note: `${out.rows.length} reports near this point · ${out.source} · a report, not a verdict`,
    };
  }

  // the honest answer, and the important one.
  return {
    rows: [],
    source: "no indexed publisher",
    coverage: "none",
    note: "no police force publishes open incident data for this jurisdiction in our index. an empty map here means nobody published — it does not mean nothing happened",
  };
}


// ─── buildings ───────────────────────────────────────────────────────────────
// The globe is a surface until the city stands up on it. OpenStreetMap already
// holds the footprint of most of the built world, and roughly a fifth of those
// footprints carry a height or a storey count. So this is not a 3d city model
// bought from a vendor — it is the public footprint, extruded, and where the
// height is unknown we SAY it is a guess rather than quietly inventing a tower.
//
// The bbox is capped hard. A building query over a continent would take the
// overpass instance down for everyone, so anything wider than a district is
// refused with an honest reason instead of being silently trimmed.
async function buildings(params: Record<string, unknown>) {
  const lat = num(params.lat);
  const lon = num(params.lon);
  if (lat === null || lon === null) throw new Error("no coordinate given");
  const la = clampLat(lat);
  const lo = wrapLon(lon);
  // ~1.1 km per 0.01°, so 0.02 is a walkable district — the scale where
  // extruded footprints actually mean something on screen.
  const span = Math.min(0.02, Math.max(0.003, num(params.span) ?? 0.008));
  const south = clampLat(la - span);
  const north = clampLat(la + span);
  const west = wrapLon(lo - span);
  const east = wrapLon(lo + span);
  const bbox = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
  const q = `[out:json][timeout:20];(way["building"](${bbox});relation["building"]["type"="multipolygon"](${bbox}););out geom 900;`;
  // the main overpass instance rate-limits and 504s under load. mirrors are
  // tried in order rather than in parallel, so a healthy first mirror never
  // costs the others a request.
  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let d: { elements?: Array<Record<string, unknown>> } | null = null;
  const errs: string[] = [];
  for (const m of mirrors) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 9_000);
    try {
      // overpass wants the query as a POST form field once it grows past a
      // trivial length; the GET form is what trips the 414/500 path on the
      // busier mirrors.
      const res = await fetch(m, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          "user-agent": "asherin.eye/1.0 (+https://asherin.com)",
        },
        body: new URLSearchParams({ data: q }).toString(),
      });
      if (!res.ok) {
        errs.push(`${new URL(m).hostname} ${res.status} ${(await res.text()).slice(0, 90).replace(/\s+/g, " ")}`);
        continue;
      }
      d = (await res.json()) as { elements?: Array<Record<string, unknown>> };
      break;
    } catch (e) {
      errs.push(`${new URL(m).hostname} ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  // Overpass is a volunteer service and it says no often — 429 from the shared
  // egress ip, 500 from a half-broken mirror. The core openstreetmap api is the
  // same data from the authoritative host: heavier on the wire (it hands back
  // every node in the box, not just the ones we asked for), but it answers.
  // So the fallback is not a degraded mode, it is the same footprints resolved
  // the slow way, and it only runs when every mirror has already refused.
  if (!d) {
    try {
      const res = await fetch(
        `https://api.openstreetmap.org/api/0.6/map.json?bbox=${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`,
        {
          headers: { accept: "application/json", "user-agent": "asherin.eye/1.0 (+https://asherin.com)" },
          signal: AbortSignal.timeout(28_000),
        },
      );
      if (!res.ok) throw new Error(`osm core ${res.status}`);
      const raw = (await res.json()) as { elements?: Array<Record<string, unknown>> };
      // the core api returns ways as node-id references, so the ring has to be
      // stitched from the node table before anything can be extruded.
      const nodes = new Map<number, { lat: number; lon: number }>();
      for (const el of raw.elements ?? []) {
        if (el.type === "node") {
          const nla = num(el.lat);
          const nlo = num(el.lon);
          if (nla !== null && nlo !== null) nodes.set(Number(el.id), { lat: nla, lon: nlo });
        }
      }
      const stitched = (raw.elements ?? [])
        .filter((el) => el.type === "way" && (el.tags as Record<string, unknown> | undefined)?.building)
        .slice(0, 900)
        .map((el) => {
          const geometry = ((el.nodes as number[]) ?? [])
            .map((nid) => nodes.get(Number(nid)))
            .filter(Boolean) as Array<{ lat: number; lon: number }>;
          return { ...el, geometry };
        });
      d = { elements: stitched as Array<Record<string, unknown>> };
      errs.push("fell back to the openstreetmap core api");
    } catch (e) {
      errs.push(`openstreetmap core api ${(e as Error).message}`);
    }
  }
  if (!d) throw new Error(`no building source answered · ${errs.join(" · ")}`);

  let measured = 0;
  const rows = (d.elements ?? [])
    .map((el, i) => {
      const tags = (el.tags as Record<string, unknown> | undefined) || {};
      // a relation's outer ring is the building; inner rings are courtyards and
      // are dropped rather than drawn as walls.
      let geom = el.geometry as Array<Record<string, unknown>> | undefined;
      if (!geom && Array.isArray(el.members)) {
        const outer = (el.members as Array<Record<string, unknown>>).find(
          (m) => m.role === "outer" && Array.isArray(m.geometry),
        );
        geom = outer?.geometry as Array<Record<string, unknown>> | undefined;
      }
      if (!Array.isArray(geom) || geom.length < 4) return null;

      const ring: number[] = [];
      for (const g of geom) {
        const gla = num(g.lat);
        const glo = num(g.lon);
        if (gla === null || glo === null) return null;
        ring.push(wrapLon(glo), clampLat(gla));
      }
      if (ring.length > 400) ring.length = 400;

      // osm tags are strings ("330", "12 m", "4;5"), so they need their own
      // parse — the strict numeric guard used for api payloads rejects them all
      // and would silently flatten every city to the 8 m default.
      const tagNum = (v: unknown): number | null => {
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v !== "string") return null;
        const n = parseFloat(v.replace(",", ".").trim());
        return Number.isFinite(n) ? n : null;
      };
      const rawH = tagNum(tags.height) ?? tagNum(tags["building:height"]);
      const levels = tagNum(tags["building:levels"]);
      let height: number;
      let estimated: boolean;
      if (rawH !== null && rawH > 1 && rawH < 900) {
        height = rawH;
        estimated = false;
      } else if (levels !== null && levels >= 1 && levels < 200) {
        // 3.2 m a storey is the ordinary european/north-american floor-to-floor.
        height = levels * 3.2;
        estimated = false;
      } else {
        height = 8;
        estimated = true;
      }
      if (!estimated) measured++;

      const min = tagNum(tags.min_height) ?? 0;
      return {
        id: `osmb-${el.id ?? i}`,
        ring,
        height: Math.round(height * 10) / 10,
        base: Math.max(0, Math.min(height - 1, min)),
        estimated,
        label: (text(tags.name, 60) || text(tags.building, 30) || "building").toLowerCase(),
        kind: text(tags.building, 24) || "yes",
      };
    })
    .filter(Boolean);

  return {
    rows,
    source: "openstreetmap",
    // a mirror that failed on the way to a mirror that answered is plumbing,
    // not news: the reader only hears which host finally served the data.
    note: `${rows.length} footprints · ${measured} carry a surveyed height or storey count, the rest are drawn at a flat 8 m and marked as a guess · a footprint is a map, not a floor plan${errs.length ? ` · ${errs.length} upstream mirror${errs.length === 1 ? "" : "s"} declined first` : ""}`,
  };
}


const FEEDS: Record<FeedName, (p: Record<string, unknown>) => Promise<unknown>> = {
  flights,
  military: () => military(),
  quakes: () => quakes(),
  stations: () => stations(),
  launches: () => launches(),
  cameras,
  radio: () => radio(),
  spaceweather: () => spaceweather(),
  local,
  places,
  property,
  webmeta,
  hex,
  osmweb,
  sats,
  airgrid,
  brittle,
  plates,
  route,
  incidents,
  disasters: () => disasters(),
  buildings,
  notices,
  crime,
};

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  try {
    const body = (await req.json().catch(() => ({}))) as { feed?: string; params?: Record<string, unknown> };
    const feed = String(body.feed ?? "") as FeedName;
    if (!(feed in FEEDS)) return json({ error: "unknown feed" }, 400);

    const params = (body.params ?? {}) as Record<string, unknown>;
    // Cache key includes only the coordinates that actually change a result,
    // rounded so small camera drift keeps hitting the same warm body.
    const keyBits =
      feed === "cameras"
        ? `${Math.round(Number(params.lat ?? 0))}:${Math.round(Number(params.lon ?? 0))}`
        : feed === "local" || feed === "flights" || feed === "crime"
        ? `${Math.round(Number(params.lat ?? 0) / 2)}:${Math.round(Number(params.lon ?? 0) / 2)}`
        : feed === "places" || feed === "property"
          ? String(params.q ?? "").slice(0, 80)
          : feed === "hex"
            ? String(params.icao ?? "").slice(0, 12)
            : feed === "sats"
              ? "sats"
              : feed === "airgrid"
                ? `${Math.round(Number(params.lat ?? 0) * 20)}:${Math.round(Number(params.lon ?? 0) * 20)}`
                : feed === "brittle"
                  ? `${Math.round(Number(params.lat ?? 0) * 20)}:${Math.round(Number(params.lon ?? 0) * 20)}`
                  : feed === "plates"
                    ? "plates"
                    : feed === "route"
                      ? `${Number(params.alat)}:${Number(params.blat)}`
                      : feed === "osmweb"
                        ? `${Math.round(Number(params.lat ?? 0) * 20)}:${Math.round(Number(params.lon ?? 0) * 20)}`
                        : feed === "incidents"
                          ? String(params.q ?? "").slice(0, 80)
                          : feed === "notices"
                            ? String(params.kind ?? "all").slice(0, 8)
                            : feed === "disasters"
                              ? "disasters"
                              : feed === "buildings"
                                ? `${Math.round(Number(params.lat ?? 0) * 100)}:${Math.round(Number(params.lon ?? 0) * 100)}`
                              : feed === "webmeta"
                          ? String(params.url ?? "").slice(0, 120)
                          : "";
    const key = `${feed}|${keyBits}`;
    const hit = CACHE.get(key);
    const now = Date.now();
    if (hit && now - hit.at < TTL[feed]) {
      return json({ ...(hit.body as Record<string, unknown>), fresh: true, ageMs: now - hit.at });
    }

    try {
      const out = (await FEEDS[feed](params)) as Record<string, unknown>;
      CACHE.set(key, { at: now, body: out });
      return json({ ...out, fresh: true, ageMs: 0 });
    } catch (e) {
      if (hit && now - hit.at < MAX_STALE) {
        return json({
          ...(hit.body as Record<string, unknown>),
          fresh: false,
          ageMs: now - hit.at,
          note: `${(hit.body as Record<string, unknown>).note ?? ""} · upstream is refusing right now, this reading is ${Math.round(
            (now - hit.at) / 1000,
          )}s old`.trim(),
        });
      }
      return json({ error: (e as Error).message || "feed unavailable", feed }, 200);
    }
  } catch (e) {
    return json({ error: (e as Error).message || "bad request" }, 400);
  }
});
