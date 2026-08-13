// asherin.arvision — native frame intelligence.
//
// Models are enhancement, not a gate. Before any classifier loads, the room can
// already read the frame: luminance, motion against the previous frame, edge
// energy, and a coarse histogram. These are deterministic, cheap, and they run
// on the operator's own device — nothing leaves the tab.
//
// Kept pure and DOM-light so the sampling loop can be unit tested.

export interface FrameIntel {
  /** mean luma 0..1 */
  luma: number;
  /** mean absolute luma delta against the previous sample, 0..1 */
  motion: number;
  /** sobel-lite edge energy 0..1 */
  edges: number;
  /** 8-bucket luma histogram, normalised */
  histogram: number[];
  /** contrast proxy: spread of the histogram, 0..1 */
  contrast: number;
}

export const EMPTY_INTEL: FrameIntel = {
  luma: 0, motion: 0, edges: 0, histogram: new Array(8).fill(0), contrast: 0,
};

/**
 * Analyse one RGBA buffer. `previous` is the last grayscale buffer; pass null
 * on the first frame. Returns the intel plus the grayscale buffer to reuse, so
 * the caller never re-allocates per frame.
 */
export function analyseFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  previous: Float32Array | null,
): { intel: FrameIntel; gray: Float32Array } {
  const n = width * height;
  const gray = new Float32Array(n);

  let lumaSum = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    // Rec. 601 luma — cheap and stable across webcam white balance.
    const v = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
    gray[i] = v;
    lumaSum += v;
  }
  const luma = n ? lumaSum / n : 0;

  let motion = 0;
  if (previous && previous.length === n) {
    let acc = 0;
    for (let i = 0; i < n; i++) acc += Math.abs(gray[i] - previous[i]);
    motion = acc / n;
  }

  // Sobel-lite: horizontal + vertical first differences on the interior.
  let edgeAcc = 0;
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const gx = Math.abs(gray[i + 1] - gray[i - 1]);
      const gy = Math.abs(gray[i + width] - gray[i - width]);
      edgeAcc += Math.min(1, gx + gy);
      edgeCount++;
    }
  }
  const edges = edgeCount ? edgeAcc / edgeCount : 0;

  const histogram = new Array(8).fill(0);
  for (let i = 0; i < n; i++) {
    const b = Math.min(7, Math.floor(gray[i] * 8));
    histogram[b]++;
  }
  for (let b = 0; b < 8; b++) histogram[b] = n ? histogram[b] / n : 0;

  // Contrast proxy: how many buckets carry meaningful mass.
  const occupied = histogram.filter((h) => h > 0.02).length;
  const contrast = occupied / 8;

  return { intel: { luma, motion, edges, histogram, contrast }, gray };
}

/**
 * Visual-intel confidence ladder L1–L5. A scene geolocation claim needs at
 * least three independent visual votes; anything less is CANNOT_RESOLVE, and
 * device GNSS is never allowed to stand in for an indoor address.
 */
export type VisualLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export function visualLevel(votes: number): VisualLevel {
  if (votes >= 5) return "L5";
  if (votes >= 4) return "L4";
  if (votes >= 3) return "L3";
  if (votes >= 2) return "L2";
  return "L1";
}

export function sceneGeoVerdict(votes: number): "resolved" | "CANNOT_RESOLVE" {
  return votes >= 3 ? "resolved" : "CANNOT_RESOLVE";
}

/** Things this room refuses to fake. Printed in the UI, not buried. */
export const CANNOT_RESOLVE = [
  "thermal without a thermal camera",
  "seeing through walls with a visual sensor",
  "IFF — friend or foe from an image",
  "A2DP audio sniffing",
  "private ring / nvr feeds",
  "pixels on a stranger's laptop",
  "dmv owner records from a plate",
  "a stranger's name from their face",
];
