// Asherin Cloud Intelligence → Map bridge.
//
// Turns the intelligence substrate (contacts, venues, signals, security events)
// into map-ready GeoJSON features. Every feature carries a provenance tag so
// the map can always answer: where did this coordinate come from?

import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/lib/asher/directions";

export type CloudEntityKind = "contact" | "venue" | "security" | "relationship";

export interface CloudMapFeature {
  id: string;
  kind: CloudEntityKind;
  lat: number;
  lng: number;
  label: string;
  caption: string;
  confidence: number; // 0–1
  source: string;
  sourceUrl?: string;
  occurredAt?: string;
  payload: Record<string, any>;
  /** Dossier / report identifiers that can be opened in the right-hand panel. */
  dossierId?: string;
  subjectEmail?: string;
  subjectName?: string;
  /** For relationship edges, the target coordinate. */
  to?: LatLng;
  /** For relationship edges, the target label. */
  toLabel?: string;
}

export interface CloudMapLayer {
  contacts: CloudMapFeature[];
  venues: CloudMapFeature[];
  security: CloudMapFeature[];
  relationships: CloudMapFeature[];
}

export interface CloudMapQuery {
  contacts?: boolean;
  venues?: boolean;
  security?: boolean;
  relationships?: boolean;
  limit?: number;
  sinceDays?: number;
}

const NOMINATIM = "https://nominatim.openstreetmap.org";

interface GeocodeCache {
  address: string;
  lat: number;
  lng: number;
  display: string;
}

const geoCache = new Map<string, GeocodeCache | null>();

const clean = (raw: string): string =>
  raw.replace(/\s+/g, " ").replace(/\bhttps?:\/\/\S+/gi, "").trim();

async function geocode(address: string): Promise<GeocodeCache | null> {
  const key = clean(address).toLowerCase();
  if (!key) return null;
  if (geoCache.has(key)) return geoCache.get(key) ?? null;

  try {
    const url = `${NOMINATIM}/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(clean(address))}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("nominatim_failed");
    const hits = (await r.json()) as Array<any>;
    if (!hits?.length) {
      geoCache.set(key, null);
      return null;
    }
    const h = hits[0];
    const out: GeocodeCache = {
      address: key,
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lon),
      display: h.display_name || clean(address),
    };
    geoCache.set(key, out);
    return out;
  } catch (e) {
    console.error("[cloudMapBridge] geocode failed:", e);
    geoCache.set(key, null);
    return null;
  }
}

/** Extract every location string from a contact dossier payload. */
function locationsFromDossier(dossier: Record<string, any>): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.length > 3) out.push(v);
  };
  const walk = (obj: any) => {
    if (!obj) return;
    if (Array.isArray(obj)) obj.forEach(walk);
    else if (typeof obj === "object") {
      Object.entries(obj).forEach(([k, v]) => {
        const kl = k.toLowerCase();
        if (
          kl.includes("address") ||
          kl.includes("location") ||
          kl.includes("venue") ||
          kl.includes("city") ||
          kl.includes("country") ||
          kl.includes("place") ||
          kl.includes("coordinates") ||
          kl.includes("lat") ||
          kl.includes("lng")
        ) {
          push(v);
        }
        if (typeof v === "object" && !(kl.includes("lat") || kl.includes("lng"))) walk(v);
      });
    }
  };
  walk(dossier);
  return [...new Set(out)].filter(Boolean);
}

/** Prefer explicit lat/lng in a dossier when present. */
function explicitLatLng(dossier: Record<string, any>): LatLng | null {
  const lat = Number(dossier?.location?.latitude ?? dossier?.latitude ?? dossier?.lat ?? dossier?.coordinates?.lat ?? dossier?.coordinates?.latitude ?? NaN);
  const lng = Number(dossier?.location?.longitude ?? dossier?.longitude ?? dossier?.lng ?? dossier?.coordinates?.lng ?? dossier?.coordinates?.longitude ?? NaN);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  return null;
}

async function contactFeatures(userId: string, limit: number): Promise<CloudMapFeature[]> {
  const out: CloudMapFeature[] = [];
  const { data: dossiers } = await supabase
    .from("mesh_dossiers")
    .select("id, subject_name, subject_email, relationship, dossier, confidence, source_account, built_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("priority", { ascending: false })
    .limit(limit);

  if (!dossiers) return out;

  for (const d of dossiers) {
    const explicit = explicitLatLng(d.dossier);
    if (explicit) {
      out.push({
        id: `dossier-${d.id}`,
        kind: "contact",
        lat: explicit.lat,
        lng: explicit.lng,
        label: d.subject_name || "Unknown contact",
        caption: `Explicit coordinates in dossier${d.source_account ? ` · ${d.source_account}` : ""}`,
        confidence: Math.min(1, Math.max(0.3, d.confidence ?? 0.7)),
        source: "mesh_dossier",
        dossierId: d.id,
        subjectEmail: d.subject_email,
        subjectName: d.subject_name,
        payload: d.dossier,
      });
      continue;
    }

    const locations = locationsFromDossier(d.dossier);
    if (!locations.length) continue;

    // Geocode the first resolved location; subsequent ones create separate pins.
    for (const loc of locations.slice(0, 2)) {
      const g = await geocode(loc);
      if (!g) continue;
      out.push({
        id: `dossier-${d.id}-${g.lat.toFixed(4)}-${g.lng.toFixed(4)}`,
        kind: "contact",
        lat: g.lat,
        lng: g.lng,
        label: d.subject_name || "Unknown contact",
        caption: `Derived from dossier location: ${g.display}${d.source_account ? ` · ${d.source_account}` : ""}`,
        confidence: Math.min(0.75, Math.max(0.25, (d.confidence ?? 0.5) * 0.8)),
        source: "mesh_dossier_geocoded",
        dossierId: d.id,
        subjectEmail: d.subject_email,
        subjectName: d.subject_name,
        payload: { locationHint: loc, dossier: d.dossier },
      });
    }
  }

  return out;
}

export interface VenueInput {
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  visits?: number;
  totalHours?: number;
  nextPredicted?: string;
  confidence?: number;
  source?: string;
}

export async function venueFeatures(venues: VenueInput[]): Promise<CloudMapFeature[]> {
  const out: CloudMapFeature[] = [];
  for (const v of venues) {
    let lat = v.lat;
    let lng = v.lng;
    let caption = `${v.visits ?? 0} visits · ${v.totalHours ?? 0}h scheduled`;
    let source = v.source || "calendar_prophet";
    if (v.nextPredicted) caption += ` · next predicted ${new Date(v.nextPredicted).toLocaleDateString()}`;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!v.address) continue;
      const g = await geocode(v.address);
      if (!g) continue;
      lat = g.lat;
      lng = g.lng;
      caption += ` · geocoded: ${g.display}`;
      source = "calendar_prophet_geocoded";
    }

    out.push({
      id: `venue-${v.label}-${lat!.toFixed(4)}-${lng!.toFixed(4)}`,
      kind: "venue",
      lat: lat!,
      lng: lng!,
      label: v.label,
      caption,
      confidence: Math.min(1, Math.max(0.3, v.confidence ?? 0.6)),
      source,
      payload: v,
    });
  }
  return out;
}

async function securityFeatures(userId: string, sinceDays: number): Promise<CloudMapFeature[]> {
  const out: CloudMapFeature[] = [];
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();

  const [{ data: securityEvents }, { data: signals }] = await Promise.all([
    supabase
      .from("security_events")
      .select("id, event_type, severity, ip_address, location, occurred_at, details, metadata")
      .eq("user_id", userId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("google_signals")
      .select("id, source, kind, actor_email, actor_name, subject, snippet, metadata, occurred_at")
      .eq("user_id", userId)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(200),
  ]);

  if (securityEvents) {
    for (const e of securityEvents) {
      const explicit = explicitLatLng(e.metadata) || explicitLatLng(e.location) || explicitLatLng(e.details);
      const locations = e.location
        ? [typeof e.location === "string" ? e.location : JSON.stringify(e.location)]
        : locationsFromDossier(e.details || e.metadata || {});

      const resolve = async (): Promise<LatLng | null> => {
        if (explicit) return explicit;
        if (!locations.length) return null;
        const g = await geocode(locations[0]);
        return g ? { lat: g.lat, lng: g.lng } : null;
      };

      const pos = await resolve();
      if (!pos) continue;

      out.push({
        id: `sec-${e.id}`,
        kind: "security",
        lat: pos.lat,
        lng: pos.lng,
        label: e.event_type || "Security event",
        caption: `${e.event_type} · severity ${e.severity ?? "unknown"}${e.ip_address ? ` · IP ${e.ip_address}` : ""}${e.occurred_at ? ` · ${new Date(e.occurred_at).toLocaleString()}` : ""}`,
        confidence: 0.7,
        source: "security_events",
        occurredAt: e.occurred_at,
        payload: e,
      });
    }
  }

  if (signals) {
    for (const s of signals) {
      // Only signals with location metadata are worth plotting.
      const locations = locationsFromDossier(s.metadata || {});
      if (!locations.length) continue;
      const g = await geocode(locations[0]);
      if (!g) continue;
      out.push({
        id: `sig-${s.id}`,
        kind: "security",
        lat: g.lat,
        lng: g.lng,
        label: s.actor_name || s.actor_email || s.source,
        caption: `${s.kind} · ${s.subject || s.snippet || ""}`.trim(),
        confidence: 0.5,
        source: `google_signals:${s.source}`,
        occurredAt: s.occurred_at,
        subjectEmail: s.actor_email,
        subjectName: s.actor_name,
        payload: s,
      });
    }
  }

  return out;
}

function relationshipFeatures(contacts: CloudMapFeature[]): CloudMapFeature[] {
  const out: CloudMapFeature[] = [];
  const grouped = new Map<string, CloudMapFeature[]>();
  for (const c of contacts) {
    if (!c.dossierId) continue;
    const list = grouped.get(c.dossierId) || [];
    list.push(c);
    grouped.set(c.dossierId, list);
  }

  for (const [, list] of grouped) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      out.push({
        id: `rel-${a.id}-${b.id}`,
        kind: "relationship",
        lat: a.lat,
        lng: a.lng,
        to: { lat: b.lat, lng: b.lng },
        label: "Inferred link",
        toLabel: b.label,
        caption: `${a.label} ↔ ${b.label}`,
        confidence: 0.4,
        source: "relationship_inferred",
        payload: { a, b },
      });
    }
  }
  return out;
}

export async function loadCloudMapLayer(q: CloudMapQuery = {}): Promise<CloudMapLayer> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session?.user?.id;
  if (!userId) return { contacts: [], venues: [], security: [], relationships: [] };

  const [contacts, venues, security] = await Promise.all([
    q.contacts !== false ? contactFeatures(userId, q.limit ?? 50) : Promise.resolve([]),
    q.venues ? venueFeatures([]) : Promise.resolve([]),
    q.security ? securityFeatures(userId, q.sinceDays ?? 30) : Promise.resolve([]),
  ]);

  const relationships = q.relationships !== false && contacts.length > 0
    ? relationshipFeatures(contacts)
    : [];

  return { contacts, venues, security, relationships };
}

export function clearCloudMapCache() {
  geoCache.clear();
}
