# asherin dashboard audit — consumer software, staged repair plan

everything below is from reading the actual code, not assumption. asherin.chat is excluded.

## what i found (honest read)

**33 tools in the left list, 6 more with no row at all.** `ghost-engine`, `notebooks`, `audit`, `pattern-analysis`, `stats` and the in-dashboard code editor route but appear nowhere in navigation. two of them are strong, three are near-empty.

**the grouping is not how people think.** groups are named create / build / investigate / analyze / workspace / account, but "pages" sits in workspace while "slides" and "ebooks" sit in create — three tools that do the same job in three different places. `investigations` sits next to live camera tools. gematria and vedic are filed under "create".

**four tools are shells.** subscription (58 lines), pages (a 10-line wrapper), stats (97 lines), audit log (112 lines). the rest of the dashboard is genuinely substantial.

**plan matching is inconsistent.** five tools render with no plan check at all — investigations, team, bugs, gematria, snippets — while team is simultaneously listed as a pro tool. the knowledge tool's own copy says "$79 pro" while the code puts it in a different bucket.

**three tools are the same tool.** slides, ebooks and pages each have their own prompt box, each calls the same model path, each builds pages with the same two libraries. separate code, separate history, no shared output.

**we are charging for a wallpaper.** uploading your own background costs $3.99, and the unlock is stored in the browser so it can be faked anyway. that is the only paywall inside settings.

**settings is one 957-line scroll.** eleven unrelated sections stacked in one page: your name, then a wallpaper picker, then a list of about fifty ai providers, then memory rules, then a github token form, then google account permissions, then account deletion. everything loads at once.

**no motion controls exist.** no reduce-motion, no animation intensity, no way to calm the shimmer and ripple. the ripple is always on and cannot be turned off.

**no cost visibility.** you can add many provider keys, but nothing shows what each key spent, on which tool. the one component that estimates cost is orphaned and wired to nothing. what is tracked is prompt counts for a streak, not money.

## the plan, in stages

### stage 1 — truth pass (no visual change)
- give every tool exactly one plan bucket, matching what the server enforces; close the five unguarded tools or declare them free on purpose.
- fix the knowledge tool's price copy to match its real bucket.
- delete or finish the four shells: subscription gets a real plan/renewal/invoice panel; stats and audit either become one honest "activity" panel or go.
- decide retirement out loud: the tools now covered by chat + the artifact runtime are retired with a row removed, not hidden.

### stage 2 — merge the duplicates
- one tool, `asherin.pages`: document studio with output type as a choice (deck, book, report, pdf) rather than three separate rooms. one prompt path, one history, one export pipeline.
- fold `snippets` into the same library the artifact runtime already writes to, so saved code has one home.
- keep `design` separate — it is a different job.

### stage 3 — navigation rebuilt around jobs
six plain-language groups, deepest tool three clicks away:
```text
talk        chat
watch      eye · arvision · sentinel · defender
find       search · cyber · google · extract · briefing · investigations
understand data · knowledge · health
make       pages · design · agents · whiteboard
keep       library · projects · vault · guardian vault · team
account    settings · plan · connect
```
the orphans get a row or get retired. nothing routes to a page with no way in.

### stage 4 — settings rebuilt
- split the one scroll into real tabs that load on demand: you · look · intelligence · keys · connections · privacy · data.
- **the wallpaper charge is removed.** custom uploads become free for everyone, and the browser-flag unlock is deleted.
- new **motion** controls: full / calm / still, plus separate switches for the click ripple and background shimmer, and automatic respect for the system reduce-motion setting.

### stage 5 — usage and cost intelligence
a new **usage** tab that honestly reports:
- spend and tokens per provider key, per tool, per day, from recorded calls — not guessed.
- which features consumed it, top prompts by cost, trend over the month.
- a per-tool switch to cut a tool off from your key entirely, and a monthly ceiling with a warning before it hits.

it will only show what was actually recorded, so it starts from the day recording begins rather than inventing history.

### stage 6 — workflow repair, worst first
each weak tool gets the same treatment: state what it is for, what it must produce, where it currently dead-ends, then rebuild that path and test it. order by how broken it is, and i will show you each one before moving on.

### stage 7 — verification
every merged and repaired tool driven for real in the browser: sign in, run its actual job end to end, check the result, check nothing else regressed. no tool is called done on a build passing alone.

## visual honesty
the interface is not unpleasant — the dark cinematic system is consistent and calm. what hurts is **density and sameness**: 33 near-identical rows with no visual weight, no sense of where you are, and long scrolls with no landmarks. so the visual work is spacing, hierarchy, a clear current-room marker, and calmer motion — not a new look. near-black, gold used sparingly, extralight inter, cormorant display and rounded-2xl all stay exactly as they are.

## technical notes
`src/lib/navIntents.ts` stays the single source for navigation; `useAccess.ts` stays the single source for plan buckets and both sidebars keep reading from them rather than duplicating rules. the merged document tool reuses `streamChat` and the existing export libraries. usage recording writes to a new owner-scoped table with row-level security and no key material or secrets in any record. the pattern/learning layer and the artifact runtime are reused, not rebuilt.

## how i will report back
stage by stage. i build one stage, show you what changed and what it now does, and wait before starting the next.
