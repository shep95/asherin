// Parse assistant chat content for ```gematria\n{"phrase":"..."}\n``` fences.
// Non-stateful: builds a fresh regex per call. Only intercepts the exact
// `gematria` language tag so ordinary ```ts / ```json blocks pass through.

export type ChatSegment =
  | { type: "text"; value: string }
  | { type: "gematria"; phrase: string; note?: string };

const MAX_PHRASE = 200;

export function parseChatGematria(content: string): ChatSegment[] {
  if (!content || content.indexOf("```gematria") === -1) {
    return [{ type: "text", value: content ?? "" }];
  }
  const re = /```gematria\s*\n?([\s\S]*?)```/g;
  const out: ChatSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: content.slice(last, m.index) });
    }
    const body = (m[1] || "").trim();
    let phrase = "";
    let note: string | undefined;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.phrase === "string") {
        phrase = parsed.phrase.slice(0, MAX_PHRASE);
        if (typeof parsed.note === "string") note = parsed.note.slice(0, 200);
      }
    } catch {
      // Fallback: treat body as raw phrase (first line only)
      phrase = body.split("\n")[0].slice(0, MAX_PHRASE);
    }
    if (phrase.trim()) {
      out.push({ type: "gematria", phrase: phrase.trim(), note });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    out.push({ type: "text", value: content.slice(last) });
  }
  return out;
}
