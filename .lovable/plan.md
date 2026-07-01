
You said: don't build anything. This is a narrative document only — no code will be written until you approve it.

## 1. What the code actually does today (old narrative)

The chat entry point receives your message and passes it through `classifyIntent()` in `supabase/functions/_shared/jurisdictionalIntel.ts`.

1. It looks for a "search trigger" verb (`search`, `find`, `look up`, `who is`, `research`, `dossier`…). If none is present, it returns `kind: "none"` and the whole jurisdictional brain is skipped.
2. It strips the trigger, then tries to split the message into `subject` + `locus` using either `" in / from / located in "` or the first comma.
3. It calls `parseLocus()` on that tail — and separately `parseLocus()` on the WHOLE message — and merges. Country/state/county/city are set from whichever hit first.
4. If it decides you have `country` + `state`, it calls `sourcesFor(country, state, county)` in `jurisdictions.ts` to assemble the site list, then fans out to `zophielQuery()` which hits the `zophiel-search` edge function once per channel with a `site:a OR site:b OR site:c` restrictor appended.
5. Whatever comes back is grouped into channels (`entities`, `people`, `courts`, `property`, `news`) and formatted for the LLM.

## 2. Where it breaks — logical, workflow, and data-source flaws

Flaw A — Regional cascade never fires for casual phrasing.
The trigger regex demands a verb. Real messages like "her name is Jane Doe, Cape Coral FL" or "pull Jane Doe cape coral florida" without the word "search" fall through to `kind: "none"` and no sweep runs. The web tab of Zophiel doesn't care about triggers, which is exactly why it succeeds where the chat brain fails.

Flaw B — Locus extraction throws away the city.
`extractLocationTail()` only recognizes `" in / from / located in "` or the FIRST comma. "Jane Doe Cape Coral Florida" (no comma, no "in") is treated as one giant subject with empty locus. `parseLocus()` is then run on the raw message as a fallback, which does find "Florida" — but it never finds "Cape Coral" reliably because the city regex only runs if the whole `low` string contains the exact token, and the subject noise around it can break word boundaries. Net effect: state may resolve, county rarely does, and the sweep degrades to state-level.

Flaw C — Country default is missing.
If the message contains a US city or state code but no country word, `parseLocus()` sets country to "US" via the city map — good. But if only "FL" is present with no city, the two-letter state regex `\b([A-Z]{2})\b` requires uppercase and word boundaries; "fl" lowercase or "Florida." with a period fails. The `country` stays empty, `sourcesFor()` falls back to global lists, and Lee County / Sunbiz never get queried.

Flaw D — Global entities list contains Offshore Leaks.
`jurisdictions.ts` line 29 has `offshoreleaks.icij.org` inside `GLOBAL_ENTITIES`. Every `entities` channel — for every person, every jurisdiction — appends this to the site restrictor. That is why you keep seeing "Library of Leaks / ICIJ" scraped: it is baked into the universal fallback set, in direct violation of the "NEVER touch breach/leak databases" contract written six lines above it.

Flaw E — Person queries always include the `entities` channel with GLOBAL fallback.
When state-level `entities` are empty, `sourcesFor()` merges `GLOBAL_ENTITIES` in, which drags Offshore Leaks into every person query even when the person has nothing to do with offshore finance.

Flaw F — One-shot Zophiel channels vs. Zophiel web-tab's iterative fusion.
The web tab of Zophiel runs a broader multi-engine sweep, deduplicates by domain authority, and returns fused results. `zophielQuery()` here calls `zophiel-search` with `mode: "web"` ONCE per channel with a narrow `site:` restrictor. Narrow restrictors + one page = thin results. The web tab succeeds because it never restricts to `site:` first — it searches wide, then filters. The report engine does the opposite: filter first, search never.

Flaw G — No result → no report. The empty-channel path emits a "nothing surfaced" block. But because the web tab clearly DOES find hits for the same query, the chat report engine is reporting empty when the retrieval layer would have answered — it just wasn't asked correctly.

Flaw H — The subject string is passed to Zophiel as `"Jane Doe"` in quotes. Combined with a `site:` restrictor list of 8+ domains, most search backends collapse to zero hits. The web tab does not quote-lock the subject.

## 3. New narrative — the fix as a story

Retrieval and reporting must become one engine, not two.

Stage 1 — Intake without the trigger tax.
Any message that resolves to a proper-noun subject (person, entity, or address) enters the sweep regardless of whether the user said "search". Casual phrasing is the norm; requiring a verb is a bug.

Stage 2 — Location parsing rebuilt as a scanner, not a tail-splitter.
Walk the whole message and collect every location token: country words, state names + codes (case-insensitive, punctuation-tolerant), province names, known cities, and the city→county map. Rank them; use the most specific. Never depend on a comma or the word "in".

Stage 3 — Two-pass retrieval that mirrors the web tab.
Pass 1: run the exact query the Zophiel web tab would run — no `site:` restrictor, subject unquoted, locus appended as plain tokens. This is the "web-tab parity" call. Take the top N hits.
Pass 2: run the jurisdiction-scoped `site:` sweeps in parallel to enrich Pass 1 with authoritative registry hits.
Fuse: dedupe by URL, prefer authoritative domains, keep the wide-web hits as "context" channel so nothing the web tab would have found is lost.

Stage 4 — Source atlas hygiene.
Remove `offshoreleaks.icij.org` from `GLOBAL_ENTITIES` entirely. Offshore Leaks is a leak aggregator and violates the contract. Keep OpenCorporates, SEC EDGAR, USPTO, LinkedIn/company. Also add a hard blocklist checked at query-assembly time so no future addition can reintroduce a leak source silently.

Stage 5 — Report from what the retrieval returned, not from what the channel taxonomy expected.
Format the report by domain-class buckets: Authoritative Records, Corporate Registries, Court/Legal, People Directories, News, Wide Web Context. If Pass 1 gave you her Facebook + a local news mention and Pass 2 gave you a Sunbiz entity, the report shows all three. Today the code drops Pass-1-shaped hits because there is no Pass 1.

Stage 6 — Honest empties, per bucket.
If Authoritative Records is empty but Wide Web Context has 6 hits, say so explicitly and name the missing lever (middle initial, DOB range, previous address). Never emit a blanket "nothing found" when any bucket has content.

## 4. Before vs. after

| Dimension | Before | After |
|---|---|---|
| Trigger to run | Verb required ("search", "find"…) | Any subject + locus triggers the sweep |
| Locus parsing | Tail-split on "in" or first comma | Full-message scan; most specific wins |
| Retrieval strategy | Filter-first: `site:` restrictor, one call per channel | Wide-first (web-tab parity) + narrow `site:` enrich in parallel |
| Subject formatting | Quote-locked (`"Jane Doe"`) | Unquoted primary, quoted variant as secondary |
| Offshore Leaks / ICIJ | Baked into `GLOBAL_ENTITIES`, hit on every person | Removed; hard blocklist prevents reintroduction |
| Report shape | Fixed channels; empties reported as "nothing" | Domain-class buckets fused from both passes; empties named per bucket |
| Zophiel web-tab parity | None — separate code path | Pass 1 IS the web-tab call; guaranteed to include what the tab would show |
| Failure mode | Silent zeros because narrow filter killed the query | Wide pass still returns hits; narrow pass only enriches |

## 5. What this changes for you in practice

Today: "search Jane Doe cape coral florida" → chat brain fires, resolves FL but not Lee County, appends Offshore Leaks to entities, returns thin/empty, report says nothing found. Meanwhile the Zophiel web tab returns her profile on the first try.

After: same message → subject `Jane Doe`, locus `Cape Coral, Lee County, FL, US`. Pass 1 runs the exact wide search the web tab runs and gets her profile. Pass 2 hits Sunbiz + Lee County appraiser + Whitepages/TruePeopleSearch in parallel. Report fuses both, cites domains, and never touches Offshore Leaks.

Say the word and I'll convert this narrative to code, deploy, and run the live test with your BYOK against a subject you name.
