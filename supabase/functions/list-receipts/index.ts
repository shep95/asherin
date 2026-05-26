// List Stripe invoices/receipts for the authenticated user.
// Returns hosted_invoice_url + invoice_pdf so the UI can render a download list.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) =>
  console.log(`[LIST-RECEIPTS] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find all Stripe customers for this email (Stripe allows duplicates)
    const customers = await stripe.customers.list({ email: user.email, limit: 5 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ receipts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fetch invoices for every matched customer (most users have 1)
    const all: any[] = [];
    for (const c of customers.data) {
      const invoices = await stripe.invoices.list({ customer: c.id, limit: 50 });
      for (const inv of invoices.data) {
        all.push({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount_paid: inv.amount_paid,
          amount_due: inv.amount_due,
          currency: inv.currency,
          created: inv.created,
          period_start: inv.period_start,
          period_end: inv.period_end,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
          description:
            inv.lines?.data?.[0]?.description ??
            (inv.lines?.data?.[0] as any)?.price?.nickname ??
            null,
        });
      }
    }

    all.sort((a, b) => b.created - a.created);
    log("Returned receipts", { count: all.length });

    return new Response(JSON.stringify({ receipts: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message, receipts: [] }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
