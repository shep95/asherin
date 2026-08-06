// intelExtract.ts — DETERMINISTIC EXTRACTION + ENTITY RESOLUTION LAYER
//
// NARRATIVE
// ---------
// Before this module existed, a person dossier was written by a language model
// reading 160-character SERP snippets. Snippets carry a name, a city and an
// age; they do not carry prior addresses, phone numbers, officer roles or case
// numbers. The model therefore had nothing to be exhaustive about, and every
// "verified" label was prose it chose to emit rather than arithmetic anyone
// computed.
//
// This layer sits BETWEEN retrieval and the model. It is pure, synchronous,
// LLM-free and unit-testable. It does four things:
//
//   1. PARSE     — pull typed fields out of full page bodies (addresses,
//                  phones, emails, ages, DOBs, handles, employers, business
//                  entities, case/parcel/licence numbers, relatives).
//   2. NORMALIZE — canonicalize each value so "2004 SW 23rd Ct" and
//                  "2004 Southwest 23rd Court" collapse to ONE node, and
//                  "(239) 283-1824" and "239-283-1824" collapse to one phone.
//   3. RESOLVE   — cluster every assertion by canonical value, recording which
//                  independent DOMAINS asserted it and at which URLs.
//   4. SCORE     — confidence is COMPUTED, never chosen:
//                    VERIFIED     = asserted by an authoritative .gov/registry
//                                   source, or by >= 3 independent domains
//                    CORROBORATED = >= 2 independent domains
//                    REPORTED     = exactly 1 domain
//
// The model is then handed a ledger of resolved fields with source counts and
// told to RENDER the confidence value, not to decide it.
//
// Flaw taxonomy applied:
//  - regex/parsing: every /g regex is constructed fresh per call (no shared
//    lastIndex state); all quantifiers are bounded (no catastrophic backtracking).
//  - security: extraction is read-only over already-fetched text; nothing is
//    executed, evaluated or issued as a query without re-validation upstream.
//  - performance: single pass per field family per document, O(n) in text
//    length; per-document text is hard-capped by the caller.
//  - data honesty: values sourced only from POSSIBLE/STRONG identity hits;
//    weak-band assertions are ledgered separately and never promoted.

export type Confidence = "VERIFIED" | "CORROBORATED" | "REPORTED";

export type FieldKind =
  | "address"
  | "phone"
  | "email"
  | "age"
  | "dob"
  | "handle"
  | "employer"
  | "entity"
  | "case"
  | "parcel"
  | "license"
  | "relative"
  | "alias";

export interface SourceRef {
  domain: string;
  url: string;
  bucket?: string;
}

export interface ResolvedField {
  kind: FieldKind;
  /** canonical, deduped form used as the cluster key */
  canonical: string;
  /** the most human-readable surface form seen */
  display: string;
  sources: SourceRef[];
  /** count of DISTINCT domains asserting this value */
  independentDomains: number;
  authoritative: boolean;
  confidence: Confidence;
  /** short verbatim window around the match, for the model to quote */
  context?: string;
}

export interface FieldLedger {
  /** fields drawn from STRONG-band identity hits only */
  confirmed: Record<FieldKind, ResolvedField[]>;
  /** fields drawn from POSSIBLE-band hits — candidates, never promoted */
  candidate: Record<FieldKind, ResolvedField[]>;
  totalAssertions: number;
  documentsParsed: number;
}

export interface ExtractInput {
  domain: string;
  url: string;
  bucket?: string;
  text: string;
  authoritative?: boolean;
  /** "strong" routes to confirmed, anything else routes to candidate */
  band?: string;
}

const EMPTY = (): Record<FieldKind, ResolvedField[]> => ({
  address: [], phone: [], email: [], age: [], dob: [], handle: [],
  employer: [], entity: [], case: [], parcel: [], license: [],
  relative: [], alias: [],
});

// ── Normalizers ────────────────────────────────────────────────────────────

const STREET_SUFFIX: Record<string, string> = {
  st: "STREET", street: "STREET", ave: "AVENUE", av: "AVENUE", avenue: "AVENUE",
  blvd: "BOULEVARD", boulevard: "BOULEVARD", rd: "ROAD", road: "ROAD",
  dr: "DRIVE", drive: "DRIVE", ln: "LANE", lane: "LANE", way: "WAY",
  ct: "COURT", court: "COURT", pl: "PLACE", place: "PLACE",
  ter: "TERRACE", terr: "TERRACE", terrace: "TERRACE", cir: "CIRCLE", circle: "CIRCLE",
  hwy: "HIGHWAY", highway: "HIGHWAY", pkwy: "PARKWAY", parkway: "PARKWAY",
  trl: "TRAIL", trail: "TRAIL", loop: "LOOP", run: "RUN", pt: "POINT", point: "POINT",
  sq: "SQUARE", square: "SQUARE", xing: "CROSSING", crossing: "CROSSING",
};

const DIRECTIONAL: Record<string, string> = {
  n: "N", s: "S", e: "E", w: "W", ne: "NE", nw: "NW", se: "SE", sw: "SW",
  north: "N", south: "S", east: "E", west: "W",
  northeast: "NE", northwest: "NW", southeast: "SE", southwest: "SW",
};

const SUFFIX_ALT = Object.keys(STREET_SUFFIX).sort((a, b) => b.length - a.length).join("|");

/** USPS-ish canonical form: uppercase, directionals + suffixes expanded, punctuation dropped. */
export function canonicalizeAddress(raw: string): string {
  const tokens = raw
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const out: string[] = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (DIRECTIONAL[low]) out.push(DIRECTIONAL[low]);
    else if (STREET_SUFFIX[low]) out.push(STREET_SUFFIX[low]);
    else out.push(t.toUpperCase());
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/** North-American phones → E.164 where possible; otherwise digits-only. */
export function canonicalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function canonicalizeName(raw: string): string {
  return raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s'\-]/g, " ")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

// ── Field extractors ───────────────────────────────────────────────────────
// Each returns [surfaceForm, canonicalForm][]. Regexes are built fresh per call.

interface Hit { display: string; canonical: string; index: number }

function addressHits(text: string): Hit[] {
  const re = new RegExp(
    String.raw`\b\d{1,6}\s+` +
    String.raw`(?:(?:N|S|E|W|NE|NW|SE|SW|North|South|East|West|Northeast|Northwest|Southeast|Southwest)\.?\s+)?` +
    String.raw`(?:[A-Z0-9][A-Za-z0-9'\-\.]{0,18}\s+){1,4}` +
    String.raw`(?:${SUFFIX_ALT})\b\.?` +
    String.raw`(?:\s+(?:Apt|Apartment|Unit|Ste|Suite|#)\s*[A-Za-z0-9\-]{1,8})?`,
    "gi",
  );
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const display = m[0].replace(/\s+/g, " ").trim();
    // Reject obvious prose false-positives ("3 Ways to ...", "5 Point Plan")
    if (/^\d{1,6}\s+(?:ways?|steps?|things?|reasons?|tips?)\b/i.test(display)) continue;
    const canonical = canonicalizeAddress(display);
    if (canonical.length < 8) continue;
    out.push({ display, canonical, index: m.index });
  }
  return out;
}

function phoneHits(text: string): Hit[] {
  const re = /(?:\+?1[\s.\-]?)?\(?\b[2-9]\d{2}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g;
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const canonical = canonicalizePhone(m[0]);
    if (!canonical) continue;
    // Strip obvious sequence junk (5555555555, 1234567890)
    const d = canonical.replace(/\D/g, "").slice(-10);
    if (/^(\d)\1{9}$/.test(d) || d === "1234567890") continue;
    out.push({ display: m[0].trim(), canonical, index: m.index });
  }
  return out;
}

function emailHits(text: string): Hit[] {
  const re = /\b[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,190}\.[A-Za-z]{2,12}\b/g;
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[0].toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(v)) continue;
    if (/^(support|info|noreply|no-reply|contact|admin|help|privacy|legal|abuse|sales)@/.test(v)) continue;
    out.push({ display: m[0], canonical: v, index: m.index });
  }
  return out;
}

function ageHits(text: string): Hit[] {
  const out: Hit[] = [];
  const patterns = [
    /\bages?\s*:?\s*(\d{1,3})\b/gi,
    /\b(\d{1,3})\s*years?\s*old\b/gi,
    /\bage\s+(\d{1,3})\s*,/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n) || n < 1 || n > 115) continue;
      out.push({ display: String(n), canonical: String(n), index: m.index });
    }
  }
  return out;
}

function dobHits(text: string): Hit[] {
  const out: Hit[] = [];
  const re = /\b(?:born|d\.?o\.?b\.?|date of birth)\b\D{0,12}((?:0?[1-9]|1[0-2])[\/\-.](?:0?[1-9]|[12]\d|3[01])[\/\-.](?:19|20)\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}|(?:19|20)\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].trim();
    out.push({ display: v, canonical: v.replace(/[.\-]/g, "/").toUpperCase(), index: m.index });
  }
  return out;
}

/**
 * Social handle capture, SUBJECT-SCOPED.
 *
 * A people-aggregator page about a relative lists that relative's profiles too.
 * Attributing every handle on the page to the subject produced false profile
 * ownership (a relative's LinkedIn reported as the subject's). A handle is only
 * accepted when its slug carries a token of the SUBJECT's own name.
 */
function handleHits(text: string, subjectCanonical = ""): Hit[] {
  const out: Hit[] = [];
  const re = /\b(?:https?:\/\/)?(?:www\.)?(instagram|twitter|x|tiktok|facebook|linkedin|github|youtube|reddit)\.com\/(?:in\/|@|u\/|user\/|c\/)?([A-Za-z0-9_.\-]{2,40})\b/gi;
  let m: RegExpExecArray | null;
  const RESERVED = new Set(["share", "login", "signup", "home", "explore", "about", "privacy", "terms", "help", "search", "watch", "policies", "legal", "sharer", "intent", "hashtag", "p", "pages", "groups", "posts", "feed", "company", "jobs", "tv", "reel", "discover", "pub", "profile", "people", "photo", "video"]);
  const nameTokens = subjectCanonical.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  while ((m = re.exec(text)) !== null) {
    const platform = m[1].toLowerCase();
    const handle = m[2];
    const slug = handle.toLowerCase();
    if (RESERVED.has(slug)) continue;
    // Ownership guard: the slug must contain a subject name token.
    // Surname alone is NOT ownership — relatives share it ("regan-newton-perry"
    // was being reported as the subject's LinkedIn). Require the GIVEN name.
    if (nameTokens.length && !slug.includes(nameTokens[0])) continue;

    const canonical = `${platform === "x" ? "twitter" : platform}/${slug}`;
    out.push({ display: `${platform}.com/${handle}`, canonical, index: m.index });
  }
  return out;
}


function employerHits(text: string): Hit[] {
  const out: Hit[] = [];
  // Case-insensitive on the CUE ONLY — the captured employer must still open
  // with a capital, so an `i` flag on the whole pattern (which would admit
  // lowercase prose fragments) is deliberately avoided.
  const re = /\b(?:[Ww]orks?\s+(?:at|for)|[Ee]mployed\s+(?:at|by)|[Ee]mployer|[Oo]ccupation|[Jj]ob\s*title|[Pp]osition)\b\s*:?\s*([A-Z][A-Za-z0-9&'.,\- ]{2,48})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // A sentence boundary ends the employer: "Lee Health. Lee County" is one
    // employer plus unrelated prose, never a 20-character company name.
    const v = m[1]
      .split(/\s{2,}|[|·•]/)[0]
      .split(/\.\s+/)[0]
      .replace(/[,.;:]+$/, "")
      .trim();
    if (v.length < 3) continue;
    out.push({ display: v, canonical: v.toUpperCase(), index: m.index });
  }
  return out;
}

function entityHits(text: string): Hit[] {
  const out: Hit[] = [];
  const re = /\b((?:[A-Z][A-Za-z0-9&'\-]*\.?\s+){1,5}?)(LLC|L\.L\.C\.|INC|Inc\.?|CORP|Corp\.?|Corporation|Ltd\.?|LLP|PLLC|L\.P\.|LP|Trust|Foundation|Holdings)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = `${m[1].trim()} ${m[2].replace(/\.$/, "")}`.replace(/\s+/g, " ").trim();
    if (name.length < 6 || name.length > 80) continue;
    // Drop sentence-fragment captures ("The Company Inc" style noise words)
    if (/^(The|This|That|Our|Your|A|An|And|Of|For|With|From)\s/i.test(name) && name.split(" ").length <= 2) continue;
    // Drop registry TYPE descriptors, which are not entity names:
    // "Florida Profit Corporation", "Domestic Limited Liability Company".
    if (/\b(Profit|Nonprofit|Non-Profit|Domestic|Foreign|Limited\s+Liability|General|Professional)\b/i.test(name)) continue;
    if (/^(Registered|Principal|Mailing|Document|Filing|Agent|Officer|Status|Address)\b/i.test(name)) continue;
    out.push({ display: name, canonical: name.toUpperCase().replace(/[.,]/g, ""), index: m.index });

  }
  return out;
}

function caseHits(text: string): Hit[] {
  const out: Hit[] = [];
  const re = /\b(?:case|docket|cause|citation)\s*(?:no\.?|number|#)?\s*:?\s*([0-9A-Z][0-9A-Z\-\/]{5,26})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = m[1].toUpperCase();
    if (!/\d/.test(v)) continue;
    out.push({ display: v, canonical: v.replace(/[^0-9A-Z]/g, ""), index: m.index });
  }
  return out;
}

function parcelHits(text: string): Hit[] {
  const out: Hit[] = [];
  // Florida STRAPs embed letters ("30-44-23-C3-04066.0180"); a digits-only class
  // truncated the ID at the first letter and produced a useless "30-44-23-".
  const re = /\b(?:parcel|folio|strap|apn|tax\s*id)\s*(?:id|no\.?|number|#)?\s*:?\s*([0-9][0-9A-Za-z\-\.]{6,36}[0-9A-Za-z])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ display: m[1], canonical: m[1].toUpperCase().replace(/[^0-9A-Z]/g, ""), index: m.index });
  }

  return out;
}

function licenseHits(text: string): Hit[] {
  const out: Hit[] = [];
  const re = /\b(?:licen[sc]e|permit|registration)\s*(?:no\.?|number|#)\s*:?\s*([A-Z]{0,4}[0-9][A-Z0-9\-]{3,18})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ display: m[1].toUpperCase(), canonical: m[1].toUpperCase().replace(/[^A-Z0-9]/g, ""), index: m.index });
  }
  return out;
}

/**
 * People-directory pages list associates under a "Relatives" / "Associated
 * Persons" heading. Grab the heading, then harvest capitalized 2-3 token names
 * from the following window. Bounded window = no runaway scan.
 */
/**
 * Relative / associate capture.
 *
 * The window MUST terminate at the next section of the document. A flat 600-char
 * slice bled past the relatives list and swallowed the following lines, producing
 * phantom associates like "Asherin Technologies" (an employer) and "Lee County"
 * (a venue). We stop at the first section terminator and reject any candidate
 * whose tokens include a structural or geographic noise word.
 */
const REL_TERMINATOR = /\b(?:also\s+known\s+as|a\.?k\.?a\.?|works?\s+at|employer|employed|email|e-mail|phone|current\s+address|previous\s+address|address(?:es)?|case\s+no|docket|parcel|folio|view\s+full|background\s+report|sponsored|advertisement|copyright)\b/i;
const REL_NOISE = /\b(RELATIVES|RELATIVE|ASSOCIATED|ASSOCIATES|PERSONS|PEOPLE|SEARCH|RESULTS|BACKGROUND|CHECK|PHONE|ADDRESS|ADDRESSES|PUBLIC|RECORDS|RECORD|VIEW|FULL|REPORT|CURRENT|POSSIBLE|UNITED|STATES|ALSO|KNOWN|CASE|NO|DOCKET|PARCEL|FOLIO|COUNTY|CITY|STATE|STREET|COURT|DRIVE|AVENUE|LANE|TERRACE|APT|SUITE|WORKS|EMPLOYER|TECHNOLOGIES|INC|LLC|CORP|COMPANY|GROUP|SERVICES|EMAIL|NUMBER|NUMBERS|AGE|BORN|DIED|MORE|LESS|SEE|CLICK|FREE|PREMIUM|LOGIN|SIGN)\b/;

function relativeHits(text: string, subjectCanonical: string): Hit[] {
  const out: Hit[] = [];
  const headRe = /\b(?:relatives?|possible\s+relatives?|associated\s+(?:persons?|people)|known\s+associates?|family\s+members?|household\s+members?|also\s+known\s+residents?)\b/gi;
  const nameRe = /\b([A-Z][a-z'’\-]{1,15})(?:\s+([A-Z][a-z'’\-]{1,15}|[A-Z]\.))?\s+([A-Z][a-z'’\-]{1,20})\b/g;
  let h: RegExpExecArray | null;
  while ((h = headRe.exec(text)) !== null) {
    // Skip the heading itself, then clip at the first terminator inside the slice.
    const raw = text.slice(h.index + h[0].length, h.index + h[0].length + 420);
    const stop = raw.search(REL_TERMINATOR);
    const window = stop > 0 ? raw.slice(0, stop) : raw;
    nameRe.lastIndex = 0;
    let n: RegExpExecArray | null;
    while ((n = nameRe.exec(window)) !== null) {
      const display = n[0].replace(/\s+/g, " ").trim();
      const canonical = canonicalizeName(display);
      if (canonical === subjectCanonical) continue;
      if (canonical.split(" ").length < 2) continue;
      if (REL_NOISE.test(canonical)) continue;
      out.push({ display, canonical, index: h.index + n.index });
    }
  }
  return out;
}


/** Alias / AKA capture: "also known as", "aka", "goes by". */
function aliasHits(text: string, subjectCanonical: string): Hit[] {
  const out: Hit[] = [];
  const re = /\b(?:also\s+known\s+as|a\.?k\.?a\.?|goes\s+by|alias(?:es)?|formerly)\b\s*:?\s*([A-Z][A-Za-z'’\-]{1,20}(?:\s+[A-Z][A-Za-z'’\-.]{1,20}){1,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const display = m[1].replace(/\s+/g, " ").trim();
    const canonical = canonicalizeName(display);
    if (!canonical || canonical === subjectCanonical) continue;
    out.push({ display, canonical, index: m.index });
  }
  return out;
}

// ── Ledger assembly ────────────────────────────────────────────────────────

interface Cluster {
  kind: FieldKind;
  canonical: string;
  display: string;
  domains: Map<string, SourceRef>;
  authoritative: boolean;
  context?: string;
}

function contextWindow(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + len + 90);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function ingest(
  map: Map<string, Cluster>,
  kind: FieldKind,
  hits: Hit[],
  doc: ExtractInput,
  text: string,
) {
  for (const h of hits) {
    const key = `${kind}::${h.canonical}`;
    let c = map.get(key);
    if (!c) {
      c = {
        kind,
        canonical: h.canonical,
        display: h.display,
        domains: new Map(),
        authoritative: false,
        context: contextWindow(text, h.index, h.display.length),
      };
      map.set(key, c);
    }
    // Prefer the longest surface form as the display value.
    if (h.display.length > c.display.length) c.display = h.display;
    if (!c.domains.has(doc.domain)) {
      c.domains.set(doc.domain, { domain: doc.domain, url: doc.url, bucket: doc.bucket });
    }
    if (doc.authoritative) c.authoritative = true;
  }
}

function score(c: Cluster): ResolvedField {
  const independentDomains = c.domains.size;
  const confidence: Confidence =
    c.authoritative || independentDomains >= 3 ? "VERIFIED"
      : independentDomains >= 2 ? "CORROBORATED"
        : "REPORTED";
  return {
    kind: c.kind,
    canonical: c.canonical,
    display: c.display,
    sources: Array.from(c.domains.values()),
    independentDomains,
    authoritative: c.authoritative,
    confidence,
    context: c.context,
  };
}

const RANK: Record<Confidence, number> = { VERIFIED: 3, CORROBORATED: 2, REPORTED: 1 };

/**
 * Build the resolved field ledger from a set of documents.
 * `subject` is the subject's name, used to suppress self-references in
 * relative/alias extraction.
 */
export function buildFieldLedger(docs: ExtractInput[], subject: string): FieldLedger {
  const subjectCanonical = canonicalizeName(subject);
  const strong = new Map<string, Cluster>();
  const weak = new Map<string, Cluster>();
  let totalAssertions = 0;
  let documentsParsed = 0;

  for (const doc of docs) {
    const text = doc.text || "";
    if (text.length < 20) continue;
    documentsParsed += 1;
    const target = doc.band === "strong" ? strong : weak;

    const families: Array<[FieldKind, Hit[]]> = [
      ["address", addressHits(text)],
      ["phone", phoneHits(text)],
      ["email", emailHits(text)],
      ["age", ageHits(text)],
      ["dob", dobHits(text)],
      ["handle", handleHits(text, subjectCanonical)],
      ["employer", employerHits(text)],
      ["entity", entityHits(text)],
      ["case", caseHits(text)],
      ["parcel", parcelHits(text)],
      ["license", licenseHits(text)],
      ["relative", relativeHits(text, subjectCanonical)],
      ["alias", aliasHits(text, subjectCanonical)],
    ];

    for (const [kind, hits] of families) {
      // Cap per-family per-document to keep a spam page from flooding the ledger.
      const capped = hits.slice(0, 40);
      totalAssertions += capped.length;
      ingest(target, kind, capped, doc, text);
    }
  }

  const collect = (map: Map<string, Cluster>): Record<FieldKind, ResolvedField[]> => {
    const out = EMPTY();
    for (const c of map.values()) {
      out[c.kind].push(score(c));
    }
    for (const k of Object.keys(out) as FieldKind[]) {
      out[k].sort((a, b) =>
        RANK[b.confidence] - RANK[a.confidence] ||
        b.independentDomains - a.independentDomains ||
        a.display.localeCompare(b.display));
    }
    return out;
  };

  return {
    confirmed: collect(strong),
    candidate: collect(weak),
    totalAssertions,
    documentsParsed,
  };
}

// ── Seed selection for the next collection hop ─────────────────────────────

export interface Seed {
  kind: "relative" | "address" | "entity";
  value: string;
  /** why this seed is worth a query — surfaced in the coverage matrix */
  rationale: string;
}

/**
 * Information-gain seed selection for HOP 1.
 *   • a relative seed reciprocally confirms the edge that produced it
 *   • an address seed unlocks co-residents and deed history
 *   • an entity seed unlocks co-officers and registered agents
 * Corroborated values outrank single-source ones; the cap keeps the hop
 * inside the wall-clock budget.
 */
export function selectSeeds(ledger: FieldLedger, max = 6): Seed[] {
  const seeds: Seed[] = [];
  const push = (kind: Seed["kind"], value: string, rationale: string) => {
    if (seeds.length >= max) return;
    if (!value || seeds.some((s) => s.value.toUpperCase() === value.toUpperCase())) return;
    seeds.push({ kind, value, rationale });
  };

  const rel = ledger.confirmed.relative.concat(ledger.candidate.relative);
  for (const r of rel.slice(0, 4)) {
    push("relative", r.display, `reciprocal confirmation of relationship edge (${r.confidence.toLowerCase()}, ${r.independentDomains} domain${r.independentDomains === 1 ? "" : "s"})`);
  }
  for (const a of ledger.confirmed.address.slice(0, 2)) {
    push("address", a.display, `co-resident + deed history at ${a.confidence.toLowerCase()} address`);
  }
  for (const e of ledger.confirmed.entity.concat(ledger.candidate.entity).slice(0, 2)) {
    push("entity", e.display, "co-officer / registered-agent expansion");
  }
  return seeds;
}

// ── Render the ledger for the model ────────────────────────────────────────

const KIND_LABEL: Record<FieldKind, string> = {
  address: "ADDRESSES",
  phone: "PHONE NUMBERS",
  email: "EMAIL ADDRESSES",
  age: "AGE",
  dob: "DATE OF BIRTH",
  handle: "USERNAMES / PROFILE HANDLES",
  employer: "EMPLOYERS / OCCUPATIONS",
  entity: "BUSINESS ENTITIES",
  case: "CASE / DOCKET NUMBERS",
  parcel: "PARCEL / FOLIO IDs",
  license: "LICENCE / PERMIT NUMBERS",
  relative: "RELATIVES & ASSOCIATES",
  alias: "ALIASES / NAME VARIANTS",
};

const ORDER: FieldKind[] = [
  "alias", "age", "dob", "address", "phone", "email", "handle",
  "employer", "entity", "case", "parcel", "license", "relative",
];

function renderGroup(fields: ResolvedField[], limit: number): string {
  return fields.slice(0, limit).map((f) => {
    const srcs = f.sources.slice(0, 5).map((s) => `${s.domain}`).join(", ");
    const auth = f.authoritative ? " [AUTHORITATIVE SOURCE]" : "";
    return `    - ${f.display} — ${f.confidence} (${f.independentDomains} independent domain${f.independentDomains === 1 ? "" : "s"}: ${srcs})${auth}`;
  }).join("\n");
}

export function formatFieldLedger(ledger: FieldLedger): string {
  const lines: string[] = [];
  lines.push(`## RESOLVED FIELD LEDGER (computed by the extraction layer — DO NOT recompute)`);
  lines.push(`Documents parsed: ${ledger.documentsParsed} · Raw assertions extracted: ${ledger.totalAssertions}`);
  lines.push(`Confidence is ARITHMETIC, not judgement: VERIFIED = authoritative source or ≥3 independent domains · CORROBORATED = ≥2 independent domains · REPORTED = 1 domain.`);
  lines.push(`Render these confidence labels EXACTLY as given. Never upgrade a REPORTED field to "confirmed".`);
  lines.push("");

  let any = false;
  lines.push(`### CONFIRMED-IDENTITY FIELDS (extracted from STRONG identity-band documents)`);
  for (const k of ORDER) {
    const f = ledger.confirmed[k];
    if (!f.length) continue;
    any = true;
    lines.push(`  ${KIND_LABEL[k]} (${f.length} distinct):`);
    lines.push(renderGroup(f, k === "relative" || k === "address" || k === "entity" ? 25 : 15));
  }
  if (!any) lines.push("  (none — no STRONG-band document yielded a parseable field)");

  let anyC = false;
  const cLines: string[] = [];
  for (const k of ORDER) {
    const f = ledger.candidate[k];
    if (!f.length) continue;
    anyC = true;
    cLines.push(`  ${KIND_LABEL[k]} (${f.length} distinct):`);
    cLines.push(renderGroup(f, 10));
  }
  if (anyC) {
    lines.push("");
    lines.push(`### CANDIDATE FIELDS (from POSSIBLE-band documents — report under "Unverified candidates" ONLY, never in the confirmed profile)`);
    lines.push(...cLines);
  }

  return lines.join("\n");
}
