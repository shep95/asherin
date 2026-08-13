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

      // ── Asherin Team ────────────────────────────────────────────────────
      // A team purchase does not create a personal `user_subscriptions` row.
      // The workspace container itself is the entitlement: members inherit
      // Pro-class access from `teams.billing_status = 'active'`.
      if ((session.metadata || {}).plan === "team") {
        const teamId = (session.metadata || {}).team_id;
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as any)?.id ?? null;
        let seats: number | null = null;
        if (subId) {
          try {
            const teamSub = await stripe.subscriptions.retrieve(subId);
            const seatItem = teamSub.items.data.find((i) => (i.quantity ?? 1) > 1);
            seats = seatItem?.quantity ?? null;
          } catch (subErr) {
            logStep("WARNING: could not read team subscription items", { error: String(subErr) });
          }
        }
        const { error: teamErr } = await supabaseAdmin
          .from("teams")
          .update({
            billing_status: "active",
            past_due_since: null,
            stripe_subscription_id: subId,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            ...(seats ? { seat_quantity: seats } : {}),
          })
          .eq("id", teamId);
        if (teamErr) logStep("ERROR: team activation failed", { teamId, error: teamErr.message });
        else logStep("Team workspace activated", { teamId, subId, seats });
        return new Response(JSON.stringify({ received: true, team: teamId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

      // P0: Idempotency guard. Stripe retries on 5xx / timeout. Without this,
      // a single payment could insert two active subscriptions.
      const { data: existingRow } = await supabaseAdmin
        .from("user_subscriptions")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();
      if (existingRow) {
        logStep("Duplicate webhook — session already processed", { sessionId: session.id });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
      }

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

      // Insert into user_subscriptions (with stripe_session_id for idempotency)
      const { error: insertError } = await supabaseAdmin
        .from("user_subscriptions")
        .insert({
          user_id: recipientUserId,
          subscription_type: subscriptionType,
          product_id: productId,
          stripe_subscription_id: session.subscription as string || null,
          stripe_customer_id: session.customer as string,
          stripe_session_id: session.id,
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
          gifted_by_user_id: isGift ? buyerUserId : null,
        });

      if (insertError) {
        // 23505 = unique_violation on stripe_session_id — treat as duplicate, ok
        if ((insertError as any).code === "23505") {
          logStep("Idempotent: duplicate insert blocked by unique index");
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
          });
        }
        logStep("ERROR inserting subscription", { error: insertError });
        throw insertError;
      }

      logStep("Subscription granted successfully", { recipientUserId, productId });

      // ── Fire the subscription-welcome email (thank-you + socials) ────────
      try {
        const { data: userRec } = await supabaseAdmin.auth.admin.getUserById(recipientUserId);
        const recipientEmail = userRec?.user?.email;
        if (recipientEmail) {
          const planName = subscriptionType
            ? `Aureon ${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}`
            : "Aureon";
          let daysLeft: number | undefined;
          let renewalDate: string | undefined;
          if (expiresAt) {
            const ms = new Date(expiresAt).getTime() - Date.now();
            daysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
            renewalDate = new Date(expiresAt).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            });
          }
          const { error: mailErr } = await supabaseAdmin.functions.invoke(
            "send-transactional-email",
            {
              body: {
                templateName: "subscription-welcome",
                recipientEmail,
                idempotencyKey: `sub-welcome-${session.id}`,
                templateData: {
                  name: (userRec?.user?.user_metadata as any)?.full_name || null,
                  planName,
                  daysLeft,
                  renewalDate,
                },
              },
            },
          );
          if (mailErr) logStep("WARNING: subscription-welcome email failed", { error: mailErr });
          else logStep("Subscription welcome email enqueued", { recipientEmail });
        }
      } catch (mailErr) {
        logStep("WARNING: subscription-welcome email threw", { error: String(mailErr) });
      }

      // P0: Plugin fulfillment — if session metadata has plugin_id, install it.
      const pluginIdMeta = (session.metadata as any)?.plugin_id;
      if (pluginIdMeta && recipientUserId) {
        const { error: pluginErr } = await supabaseAdmin
          .from("installed_plugins")
          .upsert(
            { user_id: recipientUserId, plugin_id: pluginIdMeta, config: {} },
            { onConflict: "user_id,plugin_id", ignoreDuplicates: true },
          );
        if (pluginErr) logStep("WARNING: plugin install failed", { error: pluginErr });
        else logStep("Plugin installed via webhook", { pluginIdMeta });
      }

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

    // Handle subscription cancellation — keep DB in sync with Stripe.
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if ((sub.metadata || {}).plan === "team") {
        // Never destroy the workspace on Stripe's word alone — deletion is an
        // owner action. Freezing drops inherited Pro; personal data is untouched.
        await supabaseAdmin.from("teams")
          .update({ billing_status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        logStep("Team subscription canceled — workspace frozen", { stripeSubId: sub.id });
      }
      const { error: cancelErr } = await supabaseAdmin
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("stripe_subscription_id", sub.id);
      if (cancelErr) logStep("WARNING: could not mark subscription cancelled", { error: cancelErr });
      else logStep("Subscription marked cancelled", { stripeSubId: sub.id });
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      if ((sub.metadata || {}).plan === "team") {
        const seatItem = sub.items.data.find((i) => (i.quantity ?? 1) > 1);
        // past_due keeps members working through the 3-day grace window; the
        // grace clock is the timestamp below, read by check-subscription.
        const nextStatus =
          sub.status === "active" ? "active"
          : sub.status === "past_due" || sub.status === "unpaid" ? "past_due"
          : sub.status === "canceled" ? "canceled"
          : "pending";
        const { data: current } = await supabaseAdmin
          .from("teams").select("past_due_since").eq("stripe_subscription_id", sub.id).maybeSingle();
        await supabaseAdmin.from("teams").update({
          billing_status: nextStatus,
          past_due_since: nextStatus === "past_due"
            ? (current?.past_due_since ?? new Date().toISOString())
            : null,
          ...(seatItem?.quantity ? { seat_quantity: seatItem.quantity } : {}),
        }).eq("stripe_subscription_id", sub.id);
        logStep("Team billing synced", { stripeSubId: sub.id, nextStatus, seats: seatItem?.quantity });
      }
      if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "past_due") {
        await supabaseAdmin
          .from("user_subscriptions")
          .update({ status: sub.status })
          .eq("stripe_subscription_id", sub.id);
        logStep("Subscription status synced", { stripeSubId: sub.id, status: sub.status });
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
