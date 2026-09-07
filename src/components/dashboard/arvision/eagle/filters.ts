// eagle.eye — frame filters.
//
// every variant here is a *rendering* of the same captured pixels, never a new
// measurement. the thermal variant maps visible-light luminance through an iron
// palette: it is a contrast reading, not an infrared temperature reading, and
// the evidence manifest says so in words. the low-light variant applies gain and
// gamma to pixels that were actually captured — it does not hallucinate detail.
// the edge variant is a sobel pass used to make posture and carried-object
// outlines legible in a printed report.

export type FilterMode = "clean" | "thermal" | "lowlight" | "edge";

export const FILTER_MODES: Array<{ id: FilterMode; label: string; note: string }> = [
  { id: "clean", label: "clean", note: "unmodified captured frame" },
  { id: "thermal", label: "thermal map", note: "visible-light luminance mapped to an iron palette — not an infrared temperature reading" },
  { id: "lowlight", label: "low light", note: "gain and gamma lift on the captured pixels — no detail is invented" },
  { id: "edge", label: "edge trace", note: "sobel outline pass for posture and carried-object legibility in print" },
];

/** 256-entry iron palette, r,g,b triplets. built once. */
const IRON: Uint8ClampedArray = (() => {
  const stops: Array<[number, number, number, number]> = [
    [0.0, 0, 0, 12],
    [0.22, 42, 0, 92],
    [0.42, 138, 20, 108],
    [0.6, 214, 66, 52],
    [0.78, 246, 152, 18],
    [0.92, 254, 226, 92],
    [1.0, 255, 255, 246],
  ];
  const out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const k = (t - a[0]) / span;
    out[i * 3] = a[1] + (b[1] - a[1]) * k;
    out[i * 3 + 1] = a[2] + (b[2] - a[2]) * k;
    out[i * 3 + 2] = a[3] + (b[3] - a[3]) * k;
  }
  return out;
})();

function luma(r: number, g: number, b: number): number {
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) | 0;
}

/** iron-palette map of per-pixel luminance, auto-levelled across the frame. */
export function applyThermal(src: ImageData): ImageData {
  const d = src.data;
  const n = d.length;
  let lo = 255;
  let hi = 0;
  const lum = new Uint8ClampedArray(n / 4);
  for (let p = 0, i = 0; p < n; p += 4, i++) {
    const v = luma(d[p], d[p + 1], d[p + 2]);
    lum[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  const out = new ImageData(src.width, src.height);
  const o = out.data;
  for (let p = 0, i = 0; p < n; p += 4, i++) {
    const v = (((lum[i] - lo) * 255) / span) | 0;
    const c = (v < 0 ? 0 : v > 255 ? 255 : v) * 3;
    o[p] = IRON[c];
    o[p + 1] = IRON[c + 1];
    o[p + 2] = IRON[c + 2];
    o[p + 3] = 255;
  }
  return out;
}

/** gain + gamma lift, weighted toward the green channel the sensor reads best. */
export function applyLowLight(src: ImageData, gain = 2.1, gamma = 0.62): ImageData {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.min(255, 255 * Math.pow(Math.min(1, (i / 255) * gain), gamma));
  }
  const out = new ImageData(src.width, src.height);
  const d = src.data;
  const o = out.data;
  for (let p = 0; p < d.length; p += 4) {
    const v = lut[luma(d[p], d[p + 1], d[p + 2])];
    o[p] = v * 0.32;
    o[p + 1] = v;
    o[p + 2] = v * 0.38;
    o[p + 3] = 255;
  }
  return out;
}

/** sobel magnitude, inverted to dark-on-light so it survives printing. */
export function applyEdge(src: ImageData): ImageData {
  const { width: w, height: h } = src;
  const d = src.data;
  const gray = new Float32Array(w * h);
  for (let p = 0, i = 0; p < d.length; p += 4, i++) gray[i] = luma(d[p], d[p + 1], d[p + 2]);
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 255;
        o[i * 4 + 3] = 255;
        continue;
      }
      const tl = gray[i - w - 1], t = gray[i - w], tr = gray[i - w + 1];
      const l = gray[i - 1], r = gray[i + 1];
      const bl = gray[i + w - 1], b = gray[i + w], br = gray[i + w + 1];
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const m = Math.min(255, Math.hypot(gx, gy));
      const v = 255 - m;
      o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v;
      o[i * 4 + 3] = 255;
    }
  }
  return out;
}

export function applyFilter(src: ImageData, mode: FilterMode): ImageData {
  switch (mode) {
    case "thermal": return applyThermal(src);
    case "lowlight": return applyLowLight(src);
    case "edge": return applyEdge(src);
    default: return src;
  }
}

/** draw a source (video or canvas) into a fresh canvas at a bounded size. */
export function grabCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxWidth = 1280,
): HTMLCanvasElement {
  const scale = width > maxWidth ? maxWidth / width : 1;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width * scale));
  c.height = Math.max(1, Math.round(height * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (ctx) ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export function filteredCanvas(base: HTMLCanvasElement, mode: FilterMode): HTMLCanvasElement {
  if (mode === "clean") return base;
  const ctx = base.getContext("2d", { willReadFrequently: true });
  if (!ctx) return base;
  const out = document.createElement("canvas");
  out.width = base.width;
  out.height = base.height;
  const octx = out.getContext("2d");
  if (!octx) return base;
  octx.putImageData(applyFilter(ctx.getImageData(0, 0, base.width, base.height), mode), 0, 0);
  return out;
}
