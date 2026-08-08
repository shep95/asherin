/**
 * ALWAYS-ON SENTINEL DAEMON
 *
 * Narrative this module answers:
 *   A protective watch that only runs when the user remembers to press a button
 *   is not a watch — it is a diary. The person who most needs Bluetooth and area
 *   monitoring is the person who is being followed, distracted, coerced, or
 *   simply not looking at their phone. So the Sentinel arms itself.
 *
 * Design decisions carried out of the flaw pass:
 *  • Module-level singleton, not component state. Navigating between dashboard
 *    modules must not stop the radio or reset the buffer.
 *  • Armed-by-default, persisted. Only an explicit disarm turns it off, and the
 *    disarm survives reloads so we never fight the user's stated choice.
 *  • Two independent legs. Area risk runs on geolocation alone; it must not be
 *    hostage to Bluetooth permission. Bluetooth runs on its own leg and degrades
 *    to "waiting for permission" instead of failing the whole daemon.
 *  • Watchdog. Radios die, wake locks get revoked on screen-off, tabs get frozen
 *    by the browser. A 60s supervisor re-engages any leg that stopped, instead of
 *    trusting a start that happened once.
 *  • Silent-by-default. Automatic re-arm attempts never toast; only real findings
 *    (recurring radio, risk area) speak.
 *  • No duplicate scanners. The UI subscribes to this daemon rather than opening
 *    a second radio stream, which would double-count sightings and corrupt the
 *    recurrence maths the whole stalking case rests on.
 */

import { supabase } from "@/integrations/supabase/client";
import { invokeWithByokRetry } from "@/lib/byokInvoke";
import {
  startScan,
  detectScanMode,
  type RawAdvert,
  type ScannerHandle,
  type ScanMode,
} from "@/components/dashboard/zaxin/core/scanner";
import { toast } from "sonner";

const ARM_KEY = "asherin.sentinel.armed";
const FLUSH_MS = 45_000;
const AREA_MS = 5 * 60_000;
const WATCHDOG_MS = 60_000;
const RETRY_MS = 60_000;

export interface AreaState {
  level: string;
  label: string;
  summary: string;
  checkedAt: number;
}

export interface SentinelState {
  armed: boolean;
  /** Radio actually streaming right now. */
  scanning: boolean;
  /** Geolocation fix acquired — area leg is live. */
  positioned: boolean;
  mode: ScanMode;
  liveCount: number;
  flushing: boolean;
  checkingArea: boolean;
  /** Why the radio leg is not running, in the user's language. */
  blocked: string | null;
  area: AreaState | null;
  lastFlushAt: number | null;
}

type Listener = (s: SentinelState) => void;

let state: SentinelState = {
  armed: readArmed(),
  scanning: false,
  positioned: false,
  mode: typeof navigator === "undefined" ? "unsupported" : detectScanMode(),
  liveCount: 0,
  flushing: false,
  checkingArea: false,
  blocked: null,
  area: null,
  lastFlushAt: null,
};

const listeners = new Set<Listener>();

const buffer = new Map<string, RawAdvert & { lat?: number; lng?: number; accuracy?: number }>();
let handle: ScannerHandle | null = null;
let wakeLock: any = null;
let geoWatchId: number | null = null;
let pos: { lat: number; lng: number; accuracy: number } | null = null;
let sessionId = "";
let flushTimer: number | null = null;
let areaTimer: number | null = null;
let watchdogTimer: number | null = null;
let lastRadioAttempt = 0;
let booted = false;
let geoEnabled = true;
let bleEnabled = true;
let settingsLoaded = false;
let onDeckAlerts = 0;

function readArmed(): boolean {
  try {
    // Absence means "never disarmed" — the protective default is armed.
    return localStorage.getItem(ARM_KEY) !== "0";
  } catch {
    return true;
  }
}

function emit(patch: Partial<SentinelState>) {
  state = { ...state, ...patch };
  for (const l of listeners) {
    try { l(state); } catch { /* a bad subscriber must not stop the daemon */ }
  }
}

export function getSentinelState(): SentinelState {
  return state;
}

export function subscribeSentinel(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => { listeners.delete(l); };
}

async function resolveByok(): Promise<Record<string, string> | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const { data: pref } = await supabase
      .from("user_model_preferences" as any)
      .select("active_provider, active_model").eq("user_id", user.id).maybeSingle();
    const provider = (pref as any)?.active_provider;
    const model = (pref as any)?.active_model;
    if (!provider || provider === "default" || !model || model === "default") return undefined;
    const { data: keyRow } = await supabase
      .from("user_api_keys" as any)
      .select("api_key").eq("user_id", user.id).eq("provider", provider).eq("is_active", true).maybeSingle();
    const apiKey = (keyRow as any)?.api_key;
    return apiKey ? { provider, model, apiKey } : undefined;
  } catch {
    return undefined;
  }
}

async function hasSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

async function loadSettings(): Promise<void> {
  if (settingsLoaded) return;
  try {
    const { data } = await supabase.functions.invoke("sentinel-ble", { body: { action: "settings.get" } });
    const s = data?.settings;
    if (s) {
      geoEnabled = s.geo_enabled !== false;
      bleEnabled = s.ble_enabled !== false;
    }
    settingsLoaded = true;
  } catch {
    // Unreachable backend must not disarm the watch; defaults stay permissive
    // and the next watchdog pass retries.
  }
}

/** Re-read settings after the user changes them in the UI. */
export function invalidateSentinelSettings() {
  settingsLoaded = false;
  void loadSettings();
}

// ── Radio leg ────────────────────────────────────────────────────────────────

function onAdvert(a: RawAdvert) {
  // Strongest sample per radio per window: closest approach is the fact that
  // matters in a following pattern, not the average of a noisy street.
  const prev = buffer.get(a.id);
  if (!prev || (a.rssi ?? -999) > (prev.rssi ?? -999)) {
    buffer.set(a.id, { ...a, ...(pos || {}) });
  }
  if (buffer.size !== state.liveCount) emit({ liveCount: buffer.size });
}

async function startRadio(): Promise<void> {
  if (handle || !bleEnabled) return;
  const now = Date.now();
  if (now - lastRadioAttempt < RETRY_MS) return;
  lastRadioAttempt = now;
  const mode = detectScanMode();
  if (mode === "unsupported" || mode === "picker") {
    emit({
      mode,
      scanning: false,
      blocked: mode === "picker"
        ? "This browser exposes only the one-shot Bluetooth picker. Install the Asherin companion app for continuous, background sweeps."
        : "Web Bluetooth is unavailable here. Install the Asherin companion app, or use Chrome on Android.",
    });
    return;
  }
  try {
    handle = await startScan(onAdvert);
    emit({ mode, scanning: true, blocked: null });
  } catch (e) {
    // A denied or gesture-required permission is expected on first web load.
    // Stay armed, keep the area leg alive, and retry on every visibility return.
    handle = null;
    emit({
      mode,
      scanning: false,
      blocked: e instanceof Error && /gesture|user activation/i.test(e.message)
        ? "Bluetooth needs one tap to grant permission on this browser. Everything else is already watching."
        : "Bluetooth permission is not granted yet. Grant it once and the watch stays on by itself.",
    });
  }
}

async function stopRadio(): Promise<void> {
  try { await handle?.stop(); } catch { /* noop */ }
  handle = null;
  emit({ scanning: false });
}

// ── Position leg ─────────────────────────────────────────────────────────────

function startGeo() {
  if (geoWatchId != null || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  geoWatchId = navigator.geolocation.watchPosition(
    (p) => {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
      if (!state.positioned) emit({ positioned: true });
    },
    () => { if (state.positioned) emit({ positioned: false }); },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
  );
}

function stopGeo() {
  if (geoWatchId != null) {
    try { navigator.geolocation.clearWatch(geoWatchId); } catch { /* noop */ }
    geoWatchId = null;
  }
  emit({ positioned: false });
}

// ── Work units ───────────────────────────────────────────────────────────────

export async function flushSentinel(silent = true): Promise<void> {
  const batch = Array.from(buffer.values());
  buffer.clear();
  emit({ liveCount: 0 });
  if (!batch.length) return;
  if (!(await hasSession())) return;
  emit({ flushing: true });
  try {
    const byok = await resolveByok();
    const data = await invokeWithByokRetry<any>("sentinel-ble", {
      body: {
        action: "ble.ingest",
        sessionId: sessionId || (sessionId = newSession()),
        scannerLabel: (navigator as any).platform || "device",
        adverts: batch.map((a) => ({
          id: a.id, name: a.name, manufacturer: a.manufacturer,
          serviceUuids: a.serviceUuids, rssi: a.rssi, txPower: a.txPower,
          lat: a.lat ?? null, lng: a.lng ?? null, accuracy: a.accuracy ?? null, ts: a.ts,
        })),
        ...(byok ? { byok } : {}),
      },
      silent: true,
    });
    for (const al of data?.alerts || []) {
      onDeckAlerts += 1;
      toast.warning(`Recurring device: ${al.name}`, { description: al.reason, duration: 12000 });
    }
    emit({ lastFlushAt: Date.now() });
    window.dispatchEvent(new CustomEvent("asherin-sentinel-ingest"));
    if (!silent) toast.success(`${batch.length} radios logged`);
  } catch (e) {
    if (!silent) toast.error(e instanceof Error ? e.message : "Ingest failed");
  } finally {
    emit({ flushing: false });
  }
}

export async function checkAreaNow(silent = true): Promise<void> {
  if (!geoEnabled) return;
  if (!pos) { if (!silent) toast.error("No position fix yet."); return; }
  if (!(await hasSession())) return;
  emit({ checkingArea: true });
  try {
    const byok = await resolveByok();
    const data = await invokeWithByokRetry<any>("sentinel-ble", {
      body: { action: "geo.check", lat: pos.lat, lng: pos.lng, ...(byok ? { byok } : {}) },
      silent: true,
    });
    const a = data?.assessment;
    if (a) {
      emit({ area: { level: a.risk_level, label: a.place_label || "", summary: a.summary || "", checkedAt: Date.now() } });
      if (data?.notified) {
        toast.warning(`${a.risk_level} risk area`, { description: (a.summary || "").slice(0, 180), duration: 14000 });
        window.dispatchEvent(new CustomEvent("asherin-sentinel-ingest"));
      }
    }
  } catch (e) {
    if (!silent) toast.error(e instanceof Error ? e.message : "Area check failed");
  } finally {
    emit({ checkingArea: false });
  }
}

function newSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Engine ───────────────────────────────────────────────────────────────────

async function engage(): Promise<void> {
  if (!state.armed) return;
  sessionId ||= newSession();
  await loadSettings();
  if (geoEnabled) startGeo();
  await startRadio();
  await requestWake();

  if (flushTimer == null) flushTimer = window.setInterval(() => { void flushSentinel(true); }, FLUSH_MS);
  if (areaTimer == null && geoEnabled) {
    areaTimer = window.setInterval(() => { void checkAreaNow(true); }, AREA_MS);
    window.setTimeout(() => { void checkAreaNow(true); }, 8_000);
  }
}

async function requestWake(): Promise<void> {
  if (wakeLock || typeof document === "undefined" || document.visibilityState !== "visible") return;
  try {
    wakeLock = await (navigator as any).wakeLock?.request("screen");
    wakeLock?.addEventListener?.("release", () => { wakeLock = null; });
  } catch { /* wake lock is a bonus, never a requirement */ }
}

async function disengage(): Promise<void> {
  if (flushTimer != null) { window.clearInterval(flushTimer); flushTimer = null; }
  if (areaTimer != null) { window.clearInterval(areaTimer); areaTimer = null; }
  stopGeo();
  await stopRadio();
  try { await wakeLock?.release?.(); } catch { /* noop */ }
  wakeLock = null;
  await flushSentinel(true);
}

/** Supervisor: every leg is re-checked, nothing is trusted to have stayed up. */
async function watchdog(): Promise<void> {
  if (!state.armed) return;
  await loadSettings();
  if (typeof document !== "undefined" && document.visibilityState === "visible") await requestWake();
  if (geoEnabled && geoWatchId == null) startGeo();
  if (!geoEnabled && geoWatchId != null) stopGeo();
  if (bleEnabled && !handle) await startRadio();
  if (!bleEnabled && handle) await stopRadio();
  if (flushTimer == null) flushTimer = window.setInterval(() => { void flushSentinel(true); }, FLUSH_MS);
  if (areaTimer == null && geoEnabled) areaTimer = window.setInterval(() => { void checkAreaNow(true); }, AREA_MS);
}

/** Called once from the app shell. Idempotent. */
export function bootSentinel(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const resume = () => {
    if (!state.armed) return;
    // A visibility return is a fresh user activation window on most browsers,
    // so this is also the cheapest moment to retry a blocked radio.
    lastRadioAttempt = 0;
    void watchdog();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
    else void flushSentinel(true); // never lose a buffer to a backgrounded tab
  });
  window.addEventListener("online", resume);
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("pagehide", () => { void flushSentinel(true); });

  watchdogTimer ??= window.setInterval(() => { void watchdog(); }, WATCHDOG_MS);

  // Arm on boot when the user has not disarmed.
  if (state.armed) void engage();
}

export async function armSentinel(): Promise<void> {
  try { localStorage.setItem(ARM_KEY, "1"); } catch { /* noop */ }
  emit({ armed: true });
  lastRadioAttempt = 0;
  await engage();
}

export async function disarmSentinel(): Promise<void> {
  try { localStorage.setItem(ARM_KEY, "0"); } catch { /* noop */ }
  emit({ armed: false });
  await disengage();
}

/** One tap from the UI: satisfies browsers that demand a gesture for the radio. */
export async function grantRadioPermission(): Promise<void> {
  lastRadioAttempt = 0;
  await startRadio();
  if (state.scanning) toast.success("Radio watch armed", { description: "It stays on by itself from now on." });
  else if (state.blocked) toast.error(state.blocked);
}

export function sentinelAlertCount(): number {
  return onDeckAlerts;
}

/** Merge an externally captured advert (picker mode) into the daemon buffer. */
export function ingestAdvert(a: RawAdvert): void {
  onAdvert(a);
}

/** Position for callers that need the daemon's current fix. */
export function sentinelPosition() {
  return pos;
}
