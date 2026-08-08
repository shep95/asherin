// ─────────────────────────────────────────────────────────────────────────────
// ZOPHIEL WEB FILTER — noise suppression for Ghost Engine harvests
//
// The fan-out asks sixteen questions and the open index answers all of them
// generously, including with pages that merely contain a word from the query.
// A selector search for a person should not return a Wikipedia article about
// the mail provider, a Pinterest board, a stock-photo listing, or fourteen
// mirrored copies of the same aggregator template.
//
// The filter is graded, not binary. Every lead earns a score from three
// signals and only the ones that fall below the floor are dropped:
//
//   1. HOST CLASS   — reference/aggregator/farm/shopping/parked domains carry
//                     a penalty; records, social, code, archive, gov/edu and
//                     document hosts carry a bonus.
//   2. PATH SHAPE   — search-result pages, tag/category indexes, pagination,
//                     login walls and tracker endpoints are structural noise:
//                     they are containers, not evidence.
//   3. SELECTOR FIT — the entity's own tokens appearing in URL, title or
//                     snippet, weighted by where they appear (URL > title >
//                     snippet), plus corroboration across independent legs.
//
// A host the operator explicitly named in the selector is never filtered:
// asking about example.com and then hiding example.com is the filter deciding
// it knows better than the operator, which it does not.
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterableLead {
  url: string;
  title: string;
  snippet: string;
  engine: string;
  via: string;
  corroboration: number;
}

export interface FilterVerdict<T> {
  kept: T[];
  dropped: T[];
  /** Human-readable reason counts, for the "filtered N" disclosure in the UI. */
  reasons: Record<string, number>;
}

/** Generic reference corpora — true, popular, and almost never about a person. */
const REFERENCE = [
  "wikipedia.org", "wikimedia.org", "wiktionary.org", "wikidata.org",
  "britannica.com", "dictionary.com", "merriam-webster.com", "thefreedictionary.com",
  "quora.com", "answers.com", "wikihow.com", "fandom.com", "everipedia.org",
];

/** Content farms and SEO shells — volume without provenance. */
const FARM = [
  "ezinearticles.com", "hubpages.com", "articlesbase.com", "buzzfeed.com",
  "listverse.com", "ranker.com", "slideshare.net", "scribd.com", "coursehero.com",
  "studocu.com", "chegg.com", "issuu.com", "yumpu.com", "docplayer.net",
  "vdocuments.net", "dokumen.pub", "pdfcoffee.com", "idoc.pub", "fdocuments.in",
];

/** Commerce surfaces — a name on a product page is a coincidence, not a lead. */
const SHOPPING = [
  "amazon.", "ebay.", "etsy.com", "aliexpress.com", "alibaba.com", "walmart.com",
  "target.com", "wish.com", "temu.com", "shein.com", "wayfair.com", "shutterstock.com",
  "istockphoto.com", "gettyimages.", "alamy.com", "dreamstime.com", "redbubble.com",
  "zazzle.com", "teepublic.com", "poshmark.com", "mercari.com", "bonanza.com",
];

/** Pure aggregators that republish other engines' indexes. */
const AGGREGATOR = [
  "pinterest.", "flipboard.com", "news.google.com", "bing.com", "duckduckgo.com",
  "search.yahoo.com", "yandex.", "baidu.com", "startpage.com", "ecosia.org",
  "similarweb.com", "alexa.com", "statshow.com", "siteworthtraffic.com",
  "urlm.co", "hypestat.com", "websiteoutlook.com", "worthofweb.com",
];

/** Parked / for-sale / expired-domain shells. */
const PARKED = [
  "sedo.com", "afternic.com", "dan.com", "hugedomains.com", "godaddy.com/domainsearch",
  "buydomains.com", "namecheap.com/domains", "domainmarket.com", "undeveloped.com",
];

/** Hosts that are almost always evidence when they appear at all. */
const HIGH_SIGNAL = [
  "linkedin.com", "github.com", "gitlab.com", "gist.github.com", "twitter.com",
  "x.com", "facebook.com", "instagram.com", "reddit.com", "medium.com",
  "substack.com", "keybase.io", "about.me", "angel.co", "crunchbase.com",
  "courtlistener.com", "unicourt.com", "justia.com", "pacer.gov", "sec.gov",
  "opencorporates.com", "companieshouse.gov.uk", "web.archive.org", "archive.ph",
  "pastebin.com", "ghostbin.com", "rentry.co", "controlc.com", "haveibeenpwned.com",
  "dehashed.com", "intelx.io", "leakcheck.io", "crt.sh", "shodan.io", "virustotal.com",
  "spokeo.com", "whitepages.com", "truepeoplesearch.com", "fastpeoplesearch.com",
  "radaris.com", "mylife.com", "beenverified.com", "peoplefinder.com",
];

/** Structural noise in the path: containers rather than documents. */
const NOISE_PATH = [
  /\/search\b/i, /[?&]q=/i, /[?&]query=/i, /[?&]s=/i,
  /\/tag[s]?\//i, /\/category\//i, /\/categories\//i, /\/archive[s]?\/?$/i,
  /\/page\/\d+/i, /[?&]page=\d{2,}/i,
  /\/login\b/i, /\/signin\b/i, /\/signup\b/i, /\/register\b/i,
  /\/privacy\b/i, /\/terms\b/i, /\/cookie/i, /\/robots\.txt$/i,
  /\/cdn-cgi\//i, /\/wp-json\//i, /\/feed\/?$/i, /\.rss$/i,
  /\/advertis/i, /\/sponsor/i, /doubleclick|googlesyndication|adservice/i,
];

/** Document extensions — a carved artefact outranks a rendered page. */
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|json|xml|eml|msg)(?:$|\?)/i;

const hostOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};

const anyMatch = (host: string, list: string[]) =>
  list.some((d) => (d.endsWith(".") ? host.startsWith(d) || host.includes(`.${d}`) : host === d || host.endsWith(`.${d}`) || host.includes(d)));

export interface FilterContext {
  /** Discriminating tokens for the entity under investigation. */
  tokens: string[];
  /** Hosts the operator named directly — exempt from every penalty. */
  pinnedHosts?: string[];
  /** Score floor. Raise it for a tighter cut, lower it to see more. */
  floor?: number;
}

interface Scored<T> { lead: T; score: number; reason: string }

/**
 * Score one lead. Positive is signal, negative is noise. The reason string is
 * the dominant cause and is what the UI reports when a lead is suppressed.
 */
function scoreLead(lead: FilterableLead, ctx: FilterContext): { score: number; reason: string } {
  const host = hostOf(lead.url);
  if (!host) return { score: -100, reason: "unparseable url" };

  const pinned = (ctx.pinnedHosts || []).some((h) => host === h || host.endsWith(`.${h}`));
  if (pinned) return { score: 100, reason: "pinned host" };

  let score = 0;
  let reason = "";

  // ── 1. Host class ─────────────────────────────────────────────────────────
  if (anyMatch(host, HIGH_SIGNAL)) score += 10;
  if (anyMatch(host, REFERENCE)) { score -= 9; reason = "generic reference corpus"; }
  if (anyMatch(host, FARM)) { score -= 8; reason = reason || "content farm"; }
  if (anyMatch(host, SHOPPING)) { score -= 10; reason = reason || "commerce listing"; }
  if (anyMatch(host, AGGREGATOR)) { score -= 8; reason = reason || "search aggregator"; }
  if (anyMatch(host, PARKED)) { score -= 12; reason = reason || "parked domain"; }
  if (/\.(gov|mil|edu)$/.test(host) || /\.gov\.[a-z]{2}$/.test(host)) score += 6;

  // ── 2. Path shape ─────────────────────────────────────────────────────────
  let path = "";
  try { const u = new URL(lead.url); path = u.pathname + u.search; } catch { /* noop */ }
  if (NOISE_PATH.some((re) => re.test(path))) { score -= 6; reason = reason || "container page, not a document"; }
  // A bare homepage is a door, not a finding — unless the selector *is* the host.
  if (path === "/" || path === "") { score -= 3; reason = reason || "homepage with no path"; }
  if (DOC_EXT.test(lead.url)) score += 5;
  if (path.length > 400) { score -= 3; reason = reason || "tracker-length url"; }

  // ── 3. Selector fit ───────────────────────────────────────────────────────
  const urlL = lead.url.toLowerCase();
  const titleL = (lead.title || "").toLowerCase();
  const snipL = (lead.snippet || "").toLowerCase();
  let fit = 0;
  for (const raw of ctx.tokens) {
    const t = (raw || "").toLowerCase().trim();
    if (t.length < 3) continue;
    if (urlL.includes(t)) fit += 6;
    else if (titleL.includes(t)) fit += 4;
    else if (snipL.includes(t)) fit += 2;
  }
  if (ctx.tokens.length && fit === 0) { score -= 5; reason = reason || "selector absent from url, title and snippet"; }
  score += Math.min(fit, 14);

  // Corroboration across independent legs is the strongest single vote.
  score += Math.min(Math.max(lead.corroboration - 1, 0), 6) * 2;

  // A lead with no title and no snippet is a bare URL the engine could not
  // characterise — keep it only if something else already vouched for it.
  if (!lead.title && !lead.snippet) { score -= 4; reason = reason || "no title or snippet"; }

  return { score, reason: reason || "below relevance floor" };
}

/**
 * Apply the filter. Ordering is preserved by score so the caller can render a
 * ranked list directly; `dropped` is retained so the UI can offer "show
 * everything" without a second round trip to the network.
 */
export function filterLeads<T extends FilterableLead>(
  leads: T[],
  ctx: FilterContext,
): FilterVerdict<T> {
  const floor = ctx.floor ?? 0;
  const scored: Scored<T>[] = leads.map((lead) => ({ lead, ...scoreLead(lead, ctx) }));

  // Near-duplicate suppression: aggregator mirrors republish the same title
  // under many hosts. Keep the highest-scoring copy of each title signature.
  const byTitle = new Map<string, number>();
  const sigOf = (l: T) => (l.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);

  const kept: T[] = [];
  const dropped: T[] = [];
  const reasons: Record<string, number> = {};

  for (const s of scored.sort((a, b) => b.score - a.score)) {
    const sig = sigOf(s.lead);
    if (s.score < floor) {
      dropped.push(s.lead);
      reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
      continue;
    }
    if (sig && sig.length > 24) {
      const seen = byTitle.get(sig) ?? 0;
      if (seen >= 2) {
        dropped.push(s.lead);
        reasons["duplicate title across mirrors"] = (reasons["duplicate title across mirrors"] ?? 0) + 1;
        continue;
      }
      byTitle.set(sig, seen + 1);
    }
    kept.push(s.lead);
  }

  return { kept, dropped, reasons };
}
