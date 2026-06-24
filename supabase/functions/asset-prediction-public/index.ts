// asset-prediction-public — Public read endpoint for the multi-asset blog pages.
// Query: ?asset=ETH|CRUDE|SPX|NDX
// Returns { latest, history (last 60 for the asset), stats }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED = new Set(["ETH", "CRUDE", "SPX", "NDX"]);

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = new URL(req.url);
    const asset = (url.searchParams.get("asset") || "").toUpperCase();
    if (!ALLOWED.has(asset)) {
      return new Response(JSON.stringify({ error: "unknown_asset" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: rows, error } = await supabase
      .from("asset_predictions")
      .select("*")
      .eq("asset", asset)
      .order("prediction_date", { ascending: false })
      .limit(60);

    if (error) throw error;

    const list = rows ?? [];
    const settled = list.filter((r) => r.status === "WIN" || r.status === "LOSS");
    const wins = settled.filter((r) => r.status === "WIN").length;
    const losses = settled.filter((r) => r.status === "LOSS").length;
    const open = list.filter((r) => r.status === "OPEN").length;
    const winRate = settled.length ? (wins / settled.length) * 100 : 0;
    const totalPnl = settled.reduce((s, r) => s + Number(r.pnl_pct ?? 0), 0);

    return new Response(
      JSON.stringify({
        asset,
        latest: list[0] ?? null,
        history: list,
        stats: {
          wins,
          losses,
          open,
          settled: settled.length,
          winRate: Number(winRate.toFixed(2)),
          totalPnl: Number(totalPnl.toFixed(2)),
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
