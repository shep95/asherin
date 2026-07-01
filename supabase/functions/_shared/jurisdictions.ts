// jurisdictions.ts — authoritative property-record sources per jurisdiction.
// Each region lists the sites we trust for OWNERSHIP / TAX / PERMITS / LISTINGS.
// The engine builds `site:a OR site:b OR site:c` queries so the search engine
// returns records from actual government / registry portals — not tangential
// Canadian federal-geo pages when the parcel is in Florida.

export type JurisdictionSources = {
  ownership: string[];  // deed / owner / LLC records
  tax: string[];        // assessor / tax collector
  permits: string[];    // building department
  listings: string[];   // real estate portals
};

// Universal fallbacks — used everywhere as secondary channel.
const GLOBAL_LISTINGS = ["zillow.com", "redfin.com", "realtor.com", "trulia.com", "homes.com"];

// ─── UNITED STATES ─────────────────────────────────────────────────────────
const US_STATE: Record<string, Partial<JurisdictionSources>> = {
  FL: {
    ownership: ["floridaparcels.com", "sunbiz.org", "flrecords.com"],
    tax: ["floridarevenue.com", "floridaparcels.com"],
    permits: ["floridabuilding.org"],
  },
  TX: {
    ownership: ["texasfile.com", "sos.state.tx.us"],
    tax: ["comptroller.texas.gov"],
  },
  CA: {
    ownership: ["bizfileonline.sos.ca.gov"],
    tax: ["boe.ca.gov"],
  },
  NY: {
    ownership: ["apps.dos.ny.gov", "acris.nyc.gov"],
    tax: ["tax.ny.gov"],
  },
  GA: { ownership: ["ecorp.sos.ga.gov"], tax: ["dor.georgia.gov"] },
  NC: { ownership: ["sosnc.gov"] },
  IL: { ownership: ["ilsos.gov"], tax: ["cookcountyassessor.com"] },
  WA: { ownership: ["ccfs.sos.wa.gov"] },
  AZ: { ownership: ["ecorp.azcc.gov"] },
  CO: { ownership: ["coloradosos.gov"] },
  NV: { ownership: ["esos.nv.gov"] },
  MA: { ownership: ["corp.sec.state.ma.us"] },
  OH: { ownership: ["businesssearch.ohiosos.gov"] },
  MI: { ownership: ["cofs.lara.state.mi.us"] },
  PA: { ownership: ["file.dos.pa.gov"] },
  VA: { ownership: ["cis.scc.virginia.gov"] },
  TN: { ownership: ["tnbear.tn.gov"] },
  NJ: { ownership: ["nj.gov"] },
  MD: { ownership: ["egov.maryland.gov"] },
  OR: { ownership: ["sos.oregon.gov"] },
  UT: { ownership: ["businessregistry.utah.gov"] },
  MN: { ownership: ["mblsportal.sos.state.mn.us"] },
  WI: { ownership: ["wdfi.org"] },
  SC: { ownership: ["businessfilings.sc.gov"] },
  AL: { ownership: ["arc-sos.state.al.us"] },
  LA: { ownership: ["coraweb.sos.la.gov"] },
  KY: { ownership: ["sos.ky.gov"] },
  OK: { ownership: ["sos.ok.gov"] },
  IN: { ownership: ["bsd.sos.in.gov"] },
  MO: { ownership: ["bsd.sos.mo.gov"] },
  IA: { ownership: ["sos.iowa.gov"] },
  KS: { ownership: ["sos.ks.gov"] },
  AR: { ownership: ["sos.arkansas.gov"] },
  MS: { ownership: ["corp.sos.ms.gov"] },
  NM: { ownership: ["portal.sos.state.nm.us"] },
  ID: { ownership: ["sosbiz.idaho.gov"] },
  MT: { ownership: ["biz.sosmt.gov"] },
  ND: { ownership: ["firststop.sos.nd.gov"] },
  SD: { ownership: ["sosenterprise.sd.gov"] },
  NE: { ownership: ["sos.nebraska.gov"] },
  WV: { ownership: ["apps.wv.gov"] },
  ME: { ownership: ["maine.gov"] },
  NH: { ownership: ["quickstart.sos.nh.gov"] },
  VT: { ownership: ["bizfilings.vermont.gov"] },
  RI: { ownership: ["business.sos.ri.gov"] },
  DE: { ownership: ["icis.corp.delaware.gov"] },
  AK: { ownership: ["commerce.alaska.gov"] },
  HI: { ownership: ["hbe.ehawaii.gov"] },
  WY: { ownership: ["wyobiz.wyo.gov"] },
  DC: { ownership: ["corponline.dcra.dc.gov"] },
};

// County overrides (highest fidelity — actual property appraisers / recorders).
const US_COUNTY: Record<string, Partial<JurisdictionSources>> = {
  // Florida
  "FL:LEE":         { ownership: ["leepa.org"], tax: ["leetc.com"], permits: ["leegov.com"] },
  "FL:MIAMI-DADE":  { ownership: ["miamidade.gov"], tax: ["miamidade.gov"], permits: ["miamidade.gov"] },
  "FL:BROWARD":     { ownership: ["bcpa.net"], tax: ["broward.county-taxes.com"], permits: ["broward.org"] },
  "FL:PALM BEACH":  { ownership: ["pbcgov.com", "pbcpao.gov"] },
  "FL:ORANGE":      { ownership: ["ocpaweb.ocpafl.org"], permits: ["orangecountyfl.net"] },
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
  "CA:SAN DIEGO":   { ownership: ["sdttc.com", "arcc.sdcounty.ca.gov"] },
  "CA:SANTA CLARA": { ownership: ["sccassessor.org"] },
  "CA:ALAMEDA":     { ownership: ["acgov.org"] },
  // New York
  "NY:NEW YORK":    { ownership: ["acris.nyc.gov"] },
  "NY:KINGS":       { ownership: ["acris.nyc.gov"] },
  "NY:QUEENS":      { ownership: ["acris.nyc.gov"] },
  // Illinois
  "IL:COOK":        { ownership: ["cookcountyassessor.com", "cookcountyclerkil.gov"] },
};

// ─── COUNTRIES ─────────────────────────────────────────────────────────────
const COUNTRY: Record<string, Partial<JurisdictionSources>> = {
  US: { listings: GLOBAL_LISTINGS },
  CA: {
    ownership: ["onland.ca", "ltsa.ca", "spin2.gov.ab.ca", "isc.ca"],
    tax: ["cra-arc.gc.ca"],
    listings: ["realtor.ca", "royallepage.ca", "zolo.ca"],
  },
  GB: {
    ownership: ["gov.uk/search-property-information-land-registry", "landregistry.data.gov.uk", "find-and-update.company-information.service.gov.uk"],
    listings: ["rightmove.co.uk", "zoopla.co.uk", "onthemarket.com"],
  },
  AU: {
    ownership: ["nswlrs.com.au", "landata.vic.gov.au", "titlesqld.com.au"],
    listings: ["realestate.com.au", "domain.com.au"],
  },
  NZ: { ownership: ["linz.govt.nz"], listings: ["realestate.co.nz", "trademe.co.nz"] },
  DE: { ownership: ["grundbuch.de", "handelsregister.de"], listings: ["immobilienscout24.de", "immowelt.de"] },
  FR: { ownership: ["cadastre.gouv.fr"], listings: ["seloger.com", "leboncoin.fr"] },
  ES: { ownership: ["registradores.org", "sedecatastro.gob.es"], listings: ["idealista.com", "fotocasa.es"] },
  IT: { ownership: ["agenziaentrate.gov.it"], listings: ["immobiliare.it", "casa.it"] },
  NL: { ownership: ["kadaster.nl", "kvk.nl"], listings: ["funda.nl"] },
  MX: { ownership: ["rppc.cdmx.gob.mx"], listings: ["inmuebles24.com", "vivanuncios.com.mx"] },
  BR: { ownership: ["registrodeimoveis.org.br"], listings: ["zapimoveis.com.br", "vivareal.com.br"] },
  IN: { ownership: ["dolr.gov.in", "mca.gov.in"], listings: ["99acres.com", "magicbricks.com"] },
  JP: { ownership: ["touki.moj.go.jp"], listings: ["suumo.jp", "homes.co.jp"] },
  SG: { ownership: ["sla.gov.sg"], listings: ["propertyguru.com.sg"] },
  AE: { ownership: ["dubailand.gov.ae"], listings: ["bayut.com", "propertyfinder.ae"] },
  ZA: { ownership: ["deedsweb.dla.gov.za"], listings: ["property24.com", "privateproperty.co.za"] },
};

// Merge helper — county > state > country > global-listings-only.
function merge(...parts: Array<Partial<JurisdictionSources> | undefined>): JurisdictionSources {
  const out: JurisdictionSources = { ownership: [], tax: [], permits: [], listings: [] };
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
 * @param country  ISO-2 (e.g. "US", "CA", "GB")
 * @param state    US state code / province ("FL", "TX", "ON")
 * @param county   County name (upper-cased key, e.g. "LEE", "MIAMI-DADE")
 */
export function sourcesFor(country?: string, state?: string, county?: string): JurisdictionSources {
  const c = (country || "").toUpperCase();
  const s = (state || "").toUpperCase();
  const co = (county || "").toUpperCase().replace(/\s+COUNTY$/, "").trim();
  const countyKey = s && co ? `${s}:${co}` : "";

  const merged = merge(
    { listings: GLOBAL_LISTINGS },
    COUNTRY[c],
    c === "US" ? US_STATE[s] : undefined,
    c === "US" && countyKey ? US_COUNTY[countyKey] : undefined,
  );
  return merged;
}

/** Build a `site:a OR site:b OR site:c` restrictor for the given domains. */
export function siteFilter(domains: string[], cap = 8): string {
  const list = domains.slice(0, cap).map((d) => `site:${d}`).join(" OR ");
  return list ? `(${list})` : "";
}

/** Best-effort parse of country/state/county from a free-form address string. */
export function parseJurisdiction(address: string): { country: string; state: string; county: string } {
  const t = String(address || "");
  // US ZIP → assume US
  const usZip = /\b\d{5}(?:-\d{4})?\b/.test(t);
  // Canadian postal
  const caPostal = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(t);
  // UK postal
  const ukPostal = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(t);

  let country = "";
  if (/,\s*USA?\b/i.test(t) || usZip) country = "US";
  else if (/,\s*Canada\b/i.test(t) || caPostal) country = "CA";
  else if (/,\s*(?:UK|United Kingdom|England|Scotland|Wales)\b/i.test(t) || ukPostal) country = "GB";
  else if (/,\s*Australia\b/i.test(t)) country = "AU";
  else if (/,\s*Mexico\b/i.test(t)) country = "MX";

  // US state (two-letter, before ZIP)
  let state = "";
  const st = t.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (st) state = st[1].toUpperCase();

  // County — look for "X County" token
  let county = "";
  const co = t.match(/([A-Za-z\-\s]+?)\s+County/i);
  if (co) county = co[1].trim().toUpperCase();

  return { country, state, county };
}
