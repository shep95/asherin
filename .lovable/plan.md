## Goal

Let the Aureon and Asher chat AIs decide when to run the Gematria engine (four ciphers, recursive reduction) mid-conversation. Every calculation is auto-persisted to the user's `gematria_entries` corpus and rendered as an inline result card inside the assistant message. No new tab needed on top of the existing Gematria tab — this is the in-chat surface.

## Two chat surfaces, two integration mechanics

### 1. Asher chat — native OpenAI tool_call

`supabase/functions/asher-ai/index.ts` already streams `delta.tool_calls` SSE and the client (`AsherAIPanel`) already parses them. Add:

- **New tool in `TOOLS`:** `gematria_calculate({ phrase, note? })` — description tells the model to call it whenever the operator asks for the numeric/gematria/ordinal/reduced value of a word or phrase, or asks it to compare/match phrases numerically.
- **System-prompt line** under `CAPABILITIES`: one line describing `gematria_calculate` and instructing the model to call it instead of computing values in text.
- **Client handler** in `AsherAIPanel`: when a `tool_calls[0].function.name === "gematria_calculate"` frame arrives, run `computeAll(phrase)` from `src/lib/gematria.ts`, upsert into `gematria_entries` via `useGematria`, then render the same `<GematriaResultCard>` used in the tab, inline under the assistant bubble. Send a follow-up assistant message with the compact summary text so the model can reference it in later turns.

### 2. Aureon chat — fenced-block convention (no tool_call infra in `chat`/`aureon-free-chat`)

The Aureon chat functions stream plain text and have no OpenAI tool_call plumbing. Rather than retrofit that surface, use a lightweight equivalent that keeps "AI decides":

- Append a short block to the Aureon system prompt in `supabase/functions/chat/index.ts` and `supabase/functions/aureon-free-chat/index.ts`:
  > When the operator asks for the gematria / numeric value / ordinal / reduced value of a word or phrase (or asks you to find phrases that share a value), emit a single fenced block on its own line: ` ```gematria\n{"phrase":"..."} \n``` `. Do not compute values in prose. One block per phrase. You may emit multiple blocks in one reply.
- **Client parser** in `ChatView.tsx` message renderer: split assistant `content` on ` ```gematria …``` ` fences; for each one, parse JSON, run `computeAll(phrase)`, upsert via `useGematria`, and swap the fence for `<GematriaResultCard compact />`. Non-gematria text renders unchanged through the existing markdown renderer.

Both paths converge on the same `<GematriaResultCard>` and the same `useGematria` persistence hook, so behavior/UI is identical across chats.

## Result card (`src/components/gematria/GematriaResultCard.tsx`, new)

Compact, chat-optimized version of the tab's result panel:

- Header: phrase + "Saved to corpus" pill (only when the upsert succeeds; error → "Save failed — retry" ghost button).
- 4-cipher row: Ordinal / Reduction / Reverse / Chaldean, each showing sum → reduced value (master numbers preserved).
- Collapsible per-letter breakdown.
- "Matches in your corpus (n)" line with up to 3 chip links; clicking opens the Gematria tab filtered to that value.

## Persistence + idempotency

- Auto-save uses the existing `useGematria.upsertPhrase()` on `(user_id, normalized)` — repeat calls in the same or later chat return the existing row instead of duplicating.
- Idempotency key = `(user_id, normalized(phrase))`; note field defaults to `"chat:aureon"` or `"chat:asher"` so corpus filters can distinguish origin.
- Failures (network, RLS, offline) surface as the inline "Save failed" affordance; the calc itself always renders from local computation so the chat never blocks on the DB.

## Guardrails

- Phrase length capped at 200 chars server-side (tool arg schema) and client-side before compute — prevents pathological inputs.
- HTML-escape phrase before render; card uses semantic tokens, no `dangerouslySetInnerHTML`.
- Fence parser uses a non-greedy, non-stateful regex on a per-message string (no `/g` reuse across renders).
- Skip empty/whitespace-only phrases silently.
- Do not intercept fenced blocks in code contexts: only fences with the exact language tag `gematria` are consumed; standard ``` ```ts ``` /``` ```json ``` blocks pass through untouched.

## Files

**New**
- `src/components/gematria/GematriaResultCard.tsx`
- `src/lib/gematria/parseChatGematria.ts` (fence extractor + splitter used by `ChatView`)

**Edited**
- `supabase/functions/asher-ai/index.ts` — add tool to `TOOLS`, one line in system prompt.
- `supabase/functions/chat/index.ts` — append fenced-block instruction to system prompt.
- `supabase/functions/aureon-free-chat/index.ts` — same fenced-block instruction.
- `src/components/asher/AsherAIPanel.tsx` — handle `gematria_calculate` tool_call frames, render card, auto-save.
- `src/components/dashboard/ChatView.tsx` — run assistant `content` through `parseChatGematria` in the message renderer; render `<GematriaResultCard>` for each block.
- `src/hooks/useGematria.ts` — accept optional `source` note on upsert so chat-originated entries are tagged.

**Unchanged**
- `gematria_entries` schema — existing columns cover phrase, normalized, all four cipher sums, `created_at`; no migration needed.
- Existing standalone `GematriaTab` — remains the corpus manager.

## Verification (live)

1. Aureon chat: send "What's the gematria of Aureon and Ziali?" — expect two inline cards (Aureon Ordinal 74, Ziali Ordinal 63); reload → both persisted in the Gematria tab tagged `chat:aureon`.
2. Asher chat: same prompt → SSE frame carries `gematria_calculate` tool_call, card renders under assistant reply, entries tagged `chat:asher`.
3. Repeat the same phrase in a new session → no duplicate rows (upsert path exercised).
4. Send a phrase containing a triple-backtick code block plus a gematria request → code block renders as code, gematria card renders separately (fence-tag isolation).
5. Sign out / sign in as a second account → first user's entries are not visible (RLS).
6. Airplane-mode toggle mid-send → card still renders with "Save failed — retry" affordance; retry succeeds when connectivity returns.

## Out of scope

- New tab or route (Gematria tab already exists).
- Historical/temporal or medical interpretation.
- Cross-user shared corpus.
