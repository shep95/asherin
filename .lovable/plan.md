# Gematria Engine — Aureon & Asher Chat Integration

Add a dedicated **Gematria** tab available inside both Aureon Chat and Asher Chat. It runs a client-side English Ordinal calculation engine with multi-cipher support, recursive reduction, and a persistent corpus of previously-computed phrases so users can find value-matches across their own history.

## Scope

Pure linguistic string-analysis tool (A=1..Z=26 and variants). No medical, biological, or predictive-health claims — the UI includes a plain-language note that this is a pattern/coincidence tool, not diagnosis or prediction.

## User-facing surface

1. **New tab "Gematria"** in the Aureon Chat page and the Asher Chat page (same component, mounted in both).
2. **Input panel**
   - Multiline text input for a word/phrase.
   - Cipher selector (checkboxes): English Ordinal, Full Reduction, Reverse Ordinal, Chaldean.
   - Toggle: Recursive Reduction (single-digit / master numbers 11, 22, 33).
   - "Calculate" button + Enter-to-submit.
3. **Results panel**
   - Table: cipher → sum → reduced value → per-letter breakdown (collapsible).
   - Copy-value button per row.
   - "Matches in your corpus" section: lists prior phrases sharing the same sum for the active cipher.
4. **Corpus panel**
   - Search phrases by value or substring.
   - Delete entry, export CSV of user's corpus.
5. **Empty / loading / error states** for all panels.

## Algorithm (client-side, deterministic)

- Normalize: lowercase, strip non a–z.
- English Ordinal: a=1..z=26.
- Full Reduction: ordinal → single digit via digit-sum mapping (a=1..i=9, j=1..r=9, s=1..z=8).
- Reverse Ordinal: a=26..z=1.
- Chaldean: fixed 1..8 table (no 9), standard mapping.
- Recursive reduction: repeatedly sum digits until 1–9 or 11/22/33.

All math runs in the browser — no network call needed for calculation.

## Persistence (Lovable Cloud)

Table `gematria_entries` scoped per user:
- `id uuid pk`, `user_id uuid`, `phrase text`, `normalized text`, `ordinal int`, `reduction int`, `reverse int`, `chaldean int`, `created_at timestamptz`.
- RLS: user can select/insert/update/delete only their own rows. GRANTs to `authenticated` + `service_role`.
- Index on `(user_id, ordinal)` for fast value-match lookup.

Every successful calculation upserts by `(user_id, normalized)` so re-entering the same phrase doesn't duplicate.

## Files

- `supabase/migrations/<ts>_gematria_entries.sql` — table, GRANTs, RLS, indexes.
- `src/lib/gematria.ts` — pure functions: `normalize`, `ordinal`, `reduction`, `reverseOrdinal`, `chaldean`, `recursiveReduce`, `computeAll`.
- `src/hooks/useGematria.ts` — save/list/delete/search entries via supabase client.
- `src/components/gematria/GematriaTab.tsx` — full tab UI (input, results, matches, corpus browser).
- Wire the tab into the Aureon Chat page and Asher Chat page tab lists.

## Verification

- Unit-check sample values in-app: `Aureon` → 74 (ordinal), `Asher` → 51 (ordinal), `love` → 54.
- Enter two phrases with matching sums, confirm they appear in each other's "matches" list.
- Reload page, confirm corpus persists per user; sign out / sign in with a second account, confirm isolation.
- Verify tab renders inside both Aureon and Asher chat routes without breaking existing chat streaming.

## Out of scope

- Wikipedia / Gutenberg corpus ingestion (large dataset, separate task).
- Temporal / historical-event correlation.
- Any medical, health, or predictive interpretation of results.
