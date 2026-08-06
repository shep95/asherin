/**
 * Canonical-host enforcement.
 *
 * The app is reachable on several hostnames (legacy `aureonai.app`, the
 * Lovable publish host, `www.asherin.com`). When more than one of them serves
 * the same HTML, Google is free to pick whichever it crawled first as the
 * canonical URL — which is how `aureonai.app` ended up outranking the primary
 * domain and splitting link/authority signals between two identical sites.
 *
 * Every route already emits `<link rel="canonical">` on https://asherin.com,
 * both in the prerendered HTML and at runtime. This module closes the
 * remaining gap: a visitor (or crawler) that lands on a duplicate host is sent
 * to the same path on the canonical host, so the duplicate stops accumulating
 * its own index entries.
 *
 * Deliberate constraints:
 *  - Only exact, hardcoded duplicate hosts redirect. No wildcard/suffix
 *    matching, so a preview, a branch deploy, or localhost is never hijacked.
 *  - The destination host is a constant. The incoming host never contributes
 *    to the redirect target, so a spoofed `Host` cannot bounce a user offsite.
 *  - Only `pathname + search + hash` is carried over, all re-encoded through
 *    the URL constructor — never a raw string concat that could smuggle an
 *    authority section (`//evil.com`) into the target.
 *  - `location.replace` keeps the duplicate URL out of session history, so
 *    Back does not bounce the user into a redirect loop.
 */

const CANONICAL_ORIGIN = "https://asherin.com";

/** Exact hostnames that duplicate the canonical site and must not be indexed. */
const DUPLICATE_HOSTS = new Set([
  "aureonai.app",
  "www.aureonai.app",
  "www.asherin.com",
]);

export function enforceCanonicalHost(): void {
  if (typeof window === "undefined") return;

  const { location } = window;

  // Never redirect off a non-https origin: that is a local dev server or a
  // sandbox, where forcing production would break the session entirely.
  if (location.protocol !== "https:") return;

  if (!DUPLICATE_HOSTS.has(location.hostname.toLowerCase())) return;

  // Build the target from the constant origin, letting the URL constructor
  // normalise the path. `pathname` always begins with "/", and passing it as a
  // relative reference against a fixed base means the result can only ever be
  // on CANONICAL_ORIGIN.
  const target = new URL(
    `${location.pathname}${location.search}${location.hash}`,
    CANONICAL_ORIGIN,
  );

  // Defensive: if anything about the incoming path managed to change the
  // origin, abandon the redirect rather than send the user somewhere unknown.
  if (target.origin !== CANONICAL_ORIGIN) return;

  location.replace(target.toString());
}
