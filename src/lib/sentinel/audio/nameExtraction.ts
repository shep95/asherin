// asherin.sentinel — layer 2 step 3, passive self-identification.
//
// The narrative wants a name lifted out of a person's own words and bound to
// their voiceprint. The failure mode is obvious once written down: "hey, get
// the door" would bind the speaker's identity to "Get", and once a wrong name
// is bound to a stored print every future line is mislabelled. So this layer is
// built to REFUSE far more often than it fires.
//
// Rules:
//   • a first-person claim ("my name is james", "i'm sarah", "call me sarah")
//     names the CURRENT speaker.
//   • a vocative ("hey marcus", "marcus, come here") names SOMEONE ELSE, so it
//     is recorded as an addressed name — a candidate for the NEXT distinct voice
//     to reply, never applied to the current one.
//   • a candidate must be a plausible given name: capitalised or single-token,
//     not in the stop list, 2-20 letters, no digits.
//   • a self-claim binds only once the same name arrives with enough weight;
//     the caller applies `bindable` and can require a second sighting.

const STOP = new Set([
  "a","about","after","again","all","and","any","are","back","be","because","been","before","being","but","by","call",
  "can","come","could","did","do","does","doing","done","down","for","from","get","give","go","going","gonna","good",
  "got","have","he","hell","hello","help","her","here","hey","him","his","hold","how","i","if","in","is","it","just",
  "know","let","like","listen","look","man","me","mine","more","my","name","need","no","not","now","of","off","ok",
  "okay","on","one","or","out","over","please","really","right","said","say","see","she","should","sir","so","some",
  "sorry","stop","sure","take","tell","thanks","that","the","them","then","there","they","think","this","to","up",
  "wait","want","was","watch","we","well","what","when","where","who","why","will","with","yeah","yes","you","your",
  "buddy","dude","mate","bro","guys","everyone","somebody","anyone","mom","dad","baby","honey",
]);

export interface NameFinding {
  name: string;
  /** who the name belongs to */
  scope: "self" | "addressed";
  /** the clause the name was taken from — provenance, shown in the UI */
  quote: string;
  confidence: number;
}

const clean = (raw: string): string | null => {
  const t = raw.trim().replace(/[^A-Za-z'-]/g, "");
  if (t.length < 2 || t.length > 20) return null;
  if (STOP.has(t.toLowerCase())) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const SELF_PATTERNS: Array<{ re: RegExp; confidence: number }> = [
  { re: /\bmy name(?:'s| is)\s+([A-Za-z'-]{2,20})/i, confidence: 0.92 },
  { re: /\bthey call me\s+([A-Za-z'-]{2,20})/i, confidence: 0.85 },
  { re: /\byou can call me\s+([A-Za-z'-]{2,20})/i, confidence: 0.85 },
  { re: /\bi(?:'m| am)\s+([A-Z][a-z'-]{1,19})\b/, confidence: 0.7 },
  { re: /\bthis is\s+([A-Z][a-z'-]{1,19})\b(?!\s+(?:the|a|an|my|your))/, confidence: 0.6 },
  { re: /\bi go by\s+([A-Za-z'-]{2,20})/i, confidence: 0.8 },
];

const ADDRESSED_PATTERNS: Array<{ re: RegExp; confidence: number }> = [
  { re: /\b(?:hey|hi|hello|yo|listen|look)[,]?\s+([A-Z][a-z'-]{1,19})\b/, confidence: 0.7 },
  { re: /^([A-Z][a-z'-]{1,19}),\s/, confidence: 0.6 },
  { re: /\bthanks[,]?\s+([A-Z][a-z'-]{1,19})\b/, confidence: 0.6 },
  { re: /\b(?:tell|ask)\s+([A-Z][a-z'-]{1,19})\s+(?:to|that|about)\b/, confidence: 0.55 },
];

/** Every name claim in one transcript line, self-claims first. */
export function extractNames(text: string): NameFinding[] {
  if (!text || text.length > 4000) return [];
  const out: NameFinding[] = [];
  const seen = new Set<string>();

  const run = (patterns: typeof SELF_PATTERNS, scope: NameFinding["scope"]) => {
    for (const { re, confidence } of patterns) {
      const m = re.exec(text);
      if (!m) continue;
      const name = clean(m[1]);
      if (!name) continue;
      const key = `${scope}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, scope, quote: m[0].trim(), confidence });
    }
  };

  run(SELF_PATTERNS, "self");
  run(ADDRESSED_PATTERNS, "addressed");
  return out;
}

/** The single best self-claim, or null. A binding decision, so it is strict. */
export function selfClaim(text: string): NameFinding | null {
  const self = extractNames(text).filter((f) => f.scope === "self");
  if (!self.length) return null;
  return self.sort((a, b) => b.confidence - a.confidence)[0];
}

/** Only a strong self-claim may overwrite an auto label without a human. */
export function bindable(finding: NameFinding | null): boolean {
  return !!finding && finding.scope === "self" && finding.confidence >= 0.7;
}
