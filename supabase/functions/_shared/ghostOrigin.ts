// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — ORIGIN TRACE ("where did this file come from?")
//
// The sweep answers "what is on this host". This module answers a different
// question: given ONE link — usually a PDF someone emailed you — reconstruct
// the act of authorship behind it.
//
//   WHEN  — the authoring wall-clock, the UTC instant it maps to, and the raw
//           UTC offset the authoring machine was configured to. A PDF date is
//           `D:20240115143005-05'00'`; throwing away the `-05'00'` (as the
//           sweep extractor does, by design, for indexing) destroys the single
//           most locating field in the whole document.
//   WHERE — three independent geographies that must never be conflated:
//             1. authoring zone   (from the offset, corroborated against DST)
//             2. capture point    (EXIF GPS — the only true coordinate)
//             3. serving origin   (the CDN edge / host IP — NOT the author)
//   WHO   — producer/creator toolchain, author string, hardware, org fields,
//           and the revision lineage (DocumentID vs InstanceID, mod delta).
//
// Every claim carries its evidence field and a confidence. Nothing is inferred
// silently: if the document was scrubbed, the trace says it was scrubbed.
// ─────────────────────────────────────────────────────────────────────────────

import { isPublicHttpUrl, parseExif, sha256Hex } from "./ghostMetadata.ts";
import { pdfToText } from "./ghostBuffer.ts";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Documents are read whole here — provenance lives in the trailer, not the head. */
const MAX_DOC_BYTES = 12 * 1024 * 1024;
const FETCH_MS = 25_000;
const MAX_HOPS = 6;

export interface OriginClaim {
  /** What is being asserted. */
  label: string;
  value: string;
  /** The exact field the assertion was carved out of. */
  evidence: string;
  confidence: "confirmed" | "strong" | "probable" | "weak";
}

export interface OriginTimestamp {
  /** Which field produced it (`pdf:CreationDate`, `exif:DateTimeOriginal`, …). */
  field: string;
  /** Wall clock as the authoring machine wrote it, e.g. "2024-01-15 14:30:05". */
  local: string | null;
  /** Absolute instant, when the offset is known or the field is zone-anchored. */
  utc: string | null;
  /** Minutes east of UTC. Null when the field carried no zone at all. */
  offsetMinutes: number | null;
  /** "-05:00" / "Z" / null. */
  offsetLabel: string | null;
  raw: string;
}

export interface OriginPlace {
  kind: "capture" | "authoring-zone" | "serving-origin" | "stated";
  label: string;
  detail: string | null;
  lat: number | null;
  lng: number | null;
  /** Reverse-geocoded structure when coordinates were real. */
  building: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postcode: string | null;
  source: string;
  confidence: OriginClaim["confidence"];
}

export interface OriginTrace {
  url: string;
  final_url: string;
  host: string;
  status: number | null;
  content_type: string;
  kind: "pdf" | "image" | "html" | "office" | "other";
  bytes: number | null;
  sha256: string | null;
  redirect_chain: string[];
  fetched_at: string;

  created: OriginTimestamp | null;
  modified: OriginTimestamp | null;
  timestamps: OriginTimestamp[];
  /** IANA zones whose offset matched the authoring offset at that instant. */
  zone_candidates: string[];
  /** Working-hours read on the authoring wall clock. */
  work_pattern: string | null;

  places: OriginPlace[];
  claims: OriginClaim[];
  toolchain: { producer: string | null; creator: string | null; device: string | null; os: string | null };
  identity: { author: string | null; company: string | null; title: string | null; subject: string | null; keywords: string | null };
  lineage: {
    document_id: string | null;
    instance_id: string | null;
    original_document_id: string | null;
    /** Minutes between creation and last save. */
    edit_span_minutes: number | null;
    revisions: string[];
  };
  serving: {
    server: string | null;
    powered_by: string | null;
    last_modified: string | null;
    cdn_pop: string | null;
    ip: string | null;
    asn: string | null;
    ip_place: string | null;
  };
  /** Selectors carved out of the artefact itself — pivotable, not decorative. */
  selectors: {
    emails: string[];
    phones: string[];
    urls: string[];
    hosts: string[];
    handles: string[];
    people: string[];
    places: string[];
    ids: string[];
  };
  /** Set when the artefact was uploaded rather than fetched. */
  upload: { filename: string; declared_type: string } | null;
  raw_fields: Record<string, string>;
  scrubbed: boolean;
  notes: string[];
  errors: string[];
  elapsed_ms: number;
}


// ── transport ────────────────────────────────────────────────────────────────

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, redirect: "manual" });
  } finally { clearTimeout(t); }
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  const out = new Uint8Array(Math.min(total, cap));
  let off = 0;
  for (const c of chunks) {
    if (off >= out.length) break;
    out.set(c.subarray(0, out.length - off), off);
    off += c.length;
  }
  return out;
}

// ── PDF field carving ────────────────────────────────────────────────────────

/** PDF literal string `(…)` with escapes, or hex string `<…>` (UTF-16BE aware). */
function decodePdfString(raw: string, hex: boolean): string {
  if (hex) {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "");
    const bytes: number[] = [];
    for (let i = 0; i + 1 < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let s = "";
      for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      return s;
    }
    return bytes.map((b) => String.fromCharCode(b)).join("");
  }
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      const n = raw[++i];
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n >= "0" && n <= "7") {
        let oct = n;
        while (oct.length < 3 && raw[i + 1] >= "0" && raw[i + 1] <= "7") oct += raw[++i];
        out += String.fromCharCode(parseInt(oct, 8));
      } else out += n ?? "";
    } else out += c;
  }
  // UTF-16BE literal strings are legal too.
  if (out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    let s = "";
    for (let i = 2; i + 1 < out.length; i += 2) s += String.fromCharCode((out.charCodeAt(i) << 8) | out.charCodeAt(i + 1));
    return s;
  }
  return out;
}

function pdfField(text: string, key: string): string | null {
  // Literal form first, then hex form. Last occurrence wins: incremental
  // updates append, so the newest Info dictionary is the tail one.
  const lit = [...text.matchAll(new RegExp(`/${key}\\s*\\(((?:\\\\.|[^\\\\()]){0,600})\\)`, "g"))];
  if (lit.length) return decodePdfString(lit[lit.length - 1][1], false).trim().slice(0, 400) || null;
  const hx = [...text.matchAll(new RegExp(`/${key}\\s*<([0-9a-fA-F\\s]{2,1200})>`, "g"))];
  if (hx.length) return decodePdfString(hx[hx.length - 1][1], true).trim().slice(0, 400) || null;
  return null;
}

function xmpField(text: string, tag: string): string | null {
  const el = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]{0,600}?)</${tag}>`));
  if (el?.[1]) {
    const inner = el[1].match(/<rdf:li[^>]*>([\s\S]{0,400}?)<\/rdf:li>/)?.[1] ?? el[1];
    const v = inner.replace(/<[^>]+>/g, "").trim();
    if (v) return v.slice(0, 400);
  }
  const attr = text.match(new RegExp(`${tag}\\s*=\\s*"([^"]{1,400})"`));
  return attr?.[1]?.trim() || null;
}

// ── time ─────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `D:YYYYMMDDHHmmSS+HH'mm'` — the offset is the payload, not decoration.
 * A bare date (no offset) is reported as zone-less rather than pretended UTC.
 */
function parsePdfDate(raw: string, field: string): OriginTimestamp | null {
  const m = raw.match(/^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?\d{0,2}'?)?/);
  if (!m) return null;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00", zRaw] = m;
  const local = `${y}-${mo}-${d} ${h}:${mi}:${s}`;

  let offsetMinutes: number | null = null;
  let offsetLabel: string | null = null;
  if (zRaw === "Z") { offsetMinutes = 0; offsetLabel = "Z"; }
  else if (zRaw) {
    const zm = zRaw.match(/([+-])(\d{2})'?(\d{2})?/);
    if (zm) {
      const sign = zm[1] === "-" ? -1 : 1;
      offsetMinutes = sign * (parseInt(zm[2], 10) * 60 + parseInt(zm[3] ?? "0", 10));
      offsetLabel = `${zm[1]}${zm[2]}:${zm[3] ?? "00"}`;
    }
  }

  let utc: string | null = null;
  if (offsetMinutes !== null) {
    const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - offsetMinutes * 60_000;
    if (!Number.isNaN(t)) utc = new Date(t).toISOString();
  }
  return { field, local, utc, offsetMinutes, offsetLabel, raw };
}

/** ISO-8601 as XMP writes it (`2024-01-15T14:30:05-05:00`). */
function parseIsoStamp(raw: string, field: string): OriginTimestamp | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00", zRaw] = m;
  let offsetMinutes: number | null = null;
  let offsetLabel: string | null = null;
  if (zRaw === "Z") { offsetMinutes = 0; offsetLabel = "Z"; }
  else if (zRaw) {
    const zm = zRaw.match(/([+-])(\d{2}):?(\d{2})/);
    if (zm) {
      const sign = zm[1] === "-" ? -1 : 1;
      offsetMinutes = sign * (parseInt(zm[2], 10) * 60 + parseInt(zm[3], 10));
      offsetLabel = `${zm[1]}${zm[2]}:${zm[3]}`;
    }
  }
  let utc: string | null = null;
  if (offsetMinutes !== null) {
    const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - offsetMinutes * 60_000;
    if (!Number.isNaN(t)) utc = new Date(t).toISOString();
  }
  return { field, local: `${y}-${mo}-${d} ${h}:${mi}:${s}`, utc, offsetMinutes, offsetLabel, raw };
}

/** EXIF `YYYY:MM:DD HH:MM:SS` plus an optional `OffsetTimeOriginal`. */
function parseExifStamp(raw: string, field: string, offsetRaw?: string): OriginTimestamp | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offsetRaw ?? ""}`;
  return parseIsoStamp(iso, field) ?? {
    field, local: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`,
    utc: null, offsetMinutes: null, offsetLabel: null, raw,
  };
}

/**
 * Which IANA zones actually sat at this offset at this instant?
 *
 * This is the DST-correct step people skip: `-05:00` in July is Bogotá or
 * Lima, not New York; `-05:00` in January is New York. Asking Intl for each
 * zone's offset *at the creation instant* settles it without a tz database.
 */
const ZONE_POOL = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Vancouver",
  "America/Denver", "America/Phoenix", "America/Chicago", "America/Mexico_City",
  "America/New_York", "America/Toronto", "America/Bogota", "America/Lima",
  "America/Halifax", "America/Santiago", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
  "Atlantic/Reykjavik", "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam",
  "Europe/Warsaw", "Europe/Stockholm", "Europe/Zurich", "Africa/Lagos", "Africa/Johannesburg",
  "Europe/Athens", "Europe/Kyiv", "Europe/Bucharest", "Africa/Cairo", "Asia/Jerusalem",
  "Europe/Istanbul", "Europe/Moscow", "Asia/Riyadh", "Asia/Baghdad", "Asia/Tehran",
  "Asia/Dubai", "Asia/Karachi", "Asia/Tashkent", "Asia/Kolkata", "Asia/Kathmandu",
  "Asia/Dhaka", "Asia/Yangon", "Asia/Bangkok", "Asia/Jakarta", "Asia/Shanghai",
  "Asia/Hong_Kong", "Asia/Singapore", "Asia/Manila", "Australia/Perth",
  "Asia/Tokyo", "Asia/Seoul", "Australia/Adelaide", "Australia/Brisbane",
  "Australia/Sydney", "Pacific/Auckland", "Pacific/Fiji",
];

function zoneOffsetMinutes(zone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
    if (name === "GMT") return 0;
    const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10));
  } catch { return null; }
}

function zoneCandidates(offsetMinutes: number, at: Date): string[] {
  return ZONE_POOL.filter((z) => zoneOffsetMinutes(z, at) === offsetMinutes);
}

/** A wall-clock read: 02:40 local is a very different fact from 14:40 local. */
function workPattern(local: string | null): string | null {
  const h = local ? parseInt(local.slice(11, 13), 10) : NaN;
  if (Number.isNaN(h)) return null;
  const d = new Date(`${local!.replace(" ", "T")}Z`);
  const weekend = !Number.isNaN(d.getTime()) && (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  const band =
    h < 5 ? "overnight (00:00–05:00 local) — outside any normal office pattern"
      : h < 9 ? "early morning (05:00–09:00 local)"
        : h < 18 ? "business hours (09:00–18:00 local)"
          : h < 23 ? "evening (18:00–23:00 local)"
            : "late night (23:00–24:00 local)";
  return weekend ? `${band}, on a weekend` : band;
}

// ── geography ────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<Record<string, string> | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await timedFetch(url, { headers: { "User-Agent": "AsherinGhostEngine/1.0", "Accept": "application/json" }, redirect: "follow" }, 9000);
    if (!res.ok) return null;
    const j = await res.json();
    return { display_name: j.display_name ?? "", ...(j.address ?? {}) };
  } catch { return null; }
}

/**
 * Two independent geolocators. ipapi.co silently rate-limits shared egress —
 * a single provider means the hosting row renders empty on every other run,
 * which reads as "no data" when it actually means "no answer yet".
 */
async function ipPosture(ip: string): Promise<{ asn: string | null; label: string | null }> {
  try {
    const res = await timedFetch(`https://ipapi.co/${ip}/json/`, { redirect: "follow" }, 8000);
    if (res.ok) {
      const j = await res.json();
      if (!j.error) {
        const label = [j.city, j.region, j.country_name].filter(Boolean).join(", ") || null;
        const asn = j.asn ? `${j.asn} ${j.org ?? ""}`.trim() : (j.org ?? null);
        if (label || asn) return { asn, label };
      }
    }
  } catch { /* fall through to the second provider */ }
  try {
    const res = await timedFetch(`https://ipwho.is/${ip}`, { redirect: "follow" }, 8000);
    if (!res.ok) return { asn: null, label: null };
    const j = await res.json();
    if (j.success === false) return { asn: null, label: null };
    const label = [j.city, j.region, j.country].filter(Boolean).join(", ") || null;
    const conn = j.connection ?? {};
    const asn = conn.asn ? `AS${conn.asn} ${conn.org ?? conn.isp ?? ""}`.trim() : (conn.isp ?? null);
    return { asn, label };
  } catch { return { asn: null, label: null }; }
}

async function resolveA(host: string): Promise<string | null> {
  try {
    const res = await timedFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" }, redirect: "follow" }, 7000);
    if (!res.ok) return null;
    const j = await res.json();
    return (j.Answer ?? []).map((a: { data: string }) => a.data)
      .find((d: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(d)) ?? null;
  } catch { return null; }
}

/** Street addresses stated inside the document body — the letterhead problem. */
const ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Z][A-Za-z.'-]+\s){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Plaza|Square|Sq|Parkway|Pkwy|Suite|Ste|Floor|Fl)\b[^\n,]{0,40}(?:,\s*[A-Z][A-Za-z .'-]{2,28}){0,2}(?:,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/g;

function statedAddresses(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.slice(0, 400_000).matchAll(ADDRESS_RE)) {
    const v = m[0].replace(/\s+/g, " ").trim();
    if (v.length > 12) seen.add(v);
    if (seen.size >= 6) break;
  }
  return [...seen];
}

async function forwardGeocode(q: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await timedFetch(url, { headers: { "User-Agent": "AsherinGhostEngine/1.0", "Accept": "application/json" }, redirect: "follow" }, 9000);
    if (!res.ok) return null;
    const j = await res.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), display: hit.display_name ?? q };
  } catch { return null; }
}

function placeFromAddress(
  kind: OriginPlace["kind"], source: string, confidence: OriginClaim["confidence"],
  lat: number | null, lng: number | null, addr: Record<string, string> | null, fallback: string,
): OriginPlace {
  const a = addr ?? {};
  const building = a.building || a.amenity || a.office || a.shop || a.house_name || null;
  const street = [a.house_number, a.road].filter(Boolean).join(" ") || null;
  const city = a.city || a.town || a.village || a.suburb || a.county || null;
  return {
    kind,
    label: building || street || city || fallback,
    detail: a.display_name || fallback,
    lat, lng,
    building, street, city,
    region: a.state || a.region || null,
    country: a.country || null,
    postcode: a.postcode || null,
    source, confidence,
  };
}

// ── compressed page streams ──────────────────────────────────────────────────

/**
 * A PDF's visible text almost always lives inside a FlateDecode stream, so
 * reading only the plain operators is why a filled form used to come back with
 * no addresses and no phone numbers. Each stream is inflated independently —
 * one malformed object must not cost the whole document — and both zlib-wrapped
 * and raw deflate framings are attempted, because producers disagree.
 */
async function inflateOne(bytes: Uint8Array, start: number, ends: number[]): Promise<string> {
  // The bytes between `stream` and `endstream` usually carry a trailing EOL
  // that is not part of the deflate payload; feeding it in fails the whole
  // stream, which is why an entire form used to read as empty. Each plausible
  // end offset is tried, longest first, under both framings.
  for (const end of ends) {
    if (end <= start) continue;
    const copy = new Uint8Array(end - start);
    copy.set(bytes.subarray(start, end));
    for (const format of ["deflate", "deflate-raw"] as const) {
      try {
        const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
        const buf = new Uint8Array(await new Response(stream).arrayBuffer());
        if (buf.length) return new TextDecoder("latin1").decode(buf);
      } catch { /* try the other framing, then the other end */ }
    }
  }
  return "";
}

async function inflatePdfStreams(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1").decode(bytes);
  const out: string[] = [];
  let cursor = 0;
  let count = 0;
  let total = 0;
  // Bounded at 140 streams / 8 MB: an adversarial file must not turn one
  // inspection into unbounded decompression.
  while (count < 140 && total < 8 * 1024 * 1024) {
    const at = latin1.indexOf("stream", cursor);
    if (at === -1) break;
    const dict = latin1.slice(Math.max(0, at - 900), at);
    // Per spec `stream` is followed by CRLF or LF, never a bare CR.
    let start = at + 6;
    if (latin1[start] === "\r") start++;
    if (latin1[start] === "\n") start++;
    const end = latin1.indexOf("endstream", start);
    if (end === -1) break;
    cursor = end + 9;
    if (!/\/FlateDecode/.test(dict)) continue;
    const span = end - start;
    if (span < 12 || span > 4 * 1024 * 1024) continue;
    count++;
    // Trim the EOL that precedes `endstream`, and honour a declared /Length.
    let trimmed = end;
    while (trimmed > start && (bytes[trimmed - 1] === 0x0a || bytes[trimmed - 1] === 0x0d)) trimmed--;
    const declared = /\/Length\s+(\d+)/.exec(dict);
    const ends = [trimmed, end];
    if (declared) {
      const n = start + Number(declared[1]);
      if (n > start && n <= end) ends.unshift(n);
    }
    const text = await inflateOne(bytes, start, ends);
    if (text) { out.push(text); total += text.length; }
  }

  return out.join("\n");
}

// ── the trace ────────────────────────────────────────────────────────────────


function blankTrace(url: string): OriginTrace {
  return {
    url, final_url: url, host: "", status: null, content_type: "", kind: "other",
    bytes: null, sha256: null, redirect_chain: [], fetched_at: new Date().toISOString(),
    created: null, modified: null, timestamps: [], zone_candidates: [], work_pattern: null,
    places: [], claims: [],
    toolchain: { producer: null, creator: null, device: null, os: null },
    identity: { author: null, company: null, title: null, subject: null, keywords: null },
    lineage: { document_id: null, instance_id: null, original_document_id: null, edit_span_minutes: null, revisions: [] },
    serving: { server: null, powered_by: null, last_modified: null, cdn_pop: null, ip: null, asn: null, ip_place: null },
    selectors: { emails: [], phones: [], urls: [], hosts: [], handles: [], people: [], places: [], ids: [] },
    upload: null,
    raw_fields: {}, scrubbed: false, notes: [], errors: [], elapsed_ms: 0,
  };
}

export async function traceOrigin(rawUrl: string): Promise<OriginTrace> {
  const t0 = Date.now();
  const safe = isPublicHttpUrl(rawUrl.trim().match(/^https?:\/\//i) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  const url = safe ?? rawUrl.trim();

  const trace: OriginTrace = blankTrace(url);


  if (!safe) {
    trace.errors.push("Target is not a public HTTP(S) URL. Private ranges and metadata endpoints are refused.");
    trace.elapsed_ms = Date.now() - t0;
    return trace;
  }

  // 1. Follow the link by hand so the redirect topology survives.
  let current = url;
  let res: Response | null = null;
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      res = await timedFetch(current, { headers: { "user-agent": UA, accept: "*/*" } }, FETCH_MS);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = isPublicHttpUrl(new URL(loc, current).toString());
        if (!next) { trace.errors.push("Redirect pointed at a non-public target; chain abandoned."); break; }
        trace.redirect_chain.push(next);
        try { await res.body?.cancel(); } catch { /* noop */ }
        current = next;
        continue;
      }
      break;
    }
  } catch (e) {
    trace.errors.push(`fetch: ${(e as Error).message}`);
  }

  trace.final_url = current;

  try { trace.host = new URL(current).hostname.replace(/^www\./, ""); } catch { /* noop */ }


  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  if (res) {
    trace.status = res.status;
    trace.content_type = (res.headers.get("content-type") || "").split(";")[0].trim();
    trace.serving = {
      server: res.headers.get("server"),
      powered_by: res.headers.get("x-powered-by"),
      last_modified: res.headers.get("last-modified"),
      cdn_pop: res.headers.get("x-amz-cf-pop") || res.headers.get("cf-ray") || res.headers.get("x-served-by"),
      ip: null, asn: null, ip_place: null,
    };
    try { bytes = await readCapped(res, MAX_DOC_BYTES); } catch (e) { trace.errors.push(`body: ${(e as Error).message}`); }
  }

  await inspectArtifact(trace, bytes);
  trace.elapsed_ms = Date.now() - t0;
  return trace;
}

/**
 * Everything that can be learned from the bytes themselves. Split out of
 * `traceOrigin` so an uploaded artefact — which has no transport layer at all —
 * gets the identical evidence treatment as a fetched one.
 */
async function inspectArtifact(trace: OriginTrace, bytes: Uint8Array): Promise<void> {
  trace.bytes = bytes.length || null;
  if (bytes.length) trace.sha256 = await sha256Hex(new TextDecoder("latin1").decode(bytes.subarray(0, 2 * 1024 * 1024)));

  const ct = trace.content_type;

  const looksPdf = ct.includes("pdf") || /%PDF-/.test(new TextDecoder("latin1").decode(bytes.subarray(0, 1024)));
  const looksJpeg = ct.includes("jpeg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
  trace.kind = looksPdf ? "pdf"
    : looksJpeg || ct.startsWith("image/") ? "image"
      : ct.includes("html") ? "html"
        : /officedocument|msword|excel|powerpoint/.test(ct) ? "office" : "other";

  const stamps: OriginTimestamp[] = [];
  let docText = "";
  let auxText = "";


  // 2. Container carving.
  if (trace.kind === "pdf" && bytes.length) {
    const latin1 = new TextDecoder("latin1").decode(bytes);

    const info: Record<string, string | null> = {
      Author: pdfField(latin1, "Author"),
      Creator: pdfField(latin1, "Creator"),
      Producer: pdfField(latin1, "Producer"),
      Company: pdfField(latin1, "Company"),
      Title: pdfField(latin1, "Title"),
      Subject: pdfField(latin1, "Subject"),
      Keywords: pdfField(latin1, "Keywords"),
      SourceModified: pdfField(latin1, "SourceModified"),
    };
    const creationRaw = [...latin1.matchAll(/\/CreationDate\s*\(\s*(D:[^)]{6,40})\)/g)].pop()?.[1]
      ?? pdfField(latin1, "CreationDate");
    const modRaw = [...latin1.matchAll(/\/ModDate\s*\(\s*(D:[^)]{6,40})\)/g)].pop()?.[1]
      ?? pdfField(latin1, "ModDate");

    if (creationRaw) { const s = parsePdfDate(creationRaw, "pdf:CreationDate"); if (s) stamps.push(s); }
    if (modRaw) { const s = parsePdfDate(modRaw, "pdf:ModDate"); if (s) stamps.push(s); }

    // XMP is the second, independent clock — and it disagrees when a file has
    // been through a converter that only rewrote one of the two.
    for (const [tag, field] of [
      ["xmp:CreateDate", "xmp:CreateDate"], ["xmp:ModifyDate", "xmp:ModifyDate"],
      ["xmp:MetadataDate", "xmp:MetadataDate"], ["photoshop:DateCreated", "photoshop:DateCreated"],
    ] as const) {
      const v = xmpField(latin1, tag);
      if (v) { const s = parseIsoStamp(v, field); if (s) stamps.push(s); }
    }

    trace.toolchain.producer = info.Producer;
    trace.toolchain.creator = info.Creator || xmpField(latin1, "xmp:CreatorTool");
    trace.identity.author = info.Author || xmpField(latin1, "dc:creator");
    trace.identity.company = info.Company;
    trace.identity.title = info.Title || xmpField(latin1, "dc:title");
    trace.identity.subject = info.Subject;
    trace.identity.keywords = info.Keywords;
    trace.lineage.document_id = xmpField(latin1, "xmpMM:DocumentID");
    trace.lineage.instance_id = xmpField(latin1, "xmpMM:InstanceID");
    trace.lineage.original_document_id = xmpField(latin1, "xmpMM:OriginalDocumentID");
    trace.lineage.revisions = [...latin1.matchAll(/stEvt:when="([^"]{10,40})"/g)].slice(0, 12).map((m) => m[1]);

    const pdfVersion = latin1.match(/%PDF-(\d\.\d)/)?.[1];
    const trailerId = latin1.match(/\/ID\s*\[\s*<([0-9a-fA-F]{8,64})>\s*<([0-9a-fA-F]{8,64})>/);
    if (pdfVersion) trace.raw_fields["pdf:version"] = pdfVersion;
    if (trailerId) {
      trace.raw_fields["pdf:id.original"] = trailerId[1];
      trace.raw_fields["pdf:id.current"] = trailerId[2];
      if (trailerId[1] !== trailerId[2]) {
        trace.notes.push("Trailer /ID pair differs — the file was saved again after it was first written.");
      }
    }
    const incremental = (latin1.match(/%%EOF/g) || []).length;
    if (incremental > 1) trace.raw_fields["pdf:saves"] = String(incremental);

    for (const [k, v] of Object.entries(info)) if (v) trace.raw_fields[`pdf:${k}`] = v;
    for (const tag of ["xmp:CreatorTool", "dc:creator", "dc:title", "pdf:Producer", "photoshop:City", "photoshop:State", "photoshop:Country", "Iptc4xmpCore:Location"]) {
      const v = xmpField(latin1, tag);
      if (v) trace.raw_fields[tag] = v;
    }

    // Scanner output: the page image often still carries its own EXIF.
    const soi = latin1.indexOf("\uFFFD\uFFFD"); // placeholder guard; real scan below
    void soi;
    for (let i = 0, found = 0; i + 3 < bytes.length && found < 2; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff && bytes[i + 3] === 0xe1) {
        const exif = parseExif(bytes.subarray(i, Math.min(i + 128 * 1024, bytes.length)));
        if (Object.keys(exif).length) {
          found++;
          for (const [k, v] of Object.entries(exif)) trace.raw_fields[`embedded-exif:${k}`] = String(v);
          if (typeof exif.DateTimeOriginal === "string") {
            const s = parseExifStamp(exif.DateTimeOriginal, "embedded-exif:DateTimeOriginal",
              typeof exif.OffsetTimeOriginal === "string" ? exif.OffsetTimeOriginal : undefined);
            if (s) stamps.push(s);
          }
          if (typeof exif.GPSLatitude === "number" && typeof exif.GPSLongitude === "number") {
            trace.raw_fields["embedded-exif:GPS"] = `${exif.GPSLatitude},${exif.GPSLongitude}`;
          }
        }
        i += 1024;
      }
    }

    // Most real documents keep their page text inside FlateDecode streams, so
    // reading only the uncompressed operators means a form full of addresses
    // and phone numbers looks empty. Inflate first, then extract.
    let readable = latin1;
    try {
      const inflated = await inflatePdfStreams(bytes);
      if (inflated) {
        readable = `${latin1}\n${inflated}`;
        // Forms built in LiveCycle/XFA carry their real content as XML inside
        // those same streams, never as text-showing operators — so the inflated
        // body is kept as its own corpus for selector carving, tags stripped.
        auxText = inflated
          .replace(/<[^>]{0,400}>/g, " ")
          .replace(/[^\x20-\x7e\n]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .slice(0, 400_000);
      }
    } catch { /* an unreadable stream is a fact, not a failure */ }
    try { docText = pdfToText(readable).slice(0, 400_000); } catch { /* text is a bonus, not a requirement */ }


  }

  if (trace.kind === "image" && bytes.length) {
    const exif = parseExif(bytes);
    for (const [k, v] of Object.entries(exif)) trace.raw_fields[`exif:${k}`] = String(v);
    trace.toolchain.device = [exif.Make, exif.Model].filter(Boolean).join(" ").trim() || null;
    trace.toolchain.creator = (exif.Software as string) || null;
    trace.identity.author = (exif.Artist as string) || (exif.OwnerName as string) || null;
    for (const f of ["DateTimeOriginal", "DateTime"]) {
      const v = exif[f];
      if (typeof v === "string") {
        const s = parseExifStamp(v, `exif:${f}`, typeof exif.OffsetTimeOriginal === "string" ? exif.OffsetTimeOriginal : undefined);
        if (s) { stamps.push(s); break; }
      }
    }
    if (typeof exif.GPSLatitude === "number" && typeof exif.GPSLongitude === "number") {
      const addr = await reverseGeocode(exif.GPSLatitude, exif.GPSLongitude);
      trace.places.push(placeFromAddress(
        "capture", "EXIF GPSLatitude/GPSLongitude", "confirmed",
        exif.GPSLatitude, exif.GPSLongitude, addr,
        `${exif.GPSLatitude}, ${exif.GPSLongitude}`,
      ));
    }
  }

  if (trace.kind === "html" && bytes.length) {
    const head = new TextDecoder().decode(bytes.subarray(0, 128 * 1024));
    const grab = (re: RegExp) => head.match(re)?.[1]?.trim().slice(0, 300) ?? null;
    trace.toolchain.creator = grab(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i);
    trace.identity.author = grab(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i);
    trace.identity.title = grab(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
    for (const [re, field] of [
      [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i, "og:article:published_time"],
      [/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)/i, "og:article:modified_time"],
      [/"datePublished"\s*:\s*"([^"]+)"/i, "jsonld:datePublished"],
    ] as const) {
      const v = head.match(re)?.[1];
      if (v) { const s = parseIsoStamp(v, field); if (s) stamps.push(s); }
    }
  }

  if (trace.kind === "office") {
    trace.notes.push(
      "Office container (OOXML). Its core.xml authorship block is inside a zip; this trace reports transport and hosting provenance only.",
    );
  }

  // 3. Timeline resolution.
  const withInstant = stamps.filter((s) => s.utc);
  const sortKey = (s: OriginTimestamp) => s.utc ?? `${s.local}Z`;
  stamps.sort((a, b) => String(sortKey(a)).localeCompare(String(sortKey(b))));
  trace.timestamps = stamps;

  trace.created = stamps.find((s) => /CreationDate|CreateDate|DateTimeOriginal|DateCreated|datePublished/i.test(s.field)) ?? stamps[0] ?? null;
  trace.modified = [...stamps].reverse().find((s) => /ModDate|ModifyDate|modified_time|MetadataDate/i.test(s.field)) ?? null;

  if (!trace.created && trace.serving.last_modified) {
    const d = new Date(trace.serving.last_modified);
    // Epoch zero is a CDN placeholder header, never a publication date.
    if (!Number.isNaN(d.getTime()) && d.getTime() > 86_400_000) {
      trace.notes.push("No container timestamp survived. The only date available is when the host last wrote the file, which is publication, not authorship.");
      trace.created = {
        field: "http:Last-Modified", local: null, utc: d.toISOString(),
        offsetMinutes: 0, offsetLabel: "Z", raw: trace.serving.last_modified,
      };
    }
  }

  if (trace.created?.offsetMinutes != null && trace.created.utc) {
    trace.zone_candidates = zoneCandidates(trace.created.offsetMinutes, new Date(trace.created.utc));
  }
  trace.work_pattern = workPattern(trace.created?.local ?? null);

  if (trace.created?.utc && trace.modified?.utc) {
    const span = (Date.parse(trace.modified.utc) - Date.parse(trace.created.utc)) / 60_000;
    if (Number.isFinite(span)) trace.lineage.edit_span_minutes = Math.round(span);
  }

  // "Scrubbed" is an accusation, and it is only earnable when the engine
  // actually held the artefact: a 404 error page has no metadata to strip.
  const gotArtefact = trace.status !== null && trace.status >= 200 && trace.status < 300 &&
    (trace.bytes ?? 0) > 512 && (trace.kind === "pdf" || trace.kind === "image" || trace.kind === "office");
  trace.scrubbed = gotArtefact && stamps.length === 0 &&
    !trace.toolchain.producer && !trace.toolchain.creator && !trace.identity.author;
  if (!gotArtefact && trace.status !== null && (trace.status < 200 || trace.status >= 300)) {
    trace.notes.push(`The host answered ${trace.status} and served ${trace.bytes ?? 0} bytes of ${trace.content_type || "unknown type"} — that is an error page, not the artefact. Nothing below describes the file you were looking for.`);
  }
  if (trace.scrubbed) {
    trace.notes.push("Every authorship field is absent. Files do not arrive this clean by accident — this one was stripped, re-printed, or generated by a sanitising pipeline.");
  }

  // 4. Geography — three separate answers, never merged.
  if (trace.created?.offsetMinutes != null) {
    const sign = trace.created.offsetMinutes < 0 ? "-" : "+";
    const abs = Math.abs(trace.created.offsetMinutes);
    trace.places.push({
      kind: "authoring-zone",
      label: `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`,
      detail: trace.zone_candidates.length
        ? `Zones at that offset on that date: ${trace.zone_candidates.slice(0, 10).join(", ")}`
        : "No common zone matched that offset on that date — the machine clock may be misconfigured.",
      lat: null, lng: null, building: null, street: null, city: null,
      region: null, country: null, postcode: null,
      source: `${trace.created.field} UTC offset`,
      confidence: trace.zone_candidates.length ? "strong" : "weak",
    });
  }

  const stated = docText ? statedAddresses(docText) : [];
  if (stated.length) {
    const geo = await forwardGeocode(stated[0]);
    const addr = geo ? await reverseGeocode(geo.lat, geo.lng) : null;
    trace.places.push(placeFromAddress(
      "stated", "Address printed inside the document body", "probable",
      geo?.lat ?? null, geo?.lng ?? null, addr, stated[0],
    ));
    trace.raw_fields["document:addresses"] = stated.join(" | ");
  }

  if (trace.host) {
    const ip = await resolveA(trace.host);
    if (ip) {
      trace.serving.ip = ip;
      const post = await ipPosture(ip);
      trace.serving.asn = post.asn;
      trace.serving.ip_place = post.label;
      if (post.label) {
        trace.places.push({
          kind: "serving-origin",
          label: post.label,
          detail: `${trace.host} resolves to ${ip}${post.asn ? ` (${post.asn})` : ""}. This is where the copy is served from — a CDN edge, not the author's desk.`,
          lat: null, lng: null, building: null, street: null, city: null,
          region: null, country: null, postcode: null,
          source: "DNS A record + IP geolocation",
          confidence: "weak",
        });
      }
    }
  }

  // 5. Claims — the readable verdict, each line pinned to its field.
  const push = (label: string, value: string | null, evidence: string, confidence: OriginClaim["confidence"]) => {
    if (value) trace.claims.push({ label, value, evidence, confidence });
  };
  if (trace.created) {
    push("Created", trace.created.local
      ? `${trace.created.local}${trace.created.offsetLabel ? ` ${trace.created.offsetLabel}` : " (no zone recorded)"}`
      : trace.created.utc!, trace.created.field,
      trace.created.offsetMinutes != null ? "confirmed" : "strong");
  }
  if (trace.modified) {
    push("Last saved", trace.modified.local ?? trace.modified.utc ?? "—", trace.modified.field, "confirmed");
  }
  push("Authoring toolchain", [trace.toolchain.creator, trace.toolchain.producer].filter(Boolean).join(" → ") || null,
    trace.kind === "pdf" ? "pdf:Creator / pdf:Producer" : "container generator", "confirmed");
  push("Hardware", trace.toolchain.device, "exif:Make/Model", "confirmed");
  push("Named author", trace.identity.author, trace.kind === "pdf" ? "pdf:Author / dc:creator" : "container author", "strong");
  push("Organisation", trace.identity.company, "pdf:Company", "strong");
  if (trace.lineage.edit_span_minutes != null) {
    const m = trace.lineage.edit_span_minutes;
    push("Edit span", m <= 0 ? "written and saved in one pass" :
      m < 60 ? `${m} minutes between first write and last save` :
        m < 1440 ? `${(m / 60).toFixed(1)} hours between first write and last save` :
          `${(m / 1440).toFixed(1)} days between first write and last save`,
      "CreationDate → ModDate", "confirmed");
  }
  if (trace.zone_candidates.length) {
    push("Authoring region", trace.zone_candidates.slice(0, 6).join(", "),
      "UTC offset resolved against DST for that date", trace.zone_candidates.length <= 3 ? "strong" : "probable");
  }
  const capture = trace.places.find((p) => p.kind === "capture");
  if (capture) {
    push("Capture point",
      [capture.building, capture.street, capture.city, capture.region, capture.country].filter(Boolean).join(", ") || capture.label,
      "EXIF GPS", "confirmed");
  }

  // 6. Selector harvest — the document is not the end of the trace, it is the
  // start of the next one. Everything pivotable is lifted out of both the body
  // text and the metadata fields, deduped, and handed back as search seeds.
  trace.selectors = harvestSelectors(`${docText}\n${auxText}`.slice(0, 600_000), trace);
  const sel = trace.selectors;
  if (sel.emails.length) push("Addresses in document", sel.emails.slice(0, 8).join(", "), "body text + metadata fields", "confirmed");
  if (sel.phones.length) push("Phone numbers in document", sel.phones.slice(0, 8).join(", "), "body text", "confirmed");
}

// ── selector harvest ─────────────────────────────────────────────────────────

const EMAIL_RE = /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{2,255}\.[A-Za-z]{2,24}\b/g;
/** NANP + international, tolerant of the spacing PDFs introduce mid-number. */
const PHONE_RE = /(?:\+\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?|\d{2,4}[\s.\-])\d{3,4}[\s.\-]?\d{3,4}\b/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]{4,300}/g;
const HANDLE_RE = /(?:^|[\s(:])@([A-Za-z0-9_]{3,30})\b/g;
const ID_RE = /\b(?:[A-Z]{2,4}-\d{3,8}|\d{2}-\d{7}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g;

function uniq(list: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}

function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  // Dates, invoice totals, and ZIP+4 runs are the usual false positives.
  if (/^(19|20)\d{6}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  // Inflated page streams are full of coordinate triplets — "1054 236 1055"
  // reads as a phone number only if space is accepted as a separator. Require
  // real punctuation, a country prefix, or one contiguous run.
  if (!/[+().\-]/.test(raw) && /\s/.test(raw)) return false;
  return true;
}


function harvestSelectors(docText: string, trace: OriginTrace) {
  const metaBlob = [
    trace.identity.author, trace.identity.company, trace.identity.title,
    trace.identity.subject, trace.identity.keywords,
    ...Object.values(trace.raw_fields),
  ].filter(Boolean).join("\n");
  const corpus = `${docText}\n${metaBlob}`.slice(0, 500_000);

  const emails = uniq([...corpus.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase()), 40);
  const phones = uniq(
    [...corpus.matchAll(PHONE_RE)].map((m) => m[0].replace(/\s{2,}/g, " ").trim()).filter(looksLikePhone),
    30,
  );
  const urls = uniq([...corpus.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;]$/, "")), 60);
  const handles = uniq([...corpus.matchAll(HANDLE_RE)].map((m) => `@${m[1]}`), 20);
  const ids = uniq([...corpus.matchAll(ID_RE)].map((m) => m[0]), 25);

  const hosts = uniq([
    ...urls.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }),
    ...emails.map((e) => e.split("@")[1] ?? ""),
  ].filter(Boolean), 30);

  // People: the named author plus capitalised two/three-token names in the body.
  const bodyNames = [...docText.matchAll(/\b([A-Z][a-z]{1,15})\s+(?:([A-Z]\.|[A-Z][a-z]{1,15})\s+)?([A-Z][a-z]{1,20})\b/g)]
    .map((m) => m[0])
    .filter((n) => !/^(The|This|That|United|New|Form|Department|Internal|Revenue|Social|Security|Page|Table|Figure)\b/.test(n));
  const people = uniq([trace.identity.author ?? "", ...bodyNames], 25);

  const places = uniq([
    ...trace.places.map((p) => [p.building, p.street, p.city, p.region, p.country].filter(Boolean).join(", ") || p.label),
    ...(trace.raw_fields["document:addresses"]?.split(" | ") ?? []),
  ].filter(Boolean), 15);

  return { emails, phones, urls, hosts, handles, people, places, ids };
}

// ── uploaded artefacts ───────────────────────────────────────────────────────

export interface UploadedArtifact {
  filename: string;
  contentType: string;
  /** Raw base64 (no data: prefix). */
  base64: string;
}

/** Hard ceiling on an upload the function will hold in memory. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") && b64.startsWith("data:") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * ORIGIN for a file the operator holds rather than a link they were sent.
 * Transport evidence is absent by construction — no host, no CDN, no serving
 * IP — and the trace says so instead of inventing one.
 */
export async function traceUpload(file: UploadedArtifact): Promise<OriginTrace> {
  const t0 = Date.now();
  const name = (file.filename || "upload").slice(0, 200);
  const trace = blankTrace(`upload:${name}`);
  trace.final_url = trace.url;
  trace.upload = { filename: name, declared_type: file.contentType || "" };

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(file.base64 || "");
  } catch {
    trace.errors.push("Upload payload was not valid base64.");
    trace.elapsed_ms = Date.now() - t0;
    return trace;
  }
  if (!bytes.length) {
    trace.errors.push("Upload was empty.");
    trace.elapsed_ms = Date.now() - t0;
    return trace;
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    trace.notes.push(`File is ${(bytes.length / 1048576).toFixed(1)} MB; only the first 12 MB were read. Provenance normally lives in the head and trailer, both of which are inside that window for most documents.`);
    bytes = bytes.subarray(0, MAX_UPLOAD_BYTES);
  }

  // The declared type is a claim by the uploader; the magic bytes are evidence.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
  const sniffed = head.startsWith("%PDF-") ? "application/pdf"
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg"
      : head.startsWith("\x89PNG") ? "image/png"
        : head.startsWith("PK\x03\x04") ? "application/vnd.openxmlformats-officedocument"
          : head.startsWith("<") ? "text/html"
            : (file.contentType || "application/octet-stream");
  trace.content_type = sniffed;
  trace.status = 200;
  if (file.contentType && !sniffed.includes(file.contentType.split("/")[1] ?? "\u0000") && !file.contentType.includes(sniffed.split("/")[1] ?? "\u0000")) {
    trace.notes.push(`Declared type "${file.contentType}" does not match the file's own signature (${sniffed}). Read the signature, not the extension.`);
  }

  await inspectArtifact(trace, bytes);
  trace.notes.push("Uploaded artefact — there is no transport layer to read, so no serving host, CDN edge, or origin IP appears below. Every claim comes from inside the file.");
  trace.elapsed_ms = Date.now() - t0;
  return trace;
}

