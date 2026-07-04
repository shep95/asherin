// Detect a ZOSMA directive inside a chat message.
// Trigger only on the user's own turn (never inside quoted/pasted content-only messages).
// Returns { modulus?: bigint, primeBits?: number } when a directive is present.

export interface ZosmaIntent {
  modulus?: bigint;
  primeBits?: number;
  url?: string;   // NEW — "zosma url https://example.com" branches to cert inspector.
  raw: string;
}


// Verbs that indicate the user is directing ZOSMA (not just mentioning it).
const VERB_RE = /\b(zosma|lco|aureon[-\s]?void|crack|factor(?:ize)?|shor'?s?|break|attack)\b/i;

// Explicit "zosma"/"lco" keyword must appear for the trigger to fire —
// prevents ordinary "please factor this" prompts from silently invoking crypto.
const ANCHOR_RE = /\b(zosma|lco|aureon[-\s]?void)\b/i;

// Match N= / modulus= / bare very-long integer.
const MODULUS_RE = /(?:\b(?:N|modulus|n)\s*[:=]\s*)?(\d{10,})/;
const HEX_MODULUS_RE = /(?:\b(?:N|modulus)\s*[:=]\s*)?0x([0-9a-fA-F]{8,})/;

// "64-bit", "primeBits 48", "run at 48 bits"
const BITS_RE = /\b(\d{2,3})\s*[- ]?bit\b/i;

export function detectZosmaIntent(text: string): ZosmaIntent | null {
  if (!text || typeof text !== "string") return null;
  // Reject if the ZOSMA verb appears only inside a fenced code block or blockquote.
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^>.*$/gm, " ");
  if (!ANCHOR_RE.test(stripped)) return null;
  if (!VERB_RE.test(stripped)) return null;

  // URL directive — "zosma url https://…" or any https URL alongside a zosma verb.
  let url: string | undefined;
  const urlMatch = stripped.match(/\bhttps?:\/\/[^\s<>"')]+/i);
  if (urlMatch) {
    try {
      const u = new URL(urlMatch[0]);
      if (u.protocol === "https:" || u.protocol === "http:") url = u.toString();
    } catch { /* ignore */ }
  }

  let modulus: bigint | undefined;
  const hex = stripped.match(HEX_MODULUS_RE);
  if (hex) {
    try { modulus = BigInt("0x" + hex[1]); } catch { /* ignore */ }
  }
  if (!modulus) {
    const dec = stripped.match(MODULUS_RE);
    if (dec) {
      try {
        const cand = BigInt(dec[1]);
        // Ignore small integers like "48" from bit-spec — require ≥ 2^32.
        if (cand > 0xffffffffn) modulus = cand;
      } catch { /* ignore */ }
    }
  }

  let primeBits: number | undefined;
  const bm = stripped.match(BITS_RE);
  if (bm) {
    const n = Number(bm[1]);
    if (n >= 16 && n <= 64) primeBits = n;
  }

  return { modulus, primeBits, url, raw: text.trim() };
}

