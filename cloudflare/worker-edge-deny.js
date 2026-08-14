/**
 * ASHERIN — EDGE DENY WORKER
 *
 * Purpose (from internal hardpass REPORT 1, CWE-755 / security misconfiguration):
 *   1. VCS / secret / recon paths (`/.git/*`, `/.svn/*`, `/.hg/*`, `/.env*`, …)
 *      currently fall through to the SPA catch-all and answer `200 text/html`
 *      with the app shell. That is a soft-404: scanners read it as "path exists".
 *      This worker turns every such path into a real `404 text/plain Not Found`.
 *   2. Every HTML response leaks `x-deployment-id`, a stable host fingerprint.
 *      This worker strips that header (and other build fingerprints) from all
 *      responses, denied or not.
 *
 * Design constraints:
 *   - Fail-open on origin errors: the worker must never take the app down. Any
 *     unexpected throw returns the untouched origin response.
 *   - Deny decision is path-only and allocation-free: one lowercase pass plus a
 *     precompiled regex, O(1) per request, no upstream fetch for denied paths.
 *   - Deny responses carry `x-robots-tag: noindex` so a crawler that already has
 *     the URL drops it from the index instead of caching a 404 body.
 *   - Legitimate dot-paths under `/.well-known/` are explicitly allowed first,
 *     otherwise `security.txt` and ACME/Apple/Google verification break.
 */

/** Paths that must always survive the dot-file deny (checked before DENY). */
const ALLOW_PREFIXES = ["/.well-known/"];

/**
 * Recon paths that must hard-404.
 * Anchored, case-insensitive, no catastrophic backtracking (no nested quantifiers).
 */
const DENY = new RegExp(
  "^(?:" +
    // version control metadata
    "/\\.git(?:/|$)" +
    "|/\\.svn(?:/|$)" +
    "|/\\.hg(?:/|$)" +
    "|/\\.bzr(?:/|$)" +
    "|/_darcs(?:/|$)" +
    // credentials / config
    "|/\\.env[^/]*" +
    "|/\\.aws(?:/|$)" +
    "|/\\.ssh(?:/|$)" +
    "|/\\.npmrc$" +
    "|/\\.netrc$" +
    "|/\\.htpasswd$" +
    "|/\\.htaccess$" +
    "|/\\.dockerenv$" +
    "|/\\.docker(?:/|$)" +
    "|/\\.vscode(?:/|$)" +
    "|/\\.idea(?:/|$)" +
    "|/\\.terraform(?:/|$)" +
    "|/docker-compose\\.ya?ml$" +
    "|/wrangler\\.toml$" +
    // build / dependency manifests
    "|/package(?:-lock)?\\.json$" +
    "|/bun\\.lockb?$" +
    "|/yarn\\.lock$" +
    "|/pnpm-lock\\.yaml$" +
    "|/composer\\.(?:json|lock)$" +
    "|/Gemfile(?:\\.lock)?$" +
    "|/requirements\\.txt$" +
    "|/tsconfig[^/]*\\.json$" +
    "|/vite\\.config\\.[cm]?[jt]s$" +
    // dumps / backups / keys anywhere in the tree
    "|/[^?]*\\.(?:sql|bak|old|swp|pem|key|p12|pfx|kdbx|ovpn|log|sqlite3?|db)$" +
    // classic CMS / admin probes that do not exist here
    "|/wp-(?:admin|login\\.php|content|includes)(?:/|$)" +
    "|/phpmyadmin(?:/|$)" +
    "|/phpinfo\\.php$" +
    "|/server-(?:status|info)$" +
    "|/cgi-bin(?:/|$)" +
    "|/actuator(?:/|$)" +
    "|/telescope(?:/|$)" +
    "|/config\\.(?:json|ya?ml|php)$" +
    // Backend-shaped prefixes that exist on the Supabase host, never here. The
    // SPA catch-all used to answer these with 200 HTML, which reads to a
    // scanner as "this origin proxies the API" (REPORT 4 soft-404 expansion).
    "|/debug(?:/|$)" +
    "|/api/internal(?:/|$)" +
    "|/rest/v1(?:/|$)" +
    "|/functions/v1(?:/|$)" +
    "|/storage/v1(?:/|$)" +
    "|/auth/v1(?:/|$)" +
    "|/graphql/v1(?:/|$)" +
    ")",
  "i",
);

/** Fingerprint headers stripped from every response. */
const STRIP_HEADERS = ["x-deployment-id", "x-powered-by", "x-vercel-id", "x-served-by", "x-nf-request-id", "via"];

/**
 * Browser-hardening headers (REPORT 5). A <meta> CSP cannot express
 * frame-ancestors and is ignored for framing decisions, so the real policy has
 * to arrive as a response header. Kept byte-compatible with the meta policy in
 * index.html so nothing the app already loads is newly blocked.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://fonts.googleapis.com https://js.stripe.com https://cdn.gpteng.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' wss://*.supabase.co https://*.supabase.co https://*.supabase.in https://api.stripe.com https://api.allorigins.win https://ipapi.co https://api.ipify.org https://haveibeenpwned.com https://cloudflare-dns.com https://nominatim.openstreetmap.org https://api.open-meteo.com https://overpass-api.de https://overpass.kumi.systems https://router.project-osrm.org https://server.arcgisonline.com https://*.googleapis.com https://*.google.com https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://api.x.ai https://api.venice.ai https://api.mistral.ai https://*.elevenlabs.io https://crt.sh https://api.hyperliquid.xyz https://api.firecrawl.dev https://cdn.jsdelivr.net https://*.skyvdn.com https://*.dot.ca.gov https://s3-eu-west-1.amazonaws.com https://api.weather.gov https://earthquake.usgs.gov https://waterservices.usgs.gov https://air-quality-api.open-meteo.com https://api.panoramax.xyz https://hazards.fema.gov https://aviationweather.gov https://services3.arcgis.com https://opensky-network.org https://tile.openstreetmap.org https://storage.googleapis.com https://vpic.nhtsa.dot.gov https://api.nhtsa.gov https://opendata.rdw.nl https://geocoding.geo.census.gov https://api.tidesandcurrents.noaa.gov https://geo.txdps.state.tx.us https://gis.fdle.state.fl.us https://haveibeenpwned.com https://api.pwnedpasswords.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://platform.twitter.com https://www.instagram.com https://www.tiktok.com https://www.redditmedia.com https://www.facebook.com https://open.spotify.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.supabase.co https://api.stripe.com",
].join("; ");

const SECURITY_HEADERS = {
  "content-security-policy": CSP,
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "permissions-policy":
    "camera=(self), microphone=(self), payment=(self), geolocation=(self), usb=(), serial=(), midi=(), magnetometer=(self), gyroscope=(self), accelerometer=(self), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
};

/** @param {string} pathname */
export function shouldDeny(pathname) {
  const p = pathname.toLowerCase();
  for (const allow of ALLOW_PREFIXES) {
    if (p.startsWith(allow)) return false;
  }
  return DENY.test(p);
}

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

/** @param {Response} res */
function harden(res) {
  // A 304/204 has an immutable empty body; cloning headers is still safe.
  const out = new Response(res.body, res);
  for (const h of STRIP_HEADERS) out.headers.delete(h);
  // An origin that already sets a stricter policy wins; we only fill the gaps.
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  return out;
}

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      // Malformed URL can never be a legitimate app request.
      return notFound();
    }

    if (shouldDeny(url.pathname)) return notFound();

    try {
      const res = await fetch(request);
      return harden(res);
    } catch (err) {
      // Fail-open: never convert an origin hiccup into a worker outage.
      return new Response("Bad Gateway", {
        status: 502,
        headers: { "content-type": "text/plain; charset=UTF-8", "cache-control": "no-store" },
      });
    }
  },
};
