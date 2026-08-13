import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin, authErrorResponse } from "../_shared/authMiddleware.ts";

import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await requireAdmin(req);
    } catch (e) {
      return authErrorResponse(e, corsHeaders);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const now = Math.floor(Date.now() / 1000);
    const buckets = { "3d": 3, "7d": 7, "30d": 30, "90d": 90 } as const;
    const result: Record<string, { gross: number; net: number; refunds: number; count: number }> = {
      "3d": { gross: 0, net: 0, refunds: 0, count: 0 },
      "7d": { gross: 0, net: 0, refunds: 0, count: 0 },
      "30d": { gross: 0, net: 0, refunds: 0, count: 0 },
      "90d": { gross: 0, net: 0, refunds: 0, count: 0 },
      lifetime: { gross: 0, net: 0, refunds: 0, count: 0 },
    };
    const productRevenue: Record<string, number> = {};
    const sources: Record<string, number> = {};

    // Pull successful charges (paginate)
    let starting_after: string | undefined;
    let safety = 0;
    while (safety < 40) {
      const charges: any = await stripe.charges.list({ limit: 100, ...(starting_after && { starting_after }) });
      for (const ch of charges.data) {
        if (ch.status !== "succeeded" || !ch.paid) continue;
        const amount = ch.amount / 100;
        const refunded = (ch.amount_refunded || 0) / 100;
        const net = amount - refunded;
        result.lifetime.gross += amount;
        result.lifetime.net += net;
        result.lifetime.refunds += refunded;
        result.lifetime.count += 1;

        const ageDays = (now - ch.created) / 86400;
        for (const [k, days] of Object.entries(buckets)) {
          if (ageDays <= days) {
            result[k].gross += amount;
            result[k].net += net;
            result[k].refunds += refunded;
            result[k].count += 1;
          }
        }

        // Source tracking from metadata or referer
        const src =
          ch.metadata?.utm_source ||
          ch.metadata?.source ||
          ch.metadata?.referrer ||
          (ch.payment_method_details?.card?.wallet?.type ? `wallet:${ch.payment_method_details.card.wallet.type}` : null) ||
          "direct";
        sources[src] = (sources[src] || 0) + amount;
      }
      if (!charges.has_more) break;
      starting_after = charges.data[charges.data.length - 1]?.id;
      safety++;
    }

    // Active subscription product breakdown
    let sub_after: string | undefined;
    safety = 0;
    while (safety < 20) {
      const subs: any = await stripe.subscriptions.list({ status: "active", limit: 100, ...(sub_after && { starting_after: sub_after }) });
      for (const s of subs.data) {
        for (const it of s.items.data) {
          const prod = (it.price?.product as string) || "unknown";
          const amt = (it.price?.unit_amount || 0) / 100;
          productRevenue[prod] = (productRevenue[prod] || 0) + amt;
        }
      }
      if (!subs.has_more) break;
      sub_after = subs.data[subs.data.length - 1]?.id;
      safety++;
    }

    // Resolve product names
    const productNames: Record<string, string> = {};
    for (const id of Object.keys(productRevenue)) {
      try {
        const p: any = await stripe.products.retrieve(id);
        productNames[id] = p.name || id;
      } catch { productNames[id] = id; }
    }

    return new Response(JSON.stringify({
      revenue: result,
      productMRR: Object.entries(productRevenue).map(([id, amt]) => ({
        product: productNames[id] || id, mrr: amt,
      })).sort((a, b) => b.mrr - a.mrr),
      sources: Object.entries(sources).map(([source, amount]) => ({ source, amount })).sort((a, b) => b.amount - a.amount),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-revenue error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
