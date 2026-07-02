// ============================================================================
// AUREON OSINT STACK — Zero-key global intelligence fetchers
// ----------------------------------------------------------------------------
// Free public APIs, no user credentials required. Every fetcher is timeboxed,
// summarized to a compact string, and safe under Promise.allSettled.
//
// Sources included:
//   - GDELT              global news / events (15-min cadence)
//   - SEC EDGAR          US public company filings
//   - OpenSky Network    global aircraft state vectors
//   - Overpass (OSM)     physical infrastructure geometry
//   - World Bank         country economic indicators
//   - IMF DataMapper     macro indicators
//   - Wikipedia REST     entity summaries + pageview spikes
//   - USASpending        US federal contracts / grants
//   - OpenFDA            drug approvals / adverse events
//   - UN Comtrade        bilateral trade
//   - exchangerate.host  keyless FX rates
// ============================================================================

const UA = "AureonOSINT/1.0 (aureonai.app; intel@aureonai.app)";
const DEFAULT_TIMEOUT_MS = 4500;

async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", ...(init.headers || {}) },
    });
  } finally { clearTimeout(t); }
}

const clip = (s: string, n = 1500) => (s.length > n ? s.slice(0, n) + "…" : s);

// ---------- Individual fetchers ----------

export async function fetchGDELT(query: string): Promise<string> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=15&format=json&sort=DateDesc`;
  const r = await timedFetch(url);
  if (!r.ok) throw new Error(`GDELT ${r.status}`);
  const j = await r.json();
  const arts = (j?.articles || []) as any[];
  if (!arts.length) return "No GDELT articles matched.";
  const lines = arts.slice(0, 12).map((a) =>
    `- [${a.seendate || ""}] ${a.title || ""} — ${a.domain || a.sourcecountry || ""}${a.url ? ` (${a.url})` : ""}`
  );
  return clip(`GDELT (last 24-72h global media, ${arts.length} hits):\n` + lines.join("\n"));
}

export async function fetchWikipediaSummary(entity: string): Promise<string> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity.replace(/\s+/g, "_"))}`;
  const r = await timedFetch(url);
  if (!r.ok) throw new Error(`Wiki ${r.status}`);
  const j = await r.json();
  if (!j?.extract) return "No Wikipedia entry.";
  return clip(`Wikipedia: ${j.title}\n${j.description || ""}\n${j.extract}`);
}

export async function fetchWorldBank(countryIso2: string): Promise<string> {
  const inds = [
    ["NY.GDP.MKTP.CD", "GDP (USD)"],
    ["NY.GDP.MKTP.KD.ZG", "GDP growth %"],
    ["FP.CPI.TOTL.ZG", "Inflation %"],
    ["SL.UEM.TOTL.ZS", "Unemployment %"],
    ["MS.MIL.XPND.GD.ZS", "Mil spend %GDP"],
  ];
  const results = await Promise.allSettled(inds.map(async ([code, label]) => {
    const u = `https://api.worldbank.org/v2/country/${countryIso2}/indicator/${code}?format=json&per_page=3`;
    const r = await timedFetch(u, {}, 3500);
    if (!r.ok) throw new Error(`WB ${r.status}`);
    const j = await r.json();
    const point = (j?.[1] || []).find((p: any) => p?.value != null);
    return point ? `- ${label}: ${point.value} (${point.date})` : `- ${label}: n/a`;
  }));
  const lines = results.map((r) => r.status === "fulfilled" ? r.value : `- (source error)`);
  return clip(`World Bank — ${countryIso2.toUpperCase()}:\n` + lines.join("\n"));
}

export async function fetchSECEdgar(company: string): Promise<string> {
  // Full-text search across recent filings.
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${company}"`)}&dateRange=custom&startdt=${dateNDaysAgo(180)}&enddt=${today()}&forms=10-K,10-Q,8-K`;
  const r = await timedFetch(url);
  if (!r.ok) throw new Error(`SEC ${r.status}`);
  const j = await r.json();
  const hits = (j?.hits?.hits || []).slice(0, 8);
  if (!hits.length) return "No SEC filings in last 180 days.";
  const lines = hits.map((h: any) => {
    const s = h?._source || {};
    const form = s.form || s.forms?.[0] || "?";
    const cik = h?._id?.split(":")?.[0] || s.ciks?.[0] || "";
    return `- ${s.file_date || ""} · ${form} · ${(s.display_names?.[0] || "").slice(0, 80)}${cik ? ` (CIK ${cik})` : ""}`;
  });
  return clip(`SEC EDGAR (last 180d 10-K/10-Q/8-K for "${company}"):\n` + lines.join("\n"));
}

export async function fetchOpenSkyOverBox(bbox?: { south: number; west: number; north: number; east: number }): Promise<string> {
  const box = bbox
    ? `?lamin=${bbox.south}&lomin=${bbox.west}&lamax=${bbox.north}&lomax=${bbox.east}`
    : "";
  const r = await timedFetch(`https://opensky-network.org/api/states/all${box}`);
  if (!r.ok) throw new Error(`OpenSky ${r.status}`);
  const j = await r.json();
  const states = (j?.states || []) as any[][];
  if (!states.length) return "No OpenSky aircraft in bbox.";
  const sample = states.slice(0, 12).map((s) =>
    `- ${(s[1] || "").trim() || s[0]} · ${s[2] || "?"} · alt ${Math.round((s[7] || 0))}m · vel ${Math.round((s[9] || 0))}m/s`
  );
  return clip(`OpenSky (${states.length} aircraft live):\n` + sample.join("\n"));
}

export async function fetchOverpass(query: string): Promise<string> {
  // Query must be Overpass QL. Provide sensible default if not.
  const ql = query.trim().startsWith("[") ? query : `[out:json][timeout:15];${query};out center 20;`;
  const r = await timedFetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: ql,
  });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = await r.json();
  const els = (j?.elements || []) as any[];
  if (!els.length) return "No Overpass elements.";
  const lines = els.slice(0, 10).map((e) =>
    `- ${e.type} ${e.id} · ${JSON.stringify(e.tags || {}).slice(0, 120)}`
  );
  return clip(`Overpass/OSM (${els.length} elements):\n` + lines.join("\n"));
}

export async function fetchUSASpending(recipient: string): Promise<string> {
  const body = {
    filters: {
      recipient_search_text: [recipient],
      time_period: [{ start_date: dateNDaysAgo(365), end_date: today() }],
      award_type_codes: ["A", "B", "C", "D"], // contracts
    },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Action Date"],
    page: 1, limit: 10, sort: "Action Date", order: "desc",
  };
  const r = await timedFetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`USASpending ${r.status}`);
  const j = await r.json();
  const rows = (j?.results || []) as any[];
  if (!rows.length) return `No US federal awards for "${recipient}" in last 365d.`;
  const lines = rows.map((a) =>
    `- ${a["Action Date"] || ""} · $${Number(a["Award Amount"] || 0).toLocaleString()} · ${a["Awarding Agency"] || ""} → ${a["Recipient Name"] || ""}`
  );
  return clip(`USASpending (federal awards last 365d, "${recipient}"):\n` + lines.join("\n"));
}

export async function fetchOpenFDA(drug: string): Promise<string> {
  const r = await timedFetch(
    `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug)}"&limit=5`
  );
  if (!r.ok) throw new Error(`OpenFDA ${r.status}`);
  const j = await r.json();
  const evs = (j?.results || []) as any[];
  if (!evs.length) return "No OpenFDA events.";
  const lines = evs.map((e) => {
    const rxs = (e?.patient?.reaction || []).map((x: any) => x.reactionmeddrapt).filter(Boolean).slice(0, 4).join(", ");
    return `- ${e.receiptdate || ""} · ${e.serious === "1" ? "SERIOUS" : "non-serious"} · ${rxs}`;
  });
  return clip(`OpenFDA adverse events ("${drug}"):\n` + lines.join("\n"));
}

export async function fetchExchangeRate(base = "USD", symbols = "EUR,GBP,JPY,CNY,RUB,BRL,INR,TRY,ARS"): Promise<string> {
  // Keyless mirror.
  const r = await timedFetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
  if (!r.ok) throw new Error(`FX ${r.status}`);
  const j = await r.json();
  const rates = j?.rates || {};
  const wants = symbols.split(",").map((s) => s.trim().toUpperCase());
  const lines = wants.filter((s) => rates[s] != null).map((s) => `- ${base}/${s} ${rates[s]}`);
  return clip(`FX (${j?.time_last_update_utc || "live"}, base ${base}):\n` + lines.join("\n"));
}

export async function fetchIMF(indicator = "PCPIPCH", countryIso3 = "USA"): Promise<string> {
  // WEO indicator via IMF DataMapper.
  const r = await timedFetch(`https://www.imf.org/external/datamapper/api/v1/${indicator}/${countryIso3}`);
  if (!r.ok) throw new Error(`IMF ${r.status}`);
  const j = await r.json();
  const series = j?.values?.[indicator]?.[countryIso3] || {};
  const rows = Object.entries(series).slice(-8).map(([y, v]) => `- ${y}: ${v}`);
  return clip(`IMF ${indicator} ${countryIso3}:\n` + rows.join("\n"));
}

export async function fetchUNComtrade(reporterIso3: string, partnerIso3 = "all", year = new Date().getFullYear() - 1): Promise<string> {
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${iso3ToNumeric(reporterIso3)}&partnerCode=${partnerIso3 === "all" ? "0" : iso3ToNumeric(partnerIso3)}&period=${year}&flowCode=X,M`;
  const r = await timedFetch(url);
  if (!r.ok) throw new Error(`Comtrade ${r.status}`);
  const j = await r.json();
  const rows = (j?.data || []) as any[];
  if (!rows.length) return "No Comtrade data.";
  const lines = rows.slice(0, 8).map((x) =>
    `- ${x.period} · ${x.flowDesc || x.flowCode} · ${x.partnerDesc || x.partnerCode} · $${Number(x.primaryValue || 0).toLocaleString()}`
  );
  return clip(`UN Comtrade ${reporterIso3} ${year}:\n` + lines.join("\n"));
}

// ---------- Helpers ----------

function today(): string { return new Date().toISOString().slice(0, 10); }
function dateNDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

// Compact ISO3 → numeric map for the countries most likely to be asked about.
// Falls back to "0" (world) if unknown.
const ISO3_NUMERIC: Record<string, string> = {
  USA: "842", CHN: "156", RUS: "643", DEU: "276", GBR: "826", FRA: "251", JPN: "392",
  IND: "699", BRA: "076", CAN: "124", AUS: "036", MEX: "484", KOR: "410", ITA: "381",
  ESP: "724", TUR: "792", SAU: "682", IRN: "364", ISR: "376", UKR: "804", POL: "616",
  NLD: "528", CHE: "757", SWE: "752", NOR: "578", ZAF: "710", NGA: "566", EGY: "818",
  ARG: "032", COL: "170", CHL: "152", PER: "604", VEN: "862", VNM: "704", IDN: "360",
  PAK: "586", BGD: "050", THA: "764", SGP: "702", MYS: "458", PHL: "608", TWN: "158",
  HKG: "344",
};
function iso3ToNumeric(iso3: string): string { return ISO3_NUMERIC[iso3.toUpperCase()] || "0"; }

// ---------- Intent detection ----------

export interface OsintIntent {
  countries: string[];         // ISO2 codes
  countriesIso3: string[];     // ISO3 codes
  companies: string[];         // free-text company names
  entities: string[];          // wiki-able terms
  drugs: string[];
  wantGDELT: boolean;
  wantFX: boolean;
  wantAircraft: boolean;
  wantFilings: boolean;
  wantAwards: boolean;
  wantWiki: boolean;
  wantMacro: boolean;
  wantInfra: boolean;
  wantDrugs: boolean;
  keywords: string[];
}

// Very small country lexicon — expand as needed. Matches lowercase word boundaries.
const COUNTRY_LEX: Array<{ names: string[]; iso2: string; iso3: string }> = [
  { names: ["united states", "usa", "u.s.", "america"], iso2: "US", iso3: "USA" },
  { names: ["china", "prc"], iso2: "CN", iso3: "CHN" },
  { names: ["russia", "russian federation"], iso2: "RU", iso3: "RUS" },
  { names: ["ukraine"], iso2: "UA", iso3: "UKR" },
  { names: ["iran"], iso2: "IR", iso3: "IRN" },
  { names: ["israel"], iso2: "IL", iso3: "ISR" },
  { names: ["india"], iso2: "IN", iso3: "IND" },
  { names: ["japan"], iso2: "JP", iso3: "JPN" },
  { names: ["germany"], iso2: "DE", iso3: "DEU" },
  { names: ["france"], iso2: "FR", iso3: "FRA" },
  { names: ["united kingdom", "uk", "britain"], iso2: "GB", iso3: "GBR" },
  { names: ["brazil"], iso2: "BR", iso3: "BRA" },
  { names: ["mexico"], iso2: "MX", iso3: "MEX" },
  { names: ["turkey", "türkiye"], iso2: "TR", iso3: "TUR" },
  { names: ["saudi arabia", "ksa"], iso2: "SA", iso3: "SAU" },
  { names: ["argentina"], iso2: "AR", iso3: "ARG" },
  { names: ["venezuela"], iso2: "VE", iso3: "VEN" },
  { names: ["taiwan"], iso2: "TW", iso3: "TWN" },
  { names: ["south korea", "korea"], iso2: "KR", iso3: "KOR" },
  { names: ["north korea", "dprk"], iso2: "KP", iso3: "PRK" },
  { names: ["australia"], iso2: "AU", iso3: "AUS" },
  { names: ["canada"], iso2: "CA", iso3: "CAN" },
  { names: ["pakistan"], iso2: "PK", iso3: "PAK" },
  { names: ["indonesia"], iso2: "ID", iso3: "IDN" },
  { names: ["vietnam"], iso2: "VN", iso3: "VNM" },
  { names: ["egypt"], iso2: "EG", iso3: "EGY" },
  { names: ["nigeria"], iso2: "NG", iso3: "NGA" },
  { names: ["south africa"], iso2: "ZA", iso3: "ZAF" },
];

export function detectIntent(text: string): OsintIntent {
  const q = text.toLowerCase();
  const countries: string[] = [];
  const countriesIso3: string[] = [];
  for (const c of COUNTRY_LEX) {
    if (c.names.some((n) => q.includes(n))) {
      if (!countries.includes(c.iso2)) countries.push(c.iso2);
      if (!countriesIso3.includes(c.iso3)) countriesIso3.push(c.iso3);
    }
  }

  const companyMatches = Array.from(text.matchAll(/\b([A-Z][A-Za-z0-9&.\-]{2,}(?:\s+[A-Z][A-Za-z0-9&.\-]{1,}){0,3})\b/g))
    .map((m) => m[1])
    .filter((s) => !/^(The|And|For|With|From|About|What|Who|Why|How|When|Where|Which|That|This|These|Those|USA|China|Russia|Aureon)$/.test(s))
    .slice(0, 3);

  const wantFilings = /\b(sec|10-?[kq]|8-?k|filing|earnings|ticker|nasdaq|nyse|insider|ownership)\b/.test(q) || companyMatches.length > 0;
  const wantAwards = /\b(contract|federal|award|grant|dod|pentagon|usaspending|procurement)\b/.test(q);
  const wantFX = /\b(currency|fx|exchange rate|forex|usd|eur|jpy|gbp|cny|rub|inflation|depreciation|collapse)\b/.test(q);
  const wantAircraft = /\b(aircraft|flight|jet|adsb|airspace|airplane|helicopter|air force|drone)\b/.test(q);
  const wantInfra = /\b(power plant|pipeline|port|base|military base|infrastructure|road|bridge|dam|refinery)\b/.test(q);
  const wantDrugs = /\b(drug|fda|pharma|vaccine|clinical|adverse event)\b/.test(q);
  const wantMacro = /\b(gdp|inflation|unemployment|debt|deficit|economy|macro|recession|growth)\b/.test(q) || countries.length > 0;
  const wantGDELT = /\b(news|breaking|reported|coverage|media|latest|today|this week|happening|crisis|conflict|war|protest|attack|sanctions)\b/.test(q) || countries.length > 0;
  const wantWiki = /\b(who is|what is|tell me about|profile of|background on|biography)\b/.test(q) || countries.length > 0;

  const drugs = wantDrugs ? Array.from(text.matchAll(/\b([A-Z][a-z]{3,})\b/g)).map((m) => m[1]).slice(0, 2) : [];

  return {
    countries, countriesIso3,
    companies: companyMatches,
    entities: [...countries.map((c) => COUNTRY_LEX.find((x) => x.iso2 === c)!.names[0]), ...companyMatches].slice(0, 3),
    drugs,
    wantGDELT, wantFX, wantAircraft, wantFilings, wantAwards, wantWiki, wantMacro, wantInfra, wantDrugs,
    keywords: text.split(/\s+/).filter((w) => w.length > 3).slice(0, 6),
  };
}

// ---------- Orchestrator ----------

export interface OsintPull {
  sources: string[];         // human-readable source labels actually used
  context: string;           // compact aggregated markdown injected into system prompt
  errors: string[];          // sources that failed
}

/**
 * Run all relevant fetchers in parallel with per-source timeouts. Returns
 * summarized context + list of sources that actually contributed data.
 */
export async function runOsintPipeline(userQuery: string): Promise<OsintPull> {
  const intent = detectIntent(userQuery);
  const jobs: Array<{ label: string; run: () => Promise<string> }> = [];

  if (intent.wantGDELT) {
    const q = intent.entities[0] || intent.keywords.slice(0, 3).join(" ") || userQuery.slice(0, 80);
    if (q.trim()) jobs.push({ label: "GDELT", run: () => fetchGDELT(q) });
  }
  if (intent.wantWiki) {
    for (const e of intent.entities.slice(0, 2)) {
      jobs.push({ label: `Wikipedia:${e}`, run: () => fetchWikipediaSummary(e) });
    }
  }
  if (intent.wantMacro) {
    for (const c of intent.countries.slice(0, 2)) {
      jobs.push({ label: `WorldBank:${c}`, run: () => fetchWorldBank(c) });
    }
    for (const c of intent.countriesIso3.slice(0, 1)) {
      jobs.push({ label: `IMF:${c}`, run: () => fetchIMF("PCPIPCH", c) });
    }
  }
  if (intent.wantFilings) {
    for (const co of intent.companies.slice(0, 2)) {
      jobs.push({ label: `SEC:${co}`, run: () => fetchSECEdgar(co) });
    }
  }
  if (intent.wantAwards) {
    for (const co of intent.companies.slice(0, 2)) {
      jobs.push({ label: `USASpending:${co}`, run: () => fetchUSASpending(co) });
    }
  }
  if (intent.wantFX) {
    jobs.push({ label: "FX", run: () => fetchExchangeRate("USD") });
  }
  if (intent.wantAircraft) {
    jobs.push({ label: "OpenSky", run: () => fetchOpenSkyOverBox() });
  }
  if (intent.wantInfra && intent.countries[0]) {
    const iso = intent.countries[0];
    jobs.push({
      label: `Overpass:${iso}`,
      run: () => fetchOverpass(`area["ISO3166-1"="${iso}"]->.a;(node["power"="plant"](area.a);way["power"="plant"](area.a);)`),
    });
  }
  if (intent.wantDrugs) {
    for (const d of intent.drugs.slice(0, 1)) {
      jobs.push({ label: `OpenFDA:${d}`, run: () => fetchOpenFDA(d) });
    }
  }
  if (intent.countriesIso3.length && intent.wantMacro) {
    jobs.push({ label: `Comtrade:${intent.countriesIso3[0]}`, run: () => fetchUNComtrade(intent.countriesIso3[0]) });
  }

  if (!jobs.length) return { sources: [], context: "", errors: [] };

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const sources: string[] = [];
  const errors: string[] = [];
  const blocks: string[] = [];
  settled.forEach((r, i) => {
    const label = jobs[i].label;
    if (r.status === "fulfilled" && r.value) {
      sources.push(label);
      blocks.push(`### ${label}\n${r.value}`);
    } else if (r.status === "rejected") {
      errors.push(`${label}: ${String((r.reason as any)?.message || r.reason).slice(0, 80)}`);
    }
  });

  const context = blocks.length
    ? `\n\n## LIVE OSINT PULL (${new Date().toISOString()})\nSources consulted: ${sources.join(", ")}\n\n${blocks.join("\n\n")}\n\nUse this real-time evidence to ground your answer. Cite sources inline like [GDELT] or [SEC].`
    : "";

  return { sources, context, errors };
}
