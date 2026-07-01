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
const GLOBAL_ENTITIES = [
  "opencorporates.com",
  "sec.gov", "efts.sec.gov",
  "linkedin.com/company",
];
const GLOBAL_PEOPLE_AGGREGATORS = [
  "linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com",
];
const GLOBAL_COURTS = ["justia.com", "courtlistener.com", "pacer.gov"];

// ─── UNITED STATES ─────────────────────────────────────────────────────────
const US_NATIONAL: Partial<JurisdictionSources> = {
  entities: ["opencorporates.com", "sec.gov", "efts.sec.gov", "fec.gov", "uspto.gov", "linkedin.com/company"],
  courts: ["pacer.gov", "courtlistener.com", "justia.com"],
  people: ["truepeoplesearch.com", "whitepages.com", "spokeo.com", "beenverified.com", "fastpeoplesearch.com", "radaris.com", "thatsthem.com", "usphonebook.com", "voterrecords.com"],
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
  TX: { ownership: ["texasfile.com"], entities: ["direct.sos.state.tx.us"], tax: ["comptroller.texas.gov"], courts: ["efile.txcourts.gov"] },
  CA: { ownership: ["bizfileonline.sos.ca.gov"], entities: ["businesssearch.sos.ca.gov", "bizfileonline.sos.ca.gov"], tax: ["boe.ca.gov"], courts: ["courts.ca.gov"] },
  NY: { ownership: ["apps.dos.ny.gov", "acris.nyc.gov"], entities: ["apps.dos.ny.gov"], tax: ["tax.ny.gov"], courts: ["iapps.courts.state.ny.us"] },
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
  "FL:LEE":         { ownership: ["leepa.org"], tax: ["leetc.com"], permits: ["leegov.com"], courts: ["leeclerk.org"] },
  "FL:MIAMI-DADE":  { ownership: ["miamidade.gov"], tax: ["miamidade.gov"], permits: ["miamidade.gov"], courts: ["miami-dadeclerk.com"] },
  "FL:BROWARD":     { ownership: ["bcpa.net"], tax: ["broward.county-taxes.com"], permits: ["broward.org"] },
  "FL:PALM BEACH":  { ownership: ["pbcgov.com", "pbcpao.gov"] },
  "FL:ORANGE":      { ownership: ["ocpaweb.ocpafl.org", "ocpafl.org"], permits: ["orangecountyfl.net"] },
  "FL:HILLSBOROUGH":{ ownership: ["hcpafl.org"] },
  "FL:PINELLAS":    { ownership: ["pcpao.gov"] },
  "FL:DUVAL":       { ownership: ["paopropertysearch.coj.net"] },
  "FL:COLLIER":     { ownership: ["collierappraiser.com"] },
  "FL:CHARLOTTE":   { ownership: ["ccappraiser.com"] },
  "FL:SARASOTA":    { ownership: ["sc-pa.com"] },
  // Texas
  "TX:HARRIS":      { ownership: ["hcad.org"], tax: ["hctax.net"] },
  "TX:DALLAS":      { ownership: ["dallascad.org"] },
  "TX:TARRANT":     { ownership: ["tad.org"] },
  "TX:BEXAR":       { ownership: ["bcad.org"] },
  "TX:TRAVIS":      { ownership: ["traviscad.org"] },
  // California
  "CA:LOS ANGELES": { ownership: ["assessor.lacounty.gov"] },
  "CA:ORANGE":      { ownership: ["ocassessor.gov"] },
  "CA:SAN DIEGO":   { ownership: ["sdttc.com", "arcc.sdcounty.ca.gov", "sdarcc.gov"] },
  "CA:SANTA CLARA": { ownership: ["sccassessor.org"] },
  "CA:ALAMEDA":     { ownership: ["acgov.org"] },
  "CA:SAN FRANCISCO":{ ownership: ["sfassessor.org"] },
  // NY
  "NY:NEW YORK":    { ownership: ["acris.nyc.gov"] },
  "NY:KINGS":       { ownership: ["acris.nyc.gov"] },
  "NY:QUEENS":      { ownership: ["acris.nyc.gov"] },
  // IL
  "IL:COOK":        { ownership: ["cookcountyassessor.com", "cookcountyclerkil.gov"] },
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
  WA:  { ownership: ["landgate.wa.gov.au"] },
  SA:  { ownership: ["sailis.sa.gov.au"] },
  TAS: { ownership: ["thelist.tas.gov.au"] },
  ACT: { ownership: ["actmapi.act.gov.au"] },
  NT:  { ownership: ["nt.gov.au"] },
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
  ownership: ["search.find-my-landinfo.service.gov.uk", "landregistry.data.gov.uk", "gov.uk/search-property-information-land-registry"],
  entities: ["find-and-update.company-information.service.gov.uk", "opencorporates.com"],
  people: ["192.com", "linkedin.com"],
  courts: ["find-case-information.service.gov.uk", "insolvency.service.gov.uk", "trustonline.org.uk"],
  listings: ["rightmove.co.uk", "zoopla.co.uk", "onthemarket.com"],
};
const GB_REGION: Record<string, Partial<JurisdictionSources>> = {
  SCT: { ownership: ["ros.gov.uk"] },       // Scotland
  NIR: { ownership: ["lpsni.gov.uk"] },     // Northern Ireland
};

// ─── EU / OTHER COUNTRIES ──────────────────────────────────────────────────
const COUNTRY: Record<string, Partial<JurisdictionSources>> = {
  US: US_NATIONAL,
  AU: AU_NATIONAL,
  CA: CA_NATIONAL,
  GB: GB_NATIONAL,
  NZ: { ownership: ["linz.govt.nz"], listings: ["realestate.co.nz", "trademe.co.nz"], entities: ["companiesoffice.govt.nz"] },
  DE: { ownership: ["grundbuch.de"], entities: ["handelsregister.de", "unternehmensregister.de"], listings: ["immobilienscout24.de", "immowelt.de"] },
  FR: { ownership: ["cadastre.gouv.fr"], entities: ["infogreffe.fr", "societe.com"], listings: ["seloger.com", "leboncoin.fr"] },
  ES: { ownership: ["registradores.org", "sedecatastro.gob.es"], entities: ["registradores.org"], listings: ["idealista.com", "fotocasa.es"] },
  IT: { ownership: ["agenziaentrate.gov.it"], entities: ["registroimprese.it"], listings: ["immobiliare.it", "casa.it"] },
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
    ownership: [], tax: [], permits: [], listings: [], entities: [], courts: [], people: [],
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
  const co = (county || "").toUpperCase().replace(/\s+COUNTY$/, "").trim();
  const countyKey = s && co ? `${s}:${co}` : "";

  const stateMap: Record<string, Partial<JurisdictionSources> | undefined> = {
    US: US_STATE[s], AU: AU_STATE[s], CA: CA_PROVINCE[s], GB: GB_REGION[s],
  };

  return merge(
    { listings: GLOBAL_LISTINGS, entities: GLOBAL_ENTITIES, people: GLOBAL_PEOPLE_AGGREGATORS, courts: GLOBAL_COURTS },
    COUNTRY[c],
    stateMap[c],
    c === "US" && countyKey ? US_COUNTY[countyKey] : undefined,
  );
}

/** Build a `site:a OR site:b OR site:c` restrictor for the given domains. */
export function siteFilter(domains: string[], cap = 8): string {
  const list = domains.slice(0, cap).map((d) => `site:${d}`).join(" OR ");
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
