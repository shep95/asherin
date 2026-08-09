/**
 * RIDESHARE AUTOPILOT — the sweep that must reach the rider before boarding.
 *
 * The rider should never paste a link. Uber and Lyft already write the trip to
 * the mailbox: dispatch notice, receipt, share forward. This function claims
 * riders whose autopilot window has come due, harvests those messages through
 * the Google Intelligence Substrate the rider already authorised, reconstructs
 * the ride card, and runs the same doctrine-enforced deep sweep the manual desk
 * runs — then pushes and emails the verdict.
 *
 * Invariants that make it safe on a schedule:
 *   • Claim-before-work — next_due_at moves forward in the same pass that
 *     selects the batch, so two overlapping ticks never sweep one rider twice.
 *   • Message-id idempotency — a ride is bound to the Gmail id that produced
 *     it, so a re-scan of the same mailbox window reports nothing new.
 *   • Bounded fan-out — fixed batch, per-rider budget, global wall clock. A
 *     large mailbox degrades to a partial sweep, never a platform timeout.
 *   • Opt-in only — autopilot_enabled defaults false; reading a mailbox on a
 *     schedule is a standing permission and is treated as one.
 *   • Consent-scoped — only accounts the rider connected, only Gmail scope.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { liveAccounts, harvestBodies, hasScope } from "../_shared/googleMesh.ts";
import { gmailQuery, parseRideEmail, foldRides, type ParsedRideEmail } from "../_shared/rideshareIngest.ts";
import { runDeepSweep, loadSettings, type GuardianSettings } from "../_shared/rideshareSweep.ts";
import { fastPass, type RideInput } from "../_shared/rideshareGuardian.ts";
import { ADMIN_EMAILS } from "../_shared/constants.ts";
import { assessAreaByLabel, alertAreaRisk, ALERTING_LEVELS, type AreaAssessment } from "../_shared/areaRisk.ts";
import { notifyIntel } from "../_shared/intelNotify.ts";
import type { ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BATCH = 3;
const GLOBAL_BUDGET_MS = 110_000;
// Searches now share one serialized provider lane (~1.1 s apart), so a full
// driver sweep costs wall-clock time it did not before. Too small a budget
// truncates collection and reproduces the thin-identity failure.
const PER_RIDE_COLLECTION_MS = 60_000;
/** Only sweep rides this recent — an old receipt is history, not a safety event. */
const MAX_RIDE_AGE_MS = 36 * 60 * 60 * 1000;

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const log = (step: string, detail?: unknown) =>
  console.log(`[rideshare-autopilot] ${step}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);

const admin = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Cron has no caller identity, so the model key is resolved from the rider's
 *  own account tier rather than a request header. */
function cfgForEmail(email: string | null): ZophielByokConfig | null {
  const gemini = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";
  if (email && ADMIN_EMAILS.has(email.toLowerCase()) && gemini) {
    return { provider: "google", model: "gemini-flash-latest", apiKey: gemini };
  }
  const venice = Deno.env.get("VENICE_API_KEY") || "";
  if (venice) return { provider: "venice", model: "mistral-31-24b", apiKey: venice };
  if (gemini) return { provider: "google", model: "gemini-flash-latest", apiKey: gemini };
  return null;
}

interface RiderRow {
  user_id: string;
  lookback_hours: number | null;
  next_due_at: string | null;
}

/** Select and lock in one motion: the UPDATE re-asserts the due filter, so the
 *  first tick to commit wins and the loser claims nothing. */
async function claimDue(sb: SupabaseClient): Promise<RiderRow[]> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("rideshare_settings")
    .select("user_id, lookback_hours, next_due_at")
    .eq("autopilot_enabled", true)
    .or(`next_due_at.is.null,next_due_at.lte.${nowIso}`)
    .order("next_due_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) throw new Error(`claim read: ${error.message}`);
  const rows = (due ?? []) as RiderRow[];
  if (!rows.length) return [];

  // Dispatch cards have a short useful life. A fifteen-minute claim window was
  // long enough for the vehicle to arrive, complete a short trip, and generate
  // a receipt before the next scan. One minute keeps overlapping cron ticks
  // idempotent while preserving the pre-boarding window.
  const next = new Date(Date.now() + 60_000).toISOString();
  const claimed: RiderRow[] = [];
  for (const r of rows) {
    const q = sb.from("rideshare_settings")
      .update({ next_due_at: next, last_scan_at: nowIso })
      .eq("user_id", r.user_id)
      .eq("autopilot_enabled", true);
    const { data, error: uErr } = r.next_due_at
      ? await (q.lte("next_due_at", nowIso).select("user_id"))
      : await (q.is("next_due_at", null).select("user_id"));
    if (!uErr && data && data.length) claimed.push(r);
  }
  return claimed;
}

async function emailFor(sb: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await sb.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

/** Harvest → parse → fold. Never throws: a broken mailbox thins the batch. */
async function harvestRides(sb: SupabaseClient, userId: string, lookbackHours: number): Promise<ParsedRideEmail[]> {
  const accounts = await liveAccounts(sb, userId);
  const q = gmailQuery(lookbackHours);
  const parsed: ParsedRideEmail[] = [];
  for (const acct of accounts) {
    if (!hasScope(acct, "gmail.readonly") && !hasScope(acct, "gmail.modify")) continue;
    try {
      const msgs = await harvestBodies(acct.token, q, 25);
      for (const m of msgs) {
        const p = parseRideEmail({ id: m.id, subject: m.subject, at: m.at, body: m.body });
        if (p && Date.now() - p.at <= MAX_RIDE_AGE_MS) parsed.push(p);
      }
    } catch (e) {
      log("harvest failed", { userId, acct: acct.id, msg: (e as Error).message?.slice(0, 120) });
    }
  }
  return foldRides(parsed);
}

async function sweepRider(
  sb: SupabaseClient,
  rider: RiderRow,
  deadline: number,
): Promise<Record<string, unknown>> {
  const userId = rider.user_id;
  const settings: GuardianSettings = await loadSettings(userId);
  const userEmail = await emailFor(sb, userId);
  const cfg = cfgForEmail(userEmail);
  if (!cfg) return { userId, status: "no_model_key" };

  const rides = await harvestRides(sb, userId, settings.lookback_hours ?? rider.lookback_hours ?? 24);
  if (!rides.length) return { userId, status: "no_rides" };

  let swept = 0, skipped = 0, briefed = 0, areaAlerts = 0;
  // A cache miss on the area engine costs a model call, so a single tick may
  // generate at most two fresh assessments; the rest ride the cache or wait.
  let areaBudget = 2;
  for (const r of rides) {
    if (Date.now() > deadline) { skipped++; continue; }

    // Idempotency on the producing message id: a re-scan of the same window
    // must recognise the trip, not re-report it.
    const { data: existing } = await sb.from("rideshare_rides")
      .select("id, status").eq("user_id", userId).eq("email_message_id", r.messageId).maybeSingle();
    if (existing?.status === "deep_done") { skipped++; continue; }

    const ride: RideInput = {
      platform: r.platform,
      source: "email",
      driver_name: r.driver_name,
      plate: r.plate,
      vehicle: r.vehicle,
      city: r.city,
      pickup_label: r.pickup_label,
      trip_url: r.trip_url,
    };
    const fast = fastPass(ride);

    const record = {
      user_id: userId,
      platform: ride.platform,
      source: ride.source,
      driver_name: ride.driver_name,
      plate: ride.plate,
      vehicle: ride.vehicle,
      city: ride.city,
      pickup_label: ride.pickup_label,
      trip_url: ride.trip_url,
      status: "fast_done",
      verdict: fast.verdict,
      confidence: fast.confidence,
      auto_captured: true,
      email_message_id: r.messageId,
      ride_at: new Date(r.at).toISOString(),
      idempotency_key: `auto:${r.messageId}`,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = existing
      ? await sb.from("rideshare_rides").update(record).eq("id", existing.id).select("id").single()
      : await sb.from("rideshare_rides").insert(record).select("id").single();
    if (error || !row) { log("ride write failed", { userId, msg: error?.message }); continue; }

    await sb.from("rideshare_reports").upsert({
      ride_id: row.id, user_id: userId, phase: "fast",
      verdict: fast.verdict, confidence: fast.confidence, score: fast.score,
      headline: fast.headline,
      payload: {
        ...fast.payload,
        capture: "autopilot",
        email_gaps: r.gaps,
        email_kind: r.kind,
        email_subject: r.subject,
        email_excerpt: r.excerpt,
      },
    }, { onConflict: "ride_id,phase" });

    // Beat the deep sweep to the lock screen. The deterministic card arrives as
    // soon as an assignment/dispatch email is parsed; the sourced dossier then
    // replaces it. Receipts are historical evidence and must never masquerade
    // as a pre-boarding alert after the ride has ended.
    if (r.kind !== "receipt") {
      await notifyIntel({
        userId,
        userEmail,
        kind: "rideshare",
        severity: "notable",
        title: `VERIFY BEFORE BOARDING — ${ride.driver_name || ride.plate || "incoming ride"}`,
        body: `Assigned ${ride.vehicle || "vehicle not captured"} · plate ${ride.plate || "not captured"}. The full driver and vehicle sweep is running now.`,
        subjectName: ride.driver_name || ride.plate || "assigned driver",
        source: "Rideshare Guardian · Pre-boarding",
        url: `/dashboard?tab=cloud-intel&module=rideshare&ride=${row.id}`,
        sections: [
          { label: "Driver shown", value: ride.driver_name || "not captured — compare the app photo" },
          { label: "Assigned vehicle", value: ride.vehicle || "not captured — compare the app card" },
          { label: "Assigned plate", value: ride.plate || "not captured — do not board until confirmed" },
          { label: "Immediate check", value: "Match the face, vehicle and every plate character. Ask the driver to say your name." },
        ],
        findings: r.gaps.length ? [`Still collecting: ${r.gaps.join(", ")}`] : [],
        idempotencyKey: `rideshare:preboard:${row.id}`,
        skipPush: !settings.push_enabled,
        skipEmail: !settings.email_enabled,
      }).catch((e) => log("preboard brief failed", { userId, msg: (e as Error).message?.slice(0, 160) }));
    }

    let deep: { verdict: string; headline: string; confidence: number; delivered: string[] } | null = null;
    try {
      const out = await runDeepSweep({
        userId, userEmail, rideId: row.id, ride, cfg, settings,
        collectionBudgetMs: PER_RIDE_COLLECTION_MS,
      });
      deep = {
        verdict: out.deep.verdict,
        headline: out.deep.headline,
        confidence: out.deep.confidence,
        delivered: out.delivered,
      };
      swept++;
    } catch (e) {
      // The fast pass is already persisted and visible; a failed deep pass
      // leaves the rider with less, never with nothing.
      log("deep sweep failed", { userId, rideId: row.id, msg: (e as Error).message?.slice(0, 160) });
      await sb.from("rideshare_rides").update({ status: "failed" }).eq("id", row.id);
    }

    // ── Destination area briefing ─────────────────────────────────────────
    // The handset is the wrong place to learn where the rider is going: it may
    // be off, and it is off exactly when this matters. The operator email
    // already names the destination, so the area is assessed server-side from
    // the label, cached per ~1.1 km cell, and alerted with the sentinel's own
    // 6-hour per-cell dedupe.
    let area: AreaAssessment | null = null;
    const destLabel = [r.dropoff_label || r.pickup_label, r.city].filter(Boolean).join(", ");
    if (destLabel && areaBudget > 0 && Date.now() < deadline) {
      areaBudget--;
      area = await assessAreaByLabel(sb, destLabel, cfg);
      if (area) {
        const alerted = await alertAreaRisk(sb, {
          userId, userEmail, assessment: area,
          context: `Destination of your ${ride.platform} ride`,
          skipPush: !settings.push_enabled,
          skipEmail: !settings.email_enabled,
        }).catch(() => false);
        if (alerted) areaAlerts++;
      }
    }

    // ── Boarding briefing ─────────────────────────────────────────────────
    // Silence is indistinguishable from a broken sentinel. A CLEAR or THIN
    // driver still gets one informational notice per captured ride, so the
    // rider always knows the sweep ran, what car it saw, and how the
    // destination graded. Escalated verdicts already alerted above; this fires
    // only when the threshold gate stayed shut.
    if (!deep?.delivered?.length) {
      const areaLine = area
        ? `${area.risk_level} — ${String(area.place_label || destLabel).split(",").slice(0, 2).join(",")}`
        : destLabel
          ? "destination could not be assessed"
          : "no destination in the trip email";
      await notifyIntel({
        userId, userEmail,
        kind: "rideshare",
        severity: area && ALERTING_LEVELS.has(area.risk_level) ? "notable" : "info",
        title: `Ride logged — ${ride.driver_name || ride.plate || "driver not named"} · ${deep?.verdict ?? fast.verdict}`,
        body: deep?.headline || fast.headline ||
          "Autopilot captured this ride from your mailbox and swept the driver.",
        subjectName: ride.driver_name || ride.plate || "unnamed driver",
        source: "Rideshare Guardian · Autopilot",
        url: `/dashboard?tab=cloud-intel&module=rideshare&ride=${row.id}`,
        sections: [
          { label: "Vehicle", value: `${ride.vehicle || "not captured"} · plate ${ride.plate || "not captured"}` },
          { label: "Identity confidence", value: `${Math.round((deep?.confidence ?? fast.confidence) * 100)}%` },
          { label: "Destination area", value: areaLine },
          { label: "Not captured", value: r.gaps.join(", ") || "nothing — the card was complete" },
        ],
        findings: area?.payload && Array.isArray((area.payload as any).safer_actions)
          ? (area.payload as any).safer_actions.map(String).slice(0, 4)
          : [],
        idempotencyKey: `rideshare:boarded:${row.id}`,
        skipPush: !settings.push_enabled,
        skipEmail: !settings.email_enabled,
      }).catch((e) => log("boarding brief failed", { userId, msg: (e as Error).message?.slice(0, 160) }));
      briefed++;
    }
  }


  return { userId, status: "ok", found: rides.length, swept, skipped, briefed, areaAlerts };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = admin();
  const started = Date.now();

  // Two accepted callers: the scheduler holding the cron token, and a
  // signed-in rider asking for their own mailbox to be scanned now.
  const presented = req.headers.get("x-cron-secret") ?? "";
  let scope: RiderRow[] | null = null;

  if (presented) {
    const envSecret = Deno.env.get("MESH_CRON_SECRET") ?? "";
    const { data: tokenRow } = await sb
      .from("cron_tokens").select("token").eq("name", "rideshare_autopilot").maybeSingle();
    const dbSecret = (tokenRow?.token as string | undefined) ?? "";
    const matches = (c: string) => c.length > 0 && c.length === presented.length && c === presented;
    if (!matches(envSecret) && !matches(dbSecret)) return json({ error: "Forbidden" }, 403, cors);
  } else {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: { user } } = await anon.auth.getUser(authHeader.slice(7));
    if (!user) return json({ error: "unauthorized" }, 401, cors);
    // A manual run only ever touches the caller's own mailbox.
    scope = [{ user_id: user.id, lookback_hours: null, next_due_at: null }];
  }

  try {
    const riders = scope ?? await claimDue(sb);
    log("tick", { claimed: riders.length, manual: Boolean(scope) });

    const results: Array<Record<string, unknown>> = [];
    for (const rider of riders) {
      if (Date.now() - started > GLOBAL_BUDGET_MS) {
        // Hand the remainder straight back to the queue for the next tick.
        if (!scope) {
          await sb.from("rideshare_settings")
            .update({ next_due_at: new Date().toISOString() })
            .eq("user_id", rider.user_id);
        }
        results.push({ userId: rider.user_id, status: "deferred" });
        continue;
      }
      try {
        const out = await sweepRider(sb, rider, started + GLOBAL_BUDGET_MS);
        results.push(out);
        // The rider can see when their mailbox was last read and what it found;
        // a silent scheduler is indistinguishable from a broken one.
        await sb.from("rideshare_settings").update({
          last_scan_status: String(out.status ?? "ok"),
          last_scan_detail: `found ${out.found ?? 0}, swept ${out.swept ?? 0}, briefed ${out.briefed ?? 0}, area alerts ${out.areaAlerts ?? 0}`,
        }).eq("user_id", rider.user_id);
      } catch (e) {
        const msg = (e as Error).message ?? "unknown";
        log("rider failed", { userId: rider.user_id, msg });
        results.push({ userId: rider.user_id, status: "error", error: msg.slice(0, 200) });
        await sb.from("rideshare_settings").update({
          last_scan_status: "error", last_scan_detail: msg.slice(0, 300),
        }).eq("user_id", rider.user_id);
      }
    }
    return json({ ok: true, elapsed_ms: Date.now() - started, results }, 200, cors);
  } catch (e) {
    log("tick failed", (e as Error).message);
    return json({ error: "autopilot_failed", message: (e as Error).message?.slice(0, 300) }, 500, cors);
  }
});
