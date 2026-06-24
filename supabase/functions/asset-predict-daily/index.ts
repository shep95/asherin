// asset-predict-daily — Scheduled by pg_cron (07:00 EST / 12:00 UTC).
// For each asset (ETH, CRUDE, SPX, NDX):
//   1. Settles any OPEN predictions whose horizon elapsed.
//   2. Skips if today's prediction already exists.
//   3. Pulls a live snapshot (spot + prev close → 24h change).
//   4. Calls the AXRLEN engine (Lovable AI Gateway) for a JSON forecast.
//   5. Inserts the row.
//
// Per-asset isolation: a failure on one asset does NOT stop the others.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: unknown) =>
  console.log(`[asset-predict-daily] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

type AssetKey = "ETH" | "CRUDE" | "SPX" | "NDX";

interface AssetMeta {
  key: AssetKey;
  display: string;
  unit: string;          // "USD" etc.
  venue: string;
  yahooSymbol?: string;
  coingeckoId?: string;
  precision: number;     // decimal places for entry/sl/tp
}

const ASSETS: AssetMeta[] = [
  { key: "ETH",   display: "Ethereum (ETH-USD)",     unit: "USD", venue: "Coinbase / Hyperliquid ETH-PERP", coingeckoId: "ethereum", yahooSymbol: "ETH-USD", precision: 2 },
  { key: "CRUDE", display: "WTI Crude Oil (CL=F)",    unit: "USD/bbl", venue: "NYMEX CL Futures",            yahooSymbol: "CL=F",   precision: 2 },
  { key: "SPX",   display: "S&P 500 Index (^GSPC)",  unit: "pts", venue: "S&P / CME ES Futures",            yahooSymbol: "^GSPC",  precision: 2 },
  { key: "NDX",   display: "NASDAQ 100 Index (^NDX)", unit: "pts", venue: "Nasdaq / CME NQ Futures",         yahooSymbol: "^NDX",   precision: 2 },
];

interface Live {
  price: number;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  source: string;
}

async function fetchYahooLive(symbol: string): Promise<Live> {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: { "user-agent": "Mozilla/5.0 (aureon-axrlen/1.0)" } },
  );
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  const closes: number[] = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter((x: any) => typeof x === "number");
  const price = Number(meta?.regularMarketPrice);
  if (!price) throw new Error(`Yahoo ${symbol} no price`);
  const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
  const change24h = prev ? ((price - prev) / prev) * 100 : null;
  return {
    price,
    change24h,
    high24h: Number(meta?.regularMarketDayHigh) || null,
    low24h: Number(meta?.regularMarketDayLow) || null,
    volume24h: Number(meta?.regularMarketVolume) || null,
    source: `Yahoo Finance (${symbol})`,
  };
}

async function fetchCoinGeckoLive(id: string): Promise<Live> {
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
    { headers: { "User-Agent": "Aureon-AXRLEN/1.0" } },
  );
  if (!r.ok) throw new Error(`CoinGecko ${id} ${r.status}`);
  const j = await r.json();
  const md = j.market_data;
  return {
    price: md.current_price.usd,
    change24h: md.price_change_percentage_24h ?? null,
    high24h: md.high_24h?.usd ?? null,
    low24h: md.low_24h?.usd ?? null,
    volume24h: md.total_volume?.usd ?? null,
    source: `CoinGecko (${id})`,
  };
}

async function fetchLive(a: AssetMeta): Promise<Live> {
  // ETH: try CoinGecko first (richer 24h metrics), fall back to Yahoo.
  if (a.coingeckoId) {
    try { return await fetchCoinGeckoLive(a.coingeckoId); }
    catch (e) { log("CoinGecko fail, falling back to Yahoo", { asset: a.key, err: String((e as Error).message) }); }
  }
  if (a.yahooSymbol) return await fetchYahooLive(a.yahooSymbol);
  throw new Error(`No data source for ${a.key}`);
}

async function callAxrlen(a: AssetMeta, live: Live): Promise<{
  direction: "LONG" | "SHORT";
  confidence: number;
  stop_loss: number;
  take_profit: number;
  thesis: string;
  reasoning: string;
}> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!LOVABLE_KEY && !OPENAI_KEY) throw new Error("No AI key configured (LOVABLE_API_KEY or OPENAI_API_KEY)");

  const now = new Date().toISOString();
  const system = `You are AXRLEN, the Nexus Prime predictive intelligence engine inside Aureon.
You produce 24-hour directional forecasts for global risk assets using pattern recognition over
price action, momentum, volume, and liquidity dynamics. You are surgical, decisive, and confident.

Output STRICT JSON only — no markdown, no commentary outside the JSON.
Schema:
{
  "direction": "LONG" | "SHORT",
  "confidence": <number 50-95>,
  "stop_loss": <price in the same unit as entry>,
  "take_profit": <price in the same unit as entry>,
  "thesis": "<one tight sentence, <=180 chars>",
  "reasoning": "<3-5 sentence intelligence-officer brief>"
}

Rules:
- Risk/reward must be at least 1:1.5. TP further from entry than SL.
- LONG: SL below entry, TP above entry. SHORT: SL above entry, TP below entry.
- SL within 1.0%-2.5% of entry, TP within 1.5%-4% of entry (24h horizon).
- Confidence reflects conviction. 50 = coin flip, 95 = maximum conviction.`;

  const user = `${a.display} LIVE SNAPSHOT — generated ${now}
- Spot:        ${live.price.toFixed(a.precision)} ${a.unit}
- 24h change:  ${live.change24h == null ? "n/a" : live.change24h.toFixed(2) + "%"}
- 24h high:    ${live.high24h == null ? "n/a" : live.high24h.toFixed(a.precision)}
- 24h low:     ${live.low24h == null ? "n/a" : live.low24h.toFixed(a.precision)}
- 24h volume:  ${live.volume24h == null ? "n/a" : live.volume24h.toLocaleString()}
- Source:      ${live.source}
- Venue:       ${a.venue}

Produce the next-24h AXRLEN directional call NOW for ${a.display}.`;

  // Prefer Lovable AI Gateway when available (cheaper, no per-key billing).
  const useLovable = !!LOVABLE_KEY;
  const endpoint = useLovable
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useLovable ? "google/gemini-2.5-flash" : "gpt-4o-mini";
  const key = (useLovable ? LOVABLE_KEY : OPENAI_KEY) as string;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model,
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
    throw new Error(`AI (${useLovable ? "Lovable" : "OpenAI"}) ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const txt: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = txt.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  const direction = parsed.direction === "SHORT" ? "SHORT" : "LONG";
  const entry = live.price;
  let sl = Number(parsed.stop_loss);
  let tp = Number(parsed.take_profit);
  if (!Number.isFinite(sl) || sl <= 0) sl = direction === "LONG" ? entry * 0.985 : entry * 1.015;
  if (!Number.isFinite(tp) || tp <= 0) tp = direction === "LONG" ? entry * 1.025 : entry * 0.975;
  if (direction === "LONG" && sl >= entry) sl = entry * 0.985;
  if (direction === "LONG" && tp <= entry) tp = entry * 1.025;
  if (direction === "SHORT" && sl <= entry) sl = entry * 1.015;
  if (direction === "SHORT" && tp >= entry) tp = entry * 0.975;

  const round = (x: number) => Number(x.toFixed(a.precision));

  return {
    direction,
    confidence: Math.max(50, Math.min(95, Number(parsed.confidence) || 65)),
    stop_loss: round(sl),
    take_profit: round(tp),
    thesis: String(parsed.thesis || "").slice(0, 240),
    reasoning: String(parsed.reasoning || ""),
  };
}

function evaluateSettlement(row: { direction: string; entry_price: number; stop_loss: number; take_profit: number; }, price: number) {
  const entry = Number(row.entry_price);
  const sl = Number(row.stop_loss);
  const tp = Number(row.take_profit);
  const isLong = row.direction === "LONG";
  if (isLong) {
    if (price >= tp) return { status: "WIN" as const,  pnl_pct: ((tp - entry) / entry) * 100 };
    if (price <= sl) return { status: "LOSS" as const, pnl_pct: ((sl - entry) / entry) * 100 };
    return { status: "EXPIRED" as const, pnl_pct: ((price - entry) / entry) * 100 };
  } else {
    if (price <= tp) return { status: "WIN" as const,  pnl_pct: ((entry - tp) / entry) * 100 };
    if (price >= sl) return { status: "LOSS" as const, pnl_pct: ((entry - sl) / entry) * 100 };
    return { status: "EXPIRED" as const, pnl_pct: ((entry - price) / entry) * 100 };
  }
}

async function runForAsset(supabase: ReturnType<typeof createClient>, a: AssetMeta) {
  log("Begin", { asset: a.key });
  const live = await fetchLive(a);

  // Settle expired OPEN rows for this asset.
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: openRows } = await supabase
    .from("asset_predictions")
    .select("*")
    .eq("asset", a.key)
    .eq("status", "OPEN")
    .lt("generated_at", cutoff);

  const settled: unknown[] = [];
  for (const row of openRows ?? []) {
    const v = evaluateSettlement(row as any, live.price);
    await supabase
      .from("asset_predictions")
      .update({
        status: v.status,
        settled_at: new Date().toISOString(),
        settle_price: Number(live.price.toFixed(a.precision)),
        pnl_pct: Number(v.pnl_pct.toFixed(3)),
      })
      .eq("id", (row as any).id);
    settled.push({ id: (row as any).id, ...v });
  }

  // Skip if today already exists.
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("asset_predictions")
    .select("id")
    .eq("asset", a.key)
    .eq("prediction_date", today)
    .maybeSingle();

  if (existing) return { asset: a.key, skipped: true, settled };

  const pick = await callAxrlen(a, live);
  const { data: inserted, error: insErr } = await supabase
    .from("asset_predictions")
    .insert({
      asset: a.key,
      prediction_date: today,
      direction: pick.direction,
      confidence: pick.confidence,
      entry_price: Number(live.price.toFixed(a.precision)),
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
  return { asset: a.key, inserted, settled, live };
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

    // Allow `?asset=ETH` to run a single asset (testing / backfill).
    const url = new URL(req.url);
    const onlyParam = (url.searchParams.get("asset") || "").toUpperCase();
    const targets = onlyParam
      ? ASSETS.filter((a) => a.key === onlyParam)
      : ASSETS;

    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "unknown_asset" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: unknown[] = [];
    for (const a of targets) {
      try { results.push(await runForAsset(supabase, a)); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("ASSET FAIL", { asset: a.key, msg });
        results.push({ asset: a.key, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("FATAL", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
