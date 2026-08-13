import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { BillingAuthError, BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPGRADE-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Tier price IDs
const TIER_PRICES: Record<string, string> = {
  monthly_aureon: "price_1Tk7FyRxgCpmPfiF4vZebmnE",
  monthly_pro: "price_1U3vudRxgCpmPfiFCTcY3p1W",
  starter: "price_1T9wBfRxgCpmPfiFgegrNIkk",
  chat: "price_1T6PPmRxgCpmPfiFoTiBXBzq",
  aureon: "price_1T3o9NRxgCpmPfiFaFDWC8u0",
  pro: "price_1T3N4iRxgCpmPfiFGbJkXY33",
  advisor_monthly: "price_1T1abVRxgCpmPfiFsZcq9ZNM",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new BillingConfigError();

    const user = await requireBillingUser(req, (t) => supabaseClient.auth.getUser(t) as any);
    logStep("User authenticated", { email: user.email });

    const { action, targetTier } = await req.json();
    logStep("Request", { action, targetTier });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("No Stripe customer found");
    const customerId = customers.data[0].id;

    // Find active subscription
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });
    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 5,
    });
    const pastDueSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "past_due",
      limit: 5,
    });
    const allSubs = [...subs.data, ...trialingSubs.data, ...pastDueSubs.data];
    
    if (action === "upgrade") {
      // ── PRORATED UPGRADE ──────────────────────────────────────────
      // Find the main subscription (not addon)
      const mainSub = allSubs.find(s => {
        const priceId = s.items.data[0]?.price?.id;
        return Object.values(TIER_PRICES).includes(priceId);
      });

      if (!mainSub) throw new Error("No active subscription found to upgrade");

      const newPriceId = TIER_PRICES[targetTier];
      if (!newPriceId) throw new Error(`Invalid target tier: ${targetTier}`);

      const currentPriceId = mainSub.items.data[0].price.id;
      if (currentPriceId === newPriceId) throw new Error("Already on this tier");

      logStep("Upgrading subscription", {
        subscriptionId: mainSub.id,
        from: currentPriceId,
        to: newPriceId,
      });

      // Swap the subscription item with proration
      const updated = await stripe.subscriptions.update(mainSub.id, {
        items: [
          {
            id: mainSub.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
        payment_behavior: "pending_if_incomplete",
      });

      logStep("Subscription upgraded", { newStatus: updated.status });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription upgraded with prorated billing. You only pay the difference.",
          new_status: updated.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else if (action === "start_pro_trial") {
      // ── 3-DAY PRO TRIAL FOR AUREON USERS ──────────────────────────
      const mainSub = allSubs.find(s => {
        const priceId = s.items.data[0]?.price?.id;
        return priceId === TIER_PRICES.aureon;
      });

      if (!mainSub) throw new Error("You need an active Aureon subscription to start a Pro trial");

      // Check if they already had a trial
      const existingProTrials = allSubs.filter(s => {
        const priceId = s.items.data[0]?.price?.id;
        return priceId === TIER_PRICES.pro && s.status === "trialing";
      });
      if (existingProTrials.length > 0) throw new Error("You already have an active Pro trial");

      logStep("Starting 3-day Pro trial for Aureon user");

      // Upgrade to Pro with 3-day trial, cancel_at set to 3 days from now
      // After trial ends, it reverts by canceling (user keeps Aureon sub)
      const trialEnd = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; // 3 days

      const updated = await stripe.subscriptions.update(mainSub.id, {
        items: [
          {
            id: mainSub.items.data[0].id,
            price: TIER_PRICES.pro,
          },
        ],
        trial_end: trialEnd,
        proration_behavior: "none",
        cancel_at: trialEnd, // Auto-cancel at end of trial
      });

      logStep("Pro trial started", { trialEnd: new Date(trialEnd * 1000).toISOString() });

      return new Response(
        JSON.stringify({
          success: true,
          message: "3-day Pro trial activated! You'll have full Pro access. After 3 days, you can upgrade or return to Aureon.",
          trial_ends: new Date(trialEnd * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else if (action === "cancel") {
      // ── CANCEL AT PERIOD END ──────────────────────────────────────
      const mainSub = allSubs.find(s => {
        const priceId = s.items.data[0]?.price?.id;
        return Object.values(TIER_PRICES).includes(priceId);
      });

      if (!mainSub) throw new Error("No active subscription found");

      if (mainSub.cancel_at_period_end) {
        return new Response(
          JSON.stringify({
            success: true,
            already_scheduled: true,
            message: `Cancellation is already scheduled for ${new Date(mainSub.current_period_end * 1000).toLocaleDateString()}.`,
            cancel_date: new Date(mainSub.current_period_end * 1000).toISOString(),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      logStep("Canceling at period end", { subscriptionId: mainSub.id });

      const updated = await stripe.subscriptions.update(mainSub.id, {
        cancel_at_period_end: true,
      });

      logStep("Subscription set to cancel at period end", {
        cancelAt: new Date(updated.current_period_end * 1000).toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Subscription will cancel at the end of your billing period (${new Date(updated.current_period_end * 1000).toLocaleDateString()}). You'll keep access until then. Any active add-ons continue billing separately.`,
          cancel_date: new Date(updated.current_period_end * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else if (action === "reactivate") {
      // ── REACTIVATE (undo cancel) ──────────────────────────────────
      const mainSub = allSubs.find(s => s.cancel_at_period_end);
      if (!mainSub) throw new Error("No subscription pending cancellation");

      const updated = await stripe.subscriptions.update(mainSub.id, {
        cancel_at_period_end: false,
      });

      logStep("Subscription reactivated");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Subscription reactivated! Your plan will continue renewing normally.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return billingError(error, corsHeaders, "UPGRADE-SUBSCRIPTION");
  }
});
