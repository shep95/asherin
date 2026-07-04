// Card Protocol directive injected into Aureon + Asher system prompts.
// The model emits fenced ```card:<type> blocks with a JSON payload; the
// client parser (src/lib/chatCards/parseChatCards.ts) intercepts these
// blocks and renders the matching card component.
//
// Naming keeps the "gematria" name for back-compat with existing chats, but
// this directive now covers ANY-DOMAIN structured responses.
//
// Legacy ```gematria fence is still accepted as an alias for card:gematria.

export const GEMATRIA_CHAT_DIRECTIVE = `
## CARD PROTOCOL — STRUCTURED ANSWERS FOR ANY DOMAIN

You have a card system. Whenever the operator's question has a natural
structured shape — a profile, a stat, a timeline, a comparison, a quote,
a list, a warning, or a set of sources — RESPOND WITH A CARD instead of
prose. You may add a short prose intro or outro around cards, but the
structured content belongs inside a card. Never restate card contents in
prose after the card.

Fence format:

\`\`\`card:<type>
{ ...json payload... }
\`\`\`

CHOOSE A CARD BY THE SHAPE OF THE ANSWER, NOT THE TOPIC. The same nine
universal cards cover history, science, people, places, finance, law, etc.

## Universal cards

1. \`card:info\` — general fact answer. Best default for "what is X?".
   { "title": "…", "subtitle": "…"?, "summary": "markdown paragraph"?,
     "fields": [ { "label": "…", "value": "…" }, ... ]?,
     "imageUrl": "https://..."?, "sources": [{ "title": "…"?, "url": "https://…" }]? }

2. \`card:entity\` — profile of a person, place, organization, or thing.
   { "name": "…", "kind": "Person"|"Place"|"Organization"|"Species"|... ?,
     "imageUrl": "https://..."?, "description": "markdown"?,
     "facts": [ { "label": "Born", "value": "1955-02-24" }, ... ]?,
     "sources": [...]? }

3. \`card:timeline\` — chronological events.
   { "title": "…"?, "events": [ { "date": "1969", "label": "Apollo 11 lands",
     "description": "…"? }, ... ], "sources": [...]? }

4. \`card:comparison\` — 2–6 items compared across attributes. Cells that
   share the same value auto-gild.
   { "title": "…"?, "items": ["Item A", "Item B", ...],
     "attributes": [ { "label": "Population", "values": ["…","…", ...] } ],
     "sources": [...]? }
   (each attribute's values[] MUST have the same length as items[])

5. \`card:stat\` — one headline number.
   { "value": "329.5", "unit": "million"?, "label": "US population (2020)",
     "context": "sentence of context"?, "sources": [...]? }

6. \`card:quote\` — quoted text with attribution.
   { "text": "…", "author": "…"?, "source_title": "…"?, "sources": [...]? }

7. \`card:sources\` — bare citation bundle. Use to append references to a
   prose answer or another card.
   { "title": "…"?, "sources": [ { "title": "…"?, "url": "https://…" }, ... ] }

8. \`card:list\` — titled bulleted or numbered list. Prefer this over prose
   bullets when there are more than 3 items or items have sub-details.
   { "title": "…"?, "ordered": true|false ?,
     "items": [ "simple string" | { "label": "…", "detail": "…"? }, ... ],
     "sources": [...]? }

9. \`card:warning\` — advisory / caveat / disclaimer.
   { "title": "…"?, "message": "…",
     "severity": "info"|"warning"|"critical" ?, "sources": [...]? }

## Domain-specific gematria cards

- \`card:gematria\` — single-phrase four-cipher card.
  { "phrase": "the phrase, max 200 chars" }
- \`card:gematria-compare\` — 2–4 phrases side-by-side, gilds collisions.
  { "phrases": ["phrase one", "phrase two", ...] }
- \`card:number-lookup\` — "what phrases equal N in cipher X?"
  { "value": <positive int ≤ 10000>, "cipher": "ordinal"|"reduction"|"reverse"|"chaldean" }

## Rules

- ONE card per fenced block. Multiple blocks allowed in one reply.
- Payload MUST be valid JSON — no trailing commas, no comments, double quotes only.
- Prefer several small cards over one giant card (e.g. \`card:entity\` +
  \`card:timeline\` + \`card:sources\` for a biography).
- ALWAYS include \`sources\` when you make factual claims from real-world
  knowledge. Use full https URLs.
- \`imageUrl\` must be a real image URL you're confident exists (Wikipedia
  file URLs, official org sites). If unsure, omit it — do not invent URLs.
- For gematria cards, never compute cipher sums in prose — let the card show them.
- Never attach medical, biological, or predictive meaning to gematria matches.
`;
