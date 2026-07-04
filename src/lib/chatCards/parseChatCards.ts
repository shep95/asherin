// Generalized "Card Protocol" parser for Aureon / Asher assistant streams.
// The model emits fenced blocks of the form:
//
//   ```card:<type>
//   { ...json payload... }
//   ```
//
// This walker splits assistant content into text + card segments in the
// order they appear. The legacy ```gematria fence is preserved as an alias
// for card:gematria so older streams still render.
//
// Design notes (flaw taxonomy applied):
//  - Regex is built fresh per call (no stateful /g lastIndex bugs).
//  - Payload JSON is best-effort; malformed payload → segment dropped, not thrown.
//  - Unknown card `type` values become inert `unknown` segments so the UI can
//    show a soft "unsupported card" chip instead of leaking raw JSON.
//  - Max payload size guard (8 KB) blocks accidental prompt-injection of huge
//    blobs into the render layer.

export type CardType =
  // Gematria family (domain-specific)
  | "gematria"
  | "gematria-compare"
  | "number-lookup"
  // Universal shape-based cards
  | "info"
  | "entity"
  | "timeline"
  | "comparison"
  | "stat"
  | "quote"
  | "sources"
  | "list"
  | "warning";

export interface CardSegment {
  type: "card";
  cardType: CardType;
  payload: Record<string, unknown>;
}
export interface UnknownCardSegment {
  type: "card-unknown";
  rawType: string;
}
export interface TextSegment {
  type: "text";
  value: string;
}

export type ChatSegment = TextSegment | CardSegment | UnknownCardSegment;

// Payload guard is generous: universal cards may carry markdown descriptions
// and long timelines, so raise the ceiling from 8 KB → 32 KB.
const MAX_PAYLOAD_BYTES = 32 * 1024;
const KNOWN: ReadonlySet<CardType> = new Set([
  "gematria",
  "gematria-compare",
  "number-lookup",
  "info",
  "entity",
  "timeline",
  "comparison",
  "stat",
  "quote",
  "sources",
  "list",
  "warning",
]);

/** Split assistant `content` into ordered text / card segments. */
export function parseChatCards(content: string): ChatSegment[] {
  const src = content ?? "";
  if (!src) return [{ type: "text", value: "" }];
  // Cheap short-circuit: no fences at all → single text segment.
  if (src.indexOf("```") === -1) return [{ type: "text", value: src }];

  // Match either the new `card:<type>` fence OR the legacy `gematria` fence.
  // Group 1 = new type (may be undefined). Group 2 = body.
  const re = /```(?:card:([a-z0-9-]+)|gematria)\s*\n?([\s\S]*?)```/gi;

  const out: ChatSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ type: "text", value: src.slice(last, m.index) });

    const rawType = (m[1] || "gematria").toLowerCase();
    const body = (m[2] || "").trim();

    last = m.index + m[0].length;

    if (body.length > MAX_PAYLOAD_BYTES) continue; // silently drop giant payloads

    let payload: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      // Back-compat: legacy gematria fence sometimes contained raw phrase text.
      if (rawType === "gematria") {
        const phrase = body.split("\n")[0].trim();
        if (phrase) payload = { phrase };
      }
    }

    if (!payload) continue;

    if (KNOWN.has(rawType as CardType)) {
      out.push({ type: "card", cardType: rawType as CardType, payload });
    } else {
      out.push({ type: "card-unknown", rawType });
    }
  }

  if (last < src.length) out.push({ type: "text", value: src.slice(last) });
  return out;
}
