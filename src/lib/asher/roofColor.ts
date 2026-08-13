/**
 * Roof colour vote from one public satellite tile.
 *
 * This is a single Esri World Imagery z18 tile read through a canvas: we take
 * the pixels immediately around the parcel point, convert to HSV and vote a
 * coarse class. It is ONE tile, at one date, at ~0.6 m/px — good enough to say
 * "the roof reads red" and never good enough to be evidence. Every caller must
 * print the unsure tag with it.
 *
 * A tainted or missing tile is a gap, never a guess.
 */

export interface RoofColorVote {
  klass: "red" | "blue" | "grey" | "dark" | "light" | "green" | "brown";
  confidence: number; // share of sampled pixels in the winning class
  note: string;
}

const TILE = 256;

function lonToTileX(lng: number, z: number) { return ((lng + 180) / 360) * 2 ** z; }
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

function classify(r: number, g: number, b: number): RoofColorVote["klass"] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
    else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
    else h = 60 * ((r - g) / (max - min)) + 240;
  }
  if (v < 0.18) return "dark";
  if (s < 0.14) return v > 0.72 ? "light" : "grey";
  if (h < 20 || h >= 340) return "red";
  if (h < 45) return "brown";
  if (h < 70) return "light";
  if (h < 170) return "green";
  if (h < 265) return "blue";
  return "red";
}

/**
 * Sample the imagery tile under a point. Returns null when the tile is
 * unavailable or the canvas read is blocked — the caller prints a gap.
 */
export async function sampleRoofColor(lat: number, lng: number, z = 18): Promise<RoofColorVote | null> {
  const fx = lonToTileX(lng, z), fy = latToTileY(lat, z);
  const x = Math.floor(fx), y = Math.floor(fy);
  const px = Math.floor((fx - x) * TILE), py = Math.floor((fy - y) * TILE);
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 8000);
    el.onload = () => { window.clearTimeout(timer); resolve(el); };
    el.onerror = () => { window.clearTimeout(timer); resolve(null); };
    el.src = url;
  });
  if (!img) return null;

  try {
    const c = document.createElement("canvas");
    c.width = TILE; c.height = TILE;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, TILE, TILE);
    /* ~9 m box around the point: a rooftop at z18, not the whole block. */
    const half = 7;
    const sx = Math.max(0, px - half), sy = Math.max(0, py - half);
    const w = Math.min(TILE - sx, half * 2), h = Math.min(TILE - sy, half * 2);
    const data = ctx.getImageData(sx, sy, Math.max(1, w), Math.max(1, h)).data;

    const votes = new Map<RoofColorVote["klass"], number>();
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const k = classify(data[i], data[i + 1], data[i + 2]);
      votes.set(k, (votes.get(k) ?? 0) + 1);
      n++;
    }
    if (!n) return null;
    const [klass, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      klass,
      confidence: count / n,
      note: "one Esri World Imagery z18 tile vote — this is unsure",
    };
  } catch {
    /* Canvas tainted by CORS: an honest gap, not a fabricated colour. */
    return null;
  }
}
