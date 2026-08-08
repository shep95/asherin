/* ─────────────────────────────────────────────────────────────────────────
   ASHER — Operator Self-Tracking Engine
   ─────────────────────────────────────────────────────────────────────────
   Turns the browser Geolocation API into an intelligence-grade own-force
   track ("blue force") for the Intelligence Map.

   Doctrine encoded here:

   1. CONSENT IS A GATE, NOT A SIDE EFFECT.
      The AI may *request* tracking, but the sensor never opens without an
      explicit operator action. A model that could silently open the GPS is a
      surveillance backdoor. `grantConsent()` is only ever called from a real
      click; the AI path can only raise `pendingRequest`.

   2. FIXES ARE EVIDENCE, NOT TRUTH.
      Every fix carries its own accuracy radius. Fixes worse than the gate are
      recorded as degraded and excluded from distance/speed math so a single
      500 m wifi-triangulated fix cannot fabricate a 500 m "movement".

   3. LOCAL ONLY.
      The trail lives in memory + sessionStorage. Nothing is transmitted; no
      upload path exists in this module by design.

   4. DERIVED MOTION IS LABELLED.
      Hardware speed/heading are used when the device supplies them; otherwise
      they are derived from consecutive good fixes and flagged `derived`.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SelfFix {
  ts: number;            // epoch ms, from the position timestamp (source clock)
  lat: number;
  lng: number;
  accM: number;          // horizontal accuracy, metres (1-sigma per spec)
  altM: number | null;
  altAccM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  derivedMotion: boolean; // heading/speed computed by us, not by the device
  degraded: boolean;      // accuracy worse than the gate — excluded from math
}

export interface Geofence {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: number;
  /** Last known containment, used for hysteresis-free edge detection. */
  inside: boolean;
}

export interface GeofenceEvent {
  id: string;
  fenceId: string;
  label: string;
  kind: "enter" | "exit";
  ts: number;
}

export type TrackStatus = "idle" | "requesting" | "live" | "denied" | "unsupported" | "error";

export interface SelfTrackStats {
  fixes: number;
  distanceM: number;      // cumulative over good fixes only
  durationMs: number;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  bestAccM: number | null;
  stationarySinceMs: number | null; // dwell timer, null while moving
}

/* Tunables. Chosen for a handheld operator, not a vehicle telemetry rig. */
const ACC_GATE_M = 120;        // fixes worse than this never drive the math
const MIN_STEP_M = 6;          // GPS jitter floor — below this we are standing still
const MAX_TRAIL = 2000;        // ring buffer cap; ~5.5h at 10s cadence
const DWELL_JITTER_M = 25;     // radius that still counts as "same place"
const CONSENT_KEY = "asher.selftrack.consent";
const TRAIL_KEY = "asher.selftrack.trail";
const FENCE_KEY = "asher.selftrack.fences";

const EARTH_R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLng = rad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLng);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export const compass16 = (d: number): string =>
  ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round(((d % 360) + 360) % 360 / 22.5) % 16
  ];

export const fmtSpeed = (mps: number | null): string =>
  mps == null ? "—" : `${(mps * 3.6).toFixed(1)} km/h`;

export const fmtDistanceM = (m: number): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

export const fmtClock = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}h ${mm}m` : mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;
};

/* ── Exports (local file generation, never a network call) ───────────────── */

export function trailToGeoJSON(trail: SelfFix[]) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "Asher operator track",
          generated: new Date().toISOString(),
          fixes: trail.length,
        },
        geometry: { type: "LineString", coordinates: trail.map((f) => [f.lng, f.lat]) },
      },
      ...trail.map((f) => ({
        type: "Feature",
        properties: {
          ts: new Date(f.ts).toISOString(),
          accuracy_m: f.accM,
          speed_mps: f.speedMps,
          heading_deg: f.headingDeg,
          degraded: f.degraded,
        },
        geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      })),
    ],
  };
}

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

export function trailToGPX(trail: SelfFix[]): string {
  const pts = trail
    .map(
      (f) =>
        `      <trkpt lat="${f.lat.toFixed(7)}" lon="${f.lng.toFixed(7)}">` +
        (f.altM != null ? `<ele>${f.altM.toFixed(1)}</ele>` : "") +
        `<time>${new Date(f.ts).toISOString()}</time>` +
        `<hdop>${(f.accM / 5).toFixed(2)}</hdop>` +
        `</trkpt>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${xml("Asherin — Asher Intelligence Map")}" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${xml("Operator track")}</name><trkseg>
${pts}
  </trkseg></trk>
</gpx>`;
}

export function downloadText(filename: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke on the next frame — revoking synchronously races the download in
  // Safari and silently produces a zero-byte file.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/* ── Persistence (session-scoped, local only) ────────────────────────────── */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — tracking still works, it just is not resumable */
  }
}

/* Consent is DURABLE, not session-scoped.
   Previously the grant lived in sessionStorage, so every new tab re-locked the
   sensor: the operator's own-force track died the moment they reopened the
   app, the map fell back to its continental default, and every "nearby" tool
   then swept a city the operator was not standing in. A consent decision is a
   standing authorisation until it is revoked, so it belongs in localStorage.
   A session-era grant is migrated forward once so nobody is asked twice. */
export function hasStoredConsent(): boolean {
  try {
    if (localStorage.getItem(CONSENT_KEY) === "granted") return true;
    if (sessionStorage.getItem(CONSENT_KEY) === "granted") {
      localStorage.setItem(CONSENT_KEY, "granted");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}


/* ── The hook ────────────────────────────────────────────────────────────── */

export interface UseSelfTracking {
  status: TrackStatus;
  error: string | null;
  consent: boolean;
  /** Set when the AI asked for tracking and consent has not been given yet. */
  pendingRequest: string | null;
  fix: SelfFix | null;
  trail: SelfFix[];
  stats: SelfTrackStats;
  fences: Geofence[];
  events: GeofenceEvent[];
  follow: boolean;

  requestFromAI: (reason: string) => void;
  clearPending: () => void;
  grantConsent: () => void;
  revokeConsent: () => void;
  start: () => void;
  stop: () => void;
  setFollow: (on: boolean) => void;
  addFence: (f: { label: string; lat: number; lng: number; radiusM: number }) => Geofence;
  removeFence: (id: string) => void;
  clearTrail: () => void;
}

export function useSelfTracking(opts?: { onFix?: (f: SelfFix) => void; onFenceEvent?: (e: GeofenceEvent) => void }): UseSelfTracking {
  const onFixRef = useRef(opts?.onFix);
  const onFenceRef = useRef(opts?.onFenceEvent);
  onFixRef.current = opts?.onFix;
  onFenceRef.current = opts?.onFenceEvent;

  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const [status, setStatus] = useState<TrackStatus>(supported ? "idle" : "unsupported");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean>(hasStoredConsent);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [fix, setFix] = useState<SelfFix | null>(null);
  const [trail, setTrail] = useState<SelfFix[]>(() => readJSON<SelfFix[]>(TRAIL_KEY, []));
  const [fences, setFences] = useState<Geofence[]>(() => readJSON<Geofence[]>(FENCE_KEY, []));
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [follow, setFollow] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  /* Refs mirror state for use inside the geolocation callback, which is
     registered once and would otherwise capture a stale closure. */
  const trailRef = useRef<SelfFix[]>(trail);
  const fencesRef = useRef<Geofence[]>(fences);
  const distRef = useRef(0);
  const maxSpeedRef = useRef<number | null>(null);
  const dwellAnchorRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastFixRef = useRef<SelfFix | null>(null);

  const [dwellSince, setDwellSince] = useState<number | null>(null);

  useEffect(() => { trailRef.current = trail; }, [trail]);
  useEffect(() => { fencesRef.current = fences; writeJSON(FENCE_KEY, fences); }, [fences]);

  /* Persist the trail lazily — writing 2000 points on every fix would block
     the main thread for longer than the fix cadence. */
  useEffect(() => {
    const t = window.setTimeout(() => writeJSON(TRAIL_KEY, trail.slice(-MAX_TRAIL)), 1500);
    return () => window.clearTimeout(t);
  }, [trail]);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const c = pos.coords;
    const accM = Number.isFinite(c.accuracy) ? c.accuracy : 9999;
    const prevGood = [...trailRef.current].reverse().find((f) => !f.degraded) || null;

    let headingDeg: number | null = Number.isFinite(c.heading as number) ? (c.heading as number) : null;
    let speedMps: number | null = Number.isFinite(c.speed as number) && (c.speed as number) >= 0 ? (c.speed as number) : null;
    let derived = false;

    const degraded = accM > ACC_GATE_M;
    let stepM = 0;

    if (prevGood && !degraded) {
      stepM = haversineM(prevGood, { lat: c.latitude, lng: c.longitude });
      const dtS = Math.max(0.001, (pos.timestamp - prevGood.ts) / 1000);
      if (stepM >= MIN_STEP_M) {
        if (speedMps == null) { speedMps = stepM / dtS; derived = true; }
        if (headingDeg == null) { headingDeg = bearingDeg(prevGood, { lat: c.latitude, lng: c.longitude }); derived = true; }
        distRef.current += stepM;
        maxSpeedRef.current = Math.max(maxSpeedRef.current ?? 0, speedMps);
      } else {
        // Inside the jitter floor: hold heading, report stationary.
        headingDeg = headingDeg ?? prevGood.headingDeg;
        speedMps = 0;
        derived = true;
      }
    }

    const f: SelfFix = {
      ts: pos.timestamp,
      lat: c.latitude,
      lng: c.longitude,
      accM,
      altM: Number.isFinite(c.altitude as number) ? (c.altitude as number) : null,
      altAccM: Number.isFinite(c.altitudeAccuracy as number) ? (c.altitudeAccuracy as number) : null,
      headingDeg,
      speedMps,
      derivedMotion: derived,
      degraded,
    };

    // Dwell detection: how long have we stayed inside DWELL_JITTER_M?
    const anchor = dwellAnchorRef.current;
    if (!anchor || haversineM(anchor, f) > DWELL_JITTER_M) {
      dwellAnchorRef.current = { lat: f.lat, lng: f.lng, ts: f.ts };
      setDwellSince(f.ts);
    }

    lastFixRef.current = f;
    setFix(f);

    setStatus("live");
    setError(null);
    setTrail((p) => {
      const next = p.concat(f);
      return next.length > MAX_TRAIL ? next.slice(next.length - MAX_TRAIL) : next;
    });

    // Geofence edges — evaluated only on trustworthy fixes so a degraded fix
    // cannot fire a false breach alert.
    if (!degraded && fencesRef.current.length) {
      const fired: GeofenceEvent[] = [];
      const updated = fencesRef.current.map((fence) => {
        const inside = haversineM(fence, f) <= fence.radiusM;
        if (inside !== fence.inside) {
          fired.push({
            id: crypto.randomUUID(),
            fenceId: fence.id,
            label: fence.label,
            kind: inside ? "enter" : "exit",
            ts: f.ts,
          });
        }
        return { ...fence, inside };
      });
      if (fired.length) {
        fencesRef.current = updated;
        setFences(updated);
        setEvents((p) => [...fired, ...p].slice(0, 50));
        fired.forEach((e) => onFenceRef.current?.(e));
      }
    }

    onFixRef.current?.(f);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus("denied");
      setError("Location permission denied by the browser. Re-enable it in the site permissions to track.");
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setStatus("error");
      setError("No position source available — GPS/wifi geolocation returned nothing.");
    } else {
      setStatus("error");
      setError("Position request timed out. Holding last known fix.");
    }
  }, []);

  const start = useCallback(() => {
    if (!supported) { setStatus("unsupported"); return; }
    if (watchIdRef.current != null) return;
    setStatus("requesting");
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
  }, [supported, handlePosition, handleError]);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus((s) => (s === "denied" || s === "unsupported" ? s : "idle"));
  }, []);

  // Sensor must close when the module unmounts — an orphan watch keeps the GPS
  // radio hot and drains the device long after the operator left the map.
  useEffect(() => () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  const grantConsent = useCallback(() => {
    try { sessionStorage.setItem(CONSENT_KEY, "granted"); } catch { /* private mode */ }
    setConsent(true);
    setPendingRequest(null);
    start();
  }, [start]);

  const revokeConsent = useCallback(() => {
    try { sessionStorage.removeItem(CONSENT_KEY); } catch { /* private mode */ }
    setConsent(false);
    setPendingRequest(null);
    stop();
  }, [stop]);

  const requestFromAI = useCallback((reason: string) => {
    if (hasStoredConsent()) { start(); return; }
    setPendingRequest(reason);
  }, [start]);

  const addFence = useCallback((f: { label: string; lat: number; lng: number; radiusM: number }): Geofence => {
    const radiusM = Math.max(20, Math.min(200_000, f.radiusM));
    /* Seed containment from the current fix. Without this a fence drawn
       around where the operator already stands reads "outside" until the next
       fix lands, and an exit alert then fires for a boundary never crossed. */
    const now = lastFixRef.current;
    const inside = !!now && !now.degraded && haversineM({ lat: f.lat, lng: f.lng }, now) <= radiusM;
    const fence: Geofence = {
      id: crypto.randomUUID(),
      label: f.label,
      lat: f.lat,
      lng: f.lng,
      radiusM,
      createdAt: Date.now(),
      inside,
    };
    setFences((p) => [...p, fence]);
    return fence;
  }, []);


  const removeFence = useCallback((id: string) => setFences((p) => p.filter((x) => x.id !== id)), []);

  const clearTrail = useCallback(() => {
    distRef.current = 0;
    maxSpeedRef.current = null;
    dwellAnchorRef.current = null;
    setDwellSince(null);
    setTrail([]);
    writeJSON(TRAIL_KEY, []);
  }, []);

  const stats: SelfTrackStats = useMemo(() => {
    const good = trail.filter((f) => !f.degraded);
    const durationMs = good.length >= 2 ? good[good.length - 1].ts - good[0].ts : 0;
    return {
      fixes: trail.length,
      distanceM: distRef.current,
      durationMs,
      avgSpeedMps: durationMs > 0 ? distRef.current / (durationMs / 1000) : null,
      maxSpeedMps: maxSpeedRef.current,
      bestAccM: good.length ? Math.min(...good.map((f) => f.accM)) : null,
      stationarySinceMs: dwellSince,
    };
  }, [trail, dwellSince]);

  return {
    status, error, consent, pendingRequest, fix, trail, stats, fences, events, follow,
    requestFromAI, clearPending: () => setPendingRequest(null),
    grantConsent, revokeConsent, start, stop, setFollow,
    addFence, removeFence, clearTrail,
  };
}
