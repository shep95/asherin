// QUERY PLAN — Zophiel "Understand → Retrieve → Rank" stage 1 + stage 3.
//
// Narrative: the engine used to glue augmentation words onto the raw query and
// then order results purely by source credibility (`veracity`), with zero
// comparison against what the operator actually asked. Credibility ordering
// reads as randomness. This module restores topical relevance as a first-class
// ranking factor WITHOUT hard-filtering rare, high-value hits out of existence.
//
// Design constraints (flaws fixed vs. the naive version):
//  1. Required terms are variant-aware (initials, diacritics, hyphen/space) and
//     apply a PENALTY, never a filter — recall floor is preserved.
//  2. Final score is a weighted SUM with a credibility floor, not a product —
//     a near-zero relevance cannot collapse the list into ties.
//  3. Corroboration counts DISTINCT engine-independence CLASSES, because most
//     "different" engines resell the same Google/Bing index.
//  4. Pure regex/dictionary work — no LLM call, sub-millisecond, latency-safe.

export type EntityKind =
  | "person" | "organization" | "place" | "ticker"
  | "cve" | "wallet" | "domain" | "general";

export interface QueryPlan {
  raw: string;
  /** Hard-signal terms: proper nouns, IDs, tickers, domains. Missing → heavy penalty. */
  required: string[];
  /** Context terms that boost but never gate. */
  optional: string[];
  /** Terms prefixed with `-`. Presence sinks a result. */
  negative: string[];
  /** Quoted "..." phrases — exact-match bonus. */
  phrases: string[];
  entity: EntityKind;
  /** Search operators (`site:`, `filetype:`, `-site:` …) preserved verbatim. */
  operators: string[];
  /** The string that should go on the wire — the operator's words, unpolluted. */
  wireQuery: string;
}

/**
 * Dork operators must survive the planner untouched. Before this guard the
 * tokenizer split `site:linkedin.com` on the colon, quoted "linkedin.com" as a
 * proper noun and left a dangling `site:` on the wire — every operator-driven
 * dork leg silently degraded into a bag-of-words search.
 */
const OPERATOR_RE =
  /(^|\s)(-?)(site|filetype|ext|inurl|allinurl|intitle|allintitle|intext|allintext|related|cache|link|before|after|lang|loc|location|source|around|imagesize)\s*:\s*("[^"]{1,120}"|[^\s]{1,120})/gi;


const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","has","have","he","her","his",
  "how","i","in","is","it","its","me","my","of","on","or","she","that","the","their","them",
  "there","they","this","to","was","were","what","when","where","which","who","whom","why",
  "will","with","you","your","about","into","over","than","then","tell","find","give","show",
  "search","lookup","look","info","information","data","please","can","do","does","did","get",
]);

/** Strip diacritics, lowercase, collapse punctuation used as word joins. */
export function normalizeTerm(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[-_/.]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TICKER_RE = /^\$?[A-Z]{1,5}$/;
const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/i;
const WALLET_RE = /\b(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,62})\b/;
const DOMAIN_RE = /\b([a-z0-9-]+\.)+[a-z]{2,}\b/i;
const ORG_SUFFIX = /\b(inc|llc|ltd|corp|corporation|company|gmbh|plc|sa|nv|ag|holdings|group|labs|foundation)\b/i;
const PLACE_HINT = /\b(city|county|state|province|country|island|district|street|avenue|road)\b/i;

/**
 * Stage 1 — Query Understanding. Pure lexical parse, no network, no model.
 * The returned `wireQuery` is the operator's own words (minus negatives),
 * with multi-word proper nouns quoted so engines treat them atomically.
 */
export function buildQueryPlan(raw: string): QueryPlan {
  const input = (raw || "").trim();
  const phrases: string[] = [];
  const negative: string[] = [];
  const operators: string[] = [];

  // 0. Search operators come off FIRST and go back on the wire verbatim.
  let residue = input.replace(OPERATOR_RE, (_m, lead, neg, key, val) => {
    operators.push(`${neg || ""}${String(key).toLowerCase()}:${val}`);
    return String(lead || " ");
  });

  // 1. Quoted phrases are extracted verbatim (hard signal).
  residue = residue.replace(/"([^"]{2,120})"/g, (_m, p) => {
    phrases.push(String(p).trim());
    return " ";
  });

  // 2. Explicit negatives.
  residue = residue.replace(/(^|\s)-([A-Za-z0-9][\w.-]{1,40})/g, (_m, _s, t) => {
    negative.push(normalizeTerm(String(t)));
    return " ";
  });


  const required = new Set<string>();
  const optional = new Set<string>();
  /** normalized term → the operator's original spelling (for the wire query). */
  const surfaceForm = new Map<string, string>();
  const addRequired = (norm: string, original: string) => {
    if (!norm) return;
    required.add(norm);
    if (!surfaceForm.has(norm)) surfaceForm.set(norm, original.trim());
  };

  for (const p of phrases) addRequired(normalizeTerm(p), p);

  // 3. Structured identifiers are always required.
  const cve = input.match(CVE_RE);
  if (cve) addRequired(normalizeTerm(cve[0]), cve[0]);
  const wallet = input.match(WALLET_RE);
  if (wallet) addRequired(wallet[0].toLowerCase(), wallet[0]);
  const domainHit = residue.match(DOMAIN_RE);
  if (domainHit) addRequired(normalizeTerm(domainHit[0]), domainHit[0]);

  // 4. Capitalized runs = proper nouns → required as one atomic term.
  //    "Asher Shepherd Newton" becomes a single required term, not three.
  //    An ALL-CAPS acronym inside a run ("Tesla TSLA") is split off: gluing a
  //    ticker onto a company name produces a phrase no page ever contains.
  const ACRONYM = /^[A-Z0-9]{2,6}$/;
  const properRuns = residue.match(/\b([A-Z][\w'’-]+)(?:\s+(?:of|de|van|von|del|la|le)\s+[A-Z][\w'’-]+|\s+[A-Z][\w'’-]+)*/g) || [];
  for (const run of properRuns) {
    const words = run.trim().split(/\s+/);
    // Split the run into acronym singletons and title-case segments.
    const segments: string[][] = [];
    let buf: string[] = [];
    for (const w of words) {
      if (ACRONYM.test(w)) {
        if (buf.length) { segments.push(buf); buf = []; }
        segments.push([w]);
      } else buf.push(w);
    }
    if (buf.length) segments.push(buf);

    for (const seg of segments) {
      // A single capitalized stopword ("Who", "What") is sentence case, not a name.
      if (seg.length === 1 && STOPWORDS.has(seg[0].toLowerCase())) continue;
      const original = seg.join(" ");
      const n = normalizeTerm(original);
      if (!n || n.length < 2) continue;
      if (seg.length >= 2 || ACRONYM.test(seg[0])) addRequired(n, original);
      else optional.add(n);
    }
  }

  // 5. Bare uppercase tickers.
  for (const tok of residue.split(/\s+/)) {
    const t = tok.replace(/[^A-Za-z$]/g, "");
    if (t.length >= 2 && TICKER_RE.test(t) && t === t.toUpperCase()) addRequired(normalizeTerm(t), t);
  }

  // 6. Everything else that survives stopword removal is optional context.
  for (const tok of normalizeTerm(residue).split(" ")) {
    if (!tok || tok.length < 3 || STOPWORDS.has(tok)) continue;
    if ([...required].some((r) => r.split(" ").includes(tok))) continue;
    optional.add(tok);
  }

  // 7b. Collapse redundant required terms — "cve" is already inside
  //     "cve 2024 3094"; keeping both double-counts the gate denominator.
  const reqList = [...required].sort((a, b) => b.length - a.length);
  const requiredFinal: string[] = [];
  for (const t of reqList) {
    if (requiredFinal.some((k) => k === t || k.includes(t))) continue;
    requiredFinal.push(t);
  }
  for (const t of [...optional]) {
    if (requiredFinal.some((k) => k.includes(t))) optional.delete(t);
  }

  // 7. Entity classification — drives per-engine eligibility upstream.
  //    A person is a multi-word, purely alphabetic name with no acronym token.
  const phraseNorms = new Set(phrases.map(normalizeTerm));
  const looksPersonal = requiredFinal.some((r) => {
    if (phraseNorms.has(r)) return false;
    const w = r.split(" ");
    return w.length >= 2 && w.length <= 4 && w.every((x) => /^[a-z]{2,}$/.test(x));
  });
  let entity: EntityKind = "general";
  if (cve) entity = "cve";
  else if (wallet) entity = "wallet";
  else if (ORG_SUFFIX.test(input)) entity = "organization";
  else if (domainHit) entity = "domain";
  else if (requiredFinal.some((r) => /^[a-z]{1,5}$/.test(r)) && /\b(stock|ticker|share|earnings|price)\b/i.test(input)) entity = "ticker";
  else if (PLACE_HINT.test(input)) entity = "place";
  else if (looksPersonal) entity = "person";

  // 8. Wire query: operator's ORIGINAL spelling. Multi-word required terms get
  //    quoted so SERPs treat them atomically instead of bag-of-words. The
  //    literal spans they cover are stripped from the remainder so the query
  //    is never doubled (a doubled query silently drifts recall).
  const multi = requiredFinal.filter((r) => r.includes(" "));
  const quoted = multi.map((r) => `"${surfaceForm.get(r) || r}"`);
  let rest = input
    .replace(OPERATOR_RE, " ")
    .replace(/"([^"]{2,120})"/g, " ")
    .replace(/(^|\s)-([A-Za-z0-9][\w.-]{1,40})/g, " ");
  for (const term of multi) {
    const pattern = term.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_.]+");
    rest = rest.replace(new RegExp(pattern, "gi"), " ");
  }
  rest = rest
    .split(/\s+/)
    // Uppercase OR is a boolean the SERP understands — the stopword filter used
    // to eat it and collapse `A OR B` into an implicit AND.
    .filter((w) => w && (w === "OR" || !STOPWORDS.has(w.toLowerCase().replace(/[^a-z0-9]/g, ""))))
    .join(" ")
    .replace(/^(OR\s+)+|(\s+OR)+$/g, "")
    .trim();
  const wireQuery = [...quoted, rest, ...operators].filter(Boolean).join(" ").trim() || input;


  return {
    raw: input,
    required: requiredFinal,
    optional: [...optional],
    negative,
    phrases,
    entity,
    operators,
    wireQuery,
  };

}

/** Relaxed re-issue string for the rescue pass: drop quoting + optional noise. */
export function relaxedQuery(plan: QueryPlan): string {
  const core = plan.required.length ? plan.required.join(" ") : plan.raw;
  return core.slice(0, 200);
}

// ── Variant matching ────────────────────────────────────────────────────────
/**
 * "asher shepherd newton" also matches "a shepherd newton", "asher s newton",
 * "asher newton", and hyphen/period spellings. Prevents the required-term
 * gate from deleting correct pages that abbreviate a middle name.
 */
function termVariants(term: string): string[] {
  const words = term.split(" ").filter(Boolean);
  if (words.length < 2) return [term];
  const out = new Set<string>([term]);
  // initials for any single interior word
  for (let i = 0; i < words.length; i++) {
    const v = words.map((w, j) => (j === i ? w[0] : w));
    out.add(v.join(" "));
  }
  // drop interior words (middle names)
  if (words.length >= 3) out.add(`${words[0]} ${words[words.length - 1]}`);
  // last, first
  out.add(`${words[words.length - 1]} ${words[0]}`);
  return [...out];
}

function fieldHit(hay: string, term: string): boolean {
  return termVariants(term).some((v) => hay.includes(v));
}

export interface RelevanceInput {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Stage 3a — topical relevance, 0..1. Title outweighs URL outweighs snippet.
 * A required-term miss costs heavily but never zeroes the result out.
 */
export function scoreRelevance(plan: QueryPlan, doc: RelevanceInput): number {
  const title = normalizeTerm(doc.title || "");
  const url = normalizeTerm(doc.url || "");
  const snippet = normalizeTerm(doc.snippet || "");
  const all = `${title} ${url} ${snippet}`;

  if (plan.negative.some((n) => n && all.includes(n))) return 0.05;

  // Required coverage — weighted by the strongest field the term appears in.
  let covered = 0;
  let fieldWeight = 0;
  for (const term of plan.required) {
    if (!term) continue;
    if (fieldHit(title, term)) { covered++; fieldWeight += 1.0; }
    else if (fieldHit(url, term)) { covered++; fieldWeight += 0.8; }
    else if (fieldHit(snippet, term)) { covered++; fieldWeight += 0.6; }
  }
  const reqCount = plan.required.length;
  const coverage = reqCount ? covered / reqCount : 1;
  const fieldQuality = covered ? fieldWeight / covered : 0.7;

  // Optional context — capped contribution.
  let optHits = 0;
  for (const t of plan.optional) if (t && all.includes(t)) optHits++;
  const optScore = plan.optional.length ? Math.min(1, optHits / plan.optional.length) : 0;

  // Exact phrase bonus.
  let phraseBonus = 0;
  for (const p of plan.phrases) {
    const n = normalizeTerm(p);
    if (n && all.includes(n)) phraseBonus += 0.12;
  }

  // Proximity: two required terms close together in title/snippet.
  let proximity = 0;
  if (reqCount >= 2) {
    const idx = plan.required
      .map((t) => termVariants(t).map((v) => all.indexOf(v)).filter((i) => i >= 0)[0])
      .filter((i): i is number => typeof i === "number" && i >= 0)
      .sort((a, b) => a - b);
    if (idx.length >= 2 && idx[idx.length - 1] - idx[0] < 120) proximity = 0.08;
  }

  // Heavy penalty for missing required terms — floor 0.25, never a filter.
  const gate = reqCount ? 0.25 + 0.75 * coverage : 1;
  const base = 0.62 * coverage * fieldQuality + 0.22 * optScore + phraseBonus + proximity;

  return Math.max(0.02, Math.min(1, base * gate + (reqCount ? 0 : 0.35)));
}

// ── Engine independence classes ─────────────────────────────────────────────
// Most "different" engines resell one index. Corroborating on raw engine count
// counts the same crawl up to five times.
const ENGINE_CLASS: Record<string, string> = {
  firecrawl: "google-derived",
  searxng: "google-derived",
  brave: "brave-index",
  ddg: "bing-derived",
  metager: "bing-derived",
  gigablast: "bing-derived",
  mojeek: "independent-crawl",
  yandex: "independent-crawl",
  "common-crawl": "independent-crawl",
  wayback: "archive",
  wikipedia: "curated",
  "google-books": "curated",
  github: "primary-record",
  "sec-edgar": "primary-record",
  crossref: "primary-record",
  openalex: "primary-record",
  blockchair: "primary-record",
  hibp: "primary-record",
  shodan: "primary-record",
  "nvd-cve": "primary-record",
  hackernews: "social",
  reddit: "social",
  ahmia: "dark",
};

export function engineClass(engine?: string): string {
  return ENGINE_CLASS[(engine || "").toLowerCase()] || "other";
}

/** Distinct-class corroboration bonus, capped at +0.15 on the credibility axis. */
export function corroborationBonus(engines: string[] | undefined): number {
  if (!engines || engines.length < 2) return 0;
  const classes = new Set(engines.map(engineClass));
  return Math.min(0.15, (classes.size - 1) * 0.05);
}

/**
 * Stage 3b — final ordering score. Weighted sum, credibility floored at 0.5 so
 * no source is annihilated and no list collapses into ties.
 */
export function finalScore(opts: {
  relevance: number;
  veracity: number;
  engines?: string[];
  hostile?: boolean;
}): number {
  const credibility = Math.max(0.5, Math.min(1, opts.veracity / 100)) + corroborationBonus(opts.engines);
  const raw = 0.65 * opts.relevance + 0.35 * Math.min(1, credibility);
  return Math.round((opts.hostile ? raw * 0.35 : raw) * 1000) / 1000;
}
