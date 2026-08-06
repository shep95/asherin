// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE SUBSTRATE CHAT BRIDGE
// ---------------------------------------------------------------------------
// The Mesh bridge calls Google live on every self-referential turn. That is a
// tax on latency and quota that most turns should not pay. This bridge reads
// the already-harvested ledger instead: a bounded, indexed pull that answers in
// milliseconds and can correlate across months rather than across one API page.
//
// Rules:
//   • Pull, don't push. Fires only on an explicit self/ledger-shaped turn.
//   • Verified identity only. No JWT, no ledger — ever.
//   • Never calls Google. If the ledger is empty or stale it says so and lets
//     the model tell the user to run a sweep, rather than silently improvising.
//   • All Google-authored text is fenced as untrusted before injection.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { adminClient, fenceUntrusted } from "./googleMesh.ts";

const FIRST_PERSON = /\b(my|mine|i|me|i'm|i've|myself)\b/i;

const LEDGER_CUES =
  /\b(email|emails|inbox|gmail|calendar|schedule|meeting|meetings|drive|file|files|document|contact|contacts|task|tasks|subscription|subscriptions|charge|charged|billing|spend|spending|invoice|receipt|owe|owes|unanswered|reply|replied|follow.?up|shared|exposure|security|breach|network|correspond|relationship|ledger|substrate|digital life|brief|briefing)\b/i;

const EXPLICIT_LEDGER =
  /\b(intelligence (report|brief)|my (ledger|substrate|google data|digital life)|what do you know about me|brief me)\b/i;

export interface SubstrateIntent {
  active: boolean;
  explicit: boolean;
  /** A quoted or "about X" fragment worth full-text searching. */
  query: string | null;
  /** A specific correspondent the turn is about. */
  person: string | null;
}

export function classifySubstrateIntent(text: string): SubstrateIntent {
  const t = String(text ?? "");
  const explicit = EXPLICIT_LEDGER.test(t);
  const active = explicit || (FIRST_PERSON.test(t) && LEDGER_CUES.test(t));
  const quoted = t.match(/"([^"]{3,60})"/)?.[1]
    ?? t.match(/\babout\s+([\w \-'.]{3,50})/i)?.[1]
    ?? null;
  const person = t.match(/\b([\w.+-]+@[\w.-]+\.\w+)\b/)?.[1]?.toLowerCase() ?? null;
  return { active, explicit, query: quoted?.trim() || null, person };
}

export interface SubstrateBundle {
  signals: number;
  lastIngest: string | null;
  ageHours: number | null;
  lead: Array<Record<string, any>>;
  focused: Array<Record<string, any>>;
  insights: Array<Record<string, any>>;
  hits: Array<Record<string, any>>;
  elapsedMs: number;
}

/**
 * Read-only ledger pull. Returns null when the caller is not a verified user,
 * or when the ledger has never been swept — the caller then proceeds ungrounded
 * rather than fabricating a personal history.
 */
export async function runSubstratePull(
  authHeader: string,
  question: string,
  intent: SubstrateIntent,
): Promise<SubstrateBundle | null> {
  const started = Date.now();
  if (!authHeader?.startsWith("Bearer ")) return null;

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user } } = await anon.auth.getUser(authHeader.slice(7));
  if (!user) return null;

  const sb = adminClient();
  const userId = user.id;

  const [{ count }, { data: newest }] = await Promise.all([
    sb.from("google_signals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("google_signals").select("created_at").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1),
  ]);
  if (!count) return null;

  const lastIngest = newest?.[0]?.created_at ?? null;
  const ageHours = lastIngest ? (Date.now() - Date.parse(lastIngest)) / 36e5 : null;

  // Findings first — they are the compressed, already-reasoned layer.
  // Two pulls, because severity ordering alone buries the two rows that frame
  // everything else: the state vector is severity 1 by design (it is a
  // description, not an alarm) and would never survive a top-N by severity.
  const [{ data: lead }, { data: insights }] = await Promise.all([
    sb.from("google_insights")
      .select("domain, code, severity, title, detail, metric, computed_at")
      .eq("user_id", userId).eq("dismissed", false)
      .in("code", ["state_vector", "rhythm_baseline", "ledger_coverage"]),
    sb.from("google_insights")
      .select("domain, code, severity, title, detail, metric, computed_at")
      .eq("user_id", userId).eq("dismissed", false)
      .not("code", "in", "(state_vector,rhythm_baseline,ledger_coverage)")
      .order("severity", { ascending: false }).limit(intent.explicit ? 30 : 14),
  ]);

  // A turn naming a person deserves that person's fused dossier even when a
  // dozen higher-severity findings outrank it.
  let focused: Array<Record<string, any>> = [];
  if (intent.person) {
    const { data } = await sb.from("google_insights")
      .select("domain, code, severity, title, detail, metric")
      .eq("user_id", userId).eq("dismissed", false)
      .eq("subject_key", intent.person).limit(4);
    focused = data ?? [];
  }

  // Then raw rows, but only the ones the turn actually points at.
  let sel = sb.from("google_signals")
    .select("source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, amount, currency, metadata, account_email")
    .eq("user_id", userId);
  const q = (intent.query ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
  if (q) sel = sel.textSearch("search", q, { type: "websearch", config: "english" });
  if (intent.person) sel = sel.contains("counterparties", [intent.person]);
  const { data: hits } = await sel
    .order("occurred_at", { ascending: false })
    .limit(q || intent.person ? 30 : 15);

  return {
    signals: count ?? 0,
    lastIngest,
    ageHours: ageHours == null ? null : Number(ageHours.toFixed(1)),
    lead: lead ?? [],
    focused,
    insights: insights ?? [],
    hits: hits ?? [],
    elapsedMs: Date.now() - started,
  };
}

const line = (s: unknown, n = 160) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function formatSubstrateContext(b: SubstrateBundle | null): string {
  if (!b) return "";
  const parts: string[] = [];
  parts.push(
    `## GOOGLE SUBSTRATE — the user's own indexed ledger\n` +
    `${b.signals} signals indexed. Last harvest: ${b.lastIngest ?? "unknown"}` +
    (b.ageHours != null ? ` (${b.ageHours}h ago).` : ".") +
    (b.ageHours != null && b.ageHours > 72
      ? ` This ledger is STALE — say so, and tell the user a sweep in the Google Intelligence tab will refresh it.`
      : ""),
  );

  const sv = b.lead.find((i) => i.code === "state_vector")?.metric as any;
  if (sv) {
    parts.push(
      "### State vector (tier 2 — correlated across every surface)\n" +
      `- People fused: ${sv.people} across ${(sv.surfaces ?? []).join(", ") || "no surface"}\n` +
      `- Focus index: ${sv.focus}/100 · Exposure: ${sv.exposure}/100\n` +
      `- Median first-reply latency: ${sv.responsivenessH ?? "unmeasured"}${sv.responsivenessH ? "h" : ""}\n` +
      `- Open commitments: ${sv.commitmentDebt}\n` +
      `- Projected 90-day outflow: ${Object.entries(sv.projected ?? {}).map(([c, v]) => `${c} ${v}`).join(", ") || "none detected"}\n` +
      `- Ledger span: ${String(sv.span?.from ?? "?").slice(0, 10)} → ${String(sv.span?.to ?? "?").slice(0, 10)}\n` +
      "These are measurements over stored rows, each with a stated formula. Quote them as measured, never as estimated.",
    );
  }

  if (b.focused.length) {
    parts.push(
      "### Fused dossier for the subject of this turn\n" +
      b.focused.map((i) => `- [${i.code}] ${line(i.title, 140)}\n  ${line(i.detail, 400)}`).join("\n"),
    );
  }

  if (b.insights.length) {
    parts.push(
      "### Derived findings (deterministic — measured, not inferred)\n" +
      b.insights.map((i) =>
        `- [S${i.severity}·${i.domain}] ${line(i.title, 120)}\n  ${line(i.detail, 320)}`).join("\n"),
    );
  }

  if (b.hits.length) {
    const rows = b.hits.map((h) => {
      const when = h.occurred_at ? String(h.occurred_at).slice(0, 16).replace("T", " ") : "—";
      const money = h.amount ? ` [${h.currency ?? ""} ${h.amount}]` : "";
      const who = h.actor_name || h.actor_email || "";
      return `- ${when} · ${h.source}/${h.kind} · ${who}${money}\n  ${line(h.subject, 140)}` +
        (h.snippet ? `\n  ${line(h.snippet, 180)}` : "");
    }).join("\n");
    parts.push("### Matching ledger rows\n" + fenceUntrusted("GOOGLE_LEDGER", rows));
  }

  parts.push(
    "Cite the ledger explicitly when you use it (source + date). Never invent a row " +
    "that is not above. If the ledger lacks the answer, say what is missing and which " +
    "surface would need to be swept.",
  );
  return "\n\n" + parts.join("\n\n");
}
