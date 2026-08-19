// Shared strict CORS + client-IP utilities for all edge functions.
// Replaces the wildcard `Access-Control-Allow-Origin: *` pattern that was
// previously copy-pasted into 90+ functions and exposed credentialed/financial
// endpoints to any origin.

const ALLOWED_ORIGINS = [
  "https://asherin.com",
  "https://www.asherin.com",
  "https://id-preview--5d5e1e10-9f71-4760-8dad-575a93313745.lovable.app",
  "https://ziali-magic-pixels.lovable.app",
  "https://preview--ziali-magic-pixels.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

const THIS_PROJECT_ID = "5d5e1e10-9f71-4760-8dad-575a93313745";
const THIS_PREVIEW_SLUG = "ziali-magic-pixels";

/**
 * Exact-match allowlist, plus this project's lovable preview hosts only.
 * never `*.lovable.app`. unknown origins still echo production.
 */
function isThisProjectLovablePreview(origin: string): boolean {
  if (!origin.startsWith("https://")) return false;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  const idPreview = new RegExp(
    "^id-preview(-[a-z0-9]+)?--" + THIS_PROJECT_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.lovable\\.app$",
  );
  const namedPreview = new RegExp(
    "^preview--" + THIS_PREVIEW_SLUG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\.[a-z0-9-]+)?\\.lovable\\.app$",
  );
  return idPreview.test(host) || namedPreview.test(host);
}

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || isThisProjectLovablePreview(origin);
}

const BASE_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/**
 * Build CORS headers reflecting the caller's Origin only if it is on the
 * allowlist. Otherwise echoes the canonical production origin so unknown
 * origins still get a valid (but useless to them) preflight response.
 */
export function getCorsHeaders(req: Request, extraAllowedHeaders = ""): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  // Unknown origin: never reflect it. Answer with the canonical production
  // origin so the preflight is well-formed but useless to the caller.
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": extraAllowedHeaders
      ? `${BASE_ALLOWED_HEADERS}, ${extraAllowedHeaders}`
      : BASE_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

/**
 * Extract the real client IP from trusted infrastructure headers.
 * NEVER read source_ip from a client-supplied POST body — attackers can spoof
 * any value and poison threat-intelligence / WAF tables on behalf of victims.
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export { ALLOWED_ORIGINS };
