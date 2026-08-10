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

  // First-name-only rides still get discovery collection. Suppressing every
  // name angle created a chicken-and-egg failure: the search that could discover
  // a surname required a surname before it would run. Exact ride anchors narrow
  // the corpus; downstream identity doctrine still forbids attribution until
  // two independent identifiers bind the result to this driver.
  const anchors = !bound
    ? [ride.plate ? `"${ride.plate}"` : "", ride.vehicle ? `"${ride.vehicle}"` : "", ride.platform]
        .filter(Boolean).join(" ")
    : "";
  const subject = bound ? name : `"${name}" ${anchors}`.trim();
  const prefix = bound ? "" : "Discovery — ";

  const angles: Angle[] = [
    { label: `${prefix}identity`, query: `who is ${subject}${where} rideshare driver profile` },
    { label: `${prefix}court & safety record`, query: `${subject}${where} court records criminal charges arrest case docket` },
    { label: `${prefix}driving & licensing`, query: `${subject}${where} driver license traffic violations DUI commercial license` },
    { label: `${prefix}employment`, query: `${subject}${where} rideshare employment current employer work` },
    { label: `${prefix}reputation & complaints`, query: `${subject}${where} uber lyft driver reviews complaints rating passenger` },
  ];
  if (bound) {
    angles.push({ label: "Associates & relationships", query: `${name}${where} family relatives associates known connections` });
  }
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

  // A first name must not be discarded. It is not enough to attribute a record,
  // but it is still a useful discovery anchor when fenced by the exact plate,
  // vehicle, platform and locality. Results remain explicitly UNBOUND until an
  // independent source supplies a surname or another unique identifier.
  const unboundAnchors = [
    name ? `"${name}"` : "",
    ride.plate ? `"${ride.plate}"` : "",
    ride.vehicle ? `"${ride.vehicle}"` : "",
    ride.platform,
    ride.city || "",
  ].filter(Boolean).join(" ");
  const query = bound && name
    ? `${name}${where} rideshare driver background court record reviews complaints associates`
    : unboundAnchors
      ? `${unboundAnchors} driver profile reviews complaints rideshare`
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
        : `Identity is UNBOUND — this is a discovery sweep using the displayed first name plus the ride's plate, vehicle, platform and locality. Nothing may be attributed to ${name || "the displayed driver"} unless an independent source binds another unique identifier.`,
      body,
    ].join("\n"),
    hits,
    note: `Zophiel engine returned ${hits} ranked document(s)${graph} at ${(bundle?.topRelevance ?? 0).toFixed(2)} mean top-5 relevance.`,
  };
}

// ── Ghost identifier sweep + dork battery (contact parity) ─────────────────

/**
 * A contact dossier runs three collectors: the vault, a confirmed-sighting
 * identifier sweep and a dork battery. A driver dossier ran two, and the two it
 * skipped are the two that surface the material a rider actually wants — where
 * this plate has been seen, and what a targeted operator query exposes about
 * the person driving. There was never a reason for the asymmetry beyond wall
 * clock, so both legs are added here under their own budgets.
 *
 * Both are strictly additive and independently timed: a failure, a timeout or a
 * missing model key costs the dossier that block alone. Neither leg may attach
 * a person-level claim to an unbound first name — the plate is swept as a plate,
 * and the dork target only becomes a person once the pivot or the register has
 * bound a full name.
 */
async function ghostSightingLeg(
  ride: RideInput,
  budgetMs: number,
): Promise<{ block: string; hits: number; note: string }> {
  const plate = (ride.plate || "").trim();
  if (!plate || plate.length < 4 || budgetMs < 12_000) {
    return {
      block: "",
      hits: 0,
      note: plate
        ? "Ghost sighting sweep skipped — no wall clock left after the identity angles."
        : "Ghost sighting sweep skipped — no plate captured to sweep.",
    };
  }
  try {
    const { sweepIdentifier, formatSweep } = await import("./identifierSweep.ts");
    const report = await withTimeout(
      sweepIdentifier(plate, {
        budgetMs: Math.min(budgetMs - 4_000, 45_000),
        hardCeilingMs: Math.min(budgetMs, 50_000),
        openCap: 12,
        maxLeads: 24,
        adaptive: false,
      }),
      Math.min(budgetMs, 50_000),
      null,
    );
    if (!report) {
      return { block: "", hits: 0, note: "Ghost sighting sweep timed out inside its slice." };
    }
    const body = formatSweep(report).trim();
    const hits = report.surfaces?.length ?? 0;
    return {
      block: [
        "### Ghost engine — confirmed plate sightings",
        `Selector swept: plate ${plate}. A surface here is a page the plate string was actually found on, not a search result. Sightings bind to the VEHICLE; attributing them to the driver requires an independent identifier.`,
        body || "(swept — the plate has no confirmed public surface)",
      ].join("\n"),
      hits,
      note: `Ghost engine confirmed ${hits} public surface(s) carrying plate ${plate}.`,
    };
  } catch (e) {
    return { block: "", hits: 0, note: `Ghost sighting sweep failed: ${(e as Error).message?.slice(0, 120)}` };
  }
}

async function dorkLeg(
  ride: RideInput,
  resolvedName: string | null,
  geminiKey: string | null,
  budgetMs: number,
): Promise<{ block: string; hits: number; note: string }> {
  const bound = (resolvedName || "").trim();
  const subject = bound || (ride.plate || "").trim();
  if (!subject || !geminiKey || budgetMs < 15_000) {
    return {
      block: "",
      hits: 0,
      note: !geminiKey
        ? "Dork battery skipped — no model key available to generate query theories."
        : subject
          ? "Dork battery skipped — no wall clock left after the identity angles."
          : "Dork battery skipped — neither a bound name nor a plate to target.",
    };
  }
  try {
    const { runAureonDork, formatDorkContext } = await import("./aureonDorkEngine.ts");
    const report = await withTimeout(
      runAureonDork(
        {
          subject,
          kind: bound ? "person" : "topic",
          hints: {
            location: ride.city || undefined,
            industry: `${ride.platform} rideshare driver`,
          },
        },
        { geminiKey, testCap: 24, concurrency: 10, perQueryTimeoutMs: 9_000, skipBrief: true },
      ),
      Math.min(budgetMs, 55_000),
      null,
    );
    if (!report) return { block: "", hits: 0, note: "Dork battery timed out inside its slice." };
    const body = formatDorkContext(report).trim();
    const hits = report.totalHits ?? 0;
    return {
      block: [
        "### Aureon dork battery",
        bound
          ? `Operator-query battery against the bound identity "${bound}".`
          : `Identity is UNBOUND — the battery targets the vehicle/plate context only. Nothing here may be attributed to the displayed driver.`,
        body || "(battery ran — no operator query returned an indexed result)",
      ].join("\n"),
      hits,
      note: `Dork battery returned ${hits} operator-query hit(s).`,
    };
  } catch (e) {
    return { block: "", hits: 0, note: `Dork battery failed: ${(e as Error).message?.slice(0, 120)}` };
  }
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
  ctx?: { db: { from: (t: string) => any }; userId: string; rideId: string; geminiKey?: string | null },
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

  // ── Phase B3: contact-parity legs ────────────────────────────────────────
  // The two collectors a contact dossier gets and a driver dossier did not.
  // They query substrates the jurisdictional and Zophiel layers never touch,
  // so they run alongside rather than after them.
  const ghostPromise = ghostSightingLeg(
    ride,
    Math.max(0, budgetMs - (Date.now() - started) - 4_000),
  );
  const dorkPromise = dorkLeg(
    ride,
    pivot.bestFullName || pivot.registry.best_name || null,
    ctx?.geminiKey ?? Deno.env.get("GEMINI_API_KEY") ?? null,
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

  const ghost = await ghostPromise.catch(() => ({ block: "", hits: 0, note: "Ghost sighting sweep failed and was dropped." }));
  if (ghost.block) blocks.push(ghost.block);
  hits += ghost.hits;

  const dork = await dorkPromise.catch(() => ({ block: "", hits: 0, note: "Dork battery failed and was dropped." }));
  if (dork.block) blocks.push(dork.block);
  hits += dork.hits;

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

  // The safety substrate leads the context. Ordering is not cosmetic here: the
  // model reads top-down, and the first thing it must see is the material that
  // actually answers the rider's question.
  const safety = await safetyPromise;

  const identitySilent = !pivot.bestFullName && !pivot.registry.best_name;

  return {
    context: [
      safety.block,
      identitySilent
        ? "### Identity resolution — statutory limit, not a suspicious gap\nThe driver's surname could not be bound. In the United States the plate-to-owner linkage is sealed by the Driver's Privacy Protection Act and is not published on the open web, so this outcome is the expected one for nearly every ride. Report it as a limit of the method. Do NOT describe it as a red flag, and do NOT let it depress the boarding decision, which was computed from evidence that does not depend on it."
        : "",
      ...blocks,
    ].filter(Boolean).join("\n\n"),
    note: `${safety.note} ${registryNote} ${pivot.evidence.note} ${pivotNote} Ran ${ran.length}/${plan.length} identity angles across ${jurisdiction || "unspecified jurisdiction"}; ${hits} open-source hits. ${zophiel.note} ${ghost.note} ${dork.note}${skipped > 0 ? ` ${skipped} angle(s) returned nothing or timed out.` : ""}`,
    hits: hits + safety.corridorHits,
    angles: [
      "Rider-safety substrate",
      "Vehicle truth (NHTSA)",
      "Plate coherence",
      "Corridor threat",
      "Personal ride ledger",
      ...ran,
      ...(zophiel.hits > 0 ? ["Zophiel engine sweep"] : []),
      ...(ghost.hits > 0 ? ["Ghost engine plate sightings"] : []),
      ...(dork.hits > 0 ? ["Aureon dork battery"] : []),
    ],
    candidates: pivot.candidates,
    residual: pivot.residual,
    resolved_name: pivot.bestFullName,
    registry: pivot.registry,
    safety,
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
  const p = phase.payload as Record<string, any>;

  // The alert threshold governs the IDENTITY verdict, which is THIN on almost
  // every ride by construction. Gating delivery on it alone is what silenced
  // genuinely actionable briefings. A boarding decision that is not BOARD is
  // always delivered, regardless of threshold — it is the whole product.
  const decision: BoardingDecision = (p.boarding_decision as BoardingDecision) || "VERIFY";
  const decisionForces = decision !== "BOARD";
  if (!decisionForces && VERDICT_RANK[phase.verdict] < VERDICT_RANK[settings.alert_threshold]) {
    return delivered;
  }

  const protocol: string[] = Array.isArray(p.boarding_protocol) ? p.boarding_protocol : [];
  const decisionLabel = decision === "DO_NOT_BOARD"
    ? "DO NOT BOARD"
    : decision === "VERIFY"
      ? "VERIFY BEFORE BOARDING"
      : "CLEAR TO BOARD";

  const bus = await notifyIntel({
    userId,
    userEmail,
    kind: "rideshare",
    severity: decision === "DO_NOT_BOARD" ? "critical" : severityFromVerdict(phase.verdict),
    // The rider reads the first four words on a lock screen. They must be the
    // decision, never the identity verdict.
    title: `${decisionLabel} — ${p.vehicle_expected || ride.plate || "your ride"}`,
    body: p.narrative || phase.headline,
    subjectName: ride.driver_name || ride.plate || "unnamed driver",
    source: "Rideshare Guardian",
    url: `/dashboard?tab=cloud-intel&module=rideshare&ride=${rideId}`,
    sections: [
      { label: "Decision", value: decisionLabel },
      { label: "Why", value: String(p.boarding_basis || "Complete the boarding protocol before you get in.") },
      { label: "Car you are looking for", value: String(p.vehicle_expected || "not disclosed by the platform — confirm in the app") },
      { label: "Plate check", value: String(p.plate_check || "Match every character against the app.") },
      { label: "Vehicle safety record", value: String(p.vehicle_record_line || "Government vehicle index not reached.") },
      { label: "Area", value: String(p.corridor_line || "No local threat picture available.") },
      { label: "Your history with this car", value: String(p.ledger_line || "First recorded ride in this vehicle.") },
      {
        label: "Do this now",
        value: protocol.length ? protocol.slice(0, 3).join("  •  ") : (p.recommended_action || "Verify the plate and driver photo before boarding."),
      },

    ],
    findings: Array.isArray(p.flags)
      ? p.flags.map((f: any) => `${String(f?.severity || "note").toUpperCase()}: ${f?.detail ?? ""}`)
      : [],
    idempotencyKey: `rideshare:${rideId}:${p.phase ?? "deep"}`,
    skipEmail: true,
    skipPush: !settings.push_enabled,
    // Lock screens are read by whoever is standing next to the rider, and are
    // often the only thing read at all. It carries the decision and the plate —
    // the two facts that change what the rider physically does next.
    pushBody: decision === "BOARD"
      ? `Plate ${ride.plate || "—"}. Match plate, car and face, then get in the back.`
      : `${decisionLabel}. Plate ${ride.plate || "not captured"}. ${protocol[0] || "Verify before you open the door."}`,
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
  const collection = await collectDossier(ride, opts.collectionBudgetMs ?? 55_000, {
    db: admin(),
    userId,
    rideId,
    // The dork battery generates its query theories with a model. Prefer the
    // caller's own key so a BYOK rider is not silently served by the platform.
    geminiKey: cfg.provider === "gemini" && cfg.apiKey ? cfg.apiKey : (Deno.env.get("GEMINI_API_KEY") ?? null),
  });

  // Registry cross-checks are arithmetic over a government record, not model
  // opinion, so they enter the doctrine through the deterministic fast-pass
  // channel: a HIGH registry flag (licence expired, licensee is not the person
  // shown, VIN decodes to a different car) escalates the verdict on its own,
  // even if the model was lenient or the collection was otherwise silent.
  //
  // The rider-safety findings enter through the same channel and for the same
  // reason: a plate that cannot exist in its state, or a make the government
  // vehicle index does not recognise, is arithmetic we performed ourselves. It
  // must survive a lenient model, and it must not be gated behind an identity
  // binding it never depended on.
  const fastFlags = (fast.payload as Record<string, unknown>).flags as Array<Record<string, unknown>>;
  for (const f of [...collection.registry.flags, ...collection.safety.findings]) {
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

  // ── Rider-safety payload: computed in code, authoritative over the model ──
  // These are the fields the card, the push and the email render. None of them
  // is derived from anything the model said, so a hallucinating, truncated or
  // entirely failed model degrades the narrative and leaves the actionable
  // briefing intact.
  const s = collection.safety;
  const veh = s.vehicle.parsed;
  payload.boarding_decision = s.decision;
  payload.boarding_basis = s.decisionBasis;
  payload.boarding_protocol = s.protocol;
  payload.safety_findings = s.findings;
  payload.vehicle_expected = [veh.color, veh.year, veh.make, veh.model].filter(Boolean).join(" ")
    || ride.vehicle
    || "";
  payload.plate_check = s.coherence.line;
  payload.vehicle_record_line = s.vehicle.makeValidated
    ? `${s.vehicle.recalls.length} open recall(s) on this model year${s.vehicle.safetyRating?.overall && s.vehicle.safetyRating.overall !== "not published" ? ` · NCAP overall ${s.vehicle.safetyRating.overall}` : ""}${typeof s.vehicle.complaintCount === "number" ? ` · ${s.vehicle.complaintCount} owner complaint(s)` : ""}.`
    : s.vehicle.note;
  payload.corridor_line = s.corridorHits > 0
    ? `${s.corridorHits} current local report(s) reviewed for ${ride.city || "this area"}.`
    : `No current local reporting surfaced for ${ride.city || "this area"} — no-signal, not an all-clear.`;
  payload.ledger_line = s.ledger.priorSamePlate > 0
    ? `You have ridden in this exact car ${s.ledger.priorSamePlate} time(s) before.`
    : "First recorded ride in this vehicle.";
  payload.vehicle_safety = {
    parsed: veh,
    validated: s.vehicle.makeValidated,
    recalls: s.vehicle.recalls,
    complaints: s.vehicle.complaintCount,
    rating: s.vehicle.safetyRating,
  };

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
  // Registry and rider-safety flags must appear to the reader even when the
  // model omitted them.
  {
    const existing = Array.isArray(payload.flags) ? (payload.flags as Array<Record<string, unknown>>) : [];
    for (const f of [...collection.registry.flags, ...s.findings]) {
      if (!existing.some((x) => x.code === f.code)) existing.push({ ...f });
    }
    payload.flags = existing;
  }

  // The headline is the decision, not the identity verdict. "THIN — not enough
  // public record to say anything" is a true sentence that helps nobody at a
  // kerb; "VERIFY BEFORE BOARDING — silver 2019 Toyota Camry, plate 9NMB162" is
  // the same honesty pointed at something the rider can act on.
  if (s.decision !== "BOARD" || !String(deep.headline || "").trim()) {
    const label = s.decision === "DO_NOT_BOARD"
      ? "DO NOT BOARD"
      : s.decision === "VERIFY"
        ? "VERIFY BEFORE BOARDING"
        : "CLEAR TO BOARD";
    const car = String(payload.vehicle_expected || "").trim();
    deep.headline = `${label} — ${[car, ride.plate ? `plate ${ride.plate}` : ""].filter(Boolean).join(", ") || "confirm the car in the app"}`.slice(0, 120);
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
