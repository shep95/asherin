// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE CORRELATOR — TIER 2
// ---------------------------------------------------------------------------
// Tier 1 (googleSubstrate.analyze) answers "what happened on each surface".
// Every one of its ten analyzers reads a single source and emits a single
// observation. That is a report, not intelligence: ten true statements that
// never speak to each other. A security notice on Tuesday and a file that went
// public on Wednesday are two findings at tier 1 and one incident in reality.
//
// Tier 2 correlates. It reads the same stored ledger — no network, no model,
// no guessing — and produces the four things a flat analyzer cannot:
//
//   1. FUSION      One human, one dossier, across mail + calendar + drive +
//                  contacts + tasks, with a measured attention vector.
//   2. BASELINE    What normal looks like for THIS person, expressed as a
//                  168-cell hour-of-week histogram, so "unusual" is a
//                  measurement instead of an adjective.
//   3. CHAINING    Events inside one window that share a subject become one
//                  escalated incident with a timeline.
//   4. PROJECTION  Cadence carried forward: what recurs, when, and what it
//                  will cost across the next 90 days.
//
// Every number below is derived from stored rows and carries its formula in a
// comment. Nothing here is an estimate presented as a fact: where the evidence
// is too thin to support a claim, the finding says so rather than shrinking
// its confidence and asserting anyway.
// ═══════════════════════════════════════════════════════════════════════════

import type { InsightRow } from "./googleSubstrate.ts";

export interface LedgerRow {
  id: string;
  source: string;
  kind: string;
  occurred_at: string | null;
  actor_email: string | null;
  actor_name: string | null;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  counterparties: string[] | null;
  amount: number | string | null;
  currency: string | null;
  metadata: Record<string, any> | null;
  account_email: string | null;
}

const DAY = 864e5;
const HOUR = 36e5;
const ts = (s: string | null | undefined): number => (s ? Date.parse(s) : NaN);
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const domainOf = (e: string | null | undefined) => String(e ?? "").split("@")[1] ?? "";
const lower = (s: string | null | undefined) => String(s ?? "").toLowerCase().trim();
const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const a = xs.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  // Even-length arrays have no single middle element; averaging the two
  // straddling values is the definition, and picking either one alone skews
  // every latency figure derived from it.
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
  const cur = m.get(k);
  if (cur) cur.push(v);
  else m.set(k, [v]);
};

/** The counterparty a mail row is *about*, from the user's point of view. */
function peerOf(r: LedgerRow): string | null {
  if (r.direction === "out") {
    const first = (r.counterparties ?? []).find(Boolean);
    return first ? lower(first) : null;
  }
  return r.actor_email ? lower(r.actor_email) : null;
}

const isBulk = (r: LedgerRow) => Boolean(r.metadata?.bulk);

// ─────────────────────────────────────────────────────────────────────────────
// 1 ── ENTITY FUSION
// ─────────────────────────────────────────────────────────────────────────────

export interface Entity {
  email: string;
  name: string;
  domain: string;
  /** Per-surface event counts. Presence on many surfaces is itself a signal. */
  channels: Record<string, number>;
  inbound: number;
  outbound: number;
  meetings: number;
  meetingMinutes: number;
  sharedFiles: number;
  tasksMentioning: number;
  saved: boolean;
  firstSeen: number;
  lastSeen: number;
  /** Median inbound→outbound turnaround in hours, or null when never replied. */
  replyLatencyH: number | null;
  /** Effort-weighted attention. Outbound counts double: writing costs more
   *  than receiving, so a mailing list never outranks a colleague. */
  attention: number;
  /** Surfaces touched — 1..5. A person in mail AND calendar AND drive is a
   *  working relationship; mail alone may be a newsletter. */
  breadth: number;
}

export function buildEntities(rows: LedgerRow[]): Entity[] {
  const byEmail = new Map<string, Entity>();
  const savedContacts = new Set<string>();
  const inboundTimes = new Map<string, number[]>();
  const outboundTimes = new Map<string, number[]>();

  const get = (email: string, name?: string | null): Entity => {
    let e = byEmail.get(email);
    if (!e) {
      e = {
        email, name: name?.trim() || email, domain: domainOf(email),
        channels: {}, inbound: 0, outbound: 0, meetings: 0, meetingMinutes: 0,
        sharedFiles: 0, tasksMentioning: 0, saved: false,
        firstSeen: Infinity, lastSeen: -Infinity, replyLatencyH: null,
        attention: 0, breadth: 0,
      };
      byEmail.set(email, e);
    }
    // A real display name always beats an address used as a placeholder.
    if (name && name.trim() && (e.name === e.email)) e.name = name.trim();
    return e;
  };

  for (const r of rows) {
    const t = ts(r.occurred_at);
    const touch = (e: Entity, source: string) => {
      e.channels[source] = (e.channels[source] ?? 0) + 1;
      if (Number.isFinite(t)) {
        e.firstSeen = Math.min(e.firstSeen, t);
        e.lastSeen = Math.max(e.lastSeen, t);
      }
    };

    if (r.source === "contacts") {
      for (const c of r.counterparties ?? []) {
        const email = lower(c);
        if (!email.includes("@")) continue;
        savedContacts.add(email);
        const e = get(email, r.actor_name ?? r.subject);
        e.saved = true;
        touch(e, "contacts");
      }
      continue;
    }

    if (r.source === "gmail") {
      // Bulk mail is traffic, not relationship. It is excluded from attention
      // entirely — otherwise a daily newsletter outranks a spouse.
      if (isBulk(r)) continue;
      const peer = peerOf(r);
      if (!peer || !peer.includes("@")) continue;
      const e = get(peer, r.direction === "in" ? r.actor_name : null);
      touch(e, "gmail");
      if (r.direction === "out") {
        e.outbound++;
        if (Number.isFinite(t)) push(outboundTimes, peer, t);
      } else {
        e.inbound++;
        if (Number.isFinite(t)) push(inboundTimes, peer, t);
      }
      continue;
    }

    if (r.source === "calendar") {
      const minutes = Number(r.metadata?.minutes) || 0;
      const attendees = (r.counterparties ?? []).map(lower).filter((a) => a.includes("@"));
      for (const a of attendees) {
        const e = get(a);
        touch(e, "calendar");
        e.meetings++;
        e.meetingMinutes += minutes;
      }
      continue;
    }

    if (r.source === "drive") {
      for (const a of (r.counterparties ?? []).map(lower)) {
        if (!a.includes("@")) continue;
        const e = get(a);
        touch(e, "drive");
        e.sharedFiles++;
      }
      continue;
    }

    if (r.source === "tasks") {
      const text = `${r.subject ?? ""} ${r.snippet ?? ""}`;
      for (const m of text.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) {
        const e = get(lower(m[0]));
        touch(e, "tasks");
        e.tasksMentioning++;
      }
    }
  }

  for (const e of byEmail.values()) {
    e.saved = e.saved || savedContacts.has(e.email);
    e.breadth = Object.keys(e.channels).length;

    // Reply latency: for each inbound, the first outbound that follows it.
    // Pairing every inbound with the same trailing reply would report a single
    // reply as many fast turnarounds, so each outbound is consumed once.
    const ins = (inboundTimes.get(e.email) ?? []).slice().sort((a, b) => a - b);
    const outs = (outboundTimes.get(e.email) ?? []).slice().sort((a, b) => a - b);
    const lat: number[] = [];
    let oi = 0;
    for (const i of ins) {
      while (oi < outs.length && outs[oi] <= i) oi++;
      if (oi >= outs.length) break;
      lat.push((outs[oi] - i) / HOUR);
      oi++;
    }
    e.replyLatencyH = lat.length >= 2 ? Number(median(lat).toFixed(1)) : null;

    // attention = 2·outbound + inbound + 3·(meeting hours) + 2·sharedFiles.
    // Meeting time is the scarcest resource a person spends, so an hour in a
    // room weighs more than a message; the coefficients are the weights, and
    // they are stated here rather than buried.
    e.attention = Math.round(
      2 * e.outbound + e.inbound + 3 * (e.meetingMinutes / 60) + 2 * e.sharedFiles,
    );
    if (!Number.isFinite(e.firstSeen)) e.firstSeen = 0;
    if (!Number.isFinite(e.lastSeen)) e.lastSeen = 0;
  }

  return [...byEmail.values()]
    .filter((e) => e.attention > 0 || e.saved)
    .sort((a, b) => b.attention - a.attention);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 ── RHYTHM BASELINE  (168-cell hour-of-week histogram)
// ─────────────────────────────────────────────────────────────────────────────

export interface Rhythm {
  /** cells[day*24 + hour], day 0 = Sunday, in UTC. */
  cells: number[];
  total: number;
  /** Cells covering the middle 80% of mass — the person's working envelope. */
  coreCells: number[];
}

const cellOf = (t: number) => {
  const d = new Date(t);
  return d.getUTCDay() * 24 + d.getUTCHours();
};

export function rhythmBaseline(rows: LedgerRow[], untilMs: number): Rhythm {
  const cells = new Array(168).fill(0);
  let total = 0;
  for (const r of rows) {
    if (r.source !== "gmail" || r.direction !== "out" || isBulk(r)) continue;
    const t = ts(r.occurred_at);
    if (!Number.isFinite(t) || t >= untilMs) continue; // half-open [.., untilMs)
    cells[cellOf(t)]++;
    total++;
  }
  const order = cells.map((n, i) => [n, i] as const).sort((a, b) => b[0] - a[0]);
  const core: number[] = [];
  let acc = 0;
  for (const [n, i] of order) {
    if (acc >= total * 0.8 || n === 0) break;
    core.push(i);
    acc += n;
  }
  return { cells, total, coreCells: core };
}

export interface RhythmAnomaly {
  at: string;
  cell: number;
  subject: string;
  account: string | null;
  /** Baseline mass in this cell and its two neighbours. */
  neighbourhood: number;
}

/**
 * An action is anomalous when it lands in an hour-of-week the person has never
 * worked in, and neither has the hour on either side of it. Requiring the
 * neighbourhood to be empty prevents a 09:00 baseline from flagging 08:00 as an
 * intrusion. Below MIN_BASELINE the histogram is noise, and the function
 * refuses rather than manufacturing alarms out of a thin history.
 */
const MIN_BASELINE = 60;

export function detectRhythmAnomalies(
  rows: LedgerRow[], nowMs: number, windowDays = 14,
): { anomalies: RhythmAnomaly[]; baseline: Rhythm; sufficient: boolean } {
  const cut = nowMs - windowDays * DAY;
  const baseline = rhythmBaseline(rows, cut);
  if (baseline.total < MIN_BASELINE) return { anomalies: [], baseline, sufficient: false };

  const anomalies: RhythmAnomaly[] = [];
  for (const r of rows) {
    if (r.source !== "gmail" || r.direction !== "out" || isBulk(r)) continue;
    const t = ts(r.occurred_at);
    if (!Number.isFinite(t) || t < cut || t > nowMs) continue;
    const c = cellOf(t);
    // Wrap the neighbourhood across the week boundary: Sunday 00:00 neighbours
    // Saturday 23:00, and modular arithmetic is the only way to say that.
    const hood = baseline.cells[(c + 167) % 168] + baseline.cells[c] + baseline.cells[(c + 1) % 168];
    if (hood > 0) continue;
    anomalies.push({
      at: new Date(t).toISOString(),
      cell: c,
      subject: clip(r.subject, 100),
      account: r.account_email,
      neighbourhood: hood,
    });
  }
  return { anomalies, baseline, sufficient: true };
}

const CELL_LABEL = (c: number) =>
  `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Math.floor(c / 24)]} ${String(c % 24).padStart(2, "0")}:00Z`;

// ─────────────────────────────────────────────────────────────────────────────
// 3 ── COMMITMENT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const PROMISE_CUES =
  /\b(i(?:'| wi)ll (?:send|share|get|have|call|follow up|circle back|review|look|draft|write|ping|email)|i can (?:send|have|get)|let me (?:send|check|get|pull)|(?:sending|sharing) (?:it|this|that|those) (?:over|to you)|by (?:end of|eod|cob)|will (?:have|get) (?:it|this|that) to you)\b/i;

const DEADLINE_WORDS: Record<string, number> = {
  today: 0, tonight: 0, tomorrow: 1,
  monday: -1, tuesday: -1, wednesday: -1, thursday: -1, friday: -1,
  saturday: -1, sunday: -1,
};
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Resolve "by Friday" against the date the promise was made, not against now. */
export function resolveDeadline(text: string, madeAtMs: number): number | null {
  const m = text.toLowerCase().match(
    /\bby\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|cob|end of (?:day|week))\b/,
  );
  if (!m) return null;
  const word = m[1];
  if (word === "eod" || word === "cob" || word === "end of day") return madeAtMs + 12 * HOUR;
  if (word === "end of week") return madeAtMs + 5 * DAY;
  const offset = DEADLINE_WORDS[word];
  if (offset === undefined) return null;
  if (offset >= 0) return madeAtMs + offset * DAY + 12 * HOUR;
  const target = WEEKDAY_INDEX[word];
  const cur = new Date(madeAtMs).getUTCDay();
  // "by Friday" said on Friday means next Friday, not zero days from now.
  const delta = ((target - cur + 7) % 7) || 7;
  return madeAtMs + delta * DAY + 12 * HOUR;
}

const DELIVERY_CUES =
  /\b(attached|attaching|here(?:'s| is)|sent|sending now|as promised|please find|shared with you|uploaded|done|completed)\b/i;

export interface Promise_ {
  id: string;
  to: string;
  at: string;
  dueAt: string | null;
  overdue: boolean;
  text: string;
  /** True when a later outbound to the same peer reads as a delivery. */
  settled: boolean;
  /** False when there is no way to check — stated, never hidden. */
  checkable: boolean;
}

export function extractPromises(rows: LedgerRow[], nowMs: number): Promise_[] {
  const mail = rows.filter((r) => r.source === "gmail" && !isBulk(r));
  const outByPeer = new Map<string, LedgerRow[]>();
  for (const r of mail) {
    if (r.direction !== "out") continue;
    const p = peerOf(r);
    if (p) push(outByPeer, p, r);
  }

  const out: Promise_[] = [];
  for (const r of mail) {
    if (r.direction !== "out") continue;
    const at = ts(r.occurred_at);
    if (!Number.isFinite(at)) continue;
    // A promise older than 120 days is history, not an open obligation.
    if (nowMs - at > 120 * DAY) continue;
    const text = `${r.subject ?? ""} ${r.snippet ?? ""}`;
    if (!PROMISE_CUES.test(text)) continue;
    const peer = peerOf(r);
    if (!peer) continue;

    const dueAt = resolveDeadline(text, at);
    const later = (outByPeer.get(peer) ?? []).filter((o) => {
      const t = ts(o.occurred_at);
      return Number.isFinite(t) && t > at;
    });
    const settled = later.some((o) => DELIVERY_CUES.test(`${o.subject ?? ""} ${o.snippet ?? ""}`));

    out.push({
      id: r.id,
      to: peer,
      at: new Date(at).toISOString(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      overdue: dueAt != null && dueAt < nowMs && !settled,
      text: clip(r.subject || r.snippet, 140),
      settled,
      // Only the outbound side is stored, so "unfulfilled" is a claim about
      // this ledger, not about the world. Say which one is being made.
      checkable: later.length > 0,
    });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 ── SPEND PROJECTION
// ─────────────────────────────────────────────────────────────────────────────

const RECEIPT_CUES =
  /\b(receipt|invoice|payment|subscription|renewal|billed|charged|order confirm|your plan)\b/i;

export interface VendorForecast {
  vendor: string;
  currency: string;
  charges: number;
  cadenceDays: number;
  cadenceLabel: string;
  typical: number;
  nextDue: string;
  /** Charges expected inside the 90-day horizon. */
  horizonHits: number;
  horizonTotal: number;
  /** Coefficient of variation on amounts — high means the price is moving. */
  drift: number;
}

export function forecastSpend(rows: LedgerRow[], nowMs: number, horizonDays = 90): VendorForecast[] {
  const byKey = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    if (r.source !== "gmail") continue;
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    if (!RECEIPT_CUES.test(`${r.subject ?? ""} ${r.snippet ?? ""}`)) continue;
    const vendor = domainOf(r.actor_email);
    if (!vendor) continue;
    // Currency is part of the identity. Summing USD and EUR produces a number
    // that is not money in any currency.
    push(byKey, `${vendor}|${(r.currency ?? "USD").toUpperCase()}`, r);
  }

  const out: VendorForecast[] = [];
  for (const [key, hits] of byKey) {
    if (hits.length < 2) continue;
    const [vendor, currency] = key.split("|");
    const sorted = hits.slice().sort((a, b) => ts(a.occurred_at) - ts(b.occurred_at));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const g = (ts(sorted[i].occurred_at) - ts(sorted[i - 1].occurred_at)) / DAY;
      if (Number.isFinite(g) && g > 0.5) gaps.push(g);
    }
    if (!gaps.length) continue;
    // Median, not mean: one duplicated receipt or one skipped month would drag
    // a mean cadence far enough to misdate every projected renewal.
    const cadence = median(gaps);
    if (!Number.isFinite(cadence) || cadence <= 0) continue;

    const amounts = sorted.map((h) => Number(h.amount)).filter((n) => Number.isFinite(n));
    const typical = median(amounts);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length);
    const drift = mean > 0 ? sd / mean : 0;

    const lastT = ts(sorted[sorted.length - 1].occurred_at);
    let next = lastT + cadence * DAY;
    // A projection that lands in the past is a missed charge, not a forecast;
    // roll forward to the first future occurrence so the date is actionable.
    while (next < nowMs) next += cadence * DAY;
    const horizonEnd = nowMs + horizonDays * DAY;
    let hitsInHorizon = 0;
    for (let t = next; t < horizonEnd; t += cadence * DAY) hitsInHorizon++;

    out.push({
      vendor, currency,
      charges: sorted.length,
      cadenceDays: Math.round(cadence),
      cadenceLabel: cadence < 10 ? "weekly-ish"
        : cadence < 45 ? "monthly"
        : cadence < 120 ? "quarterly"
        : cadence < 400 ? "annual" : "irregular",
      typical: Number(typical.toFixed(2)),
      nextDue: new Date(next).toISOString(),
      horizonHits: hitsInHorizon,
      horizonTotal: Number((hitsInHorizon * typical).toFixed(2)),
      drift: Number(drift.toFixed(3)),
    });
  }
  return out.sort((a, b) => b.horizonTotal - a.horizonTotal);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 ── THREAT CHAINING
// ─────────────────────────────────────────────────────────────────────────────

const SECURITY_CUES =
  /\b(security alert|new sign-?in|suspicious|password (was )?(changed|reset)|verify your|data breach|2-?step|unusual activity|account (was )?(locked|compromised))\b/i;
const CREDENTIAL_CUES = /\b(password (was )?(changed|reset)|recovery (email|phone) (was )?(added|changed)|2-?step verification (was )?(off|disabled|turned off)|new (device|app) (access|signed in))\b/i;

export interface ChainEvent { at: number; kind: string; text: string; weight: number }

/**
 * A chain is a set of security-relevant events inside one window. Any single
 * one of them is routine; three of them in the same week is an incident, and
 * the difference is only visible to something that looks across sources.
 */
export function threatChain(rows: LedgerRow[], nowMs: number, windowDays = 30): ChainEvent[] {
  const cut = nowMs - windowDays * DAY;
  const ev: ChainEvent[] = [];
  for (const r of rows) {
    const t = ts(r.occurred_at);
    if (!Number.isFinite(t) || t < cut) continue;
    const text = `${r.subject ?? ""} ${r.snippet ?? ""}`;
    if (r.source === "gmail" && r.direction === "in") {
      if (CREDENTIAL_CUES.test(text)) ev.push({ at: t, kind: "credential_change", text: clip(r.subject, 120), weight: 3 });
      else if (SECURITY_CUES.test(text)) ev.push({ at: t, kind: "provider_alert", text: clip(r.subject, 120), weight: 2 });
    }
    if (r.source === "drive" && r.metadata?.publiclyShared) {
      ev.push({ at: t, kind: "public_exposure", text: clip(r.subject, 120), weight: 3 });
    }
  }
  return ev.sort((a, b) => a.at - b.at);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 ── STATE VECTOR
// ─────────────────────────────────────────────────────────────────────────────

export interface StateVector {
  /** 0–100. Concentration of attention (Herfindahl on attention shares). */
  focus: number;
  /** 0–100. Higher = more exposed. */
  exposure: number;
  /** Median hours to first reply across all correspondents. */
  responsivenessH: number | null;
  /** Count of open, unsettled promises. */
  commitmentDebt: number;
  /** Projected 90-day outflow, per currency. */
  projected: Record<string, number>;
  /** Surfaces actually represented in the ledger. */
  surfaces: string[];
  people: number;
  span: { from: string | null; to: string | null };
}

export function stateVector(
  rows: LedgerRow[], entities: Entity[], promises: Promise_[],
  forecasts: VendorForecast[], chain: ChainEvent[], nowMs: number,
): StateVector {
  const attn = entities.map((e) => e.attention).filter((n) => n > 0);
  const total = attn.reduce((a, b) => a + b, 0);
  // Herfindahl index: Σ(share²), normalised to 0–100. 100 = one relationship
  // consumes everything; near 0 = attention is spread thin across many.
  const hhi = total > 0 ? attn.reduce((a, n) => a + (n / total) ** 2, 0) : 0;

  const exposedFiles = rows.filter((r) => r.source === "drive" && r.metadata?.publiclyShared).length;
  const chainWeight = chain.reduce((a, e) => a + e.weight, 0);
  // exposure = 8·publicFiles + 6·chainWeight, clamped. Both terms are counts of
  // observed facts, not judgements, and the clamp keeps one noisy week from
  // pinning the gauge forever.
  const exposure = Math.min(100, exposedFiles * 8 + chainWeight * 6);

  const lat = entities.map((e) => e.replyLatencyH).filter((n): n is number => n != null);
  const times = rows.map((r) => ts(r.occurred_at)).filter(Number.isFinite);

  const projected: Record<string, number> = {};
  for (const f of forecasts) {
    projected[f.currency] = Number(((projected[f.currency] ?? 0) + f.horizonTotal).toFixed(2));
  }

  return {
    focus: Math.round(hhi * 100),
    exposure,
    responsivenessH: lat.length ? Number(median(lat).toFixed(1)) : null,
    commitmentDebt: promises.filter((p) => !p.settled).length,
    projected,
    surfaces: [...new Set(rows.map((r) => r.source))].sort(),
    people: entities.length,
    span: {
      from: times.length ? new Date(Math.min(...times)).toISOString() : null,
      to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION — emit tier-2 findings in the tier-1 shape
// ─────────────────────────────────────────────────────────────────────────────

export function correlate(userId: string, rows: LedgerRow[], nowMs = Date.now()): InsightRow[] {
  const out: InsightRow[] = [];
  const add = (i: Omit<InsightRow, "user_id">) => out.push({ user_id: userId, ...i });
  if (!rows.length) return out;

  const entities = buildEntities(rows);
  const promises = extractPromises(rows, nowMs);
  const forecasts = forecastSpend(rows, nowMs);
  const chain = threatChain(rows, nowMs);
  const rhythm = detectRhythmAnomalies(rows, nowMs);
  const sv = stateVector(rows, entities, promises, forecasts, chain, nowMs);

  // ── State vector. The lead block: one row that describes the whole ledger.
  add({
    domain: "state",
    code: "state_vector",
    subject_key: "self",
    severity: 1,
    title: `State vector — ${sv.people} people, ${sv.surfaces.length} surfaces`,
    detail: [
      `Focus index ${sv.focus}/100 (attention concentration).`,
      `Exposure ${sv.exposure}/100.`,
      sv.responsivenessH != null ? `Median first reply ${sv.responsivenessH}h.` : `Reply latency unmeasurable — too few inbound/outbound pairs.`,
      `${sv.commitmentDebt} open commitment(s).`,
      Object.keys(sv.projected).length
        ? `Projected 90-day outflow: ${Object.entries(sv.projected).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(", ")}.`
        : `No recurring charges detected.`,
    ].join(" "),
    metric: sv as unknown as Record<string, unknown>,
    evidence: [],
  });

  // ── Fused dossiers for the people who actually matter.
  const core = entities.filter((e) => e.breadth >= 2 || e.attention >= 8).slice(0, 15);
  for (const e of core) {
    const quiet = e.lastSeen ? Math.round((nowMs - e.lastSeen) / DAY) : null;
    add({
      domain: "entity",
      code: "entity_dossier",
      subject_key: e.email,
      severity: e.breadth >= 3 ? 3 : 2,
      title: `${e.name} — ${e.breadth} surface(s), attention ${e.attention}`,
      detail: [
        `${e.outbound} sent / ${e.inbound} received`,
        e.meetings ? `${e.meetings} meeting(s), ${(e.meetingMinutes / 60).toFixed(1)}h` : null,
        e.sharedFiles ? `${e.sharedFiles} shared file(s)` : null,
        e.tasksMentioning ? `${e.tasksMentioning} task mention(s)` : null,
        e.replyLatencyH != null ? `median reply ${e.replyLatencyH}h` : null,
        e.saved ? "saved contact" : "NOT in contacts",
        quiet != null ? `last activity ${quiet}d ago` : null,
      ].filter(Boolean).join(" · "),
      metric: e as unknown as Record<string, unknown>,
      evidence: [],
    });
  }

  // ── Threat chain, escalated only when the events actually co-occur.
  if (chain.length >= 2) {
    const span = (chain[chain.length - 1].at - chain[0].at) / DAY;
    const weight = chain.reduce((a, e) => a + e.weight, 0);
    add({
      domain: "security",
      code: "threat_chain",
      subject_key: "window",
      severity: weight >= 6 ? 5 : 4,
      title: `Correlated security chain — ${chain.length} events in ${Math.max(1, Math.round(span))} day(s)`,
      detail: chain.map((e) =>
        `• ${new Date(e.at).toISOString().slice(0, 10)} [${e.kind}] ${e.text}`).join("\n"),
      metric: { events: chain.length, weight, spanDays: Math.round(span) },
      evidence: chain.map((e) => ({ at: new Date(e.at).toISOString(), kind: e.kind })),
    });
  }

  // ── Rhythm. Silence about an unmeasurable baseline is itself reported.
  if (!rhythm.sufficient) {
    add({
      domain: "behavior",
      code: "rhythm_baseline",
      subject_key: "self",
      severity: 1,
      title: "Behavioural baseline not yet established",
      detail: `${rhythm.baseline.total} historical outbound events — below the ${MIN_BASELINE} needed before "unusual hour" means anything. Sweep a longer window to establish it.`,
      metric: { observed: rhythm.baseline.total, required: MIN_BASELINE },
      evidence: [],
    });
  } else {
    add({
      domain: "behavior",
      code: "rhythm_baseline",
      subject_key: "self",
      severity: 1,
      title: `Working envelope — ${rhythm.baseline.coreCells.length} active hours per week`,
      detail: `${rhythm.baseline.total} outbound events map to ${rhythm.baseline.coreCells.length} hour-of-week cells carrying 80% of activity. Peak: ${rhythm.baseline.coreCells.slice(0, 5).map(CELL_LABEL).join(", ")}.`,
      metric: { total: rhythm.baseline.total, coreCells: rhythm.baseline.coreCells.slice(0, 24), cells: rhythm.baseline.cells },
      evidence: [],
    });
    if (rhythm.anomalies.length) {
      add({
        domain: "behavior",
        code: "rhythm_anomaly",
        subject_key: "recent",
        severity: rhythm.anomalies.length >= 3 ? 4 : 2,
        title: `${rhythm.anomalies.length} action(s) outside every established working hour`,
        detail: rhythm.anomalies.slice(0, 8).map((a) =>
          `• ${a.at.slice(0, 16).replace("T", " ")}Z (${CELL_LABEL(a.cell)}) — ${a.subject}`).join("\n") +
          `\nTravel, a schedule change, or someone else on the account all look like this. It is a question, not a verdict.`,
        metric: { count: rhythm.anomalies.length, cells: [...new Set(rhythm.anomalies.map((a) => a.cell))] },
        evidence: rhythm.anomalies.slice(0, 8),
      });
    }
  }

  // ── Commitments made in your own outbound.
  const open = promises.filter((p) => !p.settled);
  if (open.length) {
    const overdue = open.filter((p) => p.overdue);
    add({
      domain: "commitment",
      code: "open_promises",
      subject_key: "outbound",
      severity: overdue.length ? 4 : 2,
      title: `${open.length} promise(s) you made and this ledger cannot see delivered` +
        (overdue.length ? ` — ${overdue.length} past a stated deadline` : ""),
      detail: open.slice(0, 10).map((p) =>
        `• ${p.at.slice(0, 10)} → ${p.to}${p.dueAt ? ` (due ${p.dueAt.slice(0, 10)}${p.overdue ? ", OVERDUE" : ""})` : ""}\n  "${p.text}"`).join("\n") +
        `\nDelivery is judged from later outbound mail only. A promise kept by phone, in person, or from an unconnected account reads as open here.`,
      metric: { open: open.length, overdue: overdue.length },
      evidence: open.slice(0, 10).map((p) => ({ id: p.id, to: p.to, at: p.at, dueAt: p.dueAt })),
    });
  }

  // ── Forward spend.
  if (forecasts.length) {
    const byCur: Record<string, number> = {};
    for (const f of forecasts) byCur[f.currency] = (byCur[f.currency] ?? 0) + f.horizonTotal;
    add({
      domain: "financial",
      code: "spend_forecast",
      subject_key: "90d",
      severity: Object.values(byCur).some((v) => v > 1000) ? 4 : 2,
      title: `Projected 90-day outflow — ${Object.entries(byCur).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" + ")}`,
      detail: forecasts.slice(0, 12).map((f) =>
        `• ${f.vendor} — ${f.currency} ${f.typical.toFixed(2)} ${f.cadenceLabel} (every ~${f.cadenceDays}d), next ${f.nextDue.slice(0, 10)}, ${f.horizonHits}× in horizon` +
        (f.drift > 0.15 ? ` ⚠ amount drifting ±${Math.round(f.drift * 100)}%` : "")).join("\n"),
      metric: { byCurrency: byCur, vendors: forecasts.slice(0, 20) },
      evidence: [],
    });

    const drifting = forecasts.filter((f) => f.drift > 0.15 && f.charges >= 3);
    if (drifting.length) {
      add({
        domain: "financial",
        code: "price_drift",
        subject_key: "vendors",
        severity: 3,
        title: `${drifting.length} vendor(s) charging an inconsistent amount`,
        detail: drifting.map((f) =>
          `• ${f.vendor} — typical ${f.currency} ${f.typical.toFixed(2)}, variation ±${Math.round(f.drift * 100)}% across ${f.charges} charges`).join("\n"),
        metric: { vendors: drifting.map((f) => ({ vendor: f.vendor, drift: f.drift, charges: f.charges })) },
        evidence: [],
      });
    }
  }

  // ── Trust asymmetry: people who receive far more than they return.
  {
    const lopsided = entities.filter((e) =>
      e.outbound + e.inbound >= 8 && e.outbound >= 3 * Math.max(1, e.inbound));
    if (lopsided.length) {
      add({
        domain: "relationship",
        code: "effort_asymmetry",
        subject_key: "graph",
        severity: 2,
        title: `${lopsided.length} correspondent(s) you carry`,
        detail: lopsided.slice(0, 10).map((e) =>
          `• ${e.name} <${e.email}> — you sent ${e.outbound}, received ${e.inbound}`).join("\n"),
        metric: { people: lopsided.slice(0, 10).map((e) => ({ email: e.email, out: e.outbound, in: e.inbound })) },
        evidence: [],
      });
    }
  }

  return out;
}
