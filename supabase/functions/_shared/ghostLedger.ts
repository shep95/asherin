// ═══════════════════════════════════════════════════════════════════════════
// GHOST LEDGER — Cloud Intelligence ↔ Asherin Ghost Engine fusion
// ---------------------------------------------------------------------------
// Cloud Intelligence knows WHO touched the operator: every email, every text,
// every calendar invite, normalised into google_signals. The Ghost Engine
// knows WHAT the infrastructure behind a target actually is: transport, DNS,
// ASN, geography, container shells, redirect topology.
//
// Neither half answers the operator's real question on its own. The ledger can
// say "this address wrote you 14 times"; it cannot say the domain has no MX
// record, resolves in a jurisdiction the brand never operates from, and was
// first seen three days ago. Ghost can say all of that; it has no idea who is
// worth probing. This module is the join: the ledger nominates the targets,
// Ghost probes them, and every finding is carried back with the exact signal
// rows that produced it.
//
// Invariants:
//   • Read-only, RLS-scoped. Rows are read through the CALLER'S token — never
//     a service identity — so a bug here cannot cross tenants.
//   • Metadata only. No message body is fetched, stored, or probed. Ghost is
//     pointed at the *infrastructure* named in the ledger, never at Google.
//   • Bounded. Fixed host cap, fixed concurrency, wall-clock budget. A large
//     mailbox degrades to a partial sweep, never a platform timeout.
//   • Absence is a finding. A host that will not resolve is reported as such,
//     never silently dropped.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractGhostRecord, isPublicHttpUrl, pool, type GhostRecord } from "./ghostMetadata.ts";
import { buildIndex, type GhostIndex } from "./ghostIndex.ts";

/** Hosts the operator's own mail lives on: probing them teaches nothing. */
const SELF_HOSTS = new Set([
  "gmail.com", "googlemail.com", "google.com", "calendar.google.com",
  "drive.google.com", "mail.google.com", "youtube.com",
]);

/** Shorteners hide the true destination — always worth a probe, never trusted. */
const SHORTENERS = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "is.gd",
  "cutt.ly", "rb.gy", "rebrand.ly", "shorturl.at", "lnkd.in", "t.ly", "s.id",
]);

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const EMAIL_RE = /\b[\w.+-]+@([\w-]+(?:\.[\w-]+)+)\b/g;

export interface LedgerSignal {
  id: string;
  source: string;
  kind: string | null;
  occurred_at: string | null;
  actor_email: string | null;
  actor_name: string | null;
  direction: string | null;
  subject: string | null;
  snippet: string | null;
  counterparties: string[] | null;
  metadata: Record<string, unknown> | null;
  account_email: string | null;
}

export interface LedgerTarget {
  host: string;
  url: string;
  /** How the ledger nominated this host. */
  origin: "sender_domain" | "embedded_link" | "shortener";
  messages: number;
  inbound: number;
  outbound: number;
  channels: string[];
  senders: string[];
  /** Phone counterparties that carried this host (SMS smishing infrastructure). */
  phones: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  sampleSubjects: string[];
  signalIds: string[];
}

export interface CorrespondentVerdict extends LedgerTarget {
  reachable: boolean;
  status: number | null;
  server: string | null;
  tls: boolean;
  hsts: boolean;
  originIp: string | null;
  asn: string | null;
  geo: string | null;
  mx: string[];
  ns: string[];
  redirects: string[];
  /** 0–100. Higher = the infrastructure disagrees with the correspondence. */
  risk: number;
  reasons: string[];
  entityId: string | null;
}

export interface GhostLedgerBundle {
  scanned: number;
  windowDays: number;
  hostsConsidered: number;
  hostsProbed: number;
  correspondents: CorrespondentVerdict[];
  index: GhostIndex;
  partial: boolean;
  elapsedMs: number;
}

const registrable = (host: string): string => {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : parts.join(".");
};

const isProbeableHost = (host: string): boolean =>
  /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) && !SELF_HOSTS.has(registrable(host));

/** Cheap edit distance, capped — used only for lookalike detection. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = cur;
    }
  }
  return prev[b.length];
}

// ── 1. NOMINATION ──────────────────────────────────────────────────────────
/** Fold the ledger into a ranked list of hosts worth probing. */
export function collectLedgerTargets(rows: LedgerSignal[], cap = 18): LedgerTarget[] {
  const byHost = new Map<string, LedgerTarget>();

  const touch = (host: string, origin: LedgerTarget["origin"], r: LedgerSignal, url?: string) => {
    if (!isProbeableHost(host)) return;
    const key = host.toLowerCase().replace(/^www\./, "");
    const t = byHost.get(key) ?? {
      host: key,
      url: url ?? `https://${key}/`,
      origin,
      messages: 0, inbound: 0, outbound: 0,
      channels: [], senders: [], phones: [],
      firstSeen: null, lastSeen: null, sampleSubjects: [], signalIds: [],
    };
    // A shortener nomination outranks a plain sender-domain nomination: the
    // destination it conceals is the whole reason to look.
    if (origin === "shortener") { t.origin = "shortener"; if (url) t.url = url; }
    t.messages++;
    if (r.direction === "inbound") t.inbound++;
    else if (r.direction === "outbound") t.outbound++;
    if (r.source && !t.channels.includes(r.source)) t.channels.push(r.source);
    if (r.actor_email && !t.senders.includes(r.actor_email) && t.senders.length < 8) t.senders.push(r.actor_email);
    if (r.source === "sms" && r.actor_email && /^\+?\d[\d\s()-]{5,}$/.test(r.actor_email) && !t.phones.includes(r.actor_email)) {
      t.phones.push(r.actor_email);
    }
    const at = r.occurred_at;
    if (at) {
      if (!t.firstSeen || at < t.firstSeen) t.firstSeen = at;
      if (!t.lastSeen || at > t.lastSeen) t.lastSeen = at;
    }
    if (r.subject && t.sampleSubjects.length < 3) t.sampleSubjects.push(r.subject.slice(0, 120));
    if (t.signalIds.length < 25) t.signalIds.push(r.id);
    byHost.set(key, t);
  };

  for (const r of rows) {
    // Sender identity — the address that actually corresponded.
    const addrPool = [r.actor_email ?? "", ...(r.counterparties ?? [])].join(" ");
    EMAIL_RE.lastIndex = 0;
    for (const m of addrPool.matchAll(EMAIL_RE)) touch(m[1], "sender_domain", r);

    // Links carried inside the correspondence — subject, snippet, metadata.
    const text = [r.subject ?? "", r.snippet ?? "", JSON.stringify(r.metadata ?? {})].join(" ");
    URL_RE.lastIndex = 0;
    for (const raw of text.match(URL_RE) ?? []) {
      const safe = isPublicHttpUrl(raw);
      if (!safe) continue;
      let host: string;
      try { host = new URL(safe).hostname; } catch { continue; }
      touch(host, SHORTENERS.has(registrable(host)) ? "shortener" : "embedded_link", r, safe);
    }
  }

  // Rank: concealed destinations first, then volume, then recency. A shortener
  // seen once matters more than a newsletter seen forty times.
  const weight = (t: LedgerTarget) =>
    (t.origin === "shortener" ? 1000 : 0) +
    (t.origin === "embedded_link" ? 50 : 0) +
    Math.min(t.messages, 40) +
    (t.inbound > 0 ? 10 : 0);

  return [...byHost.values()]
    .sort((a, b) => weight(b) - weight(a) || String(b.lastSeen).localeCompare(String(a.lastSeen)))
    .slice(0, cap);
}

// ── 2. ADJUDICATION ────────────────────────────────────────────────────────
/** Join one probe back onto its ledger nomination and score the disagreement. */
export function adjudicate(t: LedgerTarget, rec: GhostRecord | null, peers: string[]): CorrespondentVerdict {
  const reasons: string[] = [];
  let risk = 0;

  const reachable = !!rec && rec.status != null && rec.status < 500;
  if (!rec || !reachable) {
    risk += 30;
    reasons.push("Host did not answer a probe — correspondence arrived from infrastructure that will not identify itself.");
  }
  if (t.origin === "shortener") {
    risk += 35;
    reasons.push("Destination was concealed behind a link shortener.");
  }
  if (rec && !rec.tls) { risk += 20; reasons.push("No TLS on the origin."); }
  if (rec && rec.tls && !rec.hsts) { risk += 5; reasons.push("TLS present but HSTS absent."); }
  if (rec && !rec.dns?.mx?.length && t.origin === "sender_domain" && t.inbound > 0) {
    risk += 30;
    reasons.push("Domain sent mail but publishes no MX record — sender address cannot receive replies.");
  }
  if (rec?.redirect_chain?.length) {
    const hops = new Set(rec.redirect_chain.map((u) => { try { return new URL(u).hostname; } catch { return u; } }));
    if (hops.size > 1) {
      risk += 15;
      reasons.push(`Redirect crosses ${hops.size} hosts: ${rec.redirect_chain.slice(0, 3).join(" → ")}`);
    }
  }
  if (rec && !rec.network_origin_ip) { risk += 10; reasons.push("Origin address unresolved."); }

  // Lookalike: a host one or two edits from a host the operator already trusts
  // is the classic display-name attack, and the ledger is what makes it legible.
  const base = registrable(t.host);
  for (const p of peers) {
    if (p === base) continue;
    const d = editDistance(base, p);
    if (d > 0 && d <= 2) {
      risk += 40;
      reasons.push(`Lookalike of a frequent correspondent domain (${p}, edit distance ${d}).`);
      break;
    }
  }

  const days = t.firstSeen ? (Date.now() - Date.parse(t.firstSeen)) / 86_400_000 : null;
  if (days != null && days < 7 && t.inbound > 0) {
    risk += 10;
    reasons.push("First contact within the last 7 days.");
  }
  if (!reasons.length) reasons.push("Infrastructure consistent with the correspondence observed.");

  return {
    ...t,
    reachable,
    status: rec?.status ?? null,
    server: rec?.server ?? null,
    tls: !!rec?.tls,
    hsts: !!rec?.hsts,
    originIp: rec?.network_origin_ip ?? null,
    asn: rec?.asn ?? null,
    geo: rec?.geo_label ?? null,
    mx: rec?.dns?.mx?.slice(0, 4) ?? [],
    ns: rec?.dns?.ns?.slice(0, 4) ?? [],
    redirects: rec?.redirect_chain?.slice(0, 4) ?? [],
    risk: Math.min(100, risk),
    reasons,
    entityId: rec?.entity_id ?? null,
  };
}

// ── 3. EXECUTION ───────────────────────────────────────────────────────────
export interface LedgerGhostOptions {
  windowDays?: number;
  /** Restrict to one channel — "gmail" for mail only, "sms" for phone only. */
  channel?: "gmail" | "sms" | null;
  /** Only correspondence touching this address / number / host. */
  focus?: string | null;
  maxHosts?: number;
  budgetMs?: number;
  rowLimit?: number;
}

/**
 * Run the fusion. `authHeader` is the caller's own bearer token: every ledger
 * read is RLS-scoped to them. Returns null when there is nothing to join.
 */
export async function runGhostLedger(
  authHeader: string,
  opts: LedgerGhostOptions = {},
): Promise<GhostLedgerBundle | null> {
  const started = Date.now();
  const windowDays = Math.max(1, Math.min(365, opts.windowDays ?? 90));
  const maxHosts = Math.max(1, Math.min(24, opts.maxHosts ?? 14));
  const budgetMs = opts.budgetMs ?? 55_000;
  const rowLimit = Math.max(50, Math.min(3000, opts.rowLimit ?? 1200));

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anon) return null;

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  let q = sb
    .from("google_signals")
    .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, counterparties, metadata, account_email")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(rowLimit);
  if (opts.channel) q = q.eq("source", opts.channel);
  if (opts.focus) {
    const f = opts.focus.replace(/[%,]/g, " ").trim().slice(0, 120);
    if (f) q = q.or(`actor_email.ilike.%${f}%,subject.ilike.%${f}%,snippet.ilike.%${f}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[ghostLedger] ledger read failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as LedgerSignal[];
  if (!rows.length) return null;

  const targets = collectLedgerTargets(rows, maxHosts * 2);
  if (!targets.length) return null;

  // Peer set for lookalike scoring: the domains this operator genuinely
  // corresponds with most. Computed before truncation so a rare impostor is
  // still measured against the common original.
  const peers = [...new Set(
    targets.filter((t) => t.origin === "sender_domain" && t.messages >= 3).map((t) => registrable(t.host)),
  )].slice(0, 40);

  const probeList = targets.slice(0, maxHosts);
  const deadline = started + budgetMs;
  const records = (await pool(probeList, 5, async (t: LedgerTarget) => {
    if (Date.now() > deadline) return null;
    try { return await extractGhostRecord(t.url, false); } catch { return null; }
  })) as Array<GhostRecord | null>;

  const correspondents = probeList
    .map((t, i) => adjudicate(t, records[i] ?? null, peers))
    .sort((a, b) => b.risk - a.risk || b.messages - a.messages);

  const clean = records.filter(Boolean) as GhostRecord[];
  for (const r of clean) delete r.payload;

  return {
    scanned: rows.length,
    windowDays,
    hostsConsidered: targets.length,
    hostsProbed: clean.length,
    correspondents,
    index: buildIndex(clean),
    partial: probeList.length < targets.length || clean.length < probeList.length,
    elapsedMs: Date.now() - started,
  };
}

// ── 4. NARRATION ───────────────────────────────────────────────────────────
/** Compact, model-legible rendering for chat context injection. */
export function formatGhostLedgerContext(b: GhostLedgerBundle | null): string {
  if (!b || !b.correspondents.length) return "";
  const lines: string[] = [
    "\n\n## GHOST LEDGER — CLOUD INTELLIGENCE RUN THROUGH THE GHOST ENGINE",
    `Scope: ${b.scanned} ledger signals over ${b.windowDays} days · ${b.hostsConsidered} distinct hosts nominated · ${b.hostsProbed} probed${b.partial ? " (partial — budget reached)" : ""} · ${b.elapsedMs}ms.`,
    "Every line below is observed infrastructure joined to correspondence the operator actually received. No message body was read.",
    "",
  ];
  for (const c of b.correspondents.slice(0, 12)) {
    lines.push(
      `### ${c.host} — risk ${c.risk}/100 (${c.origin.replace("_", " ")})`,
      `- Correspondence: ${c.messages} signals (${c.inbound} inbound / ${c.outbound} outbound) across ${c.channels.join(", ") || "unknown channel"}; ${c.firstSeen?.slice(0, 10) ?? "?"} → ${c.lastSeen?.slice(0, 10) ?? "?"}`,
      `- Senders: ${c.senders.slice(0, 4).join(", ") || "none recorded"}${c.phones.length ? ` · numbers: ${c.phones.slice(0, 3).join(", ")}` : ""}`,
      `- Transport: ${c.reachable ? `HTTP ${c.status}` : "unreachable"} · TLS ${c.tls ? "yes" : "no"} · HSTS ${c.hsts ? "yes" : "no"} · server ${c.server ?? "undisclosed"}`,
      `- Network: ${c.originIp ?? "unresolved"}${c.asn ? ` (${c.asn})` : ""}${c.geo ? ` — ${c.geo}` : ""} · MX ${c.mx.join(", ") || "none"} · NS ${c.ns.join(", ") || "none"}`,
      `- Findings: ${c.reasons.join(" ")}`,
      "",
    );
  }
  if (b.index.anomalies.length) {
    lines.push("### Ghost anomalies across the probed set");
    for (const a of b.index.anomalies.slice(0, 8)) {
      lines.push(`- [${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`);
    }
    lines.push("");
  }
  lines.push(
    "RULES: Report only what is listed. A missing field is a finding, not a gap to fill. Never claim any email or message body was read — only the infrastructure named inside the correspondence was probed.",
  );
  return lines.join("\n");
}

/** Turn-level intent: is the operator asking to run their ledger through Ghost? */
const LEDGER_GHOST = [
  /\b(run|push|send|check|analy[sz]e|sweep)\b[^.?!]{0,40}\b(my )?(emails?|inbox|messages?|texts?|sms|phone numbers?|contacts?|ledger|cloud intelligence)\b[^.?!]{0,40}\b(through|against|with|in)\b[^.?!]{0,20}\bghost\b/i,
  /\bghost (engine|ledger)\b[^.?!]{0,40}\b(my )?(emails?|inbox|messages?|texts?|sms|ledger|cloud intelligence)\b/i,
  /\b(who|what)\b[^.?!]{0,40}\b(hosting|infrastructure|servers?|domains?)\b[^.?!]{0,40}\b(email(?:ing|ed)? me|my inbox|texting me|messag(?:ing|ed) me)\b/i,
  /\b(spoof|phish|smish|impersonat|lookalike|typosquat)\w*\b[^.?!]{0,40}\b(email|inbox|message|text|domain)/i,
];

export interface GhostLedgerIntent {
  active: boolean;
  channel: "gmail" | "sms" | null;
  focus: string | null;
}

export function classifyGhostLedgerIntent(text: string): GhostLedgerIntent {
  const t = String(text ?? "").slice(0, 600);
  const active = LEDGER_GHOST.some((re) => re.test(t));
  const smsOnly = /\b(texts?|sms|phone numbers?|messages? on my phone)\b/i.test(t) && !/\bemails?|inbox\b/i.test(t);
  const mailOnly = /\b(emails?|inbox|gmail)\b/i.test(t) && !/\btexts?|sms\b/i.test(t);
  const focus = t.match(/"([^"]{3,60})"/)?.[1]
    ?? t.match(/\b([\w.+-]+@[\w.-]+\.\w+)\b/)?.[1]
    ?? null;
  return { active, channel: smsOnly ? "sms" : mailOnly ? "gmail" : null, focus: focus?.trim() || null };
}
