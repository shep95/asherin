// PoseSense — camera + heading fusion for the AR Bluetooth Vision overlay.
//
// Compass heading is sourced from the DeviceOrientation API. On laptops and
// desktops without orientation sensors no event ever fires, so we attach
// both `deviceorientationabsolute` and `deviceorientation`, then run a
// short watchdog that rejects with a clear, actionable error if nothing
// arrives. The UI surfaces a manual-heading fallback in that case.

export type HeadingSource = "orientation" | "absolute" | "visual" | "none";

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

  // -------- High-rate path: Generic Sensor API (60 Hz when available) --------
  // AbsoluteOrientationSensor delivers true-north heading at the requested
  // frequency (typically 60 Hz), versus DeviceOrientation which most browsers
  // throttle to ~10-20 Hz. We try this first, then fall back.
  let hiResStop: (() => void) | null = null;
  try {
    const SensorCtor = (window as unknown as {
      AbsoluteOrientationSensor?: new (opts: { frequency: number; referenceFrame?: string }) => {
        quaternion: [number, number, number, number];
        start: () => void;
        stop: () => void;
        addEventListener: (e: string, cb: () => void) => void;
        removeEventListener: (e: string, cb: () => void) => void;
      };
    }).AbsoluteOrientationSensor;
    if (SensorCtor) {
      const sensor = new SensorCtor({ frequency: 60, referenceFrame: "screen" });
      const onReading = () => {
        const q = sensor.quaternion;
        if (!q) return;
        // Quaternion → yaw (heading around Z, north-relative)
        const [x, y, z, w] = q;
        const siny_cosp = 2 * (w * z + x * y);
        const cosy_cosp = 1 - 2 * (y * y + z * z);
        let yaw = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
        let heading = (360 - yaw) % 360;
        if (heading < 0) heading += 360;
        if (!firstEventResolved) { firstEventResolved = true; detectedSource = "absolute"; resolveFirst?.(); }
        onHeading(heading);
      };
      sensor.addEventListener("reading", onReading);
      sensor.start();
      hiResStop = () => { try { sensor.removeEventListener("reading", onReading); sensor.stop(); } catch { /* noop */ } };
    }
  } catch { /* permissions-policy block or unsupported — fall through */ }

  const handler = (ev: DeviceOrientationEvent) => {
    let heading: number | null = null;
    const anyEv = ev as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (typeof anyEv.webkitCompassHeading === "number") {
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
    hiResStop?.();
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

/**
 * Desktop fallback: derive relative heading from live camera motion.
 *
 * Laptops/desktops usually expose no magnetometer, so DeviceOrientation never
 * changes. This optical dead-reckoning path compares low-res luminance frames,
 * estimates horizontal pan, then accumulates it into a heading. It is not true
 * north, but it is live camera data and makes the top compass move when the
 * operator pans/turns the camera on desktop hardware.
 */
export function startVisualHeadingStream(
  video: HTMLVideoElement,
  onHeading: (deg: number) => void,
  opts: { initialHeading?: number; horizontalFov?: number; hz?: number } = {},
): PoseStream {
  const width = 72;
  const height = 40;
  const horizontalFov = opts.horizontalFov ?? 60;
  const hz = opts.hz ?? 18;
  let heading = ((opts.initialHeading ?? 0) % 360 + 360) % 360;
  let prev: Uint8ClampedArray | null = null;
  let stopped = false;
  let timer = 0;
  let lastEmit = 0;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Visual heading unavailable. Use manual heading.");

  const luminance = () => {
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      gray[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
    }
    return gray;
  };

  const estimateShift = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    let bestShift = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    let secondScore = Number.POSITIVE_INFINITY;
    for (let shift = -8; shift <= 8; shift++) {
      let score = 0;
      let count = 0;
      const xStart = Math.max(0, -shift);
      const xEnd = Math.min(width, width - shift);
      for (let y = 8; y < height - 6; y += 2) {
        const row = y * width;
        for (let x = xStart; x < xEnd; x += 2) {
          score += Math.abs(a[row + x] - b[row + x + shift]);
          count++;
        }
      }
      const norm = score / Math.max(1, count);
      if (norm < bestScore) {
        secondScore = bestScore;
        bestScore = norm;
        bestShift = shift;
      } else if (norm < secondScore) {
        secondScore = norm;
      }
    }
    const confidence = Math.max(0, Math.min(1, (secondScore - bestScore) / Math.max(1, secondScore)));
    return { shift: bestShift, confidence };
  };

  const tick = () => {
    if (stopped) return;
    try {
      const current = luminance();
      if (current) {
        if (prev) {
          const { shift, confidence } = estimateShift(prev, current);
          if (Math.abs(shift) > 0 && confidence > 0.012) {
            const degPerPx = horizontalFov / width;
            heading = (heading - shift * degPerPx * 0.85 + 360) % 360;
          }
        }
        prev = current;
        const now = performance.now();
        if (now - lastEmit > 1000 / hz) {
          lastEmit = now;
          onHeading(heading);
        }
      }
    } catch {
      // Camera frames can transiently be unavailable during device flips.
    }
    timer = window.setTimeout(() => requestAnimationFrame(tick), 1000 / hz);
  };

  onHeading(heading);
  tick();

  return {
    source: "visual",
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
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
