/**
 * TRIP TELEMETRY — reconstructing a ride from the rider's own GPS trace.
 *
 * Doctrine, inherited from Guardian: the dangerous failure is not a missed
 * event, it is a confident accusation built out of sensor noise. A consumer
 * GPS fix wobbles several metres even when the car is parked; a naive reader
 * turns that wobble into "harsh braking" and turns a stationary compass spin
 * into "swerving". Every detector below therefore demands (a) a fix good
 * enough to trust, (b) a speed high enough for the signal to mean anything,
 * and (c) persistence across a window rather than a single sample.
 *
 * Where evidence is absent the output says so. A coverage gap is reported as a
 * gap, never interpolated into a straight line and then scored as clean
 * driving — silence is not evidence.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RawPoint {
  t: string | number;
  lat: number;
  lon: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  altitude_m?: number | null;
}

export interface CleanPoint {
  /** Epoch milliseconds. */
  t: number;
  lat: number;
  lon: number;
  acc: number | null;
  /** Metres per second. Device value when trustworthy, else derived. */
  spd: number;
  /** True when spd came from the device rather than from position deltas. */
  spdFromDevice: boolean;
  hdg: number | null;
  /** Seconds since the previous retained fix. Null for the first. */
  dt: number | null;
  /** Metres travelled since the previous retained fix. */
  dist: number;
}

export type EventKind =
  | "harsh_brake"
  | "harsh_accel"
  | "swerve"
  | "speeding"
  | "stop"
  | "coverage_gap";

export interface TripEvent {
  kind: EventKind;
  at: string;
  endedAt?: string;
  durationS?: number;
  lat: number;
  lon: number;
  street?: string | null;
  /** Human sentence stating what was measured, never what it proves. */
  detail: string;
  /** 0-1. Below 0.5 the UI must present it as indicative, not established. */
  confidence: number;
  metrics: Record<string, number | string | null>;
}

export interface StreetLeg {
  name: string;
  /** Seconds the vehicle was on this street, from the rider's own clock. */
  seconds: number;
  metres: number;
  maxSpeedMps: number;
  avgSpeedMps: number;
  /** Posted limit in m/s, or null when OpenStreetMap has none on record. */
  limitMps: number | null;
  limitLabel: string | null;
  /** Seconds measured above the posted limit plus tolerance. */
  overLimitS: number;
  peakOverMps: number;
  firstAt: string;
  lastAt: string;
  samples: number;
}

export interface TripAnalysis {
  durationS: number;
  distanceM: number;
  movingS: number;
  stoppedS: number;
  coverageGapS: number;
  maxSpeedMps: number;
  avgSpeedMps: number;
  /** Average over moving samples only — the number a rider actually feels. */
  avgMovingSpeedMps: number;
  pointCount: number;
  retainedCount: number;
  droppedForAccuracy: number;
  streets: StreetLeg[];
  events: TripEvent[];
  quality: {
    /** Share of the trip duration covered by usable fixes, 0-1. */
    coverage: number;
    medianAccuracyM: number | null;
    medianIntervalS: number | null;
    /** Plain-language caveats the report must display alongside findings. */
    caveats: string[];
  };
  roadData: {
    source: "openstreetmap" | "none";
    waysConsidered: number;
    matchedSamples: number;
    unmatchedSamples: number;
    limitsKnownStreets: number;
    limitsMissingStreets: number;
  };
  summary: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

/** Fixes worse than this are positional guesses, not measurements. */
const ACC_MAX_M = 40;
/** A silence longer than this is a hole in the record, not a slow sample. */
const GAP_S = 25;
/** Below this the vehicle is treated as stationary. */
const STOP_MPS = 0.8;
/** A stop must last this long to be a stop rather than a traffic crawl. */
const STOP_MIN_S = 25;
/** Compass bearing is meaningless at walking pace; ignore heading below this. */
const HEADING_MIN_MPS = 3;
/** ~0.3 g. Industry telematics convention for a harsh event. */
const HARSH_BRAKE_MPS2 = -3.0;
const HARSH_ACCEL_MPS2 = 2.6;
/** Lateral acceleration marking an abrupt direction change. */
const LATERAL_MPS2 = 3.5;
/** A swerve is a lateral spike answered by an opposite one inside this window. */
const SWERVE_PAIR_S = 5;
/** Speed tolerance before a reading is called speeding: ~5 mph. */
const SPEED_TOLERANCE_MPS = 2.24;
/** Speeding must persist this long; one spike is GPS noise. */
const SPEEDING_MIN_S = 6;
/** A fix further than this from any road is not attributable to that road. */
const SNAP_MAX_M = 32;

const MPS_TO_MPH = 2.236936;

// ── Geometry ───────────────────────────────────────────────────────────────

const R_EARTH = 6371008.8;

export function haversineM(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const p = Math.PI / 180;
  const dLat = (bLat - aLat) * p;
  const dLon = (bLon - aLon) * p;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Signed smallest angle from a to b, in degrees, within (-180, 180]. */
function bearingDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function bearing(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const p = Math.PI / 180;
  const y = Math.sin((bLon - aLon) * p) * Math.cos(bLat * p);
  const x = Math.cos(aLat * p) * Math.sin(bLat * p) -
    Math.sin(aLat * p) * Math.cos(bLat * p) * Math.cos((bLon - aLon) * p);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Stage 1: clean the trace ───────────────────────────────────────────────

export interface CleanResult {
  points: CleanPoint[];
  droppedForAccuracy: number;
  droppedDuplicate: number;
}

/**
 * Sorts, de-duplicates and quality-gates the raw fixes, then derives per-point
 * speed. The device's own speed is preferred because it comes from Doppler
 * shift rather than position differencing and is far steadier at low speed;
 * position differencing is the fallback when the device withholds it.
 */
export function cleanTrace(raw: RawPoint[]): CleanResult {
  let droppedForAccuracy = 0;
  let droppedDuplicate = 0;

  const parsed = raw
    .map((p) => ({
      t: typeof p.t === "number" ? p.t : Date.parse(String(p.t)),
      lat: Number(p.lat),
      lon: Number(p.lon),
      acc: p.accuracy_m == null ? null : Number(p.accuracy_m),
      devSpd: p.speed_mps == null ? null : Number(p.speed_mps),
      hdg: p.heading_deg == null ? null : Number(p.heading_deg),
    }))
    .filter((p) =>
      Number.isFinite(p.t) && Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
    )
    .sort((a, b) => a.t - b.t);

  const points: CleanPoint[] = [];
  let lastT = -Infinity;

  for (const p of parsed) {
    if (p.t === lastT) { droppedDuplicate++; continue; }
    if (p.acc != null && Number.isFinite(p.acc) && p.acc > ACC_MAX_M) {
      droppedForAccuracy++;
      continue;
    }
    const prev = points[points.length - 1];
    const dt = prev ? (p.t - prev.t) / 1000 : null;
    const dist = prev ? haversineM(prev.lat, prev.lon, p.lat, p.lon) : 0;

    // A derived speed across a coverage gap is an average over unknown
    // behaviour, so it is not allowed to stand in for an instantaneous
    // reading; it is zeroed and the gap detector reports the hole instead.
    let spd: number;
    let spdFromDevice = false;
    const dev = p.devSpd;
    if (dev != null && Number.isFinite(dev) && dev >= 0) {
      spd = dev;
      spdFromDevice = true;
    } else if (dt && dt > 0 && dt <= GAP_S) {
      spd = dist / dt;
    } else {
      spd = 0;
    }

    points.push({
      t: p.t,
      lat: p.lat,
      lon: p.lon,
      acc: p.acc,
      spd,
      spdFromDevice,
      hdg: p.hdg != null && Number.isFinite(p.hdg) ? ((p.hdg % 360) + 360) % 360 : null,
      dt,
      dist,
    });
    lastT = p.t;
  }

  return { points, droppedForAccuracy, droppedDuplicate };
}

// ── Stage 2: road network (OpenStreetMap) ──────────────────────────────────

interface OsmWay {
  id: number;
  name: string;
  maxspeedMps: number | null;
  maxspeedLabel: string | null;
  geom: Array<{ lat: number; lon: number }>;
}

/** Parses OSM `maxspeed` into m/s. Bare numbers are km/h by OSM convention. */
export function parseMaxspeed(v: string | undefined): { mps: number; label: string } | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|knots)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  const unit = m[2];
  if (unit === "mph") return { mps: n * 0.44704, label: `${n} mph` };
  if (unit === "knots") return { mps: n * 0.514444, label: `${n} kn` };
  return { mps: n / 3.6, label: `${n} km/h` };
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const DRIVABLE =
  "motorway|trunk|primary|secondary|tertiary|unclassified|residential|" +
  "living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";

/**
 * Fetches the drivable road network covering the trace.
 *
 * The trace is tiled rather than queried as one bounding box: a ride that
 * crosses a city produces a box containing the whole city, and asking Overpass
 * for every road inside it is both slow and rude. Tiles are capped so a long
 * trip degrades to partial road data rather than to a timeout.
 */
async function fetchRoadNetwork(points: CleanPoint[]): Promise<OsmWay[]> {
  const TILE = 0.02;
  const MAX_TILES = 10;
  const keys = new Set<string>();
  for (const p of points) {
    keys.add(`${Math.floor(p.lat / TILE)}:${Math.floor(p.lon / TILE)}`);
    if (keys.size > MAX_TILES * 4) break;
  }
  let tiles = [...keys].map((k) => {
    const [a, b] = k.split(":").map(Number);
    return { s: a * TILE, w: b * TILE, n: (a + 1) * TILE, e: (b + 1) * TILE };
  });
  if (tiles.length > MAX_TILES) tiles = tiles.slice(0, MAX_TILES);

  const byId = new Map<number, OsmWay>();

  for (const tile of tiles) {
    // A small margin stops a road that merely clips the tile edge from being
    // invisible to points recorded right beside it.
    const pad = 0.0025;
    const bbox = `${tile.s - pad},${tile.w - pad},${tile.n + pad},${tile.e + pad}`;
    const q = `[out:json][timeout:25];way["highway"~"^(${DRIVABLE})$"](${bbox});out tags geom;`;

    let json: any = null;
    for (const endpoint of OVERPASS_MIRRORS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 25_000);
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          signal: ctl.signal,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Asherin-TripRecorder/1.0",
          },
          body: `data=${encodeURIComponent(q)}`,
        });
        if (!r.ok) continue;
        json = await r.json();
        break;
      } catch {
        /* next mirror */
      } finally {
        clearTimeout(timer);
      }
    }
    if (!json?.elements) continue;

    for (const el of json.elements) {
      if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
      if (byId.has(el.id)) continue;
      const tags = (el.tags ?? {}) as Record<string, string>;
      const name = tags.name || tags.ref ||
        (tags.highway ? `Unnamed ${tags.highway.replace(/_/g, " ")}` : "Unnamed road");
      const ms = parseMaxspeed(tags.maxspeed);
      byId.set(el.id, {
        id: el.id,
        name,
        maxspeedMps: ms?.mps ?? null,
        maxspeedLabel: ms?.label ?? null,
        geom: el.geometry,
      });
    }
  }

  return [...byId.values()];
}

// ── Stage 3: snap each fix to a road ───────────────────────────────────────

interface Segment {
  wayIdx: number;
  aLat: number; aLon: number; bLat: number; bLon: number;
}

/** Perpendicular distance from a point to a segment, in metres. */
function pointSegmentM(
  pLat: number, pLon: number,
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  // Local equirectangular projection: exact enough over the tens of metres
  // that matter here, and far cheaper than repeated haversine solving.
  const latRef = (aLat + bLat) / 2;
  const kx = Math.cos(latRef * Math.PI / 180) * 111320;
  const ky = 110540;
  const ax = aLon * kx, ay = aLat * ky;
  const bx = bLon * kx, by = bLat * ky;
  const px = pLon * kx, py = pLat * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Assigns every fix to the nearest road within SNAP_MAX_M.
 *
 * A grid index keeps this linear in practice: without it, a long ride against
 * a dense urban network is points x segments, which is the kind of quadratic
 * that turns a 30-minute trip into a timeout.
 */
function snapToRoads(points: CleanPoint[], ways: OsmWay[]): Array<OsmWay | null> {
  const CELL = 0.002;
  const grid = new Map<string, Segment[]>();

  const put = (lat: number, lon: number, seg: Segment) => {
    const k = `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
    const arr = grid.get(k);
    if (arr) arr.push(seg); else grid.set(k, [seg]);
  };

  ways.forEach((w, wi) => {
    for (let i = 1; i < w.geom.length; i++) {
      const a = w.geom[i - 1], b = w.geom[i];
      const seg: Segment = { wayIdx: wi, aLat: a.lat, aLon: a.lon, bLat: b.lat, bLon: b.lon };
      // Register under every cell the segment touches so a long segment is
      // still found from a point near its middle.
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(a.lat - b.lat), Math.abs(a.lon - b.lon)) / CELL),
      );
      for (let s = 0; s <= steps; s++) {
        put(a.lat + (b.lat - a.lat) * (s / steps), a.lon + (b.lon - a.lon) * (s / steps), seg);
      }
    }
  });

  return points.map((p) => {
    const ci = Math.floor(p.lat / CELL), cj = Math.floor(p.lon / CELL);
    let best: OsmWay | null = null;
    let bestD = SNAP_MAX_M;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const arr = grid.get(`${ci + di}:${cj + dj}`);
        if (!arr) continue;
        for (const s of arr) {
          const d = pointSegmentM(p.lat, p.lon, s.aLat, s.aLon, s.bLat, s.bLon);
          if (d < bestD) { bestD = d; best = ways[s.wayIdx]; }
        }
      }
    }
    return best;
  });
}

// ── Stage 4: detectors ─────────────────────────────────────────────────────

const iso = (ms: number) => new Date(ms).toISOString();

function detectGaps(points: CleanPoint[]): TripEvent[] {
  const out: TripEvent[] = [];
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].dt;
    if (dt != null && dt > GAP_S) {
      out.push({
        kind: "coverage_gap",
        at: iso(points[i - 1].t),
        endedAt: iso(points[i].t),
        durationS: Math.round(dt),
        lat: points[i - 1].lat,
        lon: points[i - 1].lon,
        detail:
          `No usable fix for ${Math.round(dt)} s — a tunnel, a lost signal or the ` +
          `screen sleeping. Nothing is claimed about this stretch in either direction.`,
        confidence: 1,
        metrics: {
          seconds: Math.round(dt),
          straightLineM: Math.round(points[i].dist),
        },
      });
    }
  }
  return out;
}

function detectHarsh(points: CleanPoint[], roads: Array<OsmWay | null>): TripEvent[] {
  const out: TripEvent[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dt = b.dt;
    // Acceleration across a gap is an average, not an event; and a sub-second
    // interval divides by a tiny number, which amplifies jitter into g-forces.
    if (dt == null || dt < 0.6 || dt > 6) continue;
    const accel = (b.spd - a.spd) / dt;
    const kind: EventKind | null = accel <= HARSH_BRAKE_MPS2
      ? "harsh_brake"
      : accel >= HARSH_ACCEL_MPS2
      ? "harsh_accel"
      : null;
    if (!kind) continue;
    // Below this speed the manoeuvre is a car pulling away from a kerb.
    if (Math.max(a.spd, b.spd) < 4) continue;

    // Derived speed is noisier than Doppler speed, so a harsh reading built
    // from position differencing is reported with lower confidence.
    const derived = !a.spdFromDevice || !b.spdFromDevice;
    const g = Math.abs(accel) / 9.80665;
    out.push({
      kind,
      at: iso(b.t),
      lat: b.lat,
      lon: b.lon,
      street: roads[i]?.name ?? null,
      detail:
        `${kind === "harsh_brake" ? "Speed fell" : "Speed rose"} from ` +
        `${(a.spd * MPS_TO_MPH).toFixed(0)} to ${(b.spd * MPS_TO_MPH).toFixed(0)} mph ` +
        `over ${dt.toFixed(1)} s — ${g.toFixed(2)} g.` +
        (derived ? " Speed here was derived from position, so treat the magnitude as approximate." : ""),
      confidence: derived ? 0.45 : 0.8,
      metrics: {
        mps2: Number(accel.toFixed(2)),
        g: Number(g.toFixed(2)),
        fromMph: Number((a.spd * MPS_TO_MPH).toFixed(1)),
        toMph: Number((b.spd * MPS_TO_MPH).toFixed(1)),
      },
    });
  }
  return out;
}

/**
 * A swerve is not a turn. A turn is one sustained direction change; a swerve is
 * a lateral spike immediately answered by an opposite one — out and back. Only
 * the paired form is reported, which is what keeps ordinary cornering out of
 * the record.
 */
function detectSwerves(points: CleanPoint[], roads: Array<OsmWay | null>): TripEvent[] {
  const spikes: Array<{ i: number; lat: number; signed: number; t: number }> = [];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dt = b.dt;
    if (dt == null || dt < 0.6 || dt > 4) continue;
    // A compass reading at a standstill wanders freely; requiring real speed
    // is what stops a parked car from generating a swerve.
    if (a.spd < HEADING_MIN_MPS || b.spd < HEADING_MIN_MPS) continue;

    const hA = a.hdg ?? (b.dist > 2 ? bearing(a.lat, a.lon, b.lat, b.lon) : null);
    const hB = b.hdg;
    if (hA == null || hB == null) continue;

    const dHead = bearingDelta(hA, hB);
    const yawRate = (dHead * Math.PI / 180) / dt;
    const lateral = b.spd * yawRate;
    if (Math.abs(lateral) >= LATERAL_MPS2) {
      spikes.push({ i, lat: lateral, signed: Math.sign(lateral), t: b.t });
    }
  }

  const out: TripEvent[] = [];
  let used = -1;
  for (let k = 1; k < spikes.length; k++) {
    const p = spikes[k - 1], c = spikes[k];
    if (p.i <= used) continue;
    if (c.signed === p.signed) continue;
    if ((c.t - p.t) / 1000 > SWERVE_PAIR_S) continue;

    const pt = points[c.i];
    const peak = Math.max(Math.abs(p.lat), Math.abs(c.lat));
    out.push({
      kind: "swerve",
      at: iso(p.t),
      endedAt: iso(c.t),
      durationS: Number(((c.t - p.t) / 1000).toFixed(1)),
      lat: pt.lat,
      lon: pt.lon,
      street: roads[c.i]?.name ?? null,
      detail:
        `Two opposing lateral spikes ${((c.t - p.t) / 1000).toFixed(1)} s apart at ` +
        `${(pt.spd * MPS_TO_MPH).toFixed(0)} mph, peaking at ${(peak / 9.80665).toFixed(2)} g ` +
        `sideways — an out-and-back movement rather than a turn.`,
      confidence: peak > LATERAL_MPS2 * 1.5 ? 0.7 : 0.5,
      metrics: {
        peakLateralMps2: Number(peak.toFixed(2)),
        peakLateralG: Number((peak / 9.80665).toFixed(2)),
        speedMph: Number((pt.spd * MPS_TO_MPH).toFixed(1)),
      },
    });
    used = c.i;
  }
  return out;
}

function detectStops(points: CleanPoint[], roads: Array<OsmWay | null>): TripEvent[] {
  const out: TripEvent[] = [];
  let start = -1;
  for (let i = 0; i < points.length; i++) {
    const stopped = points[i].spd < STOP_MPS;
    if (stopped && start < 0) start = i;
    if ((!stopped || i === points.length - 1) && start >= 0) {
      const end = stopped ? i : i - 1;
      const secs = (points[end].t - points[start].t) / 1000;
      if (secs >= STOP_MIN_S) {
        out.push({
          kind: "stop",
          at: iso(points[start].t),
          endedAt: iso(points[end].t),
          durationS: Math.round(secs),
          lat: points[start].lat,
          lon: points[start].lon,
          street: roads[start]?.name ?? null,
          detail:
            `Stationary for ${Math.round(secs)} s${roads[start]?.name ? ` on ${roads[start]!.name}` : ""}. ` +
            `Traffic, a light and a deliberate halt look identical from the outside; ` +
            `this records the pause, not its reason.`,
          confidence: 0.9,
          metrics: { seconds: Math.round(secs) },
        });
      }
      start = -1;
    }
  }
  return out;
}

/**
 * Speeding is only asserted where a posted limit exists in OpenStreetMap and
 * the excess persists. Everything else is reported as a speed reading with no
 * limit on record, which is a fact; calling it a violation would not be.
 */
function detectSpeeding(
  points: CleanPoint[],
  roads: Array<OsmWay | null>,
): TripEvent[] {
  const out: TripEvent[] = [];
  let start = -1;
  let peak = 0;
  let way: OsmWay | null = null;

  const close = (endIdx: number) => {
    if (start < 0) return;
    const secs = (points[endIdx].t - points[start].t) / 1000;
    if (secs >= SPEEDING_MIN_S && way?.maxspeedMps) {
      const overMph = (peak - way.maxspeedMps) * MPS_TO_MPH;
      out.push({
        kind: "speeding",
        at: iso(points[start].t),
        endedAt: iso(points[endIdx].t),
        durationS: Math.round(secs),
        lat: points[start].lat,
        lon: points[start].lon,
        street: way.name,
        detail:
          `${Math.round(secs)} s above the posted ${way.maxspeedLabel} on ${way.name}, ` +
          `peaking ${overMph.toFixed(0)} mph over. Tolerance of ` +
          `${(SPEED_TOLERANCE_MPS * MPS_TO_MPH).toFixed(0)} mph already applied.`,
        confidence: secs >= SPEEDING_MIN_S * 2 ? 0.8 : 0.6,
        metrics: {
          seconds: Math.round(secs),
          peakMph: Number((peak * MPS_TO_MPH).toFixed(1)),
          limit: way.maxspeedLabel,
          overByMph: Number(overMph.toFixed(1)),
        },
      });
    }
    start = -1; peak = 0; way = null;
  };

  for (let i = 0; i < points.length; i++) {
    const w = roads[i];
    const lim = w?.maxspeedMps ?? null;
    const over = lim != null && points[i].spd > lim + SPEED_TOLERANCE_MPS;
    if (over) {
      // A change of street ends the current run: an excess on one road cannot
      // be carried onto the next, which has its own limit.
      if (start >= 0 && way && w && way.id !== w.id) close(i - 1);
      if (start < 0) { start = i; way = w; }
      peak = Math.max(peak, points[i].spd);
    } else if (start >= 0) {
      close(i - 1);
    }
  }
  if (start >= 0) close(points.length - 1);
  return out;
}

// ── Stage 5: street-by-street dwell ────────────────────────────────────────

function buildStreets(points: CleanPoint[], roads: Array<OsmWay | null>): StreetLeg[] {
  const acc = new Map<string, {
    name: string; seconds: number; metres: number; max: number;
    sum: number; n: number; limit: number | null; label: string | null;
    over: number; peakOver: number; first: number; last: number;
  }>();

  for (let i = 0; i < points.length; i++) {
    const w = roads[i];
    if (!w) continue;
    const p = points[i];
    // Time is attributed from the rider's own clock, not a routing engine's
    // estimate, and a gap contributes nothing to any street's dwell.
    const dt = p.dt != null && p.dt <= GAP_S ? p.dt : 0;
    const key = w.name;
    let e = acc.get(key);
    if (!e) {
      e = {
        name: w.name, seconds: 0, metres: 0, max: 0, sum: 0, n: 0,
        limit: w.maxspeedMps, label: w.maxspeedLabel, over: 0, peakOver: 0,
        first: p.t, last: p.t,
      };
      acc.set(key, e);
    }
    e.seconds += dt;
    e.metres += p.dt != null && p.dt <= GAP_S ? p.dist : 0;
    e.max = Math.max(e.max, p.spd);
    e.sum += p.spd;
    e.n++;
    e.last = p.t;
    if (e.limit == null && w.maxspeedMps != null) {
      e.limit = w.maxspeedMps; e.label = w.maxspeedLabel;
    }
    if (e.limit != null && p.spd > e.limit + SPEED_TOLERANCE_MPS) {
      e.over += dt;
      e.peakOver = Math.max(e.peakOver, p.spd - e.limit);
    }
  }

  return [...acc.values()]
    .map((e) => ({
      name: e.name,
      seconds: Math.round(e.seconds),
      metres: Math.round(e.metres),
      maxSpeedMps: Number(e.max.toFixed(2)),
      avgSpeedMps: Number((e.n ? e.sum / e.n : 0).toFixed(2)),
      limitMps: e.limit,
      limitLabel: e.label,
      overLimitS: Math.round(e.over),
      peakOverMps: Number(e.peakOver.toFixed(2)),
      firstAt: iso(e.first),
      lastAt: iso(e.last),
      samples: e.n,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

// ── Orchestration ──────────────────────────────────────────────────────────

export async function analyseTrip(raw: RawPoint[]): Promise<TripAnalysis> {
  const { points, droppedForAccuracy } = cleanTrace(raw);

  if (points.length < 2) {
    return {
      durationS: 0, distanceM: 0, movingS: 0, stoppedS: 0, coverageGapS: 0,
      maxSpeedMps: 0, avgSpeedMps: 0, avgMovingSpeedMps: 0,
      pointCount: raw.length, retainedCount: points.length, droppedForAccuracy,
      streets: [], events: [],
      quality: {
        coverage: 0, medianAccuracyM: null, medianIntervalS: null,
        caveats: [
          "Too few usable fixes to reconstruct a ride. Nothing below should be " +
          "read as a description of how the vehicle was driven.",
        ],
      },
      roadData: {
        source: "none", waysConsidered: 0, matchedSamples: 0,
        unmatchedSamples: 0, limitsKnownStreets: 0, limitsMissingStreets: 0,
      },
      summary: "Not enough usable location data to reconstruct this trip.",
    };
  }

  let ways: OsmWay[] = [];
  try {
    ways = await fetchRoadNetwork(points);
  } catch {
    ways = [];
  }
  const roads = ways.length
    ? snapToRoads(points, ways)
    : points.map(() => null);

  const durationS = (points[points.length - 1].t - points[0].t) / 1000;
  let distanceM = 0, movingS = 0, stoppedS = 0, gapS = 0, maxSpeed = 0;
  let movingSum = 0, movingN = 0;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const dt = p.dt ?? 0;
    if (dt > GAP_S) { gapS += dt; continue; }
    distanceM += p.dist;
    if (p.spd >= STOP_MPS) { movingS += dt; movingSum += p.spd; movingN++; }
    else stoppedS += dt;
    maxSpeed = Math.max(maxSpeed, p.spd);
  }

  const events = [
    ...detectGaps(points),
    ...detectSpeeding(points, roads),
    ...detectHarsh(points, roads),
    ...detectSwerves(points, roads),
    ...detectStops(points, roads),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const streets = buildStreets(points, roads);
  const matched = roads.filter(Boolean).length;
  const accs = points.map((p) => p.acc).filter((a): a is number => a != null);
  const ints = points.map((p) => p.dt).filter((d): d is number => d != null && d <= GAP_S);
  const coverage = durationS > 0 ? Math.max(0, Math.min(1, (durationS - gapS) / durationS)) : 0;

  const caveats: string[] = [];
  if (coverage < 0.9) {
    caveats.push(
      `${Math.round((1 - coverage) * 100)}% of this trip has no location record. ` +
      `No finding covers those stretches, in either direction.`,
    );
  }
  if (!ways.length) {
    caveats.push(
      "The road network could not be retrieved, so streets are unnamed and no " +
      "speed limit could be checked. Speed readings below stand on their own.",
    );
  } else if (matched / points.length < 0.7) {
    caveats.push(
      `Only ${Math.round(matched / points.length * 100)}% of fixes sat close enough ` +
      `to a mapped road to be attributed to one. Street times are partial.`,
    );
  }
  const withLimit = streets.filter((s) => s.limitMps != null).length;
  if (streets.length && withLimit < streets.length) {
    caveats.push(
      `${streets.length - withLimit} of ${streets.length} streets have no posted ` +
      `limit recorded in OpenStreetMap. Speed on those is reported, not judged.`,
    );
  }
  if (points.filter((p) => p.spdFromDevice).length / points.length < 0.5) {
    caveats.push(
      "Most speeds were derived from position changes rather than reported by " +
      "the device, which widens the error on acceleration findings.",
    );
  }

  const speeding = events.filter((e) => e.kind === "speeding");
  const harsh = events.filter((e) => e.kind === "harsh_brake" || e.kind === "harsh_accel");
  const swerves = events.filter((e) => e.kind === "swerve");
  const stops = events.filter((e) => e.kind === "stop");

  const summary = [
    `${(distanceM / 1609.344).toFixed(1)} mi over ${Math.round(durationS / 60)} min`,
    `across ${streets.length} street${streets.length === 1 ? "" : "s"}`,
    `peaking at ${(maxSpeed * MPS_TO_MPH).toFixed(0)} mph.`,
    speeding.length
      ? `${speeding.length} sustained run${speeding.length === 1 ? "" : "s"} above a posted limit.`
      : withLimit
      ? "No sustained run above any posted limit on record."
      : "No posted limits were available to check speed against.",
    harsh.length ? `${harsh.length} harsh acceleration or braking event${harsh.length === 1 ? "" : "s"}.` : "",
    swerves.length ? `${swerves.length} out-and-back lateral movement${swerves.length === 1 ? "" : "s"}.` : "",
    stops.length ? `${stops.length} stop${stops.length === 1 ? "" : "s"} over 25 s.` : "",
  ].filter(Boolean).join(" ");

  return {
    durationS: Math.round(durationS),
    distanceM: Math.round(distanceM),
    movingS: Math.round(movingS),
    stoppedS: Math.round(stoppedS),
    coverageGapS: Math.round(gapS),
    maxSpeedMps: Number(maxSpeed.toFixed(2)),
    avgSpeedMps: Number((durationS > 0 ? distanceM / durationS : 0).toFixed(2)),
    avgMovingSpeedMps: Number((movingN ? movingSum / movingN : 0).toFixed(2)),
    pointCount: raw.length,
    retainedCount: points.length,
    droppedForAccuracy,
    streets,
    events,
    quality: {
      coverage: Number(coverage.toFixed(3)),
      medianAccuracyM: median(accs),
      medianIntervalS: median(ints),
      caveats,
    },
    roadData: {
      source: ways.length ? "openstreetmap" : "none",
      waysConsidered: ways.length,
      matchedSamples: matched,
      unmatchedSamples: points.length - matched,
      limitsKnownStreets: withLimit,
      limitsMissingStreets: streets.length - withLimit,
    },
    summary,
  };
}

// ── Export formats ─────────────────────────────────────────────────────────

/** GPX so the trace opens in any mapping or evidence tool, not just this app. */
export function toGpx(
  points: Array<{ t: string; lat: number; lon: number; speed_mps?: number | null; altitude_m?: number | null }>,
  name: string,
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pts = points.map((p) =>
    `      <trkpt lat="${p.lat}" lon="${p.lon}">` +
    (p.altitude_m != null ? `<ele>${p.altitude_m}</ele>` : "") +
    `<time>${p.t}</time>` +
    (p.speed_mps != null ? `<extensions><speed>${p.speed_mps}</speed></extensions>` : "") +
    `</trkpt>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Asherin Trip Recorder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name></metadata>
  <trk><name>${esc(name)}</name><trkseg>
${pts}
  </trkseg></trk>
</gpx>`;
}
