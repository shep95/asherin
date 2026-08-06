/**
 * Canonical Google OAuth redirect.
 *
 * Google matches `redirect_uri` against the Authorized redirect URIs of the
 * OAuth client as an exact string. The app is reachable from at least four
 * origins — the Lovable editor preview, the preview subdomain, the published
 * lovable.app host and the custom domain — so deriving the redirect from
 * `window.location.origin` produces a URI Google has never seen and it answers
 * `Error 400: redirect_uri_mismatch`.
 *
 * One URI is registered; every origin borrows it. The consent popup therefore
 * lands on the canonical origin, relays the authorization code back to the
 * origin that opened it (which holds the session), and that origin performs the
 * token exchange with this same canonical value. Google sees one URI at
 * authorize time and the identical URI at token time, which is its only
 * requirement.
 */

/**
 * The single URI registered in the Google Cloud OAuth client.
 *
 * This MUST be a byte-for-byte match of an entry under "Authorized redirect
 * URIs" on the OAuth client behind GOOGLE_CLIENT_ID. The rebrand to
 * asherin.com changed this value to a URI that was never registered, which is
 * exactly what Google reports as `Error 400: redirect_uri_mismatch` — the app
 * origin is irrelevant to Google, only this string is compared. It is pinned
 * back to the registered published host; the popup relays the code home, so
 * the flow still works from asherin.com, www.asherin.com and the preview.
 */
export const GOOGLE_REDIRECT_URI = "https://ziali-magic-pixels.lovable.app/dashboard";

export const GOOGLE_CANONICAL_ORIGIN = new URL(GOOGLE_REDIRECT_URI).origin;

/**
 * Origins allowed to exchange a relayed code, and allowed to receive one.
 * Anything outside this list is treated as hostile and ignored — a relayed
 * authorization code is a bearer credential for the user's Google grant.
 */
export function isTrustedAppOrigin(origin: string): boolean {
  if (!origin) return false;
  let host: string;
  let protocol: string;
  try {
    const u = new URL(origin);
    host = u.hostname;
    protocol = u.protocol;
  } catch {
    return false;
  }
  if (protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) return true;
  if (protocol !== "https:") return false;
  return (
    host === "asherin.com" ||
    host === "www.asherin.com" ||
    host === "lovable.app" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com")
  );
}
