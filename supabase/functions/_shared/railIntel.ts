/**
 * RAIL & SURFACE-NETWORK INTEL.
 *
 * NARRATIVE
 * A train has no plate and no nameable driver, so the car doctrine collapses on
 * contact. What a rail (or coach, or ferry) leg does have is a network: named
 * stops with fixed coordinates, a published timetable, and an operator with a
 * public incident record. The traveller-safety questions that actually apply
 * are therefore: does this stop exist and where exactly is it, is the service
 * plausible on this network, and what is the ground risk at the station at the
 * hour I arrive.
 *
 * FLAWS FOUND
 *  1. Most transit APIs are keyed (Transitland, Amadeus, Rail Europe) and would
 *     make the whole mode depend on a credential the traveller does not have.
 *  2. Naive geocoding ("Penn Station") resolves to a coffee shop of the same
 *     name. The resolver must prefer records the source itself typed as a STOP.
 *  3. A station name is untrusted input from an email. It is length-capped and
 *     URL-encoded before it is ever placed in a query string.
 *
 * REWRITTEN NARRATIVE
 * Use Transitous — the community MOTIS deployment over worldwide GTFS feeds —
 * which is keyless and was live-verified before adoption. Resolve each endpoint
 * to a typed STOP with coordinates, hand those coordinates to the existing
 * area-risk engine, and report an unresolved stop as a gap rather than a
 * finding. No individual crew member is ever profiled.
 */

export interface StopRecord {
  name: string;
  id: string | null;
  lat: number;
  lon: number;
  country: string | null;
  tz: string | null;
  /** The area name the source matched, e.g. "New York". */
  region: string | null;
  source_url: string;
}

export interface RailFlag {
  code: string;
  severity: "info" | "warn" | "high";
  detail: string;
  evidence: string;
}

export interface RailDossier {
  origin: StopRecord | null;
  destination: StopRecord | null;
  flags: RailFlag[];
  queried: string[];
  gaps: string[];
  block: string;
}

const TRANSITOUS = "https://api.transitous.org";
const UA = "AsherinTransitGuardian/1.0 (traveller-safety; open-data)";
const MAX_BYTES = 256_000;

interface GeocodeHit {
  type?: string;
  name?: string;
  id?: string;
  lat?: number;
  lon?: number;
  country?: string;
  tz?: string;
  areas?: Array<{ name?: string; matched?: boolean; adminLevel?: number }>;
}

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "error",
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return JSON.parse((await res.text()).slice(0, MAX_BYTES)) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a station/terminal name to a typed stop. Non-STOP hits (addresses,
 * places) are only accepted when nothing typed as a STOP came back, and they
 * are marked by the absent id so the caller can weigh them lower.
 */
export async function resolveStop(name: string): Promise<StopRecord | null> {
  const q = name.trim().slice(0, 120);
  if (q.length < 2) return null;
  const url = `${TRANSITOUS}/api/v1/geocode?text=${encodeURIComponent(q)}`;
  const hits = await getJson<GeocodeHit[]>(url);
  if (!Array.isArray(hits) || !hits.length) return null;

  const pick = hits.find((h) => h.type === "STOP" && typeof h.lat === "number") ??
    hits.find((h) => typeof h.lat === "number");
  if (!pick || typeof pick.lat !== "number" || typeof pick.lon !== "number") return null;

  const region = pick.areas?.find((a) => a.matched)?.name ??
    pick.areas?.find((a) => a.adminLevel === 4)?.name ?? null;

  return {
    name: pick.name ?? q,
    id: pick.type === "STOP" ? (pick.id ?? null) : null,
    lat: pick.lat,
    lon: pick.lon,
    country: pick.country ?? null,
    tz: pick.tz ?? null,
    region,
    source_url: url,
  };
}

/** Great-circle distance in km — used only as a sanity check on the pair. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Longest plausible single surface leg before the pair is suspect. */
const MAX_SURFACE_LEG_KM = 4000;

export async function railDossier(input: {
  origin?: string | null;
  destination?: string | null;
  service?: string | null;
  operator_label?: string | null;
}): Promise<RailDossier> {
  const flags: RailFlag[] = [];
  const gaps: string[] = [];
  const queried: string[] = [];

  // Endpoints are independent: a dead one must not take the other with it.
  const [origin, destination] = await Promise.all([
    input.origin ? (queried.push("transitous/geocode:origin"), resolveStop(input.origin)) : Promise.resolve(null),
    input.destination ? (queried.push("transitous/geocode:destination"), resolveStop(input.destination)) : Promise.resolve(null),
  ]);

  if (input.origin && !origin) gaps.push(`Origin "${input.origin}" did not resolve to a known stop in the open transit graph.`);
  if (input.destination && !destination) gaps.push(`Destination "${input.destination}" did not resolve to a known stop in the open transit graph.`);
  if (!input.origin && !input.destination) gaps.push("No route was read from the booking — station-area risk cannot be anchored.");

  if (origin && destination) {
    const km = haversineKm(origin, destination);
    if (km > MAX_SURFACE_LEG_KM) {
      flags.push({
        code: "IMPLAUSIBLE_SURFACE_LEG",
        severity: "warn",
        detail: `Resolved endpoints are ${Math.round(km)} km apart, which is not a single surface service. One endpoint was probably matched to the wrong stop of the same name.`,
        evidence: `${origin.name} → ${destination.name}`,
      });
    } else if (km < 0.5) {
      flags.push({
        code: "ENDPOINTS_COLLAPSED",
        severity: "info",
        detail: "Origin and destination resolved to effectively the same point — the route line was probably misread.",
        evidence: `${origin.name} → ${destination.name}`,
      });
    } else {
      flags.push({
        code: "ROUTE_RESOLVED",
        severity: "info",
        detail: `Route resolved: ${origin.name} → ${destination.name}, ${Math.round(km)} km direct.`,
        evidence: origin.source_url,
      });
    }
  }

  if (origin && destination && origin.country && destination.country && origin.country !== destination.country) {
    flags.push({
      code: "CROSS_BORDER",
      severity: "info",
      detail: `This service crosses from ${origin.country} into ${destination.country} — carry travel documents and expect a border control stop.`,
      evidence: `${origin.country} → ${destination.country}`,
    });
  }

  return { origin, destination, flags, queried, gaps, block: renderBlock(input, origin, destination, flags, gaps) };
}

function renderBlock(
  input: { service?: string | null; operator_label?: string | null },
  origin: StopRecord | null,
  destination: StopRecord | null,
  flags: RailFlag[],
  gaps: string[],
): string {
  const lines = ["NETWORK CHECK (primary source: Transitous open transit graph)"];
  lines.push(`Operator: ${input.operator_label ?? "(unread)"} · Service: ${input.service ?? "(unread)"}`);
  if (origin) lines.push(`Origin stop: ${origin.name} (${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)})${origin.region ? ` — ${origin.region}` : ""}${origin.tz ? ` — ${origin.tz}` : ""}`);
  if (destination) lines.push(`Destination stop: ${destination.name} (${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)})${destination.region ? ` — ${destination.region}` : ""}`);
  for (const f of flags) lines.push(`[${f.severity.toUpperCase()}] ${f.code}: ${f.detail}`);
  for (const g of gaps) lines.push(`GAP: ${g}`);
  return lines.join("\n");
}
