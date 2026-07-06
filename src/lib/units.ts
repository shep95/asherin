// Locale-aware weight unit selection.
//
// Narrative: the AR HUD prints weight as `kg`, but operators in the US see
// pounds everywhere else in their life. Rather than force a global toggle we
// derive the unit from the *user's location*, resolved in this priority:
//   1) Explicit override via `setWeightUnitOverride('kg' | 'lb')`
//   2) A cached country hint from the browser geolocation reverse-lookup
//      (populated opportunistically — never blocks the render path).
//   3) `navigator.language` region tag (e.g. `en-US` → US).
//   4) IANA timezone heuristic (America/* → US, Asia/Yangon → MM, etc.).
// Countries that use pounds for body weight in everyday use: US, Liberia,
// Myanmar. The UK legally uses kg but colloquially stones/pounds — we keep
// kg to avoid mid-metric surprise; users can flip via override.

export type WeightUnit = "kg" | "lb";

const IMPERIAL_COUNTRIES = new Set(["US", "LR", "MM"]);

let override: WeightUnit | null = null;
let cachedCountry: string | null = null;

export function setWeightUnitOverride(u: WeightUnit | null) {
  override = u;
}

export function setCountryHint(cc: string | null) {
  cachedCountry = cc ? cc.toUpperCase() : null;
}

function regionFromLanguage(): string | null {
  try {
    const lang = (typeof navigator !== "undefined" && navigator.language) || "";
    // en-US, es-419, zh-Hant-TW → take last 2-letter uppercase segment
    const parts = lang.split(/[-_]/).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
    }
  } catch { /* ignore */ }
  return null;
}

function countryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (!tz) return null;
    // Coarse but sufficient for weight-unit selection.
    if (tz.startsWith("America/") &&
        !/(Argentina|Sao_Paulo|Bogota|Lima|Santiago|Caracas|Mexico|Havana|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|St_Johns|Regina)/.test(tz)) {
      return "US";
    }
    if (tz === "Pacific/Honolulu" || tz === "America/Anchorage") return "US";
    if (tz === "Asia/Yangon" || tz === "Asia/Rangoon") return "MM";
    if (tz === "Africa/Monrovia") return "LR";
  } catch { /* ignore */ }
  return null;
}

export function resolveCountry(): string | null {
  return cachedCountry || regionFromLanguage() || countryFromTimezone();
}

export function usesImperialWeight(): boolean {
  if (override) return override === "lb";
  const cc = resolveCountry();
  return cc ? IMPERIAL_COUNTRIES.has(cc) : false;
}

/** Convert kg → integer pounds. */
export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462);
}

/**
 * Format a kg reading in the operator's preferred unit.
 * Returns a bare string like "165lb" or "75kg".
 */
export function formatWeightKg(kg: number | null | undefined): string {
  if (kg == null || !isFinite(kg)) return "—";
  return usesImperialWeight() ? `${kgToLb(kg)}lb` : `${Math.round(kg)}kg`;
}

/**
 * Opportunistically resolve the user's country via the Geolocation API +
 * a public reverse-geocoder. Silent on failure; never throws. Safe to call
 * once at app boot.
 */
export async function primeCountryFromGeolocation(signal?: AbortSignal): Promise<void> {
  if (cachedCountry) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 6000,
      });
    });
    const { latitude, longitude } = pos.coords;
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=3&addressdetails=1`;
    const r = await fetch(url, { signal, headers: { "Accept": "application/json" } });
    if (!r.ok) return;
    const j = await r.json().catch(() => null);
    const cc = j?.address?.country_code;
    if (typeof cc === "string" && cc.length === 2) setCountryHint(cc);
  } catch { /* silent */ }
}
