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
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- Individual fetchers ----------

export async function fetchGDELT(query: string): Promise<string> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=15&format=json&sort=DateDesc`;
  const r = await timedFetch(url, {}, 8000);
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
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Last Modified Date"],
    page: 1, limit: 10, sort: "Last Modified Date", order: "desc",
  };
  const r = await timedFetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`USASpending ${r.status}`);
  const j = await r.json();
  const rows = (j?.results || []) as any[];
  if (!rows.length) return `No US federal awards for "${recipient}" in last 365d.`;
  const lines = rows.map((a) =>
    `- ${a["Last Modified Date"] || ""} · $${Number(a["Award Amount"] || 0).toLocaleString()} · ${a["Awarding Agency"] || ""} → ${a["Recipient Name"] || ""}`
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
  AFG:"004",ALB:"008",DZA:"012",AND:"020",AGO:"024",ATG:"028",ARG:"032",ARM:"051",AUS:"036",AUT:"040",AZE:"031",
  BHS:"044",BHR:"048",BGD:"050",BRB:"052",BLR:"112",BEL:"056",BLZ:"084",BEN:"204",BTN:"064",BOL:"068",BIH:"070",
  BWA:"072",BRA:"076",BRN:"096",BGR:"100",BFA:"854",BDI:"108",CPV:"132",KHM:"116",CMR:"120",CAN:"124",CAF:"140",
  TCD:"148",CHL:"152",CHN:"156",COL:"170",COM:"174",COG:"178",COD:"180",CRI:"188",CIV:"384",HRV:"191",CUB:"192",
  CYP:"196",CZE:"203",DNK:"208",DJI:"262",DMA:"212",DOM:"214",ECU:"218",EGY:"818",SLV:"222",GNQ:"226",ERI:"232",
  EST:"233",SWZ:"748",ETH:"231",FJI:"242",FIN:"246",FRA:"251",GAB:"266",GMB:"270",GEO:"268",DEU:"276",GHA:"288",
  GRC:"300",GRD:"308",GTM:"320",GIN:"324",GNB:"624",GUY:"328",HTI:"332",HND:"340",HKG:"344",HUN:"348",ISL:"352",
  IND:"699",IDN:"360",IRN:"364",IRQ:"368",IRL:"372",ISR:"376",ITA:"381",JAM:"388",JPN:"392",JOR:"400",KAZ:"398",
  KEN:"404",KIR:"296",KWT:"414",KGZ:"417",LAO:"418",LVA:"428",LBN:"422",LSO:"426",LBR:"430",LBY:"434",LIE:"438",
  LTU:"440",LUX:"442",MAC:"446",MDG:"450",MWI:"454",MYS:"458",MDV:"462",MLI:"466",MLT:"470",MHL:"584",MRT:"478",
  MUS:"480",MEX:"484",FSM:"583",MDA:"498",MCO:"492",MNG:"496",MNE:"499",MAR:"504",MOZ:"508",MMR:"104",NAM:"516",
  NRU:"520",NPL:"524",NLD:"528",NZL:"554",NIC:"558",NER:"562",NGA:"566",PRK:"408",MKD:"807",NOR:"578",OMN:"512",
  PAK:"586",PLW:"585",PSE:"275",PAN:"591",PNG:"598",PRY:"600",PER:"604",PHL:"608",POL:"616",PRT:"620",PRI:"630",
  QAT:"634",ROU:"642",RUS:"643",RWA:"646",KNA:"659",LCA:"662",VCT:"670",WSM:"882",SMR:"674",STP:"678",SAU:"682",
  SEN:"686",SRB:"688",SYC:"690",SLE:"694",SGP:"702",SVK:"703",SVN:"705",SLB:"090",SOM:"706",ZAF:"710",KOR:"410",
  SSD:"728",ESP:"724",LKA:"144",SDN:"729",SUR:"740",SWE:"752",CHE:"757",SYR:"760",TWN:"158",TJK:"762",TZA:"834",
  THA:"764",TLS:"626",TGO:"768",TON:"776",TTO:"780",TUN:"788",TUR:"792",TKM:"795",TUV:"798",UGA:"800",UKR:"804",
  ARE:"784",GBR:"826",USA:"842",URY:"858",UZB:"860",VUT:"548",VAT:"336",VEN:"862",VNM:"704",YEM:"887",ZMB:"894",ZWE:"716",
};
function iso3ToNumeric(iso3: string): string { return ISO3_NUMERIC[iso3.toUpperCase()] || "0"; }

// ---------- Intent detection ----------

export interface OsintIntent {
  countries: string[];         // ISO2 codes
  countriesIso3: string[];     // ISO3 codes
  subdivisions: string[];      // matched state/province/region names (as-typed casing preserved from lex)
  companies: string[];         // free-text company names
  entities: string[];          // wiki-able terms (countries + subdivisions + companies)
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

// ─── Full ISO 3166-1 lexicon ────────────────────────────────────────────────
// Every recognized sovereign state + widely-used dependent territory. Names
// use common aliases (e.g. "burma" → Myanmar, "cape verde" → Cabo Verde) so
// casual queries resolve. Matched with word-boundaries in detectIntent().
const COUNTRY_LEX: Array<{ names: string[]; iso2: string; iso3: string }> = [
  { names: ["afghanistan"], iso2: "AF", iso3: "AFG" },
  { names: ["albania"], iso2: "AL", iso3: "ALB" },
  { names: ["algeria"], iso2: "DZ", iso3: "DZA" },
  { names: ["andorra"], iso2: "AD", iso3: "AND" },
  { names: ["angola"], iso2: "AO", iso3: "AGO" },
  { names: ["antigua and barbuda", "antigua"], iso2: "AG", iso3: "ATG" },
  { names: ["argentina"], iso2: "AR", iso3: "ARG" },
  { names: ["armenia"], iso2: "AM", iso3: "ARM" },
  { names: ["australia"], iso2: "AU", iso3: "AUS" },
  { names: ["austria"], iso2: "AT", iso3: "AUT" },
  { names: ["azerbaijan"], iso2: "AZ", iso3: "AZE" },
  { names: ["bahamas"], iso2: "BS", iso3: "BHS" },
  { names: ["bahrain"], iso2: "BH", iso3: "BHR" },
  { names: ["bangladesh"], iso2: "BD", iso3: "BGD" },
  { names: ["barbados"], iso2: "BB", iso3: "BRB" },
  { names: ["belarus"], iso2: "BY", iso3: "BLR" },
  { names: ["belgium"], iso2: "BE", iso3: "BEL" },
  { names: ["belize"], iso2: "BZ", iso3: "BLZ" },
  { names: ["benin"], iso2: "BJ", iso3: "BEN" },
  { names: ["bhutan"], iso2: "BT", iso3: "BTN" },
  { names: ["bolivia"], iso2: "BO", iso3: "BOL" },
  { names: ["bosnia and herzegovina", "bosnia"], iso2: "BA", iso3: "BIH" },
  { names: ["botswana"], iso2: "BW", iso3: "BWA" },
  { names: ["brazil"], iso2: "BR", iso3: "BRA" },
  { names: ["brunei"], iso2: "BN", iso3: "BRN" },
  { names: ["bulgaria"], iso2: "BG", iso3: "BGR" },
  { names: ["burkina faso"], iso2: "BF", iso3: "BFA" },
  { names: ["burundi"], iso2: "BI", iso3: "BDI" },
  { names: ["cabo verde", "cape verde"], iso2: "CV", iso3: "CPV" },
  { names: ["cambodia"], iso2: "KH", iso3: "KHM" },
  { names: ["cameroon"], iso2: "CM", iso3: "CMR" },
  { names: ["canada"], iso2: "CA", iso3: "CAN" },
  { names: ["central african republic", "car"], iso2: "CF", iso3: "CAF" },
  { names: ["chad"], iso2: "TD", iso3: "TCD" },
  { names: ["chile"], iso2: "CL", iso3: "CHL" },
  { names: ["china", "prc", "mainland china"], iso2: "CN", iso3: "CHN" },
  { names: ["colombia"], iso2: "CO", iso3: "COL" },
  { names: ["comoros"], iso2: "KM", iso3: "COM" },
  { names: ["congo", "republic of the congo", "congo-brazzaville"], iso2: "CG", iso3: "COG" },
  { names: ["democratic republic of the congo", "drc", "dr congo", "congo-kinshasa"], iso2: "CD", iso3: "COD" },
  { names: ["costa rica"], iso2: "CR", iso3: "CRI" },
  { names: ["ivory coast", "cote d'ivoire", "côte d'ivoire"], iso2: "CI", iso3: "CIV" },
  { names: ["croatia"], iso2: "HR", iso3: "HRV" },
  { names: ["cuba"], iso2: "CU", iso3: "CUB" },
  { names: ["cyprus"], iso2: "CY", iso3: "CYP" },
  { names: ["czech republic", "czechia"], iso2: "CZ", iso3: "CZE" },
  { names: ["denmark"], iso2: "DK", iso3: "DNK" },
  { names: ["djibouti"], iso2: "DJ", iso3: "DJI" },
  { names: ["dominica"], iso2: "DM", iso3: "DMA" },
  { names: ["dominican republic"], iso2: "DO", iso3: "DOM" },
  { names: ["ecuador"], iso2: "EC", iso3: "ECU" },
  { names: ["egypt"], iso2: "EG", iso3: "EGY" },
  { names: ["el salvador"], iso2: "SV", iso3: "SLV" },
  { names: ["equatorial guinea"], iso2: "GQ", iso3: "GNQ" },
  { names: ["eritrea"], iso2: "ER", iso3: "ERI" },
  { names: ["estonia"], iso2: "EE", iso3: "EST" },
  { names: ["eswatini", "swaziland"], iso2: "SZ", iso3: "SWZ" },
  { names: ["ethiopia"], iso2: "ET", iso3: "ETH" },
  { names: ["fiji"], iso2: "FJ", iso3: "FJI" },
  { names: ["finland"], iso2: "FI", iso3: "FIN" },
  { names: ["france"], iso2: "FR", iso3: "FRA" },
  { names: ["gabon"], iso2: "GA", iso3: "GAB" },
  { names: ["gambia"], iso2: "GM", iso3: "GMB" },
  { names: ["georgia"], iso2: "GE", iso3: "GEO" },
  { names: ["germany"], iso2: "DE", iso3: "DEU" },
  { names: ["ghana"], iso2: "GH", iso3: "GHA" },
  { names: ["greece"], iso2: "GR", iso3: "GRC" },
  { names: ["grenada"], iso2: "GD", iso3: "GRD" },
  { names: ["guatemala"], iso2: "GT", iso3: "GTM" },
  { names: ["guinea"], iso2: "GN", iso3: "GIN" },
  { names: ["guinea-bissau"], iso2: "GW", iso3: "GNB" },
  { names: ["guyana"], iso2: "GY", iso3: "GUY" },
  { names: ["haiti"], iso2: "HT", iso3: "HTI" },
  { names: ["honduras"], iso2: "HN", iso3: "HND" },
  { names: ["hong kong"], iso2: "HK", iso3: "HKG" },
  { names: ["hungary"], iso2: "HU", iso3: "HUN" },
  { names: ["iceland"], iso2: "IS", iso3: "ISL" },
  { names: ["india"], iso2: "IN", iso3: "IND" },
  { names: ["indonesia"], iso2: "ID", iso3: "IDN" },
  { names: ["iran"], iso2: "IR", iso3: "IRN" },
  { names: ["iraq"], iso2: "IQ", iso3: "IRQ" },
  { names: ["ireland"], iso2: "IE", iso3: "IRL" },
  { names: ["israel"], iso2: "IL", iso3: "ISR" },
  { names: ["italy"], iso2: "IT", iso3: "ITA" },
  { names: ["jamaica"], iso2: "JM", iso3: "JAM" },
  { names: ["japan"], iso2: "JP", iso3: "JPN" },
  { names: ["jordan"], iso2: "JO", iso3: "JOR" },
  { names: ["kazakhstan"], iso2: "KZ", iso3: "KAZ" },
  { names: ["kenya"], iso2: "KE", iso3: "KEN" },
  { names: ["kiribati"], iso2: "KI", iso3: "KIR" },
  { names: ["kosovo"], iso2: "XK", iso3: "XKX" },
  { names: ["kuwait"], iso2: "KW", iso3: "KWT" },
  { names: ["kyrgyzstan"], iso2: "KG", iso3: "KGZ" },
  { names: ["laos"], iso2: "LA", iso3: "LAO" },
  { names: ["latvia"], iso2: "LV", iso3: "LVA" },
  { names: ["lebanon"], iso2: "LB", iso3: "LBN" },
  { names: ["lesotho"], iso2: "LS", iso3: "LSO" },
  { names: ["liberia"], iso2: "LR", iso3: "LBR" },
  { names: ["libya"], iso2: "LY", iso3: "LBY" },
  { names: ["liechtenstein"], iso2: "LI", iso3: "LIE" },
  { names: ["lithuania"], iso2: "LT", iso3: "LTU" },
  { names: ["luxembourg"], iso2: "LU", iso3: "LUX" },
  { names: ["macao", "macau"], iso2: "MO", iso3: "MAC" },
  { names: ["madagascar"], iso2: "MG", iso3: "MDG" },
  { names: ["malawi"], iso2: "MW", iso3: "MWI" },
  { names: ["malaysia"], iso2: "MY", iso3: "MYS" },
  { names: ["maldives"], iso2: "MV", iso3: "MDV" },
  { names: ["mali"], iso2: "ML", iso3: "MLI" },
  { names: ["malta"], iso2: "MT", iso3: "MLT" },
  { names: ["marshall islands"], iso2: "MH", iso3: "MHL" },
  { names: ["mauritania"], iso2: "MR", iso3: "MRT" },
  { names: ["mauritius"], iso2: "MU", iso3: "MUS" },
  { names: ["mexico"], iso2: "MX", iso3: "MEX" },
  { names: ["micronesia"], iso2: "FM", iso3: "FSM" },
  { names: ["moldova"], iso2: "MD", iso3: "MDA" },
  { names: ["monaco"], iso2: "MC", iso3: "MCO" },
  { names: ["mongolia"], iso2: "MN", iso3: "MNG" },
  { names: ["montenegro"], iso2: "ME", iso3: "MNE" },
  { names: ["morocco"], iso2: "MA", iso3: "MAR" },
  { names: ["mozambique"], iso2: "MZ", iso3: "MOZ" },
  { names: ["myanmar", "burma"], iso2: "MM", iso3: "MMR" },
  { names: ["namibia"], iso2: "NA", iso3: "NAM" },
  { names: ["nauru"], iso2: "NR", iso3: "NRU" },
  { names: ["nepal"], iso2: "NP", iso3: "NPL" },
  { names: ["netherlands", "holland"], iso2: "NL", iso3: "NLD" },
  { names: ["new zealand"], iso2: "NZ", iso3: "NZL" },
  { names: ["nicaragua"], iso2: "NI", iso3: "NIC" },
  { names: ["niger"], iso2: "NE", iso3: "NER" },
  { names: ["nigeria"], iso2: "NG", iso3: "NGA" },
  { names: ["north korea", "dprk"], iso2: "KP", iso3: "PRK" },
  { names: ["north macedonia", "macedonia"], iso2: "MK", iso3: "MKD" },
  { names: ["norway"], iso2: "NO", iso3: "NOR" },
  { names: ["oman"], iso2: "OM", iso3: "OMN" },
  { names: ["pakistan"], iso2: "PK", iso3: "PAK" },
  { names: ["palau"], iso2: "PW", iso3: "PLW" },
  { names: ["palestine", "palestinian territories", "gaza", "west bank"], iso2: "PS", iso3: "PSE" },
  { names: ["panama"], iso2: "PA", iso3: "PAN" },
  { names: ["papua new guinea"], iso2: "PG", iso3: "PNG" },
  { names: ["paraguay"], iso2: "PY", iso3: "PRY" },
  { names: ["peru"], iso2: "PE", iso3: "PER" },
  { names: ["philippines"], iso2: "PH", iso3: "PHL" },
  { names: ["poland"], iso2: "PL", iso3: "POL" },
  { names: ["portugal"], iso2: "PT", iso3: "PRT" },
  { names: ["puerto rico"], iso2: "PR", iso3: "PRI" },
  { names: ["qatar"], iso2: "QA", iso3: "QAT" },
  { names: ["romania"], iso2: "RO", iso3: "ROU" },
  { names: ["russia", "russian federation"], iso2: "RU", iso3: "RUS" },
  { names: ["rwanda"], iso2: "RW", iso3: "RWA" },
  { names: ["saint kitts and nevis"], iso2: "KN", iso3: "KNA" },
  { names: ["saint lucia"], iso2: "LC", iso3: "LCA" },
  { names: ["saint vincent and the grenadines"], iso2: "VC", iso3: "VCT" },
  { names: ["samoa"], iso2: "WS", iso3: "WSM" },
  { names: ["san marino"], iso2: "SM", iso3: "SMR" },
  { names: ["sao tome and principe", "são tomé and príncipe"], iso2: "ST", iso3: "STP" },
  { names: ["saudi arabia", "ksa"], iso2: "SA", iso3: "SAU" },
  { names: ["senegal"], iso2: "SN", iso3: "SEN" },
  { names: ["serbia"], iso2: "RS", iso3: "SRB" },
  { names: ["seychelles"], iso2: "SC", iso3: "SYC" },
  { names: ["sierra leone"], iso2: "SL", iso3: "SLE" },
  { names: ["singapore"], iso2: "SG", iso3: "SGP" },
  { names: ["slovakia"], iso2: "SK", iso3: "SVK" },
  { names: ["slovenia"], iso2: "SI", iso3: "SVN" },
  { names: ["solomon islands"], iso2: "SB", iso3: "SLB" },
  { names: ["somalia"], iso2: "SO", iso3: "SOM" },
  { names: ["south africa"], iso2: "ZA", iso3: "ZAF" },
  { names: ["south korea", "korea", "republic of korea"], iso2: "KR", iso3: "KOR" },
  { names: ["south sudan"], iso2: "SS", iso3: "SSD" },
  { names: ["spain"], iso2: "ES", iso3: "ESP" },
  { names: ["sri lanka"], iso2: "LK", iso3: "LKA" },
  { names: ["sudan"], iso2: "SD", iso3: "SDN" },
  { names: ["suriname"], iso2: "SR", iso3: "SUR" },
  { names: ["sweden"], iso2: "SE", iso3: "SWE" },
  { names: ["switzerland"], iso2: "CH", iso3: "CHE" },
  { names: ["syria"], iso2: "SY", iso3: "SYR" },
  { names: ["taiwan"], iso2: "TW", iso3: "TWN" },
  { names: ["tajikistan"], iso2: "TJ", iso3: "TJK" },
  { names: ["tanzania"], iso2: "TZ", iso3: "TZA" },
  { names: ["thailand"], iso2: "TH", iso3: "THA" },
  { names: ["timor-leste", "east timor"], iso2: "TL", iso3: "TLS" },
  { names: ["togo"], iso2: "TG", iso3: "TGO" },
  { names: ["tonga"], iso2: "TO", iso3: "TON" },
  { names: ["trinidad and tobago"], iso2: "TT", iso3: "TTO" },
  { names: ["tunisia"], iso2: "TN", iso3: "TUN" },
  { names: ["turkey", "türkiye"], iso2: "TR", iso3: "TUR" },
  { names: ["turkmenistan"], iso2: "TM", iso3: "TKM" },
  { names: ["tuvalu"], iso2: "TV", iso3: "TUV" },
  { names: ["uganda"], iso2: "UG", iso3: "UGA" },
  { names: ["ukraine"], iso2: "UA", iso3: "UKR" },
  { names: ["united arab emirates", "uae"], iso2: "AE", iso3: "ARE" },
  { names: ["united kingdom", "uk", "britain", "great britain"], iso2: "GB", iso3: "GBR" },
  { names: ["united states", "usa", "u.s.", "u.s.a.", "america"], iso2: "US", iso3: "USA" },
  { names: ["uruguay"], iso2: "UY", iso3: "URY" },
  { names: ["uzbekistan"], iso2: "UZ", iso3: "UZB" },
  { names: ["vanuatu"], iso2: "VU", iso3: "VUT" },
  { names: ["vatican city", "holy see"], iso2: "VA", iso3: "VAT" },
  { names: ["venezuela"], iso2: "VE", iso3: "VEN" },
  { names: ["vietnam"], iso2: "VN", iso3: "VNM" },
  { names: ["yemen"], iso2: "YE", iso3: "YEM" },
  { names: ["zambia"], iso2: "ZM", iso3: "ZMB" },
  { names: ["zimbabwe"], iso2: "ZW", iso3: "ZWE" },
];

// ─── Subdivision lexicon ────────────────────────────────────────────────────
// Maps well-known first-order subdivisions (US states, Canadian provinces,
// Mexican states, UK constituent countries, German Länder, Indian states,
// Chinese provinces & regions, Russian federal subjects, Brazilian states,
// Australian states, Japanese prefectures, French regions) to their parent
// ISO country. Matching a subdivision automatically pulls the parent
// country's macro/trade data AND runs a Wikipedia + GDELT lookup on the
// subdivision name itself.
const SUBDIVISION_LEX: Array<{ name: string; parentIso2: string }> = [
  // United States — 50 states + DC
  ...["alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas","utah","vermont","virginia","washington state","west virginia","wisconsin","wyoming","district of columbia","washington dc"].map((n) => ({ name: n, parentIso2: "US" })),
  // Canada — provinces + territories
  ...["ontario","quebec","québec","british columbia","alberta","manitoba","saskatchewan","nova scotia","new brunswick","newfoundland and labrador","prince edward island","yukon","northwest territories","nunavut"].map((n) => ({ name: n, parentIso2: "CA" })),
  // UK constituent countries
  ...["england","scotland","wales","northern ireland"].map((n) => ({ name: n, parentIso2: "GB" })),
  // Germany — 16 Länder
  ...["bavaria","bayern","baden-württemberg","baden-wurttemberg","berlin","brandenburg","bremen","hamburg","hesse","hessen","lower saxony","niedersachsen","mecklenburg-vorpommern","north rhine-westphalia","nordrhein-westfalen","rhineland-palatinate","rheinland-pfalz","saarland","saxony","sachsen","saxony-anhalt","sachsen-anhalt","schleswig-holstein","thuringia","thüringen"].map((n) => ({ name: n, parentIso2: "DE" })),
  // France — regions
  ...["île-de-france","ile-de-france","provence-alpes-côte d'azur","auvergne-rhône-alpes","occitanie","nouvelle-aquitaine","hauts-de-france","grand est","bretagne","normandie","pays de la loire","centre-val de loire","bourgogne-franche-comté","corse","corsica"].map((n) => ({ name: n, parentIso2: "FR" })),
  // Australia — states + territories
  ...["new south wales","victoria","queensland","western australia","south australia","tasmania","australian capital territory","northern territory"].map((n) => ({ name: n, parentIso2: "AU" })),
  // India — states + UTs (top)
  ...["andhra pradesh","arunachal pradesh","assam","bihar","chhattisgarh","goa","gujarat","haryana","himachal pradesh","jharkhand","karnataka","kerala","madhya pradesh","maharashtra","manipur","meghalaya","mizoram","nagaland","odisha","punjab","rajasthan","sikkim","tamil nadu","telangana","tripura","uttar pradesh","uttarakhand","west bengal","delhi","jammu and kashmir","ladakh"].map((n) => ({ name: n, parentIso2: "IN" })),
  // China — provinces, autonomous regions, municipalities
  ...["anhui","fujian","gansu","guangdong","guizhou","hainan","hebei","heilongjiang","henan","hubei","hunan","jiangsu","jiangxi","jilin","liaoning","qinghai","shaanxi","shandong","shanxi","sichuan","yunnan","zhejiang","guangxi","inner mongolia","ningxia","tibet","xinjiang","beijing","shanghai","tianjin","chongqing"].map((n) => ({ name: n, parentIso2: "CN" })),
  // Russia — major federal subjects
  ...["moscow","saint petersburg","st petersburg","tatarstan","chechnya","dagestan","bashkortostan","krasnodar krai","primorsky krai","sakhalin","siberia","crimea","donetsk","luhansk","kaliningrad","volgograd","yekaterinburg","novosibirsk","kamchatka","murmansk"].map((n) => ({ name: n, parentIso2: "RU" })),
  // Brazil — states
  ...["acre","alagoas","amapá","amazonas","bahia","ceará","espírito santo","goiás","maranhão","mato grosso","mato grosso do sul","minas gerais","pará","paraíba","paraná","pernambuco","piauí","rio de janeiro","rio grande do norte","rio grande do sul","rondônia","roraima","santa catarina","são paulo","sergipe","tocantins","distrito federal"].map((n) => ({ name: n, parentIso2: "BR" })),
  // Mexico — states
  ...["aguascalientes","baja california","baja california sur","campeche","chiapas","chihuahua","coahuila","colima","durango","guanajuato","guerrero","hidalgo","jalisco","estado de méxico","michoacán","morelos","nayarit","nuevo león","oaxaca","puebla","querétaro","quintana roo","san luis potosí","sinaloa","sonora","tabasco","tamaulipas","tlaxcala","veracruz","yucatán","zacatecas","mexico city","ciudad de méxico","cdmx"].map((n) => ({ name: n, parentIso2: "MX" })),
  // Japan — major prefectures
  ...["tokyo","osaka","kyoto","hokkaido","okinawa","fukuoka","aichi","hiroshima","nagoya","sendai","kobe","yokohama","kanagawa","chiba","saitama","hyogo","shizuoka","niigata","kumamoto","nagasaki","fukushima","miyagi"].map((n) => ({ name: n, parentIso2: "JP" })),
  // Ukraine — oblasts (conflict-relevant)
  ...["kyiv","kiev","kharkiv","odesa","odessa","lviv","dnipro","zaporizhzhia","mariupol","kherson","mykolaiv","chernihiv","sumy"].map((n) => ({ name: n, parentIso2: "UA" })),
  // Nigeria — top states
  ...["lagos","abuja","kano","rivers state","kaduna","oyo","imo","enugu","borno"].map((n) => ({ name: n, parentIso2: "NG" })),
  // Pakistan — provinces
  ...["punjab pakistan","sindh","balochistan","khyber pakhtunkhwa","gilgit-baltistan","azad kashmir"].map((n) => ({ name: n, parentIso2: "PK" })),
  // Indonesia — top provinces
  ...["java","jakarta","bali","sumatra","sulawesi","kalimantan","papua","west papua"].map((n) => ({ name: n, parentIso2: "ID" })),
];

export function detectIntent(text: string): OsintIntent {
  const q = text.toLowerCase();
  const countries: string[] = [];
  const countriesIso3: string[] = [];
  for (const c of COUNTRY_LEX) {
    const hit = c.names.some((n) => new RegExp(`(?:^|[^a-z])${escapeRe(n)}(?:$|[^a-z])`, "i").test(q));
    if (hit) {
      if (!countries.includes(c.iso2)) countries.push(c.iso2);
      if (!countriesIso3.includes(c.iso3)) countriesIso3.push(c.iso3);
    }
  }

  // Subdivision detection — matches state/province/oblast names and pulls the
  // parent country's macro/trade data automatically, plus its own Wiki/GDELT.
  const subdivisions: string[] = [];
  for (const s of SUBDIVISION_LEX) {
    if (new RegExp(`(?:^|[^a-z])${escapeRe(s.name)}(?:$|[^a-z])`, "i").test(q)) {
      subdivisions.push(s.name);
      const parent = COUNTRY_LEX.find((c) => c.iso2 === s.parentIso2);
      if (parent) {
        if (!countries.includes(parent.iso2)) countries.push(parent.iso2);
        if (!countriesIso3.includes(parent.iso3)) countriesIso3.push(parent.iso3);
      }
    }
  }

  // Company/entity detection is layered:
  //   (a) Explicit "for X" / "about X" / "of X" / "on X" tails.
  //   (b) Multi-word Proper Case phrases (two or more capitalised tokens).
  //   (c) Well-known ALL-CAPS acronyms (NATO, OPEC, WHO, IMF, UN, EU, NASA).
  const COMPANY_STOP = new Set([
    "the","and","for","with","from","about","what","who","why","how","when","where","which","that","this","these","those",
    "give","tell","show","find","list","need","want","help","make","take","said","track","latest","federal","power","new",
    "usa","sec","fda","dod","cia","fbi","irs","aureon","google","claude",
    ...COUNTRY_LEX.flatMap((c) => c.names.map((n) => n.replace(/\s+/g, ""))),
    ...SUBDIVISION_LEX.map((s) => s.name.replace(/[\s-]+/g, "")),
  ]);
  const KNOWN_ACRONYMS = new Set(["NATO","OPEC","WHO","IMF","UN","EU","NASA","OTAN","BRICS","G7","G20","ASEAN","AFRICOM","CENTCOM","NORAD","MOSSAD","GRU","FSB","MI6"]);

  const tailMatches = Array.from(text.matchAll(/\b(?:for|about|of|on|regarding)\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,3})\b/g)).map((m) => m[1].trim());
  const multiWordMatches = Array.from(text.matchAll(/\b([A-Z][a-z][A-Za-z0-9&.\-]+\s+[A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,2})\b/g)).map((m) => m[1].trim());
  const acronymMatches = Array.from(text.matchAll(/\b([A-Z]{2,6})\b/g)).map((m) => m[1]).filter((a) => KNOWN_ACRONYMS.has(a));

  const companyMatches = Array.from(new Set([...tailMatches, ...multiWordMatches, ...acronymMatches]))
    .filter((s) => s.length >= 3 && !COMPANY_STOP.has(s.toLowerCase().replace(/[\s-]+/g, "")))
    .slice(0, 3);

  const wantFilings = /\b(sec|10-?[kq]|8-?k|filing|earnings|ticker|nasdaq|nyse|insider|ownership)\b/.test(q) || companyMatches.length > 0;
  const wantAwards = /\b(contract|federal|award|grant|dod|pentagon|usaspending|procurement)\b/.test(q);
  const wantFX = /\b(currency|fx|exchange rate|forex|usd|eur|jpy|gbp|cny|rub|inflation|depreciation|collapse)\b/.test(q);
  const wantAircraft = /\b(aircraft|flight|jet|adsb|airspace|airplane|helicopter|air force|drone)\b/.test(q);
  const wantInfra = /\b(power plant|pipeline|port|base|military base|infrastructure|road|bridge|dam|refinery)\b/.test(q);
  const wantDrugs = /\b(drug|fda|pharma|vaccine|clinical|adverse event)\b/.test(q);
  const wantMacro = /\b(gdp|inflation|unemployment|debt|deficit|economy|macro|recession|growth)\b/.test(q) || countries.length > 0;
  const wantGDELT = /\b(news|breaking|reported|coverage|media|latest|today|this week|happening|crisis|conflict|war|protest|attack|sanctions)\b/.test(q) || countries.length > 0 || subdivisions.length > 0;
  const wantWiki = /\b(who is|what is|tell me about|profile of|background on|biography)\b/.test(q) || countries.length > 0 || subdivisions.length > 0 || companyMatches.length > 0;

  const drugs = wantDrugs ? Array.from(text.matchAll(/\b([A-Z][a-z]{3,})\b/g)).map((m) => m[1]).slice(0, 2) : [];

  // Prioritize subdivisions in entity list — user typed a specific state, so
  // Wikipedia/GDELT lookup on that name is more valuable than the parent country.
  const entities = [
    ...subdivisions,
    ...companyMatches,
    ...countries.map((c) => COUNTRY_LEX.find((x) => x.iso2 === c)!.names[0]),
  ].slice(0, 4);

  return {
    countries, countriesIso3, subdivisions,
    companies: companyMatches,
    entities,
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
    // Extra GDELT queries per matched subdivision so a "Bavaria" or "Sichuan"
    // query gets region-specific media, not just parent-country media.
    for (const sub of intent.subdivisions.slice(0, 2)) {
      jobs.push({ label: `GDELT:${sub}`, run: () => fetchGDELT(sub) });
    }
  }
  if (intent.wantWiki) {
    for (const e of intent.entities.slice(0, 3)) {
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
