import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const authUrl = `${Deno.env.get("SUPABASE_URL") ?? ""}/auth/v1/user`;
    const userResp = await fetch(authUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      },
    });
    const userPayload = await userResp.json().catch(() => null);
    if (!userResp.ok) {
      logStep("Auth rejected", { status: userResp.status });
      // CWE-209: do not relay upstream auth provider detail.
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const userData = { user: userPayload };
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    // Check user_subscriptions table first (includes gifts, addons, lifetime)
    const { data: userSubs } = await supabaseClient
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (userSubs && userSubs.length > 0) {
      const activeSub = userSubs[0];
      logStep("Found active user subscription", { 
        product_id: activeSub.product_id, 
        type: activeSub.subscription_type,
        gifted: !!activeSub.gifted_by_user_id 
      });
      
      return new Response(JSON.stringify({
        subscribed: true,
        product_id: activeSub.product_id,
        price_id: null,
        subscription_end: activeSub.expires_at || null,
        status: activeSub.status,
        cancel_at_period_end: false,
        subscription_type: activeSub.subscription_type,
        addons: userSubs.filter(s => s.subscription_type === "addon").map(s => s.product_id),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check granted_subscriptions table (free/manual grants)
    const { data: grantedRows } = await supabaseClient
      .from("granted_subscriptions")
      .select("*")
      .eq("email", user.email)
      .eq("active", true)
      .order("granted_at", { ascending: false })
      .limit(1);
    const granted = grantedRows && grantedRows.length > 0 ? grantedRows[0] : null;

    if (granted) {
      logStep("Found granted subscription", { tier: granted.tier, product_id: granted.product_id });
      return new Response(JSON.stringify({
        subscribed: true,
        product_id: granted.product_id,
        price_id: null,
        subscription_end: granted.expires_at || null,
        status: "active",
        cancel_at_period_end: false,
        granted: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

    // Check for active, trialing, OR past_due subscriptions
    const activeSub = subscriptions.data.find(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"
    );

    if (!activeSub) {
      // Check for one-time lifetime purchase
      const LIFETIME_PRODUCT_ID = "prod_U74tK6VXkH6S5Z";
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
      });
      const lifetimePurchase = sessions.data.find(
        (s) => s.payment_status === "paid" && s.mode === "payment"
      );
      if (lifetimePurchase) {
        // Verify it was the lifetime product by checking line items
        const lineItems = await stripe.checkout.sessions.listLineItems(lifetimePurchase.id, { limit: 5 });
        const hasLifetime = lineItems.data.some((li) => {
          const priceProduct = (li.price as any)?.product;
          return priceProduct === LIFETIME_PRODUCT_ID;
        });
        if (hasLifetime) {
          logStep("Lifetime purchase found", { sessionId: lifetimePurchase.id });
          return new Response(JSON.stringify({
            subscribed: true,
            product_id: LIFETIME_PRODUCT_ID,
            price_id: null,
            subscription_end: null,
            status: "lifetime",
            cancel_at_period_end: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      logStep("No active/trialing subscription found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
    const productId = activeSub.items.data[0].price.product;
    const priceId = activeSub.items.data[0].price.id;
    const status = activeSub.status;
    const cancelAtPeriodEnd = activeSub.cancel_at_period_end;

    logStep("Active subscription found", { productId, priceId, status, subscriptionEnd, cancelAtPeriodEnd });

    return new Response(JSON.stringify({
      subscribed: true,
      product_id: productId,
      price_id: priceId,
      subscription_end: subscriptionEnd,
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // CWE-209: never echo upstream/auth error text to the caller.
    return new Response(JSON.stringify({ error: "Subscription check unavailable." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
