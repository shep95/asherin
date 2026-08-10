// ═══════════════════════════════════════════════════════════════════════════
// organism-cron — the heartbeat that does not need anyone to be awake
//
// A body that only metabolises while its owner is looking at it is not alive.
// This is the involuntary system: it claims due accounts, runs one full
// metabolism pass each, and moves on inside a wall-clock budget so one slow
// account degrades the batch instead of killing the tick.
//
// Invariants (same discipline as every other clock on this platform):
//   • the account is never taken from the request body — the clock is the only
//     caller, and the only authority is the shared cron secret
//   • claim-before-work: next_due_at moves forward in the SAME update that
//     wins the row, so overlapping ticks cannot double-metabolise
//   • renewal (the destructive pass) runs exactly once per tick, not per user
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { metabolize } from "../_shared/organism/metabolism.ts";
import { renewalPass } from "../_shared/organism/homeostasis.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const BATCH = 12;
const BUDGET_MS = 100_000;
const INTERVAL_MINUTES = 30;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Anyone whose organs have ever produced blood is metabolised. */
async function enroll(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from("organism_events")
    .select("user_id")
    .gte("observed_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .limit(20000);
  const ids = [...new Set((data ?? []).map((r: any) => r.user_id))];
  if (!ids.length) return 0;
  const { data: known } = await db.from("organism_state").select("user_id").in("user_id", ids);
  const have = new Set((known ?? []).map((r: any) => r.user_id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    await db.from("organism_state").upsert(
      missing.map((user_id) => ({ user_id, calibration: 0.5 })),
      { onConflict: "user_id" },
    );
  }
  return missing.length;
}

async function claimDue(db: SupabaseClient): Promise<string[]> {
  const cutoff = new Date(Date.now() - INTERVAL_MINUTES * 60_000).toISOString();
  const { data: due } = await db
    .from("organism_state")
    .select("user_id,last_metabolism_at")
    .or(`last_metabolism_at.is.null,last_metabolism_at.lte.${cutoff}`)
    .order("last_metabolism_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const claimed: string[] = [];
  const nowIso = new Date().toISOString();
  for (const row of (due ?? []) as any[]) {
    // Winning the claim IS the update — a losing tick matches zero rows.
    let q = db.from("organism_state").update({ last_metabolism_at: nowIso }).eq("user_id", row.user_id);
    q = row.last_metabolism_at === null ? q.is("last_metabolism_at", null) : q.lte("last_metabolism_at", cutoff);
    const { data: won } = await q.select("user_id").maybeSingle();
    if (won) claimed.push(row.user_id);
  }
  return claimed;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const supplied = req.headers.get("x-cron-secret") ?? "";
  if (!supplied) return json({ error: "forbidden" }, 403);

  const db = admin();

  // Two authorities are accepted, and only these two: the platform-wide cron
  // secret (env) and the row the scheduler itself reads from cron_tokens.
  // The DB token exists because pg_cron cannot read edge-function env vars.
  let authorised = CRON_SECRET.length > 0 && supplied === CRON_SECRET;
  if (!authorised) {
    const { data: tok } = await db
      .from("cron_tokens")
      .select("token")
      .eq("name", "organism_cron")
      .maybeSingle();
    authorised = typeof tok?.token === "string" && tok.token.length > 0 && tok.token === supplied;
  }
  if (!authorised) return json({ error: "forbidden" }, 403);

  const started = Date.now();


  try {
    const enrolled = await enroll(db);
    const users = await claimDue(db);

    let metabolised = 0;
    let stories = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const userId of users) {
      if (Date.now() - started > BUDGET_MS) {
        skipped = users.length - metabolised;
        break;
      }
      try {
        const r = await metabolize(db, userId, { windowHours: 72, renew: false });
        metabolised += 1;
        stories += r.stories.length;
      } catch (e) {
        errors.push(`${userId.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Death and renewal — once per tick, globally, after everyone has thought.
    const purged = await renewalPass(db);

    return json({ ok: true, enrolled, claimed: users.length, metabolised, stories, purged, skipped, errors, tookMs: Date.now() - started });
  } catch (e) {
    console.error("[organism-cron]", e instanceof Error ? e.message : String(e));
    return json({ error: "cron failure" }, 500);
  }
});
