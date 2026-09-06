# asherin.search — full rebuild

Replace the current search room with a discovery-first engine that operates in the space commercial search skips: orphan pages, exposed code/infra, paste dumps, and identity pivots. No link-graph crawl, no seo priority filter, honest "unmeasured" states for sources that need keys or paid access.

## What the user gets

One room, `asherin.search`, with three modes:

1. **Discover** — enter a domain (or seed url). The engine fans out across:
   - certificate transparency (crt.sh) → every subdomain ever issued a cert
   - dns enumeration (Google DoH + wordlist) → live subdomains not in cert logs
   - wayback CDX → every url the archive has ever captured for the domain
   - common crawl CDX index → urls seen in the last monthly dump
   - github code search → files and commits mentioning the domain, env keys, sourcemaps, `.git` refs
   - url pattern probe → live check for `/robots.txt`, `/.env`, `/.git/HEAD`, `/config.json`, `/backup/`, `/admin/`, `/staging/`, `/dev/`, `/api/v1/`, `/uploads/`, sourcemap suffixes, jupyter, s3 xml listings
   - shodan / censys — surfaced as **unmeasured — requires api key** until the operator adds one
   - pastebin realtime scrape API — **unmeasured — vendor closed the free feed**; the row explains why

   Every hit is stamped with source, first-seen, live/dead recheck, exposure class (orphan / code-leak / directory / config / credential / paste), and a sensitivity score.

2. **Identity** — enter a name, email, or phone. Runs a pivot chain: each new identifier a source returns is auto-requeued.
   - email → gravatar, github users + commits, wayback captures, keyserver (keys.openpgp.org), crt.sh by S/MIME, xposedornot breach index (free)
   - phone → NANP carrier lookup via free numverify-style probe (unmeasured without key), OpenCNAM (unmeasured), reverse via wayback CDX
   - name → SEC EDGAR full-text, FCC ULS, FAA airmen (public json), Wikidata, GitHub user search, wayback + Google Groups CDX
   - each finding renders a source-tier badge and a "why this matched" note; the pivot graph shows what unlocked what

3. **Paste stream** — a live tail of what the free paste feeds still expose (rentry public list, paste.rs, gist recent). Anything that requires a paid feed reads unmeasured with the reason.

## Ranking

Novelty (first-seen desc) + exposure score, not pagerank. Filters: content type, language, exposure class, sensitivity, source, freshness (live recheck within N minutes).

## Technical plan

### New edge functions (Deno, authenticated)
- `supabase/functions/asherin-search-discover/index.ts` — orchestrator for the Discover mode. Input `{ seed, sources? }`. Fans out with `Promise.allSettled`, per-source 12s timeout, bounded concurrency, streams SSE progress.
- `supabase/functions/asherin-search-identity/index.ts` — orchestrator for Identity mode with pivot chain (max depth 3, max fanout 40, cycle guard).
- `supabase/functions/asherin-search-probe/index.ts` — low-cost live recheck for a single stored hit (used from the UI's "still live?" button).
- Shared helpers under `supabase/functions/_shared/discover/` — `crtsh.ts`, `doh.ts`, `waybackCdx.ts`, `commonCrawl.ts`, `githubSearch.ts`, `urlPatterns.ts`, `identitySources.ts`, `pivot.ts`, `sensitivity.ts`, `tierBadges.ts`.

### Storage (migration)
- `search_discover_runs(id, user_id, seed, kind, started_at, ended_at, status)`
- `search_hits(id, run_id, user_id, source, url, kind, first_seen_at, last_probed_at, live, http_status, content_type, language, exposure_class, sensitivity, evidence_excerpt, meta jsonb)`
- `search_identity_pivots(id, run_id, parent_hit_id, identifier, kind, depth)`
- Owner-scoped RLS + GRANTs on all three; RLS lets operator read own rows; service_role for functions.

### Frontend
- New `src/components/dashboard/search/AsherinSearchView.tsx` — single glassmorphic room, tabs Discover / Identity / Paste, no sweep/ghost/shadow/etc. Streams SSE progress, renders results with source tier badges, exposure class chips, sensitivity dot, live-recheck button, evidence excerpt, and a pivot graph for identity mode (svg, no heavy libs).
- `src/components/dashboard/search/discover/` — small, focused subcomponents (`SourceStatusRow`, `HitCard`, `ExposureBadge`, `PivotGraph`, `LiveRecheckButton`).
- Wire route: `Dashboard.tsx` swaps `ZophielEngineView` for `AsherinSearchView` on the `asherin.search` intent. Old view file deleted along with its now-orphan panels (sweep, ghost, shadow, dataengine, imagine, zerlal, openvpn, link-extract, doc-harvest, archives already retired last turn — this removes the actual files too).
- `SearchModeSelector` reduced to the three modes.

### Honesty rules
- Any source that needs a paid key renders as **unmeasured — requires \<key name\>** with a one-line explanation.
- Any source whose free feed is closed (pastebin scrape) reads **unmeasured — vendor closed the free feed**.
- Nothing simulates a hit. Empty is empty. Timeouts are reported.
- No claim of "monitors cert transparency continuously" — the run queries crt.sh on demand and stamps the response time.

### Tests
- Vitest for `sensitivity.ts` (scoring boundaries), `pivot.ts` (cycle guard, depth cap, fanout cap), and `urlPatterns.ts` (path generation).
- Deno checks for each function.
- Authenticated Playwright: sign in as a non-privileged Pro test user, open the room, run a Discover on `example.com`, confirm at least crt.sh and wayback return real rows, run an Identity on a made-up email that has no breaches, confirm zero-hit paths render honestly, then revoke access and clean the test rows.

### Removed
- `ZophielEngineView.tsx` and its panels: `ZophielSweepPanel`, `ZophielFusionPanel`, `ZophielV2Panel`, `ShadowPanel`, `OpenVpnPanel`, `LinkExtractView`, `LinkExtractIntelPanel`, `ScribdPanel`, `LinkedImageryMap`, `UrlIntelMapPanel` (kept only if reused by other rooms — checked before delete).
- Their edge-function callers are left in place under `supabase/functions/` (already retired at the UI level) so no other room breaks.

Nothing here overclaims. Everything is either a real free public source, or an honest unmeasured row that names what it needs to become measured.
