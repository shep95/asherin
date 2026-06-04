# Tablet Responsiveness Pass — All Pages

## Goal
Make every route render cleanly on tablet widths (600–1024px, both portrait & landscape), without breaking existing mobile (≤480px) or desktop (≥1280px) layouts.

## Scope (pages to audit & fix)
Landing + feature pages, dashboards, and utility pages:
- `src/pages/Index.tsx`, `Pricing.tsx`, `Asher.tsx`, `Analytics.tsx`, `ZophielFree.tsx`, `AxrlenFree.tsx`, `VedicAstrology.tsx`, `Forums.tsx`, `HouseOfAsherVentures.tsx`, `ProjAureon.tsx`, `PromptEngineering.tsx`, `TrackPage.tsx`, `Unsubscribe.tsx`, `NDA.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `NotFound.tsx`
- All `src/pages/Feature*.tsx` (≈35 files)
- Dashboard modules under `src/components/dashboard/**` (Zerlal, Nomad, Axrlen, Azplen, Zeeion, Aziion, etc.) that render full-screen views

## Approach
Tablet break = `md:` (768px) in Tailwind. Current code is built around `sm` (640) and `lg` (1024) — the `md` band is where things break (sidebars too wide, grids stuck at 1 col, hero text too big, tables overflow).

### 1. Global safety rails (`src/index.css`)
Extend the existing `@media (max-width: 480px)` block with a new `@media (min-width: 481px) and (max-width: 1024px)` block:
- Cap fixed-width sidebars (`aside.w-64`, `aside.w-72`, `w-80`) at `min(18rem, 32vw)`
- Force `[role="dialog"]` to `max-width: calc(100vw - 2rem)`
- Allow wide tables and grids with `grid-cols-3/4/5/6` to wrap to 2 cols
- Reduce oversized hero typography (`text-6xl`/`text-7xl` → clamp)

### 2. Per-page fixes
For each page, audit and apply:
- **Hero sections**: swap fixed `text-7xl` → `text-5xl md:text-6xl lg:text-7xl`, padding `px-4 md:px-8 lg:px-12`
- **Grids**: `grid-cols-1 lg:grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Two-column layouts** (`flex` with fixed sidebar): collapse sidebar to top drawer or full-width row on `<lg`
- **Dashboards with side nav**: make nav collapsible/icon-only on tablet (already partially done in some); verify Zerlal, Nomad, Axrlen, Asher
- **Tables**: wrap in `.table-scroll`
- **Feature page shell** (`FeaturePageShell.tsx`): add `md:` breakpoints to its internal grid (single fix benefits all 35 Feature pages)

### 3. Verification
- Use `browser--view_preview` at 768×1024 (iPad portrait), 820×1180, 1024×768 (landscape)
- Screenshot key routes: `/`, `/pricing`, `/axrlen`, `/zophiel`, `/asher`, 3-4 feature pages, dashboard views
- Fix any overflow/clipping found

## Out of scope
- Functional/behavioral changes
- Mobile (<480px) — already handled
- Redesigns — only responsive layout adjustments

## Risks
- ~80 files touched. Will batch by category (global CSS → shell components → feature pages → dashboards) and verify after each batch.
- Some dashboard modules (Zerlal, Asher) have complex nav; may need explicit tablet nav state rather than CSS-only fix.
