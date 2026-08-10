// ═══════════════════════════════════════════════════════════════════════════
// METABOLISM — one full pass of the organism
//
// This is the heartbeat: draw blood → recognise self from not-self → think →
// write down the stories → open a falsifier on each one → learn from the
// falsifiers that already resolved → decay what nobody re-witnessed → clear
// the dead cells → record vitals.
//
// It is deliberately one function so the ordering is not an accident of who
// calls what: calibration is computed BEFORE thinking (this pass is judged by
// how the last passes turned out), and decay runs AFTER thinking (a belief is
// judged at its strength when observed, not after it has already faded).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { draw } from "./bloodstream.ts";
import { think, vitals, type Story } from "./brain.ts";
import { immunePass } from "./immune.ts";
import { computeCalibration, decayPass, renewalPass } from "./homeostasis.ts";

export interface MetabolismResult {
  vitals: ReturnType<typeof vitals>;
  stories: Story[];
  immuneChanges: number;
  decayed: number;
  purged: number;
  calibration: number;
  calibrationNote: string;
  resolvedFalsifiers: number;
  tookMs: number;
}

async function organHistory(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("organism_events")
    .select("organ,observed_at")
    .eq("user_id", userId)
    .order("observed_at", { ascending: false })
    .limit(3000);
  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    if (!seen.has(row.organ)) seen.set(row.organ, row.observed_at);
  }
  return [...seen].map(([organ, lastSeen]) => ({ organ, lastSeen }));
}

/**
 * A falsifier resolves the moment the story it belongs to stops being told.
 * If the brain still tells it, the story held (confirmed). If the brain has
 * dropped it while the evidence window still covers it, the story failed to
 * reproduce (refuted). That is the whole learning loop — no human grading.
 */
async function resolveFalsifiers(
  db: SupabaseClient,
  userId: string,
  liveKeys: Set<string>,
): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: pending } = await db
    .from("organism_outcomes")
    .select("id,finding_id,created_at")
    .eq("user_id", userId)
    .eq("resolution", "pending")
    .lte("created_at", cutoff)
    .limit(200);
  if (!pending?.length) return 0;

  const ids = pending.map((p) => p.finding_id).filter(Boolean);
  const { data: findings } = await db
    .from("organism_findings")
    .select("id,story_key")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const keyOf = new Map((findings ?? []).map((f) => [f.id, f.story_key]));

  const now = new Date().toISOString();
  let resolved = 0;
  for (const p of pending) {
    const key = keyOf.get(p.finding_id);
    if (!key) continue;
    const resolution = liveKeys.has(key) ? "confirmed" : "refuted";
    const { error } = await db
      .from("organism_outcomes")
      .update({
        resolution,
        checked_at: now,
        note:
          resolution === "confirmed"
            ? "story still reproduced from fresh blood after the falsification window"
            : "story no longer reproduces — the original read did not survive corroboration",
      })
      .eq("id", p.id)
      .eq("user_id", userId);
    if (!error) resolved += 1;
  }
  return resolved;
}

export async function metabolize(
  db: SupabaseClient,
  userId: string,
  opts: { windowHours?: number; renew?: boolean } = {},
): Promise<MetabolismResult> {
  const started = Date.now();
  const now = Date.now();

  // 1 — how much should this organism trust itself right now?
  const cal = await computeCalibration(db, userId);

  // 2 — draw blood
  const { events, entities } = await draw(db, userId, opts.windowHours ?? 72);

  // 3 — self / not-self, before judgement, because the brain reads self_status
  const verdicts = immunePass(entities, events, now);
  for (const v of verdicts) {
    await db
      .from("organism_entities")
      .update({ self_status: v.to, updated_at: new Date(now).toISOString() })
      .eq("id", v.entityId)
      .eq("user_id", userId);
    const local = entities.find((e) => e.id === v.entityId);
    if (local) local.self_status = v.to;
  }

  // 4 — think
  const history = await organHistory(db, userId);
  const stories = think({ events, entities, organHistory: history, now, calibration: cal.value });
  const liveKeys = new Set(stories.map((s) => s.storyKey));

  // 5 — write the stories down (idempotent on story_key: one story, one row)
  const nowIso = new Date(now).toISOString();
  if (stories.length) {
    const { data: written } = await db
      .from("organism_findings")
      .upsert(
        stories.map((s) => ({
          user_id: userId,
          story_key: s.storyKey,
          title: s.title,
          narrative: s.narrative,
          severity: s.severity,
          tier: s.tier,
          confidence: Number(s.confidence.toFixed(3)),
          corroboration: s.corroboration,
          organs: s.organs,
          entity_ids: s.entityIds,
          event_ids: s.eventIds,
          falsifier: s.falsifier,
          reflex_origin: s.reflexOrigin,
          status: "open",
          last_seen: nowIso,
          expires_at: new Date(now + 30 * 86_400_000).toISOString(),
          updated_at: nowIso,
        })),
        { onConflict: "user_id,story_key" },
      )
      .select("id,story_key,confidence,organs,falsifier");

    // 6 — every story ships with an open falsifier, or it has not shipped
    for (const f of written ?? []) {
      const { data: existing } = await db
        .from("organism_outcomes")
        .select("id")
        .eq("user_id", userId)
        .eq("finding_id", f.id)
        .eq("resolution", "pending")
        .maybeSingle();
      if (existing) continue;
      await db.from("organism_outcomes").insert({
        user_id: userId,
        finding_id: f.id,
        organ: (f.organs ?? [])[0] ?? "brain",
        predicted_confidence: f.confidence,
        falsifier: f.falsifier,
        resolution: "pending",
      });
    }
  }

  // 7 — close stories the brain no longer tells
  await db
    .from("organism_findings")
    .update({ status: "closed", updated_at: nowIso })
    .eq("user_id", userId)
    .eq("status", "open")
    .lt("last_seen", new Date(now - 6 * 3_600_000).toISOString());

  const resolvedFalsifiers = await resolveFalsifiers(db, userId, liveKeys);

  // 8 — homeostasis
  const decayed = await decayPass(db, userId, now);
  const purged = opts.renew === false ? 0 : await renewalPass(db);

  const v = vitals({ events, entities, stories });
  await db.from("organism_state").upsert(
    {
      user_id: userId,
      last_metabolism_at: nowIso,
      last_correlation_at: nowIso,
      calibration: Number(cal.value.toFixed(3)),
      vitals: { ...v, calibrationNote: cal.note, resolvedFalsifiers },
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  return {
    vitals: v,
    stories,
    immuneChanges: verdicts.length,
    decayed,
    purged,
    calibration: cal.value,
    calibrationNote: cal.note,
    resolvedFalsifiers,
    tookMs: Date.now() - started,
  };
}
