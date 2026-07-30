import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Pure price-driven settlement. NO AI calls.
// Body: { id: string }
// The settlement price is NEVER taken from the request body — a caller-supplied
// price let anyone force a WIN/LOSS on any open prediction. Spot is fetched
// server-side from CoinGecko so the outcome is anchored to real market data.
const SPOT_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

async function fetchSpot(): Promise<number> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(SPOT_URL, { signal: ctl.signal });
    if (!r.ok) throw new Error(`coingecko ${r.status}`);
    const j = await r.json();
    const p = Number(j?.bitcoin?.usd);
    if (!(p > 0)) throw new Error("coingecko returned no usable price");
    return p;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let price: number;
    try {
      price = await fetchSpot();
    } catch (e) {
      // Never settle on a guess: degrade instead of writing a wrong outcome.
      return new Response(
        JSON.stringify({ ok: false, unchanged: true, error: `spot_unavailable: ${String((e as Error).message)}` }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: row, error: rErr } = await admin
      .from("btc_predictions")
      .select("id, direction, entry_price, stop_loss, take_profit, generated_at, status")
      .eq("id", id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    let newStatus: "WIN" | "LOSS" | null = null;
    let pnl: number | null = null;

    // Target/stop must be evaluated before any entry-window logic.
    // A price at TP/SL necessarily crossed the entry band for the trade direction;
    // checking "entryHit" first falsely ignored valid wins once price moved past TP.
    if (long) {
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
      .from("btc_predictions")
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
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
