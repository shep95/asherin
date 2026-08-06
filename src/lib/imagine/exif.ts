/**
 * IMAGINE INTELLIGENCE — STAGE 1: STRIP
 *
 * Dependency-free client-side EXIF reader for JPEG (APP1/TIFF) images.
 * Extracts only the observables that matter to geolocation adjudication:
 * GPS fix, capture timestamp, camera identity, orientation and lens focal
 * length. Everything is read from an ArrayBuffer in the browser — the raw
 * bytes never leave the device except as the already-uploaded image.
 *
 * Provenance note (9.2): every field returned here cites `source: "exif"`,
 * so the adjudicator can weigh hard metadata above model inference and the
 * UI can render the distinction honestly.
 */

export interface ExifGps {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  /** Reported horizontal positioning error in metres, when the device wrote it. */
  hPositioningErrorMeters?: number;
}

export interface ExifFacts {
  gps?: ExifGps;
  /** EXIF DateTimeOriginal, normalised to "YYYY-MM-DDTHH:mm:ss" (camera-local, no zone). */
  capturedAtLocal?: string;
  /** GPSDateStamp + GPSTimeStamp fused into a true UTC ISO string when present. */
  capturedAtUtc?: string;
  make?: string;
  model?: string;
  software?: string;
  orientation?: number;
  focalLengthMm?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  /** True when the file carried an APP1/EXIF block at all (absence is itself a signal). */
  hasExif: boolean;
  /** Human-readable notes for the evidence ledger. */
  notes: string[];
}

const TAG = {
  ORIENTATION: 0x0112,
  MAKE: 0x010f,
  MODEL: 0x0110,
  SOFTWARE: 0x0131,
  EXIF_IFD: 0x8769,
  GPS_IFD: 0x8825,
  DATETIME_ORIGINAL: 0x9003,
  FOCAL_LENGTH: 0x920a,
  PIXEL_X: 0xa002,
  PIXEL_Y: 0xa003,
} as const;

const GPS = {
  LAT_REF: 0x0001,
  LAT: 0x0002,
  LON_REF: 0x0003,
  LON: 0x0004,
  ALT_REF: 0x0005,
  ALT: 0x0006,
  TIME: 0x0007,
  DATE: 0x001d,
  H_ERROR: 0x001f,
} as const;

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Entry {
  type: number;
  count: number;
  valueOffset: number;
}

function readEntries(view: DataView, ifdOffset: number, tiffStart: number, le: boolean): Map<number, Entry> {
  const out = new Map<number, Entry>();
  // Guard: a corrupt offset must not throw — bounded read only. (bug-class: OOB)
  if (ifdOffset + 2 > view.byteLength) return out;
  const count = view.getUint16(ifdOffset, le);
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, le);
    const type = view.getUint16(entry + 2, le);
    const num = view.getUint32(entry + 4, le);
    const size = (TYPE_SIZE[type] || 0) * num;
    const valueOffset = size > 4 ? tiffStart + view.getUint32(entry + 8, le) : entry + 8;
    out.set(tag, { type, count: num, valueOffset });
  }
  return out;
}

function readValues(view: DataView, e: Entry, le: boolean): number[] {
  const vals: number[] = [];
  const unit = TYPE_SIZE[e.type] || 0;
  for (let i = 0; i < e.count; i++) {
    const at = e.valueOffset + i * unit;
    if (at + unit > view.byteLength) break;
    switch (e.type) {
      case 1: case 7: vals.push(view.getUint8(at)); break;
      case 3: vals.push(view.getUint16(at, le)); break;
      case 4: vals.push(view.getUint32(at, le)); break;
      case 5: {
        const n = view.getUint32(at, le);
        const d = view.getUint32(at + 4, le);
        vals.push(d === 0 ? 0 : n / d);
        break;
      }
      case 9: vals.push(view.getInt32(at, le)); break;
      case 10: {
        const n = view.getInt32(at, le);
        const d = view.getInt32(at + 4, le);
        vals.push(d === 0 ? 0 : n / d);
        break;
      }
      default: break;
    }
  }
  return vals;
}

function readAscii(view: DataView, e: Entry): string {
  let s = "";
  for (let i = 0; i < e.count; i++) {
    const at = e.valueOffset + i;
    if (at >= view.byteLength) break;
    const c = view.getUint8(at);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

function dms(parts: number[], ref: string): number | undefined {
  if (parts.length < 3) return undefined;
  const [d, m, s] = parts;
  const val = d + m / 60 + s / 3600;
  if (!Number.isFinite(val)) return undefined;
  const neg = ref === "S" || ref === "W";
  return neg ? -val : val;
}

/** Locate the APP1 EXIF segment inside a JPEG byte stream. Returns TIFF header offset. */
function findTiffStart(view: DataView): number | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) { offset++; continue; }
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xda) return null; // start of scan — no EXIF found
    const len = view.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 10 < view.byteLength) {
      // "Exif\0\0"
      if (
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0x0000
      ) {
        return offset + 10;
      }
    }
    if (len < 2) return null;
    offset += 2 + len;
  }
  return null;
}

function normaliseDateTime(raw: string): string | undefined {
  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

/**
 * Parse EXIF facts from an image File. Never throws — a malformed or
 * EXIF-free file yields `{ hasExif: false }` with an explanatory note.
 */
export async function extractExifFacts(file: File): Promise<ExifFacts> {
  const facts: ExifFacts = { hasExif: false, notes: [] };
  try {
    if (!/^image\/(jpeg|jpg|tiff)$/i.test(file.type)) {
      facts.notes.push(`No EXIF container expected for ${file.type || "unknown type"} — metadata layer unavailable.`);
      return facts;
    }
    // Header slice is enough: EXIF lives in the first APP segments.
    const buf = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
    const view = new DataView(buf);
    const tiffStart = findTiffStart(view);
    if (tiffStart === null) {
      facts.notes.push("JPEG carries no APP1/EXIF block — metadata stripped by the platform that produced this file.");
      return facts;
    }
    const byteOrder = view.getUint16(tiffStart);
    const le = byteOrder === 0x4949;
    if (!le && byteOrder !== 0x4d4d) {
      facts.notes.push("EXIF byte-order marker unreadable — metadata layer discarded.");
      return facts;
    }
    facts.hasExif = true;

    const ifd0Offset = tiffStart + view.getUint32(tiffStart + 4, le);
    const ifd0 = readEntries(view, ifd0Offset, tiffStart, le);

    const makeE = ifd0.get(TAG.MAKE); if (makeE) facts.make = readAscii(view, makeE) || undefined;
    const modelE = ifd0.get(TAG.MODEL); if (modelE) facts.model = readAscii(view, modelE) || undefined;
    const swE = ifd0.get(TAG.SOFTWARE); if (swE) facts.software = readAscii(view, swE) || undefined;
    const orE = ifd0.get(TAG.ORIENTATION); if (orE) facts.orientation = readValues(view, orE, le)[0];

    const exifPtr = ifd0.get(TAG.EXIF_IFD);
    if (exifPtr) {
      const sub = readEntries(view, tiffStart + readValues(view, exifPtr, le)[0], tiffStart, le);
      const dtE = sub.get(TAG.DATETIME_ORIGINAL);
      if (dtE) facts.capturedAtLocal = normaliseDateTime(readAscii(view, dtE));
      const flE = sub.get(TAG.FOCAL_LENGTH);
      if (flE) facts.focalLengthMm = Math.round(readValues(view, flE, le)[0] * 10) / 10;
      const pxE = sub.get(TAG.PIXEL_X); if (pxE) facts.pixelWidth = readValues(view, pxE, le)[0];
      const pyE = sub.get(TAG.PIXEL_Y); if (pyE) facts.pixelHeight = readValues(view, pyE, le)[0];
    }

    const gpsPtr = ifd0.get(TAG.GPS_IFD);
    if (gpsPtr) {
      const g = readEntries(view, tiffStart + readValues(view, gpsPtr, le)[0], tiffStart, le);
      const latE = g.get(GPS.LAT), lonE = g.get(GPS.LON);
      const latRefE = g.get(GPS.LAT_REF), lonRefE = g.get(GPS.LON_REF);
      if (latE && lonE && latRefE && lonRefE) {
        const lat = dms(readValues(view, latE, le), readAscii(view, latRefE));
        const lon = dms(readValues(view, lonE, le), readAscii(view, lonRefE));
        if (
          typeof lat === "number" && typeof lon === "number" &&
          Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
          !(lat === 0 && lon === 0) // null-island guard: a 0/0 fix is a device default, not a location
        ) {
          facts.gps = { latitude: lat, longitude: lon };
          const altE = g.get(GPS.ALT);
          if (altE) {
            const altRefE = g.get(GPS.ALT_REF);
            const below = altRefE ? readValues(view, altRefE, le)[0] === 1 : false;
            const alt = readValues(view, altE, le)[0];
            if (Number.isFinite(alt)) facts.gps.altitudeMeters = Math.round(below ? -alt : alt);
          }
          const errE = g.get(GPS.H_ERROR);
          if (errE) {
            const err = readValues(view, errE, le)[0];
            if (Number.isFinite(err) && err > 0) facts.gps.hPositioningErrorMeters = Math.round(err);
          }
        }
      }
      const dateE = g.get(GPS.DATE), timeE = g.get(GPS.TIME);
      if (dateE && timeE) {
        const d = readAscii(view, dateE).replace(/:/g, "-");
        const t = readValues(view, timeE, le);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && t.length >= 3) {
          const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
          facts.capturedAtUtc = `${d}T${pad(t[0])}:${pad(t[1])}:${pad(t[2])}Z`;
        }
      }
    }

    if (facts.gps) facts.notes.push("Hard GPS fix present in EXIF — treated as ground truth, model inference is used only for corroboration.");
    else facts.notes.push("EXIF present but carries no GPS fix — location must be derived from image content.");
    if (facts.software && /photoshop|gimp|lightroom|snapseed|topaz/i.test(facts.software)) {
      facts.notes.push(`Editing software signature "${facts.software}" — pixel content may be altered; weight scene evidence accordingly.`);
    }
  } catch {
    facts.notes.push("EXIF parse aborted on malformed metadata — proceeding with content-only analysis.");
  }
  return facts;
}
