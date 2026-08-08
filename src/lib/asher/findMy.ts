/**
 * ASHERIN FIND-MY — owned-device locator math + data access.
 *
 * The BLE pipeline already writes every heard advertisement into
 * `ble_sightings` (lat/lng/rssi/accuracy_m/distance_m). This module turns that
 * raw stream into an *asset* answer: where is MY laptop, with what confidence.
 *
 * Provenance: every number here derives from a real `ble_sightings` row written
 * by a live scanner (native companion or web session). Nothing is synthesised.
 */

import { supabase } from "@/integrations/supabase/client";

export type OwnedState = "nominal" | "missing" | "stolen";

export const OWNED_KINDS = [
  "unknown", "laptop", "phone", "tablet", "earbuds", "watch", "tracker", "vehicle", "other",
] as const;
export type OwnedKind = (typeof OWNED_KINDS)[number];

export interface OwnedDeviceRow {
  id: string;
  fingerprint: string;
  label: string;
  kind: OwnedKind;
  state: OwnedState;
  missing_after_minutes: number;
  stolen_at: string | null;
  notes: string | null;
  updated_at: string;
}

export interface Fix {
  seen_at: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  rssi: number | null;
  distance_m: number | null;
}

/** A fused position: centroid + a radius the UI is allowed to claim. */
export interface FusedPosition {
  lat: number;
  lng: number;
  /** 1-sigma-ish confidence radius in metres — never smaller than the best fix's own error. */
  radiusM: number;
  fixCount: number;
  lastSeenAt: string;
  /** Plain-English caption so the map never over-claims precision. */
  caption: string;
}

export interface LocatedDevice extends OwnedDeviceRow {
  fused: FusedPosition | null;
  breadcrumb: Array<{ lat: number; lng: number; seen_at: string }>;
  /** Derived state — `missing` is computed from silence, never stored stale. */
  effectiveState: OwnedState;
  minutesSinceSeen: number | null;
}

/* ── geometry ────────────────────────────────────────────────────────────── */

const R_EARTH = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * RSSI/accuracy-weighted centroid fusion.
 *
 * A single −78 dBm hit inside a 30 m GPS circle is not "your laptop is here".
 * Each fix is weighted by 1 / (gpsError + estimatedRange + 1) and additionally
 * decayed by age, so a tight recent fix dominates a loose stale one. The
 * reported radius is the weighted mean error inflated by the spatial spread of
 * the contributing fixes — it can only ever grow, never shrink below the best
 * single fix's own stated error.
 *
 * Cost: O(n) over the window (n <= 500 by the RPC's own cap).
 */
export function fusePosition(fixes: Fix[], nowMs = Date.now()): FusedPosition | null {
  const usable = fixes.filter(
    (f) => Number.isFinite(f.lat) && Number.isFinite(f.lng) && Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180,
  );
  if (!usable.length) return null;

  // Newest first is what the RPC returns; guard anyway.
  const sorted = [...usable].sort((a, b) => Date.parse(b.seen_at) - Date.parse(a.seen_at));
  const newest = sorted[0];
  const newestMs = Date.parse(newest.seen_at);

  // Only fuse fixes clustered around the newest one. A hit from three hours and
  // four kilometres ago is a different place, not extra precision.
  const CLUSTER_WINDOW_MS = 30 * 60 * 1000;
  const CLUSTER_RADIUS_M = 300;
  const cluster = sorted.filter(
    (f) =>
      newestMs - Date.parse(f.seen_at) <= CLUSTER_WINDOW_MS &&
      haversineM(newest, f) <= CLUSTER_RADIUS_M,
  );
  const pool = cluster.length ? cluster : [newest];

  let wSum = 0;
  let latSum = 0;
  let lngSum = 0;
  let errSum = 0;
  for (const f of pool) {
    const gpsErr = Math.max(0, Number(f.accuracy_m ?? 25));
    const range = Math.max(0, Number(f.distance_m ?? rssiToMetres(f.rssi)));
    const ageMin = Math.max(0, (newestMs - Date.parse(f.seen_at)) / 60000);
    const decay = 1 / (1 + ageMin / 10);
    const w = (1 / (gpsErr + range + 1)) * decay;
    if (!Number.isFinite(w) || w <= 0) continue;
    wSum += w;
    latSum += f.lat * w;
    lngSum += f.lng * w;
    errSum += (gpsErr + range) * w;
  }
  if (wSum <= 0) {
    const gpsErr = Math.max(10, Number(newest.accuracy_m ?? 30));
    return {
      lat: newest.lat, lng: newest.lng,
      radiusM: Math.round(gpsErr + rssiToMetres(newest.rssi)),
      fixCount: 1, lastSeenAt: newest.seen_at,
      caption: captionFor(gpsErr + rssiToMetres(newest.rssi), 1, newest.seen_at, nowMs),
    };
  }

  const lat = latSum / wSum;
  const lng = lngSum / wSum;
  const meanErr = errSum / wSum;
  const spread = pool.length > 1
    ? Math.max(...pool.map((f) => haversineM({ lat, lng }, f)))
    : 0;
  // Averaging genuinely reduces error, but only as sqrt(n) and never past the
  // physical limit of the best single observation.
  const bestSingle = Math.min(
    ...pool.map((f) => Math.max(0, Number(f.accuracy_m ?? 25)) + Math.max(0, Number(f.distance_m ?? rssiToMetres(f.rssi)))),
  );
  const radiusM = Math.max(5, Math.round(Math.max(bestSingle, meanErr / Math.sqrt(pool.length)) + spread * 0.5));

  return {
    lat, lng, radiusM,
    fixCount: pool.length,
    lastSeenAt: newest.seen_at,
    caption: captionFor(radiusM, pool.length, newest.seen_at, nowMs),
  };
}

/** Log-distance path-loss fallback when the scanner did not persist a range. */
export function rssiToMetres(rssi: number | null | undefined): number {
  if (rssi == null || !Number.isFinite(rssi)) return 20;
  const txPower = -59; // typical 1 m reference for BLE class-2 advertisers
  const n = 2.6; // indoor/urban path-loss exponent
  const d = Math.pow(10, (txPower - rssi) / (10 * n));
  return Math.max(0.5, Math.min(120, d));
}

function captionFor(radiusM: number, n: number, lastSeen: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - Date.parse(lastSeen)) / 60000));
  const when = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  const src = n === 1 ? "1 sighting" : `${n} sightings fused`;
  return `≈${radiusM} m from where the scanner stood · ${src} · ${when}`;
}

export function fmtAge(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return "never seen";
  const mins = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/* ── data access ─────────────────────────────────────────────────────────── */

const client = supabase as any;

export async function listOwnedDevices(): Promise<OwnedDeviceRow[]> {
  const { data, error } = await client
    .from("ble_owned_devices")
    .select("id,fingerprint,label,kind,state,missing_after_minutes,stolen_at,notes,updated_at")
    .order("label", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OwnedDeviceRow[];
}

export async function canClaim(fingerprint: string): Promise<{
  eligible: boolean; close_days?: number; required_days?: number; min_distance_m?: number | null; reason: string;
}> {
  const { data, error } = await client.rpc("ble_can_claim", { _fingerprint: fingerprint });
  if (error) throw error;
  return (data ?? { eligible: false, reason: "unavailable" }) as any;
}

export async function claimDevice(input: {
  fingerprint: string; label: string; kind: OwnedKind; missingAfterMinutes?: number;
}): Promise<OwnedDeviceRow> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Sign in to claim a device.");
  const { data, error } = await client
    .from("ble_owned_devices")
    .insert({
      user_id: uid,
      fingerprint: input.fingerprint,
      label: input.label,
      kind: input.kind,
      missing_after_minutes: input.missingAfterMinutes ?? 60,
    })
    .select("id,fingerprint,label,kind,state,missing_after_minutes,stolen_at,notes,updated_at")
    .single();
  if (error) throw error;
  return data as OwnedDeviceRow;
}

export async function releaseDevice(id: string): Promise<void> {
  const { error } = await client.from("ble_owned_devices").delete().eq("id", id);
  if (error) throw error;
}

export async function setDeviceState(
  device: OwnedDeviceRow,
  state: OwnedState,
  lastFix?: FusedPosition | null,
): Promise<void> {
  const { error } = await client
    .from("ble_owned_devices")
    .update({ state, ...(state === "stolen" ? {} : { recovered_at: new Date().toISOString() }) })
    .eq("id", device.id);
  if (error) throw error;

  // Immutable evidence row — the thing you hand to police.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  await client.from("ble_theft_audit").insert({
    user_id: uid,
    fingerprint: device.fingerprint,
    label: device.label,
    event: state === "stolen" ? "declared_stolen" : state === "missing" ? "marked_missing" : "recovered",
    last_lat: lastFix?.lat ?? null,
    last_lng: lastFix?.lng ?? null,
    last_seen_at: lastFix?.lastSeenAt ?? null,
    detail: {
      kind: device.kind,
      confidence_radius_m: lastFix?.radiusM ?? null,
      fused_from_sightings: lastFix?.fixCount ?? 0,
    },
  });
}

export async function renameDevice(id: string, label: string): Promise<void> {
  const { error } = await client.from("ble_owned_devices").update({ label }).eq("id", id);
  if (error) throw error;
}

/** Newest fix per owned device — one round trip for the whole group map. */
export async function locateGroup(hours = 24): Promise<LocatedDevice[]> {
  const rows = await listOwnedDevices();
  if (!rows.length) return [];

  const { data, error } = await client.rpc("locate_owned_devices_group", { _hours: hours });
  if (error) throw error;

  const byFp = new Map<string, any>();
  for (const r of (data ?? []) as any[]) byFp.set(r.fingerprint, r);

  const now = Date.now();
  return rows.map((d) => {
    const g = byFp.get(d.fingerprint);
    const fused: FusedPosition | null =
      g && g.lat != null && g.lng != null
        ? fusePosition(
            [{
              seen_at: g.last_seen_at,
              lat: Number(g.lat), lng: Number(g.lng),
              accuracy_m: g.accuracy_m == null ? null : Number(g.accuracy_m),
              rssi: g.rssi == null ? null : Number(g.rssi),
              distance_m: g.distance_m == null ? null : Number(g.distance_m),
            }],
            now,
          )
        : null;
    const minutesSinceSeen = fused ? Math.round((now - Date.parse(fused.lastSeenAt)) / 60000) : null;
    return {
      ...d,
      fused,
      breadcrumb: [],
      minutesSinceSeen,
      effectiveState: deriveState(d, minutesSinceSeen),
    };
  });
}

/** Full breadcrumb + fused position for one device, via the crowd relay. */
export async function locateDevice(
  fingerprint: string,
  hours = 24,
): Promise<{ fused: FusedPosition | null; breadcrumb: Array<{ lat: number; lng: number; seen_at: string }>; fixes: Fix[] }> {
  const { data, error } = await client.rpc("locate_owned_device", {
    _fingerprint: fingerprint, _hours: hours, _limit: 200,
  });
  if (error) throw error;
  const fixes: Fix[] = ((data ?? []) as any[])
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      seen_at: r.seen_at,
      lat: Number(r.lat), lng: Number(r.lng),
      accuracy_m: r.accuracy_m == null ? null : Number(r.accuracy_m),
      rssi: r.rssi == null ? null : Number(r.rssi),
      distance_m: r.distance_m == null ? null : Number(r.distance_m),
    }));
  // Breadcrumb reads oldest → newest so the polyline draws in travel order.
  const breadcrumb = [...fixes]
    .sort((a, b) => Date.parse(a.seen_at) - Date.parse(b.seen_at))
    .map((f) => ({ lat: f.lat, lng: f.lng, seen_at: f.seen_at }));
  return { fused: fusePosition(fixes), breadcrumb, fixes };
}

/**
 * `missing` is silence, not a stored flag — computing it live means the roster
 * can never show a stale "missing" badge for a device sitting on the desk.
 * A declared theft always wins over silence.
 */
export function deriveState(d: OwnedDeviceRow, minutesSinceSeen: number | null): OwnedState {
  if (d.state === "stolen") return "stolen";
  if (minutesSinceSeen == null) return "missing";
  return minutesSinceSeen > d.missing_after_minutes ? "missing" : "nominal";
}

export const STATE_COLOR: Record<OwnedState, string> = {
  nominal: "#c98b3a",
  missing: "#9a9a9a",
  stolen: "#e0484d",
};
