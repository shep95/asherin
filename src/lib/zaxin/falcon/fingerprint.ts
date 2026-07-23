// Zaxin Falcon — Vehicle Fingerprint (color + body class)
// --------------------------------------------------------
// Extracts a "vehicle fingerprint" — dominant color name + body class — from
// a cropped bbox. Runs 100% on-device (2D canvas pixel sample).
//
// Color naming uses HSL buckets: hue rings → named color, low-saturation →
// grayscale (white/silver/gray/black). Sampled from the CENTER 60% of the
// bbox to avoid road/sky pixels bleeding in.

export type BodyClass = "sedan" | "suv" | "truck" | "van" | "motorcycle" | "bicycle" | "bus" | "unknown";

export interface VehicleFingerprint {
  colorName: string;      // "red" | "blue" | "white" | "black" | "silver" | "gray" | ...
  hex: string;            // dominant hex swatch
  bodyClass: BodyClass;
  ts: number;
}

/** Crop the video frame to the bbox and sample K pixels; returns dominant RGB. */
function sampleDominant(ctx: CanvasRenderingContext2D, w: number, h: number): { r: number; g: number; b: number } {
  const data = ctx.getImageData(0, 0, w, h).data;
  // 64-bucket histogram in RGB space (4 bits per channel — 4^3 = 64 buckets)
  const buckets = new Uint32Array(64);
  const rSum = new Uint32Array(64), gSum = new Uint32Array(64), bSum = new Uint32Array(64);
  for (let i = 0; i < data.length; i += 16) { // stride 4 pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    buckets[key]++; rSum[key] += r; gSum[key] += g; bSum[key] += b;
  }
  let best = 0;
  for (let k = 1; k < 64; k++) if (buckets[k] > buckets[best]) best = k;
  const n = Math.max(1, buckets[best]);
  return { r: rSum[best] / n, g: gSum[best] / n, b: bSum[best] / n };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
  let h = 0;
  switch (max) {
    case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
    case G: h = ((B - R) / d + 2); break;
    default: h = ((R - G) / d + 4);
  }
  return { h: (h * 60) % 360, s, l };
}

function nameColor(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l < 0.14) return "black";
  if (s < 0.10) {
    if (l > 0.82) return "white";
    if (l > 0.55) return "silver";
    return "gray";
  }
  // Chromatic buckets
  if (h < 15 || h >= 345) return "red";
  if (h < 40)  return "orange";
  if (h < 65)  return "yellow";
  if (h < 90)  return "yellow-green";
  if (h < 165) return "green";
  if (h < 195) return "teal";
  if (h < 250) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

function inferBodyClass(label: string, aspectRatio: number): BodyClass {
  const lab = label.toLowerCase();
  if (lab === "motorcycle") return "motorcycle";
  if (lab === "bicycle")    return "bicycle";
  if (lab === "bus")        return "bus";
  if (lab === "truck") {
    // Cargo trucks are boxier + wider; pickups are more square
    return aspectRatio > 2.2 ? "truck" : "van";
  }
  if (lab === "car") {
    if (aspectRatio > 2.4) return "sedan";
    if (aspectRatio > 1.8) return "sedan";
    return "suv";
  }
  return "unknown";
}

/** Extract a fingerprint from a video frame + bbox (normalized 0..1). */
export function fingerprintBbox(
  video: HTMLVideoElement,
  bbox: { x: number; y: number; w: number; h: number },
  label: string,
): VehicleFingerprint | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  // Sample the center 60% of the bbox to avoid road/sky pixels.
  const insetX = bbox.w * 0.20, insetY = bbox.h * 0.20;
  const px = Math.max(0, Math.round((bbox.x + insetX) * vw));
  const py = Math.max(0, Math.round((bbox.y + insetY) * vh));
  const pw = Math.max(4, Math.round((bbox.w - 2 * insetX) * vw));
  const ph = Math.max(4, Math.round((bbox.h - 2 * insetY) * vh));
  const c = document.createElement("canvas");
  const targetW = Math.min(96, pw), targetH = Math.min(96, ph);
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(video, px, py, pw, ph, 0, 0, targetW, targetH);
  } catch { return null; }
  const dom = sampleDominant(ctx, targetW, targetH);
  const aspect = (bbox.w * vw) / Math.max(1, bbox.h * vh);
  return {
    colorName: nameColor(dom.r, dom.g, dom.b),
    hex: rgbToHex(dom.r, dom.g, dom.b),
    bodyClass: inferBodyClass(label, aspect),
    ts: Date.now(),
  };
}
