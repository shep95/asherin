import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
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
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const { priceId, mode, isGift, giftRecipientEmail, giftDurationMonths } = await req.json();
    if (!priceId) throw new Error("Missing priceId");
    const checkoutMode = mode === "payment" ? "payment" : "subscription";
    logStep("Price requested", { priceId, checkoutMode, isGift, giftRecipientEmail, giftDurationMonths });

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

    const origin = req.headers.get("origin") || "https://id-preview--5d5e1e10-9f71-4760-8dad-575a93313745.lovable.app";

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
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
          gift_duration_months: giftDurationMonths?.toString() || "",
        },
      };
    } else {
      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          user_email: user.email,
          is_gift: isGift ? "true" : "false",
          gift_recipient_email: giftRecipientEmail || "",
          gift_duration_months: giftDurationMonths?.toString() || "",
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
