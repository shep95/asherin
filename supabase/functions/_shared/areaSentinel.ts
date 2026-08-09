// ═══════════════════════════════════════════════════════════════════════════
// areaSentinel — one implementation of "is this block safe", callable from
// both the interactive path (sentinel-ble ← a live tab) and the unattended
// path (sentinel-cron ← pg_cron, no browser anywhere).
//
// Why this exists: the assessment used to live inside the request handler, so
// the only way to get an area judgement was for a tab to ask for one. A watch
// that needs a tab is not a watch. Lifting it here means the server clock can
// run exactly the same judgement, with exactly the same cache, cooldown and
// alert shape, against the last position the user's devices reported.
//
// Invariants:
//  • ~1.1 km cell cache (place_key) shared across all users — one model call
//    per neighbourhood per week, not one per person per visit.
//  • Alert cooldown is per user per cell, 6 h, enforced against geo_risk_events.
//  • Stale-fix guard: the caller states how old the fix is; an assessment
//    derived from an aged fix is still recorded but never alerts, because
//    "you are in a dangerous area" is false if you left two hours ago.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callByokJsonWithRetry } from "./zophielByokRouter.ts";
import { notifyIntel } from "./intelNotify.ts";
import {
  parseJsonLoose, reverseGeocode, GEO_RISK_SYSTEM, buildGeoPrompt, collectAreaEvidence,
} from "./bleSentinel.ts";

export interface AreaCfg {
  provider: "google" | "venice" | string;
  model: string;
  apiKey: string;
}

/** Platform key for unattended runs. No request exists, so adminGate's
 *  request-scoped resolution cannot be used; the cron is the platform. */
export function platformAreaCfg(): AreaCfg | null {
  const gemini = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";
  if (gemini) return { provider: "google", model: "gemini-flash-latest", apiKey: gemini };
  const venice = Deno.env.get("VENICE_API_KEY") || "";
  if (venice) return { provider: "venice", model: "mistral-31-24b", apiKey: venice };
  return null;
}

const RISK_LEVELS = ["LOW", "ELEVATED", "HIGH", "SEVERE", "UNKNOWN"];
const ALERTING = new Set(["ELEVATED", "HIGH", "SEVERE"]);

export function areaPlaceKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export interface AreaArgs {
  db: SupabaseClient;
  userId: string;
  userEmail: string | null;
  lat: number;
  lng: number;
  cfg: AreaCfg | null;
  settings: { push_enabled?: boolean; email_enabled?: boolean };
  /** Age of the position fix in ms. Anything beyond `maxFixAgeMs` is assessed
   *  but never alerted on — a stale location is intelligence, not an emergency. */
  fixAgeMs?: number;
  maxFixAgeMs?: number;
  /** Shown in the alert footer so the user knows which leg raised it. */
  source?: string;
  /**
   * "fast" is the arrival path and is bound by a human deadline: the whole
   * point is a warning that lands before the user has settled in. It takes one
   * shot at the model on a short clock and, on miss, leaves the cell unjudged
   * so the deep pass can retry — it must never bank an UNKNOWN, because a
   * cached UNKNOWN mutes the cell for the next hour.
   *
   * "deep" is the unattended path with no one waiting, so it can afford the
   * long timeout and the retry.
   */
  mode?: "fast" | "deep";
}

export interface AreaResult {
  assessment: Record<string, any> | null;
  notified: boolean;
  reason?: string;
}

/** Assess (with cache) and alert (with cooldown). Never throws for alerting
 *  failures — the assessment is the product, delivery is best-effort. */
export async function assessAndAlertArea(args: AreaArgs): Promise<AreaResult> {
  const { db, userId, userEmail, lat, lng, cfg, settings } = args;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { assessment: null, notified: false, reason: "invalid_coordinates" };
  }
  const fast = args.mode === "fast";
  const pk = areaPlaceKey(lat, lng);
  const nowIso = new Date().toISOString();

  let { data: cached } = await db.from("geo_risk_assessments").select("*").eq("place_key", pk).maybeSingle();

  if (!cached || cached.expires_at < nowIso) {
    if (!cfg) return { assessment: cached ?? null, notified: false, reason: "no_model_key" };
    const label = (await reverseGeocode(lat, lng)) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    const research = await collectAreaEvidence(label);
    let parsed: Record<string, any> | null = null;
    try {
      const raw = await callByokJsonWithRetry(cfg as any, GEO_RISK_SYSTEM, buildGeoPrompt(label, lat, lng, research), {
        temperature: 0.15,
        jsonMode: true,
        // Do NOT trim the output budget on the arrival path. Latency here is
        // dominated by research and time-to-first-token, not by length, and a
        // short cap simply truncates the JSON mid-object — which the loose
        // parser then salvages into an empty-but-valid verdict. That reads as
        // "this place is fine" and is far worse than being slow.
        maxOutputTokens: 4096,
        // 90s x 2 attempts is three minutes of model time on its own — that
        // alone blows an arrival budget. The arrival path gets one short shot.
        timeoutMs: fast ? 45_000 : 90_000,
        attempts: fast ? 1 : 2,
      });
      parsed = parseJsonLoose(raw);
    } catch (e) {
      console.error("[areaSentinel] model call failed", fast ? "fast" : "deep", e instanceof Error ? e.message : e);
    }
    const level = String(parsed?.risk_level || "").toUpperCase();
    const summary = String(parsed?.summary || parsed?.headline || "").trim();
    // A parse that yields no level AND no prose is a failed sweep wearing the
    // shape of an answer. Banking it would cache silence over the cell and mute
    // the very alert this path exists to deliver.
    if (!parsed || (!RISK_LEVELS.includes(level) && !summary)) {
      return {
        assessment: cached ?? null,
        notified: false,
        reason: fast ? "fast_timeout" : "assessment_failed",
      };
    }

    const { data: saved } = await db.from("geo_risk_assessments").upsert({
      place_key: pk, lat, lng, place_label: label,
      risk_level: RISK_LEVELS.includes(level) ? level : "UNKNOWN",
      risk_score: Number(parsed.risk_score) || 0,
      summary: String(parsed.summary || parsed.headline || "").slice(0, 4000),
      payload: parsed,
      generated_at: nowIso,
      // An UNKNOWN verdict is a failed sweep, not a fact about the place —
      // expire it in an hour so one bad research pass cannot mute a whole week.
      expires_at: new Date(Date.now() + (level === "UNKNOWN" ? 3600e3 : 7 * 864e5)).toISOString(),
    }, { onConflict: "place_key" }).select("*").maybeSingle();
    cached = saved;
  }


  if (!cached) return { assessment: null, notified: false, reason: "assessment_failed" };
  if (!ALERTING.has(cached.risk_level)) return { assessment: cached, notified: false, reason: "not_alerting" };

  const maxAge = args.maxFixAgeMs ?? 90 * 60_000;
  if ((args.fixAgeMs ?? 0) > maxAge) {
    return { assessment: cached, notified: false, reason: "fix_too_old" };
  }

  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data: recent } = await db.from("geo_risk_events").select("id")
    .eq("user_id", userId).eq("place_key", pk).gte("created_at", since).limit(1);
  if (recent?.length) return { assessment: cached, notified: false, reason: "cooldown" };

  const p = (cached.payload || {}) as Record<string, any>;
  await notifyIntel({
    userId, userEmail,
    kind: "sentinel",
    severity: cached.risk_level === "SEVERE" ? "critical" : "notable",
    title: `${cached.risk_level} risk area — ${String(cached.place_label || "").split(",").slice(0, 2).join(",")}`,
    body: String(cached.summary || p.headline || "Elevated risk reported for this area."),
    subjectName: cached.place_label,
    source: args.source || "Area Sentinel",
    url: `/dashboard?tab=cloud-intel&module=sentinel`,
    sections: [
      { label: "Reported patterns", value: (p.reported_patterns || []).map((x: any) => `${x?.pattern} (${x?.when})`).join("; ") || "none surfaced" },
      { label: "Area context", value: String(p.group_activity || "none documented") },
    ],
    findings: Array.isArray(p.safer_actions) ? p.safer_actions.map(String) : [],
    idempotencyKey: `sentinel:geo:${userId}:${pk}:${cached.generated_at}`,
    skipPush: settings.push_enabled === false,
    skipEmail: settings.email_enabled === false,
  }).catch((e) => console.error("geo_alert_failed", e instanceof Error ? e.message : e));

  await db.from("geo_risk_events").insert({
    user_id: userId, place_key: pk, lat, lng,
    place_label: cached.place_label, risk_level: cached.risk_level, notified: true,
  });

  return { assessment: cached, notified: true };
}

/**
 * ARRIVAL DETECTION — the missing primitive.
 *
 * Everything upstream of this used to be a clock: re-judge wherever the user
 * happens to be, every N minutes. A clock cannot meet an arrival deadline,
 * because the clock has no idea the user arrived. This records the cell a user
 * is standing in and reports the transition into a new one.
 *
 * Two things it deliberately does NOT do:
 *  - It does not alert on first sight of a cell. Driving through a mile-wide
 *    cell would otherwise fire an alert for every block of the route.
 *  - It does not re-arm for a cell the user never left. `place_since` only
 *    resets when the key actually changes, so dwell is measured from the true
 *    moment of entry, not from the last beacon.
 */
export interface ArrivalState {
  placeKey: string;
  /** True on the fix that first lands in a new cell. */
  arrived: boolean;
  /** Milliseconds since the user entered this cell. */
  dwellMs: number;
  /** Dwell has cleared the drive-through guard and this cell was never judged. */
  confirmed: boolean;
}

/** Dwell required before an arrival is treated as real presence rather than
 *  transit. Sized to fit inside a three-minute end-to-end budget. */
export const ARRIVAL_DWELL_MS = 90_000;

export async function recordArrival(
  db: SupabaseClient,
  userId: string,
  lat: number,
  lng: number,
  patch: Record<string, unknown> = {},
): Promise<ArrivalState> {
  const placeKey = areaPlaceKey(lat, lng);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: prev } = await db
    .from("sentinel_presence")
    .select("place_key, place_since, arrival_pending")
    .eq("user_id", userId)
    .maybeSingle();

  const arrived = !prev || prev.place_key !== placeKey;
  const since = arrived ? now : Date.parse(prev?.place_since ?? nowIso) || now;
  const dwellMs = Math.max(0, now - since);
  // `arrival_pending` is the latch: set on entry, cleared once this cell has
  // actually been assessed. Without it a slow first pass would be forgotten,
  // because by the next fix `arrived` is already false.
  const stillPending = arrived ? true : prev?.arrival_pending !== false;
  const confirmed = stillPending && dwellMs >= ARRIVAL_DWELL_MS;

  await db.from("sentinel_presence").upsert({
    user_id: userId,
    lat, lng,
    place_key: placeKey,
    place_since: new Date(since).toISOString(),
    arrival_pending: stillPending,
    fix_at: nowIso,
    last_seen_at: nowIso,
    updated_at: nowIso,
    ...patch,
  }, { onConflict: "user_id" });

  return { placeKey, arrived, dwellMs, confirmed };
}

/** Clears the latch once a cell has been judged, so the arrival path stops
 *  re-firing and hands the cell back to the routine interval. */
export async function clearArrival(db: SupabaseClient, userId: string, placeKey: string): Promise<void> {
  await db.from("sentinel_presence")
    .update({ arrival_pending: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("place_key", placeKey);
}

