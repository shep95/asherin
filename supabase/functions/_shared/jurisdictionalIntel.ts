// jurisdictionalIntel.ts — SOVEREIGN INTELLIGENCE BRAIN
//
// Narrative contract (Aureon + Asher chat):
//   • Bare name, no jurisdiction  → CLARIFY. Do not search. Ask targeted intake
//     questions (country, state/province, city, age, associates, context).
//   • Name + country only         → run NATIONAL sweep (country-level registries
//     + universal people/entity aggregators) AND ask for state/province in the
//     same breath — it is an accelerator, not a wall.
//   • Name + country + state      → drill into state/provincial registries.
//   • Name + country + state + county/city → hit the ground-level authoritative
//     record (Lee County appraiser, ACRIS, NSWLRS, ONLAND, Companies House…)
//     and expand outward only if that source is thin.
//   • Property queries follow the same cascade but skip the intake if the
//     address itself carries jurisdiction.
//   • NEVER touch breach/leak databases. NEVER fabricate a table of registries
//     the engine did not query. Empty is honest — report exactly what came back
//     and what lever would unlock the next layer.
//
// Zophiel is the retrieval engine; jurisdictions.ts is the source atlas.

import { sourcesFor, siteFilter, parseJurisdiction } from "./jurisdictions.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// News aggregators — used as a secondary channel for PERSON queries only.
const NEWS_SITES = [
  "news.google.com", "reuters.com", "apnews.com", "bbc.com/news",
];

// ── Types ──────────────────────────────────────────────────────────────────
export type IntelKind = "person" | "property" | "entity" | "none";

export interface IntelIntent {
  kind: IntelKind;
  subject: string;
  country: string;
  state: string;
  county: string;
  city: string;
  needsClarification: boolean; // BLOCK-level clarify (no country at all)
  clarifyQuestions: string[];
  accelerators: string[];      // non-blocking follow-ups (e.g. "which state?")
}

export interface IntelChannelHit {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface IntelBundle {
  intent: IntelIntent;
  channels: Record<string, IntelChannelHit[]>;
  registries: string[];
  jurisdictionLabel: string;
  emptyChannels: string[];
}

// ── Intent detection ───────────────────────────────────────────────────────
const SEARCH_TRIGGERS = /\b(search|find|look ?up|research|dig ?up|osint|background(?: check)?|dossier|profile|who is|locate|track down|pull records? on|scan for)\b/i;
const PROPERTY_HINTS = /\b(address|street|st\.?|ave\.?|avenue|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|parcel|property|house|home|lot|apt|apartment|unit|zip|zipcode|zip code|owner of|deed|acreage)\b/i;
const PROPERTY_STRICT = /\b\d{1,6}\s+[A-Z][a-zA-Z0-9\.\-']+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Ter|Terrace|Cir|Circle|Hwy|Highway|Pkwy|Parkway)\b/i;
const ENTITY_HINTS = /\b(llc|inc\.?|corp\.?|corporation|company|co\.?|ltd\.?|holdings|group|trust|foundation|pty|gmbh|s\.?a\.?)\b/i;

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
  "new south wales": "NSW", nsw: "NSW",
  "victoria": "VIC", vic: "VIC",
  "queensland": "QLD", qld: "QLD",
  "western australia": "WA", wa: "WA",
  "south australia": "SA", sa: "SA",
  "tasmania": "TAS", tas: "TAS",
  "australian capital territory": "ACT", act: "ACT",
  "northern territory": "NT", nt: "NT",
};

const CA_PROVINCES: Record<string, string> = {
  ontario: "ON", "british columbia": "BC", alberta: "AB", quebec: "QC",
  saskatchewan: "SK", manitoba: "MB", "nova scotia": "NS", "new brunswick": "NB",
  "prince edward island": "PE", "newfoundland": "NL", "newfoundland and labrador": "NL",
};

const CITY_TO_COUNTY: Record<string, { country: string; state: string; county: string }> = {
  // FL
  "cape coral":     { country: "US", state: "FL", county: "LEE" },
  "fort myers":     { country: "US", state: "FL", county: "LEE" },
  "naples":         { country: "US", state: "FL", county: "COLLIER" },
  "miami":          { country: "US", state: "FL", county: "MIAMI-DADE" },
  "miami beach":    { country: "US", state: "FL", county: "MIAMI-DADE" },
  "fort lauderdale":{ country: "US", state: "FL", county: "BROWARD" },
  "hollywood":      { country: "US", state: "FL", county: "BROWARD" },
  "west palm beach":{ country: "US", state: "FL", county: "PALM BEACH" },
  "orlando":        { country: "US", state: "FL", county: "ORANGE" },
  "tampa":          { country: "US", state: "FL", county: "HILLSBOROUGH" },
  "st petersburg":  { country: "US", state: "FL", county: "PINELLAS" },
  "st. petersburg": { country: "US", state: "FL", county: "PINELLAS" },
  "jacksonville":   { country: "US", state: "FL", county: "DUVAL" },
  "punta gorda":    { country: "US", state: "FL", county: "CHARLOTTE" },
  "sarasota":       { country: "US", state: "FL", county: "SARASOTA" },
  // TX
  "houston":        { country: "US", state: "TX", county: "HARRIS" },
  "dallas":         { country: "US", state: "TX", county: "DALLAS" },
  "fort worth":     { country: "US", state: "TX", county: "TARRANT" },
  "san antonio":    { country: "US", state: "TX", county: "BEXAR" },
  "austin":         { country: "US", state: "TX", county: "TRAVIS" },
  // CA
  "los angeles":    { country: "US", state: "CA", county: "LOS ANGELES" },
  "san diego":      { country: "US", state: "CA", county: "SAN DIEGO" },
  "san jose":       { country: "US", state: "CA", county: "SANTA CLARA" },
  "oakland":        { country: "US", state: "CA", county: "ALAMEDA" },
  "san francisco":  { country: "US", state: "CA", county: "SAN FRANCISCO" },
  // NY / IL
  "new york":       { country: "US", state: "NY", county: "NEW YORK" },
  "manhattan":      { country: "US", state: "NY", county: "NEW YORK" },
  "brooklyn":       { country: "US", state: "NY", county: "KINGS" },
  "queens":         { country: "US", state: "NY", county: "QUEENS" },
  "chicago":        { country: "US", state: "IL", county: "COOK" },
  // AU cities
  "sydney":         { country: "AU", state: "NSW", county: "" },
  "melbourne":      { country: "AU", state: "VIC", county: "" },
  "brisbane":       { country: "AU", state: "QLD", county: "" },
  "perth":          { country: "AU", state: "WA",  county: "" },
  "adelaide":       { country: "AU", state: "SA",  county: "" },
  "hobart":         { country: "AU", state: "TAS", county: "" },
  "canberra":       { country: "AU", state: "ACT", county: "" },
  "darwin":         { country: "AU", state: "NT",  county: "" },
  // CA cities
  "toronto":        { country: "CA", state: "ON", county: "" },
  "vancouver":      { country: "CA", state: "BC", county: "" },
  "calgary":        { country: "CA", state: "AB", county: "" },
  "edmonton":       { country: "CA", state: "AB", county: "" },
  "montreal":       { country: "CA", state: "QC", county: "" },
  "ottawa":         { country: "CA", state: "ON", county: "" },
  // GB cities
  "london":         { country: "GB", state: "",    county: "" },
  "manchester":     { country: "GB", state: "",    county: "" },
  "edinburgh":      { country: "GB", state: "SCT", county: "" },
  "glasgow":        { country: "GB", state: "SCT", county: "" },
  "belfast":        { country: "GB", state: "NIR", county: "" },
};

function extractLocationTail(raw: string): { subject: string; locus: string } {
  const t = raw.trim();
  const inMatch = t.match(/^(.*?)\s+(?:in|from|located in|lives? in|based in)\s+(.+?)[\.\?!]?$/i);
  if (inMatch) return { subject: inMatch[1].trim(), locus: inMatch[2].trim() };
  const commaIdx = t.indexOf(",");
  if (commaIdx > 0 && commaIdx < t.length - 2) {
    return { subject: t.slice(0, commaIdx).trim(), locus: t.slice(commaIdx + 1).trim() };
  }
  return { subject: t, locus: "" };
}

function stripTrigger(raw: string): string {
  return raw.replace(/^\s*(please\s+)?(can you\s+)?(search|find|look ?up|research|dig ?up|pull records? on|scan for|locate|track down|who is|osint on|background(?: check)? on|dossier on|profile of)\s+(for\s+)?/i, "").trim();
}

function parseLocus(locus: string): { country: string; state: string; county: string; city: string } {
  const low = locus.toLowerCase();
  let country = "", state = "", county = "", city = "";

  if (/\b(usa|u\.s\.a\.|u\.s\.|united states|america)\b/.test(low)) country = "US";
  else if (/\b(canada|canadian)\b/.test(low)) country = "CA";
  else if (/\b(uk|united kingdom|england|scotland|wales|britain|british)\b/.test(low)) country = "GB";
  else if (/\b(australia|australian|aussie)\b/.test(low)) country = "AU";
  else if (/\bnew zealand\b/.test(low)) country = "NZ";
  else if (/\bmexico\b/.test(low)) country = "MX";
  else if (/\b(germany|deutschland)\b/.test(low)) country = "DE";
  else if (/\bfrance\b/.test(low)) country = "FR";
  else if (/\bspain\b/.test(low)) country = "ES";
  else if (/\bitaly\b/.test(low)) country = "IT";
  else if (/\bnetherlands\b/.test(low)) country = "NL";
  else if (/\bireland\b/.test(low)) country = "IE";
  else if (/\bjapan\b/.test(low)) country = "JP";
  else if (/\bsingapore\b/.test(low)) country = "SG";
  else if (/\b(uae|united arab emirates|dubai|abu dhabi)\b/.test(low)) country = "AE";
  else if (/\b(south africa)\b/.test(low)) country = "ZA";
  else if (/\bbrazil\b/.test(low)) country = "BR";
  else if (/\bindia\b/.test(low)) country = "IN";

  // US state
  for (const [name, code] of Object.entries(US_STATES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(locus)) { state = code; if (!country) country = "US"; break; }
  }
  if (!state) {
    const stCode = locus.match(/\b([A-Z]{2})\b/);
    if (stCode && Object.values(US_STATES).includes(stCode[1])) { state = stCode[1]; if (!country) country = "US"; }
  }
  // AU state
  if (!state && (country === "AU" || !country)) {
    for (const [name, code] of Object.entries(AU_STATES)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(locus)) { state = code; country = "AU"; break; }
    }
  }
  // CA province
  if (!state && (country === "CA" || !country)) {
    for (const [name, code] of Object.entries(CA_PROVINCES)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(locus)) { state = code; country = "CA"; break; }
    }
  }

  const co = locus.match(/([A-Za-z\-\.\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  for (const [cityName, meta] of Object.entries(CITY_TO_COUNTY)) {
    if (new RegExp(`\\b${cityName.replace(/\./g, "\\.")}\\b`, "i").test(low)) {
      city = cityName.replace(/\b\w/g, (c) => c.toUpperCase());
      if (!state) state = meta.state;
      if (!county) county = meta.county;
      if (!country) country = meta.country;
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
    needsClarification: false, clarifyQuestions: [], accelerators: [],
  };
  if (!raw) return empty;

  const isTrigger = SEARCH_TRIGGERS.test(raw);
  const looksProperty = PROPERTY_STRICT.test(raw) || PROPERTY_HINTS.test(raw);
  const looksEntity = ENTITY_HINTS.test(raw);
  if (!isTrigger && !looksProperty) return empty;

  const stripped = stripTrigger(raw);
  const { subject: rawSubject, locus } = extractLocationTail(stripped);
  const loc = locus ? parseLocus(locus) : parseJurisdiction(raw);
  const fullLoc = parseLocus(raw);
  const country = loc.country || fullLoc.country;
  const state = loc.state || fullLoc.state;
  const county = loc.county || fullLoc.county;
  const city = loc.city || fullLoc.city;

  const kind: IntelKind = looksProperty ? "property" : looksEntity ? "entity" : "person";
  const subject = rawSubject || stripped || raw;

  // ── Clarification cascade ────────────────────────────────────────────────
  // BLOCK when: person with zero jurisdiction, OR property with no locus at all.
  const clarifyQuestions: string[] = [];
  const accelerators: string[] = [];

  if (kind === "person" && !country) {
    clarifyQuestions.push(
      `Which country is ${subject} located in?`,
      `Roughly what state, province, or region — and which city if you know it?`,
      `Approximate age range, and any known middle name, employer, or associates?`,
      `What context — property owner, business director, public figure, person of interest?`,
    );
  } else if (kind === "property" && !country && !state && !city) {
    clarifyQuestions.push(
      `Which country and state (or province) is this property in?`,
      `City, county, and ZIP/postal code if you have them?`,
    );
  }

  // ACCELERATE (non-blocking) when country is known but state/province isn't.
  if (kind === "person" && country && !state) {
    if (country === "US") accelerators.push(`Which U.S. state? I can drill into that state's Secretary of State registry, county property appraiser, and court portal.`);
    else if (country === "AU") accelerators.push(`Which Australian state (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)? I can drill into that state's land registry and court records.`);
    else if (country === "CA") accelerators.push(`Which Canadian province (ON, BC, AB, QC, …)? I can drill into that province's land title system and business registry.`);
    else if (country === "GB") accelerators.push(`Which UK region — England/Wales, Scotland, or Northern Ireland? Each has its own land registry.`);
    else accelerators.push(`Which region or city in that country? I can drill into the local land registry and court records.`);
  }
  if (kind === "person" && country && state && !city && !county) {
    accelerators.push(`Any city or county to narrow the ground-level records?`);
  }

  return {
    kind, subject, country, state, county, city,
    needsClarification: clarifyQuestions.length > 0,
    clarifyQuestions, accelerators,
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
  const registries = Array.from(new Set([
    ...src.ownership, ...src.tax, ...src.permits, ...src.entities, ...src.courts,
  ]));

  const jurisdictionLabel = [
    intent.city,
    intent.county ? `${intent.county} County` : "",
    intent.state,
    intent.country,
  ].filter(Boolean).join(", ") || "unspecified";

  const channels: Record<string, IntelChannelHit[]> = {};
  const subj = `"${intent.subject}"`;
  const locusStr = [intent.city, intent.county, intent.state].filter(Boolean).join(" ");

  if (intent.kind === "property") {
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
    const [entities, courts, web] = await Promise.all([
      src.entities.length ? zophielQuery(`${subj} ${locusStr} directors officers`, siteFilter(src.entities)) : Promise.resolve([]),
      src.courts.length   ? zophielQuery(`${subj} ${locusStr} filing case`, siteFilter(src.courts)) : Promise.resolve([]),
      zophielQuery(`${subj} ${locusStr}`, ""),
    ]);
    channels.entities = entities;
    channels.courts = courts;
    channels.web = web;
  } else {
    // PERSON — layered: entities (directorships) → people-aggregators → courts → property/land → news.
    const queries: Array<[string, Promise<IntelChannelHit[]>]> = [
      ["entities",  src.entities.length ? zophielQuery(`${subj} ${locusStr} director officer`, siteFilter(src.entities)) : Promise.resolve([])],
      ["people",    src.people.length   ? zophielQuery(`${subj} ${locusStr}`, siteFilter(src.people)) : Promise.resolve([])],
      ["courts",    src.courts.length   ? zophielQuery(`${subj} ${locusStr} case filing judgment`, siteFilter(src.courts)) : Promise.resolve([])],
      ["property",  src.ownership.length ? zophielQuery(`${subj} ${locusStr} owner property`, siteFilter(src.ownership)) : Promise.resolve([])],
      ["news",      zophielQuery(`${subj} ${locusStr}`, siteFilter(NEWS_SITES))],
    ];
    const results = await Promise.all(queries.map(([, p]) => p));
    queries.forEach(([name], i) => { channels[name] = results[i]; });
  }

  const emptyChannels = Object.entries(channels).filter(([, v]) => !v.length).map(([k]) => k);
  return { intent, channels, registries, jurisdictionLabel, emptyChannels };
}

/** Build the system-prompt injection the LLM will consume. */
export function formatIntelContext(bundle: IntelBundle): string {
  const { intent, channels, jurisdictionLabel, emptyChannels } = bundle;
  const anyHits = Object.values(channels).some((arr) => arr.length > 0);

  const header = [
    `## JURISDICTIONAL INTEL SWEEP — ${intent.kind.toUpperCase()}`,
    `Subject: ${intent.subject}`,
    `Jurisdiction: ${jurisdictionLabel}`,
    `Authoritative registries queried: ${bundle.registries.slice(0, 10).join(", ") || "(none available for this jurisdiction — sweep ran national/universal only)"}`,
  ].join("\n");

  const acceleratorBlock = intent.accelerators.length
    ? `\n### ACCELERATORS (ask the user, do not block)\n${intent.accelerators.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  if (!anyHits) {
    return [
      header,
      acceleratorBlock,
      "",
      "### RESULT: No public records surfaced in the queried sources.",
      "REPORT HONESTLY. Do NOT fabricate a table. Do NOT dress up unrelated hits as records. State plainly:",
      "  • what jurisdiction was searched,",
      "  • which authoritative registries were queried,",
      "  • that nothing surfaced, and",
      "  • what would unlock the next layer (state/province confirmation, city/county, middle-name variant, approximate age, known associates, employer, or a previous address).",
      "",
      "Distinguish 'no public record found in queried sources' from 'this person does not exist' — they are not the same statement.",
    ].join("\n");
  }

  const sections: string[] = [];
  for (const [channel, hits] of Object.entries(channels)) {
    if (!hits.length) continue;
    const lines = hits.slice(0, 8).map((h, i) => `  ${i + 1}. [${h.domain}] ${h.title}\n     ${h.url}\n     ${h.snippet}`).join("\n");
    sections.push(`### ${channel.toUpperCase()}\n${lines}`);
  }

  const emptyNote = emptyChannels.length
    ? `\n\n### THIN CHANNELS: ${emptyChannels.join(", ")} — tell the user what jurisdiction detail would unlock them.`
    : "";

  return [
    header,
    acceleratorBlock,
    "",
    sections.join("\n\n"),
    emptyNote,
    "",
    "INSTRUCTIONS:",
    "  • Organize findings by channel exactly as returned.",
    "  • Cite every claim inline as [domain](url).",
    "  • NEVER touch breach/leak databases. NEVER fabricate an owner, DOB, address, or case number.",
    "  • Quote only what appears in the snippets above.",
    "  • Distinguish 'confirmed' from 'possible match — needs verification'.",
    "  • End with the specific jurisdiction/data lever that would deepen the sweep.",
  ].join("\n");
}

/** Build the clarify-only prompt when the subject is too vague to search. */
export function formatClarifyContext(intent: IntelIntent): string {
  return [
    `## JURISDICTIONAL INTEL — CLARIFICATION REQUIRED`,
    `Subject: ${intent.subject}`,
    `Kind: ${intent.kind}`,
    ``,
    `The subject is too vague to run a responsible jurisdictional sweep. A less intelligent system would fire this name into a generic search bar and dress the results up as intelligence. This engine does not do that.`,
    ``,
    `ASK THE USER these targeted intake questions before searching. Do not run a search until at least a country is confirmed:`,
    ...intent.clarifyQuestions.map((q, i) => `  ${i + 1}. ${q}`),
    ``,
    `Explain to the user — briefly — why the intake matters: every answer narrows the search from a planet to a city block. Then wait for the reply.`,
  ].join("\n");
}
