// geoAnalysis — the elite-tier spatial analytics core for the Asher
// Intelligence Map.
//
// NARRATIVE
// A consumer map answers "where is it". An intelligence map answers "what can
// be seen from it, how hard is the ground, when does the sun expose it, and
// who else is standing on it". Every function here is grounded in a real
// upstream (Copernicus/GLO-30 DEM via the Open-Meteo elevation service, OSRM
// road graph) or in closed-form astronomy — nothing is synthesised.
//
// FLAWS THIS MODULE IS BUILT AGAINST
//  - Unbounded fan-out: a naive viewshed issues thousands of HTTP calls.
//    Mitigated by fixed ray/step budgets, 100-point request batching and a
//    hard concurrency cap.
//  - Hanging requests: every network call carries an AbortController timeout
//    and honours a caller-supplied signal so a panned-away analysis dies.
//  - Silent upstream failure: each entry point returns a typed result with an
//    explicit `degraded` reason instead of throwing into a render tree.
//  - Float drift at the poles / antimeridian: bearings and destination points
//    use spherical formulae with longitude normalisation.

export interface LatLng { lat: number; lng: number }

const R_EARTH_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Normalise longitude into [-180, 180) so antimeridian rays stay valid. */
export const normLng = (lng: number): number => ((((lng + 180) % 360) + 360) % 360) - 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial great-circle bearing, degrees true, [0,360). */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const p1 = toRad(from.lat), p2 = toRad(to.lat);
  const dl = toRad(to.lng - from.lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at `distM` along `brg` from `origin` on a sphere. */
export function destinationPoint(origin: LatLng, brg: number, distM: number): LatLng {
  const d = distM / R_EARTH_M;
  const b = toRad(brg);
  const p1 = toRad(origin.lat), l1 = toRad(origin.lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: toDeg(p2), lng: normLng(toDeg(l2)) };
}

/* ── Terrain (Copernicus GLO-30 via Open-Meteo elevation) ─────────────────
   The service accepts up to 100 coordinate pairs per request. We batch to
   that ceiling, cap concurrency at 4 to stay a good citizen, and fail soft:
   a null elevation is treated as "unknown", never as sea level. */

const ELEV_ENDPOINT = "https://api.open-meteo.com/v1/elevation";
const ELEV_BATCH = 100;
/* Open-Meteo rate-limits per REQUEST, not per coordinate, and a single viewshed
   issues dozens of batches. Unbounded fan-out burns the minutely budget and
   every follow-up analysis comes back empty — which reads to an analyst as
   "flat terrain" rather than "no data". Two workers plus a request-spacing
   floor plus 429-aware backoff keeps a whole session inside the budget. */
const ELEV_CONCURRENCY = 2;
const ELEV_MIN_SPACING_MS = 120;
const ELEV_TIMEOUT_MS = 12_000;
const ELEV_RETRIES = 3;

async function fetchJson(url: string, signal?: AbortSignal, timeoutMs = ELEV_TIMEOUT_MS): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) {
      const err = new Error(`upstream ${r.status}`) as Error & { status?: number; retryAfterMs?: number };
      err.status = r.status;
      const ra = parseFloat(r.headers.get("retry-after") ?? "");
      if (Number.isFinite(ra)) err.retryAfterMs = Math.min(ra * 1000, 20_000);
      throw err;
    }
    return await r.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Bounded-concurrency map that never rejects — failures surface as null. */
async function pooled<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i]); } catch { out[i] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Retry only idempotent GETs, and only on throttling / transient upstream faults. */
async function fetchJsonResilient(url: string, signal?: AbortSignal): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < ELEV_RETRIES; attempt++) {
    try {
      return await fetchJson(url, signal);
    } catch (e: any) {
      lastErr = e;
      if (signal?.aborted) throw e;
      const status = e?.status;
      const retryable = status === 429 || status === 502 || status === 503 || status === 504 || status === undefined;
      if (!retryable || attempt === ELEV_RETRIES - 1) throw e;
      // Honour Retry-After when the server sends it; otherwise exponential
      // backoff with jitter so parallel workers do not resynchronise.
      // Honour Retry-After when the server sends it. Otherwise back off by
      // fault class: a 429 here is a MINUTELY quota, so sub-second retries are
      // guaranteed to fail again — the wait must cross into the next window.
      // Transient 5xx faults clear far faster and get the short ladder.
      const ladder = status === 429 ? [6_000, 22_000, 46_000] : [600, 1_800, 4_000];
      const wait = e?.retryAfterMs ?? ladder[Math.min(attempt, ladder.length - 1)] + Math.random() * 400;

      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/* Session-scoped elevation cache. Terrain is static, so a coordinate resolved
   once is never re-requested — repeat viewsheds over the same target are free
   and, more importantly, do not re-spend the rate-limit budget. */
const elevCache = new Map<string, number | null>();
const elevKey = (p: LatLng) => `${p.lat.toFixed(4)},${normLng(p.lng).toFixed(4)}`;

/** Serialises request starts so bursts cannot exceed the upstream's tolerance. */
let elevGate: Promise<void> = Promise.resolve();
function elevSlot(): Promise<void> {
  const wait = elevGate.then(() => new Promise<void>((r) => setTimeout(r, ELEV_MIN_SPACING_MS)));
  elevGate = wait.catch(() => undefined);
  return wait;
}

/**
 * Elevations in metres for an ordered point list. Returns an array of the same
 * length; unresolved samples are `null` so callers can reason about coverage
 * instead of silently treating gaps as flat ground.
 */
export async function fetchElevations(points: LatLng[], signal?: AbortSignal): Promise<Array<number | null>> {
  if (!points.length) return [];

  // Resolve from cache first; only unknown coordinates reach the network.
  const out: Array<number | null> = new Array(points.length).fill(null);
  const missIdx: number[] = [];
  points.forEach((p, i) => {
    const k = elevKey(p);
    if (elevCache.has(k)) out[i] = elevCache.get(k)!;
    else missIdx.push(i);
  });
  if (!missIdx.length) return out;

  const batches: number[][] = [];
  for (let i = 0; i < missIdx.length; i += ELEV_BATCH) batches.push(missIdx.slice(i, i + ELEV_BATCH));

  const results = await pooled(batches, ELEV_CONCURRENCY, async (idxBatch) => {
    await elevSlot();
    const batch = idxBatch.map((i) => points[i]);
    const lat = batch.map((p) => p.lat.toFixed(6)).join(",");
    const lng = batch.map((p) => normLng(p.lng).toFixed(6)).join(",");
    const json = await fetchJsonResilient(`${ELEV_ENDPOINT}?latitude=${lat}&longitude=${lng}`, signal);
    const arr = json?.elevation;
    return Array.isArray(arr) ? arr.map((v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)) : null;
  });

  results.forEach((r, b) => {
    const idxBatch = batches[b];
    idxBatch.forEach((pointIdx, j) => {
      const v = r && r.length === idxBatch.length ? r[j] : null;
      out[pointIdx] = v;
      // Only cache resolved values — a throttled null must not become permanent.
      if (v != null) elevCache.set(elevKey(points[pointIdx]), v);
    });
  });
  return out;
}


/* ── Elevation profile ──────────────────────────────────────────────────── */

export interface ElevationProfile {
  samples: Array<{ distM: number; elevM: number | null; lat: number; lng: number }>;
  totalM: number;
  minM: number | null;
  maxM: number | null;
  gainM: number;
  lossM: number;
  maxGradePct: number;
  coverage: number; // 0..1 fraction of samples resolved
  degraded?: string;
}

/** Resample a polyline to `n` evenly spaced points along its geodesic length. */
export function resamplePath(path: LatLng[], n: number): LatLng[] {
  if (path.length < 2) return path.slice();
  const legs = path.slice(1).map((p, i) => haversineM(path[i], p));
  const total = legs.reduce((a, b) => a + b, 0);
  if (total === 0) return [path[0]];
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) {
    let target = (total * i) / (n - 1);
    let leg = 0;
    while (leg < legs.length - 1 && target > legs[leg]) { target -= legs[leg]; leg++; }
    const f = legs[leg] === 0 ? 0 : Math.min(1, target / legs[leg]);
    const a = path[leg], b = path[leg + 1];
    out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });
  }
  return out;
}

export async function elevationProfile(path: LatLng[], samples = 96, signal?: AbortSignal): Promise<ElevationProfile> {
  const pts = resamplePath(path, Math.max(2, Math.min(samples, 300)));
  const elev = await fetchElevations(pts, signal);

  let cum = 0;
  const rows = pts.map((p, i) => {
    if (i > 0) cum += haversineM(pts[i - 1], p);
    return { distM: cum, elevM: elev[i], lat: p.lat, lng: p.lng };
  });

  const known = rows.map((r) => r.elevM).filter((v): v is number => v != null);
  let gain = 0, loss = 0, maxGrade = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].elevM, b = rows[i].elevM;
    if (a == null || b == null) continue;
    const d = b - a;
    if (d > 0) gain += d; else loss -= d;
    const run = rows[i].distM - rows[i - 1].distM;
    if (run > 1) maxGrade = Math.max(maxGrade, Math.abs((d / run) * 100));
  }

  return {
    samples: rows,
    totalM: cum,
    minM: known.length ? Math.min(...known) : null,
    maxM: known.length ? Math.max(...known) : null,
    gainM: gain,
    lossM: loss,
    maxGradePct: maxGrade,
    coverage: rows.length ? known.length / rows.length : 0,
    degraded: known.length === 0 ? "Terrain service unreachable — no elevation samples resolved." : undefined,
  };
}

/* ── Viewshed ───────────────────────────────────────────────────────────── */

export interface ViewshedResult {
  observer: LatLng;
  observerHeightM: number;
  observerElevM: number | null;
  radiusM: number;
  /** Star polygon: the furthest unobstructed radius along each sampled ray. */
  ring: LatLng[];
  /** Per-ray detail for the readout table. */
  rays: Array<{ bearing: number; visibleM: number; blockedByElevM: number | null }>;
  visibleFraction: number;   // mean visible radius / radius
  approxAreaKm2: number;
  coverage: number;
  degraded?: string;
}

/**
 * Line-of-sight viewshed by radial ray-casting against the DEM.
 *
 * For each ray we walk outward keeping the maximum vertical angle seen so far;
 * a sample is visible only if its own angle exceeds that running maximum. This
 * is the standard R3 approximation and is honest about its resolution: with
 * `rays` azimuths and `steps` range bins, angular resolution is 360/rays.
 *
 * Budget: rays*steps points, batched 100 per request, 4 in flight.
 */
export async function computeViewshed(
  observer: LatLng,
  radiusM: number,
  observerHeightM = 2,
  opts: { rays?: number; steps?: number; targetHeightM?: number; signal?: AbortSignal } = {},
): Promise<ViewshedResult> {
  const rays = Math.max(8, Math.min(opts.rays ?? 36, 72));
  const steps = Math.max(6, Math.min(opts.steps ?? 26, 40));
  const targetH = opts.targetHeightM ?? 0;
  const R = Math.max(200, Math.min(radiusM, 60_000));

  // Grid: observer first, then ray-major samples.
  const grid: LatLng[] = [observer];
  const rayBearings: number[] = [];
  for (let r = 0; r < rays; r++) {
    const brg = (360 * r) / rays;
    rayBearings.push(brg);
    for (let s = 1; s <= steps; s++) grid.push(destinationPoint(observer, brg, (R * s) / steps));
  }

  const elev = await fetchElevations(grid, opts.signal);
  const obsElev = elev[0];
  const known = elev.filter((v): v is number => v != null);
  const coverage = elev.length ? known.length / elev.length : 0;

  if (obsElev == null || coverage < 0.25) {
    return {
      observer, observerHeightM, observerElevM: obsElev, radiusM: R,
      ring: [], rays: [], visibleFraction: 0, approxAreaKm2: 0, coverage,
      degraded: "Terrain coverage insufficient — viewshed not computed.",
    };
  }

  const eyeM = obsElev + observerHeightM;
  const ring: LatLng[] = [];
  const rayRows: ViewshedResult["rays"] = [];
  let visibleSum = 0;

  for (let r = 0; r < rays; r++) {
    let maxAngle = -Infinity;
    let lastVisible = 0;
    let blockedBy: number | null = null;

    for (let s = 1; s <= steps; s++) {
      const idx = 1 + r * steps + (s - 1);
      const groundM = elev[idx];
      const dist = (R * s) / steps;
      if (groundM == null) continue;
      // Earth-curvature + standard atmospheric refraction correction (k=0.13).
      const drop = ((1 - 0.13) * dist * dist) / (2 * R_EARTH_M);
      const angle = Math.atan2(groundM + targetH - drop - eyeM, dist);
      if (angle > maxAngle) {
        maxAngle = angle;
        lastVisible = dist;
        blockedBy = null;
      } else if (blockedBy == null) {
        blockedBy = groundM;
      }
    }

    visibleSum += lastVisible;
    rayRows.push({ bearing: rayBearings[r], visibleM: lastVisible, blockedByElevM: blockedBy });
    ring.push(destinationPoint(observer, rayBearings[r], Math.max(lastVisible, R / steps / 2)));
  }

  const meanR = visibleSum / rays;
  return {
    observer, observerHeightM, observerElevM: obsElev, radiusM: R,
    ring, rays: rayRows,
    visibleFraction: meanR / R,
    approxAreaKm2: (Math.PI * meanR * meanR) / 1e6,
    coverage,
  };
}

/* ── Solar geometry (NOAA low-precision algorithm, no network) ───────────── */

export interface SolarResult {
  azimuthDeg: number;      // 0=N, clockwise
  elevationDeg: number;    // above horizon
  isDaylight: boolean;
  shadowRatio: number | null; // shadow length / object height; null when sun is down
  shadowBearingDeg: number;   // direction the shadow points
  declinationDeg: number;
  solarNoonUtcHours: number;
}

export function solarPosition(at: LatLng, when: Date): SolarResult {
  const jd = when.getTime() / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;               // mean longitude
  const g = toRad((357.528 + 0.9856003 * n) % 360);       // mean anomaly
  const lambda = toRad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const eps = toRad(23.439 - 0.0000004 * n);

  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));

  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lstHours = (gmst + normLng(at.lng) / 15 + 24) % 24;
  let ha = toRad(lstHours * 15) - ra;
  ha = Math.atan2(Math.sin(ha), Math.cos(ha)); // wrap to [-pi,pi]

  const phi = toRad(at.lat);
  const elev = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));

  const elevationDeg = toDeg(elev);
  const azimuthDeg = (toDeg(az) + 360) % 360;
  return {
    azimuthDeg,
    elevationDeg,
    isDaylight: elevationDeg > 0,
    shadowRatio: elevationDeg > 0.5 ? 1 / Math.tan(elev) : null,
    shadowBearingDeg: (azimuthDeg + 180) % 360,
    declinationDeg: toDeg(decl),
    solarNoonUtcHours: (12 - normLng(at.lng) / 15 + 24) % 24,
  };
}

/* ── Road routing (OSRM public graph) ────────────────────────────────────── */

export interface RoadRoute {
  path: LatLng[];
  distanceM: number;
  durationS: number;
  degraded?: string;
}

/**
 * Snap waypoints to the driving road graph. On any upstream failure the caller
 * still gets a usable straight-line path, explicitly flagged as an estimate —
 * a degraded route is far better than a blank map.
 */
export async function roadRoute(waypoints: LatLng[], signal?: AbortSignal): Promise<RoadRoute> {
  const straight = (reason: string): RoadRoute => ({
    path: waypoints,
    distanceM: waypoints.slice(1).reduce((a, p, i) => a + haversineM(waypoints[i], p), 0),
    durationS: 0,
    degraded: reason,
  });
  if (waypoints.length < 2) return straight("Need two or more waypoints.");
  try {
    const coords = waypoints.map((p) => `${normLng(p.lng).toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const json = await fetchJson(url, signal, 15_000);
    const route = json?.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) return straight("Road graph returned no route — showing direct line.");
    return {
      path: line.map((c: [number, number]) => ({ lat: c[1], lng: c[0] })),
      distanceM: Number(route.distance) || 0,
      durationS: Number(route.duration) || 0,
    };
  } catch (e: any) {
    return straight(`Road graph unreachable (${e?.message ?? "network"}) — showing direct line.`);
  }
}

/* ── Co-location detection ───────────────────────────────────────────────── */

export interface Colocation {
  aId: string; aLabel: string;
  bId: string; bLabel: string;
  distanceM: number;
  center: LatLng;
}

/**
 * All pairs of points within `thresholdM`. O(n²) is deliberate and safe: the
 * overlay is hard-capped at 500 objects, so the worst case is ~125k cheap
 * comparisons — well under one animation frame.
 */
export function detectColocations(
  items: Array<{ id: string; label: string; lat?: number; lng?: number }>,
  thresholdM = 60,
): Colocation[] {
  const pts = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng)) as Array<Required<typeof items[number]>>;
  const out: Colocation[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = haversineM(pts[i], pts[j]);
      if (d <= thresholdM) {
        out.push({
          aId: pts[i].id, aLabel: pts[i].label,
          bId: pts[j].id, bLabel: pts[j].label,
          distanceM: d,
          center: { lat: (pts[i].lat + pts[j].lat) / 2, lng: (pts[i].lng + pts[j].lng) / 2 },
        });
      }
    }
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

export const fmtM = (m: number): string => (m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`);
export const fmtDuration = (s: number): string => {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
export const compass = (deg: number): string =>
  ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round(((deg % 360) + 360) % 360 / 22.5) % 16
  ];
