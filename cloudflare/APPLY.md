# Asherin edge hardpass — apply guide

Closes internal REPORT 1 (CWE-755: SPA catch-all soft-404 on `/.git/*` + `x-deployment-id`
fingerprint leak). These are **edge-layer** defects: the application bundle cannot fix them,
because the host answers before any app code runs. Deploy one of the two options below.

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
