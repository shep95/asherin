// ═══════════════════════════════════════════════════════════════════════════
// IDENTIFIER SWEEP — "where does this email / phone number actually appear?"
//
// NARRATIVE
// ---------
// A harvest answers "which pages did the index return for this selector". That
// is a list of *candidates*, and a candidate is not evidence. Search engines
// return pages that merely rank for a token, snippets are truncated, and a
// paste site will happily surface for a query without ever carrying the
// string. An operator who acts on a candidate list is acting on a rumour.
//
// This module turns candidates into a register of confirmed sightings:
//
//   1. VARIANTS  — an identifier is not one string. An address is written
//                  plainly, obfuscated (`user [at] host`), percent-encoded,
//                  and split across markup. A number is written E.164, dashed,
//                  dotted, parenthesised, spaced, and national-format. Every
//                  written form is generated up front so a sighting is not
//                  missed for cosmetic reasons.
//   2. CONFIRM   — every lead is opened and read. The identifier must appear
//                  in the retrieved body, the URL, the title, or declared
//                  metadata. Anything else is reported as UNCONFIRMED and is
//                  never counted as a sighting. Absence of proof is stated,
//                  never rounded up.
//   3. DATE      — the sighting is dated from the document itself: transport
//                  headers, structured publication markup, container metadata,
//                  the dated path segment, and any date sitting beside the
//                  match. A sighting with no recoverable date says so.
//   4. FOLD      — sightings collapse by host into SURFACES, each with its own
//                  first-seen / last-seen window and a class (paste, breach
//                  index, social, people-record, code, document, registry).
//
// FLAWS THIS DESIGN CLOSES (the reason it is not just a fetch loop):
//   · SSRF — only public HTTP(S) hosts are opened; the reader enforces it.
//   · Unbounded work — leads, bytes, and wall-clock are all capped, and the
//     whole confirm pass runs under one deadline so a slow host cannot eat the
//     worker budget. Partial results are returned with a stated shortfall.
//   · Regex denial of service — every pattern is anchored on fixed digits or
//     literals; no nested quantifiers are constructed from user input.
//   · False confidence — a match inside a search-result container page is
//     graded lower than a match in a document body, and the grade is shown.
// ═══════════════════════════════════════════════════════════════════════════

import { classifySelector, harvestLeads, isFreemail, type SelectorIdentity } from "./ghostHarvest.ts";
import { readDocument, classifyDoc, toProse, type DocClass } from "./ghostDocIntel.ts";
import { pool } from "./ghostMetadata.ts";

// ── Shapes ───────────────────────────────────────────────────────────────────

export type SurfaceClass =
  | "paste"
  | "breach-index"
  | "people-record"
  | "social"
  | "code"
  | "document"
  | "registry"
  | "forum"
  | "commerce"
  | "web";

/** How strong the sighting is, by where the identifier was found. */
export type MatchGrade = "body" | "title" | "metadata" | "url";

export interface Sighting {
  url: string;
  host: string;
  title: string;
  docClass: DocClass;
  surfaceClass: SurfaceClass;
  grade: MatchGrade;
  /** Written forms of the identifier that actually occurred on the page. */
  forms: string[];
  occurrences: number;
  /** The sentence the identifier sits inside — the proof, in the page's words. */
  context: string;
  /** ISO date, or null when the document carried no recoverable date. */
  seenAt: string | null;
  dateBasis: string | null;
  /** Which fan-out leg surfaced it, and how many legs agreed. */
  via: string;
  corroboration: number;
  bytes: number;
}

export interface Surface {
  host: string;
  surfaceClass: SurfaceClass;
  sightings: Sighting[];
  firstSeen: string | null;
  lastSeen: string | null;
  /** Strongest grade anywhere on this host. */
  bestGrade: MatchGrade;
}

export interface UnconfirmedLead {
  url: string;
  host: string;
  title: string;
  reason: string;
}

export interface IdentifierSweepReport {
  identity: SelectorIdentity;
  /** Every written form the sweep searched for. */
  variants: string[];
  legsPlanned: number;
  leadsHarvested: number;
  opened: number;
  confirmed: number;
  surfaces: Surface[];
  unconfirmed: UnconfirmedLead[];
  byClass: Record<string, number>;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Stated shortfalls: deadline hit, leads skipped, hosts unreachable. */
  notes: string[];
  elapsedMs: number;
}

export interface SweepOptions {
  /** Hard wall-clock budget for the whole sweep. */
  budgetMs?: number;
  /** Maximum leads opened for confirmation. */
  openCap?: number;
  concurrency?: number;
  authHeader?: string | null;
  /** Harvest aperture. Batch callers (Cloud Intelligence) run narrower. */
  maxLeads?: number;
}

// ── 1. VARIANTS ──────────────────────────────────────────────────────────────

const AT_FORMS = ["@", " at ", "[at]", "(at)", " [at] ", " (at) ", "%40", "&#64;", "&commat;"];
const DOT_FORMS = [".", " dot ", "[dot]", "(dot)", "%2e"];

/**
 * Every plausible written form of the identifier.
 *
 * Cross-producting every at-form against every dot-form on a long domain would
 * explode combinatorially, so obfuscation is applied one axis at a time: the
 * at-symbol is disguised, or the dots are, but the set never multiplies out.
 */
export function identifierVariants(id: SelectorIdentity): string[] {
  const out = new Set<string>();
  if (id.kind === "email") {
    const [local, domain] = [id.parts.local, id.parts.domain];
    const plain = `${local}@${domain}`;
    out.add(plain);
    for (const at of AT_FORMS) out.add(`${local}${at}${domain}`);
    for (const dot of DOT_FORMS.slice(1)) out.add(`${local}@${domain.split(".").join(dot)}`);
    out.add(plain.toUpperCase());
    return [...out];
  }
  if (id.kind === "phone") {
    const d = id.parts.digits;
    const last10 = d.length > 10 ? d.slice(-10) : d;
    const cc = d.length > 10 ? d.slice(0, d.length - 10) : "";
    const a = last10.slice(0, 3), b = last10.slice(3, 6), c = last10.slice(6);
    out.add(`+${d}`);
    out.add(d);
    if (last10.length === 10) {
      out.add(`(${a}) ${b}-${c}`);
      out.add(`${a}-${b}-${c}`);
      out.add(`${a}.${b}.${c}`);
      out.add(`${a} ${b} ${c}`);
      if (cc) out.add(`+${cc} ${a} ${b} ${c}`);
    }
    return [...out];
  }
  return [id.label];
}

/**
 * One matcher per identifier, built from fixed literals only.
 *
 * Phones are matched digit-by-digit with a bounded separator class between
 * each digit — no nested quantifier, so the pattern cannot backtrack
 * catastrophically on adversarial input.
 */
function buildMatcher(id: SelectorIdentity): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (id.kind === "phone") {
    const d = id.parts.digits;
    const core = (d.length > 10 ? d.slice(-10) : d).split("").map(esc).join("[\\s().\\-\\u2010-\\u2015]{0,2}");
    return new RegExp(core, "g");
  }
  const { local, domain } = id.parts;
  const atClass = "(?:@|%40|&#64;|&commat;|\\s*[\\[(]?\\s*at\\s*[\\])]?\\s*)";
  const dotClass = "(?:\\.|%2e|\\s*[\\[(]?\\s*dot\\s*[\\])]?\\s*)";
  const dom = domain.split(".").map(esc).join(dotClass);
  return new RegExp(`${esc(local)}${atClass}${dom}`, "gi");
}

// ── Surface classification ───────────────────────────────────────────────────

const CLASS_RULES: Array<[SurfaceClass, RegExp]> = [
  ["paste", /(^|\.)(pastebin|ghostbin|hastebin|rentry|controlc|justpaste|paste\.ee|dpaste|termbin)\.(com|co|it|org|net|ee)$/i],
  ["breach-index", /(^|\.)(haveibeenpwned|dehashed|leakcheck|intelx|snusbase|leak-lookup|breachdirectory)\.(com|io|org|net)$/i],
  ["people-record", /(^|\.)(spokeo|whitepages|beenverified|truepeoplesearch|fastpeoplesearch|peoplefinder|radaris|mylife|thatsthem|usphonebook|numlookup|truecaller|sync\.me)\.(com|me|io)$/i],
  ["social", /(^|\.)(linkedin|twitter|x|facebook|instagram|tiktok|reddit|pinterest|threads|vk|medium|about|keybase|mastodon)\.(com|me|io|social)$/i],
  ["code", /(^|\.)(github|gitlab|bitbucket|sourceforge|npmjs|pypi|codeberg|gist\.github)\.(com|org|io)$/i],
  ["registry", /(\.gov(\.[a-z]{2})?|\.mil|\.edu|(^|\.)(sec|courtlistener|opencorporates|companieshouse|uspto|justia|unicourt)\.(gov|com|org|uk))$/i],
  ["forum", /(^|\.)(stackoverflow|stackexchange|quora|discourse|forum|groups\.google|disqus)\.(com|net|org)$/i],
  ["commerce", /(^|\.)(amazon|ebay|etsy|alibaba|shopify|aliexpress)\.(com|co\.uk)$/i],
];

function classifySurface(host: string, docClass: DocClass): SurfaceClass {
  const h = host.replace(/^www\./i, "").toLowerCase();
  for (const [cls, re] of CLASS_RULES) if (re.test(h)) return cls;
  if (docClass === "pdf" || docClass === "office" || docClass === "share" || docClass === "data") return "document";
  if (docClass === "code") return "code";
  return "web";
}

// ── 3. DATE ──────────────────────────────────────────────────────────────────

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const NEAR_DATE = new RegExp(
  `\\b(?:(20\\d{2}|19\\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\\d|3[01])` +
  `|(0?[1-9]|[12]\\d|3[01])\\s+(?:${MONTHS})[a-z]*\\.?,?\\s+(19|20)\\d{2}` +
  `|(?:${MONTHS})[a-z]*\\.?\\s+(0?[1-9]|[12]\\d|3[01]),?\\s+(19|20)\\d{2})\\b`,
  "i",
);

const isoOrNull = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  // A clock ahead of now, or before the web existed, is a broken clock — not a
  // date. Reporting it would date a sighting to 1970 or to next century.
  if (t > Date.now() + 86_400_000 || t < Date.parse("1991-01-01")) return null;
  return new Date(t).toISOString();
};

/** PDF wall clocks look like D:20180612153000-04'00'. */
function pdfDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/D?:?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  return isoOrNull(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}Z`);
}

/**
 * Date the sighting, strongest basis first. Publication markup beats a
 * transport header, which beats a dated URL, which beats a date merely sitting
 * near the match. The basis travels with the date so a reader can discount it.
 */
function carveDate(
  url: string,
  headers: Headers | null,
  meta: Record<string, string>,
  context: string,
): { seenAt: string | null; basis: string | null } {
  // The reader namespaces its metadata (`html:og:title`, `pdf:CreationDate`,
  // `office:created`). Looking up bare keys against a namespaced map is how a
  // perfectly good publication date goes missing, so both forms are indexed.
  const flat = flattenMeta(meta);
  const metaKeys = [
    "article:published_time", "og:published_time", "jsonld:datepublished",
    "datepublished", "dc.date", "dcterms.created", "created",
    "citation_publication_date", "pubdate", "publish-date", "date",
    "xmp:createdate", "createdate",
  ];
  for (const k of metaKeys) {
    const hit = isoOrNull(flat[k]);
    if (hit) return { seenAt: hit, basis: `declared publication date (${k})` };
  }
  const pdf = pdfDate(flat["creationdate"] ?? flat["moddate"]);
  if (pdf) return { seenAt: pdf, basis: "document container clock" };


  const lm = isoOrNull(headers?.get("last-modified"));
  if (lm) return { seenAt: lm, basis: "transport last-modified header" };

  const path = url.match(/\/((?:19|20)\d{2})\/(0?[1-9]|1[0-2])(?:\/(0?[1-9]|[12]\d|3[01]))?\//);
  if (path) {
    const iso = isoOrNull(`${path[1]}-${String(path[2]).padStart(2, "0")}-${String(path[3] ?? "01").padStart(2, "0")}`);
    if (iso) return { seenAt: iso, basis: "dated path segment" };
  }
  const near = context.match(NEAR_DATE);
  if (near) {
    const iso = isoOrNull(near[0]);
    if (iso) return { seenAt: iso, basis: "date printed beside the match" };
  }
  const served = isoOrNull(headers?.get("date"));
  if (served) return { seenAt: served, basis: "server clock at retrieval — not a publication date" };
  return { seenAt: null, basis: null };
}

// ── 2. CONFIRM ───────────────────────────────────────────────────────────────

const MAX_TEXT = 400_000;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

function contextAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 110);
  const end = Math.min(text.length, index + len + 110);
  return `${start > 0 ? "…" : ""}${tidy(text.slice(start, end))}${end < text.length ? "…" : ""}`;
}

interface Confirmation {
  grade: MatchGrade;
  forms: string[];
  occurrences: number;
  context: string;
}

function confirmIn(
  id: SelectorIdentity,
  matcher: RegExp,
  url: string,
  title: string,
  meta: Record<string, string>,
  text: string,
): Confirmation | null {
  const body = toProse(text).slice(0, MAX_TEXT);
  const forms = new Set<string>();
  let occurrences = 0;
  let context = "";

  matcher.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = matcher.exec(body)) !== null) {
    occurrences += 1;
    forms.add(tidy(m[0]).slice(0, 80));
    if (!context) context = contextAround(body, m.index, m[0].length);
    if (occurrences >= 200) break;
    if (m.index === matcher.lastIndex) matcher.lastIndex += 1; // zero-width guard
  }
  if (occurrences > 0) return { grade: "body", forms: [...forms], occurrences, context };

  matcher.lastIndex = 0;
  if (title && matcher.test(title)) {
    return { grade: "title", forms: [tidy(title).slice(0, 80)], occurrences: 1, context: tidy(title) };
  }
  const metaBlob = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(" | ").slice(0, 20_000);
  matcher.lastIndex = 0;
  if (metaBlob && matcher.test(metaBlob)) {
    return { grade: "metadata", forms: [id.label], occurrences: 1, context: tidy(metaBlob).slice(0, 240) };
  }
  // A URL can carry the identifier percent-encoded; decode before testing.
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch { /* malformed escape — test raw */ }
  matcher.lastIndex = 0;
  if (matcher.test(decoded)) {
    return { grade: "url", forms: [id.label], occurrences: 1, context: decoded.slice(0, 240) };
  }
  return null;
}

// ── Orchestration ────────────────────────────────────────────────────────────

const GRADE_RANK: Record<MatchGrade, number> = { body: 0, title: 1, metadata: 2, url: 3 };

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./i, ""); } catch { return ""; } };

/**
 * Run the full sweep for one email address or phone number.
 *
 * Never throws. A sweep that collected nothing is intelligence about the
 * collection, so it returns a report with stated notes rather than an
 * exception that would erase the attempt from the record.
 */
export async function sweepIdentifier(
  raw: string,
  opts: SweepOptions = {},
): Promise<IdentifierSweepReport> {
  const started = Date.now();
  const budgetMs = Math.min(Math.max(opts.budgetMs ?? 90_000, 15_000), 170_000);
  const openCap = Math.min(Math.max(opts.openCap ?? 40, 4), 80);
  const concurrency = Math.min(Math.max(opts.concurrency ?? 6, 2), 10);
  const deadline = started + budgetMs;

  const identity = classifySelector(raw.trim());
  const notes: string[] = [];

  const base: IdentifierSweepReport = {
    identity,
    variants: [],
    legsPlanned: 0,
    leadsHarvested: 0,
    opened: 0,
    confirmed: 0,
    surfaces: [],
    unconfirmed: [],
    byClass: {},
    firstSeen: null,
    lastSeen: null,
    notes,
    elapsedMs: 0,
  };

  if (identity.kind !== "email" && identity.kind !== "phone") {
    notes.push("Identifier sweep accepts an email address or a phone number. Everything else belongs in Intercept.");
    return { ...base, elapsedMs: Date.now() - started };
  }

  const variants = identifierVariants(identity);
  const matcher = buildMatcher(identity);

  if (identity.kind === "email" && isFreemail(identity.parts.domain)) {
    notes.push("Freemail provider — the domain says nothing about the holder, so only the full address counts as a sighting.");
  }

  // ── Harvest ───────────────────────────────────────────────────────────────
  const harvest = await harvestLeads(identity, opts.authHeader ?? null, {
    concurrency: 6,
    legTimeoutMs: 11_000,
    maxLeads: Math.min(Math.max(opts.maxLeads ?? 220, 40), 400),
    // Confirmation is the filter here. A noise heuristic that cuts a page
    // before it is read would silently discard a real sighting.
    noiseFilter: false,
  });

  base.legsPlanned = harvest.legs.length;
  base.leadsHarvested = harvest.leads.length;

  if (!harvest.leads.length) {
    notes.push("The open index returned no candidate pages for this identifier under any query leg.");
    return { ...base, variants, elapsedMs: Date.now() - started };
  }

  // Corroborated leads first: a URL two independent legs both returned is the
  // better use of a limited open budget than the tail of a single leg.
  const ordered = [...harvest.leads].sort((a, b) => b.corroboration - a.corroboration);
  const queue = ordered.slice(0, openCap);
  if (ordered.length > queue.length) {
    notes.push(`${ordered.length - queue.length} further candidate pages were harvested but not opened — the confirm budget was ${openCap} documents.`);
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  const sightings: Sighting[] = [];
  const unconfirmed: UnconfirmedLead[] = [];
  let opened = 0;
  let deadlineHit = false;

  await pool(queue, concurrency, async (lead) => {
    if (Date.now() > deadline) { deadlineHit = true; return; }
    const host = hostOf(lead.url);
    if (!host) return;

    const remaining = deadline - Date.now();
    const read = await readDocument(lead.url, Math.min(12_000, Math.max(3_000, remaining)));
    opened += 1;

    if (!read.ok) {
      unconfirmed.push({
        url: lead.url, host, title: lead.title,
        reason: read.error ? `unreadable — ${read.error.slice(0, 120)}` : `unreadable — HTTP ${read.status}`,
      });
      return;
    }

    const docClass = read.docClass || classifyDoc(lead.url, read.mime);
    const title = read.meta["og:title"] || read.meta["title"] || lead.title || "";
    const hit = confirmIn(identity, matcher, lead.url, title, read.meta, read.text);

    if (!hit) {
      unconfirmed.push({
        url: lead.url, host, title,
        reason: "page retrieved; the identifier does not occur in its body, title, metadata or URL",
      });
      return;
    }

    const { seenAt, basis } = carveDate(lead.url, read.headers, read.meta, hit.context);
    sightings.push({
      url: lead.url,
      host,
      title: tidy(title).slice(0, 180),
      docClass,
      surfaceClass: classifySurface(host, docClass),
      grade: hit.grade,
      forms: hit.forms.slice(0, 5),
      occurrences: hit.occurrences,
      context: hit.context.slice(0, 400),
      seenAt,
      dateBasis: basis,
      via: lead.via,
      corroboration: lead.corroboration,
      bytes: read.bytes,
    });
  });

  if (deadlineHit) {
    notes.push("The confirm pass reached its time budget; the pages already opened are reported and the remainder are listed as un-opened candidates.");
  }

  // ── Fold ──────────────────────────────────────────────────────────────────
  const byHost = new Map<string, Surface>();
  for (const s of sightings) {
    const existing = byHost.get(s.host);
    if (existing) {
      existing.sightings.push(s);
      if (GRADE_RANK[s.grade] < GRADE_RANK[existing.bestGrade]) existing.bestGrade = s.grade;
    } else {
      byHost.set(s.host, {
        host: s.host,
        surfaceClass: s.surfaceClass,
        sightings: [s],
        firstSeen: null,
        lastSeen: null,
        bestGrade: s.grade,
      });
    }
  }

  const surfaces = [...byHost.values()].map((surface) => {
    const dates = surface.sightings.map((x) => x.seenAt).filter((d): d is string => !!d).sort();
    surface.firstSeen = dates[0] ?? null;
    surface.lastSeen = dates[dates.length - 1] ?? null;
    surface.sightings.sort((a, b) =>
      GRADE_RANK[a.grade] - GRADE_RANK[b.grade] ||
      b.occurrences - a.occurrences ||
      (b.seenAt ?? "").localeCompare(a.seenAt ?? ""));
    return surface;
  });

  // Strongest evidence first, then breadth of sightings, then recency.
  const CLASS_WEIGHT: Record<SurfaceClass, number> = {
    "breach-index": 0, paste: 1, "people-record": 2, registry: 3, code: 4,
    document: 5, social: 6, forum: 7, web: 8, commerce: 9,
  };
  surfaces.sort((a, b) =>
    GRADE_RANK[a.bestGrade] - GRADE_RANK[b.bestGrade] ||
    CLASS_WEIGHT[a.surfaceClass] - CLASS_WEIGHT[b.surfaceClass] ||
    b.sightings.length - a.sightings.length ||
    (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));

  const byClass: Record<string, number> = {};
  for (const s of surfaces) byClass[s.surfaceClass] = (byClass[s.surfaceClass] ?? 0) + 1;

  const allDates = sightings.map((s) => s.seenAt).filter((d): d is string => !!d).sort();
  const undated = sightings.length - allDates.length;
  if (undated > 0) {
    notes.push(`${undated} sighting${undated === 1 ? "" : "s"} carried no recoverable date — they are counted but not placed on the timeline.`);
  }
  if (sightings.length === 0 && opened > 0) {
    notes.push(`${opened} candidate page${opened === 1 ? " was" : "s were"} opened and read; none carried the identifier. The index ranked them for the query, but the string is not on them.`);
  }

  console.log(
    `[identifierSweep] ${identity.kind} · legs=${harvest.legs.length} · leads=${harvest.leads.length} · ` +
    `opened=${opened} · confirmed=${sightings.length} · surfaces=${surfaces.length} · ${Date.now() - started}ms`,
  );

  return {
    identity,
    variants,
    legsPlanned: harvest.legs.length,
    leadsHarvested: harvest.leads.length,
    opened,
    confirmed: sightings.length,
    surfaces,
    unconfirmed: unconfirmed.slice(0, 60),
    byClass,
    firstSeen: allDates[0] ?? null,
    lastSeen: allDates[allDates.length - 1] ?? null,
    notes,
    elapsedMs: Date.now() - started,
  };
}

/**
 * Compact prose rendering, for the chat context block and the Cloud
 * Intelligence dossier. Numbers only; nothing here is inferred.
 */
export function formatSweep(r: IdentifierSweepReport): string {
  const lines: string[] = [];
  lines.push(`IDENTIFIER SWEEP — ${r.identity.label} (${r.identity.kind})`);
  lines.push(`Candidates harvested ${r.leadsHarvested} · opened ${r.opened} · confirmed sightings ${r.confirmed} across ${r.surfaces.length} surface${r.surfaces.length === 1 ? "" : "s"}.`);
  if (r.firstSeen || r.lastSeen) {
    lines.push(`Dated window: ${r.firstSeen?.slice(0, 10) ?? "—"} → ${r.lastSeen?.slice(0, 10) ?? "—"}.`);
  }
  for (const s of r.surfaces.slice(0, 20)) {
    const window = s.firstSeen || s.lastSeen
      ? ` [${s.firstSeen?.slice(0, 10) ?? "—"} → ${s.lastSeen?.slice(0, 10) ?? "—"}]`
      : " [undated]";
    lines.push(`· ${s.host} — ${s.surfaceClass}, ${s.sightings.length} sighting${s.sightings.length === 1 ? "" : "s"}, match in ${s.bestGrade}${window}`);
    const top = s.sightings[0];
    if (top?.context) lines.push(`    "${top.context.slice(0, 200)}"`);
  }
  if (!r.surfaces.length) lines.push("· No confirmed sighting. The identifier was not found on any page the index offered.");
  for (const n of r.notes) lines.push(`NOTE: ${n}`);
  return lines.join("\n");
}
