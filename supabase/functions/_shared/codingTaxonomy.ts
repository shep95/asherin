// ───────────────────────────────────────────────────────────────────────────
// CODING TAXONOMY — the full flaw+craft dimensional grid injected into every
// coding engine (Aureon Chat, Asher Chat, Asher Code IDE, IDE Code Router,
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
walk EVERY dimension below. Never skip a dimension. Emit a one-line finding
per dimension even if the finding is "clean" — silence is not evidence.

### 1. WORKFLOW & ORCHESTRATION
- State-machine completeness: every state has entry, exit, and error edges.
- Idempotency keys on every mutation that can be retried by client/network.
- Compensation / rollback path for every multi-step write.
- Fan-out with bounded concurrency (no unbounded Promise.all over user input).
- Fan-in join with timeout so one slow branch cannot stall the whole workflow.
- Ordering guarantees named explicitly: FIFO? causal? per-key? none?
- Dead-letter path for messages that fail past retry budget.
- Backpressure: producer stops (or spills) when consumer lags.
- Job resumption after crash: checkpoint frequency + resume semantics.
- Scheduled work: cron drift, missed-tick catch-up, DST hazards.

### 2. CODE LOGIC & CORRECTNESS
- Off-by-one on every index range and every date range.
- Missing early-return guards → wrong branch executes on empty/null.
- Discriminated-union exhaustiveness (never falls through the default case).
- Boolean short-circuit ordering: cheap checks before expensive.
- Loop invariants documented for anything non-trivial.
- Mutation of props / arguments / shared state.
- Stale closures (React callbacks capturing yesterday's state).
- Silent number coercions (parseInt without radix, "0" == false, NaN).
- Time zone: every timestamp is UTC in storage, converted only at edges.
- Precision: currency in minor units (cents), never float dollars.

### 3. BUG-CLASS
- Null / undefined deref on every optional chain.
- Unhandled promise rejection (every await inside a try or .catch).
- Race conditions (double-submit, click-during-load, tab-switch mid-fetch).
- Use-after-free equivalents (unsubscribed listeners, cancelled AbortController still resolving).
- Integer overflow on ids, counters, timestamps > 2038 for 32-bit paths.
- Recursive functions without a depth cap.

### 4. SECURITY
- Injection: SQL parameterized, shell escaped, NoSQL operator injection, XPath, LDAP, log-forging (\\r\\n).
- Prompt injection: user text never concatenated into a system prompt without a fence + rules.
- IDOR: every read/write authorized against the *record's* owner, not the request's session.
- RLS on every public table + explicit GRANTs for every role that touches it.
- SSRF: outbound fetch host allow-list, no user-supplied URL to loopback/metadata endpoints.
- XSS: rendered HTML sanitized OR text-node-only; framework auto-escape not defeated by dangerouslySetInnerHTML.
- CSRF: state-changing endpoints require token or SameSite=strict cookies.
- Secret hygiene: no secrets in code, no secrets in logs, no secrets in error messages, no secrets in URLs.
- Crypto: AEAD (AES-GCM/ChaCha20-Poly1305), never ECB, never hand-rolled, keys rotated, IV never reused.
- Auth: password hashing = argon2id or bcrypt≥12, JWT signature verified, aud/iss/exp checked.
- File upload: content-type sniffed server-side, size capped, path traversal blocked.
- Deserialization: never eval, never pickle, never yaml.load unsafe, never JSON.parse of untrusted with reviver.

### 5. CONCURRENCY & DATA
- Lost updates: read-modify-write wrapped in txn or CAS.
- Cache invalidation: single source of truth, TTL + explicit invalidation on write.
- Schema drift: migrations are additive, deploy-order-safe (backfill before drop).
- Pagination: cursor-based for anything > 1000 rows, offset only for admin.
- N+1: joined query OR batched loader, never per-row fetch inside a map.
- Distributed txn: outbox pattern for "write DB + emit event" atomicity.

### 6. PERFORMANCE
- Big-O of every hot path named (O(n), O(n log n), O(n²), etc.).
- Missing indexes on every WHERE / ORDER BY / JOIN column.
- Render performance: memoization on expensive derived state, list virtualization > 200 rows.
- Bundle size: dynamic import for anything > 40 KB not needed at first paint.
- Memory leaks: every setInterval cleared, every subscription unsubscribed on unmount.
- Main thread: no synchronous work > 50 ms on user input path.

### 7. API / NETWORK
- Every fetch has: timeout, AbortController, retry policy (only idempotent), backoff, non-2xx handling, response schema validation.
- Every WebSocket / SSE: reconnect with backoff + jitter, resume from last seq id.
- CORS explicit allow-list, never "*" with credentials.
- Rate limit both directions: server 429 with Retry-After honored client-side.

### 8. UI / UX / ANIMATION / A11Y
- Every async surface has four states: idle, loading, empty, error — none omitted.
- Loading: skeleton or shimmer, never a naked spinner over content.
- Empty: explains the state + a next action, not just "no data".
- Error: names the error class + a retry affordance.
- Layout stability: no CLS > 0.1 on hero/nav/footer during load.
- Keyboard navigation: tab order matches visual order; every interactive has :focus-visible.
- ARIA: role, label, described-by present where semantics don't suffice.
- Contrast: WCAG 2.1 AA (4.5:1 body, 3:1 large text) verified against the actual rendered palette.
- Motion: 60 fps target; only transform + opacity animated; will-change on triggered elements only; prefers-reduced-motion honored.
- Focus trap on modal open; return focus on close.
- Reduced motion path defined for every celebratory animation.

### 9. REALISM & OBSERVABILITY (never ship a mock as if it were live)
- Every data-fetching feature backed by a REAL upstream (documented) — no lorem ipsum fixture pretending to be live.
- Every claim in a UI is either directly from the upstream response OR labeled "estimate".
- Every user-visible number cites its source in the code comment.
- Structured logging on every auth event, mutation, and outbound API call.
- Error boundaries at route level with a real diagnostic payload sent to the log sink.
- Feature flags for anything that can be silently degraded.
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
