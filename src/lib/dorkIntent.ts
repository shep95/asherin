// dorkIntent.ts — Deno mirror of src/lib/dorkIntent.ts, used inside the
// chat edge function so triggering stays in perfect lockstep with the
// client-side detector.
//
// Narrative → flaws → new narrative (subject resolution):
//   Old behaviour: "dork for my information please." fired the battery but the
//   subject fell through to the *instruction line itself* ("dork for my
//   infomation"), so 100 theories were generated against a meaningless string
//   and the operator saw unrelated noise. Three flaws:
//     1. The trigger words were never stripped before subject extraction.
//     2. Self-reference ("my", "me", "myself") was treated as a topic instead
//        of resolving to the operator's own identifiers.
//     3. Strong identifiers (email / phone / handle) inside pasted text were
//        ignored in favour of the first capitalised word pair.
//   New behaviour: strip instruction verbiage → prefer hard identifiers
//   (email > phone > handle > domain > quoted string > proper name) scanned
//   across the WHOLE turn including pasted attachments → flag self-target so
//   the caller can bind the operator's own identity → refuse to fire on a junk
//   subject rather than burning a 100-theory battery on filler words.
//
// Domain classify (operator 2026-08-15): a belief/stance turn
// ("do you believe in a God?") is not an exposure sweep. Quoted theological
// words are not intel anchors. Hard dork + real identifier still fires.

export type DorkKind = "person" | "domain" | "organization" | "topic" | "email" | "phone" | "handle";

export type TurnDomain = "belief" | "cyber" | "intel" | "maps" | "code" | "legal" | "smalltalk" | "general";

export interface DorkTrigger {
  fire: boolean;
  subject: string;
  kind: DorkKind;
  /** true when the operator asked about themselves ("dork for my information") */
  selfTarget: boolean;
  hints: { domain?: string; location?: string; country_tld?: string };
  reason: string;
}

const HARD_TRIGGERS = [
  /\bdork(ing|s)?\b/i,
  /\bgoogle\s*dork/i,
  /\b(run|do|perform|execute|fire)\s+(a\s+)?(google\s+)?dork/i,
  /\bdork\s+(for|on|against|me)\b/i,
  /\baudit\s+(my\s+)?exposure\b/i,
  /\bself[-\s]?audit\b/i,
  /\bwhat.{0,10}(publicly?|leaked?|exposed?)\s+(is|about)\b/i,
  /\bexpose(d)?\s+(files|docs|credentials|env|api\s*keys)\b/i,
  /\b(find|surface)\s+(exposed|leaked|indexed|public)\b/i,
];
const SOFT_VERBS = /\b(find|surface|expose|reveal|dig up|hunt|scan|sweep|map|profile|deep\s*search)\b/i;
const SOFT_OBJECTS =
  /\b(everything|footprint|dossier|exposure|public\s+data|open\s+web|attack\s+surface|leaks|indexed)\b/i;

// NATURAL intelligence verbs — when paired with a hard identifier (email,
// phone, domain, handle) in the same turn, they imply a dork sweep even
// without the literal word "dork". Prevents the common failure where the
// operator says "look up this email" and the trigger never fires.
const INTEL_VERBS =
  /\b(look\s*(up|into)|lookup|background\s*check|background\s*on|who\s+is|whois|tell\s+me\s+about|info\s+on|information\s+on|dig\s+(up|into)|investigate|profile|check\s+out|research|deep\s*dive|run\s+(a|the)?\s*(check|report|sweep|scan)\s+on|get\s+(me\s+)?(everything|info|intel|dirt)\s+on|pull\s+(a\s+)?(report|record)\s+on|osint\s+(on|this)|recon\s+on)\b/i;

/** "dork for my information", "audit me", "what's public about myself" */
const SELF_RE = /\b(my|me|myself|mine|my\s+own|i\s+am|i'm)\b/i;
const THIRD_PARTY_RE = /\b(his|her|their|him|them|this\s+(guy|person|man|woman|number|email))\b/i;

// Instruction verbiage that must never become the dork subject.
const INSTRUCTION_STRIP = new RegExp(
  [
    "\\b(please|pls|thanks|thank you|bro|man|dude|hey|ok|okay|now|asap)\\b",
    "\\b(can|could|would|will)\\s+you\\b",
    "\\b(aureon|asherin|ghost\\s*engine|asherin\\s*engine)\\b",
    "\\bdork(ing|s)?\\b",
    "\\b(google\\s*dork|self[-\\s]?audit)\\b",
    "\\b(run|do|perform|execute|fire|give|get|pull|bring)\\s+(me\\s+)?(a\\s+|the\\s+)?",
    "\\b(for|on|against|about)\\s+(my|me|myself)\\b",
    "\\b(my|me|myself)\\b",
    "\\b(information|info|infomation|data|details|dossier|report|exposure|footprint)\\b",
  ].join("|"),
  "gi",
);

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/i;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const HANDLE_RE = /(?:^|\s)@([a-z0-9_.]{3,30})\b/i;
const QUOTED_RE = /["“']([^"”']{3,80})["”']/;
const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{0,63}\.)+[a-z]{2,24}\b/i;

const TLD_MAP: Record<string, string> = {
  ".gov": "us",
  ".mil": "us",
  ".gov.uk": "uk",
  ".ac.uk": "uk",
  ".gov.au": "au",
  ".edu.au": "au",
  ".gov.in": "in",
  ".gov.br": "br",
};

// Extensions that make a "domain-shaped" token actually a filename. Without
// this guard "fix index.ts" and "open report.pdf" look like domains and the
// implicit layer would fire a 100-theory battery on a source file.
const FILE_EXT_RE =
  /\.(ts|tsx|js|jsx|json|md|txt|pdf|docx?|xlsx?|csv|png|jpe?g|gif|svg|webp|mp4|mov|zip|tar|gz|py|rb|go|rs|java|c|cpp|h|sh|yml|yaml|toml|lock|env|sql|html?|css|scss)$/i;

function extractDomain(text: string): string | null {
  const m = text.match(DOMAIN_RE);
  if (!m) return null;
  const d = m[0].toLowerCase();
  if (/^(e\.g|i\.e|vs|etc|inc|co)\./i.test(d)) return null;
  if (FILE_EXT_RE.test(d)) return null;
  return d;
}

function looksLikeProperName(text: string): string | null {
  const m = text.match(/\b([A-Z][a-z]{1,15})(?:\s+([A-Z][a-z]{1,15})){1,3}\b/);
  return m ? m[0] : null;
}

/** A subject made only of filler/instruction words is worthless — reject it. */
function isJunkSubject(s: string): boolean {
  const cleaned = s.replace(/[^a-z0-9\s]/gi, " ").trim();
  if (cleaned.length < 4) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const filler =
    /^(dork|dorks|dorking|for|on|about|my|me|myself|mine|please|pls|info|infomation|information|data|details|report|dossier|exposure|footprint|the|a|an|and|do|run|give|get|pull|now|bro|man|hey|ok|okay|search|lookup|look|up|god|gods)$/i;
  return words.every((w) => filler.test(w));
}

/** Quoted theological / abstract words are not OSINT anchors. */
const ABSTRACT_QUOTED =
  /^(god|gods|goddess|allah|jesus|christ|yahweh|jehovah|brahman|hashem|creator|divine|love|hate|truth|peace|war|hope|faith|soul|heaven|hell|evil|good|nothing|everything|freedom|justice|spirit|afterlife|religion)$/i;

const THEOLOGY_NOUN =
  /\b(god|gods|goddess|allah|jesus|christ|yahweh|jehovah|brahman|hashem|creator|divine|the\s+father|holy\s+spirit|afterlife|heaven|hell|soul|prayer|worship|religion|faith|atheis[mt]|agnostic|christian|muslim|hindu|jewish|buddhist)\b/i;

export function isQuotedIntelAnchor(quoted: string): boolean {
  const q = String(quoted || "").trim();
  if (!q) return false;
  if (EMAIL_RE.test(q) || PHONE_RE.test(q) || HANDLE_RE.test(" @" + q.replace(/^@/, "")) || extractDomain(q))
    return true;
  if (ABSTRACT_QUOTED.test(q)) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return true;
  return q.length >= 8;
}

export function isBeliefOrStanceTurn(text: string): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  const hardCyber = HARD_TRIGGERS.some((r) => r.test(t));
  const hasId = EMAIL_RE.test(t) || PHONE_RE.test(t) || HANDLE_RE.test(t) || !!extractDomain(t);
  if (hardCyber && hasId) return false;

  if (
    /\b(do\s+you|do\s+u|does\s+asherin|does\s+aureon|are\s+you|is\s+asherin|is\s+aureon)\b/i.test(t) &&
    /\b(believe|belief|faith|worship|pray|religious|atheist|agnostic|christian|muslim|hindu|jewish)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(believe\s+in|faith\s+in|existence\s+of|do\s+you\s+believe)\b/i.test(t) && THEOLOGY_NOUN.test(t)) return true;
  if (/\b(is\s+there\s+a\s+god|does\s+god\s+exist|meaning\s+of\s+life|is\s+there\s+an\s+afterlife)\b/i.test(t))
    return true;
  if (/\bwhat\s+(do\s+you|does\s+asherin)\s+(believe|think)\b/i.test(t) && THEOLOGY_NOUN.test(t)) return true;
  return false;
}

// ── Implicit intent ─────────────────────────────────────────────────────────
// Narrative: the operator pastes a phone number, or types a name and a city,
// or asks "is this person legit?" — every one of those is an exposure sweep,
// but none of them contain "dork", "look up", or "who is". The old detector
// required the operator to speak the platform's vocabulary, so it stayed
// silent and the human did the work the engine exists to do.
//
// Flaws in a naive "any anchor fires" rule: a pasted stack trace has domains,
// a request to "email john@acme.com the invoice" has an email, a code question
// has index.ts, and a URL the operator wants summarized is a domain. Each of
// those would burn a 100-theory battery on a non-target.
//
// New narrative: fire when an anchor exists AND at least one intent shape is
// present (bare anchor, interrogative, intel noun, or vetting question) AND no
// suppressor claims the turn for a different job.

/** Turn is doing another job — never auto-sweep it. */
const SUPPRESSORS: RegExp[] = [
  /```|<\/?[a-z]+>|\bfunction\s*\(|=>\s*\{|\bconst\s+\w+\s*=/, // code / markup
  /\b(send|email|write|draft|compose|reply|forward|cc|bcc)\s+(an?\s+|the\s+)?(email|message|note|invite|reply)\b/i,
  /\b(email|message|text|call|invite|add|cc)\s+(him|her|them|it)?\s*(at|to)?\s*[a-z0-9._%+-]+@/i,
  /\b(summari[sz]e|translate|rewrite|proofread|paraphrase|transcribe)\b/i,
  /\b(fix|debug|deploy|build|refactor|install|npm|yarn|bun|git|typescript|compile|stack\s*trace|error\s*code)\b/i,
  /\b(unsubscribe|sign\s*up|log\s*in|password\s*reset|verify\s+my\s+account)\b/i,
  /\b(buy|order|checkout|invoice|refund|subscription|billing)\b/i,
  /\b(what\s+is|explain|how\s+do(es)?)\s+(a|an|the)?\s*\b(dns|http|tls|api|regex|dork)\b/i, // teaching questions
  /\b(do\s+you|do\s+u|does\s+asherin|are\s+you)\b.{0,48}\b(believe|faith|worship|pray|religious)\b/i,
  /\bbelieve\s+in\s+(a\s+|the\s+)?["']?(god|gods|allah|jesus|christ|yahweh|creator)["']?/i,
  /\b(is\s+there\s+a\s+god|does\s+god\s+exist|meaning\s+of\s+life)\b/i,
];

/** Nouns that only appear when someone wants information ABOUT a person/org. */
const INTEL_NOUNS =
  /\b(address|addresses|phone|number|email|records?|record|arrest|criminal|court|lawsuit|warrant|mugshot|employer|employment|job|linkedin|facebook|instagram|tiktok|twitter|profile|social|relatives?|family|spouse|wife|husband|neighbou?rs?|owner|owns|property|deed|license|licence|plate|vin|breach|leak|password|exposure|footprint|history|age|dob|birth|bio|net\s*worth|company|business|registration)\b/i;

/** "Should I trust this?" — vetting is an intelligence request in disguise. */
const VETTING =
  /\b(scam|scammer|legit|legitimate|fake|real|safe|trust|trustworthy|catfish|fraud|sketchy|suspicious|spoof|phish|verify|vetted?|due\s*diligence|red\s*flags?|dangerous)\b/i;

/** Interrogative or imperative-about-a-person shapes. */
const INTERROGATIVE =
  /(^|\s)(who|whose|what|where|when|why|which|how|is|are|does|did|do|can|any(thing)?|got|show|give|tell)\b|[?]/i;

export function classifyTurnDomain(text: string): TurnDomain {
  const t = String(text || "").trim();
  if (!t) return "general";
  if (
    /```|<\/?[a-z]+>|\bfunction\s*\(|=>\s*\{|\bconst\s+\w+\s*=/.test(t) &&
    !EMAIL_RE.test(t) &&
    !HARD_TRIGGERS.some((r) => r.test(t)) &&
    /\b(fix|debug|refactor|typescript|stack\s*trace|npm|yarn|compile)\b/i.test(t)
  ) {
    return "code";
  }
  if (isBeliefOrStanceTurn(t)) return "belief";
  if (
    HARD_TRIGGERS.some((r) => r.test(t)) ||
    /\b(inurl:|intitle:|intext:|filetype:|ext:|cve-\d|xss|sqli|rce|idor|ssrf|exposed\s+files|attack\s+surface)\b/i.test(
      t,
    )
  ) {
    return "cyber";
  }
  if (/^\d{1,6}\s+.+/i.test(t) && /\b(st|street|ave|avenue|rd|road|blvd|court|ct|ln|lane|dr|drive)\b/i.test(t)) {
    return "maps";
  }
  if (EMAIL_RE.test(t) || PHONE_RE.test(t) || HANDLE_RE.test(t) || looksLikeProperName(t)) {
    if (INTEL_VERBS.test(t) || INTEL_NOUNS.test(t)) return "intel";
  }
  if (/^(hi|hello|hey|yo|sup|thanks|ok|okay|lol|cool|nice)\b/i.test(t) && t.length < 40) return "smalltalk";
  if (/\b(lawsuit|statute|contract\s+clause|gdpr|ccpa)\b/i.test(t)) return "legal";
  return "general";
}

export function detectImplicitIntent(
  text: string,
  anchors: { hasStrongId: boolean; hasProperName: boolean; hasQuoted: boolean },
): string | null {
  const hasAnchor = anchors.hasStrongId || anchors.hasProperName || anchors.hasQuoted;
  if (!hasAnchor) return null;
  if (SUPPRESSORS.some((r) => r.test(text))) return null;
  if (isBeliefOrStanceTurn(text)) return null;

  const words = text.split(/\s+/).filter(Boolean);

  // 1. Bare anchor: the operator pasted an identifier and nothing else.
  //    "239-555-0134" / "jane.doe@proton.me" / "@ghostwriter_77"
  if (anchors.hasStrongId && words.length <= 6) return "implicit_bare_anchor";

  // 2. Name + place with no verb: "Jane Doe Cape Coral Florida"
  if (anchors.hasProperName && words.length <= 10 && !/\b(i|we|you|please)\b/i.test(text) && !/[.!]$/.test(text)) {
    return "implicit_bare_name";
  }

  // 3. Vetting: "is this number a scam", "is she legit", "247-... spam?"
  if (VETTING.test(text)) return "implicit_vetting";

  // 4. Intel noun attached to an anchor: "what's Jane Doe's address",
  //    "any arrest records for @handle", "who owns acme.io"
  if (INTEL_NOUNS.test(text)) return "implicit_intel_noun";

  // 5. Interrogative aimed at an anchor with no other job claimed.
  if (INTERROGATIVE.test(text) && words.length <= 25) return "implicit_question";

  return null;
}

export function detectDorkIntent(userText: string): DorkTrigger {
  const text = String(userText || "").trim();
  const none = (reason: string): DorkTrigger => ({
    fire: false,
    subject: "",
    kind: "topic",
    selfTarget: false,
    hints: {},
    reason,
  });
  if (!text || text.length < 4) return none("empty");

  if (isBeliefOrStanceTurn(text)) return none("belief_stance");

  // Teaching question about the capability itself ("explain what a dork is")
  // is not a request to run one — answer it, don't sweep.
  if (
    /\b(explain|what\s+(is|are)|what's|how\s+(do|does|can)|define|teach\s+me|meaning\s+of)\b[^?]{0,40}\bdork(s|ing)?\b/i.test(
      text,
    )
  ) {
    return none("meta_question");
  }

  const hard = HARD_TRIGGERS.some((r) => r.test(text));
  const dorkOps = /\b(inurl:|intitle:|intext:|filetype:|ext:)\b/i.test(text);
  // operator 2026-08-18: only dork when they ask for a dork.
  if (!hard && !dorkOps) return none("no_explicit_dork_request");

  const hasStrongId = EMAIL_RE.test(text) || PHONE_RE.test(text) || HANDLE_RE.test(text) || !!extractDomain(text);
  const hasProperName = !!looksLikeProperName(text);
  const quotedRaw = text.match(QUOTED_RE)?.[1]?.trim() ?? "";
  const hasQuoted = quotedRaw.length > 0 && isQuotedIntelAnchor(quotedRaw);

  const selfTarget = SELF_RE.test(text) && !THIRD_PARTY_RE.test(text);

  // Identifier precedence — strongest anchor wins, scanned across the whole
  // turn so pasted attachments contribute the subject, not the command line.
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const handle = text.match(HANDLE_RE)?.[1] ?? null;
  const domain = extractDomain(text);
  const quoted = quotedRaw || null;

  let subject = "";
  let kind: DorkKind = "topic";
  if (email) {
    subject = email.toLowerCase();
    kind = "email";
  } else if (phone) {
    subject = phone.replace(/[^\d+]/g, "");
    kind = "phone";
  } else if (handle) {
    subject = `@${handle}`;
    kind = "handle";
  } else if (domain) {
    subject = domain;
    kind = "domain";
  } else if (quoted && isQuotedIntelAnchor(quoted) && !isJunkSubject(quoted)) {
    subject = quoted;
    kind = "topic";
  } else {
    // Strip the instruction scaffolding before falling back to names/topics.
    const stripped = text
      .replace(INSTRUCTION_STRIP, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const propName = looksLikeProperName(stripped) || looksLikeProperName(text);
    if (propName && !isJunkSubject(propName)) {
      subject = propName;
      kind = /\b(corp|inc|llc|ltd|labs|company|agency|firm|foundation|trust|ngo)\b/i.test(text)
        ? "organization"
        : "person";
    } else if (!isJunkSubject(stripped)) {
      subject = stripped.slice(0, 120);
      kind = "topic";
    } else if (selfTarget) {
      // "dork for my information please." — no literal subject, but the target
      // is unambiguous: the operator. The caller binds their own identifiers.
      return {
        fire: true,
        subject: "",
        kind: "person",
        selfTarget: true,
        hints: {},
        reason: "self_target_needs_binding",
      };
    } else {
      return none("no_subject");
    }
  }

  const hints: DorkTrigger["hints"] = {};
  if (domain) hints.domain = domain;
  for (const [tld, cc] of Object.entries(TLD_MAP)) {
    if (subject.toLowerCase().endsWith(tld)) {
      hints.country_tld = cc;
      break;
    }
  }
  const loc = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  if (loc) hints.location = loc[1];

  const reason = hard ? "hard_trigger" : "dork_operator";
  return { fire: true, subject, kind, selfTarget, hints, reason };
}
