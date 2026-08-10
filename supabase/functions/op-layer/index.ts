// ═══════════════════════════════════════════════════════════════════════════
// OP LAYER — DEVICE ENDPOINT
//
// Every device signed into an account talks to exactly this function. It is
// the only writable seam into the account's shared ledger, which is why every
// action is authenticated with the caller's own session and every write is
// scoped to `auth.uid()` rather than to any identifier the client supplies.
// A device cannot enrol into, report for, or read another account's roster,
// because the account is never taken from the request body.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { runOpSweep } from "../_shared/opSweep.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SignalSchema = z.object({
  type: z.enum(["dns", "tls", "webrtc", "geodrift", "egress", "ble", "credential", "geo", "roster", "posture"]),
  verdict: z.enum(["clean", "anomalous", "hostile", "unknown"]).default("unknown"),
  confidence: z.number().min(0).max(1).default(0.5),
  networkKey: z.string().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  accuracy: z.number().min(0).max(1e6).nullable().optional(),
  evidence: z.record(z.unknown()).default({}),
  observedAt: z.string().datetime().optional(),
});

const Body = z.object({
  token: z.string().min(32).max(200).optional(),
  action: z.enum(["enroll", "report", "state", "trust", "revoke", "acknowledge", "action-outcome", "settings", "sweep"]),
  deviceId: z.string().min(8).max(120).optional(),
  label: z.string().max(120).nullable().optional(),
  platform: z.string().max(80).nullable().optional(),
  appVersion: z.string().max(40).nullable().optional(),
  formFactor: z.enum(["phone", "tablet", "laptop", "desktop", "unknown"]).optional(),
  fingerprint: z.record(z.unknown()).optional(),
  consentLevel: z.enum(["identity", "read", "comprehension"]).optional(),
  expectedIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  tier: z.enum(["foreground", "background", "server"]).optional(),
  signals: z.array(SignalSchema).max(60).optional(),
  network: z.object({
    key: z.string().min(1).max(200),
    label: z.string().max(120).nullable().optional(),
    asn: z.string().max(60).nullable().optional(),
    org: z.string().max(160).nullable().optional(),
    country: z.string().max(8).nullable().optional(),
  }).optional(),
  trusted: z.boolean().optional(),
  findingId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  outcome: z.enum(["executed", "failed", "declined"]).optional(),
  enabled: z.boolean().optional(),
  autoResponse: z.boolean().optional(),
  intervalMinutes: z.number().int().min(10).max(720).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Malformed request body." }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  // ── TIER 2 ─ background worker, opaque device token ────────────────────
  // The worker outlives the tab but holds no session, so it authenticates with
  // the same revocable single-capability token the Sentinel already mints. It
  // is allowed exactly one action — filing a presence reading — and can never
  // read the ledger, change the roster, or act. Least privilege by shape, not
  // by promise.
  if (b.token) {
    if (b.action !== "report") return json({ error: "Token auth permits reporting only." }, 403);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(b.token));
    const tokenHash = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const { data: dev } = await admin.from("sentinel_devices").select("user_id,revoked").eq("token_hash", tokenHash).maybeSingle();
    if (!dev || dev.revoked) return json({ error: "Unknown or revoked device token." }, 403);
    if (!b.deviceId) return json({ error: "deviceId required" }, 400);

    const { data: roster } = await admin.from("op_devices").select("device_id,revoked").eq("user_id", dev.user_id).eq("device_id", b.deviceId).maybeSingle();
    if (!roster || roster.revoked) return json({ error: "Device is not on this account roster." }, 403);

    const stamp = new Date().toISOString();
    const rows = (b.signals ?? []).slice(0, 8).map((s) => ({
      user_id: dev.user_id,
      device_id: b.deviceId!,
      signal_type: s.type,
      verdict: s.verdict,
      confidence: Math.min(s.confidence, 0.5), // a worker sees less; it may claim less
      network_key: s.networkKey ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      accuracy: s.accuracy ?? null,
      runtime_tier: "background",
      evidence: s.evidence,
      observed_at: s.observedAt ?? stamp,
    }));
    if (rows.length) await admin.from("op_signals").insert(rows);
    await admin.from("op_devices").update({ last_report_at: stamp, last_tier: "background", updated_at: stamp })
      .eq("user_id", dev.user_id).eq("device_id", b.deviceId);
    // Correlation stays on the server clock: a background beacon must be cheap.
    await admin.from("op_cron_state").upsert({ user_id: dev.user_id, enabled: true, next_due_at: stamp }, { onConflict: "user_id" });
    return json({ ok: true, tier: "background" });
  }

  const db = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await db.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Authentication required." }, 401);
  // The correlation sweep writes the account's ledger (findings, actions, cron
  // state) — rows the client is deliberately not allowed to author under RLS.
  // Identity still comes from the verified session above, never from the body,
  // so elevating the writer does not widen who the sweep can see or touch.
  const ledger = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();


  try {
    switch (b.action) {
      // ── ENROL ───────────────────────────────────────────────────────────
      // A device joining the roster inherits the account's posture on its very
      // first minute instead of starting cold.
      case "enroll": {
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        await db.from("op_devices").upsert({
          user_id: user.id,
          device_id: b.deviceId,
          label: b.label ?? null,
          platform: b.platform ?? null,
          app_version: b.appVersion ?? null,
          form_factor: b.formFactor ?? "unknown",
          fingerprint: b.fingerprint ?? {},
          consent_level: b.consentLevel ?? "identity",
          expected_interval_minutes: b.expectedIntervalMinutes ?? 30,
          updated_at: nowIso,
        }, { onConflict: "user_id,device_id" });

        await db.from("op_cron_state").upsert(
          { user_id: user.id, enabled: true, next_due_at: nowIso },
          { onConflict: "user_id", ignoreDuplicates: true },
        );

        const [nets, findings] = await Promise.all([
          db.from("op_networks").select("network_key,label,org,country,verdict,hostile_reports,clean_reports").eq("user_id", user.id).order("hostile_reports", { ascending: false }).limit(100),
          db.from("op_findings").select("code,title,severity,confidence,response_tier,recommendations").eq("user_id", user.id).eq("status", "open").order("confidence", { ascending: false }).limit(30),
        ]);
        return json({ ok: true, inherited: { networks: nets.data ?? [], findings: findings.data ?? [] } });
      }

      // ── REPORT ──────────────────────────────────────────────────────────
      case "report": {
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        const { data: dev } = await db.from("op_devices").select("device_id,revoked").eq("user_id", user.id).eq("device_id", b.deviceId).maybeSingle();
        if (!dev) return json({ error: "Device is not enrolled on this account." }, 403);
        if (dev.revoked) return json({ error: "Device revoked." }, 403);

        const rows = (b.signals ?? []).map((s) => ({
          user_id: user.id,
          device_id: b.deviceId!,
          signal_type: s.type,
          verdict: s.verdict,
          confidence: s.confidence,
          network_key: s.networkKey ?? b.network?.key ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          accuracy: s.accuracy ?? null,
          runtime_tier: b.tier ?? "foreground",
          evidence: s.evidence,
          observed_at: s.observedAt ?? nowIso,
        }));
        if (rows.length) await db.from("op_signals").insert(rows);

        if (b.network) {
          const adverse = (b.signals ?? []).filter((s) => s.verdict === "hostile" || s.verdict === "anomalous").length;
          const clean = (b.signals ?? []).filter((s) => s.verdict === "clean").length;
          const { data: existing } = await db.from("op_networks").select("id,hostile_reports,clean_reports,devices_seen").eq("user_id", user.id).eq("network_key", b.network.key).maybeSingle();
          await db.from("op_networks").upsert({
            user_id: user.id,
            network_key: b.network.key,
            label: b.network.label ?? null,
            asn: b.network.asn ?? null,
            org: b.network.org ?? null,
            country: b.network.country ?? null,
            hostile_reports: (existing?.hostile_reports ?? 0) + (adverse > 0 ? 1 : 0),
            clean_reports: (existing?.clean_reports ?? 0) + (adverse === 0 && clean > 0 ? 1 : 0),
            devices_seen: existing?.devices_seen ?? 1,
            verdict: adverse > 0 ? "hostile" : (existing?.hostile_reports ?? 0) > 0 ? "watch" : "clean",
            last_seen: nowIso,
          }, { onConflict: "user_id,network_key" });
        }

        await db.from("op_devices").update({ last_report_at: nowIso, last_tier: b.tier ?? "foreground", updated_at: nowIso })
          .eq("user_id", user.id).eq("device_id", b.deviceId);

        const sweep = await runOpSweep(ledger as any, user.id, user.email ?? null);
        const { data: pending } = await db.from("op_actions")
          .select("id,action,rationale,requested_at").eq("user_id", user.id).eq("outcome", "pending")
          .or(`device_id.eq.${b.deviceId},device_id.is.null`).limit(10);

        return json({ ok: true, posture: sweep.posture, findings: sweep.findings, directives: pending ?? [] });
      }

      // ── STATE / SWEEP ───────────────────────────────────────────────────
      case "sweep":
      case "state": {
        if (b.action === "sweep") await runOpSweep(ledger as any, user.id, user.email ?? null);
        const [devices, findings, actions, networks, signals, state] = await Promise.all([
          db.from("op_devices").select("*").eq("user_id", user.id).order("last_report_at", { ascending: false, nullsFirst: false }).limit(100),
          db.from("op_findings").select("*").eq("user_id", user.id).neq("status", "expired").order("confidence", { ascending: false }).limit(80),
          db.from("op_actions").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(60),
          db.from("op_networks").select("*").eq("user_id", user.id).order("last_seen", { ascending: false }).limit(60),
          db.from("op_signals").select("device_id,signal_type,verdict,network_key,runtime_tier,observed_at").eq("user_id", user.id).order("observed_at", { ascending: false }).limit(120),
          db.from("op_cron_state").select("*").eq("user_id", user.id).maybeSingle(),
        ]);
        return json({
          ok: true,
          devices: devices.data ?? [],
          findings: findings.data ?? [],
          actions: actions.data ?? [],
          networks: networks.data ?? [],
          signals: signals.data ?? [],
          state: state.data ?? null,
        });
      }

      // ── ROSTER CONTROL ──────────────────────────────────────────────────
      case "trust": {
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        await db.from("op_devices").update({ trusted: b.trusted !== false, updated_at: nowIso })
          .eq("user_id", user.id).eq("device_id", b.deviceId);
        await db.from("op_findings").update({ status: "resolved" }).eq("user_id", user.id).eq("code", `roster-stranger:${b.deviceId}`);
        return json({ ok: true });
      }
      case "revoke": {
        if (!b.deviceId) return json({ error: "deviceId required" }, 400);
        await db.from("op_devices").update({ revoked: true, trusted: false, updated_at: nowIso })
          .eq("user_id", user.id).eq("device_id", b.deviceId);
        return json({ ok: true });
      }
      case "acknowledge": {
        if (!b.findingId) return json({ error: "findingId required" }, 400);
        await db.from("op_findings").update({ acknowledged_at: nowIso, status: "acknowledged" })
          .eq("user_id", user.id).eq("id", b.findingId);
        return json({ ok: true });
      }
      case "action-outcome": {
        if (!b.actionId || !b.outcome) return json({ error: "actionId and outcome required" }, 400);
        await db.from("op_actions").update({ outcome: b.outcome, executed_at: nowIso })
          .eq("user_id", user.id).eq("id", b.actionId);
        return json({ ok: true });
      }
      case "settings": {
        await db.from("op_cron_state").upsert({
          user_id: user.id,
          enabled: b.enabled ?? true,
          auto_response_enabled: b.autoResponse ?? true,
          interval_minutes: b.intervalMinutes ?? 30,
        }, { onConflict: "user_id" });
        return json({ ok: true });
      }
    }
  } catch (e) {
    console.error("[op-layer]", String(e));
    return json({ error: "OP layer request failed." }, 500);
  }
  return json({ error: "Unsupported action." }, 400);
});
