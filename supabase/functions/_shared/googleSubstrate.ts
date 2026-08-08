// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE SUBSTRATE — the persistent, searchable intelligence ledger
// ---------------------------------------------------------------------------
// The Mesh answers a question by calling Google live, every single turn. That
// is correct for freshness and wrong for everything else: it is slow, it burns
// quota, it cannot correlate across time, and it cannot be searched.
//
// The Substrate inverts it. A sweep harvests every reachable Google surface
// ONCE, normalizes each item into a single row shape (`google_signals`), and
// stores it. Analyzers then run over the stored rows — deterministically, with
// no model in the loop — and emit findings into `google_insights`. Chat and the
// dashboard both read the ledger. Nothing downstream ever calls Google.
//
// Hard rules encoded here:
//   • Read-only. This module has no write path into any Google account.
//   • Deterministic. Every number an analyzer emits was measured here, and
//     carries the signal ids that produced it as evidence.
//   • Idempotent. Ingestion is keyed on a stable fingerprint
//     (source|externalId), never a random uuid, so re-sweeping converges
//     instead of duplicating.
//   • Untrusted by construction. Subject/snippet text is Google-controlled and
//     is fenced before it can reach a model.
//   • Bounded. Every surface has a hard item cap and every sweep a wall clock,
//     so one enormous mailbox cannot exhaust the edge budget.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { harvestVoiceMessages } from "./phoneMessages.ts";
import {
  gfetch, hasScope, parseAddr, type MeshAccount,
} from "./googleMesh.ts";

// ── Row shape ──────────────────────────────────────────────────────────────

export type SignalSource = "gmail" | "sms" | "calendar" | "drive" | "contacts" | "tasks";

export interface SignalRow {
  user_id: string;
  account_id: string | null;
  account_email: string;
  source: SignalSource;
  kind: string;
  external_id: string;
  occurred_at: string | null;
  actor_email: string | null;
  actor_name: string | null;
  direction: "in" | "out" | "self" | null;
  subject: string | null;
  snippet: string | null;
  counterparties: string[];
  people_text: string;
  amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  fingerprint: string;
}

/** Stable, content-independent identity for a harvested item. */
function fingerprint(source: SignalSource, externalId: string): string {
  return `${source}:${externalId}`;
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Ledger rows carry a people_text mirror of counterparties so the generated
 *  tsvector stays immutable (array_to_string is only STABLE in Postgres). */
function withPeople(row: Omit<SignalRow, "people_text">): SignalRow {
  return { ...row, people_text: row.counterparties.join(" ") };
}

// ── Money extraction ───────────────────────────────────────────────────────
// Deliberately conservative: a currency symbol or ISO code immediately
// adjacent to a number. "Order 1234" must never become $1,234.

const MONEY = /(?:(USD|EUR|GBP|CAD|AUD)\s*|([$€£]))\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2})/i;
const SYMBOL_CCY: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };

export function extractAmount(text: string): { amount: number; currency: string } | null {
  const m = MONEY.exec(String(text ?? ""));
  if (!m) return null;
  const raw = Number(m[3].replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0 || raw > 10_000_000) return null;
  const currency = (m[1] ? m[1].toUpperCase() : SYMBOL_CCY[m[2]] ?? "USD");
  return { amount: raw, currency };
}

// ── Harvesters ─────────────────────────────────────────────────────────────
// Each returns normalized rows. A failure on one surface degrades that surface
// only; the sweep continues.

type Acct = MeshAccount & { token: string };

const GMAIL_WORKERS = 8;

/** Gmail: metadata + snippet only. Bodies are never stored. */
export async function harvestGmail(
  userId: string, a: Acct, days: number, cap: number, selfEmails: Set<string>,
): Promise<SignalRow[]> {
  const q = `newer_than:${days}d -in:spam -in:trash`;
  const list = await gfetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(cap, 500)}&q=${encodeURIComponent(q)}`,
    a.token,
  ).catch(() => ({ messages: [] }));

  const ids: string[] = (list.messages ?? []).slice(0, cap).map((m: any) => m.id);
  const out: SignalRow[] = [];
  const queue = [...ids];

  const workers = Array.from({ length: Math.min(GMAIL_WORKERS, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      if (!id) break;
      try {
        const d = await gfetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
          `?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc` +
          `&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`,
          a.token,
        );
        const h = (n: string) =>
          d.payload?.headers?.find((x: any) => x.name?.toLowerCase() === n)?.value ?? "";
        const at = Number(d.internalDate);
        const from = parseAddr(h("from"));
        const recips = `${h("to")},${h("cc")}`
          .split(",").map((s) => parseAddr(s).email).filter((e) => e.includes("@"));
        const outbound = selfEmails.has(from.email);
        const subject = clip(h("subject"), 400);
        const snippet = clip(d.snippet, 600);
        const money = extractAmount(`${subject} ${snippet}`);

        out.push(withPeople({
          user_id: userId,
          account_id: a.id,
          account_email: a.google_email,
          source: "gmail",
          kind: "message",
          external_id: d.id,
          occurred_at: Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : null,
          actor_email: from.email || null,
          actor_name: from.name || null,
          direction: outbound ? "out" : "in",
          subject,
          snippet,
          counterparties: [...new Set([from.email, ...recips])].filter(Boolean).slice(0, 24),
          amount: money?.amount ?? null,
          currency: money?.currency ?? null,
          metadata: {
            threadId: d.threadId,
            labels: (d.labelIds ?? []).slice(0, 12),
            bulk: Boolean(h("list-unsubscribe")),
          },
          fingerprint: fingerprint("gmail", d.id),
        }));
      } catch { /* one bad message must never kill the sweep */ }
    }
  });
  await Promise.allSettled(workers);
  return out;
}

/** Calendar: a symmetric window — the past is evidence, the future is exposure. */
export async function harvestCalendar(
  userId: string, a: Acct, backDays: number, forwardDays: number, cap: number,
): Promise<SignalRow[]> {
  const now = Date.now();
  const timeMin = new Date(now - backDays * 864e5).toISOString();
  const timeMax = new Date(now + forwardDays * 864e5).toISOString();
  const d = await gfetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=${Math.min(cap, 500)}`,
    a.token,
  ).catch(() => ({ items: [] }));

  return (d.items ?? []).slice(0, cap).map((e: any) => {
    const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : null);
    const end = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00Z` : null);
    const attendees: string[] = (e.attendees ?? [])
      .map((x: any) => String(x.email ?? "").toLowerCase()).filter((s: string) => Boolean(s));
    const mins = start && end
      ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000))
      : null;
    return withPeople({
      user_id: userId,
      account_id: a.id,
      account_email: a.google_email,
      source: "calendar" as const,
      kind: e.start?.date ? "all_day" : "event",
      external_id: String(e.id),
      occurred_at: start,
      actor_email: String(e.organizer?.email ?? "").toLowerCase() || null,
      actor_name: clip(e.organizer?.displayName, 120) || null,
      direction: null,
      subject: clip(e.summary || "(untitled event)", 400),
      snippet: clip(e.description, 600),
      counterparties: Array.from(new Set(attendees)).slice(0, 32),
      amount: null,
      currency: null,
      metadata: {
        end, minutes: mins, location: clip(e.location, 200) || null,
        status: e.status ?? null, hangout: Boolean(e.hangoutLink),
        recurring: Boolean(e.recurringEventId),
      },
      fingerprint: fingerprint("calendar", String(e.id)),
    });
  });
}

/** Drive: metadata only. Sharing posture is the intelligence here, not content. */
export async function harvestDrive(userId: string, a: Acct, cap: number): Promise<SignalRow[]> {
  const d = await gfetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=${Math.min(cap, 200)}` +
    `&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,createdTime,size,owners(emailAddress,displayName),shared,webViewLink,trashed,permissions(type,role))`,
    a.token,
  ).catch(() => ({ files: [] }));

  return (d.files ?? []).filter((f: any) => !f.trashed).slice(0, cap).map((f: any) => {
    const owner = f.owners?.[0];
    const perms = (f.permissions ?? []) as Array<{ type?: string; role?: string }>;
    const publiclyShared = perms.some((p) => p.type === "anyone" || p.type === "domain");
    return withPeople({
      user_id: userId,
      account_id: a.id,
      account_email: a.google_email,
      source: "drive" as const,
      kind: "file",
      external_id: String(f.id),
      occurred_at: f.modifiedTime ?? f.createdTime ?? null,
      actor_email: String(owner?.emailAddress ?? "").toLowerCase() || null,
      actor_name: clip(owner?.displayName, 120) || null,
      direction: null,
      subject: clip(f.name, 400),
      snippet: null,
      counterparties: [],
      amount: null,
      currency: null,
      metadata: {
        mimeType: f.mimeType ?? null,
        bytes: Number(f.size) || null,
        shared: Boolean(f.shared),
        publiclyShared,
        link: f.webViewLink ?? null,
        createdTime: f.createdTime ?? null,
      },
      fingerprint: fingerprint("drive", String(f.id)),
    });
  });
}

/** Contacts: the declared graph, against which the observed graph is diffed. */
export async function harvestContactsSignals(userId: string, a: Acct, cap: number): Promise<SignalRow[]> {
  const d = await gfetch(
    `https://people.googleapis.com/v1/people/me/connections?pageSize=${Math.min(cap, 1000)}` +
    `&personFields=names,emailAddresses,phoneNumbers,organizations,addresses,metadata`,
    a.token,
  ).catch(() => ({ connections: [] }));

  return (d.connections ?? []).slice(0, cap).map((p: any) => {
    const name = clip(p.names?.[0]?.displayName, 160);
    const emails = (p.emailAddresses ?? []).map((e: any) => String(e.value ?? "").toLowerCase()).filter(Boolean);
    const phones = (p.phoneNumbers ?? []).map((e: any) => clip(e.value, 40)).filter(Boolean);
    const org = p.organizations?.[0];
    return withPeople({
      user_id: userId,
      account_id: a.id,
      account_email: a.google_email,
      source: "contacts" as const,
      kind: "person",
      external_id: String(p.resourceName ?? emails[0] ?? name),
      occurred_at: p.metadata?.sources?.[0]?.updateTime ?? null,
      actor_email: emails[0] ?? null,
      actor_name: name || emails[0] || null,
      direction: null,
      subject: name || emails[0] || "(unnamed contact)",
      snippet: [org?.name, org?.title].filter(Boolean).join(" — ") || null,
      counterparties: emails.slice(0, 8),
      amount: null,
      currency: null,
      metadata: {
        phones: phones.slice(0, 6),
        org: clip(org?.name, 160) || null,
        title: clip(org?.title, 160) || null,
        addresses: (p.addresses ?? []).map((x: any) => clip(x.formattedValue, 200)).filter(Boolean).slice(0, 4),
      },
      fingerprint: fingerprint("contacts", String(p.resourceName ?? emails[0] ?? name)),
    });
  });
}

/** Tasks: explicit, self-authored commitments. Optional scope. */
export async function harvestTasks(userId: string, a: Acct, cap: number): Promise<SignalRow[]> {
  const lists = await gfetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=20", a.token)
    .catch(() => ({ items: [] }));
  const out: SignalRow[] = [];
  for (const l of (lists.items ?? []).slice(0, 8)) {
    if (out.length >= cap) break;
    const t = await gfetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?maxResults=100&showCompleted=true&showHidden=false`,
      a.token,
    ).catch(() => ({ items: [] }));
    for (const item of (t.items ?? [])) {
      if (out.length >= cap) break;
      out.push(withPeople({
        user_id: userId,
        account_id: a.id,
        account_email: a.google_email,
        source: "tasks",
        kind: "task",
        external_id: String(item.id),
        occurred_at: item.due ?? item.updated ?? null,
        actor_email: a.google_email,
        actor_name: null,
        direction: "self",
        subject: clip(item.title || "(untitled task)", 400),
        snippet: clip(item.notes, 600),
        counterparties: [],
        amount: null,
        currency: null,
        metadata: { list: clip(l.title, 120), status: item.status ?? null, due: item.due ?? null },
        fingerprint: fingerprint("tasks", String(item.id)),
      }));
    }
  }
  return out;
}

// ── Sweep orchestration ────────────────────────────────────────────────────

export interface SweepReport {
  account: string;
  source: SignalSource;
  harvested: number;
  status: "ok" | "skipped" | "error";
  error?: string;
}

const SCOPE_FOR: Record<SignalSource, string> = {
  gmail: "gmail.readonly",
  // Google Voice publishes no API; it mirrors every text into the mailbox,
  // so the SMS channel rides the mail scope already granted.
  sms: "gmail.readonly",
  calendar: "calendar.readonly",
  drive: "drive.metadata.readonly",
  contacts: "contacts.readonly",
  tasks: "tasks.readonly",
};

export interface SweepOptions {
  days?: number;
  sources?: SignalSource[];
  perSourceCap?: number;
  budgetMs?: number;
}

/**
 * Harvest every permitted surface of every live account and upsert into the
 * ledger. Bounded by a wall clock so a large mailbox degrades to a partial
 * sweep instead of a timeout — the next sweep resumes the same window and the
 * fingerprint key makes the overlap free.
 */
export async function runSweep(
  sb: SupabaseClient,
  userId: string,
  accounts: Acct[],
  opts: SweepOptions = {},
): Promise<{ reports: SweepReport[]; ingested: number; elapsedMs: number; partial: boolean }> {
  const started = Date.now();
  const days = Math.max(7, Math.min(365, opts.days ?? 90));
  const cap = Math.max(20, Math.min(400, opts.perSourceCap ?? 200));
  const budget = Math.max(10_000, Math.min(110_000, opts.budgetMs ?? 70_000));
  const wanted: SignalSource[] = opts.sources?.length
    ? opts.sources
    : ["gmail", "sms", "calendar", "drive", "contacts", "tasks"];

  const selfEmails = new Set(accounts.map((a) => a.google_email.toLowerCase()));
  const reports: SweepReport[] = [];
  let ingested = 0;
  let partial = false;

  for (const a of accounts) {
    for (const source of wanted) {
      if (Date.now() - started > budget) { partial = true; break; }
      if (!hasScope(a, SCOPE_FOR[source])) {
        reports.push({ account: a.google_email, source, harvested: 0, status: "skipped", error: "scope not granted" });
        continue;
      }
      try {
        let rows: SignalRow[] = [];
        if (source === "gmail") rows = await harvestGmail(userId, a, days, cap, selfEmails);
        else if (source === "sms") rows = (await harvestVoiceMessages(userId, a, days, cap)) as unknown as SignalRow[];
        else if (source === "calendar") rows = await harvestCalendar(userId, a, days, 60, cap);
        else if (source === "drive") rows = await harvestDrive(userId, a, cap);
        else if (source === "contacts") rows = await harvestContactsSignals(userId, a, cap);
        else if (source === "tasks") rows = await harvestTasks(userId, a, cap);

        // Chunked upsert — one oversized payload should not fail the surface.
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await sb
            .from("google_signals")
            .upsert(chunk, { onConflict: "user_id,fingerprint" });
          if (error) throw new Error(error.message);
        }
        ingested += rows.length;
        reports.push({ account: a.google_email, source, harvested: rows.length, status: "ok" });

        await sb.from("google_sweeps").upsert({
          user_id: userId, account_id: a.id, source,
          last_run_at: new Date().toISOString(),
          signals_ingested: rows.length, status: "ok", error: null,
        }, { onConflict: "user_id,account_id,source" });
      } catch (e) {
        const msg = (e as Error).message.slice(0, 300);
        reports.push({ account: a.google_email, source, harvested: 0, status: "error", error: msg });
        await sb.from("google_sweeps").upsert({
          user_id: userId, account_id: a.id, source,
          last_run_at: new Date().toISOString(), status: "error", error: msg,
        }, { onConflict: "user_id,account_id,source" });
      }
    }
  }

  return { reports, ingested, elapsedMs: Date.now() - started, partial };
}

// ── Analyzers ──────────────────────────────────────────────────────────────
// Every analyzer reads stored rows and emits findings. No model, no guessing.

export interface InsightRow {
  user_id: string;
  domain: string;
  code: string;
  subject_key: string;
  severity: number;
  title: string;
  detail: string;
  metric: Record<string, unknown>;
  evidence: unknown[];
}

interface LedgerRow {
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
const num = (v: unknown) => (v == null ? null : Number(v));
const ts = (s: string | null) => (s ? Date.parse(s) : NaN);
const domainOf = (e: string | null) => (e ?? "").split("@")[1] ?? "";

const SECURITY_CUES =
  /\b(security alert|new sign-?in|suspicious|password (was )?(changed|reset)|verify your|data breach|2-?step|unusual activity|account (was )?(locked|compromised))\b/i;
const RECEIPT_CUES =
  /\b(receipt|invoice|payment|subscription|renewal|billed|charged|order confirm|your plan)\b/i;
const ASK_CUES =
  /\?|\b(can you|could you|please|need(ed)? (this|it|by)|let me know|waiting on|follow(ing)? up|by (monday|tuesday|wednesday|thursday|friday|eod|tomorrow))\b/i;

/**
 * Run the full analyzer battery. Returns findings ready to upsert; the caller
 * decides persistence so this stays pure and unit-testable.
 */
export function analyze(userId: string, rows: LedgerRow[], nowMs = Date.now()): InsightRow[] {
  const out: InsightRow[] = [];
  const mail = rows.filter((r) => r.source === "gmail");
  const events = rows.filter((r) => r.source === "calendar");
  const files = rows.filter((r) => r.source === "drive");
  const contacts = rows.filter((r) => r.source === "contacts");
  const tasks = rows.filter((r) => r.source === "tasks");

  const push = (i: Omit<InsightRow, "user_id">) => out.push({ user_id: userId, ...i });

  // 1 ── Recurring spend. A vendor charging on a cadence is a subscription,
  // whatever it calls itself. Requires ≥2 charges to avoid one-off noise.
  {
    const byVendor = new Map<string, LedgerRow[]>();
    for (const m of mail) {
      if (num(m.amount) == null) continue;
      if (!RECEIPT_CUES.test(`${m.subject ?? ""} ${m.snippet ?? ""}`)) continue;
      const d = domainOf(m.actor_email);
      if (!d) continue;
      (byVendor.get(d) ?? byVendor.set(d, []).get(d)!).push(m);
    }
    for (const [vendor, hits] of byVendor) {
      if (hits.length < 2) continue;
      const sorted = hits.slice().sort((a, b) => ts(a.occurred_at) - ts(b.occurred_at));
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const g = (ts(sorted[i].occurred_at) - ts(sorted[i - 1].occurred_at)) / DAY;
        if (Number.isFinite(g) && g > 0) gaps.push(g);
      }
      const cadence = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
      const amounts = sorted.map((h) => Number(h.amount)).filter(Number.isFinite);
      const total = amounts.reduce((a, b) => a + b, 0);
      const last = sorted[sorted.length - 1];
      const nextDue = cadence ? new Date(ts(last.occurred_at) + cadence * DAY).toISOString() : null;
      push({
        domain: "financial",
        code: "recurring_charge",
        subject_key: vendor,
        severity: total > 500 ? 4 : 2,
        title: `Recurring charge — ${vendor}`,
        detail: `${hits.length} charges observed totalling ${last.currency ?? "USD"} ${total.toFixed(2)}` +
          (cadence ? `, roughly every ${Math.round(cadence)} days.` : ".") +
          (nextDue ? ` Next charge projected ${nextDue.slice(0, 10)}.` : ""),
        metric: {
          vendor, charges: hits.length, total: Number(total.toFixed(2)),
          currency: last.currency ?? "USD",
          cadenceDays: cadence ? Math.round(cadence) : null,
          lastCharge: last.occurred_at, nextProjected: nextDue,
        },
        evidence: sorted.slice(-6).map((h) => ({ id: h.id, subject: h.subject, at: h.occurred_at })),
      });
    }
  }

  // 2 ── Unanswered inbound. A direct ask, addressed to few people, with no
  // outbound to that correspondent afterwards. Bulk mail is excluded.
  {
    const lastOutboundTo = new Map<string, number>();
    for (const m of mail) {
      if (m.direction !== "out") continue;
      for (const c of m.counterparties ?? []) {
        const t = ts(m.occurred_at);
        if (Number.isFinite(t)) lastOutboundTo.set(c, Math.max(lastOutboundTo.get(c) ?? 0, t));
      }
    }
    for (const m of mail) {
      if (m.direction !== "in") continue;
      if (m.metadata?.bulk) continue;
      if ((m.counterparties?.length ?? 0) > 4) continue;
      const at = ts(m.occurred_at);
      if (!Number.isFinite(at)) continue;
      const ageH = (nowMs - at) / 36e5;
      if (ageH < 48 || ageH > 24 * 45) continue;
      if (!ASK_CUES.test(`${m.subject ?? ""} ${m.snippet ?? ""}`)) continue;
      const replied = (lastOutboundTo.get(m.actor_email ?? "") ?? 0) > at;
      if (replied) continue;
      push({
        domain: "relationship",
        code: "unanswered_inbound",
        subject_key: m.id,
        severity: ageH > 24 * 7 ? 4 : 3,
        title: `Unanswered: ${m.actor_name || m.actor_email}`,
        detail: `"${clip(m.subject, 140)}" arrived ${Math.round(ageH / 24)} day(s) ago and no reply left your accounts.`,
        metric: { from: m.actor_email, ageDays: Math.round(ageH / 24), account: m.account_email },
        evidence: [{ id: m.id, subject: m.subject, at: m.occurred_at }],
      });
    }
  }

  // 3 ── Fading relationships. Someone who used to be frequent has gone quiet
  // for more than three times their own historical cadence.
  {
    const byPerson = new Map<string, number[]>();
    for (const m of mail) {
      const t = ts(m.occurred_at);
      const who = m.direction === "out" ? (m.counterparties ?? [])[0] : m.actor_email;
      if (!who || !Number.isFinite(t) || m.metadata?.bulk) continue;
      (byPerson.get(who) ?? byPerson.set(who, []).get(who)!).push(t);
    }
    for (const [person, times] of byPerson) {
      if (times.length < 4) continue;
      times.sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY);
      const cadence = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const silence = (nowMs - times[times.length - 1]) / DAY;
      if (cadence <= 0 || silence < Math.max(21, cadence * 3)) continue;
      push({
        domain: "relationship",
        code: "relationship_fade",
        subject_key: person,
        severity: 2,
        title: `Contact fading — ${person}`,
        detail: `${times.length} exchanges at roughly ${Math.round(cadence)}-day cadence, then ${Math.round(silence)} days of silence.`,
        metric: { person, exchanges: times.length, cadenceDays: Math.round(cadence), silentDays: Math.round(silence) },
        evidence: [],
      });
    }
  }

  // 4 ── Security posture. Provider-issued alerts are surfaced verbatim.
  {
    const alerts = mail.filter((m) =>
      m.direction === "in" && SECURITY_CUES.test(`${m.subject ?? ""} ${m.snippet ?? ""}`));
    if (alerts.length) {
      const recent = alerts.slice().sort((a, b) => ts(b.occurred_at) - ts(a.occurred_at)).slice(0, 8);
      push({
        domain: "security",
        code: "security_alerts",
        subject_key: "inbox",
        severity: 5,
        title: `${alerts.length} security-shaped notice(s) in the ledger`,
        detail: recent.map((r) => `• ${r.occurred_at?.slice(0, 10) ?? "?"} — ${clip(r.subject, 120)} (${r.actor_email})`).join("\n"),
        metric: { count: alerts.length, senders: [...new Set(recent.map((r) => r.actor_email))] },
        evidence: recent.map((r) => ({ id: r.id, subject: r.subject, at: r.occurred_at })),
      });
    }
  }

  // 5 ── Publicly shared Drive files. The single highest-value exposure signal.
  {
    const exposed = files.filter((f) => f.metadata?.publiclyShared);
    if (exposed.length) {
      push({
        domain: "security",
        code: "drive_public_exposure",
        subject_key: "drive",
        severity: 5,
        title: `${exposed.length} file(s) shared beyond your account`,
        detail: exposed.slice(0, 10).map((f) => `• ${clip(f.subject, 90)}`).join("\n"),
        metric: { count: exposed.length },
        evidence: exposed.slice(0, 10).map((f) => ({ id: f.id, name: f.subject, link: f.metadata?.link })),
      });
    }
    const stale = files.filter((f) => {
      const t = ts(f.occurred_at);
      return Number.isFinite(t) && nowMs - t > 180 * DAY && f.metadata?.shared;
    });
    if (stale.length >= 3) {
      push({
        domain: "security",
        code: "drive_stale_shares",
        subject_key: "drive",
        severity: 3,
        title: `${stale.length} shared file(s) untouched for 6+ months`,
        detail: "Shares outlive their purpose. These are still reachable by their collaborators.",
        metric: { count: stale.length },
        evidence: stale.slice(0, 10).map((f) => ({ id: f.id, name: f.subject, at: f.occurred_at })),
      });
    }
  }

  // 6 ── Time audit + meeting load, measured over the trailing 28 days.
  {
    const win = events.filter((e) => {
      const t = ts(e.occurred_at);
      return Number.isFinite(t) && t <= nowMs && nowMs - t <= 28 * DAY;
    });
    if (win.length) {
      const minutes = win.reduce((a, e) => a + (Number(e.metadata?.minutes) || 0), 0);
      const hours = minutes / 60;
      const perWeek = hours / 4;
      push({
        domain: "productivity",
        code: "meeting_load",
        subject_key: "28d",
        severity: perWeek > 20 ? 4 : 2,
        title: `${perWeek.toFixed(1)} meeting hours per week`,
        detail: `${win.length} events over 28 days consumed ${hours.toFixed(1)} hours. ` +
          (perWeek > 20
            ? "That is past the threshold where deep work collapses into coordination."
            : "Within a sustainable coordination budget."),
        metric: { events: win.length, hours: Number(hours.toFixed(1)), hoursPerWeek: Number(perWeek.toFixed(1)) },
        evidence: [],
      });
    }

    // Forward-looking conflicts — overlapping confirmed events.
    const future = events
      .filter((e) => ts(e.occurred_at) > nowMs && e.metadata?.status !== "cancelled")
      .sort((a, b) => ts(a.occurred_at) - ts(b.occurred_at));
    const conflicts: Array<[LedgerRow, LedgerRow]> = [];
    for (let i = 1; i < future.length; i++) {
      const prevEnd = Date.parse(String(future[i - 1].metadata?.end ?? ""));
      if (Number.isFinite(prevEnd) && ts(future[i].occurred_at) < prevEnd) {
        conflicts.push([future[i - 1], future[i]]);
      }
    }
    if (conflicts.length) {
      push({
        domain: "productivity",
        code: "calendar_conflicts",
        subject_key: "upcoming",
        severity: 4,
        title: `${conflicts.length} upcoming double-booking(s)`,
        detail: conflicts.slice(0, 6).map(([a, b]) =>
          `• ${a.occurred_at?.slice(0, 16).replace("T", " ")} — "${clip(a.subject, 60)}" overlaps "${clip(b.subject, 60)}"`).join("\n"),
        metric: { count: conflicts.length },
        evidence: conflicts.slice(0, 6).map(([a, b]) => ({ a: a.id, b: b.id })),
      });
    }
  }

  // 7 ── Network map: who actually occupies your attention.
  {
    const weight = new Map<string, { n: number; name: string; last: number }>();
    for (const m of mail) {
      if (m.metadata?.bulk) continue;
      const who = m.direction === "out" ? (m.counterparties ?? [])[0] : m.actor_email;
      if (!who) continue;
      const cur = weight.get(who) ?? { n: 0, name: m.actor_name ?? who, last: 0 };
      cur.n += m.direction === "out" ? 2 : 1; // effort you spend counts double
      cur.last = Math.max(cur.last, ts(m.occurred_at) || 0);
      weight.set(who, cur);
    }
    const top = [...weight.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    if (top.length) {
      push({
        domain: "network",
        code: "inner_ring",
        subject_key: "top",
        severity: 1,
        title: `Inner ring — ${top.length} dominant correspondents`,
        detail: top.map(([e, v], i) => `${i + 1}. ${v.name} <${e}> — weight ${v.n}`).join("\n"),
        metric: {
          people: top.map(([e, v]) => ({
            email: e, name: v.name, weight: v.n,
            lastContact: v.last ? new Date(v.last).toISOString() : null,
          })),
        },
        evidence: [],
      });
    }
  }

  // 8 ── Declared vs observed graph. Contacts you never talk to, and people
  // you talk to constantly who were never saved.
  {
    const known = new Set<string>();
    for (const c of contacts) for (const e of c.counterparties ?? []) known.add(e);
    const observed = new Map<string, number>();
    for (const m of mail) {
      if (m.metadata?.bulk || !m.actor_email) continue;
      observed.set(m.actor_email, (observed.get(m.actor_email) ?? 0) + 1);
    }
    const ghosts = [...observed.entries()]
      .filter(([e, n]) => n >= 5 && !known.has(e))
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (ghosts.length) {
      push({
        domain: "network",
        code: "unsaved_frequent",
        subject_key: "graph",
        severity: 2,
        title: `${ghosts.length} frequent correspondent(s) missing from Contacts`,
        detail: ghosts.map(([e, n]) => `• ${e} — ${n} messages, no contact card`).join("\n"),
        metric: { people: ghosts.map(([email, count]) => ({ email, count })) },
        evidence: [],
      });
    }
  }

  // 9 ── Open commitments: overdue tasks and dated asks still standing.
  {
    const overdue = tasks.filter((t) =>
      t.metadata?.status !== "completed" && Number.isFinite(ts(String(t.metadata?.due ?? ""))) &&
      Date.parse(String(t.metadata?.due)) < nowMs);
    if (overdue.length) {
      push({
        domain: "commitment",
        code: "overdue_tasks",
        subject_key: "tasks",
        severity: 3,
        title: `${overdue.length} overdue task(s)`,
        detail: overdue.slice(0, 10).map((t) =>
          `• ${String(t.metadata?.due).slice(0, 10)} — ${clip(t.subject, 90)}`).join("\n"),
        metric: { count: overdue.length },
        evidence: overdue.slice(0, 10).map((t) => ({ id: t.id, title: t.subject, due: t.metadata?.due })),
      });
    }
  }

  // 10 ── Coverage. Honesty about what the ledger does and does not contain.
  {
    const bySource = new Map<string, number>();
    for (const r of rows) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
    const oldest = rows.map((r) => ts(r.occurred_at)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    push({
      domain: "coverage",
      code: "ledger_coverage",
      subject_key: "all",
      severity: 1,
      title: `Ledger holds ${rows.length} signals`,
      detail: [...bySource.entries()].map(([s, n]) => `• ${s}: ${n}`).join("\n"),
      metric: {
        total: rows.length,
        bySource: Object.fromEntries(bySource),
        oldest: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
      },
      evidence: [],
    });
  }

  return out;
}

/** Persist findings idempotently and retire ones that no longer reproduce. */
export async function persistInsights(
  sb: SupabaseClient, userId: string, insights: InsightRow[],
): Promise<number> {
  const stamped = insights.map((i) => ({ ...i, computed_at: new Date().toISOString() }));
  for (let i = 0; i < stamped.length; i += 100) {
    const { error } = await sb
      .from("google_insights")
      .upsert(stamped.slice(i, i + 100), { onConflict: "user_id,code,subject_key" });
    if (error) throw new Error(error.message);
  }
  // Anything not re-emitted by this pass is stale evidence, not a live finding.
  const keep = new Set(stamped.map((s) => `${s.code}|${s.subject_key}`));
  const { data: existing } = await sb
    .from("google_insights").select("id, code, subject_key").eq("user_id", userId);
  const dead = (existing ?? [])
    .filter((r: any) => !keep.has(`${r.code}|${r.subject_key}`))
    .map((r: any) => r.id);
  for (let i = 0; i < dead.length; i += 100) {
    await sb.from("google_insights").delete().in("id", dead.slice(i, i + 100));
  }
  return stamped.length;
}
