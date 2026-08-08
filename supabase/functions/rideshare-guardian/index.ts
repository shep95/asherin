/**
 * RIDESHARE GUARDIAN — single control surface.
 *
 * Actions:
 *   vapid            → public VAPID key (public, no auth)
 *   push.subscribe   → register this device for alerts
 *   push.unsubscribe → drop an endpoint
 *   settings.get/set → alert threshold + channels
 *   ride.capture     → ingest a share link / manual card, run the fast pass, alert
 *   ride.sweep       → deep OSINT pass on a captured ride, alert
 *   ride.list        → recent rides with their reports
 *   message.ingest   → analyse a pasted phone-message thread
 *   message.list     → recent analysed threads
 *
 * Every action below is bound to the caller's own auth.uid(); nothing accepts a
 * user id from the request body.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJsonWithRetry } from "../_shared/zophielByokRouter.ts";
import { classifyIntent, runJurisdictionalSearch, formatIntelContext } from "../_shared/jurisdictionalIntel.ts";
import { notifyIntel, severityFromVerdict } from "../_shared/intelNotify.ts";
import { runDeepSweep, loadSettings, admin } from "../_shared/rideshareSweep.ts";
import {
  fastPass,
  parseShareLink,
  isAllowedShareUrl,
  buildDeepUserPrompt,
  DEEP_SYSTEM_PROMPT,
  enforceDoctrine,
  reportText,
  VERDICT_RANK,
  type RideInput,
  type PhaseResult,
  type Verdict,
} from "../_shared/rideshareGuardian.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;



function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

// Settings, delivery and the deep sweep are shared with the autopilot so both
// entry points enforce the same doctrine and emit the same dossier.


Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, cors);
  }
  const action = String(body.action || "");

  // Public: the VAPID public key is public by design.
  if (action === "vapid") {
    return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || null }, 200, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
  if (uErr || !user) return json({ error: "unauthorized" }, 401, cors);
  const userId = user.id;
  const userEmail = user.email ?? null;

  try {
    switch (action) {
      // ── device registration ────────────────────────────────────────────
      case "push.subscribe": {
        const sub = (body.subscription || {}) as Record<string, any>;
        const endpoint = str(sub.endpoint, 600);
        const p256dh = str(sub.keys?.p256dh, 200);
        const auth = str(sub.keys?.auth, 200);
        if (!endpoint || !p256dh || !auth) return json({ error: "invalid_subscription" }, 400, cors);
        if (!/^https:\/\//.test(endpoint)) return json({ error: "invalid_subscription" }, 400, cors);
        const { error } = await admin().from("push_subscriptions").upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth_key: auth,
            user_agent: str(body.userAgent, 300),
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" },
        );
        if (error) throw error;
        return json({ ok: true }, 200, cors);
      }

      case "push.unsubscribe": {
        const endpoint = str(body.endpoint, 600);
        if (!endpoint) return json({ error: "endpoint_required" }, 400, cors);
        await admin().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
        return json({ ok: true }, 200, cors);
      }

      // ── settings ───────────────────────────────────────────────────────
      case "settings.get":
        return json({ settings: await loadSettings(userId) }, 200, cors);

      case "settings.set": {
        const s = (body.settings || {}) as Record<string, unknown>;
        const threshold = ["CLEAR", "THIN", "WATCH", "AVOID"].includes(String(s.alert_threshold))
          ? String(s.alert_threshold)
          : "WATCH";
        // Autopilot is opt-in: reading a mailbox on a schedule is a standing
        // permission, so it defaults off and must be turned on explicitly.
        const lookbackRaw = Number(s.lookback_hours);
        const lookback = Number.isFinite(lookbackRaw)
          ? Math.min(168, Math.max(1, Math.round(lookbackRaw)))
          : 24;
        const { error } = await admin().from("rideshare_settings").upsert({
          user_id: userId,
          alert_threshold: threshold,
          push_enabled: s.push_enabled !== false,
          email_enabled: s.email_enabled !== false,
          auto_from_email: s.auto_from_email !== false,
          autopilot_enabled: s.autopilot_enabled === true,
          lookback_hours: lookback,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (error) throw error;
        return json({ settings: await loadSettings(userId) }, 200, cors);
      }

      // ── ride capture (phase 1) ─────────────────────────────────────────
      case "ride.capture": {
        const tripUrl = str(body.trip_url, 500);
        let parsedNote = "";
        let parsed: Record<string, string | undefined> = {};

        if (tripUrl) {
          if (!isAllowedShareUrl(tripUrl)) {
            return json({ error: "unsupported_link", message: "That link is not an Uber or Lyft trip-share URL." }, 400, cors);
          }
          const p = await parseShareLink(tripUrl);
          parsedNote = p.note;
          parsed = { driver_name: p.driver_name, plate: p.plate, vehicle: p.vehicle, city: p.city };
        }

        // Rider-supplied values always win over scraped ones: the human looking
        // at the car is a better sensor than a partially-rendered web page.
        const ride: RideInput = {
          platform: (str(body.platform, 20) || "uber").toLowerCase(),
          source: tripUrl ? "share_link" : "manual",
          driver_name: str(body.driver_name, 80) || parsed.driver_name || null,
          plate: (str(body.plate, 16) || parsed.plate || null)?.toUpperCase() || null,
          vehicle: str(body.vehicle, 80) || parsed.vehicle || null,
          city: str(body.city, 80) || parsed.city || null,
          pickup_label: str(body.pickup_label, 160) || null,
          trip_url: tripUrl,
        };

        if (!ride.driver_name && !ride.plate) {
          return json({
            error: "insufficient_card",
            message: parsedNote || "Provide at least a driver name or a plate.",
          }, 400, cors);
        }

        const fast = fastPass(ride);
        // Idempotency is derived from the card itself, not a random uuid, so a
        // double-tapped capture does not create two rides.
        const idem = [ride.platform, ride.plate, ride.driver_name, ride.pickup_label]
          .filter(Boolean).join("|").slice(0, 200) || null;

        const insert = {
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
          idempotency_key: idem,
          updated_at: new Date().toISOString(),
        };

        // The idempotency index on rideshare_rides is PARTIAL, so PostgREST
        // cannot infer it for ON CONFLICT. Resolve the prior ride explicitly:
        // a re-captured card must reuse its ride, not spawn a duplicate.
        let prior: { id: string } | null = null;
        if (idem) {
          const { data: found } = await admin().from("rideshare_rides")
            .select("id").eq("user_id", userId).eq("idempotency_key", idem).maybeSingle();
          prior = found ?? null;
        }
        const { data: row, error } = prior
          ? await admin().from("rideshare_rides")
              .update(insert).eq("id", prior.id).select().single()
          : await admin().from("rideshare_rides").insert(insert).select().single();
        if (error) throw error;


        await admin().from("rideshare_reports").upsert({
          ride_id: row.id,
          user_id: userId,
          phase: "fast",
          verdict: fast.verdict,
          confidence: fast.confidence,
          score: fast.score,
          headline: fast.headline,
          payload: { ...fast.payload, link_note: parsedNote },
        }, { onConflict: "ride_id,phase" });

        return json({ ride: row, fast, link_note: parsedNote }, 200, cors);
      }

      // ── deep sweep (phase 2) ───────────────────────────────────────────
      case "ride.sweep": {
        const rideId = str(body.ride_id, 60);
        if (!rideId) return json({ error: "ride_id_required" }, 400, cors);

        const { data: row, error: rErr } = await admin()
          .from("rideshare_rides").select("*").eq("id", rideId).eq("user_id", userId).maybeSingle();
        if (rErr) throw rErr;
        if (!row) return json({ error: "not_found" }, 404, cors);

        const ride: RideInput = {
          platform: row.platform, source: row.source, driver_name: row.driver_name,
          plate: row.plate, vehicle: row.vehicle, city: row.city,
          pickup_label: row.pickup_label, trip_url: row.trip_url,
        };

        let key;
        try {
          key = await resolveKey(req, body.byok);
        } catch (e) {
          return byokErrorResponse(e, cors);
        }
        const cfg = key.mode === "admin"
          ? { provider: "google" as const, model: "gemini-flash-latest", apiKey: key.geminiKey! }
          : key.byok!;

        // One engine, two entry points: the desk and the autopilot must produce
        // identical dossiers, so the sweep itself lives in the shared module.
        const { deep, delivered } = await runDeepSweep({
          userId,
          userEmail,
          rideId: row.id,
          ride,
          cfg,
          settings: await loadSettings(userId),
        });

        return json({ deep, delivered, report_text: reportText(ride, deep) }, 200, cors);

      }

      case "ride.list": {
        const { data, error } = await admin()
          .from("rideshare_rides")
          .select("*, rideshare_reports(*)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) throw error;
        return json({ rides: data || [] }, 200, cors);
      }

      case "ride.delete": {
        const rideId = str(body.ride_id, 60);
        if (!rideId) return json({ error: "ride_id_required" }, 400, cors);
        await admin().from("rideshare_rides").delete().eq("id", rideId).eq("user_id", userId);
        return json({ ok: true }, 200, cors);
      }

      // ── trip recorder ──────────────────────────────────────────────────
      // The rider's own telemetry. The recorder streams fixes up in batches
      // while the ride is live so a phone that dies mid-trip still leaves a
      // record; analysis runs once, after the trip ends.
      case "trip.start": {
        // Idempotency is keyed on the client's own start token rather than a
        // fresh uuid, so a retried request resumes the same trip instead of
        // opening a duplicate.
        const idem = str(body.idempotency_key, 120);
        if (idem) {
          const { data: existing } = await admin()
            .from("rideshare_trip_tracks")
            .select("*")
            .eq("user_id", userId)
            .eq("idempotency_key", idem)
            .maybeSingle();
          if (existing) return json({ trip: existing, resumed: true }, 200, cors);
        }
        const { data, error } = await admin().from("rideshare_trip_tracks").insert({
          user_id: userId,
          ride_id: str(body.ride_id, 60),
          platform: ["uber", "lyft", "taxi", "other"].includes(String(body.platform))
            ? String(body.platform) : "uber",
          label: str(body.label, 120),
          idempotency_key: idem,
          started_at: new Date().toISOString(),
        }).select().single();
        if (error) throw error;
        return json({ trip: data, resumed: false }, 200, cors);
      }

      case "trip.points": {
        const tripId = str(body.trip_id, 60);
        if (!tripId) return json({ error: "trip_id_required" }, 400, cors);
        const raw = Array.isArray(body.points) ? body.points : [];
        if (!raw.length) return json({ ok: true, inserted: 0 }, 200, cors);
        // A batch cap keeps one bad client from writing an unbounded payload.
        if (raw.length > 2000) return json({ error: "batch_too_large" }, 400, cors);

        const { data: owned } = await admin()
          .from("rideshare_trip_tracks")
          .select("id,status")
          .eq("id", tripId).eq("user_id", userId).maybeSingle();
        if (!owned) return json({ error: "trip_not_found" }, 404, cors);

        const num = (v: unknown, lo: number, hi: number): number | null => {
          const n = Number(v);
          return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
        };
        const rows = raw.map((p: Record<string, unknown>) => {
          const lat = num(p.lat, -90, 90);
          const lon = num(p.lon, -180, 180);
          const t = typeof p.t === "number" ? p.t : Date.parse(String(p.t));
          if (lat == null || lon == null || !Number.isFinite(t)) return null;
          return {
            trip_id: tripId,
            user_id: userId,
            t: new Date(t).toISOString(),
            lat, lon,
            accuracy_m: num(p.accuracy_m, 0, 100_000),
            speed_mps: num(p.speed_mps, 0, 200),
            heading_deg: num(p.heading_deg, -360, 360),
            altitude_m: num(p.altitude_m, -500, 20_000),
          };
        }).filter(Boolean);
        if (!rows.length) return json({ ok: true, inserted: 0 }, 200, cors);

        // Upload is at-least-once: the recorder replays its buffer after a
        // network drop, so the unique (trip, t) index absorbs the repeats.
        const { error } = await admin()
          .from("rideshare_trip_points")
          .upsert(rows, { onConflict: "trip_id,t", ignoreDuplicates: true });
        if (error) throw error;

        const { count } = await admin()
          .from("rideshare_trip_points")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", tripId);
        await admin().from("rideshare_trip_tracks")
          .update({ point_count: count ?? 0, updated_at: new Date().toISOString() })
          .eq("id", tripId).eq("user_id", userId);

        return json({ ok: true, inserted: rows.length, total: count ?? 0 }, 200, cors);
      }

      case "trip.end": {
        const tripId = str(body.trip_id, 60);
        if (!tripId) return json({ error: "trip_id_required" }, 400, cors);
        const { data, error } = await admin().from("rideshare_trip_tracks")
          .update({ status: "ended", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", tripId).eq("user_id", userId).select().single();
        if (error) throw error;
        return json({ trip: data }, 200, cors);
      }

      case "trip.analyze": {
        const tripId = str(body.trip_id, 60);
        if (!tripId) return json({ error: "trip_id_required" }, 400, cors);
        const { data: trip } = await admin().from("rideshare_trip_tracks")
          .select("*").eq("id", tripId).eq("user_id", userId).maybeSingle();
        if (!trip) return json({ error: "trip_not_found" }, 404, cors);

        // Paged read: a long ride exceeds the default row ceiling, and a
        // silently truncated trace would be analysed as a shorter, cleaner
        // trip than the one that happened.
        const points: Record<string, unknown>[] = [];
        const PAGE = 1000;
        for (let from = 0; from < 60_000; from += PAGE) {
          const { data: page, error: pErr } = await admin()
            .from("rideshare_trip_points")
            .select("t,lat,lon,accuracy_m,speed_mps,heading_deg,altitude_m")
            .eq("trip_id", tripId)
            .order("t", { ascending: true })
            .range(from, from + PAGE - 1);
          if (pErr) throw pErr;
          if (!page?.length) break;
          points.push(...page);
          if (page.length < PAGE) break;
        }

        let analysis;
        try {
          analysis = await analyseTrip(points as never);
        } catch (e) {
          await admin().from("rideshare_trip_tracks")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", tripId).eq("user_id", userId);
          return json({ error: "analysis_failed", message: String((e as Error).message) }, 500, cors);
        }

        const { data: saved, error: sErr } = await admin().from("rideshare_trip_tracks").update({
          status: "analyzed",
          ended_at: trip.ended_at ?? new Date().toISOString(),
          duration_s: analysis.durationS,
          distance_m: analysis.distanceM,
          max_speed_mps: analysis.maxSpeedMps,
          avg_speed_mps: analysis.avgSpeedMps,
          moving_s: analysis.movingS,
          stopped_s: analysis.stoppedS,
          coverage_gap_s: analysis.coverageGapS,
          point_count: analysis.retainedCount,
          streets: analysis.streets,
          events: analysis.events,
          analysis: {
            summary: analysis.summary,
            quality: analysis.quality,
            roadData: analysis.roadData,
            avgMovingSpeedMps: analysis.avgMovingSpeedMps,
            droppedForAccuracy: analysis.droppedForAccuracy,
            rawPointCount: analysis.pointCount,
            analyzedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq("id", tripId).eq("user_id", userId).select().single();
        if (sErr) throw sErr;

        return json({ trip: saved, analysis }, 200, cors);
      }

      case "trip.list": {
        const { data, error } = await admin()
          .from("rideshare_trip_tracks")
          .select("id,ride_id,platform,label,status,started_at,ended_at,duration_s,distance_m,max_speed_mps,avg_speed_mps,moving_s,stopped_s,coverage_gap_s,point_count,streets,events,analysis")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(25);
        if (error) throw error;
        return json({ trips: data || [] }, 200, cors);
      }

      case "trip.track": {
        const tripId = str(body.trip_id, 60);
        if (!tripId) return json({ error: "trip_id_required" }, 400, cors);
        const { data: trip } = await admin().from("rideshare_trip_tracks")
          .select("*").eq("id", tripId).eq("user_id", userId).maybeSingle();
        if (!trip) return json({ error: "trip_not_found" }, 404, cors);
        const { data: pts } = await admin().from("rideshare_trip_points")
          .select("t,lat,lon,speed_mps,accuracy_m,altitude_m")
          .eq("trip_id", tripId).order("t", { ascending: true }).limit(20_000);
        if (body.format === "gpx") {
          return new Response(
            toGpx((pts || []) as never, trip.label || `Asherin trip ${trip.started_at}`),
            { status: 200, headers: { ...cors, "Content-Type": "application/gpx+xml" } },
          );
        }
        return json({ trip, points: pts || [] }, 200, cors);
      }

      case "trip.delete": {
        const tripId = str(body.trip_id, 60);
        if (!tripId) return json({ error: "trip_id_required" }, 400, cors);
        await admin().from("rideshare_trip_tracks").delete().eq("id", tripId).eq("user_id", userId);
        return json({ ok: true }, 200, cors);
      }


      // ── phone-message analysis ─────────────────────────────────────────
      case "message.ingest": {
        const rawThread = typeof body.raw === "string" ? body.raw.trim().slice(0, 40_000) : "";
        if (rawThread.length < 20) return json({ error: "thread_too_short" }, 400, cors);
        const channel = ["sms_paste", "sms_forward", "whatsapp_paste", "other"].includes(String(body.channel))
          ? String(body.channel) : "sms_paste";

        let key;
        try {
          key = await resolveKey(req, body.byok);
        } catch (e) {
          return byokErrorResponse(e, cors);
        }
        const cfg = key.mode === "admin"
          ? { provider: "google" as const, model: "gemini-flash-latest", apiKey: key.geminiKey! }
          : key.byok!;

        const system = `You are an Asherin message-thread analyst.
Analyse a pasted phone-message thread for the recipient's safety and situational awareness.
Rules: quote only what is present; never invent participants or events; flag manipulation,
coercion, scam patterns, spoofing indicators and urgency-pressure tactics with the exact line
that evidences them. If the thread is benign, say so plainly.
Return strict JSON only:
{"counterparty":"","summary":"","intent":"","risk":"low|medium|high","tactics":[{"name":"","evidence":""}],
"asks":[""],"timeline":[{"when":"","what":""}],"recommended_action":"","report":"multi-paragraph plain-text assessment"}`;

        const out = await callByokJsonWithRetry(cfg, system, `THREAD:\n${rawThread}`, {
          temperature: 0.2, jsonMode: true, maxOutputTokens: 4096, timeoutMs: 90_000, attempts: 3,
        });

        let parsedMsg: Record<string, any> = {};
        try {
          parsedMsg = JSON.parse(out.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
        } catch {
          parsedMsg = { summary: "Analysis could not be parsed.", risk: "low" };
        }

        const { data, error } = await admin().from("message_sources").insert({
          user_id: userId,
          channel,
          counterparty: str(parsedMsg.counterparty, 120) || str(body.counterparty, 120),
          raw: rawThread,
          parsed: parsedMsg,
          report: typeof parsedMsg.report === "string" ? parsedMsg.report : null,
        }).select().single();
        if (error) throw error;
        return json({ source: data }, 200, cors);
      }

      case "message.list": {
        const { data, error } = await admin()
          .from("message_sources")
          .select("id, channel, counterparty, parsed, report, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) throw error;
        return json({ sources: data || [] }, 200, cors);
      }

      case "message.delete": {
        const id = str(body.id, 60);
        if (!id) return json({ error: "id_required" }, 400, cors);
        await admin().from("message_sources").delete().eq("id", id).eq("user_id", userId);
        return json({ ok: true }, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 400, cors);
    }
  } catch (e) {
    console.error("rideshare_guardian_error", action, e instanceof Error ? e.message : JSON.stringify(e));
    return json({ error: "guardian_failed", detail: e instanceof Error ? e.message : JSON.stringify(e)?.slice(0, 300) }, 500, cors);
  }
});
