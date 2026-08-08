// dorkIntent.ts — Deno mirror of src/lib/dorkIntent.ts, used inside the
// chat edge function so triggering stays in perfect lockstep with the
// client-side detector.

export type DorkKind = "person" | "domain" | "organization" | "topic";

export interface DorkTrigger {
  fire: boolean;
  subject: string;
  kind: DorkKind;
  hints: { domain?: string; location?: string; country_tld?: string };
  reason: string;
}

const HARD_TRIGGERS = [
  /\bdork(ing)?\b/i,
  /\bgoogle\s*dork/i,
  /\baudit\s+(my\s+)?exposure\b/i,
  /\bself[-\s]?audit\b/i,
  /\bwhat.{0,10}(publicly?|leaked?|exposed?)\s+(is|about)\b/i,
  /\bexpose(d)?\s+(files|docs|credentials|env|api\s*keys)\b/i,
  /\b(find|surface)\s+(exposed|leaked|indexed|public)\b/i,
];
const SOFT_VERBS = /\b(find|surface|expose|reveal|dig up|hunt|scan|sweep|map|profile|deep\s*search)\b/i;
const SOFT_OBJECTS = /\b(everything|footprint|dossier|exposure|public\s+data|open\s+web|attack\s+surface|leaks|indexed)\b/i;

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

export function detectDorkIntent(userText: string): DorkTrigger {
  const text = String(userText || "").trim();
  if (!text || text.length < 4) return { fire: false, subject: "", kind: "topic", hints: {}, reason: "empty" };
  const hard = HARD_TRIGGERS.some((r) => r.test(text));
  const softFire = SOFT_VERBS.test(text) && SOFT_OBJECTS.test(text);
  if (!hard && !softFire) return { fire: false, subject: "", kind: "topic", hints: {}, reason: "no_trigger" };
  const domain = extractDomain(text);
  const propName = looksLikeProperName(text);
  let subject = ""; let kind: DorkKind = "topic";
  if (domain) { subject = domain; kind = "domain"; }
  else if (propName) { subject = propName; kind = /\b(corp|inc|llc|ltd|labs|company|agency|firm)\b/i.test(text) ? "organization" : "person"; }
  else {
    const cleaned = text.replace(/\b(please|can you|could you|hey aureon|aureon)\b/gi, "").trim();
    if (cleaned.length < 4) return { fire: false, subject: "", kind: "topic", hints: {}, reason: "no_subject" };
    subject = cleaned.slice(0, 120); kind = "topic";
  }
  const hints: DorkTrigger["hints"] = {};
  if (domain) hints.domain = domain;
  for (const [tld, cc] of Object.entries(TLD_MAP)) {
    if (subject.toLowerCase().endsWith(tld)) { hints.country_tld = cc; break; }
  }
  const loc = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  if (loc) hints.location = loc[1];
  return { fire: true, subject, kind, hints, reason: hard ? "hard_trigger" : "soft_verb+object" };
}
