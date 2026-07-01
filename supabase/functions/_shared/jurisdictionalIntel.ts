// jurisdictionalIntel.ts — jurisdiction-aware person/property search brain.
//
// Narrative: when a user says "search asher newton" the engine should NOT blindly
// throw the name at a search engine. It should:
//   1. Classify subject (person vs property vs entity).
//   2. Extract location tokens (country → state → county → city).
//   3. If location is missing/thin, return a CLARIFY packet so the LLM asks the
//      user targeted questions (which state? which county/city? approx age?).
//   4. If location is present, resolve authoritative registries for that
//      jurisdiction (per jurisdictions.ts) and run site-scoped searches on
//      those domains PLUS universal listings/OSINT as secondary channel.
//   5. Return organized results grouped by channel (ownership/records, tax,
//      permits, listings, people-search, news) with citations.
//
// This is used by BOTH aureon chat and asher chat. Zophiel-search is the
// retrieval engine; jurisdictions.ts supplies the domain lists.

import { sourcesFor, siteFilter, parseJurisdiction } from "./jurisdictions.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// ── People-search / OSINT universal channels (used for PERSON queries) ─────
const PEOPLE_SITES = [
  "truepeoplesearch.com", "spokeo.com", "beenverified.com", "whitepages.com",
  "fastpeoplesearch.com", "radaris.com", "thatsthem.com", "peoplefinders.com",
  "linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com",
  "voterrecords.com", "usphonebook.com",
];

const NEWS_SITES = [
  "google.com/news", "news.google.com", "reuters.com", "apnews.com",
  "local10.com", "wesh.com", "wftv.com", "clickorlando.com",
  "nbc-2.com", "winknews.com", "wftx.com", "news-press.com",
];

// ── Types ──────────────────────────────────────────────────────────────────
export type IntelKind = "person" | "property" | "entity" | "none";

export interface IntelIntent {
  kind: IntelKind;
  subject: string;             // e.g. "Asher Newton" or "123 Main St"
  country: string;             // "US"
  state: string;               // "FL"
  county: string;              // "LEE" (upper, no "County")
  city: string;                // "Cape Coral"
  needsClarification: boolean; // true when subject is too vague to search well
  clarifyQuestions: string[];  // targeted questions to ask user
}

export interface IntelChannelHit {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface IntelBundle {
  intent: IntelIntent;
  channels: Record<string, IntelChannelHit[]>; // ownership | tax | permits | listings | people | news
  registries: string[];        // domains actually queried
  jurisdictionLabel: string;   // human-readable: "Lee County, Florida, US"
}

// ── Intent detection ───────────────────────────────────────────────────────
const SEARCH_TRIGGERS = /\b(search|find|look ?up|research|dig ?up|osint|background(?: check)?|dossier|profile|who is|locate|track down|pull records? on|scan for)\b/i;
const PROPERTY_HINTS = /\b(address|street|st\.?|ave\.?|avenue|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|parcel|property|house|home|lot|apt|apartment|unit|zip|zipcode|zip code|owner of|deed|acreage)\b/i;
const PROPERTY_STRICT = /\b\d{1,6}\s+[A-Z][a-zA-Z0-9\.\-']+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Cir|Circle|Hwy|Highway|Pkwy|Parkway)\b/i;
const ENTITY_HINTS = /\b(llc|inc\.?|corp\.?|corporation|company|co\.?|ltd\.?|holdings|group|trust|foundation)\b/i;

// US state map (name → 2-letter code + a few common abbreviations)
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

// Well-known city → county hints for FL (extendable per jurisdiction).
const CITY_TO_COUNTY: Record<string, { state: string; county: string }> = {
  "cape coral":     { state: "FL", county: "LEE" },
  "fort myers":     { state: "FL", county: "LEE" },
  "naples":         { state: "FL", county: "COLLIER" },
  "miami":          { state: "FL", county: "MIAMI-DADE" },
  "miami beach":    { state: "FL", county: "MIAMI-DADE" },
  "fort lauderdale":{ state: "FL", county: "BROWARD" },
  "hollywood":      { state: "FL", county: "BROWARD" },
  "west palm beach":{ state: "FL", county: "PALM BEACH" },
  "orlando":        { state: "FL", county: "ORANGE" },
  "tampa":          { state: "FL", county: "HILLSBOROUGH" },
  "st petersburg":  { state: "FL", county: "PINELLAS" },
  "st. petersburg": { state: "FL", county: "PINELLAS" },
  "jacksonville":   { state: "FL", county: "DUVAL" },
  "punta gorda":    { state: "FL", county: "CHARLOTTE" },
  "sarasota":       { state: "FL", county: "SARASOTA" },
  // TX
  "houston":        { state: "TX", county: "HARRIS" },
  "dallas":         { state: "TX", county: "DALLAS" },
  "fort worth":     { state: "TX", county: "TARRANT" },
  "san antonio":    { state: "TX", county: "BEXAR" },
  "austin":         { state: "TX", county: "TRAVIS" },
  // CA
  "los angeles":    { state: "CA", county: "LOS ANGELES" },
  "san diego":      { state: "CA", county: "SAN DIEGO" },
  "san jose":       { state: "CA", county: "SANTA CLARA" },
  "oakland":        { state: "CA", county: "ALAMEDA" },
  // NY / IL
  "new york":       { state: "NY", county: "NEW YORK" },
  "brooklyn":       { state: "NY", county: "KINGS" },
  "queens":         { state: "NY", county: "QUEENS" },
  "chicago":        { state: "IL", county: "COOK" },
};

// Extract "in <place>" or trailing ", <place>" from the tail of the query.
function extractLocationTail(raw: string): { subject: string; locus: string } {
  const t = raw.trim();
  // "search X in Y"  → subject=X, locus=Y
  const inMatch = t.match(/^(.*?)\s+in\s+(.+?)[\.\?!]?$/i);
  if (inMatch) return { subject: inMatch[1].trim(), locus: inMatch[2].trim() };
  // "search X, Y, Z"
  const commaIdx = t.indexOf(",");
  if (commaIdx > 0 && commaIdx < t.length - 2) {
    return { subject: t.slice(0, commaIdx).trim(), locus: t.slice(commaIdx + 1).trim() };
  }
  return { subject: t, locus: "" };
}

function stripTrigger(raw: string): string {
  return raw.replace(/^\s*(please\s+)?(can you\s+)?(search|find|look ?up|research|dig ?up|pull records? on|scan for|locate|track down|who is|osint on|background(?: check)? on|dossier on|profile of)\s+(for\s+)?/i, "").trim();
}

// Parse locus string like "Cape Coral Florida" or "Lee County, FL" or "London, UK"
function parseLocus(locus: string): { country: string; state: string; county: string; city: string } {
  const low = locus.toLowerCase();
  let country = "";
  let state = "";
  let county = "";
  let city = "";

  // Country hints
  if (/\b(usa|u\.s\.a\.|u\.s\.|united states|america)\b/.test(low)) country = "US";
  else if (/\b(canada|canadian)\b/.test(low)) country = "CA";
  else if (/\b(uk|united kingdom|england|scotland|wales|britain)\b/.test(low)) country = "GB";
  else if (/\b(australia|australian)\b/.test(low)) country = "AU";
  else if (/\bmexico\b/.test(low)) country = "MX";
  else if (/\bgermany|deutschland\b/.test(low)) country = "DE";
  else if (/\bfrance\b/.test(low)) country = "FR";

  // US state name or code
  for (const [name, code] of Object.entries(US_STATES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(locus)) { state = code; if (!country) country = "US"; break; }
  }
  if (!state) {
    const stCode = locus.match(/\b([A-Z]{2})\b/);
    if (stCode && Object.values(US_STATES).includes(stCode[1])) { state = stCode[1]; if (!country) country = "US"; }
  }

  // County explicit
  const co = locus.match(/([A-Za-z\-\.\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  // City lookup (also fills county from CITY_TO_COUNTY)
  for (const [cityName, meta] of Object.entries(CITY_TO_COUNTY)) {
    if (new RegExp(`\\b${cityName.replace(/\./g, "\\.")}\\b`, "i").test(low)) {
      city = cityName.replace(/\b\w/g, (c) => c.toUpperCase());
      if (!state) state = meta.state;
      if (!county) county = meta.county;
      if (!country) country = "US";
      break;
    }
  }
  return { country, state, county, city };
}

/** Classify a user message and extract subject + jurisdiction. */
export function classifyIntent(rawUserMessage: string): IntelIntent {
  const raw = String(rawUserMessage || "").trim();
  const empty: IntelIntent = {
    kind: "none", subject: "", country: "", state: "", county: "", city: "",
    needsClarification: false, clarifyQuestions: [],
  };
  if (!raw) return empty;

  const isTrigger = SEARCH_TRIGGERS.test(raw);
  const looksProperty = PROPERTY_STRICT.test(raw) || PROPERTY_HINTS.test(raw);
  const looksEntity = ENTITY_HINTS.test(raw);
  if (!isTrigger && !looksProperty) return empty; // not an intel query

  const stripped = stripTrigger(raw);
  const { subject: rawSubject, locus } = extractLocationTail(stripped);
  const loc = locus ? parseLocus(locus) : parseJurisdiction(raw);

  // Also scan the whole message for city/state if tail parse missed them.
  const fullLoc = parseLocus(raw);
  const country = loc.country || fullLoc.country;
  const state = loc.state || fullLoc.state;
  const county = loc.county || fullLoc.county;
  const city = loc.city || fullLoc.city;

  const kind: IntelKind = looksProperty ? "property" : looksEntity ? "entity" : "person";
  const subject = rawSubject || stripped || raw;

  // Clarification logic — subject is a bare person name with no location.
  const isBareName = kind === "person" && !country && !state && !county && !city
    && /^[A-Z][a-z]+(?:\s+[A-Z][a-z\-']+){0,3}$/.test(subject);

  const clarifyQuestions: string[] = [];
  if (isBareName) {
    clarifyQuestions.push(
      `Which state or country is ${subject} located in?`,
      `Any city, county, or approximate age to narrow it down?`,
      `Any known middle name, employer, or associates?`,
    );
  } else if (kind === "property" && !state && !city) {
    clarifyQuestions.push(
      `Which city and state (or country) is this property in?`,
      `Do you have a ZIP/postal code or county name?`,
    );
  }

  return {
    kind, subject, country, state, county, city,
    needsClarification: clarifyQuestions.length > 0,
    clarifyQuestions,
  };
}

// ── Zophiel internal call ──────────────────────────────────────────────────
async function zophielQuery(query: string, siteRestrictor: string): Promise<IntelChannelHit[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return [];
  try {
    const fullQuery = siteRestrictor ? `${query} ${siteRestrictor}` : query;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "apikey": SUPABASE_ANON,
      },
      body: JSON.stringify({ query: fullQuery, page: 1, mode: "web" }),
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const raw = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.hits) ? data.hits : []);
    return raw.slice(0, 8).map((r: any) => ({
      title: String(r.title || r.name || ""),
      url: String(r.url || r.link || ""),
      snippet: String(r.snippet || r.description || r.summary || "").slice(0, 400),
      domain: (() => { try { return new URL(String(r.url || r.link || "")).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
    })).filter((h: IntelChannelHit) => h.url);
  } catch (e) {
    console.error("[jurisdictionalIntel] zophiel query failed:", (e as Error).message);
    return [];
  }
}

/** Run the jurisdiction-aware sweep. Returns per-channel result bundle. */
export async function runJurisdictionalSearch(intent: IntelIntent): Promise<IntelBundle> {
  const src = sourcesFor(intent.country, intent.state, intent.county);
  const registries = Array.from(new Set([...src.ownership, ...src.tax, ...src.permits]));

  const jurisdictionLabel = [
    intent.city, intent.county ? `${intent.county} County` : "", intent.state, intent.country,
  ].filter(Boolean).join(", ");

  const channels: Record<string, IntelChannelHit[]> = {};
  const subj = `"${intent.subject}"`;
  const locusStr = [intent.city, intent.county, intent.state].filter(Boolean).join(" ");

  if (intent.kind === "property") {
    // Registry sweep (ownership/tax/permits) — site-scoped to authoritative domains.
    const [ownership, tax, permits, listings] = await Promise.all([
      src.ownership.length ? zophielQuery(`${subj} ${locusStr} owner deed`, siteFilter(src.ownership)) : Promise.resolve([]),
      src.tax.length       ? zophielQuery(`${subj} ${locusStr} assessed value tax`, siteFilter(src.tax)) : Promise.resolve([]),
      src.permits.length   ? zophielQuery(`${subj} ${locusStr} permit inspection`, siteFilter(src.permits)) : Promise.resolve([]),
      src.listings.length  ? zophielQuery(`${subj} ${locusStr}`, siteFilter(src.listings)) : Promise.resolve([]),
    ]);
    channels.ownership = ownership;
    channels.tax = tax;
    channels.permits = permits;
    channels.listings = listings;
  } else if (intent.kind === "entity") {
    const [ownership, listings] = await Promise.all([
      src.ownership.length ? zophielQuery(`${subj} ${locusStr}`, siteFilter(src.ownership)) : Promise.resolve([]),
      zophielQuery(`${subj} ${locusStr}`, ""), // free-form
    ]);
    channels.ownership = ownership;
    channels.web = listings;
  } else {
    // PERSON — people-search sites + local news + local registries where names appear.
    const [people, news, registryHits, listings] = await Promise.all([
      zophielQuery(`${subj} ${locusStr}`, siteFilter(PEOPLE_SITES)),
      zophielQuery(`${subj} ${locusStr}`, siteFilter(NEWS_SITES)),
      registries.length ? zophielQuery(`${subj} ${locusStr}`, siteFilter(registries)) : Promise.resolve([]),
      zophielQuery(`${subj} ${locusStr} property owner`, siteFilter(src.listings)),
    ]);
    channels.people = people;
    channels.news = news;
    channels.records = registryHits;
    channels.listings = listings;
  }

  return { intent, channels, registries, jurisdictionLabel };
}

/** Build the system-prompt injection the LLM will consume. */
export function formatIntelContext(bundle: IntelBundle): string {
  const { intent, channels, jurisdictionLabel } = bundle;
  const anyHits = Object.values(channels).some((arr) => arr.length > 0);
  const header = `## JURISDICTIONAL INTEL SWEEP — ${intent.kind.toUpperCase()}\nSubject: ${intent.subject}\nJurisdiction: ${jurisdictionLabel || "unspecified"}\nRegistries queried: ${bundle.registries.slice(0, 8).join(", ") || "(none for this jurisdiction)"}\n`;

  if (!anyHits) {
    return `${header}\nNo authoritative records surfaced. Instruct the user with concrete follow-up questions (state, county, city, ZIP, approx age, known associates) so the sweep can be re-run with tighter jurisdiction.`;
  }

  const sections: string[] = [];
  for (const [channel, hits] of Object.entries(channels)) {
    if (!hits.length) continue;
    const lines = hits.slice(0, 8).map((h, i) => `  ${i + 1}. [${h.domain}] ${h.title}\n     ${h.url}\n     ${h.snippet}`).join("\n");
    sections.push(`### ${channel.toUpperCase()}\n${lines}`);
  }

  return `${header}\n${sections.join("\n\n")}\n\nINSTRUCTIONS: Organize findings by channel. Cite every claim as [domain](url). If a channel is thin, tell the user what jurisdiction detail would tighten it (e.g., county, ZIP, middle name). Never fabricate an owner name, deed date, or price — quote only what appears in a snippet.`;
}

/** Build the clarify-only prompt when the subject is too vague. */
export function formatClarifyContext(intent: IntelIntent): string {
  return `## JURISDICTIONAL INTEL — CLARIFICATION REQUIRED\nSubject: ${intent.subject}\nKind: ${intent.kind}\n\nThe subject is too vague to run a jurisdictional sweep. ASK THE USER these targeted questions before searching:\n${intent.clarifyQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nDo NOT guess. Do NOT run a generic web search. Ask, then wait for the user to reply.`;
}
