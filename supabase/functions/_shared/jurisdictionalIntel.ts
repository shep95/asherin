// jurisdictionalIntel.ts — SOVEREIGN INTELLIGENCE BRAIN v2
//
// NEW NARRATIVE:
//   • No verb requirement. Any message that resolves to a proper-noun subject +
//     a locus enters the sweep. Casual phrasing ("her name is X, cape coral FL")
//     is treated the same as "search X in cape coral FL".
//   • Location parsing is a WHOLE-MESSAGE SCANNER. Every country, state,
//     province, region, and known city is detected; the most-specific token
//     wins. No dependency on commas or the word "in".
//   • Retrieval is THREE PASSES fused:
//        PASS 1 (web-tab parity) — wide Zophiel call, no site: restrictor,
//        subject unquoted. Guarantees parity with what the Zophiel web tab
//        would show.
//        PASS 2 (jurisdiction enrich) — parallel site-scoped sweeps into
//        authoritative registries.
//        PASS 3 (body excerpts) — opportunistic only, never allowed to stall
//        the chat answer.
//   • Body-fetch on top URLs to extract more than the search snippet.
//   • Report is fused into DOMAIN-CLASS BUCKETS (Authoritative, Corporate,
//     Court/Legal, People, News, Wide Web Context) so nothing is dropped.
//   • NEVER touch breach/leak databases. Enforced by SOURCE_BLOCKLIST +
//     stripBlocked + per-URL isBlockedSource check on every fused hit.

import { sourcesFor, siteFilter, parseJurisdiction, isBlockedSource } from "./jurisdictions.ts";
import {
  buildFieldLedger, formatFieldLedger,
  type FieldLedger, type Seed,
} from "./intelExtract.ts";
import {
  resolveCandidates, formatCandidateContext,
  type Candidate, type CandidateSet,
} from "./candidateResolve.ts";
import {
  createGraph, ingestRing1, ingestRing2, ring2Seeds, intersectBranches, formatGraph,
  type IntelGraph, type GraphNode,
} from "./intelGraph.ts";



const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";

const NEWS_SITES = ["news.google.com", "reuters.com", "apnews.com", "bbc.com/news"];

// ── Types ──────────────────────────────────────────────────────────────────
export type IntelKind = "person" | "property" | "entity" | "none";

export interface IntelIntent {
  kind: IntelKind;
  subject: string;
  country: string;
  state: string;
  county: string;
  city: string;
  needsClarification: boolean;
  clarifyQuestions: string[];
  accelerators: string[];
}

export interface IntelChannelHit {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  body?: string; // populated on Pass-3 body fetch
  bucket?: DomainBucket;
  identityScore?: number;
  identityReasons?: string[];
  identityBand?: "strong" | "possible" | "rejected";
}

export type DomainBucket =
  | "authoritative"
  | "corporate"
  | "court"
  | "people"
  | "news"
  | "social"
  | "web";

export interface IntelBundle {
  intent: IntelIntent;
  buckets: Record<DomainBucket, IntelChannelHit[]>;
  registries: string[];
  jurisdictionLabel: string;
  emptyBuckets: DomainBucket[];
  totalHits: number;
  rejectedIdentityHits: number;
  /** deterministic extraction + resolution output (see intelExtract.ts) */
  fieldLedger?: FieldLedger;
  /** how many full documents were actually opened and parsed */
  documentsFetched?: number;
  /** seeds actually queried during the recursive HOP-1 collection */

  hopSeeds?: Seed[];
  /** bounded three-hop relationship graph (person sweeps only) */
  graph?: IntelGraph;
  /** how many ring-1 nodes were actually expanded into ring 2 */
  ring2Executed?: number;
  elapsedMs?: number;
  queriesRun?: number;
  /** Act-1 identity clustering: distinct humans sharing this name */
  candidateSet?: CandidateSet;
}



// ── Lookup tables (kept from v1 — proven to work) ─────────────────────────
const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};
const AU_STATES: Record<string, string> = {
  "new south wales": "NSW", nsw: "NSW", victoria: "VIC", vic: "VIC",
  queensland: "QLD", qld: "QLD", "western australia": "WA",
  "south australia": "SA", tasmania: "TAS", tas: "TAS",
  "australian capital territory": "ACT", act: "ACT",
  "northern territory": "NT", nt: "NT",
};
const CA_PROVINCES: Record<string, string> = {
  ontario: "ON", "british columbia": "BC", alberta: "AB", quebec: "QC",
  saskatchewan: "SK", manitoba: "MB", "nova scotia": "NS", "new brunswick": "NB",
  "prince edward island": "PE", newfoundland: "NL", "newfoundland and labrador": "NL",
};
const CITY_TO_COUNTY: Record<string, { country: string; state: string; county: string }> = {
  "cape coral": { country: "US", state: "FL", county: "LEE" },
  "fort myers": { country: "US", state: "FL", county: "LEE" },
  "naples": { country: "US", state: "FL", county: "COLLIER" },
  "miami": { country: "US", state: "FL", county: "MIAMI-DADE" },
  "miami beach": { country: "US", state: "FL", county: "MIAMI-DADE" },
  "fort lauderdale": { country: "US", state: "FL", county: "BROWARD" },
  "hollywood": { country: "US", state: "FL", county: "BROWARD" },
  "west palm beach": { country: "US", state: "FL", county: "PALM BEACH" },
  "orlando": { country: "US", state: "FL", county: "ORANGE" },
  "tampa": { country: "US", state: "FL", county: "HILLSBOROUGH" },
  "st petersburg": { country: "US", state: "FL", county: "PINELLAS" },
  "st. petersburg": { country: "US", state: "FL", county: "PINELLAS" },
  "jacksonville": { country: "US", state: "FL", county: "DUVAL" },
  "punta gorda": { country: "US", state: "FL", county: "CHARLOTTE" },
  "sarasota": { country: "US", state: "FL", county: "SARASOTA" },
  "houston": { country: "US", state: "TX", county: "HARRIS" },
  "dallas": { country: "US", state: "TX", county: "DALLAS" },
  "fort worth": { country: "US", state: "TX", county: "TARRANT" },
  "san antonio": { country: "US", state: "TX", county: "BEXAR" },
  "austin": { country: "US", state: "TX", county: "TRAVIS" },
  "los angeles": { country: "US", state: "CA", county: "LOS ANGELES" },
  "san diego": { country: "US", state: "CA", county: "SAN DIEGO" },
  "san jose": { country: "US", state: "CA", county: "SANTA CLARA" },
  "oakland": { country: "US", state: "CA", county: "ALAMEDA" },
  "san francisco": { country: "US", state: "CA", county: "SAN FRANCISCO" },
  "new york": { country: "US", state: "NY", county: "NEW YORK" },
  "manhattan": { country: "US", state: "NY", county: "NEW YORK" },
  "brooklyn": { country: "US", state: "NY", county: "KINGS" },
  "queens": { country: "US", state: "NY", county: "QUEENS" },
  "chicago": { country: "US", state: "IL", county: "COOK" },
  "sydney": { country: "AU", state: "NSW", county: "" },
  "melbourne": { country: "AU", state: "VIC", county: "" },
  "brisbane": { country: "AU", state: "QLD", county: "" },
  "perth": { country: "AU", state: "WA", county: "" },
  "adelaide": { country: "AU", state: "SA", county: "" },
  "hobart": { country: "AU", state: "TAS", county: "" },
  "canberra": { country: "AU", state: "ACT", county: "" },
  "darwin": { country: "AU", state: "NT", county: "" },
  "toronto": { country: "CA", state: "ON", county: "" },
  "vancouver": { country: "CA", state: "BC", county: "" },
  "calgary": { country: "CA", state: "AB", county: "" },
  "edmonton": { country: "CA", state: "AB", county: "" },
  "montreal": { country: "CA", state: "QC", county: "" },
  "ottawa": { country: "CA", state: "ON", county: "" },
  "london": { country: "GB", state: "", county: "" },
  "manchester": { country: "GB", state: "", county: "" },
  "edinburgh": { country: "GB", state: "SCT", county: "" },
  "glasgow": { country: "GB", state: "SCT", county: "" },
  "belfast": { country: "GB", state: "NIR", county: "" },
};

// ── Detection ──────────────────────────────────────────────────────────────
const PROPERTY_STRICT = /\b\d{1,6}\s+[A-Z][a-zA-Z0-9\.\-']+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Cir|Circle|Hwy|Highway|Pkwy|Parkway)\b/i;
const PROPERTY_HINTS = /\b(parcel|deed|acreage|owner of|assessor)\b/i;
const ENTITY_HINTS = /\b(llc|inc\.?|corp\.?|corporation|company|ltd\.?|holdings|group|trust|foundation|pty|gmbh|s\.?a\.?)\b/i;

// Person indicator: two or more name-like tokens.
// Case-insensitive — we normalize casing before matching so lowercased
// messages like "asher shepherd newton" are still recognized as a name.
const NAME_RE = /\b([A-Z][a-z'’\-]{1,})(?:\s+([A-Z][a-z'’\-]{1,})){1,3}\b/;

/**
 * Words that can never be part of a person's name in a query.
 *
 * Why this list exists: the title-case fallback below uppercases EVERY word so
 * that a lowercased "asher newton" is still recognized. Unguarded, that same
 * fallback turned "how many ounces in a cup" into "How Many Ounces" and sent a
 * grocery question into a forty-second three-hop identity sweep. Casing alone
 * is not evidence of a name — the tokens have to be capable of being one.
 */
const NON_NAME_TOKENS = new Set([
  "how","what","why","when","where","which","who","whom","whose","is","are","was",
  "were","do","does","did","can","could","should","would","will","shall","may",
  "might","the","a","an","and","or","but","if","then","than","that","this","these",
  "those","there","here","of","in","on","at","to","for","from","by","with","about",
  "into","over","under","between","many","much","more","most","less","least","some",
  "any","all","none","not","no","yes","please","tell","me","my","you","your","i",
  "we","us","it","its","he","she","they","them","his","her","their","explain",
  "describe","compare","give","make","show","help","need","want","know","think",
  "write","build","fix","create","list","find","search","look","up","out","get",
  "now","today","tomorrow","yesterday","time","times","open","close","closed",
  "price","cost","weather","near","best","good","bad","new","old","cup","ounces",
  "code","file","error","function","page","app","site","data","report","map",
]);

function isPlausibleName(candidate: string): boolean {
  const tokens = candidate.trim().split(/\s+/);
  if (tokens.length < 2) return false;
  // Every token must be name-capable. One function word is enough to prove the
  // phrase is a sentence fragment, not a name.
  return tokens.every((tok) => {
    const w = tok.toLowerCase().replace(/[^a-z'’\-]/g, "");
    return w.length >= 2 && !NON_NAME_TOKENS.has(w);
  });
}

function titleCaseForName(s: string): string {
  return s.replace(/\b([a-z])([a-z'’\-]*)/gi, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}

function matchName(s: string): string {
  const direct = s.match(NAME_RE);
  if (direct && isPlausibleName(direct[0])) return direct[0];

  // Title-case fallback is only for genuinely lowercased input. If the operator
  // already capitalized something and it did not survive the plausibility test,
  // re-casing the whole sentence cannot turn it into a name.
  if (/[A-Z]/.test(s.replace(/^[^a-z]*/i, "").slice(1))) return "";
  const tc = titleCaseForName(s).match(NAME_RE);
  return tc && isPlausibleName(tc[0]) ? tc[0] : "";
}


function stripTriggerVerbs(raw: string): string {
  return raw
    .replace(/^\s*(please\s+)?(can you\s+)?(search|find|look\s?up|research|dig\s?up|pull records?\s+on|scan for|locate|track down|who is|osint on|background(?:\s+check)?\s+on|dossier on|profile of|tell me about|info on|information on|details on|data on)\s+(for\s+)?/i, "")
    .replace(/\b(who lives?|that lives?|living|based|located|from|in|at)\s+(in|at)\s+/gi, " ")
    .trim();
}

/** Full-message location scanner. Returns most-specific tokens found. */
function scanLocation(raw: string): { country: string; state: string; county: string; city: string } {
  const t = String(raw || "");
  const low = t.toLowerCase();
  let country = "", state = "", county = "", city = "";

  // Country tokens
  const countryPatterns: Array<[RegExp, string]> = [
    [/\b(usa|u\.s\.a\.|u\.s\.|united states|america)\b/, "US"],
    [/\b(canada|canadian)\b/, "CA"],
    [/\b(uk|united kingdom|england|scotland|wales|britain|british)\b/, "GB"],
    [/\b(australia|australian|aussie)\b/, "AU"],
    [/\bnew zealand\b/, "NZ"],
    [/\bmexico\b/, "MX"],
    [/\b(germany|deutschland)\b/, "DE"],
    [/\bfrance\b/, "FR"], [/\bspain\b/, "ES"], [/\bitaly\b/, "IT"],
    [/\bnetherlands\b/, "NL"], [/\bireland\b/, "IE"], [/\bjapan\b/, "JP"],
    [/\bsingapore\b/, "SG"], [/\b(uae|dubai|abu dhabi)\b/, "AE"],
    [/\bsouth africa\b/, "ZA"], [/\bbrazil\b/, "BR"], [/\bindia\b/, "IN"],
  ];
  for (const [re, code] of countryPatterns) {
    if (re.test(low)) { country = code; break; }
  }

  // City scan first (most specific → also sets country/state/county)
  for (const [cityName, meta] of Object.entries(CITY_TO_COUNTY)) {
    const cityRe = new RegExp(`\\b${cityName.replace(/\./g, "\\.")}\\b`, "i");
    if (cityRe.test(low)) {
      city = cityName.replace(/\b\w/g, (c) => c.toUpperCase());
      if (!state) state = meta.state;
      if (!county) county = meta.county;
      if (!country) country = meta.country;
      break;
    }
  }

  // State scan (US)
  if (!state) {
    for (const [name, code] of Object.entries(US_STATES)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(low)) {
        state = code; if (!country) country = "US"; break;
      }
    }
  }
  // AU state
  if (!state && (country === "AU" || !country)) {
    for (const [name, code] of Object.entries(AU_STATES)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(low)) {
        state = code; country = "AU"; break;
      }
    }
  }
  // CA province
  if (!state && (country === "CA" || !country)) {
    for (const [name, code] of Object.entries(CA_PROVINCES)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(low)) {
        state = code; country = "CA"; break;
      }
    }
  }
  // Two-letter US state code (case-insensitive, punctuation-tolerant)
  if (!state) {
    const stCode = t.match(/\b([A-Za-z]{2})\b/g);
    if (stCode) {
      for (const raw of stCode) {
        const up = raw.toUpperCase();
        if (Object.values(US_STATES).includes(up)) {
          state = up; if (!country) country = "US"; break;
        }
      }
    }
  }
  // Fuzzy pass — operators misspell places ("flordia", "califorina",
  // "cape corral"). Without this the misspelled token survives into the
  // subject name and poisons every downstream registry query.
  if (!state) {
    for (const word of low.split(/[^a-z]+/)) {
      if (word.length < 5) continue;
      for (const [name, code] of Object.entries(US_STATES)) {
        if (!name.includes(" ") && isFuzzyGeoMatch(word, name)) {
          state = code; if (!country) country = "US"; break;
        }
      }
      if (state) break;
    }
  }

  // County explicit
  const co = t.match(/([A-Za-z\-\.\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  return { country, state, county, city };
}

// ── Fuzzy geo vocabulary ───────────────────────────────────────────────────
// Single-word place names used to scrub location noise out of subject names.
const GEO_WORDS: string[] = Array.from(new Set([
  ...Object.keys(US_STATES), ...Object.keys(AU_STATES), ...Object.keys(CA_PROVINCES),
  ...Object.keys(CITY_TO_COUNTY),
  "usa", "america", "united", "states", "canada", "canadian", "england", "scotland",
  "wales", "britain", "british", "australia", "australian", "mexico", "germany",
  "france", "spain", "italy", "netherlands", "ireland", "japan", "singapore",
  "county", "city", "town", "state", "province", "country",
].flatMap((v) => v.split(/\s+/)))).filter((w) => w.length >= 4);

/** Levenshtein distance capped at 2 — enough for one typo/transposition. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Exact for short words; tolerate one edit at 6+ chars, two at 9+. */
function isFuzzyGeoMatch(word: string, vocab: string): boolean {
  if (word === vocab) return true;
  const budget = vocab.length >= 9 ? 2 : vocab.length >= 6 ? 1 : 0;
  if (budget === 0) return false;
  return editDistance(word, vocab) <= budget;
}

function scrubGeoNoise(s: string): string {
  return s.split(/\s+/).filter((tok) => {
    const w = tok.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 4) return true;
    return !GEO_WORDS.some((g) => isFuzzyGeoMatch(w, g));
  }).join(" ");
}


/** Extract a plausible subject (proper-noun name or address) from the message. */
function extractSubject(raw: string, jurisdictionTokens: string[]): string {
  const cleaned = stripTriggerVerbs(raw);
  // Remove jurisdiction tokens so the subject isn't polluted.
  let s = cleaned;
  for (const tok of jurisdictionTokens) {
    if (!tok) continue;
    s = s.replace(new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  }
  s = s.replace(/\b(who|that|which)\s+(lives?|living|is|are|was|were)\b/gi, " ")
       .replace(/\s{2,}/g, " ")
       .replace(/[,\.]+$/g, "")
       .trim();
  // Kill misspelled/leftover place words ("flordia") before name matching —
  // otherwise they get absorbed as a fourth name token and every registry
  // query searches for a person who does not exist.
  s = scrubGeoNoise(s).replace(/\s{2,}/g, " ").trim();

  const nameMatch = matchName(s);
  // Cap at three tokens: First [Middle] Last. A longer run is noise.
  if (nameMatch) return nameMatch.split(/\s+/).slice(0, 3).join(" ");
  return s;
}


// ── Intent classifier ──────────────────────────────────────────────────────
export function classifyIntent(rawUserMessage: string): IntelIntent {
  const raw = String(rawUserMessage || "").trim();
  const empty: IntelIntent = {
    kind: "none", subject: "", country: "", state: "", county: "", city: "",
    needsClarification: false, clarifyQuestions: [], accelerators: [],
  };
  if (!raw || raw.length < 4) return empty;

  const looksProperty = PROPERTY_STRICT.test(raw) || PROPERTY_HINTS.test(raw);
  const looksEntity = ENTITY_HINTS.test(raw);
  const hasName = Boolean(matchName(raw));

  // Location scanner runs on the WHOLE message (no tail-splitting).
  const loc = scanLocation(raw);
  const fallback = parseJurisdiction(raw);
  const country = loc.country || fallback.country;
  const state = loc.state || fallback.state;
  const county = loc.county || fallback.county;
  const city = loc.city;

  const hasLocus = Boolean(country || state || city);

  // Enter the sweep whenever we have (subject-like) + (locus) OR explicit address.
  if (!looksProperty && !hasName) return empty;
  if (looksProperty === false && !hasLocus) {
    // person/entity with no locus at all → BLOCK for clarification
    const subject = extractSubject(raw, []);
    return {
      kind: looksEntity ? "entity" : "person",
      subject, country: "", state: "", county: "", city: "",
      needsClarification: true,
      clarifyQuestions: [
        `Which country is ${subject} in?`,
        `Roughly what state, province, or region — and which city if you know?`,
        `Any middle name, age range, employer, or known associate to narrow the search?`,
      ],
      accelerators: [],
    };
  }

  const kind: IntelKind = looksProperty ? "property" : looksEntity ? "entity" : "person";
  const jurisdictionTokens = [city, county, state, country,
    "florida", "california", "texas", "new york",
    "usa", "united states", "america", "who lives", "lives in", "who is",
  ].filter(Boolean);
  const subject = extractSubject(raw, jurisdictionTokens);

  const accelerators: string[] = [];
  if (kind === "person" && country && !state) {
    if (country === "US") accelerators.push(`Which U.S. state?`);
    else if (country === "AU") accelerators.push(`Which Australian state?`);
    else if (country === "CA") accelerators.push(`Which Canadian province?`);
  }
  if (kind === "person" && state && !city && !county) {
    accelerators.push(`Any city or county to reach ground-level records?`);
  }

  return {
    kind, subject, country, state, county, city,
    needsClarification: false, clarifyQuestions: [], accelerators,
  };
}

// ── Zophiel retrieval ──────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A single upstream query. `retry` re-issues once after a short pause when the
 * upstream returns an empty set: bursts of parallel queries were observed to
 * degrade to zero results mid-sweep while identical queries succeeded seconds
 * later, so an empty response is treated as soft failure, not as "no data".
 */
async function zophielQueryOnce(query: string, options: { timeoutMs?: number; limit?: number } = {}): Promise<IntelChannelHit[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return [];

  // Hard-cap any per-call timeout at 10s so a slow/degraded zophiel-search
  // cannot chain into pushing the outer /chat request past the 150s edge limit.
  const timeoutMs = Math.min(options.timeoutMs ?? 15000, 15000);
  const limit = options.limit ?? 12;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "apikey": SUPABASE_ANON,
      },
      // fast:true → zophiel-search runs only the engines that still return
      // data from edge IPs. The full fan-out costs >10s, which this call used
      // to abort on, silently zeroing out the entire web layer.
      body: JSON.stringify({ query, page: 1, mode: "web", fast: true }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      console.warn(`[intel:query] HTTP ${resp.status} q="${query.slice(0, 80)}"`);
      return [];
    }
    const data = await resp.json();

    let raw: any[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.hits) ? data.hits : []);
    // Fallback: flatten `grouped` (category → results[]) if `results` empty.
    if (raw.length === 0 && data?.grouped && typeof data.grouped === "object") {
      raw = Object.values(data.grouped).flat() as any[];
    }
    const mapped = raw.slice(0, limit).map((r: any) => {
      const url = String(r.url || r.link || r.source_url || (r.source && !r.source.includes(" ") ? `https://${r.source}` : "") || "");
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
      return {
        title: String(r.title || r.name || ""),
        url,
        snippet: String(r.snippet || r.description || r.summary || "").slice(0, 500),
        domain,
      } as IntelChannelHit;
    }).filter((h: IntelChannelHit) => h.url && !isBlockedSource(h.domain) && !isBlockedSource(h.url));
    console.log(`[intel:query] raw=${raw.length} kept=${mapped.length} q="${query.slice(0, 80)}"`);
    return mapped;


  } catch (e) {
    console.error("[jurisdictionalIntel] zophiel query failed:", (e as Error).message);
    return [];
  }
}

// Identical queries were being issued several times inside one sweep (strict
// and loose ring-2 forms collapse to the same string, pass-1 emits the quoted
// form twice for two-token names). Every duplicate burns one unit of a rate
// limited upstream budget, which is exactly what starves the later channels,
// so identical queries share one in-flight promise for the life of a sweep.
const queryCache = new Map<string, Promise<IntelChannelHit[]>>();
let queryCacheRunId = "";

function beginQueryRun(runId: string) {
  if (queryCacheRunId !== runId) {
    queryCache.clear();
    queryCacheRunId = runId;
  }
}

async function zophielQuery(
  query: string,
  options: { timeoutMs?: number; limit?: number; retryEmpty?: boolean } = {},
): Promise<IntelChannelHit[]> {
  const key = query.trim().replace(/\s+/g, " ").toLowerCase();
  const cached = queryCache.get(key);
  if (cached) return await cached;

  const run = (async () => {
    const first = await zophielQueryOnce(query, options);
    if (first.length || options.retryEmpty === false) return first;
    await sleep(700);
    const second = await zophielQueryOnce(query, options);
    if (second.length) console.log(`[intel:query] retry recovered ${second.length} q="${query.slice(0, 60)}"`);
    return second;
  })();

  queryCache.set(key, run);
  return await run;
}



// ── Domain classifier ──────────────────────────────────────────────────────
function classifyDomain(domain: string): DomainBucket {
  const d = domain.toLowerCase();
  // Government / authoritative records
  if (/\.gov\b|\.gov\.|\.us\b|leepa\.org|floridaparcels\.com|sunbiz\.org|bcpa\.net|hcad\.org|acris\.nyc\.gov|nswlrs\.com\.au|landregistry\.data\.gov\.uk|companies-house|company-information\.service\.gov\.uk/.test(d)) return "authoritative";
  if (/opencorporates\.com|sec\.gov|efts\.sec\.gov|linkedin\.com\/company|asic\.gov\.au|corporationscanada|handelsregister\.de|infogreffe\.fr/.test(d)) return "corporate";
  if (/pacer\.gov|courtlistener\.com|justia\.com|austlii|myflcourtaccess/.test(d)) return "court";
  if (/truepeoplesearch|whitepages|spokeo|beenverified|fastpeoplesearch|fastbackgroundcheck|freepeoplesearch|peoplefinders|searchpeoplefree|unmask\.com|idcrawl|intelius|nuwber|clustrmaps|cyberbackgroundchecks|ussearch|instantcheckmate|peekyou|zabasearch|addresses\.com|smartbackgroundchecks|officialusa|radaris|thatsthem|voterrecords|usphonebook|canada411|192\.com/.test(d)) return "people";
  if (/news\.google\.com|reuters\.com|apnews\.com|bbc\.com|nytimes\.com|washingtonpost\.com|news-press\.com|winknews\.com|nbc-2\.com/.test(d)) return "news";
  if (/facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|tiktok\.com|youtube\.com|pinterest\.com/.test(d)) return "social";
  return "web";
}

function normalizeIdentityText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function scorePersonIdentity(hit: IntelChannelHit, intent: IntelIntent): IntelChannelHit {
  if (intent.kind !== "person") return hit;
  const haystack = normalizeIdentityText(`${hit.title} ${hit.snippet} ${hit.body || ""}`);
  const name = normalizeIdentityText(intent.subject);
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";
  const middle = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const middleInitial = middle.charAt(0);
  const firstLast = `${first} ${last}`.trim();
  let score = 0;
  const reasons: string[] = [];
  if (name && haystack.includes(name)) { score += 60; reasons.push("exact full name"); }
  else if (firstLast && haystack.includes(firstLast)) { score += 32; reasons.push("first + last name"); }
  else if (first && last && (haystack.includes(`${last} ${first}`) || haystack.includes(`${last} ${first} ${middleInitial}`))) { score += 32; reasons.push("registry name order"); }
  else if (first && last && haystack.includes(first) && haystack.includes(last)) { score += 22; reasons.push("name tokens"); }
  if (middle && haystack.includes(middle)) { score += 15; reasons.push("middle name"); }
  const locators = [
    [intent.city, 25, "city"], [intent.county, 15, "county"],
    [intent.state, 10, "state"], [intent.country, 5, "country"],
  ] as const;
  for (const [value, weight, label] of locators) {
    const normalized = normalizeIdentityText(value);
    if (normalized && new RegExp(`\\b${normalized}\\b`).test(haystack)) { score += weight; reasons.push(label); }
  }
  hit.identityScore = Math.min(score, 100);
  hit.identityReasons = reasons;
  hit.identityBand = score >= 70 ? "strong" : score >= 45 ? "possible" : "rejected";
  return hit;
}

// ── Body fetch (deep pass) ─────────────────────────────────────────────────
/** Collapse an HTML document to parseable plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    // 3.5 KB truncated people-directory pages before the relatives block. The
    // extraction layer parses the whole document, so keep 14 KB.
    .slice(0, 14000);
}

/**
 * Firecrawl fallback.
 *
 * Live measurement: every people-directory target (unmask, fastbackgroundcheck,
 * idcrawl) sits behind Cloudflare and answers a datacenter fetch with 403 or a
 * challenge page, so the direct pass harvested ZERO documents and the whole
 * extraction layer starved. Firecrawl renders through a residential path and
 * returns the article text those pages actually contain.
 */
// ── Profile-image capture ──────────────────────────────────────────────────
// htmlToText destroys <meta og:image>, so the raw document is scanned for a
// profile image BEFORE it is flattened. Values are only recorded here; they are
// fetched later through the SSRF-guarded intel-avatar proxy, never inline.
const IMAGE_BY_URL = new Map<string, string>();
const IMAGE_CACHE_CAP = 300;

function captureProfileImage(pageUrl: string, html: string): void {
  if (IMAGE_BY_URL.has(pageUrl)) return;
  const head = html.slice(0, 60000);
  const patterns = [
    /<meta[^>]+property=["'](?:og:image(?::secure_url)?)["'][^>]+content=["']([^"']{8,600})["']/i,
    /<meta[^>]+content=["']([^"']{8,600})["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']{8,600})["']/i,
    /"image"\s*:\s*"(https:\/\/[^"\\]{8,600})"/i,
  ];
  for (const re of patterns) {
    const m = re.exec(head);
    if (!m) continue;
    let raw = m[1].replace(/&amp;/g, "&").trim();
    if (raw.startsWith("//")) raw = `https:${raw}`;
    if (!/^https:\/\//i.test(raw)) continue;
    if (/\.svg(\?|$)/i.test(raw)) continue; // vector can carry script
    if (IMAGE_BY_URL.size >= IMAGE_CACHE_CAP) IMAGE_BY_URL.clear();
    IMAGE_BY_URL.set(pageUrl, raw);
    return;
  }
}

async function fetchBodyViaFirecrawl(url: string, timeoutMs: number): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key || timeoutMs < 3000) return "";
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: Math.min(timeoutMs - 500, 20000) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return "";
    const json = await resp.json().catch(() => null) as any;
    const md: string = json?.data?.markdown || json?.data?.html || "";
    if (!md) return "";
    return htmlToText(md);
  } catch {
    return "";
  }
}

async function fetchBody(url: string, timeoutMs = 4500): Promise<string> {
  let direct = "";
  try {
    const resp = await fetch(url, {
      headers: {
        // A self-identifying bot UA is auto-403'd by every major directory.
        // Present as a real browser; we only read publicly served pages.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(Math.min(timeoutMs, 6000)),
      redirect: "follow",
    });
    if (resp.ok) {
      const ct = resp.headers.get("content-type") || "";
      if (/text\/html|application\/xhtml|text\/plain/.test(ct)) {
        const raw = await resp.text();
        captureProfileImage(url, raw);
        direct = htmlToText(raw);
      }
    }
  } catch { /* fall through to Firecrawl */ }

  // A challenge/interstitial returns 200 with almost no text — treat as failure.
  if (direct.length >= 600 && !/just a moment|enable javascript|access denied|verify you are human/i.test(direct.slice(0, 400))) {
    return direct;
  }
  const rendered = await fetchBodyViaFirecrawl(url, timeoutMs);
  return rendered.length > direct.length ? rendered : direct;
}


function scoreEnrichQuery(intent: IntelIntent, label: string): number {
  if (intent.kind === "person") {
    if (label === "people") return 100;
    // Legal-document channels are part of the core dossier, not an optional
    // tail: an operator asking "who is X" expects LLCs, filings and records.
    if (label === "business") return 95;
    if (label === "criminal") return 88;
    if (label === "contact") return 82;
    if (label === "entities") return 60;
    if (label === "news") return 70;
    if (label === "courts") return intent.state || intent.city ? 65 : 35;
    if (label === "ownership" || label === "tax" || label === "permits") return intent.state || intent.city ? 45 : 15;
  }
  if (intent.kind === "entity") {
    if (label === "entities") return 100;
    if (label === "business") return 95;
    if (label === "courts") return 75;
    if (label === "criminal") return 70;
    if (label === "news") return 55;
  }
  if (intent.kind === "property") {
    if (label === "ownership") return 100;
    if (label === "tax") return 90;
    if (label === "permits") return 80;
    if (label === "listings") return 65;
  }
  return 10;
}


// ── Three-pass sweep + fusion ───────────────────────────────────────────────
export async function runJurisdictionalSearch(intent: IntelIntent): Promise<IntelBundle> {
  const startedAt = Date.now();
  beginQueryRun(`${startedAt}:${intent.subject}`);

  // 30s only ever bought a snippet sweep. The deep harvest (26 documents) plus
  // the recursive HOP-1 collection need real wall clock; 68s still leaves the
  // /chat request ~80s of streaming headroom inside its 150s edge limit.
  const deadlineMs = 68000;

  const src = sourcesFor(intent.country, intent.state, intent.county);
  const registries = Array.from(new Set([
    ...src.ownership, ...src.tax, ...src.permits, ...src.entities, ...src.courts, ...src.people,
  ])).slice(0, 25);

  const jurisdictionLabel = [
    intent.city,
    intent.county ? `${intent.county} County` : "",
    intent.state,
    intent.country,
  ].filter(Boolean).join(", ") || "unspecified";

  const subject = intent.subject;
  const subjectQuoted = /\s/.test(subject) ? `"${subject}"` : subject;
  // Country name maps to the geo token when no finer locus is present, so
  // Pass-1 web-tab parity actually includes "Australia" / "United Kingdom".
  const COUNTRY_LABELS: Record<string, string> = {
    US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia",
    NZ: "New Zealand", IE: "Ireland", DE: "Germany", FR: "France",
    ES: "Spain", IT: "Italy", NL: "Netherlands", SE: "Sweden", NO: "Norway",
    DK: "Denmark", FI: "Finland", CH: "Switzerland", AT: "Austria", BE: "Belgium",
    IN: "India", SG: "Singapore", JP: "Japan", MX: "Mexico", BR: "Brazil",
  };
  // County codes ("LEE") inside a query are noise no directory indexes — the
  // observed recall collapse ("Cape Coral LEE FL" → 0 hits) came from exactly
  // this token. City+state is the shape directories actually key on; the
  // county is only useful when no city was resolved.
  const narrowLocus = intent.city
    ? [intent.city, intent.state].filter(Boolean).join(" ")
    : [intent.county ? `${titleCaseForName(intent.county)} County` : "", intent.state].filter(Boolean).join(" ");

  const countryLabel = intent.country ? (COUNTRY_LABELS[intent.country] || intent.country) : "";
  const locus = narrowLocus || countryLabel;


  // ── PASS 1 — WEB-TAB PARITY ─────────────────────────────────────────────
  // Unquoted, no site: restrictor. This is exactly what the Zophiel web tab runs.
  // A fully-quoted three-part name ("First Middle Last") is near-unindexable —
  // directories file people as First Last. Without a collapsed variant the
  // person channel returns nothing and the answer drifts to whatever generic
  // .gov documents matched the loose tokens. Emit both forms.
  const nameParts = subject.split(/\s+/).filter(Boolean);
  const firstLast = intent.kind === "person" && nameParts.length >= 3
    ? `"${nameParts[0]} ${nameParts[nameParts.length - 1]}"`
    : "";
  const pass1Queries: string[] = [
    `${subject} ${locus}`.trim(),
    `${subjectQuoted} ${locus}`.trim(),
  ];

  // ── PASS 2 — JURISDICTION ENRICH ────────────────────────────────────────
  const enrichQueries: Array<{ label: string; query: string }> = [];
  if (intent.kind === "property" || intent.kind === "person") {
    if (src.ownership.length) enrichQueries.push({ label: "ownership", query: `${subjectQuoted} ${locus} owner deed ${siteFilter(src.ownership)}` });
    if (src.tax.length)       enrichQueries.push({ label: "tax",       query: `${subjectQuoted} ${locus} assessed value ${siteFilter(src.tax)}` });
    if (src.permits.length)   enrichQueries.push({ label: "permits",   query: `${subjectQuoted} ${locus} permit ${siteFilter(src.permits)}` });
  }
  if (intent.kind === "person" || intent.kind === "entity") {
    if (src.entities.length) enrichQueries.push({ label: "entities", query: `${subjectQuoted} ${locus} director officer registered agent ${siteFilter(src.entities)}` });
    if (src.courts.length)   enrichQueries.push({ label: "courts",   query: `${subjectQuoted} ${locus} case filing ${siteFilter(src.courts)}` });
  }
  if (intent.kind === "person") {
    // A 9-way `site:a OR site:b …` restrictor returns near-zero on every real
    // SERP backend, so the people channel was structurally dead. Natural-language
    // record phrasing surfaces the same directories organically.
    if (src.people.length) enrichQueries.push({ label: "people", query: `${firstLast || subjectQuoted} ${locus} address phone relatives` });
    if (firstLast) {
      enrichQueries.push({ label: "people", query: `${firstLast} ${locus} age relatives` });
      enrichQueries.push({ label: "people", query: `${firstLast} ${locus}` });
    }

    // Corporate / legal-document, criminal and contact channels.
    //
    // Measured live against the fast lane: over-specified queries (full middle
    // name + 5-6 keywords, e.g. `"Asher Shepherd Newton" LLC registered agent
    // officer Cape Coral Florida`) return ZERO hits, while the short indexable
    // form (`"Asher Newton" Cape Coral Florida court records`) returns 7-11.
    // Directory indexes key on "First Last" + locus, so every record channel
    // below uses the two-token name and at most two intent keywords. The long
    // middle-name form is kept only as a low-priority secondary probe.
    const recordName = firstLast || subjectQuoted;
    enrichQueries.push({ label: "business", query: `${recordName} ${locus} LLC` });
    enrichQueries.push({ label: "business", query: `${recordName} ${locus} registered agent` });
    enrichQueries.push({ label: "criminal", query: `${recordName} ${locus} court records` });
    enrichQueries.push({ label: "contact", query: `${recordName} ${locus} phone email` });
    // Additional collection channels — each targets a record family the old
    // 9-query budget could never reach.
    enrichQueries.push({ label: "people", query: `${recordName} ${locus} previous addresses history` });
    enrichQueries.push({ label: "criminal", query: `${recordName} ${locus} arrest booking` });
    enrichQueries.push({ label: "business", query: `${recordName} sunbiz corporation filing` });
    enrichQueries.push({ label: "contact", query: `${recordName} ${locus} email address` });
    enrichQueries.push({ label: "social", query: `${recordName} facebook profile` });
    enrichQueries.push({ label: "ownership", query: `${recordName} ${locus} property owner parcel` });

    enrichQueries.push({ label: "news", query: `${recordName} ${locus} news` });
    enrichQueries.push({ label: "social", query: `${recordName} ${locus} linkedin instagram` });

  }


  // Pass 1 is deliberately first, not part of a large Promise fan-out. The
  // Zophiel web tab succeeds on single wide calls; flooding it with 6+ nested
  // calls caused chat-timeout failures while the web tab itself still worked.
  const pass1a = await zophielQuery(pass1Queries[0], { timeoutMs: 10000, limit: 20 });
  const pass1b = pass1a.length >= 8 || pass1Queries[1] === pass1Queries[0]
    ? []
    : await zophielQuery(pass1Queries[1], { timeoutMs: Math.max(4000, Math.min(8000, deadlineMs - (Date.now() - startedAt) - 3500)), limit: 12 });

  const countryOnlyPerson = intent.kind === "person" && Boolean(intent.country) && !intent.state && !intent.city && !intent.county;
  const maxEnrich = countryOnlyPerson ? 4 : 14;
  const selectedEnrich = enrichQueries
    .sort((a, b) => scoreEnrichQuery(intent, b.label) - scoreEnrichQuery(intent, a.label))
    .slice(0, maxEnrich);

  // Bounded-concurrency waves (3 at a time). Fully sequential could only fit
  // ~4 channels inside the 30s deadline, which silently starved the business,
  // criminal and contact channels; an unbounded fan-out previously caused
  // upstream timeouts. Waves of 3 fit all 9 channels inside the same budget.
  const pass2: IntelChannelHit[][] = [];
  const WAVE = 3;
  for (let i = 0; i < selectedEnrich.length; i += WAVE) {
    const remaining = deadlineMs - (Date.now() - startedAt) - 3000;
    if (remaining < 4500) break;
    const wave = selectedEnrich.slice(i, i + WAVE);
    const results = await Promise.all(
      wave.map((q) => zophielQuery(q.query, { timeoutMs: Math.min(7000, remaining), limit: 10, retryEmpty: false })
        .catch(() => [] as IntelChannelHit[])),
    );
    pass2.push(...results);
    // Upstream degrades under back-to-back bursts; a short gap between waves
    // measurably preserves recall on the later channels.
    if (i + WAVE < selectedEnrich.length) await sleep(300);
  }



  // ── FUSE — dedupe by URL, block-check every hit, classify into buckets ──
  const seen = new Set<string>();
  const buckets: Record<DomainBucket, IntelChannelHit[]> = {
    authoritative: [], corporate: [], court: [], people: [], news: [], social: [], web: [],
  };
  const all: IntelChannelHit[] = [...pass1a, ...pass1b, ...pass2.flat()];
  let rejectedIdentityHits = 0;
  for (const hit of all) {
    if (!hit.url || seen.has(hit.url)) continue;
    if (isBlockedSource(hit.domain) || isBlockedSource(hit.url)) continue;
    scorePersonIdentity(hit, intent);
    if (intent.kind === "person" && hit.identityBand === "rejected") {
      rejectedIdentityHits += 1;
      continue;
    }
    seen.add(hit.url);
    const bucket = classifyDomain(hit.domain);
    hit.bucket = bucket;
    buckets[bucket].push(hit);
  }

  // ── PASS 3 — DEEP BODY HARVEST ─────────────────────────────────────────
  // Previously capped at 4 documents (usually 2, often 0). That single number
  // was the reason dossiers were thin: ~90% of what the model saw was a
  // 160-char SERP snippet, and snippets do not contain phone numbers, prior
  // addresses, officer roles or case numbers. We now open up to 26 documents
  // through a bounded worker pool so the extraction layer has real text to
  // parse, while the pool cap keeps us off the upstream-timeout cliff.
  const priority: DomainBucket[] = ["authoritative", "corporate", "court", "people", "social", "news", "web"];
  const pickTargets = (limit: number, pool: IntelChannelHit[]): IntelChannelHit[] => {
    const out: IntelChannelHit[] = [];
    for (const b of priority) {
      for (const h of pool.filter((x) => x.bucket === b)) {
        if (out.length >= limit) return out;
        if (h.body) continue;
        // Weak-identity documents are not worth a fetch slot on a person sweep.
        if (intent.kind === "person" && h.identityBand === "rejected") continue;
        out.push(h);
      }
    }
    return out;
  };

  const harvest = async (targets: IntelChannelHit[], concurrency = 10) => {
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= targets.length) return;
        const remaining = deadlineMs - (Date.now() - startedAt);
        // A rendered fetch needs real time; below 6s there is no point starting one.
        if (remaining < 6000) return;
        targets[i].body = await fetchBody(targets[i].url, Math.max(6000, Math.min(15000, remaining - 3000)));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  };



  const allHits = () => (Object.keys(buckets) as DomainBucket[]).flatMap((b) => buckets[b]);
  const bodyBudget = deadlineMs - (Date.now() - startedAt) > 12000 ? 26
    : deadlineMs - (Date.now() - startedAt) > 7000 ? 10 : 3;
  await harvest(pickTargets(bodyBudget, allHits()));

  // Re-score identity now that bodies exist — a body can promote a POSSIBLE
  // hit to STRONG by supplying the locator the snippet lacked.
  for (const h of allHits()) scorePersonIdentity(h, intent);

  // ── RESOLUTION — deterministic extraction, normalization, scoring ──────
  // A body is preferred, but people-directory result snippets routinely carry
  // the exact payload we need ("Relatives: X, Y · Lives in Cape Coral, FL")
  // while the page itself sits behind a Cloudflare interstitial. Discarding
  // those hits starved ring 1 and left ring 2 with zero branch documents, so
  // snippet-only hits are admitted as lower-weight documents.
  const docsOf = (hits: IntelChannelHit[]) => hits
    .map((h) => {
      const hasBody = !!h.body && h.body.length > 40;
      const meta = `${h.title}\n${h.snippet}`.trim();
      if (!hasBody && meta.length < 60) return null;
      return {
        domain: h.domain,
        url: h.url,
        bucket: h.bucket,
        text: hasBody ? `${meta}\n${h.body}` : meta,
        authoritative: hasBody && (h.bucket === "authoritative" || h.bucket === "court"),
        band: h.identityBand,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const toDocs = () => docsOf(allHits());

  let fieldLedger = buildFieldLedger(toDocs(), intent.subject);

  // ── ACT 1 — IDENTITY RESOLUTION ────────────────────────────────────────
  // Cluster the surviving documents into DISTINCT humans before any of them is
  // allowed into one dossier. A shared name is not a merge condition; only a
  // shared address / phone / relative / employer / entity / birth-year+city is.
  // When two clusters survive with comparable weight the sweep STOPS here: the
  // ring-2 expansion below is the expensive act and must never be spent on a
  // namesake.
  const candidateSet = intent.kind === "person"
    ? resolveCandidates(toDocs(), intent, (u) => IMAGE_BY_URL.get(u))
    : undefined;
  if (candidateSet) {
    console.log(`[intel:candidates] clusters=${candidateSet.candidates.length} margin=${candidateSet.margin} ambiguous=${candidateSet.ambiguous} unattributed=${candidateSet.unattributed}`);
  }

  // ── BOUNDED THREE-HOP GRAPH ────────────────────────────────────────────
  // RING 1 is a full fanout over everything the subject's own documents
  // assert. RING 2 queries only the highest information-gain ring-1 nodes and
  // admits only what THOSE documents assert, so provenance stays per-branch.
  // RING 3 is never enumerated: the engine intersects ring-2 reach sets and
  // emits closed triangles as inferred cross-links.
  const graph = createGraph(intent.subject);
  const hopExecuted: Seed[] = [];
  let ring2Executed = 0;
  if (intent.kind === "person" && !candidateSet?.ambiguous) {
    ingestRing1(graph, fieldLedger);

    const seeds = ring2Seeds(graph, 6);
    const branches = new Map<string, string[]>();
    if (seeds.length && deadlineMs - (Date.now() - startedAt) > 14000) {
      // Two query shapes per seed. A phrase-quoted query is precise but returns
      // nothing when the index has no exact-phrase match, which is exactly how
      // ring 2 was collapsing to zero; the unquoted form is the fallback.
      const queryFor = (n: GraphNode, loose: boolean) => {
        const name = loose ? n.label : `"${n.label}"`;
        return n.kind === "person" ? `${name} ${locus} relatives address`
          : n.kind === "address" ? `${name} ${locus} owner residents`
            : `${name} ${locus} officer registered agent`;
      };

      const runSeed = async (n: GraphNode, budget: number) => {
        const strict = await zophielQuery(queryFor(n, false), { timeoutMs: budget, limit: 8 })
          .catch(() => [] as IntelChannelHit[]);
        if (strict.length) return strict;
        return await zophielQuery(queryFor(n, true), { timeoutMs: budget, limit: 8 })
          .catch(() => [] as IntelChannelHit[]);
      };

      for (let i = 0; i < seeds.length; i += 3) {
        const remaining = deadlineMs - (Date.now() - startedAt) - 6000;
        if (remaining < 5000) break;
        const wave = seeds.slice(i, i + 3);
        const results = await Promise.all(
          wave.map((n) => runSeed(n, Math.min(6500, remaining))),
        );

        // Per-seed fresh-hit sets keep ring-2 attribution honest: a node found
        // by seed A must not be credited to seed B.
        const freshPerSeed: IntelChannelHit[][] = wave.map(() => []);
        results.forEach((hits, k) => {
          for (const hit of hits) {
            if (!hit.url) continue;
            if (isBlockedSource(hit.domain) || isBlockedSource(hit.url)) continue;
            if (seen.has(hit.url)) {
              // Already collected on an earlier wave. It is still legitimate
              // branch evidence when it actually names this seed — attribute it
              // to the branch without re-adding it to the bucket totals.
              const prior = allHits().find((x) => x.url === hit.url);
              if (prior && `${prior.title} ${prior.snippet} ${prior.body || ""}`
                .toLowerCase().includes(wave[k].label.toLowerCase())) {
                freshPerSeed[k].push(prior);
              }
              continue;
            }
            seen.add(hit.url);
            scorePersonIdentity(hit, intent);
            hit.bucket = classifyDomain(hit.domain);
            buckets[hit.bucket].push(hit);
            freshPerSeed[k].push(hit);
          }
        });

        const hopBodyBudget = deadlineMs - (Date.now() - startedAt) > 9000 ? 8 : 3;
        await harvest(pickTargets(hopBodyBudget, freshPerSeed.flat()), 6);

        wave.forEach((node, k) => {
          hopExecuted.push({ kind: node.kind === "person" ? "relative" : node.kind === "address" ? "address" : "entity", value: node.label, rationale: `information gain ${node.gain}` });
          ring2Executed += 1;
          const branchDocs = docsOf(freshPerSeed[k]);
          console.log(`[intel:ring2] seed="${node.label}" hits=${freshPerSeed[k].length} docs=${branchDocs.length}`);
          if (!branchDocs.length) { branches.set(node.id, []); return; }
          // Ring-2 extraction is scoped to the SEED as subject, not the
          // original target — otherwise the seed's relatives would be parsed
          // as the subject's relatives.
          const branchLedger = buildFieldLedger(branchDocs, node.label);
          const added = ingestRing2(graph, node, branchLedger);
          console.log(`[intel:ring2] seed="${node.label}" ring2Nodes=${added.length}`);
          branches.set(node.id, added);
        });
      }


      // RING 3 — intersection only.
      intersectBranches(graph, branches);
    }
    fieldLedger = buildFieldLedger(toDocs(), intent.subject);
    // Ring-1 is re-ingested against the enriched ledger so late-arriving
    // corroboration upgrades node confidence without duplicating nodes.
    ingestRing1(graph, fieldLedger);
  }


  const emptyBuckets = (Object.keys(buckets) as DomainBucket[]).filter((k) => buckets[k].length === 0);
  const totalHits = Object.values(buckets).reduce((a, b) => a + b.length, 0);
  const documentsFetched = allHits().filter((h) => h.body && h.body.length > 40).length;

  return {
    intent, buckets, registries, jurisdictionLabel, emptyBuckets, totalHits,
    rejectedIdentityHits, fieldLedger, documentsFetched,
    hopSeeds: hopExecuted,
    graph: intent.kind === "person" && !candidateSet?.ambiguous ? graph : undefined,
    candidateSet,
    ring2Executed,
    elapsedMs: Date.now() - startedAt,
    queriesRun: 2 + selectedEnrich.length + hopExecuted.length,
  };

}


// ── Format for LLM context ────────────────────────────────────────────────
const BUCKET_LABELS: Record<DomainBucket, string> = {
  authoritative: "AUTHORITATIVE RECORDS (government / land registry / assessor)",
  corporate: "CORPORATE REGISTRIES (directors, officers, filings)",
  court: "COURT & LEGAL FILINGS",
  people: "PEOPLE DIRECTORIES",
  news: "NEWS & MEDIA",
  social: "SOCIAL & PROFESSIONAL PROFILES",
  web: "WIDE WEB CONTEXT",
};

export function formatIntelContext(bundle: IntelBundle): string {
  // Act 1 outcome: the name resolved to several distinct humans. Return the
  // chooser instead of a dossier — merging them is exactly the failure mode
  // this pipeline exists to prevent.
  if (bundle.candidateSet?.ambiguous) {
    return [
      `## JURISDICTIONAL INTEL SWEEP — PERSON (IDENTIFY PHASE)`,
      `Subject as asked: ${bundle.intent.subject}`,
      `Jurisdiction: ${bundle.jurisdictionLabel}`,
      `Documents parsed: ${bundle.documentsFetched ?? 0} · Unique hits: ${bundle.totalHits}`,
      ``,
      formatCandidateContext(bundle.candidateSet, bundle.intent.subject),
    ].join("\n");
  }

  const {
    intent, buckets, jurisdictionLabel, emptyBuckets, totalHits, registries,
    rejectedIdentityHits, fieldLedger, documentsFetched, hopSeeds, elapsedMs, queriesRun,
    graph, ring2Executed,
  } = bundle;


  const header = [
    `## JURISDICTIONAL INTEL SWEEP — ${intent.kind.toUpperCase()}`,
    `Subject: ${intent.subject}`,
    `Jurisdiction: ${jurisdictionLabel}`,
    `Registries in scope: ${registries.slice(0, 12).join(", ") || "(none jurisdiction-specific — wide-web only)"}`,
    `Total unique hits (post-blocklist, deduped): ${totalHits}`,
    `Full documents opened and parsed: ${documentsFetched ?? 0}`,
    `Queries executed: ${queriesRun ?? "n/a"} · Collection wall clock: ${elapsedMs ? `${(elapsedMs / 1000).toFixed(1)}s` : "n/a"}`,
    `Recursive HOP-1 seeds pursued: ${hopSeeds && hopSeeds.length ? hopSeeds.map((s) => `${s.value} (${s.kind})`).join("; ") : "none"}`,
    `Rejected as identity mismatches: ${rejectedIdentityHits}`,
  ].join("\n");


  const accel = intent.accelerators.length
    ? `\n\n### ACCELERATORS (ask user, do not block)\n${intent.accelerators.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  const NO_PRIORS_RULE = "  • ZERO-PRIOR RULE: you have never heard of this subject. Any name, company, product, founder, handle, lineage or affiliation that appears in your system prompt, platform/product description, saved memory, vault, or earlier conversations is PRODUCT METADATA — not evidence about the person being searched, even when the names match exactly. Never merge it into this dossier and never cite it.";
  const NO_FABRICATED_SWEEP_RULE = "  • Never claim to have queried a database that is not listed in 'Registries in scope' above, and never present a registry name as a completed lookup unless a hit for it appears above.";

  if (totalHits === 0) {
    return [
      header, accel, "",
      "### RESULT: No public records surfaced in queried sources.",
      "Report honestly. Do NOT fabricate. State what was searched, that nothing surfaced, and what lever would unlock the next layer (middle name, DOB range, previous address, employer, known associate).",
      "Distinguish 'no public record found' from 'this person does not exist'.",
      NO_PRIORS_RULE,
      NO_FABRICATED_SWEEP_RULE,
      "  • Emit NO card:entity and NO profile facts on a zero-hit sweep. A subject card with facts you did not retrieve is a fabrication.",
    ].join("\n");
  }



  const ledgerBlock = fieldLedger && fieldLedger.documentsParsed > 0
    ? `\n\n${formatFieldLedger(fieldLedger)}`
    : "";

  const graphBlock = graph && graph.nodes.length > 1 ? `\n\n${formatGraph(graph)}` : "";


  const sections: string[] = [];
  const order: DomainBucket[] = ["authoritative", "corporate", "court", "people", "news", "social", "web"];
  for (const b of order) {
    const hits = buckets[b];
    if (!hits.length) continue;
    const lines = hits.slice(0, 20).map((h, i) => {
      const bodyBlock = h.body ? `\n     BODY EXCERPT: ${h.body.slice(0, 2600)}` : "";
      const identity = intent.kind === "person"
        ? `\n     IDENTITY MATCH: ${h.identityBand?.toUpperCase()} (${h.identityScore}/100) — ${(h.identityReasons || []).join(", ")}`
        : "";
      return `  ${i + 1}. [${h.domain}] ${h.title}\n     URL: ${h.url}\n     SNIPPET: ${h.snippet}${identity}${bodyBlock}`;
    }).join("\n");
    sections.push(`### ${BUCKET_LABELS[b]} (${hits.length} hit${hits.length === 1 ? "" : "s"}, showing ${Math.min(hits.length, 20)})\n${lines}`);

  }

  const coverage = [
    "",
    "### COLLECTION COVERAGE MATRIX (reproduce this table verbatim at the end of your report)",
    "| Channel | Hits | Status |",
    "|---|---|---|",
    ...order.map((b) => {
      const n = buckets[b].length;
      return `| ${BUCKET_LABELS[b]} | ${n} | ${n ? "COLLECTED" : "NO RETURN"} |`;
    }),
    `| Documents opened & parsed | ${documentsFetched ?? 0} | ${(documentsFetched ?? 0) > 0 ? "PARSED" : "NONE"} |`,
    `| Recursive HOP-1 seeds | ${hopSeeds?.length ?? 0} | ${(hopSeeds?.length ?? 0) > 0 ? "PURSUED" : "NOT REACHED"} |`,
    `| Graph ring 1 (direct contacts) | ${graph ? graph.nodes.filter((n) => n.ring === 1).length : 0} | ${graph && graph.nodes.some((n) => n.ring === 1) ? "MAPPED" : "NONE"} |`,
    `| Graph ring 2 (contacts of contacts) | ${graph ? graph.nodes.filter((n) => n.ring === 2).length : 0} | ${(ring2Executed ?? 0) > 0 ? `EXPANDED FROM ${ring2Executed} SEED(S)` : "NOT REACHED"} |`,
    `| Graph ring 3 (intersection only) | ${graph?.crossLinks.length ?? 0} | ${(graph?.crossLinks.length ?? 0) > 0 ? "CLOSED TRIANGLES FOUND" : "NO CONVERGENCE"} |`,
  ].join("\n");


  const emptyNote = emptyBuckets.length
    ? `\n\n### EMPTY BUCKETS: ${emptyBuckets.map((b) => BUCKET_LABELS[b].split(" ")[0]).join(", ")} — name the missing lever that would unlock each.`
    : "";

  return [
    header, accel, "",
    ledgerBlock,
    graphBlock,
    "",
    sections.join("\n\n"),

    emptyNote,
    coverage,
    "",
    "INSTRUCTIONS TO YOU:",
    "  • The RESOLVED FIELD LEDGER above is authoritative and already deduped, normalized and confidence-scored by a deterministic extraction layer. Report EVERY row of the confirmed ledger — every address, every phone, every email, every handle, every entity, every relative. Do not summarize it, do not sample it, do not silently drop low-confidence rows: print them with their computed label.",
    "  • Render the ledger's confidence labels EXACTLY (VERIFIED / CORROBORATED / REPORTED). You may not upgrade or downgrade them; they are computed from independent-domain counts, not from your judgement.",
    "  • The ledger is the SPINE of the report. The bucket hits below it are the supporting evidence you cite and mine for anything the extractor could not type (narrative detail, filing status, dates, job titles).",

    "  • Write an INTELLIGENCE REPORT organized by the bucket headers above.",
    "  • Cite every claim inline as [domain](url).",
    "  • Quote verbatim ONLY from SNIPPET or BODY EXCERPT text — never invent an owner, DOB, address, or case number.",
    "  • When BODY EXCERPT is present, mine it for names, dates, addresses, filing numbers — those beat the snippet.",
    "  • Distinguish 'confirmed' from 'possible match — needs verification'.",
    "  • Never merge records merely because names match. Confirm identity only when two independent domains agree on the name plus one shared locator (city, address, employer, age band, or known associate).",
    "  • A STRONG hit is evidence, not automatic confirmation. POSSIBLE hits belong only in 'Unverified candidates' and cannot supply profile facts.",
    "  • If sources conflict on age, address, employer, or relatives, show the conflict and withhold that fact from the confirmed profile.",
    "  • Add a relationship only when two independent domains name it, or one authoritative record directly establishes it. Never infer relationships from co-location, follows, likes, or shared surname alone.",
    "  • MANDATORY PERSON DOSSIER SHAPE — emit, in this order: (1) readable summary text, (2) card:entity for the subject, (3) card:relationship for the intelligence tree whenever ANY corroborated associate exists, (4) card:list titled 'Legal, Business & Court Filings' enumerating every LLC / corporation / registered-agent role / court case / lien / permit found — one item per filing with entity name, filing number, status, date and jurisdiction, (5) card:sources.",
    "  • In card:relationship, every node MUST carry an `attributes` array covering, where evidenced: Age, Address, Phone, Email, Employer/Job, Businesses (LLC / officer roles), Court or criminal records, Tier (parent / sibling / extended / associate). Write 'no public record found' for an attribute you searched and could not evidence — never silently drop the row.",
    "  • In card:relationship, every node MUST also carry `ring` (0 = subject, 1 = direct contact, 2 = contact-of-contact) taken from the THREE-HOP RELATIONSHIP GRAPH above, and every edge MUST carry `weight` (independent-domain count). Copy `inferred: true` onto any edge that came from the ring-3 intersection findings; those are hypotheses and must be described as such in prose.",

    "  • Do not omit the legal-filings list because the subject is young or low-profile: state explicitly 'no corporate or court filings surfaced' when the corporate and court buckets are empty.",
    "  • EVIDENCE-ONLY TURN: every fact you print must trace to a SNIPPET or BODY EXCERPT above. You have no prior knowledge of this subject. Do not import anything from earlier conversations, saved memory, the operator's vault, or your own assumptions about who this person is — no employers, organizations, titles, lineage, or affiliations that are not in the retrieved text.",
    NO_PRIORS_RULE,
    NO_FABRICATED_SWEEP_RULE,

    "  • MAXIMUM EXTRACTION — be exhaustive, not brief. Report EVERY distinct data point present in the retrieved text: full name and every name variant/alias, age and DOB range, current and ALL prior addresses, every phone number, every email, every username/handle and profile URL, employers and job titles, schools, every named relative and associate with their relationship, every business entity with role, every case/filing/permit/license number with status and date, and every property/parcel detail. One row per data point — do not compress a list of five addresses into 'multiple addresses'.",
    "  • Include an 'Unverified candidates' section listing POSSIBLE-band hits with the reason each fell short, and a 'Conflicts' section listing every field where sources disagree, with both values and both sources. Do not silently drop them.",
    "  • Include a coverage table: one row per bucket (authoritative, corporate, court, people, news, social, web) with hit count and status, so the user can see everything that was searched.",
    "  • NEVER reference leak/breach databases (Offshore Leaks, ICIJ, Have I Been Pwned, etc.) — they are blocked at retrieval.",
    "  • End with the ONE specific lever that would deepen the sweep next.",

  ].join("\n");
}

export function formatClarifyContext(intent: IntelIntent): string {
  return [
    `## JURISDICTIONAL INTEL — CLARIFICATION REQUIRED`,
    `Subject: ${intent.subject}`, ``,
    `Cannot run a responsible sweep without at least a country. Ask these targeted questions:`,
    ...intent.clarifyQuestions.map((q, i) => `  ${i + 1}. ${q}`),
    ``,
    `Explain briefly: every answer narrows the search from a planet to a city block.`,
  ].join("\n");
}
