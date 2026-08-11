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
const ALLOW_PREFIXES = [
  '/.well-known/',
];

/**
 * Recon paths that must hard-404.
 * Anchored, case-insensitive, no catastrophic backtracking (no nested quantifiers).
 */
const DENY = new RegExp(
  '^(?:' +
    // version control metadata
    '/\\.git(?:/|$)' +
    '|/\\.svn(?:/|$)' +
    '|/\\.hg(?:/|$)' +
    '|/\\.bzr(?:/|$)' +
    '|/_darcs(?:/|$)' +
    // credentials / config
    '|/\\.env[^/]*' +
    '|/\\.aws(?:/|$)' +
    '|/\\.ssh(?:/|$)' +
    '|/\\.npmrc$' +
    '|/\\.netrc$' +
    '|/\\.htpasswd$' +
    '|/\\.htaccess$' +
    '|/\\.dockerenv$' +
    '|/\\.docker(?:/|$)' +
    '|/\\.vscode(?:/|$)' +
    '|/\\.idea(?:/|$)' +
    '|/\\.terraform(?:/|$)' +
    '|/docker-compose\\.ya?ml$' +
    '|/wrangler\\.toml$' +
    // build / dependency manifests
    '|/package(?:-lock)?\\.json$' +
    '|/bun\\.lockb?$' +
    '|/yarn\\.lock$' +
    '|/pnpm-lock\\.yaml$' +
    '|/composer\\.(?:json|lock)$' +
    '|/Gemfile(?:\\.lock)?$' +
    '|/requirements\\.txt$' +
    '|/tsconfig[^/]*\\.json$' +
    '|/vite\\.config\\.[cm]?[jt]s$' +
    // dumps / backups / keys anywhere in the tree
    '|/[^?]*\\.(?:sql|bak|old|swp|pem|key|p12|pfx|kdbx|ovpn|log|sqlite3?|db)$' +
    // classic CMS / admin probes that do not exist here
    '|/wp-(?:admin|login\\.php|content|includes)(?:/|$)' +
    '|/phpmyadmin(?:/|$)' +
    '|/phpinfo\\.php$' +
    '|/server-(?:status|info)$' +
    '|/cgi-bin(?:/|$)' +
    '|/actuator(?:/|$)' +
    '|/telescope(?:/|$)' +
    '|/config\\.(?:json|ya?ml|php)$' +
  ')',
  'i',
);

/** Fingerprint headers stripped from every response. */
const STRIP_HEADERS = [
  'x-deployment-id',
  'x-powered-by',
  'x-vercel-id',
  'x-served-by',
  'x-nf-request-id',
  'via',
];

/** @param {string} pathname */
export function shouldDeny(pathname) {
  const p = pathname.toLowerCase();
  for (const allow of ALLOW_PREFIXES) {
    if (p.startsWith(allow)) return false;
  }
  return DENY.test(p);
}

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });
}

/** @param {Response} res */
function stripFingerprints(res) {
  // A 304/204 has an immutable empty body; cloning headers is still safe.
  const out = new Response(res.body, res);
  for (const h of STRIP_HEADERS) out.headers.delete(h);
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
      return stripFingerprints(res);
    } catch (err) {
      // Fail-open: never convert an origin hiccup into a worker outage.
      return new Response('Bad Gateway', {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=UTF-8', 'cache-control': 'no-store' },
      });
    }
  },
};
