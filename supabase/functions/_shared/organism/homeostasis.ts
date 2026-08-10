// ═══════════════════════════════════════════════════════════════════════════
// HOMEOSTASIS — the organism regulating itself
//
// Everything here exists so the system can be wrong in public and correct
// itself without a human editing a threshold.
//
//   • CALIBRATION: every finding shipped with a falsifier. When the falsifier
//     resolves, we learn whether the organism's confidence was earned. The
//     running hit-rate becomes the gain on all future fusion — an organism
//     that has been crying wolf gets quieter automatically.
//   • DECAY: a belief nobody has re-witnessed loses strength on a half-life,
//     so certainty must be continuously paid for rather than banked.
//   • RENEWAL: expired cells are cleared. Forgetting is a feature; a memory
//     that only grows becomes both a liability and a slower brain.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clamp01, decay } from "./confidence.ts";
import type { EntityRow } from "./bloodstream.ts";

export interface Calibration {
  value: number;
  resolved: number;
  confirmed: number;
  refuted: number;
  note: string;
}

/**
 * Calibration is a Laplace-smoothed hit rate, so a single lucky call cannot
 * swing the whole organism. Neutral (0.5) until there is real history.
 */
export async function computeCalibration(db: SupabaseClient, userId: string): Promise<Calibration> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("organism_outcomes")
    .select("resolution")
    .eq("user_id", userId)
    .neq("resolution", "pending")
    .gte("checked_at", since)
    .limit(500);

  if (error || !data?.length) {
    return { value: 0.5, resolved: 0, confirmed: 0, refuted: 0, note: "no resolved falsifiers yet — neutral gain" };
  }

  const confirmed = data.filter((d) => d.resolution === "confirmed").length;
  const refuted = data.filter((d) => d.resolution === "refuted").length;
  const denom = confirmed + refuted;
  if (!denom) {
    return { value: 0.5, resolved: data.length, confirmed, refuted, note: "outcomes recorded but none decisive" };
  }

  // Laplace smoothing with a prior of 2 pseudo-observations at 0.5
  const value = clamp01((confirmed + 1) / (denom + 2));
  return {
    value,
    resolved: denom,
    confirmed,
    refuted,
    note:
      value < 0.4
        ? `${refuted}/${denom} falsifiers refuted — organism damped, it has been over-calling`
        : value > 0.6
          ? `${confirmed}/${denom} falsifiers held — organism trusts its own reads more`
          : `${confirmed}/${denom} held — calibration neutral`,
  };
}

/** Apply the half-life to every belief that has not been re-witnessed. */
export async function decayPass(db: SupabaseClient, userId: string, now: number): Promise<number> {
  const { data, error } = await db
    .from("organism_entities")
    .select("id,confidence,half_life_hours,last_seen,last_decayed_at")
    .eq("user_id", userId)
    .gt("confidence", 0.02)
    .limit(2000);
  if (error || !data?.length) return 0;

  const stamp = new Date(now).toISOString();
  const updates = data
    .map((e) => {
      const from = Date.parse(e.last_decayed_at ?? e.last_seen);
      const hours = (now - from) / 3_600_000;
      if (!Number.isFinite(hours) || hours < 1) return null;
      const next = decay(Number(e.confidence), hours, Number(e.half_life_hours) || 336);
      if (Math.abs(next - Number(e.confidence)) < 0.005) return null;
      return { id: e.id, confidence: Number(next.toFixed(3)), last_decayed_at: stamp };
    })
    .filter(Boolean) as { id: string; confidence: number; last_decayed_at: string }[];

  // Chunked so a large roster never blows the statement size.
  let applied = 0;
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    await Promise.all(
      chunk.map((u) =>
        db
          .from("organism_entities")
          .update({ confidence: u.confidence, last_decayed_at: u.last_decayed_at })
          .eq("id", u.id)
          .eq("user_id", userId),
      ),
    );
    applied += chunk.length;
  }
  return applied;
}

/** Cell renewal: clear what has outlived its usefulness. */
export async function renewalPass(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("organism_purge");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

/** Entities whose belief has decayed below the noise floor are dead weight. */
export function isVestigial(entity: EntityRow): boolean {
  return Number(entity.confidence) < 0.05 && entity.self_status === "unknown";
}
