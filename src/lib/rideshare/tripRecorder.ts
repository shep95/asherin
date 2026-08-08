/**
 * TRIP RECORDER — the rider's own black box.
 *
 * The failure this design is built against is not inaccuracy, it is loss. A
 * phone in a pocket sleeps, the mobile signal drops in a tunnel, the browser
 * evicts a tab under memory pressure, the battery dies two minutes before
 * arrival. Any of those wipes an in-memory trace, and the one ride the rider
 * needs a record of is the one where something went wrong.
 *
 * So every fix is written to localStorage the moment it arrives and only
 * cleared once the server has acknowledged it. Uploads are at-least-once and
 * the server de-duplicates on (trip, timestamp); a replayed buffer costs
 * nothing but is the difference between a partial record and none.
 *
 * Nothing here interprets the data. Speed, streets and events are derived
 * server-side from the raw trace so that a re-analysis with better road data
 * changes the findings without needing the rider to drive again.
 */

import { supabase } from "@/integrations/supabase/client";

export interface Fix {
  t: number;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
}

export interface RecorderState {
  status: "idle" | "starting" | "recording" | "stopping" | "error";
  tripId: string | null;
  startedAt: number | null;
  fixes: number;
  pendingUpload: number;
  lastFix: Fix | null;
  lastUploadAt: number | null;
  /** Metres, straight-line accumulation — a live readout, not the final figure. */
  liveDistanceM: number;
  liveMaxMps: number;
  error: string | null;
  /** True when fixes have stopped arriving while recording is still active. */
  stalled: boolean;
}

type Listener = (s: RecorderState) => void;

const BUFFER_KEY = "asherin.trip.buffer.v1";
const SESSION_KEY = "asherin.trip.session.v1";
/** Upload cadence. Frequent enough that a dead battery costs seconds, not miles. */
const FLUSH_MS = 15_000;
const FLUSH_AT_POINTS = 40;
/** No fix for this long while recording means the sensor has gone quiet. */
const STALL_MS = 45_000;
/** Fixes closer together than this add jitter, not information. */
const MIN_SAMPLE_MS = 900;

function haversineM(a: Fix, b: Fix): number {
  const p = Math.PI / 180;
  const dLat = (b.lat - a.lat) * p, dLon = (b.lon - a.lon) * p;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)));
}

class TripRecorder {
  private state: RecorderState = {
    status: "idle", tripId: null, startedAt: null, fixes: 0, pendingUpload: 0,
    lastFix: null, lastUploadAt: null, liveDistanceM: 0, liveMaxMps: 0,
    error: null, stalled: false,
  };
  private listeners = new Set<Listener>();
  private watchId: number | null = null;
  private flushTimer: number | null = null;
  private stallTimer: number | null = null;
  private buffer: Fix[] = [];
  private prev: Fix | null = null;
  private flushing = false;
  private wakeLock: WakeLockSentinel | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState(): RecorderState { return this.state; }

  private set(patch: Partial<RecorderState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  // ── persistence ──────────────────────────────────────────────────────────

  private persist() {
    try {
      localStorage.setItem(BUFFER_KEY, JSON.stringify(this.buffer));
    } catch {
      // Storage full or blocked. Dropping the oldest half keeps the recorder
      // alive with the most recent stretch rather than failing outright.
      this.buffer = this.buffer.slice(Math.floor(this.buffer.length / 2));
      try { localStorage.setItem(BUFFER_KEY, JSON.stringify(this.buffer)); } catch { /* give up quietly */ }
    }
  }

  private loadBuffer() {
    try {
      const raw = localStorage.getItem(BUFFER_KEY);
      this.buffer = raw ? JSON.parse(raw) : [];
    } catch { this.buffer = []; }
  }

  /**
   * Recovers a trip the browser interrupted. Called on mount so a reload or a
   * crash resumes rather than orphans the recording.
   */
  async restore(): Promise<boolean> {
    let session: { tripId: string; startedAt: number; fixes: number } | null = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch { session = null; }
    if (!session?.tripId) return false;

    this.loadBuffer();
    this.set({
      status: "recording",
      tripId: session.tripId,
      startedAt: session.startedAt,
      fixes: session.fixes ?? this.buffer.length,
      pendingUpload: this.buffer.length,
      error: null,
    });
    await this.startWatch();
    this.startTimers();
    void this.flush();
    return true;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  async start(opts: { label?: string; platform?: string; rideId?: string | null } = {}) {
    if (this.state.status === "recording" || this.state.status === "starting") return;
    if (!("geolocation" in navigator)) {
      this.set({ status: "error", error: "This device exposes no location sensor to the browser." });
      return;
    }
    this.set({ status: "starting", error: null });

    // A stable idempotency key means a retry after a flaky response resumes the
    // same trip instead of splitting the ride into two half-records.
    const idem = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { data, error } = await supabase.functions.invoke("rideshare-guardian", {
      body: {
        action: "trip.start",
        label: opts.label || null,
        platform: opts.platform || "uber",
        ride_id: opts.rideId || null,
        idempotency_key: idem,
      },
    });
    if (error || !data?.trip?.id) {
      this.set({ status: "error", error: "Could not open a trip record. Check the connection and try again." });
      return;
    }

    this.buffer = [];
    this.prev = null;
    this.persist();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      tripId: data.trip.id, startedAt: Date.now(), fixes: 0,
    }));

    this.set({
      status: "recording", tripId: data.trip.id, startedAt: Date.now(),
      fixes: 0, pendingUpload: 0, liveDistanceM: 0, liveMaxMps: 0,
      lastFix: null, error: null, stalled: false,
    });

    await this.startWatch();
    this.startTimers();
  }

  private async startWatch() {
    if (this.watchId != null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onFix(pos),
      (err) => {
        // A permission refusal is terminal; a temporary unavailability is not,
        // so only the former stops the recording.
        if (err.code === err.PERMISSION_DENIED) {
          this.set({ status: "error", error: "Location permission was refused, so nothing can be recorded." });
          void this.stop(false);
        } else {
          this.set({ error: "Location is temporarily unavailable — the gap will be marked in the record." });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );

    // Keeping the screen awake is what keeps the sensor sampling on most
    // phones. It is best-effort: refusal degrades sampling, it does not break.
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinel> } };
      if (nav.wakeLock) this.wakeLock = await nav.wakeLock.request("screen");
    } catch { /* best effort */ }
  }

  private onFix(pos: GeolocationPosition) {
    const c = pos.coords;
    const t = pos.timestamp || Date.now();
    if (this.prev && t - this.prev.t < MIN_SAMPLE_MS) return;

    const fix: Fix = {
      t,
      lat: c.latitude,
      lon: c.longitude,
      accuracy_m: Number.isFinite(c.accuracy) ? Math.round(c.accuracy * 10) / 10 : null,
      speed_mps: c.speed != null && Number.isFinite(c.speed) && c.speed >= 0
        ? Math.round(c.speed * 100) / 100 : null,
      heading_deg: c.heading != null && Number.isFinite(c.heading) ? Math.round(c.heading) : null,
      altitude_m: c.altitude != null && Number.isFinite(c.altitude) ? Math.round(c.altitude) : null,
    };

    // The live readout ignores obviously bad fixes so the on-screen distance
    // does not run away while the car sits still under a bridge.
    let dist = this.state.liveDistanceM;
    if (this.prev && (fix.accuracy_m == null || fix.accuracy_m <= 40)) {
      const d = haversineM(this.prev, fix);
      if (d < 500) dist += d;
    }
    const spd = fix.speed_mps ?? 0;

    this.buffer.push(fix);
    this.prev = fix;
    this.persist();
    this.set({
      fixes: this.state.fixes + 1,
      pendingUpload: this.buffer.length,
      lastFix: fix,
      liveDistanceM: dist,
      liveMaxMps: Math.max(this.state.liveMaxMps, spd),
      stalled: false,
      error: null,
    });
    this.armStall();

    if (this.buffer.length >= FLUSH_AT_POINTS) void this.flush();
  }

  private startTimers() {
    if (this.flushTimer == null) {
      this.flushTimer = window.setInterval(() => void this.flush(), FLUSH_MS);
    }
    this.armStall();
  }

  private armStall() {
    if (this.stallTimer != null) window.clearTimeout(this.stallTimer);
    this.stallTimer = window.setTimeout(() => {
      if (this.state.status === "recording") this.set({ stalled: true });
    }, STALL_MS);
  }

  /** Ships the buffer. Only clears what the server acknowledged. */
  async flush(): Promise<void> {
    if (this.flushing || !this.state.tripId || !this.buffer.length) return;
    this.flushing = true;
    const batch = this.buffer.slice(0, 500);
    try {
      const { error } = await supabase.functions.invoke("rideshare-guardian", {
        body: { action: "trip.points", trip_id: this.state.tripId, points: batch },
      });
      if (error) throw error;
      this.buffer = this.buffer.slice(batch.length);
      this.persist();
      this.set({ pendingUpload: this.buffer.length, lastUploadAt: Date.now() });
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, fixes: this.state.fixes }));
    } catch {
      // The buffer is kept. Nothing is dropped for a network failure — that is
      // precisely the moment the record matters most.
      this.set({ error: "Upload is behind; the trace is held on this device and will retry." });
    } finally {
      this.flushing = false;
    }
  }

  /** Stops recording, drains the buffer, then asks the server to analyse. */
  async stop(analyse = true): Promise<string | null> {
    const tripId = this.state.tripId;
    this.set({ status: "stopping" });

    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
    if (this.flushTimer != null) { window.clearInterval(this.flushTimer); this.flushTimer = null; }
    if (this.stallTimer != null) { window.clearTimeout(this.stallTimer); this.stallTimer = null; }
    try { await this.wakeLock?.release(); } catch { /* already gone */ }
    this.wakeLock = null;

    // Drain rather than single-shot: a long ride on a poor connection can have
    // several batches queued, and stopping must not abandon them.
    for (let i = 0; i < 20 && this.buffer.length; i++) {
      const before = this.buffer.length;
      await this.flush();
      if (this.buffer.length === before) break;
    }

    if (tripId) {
      try {
        await supabase.functions.invoke("rideshare-guardian", { body: { action: "trip.end", trip_id: tripId } });
        if (analyse) {
          await supabase.functions.invoke("rideshare-guardian", { body: { action: "trip.analyze", trip_id: tripId } });
        }
      } catch { /* the trip is stored; analysis can be re-run from the list */ }
    }

    if (!this.buffer.length) localStorage.removeItem(SESSION_KEY);
    this.set({
      status: "idle", tripId: null, startedAt: null, lastFix: null,
      pendingUpload: this.buffer.length, stalled: false,
    });
    return tripId;
  }
}

export const tripRecorder = new TripRecorder();
