// candidateResolve.ts — CANDIDATE IDENTITY RESOLUTION (Act 1 of the two-act sweep)
//
// NARRATIVE
// ---------
// The prior engine assumed one name = one human. Every document that passed the
// identity threshold was poured into a single FieldLedger, so three different
// "Rebecca Newton" records fused into one dossier: her real county welded to a
// stranger's employer. The merge was invisible — the operator saw one confident
// answer and no hint that a choice had been made on their behalf.
//
// This module refuses to merge on name. It clusters the surviving documents
// into DISTINCT candidate identities and hands the choice back to the operator
// as a numbered rack. Enrichment (ring-1/2/3 graph expansion) only runs after
// an identity is confirmed, so expensive hops are never spent on a namesake.
//
// MERGE RULE (the whole bug fix in one line):
//   Two documents join the same cluster only when they agree on a DISCRIMINATOR
//   — a shared canonical address, phone, relative, employer, entity, handle, or
//   a birth-year band plus a shared city. A matching name is NEVER sufficient.
//
// Flaw taxonomy applied:
//  - data honesty: an empty slot renders "absent" (queried, not recorded) vs
//    "unsearched" (out of budget) — the two are never conflated. Nothing here
//    is authored by a model; every slot value traces to a ResolvedField.
//  - logic: union-find with path compression makes clustering order-independent,
//    so document arrival order cannot change the partition.
//  - performance: O(d · f) discriminator indexing + near-linear union-find over
//    a document set already capped upstream (<= ~60 docs). No nested doc scan.
//  - regex/parsing: every /g regex is constructed fresh per call (no shared
//    lastIndex), all quantifiers bounded — no catastrophic backtracking.
//  - security: pure and synchronous. No I/O, no eval. Avatar URLs are only
//    RECORDED here; they are fetched later behind the SSRF-guarded proxy.

import {
  buildFieldLedger, canonicalizeName,
  type Confidence, type ExtractInput, type FieldLedger, type ResolvedField,
} from "./intelExtract.ts";

/** A slot is either filled, known-absent, or never searched — never ambiguous. */
export type SlotState = "value" | "absent" | "unsearched";

export interface CandidateSlot {
  label: string;
  value: string;
  state: SlotState;
  confidence?: Confidence;
  /** how many independent domains asserted this value */
  domains?: number;
}

export interface Candidate {
  id: string;
  /** 1-based option number shown to the operator */
  option: number;
  name: string;
  /** 0..1 — evidence weight, not a probability of being "the" subject */
  score: number;
  documents: number;
  independentDomains: number;
  /** proxy-safe origin image URL (never fetched client-side directly) */
  avatarUrl?: string;
  initials: string;
  slots: CandidateSlot[];
  family: string[];
  /** what actually held this cluster together — shown so the merge is auditable */
  discriminators: string[];
  sources: Array<{ domain: string; url: string }>;
  /** natural-language confirmation the card sends back on selection */
  confirmPrompt: string;
}

export interface CandidateSet {
  candidates: Candidate[];
  /** documents that matched the name but carried no discriminator to place them */
  unattributed: number;
  /** true when the operator must choose before enrichment is worth running */
  ambiguous: boolean;
  /** margin between the top two clusters, 0..1 */
  margin: number;
}

// Slot kinds we can actually query for. Anything outside this list is reported
// as "unsearched" rather than silently blank.
const SEARCHED_SLOTS = new Set(["Name", "Age", "Job", "Spouse", "Location", "County", "State", "Country"]);

const SOCIAL_IMAGE_DOMAINS = /(facebook|fbcdn|linkedin|licdn|instagram|cdninstagram|twimg|twitter|x\.com|gravatar|githubusercontent|ytimg|tiktokcdn|muscache)/i;

// ── Union-Find ─────────────────────────────────────────────────────────────

class DisjointSet {
  private parent: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); }
  find(i: number): number {
    while (this.parent[i] !== i) { this.parent[i] = this.parent[this.parent[i]]; i = this.parent[i]; }
    return i;
  }
  union(a: number, b: number): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const strip = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

/** Birth-year band from an age or DOB assertion. Ages drift by a year, so bucket. */
function birthYear(ledger: FieldLedger): number | null {
  const dob = ledger.confirmed.dob[0] || ledger.candidate.dob[0];
  if (dob) {
    const m = /\b(18|19|20)\d{2}\b/.exec(dob.display);
    if (m) return parseInt(m[0], 10);
  }
  const age = ledger.confirmed.age[0] || ledger.candidate.age[0];
  if (age) {
    const n = parseInt(age.display.replace(/\D+/g, ""), 10);
    if (Number.isFinite(n) && n > 0 && n < 120) return new Date().getUTCFullYear() - n;
  }
  return null;
}

/** City token pulled from an address or a "City, ST" run in the text. */
function cityOf(text: string, ledger: FieldLedger): string {
  const addr = ledger.confirmed.address[0] || ledger.candidate.address[0];
  if (addr) {
    const m = /,\s*([A-Za-z][A-Za-z .'-]{2,28}),\s*[A-Z]{2}\b/.exec(addr.display);
    if (m) return strip(m[1].trim());
  }
  const m2 = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}),\s*([A-Z]{2})\b/.exec(text.slice(0, 4000));
  return m2 ? strip(m2[1]) : "";
}

/** County, when the document names one. */
function countyOf(text: string): string {
  const m = /\b([A-Z][a-zA-Z]{2,20}(?:\s[A-Z][a-zA-Z]{2,20})?)\s+County\b/.exec(text.slice(0, 6000));
  return m ? `${m[1]} County` : "";
}

/** Spouse detection — a marriage verb immediately adjacent to a capitalised name. */
function spouseOf(text: string): string {
  const window = text.slice(0, 8000);
  const patterns = [
    /\b(?:[Ss]pouse|[Ww]ife|[Hh]usband)\s*[:\-—]\s*([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’.-]+){1,2})/,
    /\b[Mm]arried\s+to\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’.-]+){1,2})/,
    /\b([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’.-]+){1,2}),?\s+(?:his|her)\s+(?:wife|husband|spouse)\b/,
  ];
  for (const re of patterns) {
    const m = re.exec(window);
    // Trim any trailing sentence bleed ("Michael Newton. Works at ...").
    if (m) return m[1].split(/\.\s+/)[0].replace(/[.,;:]+$/, "").trim();
  }
  return "";
}

function topField(list: ResolvedField[]): ResolvedField | undefined {
  const rank: Record<Confidence, number> = { VERIFIED: 3, CORROBORATED: 2, REPORTED: 1 };
  return [...list].sort((a, b) =>
    (rank[b.confidence] - rank[a.confidence]) || (b.independentDomains - a.independentDomains))[0];
}

const slot = (label: string, f?: ResolvedField, fallback = ""): CandidateSlot => {
  if (f) return { label, value: f.display, state: "value", confidence: f.confidence, domains: f.independentDomains };
  if (fallback) return { label, value: fallback, state: "value" };
  return {
    label,
    value: SEARCHED_SLOTS.has(label) ? "not recorded in searched registries" : "not yet searched",
    state: SEARCHED_SLOTS.has(label) ? "absent" : "unsearched",
  };
};

// ── Discriminator extraction ───────────────────────────────────────────────

interface DocFacts {
  doc: ExtractInput;
  ledger: FieldLedger;
  keys: Set<string>;
  city: string;
  year: number | null;
  weight: number;
}

const KEY_KINDS = ["address", "phone", "email", "relative", "employer", "entity", "handle", "parcel", "case"] as const;

function factsOf(doc: ExtractInput, subject: string): DocFacts {
  const ledger = buildFieldLedger([doc], subject);
  const keys = new Set<string>();
  for (const kind of KEY_KINDS) {
    for (const f of [...ledger.confirmed[kind], ...ledger.candidate[kind]]) {
      // A relative key is canonicalised through the name normaliser so
      // "ROBERT NEWTON" and "Robert Newton" cannot split one human in two.
      const key = kind === "relative" || kind === "employer" || kind === "entity"
        ? canonicalizeName(f.display)
        : f.canonical;
      if (key && key.length > 3) keys.add(`${kind}:${key}`);
    }
  }
  const city = cityOf(doc.text, ledger);
  const year = birthYear(ledger);
  // A .gov/registry document outweighs an aggregator; a body outweighs a snippet.
  const weight = (doc.authoritative ? 3 : 1) * (doc.text.length > 900 ? 2 : 1) * (doc.band === "strong" ? 2 : 1);
  return { doc, ledger, keys, city, year, weight };
}

// ── Main entry ─────────────────────────────────────────────────────────────

export function resolveCandidates(
  docs: ExtractInput[],
  intent: { subject: string; city?: string; state?: string; county?: string; country?: string },
  imageOf?: (url: string) => string | undefined,
): CandidateSet {
  const usable = docs.filter((d) => d.band !== "rejected" && d.text && d.text.length > 40);
  if (!usable.length) return { candidates: [], unattributed: 0, ambiguous: false, margin: 1 };

  const facts = usable.map((d) => factsOf(d, intent.subject));

  // Index discriminator -> document indices. Two docs sharing any index bucket
  // are the same human; this is O(total facts), never O(docs^2).
  const index = new Map<string, number[]>();
  facts.forEach((f, i) => {
    for (const k of f.keys) {
      const arr = index.get(k);
      if (arr) arr.push(i); else index.set(k, [i]);
    }
    // Birth-year band + city is a discriminator pair; neither alone is enough.
    if (f.year && f.city) {
      for (const y of [f.year - 1, f.year, f.year + 1]) index.set(`by:${y}:${f.city}`, [...(index.get(`by:${y}:${f.city}`) || []), i]);
    }
  });

  const ds = new DisjointSet(facts.length);
  for (const members of index.values()) {
    for (let i = 1; i < members.length; i++) ds.union(members[0], members[i]);
  }

  // A document carrying no discriminator cannot be attributed. It is admitted
  // only when exactly one cluster claims its city; otherwise it stays out of
  // every dossier and is reported as unattributed.
  const clusters = new Map<number, number[]>();
  const orphans: number[] = [];
  facts.forEach((f, i) => {
    if (!f.keys.size && !(f.year && f.city)) { orphans.push(i); return; }
    const root = ds.find(i);
    const arr = clusters.get(root);
    if (arr) arr.push(i); else clusters.set(root, [i]);
  });

  let unattributed = 0;
  for (const o of orphans) {
    const city = facts[o].city;
    const owners = city
      ? [...clusters.entries()].filter(([, m]) => m.some((i) => facts[i].city === city))
      : [];
    if (owners.length === 1) owners[0][1].push(o);
    else unattributed++;
  }

  // ── Project each cluster into fixed slots ───────────────────────────────
  const built = [...clusters.values()].map((members) => {
    const clusterDocs = members.map((i) => facts[i].doc);
    const ledger = buildFieldLedger(clusterDocs, intent.subject);
    const text = clusterDocs.map((d) => d.text).join("\n").slice(0, 24000);
    const domains = new Set(clusterDocs.map((d) => d.domain));
    const weight = members.reduce((a, i) => a + facts[i].weight, 0);

    const ageF = topField(ledger.confirmed.age) || topField(ledger.candidate.age);
    const jobF = topField(ledger.confirmed.employer) || topField(ledger.candidate.employer);
    const addrF = topField(ledger.confirmed.address) || topField(ledger.candidate.address);
    const relatives = [...ledger.confirmed.relative, ...ledger.candidate.relative];

    const aliasF = topField(ledger.confirmed.alias);
    const name = aliasF?.display || intent.subject;
    const city = members.map((i) => facts[i].city).find(Boolean) || strip(intent.city || "");
    // Title-case the intent county so a ledger value ("LEE") never renders as
    // the shouted "LEE County" beside a document-sourced "Lee County".
    const titleCounty = intent.county
      ? intent.county.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
      : "";
    const county = countyOf(text) || (titleCounty ? `${titleCounty} County` : "");
    const spouse = spouseOf(text);

    const locationDisplay = addrF?.display
      || [city ? city.replace(/\b\w/g, (c) => c.toUpperCase()) : "", intent.state].filter(Boolean).join(", ");

    const avatar = clusterDocs
      .map((d) => imageOf?.(d.url))
      .find((u): u is string => !!u && /^https:\/\//i.test(u))
      || clusterDocs
        .filter((d) => SOCIAL_IMAGE_DOMAINS.test(d.domain))
        .map((d) => imageOf?.(d.url))
        .find((u): u is string => !!u && /^https:\/\//i.test(u));

    const family = relatives.slice(0, 6).map((r) => r.display);

    const discriminators = [...new Set(members.flatMap((i) => [...facts[i].keys]))]
      .slice(0, 4)
      .map((k) => k.replace(/^([a-z]+):/, (_m, g) => `${g} `));

    const slots: CandidateSlot[] = [
      slot("Name", undefined, name),
      slot("Age", ageF),
      slot("Job", jobF),
      slot("Spouse", undefined, spouse),
      slot("Location", undefined, locationDisplay),
      slot("County", undefined, county),
      slot("State", undefined, intent.state || ""),
      slot("Country", undefined, intent.country || ""),
    ];
    if (!spouse) slots[3] = slot("Spouse");
    if (!locationDisplay) slots[4] = slot("Location");
    if (!county) slots[5] = slot("County");
    if (!intent.state) slots[6] = slot("State");
    if (!intent.country) slots[7] = slot("Country");

    const descriptor = [
      ageF ? `age ${ageF.display}` : "",
      jobF ? jobF.display : "",
      locationDisplay,
    ].filter(Boolean).join(", ");

    return {
      id: "",
      option: 0,
      name,
      score: weight,
      documents: clusterDocs.length,
      independentDomains: domains.size,
      avatarUrl: avatar,
      initials: initialsOf(name),
      slots,
      family,
      discriminators,
      sources: clusterDocs.slice(0, 8).map((d) => ({ domain: d.domain, url: d.url })),
      confirmPrompt: `Confirmed identity: ${name}${descriptor ? ` — ${descriptor}` : ""}. Run the full dossier on this person only: relatives, addresses, employment, corporate officerships, court and property records, and the relationship graph. Ignore any same-name individual who does not match these details.`,
    } as Candidate;
  });

  // Normalise scores against the strongest cluster so the card shows relative
  // evidence weight, never a fabricated probability.
  const maxWeight = Math.max(1, ...built.map((c) => c.score));
  built.sort((a, b) => b.score - a.score || b.independentDomains - a.independentDomains);
  built.forEach((c, i) => {
    c.option = i + 1;
    c.id = `cand-${i + 1}`;
    c.score = Math.round((c.score / maxWeight) * 100) / 100;
  });

  const candidates = built.slice(0, 6);
  const margin = candidates.length < 2 ? 1 : candidates[0].score - candidates[1].score;
  // One cluster, or a decisive leader, means no chooser: don't add friction to
  // an unambiguous subject.
  const ambiguous = candidates.length >= 2 && margin < 0.45;

  return { candidates, unattributed, ambiguous, margin: Math.round(margin * 100) / 100 };
}

// ── Model context ──────────────────────────────────────────────────────────

/**
 * Renders the chooser context. The card JSON is precomputed here from the
 * ledger and must be emitted VERBATIM — the model is never allowed to author a
 * slot value, which closes the hallucinated-spouse path entirely.
 */
export function formatCandidateContext(set: CandidateSet, subjectLabel: string): string {
  const payload = {
    title: `Multiple identities match "${subjectLabel}"`,
    note: "Select one to run the full dossier. Nothing below is merged across candidates.",
    unattributed: set.unattributed,
    candidates: set.candidates.map((c) => ({
      id: c.id, option: c.option, name: c.name, score: c.score,
      documents: c.documents, domains: c.independentDomains,
      avatar: c.avatarUrl || "", initials: c.initials,
      slots: c.slots.map((s) => ({ label: s.label, value: s.value, state: s.state, confidence: s.confidence || "", domains: s.domains || 0 })),
      family: c.family,
      matchedOn: c.discriminators,
      sources: c.sources,
      confirm: c.confirmPrompt,
    })),
  };

  return [
    `## IDENTITY RESOLUTION — ${set.candidates.length} DISTINCT CANDIDATES`,
    ``,
    `The sweep found ${set.candidates.length} people who share this name and could not be merged:`,
    `no shared address, phone, relative, employer or birth-year band links them.`,
    set.unattributed ? `${set.unattributed} document(s) matched the name but carried no discriminator and were attributed to NO candidate.` : ``,
    ``,
    `MANDATORY OUTPUT CONTRACT`,
    `1. Write ONE short line: the name is ambiguous and the operator must confirm which person.`,
    `2. Then emit the following block EXACTLY as given — do not edit, reorder, summarise or re-key it:`,
    ``,
    "```card:candidates",
    JSON.stringify(payload),
    "```",
    ``,
    `3. Write NOTHING after the block except one sentence telling the operator to pick an option.`,
    `4. Do NOT merge details across candidates. Do NOT assert any field not present above.`,
    `5. Do NOT produce a dossier, summary table, or relationship tree in this turn.`,
  ].filter(Boolean).join("\n");
}
