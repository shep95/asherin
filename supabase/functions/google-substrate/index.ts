// ═══════════════════════════════════════════════════════════════════════════
// google-substrate — the ledger control surface
// Actions: status | sweep | analyze | search | brief | dismiss
// Every action is scoped by a verified JWT. Nothing here writes to Google.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { adminClient, liveAccounts, hasScope } from "../_shared/googleMesh.ts";
import {
  runSweep, analyze, persistInsights, type SignalSource,
} from "../_shared/googleSubstrate.ts";

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Postgres websearch_to_tsquery is forgiving, but the input is still user
 *  text arriving over the wire — clamp length and strip control characters. */
const safeQuery = (raw: unknown) =>
  String(raw ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);

const SOURCES: SignalSource[] = ["gmail", "calendar", "drive", "contacts", "tasks"];

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, cors);

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
    if (uErr || !user) return json({ error: "Unauthorized" }, 401, cors);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "status");
    const sb = adminClient();

    // ── STATUS — what the ledger holds and how fresh it is ───────────────
    if (action === "status") {
      const accounts = await liveAccounts(sb, userId, null);
      const [{ count }, { data: sweeps }, { data: newest }, { data: insights }] = await Promise.all([
        sb.from("google_signals").select("id", { count: "exact", head: true }).eq("user_id", userId),
        sb.from("google_sweeps").select("*").eq("user_id", userId),
        sb.from("google_signals").select("created_at").eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(1),
        sb.from("google_insights").select("domain, severity").eq("user_id", userId).eq("dismissed", false),
      ]);
      const bySeverity: Record<string, number> = {};
      for (const i of insights ?? []) bySeverity[String(i.severity)] = (bySeverity[String(i.severity)] ?? 0) + 1;
      return json({
        accounts: accounts.map((a) => ({
          id: a.id, email: a.google_email, tier: a.consent_tier,
          surfaces: SOURCES.filter((s) => hasScope(a, {
            gmail: "gmail.readonly", calendar: "calendar.readonly",
            drive: "drive.metadata.readonly", contacts: "contacts.readonly",
            tasks: "tasks.readonly",
          }[s])),
        })),
        signals: count ?? 0,
        insights: (insights ?? []).length,
        bySeverity,
        sweeps: sweeps ?? [],
        lastIngest: newest?.[0]?.created_at ?? null,
      }, 200, cors);
    }

    // ── SWEEP — harvest every permitted surface, then derive ─────────────
    if (action === "sweep") {
      const accounts = await liveAccounts(sb, userId, body.account_id ?? null);
      if (!accounts.length) {
        return json({ error: "no_account", message: "Connect a Google account first." }, 400, cors);
      }
      const result = await runSweep(sb, userId, accounts, {
        days: Number(body.days) || 90,
        sources: Array.isArray(body.sources)
          ? body.sources.filter((s: string) => SOURCES.includes(s as SignalSource))
          : undefined,
        perSourceCap: Number(body.cap) || 200,
        budgetMs: 70_000,
      });

      // Derive immediately so a sweep always leaves the ledger interpreted.
      let derived = 0;
      try {
        const { data: rows } = await sb.from("google_signals")
          .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, counterparties, amount, currency, metadata, account_email")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(4000);
        derived = await persistInsights(sb, userId, analyze(userId, (rows ?? []) as any));
      } catch (e) {
        console.error("[google-substrate] analyze failed:", (e as Error).message);
      }

      return json({ ...result, derived }, 200, cors);
    }

    // ── ANALYZE — re-derive findings without touching Google ─────────────
    if (action === "analyze") {
      const { data: rows } = await sb.from("google_signals")
        .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, counterparties, amount, currency, metadata, account_email")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(4000);
      const derived = await persistInsights(sb, userId, analyze(userId, (rows ?? []) as any));
      return json({ derived, scanned: (rows ?? []).length }, 200, cors);
    }

    // ── SEARCH — full-text over the ledger, with facets ───────────────────
    if (action === "search") {
      const q = safeQuery(body.q);
      const limit = Math.max(1, Math.min(200, Number(body.limit) || 50));
      let sel = sb.from("google_signals")
        .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, counterparties, amount, currency, metadata, account_email")
        .eq("user_id", userId);
      if (q) sel = sel.textSearch("search", q, { type: "websearch", config: "english" });
      if (body.source && SOURCES.includes(body.source)) sel = sel.eq("source", body.source);
      if (body.person) sel = sel.contains("counterparties", [String(body.person).toLowerCase()]);
      if (body.since) sel = sel.gte("occurred_at", String(body.since));
      if (body.until) sel = sel.lte("occurred_at", String(body.until));
      const { data, error } = await sel.order("occurred_at", { ascending: false }).limit(limit);
      if (error) return json({ error: error.message }, 400, cors);
      return json({ results: data ?? [], count: (data ?? []).length }, 200, cors);
    }

    // ── BRIEF — the organized intelligence report ────────────────────────
    if (action === "brief") {
      const [{ data: insights }, { data: recent }, { count }] = await Promise.all([
        sb.from("google_insights").select("*").eq("user_id", userId).eq("dismissed", false)
          .order("severity", { ascending: false }).order("computed_at", { ascending: false }).limit(120),
        sb.from("google_signals")
          .select("id, source, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, amount, currency, metadata, account_email")
          .eq("user_id", userId).order("occurred_at", { ascending: false }).limit(40),
        sb.from("google_signals").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      const byDomain: Record<string, unknown[]> = {};
      for (const i of insights ?? []) (byDomain[i.domain] ??= []).push(i);
      return json({
        totalSignals: count ?? 0,
        insights: insights ?? [],
        byDomain,
        recent: recent ?? [],
        generatedAt: new Date().toISOString(),
      }, 200, cors);
    }

    // ── DISMISS — a finding the human has judged and closed ──────────────
    if (action === "dismiss") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id required" }, 400, cors);
      const { error } = await sb.from("google_insights")
        .update({ dismissed: true }).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: `Unknown action: ${action}` }, 400, cors);
  } catch (e) {
    console.error("[google-substrate]", (e as Error).message);
    return json({ error: (e as Error).message }, 500, cors);
  }
});
