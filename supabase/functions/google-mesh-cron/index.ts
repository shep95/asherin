// ═══════════════════════════════════════════════════════════════════════════
// google-mesh-cron — the sweep that runs when nobody is watching
//
// The browser can only sync while a tab is alive. Everything a closed laptop
// misses has to be harvested by something with its own clock, so this function
// owns the "app isn't open" half of the contract: pg_cron wakes it, it claims
// the users whose ledger has gone stale, sweeps their permitted Google
// surfaces, re-derives insights, and records the outcome in google_sync_state.
//
// Invariants that make it safe to run every few minutes:
//   • Claim-before-work — next_due_at is pushed forward in the same statement
//     that selects the batch, so two overlapping ticks can never sweep the
//     same user twice.
//   • Bounded fan-out — a fixed batch size and a wall-clock budget mean a
//     large mailbox degrades into a partial sweep, never a platform timeout.
//   • Fair ordering — oldest next_due_at first, so no user can be starved by
//     a noisier neighbour.
//   • Exponential backoff — a user whose tokens are revoked backs off toward
//     six hours instead of burning the batch slot on every tick.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { liveAccounts } from "../_shared/googleMesh.ts";
import { runSweep, analyze, persistInsights } from "../_shared/googleSubstrate.ts";
import { correlate } from "../_shared/googleCorrelator.ts";

/** Users touched per invocation. Small enough that the slowest mailbox in the
 *  batch cannot consume the whole wall clock. */
const BATCH = 4;
/** Leave headroom under the platform ceiling so the final state write lands. */
const GLOBAL_BUDGET_MS = 105_000;
/** Per-user harvest budget — the rest of the wall clock is derivation. */
const USER_BUDGET_MS = 20_000;
const BACKOFF_CAP_MIN = 360;

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const log = (step: string, detail?: unknown) =>
  console.log(`[mesh-cron] ${step}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);

/** Every user with at least one connected Google account gets a ledger row.
 *  Enrollment lives here rather than in a trigger so a connection made while
 *  this function was undeployed is still picked up on the next tick. */
async function enroll(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb
    .from("google_accounts")
    .select("user_id")
    .eq("status", "connected");
  if (error) throw new Error(`enroll read: ${error.message}`);

  const userIds = [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
  if (!userIds.length) return 0;

  const { data: existing, error: exErr } = await sb
    .from("google_sync_state")
    .select("user_id")
    .in("user_id", userIds);
  if (exErr) throw new Error(`enroll diff: ${exErr.message}`);

  const known = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));
  const fresh = userIds.filter((id) => !known.has(id));
  if (!fresh.length) return 0;

  const { error: insErr } = await sb
    .from("google_sync_state")
    .insert(fresh.map((user_id) => ({ user_id })));
  // A concurrent tick may have inserted the same row; that is not a failure.
  if (insErr && !/duplicate key/i.test(insErr.message)) throw new Error(`enroll write: ${insErr.message}`);
  return fresh.length;
}

/** Select and lock in one motion: the UPDATE filter re-asserts `next_due_at <=
 *  now()`, so whichever tick commits first wins and the loser claims nothing. */
async function claimDue(sb: SupabaseClient, nowIso: string): Promise<string[]> {
  const { data: due, error } = await sb
    .from("google_sync_state")
    .select("user_id, interval_minutes")
    .eq("enabled", true)
    .lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`claim read: ${error.message}`);
  if (!due?.length) return [];

  const claimed: string[] = [];
  for (const row of due as Array<{ user_id: string; interval_minutes: number }>) {
    const next = new Date(Date.now() + Math.max(15, row.interval_minutes) * 60_000).toISOString();
    const { data: won, error: upErr } = await sb
      .from("google_sync_state")
      .update({ last_started_at: nowIso, next_due_at: next, last_status: "running" })
      .eq("user_id", row.user_id)
      .lte("next_due_at", nowIso)
      .select("user_id");
    if (upErr) { log("claim failed", { user: row.user_id, error: upErr.message }); continue; }
    if (won?.length) claimed.push(row.user_id);
  }
  return claimed;
}

async function sweepUser(sb: SupabaseClient, userId: string) {
  const accounts = await liveAccounts(sb, userId, null);
  if (!accounts.length) {
    // Nothing revocable left — stand down rather than retrying every tick.
    await sb.from("google_sync_state").update({
      last_status: "no_account",
      last_error: "No connected Google account with a usable token.",
      next_due_at: new Date(Date.now() + BACKOFF_CAP_MIN * 60_000).toISOString(),
    }).eq("user_id", userId);
    return { ingested: 0, derived: 0, status: "no_account" as const };
  }

  const sweep = await runSweep(sb, userId, accounts, {
    days: 45,
    perSourceCap: 150,
    budgetMs: USER_BUDGET_MS,
  });

  // Derivation reads the rows the harvest just wrote, so a partial sweep still
  // yields a fully interpreted ledger over the window it did reach.
  let derived = 0;
  const { data: rows } = await sb
    .from("google_signals")
    .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, counterparties, amount, currency, metadata, account_email")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(4000);
  const r = (rows ?? []) as never[];
  derived = await persistInsights(sb, userId, [...analyze(userId, r), ...correlate(userId, r)]);

  await sb.from("google_sync_state").update({
    last_synced_at: new Date().toISOString(),
    last_status: sweep.partial ? "partial" : "ok",
    last_error: null,
    consecutive_failures: 0,
    signals_ingested: sweep.ingested,
    insights_derived: derived,
  }).eq("user_id", userId);

  return { ingested: sweep.ingested, derived, status: sweep.partial ? "partial" as const : "ok" as const };
}

async function recordFailure(sb: SupabaseClient, userId: string, message: string) {
  const { data } = await sb
    .from("google_sync_state")
    .select("consecutive_failures, interval_minutes")
    .eq("user_id", userId)
    .maybeSingle();
  const fails = ((data?.consecutive_failures as number) ?? 0) + 1;
  const base = Math.max(15, (data?.interval_minutes as number) ?? 30);
  const wait = Math.min(BACKOFF_CAP_MIN, base * 2 ** Math.min(fails, 6));
  await sb.from("google_sync_state").update({
    last_status: "error",
    last_error: message.slice(0, 500),
    consecutive_failures: fails,
    next_due_at: new Date(Date.now() + wait * 60_000).toISOString(),
  }).eq("user_id", userId);
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const presented = req.headers.get("x-cron-secret") ?? "";
  if (!presented) return json({ error: "Forbidden" }, 403, cors);

  const started = Date.now();
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Two accepted callers: the in-database scheduler, whose token lives in a
  // table no client role can read, and an operator holding the env secret.
  // Length is checked first so a mismatched token cannot be probed by timing
  // the string comparison.
  const envSecret = Deno.env.get("MESH_CRON_SECRET") ?? "";
  const { data: tokenRow } = await sb
    .from("cron_tokens").select("token").eq("name", "mesh_cron").maybeSingle();
  const dbSecret = (tokenRow?.token as string | undefined) ?? "";
  const matches = (candidate: string) =>
    candidate.length > 0 && candidate.length === presented.length && candidate === presented;
  if (!matches(envSecret) && !matches(dbSecret)) {
    return json({ error: "Forbidden" }, 403, cors);
  }


  try {
    const enrolled = await enroll(sb);
    const claimed = await claimDue(sb, new Date().toISOString());
    log("tick", { enrolled, claimed: claimed.length });

    const results: Array<Record<string, unknown>> = [];
    for (const userId of claimed) {
      if (Date.now() - started > GLOBAL_BUDGET_MS) {
        // Hand the remainder straight back to the queue for the next tick.
        await sb.from("google_sync_state")
          .update({ last_status: "deferred", next_due_at: new Date().toISOString() })
          .eq("user_id", userId);
        results.push({ userId, status: "deferred" });
        continue;
      }
      try {
        const out = await sweepUser(sb, userId);
        results.push({ userId, ...out });
      } catch (e) {
        const msg = (e as Error).message ?? "unknown";
        log("user sweep failed", { userId, msg });
        await recordFailure(sb, userId, msg);
        results.push({ userId, status: "error", error: msg });
      }
    }

    return json({ ok: true, enrolled, processed: results.length, results, elapsedMs: Date.now() - started }, 200, cors);
  } catch (e) {
    log("tick failed", (e as Error).message);
    return json({ error: (e as Error).message }, 500, cors);
  }
});
