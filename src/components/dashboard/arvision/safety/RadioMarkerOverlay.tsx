// asherin.arvision — radio markers over the camera frame.
//
// A marker is drawn only when the geometry actually supports one: the camera
// pose is surveyed, its field of view is reported, and the radio estimate came
// from three calibrated receivers. Anything less renders as an edge indicator
// or as a plain line of text, never as a box that implies a fix.
//
// The box size is the projected uncertainty sphere, so a vague estimate looks
// vague. And every marker is labelled RADIO, because a radio is a device that
// was switched on, not a person.

import { projectToCamera, rangeOnlyNotice, type CameraPose } from "@/lib/arvision/ble/project";
import type { BleDeviceRecord } from "@/lib/arvision/ble/types";

const RadioMarkerOverlay = ({
  devices,
  pose,
  className = "",
}: {
  devices: BleDeviceRecord[];
  pose: CameraPose | null;
  className?: string;
}) => {
  if (!pose) {
    return (
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 ${className}`}>
        <p className="rounded-lg bg-black/60 px-2 py-1 text-[10px] font-light text-amber-100/70">
          radio markers unavailable: this camera has no surveyed pose in the site frame, so a radio estimate cannot be placed in the image.
        </p>
      </div>
    );
  }

  const live = devices.filter((d) => !d.stale);
  const rangeOnly = live.filter((d) => d.localization.mode === "range_only");

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {live.map((d) => {
        const loc = d.localization;
        if (loc.mode !== "multilateration" || !loc.position) return null;
        const p = projectToCamera(pose, loc.position, loc.uncertaintyM);
        if (p.state === "unavailable") return null;
        if (p.state === "off_screen") {
          return (
            <div
              key={d.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/50 bg-black/70 px-2 py-0.5 text-[9px] font-light text-sky-100/80"
              style={{ left: `${p.edgeX * 100}%`, top: `${p.edgeY * 100}%` }}
            >
              {p.offAxisDeg < 0 ? "◀" : "▶"} radio {d.knownLabel ?? d.handle} · {p.distanceM}m · {p.bearingDeg}°
            </div>
          );
        }
        const size = Math.max(6, p.radius * 100);
        return (
          <div
            key={d.key}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-sky-300/60 bg-sky-300/[0.06]"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${size}%`, aspectRatio: "1 / 1" }}
          >
            <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-light text-sky-100/85">
              radio · {d.knownLabel ?? d.handle} · {p.distanceM}m ±{d.localization.uncertaintyM}m
            </span>
          </div>
        );
      })}

      {rangeOnly.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
          {rangeOnly.slice(0, 3).map((d) => (
            <p key={d.key} className="rounded-lg bg-black/60 px-2 py-1 text-[10px] font-light text-white/60">
              radio {d.knownLabel ?? d.handle}: {rangeOnlyNotice(d.localization.rangeM ?? 0, d.localization.uncertaintyM)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default RadioMarkerOverlay;
