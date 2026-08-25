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
//   • Allow-list of feeds only. No caller-supplied url is ever fetched, so
//     this cannot be used as an SSRF hop.
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
  | "webmeta";

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
    const d = (await getJson("https://opensky-network.org/api/states/all", 11_000)) as {
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

async function cameras() {
  const out: Array<Record<string, unknown>> = [];
  const notes: string[] = [];

  const jobs = await Promise.allSettled([
    getJson("https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=1000", 14_000),
    getJson("https://api.tfl.gov.uk/Place/Type/JamCam", 20_000),
  ]);

  if (jobs[0].status === "fulfilled") {
    const rows = jobs[0].value as Array<Record<string, unknown>>;
    for (const c of rows) {
      const loc = c.location as { coordinates?: number[] } | undefined;
      const lo = num(loc?.coordinates?.[0]);
      const la = num(loc?.coordinates?.[1]);
      const img = text(c.screenshot_address, 300);
      if (la === null || lo === null || !img.startsWith("https://")) continue;
      if (text(c.camera_status, 30) !== "TURNED_ON") continue;
      out.push({
        id: `austin-${text(c.camera_id, 16)}`,
        label: text(c.location_name, 80).toLowerCase() || "austin camera",
        lat: clampLat(la),
        lon: wrapLon(lo),
        image: img,
        city: "austin",
        credit: "city of austin open data",
      });
    }
  } else notes.push("austin catalog did not answer");

  if (jobs[1].status === "fulfilled") {
    const rows = jobs[1].value as Array<Record<string, unknown>>;
    for (const p of rows) {
      const la = num(p.lat);
      const lo = num(p.lon);
      const props = (p.additionalProperties ?? []) as Array<Record<string, unknown>>;
      const img = text(props.find((x) => x.key === "imageUrl")?.value, 300);
      const available = text(props.find((x) => x.key === "available")?.value, 8);
      if (la === null || lo === null || !img.startsWith("https://") || available === "false") continue;
      out.push({
        id: `london-${text(p.id, 40)}`,
        label: text(p.commonName, 80).toLowerCase() || "london camera",
        lat: clampLat(la),
        lon: wrapLon(lo),
        image: img,
        city: "london",
        credit: "powered by tfl open data",
      });
    }
  } else notes.push("tfl jamcams did not answer");

  if (!out.length) throw new Error("no camera catalog available");
  return { rows: out, source: "austin open data · tfl open data", note: notes.join(" · ") };
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
        note: "nominatim public index Â· not a search-results page",
      };
    })
    .filter(Boolean);
  if (!rows.length) throw new Error("no public place matched");
  return { rows, source: "openstreetmap nominatim", note: "asherin.engine places on the globe" };
}

async function property(params: Record<string, unknown>) {
  const found = (await places(params)) as { rows: Array<Record<string, unknown>> };
  const first = found.rows[0] as { lat: number; lon: number; label: string };
  const la = first.lat;
  const lo = first.lon;
  const q = `[out:json][timeout:20];(way["building"](around:120,${la.toFixed(5)},${lo.toFixed(5)});node["addr:housenumber"](around:120,${la.toFixed(5)},${lo.toFixed(5)}););out center 40;`;
  let extra: Array<Record<string, unknown>> = [];
  try {
    const d = (await getJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, 16_000)) as {
      elements?: Array<Record<string, unknown>>;
    };
    extra = (d.elements ?? [])
      .map((el, i) => {
        const c = (el.center as { lat?: number; lon?: number } | undefined) || el;
        const ela = num((c as { lat?: unknown }).lat);
        const elo = num((c as { lon?: unknown }).lon);
        if (ela === null || elo === null) return null;
        const tags = (el.tags as Record<string, unknown> | undefined) || {};
        const label =
          text(tags["addr:housenumber"], 12) && text(tags["addr:street"], 60)
            ? `${text(tags["addr:housenumber"], 12)} ${text(tags["addr:street"], 60)}`.toLowerCase()
            : text(tags.name, 80) || "building";
        return {
          id: `prop-${el.id || i}`,
          label,
          lat: clampLat(ela),
          lon: wrapLon(elo),
          note: "osm building/address Â· public tags, not a deed",
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  } catch {
    extra = [];
  }
  return {
    rows: [first, ...extra].slice(0, 48),
    source: "nominatim Â· overpass",
    note: extra.length ? "property footprint from public osm" : "place only Â· osm buildings did not answer",
  };
}

function blockedHost(host: string) {
  const h = host.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0")
    return true;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return false;
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
    note: `headers ${Object.keys(headers).join(" ") || "none"} Â· not a traffic intercept`,
  };
}

const FEEDS: Record<FeedName, (p: Record<string, unknown>) => Promise<unknown>> = {
  flights,
  military: () => military(),
  quakes: () => quakes(),
  stations: () => stations(),
  launches: () => launches(),
  cameras: () => cameras(),
  radio: () => radio(),
  spaceweather: () => spaceweather(),
  local,
  places,
  property,
  webmeta,
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
      feed === "local" || feed === "flights"
        ? `${Math.round(Number(params.lat ?? 0) / 2)}:${Math.round(Number(params.lon ?? 0) / 2)}`
        : feed === "places" || feed === "property"
          ? String(params.q ?? "").slice(0, 80)
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
