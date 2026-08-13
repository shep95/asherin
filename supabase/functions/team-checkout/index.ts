/**
 * Asherin Team checkout.
 *
 * A workspace does not exist until the owner has paid for it: the browser can
 * no longer insert into `teams` (RLS was removed in the TEAMS-WORKSPACE
 * migration). This function is the only door — it creates the container in
 * `billing_status = 'pending'`, seats the caller as owner, and hands back a
 * Stripe Checkout URL carrying two recurring lines:
 *
 *   Asherin Team workspace  $39   quantity 1
 *   Asherin Team seat       $24   quantity = seats (minimum 2, owner included)
 *
 * The webhook flips the container to `active`. Nothing in the product grants
 * team access while the row is still `pending`.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { observeAndJudge } from "../_shared/ppp.ts";
import { BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";
import { clampSeats, teamQuote, type TeamTerm } from "../_shared/teamPricing.ts";

const log = (step: string, details?: unknown) =>
  console.log(`[TEAM-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

function safeOrigin(req: Request): string {
  const raw = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(raw) ? raw : ALLOWED_ORIGINS[0];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const anon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let createdTeamId: string | null = null;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new BillingConfigError();

    const user = await requireBillingUser(req, (t) => anon.auth.getUser(t) as any);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim().slice(0, 240);
    const icon = String(body?.icon ?? "building").slice(0, 24);
    const seats = clampSeats(body?.seats);
    const term: TeamTerm = body?.term === "semiannual" ? "semiannual" : "monthly";

    if (name.length < 2 || name.length > 60) {
      return new Response(JSON.stringify({ error: "Workspace name must be 2–60 characters." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // Server-observed regional multiplier. Client never sends an amount.
    const verdict = await observeAndJudge(req, user.id, user.id);
    const quote = teamQuote(seats, term, verdict.multiplier);
    log("Quote resolved", {
      seats: quote.seats, term, country: verdict.country,
      multiplier: verdict.multiplier, total: quote.totalCents,
    });

    // Container first, so the Stripe session can carry team_id in metadata.
    const { data: team, error: teamErr } = await admin
      .from("teams")
      .insert({
        name, description, icon,
        owner_id: user.id,
        seat_quantity: quote.seats,
        billing_status: "pending",
        billing_term: term,
      })
      .select()
      .single();
    if (teamErr || !team) throw new Error(teamErr?.message ?? "Could not create the workspace.");
    createdTeamId = team.id;

    const { error: seatErr } = await admin
      .from("team_members")
      .insert({ team_id: team.id, user_id: user.id, role: "owner" });
    if (seatErr) throw new Error(seatErr.message);

    const stripe = new Stripe(stripeKey, {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") || "2025-08-27.basil") as any,
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const recurring = { interval: "month" as const, interval_count: quote.intervalCount };
    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: quote.workspaceCents,
            recurring,
            product_data: {
              name: "Asherin Team workspace",
              description: "Admin console, invites, role graph, membership audit, shared Team Projects.",
              metadata: { asherin_line: "team_workspace" },
            },
          },
        },
        {
          quantity: quote.seats,
          price_data: {
            currency: "usd",
            unit_amount: quote.seatCents,
            recurring,
            product_data: {
              name: "Asherin Team seat",
              description: "One occupied seat, owner included. Pro-class access while the team is active.",
              metadata: { asherin_line: "team_seat" },
            },
          },
        },
      ],
      success_url: `${origin}/dashboard?view=teams&team_checkout=success&team=${team.id}`,
      cancel_url: `${origin}/dashboard?view=teams&team_checkout=canceled&team=${team.id}`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      payment_method_types: ["card"],
      tax_id_collection: { enabled: true },
      customer_update: customerId ? { address: "auto", name: "auto" } : undefined,
      subscription_data: {
        metadata: {
          plan: "team",
          team_id: team.id,
          owner_id: user.id,
          seats: String(quote.seats),
          team_term: term,
          pricing_country: verdict.country ?? "unknown",
          pricing_multiplier: String(verdict.multiplier),
        },
      },
      metadata: { plan: "team", team_id: team.id, owner_id: user.id },
    });

    log("Session created", { sessionId: session.id, teamId: team.id });

    return new Response(JSON.stringify({
      url: session.url,
      team_id: team.id,
      quote: {
        workspace_cents: quote.workspaceCents,
        seat_cents: quote.seatCents,
        seats: quote.seats,
        total_cents: quote.totalCents,
        term,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    // A container without a payment session is litter — remove it so the owner
    // does not see a dead workspace they can neither pay for nor delete.
    if (createdTeamId) {
      await admin.from("team_members").delete().eq("team_id", createdTeamId);
      await admin.from("teams").delete().eq("id", createdTeamId).eq("billing_status", "pending");
    }
    return billingError(error, corsHeaders, "TEAM-CHECKOUT");
  }
});
