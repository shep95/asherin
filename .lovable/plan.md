# Aureon → Asherin — Full Rebrand Plan

Scope you approved: user-visible text, asset filenames, code identifiers, backend (edge functions, DB tables, storage keys, env vars), product tier names, Chrome extension name. **Domain `aureonai.app` stays** (I can't change DNS from here — you'd repoint it separately). **Sibling brands stay** (Zophiel, ZERLAL, AXRLEN, NOMAD, Zaxin, etc.).

## Measured impact

- **3,243 literal matches** of "aureon" across **448 files**
- **3 edge functions** to rename: `aureon-free-chat`, `aureon-shield-analyze`, `hoa-aureon-feed`
- **3 database tables** to rename: `aureon_vault_chunks`, `aureon_vault_sources`, `hoa_aureon_training_feed`
- **1 Chrome extension** package (`extension/manifest.json` → "Asherin Cross")
- **localStorage / IndexedDB namespaces** like `aureon-shield`, `aureon-*` keys

## Execution order (single sitting, ~30–40 min of work)

### Phase 1 — Backend (destructive, runs first)
1. **DB migration**: `ALTER TABLE … RENAME TO …` for the 3 tables. Non-destructive to data — rows survive, RLS policies auto-attach to the new name. Old table names are gone permanently.
2. **Rename edge function folders** on disk, redeploy under new names. Delete the 3 old function deployments so nothing hangs on the stale URL.
3. **Update every `supabase.functions.invoke("aureon-…")` call** in the client + edge functions to the new names.
4. **Env vars**: rename `AUREON_ADMIN_EMAIL` → `ASHERIN_ADMIN_EMAIL` in `_shared/constants.ts` (keep the old name as fallback for one deploy cycle so nothing 500s mid-swap).

### Phase 2 — Code identifiers & folders
- Rename directories: `src/components/aureon-shield/` → `src/components/asherin-shield/`, `src/lib/aureonShield/` → `src/lib/asherinShield/`, `src/components/asher/AsherAureon*` → `AsherAsherin*`, etc.
- Rename components: `AureonDomainGate`, `AureonEngineToggle`, `AureonView`, `AureonChat`, `useAureon*` hooks, plus every import site.
- Rename variables / class names / CSS class prefixes that contain `aureon`.

### Phase 3 — Assets & static files
- Rename asset pointers: `aureon-*.png.asset.json` → `asherin-*.png.asset.json` (the CDN URL stays; only the local filename changes so imports resolve).
- Update `public/manifest.json` PWA name, `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml`, `index.html` `<title>`/OG/meta.
- Rename `extension/` package name to "Asherin Cross", bump version, repackage the ZIP in `public/`.

### Phase 4 — User-visible copy
- Global find/replace across `src/pages/**`, `src/components/**`, blog posts, glossary, pricing, subscription copy: "Aureon" → "Asherin", "Aureon Pro" → "Asherin Pro", "aureonai.app" mentions stay as the literal domain, "Lovable Cloud" naming rules preserved.
- SEO: title, meta description, JSON-LD `name`, canonical, sitemap entries.
- `src/lib/asherBrainRouter.ts`, system prompts, chat identity strings: swap brand references.
- Memory files under `mem://` that use "Aureon" get updated in the same pass.

### Phase 5 — Verify live
1. TypeScript build must pass clean.
2. Boot the app; smoke-check: landing loads, `/pricing` says Asherin, `/software` shows Asherin/Asherin Pro tiers, dashboard mounts, chat streams a reply, `/shield` still works after the folder rename.
3. Playwright screenshot pass on 6 key routes (`/`, `/pricing`, `/software`, `/founder`, `/dashboard`, `/blog`) to confirm no stray "Aureon" text and no broken images.
4. Query the renamed tables + invoke each renamed edge function to prove they respond.

## Risks I'll actively guard against

- **In-flight user sessions** relying on old localStorage keys (`aureon-shield-*`, wallpapers, chat drafts). I'll add a one-time migration shim that copies old keys → new keys on first load, then deletes the old keys.
- **Stripe product names**: I'll rename the display names in the UI but leave the Stripe `price_*` IDs alone so existing subscribers don't get orphaned. You'll want to update the product names in the Stripe dashboard yourself for invoicing.
- **External inbound links** to old edge function URLs (Chrome extension, third-party integrations) will break. The extension gets rebuilt in the same pass; anything external you use I need you to name.
- **DB table rename** is not reversible without another migration. I'll write a rollback migration alongside.
- **Memory files (`mem://`)** referencing "Aureon" will be rewritten to "Asherin" so future sessions stay consistent.

## Not in scope (call out explicitly)

- DNS / domain `aureonai.app` — stays. Rebrand copy will still surface it as the current URL.
- Sibling product names (Zophiel, ZERLAL, AXRLEN, NOMAD, Zaxin, ZERION, ZALI, ZACOON, CROSS, etc.) — unchanged per your answer.
- Stripe backend product IDs — display names only.
- Historical blog post URLs — kept as-is to preserve SEO; only body copy updated.

## Confirm before I execute

The DB rename + edge function rename + folder renames are the destructive parts. Reply **"go"** and I'll run Phase 1 → 5 in order and report before/after when done. If you want me to skip any phase (e.g., leave DB tables alone), tell me now.
