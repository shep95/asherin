import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { statusForError } from "../_shared/errorStatus.ts";

// Server-authoritative allowlist of gift-able addon Stripe product IDs.
// Empty by default = no gifts can be created until product IDs are added.
const GIFTABLE_ADDON_PRODUCTS = new Set<string>([
  // "prod_XXXX_darkweb",
]);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GIFT-ADDON] ${step}${detailsStr}`);
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
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const { addonProductId, recipientEmail } = await req.json();
    if (!addonProductId) throw new Error("Missing addonProductId");
    if (!recipientEmail) throw new Error("Missing recipientEmail");

    logStep("Addon gift requested", { addonProductId, recipientEmail });

    // P0: reject unknown addon products. Without this, any Stripe product in
    // the account (including $0.01 test products) could be gifted.
    if (!GIFTABLE_ADDON_PRODUCTS.has(addonProductId)) {
      return new Response(JSON.stringify({ error: "Invalid addon product" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // Validate recipient via O(1) RPC (listUsers() silently truncates at 1000).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: recipientId } = await (supabaseAdmin as any).rpc(
      "get_user_id_by_email",
      { _email: recipientEmail.toLowerCase() },
    );
    const recipientExists = typeof recipientId === "string" && recipientId.length > 0;

    if (!recipientExists) {
      logStep("Recipient email not found", { recipientEmail });
      throw new Error("Recipient email must be a registered account");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get addon price from product (whitelisted above)
    const prices = await stripe.prices.list({ product: addonProductId, limit: 1, active: true });
    if (prices.data.length === 0) {
      throw new Error("No active price found for addon product");
    }

    const priceId = prices.data[0].id;
    logStep("Addon price found", { priceId });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : ALLOWED_ORIGINS[0];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/dashboard?gift=success`,
      cancel_url: `${origin}/dashboard?gift=canceled`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
        is_gift: "true",
        gift_recipient_email: recipientEmail,
        gift_duration_months: "0", // Addons are permanent
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusForError(error),
    });
  }
});
