// asset-settle — Pure price-driven settlement of a single asset_predictions row.
// Body: { id: string, price: number }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { id, price } = await req.json();
    if (!id || typeof price !== "number" || !(price > 0)) {
      return new Response(JSON.stringify({ error: "id and positive price required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: row, error: rErr } = await admin
      .from("asset_predictions")
      .select("id, asset, direction, entry_price, stop_loss, take_profit, generated_at, status")
      .eq("id", id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.status !== "OPEN") {
      return new Response(JSON.stringify({ ok: true, unchanged: true, row }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entry = Number(row.entry_price);
    const tp = Number(row.take_profit);
    const sl = Number(row.stop_loss);
    const ageMs = Date.now() - new Date(row.generated_at).getTime();
    const long = row.direction === "LONG";

    let newStatus: "WIN" | "LOSS" | "CANCELLED" | null = null;
    let pnl: number | null = null;

    const entryHit = long ? price <= entry : price >= entry;
    if (!entryHit && ageMs > 30 * 60_000) {
      newStatus = "CANCELLED";
      pnl = 0;
    } else if (long) {
      if (price >= tp) { newStatus = "WIN"; pnl = ((tp - entry) / entry) * 100; }
      else if (price <= sl) { newStatus = "LOSS"; pnl = ((sl - entry) / entry) * 100; }
    } else {
      if (price <= tp) { newStatus = "WIN"; pnl = ((entry - tp) / entry) * 100; }
      else if (price >= sl) { newStatus = "LOSS"; pnl = ((entry - sl) / entry) * 100; }
    }

    if (!newStatus) {
      return new Response(JSON.stringify({ ok: true, unchanged: true, price }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: uErr } = await admin
      .from("asset_predictions")
      .update({
        status: newStatus,
        settle_price: price,
        settled_at: new Date().toISOString(),
        pnl_pct: pnl == null ? null : Number(pnl.toFixed(4)),
      })
      .eq("id", id)
      .eq("status", "OPEN")
      .select()
      .maybeSingle();
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ ok: true, settled: true, row: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
