// Asherin Maps — Places engine.
//
// Live point-of-interest search over the OpenStreetMap Overpass API. This is
// the "search nearby" surface Google Maps users expect: categories, distance
// ordering, open-now evaluation from raw `opening_hours`, contact details and
// a one-tap route hand-off.
//
// Data honesty: everything here is OSM-sourced. Hours/phone/website only
// appear when the OSM object actually carries the tag — we never synthesise a
// plausible value.

export interface LatLng { lat: number; lng: number }

export type PlaceCategory =
  | "restaurant" | "cafe" | "fuel" | "hotel" | "pharmacy" | "hospital"
  | "atm" | "parking" | "supermarket" | "bar" | "police" | "school"
  | "charging" | "toilets" | "any";

export interface Place {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: string;
  distanceM: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  /** null = OSM carries no hours, so we refuse to guess. */
  openNow: boolean | null;
  cuisine?: string;
  wheelchair?: string;
  brand?: string;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CATEGORY_FILTERS: Record<Exclude<PlaceCategory, "any">, string> = {
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"~"^(cafe|fast_food)$"]',
  fuel: '["amenity"="fuel"]',
  hotel: '["tourism"~"^(hotel|motel|hostel|guest_house)$"]',
  pharmacy: '["amenity"="pharmacy"]',
  hospital: '["amenity"~"^(hospital|clinic|doctors)$"]',
  atm: '["amenity"~"^(atm|bank)$"]',
  parking: '["amenity"="parking"]',
  supermarket: '["shop"~"^(supermarket|convenience|grocery)$"]',
  bar: '["amenity"~"^(bar|pub|nightclub)$"]',
  police: '["amenity"~"^(police|fire_station)$"]',
  school: '["amenity"~"^(school|college|university)$"]',
  charging: '["amenity"="charging_station"]',
  toilets: '["amenity"="toilets"]',
};

/** Free-text → OSM tag filter. Falls back to a name regex search. */
function buildFilter(query: string, category: PlaceCategory): string {
  if (category !== "any") return CATEGORY_FILTERS[category];
  const q = query.trim();
  const lower = q.toLowerCase();
  for (const [cat, filter] of Object.entries(CATEGORY_FILTERS)) {
    if (lower.includes(cat)) return filter;
  }
  if (lower.includes("restaurant") || lower.includes("food") || lower.includes("eat")) return CATEGORY_FILTERS.restaurant;
  if (lower.includes("gas") || lower.includes("petrol")) return CATEGORY_FILTERS.fuel;
  if (lower.includes("coffee")) return CATEGORY_FILTERS.cafe;
  if (lower.includes("store") || lower.includes("shop")) return CATEGORY_FILTERS.supermarket;
  // Escape regex metacharacters so a user's "(" can't break the query.
  const safe = q.replace(/[\\^$.*+?()[\]{}|"]/g, "\\$&");
  return `["name"~"${safe}",i]`;
}

const R_EARTH = 6_371_000;
function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ── opening_hours evaluation ────────────────────────────────────────────
   A deliberately conservative subset of the OSM spec: weekday ranges plus
   HH:MM-HH:MM windows, "24/7", and "off". Anything we cannot parse with
   confidence returns null (unknown) rather than a wrong "Open now". */

const DAY_INDEX: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };

export function evaluateOpenNow(spec?: string, now = new Date()): boolean | null {
  if (!spec) return null;
  const s = spec.trim().toLowerCase();
  if (!s) return null;
  if (s === "24/7") return true;
  if (s === "off" || s === "closed") return false;
  if (/ph|su\[|week|easter|:/.test(s.replace(/\d{1,2}:\d{2}/g, ""))) {
    // Contains constructs (public holidays, nth-weekday, month rules) beyond
    // this parser — refuse rather than mislead.
    if (/ph|\[|week|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(s)) return null;
  }

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  let matchedRule = false;

  for (const rule of s.split(";")) {
    const r = rule.trim();
    if (!r) continue;
    const timeMatch = r.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const dayPart = r.split(/\d{1,2}:\d{2}/)[0].trim();

    let daysMatch = true;
    if (dayPart) {
      daysMatch = false;
      for (const token of dayPart.split(",")) {
        const t = token.trim();
        if (!t) continue;
        const range = t.match(/^([a-z]{2})\s*-\s*([a-z]{2})$/);
        if (range) {
          const a = DAY_INDEX[range[1]], b = DAY_INDEX[range[2]];
          if (a === undefined || b === undefined) return null;
          // Wrapping ranges (Fr-Mo) are legal in OSM.
          if (a <= b ? day >= a && day <= b : day >= a || day <= b) daysMatch = true;
        } else if (DAY_INDEX[t] !== undefined) {
          if (DAY_INDEX[t] === day) daysMatch = true;
        } else if (t !== "24/7") {
          return null;
        }
      }
    }
    if (!daysMatch) continue;
    matchedRule = true;

    if (/off|closed/.test(r)) return false;
    if (r.includes("24/7")) return true;
    if (!timeMatch) return null;

    const open = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    const closeRaw = Number(timeMatch[3]) * 60 + Number(timeMatch[4]);
    // Past-midnight closing (e.g. 18:00-02:00) wraps into the next day.
    const isOpen = closeRaw <= open
      ? minutes >= open || minutes < closeRaw
      : minutes >= open && minutes < closeRaw;
    if (isOpen) return true;
  }
  return matchedRule ? false : null;
}

function tagAddress(t: Record<string, string>): string | undefined {
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:city"] || t["addr:suburb"],
    t["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function primaryCategory(t: Record<string, string>): string {
  return t.amenity || t.shop || t.tourism || t.leisure || t.office || "place";
}

export interface NearbyOptions {
  center: LatLng;
  query?: string;
  category?: PlaceCategory;
  radiusM?: number;
  limit?: number;
  openNowOnly?: boolean;
  signal?: AbortSignal;
}

export async function searchNearby(opts: NearbyOptions): Promise<Place[]> {
  const { center } = opts;
  const radius = Math.max(100, Math.min(25_000, Math.round(opts.radiusM ?? 2000)));
  const limit = Math.max(1, Math.min(60, opts.limit ?? 30));
  const filter = buildFilter(opts.query || "", opts.category || "any");

  const body =
    `[out:json][timeout:25];` +
    `(node${filter}(around:${radius},${center.lat.toFixed(6)},${center.lng.toFixed(6)});` +
    `way${filter}(around:${radius},${center.lat.toFixed(6)},${center.lng.toFixed(6)});)` +
    `;out center ${limit * 3};`;

  let json: any = null;
  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    const relay = () => ctrl.abort();
    opts.signal?.addEventListener("abort", relay);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(body)}`,
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      json = await r.json();
      break;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", relay);
    }
  }
  if (!json) throw new Error(`Overpass unreachable (${(lastErr as Error)?.message || "network"})`);

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const el of json.elements || []) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const t: Record<string, string> = el.tags || {};
    const name = t.name || t.brand || t.operator;
    if (!name) continue;
    const key = `${name}@${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const openNow = evaluateOpenNow(t.opening_hours);
    if (opts.openNowOnly && openNow !== true) continue;

    out.push({
      id: `${el.type}/${el.id}`,
      lat, lng, name,
      category: primaryCategory(t),
      distanceM: haversineM(center, { lat, lng }),
      address: tagAddress(t),
      phone: t.phone || t["contact:phone"],
      website: t.website || t["contact:website"],
      openingHours: t.opening_hours,
      openNow,
      cuisine: t.cuisine,
      wheelchair: t.wheelchair,
      brand: t.brand,
    });
  }

  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, limit);
}

/** Google Street View deep link — the imagery operators actually ask for. */
export function streetViewUrl(lat: number, lng: number, heading = 0): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}&heading=${Math.round(heading)}`;
}
