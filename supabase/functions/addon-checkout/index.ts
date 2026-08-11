import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { BillingAuthError, BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";

// Server-authoritative addon catalog. Client sends addonId; price is resolved
// here. Populate with real Stripe price IDs as addons are launched.
// Until populated, ALL addon purchases are rejected — preventing $0.01 attacks.
const ADDON_CATALOG: Record<string, { stripePriceId: string; name: string }> = {
  // "addon_dark_web_monitor": { stripePriceId: "price_XXXX", name: "Dark Web Monitor" },
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const user = await requireBillingUser(req, (t) => supabaseClient.auth.getUser(t) as any);

    const { addonId } = await req.json();
    if (!addonId) throw new Error("Missing addonId");

    const catalogEntry = ADDON_CATALOG[addonId];
    if (!catalogEntry) {
      return new Response(JSON.stringify({ error: "Unknown or unavailable addon" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : ALLOWED_ORIGINS[0];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: catalogEntry.stripePriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?addon_installed=${addonId}`,
      cancel_url: `${origin}/dashboard?addon_cancelled=${addonId}`,
      metadata: { addon_id: addonId, user_id: user.id },
      subscription_data: {
        metadata: { addon_id: addonId, user_id: user.id, user_email: user.email },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return billingError(error, corsHeaders, "ADDON-CHECKOUT");
  }
});
