# Strict BYOK + Link Extractor Intel Map

## Part 1 — Strict BYOK Enforcement

**Rule:** Only `ashernewtonx@gmail.com` may consume `GEMINI_API_KEY` / `GEMINI_API_KEY_APP`. Every other user MUST send a BYOK config or get a clean `403 BYOK_REQUIRED` response that the UI converts into a "Add your Gemini key" prompt.

### 1a. Shared admin gate helper
Create `supabase/functions/_shared/adminGate.ts`:
- `getCallerEmail(req)` — verifies the JWT against `auth.users` and returns the caller email (null if anon).
- `isAdminCaller(email)` — returns `email?.toLowerCase() === 'ashernewtonx@gmail.com'`.
- `requireKeyOrBYOK(req, byok)` — returns `{ mode: 'byok' | 'admin', key?: string, byok?: ZophielByokConfig }` or throws a 403 with code `BYOK_REQUIRED` and message "Bring your own Gemini key to use Zophiel Engine."

### 1b. Functions to refactor (drop silent admin-key fallback for non-admins)
All Zophiel/Aureon/Asher AI functions that currently read `GEMINI_API_KEY*` without admin check:

```
zophiel-intelmap, zophiel-deep-search, zophiel-code-audit, zophiel-intel-analysis,
zophiel-darkweb, zophiel-blueprint-extract, zerlal-scan, zerlal-exploit-intel,
nomad-investigate, aureon-shield-analyze, aziion-predict, axrlen-analyze, axrlen-chat,
cross-analyze, reis-analyze, zacoon-run, oracle-locus, asher-eyes-dossier,
asher-eyes-intent, asher-ai, asher-code-ai, asha-extract, asha-scrape, asha-query,
asha-report, asha-analyze, asha-monitor, asha-doc-intel, chat, chat-consensus,
zali-chat, zali-analyze, vedic-asher-chat, generate-briefing, briefing-onboard,
self-learning-loop, self-access-learning, generate-predictions, suggest,
plugin-execute, agent-execute, scrapper-extract, summarize-bug-reports,
chart-annotate, video-intelligence, vibe-imager, vibe-video, oracle-face-search,
asher-temporal-recon, asher-visual-recon, asher-property-intel, asher-phone-intel,
asher-archives-harvest, asher-live-feed, ava-generate-picks, coding-laws-engine,
zeeion-analyze
```

For each: insert the admin gate at the top of the handler. If non-admin AND no valid BYOK → return:
```json
{ "error": "BYOK_REQUIRED", "message": "Add your Gemini API key in Settings → BYOK" }
```
HTTP 403.

Skip purely-mechanical functions that don't call an AI (`zophiel-key-probe`, `zophiel-preview`, `zerlal-domain-recon`, `gemini-voice-token`, `oracle-face-search` if it's vision-API-only, etc.) — verify each before touching.

### 1c. Frontend
- Create `src/lib/byokGate.ts` — `handleByokError(err)` that detects `BYOK_REQUIRED` and routes user to the existing BYOK settings panel with a toast.
- Update the call sites already using `IntelMapByokPanel` pattern so all Zophiel views surface the BYOK error inline.

## Part 2 — Link Extractor Intel Map + Brain Chat

### 2a. Intel Map for Link Extractor
- New edge function `link-intel-map` (clone of `zophiel-intelmap`, retuned for URL forensics). System prompt focuses on: domain ownership, hosting stack, certificate chain, related domains, exposed paths, JS bundle leaks, breach signals, archived versions, social/SEO footprint.
- New component `src/components/dashboard/search/LinkIntelMapPanel.tsx` — same node/edge graph treatment as `IntelMapPanel`, fed by `link-intel-map` output. Mounts inside `LinkExtractView.tsx` below the existing extraction results.
- Reuses the BYOK router from Part 1 (admin-only gemini fallback).

### 2b. Brain Chat Assistant
- New edge function `link-extract-chat` — streaming chat that:
  - Loads selected Aureon brain/personality from `public.brains` (same loader pattern used by Aureon Chat).
  - Has tool calls: `expand_node(nodeId)`, `list_subdomains()`, `pull_archive(url)`, `dump_js_secrets(host)`, `breach_lookup(domain)`. Tools call existing Zophiel/Zerlal helpers in-process.
  - Runs through BYOK router with `stepCountIs(50)`.
- New component `src/components/dashboard/search/LinkExtractChat.tsx` — slide-in side panel inside `LinkExtractView`. Brain selector dropdown at top (lists user's Aureon brains + system personalities), `useChat` against `link-extract-chat`, renders `parts` with markdown + tool execution UI.

### 2c. Layout
Update `LinkExtractView.tsx` to a 3-region layout:
```
┌─────────────────────────┬──────────────┐
│  Extraction Results     │              │
├─────────────────────────┤   Brain Chat │
│  Link Intel Map (graph) │              │
└─────────────────────────┴──────────────┘
```
On viewports < 1280px, chat collapses to a floating button.

## Part 3 — Verification
- Smoke-test each refactored function logged out and as a non-admin: must return 403 `BYOK_REQUIRED`.
- Smoke-test as admin: must execute against admin key.
- Smoke-test BYOK path: send a fake but well-formed BYOK config and confirm router is invoked.
- Run Link Extractor with a real URL (e.g. `https://lovable.dev`) using BYOK, verify map renders and chat can call tools.

## Technical Details

- The admin email is already verified by the existing `is_admin_user(uuid)` SQL function. The shared helper will call `supabase.auth.getUser(jwt)` then check email locally to avoid an RPC roundtrip per request.
- BYOK config continues to ship from `localStorage` in the request body — never persisted server-side.
- Existing memories already pin: `ASHER DASHBOARD AI is GEMINI-ONLY`, `Zophiel Intel Map is GEMINI-ONLY`. After this change, the new rule (BYOK-only for non-admins across the board) will be added to memory.
- The Link Extractor's new map uses the same `react-flow` graph primitives already in `IntelMapPanel.tsx` to keep bundle size flat.

## Scope Note
This is ~60 edge function edits + 2 new functions + 3 new React components + memory update. Recommend approving in two waves:
1. Wave A — admin gate helper + Part 2 (Link Extractor map/chat) so the new feature ships immediately.
2. Wave B — sweep all 60 functions to enforce BYOK.

If you want both in one go, I'll execute Wave A then Wave B sequentially in the same session.