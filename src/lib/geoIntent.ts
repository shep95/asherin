/**
 * geoIntent — a cartography request opens the map. No click to summon.
 *
 * Mirrors supabase/functions/_shared/geoToolBridge.ts so the client surfaces
 * the map at the same instant the backend fires the geography tools. Detection
 * only; nothing here geocodes or claims a location.
 */

export interface GeoIntent {
  /** The literal place phrase lifted from the turn. */
  place: string;
  /** Ownership / occupancy question → rooftop zoom + public-index dossier. */
  property: boolean;
}

/* Phrases that read like "map" but mean a diagram, not a place. */
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
  { re: /\b(?:pull\s+up|open\s+the\s+map\s+(?:on|for)|map)\s+(.+)$/i, property: false },
  /* Bare US-style street address typed straight into chat. */
  { re: /^(\d{1,6}\s+[A-Za-z0-9'.\- ]{3,}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pkwy|parkway|hwy|highway|ter|terrace|pl|place|cir|circle|trl|trail|loop|sq|square)\b.*)$/i, property: true },
];

export function detectGeoIntent(text: string): GeoIntent | null {
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

/** Ask the shell to surface the map and fly. Idempotent, fire-and-forget. */
export function requestMapFocus(intent: GeoIntent) {
  window.dispatchEvent(new CustomEvent("asherin:geo-focus", { detail: intent }));
  // The Asher dashboard listens on its own channel for the same event.
  window.dispatchEvent(new CustomEvent("asher:open-map"));
}
