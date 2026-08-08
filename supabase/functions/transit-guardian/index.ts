/**
 * TRANSIT GUARDIAN — one control surface for every mode of travel.
 *
 * The rideshare desk answered a single question about a single shape of
 * journey. This endpoint generalises it: a leg is captured (manually or
 * harvested from the traveller's own mailbox), assessed deterministically, then
 * swept against the primary source that is authoritative for its mode —
 * aircraft registry and live ADS-B for air and rotorcraft, the open transit
 * graph for rail, coach and ferry, and the existing for-hire licensing pivot
 * for cars.
 *
 * Invariants:
 *   • Every action is bound to auth.uid(); no user id is ever read from a body.
 *   • Capture is idempotent on (mode, identifier, calendar day) so a re-scanned
 *     mailbox or a double-tapped button never creates a second leg.
 *   • Collection is failure-isolated and timeboxed: a dead source thins the
 *     dossier, it never fails the request.
 *   • Car legs are delegated to the existing sweep so the two desks can never
 *     drift apart in doctrine.
 *
 * Actions: leg.capture · leg.sweep · leg.list · leg.delete · mail.scan
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";
import { notifyIntel, severityFromVerdict } from "../_shared/intelNotify.ts";
import { runDeepSweep, loadSettings } from "../_shared/rideshareSweep.ts";
import { liveAccounts, harvestBodies, hasScope, adminClient } from "../_shared/googleMesh.ts";
import { assessAreaByLabel, ALERTING_LEVELS } from "../_shared/areaRisk.ts";
import { aviationDossier } from "../_shared/aviationIntel.ts";
import { railDossier } from "../_shared/railIntel.ts";
import {
  isTransitMode,
  transitGmailQuery,
  MODE_LABEL,
  operatorById,
  type TransitMode,
} from "../_shared/transitModes.ts";
import { parseTransitEmail, foldLegs, legHeadline, type TransitLeg } from "../_shared/transitIngest.ts";
import {
  transitFastPass,
  transitSystemPrompt,
  buildTransitPrompt,
  enforceTransitDoctrine,
  transitReportText,
  VERDICT_RANK,
  type TransitLegInput,
  type TransitFlag,
  type Verdict,
  type ModelAssessment,
} from "../_shared/transitGuardian.ts";
import type { RideInput } from "../_shared/rideshareGuardian.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

const log = (step: string, detail?: unknown) =>
  console.log(`[transit-guardian] ${step}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);

/** Local wall-clock ISO ("2026-08-10T07:45:00") stored without an invented offset. */
const isoOrNull = (v: unknown): string | null => {
  const s = str(v, 40);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) || /^\d{4}-\d{2}-\d{2}T.+Z$/.test(s) ? s : null;
};

// ── Row ⇄ leg mapping ──────────────────────────────────────────────────────

interface LegRow {
  id: string;
  mode: string;
  operator: string | null;
  operator_label: string | null;
  vehicle_ident: string | null;
  vehicle: string | null;
  driver_name: string | null;
  plate: string | null;
  city: string | null;
  pickup_label: string | null;
  destination_label: string | null;
  depart_at: string | null;
  booking_ref: string | null;
  seat: string | null;
  source: string;
  platform: string;
}

function rowToLeg(row: LegRow): TransitLegInput {
  const mode = isTransitMode(row.mode) ? row.mode : "car";
  return {
    mode,
    operator: row.operator || row.platform || "unknown",
    operator_label: row.operator_label || operatorById(row.operator || "")?.label || row.platform || "Unknown operator",
    vehicle_ident: row.vehicle_ident || row.plate,
    vehicle: row.vehicle,
    driver_name: mode === "car" ? row.driver_name : null,
    plate: row.plate,
    origin_label: row.pickup_label,
    destination_label: row.destination_label,
    depart_at: row.depart_at,
    booking_ref: row.booking_ref,
    seat: row.seat,
    city: row.city,
    source: (["email", "manual", "share_link", "screenshot"].includes(row.source) ? row.source : "manual") as TransitLegInput["source"],
  };
}

/** Deterministic identity for a leg — never a random uuid. */
function idemKey(leg: TransitLegInput): string {
  const day = (leg.depart_at || new Date().toISOString()).slice(0, 10);
  return [leg.mode, leg.operator, leg.vehicle_ident || leg.booking_ref || leg.origin_label || "?", day]
    .join("|").slice(0, 200);
}

async function upsertLeg(
  userId: string,
  leg: TransitLegInput,
  extra: { email_message_id?: string | null; auto_captured?: boolean; raw?: Record<string, unknown> },
): Promise<{ id: string } & Record<string, unknown>> {
  const fast = transitFastPass(leg);
  const idem = idemKey(leg);

  const payload = {
    user_id: userId,
    // `platform` predates modes and is kept populated so every legacy reader
    // (list views, exports, the trip recorder) keeps working unchanged.
    platform: leg.operator,
    mode: leg.mode,
    operator: leg.operator,
    operator_label: leg.operator_label,
    source: leg.source,
    driver_name: leg.mode === "car" ? leg.driver_name ?? null : null,
    plate: leg.plate ?? null,
    vehicle: leg.vehicle ?? null,
    vehicle_ident: leg.vehicle_ident ?? null,
    city: leg.city ?? null,
    pickup_label: leg.origin_label ?? null,
    destination_label: leg.destination_label ?? null,
    depart_at: leg.depart_at ?? null,
    booking_ref: leg.booking_ref ?? null,
    seat: leg.seat ?? null,
    leg: (extra.raw ?? {}) as Record<string, unknown>,
    status: "fast_done",
    verdict: fast.verdict,
    confidence: fast.confidence,
    idempotency_key: idem,
    email_message_id: extra.email_message_id ?? null,
    auto_captured: extra.auto_captured ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data: prior } = await admin()
    .from("rideshare_rides").select("id").eq("user_id", userId).eq("idempotency_key", idem).maybeSingle();

  const { data: row, error } = prior
    ? await admin().from("rideshare_rides").update(payload).eq("id", prior.id).select().single()
    : await admin().from("rideshare_rides").insert(payload).select().single();
  if (error) throw error;

  await admin().from("rideshare_reports").upsert({
    ride_id: row.id,
    user_id: userId,
    phase: "fast",
    verdict: fast.verdict,
    confidence: fast.confidence,
    score: fast.score,
    headline: fast.headline,
    payload: fast.payload,
  }, { onConflict: "ride_id,phase" });

  return row as { id: string } & Record<string, unknown>;
}

// ── Mode-dispatched collection ─────────────────────────────────────────────

/**
 * Assemble the evidence block for a non-car leg. Each source is independent and
 * timeboxed; `Promise.allSettled` means a hung registry cannot take the area
 * briefing down with it.
 */
async function collectForLeg(
  userId: string,
  leg: TransitLegInput,
  cfg: ZophielByokConfig | null,
): Promise<{ block: string; flags: TransitFlag[]; area: { level: string; label: string } | null }> {
  const blocks: string[] = [];
  const flags: TransitFlag[] = [];
  let area: { level: string; label: string } | null = null;

  const jobs: Promise<void>[] = [];

  if (leg.mode === "air" || leg.mode === "helicopter") {
    jobs.push((async () => {
      const d = await aviationDossier({
        designator: leg.vehicle_ident && /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(leg.vehicle_ident) ? leg.vehicle_ident : null,
        registration: leg.vehicle_ident && /^N[0-9]/.test(leg.vehicle_ident) ? leg.vehicle_ident : null,
        ticket_from: leg.origin_label,
        ticket_to: leg.destination_label,
      });
      blocks.push(d.block);
      flags.push(...d.flags);
    })());
  }

  if (leg.mode === "rail" || leg.mode === "bus" || leg.mode === "ferry") {
    jobs.push((async () => {
      const d = await railDossier({
        origin: leg.origin_label,
        destination: leg.destination_label,
        service: leg.vehicle_ident,
        operator_label: leg.operator_label,
      });
      blocks.push(d.block);
      flags.push(...d.flags);
    })());
  }

  // Ground risk at the place the traveller actually arrives applies to every
  // mode — a safe flight into an unsafe 1 a.m. terminal is not a safe journey.
  const anchor = leg.destination_label || leg.origin_label;
  if (anchor && anchor.length > 3 && !/^[A-Z]{3}$/.test(anchor)) {
    jobs.push((async () => {
      const a = await assessAreaByLabel(admin(), anchor, cfg);
      if (!a) return;
      const level = a.risk_level;
      area = { level, label: a.place_label || anchor };
      blocks.push(`DESTINATION AREA BRIEFING (${a.place_label})\n${a.summary}`.slice(0, 4000));
      if (ALERTING_LEVELS.has(level)) {
        flags.push({
          code: "AREA_RISK",
          severity: "warn",
          detail: `Ground risk at ${a.place_label} is ${level}. This describes the arrival area, not the carrier.`,
          evidence: `Asherin area-risk engine, score ${a.risk_score}`,
        });
      }
    })());
  }

  await Promise.allSettled(jobs);
  return { block: blocks.join("\n\n"), flags, area };
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

  try {
    switch (action) {
      // ── capture ────────────────────────────────────────────────────────
      case "leg.capture": {
        const modeRaw = String(body.mode || "car");
        if (!isTransitMode(modeRaw)) return json({ error: "invalid_mode" }, 400, cors);
        const operator = (str(body.operator, 40) || "unknown").toLowerCase().replace(/[^a-z0-9_]/g, "");
        const profile = operatorById(operator);

        const leg: TransitLegInput = {
          mode: modeRaw,
          operator: operator || "unknown",
          operator_label: profile?.label || str(body.operator_label, 80) || "Unknown operator",
          vehicle_ident: str(body.vehicle_ident, 24)?.toUpperCase() ?? null,
          vehicle: str(body.vehicle, 80),
          driver_name: modeRaw === "car" ? str(body.driver_name, 80) : null,
          plate: modeRaw === "car" ? (str(body.plate, 16)?.toUpperCase() ?? null) : null,
          origin_label: str(body.origin_label, 160),
          destination_label: str(body.destination_label, 160),
          depart_at: isoOrNull(body.depart_at),
          booking_ref: str(body.booking_ref, 16)?.toUpperCase() ?? null,
          seat: str(body.seat, 12),
          city: str(body.city, 80),
          source: "manual",
        };

        // A leg with no identifier and no route is not a journey, it is a note.
        if (!leg.vehicle_ident && !leg.plate && !(leg.origin_label && leg.destination_label)) {
          return json({
            error: "insufficient_leg",
            message: "Provide a service identifier (flight, train or plate) or both ends of the route.",
          }, 400, cors);
        }

        const row = await upsertLeg(userId, leg, { auto_captured: false });
        return json({ leg: row, fast: transitFastPass(leg) }, 200, cors);
      }

      // ── sweep ──────────────────────────────────────────────────────────
      case "leg.sweep": {
        const legId = str(body.leg_id, 60) || str(body.ride_id, 60);
        if (!legId) return json({ error: "leg_id_required" }, 400, cors);

        const { data: row, error: rErr } = await admin()
          .from("rideshare_rides").select("*").eq("id", legId).eq("user_id", userId).maybeSingle();
        if (rErr) throw rErr;
        if (!row) return json({ error: "not_found" }, 404, cors);

        let key;
        try { key = await resolveKey(req, body.byok); }
        catch (e) { return byokErrorResponse(e, cors); }
        const cfg: ZophielByokConfig = key.mode === "admin"
          ? { provider: "google", model: "gemini-flash-latest", apiKey: key.geminiKey! }
          : key.byok!;

        const leg = rowToLeg(row as LegRow);
        const settings = await loadSettings(userId);

        // Cars keep the licensed-driver pivot they already have. Running a
        // second, weaker car path here is how two desks drift apart.
        if (leg.mode === "car") {
          const ride: RideInput = {
            platform: row.platform, source: row.source, driver_name: row.driver_name,
            plate: row.plate, vehicle: row.vehicle, city: row.city,
            pickup_label: row.pickup_label, trip_url: row.trip_url,
          };
          const { deep, delivered } = await runDeepSweep({
            userId, userEmail, rideId: row.id, ride, cfg, settings,
          });
          return json({ deep, delivered, mode: "car" }, 200, cors);
        }

        const collection = await collectForLeg(userId, leg, cfg);
        const fast = transitFastPass(leg);
        const deterministic = [
          ...((fast.payload.flags as TransitFlag[]) || []),
          ...collection.flags,
        ];

        let parsed: Record<string, unknown> = {};
        try {
          const raw = await callByokJsonWithRetry(
            cfg,
            transitSystemPrompt(leg.mode),
            buildTransitPrompt(leg, collection.block),
            { temperature: 0.2, maxOutputTokens: 2600 },
          );
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch (e) {
          log("model failed", { legId, msg: (e as Error).message?.slice(0, 160) });
          // A dead model must not delete the deterministic answer the
          // traveller already earned from primary sources.
          parsed = {
            verdict: deterministic.some((f) => f.severity === "high") ? "WATCH" : "THIN",
            identity_confidence: fast.confidence,
            headline: `${MODE_LABEL[leg.mode]} · ${leg.operator_label} — primary-source check only`,
            assessment: "The analytic model was unavailable. The findings below come only from deterministic primary-source checks.",
            gaps: ["Narrative assessment unavailable — primary-source checks were still run."],
          };
        }

        const deep = enforceTransitDoctrine(parsed as unknown as ModelAssessment, leg, deterministic);

        await admin().from("rideshare_reports").upsert({
          ride_id: row.id,
          user_id: userId,
          phase: "deep",
          verdict: deep.verdict,
          confidence: deep.confidence,
          score: deep.score,
          headline: deep.headline,
          payload: { ...deep.payload, collection_preview: collection.block.slice(0, 4000) },
        }, { onConflict: "ride_id,phase" });

        await admin().from("rideshare_rides")
          .update({ status: "deep_done", verdict: deep.verdict, confidence: deep.confidence, updated_at: new Date().toISOString() })
          .eq("id", row.id);

        const delivered: string[] = [];
        if (VERDICT_RANK[deep.verdict] >= VERDICT_RANK[settings.alert_threshold as Verdict]) {
          const notice = await notifyIntel({
            userId,
            userEmail,
            kind: "transit_guardian",
            source: "Asherin Transit Guardian",
            severity: severityFromVerdict(deep.verdict),
            title: `${MODE_LABEL[leg.mode]} ${deep.verdict}: ${leg.operator_label}${leg.vehicle_ident ? ` ${leg.vehicle_ident}` : ""}`,
            body: transitReportText(leg, deep).slice(0, 4000),
            pushBody: deep.headline,
            url: "/dashboard",
            skipPush: settings.push_enabled === false,
            skipEmail: settings.email_enabled === false,
          } as Parameters<typeof notifyIntel>[0]);
          delivered.push(...(notice.channels || []));
        }

        return json({
          deep,
          delivered,
          mode: leg.mode,
          report_text: transitReportText(leg, deep),
        }, 200, cors);
      }

      // ── mailbox harvest ────────────────────────────────────────────────
      case "mail.scan": {
        const lookback = Math.min(336, Math.max(1, Number(body.lookback_hours) || 72));
        const modes = Array.isArray(body.modes)
          ? (body.modes as unknown[]).filter(isTransitMode) as TransitMode[]
          : undefined;

        const accounts = await liveAccounts(adminClient(), userId);
        if (!accounts.length) {
          return json({ error: "no_google_accounts", message: "Connect a Google account in Cloud Intelligence first." }, 400, cors);
        }

        const q = transitGmailQuery(lookback, modes);
        const parsed: TransitLeg[] = [];
        const scanned: string[] = [];

        for (const acct of accounts) {
          if (!hasScope(acct, "gmail.readonly") && !hasScope(acct, "gmail.modify")) continue;
          try {
            const msgs = await harvestBodies(acct.token, q, 30);
            scanned.push(acct.google_email);
            for (const m of msgs) {
              const leg = parseTransitEmail({ id: m.id, subject: m.subject, at: m.at, body: m.body, from: (m as { from?: string }).from });
              if (leg) parsed.push(leg);
            }
          } catch (e) {
            log("harvest failed", { acct: acct.id, msg: (e as Error).message?.slice(0, 120) });
          }
        }

        const folded = foldLegs(parsed);
        const saved: Array<Record<string, unknown>> = [];
        for (const l of folded.slice(0, 20)) {
          const input: TransitLegInput = {
            mode: l.mode,
            operator: l.operator,
            operator_label: l.operator_label,
            vehicle_ident: l.vehicle_ident,
            vehicle: l.vehicle,
            driver_name: l.driver_name,
            plate: l.mode === "car" ? l.vehicle_ident : null,
            origin_label: l.origin_label,
            destination_label: l.destination_label,
            depart_at: l.depart_at,
            booking_ref: l.booking_ref,
            seat: l.seat,
            city: l.city,
            source: "email",
          };
          try {
            const row = await upsertLeg(userId, input, {
              email_message_id: l.messageId,
              auto_captured: true,
              raw: { kind: l.kind, gaps: l.gaps, subject: l.subject, headline: legHeadline(l) },
            });
            saved.push(row);
          } catch (e) {
            log("save failed", { msg: (e as Error).message?.slice(0, 120) });
          }
        }

        return json({ scanned_accounts: scanned, found: folded.length, saved: saved.length, legs: saved }, 200, cors);
      }

      // ── list / delete ──────────────────────────────────────────────────
      case "leg.list": {
        const mode = isTransitMode(body.mode) ? body.mode : null;
        let q = admin().from("rideshare_rides")
          .select("*, rideshare_reports(*)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (mode) q = q.eq("mode", mode);
        const { data, error } = await q;
        if (error) throw error;
        return json({ legs: data || [] }, 200, cors);
      }

      case "leg.delete": {
        const legId = str(body.leg_id, 60);
        if (!legId) return json({ error: "leg_id_required" }, 400, cors);
        await admin().from("rideshare_rides").delete().eq("id", legId).eq("user_id", userId);
        return json({ ok: true }, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 400, cors);
    }
  } catch (e) {
    log("error", { action, msg: (e as Error).message?.slice(0, 300) });
    return json({ error: "server_error", message: (e as Error).message?.slice(0, 300) }, 500, cors);
  }
});
