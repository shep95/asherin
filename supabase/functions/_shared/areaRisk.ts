/**
 * AREA RISK — destination-aware protective intelligence, callable without a phone.
 *
 * The area engine used to live entirely inside `sentinel-ble`'s `geo.check`
 * action, which only ever ran when the handset was awake, unlocked and pushing
 * live coordinates. A rider whose phone is off therefore got silence for the
 * one journey where an area briefing matters most.
 *
 * This module lifts the engine out of that request path so any server-side
 * surface — the rideshare autopilot in particular — can assess a place from a
 * TEXT LABEL (a dropoff address parsed out of an operator email) with no device
 * involvement at all.
 *
 * Contract:
 *   • Cache-first. One assessment per ~1.1 km cell, shared across riders,
 *     7-day TTL. A cached cell costs one indexed read, no model call.
 *   • Degrade, never throw. A dead geocoder or a missing model key thins the
 *     briefing; it must never fail the ride sweep that called it.
 *   • Dedupe alerts per (user, cell) per 6 h, recorded in geo_risk_events, so a
 *     re-scan of the same mailbox window cannot re-alarm the rider.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  GEO_RISK_SYSTEM,
  buildGeoPrompt,
  collectAreaEvidence,
  parseJsonLoose,
  reverseGeocode,
} from "./bleSentinel.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "./zophielByokRouter.ts";
import { notifyIntel } from "./intelNotify.ts";

export interface AreaAssessment {
  place_key: string;
  lat: number;
  lng: number;
  place_label: string;
  risk_level: "LOW" | "ELEVATED" | "HIGH" | "SEVERE" | "UNKNOWN";
  risk_score: number;
  summary: string;
  payload: Record<string, unknown>;
  generated_at: string;
}

const LEVELS = ["LOW", "ELEVATED", "HIGH", "SEVERE", "UNKNOWN"] as const;
export const ALERTING_LEVELS = new Set(["ELEVATED", "HIGH", "SEVERE"]);

/** ~1.1 km cell. Two riders dropped on the same block share one assessment. */
export const cellKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

/** Forward geocode a free-text place label. Best-effort, hard-bounded. */
export async function forwardGeocode(
  label: string,
  timeoutMs = 5000,
): Promise<{ lat: number; lng: number; display: string } | null> {
  const q = label.trim();
  if (q.length < 4) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "AsherinSentinel/1.0 (safety alerts)", Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat), lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, display: (hit.display_name || q).slice(0, 200) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Assess a cell, generating only on a cache miss or expiry.
 * `cfg` may be null — the caller then gets whatever is cached, or nothing.
 */
export async function assessArea(
  db: SupabaseClient,
  lat: number,
  lng: number,
  labelHint: string | null,
  cfg: ZophielByokConfig | null,
): Promise<AreaAssessment | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const pk = cellKey(lat, lng);
  const nowIso = new Date().toISOString();

  const { data: cached } = await db
    .from("geo_risk_assessments").select("*").eq("place_key", pk).maybeSingle();
  if (cached && String(cached.expires_at) > nowIso) return cached as AreaAssessment;
  if (!cfg) return (cached as AreaAssessment) ?? null;

  try {
    const label = labelHint || (await reverseGeocode(lat, lng)) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    const research = await collectAreaEvidence(label);
    const raw = await callByokJsonWithRetry(cfg, GEO_RISK_SYSTEM, buildGeoPrompt(label, lat, lng, research), {
      temperature: 0.15, jsonMode: true, maxOutputTokens: 4096, timeoutMs: 60_000, attempts: 2,
    });
    const parsed = parseJsonLoose(raw) as Record<string, unknown>;
    const level = String(parsed.risk_level || "UNKNOWN").toUpperCase();
    const { data: saved } = await db.from("geo_risk_assessments").upsert({
      place_key: pk, lat, lng, place_label: label,
      risk_level: (LEVELS as readonly string[]).includes(level) ? level : "UNKNOWN",
      risk_score: Number(parsed.risk_score) || 0,
      summary: String(parsed.summary || parsed.headline || "").slice(0, 4000),
      payload: parsed,
      generated_at: nowIso,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    }, { onConflict: "place_key" }).select("*").maybeSingle();
    return (saved as AreaAssessment) ?? (cached as AreaAssessment) ?? null;
  } catch (e) {
    console.error("area_assess_failed", (e as Error).message?.slice(0, 200));
    // A stale assessment is better intelligence than none.
    return (cached as AreaAssessment) ?? null;
  }
}

/**
 * Alert on an elevated area, at most once per (user, cell) per 6 h.
 * Returns true when a notice was actually raised.
 */
export async function alertAreaRisk(
  db: SupabaseClient,
  opts: {
    userId: string;
    userEmail?: string | null;
    assessment: AreaAssessment;
    /** why the user is here: "destination of your Uber", "current location" */
    context?: string;
    skipPush?: boolean;
    skipEmail?: boolean;
  },
): Promise<boolean> {
  const a = opts.assessment;
  if (!ALERTING_LEVELS.has(a.risk_level)) return false;

  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data: recent } = await db.from("geo_risk_events").select("id")
    .eq("user_id", opts.userId).eq("place_key", a.place_key).gte("created_at", since).limit(1);
  if (recent?.length) return false;

  const p = (a.payload || {}) as Record<string, any>;
  const shortLabel = String(a.place_label || "").split(",").slice(0, 2).join(",");
  await notifyIntel({
    userId: opts.userId,
    userEmail: opts.userEmail ?? null,
    kind: "sentinel",
    severity: a.risk_level === "SEVERE" ? "critical" : "notable",
    title: `${a.risk_level} risk area — ${shortLabel}`,
    body: String(a.summary || p.headline || "Elevated risk reported for this area."),
    subjectName: a.place_label,
    source: opts.context ? `Area Sentinel · ${opts.context}` : "Area Sentinel",
    url: `/dashboard?tab=cloud-intel&module=sentinel`,
    sections: [
      { label: "Why you're getting this", value: opts.context || "You are in or heading to this area." },
      {
        label: "Reported patterns",
        value: (p.reported_patterns || []).map((x: any) => `${x?.pattern} (${x?.when})`).join("; ") || "none surfaced",
      },
      { label: "Area context", value: String(p.group_activity || "none documented") },
    ],
    findings: Array.isArray(p.safer_actions) ? p.safer_actions.map(String) : [],
    idempotencyKey: `sentinel:geo:${opts.userId}:${a.place_key}:${a.generated_at}`,
    skipPush: opts.skipPush,
    skipEmail: opts.skipEmail,
  }).catch((e) => console.error("area_alert_failed", e instanceof Error ? e.message : e));

  await db.from("geo_risk_events").insert({
    user_id: opts.userId, place_key: a.place_key, lat: a.lat, lng: a.lng,
    place_label: a.place_label, risk_level: a.risk_level, notified: true,
  });
  return true;
}

/** Label → coordinates → assessment, in one call. Returns null on any gap. */
export async function assessAreaByLabel(
  db: SupabaseClient,
  label: string,
  cfg: ZophielByokConfig | null,
): Promise<AreaAssessment | null> {
  const geo = await forwardGeocode(label);
  if (!geo) return null;
  return assessArea(db, geo.lat, geo.lng, geo.display, cfg);
}
