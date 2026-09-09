# Unified cinematic redesign for eight Asherin rooms

## Goal
Bring `asherin.cyber`, `asherin.extract`, `asherin.briefing`, `asherin.data`, `asherin.snippets`, `asherin.design` (Zali), `asherin.slides`, and `asherin.ebooks` into one dark, cold, architectural interface language without changing their existing workflows or capabilities.

## Build
- Add one shared room atmosphere at the dashboard frame: layered near-black surfaces, faint infrastructure/grid geometry, restrained edge lighting, generous negative space, and a single green “live/trusted” signal treatment.
- Refine the shared V2 header into a quiet system status bar with consistent product naming, subtle room index/state, and responsive spacing.
- Add reusable room styling primitives for panels, controls, labels, empty states, and selected states so the eight tools feel related rather than separately themed.
- Apply those primitives to the primary visual seams of all eight rooms, replacing bright amber-heavy accents and generic card styling while preserving tool logic.
- Normalize visible names to `asherin.cyber`, `asherin.extract`, `asherin.briefing`, `asherin.data`, `asherin.snippets`, `asherin.design`, `asherin.slides`, and `asherin.ebooks`.
- Keep wallpapers visible around the framed software room and maintain mobile/tablet behavior.

## Verification
- Run focused tests/build checks.
- Open all eight authenticated dashboard routes and verify their real empty/data states at desktop and mobile widths.
- Check interactions, overflow, console errors, visual hierarchy, and that no capability behavior changed.

## Technical notes
- The implementation will reuse `DashboardSurface` and `V2PageShell`; no new backend, subscription, or business-logic work is needed.
- Existing persistence keys remain unchanged to avoid resetting user preferences.
