// btc-prediction-public — Public read endpoint for the blog page.
// Returns: { latest, history (last 60), stats {wins, losses, open, winRate, totalPnl} }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: rows, error } = await supabase
      .from("btc_predictions")
      .select("*")
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
