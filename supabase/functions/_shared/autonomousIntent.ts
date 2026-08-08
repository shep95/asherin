// autonomousIntent.ts — detects when Aureon should fire the full autonomous
// intelligence loop (dork + ghost + zophiel + consensus + memory).
//
// NARRATIVE
// ---------
// The dork trigger fires on "audit / expose" language. The autonomous loop
// is broader: any concrete SUBJECT the user asks Aureon to understand,
// research, profile, background-check, or investigate. We conservatively
// require a subject + a research verb; free-form chit-chat never fires.

export type AutoKind = "person" | "domain" | "organization" | "topic";

export interface AutoTrigger {
  fire: boolean;
  subject: string;
  kind: AutoKind;
  hints: { domain?: string; location?: string };
  reason: string;
}

const RESEARCH_VERBS = /\b(who\s+is|what\s+is|research|investigate|background|profile|dossier|look\s*up|lookup|find\s+(out\s+)?about|tell\s+me\s+about|dig\s+into|check\s+out|scan|sweep|map|track|trace|intel\s+on|report\s+on)\b/i;
const HARD_TRIGGERS = /\b(auto(nomous)?\s+(loop|research|intel)|full\s+(loop|report|dossier)|deep\s*(dive|research|scan)|run\s+(the\s+)?loop)\b/i;

const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{0,63}\.)+[a-z]{2,24}\b/i;

function extractDomain(t: string): string | null {
  const m = t.match(DOMAIN_RE);
  if (!m) return null;
  const d = m[0].toLowerCase();
  if (/^(e\.g|i\.e|vs|etc|inc|co)\./i.test(d)) return null;
  return d;
}
function properName(t: string): string | null {
  const m = t.match(/\b([A-Z][a-z]{1,15})(?:\s+([A-Z][a-z]{1,15})){1,3}\b/);
  return m ? m[0] : null;
}

export function detectAutonomousIntent(userText: string): AutoTrigger {
  const text = String(userText || "").trim();
  if (text.length < 6) return { fire: false, subject: "", kind: "topic", hints: {}, reason: "too_short" };

  const hard = HARD_TRIGGERS.test(text);
  const research = RESEARCH_VERBS.test(text);
  if (!hard && !research) return { fire: false, subject: "", kind: "topic", hints: {}, reason: "no_research_verb" };

  const domain = extractDomain(text);
  const name = properName(text);

  let subject = ""; let kind: AutoKind = "topic";
  if (domain) { subject = domain; kind = "domain"; }
  else if (name) { subject = name; kind = /\b(corp|inc|llc|ltd|labs|company|agency|firm|org)\b/i.test(text) ? "organization" : "person"; }
  else return { fire: false, subject: "", kind: "topic", hints: {}, reason: "no_subject" };

  const hints: AutoTrigger["hints"] = {};
  if (domain) hints.domain = domain;
  const loc = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  if (loc) hints.location = loc[1];

  return { fire: true, subject, kind, hints, reason: hard ? "hard_trigger" : "research_verb+subject" };
}
