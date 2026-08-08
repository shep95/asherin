/**
 * RIDESHARE SWEEP — the elite pass, shared by the manual desk and the autopilot.
 *
 * The manual sweep used to run a single query ("background check on NAME in
 * CITY") and hand whatever came back to the model. One angle is not an
 * intelligence collection plan: a driver's court record, their vehicle
 * registration, their employment trail, and what passengers say about them all
 * live in different corners of the open web, and a single query reaches at most
 * one of them.
 *
 * This module runs a bounded multi-angle collection instead, then folds the
 * angles into one evidence block for the doctrine-enforced assessment. Every
 * angle is optional and degrades independently — a dead source thins the
 * dossier, it never fails the sweep, because a rider standing at the kerb needs
 * an answer more than a complete one.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyIntent, runJurisdictionalSearch, formatIntelContext } from "./jurisdictionalIntel.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "./zophielByokRouter.ts";
import { notifyIntel, severityFromVerdict } from "./intelNotify.ts";
import {
  fastPass,
  buildDeepUserPrompt,
  DEEP_SYSTEM_PROMPT,
  enforceDoctrine,
  VERDICT_RANK,
  type RideInput,
  type PhaseResult,
  type Verdict,
} from "./rideshareGuardian.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export interface GuardianSettings {
  alert_threshold: Verdict;
  push_enabled: boolean;
  email_enabled: boolean;
  auto_from_email: boolean;
  autopilot_enabled?: boolean;
  lookback_hours?: number;
}

export const DEFAULT_SETTINGS: GuardianSettings = {
  alert_threshold: "WATCH",
  push_enabled: true,
  email_enabled: true,
  auto_from_email: true,
  autopilot_enabled: false,
  lookback_hours: 24,
};

export async function loadSettings(userId: string): Promise<GuardianSettings> {
  const { data } = await admin()
    .from("rideshare_settings")
    .select("alert_threshold, push_enabled, email_enabled, auto_from_email, autopilot_enabled, lookback_hours")
    .eq("user_id", userId)
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data || {}) } as GuardianSettings;
}

// ── Collection plan ────────────────────────────────────────────────────────

interface Angle { label: string; query: string }

/**
 * The angles are ordered by rider-safety value, because the wall clock, not the
 * source list, is what actually limits a sweep. If the budget runs out at angle
 * four, the four that ran are the four that mattered most.
 */
function collectionPlan(ride: RideInput): Angle[] {
  const name = ride.driver_name!;
  const where = ride.city ? ` in ${ride.city}` : "";
  const angles: Angle[] = [
    { label: "Identity & residence", query: `who is ${name}${where} address phone email background` },
    { label: "Court & criminal record", query: `${name}${where} court records criminal charges arrest case docket` },
    { label: "Driving & licensing", query: `${name}${where} driver license record traffic violations DUI commercial license` },
    { label: "Employment history", query: `${name}${where} employment history current job employer work` },
    { label: "Reputation & complaints", query: `${name}${where} uber lyft driver reviews complaints rating passenger` },
    { label: "Associates & relationships", query: `${name}${where} family relatives associates known connections` },
  ];
  if (ride.plate) {
    angles.push({ label: "Vehicle registration", query: `license plate ${ride.plate}${where} vehicle registration record` });
  }
  return angles;
}

export interface CollectionResult { context: string; note: string; hits: number; angles: string[] }

/**
 * Run the plan with bounded concurrency and a hard wall-clock budget.
 * Angles resolve independently; a rejected angle contributes an explicit
 * "returned nothing" line so the model can distinguish "searched and empty"
 * from "never searched" — the difference between THIN and a false CLEAR.
 */
export async function collectDossier(
  ride: RideInput,
  budgetMs = 55_000,
): Promise<CollectionResult> {
  if (!ride.driver_name) {
    return {
      context: "",
      note: "No driver name captured — no public-record collection was attempted.",
      hits: 0,
      angles: [],
    };
  }

  const plan = collectionPlan(ride);
  const started = Date.now();
  const blocks: string[] = [];
  const ran: string[] = [];
  let hits = 0;
  let jurisdiction = "";

  const queue = [...plan];
  const CONCURRENCY = 3; // three parallel sweeps keeps us inside provider limits
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      if (Date.now() - started > budgetMs) return;
      const angle = queue.shift();
      if (!angle) return;
      try {
        const intent = classifyIntent(angle.query);
        if (intent.kind === "none") {
          blocks.push(`### ${angle.label}\n(query could not be resolved to a jurisdiction)`);
          continue;
        }
        const bundle = await runJurisdictionalSearch(intent);
        hits += bundle.totalHits ?? 0;
        jurisdiction ||= bundle.jurisdictionLabel || "";
        const body = formatIntelContext(bundle).trim();
        blocks.push(`### ${angle.label}\n${body || "(searched — nothing surfaced)"}`);
        ran.push(angle.label);
      } catch (e) {
        // A failed angle is recorded as a gap, never silently dropped.
        blocks.push(`### ${angle.label}\n(collection failed: ${(e as Error).message?.slice(0, 120) ?? "unknown"})`);
      }
    }
  });
  await Promise.allSettled(workers);

  const skipped = plan.length - ran.length;
  return {
    context: blocks.join("\n\n"),
    note: `Ran ${ran.length}/${plan.length} collection angles across ${jurisdiction || "unspecified jurisdiction"}; ${hits} open-source hits.${skipped > 0 ? ` ${skipped} angle(s) returned nothing or timed out.` : ""}`,
    hits,
    angles: ran,
  };
}

// ── Delivery ───────────────────────────────────────────────────────────────

/**
 * Alerting is best-effort by contract: a dead push endpoint must never cost the
 * rider their report, so every channel is isolated and its outcome recorded.
 */
export async function deliver(
  userId: string,
  userEmail: string | null,
  ride: RideInput,
  phase: PhaseResult,
  settings: GuardianSettings,
  rideId: string,
): Promise<string[]> {
  const delivered: string[] = [];
  if (VERDICT_RANK[phase.verdict] < VERDICT_RANK[settings.alert_threshold]) return delivered;

  const p = phase.payload as Record<string, any>;
  const bus = await notifyIntel({
    userId,
    userEmail,
    kind: "rideshare",
    severity: severityFromVerdict(phase.verdict),
    title: `${phase.verdict} — ${phase.headline}`,
    body: p.narrative || phase.headline,
    subjectName: ride.driver_name || ride.plate || "unnamed driver",
    source: "Rideshare Guardian",
    url: `/dashboard?tab=cloud-intel&module=rideshare&ride=${rideId}`,
    sections: [
      { label: "Identity confidence", value: `${Math.round(phase.confidence * 100)}%` },
      { label: "Vehicle", value: `${ride.vehicle || "not captured"} · plate ${ride.plate || "not captured"}` },
      { label: "Recommended action", value: p.recommended_action || "Verify the plate and driver photo before boarding." },
    ],
    findings: Array.isArray(p.flags)
      ? p.flags.map((f: any) => `${String(f?.severity || "note").toUpperCase()}: ${f?.detail ?? ""}`)
      : [],
    idempotencyKey: `rideshare:${rideId}:${p.phase ?? "deep"}`,
    skipEmail: true,
    skipPush: !settings.push_enabled,
    // Lock screens are read by whoever is standing next to the rider.
    pushBody: `${phase.headline}. Open Asherin for the assessment.`,
  });
  for (const c of bus.channels) if (!delivered.includes(c)) delivered.push(c);

  if (settings.email_enabled && userEmail) {
    // The email is an ALERT, not the dossier.
    //
    // Mail is stored in plaintext on servers the rider does not control, is
    // forwarded and screenshotted, and — for autopilot users — lands in the
    // very mailbox the trips are harvested from. A named private individual's
    // resolved identity, candidate matches and evidence links sitting there
    // forever is the largest liability in this chain, and it is also the one
    // that would make the product indefensible if that mailbox is breached.
    // So the mail carries only what the rider needs on the curb with a phone
    // in their hand: the verdict, what car to expect, and what to do. The
    // dossier stays behind the session, one tap away.
    const flagList = Array.isArray(p.flags) ? p.flags : [];
    const worst = flagList.some((f: any) => String(f?.severity).toLowerCase() === "high")
      ? "high"
      : flagList.length
        ? "moderate"
        : "none";
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: "rideshare-report",
          recipientEmail: userEmail,
          idempotencyKey: `rideshare-${rideId}-${p.phase}`,
          templateData: {
            verdict: phase.verdict,
            headline: phase.headline,
            plate: ride.plate || "not captured",
            vehicle: ride.vehicle || "not captured",
            platform: ride.platform,
            recommendedAction: p.recommended_action || "",
            flagCount: flagList.length,
            flagSeverity: worst,
            reportUrl: `https://asherin.com/dashboard?tab=cloud-intel&module=rideshare&ride=${encodeURIComponent(rideId)}`,
            generatedAt: new Date().toUTCString(),
          },
        }),
      });
      if (res.ok) delivered.push("email");
      else console.error("guardian_email_failed", res.status, (await res.text()).slice(0, 300));
    } catch (e) {
      console.error("guardian_email_error", e instanceof Error ? e.message : e);
    }
  }
  return delivered;
}

// ── The sweep itself ───────────────────────────────────────────────────────

/**
 * Deep pass for one ride: collect, assess, enforce doctrine, persist, alert.
 * Callers own authorisation; this function assumes `rideId` already belongs to
 * `userId` and never reads a user id out of a request body.
 */
export async function runDeepSweep(opts: {
  userId: string;
  userEmail: string | null;
  rideId: string;
  ride: RideInput;
  cfg: ZophielByokConfig;
  settings: GuardianSettings;
  collectionBudgetMs?: number;
}): Promise<{ deep: PhaseResult; delivered: string[] }> {
  const { userId, userEmail, rideId, ride, cfg, settings } = opts;
  const fast = fastPass(ride);
  const collection = await collectDossier(ride, opts.collectionBudgetMs ?? 55_000);

  const raw = await callByokJsonWithRetry(
    cfg,
    DEEP_SYSTEM_PROMPT,
    buildDeepUserPrompt(ride, collection.context),
    { temperature: 0.15, jsonMode: true, maxOutputTokens: 8192, timeoutMs: 120_000, attempts: 3 },
  );

  let parsedModel: unknown = {};
  try {
    parsedModel = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    // A malformed model reply must not become a verdict; doctrine will clamp
    // the empty object to THIN, which is the honest outcome.
    parsedModel = {};
  }
  const deep = enforceDoctrine(parsedModel, fast);
  const payload = deep.payload as Record<string, unknown>;
  payload.collection_note = collection.note;
  payload.collection_angles = collection.angles;

  const delivered = await deliver(userId, userEmail, ride, deep, settings, rideId);

  await admin().from("rideshare_reports").upsert({
    ride_id: rideId,
    user_id: userId,
    phase: "deep",
    verdict: deep.verdict,
    confidence: deep.confidence,
    score: deep.score,
    headline: deep.headline,
    payload: deep.payload,
    delivered_channels: delivered,
  }, { onConflict: "ride_id,phase" });

  await admin().from("rideshare_rides").update({
    status: "deep_done",
    verdict: deep.verdict,
    confidence: deep.confidence,
    updated_at: new Date().toISOString(),
  }).eq("id", rideId);

  return { deep, delivered };
}
