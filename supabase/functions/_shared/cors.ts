// Shared strict CORS + client-IP utilities for all edge functions.
// Replaces the wildcard `Access-Control-Allow-Origin: *` pattern that was
// previously copy-pasted into 90+ functions and exposed credentialed/financial
// endpoints to any origin.

const ALLOWED_ORIGINS = [
  // Canonical production origin (also the fallback echoed to unknown origins).
  "https://www.asherin.com",
  "https://asherin.com",
  // Lovable-hosted published origin.
  "https://ziali-magic-pixels.lovable.app",
  // Legacy brand domains — kept so old bookmarks keep working.
  "https://aureonai.app",
  "https://www.aureonai.app",
  "https://id-preview--5d5e1e10-9f71-4760-8dad-575a93313745.lovable.app",
  "https://5d5e1e10-9f71-4760-8dad-575a93313745.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Lovable preview/sandbox hosts for this project only.
  if (/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)) return true;
  // Published + preview Lovable app hosts (e.g. id-preview--<uuid>.lovable.app).
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin);
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
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": extraAllowedHeaders
      ? `${BASE_ALLOWED_HEADERS}, ${extraAllowedHeaders}`
      : BASE_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
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
