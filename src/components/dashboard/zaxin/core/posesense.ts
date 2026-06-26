// PoseSense — camera + heading fusion for the AR Bluetooth Vision overlay.
//
// We don't pretend to see through walls. We compute, per contact, a bearing
// estimate from the RSSI-gradient samples the tactical brain collected while
// the operator was walking. The UI then anchors a marker at that compass
// bearing relative to the current camera heading.

export type HeadingSource = "orientation" | "absolute" | "none";

export interface PoseStream {
  source: HeadingSource;
  stop: () => void;
}

/** Request DeviceOrientation, handling iOS permission gate. */
export async function startHeadingStream(onHeading: (deg: number) => void): Promise<PoseStream> {
  const w = window as any;
  // iOS Safari requires an explicit permission request from a user gesture
  if (typeof w.DeviceOrientationEvent?.requestPermission === "function") {
    try {
      const res = await w.DeviceOrientationEvent.requestPermission();
      if (res !== "granted") throw new Error("Orientation permission denied.");
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  let source: HeadingSource = "orientation";
  const handler = (ev: any) => {
    let heading: number | null = null;
    if (typeof ev.webkitCompassHeading === "number") {
      // iOS: 0 = north, increases clockwise — already what we want
      heading = ev.webkitCompassHeading;
      source = "absolute";
    } else if (ev.absolute && typeof ev.alpha === "number") {
      heading = (360 - ev.alpha) % 360;
      source = "absolute";
    } else if (typeof ev.alpha === "number") {
      heading = (360 - ev.alpha) % 360;
    }
    if (heading != null && isFinite(heading)) onHeading(heading);
  };

  const evtName =
    typeof w.DeviceOrientationEvent !== "undefined" && "ondeviceorientationabsolute" in w
      ? "deviceorientationabsolute"
      : "deviceorientation";
  window.addEventListener(evtName, handler, true);

  return {
    source,
    stop: () => window.removeEventListener(evtName, handler, true),
  };
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
  let d = ((target - current + 540) % 360) - 180;
  return d;
}
