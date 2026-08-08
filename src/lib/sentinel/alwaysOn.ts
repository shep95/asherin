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
import { startBackgroundSentinel, handOverFix, beaconOnHide, stopBackgroundSentinel } from "./background";
import { reportMeshDevice, bindBatteryReporting } from "@/lib/asher/meshDevices";


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
  /** Latest automatic uplink judgement, so the UI never needs to ask for one. */
  network: { level: string; operator: string | null; checkedAt: number } | null;
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
  network: null,
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
let netTimer: number | null = null;
let tradeTimer: number | null = null;
/** Fleet heartbeat: keeps this device's battery/link fresh on the roster even
 *  when it is sitting still and geolocation emits nothing new. */
let meshTimer: number | null = null;
const MESH_MS = 2 * 60_000;

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
      // Tier B needs a fix it can report after this tab is gone. Handing it
      // over on every watch update costs nothing and is the only way a closed
      // browser can still say where its owner is.
      handOverFix(pos);
      // Fleet view: the same fix is what makes THIS device findable from the
      // operator's other devices. Throttled inside the reporter.
      void reportMeshDevice(pos, { source: "geo" });
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

// ── Network leg ──────────────────────────────────────────────────────────────
// The Wi-Fi / uplink judgement used to exist only while the Network tab was on
// screen. Safety that depends on which tab you opened is not safety, so the
// daemon owns it: on boot, on every link transition, on reconnect, and on a
// half-hourly cadence — throttled so a flapping connection cannot spam alerts.

const NET_MS = 30 * 60_000;
const NET_KEY = "asherin.netsentinel.lastAuto";

function linkFacts(): { linkType: string; effectiveType: string } {
  const c = (navigator as any)?.connection;
  const type = c?.type;
  return { linkType: type && type !== "none" ? type : "unknown", effectiveType: c?.effectiveType ?? "" };
}

export async function runNetworkCheck(force = false, opts?: { bypassThrottle?: boolean }): Promise<void> {
  if (!state.armed && !force) return;
  // A link transition is the exact moment a *different* network appears, so the
  // half-hourly cadence must not swallow it. A short anti-flap floor still
  // stops a bouncing radio from firing a burst of checks.
  const FLAP_MS = 45_000;
  if (!force) {
    let last = 0;
    try { last = Number(localStorage.getItem(NET_KEY) ?? 0); } catch { /* noop */ }
    const floor = opts?.bypassThrottle ? FLAP_MS : NET_MS;
    if (Date.now() - last < floor) return;
  }
  if (!(await hasSession())) return;
  try { localStorage.setItem(NET_KEY, String(Date.now())); } catch { /* noop */ }

  try {
    const { linkType, effectiveType } = linkFacts();
    const { data, error } = await supabase.functions.invoke("wifi-sentinel", {
      body: { action: "uplink", linkType, effectiveType, force },
    });
    if (error) throw error;
    const net = (data as any)?.network;
    if (net) {
      emit({ network: { level: net.riskLevel, operator: net.operator ?? null, checkedAt: Date.now() } });
      // Only a genuinely risky uplink speaks unprompted; a clean café network
      // that says nothing is the correct behaviour, not a missing feature.
      if ((data as any)?.notified) {
        toast.warning(`Network risk: ${net.riskLevel}`, {
          description: `${net.operator ?? "Unattributed uplink"} — full report in Cloud Intelligence → Network.`,
          duration: 14000,
        });
      }
    }
    window.dispatchEvent(new CustomEvent("asherin-network-updated"));
  } catch (e) {
    if (force) toast.error(e instanceof Error ? e.message : "Network report failed");
  }
}

// ── Tradecraft leg ───────────────────────────────────────────────────────────
// Recurrence only becomes a judgement once something evaluates it. Running that
// evaluation only when the Tradecraft tab mounts means the escalation that
// matters happens unobserved. The daemon re-scores on a cadence and speaks the
// moment the tier climbs.

const TRADE_MS = 15 * 60_000;
const TIER_KEY = "asherin.sentinel.lastTier";
const TIER_RANK: Record<string, number> = { none: 0, watch: 1, probable: 2, active: 3 };

export async function runTradecraftSweep(silent = true): Promise<any | null> {
  if (!(await hasSession())) return null;
  try {
    const { data, error } = await supabase.functions.invoke("sentinel-ble", { body: { action: "ble.tradecraft" } });
    if (error) throw error;
    const analysis = data?.analysis || null;
    if (analysis) {
      let prev = "none";
      try { prev = localStorage.getItem(TIER_KEY) || "none"; } catch { /* noop */ }
      const now = String(analysis.tier || "none");
      if ((TIER_RANK[now] ?? 0) > (TIER_RANK[prev] ?? 0)) {
        toast.warning(`Following pattern escalated to ${now.toUpperCase()}`, {
          description: analysis.headline || "Open Cloud Intelligence → Bluetooth Sentinel → Tradecraft.",
          duration: 16000,
        });
      }
      try { localStorage.setItem(TIER_KEY, now); } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("asherin-tradecraft-updated", { detail: data }));
    }
    return data ?? null;
  } catch (e) {
    if (!silent) toast.error(e instanceof Error ? e.message : "Analysis failed");
    return null;
  }
}

// ── Alert-delivery leg ───────────────────────────────────────────────────────
// Push enrolment behind a button means the alerts the daemon raises die in a
// tab nobody is looking at. Enrol silently whenever the browser already allows
// it; when the engine insists on user activation, borrow the next tap the user
// makes anywhere in the app instead of demanding a dedicated one.

let pushTried = false;

async function ensurePush(): Promise<void> {
  if (pushTried) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!(await hasSession())) return;
  if (Notification.permission === "denied") { pushTried = true; return; }
  if (Notification.permission === "default") return; // handled on first gesture
  pushTried = true;
  try {
    const { enablePush, readPushStatus } = await import("@/lib/guardianPush");
    const status = await readPushStatus();
    if (status.state !== "enabled") await enablePush();
  } catch { /* alert channel is best-effort; email delivery still stands */ }
}

/** Borrow the user's next natural interaction — never a dedicated button. */
function armOnFirstGesture(): void {
  if (typeof window === "undefined") return;
  const handler = () => {
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
    lastRadioAttempt = 0;
    void startRadio();
    void (async () => {
      if (!("Notification" in window) || Notification.permission !== "default") { void ensurePush(); return; }
      if (!(await hasSession())) return;
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") { pushTried = false; await ensurePush(); }
        else pushTried = true;
      } catch { /* engine refused; nothing else to do silently */ }
    })();
  };
  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("keydown", handler, true);
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
  if (netTimer == null) netTimer = window.setInterval(() => { void runNetworkCheck(false); }, NET_MS);
  if (tradeTimer == null) tradeTimer = window.setInterval(() => { void runTradecraftSweep(true); }, TRADE_MS);
  if (meshTimer == null) meshTimer = window.setInterval(() => { void reportMeshDevice(pos, { source: "heartbeat", force: true }); }, MESH_MS);

  // First pass, staggered so a cold start does not fire four calls at once.
  window.setTimeout(() => { void runNetworkCheck(false); }, 4_000);
  window.setTimeout(() => { void runTradecraftSweep(true); }, 12_000);
  // Announce this device to the fleet immediately: a laptop that is lost five
  // minutes from now must already be on the roster, not waiting out a timer.
  void reportMeshDevice(pos, { source: "boot", force: true });
  void bindBatteryReporting();
  void ensurePush();
  armOnFirstGesture();
  // Hand the watch to the runtimes that outlive this tab.
  void startBackgroundSentinel();

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
  if (netTimer != null) { window.clearInterval(netTimer); netTimer = null; }
  if (tradeTimer != null) { window.clearInterval(tradeTimer); tradeTimer = null; }
  if (meshTimer != null) { window.clearInterval(meshTimer); meshTimer = null; }

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
  if (netTimer == null) netTimer = window.setInterval(() => { void runNetworkCheck(false); }, NET_MS);
  if (tradeTimer == null) tradeTimer = window.setInterval(() => { void runTradecraftSweep(true); }, TRADE_MS);
  if (meshTimer == null) meshTimer = window.setInterval(() => { void reportMeshDevice(pos, { source: "heartbeat", force: true }); }, MESH_MS);
  void bindBatteryReporting();

  void ensurePush();
  void startBackgroundSentinel();
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
    else { void flushSentinel(true); beaconOnHide(); } // never lose a buffer to a backgrounded tab
  });
  window.addEventListener("online", () => { resume(); void runNetworkCheck(false, { bypassThrottle: true }); });
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("pagehide", () => { void flushSentinel(true); beaconOnHide(); });
  // A link transition is the one moment a new, unjudged network appears.
  (navigator as any)?.connection?.addEventListener?.("change", () => { void runNetworkCheck(false, { bypassThrottle: true }); });


  watchdogTimer ??= window.setInterval(() => { void watchdog(); }, WATCHDOG_MS);

  // Diagnostic surface: lets support confirm the watch is live on a real device
  // without asking the user to read logs. Read-only snapshot, no secrets.
  (window as any).__sentinelProbe = () => ({ ...state });

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
  // A disarm the user typed must reach the runtimes they cannot see.
  await stopBackgroundSentinel();
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
