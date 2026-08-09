// ═══════════════════════════════════════════════════════════════════════════
// sentinel-cron — the half of Cloud Intelligence that runs with every screen
// off and every tab closed.
//
// The browser daemon can only judge while a tab is alive. Everything that can
// be decided from data already in the ledger belongs on a clock the user does
// not own, so pg_cron wakes this function and it:
//   1. enrols anyone who has ever produced sentinel data,
//   2. claims a bounded batch whose next_due_at has passed,
//   3. re-scores following/tradecraft tier from stored sightings and alerts on
//      escalation — the alert the foreground daemon could only toast,
//   4. re-judges the area around each user's last reported fix, refusing to
//      alert on a stale fix,
//   5. records the outcome, backing off users that keep failing.
//
// Safety invariants:
//   • Claim-before-work: next_due_at is pushed forward by the same UPDATE that
//     selects the row, so overlapping ticks cannot double-alert.
//   • Wall-clock budget: a slow neighbourhood degrades to a partial batch, not
//     a platform timeout.
//   • Escalation-only alerting: tier is compared against last_tier, so a
//     sustained ACTIVE tier does not re-alert every fifteen minutes.
//   • No secrets in, no user id from the body: this endpoint accepts only the
//     platform cron secret and derives everything else from the database.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notifyIntel } from "../_shared/intelNotify.ts";
import { analyzeTradecraft, type TcDevice, type TcSighting } from "../_shared/stalkerTradecraft.ts";
import { assessAndAlertArea, platformAreaCfg, clearArrival } from "../_shared/areaSentinel.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 8;
const GLOBAL_BUDGET_MS = 100_000;
/** A fix older than this describes where the user was, not where they are. */
const MAX_FIX_AGE_MS = 90 * 60_000;
const BACKOFF_CAP_MIN = 180;
const TIER_RANK: Record<string, number> = { none: 0, watch: 1, probable: 2, active: 3 };

const json = (b: unknown, s: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const log = (step: string, detail?: unknown) =>
  console.log(`[sentinel-cron] ${step}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Anyone who has ever produced sentinel data is under watch by default; the
 *  ledger row is what makes the watch unattended. Enrolment runs every tick so
 *  a user who arrived while this function was undeployed is still picked up. */
async function enroll(db: SupabaseClient): Promise<number> {
  const [presence, settings, devices] = await Promise.all([
    db.from("sentinel_presence").select("user_id").limit(5000),
    db.from("sentinel_settings").select("user_id").limit(5000),
    db.from("ble_devices").select("user_id").limit(20000),
  ]);
  const ids = new Set<string>();
  for (const r of [...(presence.data ?? []), ...(settings.data ?? []), ...(devices.data ?? [])]) {
    if ((r as any)?.user_id) ids.add((r as any).user_id);
  }
  if (!ids.size) return 0;
  const { data: known } = await db.from("sentinel_cron_state").select("user_id").in("user_id", [...ids]);
  const have = new Set((known ?? []).map((r: any) => r.user_id));
  const fresh = [...ids].filter((id) => !have.has(id));
  if (!fresh.length) return 0;
  const { error } = await db.from("sentinel_cron_state").insert(fresh.map((user_id) => ({ user_id })));
  if (error && !/duplicate key/i.test(error.message)) throw new Error(`enroll: ${error.message}`);
  return fresh.length;
}

async function claimDue(db: SupabaseClient, nowIso: string): Promise<Array<{ user_id: string; last_tier: string }>> {
  const { data: due, error } = await db
    .from("sentinel_cron_state")
    .select("user_id, interval_minutes, last_tier")
    .eq("enabled", true)
    .lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`claim read: ${error.message}`);
  const claimed: Array<{ user_id: string; last_tier: string }> = [];
  for (const row of (due ?? []) as any[]) {
    const next = new Date(Date.now() + Math.max(5, row.interval_minutes ?? 15) * 60_000).toISOString();
    const { data: won, error: upErr } = await db
      .from("sentinel_cron_state")
      .update({ last_started_at: nowIso, next_due_at: next, last_status: "running" })
      .eq("user_id", row.user_id)
      .lte("next_due_at", nowIso)
      .select("user_id");
    if (upErr) { log("claim failed", { user: row.user_id, error: upErr.message }); continue; }
    if (won?.length) claimed.push({ user_id: row.user_id, last_tier: row.last_tier || "none" });
  }
  return claimed;
}

async function userEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

async function loadSettings(db: SupabaseClient, userId: string) {
  const { data } = await db.from("sentinel_settings").select("*").eq("user_id", userId).maybeSingle();
  return {
    ble_enabled: true, geo_enabled: true, push_enabled: true, email_enabled: true,
    ...(data || {}),
  } as Record<string, any>;
}

/** Deterministic re-score of the whole sighting log. No model, no key, no cost
 *  — which is exactly why it is safe to run for every user on a clock. */
async function tradecraftLeg(
  db: SupabaseClient, userId: string, email: string | null, prevTier: string, settings: Record<string, any>,
): Promise<{ tier: string; alerted: boolean }> {
  const [devRes, sightRes] = await Promise.all([
    db.from("ble_devices")
      .select("id,display_name,manufacturer,inferred_kind,is_self,is_ignored,first_seen,last_seen,encounter_count,distinct_days,distinct_places,closest_distance_m")
      .eq("user_id", userId).limit(500),
    db.from("ble_sightings")
      .select("device_id,seen_at,session_id,place_key,distance_m,rssi")
      .eq("user_id", userId).order("seen_at", { ascending: false }).limit(5000),
  ]);
  const devices = (devRes.data || []) as unknown as TcDevice[];
  const sightings = (sightRes.data || []) as unknown as TcSighting[];
  if (!sightings.length) return { tier: prevTier, alerted: false };

  const campaign = analyzeTradecraft(devices, sightings);
  const tier = String(campaign.tier || "none");
  if ((TIER_RANK[tier] ?? 0) <= (TIER_RANK[prevTier] ?? 0)) return { tier, alerted: false };

  const names: Record<string, string> = {};
  for (const d of devices) names[d.id] = d.display_name;
  const top = (campaign.indicators || []).slice(0, 4);

  await notifyIntel({
    userId, userEmail: email,
    kind: "sentinel",
    severity: tier === "active" ? "critical" : "notable",
    title: `Following pattern escalated to ${tier.toUpperCase()}`,
    body: String(campaign.headline || "Recurring radios around you now fit a surveillance pattern."),
    source: "Tradecraft Sentinel",
    url: "/dashboard?tab=cloud-intel&module=sentinel",
    sections: [
      { label: "Prior tier", value: prevTier.toUpperCase() },
      { label: "Indicators", value: top.map((i: any) => i?.label || i?.title || i?.type).filter(Boolean).join("; ") || "see case file" },
      {
        label: "Radios involved",
        value: [...new Set(top.flatMap((i: any) => (i?.deviceIds || []) as string[]))]
          .map((id) => names[id] || id).slice(0, 6).join(", ") || "unattributed",
      },
    ],
    findings: Array.isArray(campaign.recommendations) ? campaign.recommendations.map(String).slice(0, 6) : [],
    idempotencyKey: `sentinel:tradecraft:${userId}:${tier}:${new Date().toISOString().slice(0, 13)}`,
    skipPush: settings.push_enabled === false,
    skipEmail: settings.email_enabled === false,
  }).catch((e) => log("tradecraft alert failed", String(e)));

  return { tier, alerted: true };
}

async function areaLeg(
  db: SupabaseClient, userId: string, email: string | null, settings: Record<string, any>,
): Promise<{ status: string; notified: boolean }> {
  if (settings.geo_enabled === false) return { status: "geo_disabled", notified: false };
  const { data: pres } = await db.from("sentinel_presence").select("*").eq("user_id", userId).maybeSingle();
  if (!pres?.lat || !pres?.lng || !pres?.fix_at) return { status: "no_fix", notified: false };
  const fixAgeMs = Date.now() - new Date(pres.fix_at).getTime();
  // An unjudged arrival is someone who has just walked into somewhere they have
  // never been assessed in. Nobody is watching a tab, but they are physically
  // there now, so it still runs on the short clock — the deadline belongs to
  // the person, not to the runtime that happens to be awake.
  const pendingArrival = pres.arrival_pending === true;
  const res = await assessAndAlertArea({
    db, userId, userEmail: email,
    lat: Number(pres.lat), lng: Number(pres.lng),
    cfg: platformAreaCfg(),
    settings,
    fixAgeMs,
    maxFixAgeMs: MAX_FIX_AGE_MS,
    source: pendingArrival ? "Area Sentinel — arrival (unattended)" : "Area Sentinel (unattended)",
    mode: pendingArrival ? "fast" : "deep",
  });
  // Latch clears only on a real verdict, so a missed short-clock attempt is
  // retried on the next tick instead of being silently dropped.
  if (res.assessment && pres.place_key) await clearArrival(db, userId, pres.place_key);
  return { status: res.reason || (res.notified ? "alerted" : "clear"), notified: res.notified };
}


Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Only the platform clock may drive this. The cron secret is optional in
  // dev, but when configured it is mandatory — an open sweep endpoint would
  // let anyone burn the platform model budget.
  const secret = Deno.env.get("SENTINEL_CRON_SECRET") || "";
  if (secret) {
    const given = req.headers.get("x-cron-secret") || "";
    if (given !== secret) return json({ error: "unauthorized" }, 401, cors);
  }

  const db = admin();
  const startedAt = Date.now();
  const report: Record<string, unknown>[] = [];

  try {
    const enrolled = await enroll(db).catch((e) => { log("enroll failed", String(e)); return 0; });
    // Timestamp AFTER enrolment: a row created this tick defaults to due-now,
    // and a clock read from before the insert would skip it for a whole cycle.
    const nowIso = new Date().toISOString();
    const claimed = await claimDue(db, nowIso);
    log("tick", { enrolled, claimed: claimed.length });

    for (const { user_id, last_tier } of claimed) {
      if (Date.now() - startedAt > GLOBAL_BUDGET_MS) {
        // Hand the rest back rather than dying mid-write: due-now, next tick.
        await db.from("sentinel_cron_state")
          .update({ next_due_at: new Date().toISOString(), last_status: "deferred" })
          .eq("user_id", user_id);
        continue;
      }
      const email = await userEmail(db, user_id);
      const settings = await loadSettings(db, user_id);
      let status = "ok";
      let error: string | null = null;
      let tier = last_tier;
      let area = { status: "skipped", notified: false };

      try {
        const t = await tradecraftLeg(db, user_id, email, last_tier, settings);
        tier = t.tier;
      } catch (e) {
        error = `tradecraft: ${(e as Error).message?.slice(0, 200)}`;
        status = "partial";
      }
      try {
        area = await areaLeg(db, user_id, email, settings);
      } catch (e) {
        error = `${error ? error + " | " : ""}area: ${(e as Error).message?.slice(0, 200)}`;
        status = "partial";
      }

      const backoff = status === "partial"
        ? { next_due_at: new Date(Date.now() + Math.min(BACKOFF_CAP_MIN, 30) * 60_000).toISOString() }
        : {};
      await db.from("sentinel_cron_state").update({
        last_finished_at: new Date().toISOString(),
        last_status: status,
        last_error: error,
        last_tier: tier,
        ...backoff,
      }).eq("user_id", user_id);

      report.push({ user: user_id, tier, area: area.status, notified: area.notified, status });
    }

    return json({ ok: true, enrolled, processed: report.length, report, ms: Date.now() - startedAt }, 200, cors);
  } catch (e) {
    log("fatal", String(e));
    return json({ error: "cron_failed", detail: (e as Error).message?.slice(0, 300) }, 500, cors);
  }
});
