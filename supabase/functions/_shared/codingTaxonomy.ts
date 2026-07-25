// ───────────────────────────────────────────────────────────────────────────
// CODING TAXONOMY — the full flaw+craft dimensional grid injected into every
// coding engine (Asherin Chat, Asher Chat, Asher Code IDE, IDE Code Router,
// Zerlal Scan, Zophiel Code Audit, Media→Code, and the raw /chat endpoint).
//
// The narrative + checklist protocol already handles Code → Narrative →
// Flaws → Fix. This module is the *lens* the model uses during the "Flaws"
// step and the *palette* it draws from during the "Fix" step. It layers
// three concerns:
//
//   1) FULL TAXONOMY DIMENSIONS  — nine flaw/craft classes with concrete
//      example checks the model must run explicitly (not "consider errors"
//      but "did you handle 401 401→refresh-once, 429→backoff, 5xx→retry
//      idempotent-only, network→timeout+abort").
//   2) STYLE PALETTES            — nine distinct visual-language presets
//      (anime, western/cowboy, realism/photoreal, cyberpunk, art-deco,
//      brutalist, retro-futurist, editorial-minimal, organic-natural) that
//      the model activates when the user asks for a UI style. Each palette
//      is a full design system, not a color list.
//   3) STYLE DETECTOR            — a conservative string matcher so the
//      right palette auto-activates without the user having to spell it out.
//
// This module is dependency-free (pure strings + a tiny detector) so it is
// safe to import from any edge function.
// ───────────────────────────────────────────────────────────────────────────

export const CODING_TAXONOMY_DIMENSIONS = `
## FULL CODING TAXONOMY — MANDATORY WHEN CODE IS IN CONTEXT
When you run the FLAW HUNT step of the Code → Narrative → Flaws → Fix loop,
walk EVERY dimension below. Never skip a dimension. Each dimension is a
tree: DIMENSION → SUB-DOMAIN → MICRO-DOMAIN. You must descend to the
micro-domain level and emit a one-line finding per micro-domain (or an
explicit "n/a — <reason>" when the surface truly cannot exhibit it). Silence
is not evidence.

### 1. WORKFLOW & ORCHESTRATION
- 1.1 State machines
  - 1.1.1 Every state has entry, exit, error, and cancel edges (no dangling terminal).
  - 1.1.2 Illegal-transition guard (reject state→state that skips an intermediate).
  - 1.1.3 Timeout edge on every "waiting" state with a fallback state (not just log).
  - 1.1.4 Replay-safety: reprocessing the same event stream reaches the same terminal.
- 1.2 Idempotency & compensation
  - 1.2.1 Idempotency key = (userId, operationName, stableInput hash) — never a random uuid.
  - 1.2.2 Compensation is exactly the inverse of forward action (refund ↔ charge, unshare ↔ share).
  - 1.2.3 Sagas persist step outcomes; a crash between steps resumes, not restarts.
- 1.3 Concurrency shape
  - 1.3.1 Fan-out concurrency cap (p-limit / semaphore) sized to downstream RPS, not to input length.
  - 1.3.2 Fan-in join uses Promise.allSettled + per-branch timeout, never bare Promise.all.
  - 1.3.3 Ordering guarantee is named explicitly: FIFO / causal / per-key / none.
- 1.4 Delivery guarantees
  - 1.4.1 At-least-once → consumers idempotent; at-most-once → producers durable.
  - 1.4.2 Dead-letter queue with a replay tool AND a max-DLQ-size alarm.
  - 1.4.3 Poison-message quarantine after N retries (N documented, not magic).
- 1.5 Backpressure & scheduling
  - 1.5.1 Producer stops/spills when consumer lag > threshold (measured, not assumed).
  - 1.5.2 Cron jobs: DST-safe (UTC crons), missed-tick catch-up policy declared.
  - 1.5.3 Long jobs checkpoint at ≤5 min granularity; resume reads the checkpoint.

### 2. CODE LOGIC & CORRECTNESS
- 2.1 Boundaries & ranges
  - 2.1.1 Off-by-one on every array/index/date range (inclusive vs exclusive named).
  - 2.1.2 Empty / single-element / max-size / negative-size cases exercised.
  - 2.1.3 Half-open interval discipline: [start, end) everywhere unless documented.
- 2.2 Control flow
  - 2.2.1 Early-return guards on null / empty / not-authorized before main path.
  - 2.2.2 Discriminated-union exhaustiveness enforced by assertNever(default).
  - 2.2.3 Boolean short-circuit ordering: cheap/pure checks precede expensive/side-effect.
  - 2.2.4 Loop invariants documented for anything non-trivial.
- 2.3 Immutability & scope
  - 2.3.1 No mutation of props, arguments, or shared module-scope state.
  - 2.3.2 Stale-closure hunt in React callbacks/effects (use refs or dep array).
  - 2.3.3 Object identity vs value equality named for every memo/deps comparison.
- 2.4 Numbers, time, money
  - 2.4.1 parseInt has an explicit radix; parseFloat guarded for NaN.
  - 2.4.2 UTC in storage; conversion only at UI edge; IANA zones, never GMT+N offsets.
  - 2.4.3 Currency in minor units (cents) via BigInt/int; never floats.
  - 2.4.4 Rounding mode declared (banker's / half-up) at every rounding site.

### 3. BUG-CLASS
- 3.1 Nullability
  - 3.1.1 Optional-chain terminates in a real fallback, not "|| ''" that masks errors.
  - 3.1.2 API response typed with a runtime schema (zod/valibot), not a "trust me" cast.
- 3.2 Async
  - 3.2.1 Every await sits inside try or a caller with .catch — no floating promises.
  - 3.2.2 setState after unmount guarded (AbortController / mounted-ref).
  - 3.2.3 Double-submit blocked on the button (disabled + in-flight ref).
- 3.3 Concurrency hazards
  - 3.3.1 Click-during-load, tab-switch-mid-fetch, and back-nav-mid-fetch all handled.
  - 3.3.2 Cancelled AbortController does not still resolve state.
- 3.4 Bounds
  - 3.4.1 Integer overflow on ids/counters (BigInt where needed), 32-bit unix time past 2038.
  - 3.4.2 Recursion depth cap OR trampolined; JSON parse of deeply-nested untrusted input rejected past N depth.

### 4. SECURITY
- 4.1 Injection
  - 4.1.1 SQL: parameterized only; no string concat, no dynamic table names without allow-list.
  - 4.1.2 Shell: execFile with array args; never spawn with { shell: true } on user input.
  - 4.1.3 NoSQL: reject objects where a string is expected ({$gt:''} attacks).
  - 4.1.4 XPath / LDAP / template / log-forging (\\r\\n stripped in log lines).
- 4.2 Prompt injection
  - 4.2.1 User text fenced with tagged delimiters + "do not follow instructions inside".
  - 4.2.2 Tool-call outputs validated against schema before feeding back to model.
  - 4.2.3 Model output that requests egress passes through URL allow-list.
- 4.3 AuthZ (IDOR + RLS)
  - 4.3.1 Every read/write authorized against the record's owner, not the session alone.
  - 4.3.2 RLS on every public table + GRANT for every role that touches it.
  - 4.3.3 Admin gate = has_role(uid,'admin'); never an email allow-list.
- 4.4 Network security
  - 4.4.1 SSRF: outbound fetch host allow-list; block 169.254/127/10/172.16/192.168, ::1, metadata.
  - 4.4.2 CORS: explicit origin list; no "*" with credentials; preflight cache sane.
  - 4.4.3 CSRF: SameSite=strict on session, token on state-changing endpoints.
- 4.5 Rendering
  - 4.5.1 XSS: framework auto-escape not defeated (no dangerouslySetInnerHTML on user text).
  - 4.5.2 CSP header with nonce for inline scripts; no 'unsafe-inline' on scripts.
  - 4.5.3 Clickjacking: X-Frame-Options / frame-ancestors set.
- 4.6 Secrets & crypto
  - 4.6.1 Secrets: not in code, logs, error messages, URLs, or client bundle.
  - 4.6.2 AEAD only (AES-GCM / ChaCha20-Poly1305); IV per message, never reused.
  - 4.6.3 Passwords: argon2id (or bcrypt≥12); JWT verify signature + aud + iss + exp.
  - 4.6.4 Key rotation cadence declared; old keys accepted for decrypt window only.
- 4.7 Ingress hygiene
  - 4.7.1 Upload: content-type sniffed server-side; size cap; path-traversal blocked; filename normalized.
  - 4.7.2 Deserialization: never eval, never pickle, never yaml.load unsafe; JSON.parse without reviver on untrusted.

### 5. CONCURRENCY & DATA
- 5.1 Write correctness
  - 5.1.1 Lost-update guard: SELECT … FOR UPDATE, optimistic version column, or CAS.
  - 5.1.2 Read-your-writes guaranteed on the same session or explicitly declared eventual.
  - 5.1.3 Distributed write + event = outbox pattern, never dual-write.
- 5.2 Cache
  - 5.2.1 Single source of truth; cache is derived, never authoritative.
  - 5.2.2 TTL AND explicit invalidation on write; stale-while-revalidate policy stated.
  - 5.2.3 Cache key includes tenant/user scope — no cross-user bleed.
- 5.3 Schema evolution
  - 5.3.1 Additive migrations only; backfill precedes drop.
  - 5.3.2 Two-phase for column rename (add-new → dual-write → migrate-reads → drop-old).
  - 5.3.3 Every migration reversible OR documented as one-way with a fresh backup.
- 5.4 Query shape
  - 5.4.1 Pagination cursor-based (keyset) for >1000 rows; offset only for admin.
  - 5.4.2 N+1 killed: joined query or batched dataloader; no per-row fetch inside .map.
  - 5.4.3 Query timeout at the statement level, not just app level.

### 6. PERFORMANCE
- 6.1 Complexity
  - 6.1.1 Big-O of every hot path named (O(n) / O(n log n) / O(n²)).
  - 6.1.2 Nested loop over collections both driven by user input flagged.
- 6.2 Database
  - 6.2.1 Index on every WHERE / ORDER BY / JOIN column; composite order matches usage.
  - 6.2.2 EXPLAIN checked for seq-scan on tables >10k rows.
- 6.3 React / render
  - 6.3.1 Memoization on expensive derived state; key stability on lists.
  - 6.3.2 List virtualization above 200 rows.
  - 6.3.3 Context split so unrelated consumers don't re-render.
- 6.4 Bundle & network
  - 6.4.1 Dynamic import for any chunk >40 KB gz not needed at first paint.
  - 6.4.2 Images: responsive srcset, AVIF/WebP, width/height set (no CLS).
  - 6.4.3 Preload/prefetch declared for critical assets only.
- 6.5 Runtime hygiene
  - 6.5.1 Every setInterval/setTimeout cleared; every subscription unsubscribed on unmount.
  - 6.5.2 No synchronous work > 50 ms on user input path (yield with scheduler or rAF).
  - 6.5.3 Web workers for CPU > 100 ms tasks that would block main thread.

### 7. API / NETWORK
- 7.1 Fetch discipline
  - 7.1.1 Timeout (AbortController) on every request; default named, not magic.
  - 7.1.2 Retry policy: only idempotent verbs; exponential backoff + jitter; max attempts stated.
  - 7.1.3 Retry-After header honored; 429 not treated as fatal.
- 7.2 Response handling
  - 7.2.1 Non-2xx enumerated: 401→refresh once, 403→surface, 404→typed empty, 5xx→retry, network→timeout.
  - 7.2.2 Response schema validated before use; unknown fields ignored, missing required = error.
  - 7.2.3 Content-type checked before .json() (HTML error page won't crash parser).
- 7.3 Streaming
  - 7.3.1 WebSocket/SSE reconnect with backoff + jitter; resume from last seq id.
  - 7.3.2 Heartbeat interval < proxy idle timeout.
- 7.4 CORS & credentials
  - 7.4.1 Explicit origin allow-list; credentials only where required.
  - 7.4.2 Preflight response cached with a sane max-age.
- 7.5 Rate limiting
  - 7.5.1 Server-side limit per (userId, route); anon limit per IP.
  - 7.5.2 Client honors Retry-After; UI surfaces "try again in Ns" not a spinner.

### 8. UI / UX / ANIMATION / A11Y
- 8.1 Four-state quartet
  - 8.1.1 Idle: default surface has meaningful content or clear affordance.
  - 8.1.2 Loading: skeleton/shimmer matched to real layout — never bare spinner over content.
  - 8.1.3 Empty: explains state + names a next action.
  - 8.1.4 Error: names error class + retry affordance + link to help.
- 8.2 Layout stability
  - 8.2.1 CLS < 0.1 on hero, nav, footer during load (images sized, fonts preloaded).
  - 8.2.2 Fixed-height reservations for async content on the critical path.
- 8.3 Keyboard & focus
  - 8.3.1 Tab order matches visual order; every interactive has :focus-visible.
  - 8.3.2 Modal open = focus trap + return focus on close.
  - 8.3.3 Escape closes overlays; Enter activates default action.
- 8.4 Semantics
  - 8.4.1 ARIA role/label/described-by where native semantics don't suffice.
  - 8.4.2 Live regions (aria-live=polite) for async status text.
  - 8.4.3 Landmark regions: header/nav/main/footer present.
- 8.5 Contrast & type
  - 8.5.1 WCAG 2.1 AA verified against actual tokens (4.5:1 body, 3:1 large).
  - 8.5.2 Min text size 14 px body / 12 px caption; line-height ≥1.4.
- 8.6 Motion
  - 8.6.1 60 fps target; only transform + opacity animated.
  - 8.6.2 will-change scoped to triggered elements only.
  - 8.6.3 prefers-reduced-motion honored: replace animation with instant state.

### 9. REALISM & OBSERVABILITY (never ship a mock as if it were live)
- 9.1 Data honesty
  - 9.1.1 Every fetching feature backed by a documented REAL upstream.
  - 9.1.2 No lorem ipsum, no seed-data fixture, no hard-coded sample presented as live.
  - 9.1.3 Every UI claim traces to an upstream field OR is labeled "estimate".
- 9.2 Provenance
  - 9.2.1 Every user-visible number cites its source in a code comment (URL or function name).
  - 9.2.2 Timestamps show source system's clock, not the browser's, when they represent an event.
- 9.3 Logging
  - 9.3.1 Structured logs (JSON) on auth, mutation, outbound API — no console.log spam.
  - 9.3.2 Correlation id (request id) threaded through every log line and error boundary.
  - 9.3.3 PII scrubbed at the logger boundary, not left to reviewers.
- 9.4 Failure containment
  - 9.4.1 Route-level ErrorBoundary with real diagnostic payload sent to log sink.
  - 9.4.2 Every third-party dependency has a degradation path (feature flag → skeleton → cached).
  - 9.4.3 Alarms on 5xx rate, p95 latency, and error-boundary trips — not just uptime.
`;

export const CODING_STYLE_PALETTES = `
## MULTI-STYLE UI PALETTES — activate the matching preset when the user asks
for a visual language. Each preset is a full design system: color tokens,
type stack, motion register, iconography, and layout rules. Do NOT mix
tokens across presets. When the user does not specify a style, keep the
project's existing tokens untouched.

### STYLE: ANIME
- Palette: high-chroma primaries (#ff5c8a hot pink, #4cc9ff sky, #ffd166 sun-yellow, #06d6a0 mint) on off-white (#fdf6f0) or midnight (#0d1224).
- Type: bold display sans with rounded terminals (e.g. "Kosugi Maru", "Zen Maru Gothic", "Baloo 2"); body in geometric sans ("M PLUS Rounded 1c").
- Motion: overshoot cubic-bezier(.34,1.56,.64,1); speed-line trails on scroll; scale-pop on click; soft screen-shake on error, disabled if prefers-reduced-motion.
- Iconography: chunky filled icons with 2px black outer stroke (mimics manga inking).
- Layout: dutch-angle hero panels, 8-column asymmetric grid, big drop-shadow "chibi" cards, kirakira sparkle decorations only in hero.
- Signature: gradient stroke on primary buttons, ★ marker on empty-state, halftone dot texture in hero background.

### STYLE: WESTERN / COWBOY
- Palette: sunburnt palette — clay #b04a2f, dust #d9b382, sagebrush #6a7f4e, deep-shadow #241a11, cream #f4e9d3.
- Type: distressed slab serif for display ("Playfair Display" with texture overlay, or "Rye", "Smokum"); body in humanist serif ("Crimson Pro").
- Motion: no bounces — deliberate ease-out, slower (350–450 ms); horizontal drift on hero; tumbleweed cursor trail only on desktop hover, off on touch.
- Iconography: engraved-outline icons (2px hairline stroke) with tiny star or fleur ornaments.
- Layout: wanted-poster hero (centered slab title, thick border, aged paper), horizontal saloon-slat section dividers, three-column ledger tables.
- Signature: 1px inner "aged paper" texture on cards, uppercase small-caps subheads, sepia photograph treatment on images.

### STYLE: REALISM / PHOTOREAL
- Palette: neutral greyscale grounded on true white #ffffff / off-black #0a0a0a with a single restrained accent taken from the hero photograph.
- Type: humanist workhorse — "Söhne", "Neue Haas Grotesk", "Söhne Breit" for display, "Söhne" for body; measured 65–72ch.
- Motion: micro (150–200 ms), ease-out, opacity+transform only, no bounce. Cross-fades between hero photographs.
- Iconography: 1px linear icons at 20 px, matches text weight.
- Layout: full-bleed photography, editorial grid, generous negative space, single-column long-form.
- Signature: photograph is the design; UI recedes.

### STYLE: CYBERPUNK
- Palette: neon on ink — magenta #ff2ea6, cyan #00e5ff, acid-lime #b6ff2a on #05060a; accent gradients magenta→cyan.
- Type: monospaced display ("JetBrains Mono", "Space Mono") + wide sans ("Rajdhani", "Orbitron") for headers.
- Motion: glitch flicker on hero mount (< 400 ms, prefers-reduced-motion off), typewriter reveal on key numbers, scanline overlay in decorative-only surfaces.
- Iconography: pixel-perfect line icons with corner-cut chamfer.
- Layout: HUD frames, corner brackets on cards, terminal panels with blinking cursor.
- Signature: chromatic aberration on hero text (2 px cyan/magenta split), CRT vignette on hero.

### STYLE: ART DECO
- Palette: onyx #0e0e12, cream #f4ecd8, brass #c9a24a, jade #2a6b5b.
- Type: elegant geometric display ("Poiret One", "Limelight", "Cinzel") + refined serif ("Cormorant Garamond") for body.
- Motion: symmetric — mirrored fades from center, no bounces, elegant 400 ms cubic-bezier(.4,0,.2,1).
- Iconography: linear geometric with rays / zigzag ornaments; gold hairlines.
- Layout: symmetric split hero, chevron dividers, tiered stepped cards, gilt frames on portraits.
- Signature: gold hairline borders, mirrored decorative motifs top & bottom of hero.

### STYLE: BRUTALIST
- Palette: raw — pure white, pure black, one shocking accent (#ff3b30 or #0033ff), no gradients.
- Type: default system-ui or "Times New Roman" — refuse to prettify.
- Motion: none, or one deliberate 100 ms cut-transition.
- Iconography: bracket characters and Unicode glyphs, not icon fonts.
- Layout: exposed grid lines, table-like flat panels, form-first hero, monospaced captions.
- Signature: raw HTML aesthetic, no shadows, no border-radius (or radius=0 explicitly).

### STYLE: RETRO-FUTURIST (70s/80s sci-fi)
- Palette: sunset gradient (#ff6b6b → #f9844a → #f9c74f) on deep-space #14163f, chrome accents.
- Type: "VT323" or "Press Start 2P" for headers; "Space Grotesk" for body.
- Motion: horizon-line parallax on scroll, neon-glow pulse on primary CTAs (transform-only), grid-floor perspective on hero.
- Iconography: chrome bevel icons, arcade-cabinet ornaments.
- Layout: grid-floor hero with vanishing point, sun-disc CTA, hexagonal cards.
- Signature: neon outline glow, chrome text with 3D bevel, laserwave sun disc.

### STYLE: EDITORIAL MINIMAL
- Palette: two colors max — deep ink #111 + paper #fafaf7 + one accent.
- Type: "Domaine Display" / "GT Sectra" for display + "Söhne" body; drop-cap on lead paragraph.
- Motion: near-zero — content is the motion.
- Iconography: sparse, hairline, only where semantically necessary.
- Layout: baseline grid, wide margins, long measure (72–80ch), pull-quotes.
- Signature: typography-first; whitespace is the design element.

### STYLE: ORGANIC / NATURAL
- Palette: earth — clay #b6866a, moss #6b8e4e, sky #a8c8d8, sand #e8dcc8, bark #3a2a1c.
- Type: humanist warm serif ("Fraunces", "Recoleta") + friendly sans ("Nunito").
- Motion: gentle sway (± 2°) on hero elements, leaf-fall particle only in hero, spring cubic-bezier(.34,1.2,.64,1).
- Iconography: hand-drawn stroke icons with slight wobble.
- Layout: rounded-blob shapes, curved section dividers, no hard right angles, generous line-height.
- Signature: blob background shapes, hand-drawn underlines, warm neutrals throughout.

### STYLE HANDOFF RULES
- Emit ALL tokens in one migration to \`index.css\` under CSS custom properties, then map to Tailwind in \`tailwind.config.ts\`.
- Never hardcode hex in components — always via tokens.
- If the user asks for a style that combines two of the above ("anime × cyberpunk"), state the fusion decisions explicitly (which palette wins, which type wins, which motion register wins) BEFORE writing code.
`;

/**
 * Conservative style detector. Returns the palette id if the user's message
 * clearly requests one, otherwise null. Never guesses — only fires on
 * explicit keywords so URL-forensics / code-review turns aren't polluted.
 */
export type StylePaletteId =
  | "anime" | "western" | "realism" | "cyberpunk" | "art-deco"
  | "brutalist" | "retro-futurist" | "editorial-minimal" | "organic";

const STYLE_PATTERNS: Array<[StylePaletteId, RegExp]> = [
  ["anime",              /\banime\b|\bmanga\b|\bkawaii\b|\bchibi\b|\bghibli\b/i],
  ["western",            /\b(western|cowboy|wild west|wanted poster|saloon|frontier|old ?west)\b/i],
  ["realism",            /\b(photoreal|photorealistic|realism|editorial photo|magazine layout)\b/i],
  ["cyberpunk",          /\bcyberpunk\b|\bneon (city|noir)\b|\bnight ?city\b|\bshadowrun\b/i],
  ["art-deco",           /\bart[- ]?deco\b|\bgatsby\b|\b1920s?\b/i],
  ["brutalist",          /\bbrutalist\b|\braw html\b|\banti[- ]?design\b/i],
  ["retro-futurist",     /\b(retro[- ]?futur|synthwave|vaporwave|outrun|80s (aesthetic|sci[- ]?fi))\b/i],
  ["editorial-minimal",  /\b(editorial|magazine minimal|new yorker style|swiss minimal)\b/i],
  ["organic",            /\b(organic|natural|earthy|hand[- ]?drawn|cottagecore)\b/i],
];

export function detectStylePalette(text: string): StylePaletteId | null {
  if (!text) return null;
  const cue = /\b(style|theme|aesthetic|look|vibe|design (system|language)|make (it|this)|redesign)\b/i;
  if (!cue.test(text)) return null;
  for (const [id, re] of STYLE_PATTERNS) if (re.test(text)) return id;
  return null;
}

/** Optional narrowed palette injection — used when a style is detected so we
 *  don't have to inject all 9 palettes into the token budget. */
export function buildActiveStyleDirective(style: StylePaletteId): string {
  return `\n## ACTIVE STYLE PALETTE: ${style.toUpperCase()}\nUse ONLY the tokens/type/motion defined for "${style}" in the multi-style palette catalog above. Emit design tokens as CSS custom properties in index.css and Tailwind config, never hardcoded hex.\n`;
}
