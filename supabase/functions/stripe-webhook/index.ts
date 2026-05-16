import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("No signature found");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("FATAL: STRIPE_WEBHOOK_SECRET is not configured — refusing to process webhook");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured. Refusing unverified payloads." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (verifyErr) {
      logStep("Signature verification failed", { error: String(verifyErr) });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout session", { sessionId: session.id });

      const metadata = session.metadata || {};
      const isGift = metadata.is_gift === "true";
      const giftRecipientEmail = metadata.gift_recipient_email;
      const giftDurationMonths = parseInt(metadata.gift_duration_months || "0");
      const buyerUserId = metadata.user_id;

      logStep("Session metadata", { isGift, giftRecipientEmail, giftDurationMonths, buyerUserId });

      // Determine recipient
      let recipientUserId = buyerUserId;
      
      if (isGift && giftRecipientEmail) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const recipient = users?.users?.find((u) => u.email === giftRecipientEmail);
        
        if (!recipient) {
          logStep("ERROR: Gift recipient not found", { giftRecipientEmail });
          return new Response(JSON.stringify({ error: "Recipient not found" }), { status: 400 });
        }
        
        recipientUserId = recipient.id;
        logStep("Gift recipient identified", { recipientUserId });
      }

      // Get product info from session
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      
      if (lineItems.data.length === 0) {
        logStep("ERROR: No line items found");
        return new Response(JSON.stringify({ error: "No line items" }), { status: 400 });
      }

      const price = lineItems.data[0].price;
      const productId = typeof price?.product === 'string' ? price.product : price?.product?.id;
      
      if (!productId) {
        logStep("ERROR: No product ID found");
        return new Response(JSON.stringify({ error: "No product ID" }), { status: 400 });
      }

      logStep("Product identified", { productId });

      // Determine subscription type and expiry
      let subscriptionType = "subscription";
      let expiresAt: string | null = null;

      if (session.mode === "payment") {
        // One-time payment (lifetime or addon)
        subscriptionType = "lifetime";
        expiresAt = null; // Lifetime never expires
      } else if (session.mode === "subscription") {
        // Recurring subscription
        subscriptionType = "subscription";
        
        if (giftDurationMonths > 0) {
          // Gift subscription with fixed duration
          const now = new Date();
          now.setMonth(now.getMonth() + giftDurationMonths);
          expiresAt = now.toISOString();
        } else if (session.subscription) {
          // Regular subscription - get from Stripe
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        }
      }

      logStep("Subscription details", { subscriptionType, expiresAt });

      // Insert into user_subscriptions
      const { error: insertError } = await supabaseAdmin
        .from("user_subscriptions")
        .insert({
          user_id: recipientUserId,
          subscription_type: subscriptionType,
          product_id: productId,
          stripe_subscription_id: session.subscription as string || null,
          stripe_customer_id: session.customer as string,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
          gifted_by_user_id: isGift ? buyerUserId : null,
        });

      if (insertError) {
        logStep("ERROR inserting subscription", { error: insertError });
        throw insertError;
      }

      logStep("Subscription granted successfully", { recipientUserId, productId });

      // If this was a gift, record it
      if (isGift && giftRecipientEmail) {
        const { error: giftError } = await supabaseAdmin
          .from("gift_purchases")
          .update({ status: "fulfilled" })
          .eq("stripe_session_id", session.id);

        if (giftError) {
          logStep("WARNING: Could not update gift_purchases", { error: giftError });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
