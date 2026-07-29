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
  /** Per-channel retrieval outcome — lets the model know what actually ran. */
  channels?: { label: string; ok: boolean; hits: number; reason?: string }[];
  /** Hits discarded because they never mentioned the subject. */
  droppedOffSubject?: number;
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

function titleCaseForName(s: string): string {
  return s.replace(/\b([a-z])([a-z'’\-]*)/gi, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}

function matchName(s: string): string {
  const direct = s.match(NAME_RE);
  if (direct) return direct[0];
  const tc = titleCaseForName(s).match(NAME_RE);
  return tc ? tc[0] : "";
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

  // County explicit
  const co = t.match(/([A-Za-z\-\.\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  return { country, state, county, city };
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

  const nameMatch = matchName(s);
  if (nameMatch) return nameMatch;
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
export interface ChannelOutcome {
  label: string;
  ok: boolean;
  hits: number;
  reason?: string;
}

async function zophielQuery(
  query: string,
  options: { timeoutMs?: number; limit?: number } = {},
): Promise<{ hits: IntelChannelHit[]; ok: boolean; reason?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return { hits: [], ok: false, reason: "missing supabase env" };
  // Measured live P50 for zophiel-search is ~10.3s. Any per-call budget below
  // ~12s aborts the call before it can ever answer, which silently starved the
  // registry channels and left only wide-web noise for the model to reason on.
  const timeoutMs = Math.max(6000, Math.min(options.timeoutMs ?? 20000, 24000));
  const limit = options.limit ?? 12;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "apikey": SUPABASE_ANON,
      },
      body: JSON.stringify({ query, page: 1, mode: "web" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return { hits: [], ok: false, reason: `http_${resp.status}` };
    const data = await resp.json();
    let raw: any[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.hits) ? data.hits : []);
    // Fallback: flatten `grouped` (category → results[]) if `results` empty.
    if (raw.length === 0 && data?.grouped && typeof data.grouped === "object") {
      raw = Object.values(data.grouped).flat() as any[];
    }
    const hits = raw.slice(0, limit).map((r: any) => {
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
    return { hits, ok: true };
  } catch (e) {
    const reason = (e as Error).message || "unknown";
    console.error("[jurisdictionalIntel] zophiel query failed:", reason);
    return { hits: [], ok: false, reason };
  }
}

// ── Subject-relevance gate ────────────────────────────────────────────────
// Retrieval used to accept ANY hit the engine returned. For a person sweep
// that means an unrelated journal article about the city can be bucketed and
// then narrated as if it described the subject. A hit now has to actually
// mention a distinctive subject token to survive in the non-registry buckets.
function subjectTokens(subject: string): string[] {
  return subject
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .filter((t) => t.length >= 3);
}

function mentionsSubject(hit: IntelChannelHit, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const hay = `${hit.title} ${hit.snippet} ${hit.url}`.toLowerCase();
  const matched = tokens.filter((t) => hay.includes(t)).length;
  // Single-token subjects need that token; multi-token names need at least the
  // rarest half (surname-bearing) so "John" alone cannot pull a stranger in.
  return matched >= Math.max(1, Math.ceil(tokens.length / 2));
}


// ── Domain classifier ──────────────────────────────────────────────────────
function classifyDomain(domain: string): DomainBucket {
  const d = domain.toLowerCase();
  // Government / authoritative records
  if (/\.gov\b|\.gov\.|\.us\b|leepa\.org|floridaparcels\.com|sunbiz\.org|bcpa\.net|hcad\.org|acris\.nyc\.gov|nswlrs\.com\.au|landregistry\.data\.gov\.uk|companies-house|company-information\.service\.gov\.uk/.test(d)) return "authoritative";
  if (/opencorporates\.com|sec\.gov|efts\.sec\.gov|linkedin\.com\/company|asic\.gov\.au|corporationscanada|handelsregister\.de|infogreffe\.fr/.test(d)) return "corporate";
  if (/pacer\.gov|courtlistener\.com|justia\.com|austlii|myflcourtaccess/.test(d)) return "court";
  if (/truepeoplesearch|whitepages|spokeo|beenverified|fastpeoplesearch|radaris|thatsthem|voterrecords|usphonebook|canada411|192\.com/.test(d)) return "people";
  if (/news\.google\.com|reuters\.com|apnews\.com|bbc\.com|nytimes\.com|washingtonpost\.com|news-press\.com|winknews\.com|nbc-2\.com/.test(d)) return "news";
  if (/facebook\.com|instagram\.com|x\.com|twitter\.com|linkedin\.com|tiktok\.com|youtube\.com|pinterest\.com/.test(d)) return "social";
  return "web";
}

// ── Body fetch (optional deep pass) ────────────────────────────────────────
async function fetchBody(url: string, timeoutMs = 4500): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AureonIntel/2.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!resp.ok) return "";
    const ct = resp.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/.test(ct)) return "";
    const html = await resp.text();
    // Strip scripts/styles, then collapse HTML tags to spaces.
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, 3500);
  } catch {
    return "";
  }
}

function scoreEnrichQuery(intent: IntelIntent, label: string): number {
  if (intent.kind === "person") {
    if (label === "people") return 100;
    if (label === "entities") return 85;
    if (label === "news") return 70;
    if (label === "courts") return intent.state || intent.city ? 65 : 35;
    if (label === "ownership" || label === "tax" || label === "permits") return intent.state || intent.city ? 45 : 15;
  }
  if (intent.kind === "entity") {
    if (label === "entities") return 100;
    if (label === "courts") return 75;
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
  // Tightened from 24.5s → 20s so the sweep leaves comfortable headroom
  // inside the 150s /chat budget even when zophiel-search runs slow.
  const deadlineMs = 44000;
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
  const narrowLocus = [intent.city, intent.county, intent.state].filter(Boolean).join(" ");
  const countryLabel = intent.country ? (COUNTRY_LABELS[intent.country] || intent.country) : "";
  const locus = narrowLocus || countryLabel;


  // ── PASS 1 — WEB-TAB PARITY ─────────────────────────────────────────────
  // Unquoted, no site: restrictor. This is exactly what the Zophiel web tab runs.
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
    if (src.people.length) enrichQueries.push({ label: "people", query: `${subjectQuoted} ${locus} ${siteFilter(src.people)}` });
    enrichQueries.push({ label: "news", query: `${subjectQuoted} ${locus} ${siteFilter(NEWS_SITES)}` });
  }

  const countryOnlyPerson = intent.kind === "person" && Boolean(intent.country) && !intent.state && !intent.city && !intent.county;
  const maxEnrich = countryOnlyPerson ? 2 : 4;
  const selectedEnrich = enrichQueries
    .sort((a, b) => scoreEnrichQuery(intent, b.label) - scoreEnrichQuery(intent, a.label))
    .slice(0, maxEnrich);

  // ONE fan-out for every channel. Measured live: a wide query answers in ~7-10s
  // and a site-scoped registry query in ~16s. Run sequentially those costs stack
  // past the budget and the registry channels always aborted — which is exactly
  // why sweeps degraded to wide-web noise. Fanned out, wall clock is the single
  // slowest call, so every channel gets a survivable 30s.
  const channelBudget = 30000;
  const channels: ChannelOutcome[] = [];
  const plan: { label: string; query: string; limit: number }[] = [
    { label: "wide-web", query: pass1Queries[0], limit: 20 },
    ...(pass1Queries[1] !== pass1Queries[0]
      ? [{ label: "wide-web-exact", query: pass1Queries[1], limit: 12 }]
      : []),
    ...selectedEnrich.map((q) => ({ label: q.label, query: q.query, limit: 10 })),
  ];
  const runs = await Promise.all(
    plan.map(async (p) => ({ label: p.label, ...(await zophielQuery(p.query, { timeoutMs: channelBudget, limit: p.limit })) })),
  );
  for (const r of runs) channels.push({ label: r.label, ok: r.ok, hits: r.hits.length, reason: r.reason });


  // ── FUSE — dedupe by URL, block-check every hit, classify into buckets ──
  const seen = new Set<string>();
  const buckets: Record<DomainBucket, IntelChannelHit[]> = {
    authoritative: [], corporate: [], court: [], people: [], news: [], social: [], web: [],
  };
  const tokens = subjectTokens(subject);
  let droppedOffSubject = 0;
  const all: IntelChannelHit[] = [...r1a.hits, ...r1b.hits, ...pass2Results.flatMap((r) => r.hits)];
  for (const hit of all) {
    if (!hit.url || seen.has(hit.url)) continue;
    if (isBlockedSource(hit.domain) || isBlockedSource(hit.url)) continue;
    seen.add(hit.url);
    const bucket = classifyDomain(hit.domain);
    // Registry/court/corporate hits are site-scoped by construction, so they
    // stay. Everything else must actually name the subject.
    const exempt = bucket === "authoritative" || bucket === "corporate" || bucket === "court";
    if (!exempt && !mentionsSubject(hit, tokens)) { droppedOffSubject++; continue; }
    hit.bucket = bucket;
    buckets[bucket].push(hit);
  }

  // ── PASS 3 — BODY FETCH top URLs (opportunistic; do not stall answer) ──
  const priority: DomainBucket[] = ["authoritative", "corporate", "court", "people", "news", "social", "web"];
  const fetchTargets: IntelChannelHit[] = [];
  const remainingForBodies = deadlineMs - (Date.now() - startedAt);
  const bodyLimit = remainingForBodies > 6500 ? 4 : remainingForBodies > 4200 ? 2 : 0;
  for (const b of priority) {
    for (const h of buckets[b]) {
      if (fetchTargets.length >= bodyLimit) break;
      fetchTargets.push(h);
    }
    if (fetchTargets.length >= bodyLimit) break;
  }
  await Promise.all(fetchTargets.map(async (h) => {
    h.body = await fetchBody(h.url, Math.max(2200, Math.min(4500, deadlineMs - (Date.now() - startedAt) - 500)));
  }));

  const emptyBuckets = (Object.keys(buckets) as DomainBucket[]).filter((k) => buckets[k].length === 0);
  const totalHits = Object.values(buckets).reduce((a, b) => a + b.length, 0);

  return { intent, buckets, registries, jurisdictionLabel, emptyBuckets, totalHits, channels, droppedOffSubject };
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
  const { intent, buckets, jurisdictionLabel, emptyBuckets, totalHits, registries, channels, droppedOffSubject } = bundle;

  // Retrieval integrity is stated explicitly. Previously a sweep in which every
  // registry channel had timed out looked identical to a clean sweep, so the
  // model narrated wide-web noise with full confidence.
  const failed = (channels ?? []).filter((c) => !c.ok);
  const integrity = channels?.length
    ? [
        `Channels run: ${channels.length} — succeeded ${channels.length - failed.length}, failed ${failed.length}`,
        failed.length ? `FAILED CHANNELS: ${failed.map((c) => `${c.label} (${c.reason ?? "error"})`).join(", ")} — treat these record classes as NOT SEARCHED, not as "nothing found".` : "",
        droppedOffSubject ? `Off-subject hits discarded by the relevance gate: ${droppedOffSubject}` : "",
      ].filter(Boolean).join("\n")
    : "";

  const header = [
    `## JURISDICTIONAL INTEL SWEEP — ${intent.kind.toUpperCase()}`,
    `Subject: ${intent.subject}`,
    `Jurisdiction: ${jurisdictionLabel}`,
    `Registries in scope: ${registries.slice(0, 12).join(", ") || "(none jurisdiction-specific — wide-web only)"}`,
    `Total unique hits (post-blocklist, post-relevance, deduped): ${totalHits}`,
    integrity,
  ].filter(Boolean).join("\n");

  const accel = intent.accelerators.length
    ? `\n\n### ACCELERATORS (ask user, do not block)\n${intent.accelerators.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  if (totalHits === 0) {
    return [
      header, accel, "",
      "### RESULT: No public records surfaced in queried sources.",
      "Report honestly. Do NOT fabricate. State what was searched, that nothing surfaced, and what lever would unlock the next layer (middle name, DOB range, previous address, employer, known associate).",
      "Distinguish 'no public record found' from 'this person does not exist'.",
    ].join("\n");
  }


  const sections: string[] = [];
  const order: DomainBucket[] = ["authoritative", "corporate", "court", "people", "news", "social", "web"];
  for (const b of order) {
    const hits = buckets[b];
    if (!hits.length) continue;
    const lines = hits.slice(0, 8).map((h, i) => {
      const bodyBlock = h.body ? `\n     BODY EXCERPT: ${h.body.slice(0, 900)}` : "";
      return `  ${i + 1}. [${h.domain}] ${h.title}\n     URL: ${h.url}\n     SNIPPET: ${h.snippet}${bodyBlock}`;
    }).join("\n");
    sections.push(`### ${BUCKET_LABELS[b]}\n${lines}`);
  }

  const emptyNote = emptyBuckets.length
    ? `\n\n### EMPTY BUCKETS: ${emptyBuckets.map((b) => BUCKET_LABELS[b].split(" ")[0]).join(", ")} — name the missing lever that would unlock each.`
    : "";

  return [
    header, accel, "",
    sections.join("\n\n"),
    emptyNote,
    "",
    "INSTRUCTIONS TO YOU:",
    "  • Write an INTELLIGENCE REPORT organized by the bucket headers above.",
    "  • Cite every claim inline as [domain](url).",
    "  • Quote verbatim ONLY from SNIPPET or BODY EXCERPT text — never invent an owner, DOB, address, or case number.",
    "  • When BODY EXCERPT is present, mine it for names, dates, addresses, filing numbers — those beat the snippet.",
    "  • Distinguish 'confirmed' from 'possible match — needs verification'.",
    "  • A source counts as being ABOUT the subject only if the subject's name appears in its SNIPPET or BODY EXCERPT. A hit that merely shares the city or topic is CONTEXT, never identity — label it as such.",
    "  • If FAILED CHANNELS are listed above, say plainly which record classes were not reachable this run. Never present a degraded sweep as complete.",
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
