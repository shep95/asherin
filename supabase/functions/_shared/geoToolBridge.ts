// geoToolBridge.ts — geography runs, it is never described.
//
// The chat turn hands us a raw user string. We decide if it is a cartography
// intent (take me to / who lives at / map / navigate to / dossier for the
// house at ...), extract the place, and invoke the real map + property
// functions before the model composes a reply. If a tool 404s or times out
// we surface an honest "offline" line — never a hallucinated address, never
// zophiel-intelmap for geography.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export interface GeoTarget {
  /** The literal place phrase we extracted from the turn. */
  place: string;
  /** True when the user asked about ownership / who lives at / property dossier. */
  property: boolean;
}

const NEGATIVES =
  /\b(intel ?map|entity map|relationship map|link map|mind ?map|road ?map|site ?map|heat ?map|world map|map of ideas)\b/i;

const PATTERNS: { re: RegExp; property: boolean }[] = [
  { re: /\b(?:who\s+lives\s+at|who\s+owns|property\s+(?:at|for)|address\s+(?:lookup\s+)?(?:for\s+)?|dossier\s+(?:on|for)\s+(?:the\s+)?(?:house|property|address)\s+at)\s+(.+)$/i, property: true },
  { re: /\b(?:take\s+me\s+to|fly\s+to|go\s+to|navigate\s+to|zoom\s+(?:in\s+)?(?:on|to)|center\s+(?:the\s+)?map\s+on|show\s+me\s+on\s+the\s+map|show\s+me)\s+(.+)$/i, property: false },
  { re: /\b(?:map|pull\s+up|open\s+the\s+map\s+(?:on|for))\s+(.+)$/i, property: false },
];

/** Return a geo target if the user text is a cartography request, else null. */
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
    // Reject one-word abstract nouns that happen to follow "show me" etc.
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
    try { data = text ? JSON.parse(text) : null; } catch { /* keep text */ }
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
  const lon = Number(d.lon ?? d.lng ?? d.longitude ?? d.location?.lon ?? d.location?.lng ?? d.geometry?.lon ?? d.geometry?.lng);
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
}

/**
 * Fire the geography tool chain for a target. Always returns a context string
 * for the model — either the real payloads or an honest offline banner. Fired
 * function names are echoed so chat logs can prove the invoke happened.
 */
export async function runGeoTools(
  target: GeoTarget,
  callerAuth: string | null,
): Promise<{ context: string; fired: string[] }> {
  const fired: string[] = [];
  const lines: string[] = [];
  lines.push(`GEO_TOOL_INVOKE place="${target.place}" property=${target.property}`);

  const prop = await invokeFn(
    "asher-property-intel",
    { address: target.place, place: target.place },
    callerAuth,
    22_000,
  );
  fired.push(`asher-property-intel:${prop.status || (prop.error ?? "err")}`);
  if (prop.ok) {
    lines.push("PROPERTY_INTEL_OK");
    lines.push(JSON.stringify(prop.data).slice(0, 6000));
  } else {
    lines.push(`PROPERTY_INTEL_OFFLINE status=${prop.status} err=${prop.error ?? ""}`);
  }

  const { lat, lon } = pickCoords((prop.data as any)?.location ?? prop.data);
  if (lat != null && lon != null) {
    const cams = await invokeFn(
      "asher-street-cameras",
      { lat, lon, radius_m: 800 },
      callerAuth,
      15_000,
    );
    fired.push(`asher-street-cameras:${cams.status || (cams.error ?? "err")}`);
    if (cams.ok) {
      lines.push("STREET_CAMERAS_OK");
      lines.push(JSON.stringify(cams.data).slice(0, 4000));
    } else {
      lines.push(`STREET_CAMERAS_OFFLINE status=${cams.status} err=${cams.error ?? ""}`);
    }
  } else {
    lines.push("STREET_CAMERAS_SKIPPED reason=no_coords");
  }

  return { context: lines.join("\n"), fired };
}
