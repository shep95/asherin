// ═══════════════════════════════════════════════════════════════════════════
// INTEL NOTIFY — one delivery bus for every intelligence product.
//
// Any surface that finishes an intelligence report (rideshare driver check,
// correspondent dossier, contact OSINT, sentinel sweep, watchlist hit) calls
// notifyIntel() once. The bus fans that single fact out to three channels:
//
//   in-app   → a row in intel_notifications, streamed live to open tabs on
//              laptop, tablet and phone
//   push     → encrypted Web Push to every registered device, so the alert
//              lands with the app closed
//   email    → the branded intelligence-report template
//
// Contract, in order of importance:
//   1. The in-app row is written FIRST and unconditionally. Push and email are
//      best-effort transports; the inbox is the record. A dead FCM endpoint
//      must never erase the fact that an alert happened.
//   2. Every channel is isolated. One throwing transport cannot take down the
//      others, and none of them can take down the caller's report.
//   3. Idempotent by content. The caller supplies a stable key derived from
//      the subject and phase — never a random uuid — so a retried or
//      double-invoked sweep re-uses the same row and does not re-notify.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "./webPush.ts";

export type IntelSeverity = "info" | "notable" | "critical";

export const SEVERITY_RANK: Record<IntelSeverity, number> = {
  info: 0,
  notable: 1,
  critical: 2,
};

export interface IntelSection {
  label: string;
  value: string;
}

export interface IntelNotice {
  userId: string;
  userEmail?: string | null;
  /** machine tag for filtering: rideshare | dossier | contact | sentinel | watchlist | search */
  kind: string;
  severity?: IntelSeverity;
  title: string;
  body: string;
  subjectName?: string | null;
  /** human label of the producing module, e.g. "Rideshare Guardian" */
  source?: string | null;
  /** same-origin deep link into the report */
  url?: string | null;
  sections?: IntelSection[];
  findings?: string[];
  /** stable, content-derived. Omit only for genuinely one-off events. */
  idempotencyKey?: string | null;
  /**
   * Set when the caller already sends its own richer, module-specific email
   * (Rideshare Guardian does). The inbox row and push still go out here, so
   * the alert can never exist on only one channel.
   */
  skipEmail?: boolean;
  /** Set when the caller's own module preference has push muted. */
  skipPush?: boolean;
  /**
   * Lock-screen safe one-liner. Push notifications render on a locked device
   * and are handed to a third-party push service, so anything sensitive in
   * `body` must not go out that way. Defaults to `body` when omitted.
   */
  pushBody?: string;
  /**
   * Optional inline image rendered above the meta card in the email —
   * e.g. a satellite thumbnail of the actor's coordinates on a security
   * alert. Must be an https URL served by an image-friendly host.
   */
  imageUrl?: string;
  /**
   * Optional secondary CTA rendered under the primary button. Security
   * alerts use it to surface a "Not you? Lock the account" escape hatch.
   */
  secondaryCta?: { label: string; url: string };
}

export interface IntelDelivery {
  notificationId: string | null;
  channels: string[];
  /** set when transports were intentionally skipped rather than failed */
  suppressed?: string;
}

interface Prefs {
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  min_severity: IntelSeverity;
}

const DEFAULT_PREFS: Prefs = {
  push_enabled: true,
  email_enabled: true,
  in_app_enabled: true,
  min_severity: "info",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

const clamp = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function isSeverity(v: unknown): v is IntelSeverity {
  return v === "info" || v === "notable" || v === "critical";
}

export async function loadIntelPrefs(userId: string): Promise<Prefs> {
  try {
    const { data } = await admin()
      .from("intel_notification_prefs")
      .select("push_enabled, email_enabled, in_app_enabled, min_severity")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return DEFAULT_PREFS;
    return {
      push_enabled: data.push_enabled !== false,
      email_enabled: data.email_enabled !== false,
      in_app_enabled: data.in_app_enabled !== false,
      min_severity: isSeverity(data.min_severity) ? data.min_severity : "info",
    };
  } catch {
    // A preferences read failure must not silence a safety alert.
    return DEFAULT_PREFS;
  }
}

/**
 * Fan one intelligence product out to in-app, push and email.
 * Never throws: returns which channels actually accepted the alert.
 */
export async function notifyIntel(notice: IntelNotice): Promise<IntelDelivery> {
  const out: IntelDelivery = { notificationId: null, channels: [] };
  if (!notice.userId || !SUPABASE_URL || !SERVICE_KEY) return out;

  const severity: IntelSeverity = isSeverity(notice.severity) ? notice.severity : "info";
  const title = clamp(notice.title, 140) || "Intelligence report ready";
  const body = clamp(notice.body, 600);
  const pushBody = clamp(notice.pushBody, 180) || body.slice(0, 180);
  const kind = clamp(notice.kind, 40) || "intel";
  const source = clamp(notice.source, 60) || "Asherin Intelligence";
  const subjectName = clamp(notice.subjectName, 120) || null;
  // Only same-origin paths are stored: a notification is a click target, and
  // an absolute URL from a report payload would be an open-redirect surface.
  const url = typeof notice.url === "string" && /^\/[^/\\]/.test(notice.url)
    ? notice.url.slice(0, 300)
    : "/dashboard";
  const sections = (notice.sections ?? [])
    .filter((s) => s && clamp(s.label, 60) && clamp(s.value, 400))
    .slice(0, 12)
    .map((s) => ({ label: clamp(s.label, 60), value: clamp(s.value, 400) }));
  const findings = (notice.findings ?? [])
    .map((f) => clamp(f, 300))
    .filter(Boolean)
    .slice(0, 12);
  const idem = clamp(notice.idempotencyKey, 200) || null;

  const sb = admin();
  const prefs = await loadIntelPrefs(notice.userId);

  // ── 1. inbox row (the record of truth) ───────────────────────────────────
  // Re-notification guard: if this exact key already delivered on a transport,
  // the work was already announced. Refresh the row, announce nothing again.
  let alreadyDelivered: string[] = [];
  let priorId: string | null = null;
  if (idem) {
    const { data: prior } = await sb
      .from("intel_notifications")
      .select("id, channels_delivered")
      .eq("user_id", notice.userId)
      .eq("idempotency_key", idem)
      .maybeSingle();
    if (prior) {
      priorId = prior.id;
      alreadyDelivered = prior.channels_delivered ?? [];
    }
  }

  const row = {
    user_id: notice.userId,
    kind,
    severity,
    title,
    body,
    subject_name: subjectName,
    source,
    url,
    sections,
    findings,
    idempotency_key: idem,
    // Recorded at write time so the inbox row is never left claiming zero
    // channels when the inbox itself is one of them.
    channels_delivered: ["in_app"],
  };

  try {
    // The idempotency index is PARTIAL (idempotency_key IS NOT NULL), so
    // PostgREST cannot infer it for ON CONFLICT. Read-then-write explicitly.
    // A repeat under the same key is the SAME alert by contract. Rewriting the
    // row would let a thinner retry payload erase the evidence the first pass
    // collected, so an existing row is adopted, never overwritten.
    let { data, error } = priorId
      ? { data: { id: priorId }, error: null as { code?: string } | null }
      : await sb.from("intel_notifications").insert(row).select("id").single();

    // Two sweeps finishing at once both saw "no prior row" and both inserted.
    // The loser lands on the unique index; it is the same alert, so adopt the
    // winner's row rather than losing the record.
    if (error && (error as { code?: string }).code === "23505" && idem) {
      const { data: won } = await sb
        .from("intel_notifications")
        .select("id, channels_delivered")
        .eq("user_id", notice.userId)
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (won) {
        alreadyDelivered = won.channels_delivered ?? [];
        data = { id: won.id };
        error = null;
      }
    }
    if (error) throw error;
    out.notificationId = data?.id ?? null;
    out.channels.push("in_app");
  } catch (e) {
    console.error("intel_notify_inbox_failed", e instanceof Error ? e.message : e);
  }


  const meetsThreshold = SEVERITY_RANK[severity] >= SEVERITY_RANK[prefs.min_severity];
  if (!meetsThreshold) {
    out.suppressed = `below_min_severity:${prefs.min_severity}`;
    return out;
  }
  if (alreadyDelivered.some((c) => c === "push" || c === "email")) {
    out.suppressed = "already_delivered";
    return out;
  }

  // ── 2. push + email, isolated and concurrent ─────────────────────────────
  const transports: Promise<string | null>[] = [];

  if (prefs.push_enabled && !notice.skipPush) {
    transports.push((async () => {
      try {
        const { data: subs } = await sb
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth_key")
          .eq("user_id", notice.userId);
        if (!subs?.length) return null;

        const results = await Promise.allSettled(
          subs.map((s) =>
            sendWebPush(
              { endpoint: s.endpoint, p256dh: s.p256dh, auth_key: s.auth_key },
              {
                title: `${source} · ${title}`.slice(0, 120),
                body: pushBody,
                tag: `intel-${kind}-${out.notificationId ?? idem ?? Date.now()}`,
                url,
                verdict: severity === "critical" ? "AVOID" : severity === "notable" ? "WATCH" : "",
              },
              { urgency: severity === "critical" ? "high" : "normal" },
            ).then((r) => ({ r, id: s.id })),
          ),
        );

        let anyOk = false;
        const dead: string[] = [];
        for (const res of results) {
          if (res.status !== "fulfilled") continue;
          if (res.value.r.ok) anyOk = true;
          // 404/410 means the browser threw the subscription away; pruning it
          // keeps later sweeps from paying for a guaranteed failure.
          if (res.value.r.gone) dead.push(res.value.id);
          if (!res.value.r.ok && res.value.r.error) {
            console.error("intel_push_failed", res.value.r.status, res.value.r.error);
          }
        }
        if (dead.length) await sb.from("push_subscriptions").delete().in("id", dead);
        return anyOk ? "push" : null;
      } catch (e) {
        console.error("intel_push_error", e instanceof Error ? e.message : e);
        return null;
      }
    })());
  }

  if (prefs.email_enabled && notice.userEmail && !notice.skipEmail) {
    transports.push((async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "intelligence-report",
            recipientEmail: notice.userEmail,
            idempotencyKey: `intel-${idem ?? out.notificationId ?? crypto.randomUUID()}`,
            templateData: {
              title,
              body,
              severity,
              source,
              subjectName: subjectName ?? "",
              sections,
              findings,
              // A report link must resolve to the report. When the dossier row
              // exists, point at the standalone dossier page; only fall back to
              // the in-app deep link when there is no row to render.
              reportUrl: out.notificationId
                ? `https://asherin.com/report/${out.notificationId}`
                : `https://asherin.com${url}`,
              generatedAt: new Date().toUTCString(),
            },
          }),
        });
        if (res.ok) return "email";
        console.error("intel_email_failed", res.status, (await res.text()).slice(0, 300));
        return null;
      } catch (e) {
        console.error("intel_email_error", e instanceof Error ? e.message : e);
        return null;
      }
    })());
  }

  const settled = await Promise.allSettled(transports);
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) out.channels.push(s.value);
  }

  if (out.notificationId && out.channels.length) {
    await sb.from("intel_notifications")
      .update({ channels_delivered: out.channels })
      .eq("id", out.notificationId)
      .then(undefined, () => {});
  }

  return out;
}

/** Map a 0–1 risk/confidence-weighted verdict onto the shared severity scale. */
export function severityFromVerdict(verdict: string): IntelSeverity {
  const v = verdict.toUpperCase();
  if (v === "AVOID" || v === "CRITICAL" || v === "HIGH") return "critical";
  if (v === "WATCH" || v === "NOTABLE" || v === "MEDIUM") return "notable";
  return "info";
}
