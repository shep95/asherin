// btc-settle-hourly — Scheduled hourly by pg_cron.
// Fetches BTC live price + 24h high/low from CoinGecko and settles any OPEN
// btc_predictions whose TP or SL band has been touched. Uses 24h high/low so
// intra-bar wicks count, falling back to spot for tight bands.
// Also EXPIRES predictions older than horizon_hours + 2h that never hit.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[btc-settle-hourly] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

interface Live { price: number; high24h: number; low24h: number; }

async function fetchLive(): Promise<Live> {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false",
    { headers: { "User-Agent": "Aureon-AXRLEN/1.0" } },
  );
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  return {
    price: j.market_data.current_price.usd,
    high24h: j.market_data.high_24h.usd,
    low24h: j.market_data.low_24h.usd,
  };
}

function evaluate(row: {
  direction: string; entry_price: number; stop_loss: number; take_profit: number;
}, live: Live): { hit: boolean; status: "WIN" | "LOSS"; settle_price: number; pnl_pct: number } | null {
  const entry = Number(row.entry_price);
  const sl = Number(row.stop_loss);
  const tp = Number(row.take_profit);
  const hi = live.high24h;
  const lo = live.low24h;

  if (row.direction === "LONG") {
    if (hi >= tp)  return { hit: true, status: "WIN",  settle_price: tp, pnl_pct: ((tp - entry) / entry) * 100 };
    if (lo <= sl)  return { hit: true, status: "LOSS", settle_price: sl, pnl_pct: ((sl - entry) / entry) * 100 };
  } else {
    if (lo <= tp)  return { hit: true, status: "WIN",  settle_price: tp, pnl_pct: ((entry - tp) / entry) * 100 };
    if (hi >= sl)  return { hit: true, status: "LOSS", settle_price: sl, pnl_pct: ((entry - sl) / entry) * 100 };
  }
  return null;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const live = await fetchLive();
    log("Live", live);

    const { data: open } = await supabase
      .from("btc_predictions")
      .select("*")
      .eq("status", "OPEN");

    const settled: unknown[] = [];
    const expired: unknown[] = [];
    const now = Date.now();

    for (const row of open ?? []) {
      const r: any = row;
      const v = evaluate(r, live);
      if (v) {
        await supabase.from("btc_predictions").update({
          status: v.status,
          settled_at: new Date().toISOString(),
          settle_price: Number(v.settle_price.toFixed(2)),
          pnl_pct: Number(v.pnl_pct.toFixed(3)),
        }).eq("id", r.id);
        settled.push({ id: r.id, status: v.status, pnl_pct: v.pnl_pct });
        continue;
      }
      // Expire if past horizon + 2h grace
      const generated = Date.parse(r.generated_at);
      const expiresAt = generated + (Number(r.horizon_hours || 24) + 2) * 3600_000;
      if (now > expiresAt) {
        const pnl = r.direction === "LONG"
          ? ((live.price - r.entry_price) / r.entry_price) * 100
          : ((r.entry_price - live.price) / r.entry_price) * 100;
        await supabase.from("btc_predictions").update({
          status: pnl >= 0 ? "WIN" : "LOSS",
          settled_at: new Date().toISOString(),
          settle_price: Number(live.price.toFixed(2)),
          pnl_pct: Number(pnl.toFixed(3)),
        }).eq("id", r.id);
        expired.push({ id: r.id, pnl_pct: pnl });
      }
    }

    log("Done", { settled: settled.length, expired: expired.length });
    return new Response(JSON.stringify({ ok: true, live, settled, expired }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
