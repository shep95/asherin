// people / name sources — public record and public index adapters.
//
// discipline: every adapter is measured or honestly unmeasured. an adapter that
// reaches its upstream and finds nothing returns { available:true, rows:[] }.
// an adapter whose upstream refused, rate-limited or requires a key returns
// { available:false, reason } so the ui can say why instead of implying the
// person is clean. nothing here scrapes behind a login, bypasses a paywall or
// touches a non-public system.

import { fetchJson, fetchText, extractIdentifiers } from "./httpJson.ts";
import type { IdResult, IdRow } from "./identitySources.ts";
import { runSurfaceWave } from "../surfaceRetrieval.ts";

const empty: IdResult = { available: true, rows: [] };
const unmeasured = (reason: string): IdResult => ({ available: false, reason, rows: [] });

function nameTokens(name: string): string[] {
  return name.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 1);
}

/** loose relevance gate: a hit must mention at least two tokens of the name. */
function mentionsName(haystack: string, name: string): boolean {
  const tokens = nameTokens(name);
  if (tokens.length < 2) return haystack.toLowerCase().includes(tokens[0] ?? "");
  const hay = haystack.toLowerCase();
  let seen = 0;
  for (const t of tokens) if (hay.includes(t)) seen++;
  return seen >= 2;
}

// ── encyclopaedic / entity ───────────────────────────────────────────────────

export async function wikipediaByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ query?: { search?: Array<{ title: string; snippet: string; pageid: number }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=6&srsearch=${encodeURIComponent(`"${name}"`)}`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "wikipedia unavailable");
  const hits = r.value?.query?.search ?? [];
  return {
    available: true,
    rows: hits
      .filter((h) => mentionsName(`${h.title} ${h.snippet}`, name))
      .slice(0, 6)
      .map((h) => ({
        source: "wikipedia",
        kind: "encyclopaedia",
        url: `https://en.wikipedia.org/?curid=${h.pageid}`,
        summary: `wikipedia article "${h.title}" mentions this name`,
        evidence: h.snippet.replace(/<[^>]+>/g, ""),
        discovered: [],
      })),
  };
}

// ── scholarly / authorship ───────────────────────────────────────────────────

export async function openAlexByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ results?: Array<{ id: string; display_name: string; works_count: number; orcid?: string | null; last_known_institutions?: Array<{ display_name: string }> | null }> }>(
    `https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per-page=5`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "openalex unavailable");
  const results = r.value?.results ?? [];
  return {
    available: true,
    rows: results
      .filter((a) => mentionsName(a.display_name ?? "", name))
      .slice(0, 5)
      .map((a) => ({
        source: "openalex",
        kind: "scholar",
        url: a.id,
        summary: `openalex author record — ${a.works_count} works${a.last_known_institutions?.[0] ? `, ${a.last_known_institutions[0].display_name}` : ""}`,
        discovered: a.orcid ? [{ identifier: a.orcid, kind: "url" as const }] : [],
      })),
  };
}

export async function orcidByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ "expanded-result"?: Array<{ "orcid-id": string; "given-names"?: string; "family-names"?: string; "institution-name"?: string[] }> }>(
    `https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(`"${name}"`)}&rows=5`,
    12_000,
    { accept: "application/json" },
  );
  if (!r.ok) return unmeasured(r.reason ?? "orcid unavailable");
  const rows = r.value?.["expanded-result"] ?? [];
  return {
    available: true,
    rows: rows.slice(0, 5).map((p) => ({
      source: "orcid",
      kind: "researcher",
      url: `https://orcid.org/${p["orcid-id"]}`,
      summary: `orcid researcher record for ${[p["given-names"], p["family-names"]].filter(Boolean).join(" ")}${p["institution-name"]?.[0] ? ` — ${p["institution-name"][0]}` : ""}`,
      discovered: [],
    })),
  };
}

export async function crossrefByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ message?: { items?: Array<{ title?: string[]; URL?: string; author?: Array<{ given?: string; family?: string }>; created?: { "date-time"?: string } }> } }>(
    `https://api.crossref.org/works?query.author=${encodeURIComponent(name)}&rows=5&select=title,URL,author,created`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "crossref unavailable");
  const items = r.value?.message?.items ?? [];
  return {
    available: true,
    rows: items
      .filter((it) => (it.author ?? []).some((a) => mentionsName(`${a.given ?? ""} ${a.family ?? ""}`, name)))
      .slice(0, 5)
      .map((it) => ({
        source: "crossref",
        kind: "publication",
        url: it.URL,
        summary: `authored publication: ${it.title?.[0] ?? "untitled work"}`,
        discovered: [],
      })),
  };
}

export async function pubmedByName(name: string): Promise<IdResult> {
  const tokens = nameTokens(name);
  if (tokens.length < 2) return empty;
  const term = `${tokens[tokens.length - 1]} ${tokens[0][0]}[au]`;
  const r = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=${encodeURIComponent(term)}`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "pubmed unavailable");
  const ids = r.value?.esearchresult?.idlist ?? [];
  return {
    available: true,
    rows: ids.slice(0, 5).map((id) => ({
      source: "pubmed",
      kind: "publication",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      summary: `pubmed record indexed under author query "${term}" — verify the author is the same person`,
      discovered: [],
    })),
  };
}

export async function openLibraryByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ docs?: Array<{ key: string; name: string; top_work?: string; work_count?: number }> }>(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "openlibrary unavailable");
  const docs = r.value?.docs ?? [];
  return {
    available: true,
    rows: docs
      .filter((d) => mentionsName(d.name ?? "", name))
      .slice(0, 5)
      .map((d) => ({
        source: "openlibrary",
        kind: "author",
        url: `https://openlibrary.org/authors/${d.key}`,
        summary: `published author record — ${d.work_count ?? 0} works${d.top_work ? `, e.g. "${d.top_work}"` : ""}`,
        discovered: [],
      })),
  };
}

// ── government / regulatory / legal ──────────────────────────────────────────

export async function courtListenerByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ count?: number; results?: Array<{ caseName?: string; absolute_url?: string; dateFiled?: string; court?: string; description?: string }> }>(
    `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(`"${name}"`)}&type=r&order_by=score%20desc`,
    14_000,
  );
  if (!r.ok) return unmeasured(r.reason ?? "courtlistener unavailable");
  const results = r.value?.results ?? [];
  return {
    available: true,
    rows: results.slice(0, 8).map((c) => ({
      source: "courtlistener",
      kind: "court-record",
      url: c.absolute_url ? `https://www.courtlistener.com${c.absolute_url}` : undefined,
      summary: `court docket "${c.caseName ?? "unnamed case"}"${c.court ? ` — ${c.court}` : ""}${c.dateFiled ? `, filed ${c.dateFiled}` : ""}`,
      evidence: c.description?.slice(0, 300),
      discovered: [],
    })),
  };
}

export async function federalRegisterByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ results?: Array<{ title: string; html_url: string; publication_date: string; agencies?: Array<{ name: string }> }> }>(
    `https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=relevance&conditions%5Bterm%5D=${encodeURIComponent(`"${name}"`)}&fields%5B%5D=title&fields%5B%5D=html_url&fields%5B%5D=publication_date&fields%5B%5D=agencies`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "federal register unavailable");
  const results = r.value?.results ?? [];
  return {
    available: true,
    rows: results.slice(0, 5).map((d) => ({
      source: "federalregister",
      kind: "federal-notice",
      url: d.html_url,
      summary: `federal register notice "${d.title}"${d.agencies?.[0] ? ` — ${d.agencies[0].name}` : ""}, ${d.publication_date}`,
      discovered: [],
    })),
  };
}

export async function fccLicensesByName(name: string): Promise<IdResult> {
  const r = await fetchJson<{ Licenses?: { License?: Array<{ licName: string; frn: string; callsign: string; categoryDesc?: string; serviceDesc?: string; statusDesc?: string; licenseID?: string }> } }>(
    `https://data.fcc.gov/api/license-view/basicSearch/getLicenses?searchValue=${encodeURIComponent(name)}&format=json`,
    14_000,
  );
  if (!r.ok) return unmeasured(r.reason ?? "fcc license view unavailable");
  const list = r.value?.Licenses?.License ?? [];
  return {
    available: true,
    rows: list
      .filter((l) => mentionsName(l.licName ?? "", name))
      .slice(0, 8)
      .map((l) => ({
        source: "fcc.licenses",
        kind: "license",
        url: l.licenseID ? `https://wireless2.fcc.gov/UlsApp/UlsSearch/license.jsp?licKey=${encodeURIComponent(l.licenseID)}` : undefined,
        summary: `fcc licence ${l.callsign ?? ""} held by ${l.licName}${l.serviceDesc ? ` — ${l.serviceDesc}` : ""}${l.statusDesc ? ` (${l.statusDesc})` : ""}`,
        discovered: [],
      })),
  };
}

export async function usaSpendingByName(name: string): Promise<IdResult> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort("timeout"), 14_000);
  try {
    const res = await fetch("https://api.usaspending.gov/api/v2/autocomplete/recipient/", {
      method: "POST",
      signal: c.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ search_text: name, limit: 5 }),
    });
    if (!res.ok) {
      await res.text().catch(() => "");
      return unmeasured(`usaspending http ${res.status}`);
    }
    const j = await res.json() as { results?: Array<{ recipient_name?: string; uei?: string; duns?: string }> };
    const rows = (j.results ?? [])
      .filter((r) => mentionsName(r.recipient_name ?? "", name))
      .slice(0, 5)
      .map((r): IdRow => ({
        source: "usaspending",
        kind: "federal-award-recipient",
        url: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(r.recipient_name ?? name)}`,
        summary: `federal award recipient "${r.recipient_name}"${r.uei ? ` (uei ${r.uei})` : ""}`,
        discovered: [],
      }));
    return { available: true, rows };
  } catch (e) {
    return unmeasured(e instanceof Error ? e.message : "usaspending unavailable");
  } finally {
    clearTimeout(t);
  }
}

// ── forums, news, archives ───────────────────────────────────────────────────

export async function hackerNewsByTerm(term: string): Promise<IdResult> {
  const r = await fetchJson<{ hits?: Array<{ objectID: string; title?: string; story_title?: string; author?: string; comment_text?: string; url?: string; created_at?: string }> }>(
    `https://hn.algolia.com/api/v1/search?hitsPerPage=6&query=${encodeURIComponent(`"${term}"`)}`,
  );
  if (!r.ok) return unmeasured(r.reason ?? "hacker news index unavailable");
  const hits = r.value?.hits ?? [];
  return {
    available: true,
    rows: hits.slice(0, 6).map((h) => ({
      source: "hackernews",
      kind: "forum",
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      summary: `hacker news ${h.comment_text ? "comment" : "story"}${h.author ? ` by @${h.author}` : ""}${h.created_at ? ` (${h.created_at.slice(0, 10)})` : ""}`,
      evidence: (h.comment_text ?? h.title ?? h.story_title ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
      discovered: h.author ? [{ identifier: h.author, kind: "username" as const }] : [],
    })),
  };
}

export async function gdeltByTerm(term: string): Promise<IdResult> {
  const r = await fetchJson<{ articles?: Array<{ url: string; title: string; seendate?: string; domain?: string }> }>(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${term}"`)}&mode=artlist&format=json&maxrecords=8`,
    14_000,
  );
  if (!r.ok) {
    return unmeasured(r.status === 429 ? "gdelt rate limit — one query every 5 seconds" : (r.reason ?? "gdelt unavailable"));
  }
  const arts = r.value?.articles ?? [];
  return {
    available: true,
    rows: arts.slice(0, 8).map((a) => ({
      source: "gdelt.news",
      kind: "news",
      url: a.url,
      summary: `news article "${a.title}"${a.domain ? ` — ${a.domain}` : ""}${a.seendate ? `, seen ${a.seendate.slice(0, 8)}` : ""}`,
      discovered: [],
    })),
  };
}

export async function archiveOrgByTerm(term: string): Promise<IdResult> {
  const r = await fetchJson<{ response?: { docs?: Array<{ identifier: string; title?: string; mediatype?: string; year?: string }> } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`"${term}"`)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=mediatype&fl%5B%5D=year&rows=6&page=1&output=json`,
    14_000,
  );
  if (!r.ok) return unmeasured(r.reason ?? "archive.org unavailable");
  const docs = r.value?.response?.docs ?? [];
  return {
    available: true,
    rows: docs.slice(0, 6).map((d) => ({
      source: "archive.org",
      kind: "archive-item",
      url: `https://archive.org/details/${d.identifier}`,
      summary: `archived ${d.mediatype ?? "item"} "${d.title ?? d.identifier}"${d.year ? ` (${d.year})` : ""} mentioning the term`,
      discovered: [],
    })),
  };
}

// ── open web fan-out (people aggregators, obituaries, genealogy, pastes) ─────
//
// the blueprint asks for coverage of record types that publish on the open web
// but ship no api: people aggregators, obituaries, genealogy trees, usenet
// mirrors, paste dumps. we reach them the only lawful way — the public web
// index — and we label every hit with the platform it came from.

const AGGREGATOR_SURFACES: Array<{ label: string; sites: string[]; kind: string }> = [
  { label: "people-aggregator", kind: "aggregator-profile", sites: ["thatsthem.com", "fastpeoplesearch.com", "truepeoplesearch.com", "radaris.com", "spokeo.com", "whitepages.com", "cyberbackgroundchecks.com", "clustrmaps.com", "nuwber.com"] },
  { label: "obituary", kind: "obituary", sites: ["legacy.com", "findagrave.com", "dignitymemorial.com", "echovita.com", "tributearchive.com"] },
  { label: "genealogy", kind: "genealogy", sites: ["familysearch.org", "wikitree.com", "geni.com", "ancestors.familysearch.org"] },
  { label: "usenet.groups", kind: "usenet", sites: ["groups.google.com", "narkive.com", "mail-archive.com"] },
  { label: "paste.web", kind: "paste", sites: ["pastebin.com", "ghostbin.com", "controlc.com", "justpaste.it", "rentry.co", "throwbin.io"] },
  { label: "professional", kind: "professional-profile", sites: ["linkedin.com/in", "crunchbase.com", "angel.co", "about.me", "muckrack.com"] },
  { label: "corporate-registry", kind: "corporate-officer", sites: ["opencorporates.com", "bizapedia.com", "sec.gov", "opengovus.com"] },
  { label: "property.court", kind: "public-record", sites: ["unicourt.com", "trellis.law", "docketbird.com", "county-taxes.net", "propertyshark.com"] },
];

export async function openWebSurface(term: string, group: typeof AGGREGATOR_SURFACES[number]): Promise<IdResult> {
  const scoped = `${group.sites.map((s) => `site:${s}`).join(" OR ")} "${term}"`;
  try {
    const wave = await runSurfaceWave(scoped, { limit: 8, yieldFloor: 3, providerFloor: 1 });
    if (wave.hits.length === 0 && wave.liveProviders === 0) {
      const blocked = wave.telemetry.find((t) => !t.ok)?.reason;
      return unmeasured(`open web index did not answer for ${group.label}${blocked ? ` (${blocked})` : ""}`);
    }
    const rows: IdRow[] = wave.hits
      .filter((h) => group.sites.some((s) => h.url.includes(s.split("/")[0])))
      .slice(0, 8)
      .map((h) => ({
        source: group.label,
        kind: group.kind,
        url: h.url,
        summary: `${group.label} listing: ${h.title || h.url}`,
        evidence: h.snippet?.slice(0, 300),
        discovered: extractIdentifiers(`${h.title} ${h.snippet}`),
      }));
    return { available: true, rows };
  } catch (e) {
    return unmeasured(e instanceof Error ? e.message : `${group.label} sweep failed`);
  }
}

export function surfaceGroups() {
  return AGGREGATOR_SURFACES;
}

/** broad open-web mention sweep, unscoped, for pivot fuel. */
export async function openWebMentions(term: string): Promise<IdResult> {
  try {
    const wave = await runSurfaceWave(`"${term}"`, { limit: 12, yieldFloor: 5, providerFloor: 1 });
    if (wave.hits.length === 0 && wave.liveProviders === 0) {
      return unmeasured(`open web index did not answer (${wave.telemetry.find((t) => !t.ok)?.reason ?? "blocked"})`);
    }
    return {
      available: true,
      rows: wave.hits.slice(0, 12).map((h) => ({
        source: "open-web",
        kind: "mention",
        url: h.url,
        summary: h.title || h.url,
        evidence: h.snippet?.slice(0, 300),
        discovered: extractIdentifiers(`${h.title} ${h.snippet}`),
      })),
    };
  } catch (e) {
    return unmeasured(e instanceof Error ? e.message : "open web sweep failed");
  }
}

// ── record types with no lawful free query surface ───────────────────────────
// these are declared so the operator sees the gap instead of assuming coverage.

export function unqueryablePeopleSources(): Record<string, { available: false; reason: string }> {
  return {
    "voter.registration": { available: false, reason: "us voter files are sold per state under signed use agreements; no free query api" },
    "property.assessor": { available: false, reason: "property assessment records are per-county portals with no national free api" },
    "dmv.records": { available: false, reason: "dppa restricts motor vehicle records; no public query surface" },
    "faa.airmen": { available: false, reason: "faa airmen ships as a bulk csv download, not a query api" },
    "opencorporates.api": { available: false, reason: "requires OPENCORPORATES_API_KEY" },
    "pipl": { available: false, reason: "requires a paid PIPL_API_KEY (investigative use only)" },
    "shodan": { available: false, reason: "requires SHODAN_API_KEY" },
    "censys": { available: false, reason: "requires CENSYS_API_ID and CENSYS_API_SECRET" },
  };
}

export async function verifyReachable(url: string): Promise<boolean> {
  const r = await fetchText(url, 6_000);
  return r.ok;
}
