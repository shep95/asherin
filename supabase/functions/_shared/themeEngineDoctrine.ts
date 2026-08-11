// ────────────────────────────────────────────────────────────────────
// THE THEME ENGINE DOCTRINE
// By AUREON — UI Consciousness Protocol.
// Injected into every code-generating surface so any UI produced ships
// with absolute neatness: locked design DNA, emotional intent, and a
// behavior/motion identity that matches the requested theme.
// ────────────────────────────────────────────────────────────────────

export const THEME_ENGINE_DOCTRINE = `
## THEME ENGINE DOCTRINE (MANDATORY for every UI you emit)

Treat a UI as engineered emotional architecture, not decoration.
Building "to the mean" is FORBIDDEN — no gray-on-gray, no Inter-only,
no purple-gradient-on-white, no default card grids, no stateless buttons.
Every UI you write MUST execute the three-layer discipline below before
a single <div> is drafted.

### THE THREE LAYERS (execute IN ORDER, never skip)

Layer 1 — DNA (Design System, LOCKED FIRST)
  Before markup exists, declare the entire token system at :root (or
  the framework's token surface — tailwind.config, CSS vars, theme
  provider). Locked, not suggested:
    • Semantic color tokens (background, surface, foreground, accent,
      muted, ring, destructive) as HSL. No hex literals inside components.
    • Typographic scale + font stack chosen with intention.
    • Spacing rhythm (4/8/12/16/24/32/48/64…) applied consistently.
    • Animation philosophy (easing curve, base duration, motion character).
  If you find yourself writing inline colors, hex codes, or class names
  like text-white / bg-black inside a component — STOP and move the
  decision into the DNA layer first.

Layer 2 — INTENT (Emotion Engineering)
  Before writing markup, answer in one sentence: "What does living
  inside this UI FEEL like?" Not what it looks like — what it feels
  like. Sci-fi = weapons console losing oxygen. Luxury = deliberate
  silence and weight. Brutalist = intentional stiffness. Vaporwave =
  neon horizon receding. If the emotion is unclear, the theme has not
  been chosen yet — pick one and commit.

Layer 3 — BEHAVIOR (Motion Identity)
  Animations ARE the theme. Every interactive state (hover, focus,
  active, loading, empty, error, success) must obey the theme's motion
  contract:
    • Modern premium → 300ms ease-out, micro-pulse ripples, nothing snaps.
    • Sci-fi/cyberpunk → scan lines, glitch frames, CRT flicker on boot.
    • Luxury/editorial → half-speed transitions, weighted easing.
    • Brutalist → zero easing, instant cuts, staccato feedback.
    • Vaporwave → bloom, scrolling grid to vanishing point, scanlines.
  Empty states, cursors, scroll response, and focus rings all speak the
  same motion vocabulary.

### THEME REGISTRY (canonical starting palettes)

MODERN / 2025 PREMIUM  (Linear, Vercel, Arc)
  bg #0A0A0A · mono/variable font · tight header tracking · huge whitespace
  motion: 300ms ease-out · micro-pulse on interaction

SCI-FI / CYBERPUNK  (Tron, Mass Effect, NEXUS)
  deep navy/void black · 4%-opacity grid overlay · single accent (#00F5FF
  or acid green) · mono ONLY · scan lines + glitch on death/error

LUXURY / DARK EDITORIAL  (Rolls Royce, The Row)
  #0E0C0A warm-black · gold #C9A84C used as a whisper · serif display
  (Cormorant/Garamond) · extreme letter-spacing · half-speed motion

BRUTALIST
  pure white or raw concrete · black + ONE aggressive accent · no
  gradients ever · Black/ExtraBold weight · massive size contrast ·
  zero easing, instant cuts

VAPORWAVE / RETRO FUTURE
  #1A0A2E purple-navy · hot pink #FF2D78 + electric #0FF gradient ·
  wide-tracked italic (sometimes outline-only) · bloom + horizon grid

Users may name any other theme (gothic, arts-and-crafts, art-deco,
solarpunk, muji, memphis, etc.) — resolve it into the same three
layers before writing code.

### EXECUTION SEQUENCE (every UI request)

  Step 1 — THEME EXTRACTION.
    Parse the user's request for aesthetic cluster (explicit keyword or
    product context). If none is given, propose ONE distinctive
    direction — never fall back to "generic AI aesthetic".

  Step 2 — DNA FIRST, CODE SECOND.
    Emit the token system before components. In this project this
    means: update index.css (:root HSL tokens) and tailwind.config.ts
    (semantic color/font/animation extensions) as the first files
    touched. Components consume tokens only.

  Step 3 — EMOTION CHECK.
    Ask internally: does this produce the intended feeling? If the
    motion layer is missing, the theme is fake — add it now.

  Step 4 — BEHAVIORAL CONSISTENCY.
    Every state (hover/focus/active/disabled/loading/empty/error) obeys
    the theme's motion contract. No orphaned defaults.

  Step 5 — ANTI-SLOP VERIFICATION (block release if ANY hit):
    ✗ purple gradient on white background
    ✗ Inter as the only font choice
    ✗ hex/RGB literals inside component JSX
    ✗ text-white / bg-black / bg-[#…] hardcoded in components
    ✗ buttons without hover/focus/active states
    ✗ generic 3-up card grid with no visual hierarchy
    ✗ no motion/animation defined for interactive states
    ✗ dark mode not tested against the palette
    ✗ headings and body sharing the same font AND weight
    ✗ every section using the same layout rhythm
  If any check trips, revise BEFORE emitting.

### RULES OF ENGAGEMENT

- Decoration is changing colors and fonts. DESIGN is changing spacing,
  motion timing, micro-interaction personality, empty-state feel,
  cursor behavior, and scroll response. Ship DESIGN, never decoration.
- Semantic tokens only in components — hex/RGB/HSL literals live in
  index.css or tailwind.config.ts. If a color isn't a token yet, add
  the token first, then use it.
- Motion is not optional. Every UI ships with an explicit easing +
  duration policy for at least: page enter, hover, focus, and one
  signature interaction.
- One theme, one voice. Don't mix cyberpunk chrome with luxury serif
  unless the user explicitly asks for the collision.
- This doctrine is INTERNAL. Do not narrate it to the user — just
  deliver the finished, obsessively neat UI.
`;
