# Asherin edge hardpass — apply guide

Closes internal REPORT 1 (CWE-755: SPA catch-all soft-404 on `/.git/*` + `x-deployment-id`
fingerprint leak). These are **edge-layer** defects: the application bundle cannot fix them,
because the host answers before any app code runs. Deploy one of the two options below.

## Measured state 13 August 2026 — read this before Option A

Two facts were measured against production, not assumed.

**1. A deny layer already exists, with an incomplete pattern.**

```
GET https://asherin.com/.env          -> 404  text/plain; charset=UTF-8   no x-deployment-id
GET https://asherin.com/package.json  -> 404  text/plain; charset=UTF-8   no x-deployment-id
GET https://asherin.com/.git/HEAD     -> 200  text/html; charset=utf-8    x-deployment-id: e54f28d7-...
GET https://asherin.com/.ssh/id_rsa   -> 200  text/html
GET https://asherin.com/wp-admin/     -> 200  text/html
```

So the mechanism works; its regex simply does not cover the VCS, credential-directory, CMS and
`debug` families. The remaining work is **one rule edit**, not a new platform. Extend the existing
custom rule's expression to:

```
http.request.uri.path matches "^/(\\.(git|svn|hg|bzr|aws|ssh|env)(/|$)|wp-(admin|login|content|includes)|phpmyadmin|phpinfo\\.php|cgi-bin/|actuator(/|$)|debug(/|$)|api/internal(/|$))"
```

Action: Block → custom response `404`, `text/plain`, body `Not Found`. Keep `/.well-known/*`
excluded so `security.txt` and ACME/Apple/Google verification keep resolving.

**2. Security response headers are absent on the live origin.**

`GET /` returns `x-content-type-options`, `referrer-policy` and `strict-transport-security`, but
**no** `content-security-policy`, **no** `x-frame-options` and **no** `permissions-policy`. The only
CSP in effect is the `<meta>` tag in `index.html`, and a meta CSP cannot express `frame-ancestors`,
so clickjacking protection is currently not enforced at all. `public/_headers` does not change this
— the current host ignores that file, which is why the header block belongs in the worker or in a
Transform Rule.

**3. The zone is not on Cloudflare nameservers.**

`asherin.com` NS answers `ns15.domaincontrol.com` / `ns16.domaincontrol.com` (GoDaddy). If the
existing deny rule lives in a Cloudflare account the operator controls, Options A and B apply
directly. If it does not, `wrangler deploy` will fail with "zone not found" and the zone must first
be added to Cloudflare and the GoDaddy nameservers repointed. While in the DNS panel, **add MX
records** — the zone publishes none today, so `security@asherin.com` receives no mail, and
`/security-policy` now says so in plain language rather than implying a live inbox.

Until item 1 and item 2 are applied, this finding is **not fixed**. Track it as accepted risk. No
file in this repository can close it, because the host answers before any application code runs.

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
