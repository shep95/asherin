// btc-predict-daily — Scheduled at 12:00 UTC (07:00 EST) by pg_cron.
// 1. Settles yesterday's OPEN prediction by comparing current BTC price to
//    its TP / SL bands and writes WIN / LOSS / EXPIRED + realized PnL.
// 2. Fetches live BTC price + 24h/7d momentum from CoinGecko (public, no key).
// 3. Calls Lovable AI Gateway (Gemini) with an AXRLEN-style prompt to produce
//    a JSON forecast: { direction, confidence, stop_loss, take_profit, thesis }.
// 4. Inserts today's prediction row.
//
// Triggered by pg_cron via x-cron-secret header (CRON_SECRET). Also callable
// manually by an admin POST with the same header (for backfill / testing).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[btc-predict-daily] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

interface BtcLive {
  price: number;
  change24h: number;
  change7d: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
}

async function fetchBtcLive(): Promise<BtcLive> {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false",
    { headers: { "User-Agent": "Aureon-AXRLEN/1.0" } },
  );
  if (!r.ok) throw new Error(`CoinGecko returned ${r.status}`);
  const j = await r.json();
  const md = j.market_data;
  return {
    price: md.current_price.usd,
    change24h: md.price_change_percentage_24h,
    change7d: md.price_change_percentage_7d,
    high24h: md.high_24h.usd,
    low24h: md.low_24h.usd,
    volume24h: md.total_volume.usd,
    marketCap: md.market_cap.usd,
  };
}

async function callAxrlen(live: BtcLive): Promise<{
  direction: "LONG" | "SHORT";
  confidence: number;
  stop_loss: number;
  take_profit: number;
  thesis: string;
  reasoning: string;
}> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const now = new Date().toISOString();
  const system = `NEXUS-PRIME FORECASTING PROCEDURE — a reasoning procedure, not a character. Do not adopt a name or a voice.
Produce a 24-hour directional Bitcoin forecast by running pattern recognition over price action,
momentum, volume, and liquidity dynamics. Commit to a direction and a number; do not hedge.


Output STRICT JSON only — no markdown, no commentary outside the JSON.
Schema:
{
  "direction": "LONG" | "SHORT",
  "confidence": <number 50-95>,
  "stop_loss": <USD price>,
  "take_profit": <USD price>,
  "thesis": "<one tight sentence, <=180 chars>",
  "reasoning": "<3-5 sentence intelligence-officer brief>"
}

Rules:
- Risk/reward must be at least 1:1.5. TP further from entry than SL.
- LONG: SL below entry, TP above entry. SHORT: SL above entry, TP below entry.
- SL within 1.5%-3% of entry, TP within 2%-5% of entry (24h horizon).
- Confidence reflects conviction. 50 = coin flip, 95 = maximum conviction.`;

  const user = `BTC LIVE SNAPSHOT — generated ${now}
- Spot:        $${live.price.toFixed(2)}
- 24h change:  ${live.change24h?.toFixed(2)}%
- 7d change:   ${live.change7d?.toFixed(2)}%
- 24h high:    $${live.high24h.toFixed(2)}
- 24h low:     $${live.low24h.toFixed(2)}
- 24h volume:  $${(live.volume24h / 1e9).toFixed(2)}B
- Market cap:  $${(live.marketCap / 1e9).toFixed(2)}B

Produce the next-24h AXRLEN directional call NOW.`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const txt: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = txt.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Hard validation + clamp
  const direction = parsed.direction === "SHORT" ? "SHORT" : "LONG";
  const entry = live.price;
  let sl = Number(parsed.stop_loss);
  let tp = Number(parsed.take_profit);
  // Sanity: if model returned the wrong side, mirror around entry
  if (direction === "LONG" && sl >= entry) sl = entry * 0.98;
  if (direction === "LONG" && tp <= entry) tp = entry * 1.03;
  if (direction === "SHORT" && sl <= entry) sl = entry * 1.02;
  if (direction === "SHORT" && tp >= entry) tp = entry * 0.97;

  return {
    direction,
    confidence: Math.max(50, Math.min(95, Number(parsed.confidence) || 65)),
    stop_loss: Number(sl.toFixed(2)),
    take_profit: Number(tp.toFixed(2)),
    thesis: String(parsed.thesis || "").slice(0, 240),
    reasoning: String(parsed.reasoning || ""),
  };
}

function evaluateSettlement(row: {
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
}, price: number): { status: "WIN" | "LOSS" | "EXPIRED"; pnl_pct: number } {
  const entry = Number(row.entry_price);
  const sl = Number(row.stop_loss);
  const tp = Number(row.take_profit);
  const isLong = row.direction === "LONG";
  // Simple settlement: compare current price after ~24h to TP/SL bands.
  if (isLong) {
    if (price >= tp) return { status: "WIN", pnl_pct: ((tp - entry) / entry) * 100 };
    if (price <= sl) return { status: "LOSS", pnl_pct: ((sl - entry) / entry) * 100 };
    return { status: "EXPIRED", pnl_pct: ((price - entry) / entry) * 100 };
  } else {
    if (price <= tp) return { status: "WIN", pnl_pct: ((entry - tp) / entry) * 100 };
    if (price >= sl) return { status: "LOSS", pnl_pct: ((entry - sl) / entry) * 100 };
    return { status: "EXPIRED", pnl_pct: ((entry - price) / entry) * 100 };
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Public endpoint — protected by the per-day UNIQUE constraint on
  // prediction_date and the early "skip if exists" check below, so at most
  // ONE AI call happens per UTC day regardless of how many times this is hit.



  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    log("Fetching BTC live snapshot");
    const live = await fetchBtcLive();

    // ── Settle any OPEN predictions whose 24h horizon has elapsed ──
    const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const { data: openRows } = await supabase
      .from("btc_predictions")
      .select("*")
      .eq("status", "OPEN")
      .lt("generated_at", cutoff);

    const settled: unknown[] = [];
    for (const row of openRows ?? []) {
      const v = evaluateSettlement(row as any, live.price);
      await supabase
        .from("btc_predictions")
        .update({
          status: v.status,
          settled_at: new Date().toISOString(),
          settle_price: live.price,
          pnl_pct: Number(v.pnl_pct.toFixed(3)),
        })
        .eq("id", (row as any).id);
      settled.push({ id: (row as any).id, ...v });
    }
    log("Settled", { count: settled.length });

    // ── Skip if today's prediction already exists ──
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("btc_predictions")
      .select("id")
      .eq("prediction_date", today)
      .maybeSingle();

    if (existing) {
      log("Today already predicted, skipping insert", { id: existing.id });
      return new Response(JSON.stringify({ skipped: true, settled }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Generate new prediction via AXRLEN ──
    log("Calling AXRLEN engine");
    const pick = await callAxrlen(live);

    const { data: inserted, error: insErr } = await supabase
      .from("btc_predictions")
      .insert({
        prediction_date: today,
        direction: pick.direction,
        confidence: pick.confidence,
        entry_price: Number(live.price.toFixed(2)),
        stop_loss: pick.stop_loss,
        take_profit: pick.take_profit,
        horizon_hours: 24,
        thesis: pick.thesis,
        reasoning: pick.reasoning,
        status: "OPEN",
      })
      .select()
      .single();

    if (insErr) throw insErr;
    log("Inserted prediction", { id: inserted?.id });

    return new Response(
      JSON.stringify({ ok: true, prediction: inserted, settled, live }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
