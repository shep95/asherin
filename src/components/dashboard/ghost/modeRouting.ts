// Asherin Engine — input-type routing, made visible and correctable.
//
// The engine has four verbs and, until now, the operator had to know which one
// their input deserved before they typed it. That is the wrong way round: the
// input almost always announces its own verb. An `@` means an identifier. A
// scheme and a host mean a document whose provenance is the question. A year
// range or the word "archive" means reach-back. Everything else is a sweep.
//
// The failure mode this replaces was silent, which is the worst kind: paste a
// PDF URL into the box while INTERCEPT happens to be selected and the engine
// dutifully runs a keyword sweep on a URL string, returns nothing useful, and
// never says that the wrong verb was applied. So routing is now inferred,
// SHOWN, and overridable in one click — inference proposes, the operator
// disposes, and the override sticks for the session so a deliberate choice is
// never silently re-inferred out from under them on the next keystroke.

export type GhostMode = "intercept" | "origin" | "deeptime" | "identifier";
export type GhostRoute = GhostMode | "auto";

export interface RoutingCall {
  mode: GhostMode;
  /** Why the classifier landed here, in the operator's language. */
  reason: string;
  /** 0–100. Below ~60 the banner invites correction rather than asserting. */
  confidence: number;
}

const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
// E.164 and the common national shapes, once punctuation is stripped.
const PHONE_CHARS = /^[+()\-.\s\d]{7,22}$/;
const URLISH = /^(https?:\/\/|www\.)\S+$/i;
const BARE_HOST_PATH = /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S+$/i;
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|jpe?g|png|tiff?|heic|csv|json|xml)(\?|#|$)/i;
const YEAR_RANGE = /\b(19|20)\d{2}\s*(?:-|–|to|through|until)\s*(?:(19|20)\d{2}|now|today|present)\b/i;
const REACHBACK = /\b(archive|archived|wayback|历史|history of|since \d{4}|earliest|first published|oldest|over time|deep ?time|timeline)\b/i;

/**
 * Infer the verb an input deserves. Pure, synchronous, and deliberately
 * conservative: when the signals disagree it returns INTERCEPT with a low
 * confidence rather than guessing, because a wrong-but-confident route costs
 * the operator a full budgeted run.
 */
export function classifyInput(raw: string): RoutingCall {
  const q = raw.trim();
  if (!q) return { mode: "intercept", reason: "nothing typed yet", confidence: 0 };

  // ── Identifier: an address or a number is a person, not a topic ─────────
  if (EMAIL.test(q)) {
    return { mode: "identifier", reason: "an email address — this is a person, so confirm every sighting", confidence: 97 };
  }
  const digits = q.replace(/[^\d]/g, "");
  if (PHONE_CHARS.test(q) && digits.length >= 7 && digits.length <= 15 && /\d/.test(q[0] === "+" ? q[1] ?? "" : q[0])) {
    return { mode: "identifier", reason: "a phone number — this is a person, so confirm every sighting", confidence: 92 };
  }

  // ── Origin: a specific artefact, so the question is where it came from ──
  const looksLikeUrl = URLISH.test(q) || BARE_HOST_PATH.test(q);
  if (looksLikeUrl && !q.includes(" ")) {
    const isDoc = DOC_EXT.test(q);
    return {
      mode: "origin",
      reason: isDoc
        ? "a document address — trace its authoring machine, clock and lineage"
        : "a single address — trace its redirects, hosting and lineage",
      confidence: isDoc ? 95 : 84,
    };
  }

  // ── Deep time: the question is when, not what ───────────────────────────
  if (YEAR_RANGE.test(q) || REACHBACK.test(q)) {
    return { mode: "deeptime", reason: "the phrasing asks when, not what — reach back through the record", confidence: 80 };
  }

  // ── Everything else is a sweep ──────────────────────────────────────────
  const words = q.split(/\s+/).length;
  return {
    mode: "intercept",
    reason: words > 2 ? "a topical query — sweep the open index" : "a short selector — sweep the open index",
    confidence: words > 2 ? 74 : 58,
  };
}

/** Resolve a stored route preference against a live input. */
export function resolveRoute(route: GhostRoute, input: string): RoutingCall & { auto: boolean } {
  const call = classifyInput(input);
  if (route === "auto") return { ...call, auto: true };
  return {
    mode: route,
    auto: false,
    confidence: 100,
    reason: route === call.mode
      ? call.reason
      : `held by you — the input reads as ${MODE_LABEL[call.mode].toLowerCase()}`,
  };
}

export const MODE_LABEL: Record<GhostMode, string> = {
  intercept: "Intercept",
  origin: "Origin",
  deeptime: "Deep Time",
  identifier: "Identifier",
};

export const MODE_BLURB: Record<GhostMode, string> = {
  intercept: "Sweep the open index and retain the bodies.",
  origin: "Trace one artefact back to the machine that made it.",
  deeptime: "Carve dates and reach back through the record.",
  identifier: "Confirm every page an address or number actually appears on.",
};
