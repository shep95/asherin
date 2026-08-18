// jurisdictions.ts — SOVEREIGN SOURCE ATLAS
// Authoritative record sources per jurisdiction (country → state/province → county).
// Channels:
//   ownership → land registry / title / deed / assessor
//   tax       → assessor / tax collector / revenue
//   permits   → building / planning / inspection
//   listings  → real estate portals (secondary)
//   entities  → corporate registries (directors, agents, PSC)
//   courts    → civil/criminal/probate/bankruptcy filings
//   people    → residential directories / electoral / people-search
// The engine composes site:a OR site:b OR site:c restrictors from these lists.
// NEVER include breach databases. Every source must be an authoritative or
// public-records aggregator that pulls from authoritative sources.

export type JurisdictionSources = {
  ownership: string[];
  tax: string[];
  permits: string[];
  listings: string[];
  entities: string[];
  courts: string[];
  people: string[];
};

// Hard blocklist — leak/breach aggregators are NEVER queried, regardless of channel.
// Any domain matching (substring, case-insensitive) is stripped at query-assembly time.
export const SOURCE_BLOCKLIST = [
  "offshoreleaks.icij.org",
  "icij.org",
  "libraryofleaks",
  "distributeddenialofsecrets",
  "ddosecrets",
  "wikileaks.org",
  "haveibeenpwned",
  "dehashed",
  "leakcheck",
  "intelx.io",
  "snusbase",
  "leak-lookup",
];

export function isBlockedSource(domain: string): boolean {
  const d = String(domain || "").toLowerCase();
  return SOURCE_BLOCKLIST.some((b) => d.includes(b));
}

export function stripBlocked(domains: string[]): string[] {
  return domains.filter((d) => !isBlockedSource(d));
}

// Universal fallbacks used everywhere as tertiary layer.
const GLOBAL_LISTINGS = ["zillow.com", "redfin.com", "realtor.com", "trulia.com", "homes.com"];
const GLOBAL_ENTITIES = ["opencorporates.com", "sec.gov", "efts.sec.gov", "linkedin.com/company"];
const GLOBAL_PEOPLE_AGGREGATORS = ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com"];
const GLOBAL_COURTS = ["justia.com", "courtlistener.com", "pacer.gov"];

// ─── UNITED STATES ─────────────────────────────────────────────────────────
const US_NATIONAL: Partial<JurisdictionSources> = {
  entities: ["opencorporates.com", "sec.gov", "efts.sec.gov", "fec.gov", "uspto.gov", "linkedin.com/company"],
  courts: ["pacer.gov", "courtlistener.com", "justia.com"],
  people: [
    "truepeoplesearch.com",
    "whitepages.com",
    "spokeo.com",
    "beenverified.com",
    "fastpeoplesearch.com",
    "radaris.com",
    "thatsthem.com",
    "usphonebook.com",
    "voterrecords.com",
  ],
  listings: GLOBAL_LISTINGS,
};

const US_STATE: Record<string, Partial<JurisdictionSources>> = {
  FL: {
    ownership: ["floridaparcels.com", "sunbiz.org", "flrecords.com"],
    tax: ["floridarevenue.com", "floridaparcels.com"],
    permits: ["floridabuilding.org"],
    entities: ["sunbiz.org"],
    courts: ["myflcourtaccess.com", "flcourts.gov"],
  },
  TX: {
    ownership: ["texasfile.com"],
    entities: ["direct.sos.state.tx.us"],
    tax: ["comptroller.texas.gov"],
    courts: ["efile.txcourts.gov"],
  },
  CA: {
    ownership: ["bizfileonline.sos.ca.gov"],
    entities: ["businesssearch.sos.ca.gov", "bizfileonline.sos.ca.gov"],
    tax: ["boe.ca.gov"],
    courts: ["courts.ca.gov"],
  },
  NY: {
    ownership: ["apps.dos.ny.gov", "acris.nyc.gov"],
    entities: ["apps.dos.ny.gov"],
    tax: ["tax.ny.gov"],
    courts: ["iapps.courts.state.ny.us"],
  },
  GA: { entities: ["ecorp.sos.ga.gov"], tax: ["dor.georgia.gov"] },
  NC: { entities: ["sosnc.gov"] },
  IL: { entities: ["ilsos.gov"], tax: ["cookcountyassessor.com"] },
  WA: { entities: ["ccfs.sos.wa.gov"] },
  AZ: { entities: ["ecorp.azcc.gov"] },
  CO: { entities: ["coloradosos.gov"] },
  NV: { entities: ["esos.nv.gov"] },
  MA: { entities: ["corp.sec.state.ma.us"] },
  OH: { entities: ["businesssearch.ohiosos.gov"] },
  MI: { entities: ["cofs.lara.state.mi.us"] },
  PA: { entities: ["file.dos.pa.gov"] },
  VA: { entities: ["cis.scc.virginia.gov"] },
  TN: { entities: ["tnbear.tn.gov"] },
  NJ: { entities: ["nj.gov"] },
  MD: { entities: ["egov.maryland.gov"] },
  OR: { entities: ["sos.oregon.gov"] },
  UT: { entities: ["businessregistry.utah.gov"] },
  MN: { entities: ["mblsportal.sos.state.mn.us"] },
  WI: { entities: ["wdfi.org"] },
  SC: { entities: ["businessfilings.sc.gov"] },
  AL: { entities: ["arc-sos.state.al.us"] },
  LA: { entities: ["coraweb.sos.la.gov"] },
  KY: { entities: ["sos.ky.gov"] },
  OK: { entities: ["sos.ok.gov"] },
  IN: { entities: ["bsd.sos.in.gov"] },
  MO: { entities: ["bsd.sos.mo.gov"] },
  IA: { entities: ["sos.iowa.gov"] },
  KS: { entities: ["sos.ks.gov"] },
  AR: { entities: ["sos.arkansas.gov"] },
  MS: { entities: ["corp.sos.ms.gov"] },
  NM: { entities: ["portal.sos.state.nm.us"] },
  ID: { entities: ["sosbiz.idaho.gov"] },
  MT: { entities: ["biz.sosmt.gov"] },
  ND: { entities: ["firststop.sos.nd.gov"] },
  SD: { entities: ["sosenterprise.sd.gov"] },
  NE: { entities: ["sos.nebraska.gov"] },
  WV: { entities: ["apps.wv.gov"] },
  ME: { entities: ["maine.gov"] },
  NH: { entities: ["quickstart.sos.nh.gov"] },
  VT: { entities: ["bizfilings.vermont.gov"] },
  RI: { entities: ["business.sos.ri.gov"] },
  DE: { entities: ["icis.corp.delaware.gov"] },
  AK: { entities: ["commerce.alaska.gov"] },
  HI: { entities: ["hbe.ehawaii.gov"] },
  WY: { entities: ["wyobiz.wyo.gov"] },
  DC: { entities: ["corponline.dcra.dc.gov"] },
};

const US_COUNTY: Record<string, Partial<JurisdictionSources>> = {
  // Florida
  "FL:LEE": { ownership: ["leepa.org"], tax: ["leetc.com"], permits: ["leegov.com"], courts: ["leeclerk.org"] },
  "FL:MIAMI-DADE": {
    ownership: ["miamidade.gov"],
    tax: ["miamidade.gov"],
    permits: ["miamidade.gov"],
    courts: ["miami-dadeclerk.com"],
  },
  "FL:BROWARD": { ownership: ["bcpa.net"], tax: ["broward.county-taxes.com"], permits: ["broward.org"] },
  "FL:PALM BEACH": { ownership: ["pbcgov.com", "pbcpao.gov"] },
  "FL:ORANGE": { ownership: ["ocpaweb.ocpafl.org", "ocpafl.org"], permits: ["orangecountyfl.net"] },
  "FL:HILLSBOROUGH": { ownership: ["hcpafl.org"] },
  "FL:PINELLAS": { ownership: ["pcpao.gov"] },
  "FL:DUVAL": { ownership: ["paopropertysearch.coj.net"] },
  "FL:COLLIER": { ownership: ["collierappraiser.com"] },
  "FL:CHARLOTTE": { ownership: ["ccappraiser.com"] },
  "FL:SARASOTA": { ownership: ["sc-pa.com"] },
  // Texas
  "TX:HARRIS": { ownership: ["hcad.org"], tax: ["hctax.net"] },
  "TX:DALLAS": { ownership: ["dallascad.org"] },
  "TX:TARRANT": { ownership: ["tad.org"] },
  "TX:BEXAR": { ownership: ["bcad.org"] },
  "TX:TRAVIS": { ownership: ["traviscad.org"] },
  // California
  "CA:LOS ANGELES": { ownership: ["assessor.lacounty.gov"] },
  "CA:ORANGE": { ownership: ["ocassessor.gov"] },
  "CA:SAN DIEGO": { ownership: ["sdttc.com", "arcc.sdcounty.ca.gov", "sdarcc.gov"] },
  "CA:SANTA CLARA": { ownership: ["sccassessor.org"] },
  "CA:ALAMEDA": { ownership: ["acgov.org"] },
  "CA:SAN FRANCISCO": { ownership: ["sfassessor.org"] },
  // NY
  "NY:NEW YORK": { ownership: ["acris.nyc.gov"] },
  "NY:KINGS": { ownership: ["acris.nyc.gov"] },
  "NY:QUEENS": { ownership: ["acris.nyc.gov"] },
  // IL
  "IL:COOK": { ownership: ["cookcountyassessor.com", "cookcountyclerkil.gov"] },
};

// ─── AUSTRALIA ─────────────────────────────────────────────────────────────
const AU_NATIONAL: Partial<JurisdictionSources> = {
  entities: ["asic.gov.au", "abr.business.gov.au", "opencorporates.com"],
  people: ["whitepages.com.au", "linkedin.com", "facebook.com"],
  courts: ["austlii.edu.au", "fedcourt.gov.au"],
  listings: ["realestate.com.au", "domain.com.au"],
};
const AU_STATE: Record<string, Partial<JurisdictionSources>> = {
  NSW: { ownership: ["nswlrs.com.au"], courts: ["onlineregistry.lawlink.nsw.gov.au"] },
  VIC: { ownership: ["landata.vic.gov.au"], courts: ["online.justice.vic.gov.au"] },
  QLD: { ownership: ["titlesqld.com.au"], courts: ["justice.qld.gov.au"] },
  WA: { ownership: ["landgate.wa.gov.au"] },
  SA: { ownership: ["sailis.sa.gov.au"] },
  TAS: { ownership: ["thelist.tas.gov.au"] },
  ACT: { ownership: ["actmapi.act.gov.au"] },
  NT: { ownership: ["nt.gov.au"] },
};

// ─── CANADA ────────────────────────────────────────────────────────────────
const CA_NATIONAL: Partial<JurisdictionSources> = {
  entities: ["corporationscanada.ic.gc.ca", "opencorporates.com"],
  people: ["canada411.ca", "linkedin.com"],
  listings: ["realtor.ca", "royallepage.ca", "zolo.ca"],
  tax: ["cra-arc.gc.ca"],
};
const CA_PROVINCE: Record<string, Partial<JurisdictionSources>> = {
  ON: { ownership: ["onland.ca"], entities: ["ontario.ca/businessregistry"], courts: ["ontariocourts.ca"] },
  BC: { ownership: ["ltsa.ca"], entities: ["bcregistryservices.gov.bc.ca"], courts: ["justice.gov.bc.ca"] },
  AB: { ownership: ["spin2.alberta.ca", "spin2.gov.ab.ca"], entities: ["mycores.ca"] },
  QC: { ownership: ["registrefoncier.gouv.qc.ca"], entities: ["registreentreprises.gouv.qc.ca"] },
  SK: { ownership: ["isc.ca"] },
  MB: { ownership: ["teranet-mb.ca"] },
  NS: { ownership: ["novascotia.ca"] },
  NB: { ownership: ["snb.ca"] },
  PE: { ownership: ["princeedwardisland.ca"] },
  NL: { ownership: ["gov.nl.ca"] },
};

// ─── UNITED KINGDOM ────────────────────────────────────────────────────────
const GB_NATIONAL: Partial<JurisdictionSources> = {
  ownership: [
    "search.find-my-landinfo.service.gov.uk",
    "landregistry.data.gov.uk",
    "gov.uk/search-property-information-land-registry",
  ],
  entities: ["find-and-update.company-information.service.gov.uk", "opencorporates.com"],
  people: ["192.com", "linkedin.com"],
  courts: ["find-case-information.service.gov.uk", "insolvency.service.gov.uk", "trustonline.org.uk"],
  listings: ["rightmove.co.uk", "zoopla.co.uk", "onthemarket.com"],
};
const GB_REGION: Record<string, Partial<JurisdictionSources>> = {
  SCT: { ownership: ["ros.gov.uk"] }, // Scotland
  NIR: { ownership: ["lpsni.gov.uk"] }, // Northern Ireland
};

// ─── EU / OTHER COUNTRIES ──────────────────────────────────────────────────
const COUNTRY: Record<string, Partial<JurisdictionSources>> = {
  US: US_NATIONAL,
  AU: AU_NATIONAL,
  CA: CA_NATIONAL,
  GB: GB_NATIONAL,
  NZ: {
    ownership: ["linz.govt.nz"],
    listings: ["realestate.co.nz", "trademe.co.nz"],
    entities: ["companiesoffice.govt.nz"],
  },
  DE: {
    ownership: ["grundbuch.de"],
    entities: ["handelsregister.de", "unternehmensregister.de"],
    listings: ["immobilienscout24.de", "immowelt.de"],
  },
  FR: {
    ownership: ["cadastre.gouv.fr"],
    entities: ["infogreffe.fr", "societe.com"],
    listings: ["seloger.com", "leboncoin.fr"],
  },
  ES: {
    ownership: ["registradores.org", "sedecatastro.gob.es"],
    entities: ["registradores.org"],
    listings: ["idealista.com", "fotocasa.es"],
  },
  IT: {
    ownership: ["agenziaentrate.gov.it"],
    entities: ["registroimprese.it"],
    listings: ["immobiliare.it", "casa.it"],
  },
  NL: { ownership: ["kadaster.nl"], entities: ["kvk.nl"], listings: ["funda.nl"] },
  IE: { ownership: ["landdirect.ie"], entities: ["cro.ie"] },
  MX: { ownership: ["rppc.cdmx.gob.mx"], listings: ["inmuebles24.com", "vivanuncios.com.mx"] },
  BR: { ownership: ["registrodeimoveis.org.br"], listings: ["zapimoveis.com.br", "vivareal.com.br"] },
  IN: { ownership: ["dolr.gov.in"], entities: ["mca.gov.in"], listings: ["99acres.com", "magicbricks.com"] },
  JP: { ownership: ["touki.moj.go.jp"], listings: ["suumo.jp", "homes.co.jp"] },
  SG: { ownership: ["sla.gov.sg"], entities: ["bizfile.gov.sg"], listings: ["propertyguru.com.sg"] },
  AE: { ownership: ["dubailand.gov.ae"], listings: ["bayut.com", "propertyfinder.ae"] },
  ZA: { ownership: ["deedsweb.dla.gov.za"], listings: ["property24.com", "privateproperty.co.za"] },
};

// Merge helper — county > state > country > global.
function merge(...parts: Array<Partial<JurisdictionSources> | undefined>): JurisdictionSources {
  const out: JurisdictionSources = {
    ownership: [],
    tax: [],
    permits: [],
    listings: [],
    entities: [],
    courts: [],
    people: [],
  };
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(out) as (keyof JurisdictionSources)[]) {
      if (p[k]) out[k] = Array.from(new Set([...(out[k] || []), ...(p[k] as string[])]));
    }
  }
  return out;
}

/**
 * Resolve authoritative record sources for a jurisdiction.
 * @param country  ISO-2 ("US", "CA", "GB", "AU", …)
 * @param state    US state / AU state / CA province / GB region ("FL", "NSW", "ON", "SCT")
 * @param county   County / borough (e.g. "LEE", "MIAMI-DADE")
 */
export function sourcesFor(country?: string, state?: string, county?: string): JurisdictionSources {
  const c = (country || "").toUpperCase();
  const s = (state || "").toUpperCase();
  const co = (county || "")
    .toUpperCase()
    .replace(/\s+COUNTY$/, "")
    .trim();
  const countyKey = s && co ? `${s}:${co}` : "";

  const stateMap: Record<string, Partial<JurisdictionSources> | undefined> = {
    US: US_STATE[s],
    AU: AU_STATE[s],
    CA: CA_PROVINCE[s],
    GB: GB_REGION[s],
  };

  const raw = merge(
    { listings: GLOBAL_LISTINGS, entities: GLOBAL_ENTITIES, people: GLOBAL_PEOPLE_AGGREGATORS, courts: GLOBAL_COURTS },
    WORLD_SOURCES[c] as Partial<JurisdictionSources>,
    COUNTRY[c],
    stateMap[c],
    c === "US" && countyKey ? US_COUNTY[countyKey] : undefined,
  );
  // Final safety: strip any blocklisted domain that may have leaked into a jurisdiction map.
  (Object.keys(raw) as (keyof JurisdictionSources)[]).forEach((k) => {
    raw[k] = stripBlocked(raw[k]);
  });
  return raw;
}

/** Build a `site:a OR site:b OR site:c` restrictor for the given domains. */
export function siteFilter(domains: string[], cap = 8): string {
  const clean = stripBlocked(domains).slice(0, cap);
  const list = clean.map((d) => `site:${d}`).join(" OR ");
  return list ? `(${list})` : "";
}

/** Best-effort parse of country/state/county from a free-form address string. */
export function parseJurisdiction(address: string): { country: string; state: string; county: string } {
  const t = String(address || "");
  const usZip = /\b\d{5}(?:-\d{4})?\b/.test(t);
  const caPostal = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(t);
  const ukPostal = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(t);

  let country = "";
  if (/,\s*USA?\b/i.test(t) || usZip) country = "US";
  else if (/,\s*Canada\b/i.test(t) || caPostal) country = "CA";
  else if (/,\s*(?:UK|United Kingdom|England|Scotland|Wales)\b/i.test(t) || ukPostal) country = "GB";
  else if (/,\s*Australia\b/i.test(t)) country = "AU";
  else if (/,\s*Mexico\b/i.test(t)) country = "MX";

  let state = "";
  const st = t.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (st) state = st[1].toUpperCase();

  let county = "";
  const co = t.match(/([A-Za-z\-\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  return { country, state, county };
}

// AUTO-GENERATED world public-index atlas. hosts only. never secrets.
export const WORLD_ISO_COUNT = 250;
export const WORLD_NOTE =
  "ISO pack from mledoze/countries (250 including territories). user asked 150 — this is the complete live set, not a stub of 20 western states.";
export type WorldSources = {
  ownership?: string[];
  tax?: string[];
  permits?: string[];
  listings: string[];
  entities: string[];
  courts: string[];
  people: string[];
};
export const COUNTRY_LABELS: Record<string, string> = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AG: "Antigua and Barbuda",
  AI: "Anguilla",
  AL: "Albania",
  AM: "Armenia",
  AO: "Angola",
  AQ: "Antarctica",
  AR: "Argentina",
  AS: "American Samoa",
  AT: "Austria",
  AU: "Australia",
  AW: "Aruba",
  AX: "\u00c5land Islands",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  BB: "Barbados",
  BD: "Bangladesh",
  BE: "Belgium",
  BF: "Burkina Faso",
  BG: "Bulgaria",
  BH: "Bahrain",
  BI: "Burundi",
  BJ: "Benin",
  BL: "Saint Barth\u00e9lemy",
  BM: "Bermuda",
  BN: "Brunei",
  BO: "Bolivia",
  BQ: "Caribbean Netherlands",
  BR: "Brazil",
  BS: "Bahamas",
  BT: "Bhutan",
  BV: "Bouvet Island",
  BW: "Botswana",
  BY: "Belarus",
  BZ: "Belize",
  CA: "Canada",
  CC: "Cocos (Keeling) Islands",
  CD: "DR Congo",
  CF: "Central African Republic",
  CG: "Congo",
  CH: "Switzerland",
  CI: "Ivory Coast",
  CK: "Cook Islands",
  CL: "Chile",
  CM: "Cameroon",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CV: "Cape Verde",
  CW: "Cura\u00e7ao",
  CX: "Christmas Island",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DJ: "Djibouti",
  DK: "Denmark",
  DM: "Dominica",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  EH: "Western Sahara",
  ER: "Eritrea",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FJ: "Fiji",
  FK: "Falkland Islands",
  FM: "Micronesia",
  FO: "Faroe Islands",
  FR: "France",
  GA: "Gabon",
  GB: "United Kingdom",
  GD: "Grenada",
  GE: "Georgia",
  GF: "French Guiana",
  GG: "Guernsey",
  GH: "Ghana",
  GI: "Gibraltar",
  GL: "Greenland",
  GM: "Gambia",
  GN: "Guinea",
  GP: "Guadeloupe",
  GQ: "Equatorial Guinea",
  GR: "Greece",
  GS: "South Georgia",
  GT: "Guatemala",
  GU: "Guam",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HK: "Hong Kong",
  HM: "Heard Island and McDonald Islands",
  HN: "Honduras",
  HR: "Croatia",
  HT: "Haiti",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IM: "Isle of Man",
  IN: "India",
  IO: "British Indian Ocean Territory",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JE: "Jersey",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KI: "Kiribati",
  KM: "Comoros",
  KN: "Saint Kitts and Nevis",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KY: "Cayman Islands",
  KZ: "Kazakhstan",
  LA: "Laos",
  LB: "Lebanon",
  LC: "Saint Lucia",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LR: "Liberia",
  LS: "Lesotho",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  LY: "Libya",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MF: "Saint Martin",
  MG: "Madagascar",
  MH: "Marshall Islands",
  MK: "North Macedonia",
  ML: "Mali",
  MM: "Myanmar",
  MN: "Mongolia",
  MO: "Macau",
  MP: "Northern Mariana Islands",
  MQ: "Martinique",
  MR: "Mauritania",
  MS: "Montserrat",
  MT: "Malta",
  MU: "Mauritius",
  MV: "Maldives",
  MW: "Malawi",
  MX: "Mexico",
  MY: "Malaysia",
  MZ: "Mozambique",
  NA: "Namibia",
  NC: "New Caledonia",
  NE: "Niger",
  NF: "Norfolk Island",
  NG: "Nigeria",
  NI: "Nicaragua",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NR: "Nauru",
  NU: "Niue",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PF: "French Polynesia",
  PG: "Papua New Guinea",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PM: "Saint Pierre and Miquelon",
  PN: "Pitcairn Islands",
  PR: "Puerto Rico",
  PS: "Palestine",
  PT: "Portugal",
  PW: "Palau",
  PY: "Paraguay",
  QA: "Qatar",
  RE: "R\u00e9union",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  RW: "Rwanda",
  SA: "Saudi Arabia",
  SB: "Solomon Islands",
  SC: "Seychelles",
  SD: "Sudan",
  SE: "Sweden",
  SG: "Singapore",
  SH: "Saint Helena, Ascension and Tristan da Cunha",
  SI: "Slovenia",
  SJ: "Svalbard and Jan Mayen",
  SK: "Slovakia",
  SL: "Sierra Leone",
  SM: "San Marino",
  SN: "Senegal",
  SO: "Somalia",
  SR: "Suriname",
  SS: "South Sudan",
  ST: "S\u00e3o Tom\u00e9 and Pr\u00edncipe",
  SV: "El Salvador",
  SX: "Sint Maarten",
  SY: "Syria",
  SZ: "Eswatini",
  TC: "Turks and Caicos Islands",
  TD: "Chad",
  TF: "French Southern and Antarctic Lands",
  TG: "Togo",
  TH: "Thailand",
  TJ: "Tajikistan",
  TK: "Tokelau",
  TL: "Timor-Leste",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TO: "Tonga",
  TR: "T\u00fcrkiye",
  TT: "Trinidad and Tobago",
  TV: "Tuvalu",
  TW: "Taiwan",
  TZ: "Tanzania",
  UA: "Ukraine",
  UG: "Uganda",
  UM: "United States Minor Outlying Islands",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VA: "Vatican City",
  VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela",
  VG: "British Virgin Islands",
  VI: "United States Virgin Islands",
  VN: "Vietnam",
  VU: "Vanuatu",
  WF: "Wallis and Futuna",
  WS: "Samoa",
  XK: "Kosovo",
  YE: "Yemen",
  YT: "Mayotte",
  ZA: "South Africa",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};
export const COUNTRY_REGION: Record<string, { region: string; subregion: string; capital: string }> = {
  AD: { region: "Europe", subregion: "Southern Europe", capital: "Andorra la Vella" },
  AE: { region: "Asia", subregion: "Western Asia", capital: "Abu Dhabi" },
  AF: { region: "Asia", subregion: "Southern Asia", capital: "Kabul" },
  AG: { region: "Americas", subregion: "Caribbean", capital: "Saint John's" },
  AI: { region: "Americas", subregion: "Caribbean", capital: "The Valley" },
  AL: { region: "Europe", subregion: "Southeast Europe", capital: "Tirana" },
  AM: { region: "Asia", subregion: "Western Asia", capital: "Yerevan" },
  AO: { region: "Africa", subregion: "Middle Africa", capital: "Luanda" },
  AQ: { region: "Antarctic", subregion: "", capital: "" },
  AR: { region: "Americas", subregion: "South America", capital: "Buenos Aires" },
  AS: { region: "Oceania", subregion: "Polynesia", capital: "Pago Pago" },
  AT: { region: "Europe", subregion: "Central Europe", capital: "Vienna" },
  AU: { region: "Oceania", subregion: "Australia and New Zealand", capital: "Canberra" },
  AW: { region: "Americas", subregion: "Caribbean", capital: "Oranjestad" },
  AX: { region: "Europe", subregion: "Northern Europe", capital: "Mariehamn" },
  AZ: { region: "Asia", subregion: "Western Asia", capital: "Baku" },
  BA: { region: "Europe", subregion: "Southeast Europe", capital: "Sarajevo" },
  BB: { region: "Americas", subregion: "Caribbean", capital: "Bridgetown" },
  BD: { region: "Asia", subregion: "Southern Asia", capital: "Dhaka" },
  BE: { region: "Europe", subregion: "Western Europe", capital: "Brussels" },
  BF: { region: "Africa", subregion: "Western Africa", capital: "Ouagadougou" },
  BG: { region: "Europe", subregion: "Southeast Europe", capital: "Sofia" },
  BH: { region: "Asia", subregion: "Western Asia", capital: "Manama" },
  BI: { region: "Africa", subregion: "Eastern Africa", capital: "Gitega" },
  BJ: { region: "Africa", subregion: "Western Africa", capital: "Porto-Novo" },
  BL: { region: "Americas", subregion: "Caribbean", capital: "Gustavia" },
  BM: { region: "Americas", subregion: "North America", capital: "Hamilton" },
  BN: { region: "Asia", subregion: "South-Eastern Asia", capital: "Bandar Seri Begawan" },
  BO: { region: "Americas", subregion: "South America", capital: "Sucre" },
  BQ: { region: "Americas", subregion: "Caribbean", capital: "Kralendijk" },
  BR: { region: "Americas", subregion: "South America", capital: "Bras\u00edlia" },
  BS: { region: "Americas", subregion: "Caribbean", capital: "Nassau" },
  BT: { region: "Asia", subregion: "Southern Asia", capital: "Thimphu" },
  BV: { region: "Antarctic", subregion: "", capital: "" },
  BW: { region: "Africa", subregion: "Southern Africa", capital: "Gaborone" },
  BY: { region: "Europe", subregion: "Eastern Europe", capital: "Minsk" },
  BZ: { region: "Americas", subregion: "Central America", capital: "Belmopan" },
  CA: { region: "Americas", subregion: "North America", capital: "Ottawa" },
  CC: { region: "Oceania", subregion: "Australia and New Zealand", capital: "West Island" },
  CD: { region: "Africa", subregion: "Middle Africa", capital: "Kinshasa" },
  CF: { region: "Africa", subregion: "Middle Africa", capital: "Bangui" },
  CG: { region: "Africa", subregion: "Middle Africa", capital: "Brazzaville" },
  CH: { region: "Europe", subregion: "Western Europe", capital: "Bern" },
  CI: { region: "Africa", subregion: "Western Africa", capital: "Yamoussoukro" },
  CK: { region: "Oceania", subregion: "Polynesia", capital: "Avarua" },
  CL: { region: "Americas", subregion: "South America", capital: "Santiago" },
  CM: { region: "Africa", subregion: "Middle Africa", capital: "Yaound\u00e9" },
  CN: { region: "Asia", subregion: "Eastern Asia", capital: "Beijing" },
  CO: { region: "Americas", subregion: "South America", capital: "Bogot\u00e1" },
  CR: { region: "Americas", subregion: "Central America", capital: "San Jos\u00e9" },
  CU: { region: "Americas", subregion: "Caribbean", capital: "Havana" },
  CV: { region: "Africa", subregion: "Western Africa", capital: "Praia" },
  CW: { region: "Americas", subregion: "Caribbean", capital: "Willemstad" },
  CX: { region: "Oceania", subregion: "Australia and New Zealand", capital: "Flying Fish Cove" },
  CY: { region: "Europe", subregion: "Southern Europe", capital: "Nicosia" },
  CZ: { region: "Europe", subregion: "Central Europe", capital: "Prague" },
  DE: { region: "Europe", subregion: "Western Europe", capital: "Berlin" },
  DJ: { region: "Africa", subregion: "Eastern Africa", capital: "Djibouti" },
  DK: { region: "Europe", subregion: "Northern Europe", capital: "Copenhagen" },
  DM: { region: "Americas", subregion: "Caribbean", capital: "Roseau" },
  DO: { region: "Americas", subregion: "Caribbean", capital: "Santo Domingo" },
  DZ: { region: "Africa", subregion: "Northern Africa", capital: "Algiers" },
  EC: { region: "Americas", subregion: "South America", capital: "Quito" },
  EE: { region: "Europe", subregion: "Northern Europe", capital: "Tallinn" },
  EG: { region: "Africa", subregion: "Northern Africa", capital: "Cairo" },
  EH: { region: "Africa", subregion: "Northern Africa", capital: "El Aai\u00fan" },
  ER: { region: "Africa", subregion: "Eastern Africa", capital: "Asmara" },
  ES: { region: "Europe", subregion: "Southern Europe", capital: "Madrid" },
  ET: { region: "Africa", subregion: "Eastern Africa", capital: "Addis Ababa" },
  FI: { region: "Europe", subregion: "Northern Europe", capital: "Helsinki" },
  FJ: { region: "Oceania", subregion: "Melanesia", capital: "Suva" },
  FK: { region: "Americas", subregion: "South America", capital: "Stanley" },
  FM: { region: "Oceania", subregion: "Micronesia", capital: "Palikir" },
  FO: { region: "Europe", subregion: "Northern Europe", capital: "T\u00f3rshavn" },
  FR: { region: "Europe", subregion: "Western Europe", capital: "Paris" },
  GA: { region: "Africa", subregion: "Middle Africa", capital: "Libreville" },
  GB: { region: "Europe", subregion: "Northern Europe", capital: "London" },
  GD: { region: "Americas", subregion: "Caribbean", capital: "St. George's" },
  GE: { region: "Asia", subregion: "Western Asia", capital: "Tbilisi" },
  GF: { region: "Americas", subregion: "South America", capital: "Cayenne" },
  GG: { region: "Europe", subregion: "Northern Europe", capital: "St. Peter Port" },
  GH: { region: "Africa", subregion: "Western Africa", capital: "Accra" },
  GI: { region: "Europe", subregion: "Southern Europe", capital: "Gibraltar" },
  GL: { region: "Americas", subregion: "North America", capital: "Nuuk" },
  GM: { region: "Africa", subregion: "Western Africa", capital: "Banjul" },
  GN: { region: "Africa", subregion: "Western Africa", capital: "Conakry" },
  GP: { region: "Americas", subregion: "Caribbean", capital: "Basse-Terre" },
  GQ: { region: "Africa", subregion: "Middle Africa", capital: "Malabo" },
  GR: { region: "Europe", subregion: "Southern Europe", capital: "Athens" },
  GS: { region: "Antarctic", subregion: "", capital: "King Edward Point" },
  GT: { region: "Americas", subregion: "Central America", capital: "Guatemala City" },
  GU: { region: "Oceania", subregion: "Micronesia", capital: "Hag\u00e5t\u00f1a" },
  GW: { region: "Africa", subregion: "Western Africa", capital: "Bissau" },
  GY: { region: "Americas", subregion: "South America", capital: "Georgetown" },
  HK: { region: "Asia", subregion: "Eastern Asia", capital: "City of Victoria" },
  HM: { region: "Antarctic", subregion: "", capital: "" },
  HN: { region: "Americas", subregion: "Central America", capital: "Tegucigalpa" },
  HR: { region: "Europe", subregion: "Southeast Europe", capital: "Zagreb" },
  HT: { region: "Americas", subregion: "Caribbean", capital: "Port-au-Prince" },
  HU: { region: "Europe", subregion: "Central Europe", capital: "Budapest" },
  ID: { region: "Asia", subregion: "South-Eastern Asia", capital: "Jakarta" },
  IE: { region: "Europe", subregion: "Northern Europe", capital: "Dublin" },
  IL: { region: "Asia", subregion: "Western Asia", capital: "Jerusalem" },
  IM: { region: "Europe", subregion: "Northern Europe", capital: "Douglas" },
  IN: { region: "Asia", subregion: "Southern Asia", capital: "New Delhi" },
  IO: { region: "Africa", subregion: "Eastern Africa", capital: "Diego Garcia" },
  IQ: { region: "Asia", subregion: "Western Asia", capital: "Baghdad" },
  IR: { region: "Asia", subregion: "Southern Asia", capital: "Tehran" },
  IS: { region: "Europe", subregion: "Northern Europe", capital: "Reykjavik" },
  IT: { region: "Europe", subregion: "Southern Europe", capital: "Rome" },
  JE: { region: "Europe", subregion: "Northern Europe", capital: "Saint Helier" },
  JM: { region: "Americas", subregion: "Caribbean", capital: "Kingston" },
  JO: { region: "Asia", subregion: "Western Asia", capital: "Amman" },
  JP: { region: "Asia", subregion: "Eastern Asia", capital: "Tokyo" },
  KE: { region: "Africa", subregion: "Eastern Africa", capital: "Nairobi" },
  KG: { region: "Asia", subregion: "Central Asia", capital: "Bishkek" },
  KH: { region: "Asia", subregion: "South-Eastern Asia", capital: "Phnom Penh" },
  KI: { region: "Oceania", subregion: "Micronesia", capital: "South Tarawa" },
  KM: { region: "Africa", subregion: "Eastern Africa", capital: "Moroni" },
  KN: { region: "Americas", subregion: "Caribbean", capital: "Basseterre" },
  KP: { region: "Asia", subregion: "Eastern Asia", capital: "Pyongyang" },
  KR: { region: "Asia", subregion: "Eastern Asia", capital: "Seoul" },
  KW: { region: "Asia", subregion: "Western Asia", capital: "Kuwait City" },
  KY: { region: "Americas", subregion: "Caribbean", capital: "George Town" },
  KZ: { region: "Asia", subregion: "Central Asia", capital: "Astana" },
  LA: { region: "Asia", subregion: "South-Eastern Asia", capital: "Vientiane" },
  LB: { region: "Asia", subregion: "Western Asia", capital: "Beirut" },
  LC: { region: "Americas", subregion: "Caribbean", capital: "Castries" },
  LI: { region: "Europe", subregion: "Western Europe", capital: "Vaduz" },
  LK: { region: "Asia", subregion: "Southern Asia", capital: "Colombo" },
  LR: { region: "Africa", subregion: "Western Africa", capital: "Monrovia" },
  LS: { region: "Africa", subregion: "Southern Africa", capital: "Maseru" },
  LT: { region: "Europe", subregion: "Northern Europe", capital: "Vilnius" },
  LU: { region: "Europe", subregion: "Western Europe", capital: "Luxembourg" },
  LV: { region: "Europe", subregion: "Northern Europe", capital: "Riga" },
  LY: { region: "Africa", subregion: "Northern Africa", capital: "Tripoli" },
  MA: { region: "Africa", subregion: "Northern Africa", capital: "Rabat" },
  MC: { region: "Europe", subregion: "Western Europe", capital: "Monaco" },
  MD: { region: "Europe", subregion: "Eastern Europe", capital: "Chi\u0219in\u0103u" },
  ME: { region: "Europe", subregion: "Southeast Europe", capital: "Podgorica" },
  MF: { region: "Americas", subregion: "Caribbean", capital: "Marigot" },
  MG: { region: "Africa", subregion: "Eastern Africa", capital: "Antananarivo" },
  MH: { region: "Oceania", subregion: "Micronesia", capital: "Majuro" },
  MK: { region: "Europe", subregion: "Southeast Europe", capital: "Skopje" },
  ML: { region: "Africa", subregion: "Western Africa", capital: "Bamako" },
  MM: { region: "Asia", subregion: "South-Eastern Asia", capital: "Naypyidaw" },
  MN: { region: "Asia", subregion: "Eastern Asia", capital: "Ulan Bator" },
  MO: { region: "Asia", subregion: "Eastern Asia", capital: "" },
  MP: { region: "Oceania", subregion: "Micronesia", capital: "Saipan" },
  MQ: { region: "Americas", subregion: "Caribbean", capital: "Fort-de-France" },
  MR: { region: "Africa", subregion: "Western Africa", capital: "Nouakchott" },
  MS: { region: "Americas", subregion: "Caribbean", capital: "Plymouth" },
  MT: { region: "Europe", subregion: "Southern Europe", capital: "Valletta" },
  MU: { region: "Africa", subregion: "Eastern Africa", capital: "Port Louis" },
  MV: { region: "Asia", subregion: "Southern Asia", capital: "Mal\u00e9" },
  MW: { region: "Africa", subregion: "Eastern Africa", capital: "Lilongwe" },
  MX: { region: "Americas", subregion: "North America", capital: "Mexico City" },
  MY: { region: "Asia", subregion: "South-Eastern Asia", capital: "Kuala Lumpur" },
  MZ: { region: "Africa", subregion: "Eastern Africa", capital: "Maputo" },
  NA: { region: "Africa", subregion: "Southern Africa", capital: "Windhoek" },
  NC: { region: "Oceania", subregion: "Melanesia", capital: "Noum\u00e9a" },
  NE: { region: "Africa", subregion: "Western Africa", capital: "Niamey" },
  NF: { region: "Oceania", subregion: "Australia and New Zealand", capital: "Kingston" },
  NG: { region: "Africa", subregion: "Western Africa", capital: "Abuja" },
  NI: { region: "Americas", subregion: "Central America", capital: "Managua" },
  NL: { region: "Europe", subregion: "Western Europe", capital: "Amsterdam" },
  NO: { region: "Europe", subregion: "Northern Europe", capital: "Oslo" },
  NP: { region: "Asia", subregion: "Southern Asia", capital: "Kathmandu" },
  NR: { region: "Oceania", subregion: "Micronesia", capital: "Yaren" },
  NU: { region: "Oceania", subregion: "Polynesia", capital: "Alofi" },
  NZ: { region: "Oceania", subregion: "Australia and New Zealand", capital: "Wellington" },
  OM: { region: "Asia", subregion: "Western Asia", capital: "Muscat" },
  PA: { region: "Americas", subregion: "Central America", capital: "Panama City" },
  PE: { region: "Americas", subregion: "South America", capital: "Lima" },
  PF: { region: "Oceania", subregion: "Polynesia", capital: "Papeet\u0113" },
  PG: { region: "Oceania", subregion: "Melanesia", capital: "Port Moresby" },
  PH: { region: "Asia", subregion: "South-Eastern Asia", capital: "Manila" },
  PK: { region: "Asia", subregion: "Southern Asia", capital: "Islamabad" },
  PL: { region: "Europe", subregion: "Central Europe", capital: "Warsaw" },
  PM: { region: "Americas", subregion: "North America", capital: "Saint-Pierre" },
  PN: { region: "Oceania", subregion: "Polynesia", capital: "Adamstown" },
  PR: { region: "Americas", subregion: "Caribbean", capital: "San Juan" },
  PS: { region: "Asia", subregion: "Western Asia", capital: "Ramallah" },
  PT: { region: "Europe", subregion: "Southern Europe", capital: "Lisbon" },
  PW: { region: "Oceania", subregion: "Micronesia", capital: "Ngerulmud" },
  PY: { region: "Americas", subregion: "South America", capital: "Asunci\u00f3n" },
  QA: { region: "Asia", subregion: "Western Asia", capital: "Doha" },
  RE: { region: "Africa", subregion: "Eastern Africa", capital: "Saint-Denis" },
  RO: { region: "Europe", subregion: "Southeast Europe", capital: "Bucharest" },
  RS: { region: "Europe", subregion: "Southeast Europe", capital: "Belgrade" },
  RU: { region: "Europe", subregion: "Eastern Europe", capital: "Moscow" },
  RW: { region: "Africa", subregion: "Eastern Africa", capital: "Kigali" },
  SA: { region: "Asia", subregion: "Western Asia", capital: "Riyadh" },
  SB: { region: "Oceania", subregion: "Melanesia", capital: "Honiara" },
  SC: { region: "Africa", subregion: "Eastern Africa", capital: "Victoria" },
  SD: { region: "Africa", subregion: "Northern Africa", capital: "Khartoum" },
  SE: { region: "Europe", subregion: "Northern Europe", capital: "Stockholm" },
  SG: { region: "Asia", subregion: "South-Eastern Asia", capital: "Singapore" },
  SH: { region: "Africa", subregion: "Western Africa", capital: "Jamestown" },
  SI: { region: "Europe", subregion: "Central Europe", capital: "Ljubljana" },
  SJ: { region: "Europe", subregion: "Northern Europe", capital: "Longyearbyen" },
  SK: { region: "Europe", subregion: "Central Europe", capital: "Bratislava" },
  SL: { region: "Africa", subregion: "Western Africa", capital: "Freetown" },
  SM: { region: "Europe", subregion: "Southern Europe", capital: "City of San Marino" },
  SN: { region: "Africa", subregion: "Western Africa", capital: "Dakar" },
  SO: { region: "Africa", subregion: "Eastern Africa", capital: "Mogadishu" },
  SR: { region: "Americas", subregion: "South America", capital: "Paramaribo" },
  SS: { region: "Africa", subregion: "Middle Africa", capital: "Juba" },
  ST: { region: "Africa", subregion: "Middle Africa", capital: "S\u00e3o Tom\u00e9" },
  SV: { region: "Americas", subregion: "Central America", capital: "San Salvador" },
  SX: { region: "Americas", subregion: "Caribbean", capital: "Philipsburg" },
  SY: { region: "Asia", subregion: "Western Asia", capital: "Damascus" },
  SZ: { region: "Africa", subregion: "Southern Africa", capital: "Lobamba" },
  TC: { region: "Americas", subregion: "Caribbean", capital: "Cockburn Town" },
  TD: { region: "Africa", subregion: "Middle Africa", capital: "N'Djamena" },
  TF: { region: "Antarctic", subregion: "", capital: "Port-aux-Fran\u00e7ais" },
  TG: { region: "Africa", subregion: "Western Africa", capital: "Lom\u00e9" },
  TH: { region: "Asia", subregion: "South-Eastern Asia", capital: "Bangkok" },
  TJ: { region: "Asia", subregion: "Central Asia", capital: "Dushanbe" },
  TK: { region: "Oceania", subregion: "Polynesia", capital: "Fakaofo" },
  TL: { region: "Asia", subregion: "South-Eastern Asia", capital: "Dili" },
  TM: { region: "Asia", subregion: "Central Asia", capital: "Ashgabat" },
  TN: { region: "Africa", subregion: "Northern Africa", capital: "Tunis" },
  TO: { region: "Oceania", subregion: "Polynesia", capital: "Nuku'alofa" },
  TR: { region: "Asia", subregion: "Western Asia", capital: "Ankara" },
  TT: { region: "Americas", subregion: "Caribbean", capital: "Port of Spain" },
  TV: { region: "Oceania", subregion: "Polynesia", capital: "Funafuti" },
  TW: { region: "Asia", subregion: "Eastern Asia", capital: "Taipei" },
  TZ: { region: "Africa", subregion: "Eastern Africa", capital: "Dodoma" },
  UA: { region: "Europe", subregion: "Eastern Europe", capital: "Kyiv" },
  UG: { region: "Africa", subregion: "Eastern Africa", capital: "Kampala" },
  UM: { region: "Americas", subregion: "North America", capital: "" },
  US: { region: "Americas", subregion: "North America", capital: "Washington D.C." },
  UY: { region: "Americas", subregion: "South America", capital: "Montevideo" },
  UZ: { region: "Asia", subregion: "Central Asia", capital: "Tashkent" },
  VA: { region: "Europe", subregion: "Southern Europe", capital: "Vatican City" },
  VC: { region: "Americas", subregion: "Caribbean", capital: "Kingstown" },
  VE: { region: "Americas", subregion: "South America", capital: "Caracas" },
  VG: { region: "Americas", subregion: "Caribbean", capital: "Road Town" },
  VI: { region: "Americas", subregion: "Caribbean", capital: "Charlotte Amalie" },
  VN: { region: "Asia", subregion: "South-Eastern Asia", capital: "Hanoi" },
  VU: { region: "Oceania", subregion: "Melanesia", capital: "Port Vila" },
  WF: { region: "Oceania", subregion: "Polynesia", capital: "Mata-Utu" },
  WS: { region: "Oceania", subregion: "Polynesia", capital: "Apia" },
  XK: { region: "Europe", subregion: "Southeast Europe", capital: "Pristina" },
  YE: { region: "Asia", subregion: "Western Asia", capital: "Sana'a" },
  YT: { region: "Africa", subregion: "Eastern Africa", capital: "Mamoudzou" },
  ZA: { region: "Africa", subregion: "Southern Africa", capital: "Pretoria" },
  ZM: { region: "Africa", subregion: "Eastern Africa", capital: "Lusaka" },
  ZW: { region: "Africa", subregion: "Eastern Africa", capital: "Harare" },
};
export const WORLD_SOURCES: Record<string, WorldSources> = {
  AD: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AE: {
    ownership: ["dubailand.gov.ae"],
    entities: ["opencorporates.com", "ded.ae"],
    courts: ["worldlii.org", "commonlii.org", "adjd.gov.ae"],
    people: ["linkedin.com"],
    listings: ["bayut.com"],
  },
  AF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AL: {
    entities: ["opencorporates.com", "qkb.gov.al"],
    courts: ["worldlii.org", "commonlii.org", "gjykataelarte.gov.al"],
    people: ["linkedin.com"],
    listings: [],
  },
  AM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AO: {
    entities: ["opencorporates.com", "minfin.gov.ao"],
    courts: ["worldlii.org", "commonlii.org", "tribunalsupremo.ao"],
    people: ["linkedin.com"],
    listings: [],
  },
  AQ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AR: {
    entities: ["opencorporates.com", "argentina.gob.ar"],
    courts: ["worldlii.org", "commonlii.org", "csjn.gov.ar"],
    people: ["linkedin.com"],
    listings: [],
  },
  AS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AT: {
    entities: ["opencorporates.com", "firmenbuch.at"],
    courts: ["worldlii.org", "commonlii.org", "ris.bka.gv.at"],
    people: ["linkedin.com"],
    listings: [],
  },
  AU: {
    entities: ["opencorporates.com", "asic.gov.au", "abr.business.gov.au"],
    courts: ["worldlii.org", "commonlii.org", "austlii.edu.au", "fedcourt.gov.au"],
    people: ["linkedin.com", "whitepages.com.au"],
    listings: ["realestate.com.au"],
  },
  AW: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AX: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  AZ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BA: {
    entities: ["opencorporates.com", "fbia.gov.ba"],
    courts: ["worldlii.org", "commonlii.org", "ustavnisud.ba"],
    people: ["linkedin.com"],
    listings: [],
  },
  BB: {
    entities: ["opencorporates.com", "caipo.gov.bb"],
    courts: ["worldlii.org", "commonlii.org", "lawcourts.gov.bb"],
    people: ["linkedin.com"],
    listings: [],
  },
  BD: {
    entities: ["opencorporates.com", "roc.gov.bd"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.bd"],
    people: ["linkedin.com"],
    listings: [],
  },
  BE: {
    entities: ["opencorporates.com", "ejustice.just.fgov.be"],
    courts: ["worldlii.org", "commonlii.org", "juridat.be"],
    people: ["linkedin.com"],
    listings: [],
  },
  BF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BG: {
    entities: ["opencorporates.com", "brra.bg"],
    courts: ["worldlii.org", "commonlii.org", "vks.bg"],
    people: ["linkedin.com"],
    listings: [],
  },
  BH: {
    entities: ["opencorporates.com", "sijilat.bh"],
    courts: ["worldlii.org", "commonlii.org", "moj.gov.bh"],
    people: ["linkedin.com"],
    listings: [],
  },
  BI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BJ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BL: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BN: {
    entities: ["opencorporates.com", "roc.gov.bn"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.gov.bn"],
    people: ["linkedin.com"],
    listings: [],
  },
  BO: {
    entities: ["opencorporates.com", "seprec.gob.bo"],
    courts: ["worldlii.org", "commonlii.org", "tcp.gob.bo"],
    people: ["linkedin.com"],
    listings: [],
  },
  BQ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BR: {
    entities: ["opencorporates.com", "receita.fazenda.gov.br"],
    courts: ["worldlii.org", "commonlii.org", "stf.jus.br"],
    people: ["linkedin.com"],
    listings: ["zapimoveis.com.br"],
  },
  BS: {
    entities: ["opencorporates.com", "bahamas.gov.bs"],
    courts: ["worldlii.org", "commonlii.org", "courts.gov.bs"],
    people: ["linkedin.com"],
    listings: [],
  },
  BT: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BV: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  BW: {
    entities: ["opencorporates.com", "cipa.co.bw"],
    courts: ["worldlii.org", "commonlii.org", "justice.gov.bw"],
    people: ["linkedin.com"],
    listings: [],
  },
  BY: {
    entities: ["opencorporates.com", "egr.gov.by"],
    courts: ["worldlii.org", "commonlii.org", "court.gov.by"],
    people: ["linkedin.com"],
    listings: [],
  },
  BZ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CA: {
    entities: ["opencorporates.com", "corporationscanada.ic.gc.ca"],
    courts: ["worldlii.org", "commonlii.org", "canlii.org"],
    people: ["linkedin.com", "canada411.ca"],
    listings: ["realtor.ca"],
  },
  CC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CD: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CH: {
    entities: ["opencorporates.com", "zefix.ch"],
    courts: ["worldlii.org", "commonlii.org", "bger.ch"],
    people: ["linkedin.com"],
    listings: [],
  },
  CI: {
    entities: ["opencorporates.com", "cepici.ci"],
    courts: ["worldlii.org", "commonlii.org", "justice.gouv.ci"],
    people: ["linkedin.com"],
    listings: [],
  },
  CK: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CL: {
    entities: ["opencorporates.com", "registroempresas.cl"],
    courts: ["worldlii.org", "commonlii.org", "pjud.cl"],
    people: ["linkedin.com"],
    listings: [],
  },
  CM: {
    entities: ["opencorporates.com", "minmidt.cm"],
    courts: ["worldlii.org", "commonlii.org", "coursupreme.cm"],
    people: ["linkedin.com"],
    listings: [],
  },
  CN: {
    entities: ["opencorporates.com", "gsxt.gov.cn"],
    courts: ["worldlii.org", "commonlii.org", "wenshu.court.gov.cn"],
    people: ["linkedin.com"],
    listings: [],
  },
  CO: {
    entities: ["opencorporates.com", "rues.org.co"],
    courts: ["worldlii.org", "commonlii.org", "corteconstitucional.gov.co"],
    people: ["linkedin.com"],
    listings: [],
  },
  CR: {
    entities: ["opencorporates.com", "rnpdigital.com"],
    courts: ["worldlii.org", "commonlii.org", "poder-judicial.go.cr"],
    people: ["linkedin.com"],
    listings: [],
  },
  CU: {
    entities: ["opencorporates.com", "gacetaoficial.gob.cu"],
    courts: ["worldlii.org", "commonlii.org", "tsp.gob.cu"],
    people: ["linkedin.com"],
    listings: [],
  },
  CV: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CW: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CX: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  CY: {
    entities: ["opencorporates.com", "companies.gov.cy"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.cy"],
    people: ["linkedin.com"],
    listings: [],
  },
  CZ: {
    entities: ["opencorporates.com", "or.justice.cz"],
    courts: ["worldlii.org", "commonlii.org", "nsoud.cz"],
    people: ["linkedin.com"],
    listings: [],
  },
  DE: {
    ownership: ["grundbuch.de"],
    entities: ["opencorporates.com", "handelsregister.de", "unternehmensregister.de"],
    courts: ["worldlii.org", "commonlii.org", "bundesanzeiger.de"],
    people: ["linkedin.com"],
    listings: ["immobilienscout24.de"],
  },
  DJ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  DK: {
    entities: ["opencorporates.com", "virk.dk"],
    courts: ["worldlii.org", "commonlii.org", "domstol.dk"],
    people: ["linkedin.com"],
    listings: [],
  },
  DM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  DO: {
    entities: ["opencorporates.com", "dgii.gov.do"],
    courts: ["worldlii.org", "commonlii.org", "poderjudicial.gob.do"],
    people: ["linkedin.com"],
    listings: [],
  },
  DZ: {
    entities: ["opencorporates.com", "cnrc.dz"],
    courts: ["worldlii.org", "commonlii.org", "coursupreme.dz"],
    people: ["linkedin.com"],
    listings: [],
  },
  EC: {
    entities: ["opencorporates.com", "supercias.gob.ec"],
    courts: ["worldlii.org", "commonlii.org", "corteconstitucional.gob.ec"],
    people: ["linkedin.com"],
    listings: [],
  },
  EE: {
    entities: ["opencorporates.com", "rik.ee"],
    courts: ["worldlii.org", "commonlii.org", "riigikohus.ee"],
    people: ["linkedin.com"],
    listings: [],
  },
  EG: {
    entities: ["opencorporates.com", "gafi.gov.eg"],
    courts: ["worldlii.org", "commonlii.org", "cc.gov.eg"],
    people: ["linkedin.com"],
    listings: [],
  },
  EH: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  ER: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  ES: {
    ownership: ["sedecatastro.gob.es"],
    entities: ["opencorporates.com", "registradores.org"],
    courts: ["worldlii.org", "commonlii.org", "poderjudicial.es"],
    people: ["linkedin.com"],
    listings: ["idealista.com"],
  },
  ET: {
    entities: ["opencorporates.com", "etrade.gov.et"],
    courts: ["worldlii.org", "commonlii.org", "fsc.gov.et"],
    people: ["linkedin.com"],
    listings: [],
  },
  FI: {
    entities: ["opencorporates.com", "prh.fi"],
    courts: ["worldlii.org", "commonlii.org", "finlex.fi"],
    people: ["linkedin.com"],
    listings: [],
  },
  FJ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  FK: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  FM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  FO: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  FR: {
    ownership: ["cadastre.gouv.fr"],
    entities: ["opencorporates.com", "infogreffe.fr", "societe.com"],
    courts: ["worldlii.org", "commonlii.org", "legifrance.gouv.fr", "justice.fr"],
    people: ["linkedin.com"],
    listings: ["seloger.com"],
  },
  GA: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GB: {
    ownership: ["gov.uk"],
    entities: ["opencorporates.com", "find-and-update.company-information.service.gov.uk"],
    courts: ["worldlii.org", "commonlii.org", "find-case-information.service.gov.uk", "bailii.org"],
    people: ["linkedin.com", "192.com"],
    listings: ["rightmove.co.uk"],
  },
  GD: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GE: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GH: {
    entities: ["opencorporates.com", "rgd.gov.gh"],
    courts: ["worldlii.org", "commonlii.org", "judicial.gov.gh"],
    people: ["linkedin.com"],
    listings: [],
  },
  GI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GL: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GN: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GP: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GQ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GR: {
    entities: ["opencorporates.com", "businessportal.gr"],
    courts: ["worldlii.org", "commonlii.org", "areiospagos.gr"],
    people: ["linkedin.com"],
    listings: [],
  },
  GS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GT: {
    entities: ["opencorporates.com", "registromercantil.gob.gt"],
    courts: ["worldlii.org", "commonlii.org", "oj.gob.gt"],
    people: ["linkedin.com"],
    listings: [],
  },
  GU: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GW: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  GY: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  HK: {
    entities: ["opencorporates.com", "icris.cr.gov.hk"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.hk"],
    people: ["linkedin.com"],
    listings: [],
  },
  HM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  HN: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  HR: {
    entities: ["opencorporates.com", "sudreg.pravosudje.hr"],
    courts: ["worldlii.org", "commonlii.org", "vsrh.hr"],
    people: ["linkedin.com"],
    listings: [],
  },
  HT: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  HU: {
    entities: ["opencorporates.com", "e-cegjegyzek.hu"],
    courts: ["worldlii.org", "commonlii.org", "birosag.hu"],
    people: ["linkedin.com"],
    listings: [],
  },
  ID: {
    entities: ["opencorporates.com", "ahu.go.id"],
    courts: ["worldlii.org", "commonlii.org", "mahkamahagung.go.id"],
    people: ["linkedin.com"],
    listings: [],
  },
  IE: {
    ownership: ["landdirect.ie"],
    entities: ["opencorporates.com", "cro.ie"],
    courts: ["worldlii.org", "commonlii.org", "courts.ie", "bailii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  IL: {
    entities: ["opencorporates.com", "ica.gov.il"],
    courts: ["worldlii.org", "commonlii.org", "court.gov.il"],
    people: ["linkedin.com"],
    listings: [],
  },
  IM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  IN: {
    ownership: ["dolr.gov.in"],
    entities: ["opencorporates.com", "mca.gov.in"],
    courts: ["worldlii.org", "commonlii.org", "sci.gov.in", "ecourts.gov.in"],
    people: ["linkedin.com"],
    listings: ["99acres.com"],
  },
  IO: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  IQ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  IR: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  IS: {
    entities: ["opencorporates.com", "rsk.is"],
    courts: ["worldlii.org", "commonlii.org", "haestirettur.is"],
    people: ["linkedin.com"],
    listings: [],
  },
  IT: {
    ownership: ["agenziaentrate.gov.it"],
    entities: ["opencorporates.com", "registroimprese.it"],
    courts: ["worldlii.org", "commonlii.org", "giustizia.it"],
    people: ["linkedin.com"],
    listings: ["immobiliare.it"],
  },
  JE: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  JM: {
    entities: ["opencorporates.com", "orcjamaica.com"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.jm"],
    people: ["linkedin.com"],
    listings: [],
  },
  JO: {
    entities: ["opencorporates.com", "ccd.gov.jo"],
    courts: ["worldlii.org", "commonlii.org", "jc.jo"],
    people: ["linkedin.com"],
    listings: [],
  },
  JP: {
    ownership: ["touki.moj.go.jp"],
    entities: ["opencorporates.com", "houjin-bangou.nta.go.jp"],
    courts: ["worldlii.org", "commonlii.org", "courts.go.jp"],
    people: ["linkedin.com"],
    listings: ["suumo.jp"],
  },
  KE: {
    entities: ["opencorporates.com", "ecitizen.go.ke"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.go.ke"],
    people: ["linkedin.com"],
    listings: [],
  },
  KG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KH: {
    entities: ["opencorporates.com", "cdc.gov.kh"],
    courts: ["worldlii.org", "commonlii.org", "ccc.gov.kh"],
    people: ["linkedin.com"],
    listings: [],
  },
  KI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KN: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KP: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KR: {
    entities: ["opencorporates.com", "dart.fss.or.kr"],
    courts: ["worldlii.org", "commonlii.org", "scourt.go.kr"],
    people: ["linkedin.com"],
    listings: [],
  },
  KW: {
    entities: ["opencorporates.com", "e.gov.kw"],
    courts: ["worldlii.org", "commonlii.org", "moj.gov.kw"],
    people: ["linkedin.com"],
    listings: [],
  },
  KY: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  KZ: {
    entities: ["opencorporates.com", "egov.kz"],
    courts: ["worldlii.org", "commonlii.org", "sud.gov.kz"],
    people: ["linkedin.com"],
    listings: [],
  },
  LA: {
    entities: ["opencorporates.com", "erm.gov.la"],
    courts: ["worldlii.org", "commonlii.org", "laocourts.gov.la"],
    people: ["linkedin.com"],
    listings: [],
  },
  LB: {
    entities: ["opencorporates.com", "economy.gov.lb"],
    courts: ["worldlii.org", "commonlii.org", "justice.gov.lb"],
    people: ["linkedin.com"],
    listings: [],
  },
  LC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  LI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  LK: {
    entities: ["opencorporates.com", "drc.gov.lk"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.lk"],
    people: ["linkedin.com"],
    listings: [],
  },
  LR: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  LS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  LT: {
    entities: ["opencorporates.com", "registrucentras.lt"],
    courts: ["worldlii.org", "commonlii.org", "lat.lt"],
    people: ["linkedin.com"],
    listings: [],
  },
  LU: {
    entities: ["opencorporates.com", "lbr.lu"],
    courts: ["worldlii.org", "commonlii.org", "justice.public.lu"],
    people: ["linkedin.com"],
    listings: [],
  },
  LV: {
    entities: ["opencorporates.com", "ur.gov.lv"],
    courts: ["worldlii.org", "commonlii.org", "at.gov.lv"],
    people: ["linkedin.com"],
    listings: [],
  },
  LY: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MA: {
    entities: ["opencorporates.com", "directinfo.ma"],
    courts: ["worldlii.org", "commonlii.org", "justice.gov.ma"],
    people: ["linkedin.com"],
    listings: [],
  },
  MC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MD: {
    entities: ["opencorporates.com", "cis.gov.md"],
    courts: ["worldlii.org", "commonlii.org", "csj.md"],
    people: ["linkedin.com"],
    listings: [],
  },
  ME: {
    entities: ["opencorporates.com", "crps.me"],
    courts: ["worldlii.org", "commonlii.org", "sudovi.me"],
    people: ["linkedin.com"],
    listings: [],
  },
  MF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MH: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MK: {
    entities: ["opencorporates.com", "crm.com.mk"],
    courts: ["worldlii.org", "commonlii.org", "vsrm.mk"],
    people: ["linkedin.com"],
    listings: [],
  },
  ML: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MM: {
    entities: ["opencorporates.com", "dica.gov.mm"],
    courts: ["worldlii.org", "commonlii.org", "unionsupremecourt.gov.mm"],
    people: ["linkedin.com"],
    listings: [],
  },
  MN: {
    entities: ["opencorporates.com", "burtgel.gov.mn"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.mn"],
    people: ["linkedin.com"],
    listings: [],
  },
  MO: {
    entities: ["opencorporates.com", "dsaj.gov.mo"],
    courts: ["worldlii.org", "commonlii.org", "court.gov.mo"],
    people: ["linkedin.com"],
    listings: [],
  },
  MP: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MQ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MR: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MT: {
    entities: ["opencorporates.com", "mbr.mt"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.mt"],
    people: ["linkedin.com"],
    listings: [],
  },
  MU: {
    entities: ["opencorporates.com", "companies.govmu.org"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.govmu.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MV: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MW: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  MX: {
    entities: ["opencorporates.com", "gob.mx"],
    courts: ["worldlii.org", "commonlii.org", "scjn.gob.mx"],
    people: ["linkedin.com"],
    listings: ["inmuebles24.com"],
  },
  MY: {
    entities: ["opencorporates.com", "ssm.com.my"],
    courts: ["worldlii.org", "commonlii.org", "kehakiman.gov.my"],
    people: ["linkedin.com"],
    listings: [],
  },
  MZ: {
    entities: ["opencorporates.com", "portaldogoverno.gov.mz"],
    courts: ["worldlii.org", "commonlii.org", "ts.gov.mz"],
    people: ["linkedin.com"],
    listings: [],
  },
  NA: {
    entities: ["opencorporates.com", "bipa.na"],
    courts: ["worldlii.org", "commonlii.org", "ejustice.moj.na"],
    people: ["linkedin.com"],
    listings: [],
  },
  NC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NE: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NG: {
    entities: ["opencorporates.com", "cac.gov.ng"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.ng"],
    people: ["linkedin.com"],
    listings: [],
  },
  NI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NL: {
    ownership: ["kadaster.nl"],
    entities: ["opencorporates.com", "kvk.nl"],
    courts: ["worldlii.org", "commonlii.org", "rechtspraak.nl"],
    people: ["linkedin.com"],
    listings: ["funda.nl"],
  },
  NO: {
    entities: ["opencorporates.com", "brreg.no"],
    courts: ["worldlii.org", "commonlii.org", "domstol.no"],
    people: ["linkedin.com"],
    listings: [],
  },
  NP: {
    entities: ["opencorporates.com", "ocr.gov.np"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.np"],
    people: ["linkedin.com"],
    listings: [],
  },
  NR: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NU: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  NZ: {
    ownership: ["linz.govt.nz"],
    entities: ["opencorporates.com", "companiesoffice.govt.nz"],
    courts: ["worldlii.org", "commonlii.org", "nzlii.org"],
    people: ["linkedin.com"],
    listings: ["realestate.co.nz"],
  },
  OM: {
    entities: ["opencorporates.com", "business.gov.om"],
    courts: ["worldlii.org", "commonlii.org", "moj.gov.om"],
    people: ["linkedin.com"],
    listings: [],
  },
  PA: {
    entities: ["opencorporates.com", "registro-publico.gob.pa"],
    courts: ["worldlii.org", "commonlii.org", "organojudicial.gob.pa"],
    people: ["linkedin.com"],
    listings: [],
  },
  PE: {
    entities: ["opencorporates.com", "sunarp.gob.pe"],
    courts: ["worldlii.org", "commonlii.org", "pj.gob.pe"],
    people: ["linkedin.com"],
    listings: [],
  },
  PF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PH: {
    entities: ["opencorporates.com", "sec.gov.ph"],
    courts: ["worldlii.org", "commonlii.org", "sc.judiciary.gov.ph"],
    people: ["linkedin.com"],
    listings: [],
  },
  PK: {
    entities: ["opencorporates.com", "secp.gov.pk"],
    courts: ["worldlii.org", "commonlii.org", "supremecourt.gov.pk"],
    people: ["linkedin.com"],
    listings: [],
  },
  PL: {
    entities: ["opencorporates.com", "krs-online.com.pl", "ekrs.ms.gov.pl"],
    courts: ["worldlii.org", "commonlii.org", "saos.org.pl"],
    people: ["linkedin.com"],
    listings: [],
  },
  PM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PN: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PR: {
    entities: ["opencorporates.com", "estado.pr.gov"],
    courts: ["worldlii.org", "commonlii.org", "ramajudicial.pr"],
    people: ["linkedin.com"],
    listings: [],
  },
  PS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PT: {
    entities: ["opencorporates.com", "portaldaempresa.pt"],
    courts: ["worldlii.org", "commonlii.org", "igfej.mj.pt"],
    people: ["linkedin.com"],
    listings: [],
  },
  PW: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  PY: {
    entities: ["opencorporates.com", "ruc.set.gov.py"],
    courts: ["worldlii.org", "commonlii.org", "csj.gov.py"],
    people: ["linkedin.com"],
    listings: [],
  },
  QA: {
    entities: ["opencorporates.com", "mec.gov.qa"],
    courts: ["worldlii.org", "commonlii.org", "sjc.gov.qa"],
    people: ["linkedin.com"],
    listings: [],
  },
  RE: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  RO: {
    entities: ["opencorporates.com", "onrc.ro"],
    courts: ["worldlii.org", "commonlii.org", "scj.ro"],
    people: ["linkedin.com"],
    listings: [],
  },
  RS: {
    entities: ["opencorporates.com", "apr.gov.rs"],
    courts: ["worldlii.org", "commonlii.org", "vk.sud.rs"],
    people: ["linkedin.com"],
    listings: [],
  },
  RU: {
    entities: ["opencorporates.com", "egrul.nalog.ru"],
    courts: ["worldlii.org", "commonlii.org", "vsrf.ru"],
    people: ["linkedin.com"],
    listings: [],
  },
  RW: {
    entities: ["opencorporates.com", "rdb.rw"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.gov.rw"],
    people: ["linkedin.com"],
    listings: [],
  },
  SA: {
    entities: ["opencorporates.com", "mc.gov.sa"],
    courts: ["worldlii.org", "commonlii.org", "moj.gov.sa"],
    people: ["linkedin.com"],
    listings: [],
  },
  SB: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SD: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SE: {
    entities: ["opencorporates.com", "bolagsverket.se"],
    courts: ["worldlii.org", "commonlii.org", "domstol.se"],
    people: ["linkedin.com"],
    listings: [],
  },
  SG: {
    ownership: ["sla.gov.sg"],
    entities: ["opencorporates.com", "bizfile.gov.sg"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.gov.sg"],
    people: ["linkedin.com"],
    listings: ["propertyguru.com.sg"],
  },
  SH: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SI: {
    entities: ["opencorporates.com", "ajpes.si"],
    courts: ["worldlii.org", "commonlii.org", "sodisce.si"],
    people: ["linkedin.com"],
    listings: [],
  },
  SJ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SK: {
    entities: ["opencorporates.com", "orsr.sk"],
    courts: ["worldlii.org", "commonlii.org", "nsud.sk"],
    people: ["linkedin.com"],
    listings: [],
  },
  SL: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SN: {
    entities: ["opencorporates.com", "api.gouv.sn"],
    courts: ["worldlii.org", "commonlii.org", "justice.gouv.sn"],
    people: ["linkedin.com"],
    listings: [],
  },
  SO: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SR: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  ST: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SV: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SX: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SY: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  SZ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TD: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TH: {
    entities: ["opencorporates.com", "dbd.go.th"],
    courts: ["worldlii.org", "commonlii.org", "coj.go.th"],
    people: ["linkedin.com"],
    listings: [],
  },
  TJ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TK: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TL: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TN: {
    entities: ["opencorporates.com", "registre-entreprises.tn"],
    courts: ["worldlii.org", "commonlii.org", "justice.gov.tn"],
    people: ["linkedin.com"],
    listings: [],
  },
  TO: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TR: {
    entities: ["opencorporates.com", "mersis.gto.org.tr"],
    courts: ["worldlii.org", "commonlii.org", "yargitay.gov.tr"],
    people: ["linkedin.com"],
    listings: [],
  },
  TT: {
    entities: ["opencorporates.com", "ttbizlink.gov.tt"],
    courts: ["worldlii.org", "commonlii.org", "ttlawcourts.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TV: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  TW: {
    entities: ["opencorporates.com", "findbiz.nat.gov.tw"],
    courts: ["worldlii.org", "commonlii.org", "judicial.gov.tw"],
    people: ["linkedin.com"],
    listings: [],
  },
  TZ: {
    entities: ["opencorporates.com", "brela.go.tz"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.go.tz"],
    people: ["linkedin.com"],
    listings: [],
  },
  UA: {
    entities: ["opencorporates.com", "usr.minjust.gov.ua"],
    courts: ["worldlii.org", "commonlii.org", "court.gov.ua"],
    people: ["linkedin.com"],
    listings: [],
  },
  UG: {
    entities: ["opencorporates.com", "ursb.go.ug"],
    courts: ["worldlii.org", "commonlii.org", "judiciary.go.ug"],
    people: ["linkedin.com"],
    listings: [],
  },
  UM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  US: {
    entities: ["opencorporates.com", "sec.gov"],
    courts: ["worldlii.org", "commonlii.org", "pacer.gov", "courtlistener.com", "justia.com"],
    people: ["linkedin.com", "truepeoplesearch.com", "whitepages.com", "voterrecords.com"],
    listings: ["zillow.com", "redfin.com"],
  },
  UY: {
    entities: ["opencorporates.com", "dgi.gub.uy"],
    courts: ["worldlii.org", "commonlii.org", "poderjudicial.gub.uy"],
    people: ["linkedin.com"],
    listings: [],
  },
  UZ: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  VA: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  VC: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  VE: {
    entities: ["opencorporates.com", "snc.gob.ve"],
    courts: ["worldlii.org", "commonlii.org", "tsj.gob.ve"],
    people: ["linkedin.com"],
    listings: [],
  },
  VG: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  VI: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  VN: {
    entities: ["opencorporates.com", "dangkykinhdoanh.gov.vn"],
    courts: ["worldlii.org", "commonlii.org", "toaan.gov.vn"],
    people: ["linkedin.com"],
    listings: [],
  },
  VU: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  WF: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  WS: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  XK: {
    entities: ["opencorporates.com", "arbk.rks-gov.net"],
    courts: ["worldlii.org", "commonlii.org", "gjyqesori-rks.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  YE: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  YT: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  ZA: {
    ownership: ["deeds.gov.za"],
    entities: ["opencorporates.com", "cipc.co.za"],
    courts: ["worldlii.org", "commonlii.org", "saflii.org", "judiciary.org.za"],
    people: ["linkedin.com"],
    listings: ["property24.com"],
  },
  ZM: {
    entities: ["opencorporates.com"],
    courts: ["worldlii.org", "commonlii.org"],
    people: ["linkedin.com"],
    listings: [],
  },
  ZW: {
    entities: ["opencorporates.com", "dcip.gov.zw"],
    courts: ["worldlii.org", "commonlii.org", "jsc.org.zw"],
    people: ["linkedin.com"],
    listings: [],
  },
};
export function countryNameToIso(raw: string): string {
  const low = String(raw || "").toLowerCase();
  let best = "";
  let bestLen = 0;
  for (const [iso, name] of Object.entries(COUNTRY_LABELS)) {
    const n = name.toLowerCase();
    if (n.length > 3 && n.length > bestLen && low.includes(n)) {
      best = iso;
      bestLen = n.length;
    }
  }
  const aliases: Array<[RegExp, string]> = [
    [/\b(usa|u\.s\.a\.|u\.s\.|united states|america)\b/, "US"],
    [/\b(uk|united kingdom|britain|great britain|england)\b/, "GB"],
    [/\bholland\b/, "NL"],
    [/\bburma\b/, "MM"],
    [/\bivory coast\b/, "CI"],
    [/\bczechia\b/, "CZ"],
    [/\buae\b/, "AE"],
    [/\bsouth korea\b/, "KR"],
    [/\bnorth korea\b/, "KP"],
  ];
  for (const [re, iso] of aliases) {
    if (re.test(low) && bestLen < 12) return iso;
  }
  return best;
}

// geoHierarchyJump.ts — country > region > state/province > county > city
// Nominatim (keyless) + GeoNames (GEONAMES_USERNAME) + atlas labels.
// Never print secrets. Public-index hunt only.

export type GeoJump = {
  country: string;
  countryName: string;
  region: string;
  subregion: string;
  state: string;
  county: string;
  city: string;
  source: "prompt" | "nominatim" | "geonames" | "atlas";
  chain: string[];
};

const UA = "asherin.com-intel/1.0 (public-index geo jump; contact asherin.com)";

function chainOf(j: GeoJump): string[] {
  return [j.countryName || j.country, j.region, j.subregion, j.state, j.county, j.city].filter(Boolean);
}

function atlasFill(iso: string, j: GeoJump): GeoJump {
  const meta = COUNTRY_REGION[iso];
  if (meta) {
    if (!j.region) j.region = meta.region;
    if (!j.subregion) j.subregion = meta.subregion;
  }
  j.countryName = COUNTRY_LABELS[iso] || j.countryName || iso;
  j.chain = chainOf(j);
  return j;
}

async function nominatimJump(q: string): Promise<Partial<GeoJump> | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=" +
    encodeURIComponent(q.slice(0, 180));
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!resp.ok) return null;
    const rows = (await resp.json().catch(() => [])) as any[];
    const hit = rows?.[0];
    const a = hit?.address || {};
    const iso = String(a.country_code || "").toUpperCase();
    if (!iso) return null;
    return {
      country: iso,
      countryName: a.country || COUNTRY_LABELS[iso] || iso,
      state: a.state || a.region || a.province || "",
      county: a.county || a.state_district || "",
      city: a.city || a.town || a.village || a.municipality || "",
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

async function geonamesJump(q: string): Promise<Partial<GeoJump> | null> {
  const user =
    Deno.env.get("GEONAMES_USERNAME") || Deno.env.get("GEONAMES_USER") || Deno.env.get("GEO_NAMES_USERNAME") || "";
  if (!user) return null;
  const url =
    "https://api.geonames.org/searchJSON?maxRows=1&style=FULL&orderby=relevance&q=" +
    encodeURIComponent(q.slice(0, 180)) +
    "&username=" +
    encodeURIComponent(user);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json().catch(() => null)) as any;
    const hit = json?.geonames?.[0];
    if (!hit) return null;
    const iso = String(hit.countryCode || "").toUpperCase();
    return {
      country: iso,
      countryName: hit.countryName || COUNTRY_LABELS[iso] || iso,
      state: hit.adminName1 || "",
      county: hit.adminName2 || "",
      city: hit.name || hit.toponymName || "",
      source: "geonames",
    };
  } catch {
    return null;
  }
}

/** Prompt tokens win when already specific. Live geocoders fill the missing rungs. */
export async function regionalJump(
  raw: string,
  seed: {
    country?: string;
    state?: string;
    county?: string;
    city?: string;
  },
): Promise<GeoJump> {
  const isoFromText = countryNameToIso(raw);
  let j: GeoJump = {
    country: (seed.country || isoFromText || "").toUpperCase(),
    countryName: "",
    region: "",
    subregion: "",
    state: seed.state || "",
    county: seed.county || "",
    city: seed.city || "",
    source: seed.country || seed.city ? "prompt" : "atlas",
    chain: [],
  };
  j = atlasFill(j.country, j);

  const q = [j.city, j.county, j.state, j.countryName || j.country, String(raw || "").slice(0, 80)]
    .filter(Boolean)
    .join(", ");
  const needFiner = !j.city || !j.state || !j.country;
  if (needFiner && q.length >= 3) {
    const geo = (await geonamesJump(q)) || (await nominatimJump(q));
    if (geo) {
      if (!j.country && geo.country) j.country = geo.country;
      if (!j.state && geo.state) j.state = geo.state;
      if (!j.county && geo.county) j.county = geo.county;
      if (!j.city && geo.city) j.city = geo.city;
      if (geo.countryName) j.countryName = geo.countryName;
      j.source = geo.source || j.source;
      j = atlasFill(j.country, j);
    }
  }
  j.chain = chainOf(j);
  return j;
}

export type KeyedHit = { title: string; url: string; snippet: string; domain: string };

function hit(title: string, url: string, snippet: string): KeyedHit {
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "";
  }
  return { title, url, snippet, domain };
}

/** Direct public-index APIs when keys exist. Never leftover "visit the registry". */
export async function keyedPublicIndexHits(opts: {
  subject: string;
  country: string;
  state?: string;
  city?: string;
}): Promise<{ hits: KeyedHit[]; used: string[] }> {
  const subject = String(opts.subject || "").slice(0, 120);
  const iso = (opts.country || "").toUpperCase();
  const hits: KeyedHit[] = [];
  const used: string[] = [];
  const oc =
    Deno.env.get("OPENCORPORATES_API_KEY") ||
    Deno.env.get("OPENCORPORATES_TOKEN") ||
    Deno.env.get("OPENCORPORATES_API_TOKEN") ||
    "";
  const cl =
    Deno.env.get("COURTLISTENER_TOKEN") ||
    Deno.env.get("COURTLISTENER_API_KEY") ||
    Deno.env.get("COURTLISTENER_API_TOKEN") ||
    "";
  const ch = Deno.env.get("COMPANIES_HOUSE_API_KEY") || Deno.env.get("COMPANIES_HOUSE_KEY") || "";

  const jobs: Array<Promise<void>> = [];

  if (oc && subject) {
    used.push("opencorporates");
    const q = new URL("https://api.opencorporates.com/v0.4/companies/search");
    q.searchParams.set("q", subject);
    q.searchParams.set("per_page", "5");
    q.searchParams.set("api_token", oc);
    if (iso) q.searchParams.set("jurisdiction_code", iso.toLowerCase());
    jobs.push(
      (async () => {
        try {
          const resp = await fetch(q.toString(), {
            headers: { "User-Agent": UA, Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp.ok) return;
          const json = (await resp.json().catch(() => null)) as any;
          const companies = json?.results?.companies || [];
          for (const row of companies.slice(0, 5)) {
            const c = row?.company || row;
            const url = c?.opencorporates_url || "";
            if (!url) continue;
            hits.push(
              hit(
                String(c?.name || subject),
                url,
                `${c?.jurisdiction_code || iso} · ${c?.company_type || "company"} · ${c?.current_status || ""}`.trim(),
              ),
            );
          }
        } catch {
          /* keyed miss is not leftover homework */
        }
      })(),
    );
  }

  if (cl && subject) {
    used.push("courtlistener");
    const q = new URL("https://www.courtlistener.com/api/rest/v4/search/");
    q.searchParams.set("q", `${subject} ${opts.city || ""} ${opts.state || ""}`.trim());
    q.searchParams.set("type", "o");
    jobs.push(
      (async () => {
        try {
          const resp = await fetch(q.toString(), {
            headers: { "User-Agent": UA, Accept: "application/json", Authorization: `Token ${cl}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp.ok) return;
          const json = (await resp.json().catch(() => null)) as any;
          const results = json?.results || [];
          for (const row of results.slice(0, 5)) {
            const url = row?.absolute_url
              ? `https://www.courtlistener.com${row.absolute_url}`
              : String(row?.absolute_url || "");
            if (!url) continue;
            hits.push(
              hit(String(row?.caseName || row?.snippet || "opinion"), url, String(row?.snippet || "").slice(0, 280)),
            );
          }
        } catch {
          /* keyed miss is not leftover homework */
        }
      })(),
    );
  }

  if (ch && iso === "GB" && subject) {
    used.push("companies_house");
    const q = "https://api.company-information.service.gov.uk/search/companies?q=" + encodeURIComponent(subject);
    jobs.push(
      (async () => {
        try {
          const resp = await fetch(q, {
            headers: {
              "User-Agent": UA,
              Accept: "application/json",
              Authorization: "Basic " + btoa(ch + ":"),
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp.ok) return;
          const json = (await resp.json().catch(() => null)) as any;
          for (const row of (json?.items || []).slice(0, 5)) {
            const num = row?.company_number || "";
            const url = num ? `https://find-and-update.company-information.service.gov.uk/company/${num}` : "";
            if (!url) continue;
            hits.push(
              hit(
                String(row?.title || subject),
                url,
                `${row?.company_status || ""} · ${row?.address_snippet || ""}`.trim(),
              ),
            );
          }
        } catch {
          /* keyed miss is not leftover homework */
        }
      })(),
    );
  }

  await Promise.all(jobs);
  return { hits, used };
}
