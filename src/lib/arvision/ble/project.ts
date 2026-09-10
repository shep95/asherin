// asherin.arvision — spatial registration of a radio estimate into the camera.
//
// A radio estimate lives in the site's metric frame. The camera lives at a
// surveyed pose inside that same frame. Registration is the transform between
// them, and it exists only when the camera pose and its horizontal field of
// view are both actually known. An uncalibrated lens gets no marker, because a
// marker drawn from an assumed field of view is a drawing, not a measurement.
//
// The output distinguishes three cases the overlay must render differently:
//   on screen      -> a box whose size is the projected uncertainty sphere
//   off screen     -> an edge indicator carrying a bearing, never a box
//   unprojectable  -> nothing, plus the reason

export interface CameraPose {
  /** metres in the site frame. */
  position: { x: number; y: number; z: number };
  /** degrees, clockwise from +y (site north). */
  yawDeg: number;
  /** degrees, positive up. */
  pitchDeg: number;
  /** measured horizontal field of view. null when the lens never reported one. */
  hfovDeg: number | null;
  aspect: number;
  /** how the pose was established, printed verbatim in the panel. */
  source: string;
}

export type Projection =
  | {
      state: "on_screen";
      /** normalised 0..1 image coordinates. */
      x: number;
      y: number;
      /** normalised radius of the projected uncertainty sphere. */
      radius: number;
      distanceM: number;
      bearingDeg: number;
    }
  | {
      state: "off_screen";
      /** where on the frame edge the indicator sits, normalised 0..1. */
      edgeX: number;
      edgeY: number;
      bearingDeg: number;
      /** signed degrees off the camera axis; negative is left. */
      offAxisDeg: number;
      distanceM: number;
    }
  | { state: "unavailable"; reason: string };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function projectToCamera(
  pose: CameraPose,
  point: { x: number; y: number; z: number },
  uncertaintyM: number | null,
): Projection {
  if (pose.hfovDeg === null) {
    return {
      state: "unavailable",
      reason: "this camera never reported a focal length, so no field of view is known and no marker may be placed in the frame",
    };
  }
  const dx = point.x - pose.position.x;
  const dy = point.y - pose.position.y;
  const dz = point.z - pose.position.z;
  const ground = Math.hypot(dx, dy);
  const distanceM = Math.hypot(ground, dz);
  if (distanceM < 0.05) {
    return { state: "unavailable", reason: "the estimate coincides with the camera position, which is not a placeable result" };
  }

  const bearingDeg = (deg(Math.atan2(dx, dy)) + 360) % 360;
  let offAxis = bearingDeg - pose.yawDeg;
  while (offAxis > 180) offAxis -= 360;
  while (offAxis < -180) offAxis += 360;

  const halfH = pose.hfovDeg / 2;
  const vfov = 2 * deg(Math.atan(Math.tan(rad(halfH)) / Math.max(0.2, pose.aspect)));
  const elevation = deg(Math.atan2(dz, ground)) - pose.pitchDeg;

  if (Math.abs(offAxis) > halfH || Math.abs(elevation) > vfov / 2) {
    const t = Math.max(-1, Math.min(1, offAxis / 90));
    const v = Math.max(-1, Math.min(1, elevation / 90));
    return {
      state: "off_screen",
      edgeX: 0.5 + t * 0.5,
      edgeY: 0.5 - v * 0.5,
      bearingDeg: Math.round(bearingDeg),
      offAxisDeg: Math.round(offAxis),
      distanceM: Math.round(distanceM * 10) / 10,
    };
  }

  const x = 0.5 + Math.tan(rad(offAxis)) / (2 * Math.tan(rad(halfH)));
  const y = 0.5 - Math.tan(rad(elevation)) / (2 * Math.tan(rad(vfov / 2)));
  const u = uncertaintyM ?? 0;
  const angularRadius = deg(Math.atan(u / distanceM));
  const radius = Math.max(0.02, angularRadius / Math.max(1, pose.hfovDeg));

  return {
    state: "on_screen",
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    radius: Math.min(0.6, radius),
    distanceM: Math.round(distanceM * 10) / 10,
    bearingDeg: Math.round(bearingDeg),
  };
}

/** Range-only estimates get a ring on the map, never a box in the frame. */
export function rangeOnlyNotice(rangeM: number, uncertaintyM: number | null): string {
  return `radio detected at roughly ${rangeM}m${uncertaintyM ? ` ±${uncertaintyM}m` : ""} from the receiver. direction is unknown, so this device cannot be placed in the camera frame.`;
}
