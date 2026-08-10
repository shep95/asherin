// ═══════════════════════════════════════════════════════════════════════════
// OP LAYER — SWEEP (shared by the on-demand endpoint and the server clock)
//
// One code path produces findings, whichever runtime asked. If the browser
// sweep and the unattended sweep could diverge, the account's posture would
// depend on whether a tab happened to be open — which is the exact failure the
// OP layer exists to remove.
//
// Ordering is deliberate and non-negotiable:
//   1. read the roster, the recent signal window, the network posture
//   2. correlate (pure)
//   3. upsert findings, ESCALATION-ONLY on notification
//   4. for anything that reached `act`, write the audit row BEFORE queueing the
//      directive — never the other way round
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correlate, posture, type OpDevice, type OpFinding, type OpNetwork, type OpSignal } from "./opCorrelation.ts";
import { notifyIntel } from "./intelNotify.ts";

const SIGNAL_WINDOW_MS = 7 * 24 * 3_600_000;
const SEV_RANK: Record<string, number> = { informational: 0, elevated: 1, high: 2, critical: 3 };

/** The directive a finding earns when it is allowed to act. Each one is
 *  reversible and device-scoped: nothing here can be account-wide, because a
 *  correlation engine should never be able to lock a person out of everything
 *  from a reading it made itself. */
function directiveFor(f: OpFinding): { action: string; scope: "device" | "advisory" } | null {
  if (f.responseTier !== "act") return null;
  switch (true) {
    case f.code === "credential-plus-stranger":
    case f.code === "credential-exposure":
      return { action: "force_credential_rotation", scope: "device" };
    case f.code === "cross-network-pressure":
    case f.code === "tls-interception":
    case f.code === "dns-integrity":
      return { action: "engage_vpn_profile", scope: "device" };
    case f.code.startsWith("roster-stranger:"):
    case f.code.startsWith("geo-contradiction:"):
      return { action: "lock_session", scope: "device" };
    default:
      return null;
  }
}

/**
 * Folds two ledgers the platform already maintains into the OP signal stream:
 *
 *   RADIO    — ble_devices carries the recurrence facts the Bluetooth Sentinel
 *              measured (distinct days, distinct places, threat tier). A radio
 *              seen once in one place is noise; the same radio across separate
 *              days AND separate places is the signature of being followed.
 *   IDENTITY — Ghost Engine capture rows that contain the account's own email
 *              on a paste/leak host. A leaked credential is an account risk in
 *              exactly the way a hostile network is, so it is watched here
 *              continuously rather than only when that panel is opened.
 *
 * These are synthesised, not persisted: writing them back into op_signals
 * would double-count on the next sweep.
 */
async function ingestRadioAndIdentity(
  db: SupabaseClient,
  userId: string,
  userEmail: string | null,
  devices: OpDevice[],
  now: number,
): Promise<OpSignal[]> {
  const out: OpSignal[] = [];
  // Attribute to the device that most recently reported: the reading came from
  // this account's fleet, and an unattributed signal cannot corroborate.
  const anchor = devices.filter((d) => !d.revoked)
    .sort((a, b) => Date.parse(b.last_report_at ?? "0") - Date.parse(a.last_report_at ?? "0"))[0]?.device_id;
  if (!anchor) return out;

  try {
    const { data: radios } = await db.from("ble_devices")
      .select("fingerprint,display_name,manufacturer,threat_tier,distinct_days,distinct_places,encounter_count,last_seen,is_self,is_ignored")
      .eq("user_id", userId).eq("is_self", false).eq("is_ignored", false)
      .gte("last_seen", new Date(now - 7 * 24 * 3_600_000).toISOString())
      .limit(200);
    for (const r of (radios ?? []) as any[]) {
      const tier = String(r.threat_tier ?? "none").toLowerCase();
      const following = (r.distinct_days ?? 0) >= 2 && (r.distinct_places ?? 0) >= 2;
      if (tier !== "active" && tier !== "probable" && !following) continue;
      out.push({
        device_id: anchor,
        signal_type: "ble",
        verdict: tier === "active" ? "hostile" : "anomalous",
        confidence: tier === "active" ? 0.6 : 0.45,
        network_key: null, lat: null, lng: null, accuracy: null,
        runtime_tier: "server",
        evidence: {
          radio: r.display_name || r.manufacturer || String(r.fingerprint ?? "").slice(0, 10),
          tier, distinctDays: r.distinct_days, distinctPlaces: r.distinct_places, encounters: r.encounter_count,
        },
        observed_at: r.last_seen ?? new Date(now).toISOString(),
      });
    }
  } catch (e) {
    console.error("[opSweep] radio ingest failed", String(e));
  }

  if (userEmail) {
    try {
      const { data: caught } = await db.from("ghost_sessions")
        .select("host,url,emails,captured_at,source_type")
        .eq("user_id", userId)
        .contains("emails", [userEmail.toLowerCase()])
        .gte("captured_at", new Date(now - 30 * 24 * 3_600_000).toISOString())
        .limit(20);
      for (const c of (caught ?? []) as any[]) {
        out.push({
          device_id: anchor,
          signal_type: "credential",
          verdict: "hostile",
          confidence: 0.6,
          network_key: null, lat: null, lng: null, accuracy: null,
          runtime_tier: "server",
          evidence: { host: c.host, url: c.url, sourceType: c.source_type, capturedAt: c.captured_at, note: "Account identifier found in publicly reachable content by the exposure sweep." },
          observed_at: c.captured_at ?? new Date(now).toISOString(),
        });
      }
    } catch (e) {
      console.error("[opSweep] identity ingest failed", String(e));
    }
  }

  return out;
}

export interface SweepResult {
  findings: OpFinding[];
  posture: ReturnType<typeof posture>;
  notified: number;
  actionsQueued: number;
}

export async function runOpSweep(
  db: SupabaseClient,
  userId: string,
  userEmail: string | null,
  opts: { now?: number; allowActions?: boolean } = {},
): Promise<SweepResult> {
  const now = opts.now ?? Date.now();
  const since = new Date(now - SIGNAL_WINDOW_MS).toISOString();

  const [devRes, sigRes, netRes, openRes, stateRes] = await Promise.all([
    db.from("op_devices").select("device_id,label,platform,form_factor,consent_level,trusted,revoked,enrolled_at,last_report_at,expected_interval_minutes").eq("user_id", userId).limit(200),
    db.from("op_signals").select("device_id,signal_type,verdict,confidence,network_key,lat,lng,accuracy,runtime_tier,evidence,observed_at").eq("user_id", userId).gte("observed_at", since).order("observed_at", { ascending: false }).limit(3000),
    db.from("op_networks").select("network_key,label,org,country,verdict,hostile_reports,clean_reports,devices_seen,first_seen").eq("user_id", userId).limit(500),
    db.from("op_findings").select("id,code,severity,status,response_tier,confidence").eq("user_id", userId).limit(500),
    db.from("op_cron_state").select("auto_response_enabled").eq("user_id", userId).maybeSingle(),
  ]);

  const devices = (devRes.data ?? []) as unknown as OpDevice[];
  const signals = (sigRes.data ?? []) as unknown as OpSignal[];
  const networks = (netRes.data ?? []) as unknown as OpNetwork[];
  const prior = new Map((openRes.data ?? []).map((r: any) => [r.code, r]));

  // Radio and identity legs are not re-collected here — they are already
  // measured elsewhere in the platform. Re-deriving them would create a second
  // source of truth that could disagree with the first, so the OP layer reads
  // the existing ledgers and folds them in as ordinary signals instead.
  signals.push(...(await ingestRadioAndIdentity(db, userId, userEmail, devices, now)));

  const findings = correlate({ now, devices, signals, networks });
  const post = posture(findings, devices);

  const autoAllowed = opts.allowActions !== false && stateRes.data?.auto_response_enabled !== false;
  let notified = 0;
  let actionsQueued = 0;

  for (const f of findings) {
    const before = prior.get(f.code) as any | undefined;
    const nowIso = new Date(now).toISOString();

    const row = {
      user_id: userId,
      code: f.code,
      title: f.title,
      narrative: f.narrative,
      severity: f.severity,
      confidence: f.confidence,
      corroborating_devices: f.corroboratingDevices,
      distinct_signal_types: f.distinctSignalTypes,
      response_tier: f.responseTier,
      exposed_device_id: f.exposedDeviceId,
      evidence: f.evidence,
      recommendations: f.recommendations,
      first_seen: before ? undefined : f.firstSeen,
      last_seen: f.lastSeen || nowIso,
      status: before?.status === "resolved" && SEV_RANK[f.severity] <= SEV_RANK[before.severity] ? "resolved" : "open",
    };
    Object.keys(row).forEach((k) => (row as any)[k] === undefined && delete (row as any)[k]);

    const { data: saved } = await db.from("op_findings")
      .upsert(row, { onConflict: "user_id,code" })
      .select("id,status").maybeSingle();

    if ((saved as any)?.status === "resolved") continue;

    // Escalation-only: a sustained condition must not re-alert on every tick.
    const escalated = !before || SEV_RANK[f.severity] > SEV_RANK[before.severity] || f.confidence - Number(before.confidence ?? 0) >= 0.2;
    if (escalated && f.responseTier !== "log") {
      await notifyIntel({
        userId,
        userEmail,
        kind: "sentinel",
        severity: f.severity === "critical" ? "critical" : "notable",
        title: f.title,
        body: f.narrative,
        source: "Cloud Intelligence — OP Layer",
        url: "/dashboard?tab=cloud-intel&module=overwatch",
        sections: [
          { label: "Confidence", value: `${Math.round(f.confidence * 100)}% — ${f.corroboratingDevices} device(s), ${f.distinctSignalTypes} signal type(s)` },
          { label: "Response", value: f.responseTier === "act" ? "Automatic countermeasure queued" : "Recommendation only" },
        ],
        findings: f.recommendations.slice(0, 5),
        idempotencyKey: `op:${userId}:${f.code}:${f.severity}:${new Date(now).toISOString().slice(0, 13)}`,
      }).catch((e) => console.error("[opSweep] notify failed", String(e)));
      notified++;
    }

    // ── Act tier. Audit first, always. ───────────────────────────────────
    const directive = directiveFor(f);
    if (directive && autoAllowed && (saved as any)?.id) {
      const { data: dupe } = await db.from("op_actions")
        .select("id").eq("user_id", userId).eq("finding_id", (saved as any).id)
        .eq("action", directive.action).eq("outcome", "pending").maybeSingle();
      if (!dupe) {
        await db.from("op_actions").insert({
          user_id: userId,
          finding_id: (saved as any).id,
          device_id: f.exposedDeviceId,
          action: directive.action,
          rationale: {
            code: f.code,
            confidence: f.confidence,
            corroboratingDevices: f.corroboratingDevices,
            distinctSignalTypes: f.distinctSignalTypes,
            scope: directive.scope,
            narrative: f.narrative,
          },
          outcome: "pending",
        });
        actionsQueued++;
      }
    }
  }

  // Findings that no longer reproduce are closed rather than left standing.
  const liveCodes = new Set(findings.map((f) => f.code));
  const stale = (openRes.data ?? []).filter((r: any) => r.status === "open" && !liveCodes.has(r.code)).map((r: any) => r.id);
  if (stale.length) {
    await db.from("op_findings").update({ status: "expired" }).in("id", stale);
  }

  // ── Breathe into the bloodstream ───────────────────────────────────────
  // The OP layer keeps its own ledger because that is what its own UI reads,
  // but it also reports what it SENSED — not what it concluded — into the
  // shared substance so the correlation layer can notice when this organ and
  // an unrelated one are describing the same event. A failure here must never
  // fail the sweep: the organ's primary duty is its own ledger.
  try {
    const sensations: Sensation[] = [];

    for (const f of findings) {
      sensations.push({
        organ: "op",
        kind: `op:${f.code}`.slice(0, 80),
        entity: f.exposedDeviceId
          ? { kind: "device", key: f.exposedDeviceId, label: devices.find((d) => d.device_id === f.exposedDeviceId)?.label ?? null }
          : null,
        verdict: f.severity === "critical" || f.severity === "high" ? "hostile" : f.severity === "medium" ? "anomalous" : "benign",
        confidence: Number(f.confidence),
        summary: f.title,
        evidence: { code: f.code, corroboratingDevices: f.corroboratingDevices, distinctSignalTypes: f.distinctSignalTypes },
        observedAt: f.lastSeen || new Date(now).toISOString(),
        dedupeKey: `finding:${f.code}:${f.severity}:${new Date(now).toISOString().slice(0, 13)}`,
        ttlDays: 45,
      });
    }

    // Networks are the entity the rest of the organism most often shares with
    // this one, so they are reported even when no finding fired.
    const seenNetworks = new Set<string>();
    for (const s of signals) {
      if (!s.network_key || seenNetworks.has(s.network_key)) continue;
      seenNetworks.add(s.network_key);
      const net = networks.find((n) => n.network_key === s.network_key);
      sensations.push({
        organ: "op",
        kind: "op:network",
        entity: { kind: "network", key: s.network_key, label: net?.label ?? net?.org ?? null },
        verdict: net?.verdict === "hostile" ? "hostile" : net?.verdict === "suspect" ? "anomalous" : "clean",
        confidence: net?.verdict === "hostile" ? 0.7 : 0.35,
        reflex: s.runtime_tier === "foreground",
        summary: `Network observed by ${net?.devices_seen ?? 1} device(s)`,
        evidence: { country: net?.country ?? null, org: net?.org ?? null },
        observedAt: s.observed_at,
        dedupeKey: `network:${s.network_key}:${new Date(now).toISOString().slice(0, 13)}`,
        ttlDays: 21,
      });
      if (seenNetworks.size >= 40) break;
    }

    if (sensations.length) await publish(db, userId, sensations);
  } catch (e) {
    console.error("[opSweep] bloodstream publish failed", e instanceof Error ? e.message : String(e));
  }

  return { findings, posture: post, notified, actionsQueued };
}
