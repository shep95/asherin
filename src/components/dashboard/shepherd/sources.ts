// shepherd — the source reliability taxonomy.
//
// Every source is classified before it is ever queried. The classification is
// permanent and it caps the weight of every token that source can ever birth.
//
// Honesty note carried into the UI: shepherd reaches these indexes through the
// platform's own retrieval layer. Where a direct probe tool (maigret, holehe,
// dehashed, snusbase) is not wired into this deployment, the source is shown in
// the live feed as not-connected. It is never silently skipped and its absence
// is never rendered as an absence token.

import type { Tier, TokenType } from "./types";

export interface SourceDef {
  id: string;
  name: string;
  tier: Tier;
  layer: 1 | 2 | 3 | 4;
  /** Domains a hit must live on to count as this source. */
  domains: string[];
  /** Token types this source is eligible to be queried with. */
  accepts: TokenType[];
  /** Wire query built from a token value. */
  query: (v: string, geo?: string) => string;
  /** What a null return from this source actually means. */
  connected: boolean;
  note?: string;
}

const site = (domains: string[]) => domains.map((d) => `site:${d}`).join(" OR ");

export const SOURCES: SourceDef[] = [
  // ── T1 government primary ──────────────────────────────────────────────
  {
    id: "fl-voter",
    name: "state voter registration index",
    tier: 1,
    layer: 1,
    domains: ["dos.myflorida.com", "registertovoteflorida.gov", "vote.org", "sos.state.fl.us", "elections.myflorida.com"],
    accepts: ["name", "partial-name"],
    query: (v, geo) => `${site(["dos.myflorida.com", "elections.myflorida.com", "sos.state.fl.us"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "courts",
    name: "clerk of courts / statewide case search",
    tier: 1,
    layer: 1,
    domains: ["flcourts.gov", "myfloridacounty.com", "courts.gov", "uscourts.gov", "casetext.com", "courtlistener.com"],
    accepts: ["name", "partial-name"],
    query: (v, geo) => `${site(["flcourts.gov", "courtlistener.com", "uscourts.gov"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "pacer",
    name: "federal court index (pacer mirror)",
    tier: 1,
    layer: 1,
    domains: ["pacer.gov", "uscourts.gov", "courtlistener.com", "docketbird.com"],
    accepts: ["name"],
    query: (v) => `${site(["pacer.gov", "courtlistener.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "sunbiz",
    name: "state business registry",
    tier: 1,
    layer: 1,
    domains: ["sunbiz.org", "dos.myflorida.com", "opencorporates.com"],
    accepts: ["name", "org"],
    query: (v) => `${site(["sunbiz.org", "opencorporates.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "fec",
    name: "federal election commission donor index",
    tier: 1,
    layer: 1,
    domains: ["fec.gov", "docquery.fec.gov", "opensecrets.org"],
    accepts: ["name"],
    query: (v, geo) => `${site(["fec.gov", "opensecrets.org"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "property",
    name: "county property appraiser records",
    tier: 1,
    layer: 1,
    domains: ["bcpa.net", "pbcgov.org", "hcpafl.org", "paslc.gov", "leepa.org", "ccappraiser.com", "propertyappraiser.com"],
    accepts: ["name", "address"],
    query: (v, geo) => `("property appraiser" OR "parcel") "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "usaspending",
    name: "federal contract and award index",
    tier: 1,
    layer: 1,
    domains: ["usaspending.gov", "sam.gov", "fpds.gov"],
    accepts: ["name", "org"],
    query: (v) => `${site(["usaspending.gov", "sam.gov"])} "${v}"`,
    connected: true,
  },

  // ── T2 passive technical probes ────────────────────────────────────────
  {
    id: "archive",
    name: "web archive index",
    tier: 2,
    layer: 2,
    domains: ["archive.org", "web.archive.org", "archive.ph"],
    accepts: ["name", "handle", "email"],
    query: (v) => `${site(["archive.org"])} "${v}"`,
    connected: true,
  },
  {
    id: "paste-index",
    name: "paste and leak index",
    tier: 2,
    layer: 2,
    domains: ["pastebin.com", "ghostbin.com", "controlc.com", "justpaste.it", "intelx.io"],
    accepts: ["email", "handle"],
    query: (v) => `${site(["pastebin.com", "justpaste.it", "controlc.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "breach-mention",
    name: "public breach disclosure index",
    tier: 2,
    layer: 2,
    domains: ["haveibeenpwned.com", "breachdirectory.org", "cybernews.com", "bleepingcomputer.com"],
    accepts: ["email"],
    query: (v) => `"${v}" (breach OR leaked OR "data dump")`,
    connected: true,
  },
  {
    id: "keybase",
    name: "cryptographic identity directory",
    tier: 2,
    layer: 2,
    domains: ["keybase.io", "keys.openpgp.org"],
    accepts: ["handle", "email", "name"],
    query: (v) => `${site(["keybase.io", "keys.openpgp.org"])} "${v}"`,
    connected: true,
  },
  {
    id: "maigret",
    name: "maigret username enumeration (600+ platforms)",
    tier: 2,
    layer: 2,
    domains: [],
    accepts: ["handle"],
    query: (v) => v,
    connected: false,
    note: "direct probe binary is not wired into this deployment. no null return is recorded for it.",
  },
  {
    id: "holehe",
    name: "holehe email registration scanner (120 services)",
    tier: 2,
    layer: 2,
    domains: [],
    accepts: ["email"],
    query: (v) => v,
    connected: false,
    note: "direct probe binary is not wired into this deployment. no null return is recorded for it.",
  },
  {
    id: "dehashed",
    name: "dehashed / snusbase credential index",
    tier: 2,
    layer: 2,
    domains: [],
    accepts: ["email", "phone", "name"],
    query: (v) => v,
    connected: false,
    note: "paid credential index, no key bound to this deployment.",
  },

  // ── T3 social enumeration ──────────────────────────────────────────────
  {
    id: "github",
    name: "github public profile and repositories",
    tier: 3,
    layer: 3,
    domains: ["github.com", "gist.github.com"],
    accepts: ["handle", "name", "email"],
    query: (v) => `${site(["github.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "reddit",
    name: "reddit public post history",
    tier: 3,
    layer: 3,
    domains: ["reddit.com", "old.reddit.com"],
    accepts: ["handle", "name"],
    query: (v) => `${site(["reddit.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "x",
    name: "x / twitter public profile",
    tier: 3,
    layer: 3,
    domains: ["twitter.com", "x.com", "nitter.net"],
    accepts: ["handle", "name"],
    query: (v) => `${site(["twitter.com", "x.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "instagram",
    name: "instagram public profile",
    tier: 3,
    layer: 3,
    domains: ["instagram.com", "picuki.com"],
    accepts: ["handle", "name"],
    query: (v) => `${site(["instagram.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "linkedin",
    name: "linkedin public profile",
    tier: 3,
    layer: 3,
    domains: ["linkedin.com"],
    accepts: ["name", "org"],
    query: (v, geo) => `${site(["linkedin.com"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "steam",
    name: "steam gaming profile",
    tier: 3,
    layer: 3,
    domains: ["steamcommunity.com", "steamdb.info"],
    accepts: ["handle"],
    query: (v) => `${site(["steamcommunity.com"])} "${v}"`,
    connected: true,
  },
  {
    id: "twitch",
    name: "twitch channel",
    tier: 3,
    layer: 3,
    domains: ["twitch.tv"],
    accepts: ["handle"],
    query: (v) => `${site(["twitch.tv"])} "${v}"`,
    connected: true,
  },

  // ── T4 aggregators — always last, always provisional ───────────────────
  {
    id: "fastpeoplesearch",
    name: "fastpeoplesearch",
    tier: 4,
    layer: 4,
    domains: ["fastpeoplesearch.com"],
    accepts: ["name"],
    query: (v, geo) => `${site(["fastpeoplesearch.com"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "spokeo",
    name: "spokeo",
    tier: 4,
    layer: 4,
    domains: ["spokeo.com"],
    accepts: ["name"],
    query: (v, geo) => `${site(["spokeo.com"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "whitepages",
    name: "whitepages",
    tier: 4,
    layer: 4,
    domains: ["whitepages.com", "411.com"],
    accepts: ["name", "phone"],
    query: (v, geo) => `${site(["whitepages.com"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
  {
    id: "beenverified",
    name: "beenverified / intelius / truthfinder",
    tier: 4,
    layer: 4,
    domains: ["beenverified.com", "intelius.com", "truthfinder.com", "radaris.com", "thatsthem.com"],
    accepts: ["name"],
    query: (v, geo) => `${site(["beenverified.com", "radaris.com", "thatsthem.com"])} "${v}" ${geo ?? ""}`.trim(),
    connected: true,
  },
];

export const TIER_FAILURE_MODES: Record<Tier, string> = {
  1: "outdated after a move, data-entry error at registration, spelling variants, records that never propagated across counties.",
  2: "username enumeration false positives, rate-limited partial results, account existence proven but ownership not, stale breach attribution.",
  3: "curated public personas, handles shared between people, unreliable activity timestamps, scraping blocks.",
  4: "record-merge errors, months-old data, circular sourcing between aggregators, high error rate on common surnames.",
};

export function sourcesForLayer(layer: 1 | 2 | 3 | 4): SourceDef[] {
  return SOURCES.filter((s) => s.layer === layer);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function matchesSource(url: string, def: SourceDef): boolean {
  if (!def.domains.length) return false;
  const h = hostOf(url);
  return def.domains.some((d) => h === d || h.endsWith(`.${d}`));
}
