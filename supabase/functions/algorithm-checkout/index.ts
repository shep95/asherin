// Creates a Stripe Checkout session for the $10/mo Aureon Algorithm Access subscription.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { BillingAuthError, BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";

const ALGORITHM_PRICE_ID = "price_1TfC3oRxgCpmPfiFniV2cXAu";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new BillingConfigError();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const user = await requireBillingUser(req, (t) => supabase.auth.getUser(t) as any);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    const customerId = customers.data[0]?.id;

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://aureonai.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [{ price: ALGORITHM_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/zophiel?upgraded=1`,
      cancel_url: `${origin}/zophiel?cancelled=1`,
      allow_promotion_codes: true,
      // P0: embed user_id so webhook can grant the subscription. Without
      // this metadata, paid subscriptions were dropped on the floor.
      subscription_data: {
        metadata: {
          user_id: user.id,
          user_email: user.email!,
          is_gift: "false",
          gift_recipient_email: "",
          gift_duration_months: "0",
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return billingError(e, corsHeaders, "ALGORITHM-CHECKOUT");
  }
});
