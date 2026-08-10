/**
 * ZOPHIEL HOP CHAIN — recursive entity resolution with context-anchored
 * query propagation ("3-way hopping").
 *
 * This is not a search engine. It is an entity-graph expander: hop 1 answers
 * the seed question, hops 2 and 3 are written BY the answers of the hop before
 * them. Seven resident thinking patterns govern the expansion:
 *
 *   P1  Entity extraction (NER)        — what did the corpus actually name?
 *   P2  Betweenness/centrality ranking — which named thing unlocks the most?
 *   P3  Context anchoring              — the subject stays pinned every hop.
 *   P4  Deduplication + convergence    — stop when the chain stops paying.
 *   P5  Diffusion weighting            — a claim in 5 domains outranks 1.
 *   P6  Dark-data extraction           — read the container, not just the body.
 *   P7  Query morphology               — one entity becomes many query shapes.
 *
 * Every function here is deterministic and model-free. Nothing below invents a
 * fact; each extracted entity carries the URLs it was read from.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HopDoc {
  url: string;
  title: string;
  snippet: string;
  domain?: string;
  publishDate?: string;
}

export type HopEntityKind =
  | "org"
  | "person"
  | "place"
  | "role"
  | "tech"
  | "handle"
  | "email"
  | "phone"
  | "domain"
  | "date";

export interface HopEntity {
  key: string;            // normalized identity (lowercased)
  label: string;          // display form as written in the corpus
  kind: HopEntityKind;
  mentions: number;
  domains: string[];      // distinct source domains (P5 diffusion evidence)
  sources: string[];      // up to 5 source URLs
  darkData: boolean;      // P6 — read from the container, not the body text
  centrality: number;     // P2 — 0..1 unlock potential
  firstHop: number;
}

export interface HopQuery {
  q: string;
  hop: number;
  anchored: boolean;
  from: string;           // entity label that generated it
  shape: string;          // morphology template id (P7)
}

export interface HopRecord {
  hop: number;
  queries: HopQuery[];
  docsSeen: number;
  docsNew: number;
  noveltyRatio: number;
  entitiesFound: number;
  converged: boolean;
  ms: number;
}

export interface HopChainReport {
  anchor: string;
  hops: HopRecord[];
  entities: HopEntity[];
  newDocs: HopDoc[];
  convergedAtHop: number | null;
  stopReason: "converged" | "budget" | "depth" | "no-seeds";
  totalQueries: number;
  totalMs: number;
}

export interface HopChainOptions {
  anchor: string;                 // the identity that must never drift (P3)
  seedDocs: HopDoc[];             // hop-1 corpus, already retrieved
  searchFn: (q: string) => Promise<HopDoc[]>;
  maxHops?: number;               // default 3
  queriesPerHop?: number;         // default 4
  budgetMs?: number;              // default 22000
  perQueryTimeoutMs?: number;     // default 7000
  concurrency?: number;           // default 3
  noveltyFloor?: number;          // default 0.15 (P4)
}

// ─────────────────────────────────────────────────────────────────────────────
// P1 — Entity extraction
// ─────────────────────────────────────────────────────────────────────────────

const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "our", "you",
  "new", "all", "how", "who", "what", "when", "where", "why", "best", "top",
  "home", "about", "contact", "privacy", "terms", "search", "results", "page",
  "free", "online", "login", "sign", "read", "more", "news", "view", "learn",
  "united states", "north america", "google", "facebook", "twitter", "linkedin",
  "instagram", "youtube", "wikipedia", "amazon", "microsoft", "apple inc",
]);

const ORG_SUFFIX =
  /\b(?:inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|group|holdings|partners|labs?|technologies|technology|systems|solutions|ventures|capital|associates|foundation|institute|university|college|hospital|agency|studio|media|networks?|software|ai|analytics|consulting|services|enterprises|industries|trust|bank|realty|properties|construction|logistics)\b\.?/i;

const ROLE_RE =
  /\b(?:chief\s+\w+\s+officer|c[eotifs]o|founder|co-?founder|president|vice\s+president|vp|director|managing\s+director|partner|principal|owner|manager|engineer|developer|architect|analyst|scientist|researcher|professor|attorney|counsel|agent|broker|realtor|consultant|administrator|supervisor|technician|nurse|physician|pastor|driver|contractor)\b/gi;

const TECH_RE =
  /\b(?:artificial intelligence|machine learning|deep learning|blockchain|cybersecurity|osint|kubernetes|typescript|javascript|python|react|node\.js|postgres|supabase|aws|azure|salesforce|solidity|llm|gpt|nlp|computer vision|robotics|saas|fintech|biotech)\b/gi;

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g;
const HANDLE_RE = /(?:^|[\s(])@([a-z0-9_]{3,30})\b/gi;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;

const US_STATES =
  /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/gi;

/**
 * Proper-noun runs: "Neon Logic AI", "Jennifer Newton", "Cape Coral".
 * Deliberately excludes "." from the token body — a run that swallows a
 * sentence terminator produces phantom organizations like
 * "Neon Logic AI. Asher Shepherd", which then get spent as search pivots.
 */
const PROPER_RUN_RE = /\b([A-Z][A-Za-z&'-]{1,24}(?:\s+[A-Z][A-Za-z&'-]{1,24}){0,4})\b/g;

/** Sentence splitter — the boundary the run matcher must never cross. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;:])\s+|\s*[|·•—]\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Words that are never an entity on their own and never end a valid run. */
const RUN_NOISE = new Set([
  "and", "of", "the", "for", "with", "at", "in", "on", "to", "a", "an", "or",
  "founder", "cofounder", "ceo", "cto", "cfo", "coo", "president", "director",
  "manager", "officer", "owner", "partner", "contact", "about", "profile",
  "linkedin", "facebook", "twitter", "instagram", "email", "phone", "address",
  "mr", "mrs", "ms", "dr", "view", "see", "read", "more", "home", "search",
]);

function trimRun(run: string): string {
  const parts = run.split(/\s+/);
  while (parts.length && RUN_NOISE.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  while (parts.length && RUN_NOISE.has(parts[0].toLowerCase())) parts.shift();
  return parts.join(" ");
}


function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@. ]+/g, " ").replace(/\s+/g, " ").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * P6 — dark data. The container around a result carries identity that the body
 * text often omits: profile slugs, author paths, filing accession numbers.
 */
function extractDarkData(doc: HopDoc): Array<{ label: string; kind: HopEntityKind }> {
  const out: Array<{ label: string; kind: HopEntityKind }> = [];
  let u: URL | null = null;
  try { u = new URL(doc.url); } catch { return out; }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);

  // Profile slugs on identity-bearing hosts → the handle IS the identity.
  const SLUG_HOSTS: Record<string, number> = {
    "linkedin.com": 1, "github.com": 0, "x.com": 0, "twitter.com": 0,
    "facebook.com": 0, "instagram.com": 0, "medium.com": 0, "about.me": 0,
    "angel.co": 1, "crunchbase.com": 1, "muckrack.com": 1, "substack.com": 0,
  };
  if (host in SLUG_HOSTS) {
    const idx = SLUG_HOSTS[host];
    const slug = segs[idx] ?? segs[0];
    if (slug && slug.length >= 3 && !/^(in|company|people|search|posts?)$/i.test(slug)) {
      out.push({ label: slug.replace(/[-_]+/g, " ").slice(0, 60), kind: "handle" });
    }
  }

  // Author/contributor paths — publication bylines are the cheapest link edge.
  const authorIdx = segs.findIndex((s) => /^(author|authors|profile|people|staff|team|member)$/i.test(s));
  if (authorIdx >= 0 && segs[authorIdx + 1]) {
    out.push({ label: segs[authorIdx + 1].replace(/[-_]+/g, " ").slice(0, 60), kind: "person" });
  }

  // The host itself is an entity worth pivoting on when it is not a mega-portal.
  if (host && !/(google|bing|duckduckgo|yahoo|wikipedia|youtube|reddit|facebook|pinterest)\./.test(host)) {
    out.push({ label: host, kind: "domain" });
  }

  return out;
}

/** P1 + P6 combined pass over one hop's corpus. */
export function extractEntities(
  docs: HopDoc[],
  anchor: string,
  hop: number,
  into: Map<string, HopEntity>,
): void {
  const anchorTokens = new Set(normKey(anchor).split(" ").filter((t) => t.length > 2));

  const add = (
    rawLabel: string,
    kind: HopEntityKind,
    doc: HopDoc,
    dark: boolean,
  ) => {
    const label = rawLabel.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
    if (label.length < 3 || label.length > 70) return;
    // Org canonicalization: "Neon Logic AI" and "NEON LOGIC AI LLC" are one
    // pivot, not two. Without this the chain spends half its query budget
    // re-asking the same question with a legal suffix attached.
    const bare = normKey(label);
    const canon = kind === "org"
      ? bare.replace(/\b(?:inc|llc|l l c|ltd|limited|corp|corporation|co|company|group|holdings|plc)\b\.?/g, "").replace(/\s+/g, " ").trim() || bare
      : bare;
    const key = `${kind}:${canon}`;
    if (!bare || STOP_TOKENS.has(bare)) return;
    // P3 guard — never re-emit the anchor itself as a pivot target.
    const bareTokens = bare.split(" ");
    if (bareTokens.length && bareTokens.every((t) => anchorTokens.has(t))) return;
    if (kind !== "email" && kind !== "phone" && kind !== "domain" && kind !== "handle") {
      if (bareTokens.every((t) => STOP_TOKENS.has(t))) return;
    }

    const host = doc.domain || hostOf(doc.url);
    const cur = into.get(key);
    if (cur) {
      cur.mentions += 1;
      if (label.length < cur.label.length) cur.label = label;
      if (host && !cur.domains.includes(host)) cur.domains.push(host);
      if (cur.sources.length < 5 && !cur.sources.includes(doc.url)) cur.sources.push(doc.url);
      cur.darkData = cur.darkData || dark;
    } else {
      into.set(key, {
        key,
        label,
        kind,
        mentions: 1,
        domains: host ? [host] : [],
        sources: [doc.url],
        darkData: dark,
        centrality: 0,
        firstHop: hop,
      });
    }
  };

  for (const doc of docs) {
    const text = `${doc.title || ""}. ${doc.snippet || ""}`.slice(0, 4000);

    for (const m of text.matchAll(EMAIL_RE)) add(m[0], "email", doc, false);
    for (const m of text.matchAll(PHONE_RE)) add(m[0], "phone", doc, false);
    for (const m of text.matchAll(HANDLE_RE)) add(m[1], "handle", doc, false);
    for (const m of text.matchAll(ROLE_RE)) add(m[0], "role", doc, false);
    for (const m of text.matchAll(TECH_RE)) add(m[0], "tech", doc, false);
    for (const m of text.matchAll(US_STATES)) add(m[0], "place", doc, false);
    for (const m of text.matchAll(YEAR_RE)) add(m[0], "date", doc, false);

    // Runs are matched per sentence so a terminator can never be swallowed,
    // and a single bare capitalized word is only kept when it carries an org
    // suffix — otherwise every sentence-initial word becomes a fake company.
    for (const sent of sentences(text)) {
      for (const m of sent.matchAll(PROPER_RUN_RE)) {
        const run = trimRun(m[1] || "");
        if (!run) continue;
        const words = run.split(/\s+/);
        if (words.length > 5) continue;
        const hasOrgSuffix = ORG_SUFFIX.test(run);
        if (words.length < 2 && !hasOrgSuffix) continue;
        const kind: HopEntityKind = hasOrgSuffix
          ? "org"
          : /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+$/.test(run)
            ? "person"
            : "org";
        add(run, kind, doc, false);
      }
    }


    for (const dd of extractDarkData(doc)) add(dd.label, dd.kind, doc, true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P2 + P5 — centrality ranking with diffusion weighting
// ─────────────────────────────────────────────────────────────────────────────

const KIND_UNLOCK: Record<HopEntityKind, number> = {
  org: 1.0,        // an employer is the single highest-yield pivot
  person: 0.85,    // an associate opens a second identity axis
  domain: 0.7,
  handle: 0.65,
  email: 0.6,
  role: 0.45,
  tech: 0.4,
  phone: 0.55,
  place: 0.2,      // a city rarely unlocks anything a name has not
  date: 0.1,
};

export function rankEntities(entities: HopEntity[]): HopEntity[] {
  const maxMentions = Math.max(1, ...entities.map((e) => e.mentions));
  for (const e of entities) {
    const freq = e.mentions / maxMentions;                       // repetition
    const diffusion = Math.min(1, (e.domains.length - 1) / 3);   // P5 cross-source
    const dark = e.darkData ? 0.1 : 0;                           // P6 bonus
    e.centrality = Math.min(
      1,
      KIND_UNLOCK[e.kind] * (0.45 + 0.3 * freq + 0.25 * diffusion) + dark,
    );
  }
  return entities.sort((a, b) => b.centrality - a.centrality || b.mentions - a.mentions);
}

// ─────────────────────────────────────────────────────────────────────────────
// P3 + P7 — context-anchored query morphology
// ─────────────────────────────────────────────────────────────────────────────

const quoted = (s: string) => (/\s/.test(s) ? `"${s.replace(/"/g, "")}"` : s);

/** One entity becomes several differently-shaped queries, all anchor-pinned. */
export function morphQueries(
  anchor: string,
  entity: HopEntity,
  hop: number,
  allowUnanchored: boolean,
): HopQuery[] {
  const a = quoted(anchor);
  const e = quoted(entity.label);
  const out: HopQuery[] = [];
  const push = (q: string, shape: string, anchored = true) =>
    out.push({ q, hop, anchored, from: entity.label, shape });

  switch (entity.kind) {
    case "org":
      push(`${a} ${e}`, "identity×org");
      push(`${a} ${e} role OR title OR position`, "identity×org×role");
      if (allowUnanchored) push(`${e} team OR leadership OR founders`, "org×people", false);
      break;
    case "person":
      push(`${a} ${e}`, "identity×associate");
      push(`${a} ${e} together OR partner OR colleague OR family`, "identity×associate×relation");
      break;
    case "domain":
      push(`${a} site:${entity.label}`, "identity×site");
      push(`${a} ${quoted(entity.label.replace(/\.[a-z.]+$/, ""))}`, "identity×brand");
      break;
    case "handle":
      push(`${a} ${e}`, "identity×handle");
      push(`${e} profile OR bio`, "handle×profile", false);
      break;
    case "email":
      push(`${e}`, "email×exact", false);
      push(`${a} ${quoted(entity.label.split("@")[1] ?? "")}`, "identity×maildomain");
      break;
    case "phone":
      push(`${e}`, "phone×exact", false);
      break;
    case "role":
      push(`${a} ${e}`, "identity×role");
      break;
    case "tech":
      push(`${a} ${e}`, "identity×tech");
      break;
    case "place":
      push(`${a} ${e} records OR property OR business`, "identity×place×records");
      break;
    default:
      push(`${a} ${e}`, "identity×generic");
  }

  // P3 hard guard: an unanchored query is only allowed where explicitly
  // permitted, otherwise the chain drifts into generic pages about the company.
  return out.filter((q) => q.anchored || allowUnanchored);
}

// ─────────────────────────────────────────────────────────────────────────────
// P4 — dedup, convergence, and the chain driver
// ─────────────────────────────────────────────────────────────────────────────

function urlKey(url: string): string {
  return url
    .replace(/[#?].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .toLowerCase();
}

function queryKey(q: string): string {
  return q.toLowerCase().replace(/["']/g, "").replace(/\s+/g, " ").trim();
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: number | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((res) => { t = setTimeout(() => res(fallback), ms) as unknown as number; }),
    ]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}

/** Bounded-concurrency map — the fan-out must never stampede the engines. */
async function pooled<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = undefined as unknown as R; }
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runHopChain(opts: HopChainOptions): Promise<HopChainReport> {
  const {
    anchor,
    seedDocs,
    searchFn,
    maxHops = 3,
    queriesPerHop = 4,
    budgetMs = 22000,
    perQueryTimeoutMs = 7000,
    concurrency = 3,
    noveltyFloor = 0.15,
  } = opts;

  const started = Date.now();
  const remaining = () => budgetMs - (Date.now() - started);

  const entityMap = new Map<string, HopEntity>();
  const seenUrls = new Set(seedDocs.map((d) => urlKey(d.url)));
  const firedQueries = new Set<string>();
  const usedEntities = new Set<string>();
  const hops: HopRecord[] = [];
  const newDocs: HopDoc[] = [];

  // Hop 1 is the corpus already in hand — extract, do not re-search.
  extractEntities(seedDocs, anchor, 1, entityMap);
  hops.push({
    hop: 1,
    queries: [],
    docsSeen: seedDocs.length,
    docsNew: seedDocs.length,
    noveltyRatio: 1,
    entitiesFound: entityMap.size,
    converged: false,
    ms: 0,
  });

  let stopReason: HopChainReport["stopReason"] = "depth";
  let convergedAtHop: number | null = null;
  let totalQueries = 0;

  for (let hop = 2; hop <= maxHops; hop++) {
    // A hop needs only enough time for ONE bounded query; the per-query timeout
    // is already clamped to whatever budget is left. Gating on the full
    // per-query timeout aborted hop 2 whenever the caller passed a tight
    // budget, which silently degraded the chain to a flat search.
    if (remaining() < 1500) { stopReason = "budget"; break; }
    const hopStart = Date.now();

    // P2 — pick the highest-unlock entities not already spent, and require
    // corroboration (2+ domains) OR strong dark-data provenance before paying
    // a search for them. One-off noise never becomes a query.
    const ranked = rankEntities([...entityMap.values()]).filter(
      (e) => !usedEntities.has(e.key) &&
        (e.domains.length >= 2 || e.mentions >= 2 || e.darkData) &&
        e.centrality >= 0.35,
    );
    if (ranked.length === 0) { stopReason = "no-seeds"; break; }

    // P7 — morph the top seeds into differently-shaped queries.
    const queries: HopQuery[] = [];
    for (const ent of ranked) {
      if (queries.length >= queriesPerHop) break;
      usedEntities.add(ent.key);
      for (const q of morphQueries(anchor, ent, hop, hop >= 3)) {
        const k = queryKey(q.q);
        if (firedQueries.has(k)) continue;
        firedQueries.add(k);
        queries.push(q);
        if (queries.length >= queriesPerHop) break;
      }
    }
    if (queries.length === 0) { stopReason = "no-seeds"; break; }

    const batches = await pooled(queries, concurrency, (q) =>
      withTimeout(searchFn(q.q).catch(() => [] as HopDoc[]), Math.min(perQueryTimeoutMs, Math.max(1500, remaining())), [] as HopDoc[]),
    );

    let seen = 0;
    const fresh: HopDoc[] = [];
    for (const batch of batches) {
      for (const d of batch ?? []) {
        seen++;
        const k = urlKey(d.url);
        if (!k || seenUrls.has(k)) continue;   // P4 dedup
        seenUrls.add(k);
        fresh.push(d);
      }
    }

    const before = entityMap.size;
    extractEntities(fresh, anchor, hop, entityMap);
    newDocs.push(...fresh);

    const novelty = seen > 0 ? fresh.length / seen : 0;
    const converged = seen > 0 && novelty < noveltyFloor;
    totalQueries += queries.length;

    hops.push({
      hop,
      queries,
      docsSeen: seen,
      docsNew: fresh.length,
      noveltyRatio: Number(novelty.toFixed(3)),
      entitiesFound: entityMap.size - before,
      converged,
      ms: Date.now() - hopStart,
    });

    // P4 — the chain closes when new queries stop returning new ground.
    if (converged) { convergedAtHop = hop; stopReason = "converged"; break; }
  }

  return {
    anchor,
    hops,
    entities: rankEntities([...entityMap.values()]).slice(0, 60),
    newDocs,
    convergedAtHop,
    stopReason,
    totalQueries,
    totalMs: Date.now() - started,
  };
}

/**
 * The identity anchor is the subject's name, stripped of the question wrapper
 * and the locator clause. "who is asher shepherd newton who lives in cape coral
 * florida" → "asher shepherd newton". Without this the anchor carries "who is"
 * into every downstream query and every hop returns dictionary pages.
 */
export function deriveAnchor(query: string): string {
  let t = (query || "").trim();
  t = t.replace(/^\s*(?:who\s+(?:is|was|are)|who's|tell me about|background\s+(?:check\s+)?on|look\s?up|dossier\s+on|intel\s+on|profile\s+of|research\s+on|everything\s+(?:about|on)|find\s+(?:me\s+)?(?:info\s+on\s+)?)\s+/i, "");
  t = t.replace(/\s+(?:who|that)\s+(?:lives?|resides?|works?|is\s+based).*$/i, "");
  t = t.replace(/\s+(?:in|from|of|at)\s+[a-z\s]{3,40}$/i, (m) =>
    // keep the locator only when nothing else would remain
    t.replace(m, "").trim().length >= 4 ? "" : m,
  );
  t = t.replace(/[?.!]+$/g, "").replace(/\s+/g, " ").trim();
  return t.length >= 3 ? t : (query || "").trim();
}
