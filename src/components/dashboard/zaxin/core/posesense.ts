// PoseSense — camera + heading fusion for the AR Bluetooth Vision overlay.
//
// Compass heading is sourced from the DeviceOrientation API. On laptops and
// desktops without orientation sensors no event ever fires, so we attach
// both `deviceorientationabsolute` and `deviceorientation`, then run a
// short watchdog that rejects with a clear, actionable error if nothing
// arrives. The UI surfaces a manual-heading fallback in that case.

export type HeadingSource = "orientation" | "absolute" | "none";

export interface PoseStream {
  source: HeadingSource;
  stop: () => void;
}

/** Request DeviceOrientation, handling iOS permission gate. */
export async function startHeadingStream(onHeading: (deg: number) => void): Promise<PoseStream> {
  const w = window as unknown as {
    DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } & typeof DeviceOrientationEvent;
    ondeviceorientationabsolute?: unknown;
  };

  if (typeof window === "undefined" || typeof w.DeviceOrientationEvent === "undefined") {
    throw new Error("This browser has no orientation sensor. Use manual heading.");
  }

  // iOS Safari requires an explicit permission request from a user gesture.
  if (typeof w.DeviceOrientationEvent?.requestPermission === "function") {
    try {
      const res = await w.DeviceOrientationEvent.requestPermission();
      if (res !== "granted") throw new Error("Orientation permission denied. Use manual heading.");
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  let detectedSource: HeadingSource = "orientation";
  let firstEventResolved = false;
  let resolveFirst: ((v: void) => void) | null = null;
  let rejectFirst: ((e: Error) => void) | null = null;

  const firstEvent = new Promise<void>((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });

  const handler = (ev: DeviceOrientationEvent) => {
    let heading: number | null = null;
    const anyEv = ev as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (typeof anyEv.webkitCompassHeading === "number") {
      // iOS: 0 = north, increases clockwise — already what we want.
      heading = anyEv.webkitCompassHeading;
      detectedSource = "absolute";
    } else if (ev.absolute && typeof ev.alpha === "number") {
      heading = (360 - ev.alpha) % 360;
      detectedSource = "absolute";
    } else if (typeof ev.alpha === "number") {
      heading = (360 - ev.alpha) % 360;
    }
    if (heading != null && isFinite(heading)) {
      if (!firstEventResolved) {
        firstEventResolved = true;
        resolveFirst?.();
      }
      onHeading(heading);
    }
  };

  // Attach BOTH event names — some browsers only fire one of them.
  const hasAbsolute = "ondeviceorientationabsolute" in window;
  window.addEventListener("deviceorientation", handler as EventListener, true);
  if (hasAbsolute) {
    window.addEventListener("deviceorientationabsolute", handler as EventListener, true);
  }

  const stop = () => {
    window.removeEventListener("deviceorientation", handler as EventListener, true);
    if (hasAbsolute) {
      window.removeEventListener("deviceorientationabsolute", handler as EventListener, true);
    }
  };

  // Watchdog: if no events arrive within 2.5s, the device has no sensor
  // (typical of desktops). Reject so the UI can show manual heading.
  const watchdog = window.setTimeout(() => {
    if (!firstEventResolved) {
      stop();
      rejectFirst?.(new Error("No orientation sensor detected. Set heading manually."));
    }
  }, 2500);

  try {
    await firstEvent;
  } finally {
    window.clearTimeout(watchdog);
  }

  return { source: detectedSource, stop };
}

/** Open a camera by facing mode. Defaults to rear-facing. */
export async function startCamera(
  video: HTMLVideoElement,
  facing: "environment" | "user" = "environment",
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Opposite of a facing mode. */
export function flipFacing(f: "environment" | "user"): "environment" | "user" {
  return f === "environment" ? "user" : "environment";
}

/** Signed angular delta in [-180, 180]. Positive = clockwise. */
export function bearingDelta(target: number, current: number): number {
  const d = ((target - current + 540) % 360) - 180;
  return d;
}
