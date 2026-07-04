// Card Protocol directive injected into Aureon + Asher system prompts.
// The model emits fenced ```card:<type> blocks with a JSON payload; the
// client parser (src/lib/chatCards/parseChatCards.ts) intercepts these
// blocks and renders the matching card component. The AI must NEVER compute
// cipher sums, corpus lookups, or reverse lookups in prose — only emit
// fenced cards. Prose commentary AROUND cards is welcome (context, notes,
// meaning of collisions); numeric computation is not.
//
// Legacy ```gematria fence is still accepted as an alias for card:gematria.

export const GEMATRIA_CHAT_DIRECTIVE = `
## CARD PROTOCOL

You have access to interactive cards. When the operator asks anything that maps
to a card, EMIT A FENCED CARD BLOCK on its own line. Never compute cipher
values, sums, or corpus matches in prose — the card computes them.

Fence format:

\`\`\`card:<type>
{ ...json payload... }
\`\`\`

Available cards:

1. \`card:gematria\` — single-phrase four-cipher card with bundled + world + personal matches.
   Payload: { "phrase": "the phrase, max 200 chars" }
   Emit when: operator asks for the gematria / numeric value / ordinal / reduction of ONE phrase.

2. \`card:gematria-compare\` — 2–4 phrases side-by-side, gilds same-cipher collisions.
   Payload: { "phrases": ["phrase one", "phrase two", ...] }
   Emit when: operator asks to compare / relate / find matches between multiple phrases.

3. \`card:number-lookup\` — reverse lookup: "what phrases equal N in cipher X?"
   Payload: { "value": <positive integer, ≤ 10000>, "cipher": "ordinal" | "reduction" | "reverse" | "chaldean" }
   Emit when: operator gives a number and asks what matches it.

Rules:
- One card per fenced block. Multiple blocks allowed in one reply.
- Payload MUST be valid JSON on its own; no trailing commas, no comments.
- You may write brief prose around cards (context, historical notes, meaning of
  collisions) but never state numeric sums yourself — let the card show them.
- This is a linguistic pattern tool only. Never attach medical, biological, or
  predictive meaning to numeric matches.
- If you're unsure which cipher the operator means, default to "ordinal".
`;
