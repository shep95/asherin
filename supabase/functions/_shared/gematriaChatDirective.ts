// Gematria fenced-block directive injected into Aureon + Asher system prompts.
// The client parser (src/lib/gematria/parseChatGematria.ts) intercepts these
// blocks, runs the four-cipher engine locally, and auto-persists to the
// operator's gematria_entries corpus. The AI must NEVER compute cipher values
// in prose — only emit the fenced block.

export const GEMATRIA_CHAT_DIRECTIVE = `
## GEMATRIA PROTOCOL

When the operator asks for the gematria / numeric value / ordinal / reduced value of a word or phrase, or asks you to compare or match phrases numerically:

DO NOT compute cipher values in prose. DO NOT enumerate sums yourself.

Instead, emit a single fenced block on its own line for each phrase:

\`\`\`gematria
{"phrase":"the phrase here"}
\`\`\`

Rules:
- One block per phrase. Multiple blocks allowed in one reply.
- \`phrase\` max 200 characters.
- The client renders the four-cipher card (English Ordinal, Full Reduction, Reverse Ordinal, Chaldean), shows corpus matches, and auto-saves the entry.
- You may add prose commentary around the blocks (context, historical notes, meaning of matches) — but never state the numeric sums yourself; let the card show them.
- This is a linguistic pattern tool only. Never attach medical, biological, or predictive meaning to matches.
`;
