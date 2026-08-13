# Asherin edge hardpass — apply guide

Closes internal REPORT 1 (CWE-755: SPA catch-all soft-404 on `/.git/*` + `x-deployment-id`
fingerprint leak). These are **edge-layer** defects: the application bundle cannot fix them,
because the host answers before any app code runs. Deploy one of the two options below.

## Blocker measured 13 August 2026 — read this before Option A

`dig NS asherin.com` answers `ns15.domaincontrol.com` / `ns16.domaincontrol.com`. The zone is on
**GoDaddy nameservers, not Cloudflare**. The `cf-ray` header on responses comes from the CDN in
front of the *hosting provider*, which is not an account the operator can attach a worker to.

Consequence, stated plainly: **Options A and B cannot be applied in their current form.** Anyone
running `wrangler deploy` today will get "zone not found" for the `asherin.com/*` route. Until the
step below is done, `GET https://asherin.com/.git/HEAD` keeps answering `200 text/html` with the
SPA shell, and no file inside this repository changes that — `public/_headers` and
`public/_redirects` are both ignored by the current host (verified: the live response carries no
`x-frame-options` and no `content-security-policy` response header, only the `<meta>` CSP from
`index.html`, which cannot express `frame-ancestors`).

**Unblock (operator action, ~15 minutes, one DNS change):**

1. Add `asherin.com` as a site in a Cloudflare account (Free plan is sufficient for both options).
2. Copy the existing records Cloudflare imports — in particular keep the hosting CNAME/A records
   for `asherin.com` and `www`, and **add the missing MX records** while in there; the zone
   currently publishes none, so `security@asherin.com` does not receive mail today.
3. In GoDaddy, change the nameservers to the two Cloudflare nameservers shown.
4. Wait for the zone to go active, then run Option A.
5. Re-run `./verify-edge-deny.sh` and require every path to be `404 text/plain`.

If the operator will **not** move the zone, then Options A and B are unavailable and the only
remaining lever is the hosting provider's own path rules. In that case do not mark this finding
resolved — the soft-404 stays live and should be tracked as accepted risk, not as fixed.

## Option A — Cloudflare Worker (recommended, closes both halves)

```bash
cd cloudflare
npx wrangler login
npx wrangler deploy
```

`wrangler.toml` binds the worker to `asherin.com/*` and `www.asherin.com/*`.
The worker:

- hard-404s VCS/secret/backup/CMS recon paths with `text/plain` + `x-robots-tag: noindex`;
- strips `x-deployment-id` (and `x-powered-by`, `via`, other build fingerprints) from
  **every** response, including the app shell;
- allows `/.well-known/*` through so `security.txt` and ACME/Apple/Google verification keep working;
- fails open on origin errors so the app can never be taken down by the deny layer.

## Option B — Cloudflare Configuration/WAF rule (closes the soft-404 half only)

The existing rule that already hard-404s `^/\.env` and `^/package\.json` proves this path works.
Add one custom rule:

- Expression: `http.request.uri.path matches "^/\\.(git|svn|hg|bzr|aws|ssh)(/|$)"`
- Action: Block, custom response `404`, `text/plain`, body `Not Found`

Then add a Transform Rule → Modify Response Header → **Remove** `x-deployment-id`.

## Retest

```bash
./verify-edge-deny.sh            # defaults to https://asherin.com
```

Pass criteria (per path): `404`, `content-type: text/plain`, body `Not Found`, no
`x-deployment-id` header. `/` must still be `200` and `/.well-known/security.txt` must
still be `200`.
