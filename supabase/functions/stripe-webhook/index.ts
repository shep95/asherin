import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Webhook is server-to-server (Stripe → us). CORS is irrelevant for the
  // actual POST (no browser), but keep correct headers for the OPTIONS
  // preflight Stripe may send and so that any dashboard tooling works.
  const corsHeaders = getCorsHeaders(req);
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
        // FIX (H-06): direct lookup instead of paginate-and-scan listUsers().
        // listUsers() defaulted to a 1000-user page and silently broke at scale.
        // Try profiles table first (cheap), fall back to admin listUsers with
        // an explicit filter as a safety net.
        let recipientId: string | null = null;
        const { data: profileMatch } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", giftRecipientEmail)
          .maybeSingle();
        if (profileMatch?.user_id) {
          recipientId = profileMatch.user_id as string;
        } else {
          // Fallback: paginate-aware admin lookup (cheap because filter is server-side)
          const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
            // @ts-ignore - filter is supported by the admin API even if not in older types
            filter: `email.eq.${giftRecipientEmail}`,
          } as any);
          recipientId = usersPage?.users?.find((u: any) => (u.email || "").toLowerCase() === giftRecipientEmail.toLowerCase())?.id ?? null;
        }

        if (!recipientId) {
          logStep("ERROR: Gift recipient not found", { giftRecipientEmail });
          return new Response(JSON.stringify({ error: "Recipient not found" }), { status: 400 });
        }

        recipientUserId = recipientId;
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

    // ── Invoice paid → send receipt email with download link ───────────
    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
      const inv = event.data.object as Stripe.Invoice;
      const recipient = inv.customer_email
        || (inv.customer ? (await stripe.customers.retrieve(inv.customer as string) as any)?.email : null);

      if (recipient) {
        const planName = inv.lines?.data?.[0]?.description
          || (inv.lines?.data?.[0] as any)?.price?.nickname
          || "Aureon";
        const amount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: (inv.currency || "usd").toUpperCase(),
        }).format((inv.amount_paid || 0) / 100);

        const templateData: Record<string, any> = {
          planName,
          amount,
          invoiceNumber: inv.number || inv.id,
          paidAt: new Date((inv.status_transitions?.paid_at || inv.created) * 1000)
            .toISOString().slice(0, 10),
          receiptUrl: inv.hosted_invoice_url || undefined,
          invoicePdfUrl: inv.invoice_pdf || undefined,
        };
        if ((inv as any).next_payment_attempt) {
          templateData.nextBillingDate = new Date((inv as any).next_payment_attempt * 1000)
            .toISOString().slice(0, 10);
        }

        try {
          await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "invoice-receipt",
              recipientEmail: recipient,
              idempotencyKey: `invoice-receipt-${inv.id}`,
              templateData,
            },
          });
          logStep("Receipt email enqueued", { invoice: inv.id, recipient });
        } catch (mailErr) {
          logStep("WARNING: receipt email failed", { error: String(mailErr) });
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
