/**
 * geo-guard — regional pricing quote + VPN integrity probe.
 *
 * The browser calls this on every subscription-page view (and periodically
 * while it stays open). Each call writes one server-observed IP fix into the
 * integrity ledger and returns the price the server is *actually* willing to
 * charge. The client never proposes a country and never proposes an amount.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { BASE_CENTS, observeAndJudge, priceCents, roundCents, type PppTier, type Term } from "../_shared/ppp.ts";
import { TEAM_SEAT_CENTS, TEAM_WORKSPACE_CENTS } from "../_shared/teamPricing.ts";

const TIERS: PppTier[] = ["monthly_aureon", "monthly_pro"];
const TERMS: Term[] = ["monthly", "semiannual"];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* GET-style call */ }

    const visitorId = typeof body?.visitorId === "string" ? body.visitorId.slice(0, 64) : "";
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) {
      // Asherin Team lines quote separately: the workspace fee and the per-seat
    // fee are two distinct recurring lines, so the card can show 39 + 24 x N.
    const teamLine = (base: number) =>
      verdict.multiplier >= 1 ? base : roundCents(base * verdict.multiplier);
    quote["team_workspace"] = {
      monthly: { cents: teamLine(TEAM_WORKSPACE_CENTS.monthly), baseCents: TEAM_WORKSPACE_CENTS.monthly },
      semiannual: { cents: teamLine(TEAM_WORKSPACE_CENTS.semiannual), baseCents: TEAM_WORKSPACE_CENTS.semiannual },
    };
    quote["team_seat"] = {
      monthly: { cents: teamLine(TEAM_SEAT_CENTS.monthly), baseCents: TEAM_SEAT_CENTS.monthly },
      semiannual: { cents: teamLine(TEAM_SEAT_CENTS.semiannual), baseCents: TEAM_SEAT_CENTS.semiannual },
    };

    return new Response(JSON.stringify({ error: "invalid visitorId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional identity — signing in must not reset the visitor's hour of history.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        );
        const { data } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
        userId = data.user?.id ?? null;
      } catch { /* anonymous quote */ }
    }

    const verdict = await observeAndJudge(req, visitorId, userId);

    const quote: Record<string, Record<string, { cents: number; baseCents: number }>> = {};
    for (const tier of TIERS) {
      quote[tier] = {};
      for (const term of TERMS) {
        quote[tier][term] = {
          cents: priceCents(tier, term, verdict.multiplier),
          baseCents: BASE_CENTS[tier][term],
        };
      }
    }

    return new Response(
      JSON.stringify({
        country: verdict.country,
        multiplier: verdict.multiplier,
        vpnSuspected: verdict.vpnSuspected,
        reasons: verdict.reasons,
        distinctIps: verdict.distinctIps,
        distinctCountries: verdict.distinctCountries,
        quote,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[geo-guard] ${message}`);
    // Fail closed but never break the page: full price, no discount.
    return new Response(JSON.stringify({ error: message, multiplier: 1, vpnSuspected: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
