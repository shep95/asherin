import { Geolocation, type PositionOptions } from "@capacitor/geolocation";
import { isNativeApp } from "./nativeRuntime";

/**
 * NATIVE GEOLOCATION BRIDGE
 *
 * On the web the only fix source is `navigator.geolocation`, which a mobile OS
 * suspends the moment the app leaves the foreground. Inside the companion app
 * the OS-level plugin holds the fix stream instead, so the watch survives the
 * screen going off. This module is the single seam between the two: callers ask
 * for a watch and get whichever runtime is actually present.
 *
 * Errors are never thrown outward — a denied permission degrades to "no fixes",
 * exactly as a web geolocation error does, so the Sentinel's two legs keep the
 * same failure shape on both runtimes.
 */

export type Fix = { lat: number; lng: number; accuracy?: number };
export type GeoHandle = { stop: () => void };

const OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 20_000,
};

/** Ask once. A denial is a final answer for this launch, not a retry loop. */
async function ensureNativePermission(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions();
    const granted = status.location === "granted" || (status as any).coarseLocation === "granted";
    if (granted) return true;
    if (status.location === "denied") return false;
    const asked = await Geolocation.requestPermissions({ permissions: ["location"] });
    return asked.location === "granted" || (asked as any).coarseLocation === "granted";
  } catch {
    return false;
  }
}

/**
 * Starts a fix stream on the best runtime available. Returns a handle whose
 * `stop()` is idempotent and safe before the async start has resolved.
 */
export function watchPosition(
  onFix: (fix: Fix) => void,
  onError: () => void,
): GeoHandle {
  let stopped = false;

  if (isNativeApp()) {
    let watchId: string | null = null;
    void (async () => {
      if (!(await ensureNativePermission())) { onError(); return; }
      try {
        const id = await Geolocation.watchPosition(OPTS, (p, err) => {
          if (stopped) return;
          if (err || !p) { onError(); return; }
          onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        });
        if (stopped) { void Geolocation.clearWatch({ id }); return; }
        watchId = id;
      } catch {
        onError();
      }
    })();
    return {
      stop: () => {
        stopped = true;
        if (watchId) { void Geolocation.clearWatch({ id: watchId }).catch(() => undefined); watchId = null; }
      },
    };
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    onError();
    return { stop: () => undefined };
  }

  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (stopped) return;
      onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    },
    () => { if (!stopped) onError(); },
    // The web leg stays low-accuracy: it runs in a tab that pays for the radio
    // in battery the user did not opt into by installing an app.
    { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 },
  );

  return {
    stop: () => {
      stopped = true;
      try { navigator.geolocation.clearWatch(id); } catch { /* noop */ }
    },
  };
}
