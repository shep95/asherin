// ═══════════════════════════════════════════════════════════════════════════
// op-layer-cron — TIER 3. The layer that never stops.
//
// Tiers 1 and 2 are tied to a device being awake. This one is not: it reasons
// over what every device has ALREADY reported, so it can still raise an alert
// with the phone in a pocket, the laptop shut and the tablet at home. It is
// also the only tier that can notice a device has gone silent, because a
// silent device cannot report its own silence.
//
// Invariants carried from sentinel-cron, for the same reasons:
//   • Claim-before-work — next_due_at moves forward in the same UPDATE that
//     selects the row, so overlapping ticks cannot double-alert.
//   • Wall-clock budget — a slow account degrades to a partial batch, never a
//     platform timeout.
//   • Escalation-only alerting — enforced inside runOpSweep.
//   • No user id from the request body; the clock is the only caller.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runOpSweep } from "../_shared/opSweep.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH = 10;
const GLOBAL_BUDGET_MS = 100_000;
const BACKOFF_MIN = 30;

const json = (b: unknown, s: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Anyone with a device on a roster is under watch. Enrolment repeats every
 *  tick so an account that appeared while this function was down is picked up. */
async function enroll(db: SupabaseClient): Promise<number> {
  const { data } = await db.from("op_devices").select("user_id").eq("revoked", false).limit(20000);
  const ids = [...new Set((data ?? []).map((r: any) => r.user_id))];
  if (!ids.length) return 0;
  const { data: known } = await db.from("op_cron_state").select("user_id").in("user_id", ids);
  const have = new Set((known ?? []).map((r: any) => r.user_id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    await db.from("op_cron_state").insert(missing.map((user_id) => ({ user_id, enabled: true, next_due_at: new Date().toISOString() })));
  }
  return missing.length;
}

async function claimDue(db: SupabaseClient, nowIso: string): Promise<string[]> {
  const { data: due } = await db.from("op_cron_state")
    .select("user_id,interval_minutes").eq("enabled", true).lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true }).limit(BATCH);
  const rows = due ?? [];
  const claimed: string[] = [];
  for (const r of rows as any[]) {
    const next = new Date(Date.now() + Math.max(10, r.interval_minutes ?? 30) * 60_000).toISOString();
    const { data: won } = await db.from("op_cron_state")
      .update({ next_due_at: next, last_started_at: nowIso, last_status: "running" })
      .eq("user_id", r.user_id).lte("next_due_at", nowIso).select("user_id").maybeSingle();
    if (won) claimed.push(r.user_id);
  }
  return claimed;
}

async function userEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const secret = Deno.env.get("SENTINEL_CRON_SECRET") || "";
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) {
    return json({ error: "unauthorized" }, 401, cors);
  }

  const db = admin();
  const startedAt = Date.now();
  const report: Record<string, unknown>[] = [];

  try {
    const enrolled = await enroll(db).catch(() => 0);
    const nowIso = new Date().toISOString();
    const claimed = await claimDue(db, nowIso);

    for (const userId of claimed) {
      if (Date.now() - startedAt > GLOBAL_BUDGET_MS) {
        await db.from("op_cron_state").update({ next_due_at: new Date().toISOString(), last_status: "deferred" }).eq("user_id", userId);
        continue;
      }
      try {
        const email = await userEmail(db, userId);
        const sweep = await runOpSweep(db, userId, email);
        await db.from("op_cron_state").update({ last_finished_at: new Date().toISOString(), last_status: "ok", failures: 0 }).eq("user_id", userId);
        report.push({ user: userId, posture: sweep.posture.label, score: sweep.posture.score, findings: sweep.findings.length, notified: sweep.notified, actions: sweep.actionsQueued });
      } catch (e) {
        console.error("[op-layer-cron] account failed", userId, String(e));
        await db.from("op_cron_state").update({
          last_finished_at: new Date().toISOString(),
          last_status: "error",
          next_due_at: new Date(Date.now() + BACKOFF_MIN * 60_000).toISOString(),
        }).eq("user_id", userId);
        report.push({ user: userId, status: "error" });
      }
    }

    return json({ ok: true, enrolled, processed: report.length, report, ms: Date.now() - startedAt }, 200, cors);
  } catch (e) {
    console.error("[op-layer-cron] fatal", String(e));
    return json({ error: "cron_failed" }, 500, cors);
  }
});
