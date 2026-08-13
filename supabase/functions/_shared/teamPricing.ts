/**
 * Asherin Team — canonical price maths.
 *
 * Locked numbers (USD):
 *   workspace fee  $39 / month   — one line, billed to the owner
 *   seat fee       $24 / member / month — every occupied seat, owner included
 *   minimum        2 seats
 *   six-month term 6 x monthly, charged once (workspace $234, seats $144/seat)
 *
 * Example printed on the pricing card: 5 people = 39 + (5 x 24) = $159 / month.
 *
 * The amount actually charged is always computed here, server-side, from a
 * server-observed IP multiplier. The client mirror in src/lib/pricing/ppp.ts is
 * display-only.
 */

import { roundCents } from "./ppp.ts";

export type TeamTerm = "monthly" | "semiannual";

export const TEAM_WORKSPACE_CENTS: Record<TeamTerm, number> = {
  monthly: 3900,
  semiannual: 23400,
};

export const TEAM_SEAT_CENTS: Record<TeamTerm, number> = {
  monthly: 2400,
  semiannual: 14400,
};

export const TEAM_MIN_SEATS = 2;
export const TEAM_MAX_SEATS = 500;

/** Product identity the entitlement layer resolves to Pro-class access. */
export const TEAM_PRODUCT_ID = "asherin_team_workspace";

export interface TeamQuote {
  workspaceCents: number;
  seatCents: number;
  seats: number;
  totalCents: number;
  term: TeamTerm;
  intervalCount: number;
}

export function clampSeats(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return TEAM_MIN_SEATS;
  return Math.min(Math.max(n, TEAM_MIN_SEATS), TEAM_MAX_SEATS);
}

export function teamQuote(seats: number, term: TeamTerm, multiplier: number): TeamQuote {
  const baseWorkspace = TEAM_WORKSPACE_CENTS[term];
  const baseSeat = TEAM_SEAT_CENTS[term];
  const workspaceCents = multiplier >= 1 ? baseWorkspace : roundCents(baseWorkspace * multiplier);
  const seatCents = multiplier >= 1 ? baseSeat : roundCents(baseSeat * multiplier);
  const s = clampSeats(seats);
  return {
    workspaceCents,
    seatCents,
    seats: s,
    totalCents: workspaceCents + seatCents * s,
    term,
    intervalCount: term === "semiannual" ? 6 : 1,
  };
}
