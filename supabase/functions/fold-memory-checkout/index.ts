// fold-memory-checkout — guest-capable one-time $99 checkout for asher.fold-memory.
//
// No sign-in required: the buyer's email is collected by Stripe Checkout itself.
// The price is resolved server-side from a constant, so the client can never
// choose the amount. If a caller happens to send a valid Authorization header,
// the session is attached to that user's existing Stripe customer instead of
// creating a duplicate.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";

// Server-authoritative. asher.fold-memory — $99.00 USD, one-time.
const FOLD_MEMORY_PRICE_ID = "price_1U4wxhRxgCpmPfiFzF56mzK1";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[FOLD-MEMORY-CHECKOUT] STRIPE_SECRET_KEY missing");
      return new Response(JSON.stringify({ error: "Checkout is not configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional identity. A guest buyer is fully supported — Stripe collects
    // the email on the hosted page.
    let email: string | undefined;
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        );
        const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (data?.user?.email) { email = data.user.email; userId = data.user.id; }
      } catch (_) {
        // anonymous purchase — not an error path
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data[0]?.id;
    }

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : ALLOWED_ORIGINS[0];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: FOLD_MEMORY_PRICE_ID, quantity: 1 }],
      mode: "payment",
      allow_promotion_codes: true,
      billing_address_collection: "required",
      success_url: `${origin}/blog/asher-fold-memory?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/blog/asher-fold-memory?purchase=cancelled`,
      payment_intent_data: {
        metadata: {
          product: "asher.fold-memory",
          user_id: userId ?? "guest",
        },
      },
      metadata: { product: "asher.fold-memory", user_id: userId ?? "guest" },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[FOLD-MEMORY-CHECKOUT] error:", msg);
    return new Response(JSON.stringify({ error: "Could not start checkout." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
