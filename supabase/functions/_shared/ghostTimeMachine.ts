// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — TIME MACHINE ("what did the web hold about this, before now?")
//
// The intercept layer reads the web as it exists this second. That is the
// smaller half of the record. Most of what was ever published about a person,
// a family, a company or a house is no longer served by anybody — the page was
// deleted, the host expired, the forum closed, the newspaper repaved its CMS.
// It survives only in capture archives.
//
// This module reaches back to the first crawls (Internet Archive began taking
// captures in 1996; Common Crawl's public index starts 2008) and reconstructs a
// per-year record for a selector. Three independent corpora, because each one
// misses different things:
//
//   1. WAYBACK CDX   — every capture of a URL or an entire domain, with the
//                      exact 14-digit timestamp. Authoritative for "when did
//                      this host first exist and when did it die".
//   2. ARCHIVE.ORG   — full-text search across scanned books, papers, court
//                      filings, newspapers, microfilm, genealogy uploads and
//                      archived web collections. This is the layer that answers
//                      origin questions a live crawl cannot.
//   3. COMMON CRAWL  — the raw crawl index, useful for hosts the Wayback
//                      machine skipped and for confirming a page existed at a
//                      given crawl even when no rendered capture survives.
//
// Nothing here is inferred. A year appears on the timeline only when a corpus
// returned a dated record for it, and every era row keeps the URL that proves
// it.
// ─────────────────────────────────────────────────────────────────────────────

import { searchArchive, type IaHit } from "./internetArchive.ts";

/** The web's own year zero for capture purposes. */
export const ARCHIVE_EPOCH_YEAR = 1996;

const CDX = "https://web.archive.org/cdx/search/cdx";
const UA = "Asherin-GhostEngine/1.0 (+time-machine)";

export interface TimeCapture {
  url: string;
  /** Rendered capture, always replayable. */
  wayback_url: string;
  timestamp: string;        // ISO
  year: number;
  status: string;
  mime: string;
  digest: string;
  source: "wayback" | "commoncrawl";
}

export interface TimeEra {
  year: number;
  captures: number;
  hosts: string[];
  /** One proving link for the year. */
  sample_url: string | null;
  sample_wayback: string | null;
}

export interface TimeMachineReport {
  selector: string;
  kind: string;
  /** Years actually searched. */
  window: { from: number; to: number };
  earliest: TimeCapture | null;
  latest: TimeCapture | null;
  eras: TimeEra[];
  captures: TimeCapture[];
  archive_items: Array<{
    id: string; title: string; creator: string; date: string;
    mediatype: string; url: string; excerpt: string;
  }>;
  hosts_probed: string[];
  /** Hosts that existed in the archive but serve nothing today. */
  dead_hosts: string[];
  corpora: Array<{ name: string; ok: boolean; records: number; note: string | null }>;
  elapsed_ms: number;
}

async function timed<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: number | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => { t = setTimeout(() => resolve(fallback), ms); }),
    ]);
  } finally { if (t) clearTimeout(t); }
}

function cdxStampToIso(stamp: string): string {
  const s = stamp.padEnd(14, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

function hostOf(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `http://${url}`).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/**
 * Every capture the Wayback machine holds for a host (or a single URL), from
 * the archive epoch forward. `collapse=timestamp:6` keeps one row per host per
 * month, which is what makes a full-domain query over 29 years affordable.
 */
async function waybackCdx(
  target: string,
  opts: { matchType: "domain" | "prefix" | "exact"; limit: number; fromYear: number; timeoutMs: number },
): Promise<{ rows: TimeCapture[]; error: string | null }> {
  const params = new URLSearchParams({
    url: target,
    matchType: opts.matchType,
    output: "json",
    fl: "timestamp,original,statuscode,mimetype,digest",
    collapse: "timestamp:6",
    filter: "!statuscode:404",
    from: String(opts.fromYear),
    limit: String(opts.limit),
  });
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opts.timeoutMs);
    const r = await fetch(`${CDX}?${params}`, { headers: { "user-agent": UA }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return { rows: [], error: `CDX ${r.status}` };
    const body = await r.json().catch(() => null) as string[][] | null;
    if (!Array.isArray(body) || body.length < 2) return { rows: [], error: null };
    const rows: TimeCapture[] = [];
    for (const row of body.slice(1)) {
      const [timestamp, original, statuscode, mimetype, digest] = row;
      if (!timestamp || !original) continue;
      const iso = cdxStampToIso(timestamp);
      const year = Number(timestamp.slice(0, 4));
      if (!Number.isFinite(year) || year < ARCHIVE_EPOCH_YEAR) continue;
      rows.push({
        url: original,
        wayback_url: `https://web.archive.org/web/${timestamp}/${original}`,
        timestamp: iso,
        year,
        status: statuscode || "",
        mime: mimetype || "",
        digest: digest || "",
        source: "wayback",
      });
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/** Common Crawl's public index — a second opinion on whether a host existed. */
async function commonCrawl(host: string, timeoutMs: number): Promise<{ rows: TimeCapture[]; error: string | null }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(
      `https://index.commoncrawl.org/CC-MAIN-2024-33-index?url=${encodeURIComponent(`*.${host}`)}&output=json&limit=40`,
      { headers: { "user-agent": UA }, signal: ctl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return { rows: [], error: `CC ${r.status}` };
    const text = await r.text();
    const rows: TimeCapture[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let rec: Record<string, string>;
      try { rec = JSON.parse(line); } catch { continue; }
      const stamp = rec.timestamp || "";
      if (!stamp || !rec.url) continue;
      rows.push({
        url: rec.url,
        wayback_url: `https://web.archive.org/web/${stamp}/${rec.url}`,
        timestamp: cdxStampToIso(stamp),
        year: Number(stamp.slice(0, 4)),
        status: rec.status || "",
        mime: rec.mime || "",
        digest: rec.digest || "",
        source: "commoncrawl",
      });
    }
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/** Does the host answer today? A host in the archive but silent now is a lead. */
async function hostAlive(host: string, timeoutMs: number): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(`https://${host}/`, { method: "HEAD", headers: { "user-agent": UA }, signal: ctl.signal, redirect: "follow" });
    clearTimeout(t);
    return r.status < 500;
  } catch { return false; }
}

export interface TimeMachineOptions {
  /** Hosts already known for this selector (from the harvest or a document). */
  hosts?: string[];
  fromYear?: number;
  /** Max captures retained in the response. */
  cap?: number;
  timeoutMs?: number;
  /** Skip the archive.org full-text leg (it is the slowest). */
  skipFullText?: boolean;
}

/**
 * Reach back across the whole archived web for one selector.
 *
 * Strategy depends on what the selector IS, because the corpora index different
 * things: a domain is addressable by CDX directly, a person is not addressable
 * at all and has to be reached through full-text corpora and through the hosts
 * the live harvest already tied to them.
 */
export async function deepTimeSweep(
  selector: string,
  kind: string,
  opts: TimeMachineOptions = {},
): Promise<TimeMachineReport> {
  const t0 = Date.now();
  const fromYear = Math.max(ARCHIVE_EPOCH_YEAR, opts.fromYear ?? ARCHIVE_EPOCH_YEAR);
  const cap = opts.cap ?? 600;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const nowYear = new Date().getUTCFullYear();

  const report: TimeMachineReport = {
    selector, kind,
    window: { from: fromYear, to: nowYear },
    earliest: null, latest: null, eras: [], captures: [],
    archive_items: [], hosts_probed: [], dead_hosts: [],
    corpora: [], elapsed_ms: 0,
  };

  // 1. Decide what is addressable by capture index.
  const seedHosts = new Set<string>();
  for (const h of opts.hosts ?? []) {
    const clean = hostOf(h);
    if (clean) seedHosts.add(clean);
  }
  let exactTarget: string | null = null;

  if (kind === "domain" || /^https?:\/\//i.test(selector) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(selector)) {
    const h = hostOf(selector);
    if (h) seedHosts.add(h);
    if (/^https?:\/\/.+\/.+/i.test(selector)) exactTarget = selector;
  }
  if (kind === "email") {
    const domain = selector.split("@")[1];
    if (domain) seedHosts.add(domain.toLowerCase());
  }

  const hosts = [...seedHosts].slice(0, 6);
  report.hosts_probed = hosts;

  // 2. Wayback — the spine of the timeline.
  const cdxJobs: Promise<{ rows: TimeCapture[]; error: string | null }>[] = [];
  if (exactTarget) cdxJobs.push(waybackCdx(exactTarget, { matchType: "prefix", limit: 400, fromYear, timeoutMs }));
  for (const h of hosts) {
    cdxJobs.push(waybackCdx(h, { matchType: "domain", limit: 400, fromYear, timeoutMs }));
  }
  const cdxResults = cdxJobs.length ? await Promise.all(cdxJobs) : [];
  const waybackRows = cdxResults.flatMap((r) => r.rows);
  report.corpora.push({
    name: "Wayback CDX",
    ok: cdxResults.some((r) => !r.error),
    records: waybackRows.length,
    note: hosts.length || exactTarget
      ? null
      : "No addressable host for this selector — capture indexes are keyed by URL, not by person.",
  });

  // 3. Common Crawl — only worth a call when a host exists to ask about.
  const ccRows: TimeCapture[] = [];
  if (hosts.length) {
    const ccResults = await Promise.all(hosts.slice(0, 3).map((h) => timed(commonCrawl(h, 12_000), 13_000, { rows: [], error: "timeout" })));
    for (const r of ccResults) ccRows.push(...r.rows);
    report.corpora.push({ name: "Common Crawl index", ok: ccResults.some((r) => !r.error), records: ccRows.length, note: null });
  }

  // 4. Full-text corpora — the only layer that can reach a person by name.
  if (!opts.skipFullText) {
    const quoted = /\s/.test(selector) ? `"${selector}"` : selector;
    const hits: IaHit[] = await timed(
      searchArchive(quoted, { limit: 30, deepRead: 2, timeoutMs: 15_000 }),
      16_000,
      [],
    );
    report.archive_items = hits.map((h) => ({
      id: h.id,
      title: h.title,
      creator: h.creator,
      date: h.date,
      mediatype: h.mediatype,
      url: h.details_url,
      excerpt: (h.body || h.description || "").slice(0, 500),
    }));
    report.corpora.push({ name: "Internet Archive full text", ok: true, records: hits.length, note: null });
  }

  // 5. Fold the capture rows into one deduped, chronologically ordered record.
  const seen = new Set<string>();
  const all: TimeCapture[] = [];
  for (const c of [...waybackRows, ...ccRows]) {
    const k = `${c.year}|${c.digest || c.url}`;
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(c);
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  report.captures = all.slice(0, cap);
  report.earliest = all[0] ?? null;
  report.latest = all[all.length - 1] ?? null;

  const byYear = new Map<number, { captures: number; hosts: Set<string>; sample: TimeCapture }>();
  for (const c of all) {
    const bucket = byYear.get(c.year);
    if (bucket) {
      bucket.captures++;
      bucket.hosts.add(hostOf(c.url));
    } else {
      byYear.set(c.year, { captures: 1, hosts: new Set([hostOf(c.url)]), sample: c });
    }
  }
  report.eras = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, b]) => ({
      year,
      captures: b.captures,
      hosts: [...b.hosts].filter(Boolean).slice(0, 8),
      sample_url: b.sample.url,
      sample_wayback: b.sample.wayback_url,
    }));

  // 6. A host the archive remembers but the present does not is the single
  // highest-value lead in an origins search: the page is gone, the copy is not.
  if (hosts.length) {
    const alive = await Promise.all(hosts.map((h) => timed(hostAlive(h, 6000), 6500, false)));
    report.dead_hosts = hosts.filter((_, i) => !alive[i] && report.eras.length > 0);
  }

  report.elapsed_ms = Date.now() - t0;
  return report;
}
