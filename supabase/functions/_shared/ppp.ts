/**
 * CANONICAL purchasing-power pricing + VPN/geo integrity engine.
 *
 * Every amount charged is computed here, from an IP the *server* observed on
 * the request socket — never from a client-supplied country. The client mirror
 * at src/lib/pricing/ppp.ts is display-only.
 *
 * Integrity rule (anti-loophole):
 *   A regional discount is granted only when the last hour of server-observed
 *   IP telemetry for this identity is *stable*: one country, no datacenter /
 *   hosting ASN, no impossible-travel hop. Any instability => full USD price.
 *   Fail-closed: if geolocation itself fails we charge full price.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Term = "monthly" | "semiannual";
export type PppTier = "monthly_aureon" | "monthly_pro";

export const BASE_CENTS: Record<PppTier, Record<Term, number>> = {
  monthly_aureon: { monthly: 1800, semiannual: 10800 },
  monthly_pro: { monthly: 7900, semiannual: 47400 },
};

/** Stripe product each dynamic price attaches to, so revenue stays trackable. */
export const STRIPE_PRODUCTS: Record<PppTier, Record<Term, string>> = {
  monthly_aureon: { monthly: "prod_UjaQPixvFi3Qlr", semiannual: "prod_V226j5fQ5fSoD9" },
  monthly_pro: { monthly: "prod_UjaQFcAkQnTOm1", semiannual: "prod_V2267gYsf3sRRn" },
};

/** Canonical full-price Stripe Price IDs (used when multiplier === 1). */
export const FULL_PRICE_IDS: Record<PppTier, Record<Term, string | null>> = {
  monthly_aureon: { monthly: "price_1Tk7FyRxgCpmPfiF4vZebmnE", semiannual: null },
  monthly_pro: { monthly: "price_1U3vudRxgCpmPfiFCTcY3p1W", semiannual: null },
};

export const PPP_MULTIPLIERS: Record<string, number> = {
  US: 1, CA: 1, GB: 1, IE: 1, FR: 1, DE: 1, NL: 1, BE: 1, LU: 1, AT: 1,
  CH: 1, NO: 1, SE: 1, DK: 1, FI: 1, IS: 1, AU: 1, NZ: 1, SG: 1, HK: 1,
  IL: 1, QA: 1, AE: 1, KW: 1,
  IT: 0.75, ES: 0.75, PT: 0.75, GR: 0.75, CY: 0.75, MT: 0.75, JP: 0.75,
  KR: 0.75, TW: 0.75, EE: 0.75, LV: 0.75, LT: 0.75, SI: 0.75, CZ: 0.75,
  SA: 0.75, BH: 0.75, OM: 0.75,
  PL: 0.55, SK: 0.55, HU: 0.55, HR: 0.55, RO: 0.55, BG: 0.55, RS: 0.55,
  CL: 0.55, UY: 0.55, PA: 0.55, CR: 0.55, MY: 0.55, CN: 0.55, TR: 0.55,
  MX: 0.55, ZA: 0.55, BR: 0.55, AR: 0.55, TH: 0.55,
  CO: 0.4, PE: 0.4, EC: 0.4, DO: 0.4, GT: 0.4, PY: 0.4, BO: 0.4,
  MA: 0.4, TN: 0.4, JO: 0.4, AL: 0.4, BA: 0.4, MK: 0.4, MD: 0.4,
  UA: 0.4, GE: 0.4, AM: 0.4, AZ: 0.4, KZ: 0.4, ID: 0.4, PH: 0.4,
  VN: 0.4, LK: 0.4, MN: 0.4, FJ: 0.4,
  IN: 0.3, BD: 0.3, PK: 0.3, NP: 0.3, KH: 0.3, LA: 0.3, MM: 0.3,
  EG: 0.3, DZ: 0.3, KE: 0.3, GH: 0.3, NG: 0.3, TZ: 0.3, UG: 0.3,
  ZM: 0.3, ZW: 0.3, CM: 0.3, SN: 0.3, CI: 0.3, UZ: 0.3, KG: 0.3,
  TJ: 0.3, HN: 0.3, NI: 0.3, SV: 0.3, VE: 0.3,
  ET: 0.22, RW: 0.22, MW: 0.22, MZ: 0.22, MG: 0.22, NE: 0.22, ML: 0.22,
  BF: 0.22, TD: 0.22, CD: 0.22, SS: 0.22, SL: 0.22, LR: 0.22, BI: 0.22,
  AF: 0.22, YE: 0.22, HT: 0.22, SO: 0.22, GN: 0.22, TG: 0.22, BJ: 0.22,
};

export function multiplierFor(country: string | null | undefined): number {
  if (!country) return 1;
  const m = PPP_MULTIPLIERS[country.toUpperCase()];
  return typeof m === "number" ? m : 1;
}

export function roundCents(cents: number): number {
  if (cents >= 10000) return Math.max(199, Math.round(cents / 100) * 100);
  const dollars = Math.max(1, Math.round(cents / 100));
  return Math.max(199, dollars * 100 - 1);
}

export function priceCents(tier: PppTier, term: Term, multiplier: number): number {
  const base = BASE_CENTS[tier][term];
  return multiplier >= 1 ? base : roundCents(base * multiplier);
}

// ── Geo resolution ──────────────────────────────────────────────────────────

/** First public IP on the forwarding chain. Private/loopback hops discarded. */
export function clientIp(req: Request): string | null {
  const chain = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = [...chain, req.headers.get("x-real-ip") || ""].filter(Boolean);
  for (const ip of candidates) {
    if (/^(10\.|127\.|192\.168\.|::1|fc|fd)/i.test(ip)) continue;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) continue;
    return ip;
  }
  return null;
}

export interface GeoResult {
  ip: string | null;
  country: string | null;
  city: string | null;
  org: string | null;
  asn: string | null;
  latitude: number | null;
  longitude: number | null;
  /** True when geolocation could not be established — forces full price. */
  failed: boolean;
}

const DATACENTER_HINTS = [
  "amazon", "aws", "google", "microsoft", "azure", "digitalocean", "linode",
  "ovh", "hetzner", "vultr", "choopa", "leaseweb", "m247", "datacamp",
  "cdn77", "packet", "oracle cloud", "contabo", "scaleway", "colocation",
  "hosting", "datacenter", "data center", "server", "vpn", "proxy", "tor ",
  "nordvpn", "expressvpn", "surfshark", "mullvad", "private internet",
  "cyberghost", "protonvpn", "ipvanish", "zenlayer", "gcore", "clouvider",
];

export function looksLikeInfrastructure(org: string | null): boolean {
  if (!org) return false;
  const s = org.toLowerCase();
  return DATACENTER_HINTS.some((h) => s.includes(h));
}

/** Resolve an IP with a hard timeout. Never throws. */
export async function resolveGeo(ip: string | null): Promise<GeoResult> {
  const empty: GeoResult = {
    ip, country: null, city: null, org: null, asn: null,
    latitude: null, longitude: null, failed: true,
  };
  if (!ip) return empty;
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "asherin-pricing/1.0" },
    });
    if (!res.ok) {
      console.error(`[ppp] geo lookup failed [${res.status}]: ${await res.text()}`);
      return empty;
    }
    const d = await res.json();
    if (d?.error) {
      console.error(`[ppp] geo provider error: ${JSON.stringify(d)}`);
      return empty;
    }
    return {
      ip,
      country: typeof d.country_code === "string" ? d.country_code.toUpperCase() : null,
      city: d.city ?? null,
      org: d.org ?? d.asn_org ?? null,
      asn: d.asn ?? null,
      latitude: typeof d.latitude === "number" ? d.latitude : null,
      longitude: typeof d.longitude === "number" ? d.longitude : null,
      failed: !d.country_code,
    };
  } catch (err) {
    console.error(`[ppp] geo lookup threw: ${err instanceof Error ? err.message : String(err)}`);
    return empty;
  }
}

// ── Integrity ledger ────────────────────────────────────────────────────────

export interface IntegrityVerdict {
  country: string | null;
  multiplier: number;
  vpnSuspected: boolean;
  /** Machine-readable reasons; surfaced to the UI verbatim. */
  reasons: string[];
  distinctIps: number;
  distinctCountries: number;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/** Great-circle km between two coordinates. */
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Record this observation and return the pricing verdict for the trailing hour.
 *
 * `subjectId` is the authenticated user id when available, otherwise a stable
 * anonymous visitor id minted in the browser. Both are recorded so a visitor
 * cannot shed their history simply by signing in mid-session.
 */
export async function observeAndJudge(
  req: Request,
  subjectId: string,
  userId: string | null,
): Promise<IntegrityVerdict> {
  const ip = clientIp(req);
  const geo = await resolveGeo(ip);
  const sb = admin();
  const nowMs = Date.now();
  const windowStart = new Date(nowMs - 60 * 60 * 1000).toISOString();
  const reasons: string[] = [];

  // Write first, then read — so this very hop counts against the window and a
  // rapid VPN flip cannot slip through between the read and the write.
  if (ip) {
    const { error } = await sb.from("pricing_ip_observations").insert({
      subject_id: subjectId,
      user_id: userId,
      ip_address: ip,
      country: geo.country,
      city: geo.city,
      org: geo.org,
      asn: geo.asn,
      latitude: geo.latitude,
      longitude: geo.longitude,
      is_infrastructure: looksLikeInfrastructure(geo.org),
    });
    if (error) console.error(`[ppp] observation insert failed: ${error.message}`);
  }

  const { data: rows, error: readErr } = await sb
    .from("pricing_ip_observations")
    .select("ip_address,country,latitude,longitude,is_infrastructure,observed_at")
    .or(`subject_id.eq.${subjectId}${userId ? `,user_id.eq.${userId}` : ""}`)
    .gte("observed_at", windowStart)
    .order("observed_at", { ascending: true })
    .limit(200);

  if (readErr) {
    console.error(`[ppp] observation read failed: ${readErr.message}`);
    return {
      country: null, multiplier: 1, vpnSuspected: true,
      reasons: ["integrity_ledger_unavailable"], distinctIps: 0, distinctCountries: 0,
    };
  }

  const history = rows ?? [];
  const ips = new Set(history.map((r: any) => r.ip_address).filter(Boolean));
  const countries = new Set(history.map((r: any) => r.country).filter(Boolean));

  if (geo.failed) reasons.push("geolocation_unavailable");
  if (looksLikeInfrastructure(geo.org)) reasons.push("datacenter_or_vpn_asn");
  if (history.some((r: any) => r.is_infrastructure)) reasons.push("datacenter_seen_this_hour");
  if (ips.size > 1) reasons.push(`ip_rotation_${ips.size}_addresses_in_1h`);
  if (countries.size > 1) reasons.push(`country_hopping_${[...countries].join("/")}`);

  // Impossible travel: >900 km/h implied between consecutive fixes.
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1] as any;
    const b = history[i] as any;
    if (a.latitude == null || b.latitude == null) continue;
    const hours = (new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()) / 3.6e6;
    if (hours <= 0) continue;
    const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    if (km > 300 && km / hours > 900) {
      reasons.push("impossible_travel");
      break;
    }
  }

  const vpnSuspected = reasons.length > 0;
  const rawMultiplier = multiplierFor(geo.country);
  // Fail closed: any integrity doubt collapses the discount to full price.
  return {
    country: geo.country,
    multiplier: vpnSuspected ? 1 : rawMultiplier,
    vpnSuspected,
    reasons,
    distinctIps: ips.size,
    distinctCountries: countries.size,
  };
}
