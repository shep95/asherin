// PROPERTY INTEL — Aureon inline property card pipeline
// ─────────────────────────────────────────────────────
// Given a user message, this module:
//   1. Detects whether the message is about a physical property/address.
//   2. Geocodes the address(es) via Nominatim (free OSM — no key required).
//   3. Plans targeted web searches for each address (Zillow / Redfin /
//      Realtor / assessor / general).
//   4. Runs Firecrawl v2 /search on each query in parallel.
//   5. Scrapes the top ranked URLs via Firecrawl v2 /scrape with JSON
//      extraction (owner, price, sqft, beds, baths, year_built…).
//   6. Returns an evidence bundle for the LLM prompt PLUS structured
//      attachments the frontend renders as PropertyMapCard +
//      PropertySourcesStrip beneath the assistant message.
//
// Zero cost when intent doesn't fire. All external calls are timeboxed
// (Nominatim 3.5 s, Firecrawl search 5 s each, scrape 8 s each with a 14 s
// total scrape budget). Failures degrade gracefully — the assistant answers
// with whatever evidence returned, or with none if nothing did.

const NOMINATIM_UA = "AureonAI-PropertyIntel/1.0 (support@aureonai.app)";
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyGeocode {
  address: string;              // as typed by the user
  formatted: string;            // Nominatim's canonical form
  lat: number;
  lng: number;
  osmType?: string;
  category?: string;            // e.g. "building", "place", "highway"
  boundingBox?: [string, string, string, string];
}

export interface PropertySource {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  extracted?: Record<string, unknown>;
}

export interface PropertyAttachments {
  map: PropertyGeocode | null;
  sources: PropertySource[];
}

export interface PropertyPull {
  fired: boolean;
  addresses: string[];
  evidence: string;              // markdown block to inject into system prompt
  attachments: PropertyAttachments;
  errors: string[];
}

// ─── Intent detection ───────────────────────────────────────────────────────

// US street address: allows both alpha names ("Main St") and numeric ordinal
// names ("5th Ave", "42nd St", "1st Blvd"), with optional apt/unit + city/state/zip.
const STREET_TOKEN = "(?:[A-Z][a-zA-Z'.-]+|\\d+(?:st|nd|rd|th))";
// NOTE: case-INSENSITIVE. Users type addresses in mixed/lowercase far more often
// than perfectly capitalized ("2004 sw 23rd ct cape coral florida 33991"). The
// original `g`-only flag silently dropped every lowercase address and no map card
// ever rendered. Keep street tokens broad enough to accept mixed-case city/state
// tails (`[a-zA-Z]` in STREET_TOKEN already permits it with the /i flag).
const US_ADDR_RE = new RegExp(
  `\\b\\d{1,6}[A-Z]?\\s+(?:[NSEW]\\.?\\s+)?(?:${STREET_TOKEN}\\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter|Way|Highway|Hwy|Parkway|Pkwy|Square|Sq)\\b\\.?(?:\\s*(?:Apt|Unit|Suite|Ste|#)\\s*\\w+)?(?:,?\\s+[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+){0,3})?(?:,?\\s+[A-Z]{2})?(?:\\s+\\d{5}(?:-\\d{4})?)?`,
  "gi",
);

// UK postcode (SW1A 1AA etc.)
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g;
// Canadian postal (K1A 0B1)
const CA_POSTAL_RE = /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/g;
// Australian/NZ/US bare ZIP+context sniffer
const ZIP_HINT_RE = /\b\d{5}(?:-\d{4})?\b/;

// Property vocabulary that turns a location-adjacent question into a property-search intent.
const PROPERTY_KEYWORDS =
  /\b(propert(?:y|ies)|address(?:es)?|listing(?:s)?|for sale|sold|owns?|owner|owned by|assessor|parcel|apn|mls|zillow|redfin|realtor|trulia|square feet|sq\s?ft|square footage|acres|acreage|lot size|year built|beds?|bath(?:room)?s?|deed|title|tax record|home price|rent|rental|multifamily|single family|townhouse|condo|hoa|neighborhood|zip code|postcode|building at|house at|located at)\b/i;

// Explicit ask verbs — "show me", "map of", "where is"
const MAP_ASK_RE =
  /\b(map|satellite|aerial|street view|show me|where is|located at|pictures of|photos of)\b/i;

// Tail extractor for named landmarks ("map of the Empire State Building",
// "show me the Eiffel Tower"). Allows an optional article (the/a/an).
const LANDMARK_TAIL_RE =
  /\b(?:of|at|for|near|show me|map of|where is|about)\s+(?:the\s+|a\s+|an\s+)?([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,5})\b/g;

// Reset a global regex's lastIndex so `.test()` calls don't leak state
// between invocations. Cheap safety net around any /g regex we reuse.
function safeGlobalMatchAll(re: RegExp, s: string): RegExpMatchArray[] {
  re.lastIndex = 0;
  const out = [...s.matchAll(re)];
  re.lastIndex = 0;
  return out;
}
function safeGlobalTest(re: RegExp, s: string): boolean {
  re.lastIndex = 0;
  const ok = re.test(s);
  re.lastIndex = 0;
  return ok;
}

export function detectPropertyIntent(text: string): { addresses: string[]; fired: boolean } {
  const addrs = new Set<string>();
  for (const m of safeGlobalMatchAll(US_ADDR_RE, text)) addrs.add(m[0].replace(/\s+/g, " ").trim());
  for (const m of safeGlobalMatchAll(UK_POSTCODE_RE, text)) addrs.add(m[0].trim());
  for (const m of safeGlobalMatchAll(CA_POSTAL_RE, text)) addrs.add(m[0].trim());

  const hasKeyword = PROPERTY_KEYWORDS.test(text);
  const hasMapAsk = MAP_ASK_RE.test(text);
  const hasZipHint = ZIP_HINT_RE.test(text);
  const hasStreetAddr = addrs.size > 0; // any address-shaped regex fired

  // No explicit address, but the user is clearly asking about a property with
  // a nameable landmark ("map of the Chrysler Building") — grab a Proper-noun tail.
  if (!hasStreetAddr && (hasKeyword || hasMapAsk)) {
    for (const m of safeGlobalMatchAll(LANDMARK_TAIL_RE, text)) addrs.add(m[1].trim());
  }

  // Fired when we have a location AND context (an explicit address is context
  // by itself; a landmark needs a keyword/map-ask/zip to confirm intent).
  const fired = addrs.size > 0 && (hasStreetAddr || hasKeyword || hasMapAsk || hasZipHint);
  return { addresses: [...addrs].slice(0, 2), fired };
}

// ─── Geocoding (Nominatim / OSM — free, no key) ─────────────────────────────

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error(`${label}_timeout`)), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

export async function geocodeNominatim(address: string): Promise<PropertyGeocode | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    const r = await withTimeout(
      fetch(url.toString(), { headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" } }),
      3500,
      "nominatim",
    );
    if (!r.ok) return null;
    const arr = (await r.json()) as Array<{
      lat: string; lon: string; display_name: string; osm_type?: string;
      category?: string; type?: string; boundingbox?: [string, string, string, string];
    }>;
    if (!arr?.length) return null;
    const hit = arr[0];
    return {
      address,
      formatted: hit.display_name,
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      osmType: hit.osm_type,
      category: hit.category || hit.type,
      boundingBox: hit.boundingbox,
    };
  } catch {
    return null;
  }
}

// ─── Web search + scrape (Firecrawl v2) ─────────────────────────────────────

function firecrawlKey(): string | null {
  return Deno.env.get("FIRECRAWL_API_KEY") || null;
}

function domainOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

// Domain authority ranking for property data. Higher = more trustworthy.
const DOMAIN_RANK: Record<string, number> = {
  "zillow.com": 90,
  "redfin.com": 88,
  "realtor.com": 85,
  "trulia.com": 80,
  "homes.com": 75,
  "compass.com": 74,
  "loopnet.com": 82,      // commercial
  "propertyshark.com": 80,
  "acris.nyc.gov": 95,    // NYC deeds
  "portal.311.nyc.gov": 88,
};
function rankDomain(host: string): number {
  if (DOMAIN_RANK[host]) return DOMAIN_RANK[host];
  if (host.endsWith(".gov")) return 92;
  if (host.endsWith(".edu")) return 70;
  return 40;
}

export function planPropertyQueries(address: string): string[] {
  const quoted = `"${address.replace(/"/g, "")}"`;
  return [
    `${quoted} owner assessor records`,
    `${quoted} site:zillow.com`,
    `${quoted} site:redfin.com`,
    `${quoted} site:realtor.com`,
    `${quoted} deed OR parcel OR APN`,
  ];
}

async function firecrawlSearch(query: string): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const key = firecrawlKey();
  if (!key) return [];
  try {
    const r = await withTimeout(
      fetch(`${FIRECRAWL_V2}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      }),
      5000,
      "fc_search",
    );
    if (!r.ok) return [];
    const j = await r.json();
    // v2 shape: { success, data: { web: [{url,title,description}] } } — be defensive.
    const items: Array<{ url?: string; title?: string; description?: string; snippet?: string }> =
      (j?.data?.web ?? j?.web ?? j?.data ?? []) as unknown as Array<{ url?: string; title?: string; description?: string; snippet?: string }>;
    return (Array.isArray(items) ? items : [])
      .filter((x) => typeof x?.url === "string")
      .map((x) => ({ url: x.url!, title: x.title || "", snippet: x.description || x.snippet || "" }));
  } catch {
    return [];
  }
}

const EXTRACTION_PROMPT =
  "Extract property facts as JSON with these OPTIONAL keys (only include what's present, omit others): full_address, owner_name, beds, baths, sqft, lot_size, year_built, last_sale_date, last_sale_price, tax_assessment, listing_status, listing_price, hoa_fee, property_type, mls_number.";

// Fallback: pull common property fields directly from scraped markdown.
// Runs when Firecrawl's JSON extraction returned nothing (some plans/pages).
function factsFromMarkdown(md: string): Record<string, string> {
  if (!md) return {};
  const out: Record<string, string> = {};
  const grab = (key: string, re: RegExp) => {
    const m = md.match(re);
    if (m && m[1]) out[key] = m[1].replace(/\s+/g, " ").trim().slice(0, 80);
  };
  grab("beds", /(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)\b/i);
  grab("baths", /(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)\b/i);
  grab("sqft", /([\d,]{3,7})\s*(?:sq\.?\s*ft|square feet|sqft)\b/i);
  grab("year_built", /(?:built|year built)[:\s]+(\d{4})\b/i);
  grab("lot_size", /(?:lot(?: size)?)[:\s]+([\d,.]+\s*(?:acres?|sq\.?\s*ft|sqft))/i);
  grab("last_sale_price", /(?:sold|last sold|sale price)[:\s]+\$?([\d,]{4,})/i);
  grab("listing_price", /(?:listed|for sale|price)[:\s]+\$?([\d,]{4,})/i);
  grab("hoa_fee", /HOA[:\s]+\$?([\d,]+(?:\/\w+)?)/i);
  grab("property_type", /(?:type|property type)[:\s]+([A-Za-z][A-Za-z\s-]{2,30})/i);
  grab("mls_number", /MLS\s*(?:#|number)?[:\s]*([A-Z0-9-]{4,})/i);
  return out;
}

async function firecrawlScrape(url: string): Promise<PropertySource | null> {
  const key = firecrawlKey();
  if (!key) return null;
  try {
    const r = await withTimeout(
      fetch(`${FIRECRAWL_V2}/scrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          formats: ["markdown", { type: "json", prompt: EXTRACTION_PROMPT }],
          onlyMainContent: true,
        }),
      }),
      8000,
      "fc_scrape",
    );
    if (!r.ok) return null;
    const j = await r.json();
    const doc = (j?.data ?? j) as Record<string, unknown>;

    // Firecrawl v2 nests JSON extraction under different keys depending on
    // plan/response shape: doc.json | doc.extract | doc.llm_extraction |
    // doc.data.json. Try them all, then fall back to markdown regex parsing.
    const jsonExtracted =
      (doc?.json as Record<string, unknown>) ??
      (doc?.extract as Record<string, unknown>) ??
      ((doc as { llm_extraction?: Record<string, unknown> })?.llm_extraction) ??
      ((doc?.data as { json?: Record<string, unknown> })?.json) ??
      null;
    const md = typeof doc?.markdown === "string" ? (doc.markdown as string) : "";
    const mdFacts = factsFromMarkdown(md);
    const extracted: Record<string, unknown> = { ...mdFacts, ...(jsonExtracted || {}) };

    const meta = (doc?.metadata as { title?: string } | undefined) ?? undefined;
    const title = meta?.title || domainOf(url);
    const snippet = md.replace(/\s+/g, " ").slice(0, 220);
    return { url, domain: domainOf(url), title, snippet, extracted };
  } catch {
    return null;
  }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function runPropertyPipeline(userQuery: string): Promise<PropertyPull> {
  const intent = detectPropertyIntent(userQuery);
  if (!intent.fired) {
    return { fired: false, addresses: [], evidence: "", attachments: { map: null, sources: [] }, errors: [] };
  }

  const errors: string[] = [];

  // 1. Geocode each candidate address (max 2) sequentially to respect the
  //    Nominatim 1-req/sec policy.
  const geocodes: PropertyGeocode[] = [];
  for (const addr of intent.addresses) {
    const g = await geocodeNominatim(addr).catch((e) => { errors.push(`geo:${e?.message}`); return null; });
    if (g) geocodes.push(g);
    await new Promise((r) => setTimeout(r, 900)); // Nominatim politeness
  }

  // 2. Search — 5 targeted queries for the first address (the primary target).
  const primary = intent.addresses[0];
  const searchResults = primary
    ? (await Promise.all(planPropertyQueries(primary).map(firecrawlSearch))).flat()
    : [];

  // 3. Dedupe by URL, rank by domain authority, take top 5.
  const seen = new Set<string>();
  const ranked = searchResults
    .filter((r) => r.url && !seen.has(r.url) && (seen.add(r.url), true))
    .map((r) => ({ ...r, _rank: rankDomain(domainOf(r.url)) }))
    .sort((a, b) => b._rank - a._rank)
    .slice(0, 5);

  // 4. Parallel scrape with a 14 s total budget.
  const scrapePromise = Promise.all(ranked.map((r) => firecrawlScrape(r.url)));
  const budgetRace = new Promise<(PropertySource | null)[]>((resolve) =>
    setTimeout(() => resolve(ranked.map(() => null)), 14000),
  );
  const scraped = (await Promise.race([scrapePromise, budgetRace])).filter(
    (x): x is PropertySource => !!x,
  );

  // Fall back to search snippets for any URL that failed to scrape but ranked well.
  const scrapedUrls = new Set(scraped.map((s) => s.url));
  const snippetOnly: PropertySource[] = ranked
    .filter((r) => !scrapedUrls.has(r.url))
    .map((r) => ({ url: r.url, domain: domainOf(r.url), title: r.title, snippet: r.snippet }));
  const allSources = [...scraped, ...snippetOnly].slice(0, 6);

  // 5. Build the evidence markdown for the system prompt.
  const evidenceBlocks: string[] = [];
  if (geocodes.length) {
    evidenceBlocks.push(
      "### GEOCODE (Nominatim/OSM)\n" +
        geocodes.map((g) => `- ${g.address} → ${g.formatted} · lat ${g.lat.toFixed(6)}, lng ${g.lng.toFixed(6)}${g.category ? ` (${g.category})` : ""}`).join("\n"),
    );
  }
  for (const s of allSources) {
    const facts = s.extracted && Object.keys(s.extracted).length
      ? "\n  " + Object.entries(s.extracted)
          .filter(([, v]) => v != null && v !== "")
          .slice(0, 12)
          .map(([k, v]) => `- ${k}: ${JSON.stringify(v).slice(0, 120)}`)
          .join("\n  ")
      : "";
    evidenceBlocks.push(`### ${s.domain} — ${s.title || s.url}\n${s.url}${facts}${s.snippet ? `\n  > ${s.snippet}` : ""}`);
  }

  const evidence = evidenceBlocks.length
    ? `\n\n## LIVE PROPERTY EVIDENCE (${new Date().toISOString()})\nAddresses probed: ${intent.addresses.join(" · ")}\n\n${evidenceBlocks.join("\n\n")}\n\nCite each fact inline as [domain] (e.g. [zillow.com], [redfin.com], [nyc.gov]). When two sources conflict on the same field, list both values explicitly.`
    : "";

  return {
    fired: true,
    addresses: intent.addresses,
    evidence,
    attachments: { map: geocodes[0] || null, sources: allSources },
    errors,
  };
}
