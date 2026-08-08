// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — Extraction Layer
//
// "It touches everything and reads nothing."
//
// This module receives a URL and returns ONLY the shell: transport headers,
// DNS/ASN/geo posture, redirect topology, and container metadata (EXIF for
// JPEG, document info for PDF, OpenGraph / JSON-LD / generator for HTML head).
// Body prose is never retained — HTML is read head-only and discarded, image
// pixel data is never decoded, PDF page streams are never parsed.
//
// Every field emitted here is normalized into one vocabulary (GhostRecord) so
// an EXIF `DateTimeOriginal`, an HTTP `Last-Modified`, and a JSON-LD
// `datePublished` all become the same queryable dimension.
// ─────────────────────────────────────────────────────────────────────────────

export interface GhostRecord {
  entity_id: string;            // sha256 fingerprint of the canonical URL
  url: string;
  host: string;
  source_type: string;          // MIME family, e.g. "text/html", "image/jpeg"
  status: number | null;
  created_at: string | null;    // ISO — earliest defensible creation signal
  modified_at: string | null;   // ISO — last modification signal
  author: string | null;
  device_id: string | null;     // camera / hardware string from container
  software: string | null;      // generator / producer / encoder
  geo_lat: number | null;
  geo_lng: number | null;
  geo_label: string | null;     // network-origin locality (not subject location)
  geo_source: "exif" | "network" | null;
  file_size_bytes: number | null;
  network_origin_ip: string | null;
  asn: string | null;
  server: string | null;
  tls: boolean;
  hsts: boolean;
  csp: boolean;
  redirect_chain: string[];
  response_ms: number | null;
  dns: { a: string[]; ns: string[]; mx: string[]; txt_spf: string | null };
  headers: Record<string, string>;
  container: Record<string, string | number>;  // raw normalized container fields
  errors: string[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Header allow-list: transport shell only, never cookies or auth material. */
const HEADER_KEEP = new Set([
  "content-type", "content-length", "last-modified", "etag", "server",
  "x-powered-by", "cache-control", "age", "date", "via", "cf-ray",
  "strict-transport-security", "content-security-policy", "x-frame-options",
  "content-encoding", "vary", "alt-svc", "x-cache", "x-amz-cf-pop",
]);

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** fetch with a hard deadline — every outbound call is bounded. */
async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, redirect: "manual" });
  } finally {
    clearTimeout(t);
  }
}

/** SSRF guard: the engine may only touch public hosts. */
export function isPublicHttpUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\[?::1\]?$/.test(h)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254) return null;
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 192 && b === 168) return null;
    if (a >= 224) return null;
  }
  return u.toString();
}

// ── DNS / network posture ────────────────────────────────────────────────────

async function dnsQuery(name: string, type: string): Promise<string[]> {
  try {
    const r = await timedFetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
      6000,
    );
    if (!r.ok) return [];
    const j = await r.json();
    return (j.Answer || []).map((a: { data: string }) => String(a.data)).slice(0, 8);
  } catch { return []; }
}

async function ipPosture(ip: string): Promise<{ lat: number | null; lng: number | null; label: string | null; asn: string | null }> {
  try {
    const r = await timedFetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {}, 6000);
    if (!r.ok) return { lat: null, lng: null, label: null, asn: null };
    const j = await r.json();
    if (!j?.success) return { lat: null, lng: null, label: null, asn: null };
    return {
      lat: typeof j.latitude === "number" ? j.latitude : null,
      lng: typeof j.longitude === "number" ? j.longitude : null,
      label: [j.city, j.region, j.country].filter(Boolean).join(", ") || null,
      asn: j.connection?.org ? `${j.connection.asn ? "AS" + j.connection.asn + " " : ""}${j.connection.org}` : null,
    };
  } catch { return { lat: null, lng: null, label: null, asn: null }; }
}

// ── Container parsers ────────────────────────────────────────────────────────

function rational(view: DataView, off: number, le: boolean): number {
  const n = view.getUint32(off, le), d = view.getUint32(off + 4, le);
  return d === 0 ? 0 : n / d;
}

/**
 * Minimal EXIF reader — walks the TIFF IFD chain inside the JPEG APP1 segment.
 * Only tag identifiers are decoded; pixel data is never touched.
 */
export function parseExif(bytes: Uint8Array): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return out;

  // Locate the APP1 (Exif) marker.
  let p = 2, tiff = -1;
  while (p + 4 < bytes.length) {
    if (bytes[p] !== 0xff) { p++; continue; }
    const marker = bytes[p + 1];
    const size = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(p + 4, p + 8)) === "Exif") {
      tiff = p + 10;
      break;
    }
    if (marker === 0xda) break; // start of scan — image data begins, stop
    if (size <= 0) break;
    p += 2 + size;
  }
  if (tiff < 0 || tiff + 8 > bytes.length) return out;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = view.getUint16(tiff, false) === 0x4949;
  if (view.getUint16(tiff + 2, le) !== 0x2a) return out;

  const TAGS: Record<number, string> = {
    0x010f: "Make", 0x0110: "Model", 0x0131: "Software", 0x013b: "Artist",
    0x0132: "DateTime", 0x8298: "Copyright", 0x9003: "DateTimeOriginal",
    0x9004: "DateTimeDigitized", 0xa430: "OwnerName", 0xa431: "BodySerialNumber",
    0x829a: "ExposureTime", 0x8827: "ISO", 0x920a: "FocalLength", 0x9209: "Flash",
  };

  const readIfd = (start: number, gps: boolean) => {
    if (start + 2 > bytes.length) return;
    const count = view.getUint16(start, le);
    if (count > 512) return;
    const gpsRef: Record<number, string> = {};
    const gpsVal: Record<number, number> = {};
    for (let i = 0; i < count; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > bytes.length) return;
      const tag = view.getUint16(e, le);
      const type = view.getUint16(e + 2, le);
      const n = view.getUint32(e + 4, le);
      const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const byteLen = (sizes[type] || 1) * n;
      const valOff = byteLen <= 4 ? e + 8 : tiff + view.getUint32(e + 8, le);
      if (valOff < 0 || valOff + Math.min(byteLen, 4) > bytes.length) continue;

      if (!gps && (tag === 0x8769 || tag === 0x8825)) {
        readIfd(tiff + view.getUint32(e + 8, le), tag === 0x8825);
        continue;
      }
      if (gps) {
        if ((tag === 1 || tag === 3) && type === 2) gpsRef[tag] = String.fromCharCode(bytes[valOff]);
        if ((tag === 2 || tag === 4) && type === 5 && valOff + 24 <= bytes.length) {
          gpsVal[tag] = rational(view, valOff, le)
            + rational(view, valOff + 8, le) / 60
            + rational(view, valOff + 16, le) / 3600;
        }
        continue;
      }
      const name = TAGS[tag];
      if (!name) continue;
      if (type === 2) {
        const end = Math.min(valOff + n, bytes.length);
        const s = new TextDecoder().decode(bytes.slice(valOff, end)).replace(/\0+$/, "").trim();
        if (s) out[name] = s;
      } else if (type === 3) {
        out[name] = view.getUint16(valOff, le);
      } else if (type === 4) {
        out[name] = view.getUint32(valOff, le);
      } else if (type === 5 && valOff + 8 <= bytes.length) {
        out[name] = Number(rational(view, valOff, le).toFixed(4));
      }
    }
    if (gps && gpsVal[2] !== undefined && gpsVal[4] !== undefined) {
      out.GPSLatitude = Number(((gpsRef[1] === "S" ? -1 : 1) * gpsVal[2]).toFixed(6));
      out.GPSLongitude = Number(((gpsRef[3] === "W" ? -1 : 1) * gpsVal[4]).toFixed(6));
    }
  };

  readIfd(tiff + view.getUint32(tiff + 4, le), false);
  return out;
}

/** PDF document-info + XMP header fields. Page content streams are ignored. */
export function parsePdfInfo(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (key: string, re: RegExp) => {
    const m = text.match(re);
    if (m?.[1]) out[key] = m[1].replace(/\\[()]/g, "").trim().slice(0, 200);
  };
  grab("Author", /\/Author\s*\(([^)]{1,200})\)/);
  grab("Creator", /\/Creator\s*\(([^)]{1,200})\)/);
  grab("Producer", /\/Producer\s*\(([^)]{1,200})\)/);
  grab("Company", /\/Company\s*\(([^)]{1,200})\)/);
  grab("Title", /\/Title\s*\(([^)]{1,200})\)/);
  grab("CreationDate", /\/CreationDate\s*\(D:(\d{4}[\d+\-Z']*)\)/);
  grab("ModDate", /\/ModDate\s*\(D:(\d{4}[\d+\-Z']*)\)/);
  grab("XMPCreatorTool", /<xmp:CreatorTool>([^<]{1,200})<\/xmp:CreatorTool>/);
  grab("PDFVersion", /%PDF-(\d\.\d)/);
  return out;
}

/** Parse a PDF `D:YYYYMMDDHHmmSS` date into ISO. */
function pdfDate(v?: string): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2] || "01"}-${m[3] || "01"}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** EXIF `YYYY:MM:DD HH:MM:SS` (camera-local, no zone) into ISO. */
function exifDate(v?: string | number): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Head-only HTML metadata: OpenGraph, JSON-LD, generator, article dates. */
export function parseHtmlHead(head: string): Record<string, string> {
  const out: Record<string, string> = {};
  const metaRe = /<meta\s+[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(head)) !== null) {
    const tag = m[0];
    const key = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1];
    const val = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!key || !val) continue;
    const k = key.toLowerCase();
    if (/^(og:|article:|twitter:|dc\.|dcterms\.)/.test(k) || ["author", "generator", "description", "date", "publish-date", "last-modified"].includes(k)) {
      out[k] = val.slice(0, 300);
    }
  }
  const title = head.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1];
  if (title) out["title"] = title.replace(/\s+/g, " ").trim();

  // JSON-LD: read only the structural date/author/publisher fields.
  const ld = head.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]{0,20000}?)<\/script>/i)?.[1];
  if (ld) {
    try {
      const j = JSON.parse(ld.trim());
      const node = Array.isArray(j) ? j[0] : (j["@graph"]?.[0] ?? j);
      for (const f of ["datePublished", "dateModified", "@type", "publisher", "author"]) {
        const v = node?.[f];
        if (typeof v === "string") out[`jsonld:${f}`] = v.slice(0, 200);
        else if (v?.name) out[`jsonld:${f}`] = String(v.name).slice(0, 200);
      }
    } catch { /* malformed JSON-LD is a signal, not a failure */ }
  }
  return out;
}

function isoOrNull(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── The extractor ────────────────────────────────────────────────────────────

const MAX_HEAD_BYTES = 96 * 1024;   // HTML head window
const MAX_BIN_BYTES = 192 * 1024;   // EXIF / PDF-info window

/**
 * Collect the shell of a single URL. Never throws — a failed probe still
 * returns a record carrying the failure, because an unreachable host is itself
 * a metadata finding.
 */
export async function extractGhostRecord(rawUrl: string): Promise<GhostRecord> {
  const safe = isPublicHttpUrl(rawUrl);
  const url = safe ?? rawUrl;
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  const rec: GhostRecord = {
    entity_id: await sha256Hex(url),
    url, host,
    source_type: "unknown", status: null,
    created_at: null, modified_at: null, author: null, device_id: null, software: null,
    geo_lat: null, geo_lng: null, geo_label: null, geo_source: null,
    file_size_bytes: null, network_origin_ip: null, asn: null, server: null,
    tls: url.startsWith("https://"), hsts: false, csp: false,
    redirect_chain: [], response_ms: null,
    dns: { a: [], ns: [], mx: [], txt_spf: null },
    headers: {}, container: {}, errors: [],
  };
  if (!safe) { rec.errors.push("blocked: non-public or malformed URL"); return rec; }

  // 1. Redirect topology + transport shell.
  const started = Date.now();
  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    try {
      res = await timedFetch(current, { headers: { "User-Agent": UA, accept: "*/*" } }, 12000);
    } catch (e) {
      rec.errors.push(`fetch: ${(e as Error).message}`);
      break;
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = isPublicHttpUrl(new URL(loc, current).toString());
      if (!next) { rec.errors.push("blocked redirect target"); break; }
      rec.redirect_chain.push(next);
      current = next;
      try { await res.body?.cancel(); } catch { /* drained */ }
      continue;
    }
    break;
  }
  rec.response_ms = Date.now() - started;

  if (res) {
    rec.status = res.status;
    rec.url = current;
    rec.host = new URL(current).hostname;
    rec.tls = current.startsWith("https://");
    for (const [k, v] of res.headers) {
      const key = k.toLowerCase();
      if (HEADER_KEEP.has(key)) rec.headers[key] = v.slice(0, 300);
    }
    rec.server = rec.headers["server"] || rec.headers["x-powered-by"] || null;
    rec.hsts = !!rec.headers["strict-transport-security"];
    rec.csp = !!rec.headers["content-security-policy"];
    rec.source_type = (rec.headers["content-type"] || "unknown").split(";")[0].trim().toLowerCase();
    rec.file_size_bytes = rec.headers["content-length"] ? Number(rec.headers["content-length"]) : null;
    rec.modified_at = isoOrNull(rec.headers["last-modified"]);

    // 2. Container shell — bounded byte window, body then discarded.
    try {
      if (rec.source_type.startsWith("image/jpeg")) {
        const buf = new Uint8Array(await readCapped(res, MAX_BIN_BYTES));
        const exif = parseExif(buf);
        rec.container = exif;
        rec.device_id = [exif.Make, exif.Model].filter(Boolean).join(" ").trim() || null;
        rec.software = (exif.Software as string) || null;
        rec.author = (exif.Artist as string) || (exif.OwnerName as string) || null;
        rec.created_at = exifDate(exif.DateTimeOriginal) || exifDate(exif.DateTime);
        if (typeof exif.GPSLatitude === "number" && typeof exif.GPSLongitude === "number") {
          rec.geo_lat = exif.GPSLatitude; rec.geo_lng = exif.GPSLongitude; rec.geo_source = "exif";
        }
      } else if (rec.source_type.includes("pdf")) {
        const txt = new TextDecoder("latin1").decode(await readCapped(res, MAX_BIN_BYTES));
        const info = parsePdfInfo(txt);
        rec.container = info;
        rec.author = info.Author || null;
        rec.software = info.Producer || info.Creator || info.XMPCreatorTool || null;
        rec.created_at = pdfDate(info.CreationDate);
        rec.modified_at = pdfDate(info.ModDate) || rec.modified_at;
      } else if (rec.source_type.startsWith("text/html") || rec.source_type.includes("xml")) {
        const head = new TextDecoder().decode(await readCapped(res, MAX_HEAD_BYTES));
        const cut = head.search(/<\/head>/i);
        const meta = parseHtmlHead(cut > 0 ? head.slice(0, cut) : head);
        rec.container = meta;
        rec.author = meta["author"] || meta["jsonld:author"] || meta["article:author"] || null;
        rec.software = meta["generator"] || null;
        rec.created_at = isoOrNull(meta["article:published_time"] || meta["jsonld:datePublished"] || meta["date"]);
        rec.modified_at = isoOrNull(meta["article:modified_time"] || meta["jsonld:dateModified"]) || rec.modified_at;
        if (!rec.file_size_bytes) rec.file_size_bytes = head.length;
      } else {
        try { await res.body?.cancel(); } catch { /* drained */ }
      }
    } catch (e) {
      rec.errors.push(`container: ${(e as Error).message}`);
    }
  }

  // 3. DNS + network origin posture.
  if (rec.host) {
    const [a, ns, mx, txt] = await Promise.all([
      dnsQuery(rec.host, "A"), dnsQuery(rec.host, "NS"),
      dnsQuery(rec.host, "MX"), dnsQuery(rec.host, "TXT"),
    ]);
    rec.dns = {
      a, ns, mx,
      txt_spf: txt.find((t) => t.toLowerCase().includes("v=spf1"))?.slice(0, 200) ?? null,
    };
    const ip = a.find((x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x));
    if (ip) {
      rec.network_origin_ip = ip;
      const post = await ipPosture(ip);
      rec.asn = post.asn;
      if (rec.geo_source !== "exif") {
        rec.geo_lat = post.lat; rec.geo_lng = post.lng; rec.geo_source = post.lat != null ? "network" : null;
      }
      rec.geo_label = post.label;
    }
  }

  return rec;
}

/** Read at most `cap` bytes from a response, then abandon the rest. */
async function readCapped(res: Response, cap: number): Promise<ArrayBuffer> {
  const reader = res.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
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
  return out.buffer;
}

/** Bounded-concurrency map — the crawl never stampedes an origin. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i]); } catch { /* per-item failure is recorded upstream */ }
    }
  });
  await Promise.all(workers);
  return out.filter(Boolean);
}
