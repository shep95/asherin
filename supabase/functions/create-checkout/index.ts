import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import {
  observeAndJudge, priceCents, STRIPE_PRODUCTS, FULL_PRICE_IDS,
  type PppTier, type Term,
} from "../_shared/ppp.ts";
import { BillingAuthError, BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// Server-authoritative price ID whitelist. Client cannot purchase any
// price not on this list, blocking $0.01-test-price attacks.
const ALLOWED_PRICE_IDS = new Set<string>([
  "price_1Tk7FyRxgCpmPfiF4vZebmnE", // monthly_aureon ($18/mo)
  "price_1U3vudRxgCpmPfiFCTcY3p1W", // monthly_pro ($79/mo)
  "price_1TUtfDRxgCpmPfiFNYa092Zu", // lifetime
  "price_1T6PPmRxgCpmPfiFoTiBXBzq", // chat
  "price_1T3o9NRxgCpmPfiFaFDWC8u0", // aureon (legacy)
  "price_1T3N4iRxgCpmPfiFGbJkXY33", // pro (legacy)
  "price_1TfC3oRxgCpmPfiFniV2cXAu", // algorithm
]);

function safeOrigin(req: Request): string {
  const raw = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(raw) ? raw : ALLOWED_ORIGINS[0];
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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

    const {
      priceId, mode, isGift, giftRecipientEmail, giftDurationMonths, tier, term, visitorId,
    } = await req.json();

    // ── Path A: regional / term-based plan. Amount is computed here, never sent. ──
    const planTier: PppTier | null =
      tier === "monthly_aureon" || tier === "monthly_pro" ? tier : null;
    const planTerm: Term = term === "semiannual" ? "semiannual" : "monthly";
    let dynamicLineItem: any = null;
    let pricingAudit: Record<string, string> = {};

    if (planTier) {
      const subjectId = typeof visitorId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(visitorId)
        ? visitorId
        : user.id;
      const verdict = await observeAndJudge(req, subjectId, user.id);
      const amount = priceCents(planTier, planTerm, verdict.multiplier);
      logStep("Regional price resolved", {
        planTier, planTerm, amount, country: verdict.country,
        multiplier: verdict.multiplier, vpnSuspected: verdict.vpnSuspected, reasons: verdict.reasons,
      });

      const canonical = FULL_PRICE_IDS[planTier][planTerm];
      if (verdict.multiplier >= 1 && canonical) {
        dynamicLineItem = { price: canonical, quantity: 1 };
      } else {
        dynamicLineItem = {
          price_data: {
            currency: "usd",
            product: STRIPE_PRODUCTS[planTier][planTerm],
            unit_amount: amount,
            recurring: { interval: "month", interval_count: planTerm === "semiannual" ? 6 : 1 },
          },
          quantity: 1,
        };
      }
      pricingAudit = {
        pricing_country: verdict.country ?? "unknown",
        pricing_multiplier: String(verdict.multiplier),
        pricing_term: planTerm,
        pricing_integrity: verdict.vpnSuspected ? `flagged:${verdict.reasons.join("|")}`.slice(0, 480) : "clean",
      };
    } else {
      if (!priceId) throw new Error("Missing priceId");
      // P0: reject any price ID not on the server-side allowlist.
      if (!ALLOWED_PRICE_IDS.has(priceId)) {
        logStep("REJECTED unknown priceId", { priceId });
        return new Response(JSON.stringify({ error: "Invalid price selection" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
        });
      }
    }

    const checkoutMode = planTier ? "subscription" : (mode === "payment" ? "payment" : "subscription");
    // P2: clamp gift duration to [1, 12] months
    const safeGiftMonths = isGift && giftDurationMonths
      ? Math.min(Math.max(parseInt(String(giftDurationMonths), 10) || 1, 1), 12)
      : 0;
    logStep("Price requested", { priceId, planTier, planTerm, checkoutMode, isGift, giftRecipientEmail, safeGiftMonths });


    // Validate gift recipient exists if this is a gift purchase
    if (isGift && giftRecipientEmail) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      // O(1) lookup via RPC — previous listUsers() silently failed past the
      // 1000-user default page, blocking gifts to newer accounts.
      const { data: recipientId } = await (supabaseAdmin as any).rpc(
        "get_user_id_by_email",
        { _email: giftRecipientEmail.toLowerCase() },
      );
      const recipientExists = typeof recipientId === "string" && recipientId.length > 0;

      if (!recipientExists) {
        logStep("Gift recipient email not found in system", { giftRecipientEmail });
        throw new Error("Recipient email must be a registered account in the system");
      }
      logStep("Gift recipient validated", { giftRecipientEmail });
    }

    const stripeApiVersion = (Deno.env.get("STRIPE_API_VERSION") || "2025-08-27.basil") as any;
    const stripe = new Stripe(stripeKey, { apiVersion: stripeApiVersion });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // For subscriptions, check if user already has an active one
      if (checkoutMode === "subscription") {
        const existingSubs = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
        });
        if (existingSubs.data.length > 0) {
          logStep("User already has active subscription");
          throw new Error("You already have an active subscription. Manage it from the billing portal.");
        }
      }
    }

    const origin = safeOrigin(req);

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [dynamicLineItem ?? { price: priceId, quantity: 1 }],
      mode: checkoutMode,
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/dashboard?subscription=canceled`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      payment_method_types: ["card"],
      tax_id_collection: { enabled: true },
      customer_update: customerId ? { address: "auto", name: "auto" } : undefined,
    };

    // Add subscription-specific metadata
    if (checkoutMode === "subscription") {
      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
          user_email: user.email,
          is_gift: isGift ? "true" : "false",
          gift_recipient_email: giftRecipientEmail || "",
          gift_duration_months: safeGiftMonths ? String(safeGiftMonths) : "",
          ...pricingAudit,
        },
      };
    } else {
      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          user_email: user.email,
          is_gift: isGift ? "true" : "false",
          gift_recipient_email: giftRecipientEmail || "",
          gift_duration_months: safeGiftMonths ? String(safeGiftMonths) : "",
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return billingError(error, corsHeaders, "CREATE-CHECKOUT");
  }
});
