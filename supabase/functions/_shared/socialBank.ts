// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL BANK — persistence for scarce social captures.
//
// Instagram's public endpoint is throttled by egress IP reputation and no
// proxy vendor will carry the domain, so a successful read is a scarce asset
// rather than a repeatable call. Two mechanisms follow from that:
//
//   BANK      a success is written once and served to every later sweep,
//             so a locked window degrades to stale data instead of no data.
//   COOLDOWN  a throttle response parks the platform for a backoff interval,
//             because hammering a rate limiter is what keeps it closed.
//
// Both are best-effort. A storage failure must never void a live result the
// operator already paid for, so every function here swallows its own errors
// and reports the degradation rather than throwing into the request path.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { Platform, SocialProbeResult, Verdict } from "./socialSubstrate.ts";

/** How long a banked capture is served before a live re-read is preferred. */
const FRESH_HOURS: Record<Platform, number> = {
  // Cheap and reliable, so re-read often to stay current.
  x: 12,
  // Scarce. Hold far longer; a stale capture beats a lockout.
  instagram: 72,
  linkedin: 24,
  facebook: 24,
};

/**
 * Ceiling on how old a banked capture may be before it is withheld entirely.
 * Beyond this the data is more likely to mislead than inform, so the sweep
 * reports the refusal honestly rather than passing off a stale profile.
 */
const MAX_SERVE_HOURS = 24 * 21;

/** Exponential backoff per consecutive throttle, capped so it always recovers. */
const BACKOFF_MINUTES = [15, 45, 120, 360, 720];

export function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function handleKey(handle: string): string {
  return handle.trim().toLowerCase();
}

// ── Cooldown ───────────────────────────────────────────────────────────────

export interface Cooldown {
  platform: Platform;
  until: string;
  consecutiveFailures: number;
  reason: string | null;
}

/** Platforms currently parked. Read once per sweep, not once per target. */
export async function loadCooldowns(sb: SupabaseClient | null): Promise<Map<Platform, Cooldown>> {
  const out = new Map<Platform, Cooldown>();
  if (!sb) return out;
  try {
    const { data, error } = await sb
      .from("social_probe_cooldown")
      .select("platform, cooldown_until, consecutive_failures, last_reason")
      .gt("cooldown_until", new Date().toISOString());
    if (error || !data) return out;
    for (const row of data) {
      out.set(row.platform as Platform, {
        platform: row.platform as Platform,
        until: row.cooldown_until,
        consecutiveFailures: row.consecutive_failures ?? 1,
        reason: row.last_reason ?? null,
      });
    }
  } catch {
    // A cooldown read failure must not block the sweep; worst case we probe
    // a platform that would have been skipped and take one more refusal.
  }
  return out;
}

/** Park a platform after a throttle, lengthening the interval each time. */
export async function recordThrottle(sb: SupabaseClient | null, platform: Platform, reason: string): Promise<void> {
  if (!sb) return;
  try {
    const { data } = await sb
      .from("social_probe_cooldown")
      .select("consecutive_failures")
      .eq("platform", platform)
      .maybeSingle();

    const failures = Math.min((data?.consecutive_failures ?? 0) + 1, BACKOFF_MINUTES.length);
    const minutes = BACKOFF_MINUTES[failures - 1];
    await sb.from("social_probe_cooldown").upsert(
      {
        platform,
        cooldown_until: new Date(Date.now() + minutes * 60_000).toISOString(),
        consecutive_failures: failures,
        last_reason: reason.slice(0, 500),
      },
      { onConflict: "platform" },
    );
  } catch {
    // Best effort. Failing to park only costs an extra refusal later.
  }
}

/** Clear the backoff after a success, so one bad window is not permanent. */
export async function clearCooldown(sb: SupabaseClient | null, platform: Platform): Promise<void> {
  if (!sb) return;
  try {
    await sb.from("social_probe_cooldown").delete().eq("platform", platform);
  } catch {
    /* best effort */
  }
}

// ── Bank ───────────────────────────────────────────────────────────────────

export interface BankedCapture {
  result: SocialProbeResult;
  ageHours: number;
  fresh: boolean;
}

/** Fetch banked captures for a set of targets in one round trip, not N. */
export async function loadBank(
  sb: SupabaseClient | null,
  targets: Array<{ platform: Platform; handle: string }>,
): Promise<Map<string, BankedCapture>> {
  const out = new Map<string, BankedCapture>();
  if (!sb || targets.length === 0) return out;

  try {
    // One query with an OR filter beats a per-target read (N+1) and keeps the
    // sweep's database cost flat as the target list grows.
    const filter = targets
      .map((t) => `and(platform.eq.${t.platform},handle_key.eq.${handleKey(t.handle)})`)
      .join(",");
    const { data, error } = await sb
      .from("social_intel_cache")
      .select("platform, handle, handle_key, verdict, payload, fetched_at")
      .or(filter)
      .limit(targets.length * 2);
    if (error || !data) return out;

    for (const row of data) {
      const ageHours = (Date.now() - Date.parse(row.fetched_at)) / 3_600_000;
      if (!Number.isFinite(ageHours) || ageHours > MAX_SERVE_HOURS) continue;
      const platform = row.platform as Platform;
      const result = row.payload as SocialProbeResult;
      if (!result || typeof result !== "object") continue;
      out.set(`${platform}:${row.handle_key}`, {
        result,
        ageHours,
        fresh: ageHours <= FRESH_HOURS[platform],
      });
    }
  } catch {
    // A bank read failure degrades to live-only, which is correct behaviour.
  }
  return out;
}

/** Bank a capture worth keeping. Only substantive results are stored. */
export async function saveCapture(sb: SupabaseClient | null, result: SocialProbeResult): Promise<void> {
  // Refusals carry no intelligence and must never displace a good capture
  // already in the bank — that would convert a throttle into data loss.
  if (!sb || !result.profile) return;
  const keepable: Verdict[] = ["ok", "private"];
  if (!keepable.includes(result.verdict)) return;

  try {
    await sb.from("social_intel_cache").upsert(
      {
        platform: result.platform,
        handle: result.profile.handle,
        handle_key: handleKey(result.profile.handle),
        display_name: result.profile.displayName,
        verdict: result.verdict,
        payload: result,
        fetched_at: result.fetchedAt,
      },
      { onConflict: "platform,handle_key" },
    );
  } catch {
    /* best effort — the live result is already returned to the operator */
  }
}

/** Present a banked capture as a probe result, labelled with its true age. */
export function asCached(banked: BankedCapture): SocialProbeResult {
  const age = Math.round(banked.ageHours * 10) / 10;
  const staleNote =
    banked.result.note ||
    (banked.fresh
      ? ""
      : `Served from the intelligence bank — captured ${age}h ago. The live source is currently throttled, so this reflects the last successful read rather than the present state.`);
  return {
    ...banked.result,
    note: staleNote,
    fromCache: true,
    cacheAgeHours: age,
  };
}
