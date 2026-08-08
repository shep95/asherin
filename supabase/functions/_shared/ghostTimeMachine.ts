// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — DEEP TIME (native).
//
// No third-party capture archive is consulted here. Everything on this ladder
// is produced by the Ghost Engine's own apparatus:
//
//   1. FAN-OUT   — the engine's own selector harvest (multi-engine surface),
//                  re-run across coarse era buckets so the index is forced to
//                  surrender old material instead of only the freshest page.
//   2. PROBE     — the engine fetches each lead itself and reads the document,
//                  exactly as the intercept layer does.
//   3. DATE      — a page's own age is carved out of five independent places:
//                  transport headers (Last-Modified), structured markup
//                  (JSON-LD datePublished / article:published_time / <time>),
//                  the URL path (/2004/07/…), the copyright range, and visible
//                  date strings in the body. Whichever is oldest and provable
//                  becomes the row's year.
//   4. LIFESPAN  — DNS + a live probe decide whether a host that once carried
//                  the selector still answers at all.
//
// Nothing is interpolated. A year appears only when a document itself carried a
// date for it, and every row keeps the URL and the field that proved it.
// ─────────────────────────────────────────────────────────────────────────────

import { classifySelector, harvestLeads, type SelectorIdentity } from "./ghostHarvest.ts";
import { pool } from "./ghostMetadata.ts";
import {
  readDocument, toProse, matchTerms, keywordTerms,
  type DocClass, type TermHit,
} from "./ghostDocIntel.ts";

/** The web's own year zero — nothing predates this on a dated document. */
export const ARCHIVE_EPOCH_YEAR = 1990;

const UA = "Asherin-GhostEngine/1.0 (+deep-time)";
const MAX_BODY = 900_000; // chars read per document

export type DateProof =
  | "http-last-modified"
  | "jsonld"
  | "meta-published"
  | "time-element"
  | "url-path"
  | "copyright"
  | "body-text"
  | "doc-metadata";

export interface TimeCapture {
  url: string;
  /** The live document that proves the date. Always openable. */
  evidence_url: string;
  timestamp: string; // ISO
  year: number;
  status: string;
  mime: string;
  /** Which field carried the date. */
  proof: DateProof;
  /** The literal string the engine read. */
  raw: string;
  title: string;
  source: "probe";
  /** Which surface carried the document — page, PDF, office file, code, share. */
  doc_class: DocClass;
  /** Metadata fields the file itself carried (pdf:Author, html:generator, …). */
  meta: Record<string, string>;
  /** Keywords the document declared about itself. */
  keywords: string[];
  /** Selector terms found inside the document, with the sentence proving each. */
  terms: TermHit[];
  /** Bytes the engine actually read. */
  bytes: number;
}

export interface TimeEra {
  year: number;
  captures: number;
  hosts: string[];
  sample_url: string | null;
  sample_evidence: string | null;
}

export interface HostLifespan {
  host: string;
  first_year: number | null;
  last_year: number | null;
  documents: number;
  alive: boolean;
  resolves: boolean;
}

export interface TimeMachineReport {
  selector: string;
  kind: string;
  window: { from: number; to: number };
  earliest: TimeCapture | null;
  latest: TimeCapture | null;
  eras: TimeEra[];
  captures: TimeCapture[];
  hosts: HostLifespan[];
  hosts_probed: string[];
  /** Hosts that carried the selector but no longer answer. */
  dead_hosts: string[];
  /** Documents by surface class, so the operator sees what was actually read. */
  classes: Array<{ doc_class: DocClass; documents: number }>;
  /** Keywords the corpus declared, ranked by how many documents carried each. */
  keywords: Array<{ keyword: string; documents: number }>;
  /** Authoring metadata recovered across the corpus (authors, producers, tools). */
  authors: Array<{ value: string; field: string; documents: number; sample_url: string }>;
  /** Selector terms and how often the corpus corroborated each one. */
  term_coverage: Array<{ term: string; documents: number; hits: number }>;
  /** The engine's own stages — never an outside corpus. */
  corpora: Array<{ name: string; ok: boolean; records: number; note: string | null }>;
  elapsed_ms: number;
}

function hostOf(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `http://${url}`).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" });
  } catch { return null; } finally { clearTimeout(t); }
}

/** Only accept a year that a document could plausibly carry. */
function sane(year: number): boolean {
  const now = new Date().getUTCFullYear();
  return Number.isFinite(year) && year >= ARCHIVE_EPOCH_YEAR && year <= now + 1;
}

function isoFrom(value: string): { iso: string; year: number } | null {
  const raw = value.trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isFinite(ms)) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    if (sane(y)) return { iso: d.toISOString(), year: y };
  }
  const m = raw.match(/\b(19[9]\d|20[0-4]\d)\b/);
  if (m) {
    const y = Number(m[1]);
    if (sane(y)) return { iso: `${y}-01-01T00:00:00Z`, year: y };
  }
  return null;
}

interface Dated { iso: string; year: number; proof: DateProof; raw: string }

/** Carve every date the document itself is willing to admit. */
function carveDates(url: string, headers: Headers, html: string): Dated[] {
  const out: Dated[] = [];
  const push = (value: string | null | undefined, proof: DateProof) => {
    if (!value) return;
    const hit = isoFrom(value);
    if (hit) out.push({ ...hit, proof, raw: value.slice(0, 120) });
  };

  // 1. Transport — the server's own claim about the file on disk.
  push(headers.get("last-modified"), "http-last-modified");

  // 2. URL path — /2004/07/slug is a publisher's own filing date.
  const pathDate = url.match(/\/((?:19[9]\d|20[0-4]\d))\/(\d{1,2})(?:\/(\d{1,2}))?\//);
  if (pathDate) {
    const [, y, mo, d] = pathDate;
    push(`${y}-${String(mo).padStart(2, "0")}-${String(d ?? "01").padStart(2, "0")}`, "url-path");
  }

  if (html) {
    // 3. Structured markup.
    for (const re of [
      /<meta[^>]+(?:property|name)=["'](?:article:published_time|article:modified_time|datePublished|dateModified|date|DC\.date[^"']*|pubdate)["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["']/gi,
    ]) {
      for (const m of html.matchAll(re)) push(m[1], "meta-published");
    }
    for (const m of html.matchAll(/"(?:datePublished|dateCreated|uploadDate|dateModified)"\s*:\s*"([^"]{4,40})"/gi)) {
      push(m[1], "jsonld");
    }
    for (const m of html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi)) push(m[1], "time-element");

    // 4. Copyright range — the oldest year in "© 1998–2012" is a founding date.
    for (const m of html.matchAll(/(?:©|&copy;|copyright)\s*:?\s*((?:19[9]\d|20[0-4]\d))/gi)) {
      push(m[1], "copyright");
    }

    // 5. Visible prose dates — last resort, only long-form months.
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
    const prose = text.match(
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+((?:19[9]\d|20[0-4]\d))\b/g,
    );
    for (const p of (prose ?? []).slice(0, 6)) push(p, "body-text");
  }
  return out;
}

const PROOF_RANK: Record<DateProof, number> = {
  // A file's own authoring stamp outranks anything a page says about itself:
  // /CreationDate was written by the producing application, not by a CMS.
  "doc-metadata": 7,
  jsonld: 6, "meta-published": 5, "time-element": 4, "url-path": 4,
  "http-last-modified": 3, copyright: 2, "body-text": 1,
};

/** Read one lead with the engine's own reader and date it. */
async function probeLead(lead: { url: string; title: string }): Promise<TimeCapture[]> {
  const res = await timedFetch(lead.url, { headers: { "user-agent": UA, accept: "text/html,*/*" } }, 11_000);
  if (!res) return [];
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
  let html = "";
  if (res.ok && /html|xml|text|json/i.test(mime)) {
    html = (await res.text().catch(() => "")).slice(0, MAX_BODY);
  } else {
    await res.body?.cancel().catch(() => {});
  }
  const dated = carveDates(lead.url, res.headers, html);
  if (!dated.length) return [];

  // One row per distinct year, keeping the strongest proof for that year.
  const best = new Map<number, Dated>();
  for (const d of dated) {
    const prev = best.get(d.year);
    if (!prev || PROOF_RANK[d.proof] > PROOF_RANK[prev.proof]) best.set(d.year, d);
  }
  return [...best.values()].map((d) => ({
    url: lead.url,
    evidence_url: lead.url,
    timestamp: d.iso,
    year: d.year,
    status: String(res.status),
    mime,
    proof: d.proof,
    raw: d.raw,
    title: lead.title,
    source: "probe" as const,
  }));
}

/** Does the host still exist, and does it still answer? */
async function hostPosture(host: string): Promise<{ resolves: boolean; alive: boolean }> {
  const dns = await timedFetch(
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
    { headers: { accept: "application/dns-json" } },
    6000,
  );
  let resolves = false;
  if (dns?.ok) {
    const j = await dns.json().catch(() => null);
    resolves = Array.isArray(j?.Answer) && j.Answer.length > 0;
  }
  if (!resolves) return { resolves: false, alive: false };
  const head = await timedFetch(`https://${host}/`, { method: "HEAD", headers: { "user-agent": UA } }, 6000);
  return { resolves: true, alive: !!head && head.status < 500 };
}

export interface TimeMachineOptions {
  hosts?: string[];
  fromYear?: number;
  cap?: number;
  /** Caller's Authorization header — the harvest runs on the engine's own surface. */
  authHeader?: string | null;
  /** How many documents the engine will open and read. */
  probeBudget?: number;
}

/** Coarse era buckets — the index answers differently when a decade is named. */
function eraLegs(selector: string, fromYear: number): string[] {
  const now = new Date().getUTCFullYear();
  const buckets: string[] = [];
  for (let start = 1995; start <= now; start += 10) {
    const end = Math.min(start + 9, now);
    if (end < fromYear) continue;
    buckets.push(`${selector} ${start}..${end}`);
  }
  return buckets.slice(0, 4);
}

/**
 * Reach back across everything the engine can reach itself, and date it.
 */
export async function deepTimeSweep(
  selector: string,
  kind: string,
  opts: TimeMachineOptions = {},
): Promise<TimeMachineReport> {
  const t0 = Date.now();
  const fromYear = Math.max(ARCHIVE_EPOCH_YEAR, opts.fromYear ?? ARCHIVE_EPOCH_YEAR);
  const cap = opts.cap ?? 600;
  const probeBudget = Math.max(20, Math.min(160, opts.probeBudget ?? 120));
  const nowYear = new Date().getUTCFullYear();
  const auth = opts.authHeader ?? null;

  const report: TimeMachineReport = {
    selector, kind,
    window: { from: fromYear, to: nowYear },
    earliest: null, latest: null, eras: [], captures: [],
    hosts: [], hosts_probed: [], dead_hosts: [],
    corpora: [], elapsed_ms: 0,
  };

  // ── 1. FAN-OUT on the engine's own harvest, base selector + era buckets ───
  const base: SelectorIdentity = classifySelector(selector);
  const legs: SelectorIdentity[] = [base, ...eraLegs(selector, fromYear).map(classifySelector)];

  const harvests = await Promise.allSettled(
    legs.map((id) => harvestLeads(id, auth, { maxLeads: 120, noiseFilter: true, legTimeoutMs: 11_000 })),
  );

  const leadByUrl = new Map<string, { url: string; title: string }>();
  for (const h of harvests) {
    if (h.status !== "fulfilled") continue;
    for (const l of h.value.leads) {
      if (!leadByUrl.has(l.url)) leadByUrl.set(l.url, { url: l.url, title: l.title });
    }
  }

  // Seed hosts the caller already tied to the entity — probe their front doors
  // directly, since a root page usually carries the copyright range.
  const seedHosts = new Set<string>();
  for (const h of opts.hosts ?? []) { const c = hostOf(h); if (c) seedHosts.add(c); }
  if (kind === "domain") { const c = hostOf(selector); if (c) seedHosts.add(c); }
  if (kind === "email") { const d = selector.split("@")[1]; if (d) seedHosts.add(d.toLowerCase()); }
  for (const h of seedHosts) {
    const u = `https://${h}/`;
    if (!leadByUrl.has(u)) leadByUrl.set(u, { url: u, title: h });
  }

  const leads = [...leadByUrl.values()].slice(0, probeBudget);
  report.corpora.push({
    name: "Ghost fan-out",
    ok: harvests.some((h) => h.status === "fulfilled"),
    records: leadByUrl.size,
    note: leadByUrl.size ? null : "The engine's harvest returned nothing to date.",
  });

  // ── 2. PROBE + DATE ───────────────────────────────────────────────────────
  const probed = await pool(leads, 8, (l) => probeLead(l).catch(() => [] as TimeCapture[]));
  const all = probed.flat().filter((c) => c.year >= fromYear);
  report.corpora.push({ name: "Direct probe", ok: true, records: leads.length, note: null });
  report.corpora.push({ name: "Dated documents", ok: all.length > 0, records: all.length, note: null });

  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  report.captures = all.slice(0, cap);
  report.earliest = all[0] ?? null;
  report.latest = all[all.length - 1] ?? null;

  // ── 3. Era ladder ─────────────────────────────────────────────────────────
  const byYear = new Map<number, { captures: number; hosts: Set<string>; sample: TimeCapture }>();
  for (const c of all) {
    const b = byYear.get(c.year);
    if (b) { b.captures++; b.hosts.add(hostOf(c.url)); }
    else byYear.set(c.year, { captures: 1, hosts: new Set([hostOf(c.url)]), sample: c });
  }
  report.eras = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, b]) => ({
    year,
    captures: b.captures,
    hosts: [...b.hosts].filter(Boolean).slice(0, 8),
    sample_url: b.sample.url,
    sample_evidence: b.sample.evidence_url,
  }));

  // ── 4. Host lifespans ─────────────────────────────────────────────────────
  const hostAgg = new Map<string, { first: number; last: number; docs: number }>();
  for (const c of all) {
    const h = hostOf(c.url);
    if (!h) continue;
    const a = hostAgg.get(h);
    if (a) { a.first = Math.min(a.first, c.year); a.last = Math.max(a.last, c.year); a.docs++; }
    else hostAgg.set(h, { first: c.year, last: c.year, docs: 1 });
  }
  for (const h of seedHosts) if (!hostAgg.has(h)) hostAgg.set(h, { first: 0, last: 0, docs: 0 });

  const hostList = [...hostAgg.entries()]
    .sort((a, b) => b[1].docs - a[1].docs)
    .slice(0, 24);
  const postures = await pool(hostList, 6, ([h]) => hostPosture(h).catch(() => ({ resolves: false, alive: false })));
  report.hosts = hostList.map(([host, a], i) => ({
    host,
    first_year: a.first || null,
    last_year: a.last || null,
    documents: a.docs,
    alive: postures[i].alive,
    resolves: postures[i].resolves,
  }));
  report.hosts_probed = hostList.map(([h]) => h);
  report.dead_hosts = report.hosts.filter((h) => !h.alive).map((h) => h.host);

  report.elapsed_ms = Date.now() - t0;
  return report;
}
