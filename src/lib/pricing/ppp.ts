/**
 * Purchasing-Power-Parity pricing table (client display mirror).
 *
 * CANONICAL COPY: supabase/functions/_shared/ppp.ts
 * This file exists only so the marketing/subscription UI can render a price
 * before the server responds. It is NEVER authoritative — the amount actually
 * charged is recomputed server-side inside `create-checkout` from a
 * server-observed IP. Any tampering here changes pixels, not money.
 */

export type Term = "monthly" | "semiannual";
export type PriceLineId =
  | "monthly_aureon"
  | "monthly_pro"
  | "team_workspace"
  | "team_seat";

/** Base USD amounts, in cents, at multiplier 1.0. */
export const BASE_CENTS: Record<PriceLineId, Record<Term, number>> = {
  monthly_aureon: { monthly: 1800, semiannual: 10800 },
  monthly_pro: { monthly: 7900, semiannual: 47400 },
  // Asherin Team is two recurring lines, not one sticker: the workspace
  // container and one seat. A five-person team renders 3900 + 5 x 2400.
  team_workspace: { monthly: 3900, semiannual: 23400 },
  team_seat: { monthly: 2400, semiannual: 14400 },
};

/** Minimum occupied seats. A one-person "team" is the $18 or $79 seat instead. */
export const TEAM_MIN_SEATS = 2;

/**
 * ISO-3166 alpha-2 → affordability multiplier.
 * Derived from World Bank PPP conversion factors normalised against the US and
 * floored at 0.20 so the platform never sells below its own compute cost.
 * Countries absent from this table pay full price (multiplier 1.0).
 */
export const PPP_MULTIPLIERS: Record<string, number> = {
  // Tier A — 1.00 (US, Canada, Western Europe, Nordics, AU/NZ, CH, IL, SG, HK)
  US: 1, CA: 1, GB: 1, IE: 1, FR: 1, DE: 1, NL: 1, BE: 1, LU: 1, AT: 1,
  CH: 1, NO: 1, SE: 1, DK: 1, FI: 1, IS: 1, AU: 1, NZ: 1, SG: 1, HK: 1,
  IL: 1, QA: 1, AE: 1, KW: 1,

  // Tier B — 0.75 (Southern Europe, Japan, Korea, Gulf, Baltics)
  IT: 0.75, ES: 0.75, PT: 0.75, GR: 0.75, CY: 0.75, MT: 0.75, JP: 0.75,
  KR: 0.75, TW: 0.75, EE: 0.75, LV: 0.75, LT: 0.75, SI: 0.75, CZ: 0.75,
  SA: 0.75, BH: 0.75, OM: 0.75,

  // Tier C — 0.55 (Central/Eastern Europe, Chile, Uruguay, Panama, Malaysia)
  PL: 0.55, SK: 0.55, HU: 0.55, HR: 0.55, RO: 0.55, BG: 0.55, RS: 0.55,
  CL: 0.55, UY: 0.55, PA: 0.55, CR: 0.55, MY: 0.55, CN: 0.55, TR: 0.55,
  MX: 0.55, ZA: 0.55, BR: 0.55, AR: 0.55, TH: 0.55,

  // Tier D — 0.40 (Latin America, North Africa, SE Asia, Balkans)
  CO: 0.4, PE: 0.4, EC: 0.4, DO: 0.4, GT: 0.4, PY: 0.4, BO: 0.4,
  MA: 0.4, TN: 0.4, JO: 0.4, AL: 0.4, BA: 0.4, MK: 0.4, MD: 0.4,
  UA: 0.4, GE: 0.4, AM: 0.4, AZ: 0.4, KZ: 0.4, ID: 0.4, PH: 0.4,
  VN: 0.4, LK: 0.4, MN: 0.4, FJ: 0.4,

  // Tier E — 0.30 (South Asia, most of Sub-Saharan Africa, Central Asia)
  IN: 0.3, BD: 0.3, PK: 0.3, NP: 0.3, KH: 0.3, LA: 0.3, MM: 0.3,
  EG: 0.3, DZ: 0.3, KE: 0.3, GH: 0.3, NG: 0.3, TZ: 0.3, UG: 0.3,
  ZM: 0.3, ZW: 0.3, CM: 0.3, SN: 0.3, CI: 0.3, UZ: 0.3, KG: 0.3,
  TJ: 0.3, HN: 0.3, NI: 0.3, SV: 0.3, VE: 0.3,

  // Tier F — 0.22 (lowest-income economies)
  ET: 0.22, RW: 0.22, MW: 0.22, MZ: 0.22, MG: 0.22, NE: 0.22, ML: 0.22,
  BF: 0.22, TD: 0.22, CD: 0.22, SS: 0.22, SL: 0.22, LR: 0.22, BI: 0.22,
  AF: 0.22, YE: 0.22, HT: 0.22, SO: 0.22, GN: 0.22, TG: 0.22, BJ: 0.22,
};

export function multiplierFor(country: string | null | undefined): number {
  if (!country) return 1;
  const m = PPP_MULTIPLIERS[country.toUpperCase()];
  return typeof m === "number" ? m : 1;
}

/**
 * Charm-round a discounted amount so the checkout never shows $3.9600.
 * < $100 → nearest .99 ; >= $100 → nearest whole dollar.
 * Never returns less than $1.99 (Stripe's practical minimum for USD cards).
 */
export function roundCents(cents: number): number {
  if (cents >= 10000) return Math.max(199, Math.round(cents / 100) * 100);
  const dollars = Math.max(1, Math.round(cents / 100));
  return Math.max(199, dollars * 100 - 1);
}

export interface PricePoint {
  cents: number;
  baseCents: number;
  discounted: boolean;
  /** Effective per-month cents, for the "= $X/mo" line on semiannual cards. */
  perMonthCents: number;
}

export function priceFor(
  tier: PriceLineId,
  term: Term,
  multiplier: number,
): PricePoint {
  const baseCents = BASE_CENTS[tier][term];
  const cents = multiplier >= 1 ? baseCents : roundCents(baseCents * multiplier);
  return {
    cents,
    baseCents,
    discounted: cents < baseCents,
    perMonthCents: term === "semiannual" ? Math.round(cents / 6) : cents,
  };
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
