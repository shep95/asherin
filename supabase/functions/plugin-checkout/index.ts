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

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { pluginId, pluginName, priceCents } = await req.json();
    if (!pluginId || !pluginName || !priceCents) {
      throw new Error("Missing plugin details");
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

    const origin = req.headers.get("origin") || "https://ziali-magic-pixels.lovable.app";

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
    console.error("plugin-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
