// DOMAIN ZIP — Given a list of URLs, either:
//   mode="estimate" → run HEAD requests in parallel, return total bytes + per-type breakdown
//   mode="download" → fetch each URL and stream back a single ZIP file
//
// Limited to 250 URLs / 250MB per request to keep edge runtime safe.

import { getCorsHeaders } from "../_shared/cors.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

const UA = "Mozilla/5.0 (compatible; AureonZophielZip/1.0; +https://aureonai.app)";
const MAX_URLS = 250;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024; // 250 MB hard cap
const FETCH_TIMEOUT_MS = 15000;

interface FileMeta {
  url: string;
  status: number;
  ok: boolean;
  bytes: number;
  contentType: string;
  ext: string;
  error?: string;
}

function timedFetch(url: string, init: RequestInit = {}, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...init, signal: ctl.signal, redirect: "follow", headers: { "User-Agent": UA, ...(init.headers || {}) } })
    .finally(() => clearTimeout(t));
}

function extFromContentType(ct: string, url: string): string {
  const c = ct.toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "text/html": "html",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/epub+zip": "epub",
    "application/rtf": "rtf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  if (map[c]) return map[c];
  try {
    const m = new URL(url).pathname.match(/\.([a-z0-9]{1,5})$/i);
    if (m) return m[1].toLowerCase();
  } catch { /* ignore */ }
  return "bin";
}

function safeName(url: string, ext: string, idx: number, used: Set<string>): string {
  let base = "file";
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    base = seg.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  } catch { /* ignore */ }
  if (!base.toLowerCase().endsWith("." + ext)) base = `${base}.${ext}`;
  let name = `${String(idx).padStart(3, "0")}_${base}`;
  while (used.has(name)) name = `${String(idx).padStart(3, "0")}_${Math.random().toString(36).slice(2, 6)}_${base}`;
  used.add(name);
  return name;
}

async function headProbe(url: string): Promise<FileMeta> {
  try {
    let r = await timedFetch(url, { method: "HEAD" });
    // some servers don't support HEAD properly — fall back to ranged GET
    if (!r.ok || !r.headers.get("content-length")) {
      r = await timedFetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    }
    const cl = r.headers.get("content-length");
    const cr = r.headers.get("content-range"); // bytes 0-0/12345
    let bytes = cl ? parseInt(cl, 10) : 0;
    if (!bytes && cr) {
      const m = cr.match(/\/(\d+)$/);
      if (m) bytes = parseInt(m[1], 10);
    }
    const contentType = r.headers.get("content-type") || "application/octet-stream";
    return {
      url, status: r.status, ok: r.ok || r.status === 206,
      bytes: isFinite(bytes) ? bytes : 0,
      contentType,
      ext: extFromContentType(contentType, url),
    };
  } catch (e) {
    return { url, status: 0, ok: false, bytes: 0, contentType: "", ext: "bin", error: String((e as any)?.message || e) };
  }
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "estimate", urls = [], zipName = "aureon-domain-bundle.zip" } = await req.json() as {
      mode?: "estimate" | "download"; urls?: string[]; zipName?: string;
    };

    if (!Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "urls[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const list = urls.slice(0, MAX_URLS).filter((u) => /^https?:\/\//i.test(u));
    if (!list.length) {
      return new Response(JSON.stringify({ error: "no valid http(s) urls" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ESTIMATE ─────────────────────────────────────────────────────────────
    if (mode === "estimate") {
      const concurrency = 12;
      const results: FileMeta[] = [];
      let i = 0;
      async function worker() {
        while (i < list.length) {
          const idx = i++;
          results[idx] = await headProbe(list[idx]);
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

      const byType: Record<string, { count: number; bytes: number }> = {};
      let totalBytes = 0, ok = 0, failed = 0, unknownSize = 0;
      for (const r of results) {
        if (r.ok) ok++; else failed++;
        if (r.bytes > 0) totalBytes += r.bytes; else if (r.ok) unknownSize++;
        const k = r.ext || "bin";
        byType[k] ||= { count: 0, bytes: 0 };
        byType[k].count++;
        byType[k].bytes += r.bytes;
      }
      return new Response(JSON.stringify({
        success: true,
        mode: "estimate",
        requested: urls.length,
        scanned: list.length,
        ok, failed, unknownSize,
        totalBytes,
        byType,
        files: results,
        capped: urls.length > MAX_URLS,
        maxUrls: MAX_URLS,
        maxTotalBytes: MAX_TOTAL_BYTES,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── DOWNLOAD (build ZIP) ─────────────────────────────────────────────────
    const zip = new JSZip();
    const used = new Set<string>();
    const manifest: Array<{ name: string; url: string; status: number; bytes: number; type: string }> = [];
    let total = 0;
    let idx = 0;
    const concurrency = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < list.length && total < MAX_TOTAL_BYTES) {
        const myIdx = cursor++;
        const url = list[myIdx];
        try {
          const r = await timedFetch(url, { method: "GET" });
          if (!r.ok) {
            manifest.push({ name: "(skipped)", url, status: r.status, bytes: 0, type: "" });
            continue;
          }
          const buf = new Uint8Array(await r.arrayBuffer());
          if (total + buf.byteLength > MAX_TOTAL_BYTES) {
            manifest.push({ name: "(skipped-size-cap)", url, status: r.status, bytes: buf.byteLength, type: r.headers.get("content-type") || "" });
            continue;
          }
          const ct = r.headers.get("content-type") || "application/octet-stream";
          const ext = extFromContentType(ct, url);
          const name = safeName(url, ext, ++idx, used);
          zip.file(name, buf);
          total += buf.byteLength;
          manifest.push({ name, url, status: r.status, bytes: buf.byteLength, type: ct });
        } catch (e) {
          manifest.push({ name: "(error)", url, status: 0, bytes: 0, type: String((e as any)?.message || e) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

    zip.file("_manifest.json", JSON.stringify({
      generated_at: new Date().toISOString(),
      total_files: idx,
      total_bytes: total,
      files: manifest,
    }, null, 2));

    const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const safeZipName = zipName.replace(/[^a-zA-Z0-9._-]/g, "_") || "aureon-bundle.zip";

    return new Response(blob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeZipName}"`,
        "X-Aureon-Files": String(idx),
        "X-Aureon-Bytes": String(total),
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
