import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";
import { BillingAuthError, BillingConfigError, billingError, requireBillingUser } from "../_shared/billingHttp.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const user = await requireBillingUser(req, (t) => supabaseClient.auth.getUser(t) as any);

    const { pluginId } = await req.json();
    if (!pluginId) throw new Error("Missing pluginId");

    // P0: Server-authoritative price + plugin lookup. Reject the client's
    // priceCents / pluginName entirely — they were trusted before, enabling
    // a $0.01 plugin purchase by any authenticated user.
    const { data: pluginRow, error: pluginErr } = await supabaseAdmin
      .from("plugins")
      .select("id, name, price_cents, is_premium")
      .eq("id", pluginId)
      .maybeSingle();
    if (pluginErr || !pluginRow) {
      return new Response(JSON.stringify({ error: "Plugin not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }
    const pluginName = pluginRow.name as string;
    const priceCents = pluginRow.price_cents as number;
    if (!pluginRow.is_premium || !priceCents || priceCents < 100) {
      return new Response(JSON.stringify({ error: "Plugin not purchasable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // ── Idempotency: Check if user already owns this plugin ──
    const { data: existingInstall } = await supabaseAdmin
      .from("installed_plugins")
      .select("id")
      .eq("user_id", user.id)
      .eq("plugin_id", pluginId)
      .maybeSingle();

    if (existingInstall) {
      return new Response(JSON.stringify({ error: "Plugin already owned", alreadyOwned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or skip existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : ALLOWED_ORIGINS[0];

    // ── Idempotency: Check for existing pending Stripe session via client_reference_id ──
    const clientRefId = `${user.id}_plugin_${pluginId}`;
    const recentSessions = await stripe.checkout.sessions.list({
      limit: 5,
      ...(customerId ? { customer: customerId } : {}),
    });

    const pendingSession = recentSessions.data.find(
      (s) => s.client_reference_id === clientRefId && s.status === "open"
    );

    if (pendingSession?.url) {
      // Reuse existing open session instead of creating a duplicate
      return new Response(JSON.stringify({ url: pendingSession.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create a subscription checkout for the plugin
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: clientRefId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: {
              name: `Aureon Plugin: ${pluginName}`,
              description: `Monthly subscription for the ${pluginName} plugin`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?plugin_installed=${pluginId}`,
      cancel_url: `${origin}/dashboard?plugin_cancelled=${pluginId}`,
      metadata: {
        plugin_id: pluginId,
        user_id: user.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return billingError(error, corsHeaders, "PLUGIN-CHECKOUT");
  }
});
