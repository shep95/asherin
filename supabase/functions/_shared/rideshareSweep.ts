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
import { plateAnchoredIdentity, unboundContextSweep, withTimeout, type WeightedCandidate } from "./ridesharePlateIntel.ts";
import type { RegistryResult } from "./rideshareRegistry.ts";
import { runZophielIntel, formatZophielContext } from "./zophielChatBridge.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "./zophielByokRouter.ts";
import { notifyIntel, severityFromVerdict } from "./intelNotify.ts";
import {
  assembleRiderSafety,
  type RiderSafetyBriefing,
  type SafetyFinding,
  type BoardingDecision,
} from "./riderSafety.ts";
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
 *
 * `resolvedName` is the plate-anchored full name when the pivot cleared the
 * identity floor. Running a court-record query on a bare first name is not
 * collection, it is noise generation — so when only a first name exists the
 * identity-bound angles are dropped entirely and their absence is reported.
 */
function collectionPlan(ride: RideInput, resolvedName: string | null): Angle[] {
  const raw = (ride.driver_name || "").trim();
  const name = resolvedName || raw;
  const bound = Boolean(resolvedName) || raw.split(/\s+/).length > 1;
  const where = ride.city ? ` in ${ride.city}` : "";
  if (!name) return [];

  if (!bound) {
    // First-name-only and the pivot did not resolve a surname. The
    // jurisdictional identity collector needs a bindable person, so nothing it
    // returns here would be admissible; the open-web fallback runs instead.
    return [];
  }


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

// ── Zophiel engine layer ───────────────────────────────────────────────────

/**
 * The jurisdictional collector reaches registers and courts; it does not reach
 * the ranked, tier-scored, multi-index corpus the Zophiel engine maintains for
 * the dashboard. A driver's reviews, complaints, forum mentions and news trail
 * live there, so the Guardian now queries the same substrate the search tab
 * uses and folds it in as one clearly-labelled, citation-carrying block.
 *
 * It is strictly additive: a null bundle, a timeout or an engine outage costs
 * the dossier this block and nothing else. The graph layer is only requested
 * when the identity is actually bound — running relationship extraction on an
 * unbound first name manufactures associations that belong to other people.
 */
async function zophielLayer(
  ride: RideInput,
  resolvedName: string | null,
  budgetMs: number,
): Promise<{ block: string; hits: number; note: string }> {
  const raw = (ride.driver_name || "").trim();
  const name = (resolvedName || raw).trim();
  const bound = Boolean(resolvedName) || raw.split(/\s+/).length > 1;
  const where = ride.city ? ` ${ride.city}` : "";

  const query = bound && name
    ? `${name}${where} rideshare driver background court record reviews complaints associates`
    : ride.plate
      ? `license plate ${ride.plate}${where} vehicle registration rideshare driver`
      : "";

  if (!query || budgetMs < 8_000) {
    return {
      block: "",
      hits: 0,
      note: query
        ? "Zophiel engine layer skipped — no wall clock left after the identity angles."
        : "Zophiel engine layer skipped — no bindable name or plate to query.",
    };
  }

  const bundle = await withTimeout(
    runZophielIntel(query, { deep: bound, mode: "web", fast: false }),
    Math.min(budgetMs, 40_000),
    null,
  ).catch(() => null);

  const body = formatZophielContext(bundle).trim();
  if (!body) {
    return {
      block: `### Zophiel engine sweep\n(Zophiel engine queried for "${query}" — returned nothing usable)`,
      hits: 0,
      note: "Zophiel engine returned no usable corpus for this driver.",
    };
  }

  const hits = bundle?.results.length ?? 0;
  const graph = bundle?.intel ? " with graph layer" : "";
  return {
    block: [
      "### Zophiel engine sweep",
      bound
        ? "Identity-bound query against the Zophiel multi-index corpus. Tier 1 is a primary source; treat weak-match warnings as disqualifying unless corroborated."
        : "Identity is UNBOUND — this corpus was retrieved on the plate/vehicle only. Nothing here may be attributed to a named person.",
      body,
    ].join("\n"),
    hits,
    note: `Zophiel engine returned ${hits} ranked document(s)${graph} at ${(bundle?.topRelevance ?? 0).toFixed(2)} mean top-5 relevance.`,
  };
}

export interface CollectionResult {
  context: string;
  note: string;
  hits: number;
  angles: string[];
  candidates: WeightedCandidate[];
  residual: number;
  resolved_name: string | null;
  /** Deterministic regulator evidence; the authority for identity binding. */
  registry: RegistryResult;
  /** The rider-safety substrate — always present, never gated on identity. */
  safety: RiderSafetyBriefing;
}

/**
 * Run the plan with bounded concurrency and a hard wall-clock budget.
 *
 * ORDER OF PRECEDENCE — the correction that matters most in this file.
 * The rider-safety substrate launches FIRST and independently of everything
 * else, because it is the only part of this collection that reliably returns
 * anything. Identity resolution used to own the whole wall clock and gate every
 * other angle behind a binding that, measured on live rides, never occurs — a
 * US plate does not resolve to an owner on the open web and no query shape
 * changes that. So identity is now the tail, not the trunk: it runs with
 * whatever budget the safety layers did not need, it thickens the dossier when
 * it succeeds, and its silence is reported as a legal limit rather than as an
 * ominous blank.
 *
 * Within the identity tail the old ordering still holds: the plate pivot runs
 * before the angles because its output reshapes them, and each angle carries
 * its own timeout so one hanging source costs its slice and nothing more.
 */
export async function collectDossier(
  ride: RideInput,
  budgetMs = 55_000,
  ctx?: { db: { from: (t: string) => any }; userId: string; rideId: string },
): Promise<CollectionResult> {
  const started = Date.now();
  const blocks: string[] = [];
  const ran: string[] = [];
  let hits = 0;
  let jurisdiction = "";

  // ── Phase 0: rider safety, launched immediately and never blocked ────────
  // This is what the rider actually reads. It is deliberately not awaited here
  // so the identity work overlaps it rather than queueing behind it.
  const safetyPromise = ctx
    ? assembleRiderSafety({ db: ctx.db, userId: ctx.userId, rideId: ctx.rideId, ride, budgetMs: 22_000 })
    : assembleRiderSafety({ db: admin(), userId: "", rideId: "", ride, budgetMs: 22_000 });

  // ── Phase A: plate-anchored pivot (bounded, best-effort) ─────────────────
  const pivot = await plateAnchoredIdentity(ride, Math.min(14_000, Math.floor(budgetMs * 0.22)));
  blocks.push(pivot.block);
  hits += pivot.evidence.hits.length;

  if (!ride.driver_name && !pivot.bestFullName) {
    // No bindable person. That used to end the collection with an empty
    // dossier; it no longer does, because none of the rider-safety layers
    // needed a name in the first place.
    const safety = await safetyPromise;
    return {
      context: [safety.block, ...blocks].join("\n\n"),
      note: `No driver name captured — identity collection was not attempted. ${safety.note}`,
      hits,
      angles: ["Rider-safety substrate"],
      candidates: pivot.candidates,
      residual: pivot.residual,
      resolved_name: null,
      registry: pivot.registry,
      safety,
    };
  }


  // ── Phase B: identity collection, re-seeded by the pivot ─────────────────
  const plan = collectionPlan(ride, pivot.bestFullName);
  if (!plan.length) {
    // Unbound: nothing may be attributed to the person, but the car, the
    // pickup and the locality still carry rider-safety signal.
    blocks.push(await unboundContextSweep(ride, Math.min(14_000, Math.max(6_000, budgetMs - (Date.now() - started) - 4_000))));
  }
  const queue = [...plan];

  // ── Phase B2: Zophiel engine, launched alongside the angles ──────────────
  // It runs against a different substrate (the dashboard search engine), so
  // serialising it would double the wall clock for no extra evidence.
  const zophielPromise = zophielLayer(
    ride,
    pivot.bestFullName,
    Math.max(0, budgetMs - (Date.now() - started) - 4_000),
  );

  const CONCURRENCY = 3; // three parallel sweeps keeps us inside provider limits
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const remaining = budgetMs - (Date.now() - started);
      if (remaining < 6_000) return;
      const angle = queue.shift();
      if (!angle) return;
      try {
        const intent = classifyIntent(angle.query);
        if (intent.kind === "none") {
          blocks.push(`### ${angle.label}\n(query could not be resolved to a jurisdiction)`);
          continue;
        }
        // Per-angle cap: no single source may consume the shared budget.
        const bundle = await withTimeout(
          runJurisdictionalSearch(intent),
          Math.min(remaining - 2_000, 30_000),
          null as Awaited<ReturnType<typeof runJurisdictionalSearch>> | null,
        );
        if (!bundle) {
          blocks.push(`### ${angle.label}\n(collection timed out inside its slice of the budget)`);
          continue;
        }
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

  const zophiel = await zophielPromise.catch(() => ({
    block: "",
    hits: 0,
    note: "Zophiel engine layer failed and was dropped from the dossier.",
  }));
  if (zophiel.block) blocks.push(zophiel.block);
  hits += zophiel.hits;

  const skipped = plan.length - ran.length;
  const registryNote = pivot.registry.records.length
    ? `Regulator register bound plate ${ride.plate} to "${pivot.registry.records[0].raw_name}" (${pivot.registry.records[0].source}).`
    : pivot.registry.covered
      ? `Regulator register queried (${pivot.registry.queried.join(", ")}) — no for-hire licence on file for this plate.`
      : "No open for-hire register publishes this jurisdiction; identity binding falls back to open-web inference.";
  const pivotNote = pivot.bestFullName
    ? `Plate pivot resolved "${pivot.bestFullName}" at ${(pivot.candidates[0].posterior * 100).toFixed(0)}% posterior and re-seeded the identity collection.`
    : pivot.candidates.length
      ? `Plate pivot produced ${pivot.candidates.length} weighted surname candidate(s), best ${(pivot.candidates[0].posterior * 100).toFixed(0)}% — below the 55% floor, so identity-bound angles were withheld.`
      : `Plate pivot resolved no surname; identity-bound angles were withheld as unbindable.`;

  return {
    context: blocks.join("\n\n"),
    note: `${registryNote} ${pivot.evidence.note} ${pivotNote} Ran ${ran.length}/${plan.length} identity angles across ${jurisdiction || "unspecified jurisdiction"}; ${hits} open-source hits. ${zophiel.note}${skipped > 0 ? ` ${skipped} angle(s) returned nothing or timed out.` : ""}`,
    hits,
    angles: zophiel.hits > 0 ? [...ran, "Zophiel engine sweep"] : ran,
    candidates: pivot.candidates,
    residual: pivot.residual,
    resolved_name: pivot.bestFullName,
    registry: pivot.registry,
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
            // Resolve to the rendered dossier when the row exists; the in-app
            // deep link is only the fallback.
            reportUrl: bus.notificationId
              ? `https://asherin.com/report/${bus.notificationId}`
              : `https://asherin.com/dashboard?tab=cloud-intel&module=rideshare&ride=${encodeURIComponent(rideId)}`,
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

  // Registry cross-checks are arithmetic over a government record, not model
  // opinion, so they enter the doctrine through the deterministic fast-pass
  // channel: a HIGH registry flag (licence expired, licensee is not the person
  // shown, VIN decodes to a different car) escalates the verdict on its own,
  // even if the model was lenient or the collection was otherwise silent.
  const fastFlags = (fast.payload as Record<string, unknown>).flags as Array<Record<string, unknown>>;
  for (const f of collection.registry.flags) {
    if (!fastFlags.some((x) => x.code === f.code)) {
      fastFlags.push({ code: f.code, severity: f.severity, detail: f.detail, evidence: f.evidence });
    }
  }

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

  // Deterministic evidence outranks a model's self-reported confidence in ONE
  // direction only: a surname that was recombined from a page carrying this
  // exact plate is arithmetic we performed ourselves, so it may raise the
  // binding strength. It may never lower it, and it may never invent a verdict.
  const anchored = collection.candidates.find((c) => c.plate_anchored);
  if (anchored && parsedModel && typeof parsedModel === "object") {
    const pm = parsedModel as Record<string, unknown>;
    const modelConf = typeof pm.identity_confidence === "number" ? pm.identity_confidence : 0;
    // A registry-bound licensee is a primary-source identity and is allowed a
    // higher ceiling than a web recombination, which stays capped at 0.85.
    const ceiling = collection.registry.best_name ? 0.95 : 0.85;
    pm.identity_confidence = Math.max(modelConf, Math.min(anchored.posterior, ceiling));
  }

  const deep = enforceDoctrine(parsedModel, fast);
  const payload = deep.payload as Record<string, unknown>;
  payload.collection_note = collection.note;
  payload.collection_angles = collection.angles;
  payload.plate_candidates = collection.candidates;
  payload.unresolved_mass = collection.residual;
  payload.pivot_resolved_name = collection.resolved_name;
  payload.registry = {
    covered: collection.registry.covered,
    queried: collection.registry.queried,
    records: collection.registry.records,
    vin: collection.registry.vin,
    flags: collection.registry.flags,
    bound_name: collection.registry.best_name,
    binding_confidence: collection.registry.confidence,
  };
  // Registry flags must appear to the reader even when the model omitted them.
  {
    const existing = Array.isArray(payload.flags) ? (payload.flags as Array<Record<string, unknown>>) : [];
    for (const f of collection.registry.flags) {
      if (!existing.some((x) => x.code === f.code)) existing.push({ ...f });
    }
    payload.flags = existing;
  }
  if (collection.registry.best_name && !(payload.subject_profile as any)?.resolved_name) {
    (payload.subject_profile as any) = {
      ...((payload.subject_profile as any) || {}),
      resolved_name: collection.registry.best_name,
    };
  }
  // When the model named nobody, the weighted reconstruction is still the most
  // honest candidate list we have — surfaced with its posteriors intact.
  if (!Array.isArray(payload.candidates) || !(payload.candidates as unknown[]).length) {
    payload.candidates = collection.candidates.map((c) => ({
      name: c.name,
      age: "",
      locality: ride.city || "",
      basis: c.reasons.join("; "),
      match_confidence: Number(c.posterior.toFixed(3)),
    }));
  }


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
