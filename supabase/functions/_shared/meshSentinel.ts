// ═══════════════════════════════════════════════════════════════════════════
// MESH SENTINEL — every inbound contact becomes a standing intelligence file
//
// The vault's first generation only swept people the user already had a
// *relationship* with: two or more messages, a reciprocity score, a saved
// address-book card. That is exactly backwards for threat work. The subject
// who matters most is the one who just reached you for the FIRST time — the
// cold sender, the unknown number on a contact card, the stranger who put a
// meeting on your calendar. Those were all discarded as "only 1 message".
//
// The sentinel closes that hole. It watches four channels:
//
//   inbound_mail  first-contact senders since the last watermark
//   calendar      organizers and attendees who put time on your calendar
//   phone_book    cards whose only identifier is a phone number
//   address_book  saved cards (handled by the existing contact selector)
//
// Every channel yields the same target shape, keyed so one human can never be
// queued twice under two channels, and carrying the identifiers (phone,
// alternate emails, employer) the dossier builder uses to seed reverse
// lookups. Selection is deterministic; nothing here calls a model.
// ═══════════════════════════════════════════════════════════════════════════

import type { MailHeader, ContactRecord } from "./googleMesh.ts";
import { parseAddr } from "./googleMesh.ts";
import { isMachineAddress, looksHuman, normKey } from "./meshDossier.ts";

export type ContactChannel = "inbound_mail" | "calendar" | "phone_book" | "address_book";

export interface ChannelTarget {
  key: string;
  email: string | null;
  name: string;
  channel: ContactChannel;
  priority: number;
  /** Identifiers handed to the dossier builder for reverse lookup. */
  identifiers: string[];
  locationHint: string | null;
  reason: string;
  /** Verbatim first-party facts, persisted on the dossier row. */
  profile: Record<string, unknown>;
  /**
   * Every channel this same human arrived on. Per-channel first contact is a
   * weak signal on its own; the same stranger appearing cold on two separate
   * channels inside one sweep is the strong one, and it used to dissolve into
   * whichever half-signal happened to win the merge.
   */
  channels?: ContactChannel[];
  /** True once two or more distinct channels resolved to this subject. */
  crossChannel?: boolean;
}

/**
 * Priority uplift for a subject that appears cold on more than one channel.
 * Two channels is a coincidence worth ranking above a single-channel stranger;
 * three or more is a person deliberately reaching you through every surface
 * they can find, which is the highest-value cold signal the sentinel produces.
 */
function crossChannelUplift(channelCount: number): number {
  if (channelCount >= 3) return 30;
  if (channelCount === 2) return 15;
  return 0;
}


// ── Phone normalization ────────────────────────────────────────────────────

/**
 * Normalize to a dialable, comparable string. Extensions, punctuation and
 * vanity spacing are stripped, because "+1 (239) 555-0142 x12" and
 * "12395550142" are one identifier, not two.
 *
 * A bare 10-digit number carries no country code, so the caller must say which
 * country to assume. Defaulting to +1 silently mangles every non-NANP number,
 * so `defaultCc` is explicit and a number is rejected rather than guessed when
 * it is ambiguous and no default was supplied.
 */
export function normalizePhone(raw: string, defaultCc: string | null = "1"): string | null {
  // Word boundaries fail on "0142x12" (digit→x is not a boundary), so match the
  // extension as a trailing suffix instead of relying on \b.
  const s = String(raw ?? "").replace(/[\s,;-]*(?:x|ext\.?|extension)\s*\d+\s*$/i, "");
  const plus = s.trim().startsWith("+");
  const digits = s.replace(/\D+/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (plus) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return defaultCc ? `+${defaultCc}${digits}` : null;
  // 7-9 digits with no country code is a local fragment: not a stable identity.
  if (digits.length < 10) return null;
  return `+${digits}`;
}

/** "+12395550142" → "(239) 555-0142" for report surfaces. */
export function displayPhone(e164: string): string {
  const d = e164.replace(/\D+/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

// ── Channel 1: first-contact inbound mail ──────────────────────────────────

export interface CalendarPerson {
  email: string;
  name: string;
  events: number;
  lastAt: string;
  organizer: boolean;
  locations: string[];
}

/**
 * A stranger who writes to you once is the highest-value unswept subject in
 * the mailbox: no history to lean on, and a decision to make about them right
 * now. `selectTargets` explicitly drops them (`minTotal = 2`, "never answered
 * — broadcast"), so they are recovered here instead, priority-weighted by
 * recency because a cold contact decays fast in usefulness.
 */
export function selectColdInbound(
  headers: MailHeader[],
  selfEmails: string[],
  alreadyKeyed: Set<string>,
  opts: { max?: number; sinceMs?: number; knownCorrespondents?: Set<string> } = {},
): { targets: ChannelTarget[]; skipped: Array<{ email: string; reason: string }> } {
  const max = Math.min(Math.max(opts.max ?? 20, 1), 60);
  const since = opts.sinceMs ?? 0;
  const self = new Set(selfEmails.map((e) => e.toLowerCase()));
  // The Gmail query is bounded by the watermark, so the harvest alone cannot
  // prove a sender is new — it can only prove they appeared in this window.
  // Prior correspondents are supplied by the caller; without that set the
  // claim is downgraded rather than asserted.
  const known = opts.knownCorrespondents ?? null;
  const skipped: Array<{ email: string; reason: string }> = [];

  interface Agg { email: string; name: string; count: number; lastAt: number; subjects: string[] }
  const agg = new Map<string, Agg>();

  for (const h of headers) {
    if (h.outbound || h.at < since) continue;
    const { email, name } = parseAddr(h.from);
    if (!email.includes("@") || self.has(email)) continue;
    const rec = agg.get(email) ?? { email, name, count: 0, lastAt: 0, subjects: [] };
    rec.count++;
    if (h.at > rec.lastAt) { rec.lastAt = h.at; rec.name = name || rec.name; }
    if (rec.subjects.length < 3 && h.subject) rec.subjects.push(h.subject.slice(0, 120));
    agg.set(email, rec);
  }

  const targets: ChannelTarget[] = [];
  for (const rec of agg.values()) {
    const key = rec.email.toLowerCase();
    if (alreadyKeyed.has(key)) { skipped.push({ email: rec.email, reason: "already a subject" }); continue; }
    if (isMachineAddress(rec.email)) { skipped.push({ email: rec.email, reason: "automated sender" }); continue; }
    if (!looksHuman(rec.name)) { skipped.push({ email: rec.email, reason: "no human name on the header" }); continue; }

    // Fresh contact outranks stale contact; a second message inside the window
    // is a small confirmation bonus, not a volume score.
    const ageDays = Math.max(0, (Date.now() - rec.lastAt) / 86400000);
    const priorHistory = known ? known.has(key) : null;
    const priority = Math.round(
      Math.min(100, 62 + Math.min(18, (rec.count - 1) * 6) + 20 / (1 + ageDays / 7)
        // A sender with history is a known quantity: real, but less urgent
        // than a stranger who just appeared.
        - (priorHistory === true ? 14 : 0)),
    );

    targets.push({
      key,
      email: rec.email,
      name: rec.name,
      channel: "inbound_mail",
      priority,
      identifiers: [],
      locationHint: null,
      reason: priorHistory === false
        ? `first contact · ${rec.count} inbound message(s) · ${Math.round(ageDays)}d ago`
        : `inbound · ${rec.count} message(s) in watch window · ${Math.round(ageDays)}d ago`,
      profile: {
        source: "inbound_mail",
        // Only asserted when the caller supplied history to check it against.
        firstContact: priorHistory === false,
        priorHistoryChecked: priorHistory !== null,
        inboundCount: rec.count,
        lastAt: new Date(rec.lastAt).toISOString(),
        subjects: rec.subjects,
        domain: rec.email.split("@")[1] ?? null,
      },
    });
  }

  targets.sort((a, b) => b.priority - a.priority);
  return { targets: targets.slice(0, max), skipped };
}

// ── Channel 2: calendar counterparties ─────────────────────────────────────

/**
 * Someone who books time with you has asserted a stronger claim than someone
 * who mails you: they expect to be in a room with you. Organizers outrank
 * co-attendees, and a recurring counterparty outranks a one-off.
 */
export function selectCalendarTargets(
  people: CalendarPerson[],
  alreadyKeyed: Set<string>,
  opts: { max?: number } = {},
): { targets: ChannelTarget[]; skipped: Array<{ email: string; reason: string }> } {
  const max = Math.min(Math.max(opts.max ?? 20, 1), 60);
  const skipped: Array<{ email: string; reason: string }> = [];
  const targets: ChannelTarget[] = [];

  for (const p of people) {
    const key = p.email.toLowerCase();
    if (alreadyKeyed.has(key)) { skipped.push({ email: p.email, reason: "already a subject" }); continue; }
    if (isMachineAddress(p.email)) { skipped.push({ email: p.email, reason: "automated invite address" }); continue; }
    if (!looksHuman(p.name)) { skipped.push({ email: p.email, reason: "no human name on the invite" }); continue; }

    const priority = Math.round(
      Math.min(100, 55 + (p.organizer ? 18 : 6) + Math.min(20, p.events * 5)),
    );
    targets.push({
      key,
      email: p.email,
      name: p.name,
      channel: "calendar",
      priority,
      identifiers: [],
      // A shared physical meeting place is the strongest jurisdiction hint the
      // mesh can produce without asking the user anything.
      locationHint: p.locations[0] ?? null,
      reason: `${p.organizer ? "organized" : "attended"} ${p.events} meeting(s) with you`,
      profile: {
        source: "calendar",
        events: p.events,
        organizer: p.organizer,
        lastAt: p.lastAt,
        locations: p.locations.slice(0, 3),
      },
    });
  }

  targets.sort((a, b) => b.priority - a.priority);
  return { targets: targets.slice(0, max), skipped };
}

// ── Channel 3: phone-only cards ────────────────────────────────────────────

/**
 * A card with a number and no address is invisible to an email-keyed vault.
 * It is keyed here on the normalized number so the same human saved twice
 * under two spellings of a name collapses to one subject, and the number is
 * carried through as a reverse-lookup seed.
 */
export function selectPhoneTargets(
  contacts: ContactRecord[],
  alreadyKeyed: Set<string>,
  opts: { max?: number; defaultCc?: string | null } = {},
): { targets: ChannelTarget[]; skipped: Array<{ email: string; reason: string }> } {
  const max = Math.min(Math.max(opts.max ?? 30, 1), 90);
  const cc = opts.defaultCc === undefined ? "1" : opts.defaultCc;
  const skipped: Array<{ email: string; reason: string }> = [];
  const targets: ChannelTarget[] = [];
  const seen = new Set<string>();

  for (const c of contacts) {
    // Point-free .map() would feed the array index in as defaultCc.
    const phones = c.phones.map((raw) => normalizePhone(raw, cc)).filter((p): p is string => !!p);
    if (!phones.length) continue;
    // Cards that also carry an email are already claimed by the address-book
    // selector; sweeping them here would duplicate the same human.
    if (c.emails.some((e) => alreadyKeyed.has(e.toLowerCase()))) continue;
    if (c.emails.length) continue;

    const key = `phone:${phones[0]}`;
    if (alreadyKeyed.has(key) || seen.has(key)) { skipped.push({ email: phones[0], reason: "already a subject" }); continue; }
    if (!looksHuman(c.name)) { skipped.push({ email: phones[0], reason: "not a personal name" }); continue; }
    seen.add(key);

    targets.push({
      key,
      email: null,
      name: c.name,
      channel: "phone_book",
      priority: Math.round(Math.min(100, 44 + phones.length * 10 + c.addresses.length * 12 + (c.org ? 8 : 0))),
      identifiers: phones.slice(0, 2),
      locationHint: hintFromAddress(c.addresses[0] ?? ""),
      reason: `phone-only card · ${phones.map(displayPhone).join(", ")}`,
      profile: {
        source: "phone_book",
        phones,
        org: c.org,
        title: c.title,
        addresses: c.addresses,
      },
    });
  }

  targets.sort((a, b) => b.priority - a.priority);
  return { targets: targets.slice(0, max), skipped };
}

/** "1234 Elm St, Cape Coral, FL 33904, USA" → "Cape Coral FL" */
function hintFromAddress(addr: string): string | null {
  const parts = String(addr ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const city = parts[parts.length - 3] ?? parts[0];
  const region = (parts[parts.length - 2] ?? "").replace(/\s*\d{4,}.*$/, "").trim();
  const hint = [city, region].filter(Boolean).join(" ").slice(0, 60);
  return hint.length >= 4 ? hint : null;
}

/**
 * Collapse channels that describe the same human — and only then.
 *
 * Matching on the name alone merges two different people who happen to share
 * one, which is a false identity claim and the worst failure this file can
 * produce. A merge is therefore allowed only when the evidence supports it:
 * identical address, or a shared name where at most one side carries an
 * address (a phone card folding into its mail identity). Two same-named
 * subjects with two different addresses stay two subjects.
 */
export function dedupeByIdentity(targets: ChannelTarget[]): ChannelTarget[] {
  const byEmail = new Map<string, ChannelTarget>();
  const byName = new Map<string, ChannelTarget[]>();
  const out: ChannelTarget[] = [];

  const absorb = (into: ChannelTarget, from: ChannelTarget) => {
    into.identifiers = [...new Set([...into.identifiers, ...from.identifiers])].slice(0, 4);
    into.locationHint = into.locationHint ?? from.locationHint;
    into.email = into.email ?? from.email;
    into.profile = { ...from.profile, ...into.profile, mergedFrom: from.channel };

    // CROSS-CHANNEL FIRST CONTACT. The merge used to keep the higher of two
    // priorities and drop the fact that two different surfaces produced this
    // stranger — so a cold emailer who also appeared on a calendar invite
    // ranked exactly like a cold emailer who did not. The channel set is now
    // carried, and the subject is re-scored on the breadth of the approach,
    // not just on the strongest single channel.
    const channels = [...new Set([
      ...(into.channels ?? [into.channel]),
      ...(from.channels ?? [from.channel]),
    ])];
    into.channels = channels;
    into.crossChannel = channels.length > 1;
    into.priority = Math.min(
      100,
      Math.max(into.priority, from.priority) + crossChannelUplift(channels.length),
    );
    into.reason = into.crossChannel
      ? `${into.reason} · cross-channel first contact on ${channels.join(" + ")}`
      : `${into.reason} · also ${from.channel}`;
  };

  for (const t of [...targets].sort((a, b) => b.priority - a.priority)) {
    t.channels = t.channels ?? [t.channel];
    t.crossChannel = t.crossChannel ?? false;
    const em = t.email?.toLowerCase() ?? null;
    if (em) {
      const prev = byEmail.get(em);
      if (prev) { absorb(prev, t); continue; }
    }
    const nk = normKey(t.name);
    const siblings = byName.get(nk) ?? [];
    // Fold only into a same-named sibling whose address does not contradict.
    const foldInto = siblings.find((s) => !s.email || !em);
    if (foldInto) { absorb(foldInto, t); continue; }

    out.push(t);
    if (em) byEmail.set(em, t);
    byName.set(nk, [...siblings, t]);
  }

  return out.sort((a, b) => b.priority - a.priority);
}
