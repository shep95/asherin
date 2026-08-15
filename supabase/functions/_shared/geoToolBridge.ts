// geoToolBridge.ts — geography runs, it is never described.
//
// Fast path: Photon geocode in ~2s so the mouth is not waiting on a property
// dossier. Property intel only when the officer asked who-lives / who-owns.
// Street cameras belong on the map organ (it already sweeps on fly) — chat
// does not serialize a 15s camera fan before the first token.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export interface GeoTarget {
  place: string;
  property: boolean;
}

const NEGATIVES =
  /\b(intel ?map|entity map|relationship map|link map|mind ?map|road ?map|site ?map|heat ?map|world map|map of ideas|sitemap)\b/i;

const PATTERNS: { re: RegExp; property: boolean }[] = [
  {
    re: /\b(?:who\s+lives\s+at|who\s+owns|property\s+(?:at|for)|address\s+(?:lookup\s+)?(?:for\s+)?|dossier\s+(?:on|for)\s+(?:the\s+)?(?:house|property|address)\s+at)\s+(.+)$/i,
    property: true,
  },
  {
    re: /\b(?:take\s+me\s+to|fly\s+to|go\s+to|navigate\s+to|zoom\s+(?:in\s+)?(?:on|to)|center\s+(?:the\s+)?map\s+on|show\s+me\s+on\s+the\s+map)\s+(.+)$/i,
    property: false,
  },
  { re: /\b(?:compare|contrast)\s+(.+\s+(?:vs\.?|versus|and)\s+.+)$/i, property: true },
  { re: /\b(?:map|pull\s+up|open\s+the\s+map\s+(?:on|for))\s+(.+)$/i, property: false },
  {
    re: /^(\d{1,6}\s+[A-Za-z0-9'.\- ]{3,}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pkwy|parkway|hwy|highway|ter|terrace|pl|place|cir|circle|trl|trail|loop|sq|square)\b.*)$/i,
    property: true,
  },
];

export function detectGeoTarget(text: string): GeoTarget | null {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 2000) return null;
  if (NEGATIVES.test(raw)) return null;

  for (const { re, property } of PATTERNS) {
    const m = raw.match(re);
    if (!m) continue;
    const place = (m[1] || "")
      .replace(/[.?!]+$/g, "")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();
    if (!place || place.length < 2) continue;
    if (!property && /^[a-z]+$/i.test(place) && place.length < 4) continue;
    return { place, property };
  }
  return null;
}

async function invokeFn(
  name: string,
  body: Record<string, unknown>,
  callerAuth: string | null,
  timeoutMs: number,
): Promise<{ name: string; ok: boolean; status: number; data: unknown; error?: string }> {
  if (!SUPABASE_URL) return { name, ok: false, status: 0, data: null, error: "SUPABASE_URL unset" };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const auth = callerAuth || (SERVICE_KEY ? `Bearer ${SERVICE_KEY}` : "");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
        ...(SERVICE_KEY ? { apikey: SERVICE_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    return { name, ok: res.ok, status: res.status, data };
  } catch (e) {
    return { name, ok: false, status: 0, data: null, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

function pickCoords(data: any): { lat?: number; lon?: number } {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, any>;
  const lat = Number(d.lat ?? d.latitude ?? d.location?.lat ?? d.geometry?.lat);
  const lon = Number(
    d.lon ?? d.lng ?? d.longitude ?? d.location?.lon ?? d.location?.lng ?? d.geometry?.lon ?? d.geometry?.lng,
  );
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
}

async function photonGeocode(place: string): Promise<{ lat?: number; lon?: number; label?: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2500);
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(place)}&limit=1`;
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) return {};
    const j = await res.json();
    const f = Array.isArray(j?.features) ? j.features[0] : null;
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return {};
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return {};
    const p = f?.properties || {};
    const label = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ") || place;
    return { lat, lon, label };
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

export async function runGeoTools(
  target: GeoTarget,
  callerAuth: string | null,
): Promise<{ context: string; fired: string[] }> {
  const fired: string[] = [];
  const lines: string[] = [];
  lines.push(`GEO_TOOL_INVOKE place="${target.place}" property=${target.property}`);

  const geo = await photonGeocode(target.place);
  if (geo.lat != null && geo.lon != null) {
    fired.push("photon:200");
    lines.push(`PHOTON_GEOCODE_OK lat=${geo.lat} lon=${geo.lon} label=${geo.label || target.place}`);
  } else {
    fired.push("photon:miss");
    lines.push("PHOTON_GEOCODE_OFFLINE");
  }

  if (target.property) {
    const prop = await invokeFn(
      "asher-property-intel",
      { address: target.place, place: target.place },
      callerAuth,
      8_000,
    );
    fired.push(`asher-property-intel:${prop.status || (prop.error ?? "err")}`);
    if (prop.ok) {
      lines.push("PROPERTY_INTEL_OK");
      lines.push(JSON.stringify(prop.data).slice(0, 6000));
      const fromProp = pickCoords((prop.data as any)?.location ?? prop.data);
      if (fromProp.lat != null && fromProp.lon != null && (geo.lat == null || geo.lon == null)) {
        lines.push(`PROPERTY_COORDS lat=${fromProp.lat} lon=${fromProp.lon}`);
      }
    } else {
      lines.push(`PROPERTY_INTEL_OFFLINE status=${prop.status} err=${prop.error ?? ""}`);
    }
  } else {
    lines.push("PROPERTY_INTEL_SKIPPED reason=fly_not_dossier");
  }

  lines.push("STREET_CAMERAS_DEFERRED reason=map_organ_sweeps_on_fly");
  return { context: lines.join("\n"), fired };
}
