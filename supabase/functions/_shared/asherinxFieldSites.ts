// ─────────────────────────────────────────────────────────────────────────────
// asherinx.eng — federated keyless search over public indexes.
//
// Honesty contract, stated once and enforced in code:
//   • This engine has no tap. It does not scan the internet, it does not sit
//     on a wire, it holds no breach dumps. It asks public indexes the same
//     question a browser would, in parallel, and ranks what comes back.
//   • A field site that refuses, rate-limits or returns nothing is reported as
//     a skip with its reason. Silence is never rendered as a result.
//   • Query terms are never censored. "pcap", "xkeyscore", "intercept" are
//     search strings; an empty index is an empty answer, not a refusal.
// ─────────────────────────────────────────────────────────────────────────────

export interface Hit {
  site: string;
  title: string;
  url: string;
  snippet?: string;
  /** derived provenance tags — year, kind, host. never invented. */
  genesis?: string[];
}

export interface SiteOutcome {
  site: string;
  status: "ok" | "empty" | "skip" | "fail";
  reason?: string;
  hits: Hit[];
  took_ms: number;
}

export type Domain =
  | "security" | "code" | "academic" | "world" | "legal" | "general";

/** Which field sites a domain pack fans out to. Order = reading order. */
export const DOMAIN_PACKS: Record<Domain, string[]> = {
  security: ["nvd", "cisa_kev", "github", "urlscan", "hn", "wikipedia"],
  code: ["github", "npm", "pypi", "hn", "wikipedia"],
  academic: ["openalex", "arxiv", "crossref", "pubmed", "wikipedia"],
  world: ["gdelt", "wikipedia", "wikidata", "ddg_instant", "wayback"],
  legal: ["courtlistener", "sec_efts", "gdelt", "wikipedia"],
  general: ["wikipedia", "ddg_instant", "hn", "gdelt", "wayback", "github"],
};

export const ALL_SITES = [
  "wayback", "wikipedia", "ddg_instant", "hn", "github", "nvd", "cisa_kev",
  "openalex", "arxiv", "crossref", "gdelt", "urlscan", "wikidata",
  "courtlistener", "sec_efts", "pypi", "npm", "pubmed",
] as const;

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/i;
const HOST_RE = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/|$)/i;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/;
const DOI_RE = /\b10\.\d{4,9}\/\S+\b/;

export interface Classification {
  selector: "strong" | "soft";
  domain: Domain;
  kind: string;
}

/** Read the query and pick a domain pack out loud. No model call. */
export function classify(q: string): Classification {
  const s = (q || "").trim();
  if (CVE_RE.test(s)) return { selector: "strong", domain: "security", kind: "cve" };
  if (EMAIL_RE.test(s)) return { selector: "strong", domain: "general", kind: "email" };
  if (DOI_RE.test(s)) return { selector: "strong", domain: "academic", kind: "doi" };
  if (PHONE_RE.test(s)) return { selector: "strong", domain: "general", kind: "phone" };
  if (HOST_RE.test(s)) return { selector: "strong", domain: "security", kind: "host" };
  if (/\b(vulnerab|exploit|malware|ransom|breach|patch|cwe|kev|advisor)/i.test(s))
    return { selector: "soft", domain: "security", kind: "topic" };
  if (/\b(npm|pypi|library|sdk|package|repo|github|typescript|python|rust|golang)\b/i.test(s))
    return { selector: "soft", domain: "code", kind: "topic" };
  if (/\b(study|paper|research|trial|dataset|preprint|meta-analysis|clinical)\b/i.test(s))
    return { selector: "soft", domain: "academic", kind: "topic" };
  if (/\b(court|lawsuit|filing|sec |10-k|8-k|indict|statute|plaintiff|docket)\b/i.test(s))
    return { selector: "soft", domain: "legal", kind: "topic" };
  if (/\b(war|election|protest|treaty|sanction|strike|summit|minister|president)\b/i.test(s))
    return { selector: "soft", domain: "world", kind: "topic" };
  return { selector: "soft", domain: "general", kind: "free" };
}

/* ── transport ─────────────────────────────────────────────────────────── */

const UA = "asherin.eng/1.0 (public-index reader; +https://asherin.com)";

async function get(url: string, ms: number, accept = "application/json"): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: accept },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

function yearTag(v: unknown): string[] {
  const m = String(v ?? "").match(/\b(19|20)\d{2}\b/);
  return m ? [m[0]] : [];
}

function clip(s: unknown, n = 240): string {
  const t = String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/* ── field sites ───────────────────────────────────────────────────────── */

type Fetcher = (q: string, when?: string) => Promise<Hit[]>;

const SITES: Record<string, Fetcher> = {
  async wikipedia(q) {
    const r = await get(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&format=json&srsearch=${encodeURIComponent(q)}`,
      7000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.query?.search ?? []).map((it: Record<string, unknown>) => ({
      site: "wikipedia",
      title: String(it.title),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(it.title).replace(/ /g, "_"))}`,
      snippet: clip(it.snippet),
      genesis: yearTag(it.timestamp).concat("encyclopedia"),
    }));
  },

  async ddg_instant(q) {
    const r = await get(
      `https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=${encodeURIComponent(q)}`,
      7000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    const out: Hit[] = [];
    if (j?.AbstractURL) {
      out.push({
        site: "ddg_instant", title: String(j.Heading || q), url: String(j.AbstractURL),
        snippet: clip(j.AbstractText), genesis: ["instant answer"],
      });
    }
    for (const t of (j?.RelatedTopics ?? []).slice(0, 4)) {
      if (t?.FirstURL) {
        out.push({ site: "ddg_instant", title: clip(t.Text, 90), url: String(t.FirstURL), snippet: clip(t.Text) });
      }
    }
    return out;
  },

  async hn(q) {
    const r = await get(`https://hn.algolia.com/api/v1/search?hitsPerPage=5&query=${encodeURIComponent(q)}`, 7000);
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.hits ?? []).map((h: Record<string, unknown>) => ({
      site: "hn",
      title: String(h.title || h.story_title || "(untitled)"),
      url: String(h.url || `https://news.ycombinator.com/item?id=${h.objectID}`),
      snippet: clip(h.story_text || h.comment_text || `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`),
      genesis: yearTag(h.created_at).concat("discussion"),
    }));
  },

  async github(q) {
    const r = await get(
      `https://api.github.com/search/repositories?per_page=5&q=${encodeURIComponent(q)}`,
      8000, "application/vnd.github+json",
    );
    if (r.status === 403 || r.status === 429) throw new Error("rate limited (unauthenticated)");
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.items ?? []).map((it: Record<string, unknown>) => ({
      site: "github",
      title: String(it.full_name),
      url: String(it.html_url),
      snippet: clip(it.description),
      genesis: yearTag(it.pushed_at).concat([`${it.stargazers_count ?? 0}★`, String(it.language || "")].filter(Boolean) as string[]),
    }));
  },

  async nvd(q) {
    const cve = q.match(CVE_RE)?.[0];
    const url = cve
      ? `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cve.toUpperCase())}`
      : `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=5&keywordSearch=${encodeURIComponent(q)}`;
    const r = await get(url, 12000);
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.vulnerabilities ?? []).slice(0, 5).map((v: Record<string, any>) => {
      const c = v.cve ?? {};
      const desc = (c.descriptions ?? []).find((d: any) => d.lang === "en")?.value;
      const sev = c.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity;
      return {
        site: "nvd",
        title: String(c.id),
        url: `https://nvd.nist.gov/vuln/detail/${c.id}`,
        snippet: clip(desc),
        genesis: yearTag(c.published).concat([sev ? String(sev).toLowerCase() : ""].filter(Boolean)),
      } as Hit;
    });
  },

  async cisa_kev(q) {
    const cve = q.match(CVE_RE)?.[0];
    if (!cve) throw new Error("kev is queried by cve id only");
    const r = await get(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      15000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.vulnerabilities ?? [])
      .filter((v: any) => String(v.cveID).toUpperCase() === cve.toUpperCase())
      .map((v: any) => ({
        site: "cisa_kev",
        title: `${v.cveID} — known exploited`,
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        snippet: clip(`${v.vendorProject} ${v.product}: ${v.shortDescription}`),
        genesis: yearTag(v.dateAdded).concat("exploited in the wild"),
      }));
  },

  async openalex(q) {
    const r = await get(`https://api.openalex.org/works?per-page=5&search=${encodeURIComponent(q)}`, 9000);
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.results ?? []).map((w: Record<string, any>) => ({
      site: "openalex",
      title: String(w.title || "(untitled work)"),
      url: String(w.doi || w.id),
      snippet: clip(`${w.publication_year ?? ""} · cited ${w.cited_by_count ?? 0}× · ${w.type ?? ""}`),
      genesis: yearTag(w.publication_year).concat("scholarly"),
    }));
  },

  async arxiv(q) {
    const r = await get(
      `http://export.arxiv.org/api/query?max_results=5&search_query=all:${encodeURIComponent(q)}`,
      9000, "application/atom+xml",
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const xml = await r.text();
    const entries = xml.split("<entry>").slice(1, 6);
    return entries.map((e) => {
      const title = clip(e.match(/<title>([\s\S]*?)<\/title>/)?.[1], 140);
      const link = e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "";
      const summary = clip(e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]);
      const pub = e.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? "";
      return { site: "arxiv", title, url: link, snippet: summary, genesis: yearTag(pub).concat("preprint") };
    }).filter((h) => !!h.url);
  },

  async crossref(q) {
    const r = await get(`https://api.crossref.org/works?rows=5&query=${encodeURIComponent(q)}`, 9000);
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.message?.items ?? []).map((it: Record<string, any>) => ({
      site: "crossref",
      title: clip(it.title?.[0] || "(untitled)", 140),
      url: String(it.URL || ""),
      snippet: clip(`${it["container-title"]?.[0] ?? ""} · ${it.publisher ?? ""}`),
      genesis: yearTag(it.created?.["date-time"]).concat("doi"),
    })).filter((h: Hit) => !!h.url);
  },

  async gdelt(q, when) {
    const span = when ? `&startdatetime=${when.replace(/-/g, "")}01000000&enddatetime=${when.replace(/-/g, "")}28000000` : "&timespan=3months";
    const r = await get(
      `https://api.gdeltproject.org/api/v2/doc/doc?format=json&maxrecords=5&mode=artlist&query=${encodeURIComponent(q)}${span}`,
      10000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const text = await r.text();
    let j: any;
    try { j = JSON.parse(text); } catch { throw new Error("index returned non-json"); }
    return (j?.articles ?? []).map((a: Record<string, any>) => ({
      site: "gdelt",
      title: clip(a.title, 140),
      url: String(a.url),
      snippet: clip(`${a.domain ?? ""} · ${a.seendate ?? ""}`),
      genesis: yearTag(a.seendate).concat("news"),
    }));
  },

  async urlscan(q) {
    const r = await get(`https://urlscan.io/api/v1/search/?size=5&q=${encodeURIComponent(q)}`, 9000);
    if (r.status === 401 || r.status === 429) throw new Error("public search throttled");
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.results ?? []).slice(0, 5).map((it: Record<string, any>) => ({
      site: "urlscan",
      title: String(it.page?.domain || it.task?.url || "(scan)"),
      url: String(it.result || it.task?.url || ""),
      snippet: clip(`${it.page?.ip ?? ""} ${it.page?.server ?? ""} ${it.page?.country ?? ""}`),
      genesis: yearTag(it.task?.time).concat("scan"),
    })).filter((h: Hit) => !!h.url);
  },

  async wikidata(q) {
    const r = await get(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&limit=5&format=json&search=${encodeURIComponent(q)}`,
      7000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.search ?? []).map((it: Record<string, any>) => ({
      site: "wikidata",
      title: `${it.label} (${it.id})`,
      url: String(it.concepturi || `https://www.wikidata.org/wiki/${it.id}`),
      snippet: clip(it.description),
      genesis: ["entity"],
    }));
  },

  async courtlistener(q) {
    const r = await get(
      `https://www.courtlistener.com/api/rest/v4/search/?type=o&q=${encodeURIComponent(q)}`,
      10000,
    );
    if (r.status === 401 || r.status === 403) throw new Error("public api requires a token for this query");
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.results ?? []).slice(0, 5).map((it: Record<string, any>) => ({
      site: "courtlistener",
      title: clip(it.caseName || it.caption || "(opinion)", 140),
      url: it.absolute_url ? `https://www.courtlistener.com${it.absolute_url}` : String(it.download_url || ""),
      snippet: clip(`${it.court ?? ""} · ${it.dateFiled ?? ""}`),
      genesis: yearTag(it.dateFiled).concat("opinion"),
    })).filter((h: Hit) => !!h.url);
  },

  async sec_efts(q) {
    const r = await get(
      `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${q}"`)}`,
      10000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.hits?.hits ?? []).slice(0, 5).map((h: Record<string, any>) => {
      const src = h._source ?? {};
      const id = String(h._id ?? "");
      const [adsh, file] = id.split(":");
      const cik = (src.ciks ?? [])[0] ?? "";
      const acc = String(adsh ?? "").replace(/-/g, "");
      return {
        site: "sec_efts",
        title: clip(`${src.display_names?.[0] ?? "(filer)"} — ${src.file_type ?? src.root_form ?? ""}`, 140),
        url: cik && acc && file
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${file}`
          : "https://efts.sec.gov/LATEST/search-index",
        snippet: clip(`${src.file_date ?? ""} · ${src.root_form ?? ""}`),
        genesis: yearTag(src.file_date).concat("filing"),
      } as Hit;
    });
  },

  async pypi(q) {
    const name = q.trim().split(/\s+/)[0];
    const r = await get(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, 7000);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    const i = j?.info ?? {};
    return [{
      site: "pypi",
      title: `${i.name} ${i.version ?? ""}`.trim(),
      url: String(i.package_url || `https://pypi.org/project/${name}/`),
      snippet: clip(i.summary),
      genesis: ["package", String(i.license || "").slice(0, 24)].filter(Boolean) as string[],
    }];
  },

  async npm(q) {
    const r = await get(`https://registry.npmjs.org/-/v1/search?size=5&text=${encodeURIComponent(q)}`, 8000);
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    return (j?.objects ?? []).map((o: Record<string, any>) => ({
      site: "npm",
      title: `${o.package?.name} ${o.package?.version ?? ""}`.trim(),
      url: String(o.package?.links?.npm || `https://www.npmjs.com/package/${o.package?.name}`),
      snippet: clip(o.package?.description),
      genesis: yearTag(o.package?.date).concat("package"),
    }));
  },

  async pubmed(q) {
    const r = await get(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=${encodeURIComponent(q)}`,
      9000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const j = await r.json();
    const ids: string[] = j?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const sum = await get(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
      9000,
    );
    if (!sum.ok) throw new Error(`http ${sum.status}`);
    const s = await sum.json();
    return ids.map((id) => {
      const rec = s?.result?.[id] ?? {};
      return {
        site: "pubmed",
        title: clip(rec.title || `pmid ${id}`, 140),
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: clip(`${rec.source ?? ""} · ${rec.pubdate ?? ""}`),
        genesis: yearTag(rec.pubdate).concat("clinical"),
      } as Hit;
    });
  },

  async wayback(q, when) {
    const host = q.match(HOST_RE)?.[1] ?? q.trim();
    const from = when ? when.replace(/-/g, "") : "";
    const r = await get(
      `https://web.archive.org/cdx/search/cdx?output=json&limit=5&collapse=timestamp:6&fl=timestamp,original,mimetype,statuscode&url=${encodeURIComponent(host)}${from ? `&from=${from}` : ""}`,
      12000,
    );
    if (!r.ok) throw new Error(`http ${r.status}`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows.slice(1) : []).map((row: string[]) => ({
      site: "wayback",
      title: `${host} — ${row[0]?.slice(0, 8)}`,
      url: `https://web.archive.org/web/${row[0]}/${row[1]}`,
      snippet: clip(`${row[2] ?? ""} · http ${row[3] ?? ""}`),
      genesis: yearTag(row[0]).concat("archived capture"),
    }));
  },
};

/* ── fan-out ───────────────────────────────────────────────────────────── */

export interface QueryResult {
  query: string;
  classification: Classification;
  hits: Hit[];
  sites: SiteOutcome[];
  unsure: string[];
  took_ms: number;
}

/**
 * Ask a domain pack in parallel. Every site reports its own outcome; a failure
 * degrades that row, never the answer.
 */
export async function runQuery(
  q: string,
  opts: { domain?: Domain; when?: string; sites?: string[] } = {},
): Promise<QueryResult> {
  const started = Date.now();
  const classification = classify(q);
  const domain = opts.domain ?? classification.domain;
  const pack = (opts.sites?.length ? opts.sites : DOMAIN_PACKS[domain]).filter((s) => s in SITES);

  const outcomes = await Promise.all(pack.map(async (site): Promise<SiteOutcome> => {
    const t0 = Date.now();
    try {
      const hits = await SITES[site](q, opts.when);
      return {
        site,
        status: hits.length ? "ok" : "empty",
        hits,
        took_ms: Date.now() - t0,
        reason: hits.length ? undefined : "not in this public index",
      };
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      const aborted = /abort/i.test(msg);
      return {
        site,
        status: aborted || /rate|throttl|token/i.test(msg) ? "skip" : "fail",
        reason: aborted ? "timed out" : msg.slice(0, 120),
        hits: [],
        took_ms: Date.now() - t0,
      };
    }
  }));

  // Rank: pack order first (the classifier's judgement), site rank second.
  const hits: Hit[] = [];
  for (const site of pack) {
    const o = outcomes.find((x) => x.site === site);
    if (o) hits.push(...o.hits);
  }

  const unsure = outcomes
    .filter((o) => o.status !== "ok")
    .map((o) => `${o.site}: ${o.reason ?? o.status}`);

  return { query: q, classification, hits, sites: outcomes, unsure, took_ms: Date.now() - started };
}

/* ── extract ───────────────────────────────────────────────────────────── */

const EMAIL_G = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_G = /(?:\+?\d[\d\s().-]{8,}\d)/g;

/** Star public contact strings. Never returns the full mailbox or number. */
export function starContacts(text: string): { emails: string[]; phones: string[] } {
  const emails = Array.from(new Set((text.match(EMAIL_G) ?? []).map((e) => {
    const [u, d] = e.split("@");
    return `${u.slice(0, 1)}***@${d}`;
  }))).slice(0, 20);
  const phones = Array.from(new Set((text.match(PHONE_G) ?? []).map((p) => {
    const d = p.replace(/\D/g, "");
    return d.length >= 9 ? `***${d.slice(-4)}` : "***";
  }))).slice(0, 20);
  return { emails, phones };
}

/** Cheap genesis tags off raw text — the honest half of a metadata carve. */
export function genesisTags(text: string): string[] {
  const tags: string[] = [];
  const y = text.match(/\b(19|20)\d{2}\b/g);
  if (y) tags.push(...Array.from(new Set(y)).slice(0, 3));
  for (const [re, tag] of [
    [/\bmicrosoft word|msword\b/i, "word"],
    [/\bgs_pdf|ghostscript\b/i, "ghostscript"],
    [/\blatex|pdftex\b/i, "latex"],
    [/\bcanon|nikon|iphone|pixel|samsung\b/i, "camera"],
    [/\bcloudflare\b/i, "cloudflare"],
    [/\bwordpress\b/i, "wordpress"],
  ] as [RegExp, string][]) {
    if (re.test(text)) tags.push(tag);
  }
  return Array.from(new Set(tags)).slice(0, 8);
}
