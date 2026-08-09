/**
 * SENTINEL — nearby-radio stalker detection + area risk alerting.
 *
 * Actions (all bound to auth.uid(); nothing accepts a user id from the body):
 *   settings.get / settings.set
 *   ble.ingest   → a batch of advertisements from one foreground scan session
 *   ble.list     → the device log with recurrence aggregates and dossiers
 *   ble.mark     → mark a radio as your own / mute it
 *   ble.dossier  → force a dossier build for one radio
 *   geo.check    → risk assessment for the caller's current coordinates
 *   geo.list     → recent area-entry alerts
 *
 * Alerting contract: the inbox row is written first and unconditionally by
 * notifyIntel(); push and email are best-effort transports layered on top.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJsonWithRetry } from "../_shared/zophielByokRouter.ts";
import { classifyIntent, runJurisdictionalSearch, formatIntelContext } from "../_shared/jurisdictionalIntel.ts";
import { notifyIntel } from "../_shared/intelNotify.ts";
import {
  fingerprint, classifyKind, displayNameFor, estimateDistance, metersToFeet,
  placeKey, assessRecurrence, inferSelf, parseJsonLoose, reverseGeocode,
  BLE_DOSSIER_SYSTEM, buildDossierPrompt, GEO_RISK_SYSTEM, buildGeoPrompt, collectAreaEvidence,
  type AdvertInput, type DeviceKind,
} from "../_shared/bleSentinel.ts";
import {
  analyzeTradecraft, buildCasePrompt, deterministicCase, tradecraftBriefFor,
  TRADECRAFT_CASE_SYSTEM, TRADECRAFT_DOCTRINE,
  type TcDevice, type TcSighting, type TcCampaign,
} from "../_shared/stalkerTradecraft.ts";
import { assessAndAlertArea, recordArrival, clearArrival } from "../_shared/areaSentinel.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (b: unknown, s: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT_SETTINGS = {
  recurrence_threshold: 3,
  ignore_audio: true,
  min_rssi: -95,
  ble_enabled: true,
  geo_enabled: true,
  push_enabled: true,
  email_enabled: true,
};

async function loadSettings(userId: string) {
  const { data } = await admin().from("sentinel_settings").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data || {}) };
}

function cfgFrom(key: { mode: string; geminiKey?: string; byok?: any }) {
  return key.mode === "admin"
    ? { provider: "google" as const, model: "gemini-flash-latest", apiKey: key.geminiKey! }
    : key.byok!;
}

/** Bounded, wall-clock-capped multi-angle collection. A dead angle thins the
 *  dossier; it never fails it. */
async function collect(angles: Array<{ label: string; query: string }>, budgetMs: number): Promise<string> {
  const started = Date.now();
  const blocks: string[] = [];
  const queue = [...angles];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      if (Date.now() - started > budgetMs) return;
      const a = queue.shift();
      if (!a) return;
      try {
        const intent = classifyIntent(a.query);
        if (intent.kind === "none") { blocks.push(`### ${a.label}\n(no jurisdiction resolved)`); continue; }
        const bundle = await runJurisdictionalSearch(intent);
        const body = formatIntelContext(bundle).trim();
        blocks.push(`### ${a.label}\n${body || "(searched — nothing surfaced)"}`);
      } catch (e) {
        blocks.push(`### ${a.label}\n(collection failed: ${(e as Error).message?.slice(0, 120) ?? "unknown"})`);
      }
    }
  });
  await Promise.allSettled(workers);
  return blocks.join("\n\n");
}

// ── Dossier for one radio ──────────────────────────────────────────────────

async function buildDeviceDossier(row: any, cfg: any, tradecraftBrief?: string) {
  const name = row.display_name as string;
  const maker = row.manufacturer as string | null;
  const collected = await collect([
    { label: "Hardware identification", query: `"${name}" ${maker || ""} bluetooth device what is it specifications` },
    { label: "Covert-tracking misuse", query: `${maker || name} bluetooth tracker stalking unwanted tracking reports` },
    { label: "Detection & countermeasures", query: `how to find hidden ${row.inferred_kind === "tracker" ? "bluetooth tracker tag" : `${name} bluetooth device`} on your person or car` },
  ], 30_000);
  // The behavioural read and the hardware read must never contradict each
  // other, so the tradecraft indicators are handed to the same model call.
  const research = tradecraftBrief
    ? `${collected}\n\n### Tradecraft indicators observed for THIS radio\n${tradecraftBrief}\n\nUse these behavioural indicators in your assessment, and restate their innocent explanations honestly.`
    : collected;

  const raw = await callByokJsonWithRetry(
    cfg,
    BLE_DOSSIER_SYSTEM,
    buildDossierPrompt({
      displayName: name,
      manufacturer: maker,
      kind: row.inferred_kind,
      serviceUuids: row.service_uuids || [],
      encounterCount: row.encounter_count,
      distinctDays: row.distinct_days,
      distinctPlaces: row.distinct_places,
      closestMeters: row.closest_distance_m != null ? Number(row.closest_distance_m) : null,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      research,
    }),
    { temperature: 0.15, jsonMode: true, maxOutputTokens: 4096, timeoutMs: 90_000, attempts: 2 },
  );
  const parsed = parseJsonLoose(raw);
  if (!parsed.headline) {
    parsed.headline = `${name} — recurring nearby radio`;
    parsed.grade = "THIN";
  }
  (parsed as any).research_note = research ? "Open-source collection ran across three angles." : "No open-source collection returned.";
  return parsed as Record<string, any>;
}

async function alertDevice(userId: string, userEmail: string | null, row: any, verdict: any, dossier: Record<string, any>, settings: any) {
  const closest = row.closest_distance_m != null ? Number(row.closest_distance_m) : null;
  await notifyIntel({
    userId,
    userEmail,
    kind: "sentinel",
    severity: verdict.tier === "breach" ? "critical" : "notable",
    title: `Recurring nearby device — ${row.display_name}`,
    body: String(dossier.assessment || verdict.reason),
    subjectName: row.display_name,
    source: "Bluetooth Sentinel",
    url: `/dashboard?tab=cloud-intel&module=sentinel&device=${row.id}`,
    sections: [
      { label: "Pattern", value: verdict.reason },
      { label: "Closest approach", value: closest != null ? `${closest} m (~${metersToFeet(closest)} ft)` : "not measurable" },
      { label: "Hardware class", value: String(dossier.device_class || row.inferred_kind) },
      { label: "Confidence", value: `${String(dossier.grade || "THIN")}` },
    ],
    findings: Array.isArray(dossier.actions) ? dossier.actions.map(String) : [],
    idempotencyKey: `sentinel:ble:${row.id}:${row.encounter_count}`,
    skipPush: !settings.push_enabled,
    skipEmail: !settings.email_enabled,
  });
}

// ── Aggregate recompute for one device ─────────────────────────────────────

async function recompute(deviceId: string, totalSessions: number, windowHours = 12) {
  const { data } = await admin()
    .from("ble_sightings")
    .select("session_id, seen_at, place_key, distance_m, rssi")
    .eq("device_id", deviceId)
    .order("seen_at", { ascending: false })
    .limit(2000);
  const rows = data || [];
  const sessions = new Set<string>();
  const days = new Set<string>();
  const places = new Set<string>();
  let closest: number | null = null;
  const rssis: number[] = [];

  // Rolling-window state: "near me N separate times in the last X hours".
  const cutoff = Date.now() - windowHours * 3_600_000;
  const windowSessions = new Set<string>();
  const windowPlaces = new Set<string>();
  let winFirst = Infinity, winLast = -Infinity, winClosest: number | null = null;

  for (const r of rows) {
    if (r.session_id) sessions.add(r.session_id);
    if (r.seen_at) days.add(String(r.seen_at).slice(0, 10));
    if (r.place_key) places.add(r.place_key);
    const d = r.distance_m != null ? Number(r.distance_m) : null;
    if (d != null && Number.isFinite(d)) {
      if (closest == null || d < closest) closest = d;
    }
    if (typeof r.rssi === "number") rssis.push(r.rssi);

    const t = r.seen_at ? Date.parse(String(r.seen_at)) : NaN;
    if (Number.isFinite(t) && t >= cutoff) {
      // A sighting without a session id still counts as its own encounter,
      // keyed by minute so a burst never inflates the count.
      windowSessions.add(r.session_id || `t:${Math.floor(t / 60_000)}`);
      if (r.place_key) windowPlaces.add(r.place_key);
      if (t < winFirst) winFirst = t;
      if (t > winLast) winLast = t;
      if (d != null && Number.isFinite(d) && (winClosest == null || d < winClosest)) winClosest = d;
    }
  }
  rssis.sort((a, b) => a - b);
  const median = rssis.length ? rssis[Math.floor(rssis.length / 2)] : null;
  return {
    encounter_count: sessions.size,
    distinct_days: days.size,
    distinct_places: places.size,
    sighting_count: rows.length,
    closest_distance_m: closest,
    presence_ratio: totalSessions > 0 ? sessions.size / totalSessions : 0,
    median_rssi: median,
    window_encounters: windowSessions.size,
    window_places: windowPlaces.size,
    window_closest_m: winClosest,
    window_span_minutes: Number.isFinite(winFirst) && Number.isFinite(winLast)
      ? Math.round((winLast - winFirst) / 60_000)
      : 0,
  };
}


// ── Tradecraft: behavioural read across the whole log ──────────────────────
//
// Recurrence says "something follows you". Tradecraft says "how it is being
// run", which is what changes the advice. Bounded to the last 5,000 sightings
// so one noisy city week cannot turn this into an unbounded scan.

async function loadTradecraft(userId: string): Promise<{ campaign: TcCampaign; names: Record<string, string> }> {
  const db = admin();
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
  const names: Record<string, string> = {};
  for (const d of devices) names[d.id] = d.display_name;
  return { campaign: analyzeTradecraft(devices, sightings), names };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const action = String(body.action || "");

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
  if (uErr || !user) return json({ error: "unauthorized" }, 401, cors);
  const userId = user.id;
  const userEmail = user.email ?? null;
  const db = admin();

  try {
    switch (action) {
      case "settings.get":
        return json({ settings: await loadSettings(userId) }, 200, cors);

      case "settings.set": {
        const p = (body.settings || {}) as Record<string, unknown>;
        const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
        if (typeof p.recurrence_threshold === "number") patch.recurrence_threshold = Math.min(20, Math.max(2, Math.round(p.recurrence_threshold)));
        if (typeof p.min_rssi === "number") patch.min_rssi = Math.min(-30, Math.max(-110, Math.round(p.min_rssi)));
        for (const k of ["ignore_audio", "ble_enabled", "geo_enabled", "push_enabled", "email_enabled"]) {
          if (typeof p[k] === "boolean") patch[k] = p[k];
        }
        await db.from("sentinel_settings").upsert(patch, { onConflict: "user_id" });
        return json({ settings: await loadSettings(userId) }, 200, cors);
      }

      // ── Ingest one scan session ─────────────────────────────────────────
      case "ble.ingest": {
        const settings = await loadSettings(userId);
        const sessionId = String(body.sessionId || "").slice(0, 64);
        if (!sessionId) return json({ error: "session_required" }, 400, cors);
        const scannerLabel = String(body.scannerLabel || "device").slice(0, 60);
        const adverts = Array.isArray(body.adverts) ? (body.adverts as AdvertInput[]).slice(0, 120) : [];
        if (!adverts.length) return json({ ingested: 0, alerts: [] }, 200, cors);

        // Total distinct sessions ever, for the self-device presence ratio.
        const { data: sess } = await db.from("ble_sightings").select("session_id").eq("user_id", userId).limit(5000);
        const totalSessions = new Set([...(sess || []).map((r: any) => r.session_id), sessionId]).size;

        const touched: string[] = [];
        for (const a of adverts) {
          if (typeof a?.rssi === "number" && a.rssi < settings.min_rssi) continue;
          const fp = await fingerprint(a);
          const uuids = Array.isArray(a.serviceUuids) ? a.serviceUuids.slice(0, 12).map(String) : [];
          const kind: DeviceKind = classifyKind(a.name ?? null, a.manufacturer ?? null, uuids);
          const dist = estimateDistance(a.rssi ?? null, a.txPower ?? null);
          const pk = placeKey(a.lat, a.lng);

          const { data: dev } = await db.from("ble_devices").upsert({
            user_id: userId,
            fingerprint: fp,
            display_name: displayNameFor(a.name ?? null, a.manufacturer ?? null, kind, fp),
            raw_name: a.name ?? null,
            manufacturer: a.manufacturer ?? null,
            inferred_kind: kind,
            service_uuids: uuids,
            last_seen: new Date(a.ts || Date.now()).toISOString(),
            last_rssi: typeof a.rssi === "number" ? Math.round(a.rssi) : null,
            last_distance_m: dist,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,fingerprint" }).select("id").maybeSingle();
          if (!dev?.id) continue;

          await db.from("ble_sightings").insert({
            user_id: userId,
            device_id: dev.id,
            seen_at: new Date(a.ts || Date.now()).toISOString(),
            rssi: typeof a.rssi === "number" ? Math.round(a.rssi) : null,
            distance_m: dist,
            lat: typeof a.lat === "number" ? a.lat : null,
            lng: typeof a.lng === "number" ? a.lng : null,
            accuracy_m: typeof a.accuracy === "number" ? a.accuracy : null,
            place_key: pk,
            scanner_label: scannerLabel,
            session_id: sessionId,
          });
          if (!touched.includes(dev.id)) touched.push(dev.id);
        }

        // Recompute aggregates and run the recurrence doctrine.
        const alerts: any[] = [];
        let dossiersBuilt = 0;
        let tcCache: { campaign: TcCampaign; names: Record<string, string> } | null = null;
        for (const id of touched) {
          const agg = await recompute(id, totalSessions, windowHours);
          const { data: row } = await db.from("ble_devices").select("*").eq("id", id).maybeSingle();
          if (!row) continue;

          const selfReason = row.is_self ? row.self_reason : inferSelf(agg.presence_ratio, agg.encounter_count, agg.median_rssi);
          const isSelf = row.is_self || !!selfReason;

          const verdict = assessRecurrence({
            encounterCount: agg.encounter_count,
            distinctDays: agg.distinct_days,
            distinctPlaces: agg.distinct_places,
            kind: row.inferred_kind as DeviceKind,
            isSelf,
            isIgnored: row.is_ignored,
            closestMeters: agg.window_closest_m ?? agg.closest_distance_m,
            threshold: settings.recurrence_threshold,
            ignoreAudio: settings.ignore_audio,
            windowEncounters: agg.window_encounters,
            windowHours,
            windowSpanMinutes: agg.window_span_minutes,
          });

          const patch: Record<string, unknown> = {
            encounter_count: agg.encounter_count,
            distinct_days: agg.distinct_days,
            distinct_places: agg.distinct_places,
            sighting_count: agg.sighting_count,
            closest_distance_m: agg.closest_distance_m,
            is_self: isSelf,
            self_reason: selfReason ?? row.self_reason,
            threat_tier: verdict.tier,
            updated_at: new Date().toISOString(),
          };

          // Re-alert when the window doctrine fires again after a full cooldown,
          // or when the all-time pattern deepens. Never on every ping.
          const lastAlertMs = row.last_alert_at ? Date.parse(String(row.last_alert_at)) : NaN;
          const cooledDown = !Number.isFinite(lastAlertMs) ||
            Date.now() - lastAlertMs >= windowHours * 3_600_000;
          const escalated = verdict.shouldAlert &&
            (cooledDown ||
              agg.encounter_count >= (row.alert_count || 0) * 3 + settings.recurrence_threshold);


          if (escalated && dossiersBuilt < 1) {
            let key;
            try { key = await resolveKey(req, body.byok); } catch { key = null; }
            if (key) {
              const merged = { ...row, ...patch };
              // Behavioural read, computed once per ingest and only when an
              // alert is actually being raised.
              tcCache ??= await loadTradecraft(userId).catch(() => null);
              const brief = tcCache ? tradecraftBriefFor(id, tcCache.campaign) : undefined;
              const dossier = await buildDeviceDossier(merged, cfgFrom(key), brief).catch((e) => ({
                headline: `${row.display_name} — dossier build failed`,
                grade: "THIN",
                assessment: `Recurrence confirmed: ${verdict.reason} Open-source enrichment failed (${(e as Error).message?.slice(0, 100)}).`,
                actions: ["Run your phone's built-in unwanted-tracker scan.", "Physically sweep bag, coat linings and vehicle wheel wells."],
              }));
              if (tcCache) {
                (dossier as any).tradecraft = tcCache.campaign.indicators.filter((i) => i.deviceIds.includes(id));
                (dossier as any).tradecraft_tier = tcCache.campaign.tier;
              }
              patch.dossier = dossier;
              patch.dossier_at = new Date().toISOString();
              patch.alert_count = (row.alert_count || 0) + 1;
              patch.last_alert_at = new Date().toISOString();
              dossiersBuilt++;
              await alertDevice(userId, userEmail, { ...merged, ...patch }, verdict, dossier, settings).catch((e) =>
                console.error("sentinel_alert_failed", e instanceof Error ? e.message : e));
              alerts.push({ deviceId: id, name: row.display_name, tier: verdict.tier, reason: verdict.reason });
            }
          }
          await db.from("ble_devices").update(patch).eq("id", id);
        }

        return json({ ingested: touched.length, sessions: totalSessions, alerts }, 200, cors);
      }

      case "ble.list": {
        const { data } = await db.from("ble_devices").select("*").eq("user_id", userId)
          .order("last_seen", { ascending: false }).limit(300);
        return json({ devices: data || [] }, 200, cors);
      }

      case "ble.mark": {
        const deviceId = String(body.deviceId || "");
        if (!deviceId) return json({ error: "device_required" }, 400, cors);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.is_self === "boolean") {
          patch.is_self = body.is_self;
          patch.self_reason = body.is_self ? "Confirmed by you as your own hardware." : null;
        }
        if (typeof body.is_ignored === "boolean") patch.is_ignored = body.is_ignored;
        const { data } = await db.from("ble_devices").update(patch).eq("id", deviceId).eq("user_id", userId).select("*").maybeSingle();
        return json({ device: data }, 200, cors);
      }

      case "ble.dossier": {
        const deviceId = String(body.deviceId || "");
        const { data: row } = await db.from("ble_devices").select("*").eq("id", deviceId).eq("user_id", userId).maybeSingle();
        if (!row) return json({ error: "not_found" }, 404, cors);
        let key;
        try { key = await resolveKey(req, body.byok); } catch (e) { return byokErrorResponse(e, cors); }
        const tc = await loadTradecraft(userId).catch(() => null);
        const dossier = await buildDeviceDossier(row, cfgFrom(key), tc ? tradecraftBriefFor(deviceId, tc.campaign) : undefined);
        if (tc) {
          (dossier as any).tradecraft = tc.campaign.indicators.filter((i) => i.deviceIds.includes(deviceId));
          (dossier as any).tradecraft_tier = tc.campaign.tier;
        }
        await db.from("ble_devices").update({ dossier, dossier_at: new Date().toISOString() }).eq("id", deviceId);
        return json({ dossier }, 200, cors);
      }

      // ── Tradecraft analysis (deterministic, no model required) ───────────
      case "ble.tradecraft": {
        const { campaign } = await loadTradecraft(userId);
        return json({ analysis: campaign, doctrine: TRADECRAFT_DOCTRINE }, 200, cors);
      }

      // ── Case file: deterministic substrate, model narration on top ───────
      case "ble.case": {
        const { campaign, names } = await loadTradecraft(userId);
        const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";
        const fallback = deterministicCase(campaign, names);

        let caseFile: Record<string, unknown> = fallback;
        let key = null as any;
        try { key = await resolveKey(req, body.byok); } catch { key = null; }
        if (key) {
          try {
            const raw = await callByokJsonWithRetry(
              cfgFrom(key),
              TRADECRAFT_CASE_SYSTEM,
              buildCasePrompt(campaign, { note, deviceNames: names }),
              { temperature: 0.15, jsonMode: true, maxOutputTokens: 6144, timeoutMs: 120_000, attempts: 2 },
            );
            const parsed = parseJsonLoose(raw);
            // The facts stay deterministic; the model only narrates them. A
            // thin or malformed generation must never erase the real analysis.
            if (parsed && typeof parsed.executive_summary === "string" && parsed.executive_summary.length > 40) {
              caseFile = { ...fallback, ...parsed, generated_offline: false };
            }
          } catch (e) {
            (caseFile as any).narration_note = `Model narration unavailable (${(e as Error).message?.slice(0, 120)}). The analysis below is the deterministic engine output.`;
          }
        } else {
          (caseFile as any).narration_note = "No model key available — this case file is the deterministic engine output.";
        }

        const { data: saved } = await db.from("sentinel_cases").insert({
          user_id: userId,
          case_reference: String((caseFile as any).case_reference || `BLE-SENTINEL-${new Date().toISOString().slice(0, 10)}`).slice(0, 80),
          tier: campaign.tier,
          score: campaign.score,
          posture: campaign.posture,
          headline: campaign.headline,
          analysis: campaign as unknown as Record<string, unknown>,
          case_file: caseFile,
          note: note || null,
        }).select("*").maybeSingle();

        if (campaign.tier === "active" || campaign.tier === "probable") {
          const settings = await loadSettings(userId);
          await notifyIntel({
            userId,
            userEmail,
            kind: "sentinel",
            severity: campaign.tier === "active" ? "critical" : "notable",
            title: `Stalking case file — ${campaign.headline}`,
            body: String((caseFile as any).executive_summary || campaign.headline),
            source: "Bluetooth Sentinel · Tradecraft",
            url: `/dashboard?tab=cloud-intel&module=sentinel`,
            sections: [
              { label: "Tier", value: campaign.tier },
              { label: "Posture", value: campaign.posture },
              { label: "Score", value: `${campaign.score}/100` },
              { label: "Indicators", value: campaign.indicators.map((i) => i.title).join("; ") || "none" },
            ],
            findings: Array.isArray((caseFile as any).next_24_hours) ? (caseFile as any).next_24_hours.map(String) : [],
            idempotencyKey: `sentinel:case:${saved?.id || Date.now()}`,
            skipPush: !settings.push_enabled,
            skipEmail: !settings.email_enabled,
          }).catch((e) => console.error("sentinel_case_notify_failed", e instanceof Error ? e.message : e));
        }

        return json({ analysis: campaign, caseFile, case: saved || null }, 200, cors);
      }

      case "ble.cases": {
        const { data } = await db.from("sentinel_cases").select("*").eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(25);
        return json({ cases: data || [] }, 200, cors);
      }

      // ── Area risk ────────────────────────────────────────────────────────
      // The judgement itself lives in _shared/areaSentinel so the unattended
      // cron runs the identical cache, cooldown and alert shape. This handler
      // only supplies the caller's key and records presence for that cron.
      case "geo.check": {
        const settings = await loadSettings(userId);
        if (!settings.geo_enabled) return json({ skipped: "geo_disabled" }, 200, cors);
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return json({ error: "invalid_coordinates" }, 400, cors);
        }
        let key;
        try { key = await resolveKey(req, body.byok); } catch (e) { return byokErrorResponse(e, cors); }

        // Every live fix teaches the server where to look when no tab is open,
        // and records which cell the user is standing in so the unattended pass
        // can tell "arrived somewhere new" from "still where they were".
        const arrivalReq = body.arrival === true;
        const arrival = await recordArrival(db, userId, lat, lng, {
          accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null,
          last_source: "foreground",
        });
        await db.from("sentinel_cron_state")
          .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

        const result = await assessAndAlertArea({
          db, userId, userEmail, lat, lng,
          cfg: cfgFrom(key) as any,
          settings,
          fixAgeMs: 0,
          source: arrivalReq ? "Area Sentinel — arrival" : "Area Sentinel",
          // Someone is physically standing in this cell waiting on the answer.
          // A patient 3-minute model call is the wrong trade here: a late
          // perfect verdict is worth less than an on-time one.
          mode: arrivalReq ? "fast" : "deep",
        });
        // Only drop the latch on a real verdict. Clearing it on a timeout would
        // hand the cell back to the 15-minute clock — the exact failure we are
        // fixing — instead of letting the next pass retry it.
        if (result.assessment) await clearArrival(db, userId, arrival.placeKey);
        if (!result.assessment) return json({ error: result.reason || "assessment_failed", reason: result.reason }, 502, cors);
        return json({
          assessment: result.assessment,
          notified: result.notified,
          arrival: { placeKey: arrival.placeKey, arrived: arrival.arrived, dwellMs: arrival.dwellMs },
        }, 200, cors);

      }


      case "geo.list": {
        const { data } = await db.from("geo_risk_events").select("*").eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(50);
        return json({ events: data || [] }, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 400, cors);
    }
  } catch (e) {
    console.error("sentinel_error", action, e instanceof Error ? e.message : e);
    return json({ error: "sentinel_failed", detail: (e as Error).message?.slice(0, 300) }, 500, cors);
  }
});
