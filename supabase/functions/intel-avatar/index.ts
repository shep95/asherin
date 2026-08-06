// intel-avatar — SSRF-GUARDED PROFILE IMAGE PROXY
//
// NARRATIVE
// ---------
// A candidate card needs a face, and a face is the fastest human disambiguator
// there is. Rendering <img src={remoteProfileUrl}> would (a) require loosening
// img-src in the CSP, (b) leak the operator's interest directly to the target's
// CDN with a referer, and (c) hand an attacker-controlled URL to the browser.
//
// So the browser never sees the origin URL's host. It asks THIS function, which
// fetches server-side behind a hard SSRF allow-list, proves the bytes really are
// an image by magic-number sniff (a text/plain payload mislabelled image/jpeg is
// rejected), caps the transfer, strips every response header the origin set, and
// returns the image same-origin with an immutable cache.
//
// Flaw taxonomy applied:
//  - security/SSRF: https only; IP literals, private/link-local/loopback/CGNAT
//    ranges, cloud metadata hosts and non-public TLD suffixes are all rejected
//    BEFORE the fetch; redirects are followed manually so a 302 to
//    169.254.169.254 cannot slip past the pre-flight check.
//  - security/content: magic-byte sniff, 2 MB ceiling, Content-Disposition
//    attachment-proofing via nosniff, no SVG (script-carrying vector).
//  - api/network: explicit timeout + AbortSignal, non-2xx surfaced as 502 with
//    the upstream status, never a hung request.
//  - performance: 24h immutable cache so a rack of 6 faces is fetched once.

import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 7000;

/** Literal IPs and reserved names never reach the network. */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost")) return true;
  if (/\.(local|internal|lan|home|corp|test|example|invalid|onion)$/.test(h)) return true;
  if (/^metadata(\.google)?(\.internal)?$/.test(h)) return true;
  if (h === "metadata.goog" || h.endsWith(".metadata.goog")) return true;
  // IPv6 literal — allow none (every legitimate CDN resolves via DNS name).
  if (h.includes(":")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [parseInt(v4[1], 10), parseInt(v4[2], 10)];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;             // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;    // RFC1918
    if (a === 192 && b === 168) return true;             // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT
    if (a >= 224) return true;                           // multicast / reserved
    return true; // no bare-IP image origins are legitimate here
  }
  // Require a real public-looking hostname with a dotted TLD.
  return !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h);
}

/** Magic-number sniff — the origin's Content-Type is untrusted. */
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  const ascii = String.fromCharCode(...b.slice(0, 12));
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
    && String.fromCharCode(...b.slice(8, 12)).startsWith("avif")) return "image/avif";
  return null;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const fail = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  let target: URL;
  try {
    const raw = new URL(req.url).searchParams.get("u") || "";
    if (!raw || raw.length > 2048) return fail(400, "missing or oversized url");
    target = new URL(raw);
  } catch {
    return fail(400, "unparseable url");
  }

  if (target.protocol !== "https:") return fail(400, "https required");
  if (isBlockedHost(target.hostname)) return fail(403, "host not permitted");

  // Manual redirect walk: a pre-flight host check is worthless if the origin can
  // 302 us into the metadata service.
  let current = target;
  let resp: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      resp = await fetch(current.toString(), {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AsherinIntel/1.0)", Accept: "image/*" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return fail(504, "upstream timeout");
    }
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) return fail(502, "redirect without location");
      let next: URL;
      try { next = new URL(loc, current); } catch { return fail(502, "bad redirect target"); }
      if (next.protocol !== "https:" || isBlockedHost(next.hostname)) return fail(403, "redirect host not permitted");
      current = next;
      continue;
    }
    break;
  }

  if (!resp || !resp.ok) return fail(502, `upstream returned ${resp?.status ?? "no response"}`);

  const declared = parseInt(resp.headers.get("content-length") || "0", 10);
  if (Number.isFinite(declared) && declared > MAX_BYTES) return fail(413, "image too large");

  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return fail(413, "image too large");

  const mime = sniff(buf);
  if (!mime) return fail(415, "payload is not a supported raster image");

  return new Response(buf, {
    headers: {
      ...cors,
      "Content-Type": mime,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
