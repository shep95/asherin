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

export type DorkKind = "person" | "domain" | "organization" | "topic" | "email" | "phone" | "handle";

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
const SOFT_OBJECTS = /\b(everything|footprint|dossier|exposure|public\s+data|open\s+web|attack\s+surface|leaks|indexed)\b/i;

// NATURAL intelligence verbs — when paired with a hard identifier (email,
// phone, domain, handle) in the same turn, they imply a dork sweep even
// without the literal word "dork". Prevents the common failure where the
// operator says "look up this email" and the trigger never fires.
const INTEL_VERBS = /\b(look\s*(up|into)|lookup|background\s*check|background\s*on|who\s+is|whois|tell\s+me\s+about|info\s+on|information\s+on|dig\s+(up|into)|investigate|profile|check\s+out|research|deep\s*dive|run\s+(a|the)?\s*(check|report|sweep|scan)\s+on|get\s+(me\s+)?(everything|info|intel|dirt)\s+on|pull\s+(a\s+)?(report|record)\s+on|osint\s+(on|this)|recon\s+on)\b/i;

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
  ".gov": "us", ".mil": "us", ".gov.uk": "uk", ".ac.uk": "uk",
  ".gov.au": "au", ".edu.au": "au", ".gov.in": "in", ".gov.br": "br",
};

function extractDomain(text: string): string | null {
  const m = text.match(DOMAIN_RE);
  if (!m) return null;
  const d = m[0].toLowerCase();
  if (/^(e\.g|i\.e|vs|etc|inc|co)\./i.test(d)) return null;
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
  const filler = /^(dork|dorks|dorking|for|on|about|my|me|myself|mine|please|pls|info|infomation|information|data|details|report|dossier|exposure|footprint|the|a|an|and|do|run|give|get|pull|now|bro|man|hey|ok|okay|search|lookup|look|up)$/i;
  return words.every((w) => filler.test(w));
}

export function detectDorkIntent(userText: string): DorkTrigger {
  const text = String(userText || "").trim();
  const none = (reason: string): DorkTrigger => ({ fire: false, subject: "", kind: "topic", selfTarget: false, hints: {}, reason });
  if (!text || text.length < 4) return none("empty");

  const hard = HARD_TRIGGERS.some((r) => r.test(text));
  const softFire = SOFT_VERBS.test(text) && SOFT_OBJECTS.test(text);

  // Pre-scan for a strong identifier — if one exists, natural intel verbs
  // ("look up", "background check", "who is", "info on") are enough to fire.
  const hasStrongId = EMAIL_RE.test(text) || PHONE_RE.test(text) || HANDLE_RE.test(text) || !!extractDomain(text);
  const naturalFire = hasStrongId && INTEL_VERBS.test(text);

  if (!hard && !softFire && !naturalFire) return none("no_trigger");

  const selfTarget = SELF_RE.test(text) && !THIRD_PARTY_RE.test(text);

  // Identifier precedence — strongest anchor wins, scanned across the whole
  // turn so pasted attachments contribute the subject, not the command line.
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const handle = text.match(HANDLE_RE)?.[1] ?? null;
  const domain = extractDomain(text);
  const quoted = text.match(QUOTED_RE)?.[1]?.trim() ?? null;

  let subject = "";
  let kind: DorkKind = "topic";
  if (email) { subject = email.toLowerCase(); kind = "email"; }
  else if (phone) { subject = phone.replace(/[^\d+]/g, ""); kind = "phone"; }
  else if (handle) { subject = `@${handle}`; kind = "handle"; }
  else if (domain) { subject = domain; kind = "domain"; }
  else if (quoted && !isJunkSubject(quoted)) { subject = quoted; kind = "topic"; }
  else {
    // Strip the instruction scaffolding before falling back to names/topics.
    const stripped = text.replace(INSTRUCTION_STRIP, " ").replace(/\s{2,}/g, " ").trim();
    const propName = looksLikeProperName(stripped) || looksLikeProperName(text);
    if (propName && !isJunkSubject(propName)) {
      subject = propName;
      kind = /\b(corp|inc|llc|ltd|labs|company|agency|firm|foundation|trust|ngo)\b/i.test(text) ? "organization" : "person";
    } else if (!isJunkSubject(stripped)) {
      subject = stripped.slice(0, 120);
      kind = "topic";
    } else if (selfTarget) {
      // "dork for my information please." — no literal subject, but the target
      // is unambiguous: the operator. The caller binds their own identifiers.
      return { fire: true, subject: "", kind: "person", selfTarget: true, hints: {}, reason: "self_target_needs_binding" };
    } else {
      return none("no_subject");
    }
  }

  const hints: DorkTrigger["hints"] = {};
  if (domain) hints.domain = domain;
  for (const [tld, cc] of Object.entries(TLD_MAP)) {
    if (subject.toLowerCase().endsWith(tld)) { hints.country_tld = cc; break; }
  }
  const loc = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  if (loc) hints.location = loc[1];

  return { fire: true, subject, kind, selfTarget, hints, reason: hard ? "hard_trigger" : "soft_verb+object" };
}
