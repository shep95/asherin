// btc-settle-hourly — Scheduled by pg_cron.
// Fetches current BTC spot from CoinGecko and settles OPEN btc_predictions only
// from live spot after the prediction was created. It deliberately does NOT use
// CoinGecko 24h high/low because those values include price action from before
// the AXRLEN call and can falsely mark a fresh trade as stopped out.
// Horizon rule: if TP/SL never hits by the prediction horizon, expire it.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[btc-settle-hourly] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

interface Live { price: number; }

async function fetchLive(): Promise<Live> {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false",
    { headers: { "User-Agent": "Aureon-AXRLEN/1.0" } },
  );
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  return {
    price: j.market_data.current_price.usd,
  };
}

function evaluate(row: {
  direction: string; entry_price: number; stop_loss: number; take_profit: number; generated_at: string; horizon_hours?: number;
}, live: Live, now = Date.now()): { hit: boolean; status: "WIN" | "LOSS" | "EXPIRED"; settle_price: number | null; pnl_pct: number | null } | null {
  const entry = Number(row.entry_price);
  const sl = Number(row.stop_loss);
  const tp = Number(row.take_profit);
  const price = Number(live.price);
  const generated = Date.parse(row.generated_at);
  const ageMs = now - generated;
  const horizonMs = Number(row.horizon_hours || 24) * 3600_000;
  const long = row.direction === "LONG";

  // Target/stop must be evaluated directly from live price. If price is already
  // beyond TP or SL, the trade crossed the entry band and must settle.
  if (long) {
    if (price >= tp) return { hit: true, status: "WIN", settle_price: tp, pnl_pct: ((tp - entry) / entry) * 100 };
    if (price <= sl) return { hit: true, status: "LOSS", settle_price: sl, pnl_pct: ((sl - entry) / entry) * 100 };
  } else {
    if (price <= tp) return { hit: true, status: "WIN", settle_price: tp, pnl_pct: ((entry - tp) / entry) * 100 };
    if (price >= sl) return { hit: true, status: "LOSS", settle_price: sl, pnl_pct: ((entry - sl) / entry) * 100 };
  }

  if (ageMs > horizonMs) {
    return { hit: true, status: "EXPIRED", settle_price: price, pnl_pct: null };
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
          settle_price: v.settle_price == null ? null : Number(v.settle_price.toFixed(2)),
          pnl_pct: v.pnl_pct == null ? null : Number(v.pnl_pct.toFixed(3)),
        }).eq("id", r.id);
        settled.push({ id: r.id, status: v.status, pnl_pct: v.pnl_pct });
        continue;
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
