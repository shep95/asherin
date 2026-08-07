/**
 * Structural, temporal, evidential and stealth analysis of GEO pages.
 *
 * Four independent measurements, each traced to a 2026 result the earlier
 * semantic-only layer does not cover. All pure functions over the GeoPage
 * model: imported by React at runtime and by the Vite build plugin under Node,
 * so nothing here may touch `window` or `document`.
 *
 *  1. GEO-SFE — "Structural Feature Engineering for Generative Engine
 *     Optimization" (arXiv:2603.29979). Structure *independent of semantics*
 *     moves citation rate by 17.3% across six engines. The gain decomposes
 *     into three levels that behave independently: macro-structure 44.9%,
 *     meso-structure 39.7%, micro-structure 15.4%. Those are the weights below.
 *
 *  2. Semantic Entropy Drift — "Beyond Retrieval: Modeling Confidence Decay
 *     and Deterministic Agentic Platforms in GEO" (arXiv:2604.03656, Fukuoka
 *     Institute of Technology + Yishu Research). A page's cited-confidence
 *     decays continuously against wall-clock time unless its figures and
 *     timestamps are re-confirmed. Decay is modelled as a half-life per page
 *     class, because a price goes stale far faster than a definition.
 *
 *  3. Evidence genres — "From Citation Selection to Citation Absorption"
 *     (arXiv:2604.25707). Q&A formatting alone does not raise absorption. Four
 *     genres do: definitions, numerical facts, comparisons, procedural steps.
 *
 *  4. Stealth ceiling — GEO-Bench (arXiv:2605.29107). Optimisation is
 *     detectable: keyword-violation rate and perplexity ratio separate
 *     legitimate content from ranking manipulation. Everything this codebase
 *     does must stay under that ceiling, so the ceiling is measured rather
 *     than assumed.
 */

import {
  GEO_CONTENT,
  answerWordCount,
  effectiveUpdated,
  pageClass,
  type GeoPage,
  type GeoPageClass,
} from "./geoContent";

/* ========================================================================= *
 * 1. GEO-SFE structural scoring
 * ========================================================================= */

/** Published contribution of each structural level to the measured gain. */
export const SFE_WEIGHTS = { macro: 0.449, meso: 0.397, micro: 0.154 } as const;

export interface SfeLevel {
  /** 0-1. */
  score: number;
  features: { id: string; label: string; value: number; detail: string }[];
}

export interface SfeScore {
  macro: SfeLevel;
  meso: SfeLevel;
  micro: SfeLevel;
  /** 0-1, weighted by the published level contributions. */
  weighted: number;
  /** 0-100, for display. */
  percent: number;
  findings: string[];
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * The discrete rendered blocks of a page, in render order.
 *
 * This mirrors GeoBlock's section order exactly. Meso-structure is measured on
 * these units because they are what a web chunker splits on — W-RAC
 * (arXiv:2604.04936) shows retrievers group by heading-addressable units, so
 * a unit is only real if it has its own heading in the DOM.
 */
export interface GeoChunk {
  id: string;
  label: string;
  /** Approximate word count of the rendered unit. */
  words: number;
  /** Atomic rows inside the unit (table rows, list items). 1 for prose. */
  rows: number;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function chunksOf(page: GeoPage): GeoChunk[] {
  const out: GeoChunk[] = [];
  out.push({ id: "answer", label: "Answer", words: answerWordCount(page.answer), rows: 1 });

  if (page.attributes?.length) {
    out.push({
      id: "attributes",
      label: "Attributes",
      words: page.attributes.reduce((n, a) => n + words(`${a.name} ${a.value} ${a.unit ?? ""}`), 0),
      rows: page.attributes.length,
    });
  }
  if (page.stats.length) {
    out.push({
      id: "stats",
      label: "Figures",
      words: page.stats.reduce((n, s) => n + words(`${s.label} ${s.value} ${s.source}`), 0),
      rows: page.stats.length,
    });
  }
  if (page.comparisons?.length) {
    out.push({
      id: "comparisons",
      label: "Comparisons",
      words: page.comparisons.reduce(
        (n, c) => n + words(`${c.versus} ${c.dimension} ${c.asherin} ${c.other}`),
        0,
      ),
      rows: page.comparisons.length,
    });
  }
  if (page.procedure?.steps.length) {
    out.push({
      id: "procedure",
      label: "Procedure",
      words: page.procedure.steps.reduce((n, s) => n + words(s), 0),
      rows: page.procedure.steps.length,
    });
  }
  if (page.citations?.length) {
    out.push({
      id: "citations",
      label: "Sources",
      words: page.citations.reduce((n, c) => n + words(`${c.title} ${c.publisher}`), 0),
      rows: page.citations.length,
    });
  }
  if (page.corroboration?.length) {
    out.push({
      id: "corroboration",
      label: "Corroboration",
      words: page.corroboration.reduce((n, c) => n + words(`${c.label} ${c.confirms}`), 0),
      rows: page.corroboration.length,
    });
  }
  if (page.revisions?.length) {
    out.push({
      id: "revisions",
      label: "Revisions",
      words: page.revisions.reduce((n, r) => n + words(r.note), 0),
      rows: page.revisions.length,
    });
  }
  if (page.faqs?.length) {
    out.push({
      id: "faqs",
      label: "Questions",
      words: page.faqs.reduce((n, f) => n + words(`${f.q} ${f.a}`), 0),
      rows: page.faqs.length,
    });
  }
  if (page.related?.length) {
    out.push({
      id: "related",
      label: "Related",
      words: page.related.reduce((n, r) => n + words(r.label), 0),
      rows: page.related.length,
    });
  }
  return out;
}

/** Chunks below this are too thin to stand alone in a retrieved set. */
export const MIN_CHUNK_WORDS = 12;
/** Above this a chunk gets split across retrieval boundaries mid-claim. */
export const MAX_CHUNK_WORDS = 220;
/** Macro-structure target: a page needs this many addressable sections. */
export const TARGET_SECTIONS = 7;
/** Macro-structure target: internal links out of the page. */
export const TARGET_INTERNAL_LINKS = 4;

function macroLevel(page: GeoPage): SfeLevel {
  const chunks = chunksOf(page);
  const sectionCount = chunks.length;

  // Heading hierarchy depth: h2 (topic) -> h3 (each section) -> rows. A page
  // with one section is a wall of text to a chunker regardless of length.
  const depth = clamp01(sectionCount / TARGET_SECTIONS);

  // Section balance: low dispersion of section sizes. A page where one section
  // is 90% of the words chunks into one useful unit and eight useless ones.
  const sizes = chunks.map((c) => c.words).filter((n) => n > 0);
  const mean = sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length);
  const sd =
    sizes.length > 1
      ? Math.sqrt(sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length)
      : 0;
  const cv = mean > 0 ? sd / mean : 1;
  const balance = clamp01(1 - cv / 1.5);

  // Logical progression: definition first, then evidence, then references.
  // GeoBlock renders in this fixed order, so the check is that the spine
  // exists at all rather than that it is ordered.
  const spine = ["answer", "stats", "comparisons", "procedure"];
  const present = spine.filter((id) => chunks.some((c) => c.id === id)).length;
  const progression = clamp01(present / spine.length);

  const links = (page.related?.length ?? 0) + (page.supersedes?.length ?? 0);
  const linkDensity = clamp01(links / TARGET_INTERNAL_LINKS);

  const features = [
    { id: "depth", label: "Heading hierarchy depth", value: depth, detail: `${sectionCount} addressable sections` },
    { id: "balance", label: "Section balance", value: balance, detail: `CV ${cv.toFixed(2)}` },
    { id: "progression", label: "Logical progression", value: progression, detail: `${present}/4 spine sections` },
    { id: "links", label: "Internal linking density", value: linkDensity, detail: `${links} internal links` },
  ];
  return { score: features.reduce((a, f) => a + f.value, 0) / features.length, features };
}

function mesoLevel(page: GeoPage): SfeLevel {
  const chunks = chunksOf(page);
  const inBand = chunks.filter((c) => c.words >= MIN_CHUNK_WORDS && c.words <= MAX_CHUNK_WORDS);
  const sizing = chunks.length ? clamp01(inBand.length / chunks.length) : 0;

  // Atomic rows: an engine lifts a row, not a paragraph. Row count across the
  // page is the direct measure of how much of it is liftable in isolation.
  const rows = chunks.reduce((n, c) => n + c.rows, 0);
  const modularity = clamp01(rows / 24);

  // Addressability (W-RAC): every unit must carry a stable DOM id so the
  // chunker splits on our boundaries. GeoBlock emits one id per chunk, so this
  // is structurally guaranteed and reported rather than assumed.
  const addressable = chunks.length > 0 ? 1 : 0;

  // Answer band: the extractable unit itself must sit in the 40-60 word band.
  const aw = answerWordCount(page.answer);
  const answerBand = aw >= 40 && aw <= 60 ? 1 : clamp01(1 - Math.abs(aw - 50) / 50);

  const features = [
    { id: "sizing", label: "Chunk sizes inside retrieval band", value: sizing, detail: `${inBand.length}/${chunks.length} in ${MIN_CHUNK_WORDS}-${MAX_CHUNK_WORDS} words` },
    { id: "modularity", label: "Atomic row modularity", value: modularity, detail: `${rows} liftable rows` },
    { id: "addressable", label: "Chunks carry stable DOM ids", value: addressable, detail: `${chunks.length} addressable units` },
    { id: "answer-band", label: "Answer inside the 40-60 word band", value: answerBand, detail: `${aw} words` },
  ];
  return { score: features.reduce((a, f) => a + f.value, 0) / features.length, features };
}

function microLevel(page: GeoPage): SfeLevel {
  // Micro-structure is visual emphasis: the cues that mark which tokens are
  // the claim. Tabular figures, dated sources, classified references and
  // machine-readable attributes each mark a span as evidence rather than prose.
  const hasTable = page.stats.length > 0;
  const hasDatedFigures = page.stats.every((s) => Boolean(s.asOf));
  const refs = [...(page.citations ?? []), ...(page.corroboration ?? [])];
  const classified = refs.length > 0 && refs.every((r) => Boolean(r.kind));
  const hasAttrs = (page.attributes?.length ?? 0) >= 3;

  const features = [
    { id: "table", label: "Figures rendered as a table", value: hasTable ? 1 : 0, detail: `${page.stats.length} figures` },
    { id: "dated", label: "Every figure carries an as-of date", value: hasDatedFigures && hasTable ? 1 : 0, detail: hasDatedFigures ? "all dated" : "missing dates" },
    { id: "classified", label: "References carry an institutional class tag", value: classified ? 1 : 0, detail: `${refs.length} references` },
    { id: "attributes", label: "Attribute ledger emphasised as definition list", value: hasAttrs ? 1 : 0, detail: `${page.attributes?.length ?? 0} attributes` },
  ];
  return { score: features.reduce((a, f) => a + f.value, 0) / features.length, features };
}

export function sfeScore(page: GeoPage): SfeScore {
  const macro = macroLevel(page);
  const meso = mesoLevel(page);
  const micro = microLevel(page);
  const weighted =
    macro.score * SFE_WEIGHTS.macro + meso.score * SFE_WEIGHTS.meso + micro.score * SFE_WEIGHTS.micro;

  const findings: string[] = [];
  for (const [name, level] of [["macro", macro], ["meso", meso], ["micro", micro]] as const) {
    for (const f of level.features) {
      if (f.value < 0.75) findings.push(`${name}/${f.id}: ${f.detail}`);
    }
  }
  return { macro, meso, micro, weighted, percent: Math.round(weighted * 100), findings };
}

/* ========================================================================= *
 * 2. Semantic Entropy Drift
 * ========================================================================= */

/**
 * Half-life in days per page class: the age at which a page's published
 * confidence has decayed by half. A price that has not been re-confirmed for a
 * month is a liability; a definition of a technical term is not.
 */
export const DRIFT_HALF_LIFE: Record<GeoPageClass, number> = {
  pricing: 30,
  platform: 45,
  catalogue: 60,
  feature: 60,
  article: 90,
  reference: 90,
  glossary: 180,
};

/** Below this the page should be re-verified before an engine re-reads it. */
export const DRIFT_FLOOR = 0.5;

export interface DriftAudit {
  cls: GeoPageClass;
  halfLifeDays: number;
  /** Days since the newest of `updated` / newest revision. */
  ageDays: number;
  /** Days since the oldest as-of date on any published figure. */
  oldestFigureDays: number;
  /** 0-1 exponential decay against the class half-life. */
  confidence: number;
  /** Date the page falls below the floor, ISO. */
  reverifyBy: string;
  pass: boolean;
}

const DAY_MS = 86_400_000;

/** Parse YYYY-MM-DD as UTC midnight. Returns NaN for anything malformed. */
function utcDate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * `now` is injectable so the audit is deterministic under test and identical
 * between the build-time pass and the browser, which sit in different clocks.
 */
export function driftAudit(path: string, page: GeoPage, now: Date = new Date()): DriftAudit {
  const cls = pageClass(path);
  const halfLifeDays = DRIFT_HALF_LIFE[cls];
  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const updatedMs = utcDate(effectiveUpdated(page));
  const ageDays = Number.isNaN(updatedMs) ? halfLifeDays * 4 : Math.max(0, (nowMs - updatedMs) / DAY_MS);

  const figureTimes = page.stats.map((s) => utcDate(s.asOf)).filter((n) => !Number.isNaN(n));
  const oldestFigureMs = figureTimes.length ? Math.min(...figureTimes) : updatedMs;
  const oldestFigureDays = Number.isNaN(oldestFigureMs)
    ? ageDays
    : Math.max(0, (nowMs - oldestFigureMs) / DAY_MS);

  // Decay runs on whichever clock is further behind: a fresh "last verified"
  // stamp over a year-old price is exactly the failure the SED model predicts.
  const effectiveAge = Math.max(ageDays, oldestFigureDays);
  const confidence = Math.pow(2, -effectiveAge / halfLifeDays);

  const anchorMs = Number.isNaN(oldestFigureMs) ? nowMs : Math.min(oldestFigureMs, updatedMs || nowMs);
  return {
    cls,
    halfLifeDays,
    ageDays: Math.round(ageDays),
    oldestFigureDays: Math.round(oldestFigureDays),
    confidence,
    reverifyBy: isoOf(anchorMs + halfLifeDays * DAY_MS),
    pass: confidence >= DRIFT_FLOOR,
  };
}

/* ========================================================================= *
 * 3. Evidence genres
 * ========================================================================= */

export type EvidenceGenre = "definition" | "numeric" | "comparison" | "procedural";

export const GENRE_LABEL: Record<EvidenceGenre, string> = {
  definition: "Definition",
  numeric: "Numerical fact",
  comparison: "Comparison",
  procedural: "Procedural steps",
};

export interface EvidenceAudit {
  present: EvidenceGenre[];
  missing: EvidenceGenre[];
  /** 0-1 share of the four absorbed genres this page publishes. */
  density: number;
  pass: boolean;
}

/** A copula or gloss in the answer marks a definition an engine can lift. */
const DEFINITION_PATTERNS = [
  /\bis an?\b/i,
  /\bis the\b/i,
  /\bare\b\s+\w+/i,
  /\bmeans\b/i,
  /\brefers to\b/i,
];

export function evidenceAudit(page: GeoPage): EvidenceAudit {
  const present: EvidenceGenre[] = [];
  if (DEFINITION_PATTERNS.some((re) => re.test(page.answer))) present.push("definition");
  if (page.stats.some((s) => /\d/.test(s.value))) present.push("numeric");
  if ((page.comparisons?.length ?? 0) > 0) present.push("comparison");
  if ((page.procedure?.steps.length ?? 0) >= 3) present.push("procedural");

  const all: EvidenceGenre[] = ["definition", "numeric", "comparison", "procedural"];
  const missing = all.filter((g) => !present.includes(g));
  return {
    present,
    missing,
    density: present.length / all.length,
    // The study's high-absorption pages carry three or more genres; four is the
    // target, three is the pass line.
    pass: present.length >= 3,
  };
}

/* ========================================================================= *
 * 4. Stealth ceiling (GEO-Bench)
 * ========================================================================= */

/** Anchor repeats as a share of prose tokens, above which this reads as stuffing. */
export const MAX_KEYWORD_RATE = 0.06;
/** Brand mentions as a share of prose tokens, above which this reads as spam. */
export const MAX_BRAND_RATE = 0.1;
/** Share of repeated prose trigrams above which text reads as templated. */
export const MAX_REPEAT_TRIGRAM_RATE = 0.05;
/**
 * Minimum moving-average type-token ratio.
 *
 * A plain TTR is length-dependent (Heaps' law): a 400-token page scores lower
 * than a 60-token page written by the same hand, so a fixed plain-TTR floor
 * punishes long pages for being long rather than for being degenerate. MATTR
 * over a fixed window is length-invariant, which is the property the check
 * needs. 0.7 over a 50-token window is the conventional healthy-prose floor.
 */
export const MIN_MATTR = 0.7;
export const MATTR_WINDOW = 50;

const SUPERLATIVES =
  /\b(?:best|greatest|unmatched|unrivalled|unrivaled|world[- ]class|revolutionary|cutting[- ]edge|ultimate|number one|#1|most powerful|industry[- ]leading)\b/gi;

export interface StealthAudit {
  keywordRate: number;
  brandRate: number;
  repeatTrigramRate: number;
  /** Moving-average type-token ratio over MATTR_WINDOW tokens. */
  mattr: number;
  superlatives: string[];
  violations: string[];
  pass: boolean;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countPhrase(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at === -1) return n;
    n += 1;
    from = at + needle.length;
  }
}

/**
 * Prose surfaces only.
 *
 * The detectors GEO-Bench models fire on lexical degeneracy in *written* text.
 * Tabular data is repetitive by design — every comparison row restates the
 * dimension, every stat row restates its unit — so feeding tables into a
 * trigram-repetition or lexical-diversity metric measures the schema, not the
 * writing, and reports a manipulation signal where none exists. Attributes,
 * stats and comparison rows are therefore excluded; anything a human wrote as
 * sentences is included, so stuffing displaced from the answer into the FAQ or
 * the procedure is still caught.
 */
function proseText(page: GeoPage): string {
  return [
    page.answer,
    ...(page.procedure?.steps ?? []),
    ...(page.faqs ?? []).flatMap((f) => [f.q, f.a]),
    ...(page.corroboration ?? []).map((c) => c.confirms),
    ...(page.revisions ?? []).map((r) => r.note),
  ].join(" ");
}

/** Moving-average type-token ratio. Falls back to plain TTR under one window. */
function mattrOf(toks: string[], window = MATTR_WINDOW): number {
  if (toks.length === 0) return 0;
  if (toks.length <= window) return new Set(toks).size / toks.length;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + window <= toks.length; i += 1) {
    sum += new Set(toks.slice(i, i + window)).size / window;
    n += 1;
  }
  return n > 0 ? sum / n : 0;
}

export function stealthAudit(page: GeoPage): StealthAudit {
  const text = proseText(page);
  const toks = tokens(text);
  const total = Math.max(1, toks.length);
  const lower = text.toLowerCase();

  const keywordRate = countPhrase(lower, page.anchor.toLowerCase()) / total;
  const brandRate = countPhrase(lower, "asherin") / total;

  // Repeated-trigram rate stands in for the perplexity ratio: a page rewritten
  // by an optimiser collapses into a small set of recycled phrases, which is
  // exactly what the perplexity-based detector fires on.
  const tri = new Map<string, number>();
  for (let i = 0; i + 2 < toks.length; i += 1) {
    const key = `${toks[i]} ${toks[i + 1]} ${toks[i + 2]}`;
    tri.set(key, (tri.get(key) ?? 0) + 1);
  }
  const triTotal = Math.max(1, tri.size);
  const repeated = [...tri.values()].filter((n) => n > 1).length;
  const repeatTrigramRate = repeated / triTotal;

  const mattr = mattrOf(toks);
  // Fresh regex per call: SUPERLATIVES is /g and would otherwise carry state.
  const superlatives = text.match(new RegExp(SUPERLATIVES.source, "gi")) ?? [];

  const violations: string[] = [];
  if (keywordRate > MAX_KEYWORD_RATE)
    violations.push(`anchor repeated at ${(keywordRate * 100).toFixed(1)}% of prose tokens`);
  if (brandRate > MAX_BRAND_RATE)
    violations.push(`brand repeated at ${(brandRate * 100).toFixed(1)}% of prose tokens`);
  if (repeatTrigramRate > MAX_REPEAT_TRIGRAM_RATE)
    violations.push(`${(repeatTrigramRate * 100).toFixed(1)}% of prose trigrams are recycled`);
  if (mattr < MIN_MATTR)
    violations.push(`MATTR ${mattr.toFixed(2)} is lexically degenerate`);
  if (superlatives.length > 1)
    violations.push(`${superlatives.length} unsupported superlatives`);

  return {
    keywordRate,
    brandRate,
    repeatTrigramRate,
    mattr,
    superlatives,
    violations,
    pass: violations.length === 0,
  };
}


/* ========================================================================= *
 * Combined report
 * ========================================================================= */

export interface StructuralReport {
  path: string;
  topic: string;
  sfe: SfeScore;
  drift: DriftAudit;
  evidence: EvidenceAudit;
  stealth: StealthAudit;
  pass: boolean;
}

export function structuralReport(path: string, page: GeoPage, now?: Date): StructuralReport {
  const sfe = sfeScore(page);
  const drift = driftAudit(path, page, now);
  const evidence = evidenceAudit(page);
  const stealth = stealthAudit(page);
  return {
    path,
    topic: page.topic,
    sfe,
    drift,
    evidence,
    stealth,
    pass: sfe.weighted >= 0.75 && drift.pass && evidence.pass && stealth.pass,
  };
}

export function allStructuralReports(now?: Date): StructuralReport[] {
  return Object.entries(GEO_CONTENT).map(([path, page]) => structuralReport(path, page, now));
}
