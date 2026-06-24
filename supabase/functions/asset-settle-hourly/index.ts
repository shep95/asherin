// asset-settle-hourly — Scheduled by pg_cron. Iterates every OPEN
// asset_predictions row, fetches a fresh spot price for its asset, and
// settles WIN/LOSS/CANCELLED/EXPIRED off live price (never 24h high/low).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isMarketOpen } from "../_shared/marketHours.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[asset-settle-hourly] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

type AssetKey = "ETH" | "CRUDE" | "SPX" | "NDX";

const YAHOO_SYMBOL: Record<AssetKey, string> = {
  ETH: "ETH-USD",
  CRUDE: "CL=F",
  SPX: "^GSPC",
  NDX: "^NDX",
};

async function spot(asset: AssetKey): Promise<number> {
  if (asset === "ETH") {
    try {
      const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
      if (r.ok) {
        const j = await r.json();
        const p = Number(j?.data?.amount);
        if (p > 0) return p;
      }
    } catch { /* fall through */ }
  }
  const sym = YAHOO_SYMBOL[asset];
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
    { headers: { "user-agent": "Mozilla/5.0 (aureon-axrlen/1.0)" } },
  );
  if (!r.ok) throw new Error(`Yahoo ${sym} ${r.status}`);
  const j = await r.json();
  const p = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (!(p > 0)) throw new Error(`Yahoo ${sym} no price`);
  return p;
}

function evaluate(row: any, price: number, now = Date.now()) {
  const entry = Number(row.entry_price);
  const sl = Number(row.stop_loss);
  const tp = Number(row.take_profit);
  const generated = Date.parse(row.generated_at);
  const ageMs = now - generated;
  const horizonMs = Number(row.horizon_hours || 24) * 3600_000;
  const long = row.direction === "LONG";

  const entryHit = long ? price <= entry : price >= entry;
  if (!entryHit && ageMs > 30 * 60_000) {
    return { status: "CANCELLED" as const, settle_price: null as number | null, pnl_pct: 0 };
  }
  if (long) {
    if (price >= tp) return { status: "WIN" as const,  settle_price: tp, pnl_pct: ((tp - entry) / entry) * 100 };
    if (price <= sl) return { status: "LOSS" as const, settle_price: sl, pnl_pct: ((sl - entry) / entry) * 100 };
  } else {
    if (price <= tp) return { status: "WIN" as const,  settle_price: tp, pnl_pct: ((entry - tp) / entry) * 100 };
    if (price >= sl) return { status: "LOSS" as const, settle_price: sl, pnl_pct: ((entry - sl) / entry) * 100 };
  }
  if (ageMs > horizonMs) {
    return { status: "EXPIRED" as const, settle_price: price, pnl_pct: null as number | null };
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

    const { data: openRows } = await supabase
      .from("asset_predictions")
      .select("*")
      .eq("status", "OPEN");

    const priceCache = new Map<AssetKey, number>();
    const settled: unknown[] = [];
    const now = Date.now();

    const skipped: unknown[] = [];
    for (const row of (openRows ?? []) as any[]) {
      const asset = row.asset as AssetKey;
      // Skip closed markets — stale spot prices would falsely trip SL/TP and waste API calls.
      if (!isMarketOpen(asset)) { skipped.push({ id: row.id, asset, reason: "market_closed" }); continue; }
      let p = priceCache.get(asset);
      if (p == null) {
        try { p = await spot(asset); priceCache.set(asset, p); }
        catch (e) { log("spot fail", { asset, e: String((e as Error).message) }); continue; }
      }
      const v = evaluate(row, p, now);
      if (!v) continue;
      await supabase.from("asset_predictions").update({
        status: v.status,
        settled_at: new Date().toISOString(),
        settle_price: v.settle_price == null ? null : Number(v.settle_price.toFixed(4)),
        pnl_pct: v.pnl_pct == null ? null : Number(v.pnl_pct.toFixed(3)),
      }).eq("id", row.id);
      settled.push({ id: row.id, asset, status: v.status, pnl_pct: v.pnl_pct });
    }

    log("Done", { settled: settled.length });
    return new Response(JSON.stringify({ ok: true, settled }), {
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
