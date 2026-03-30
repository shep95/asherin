import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Yahoo Finance interval mapping
const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "60m", "4h": "60m", // 4h derived from 1h
  "1d": "1d", "1w": "1wk", "1mo": "1mo",
};

const RANGE_MAP: Record<string, string> = {
  "1m": "7d", "5m": "60d", "15m": "60d", "30m": "60d",
  "1h": "730d", "4h": "730d",
  "1d": "10y", "1w": "10y", "1mo": "max",
};

async function fetchYahooFinance(symbol: string, interval: string): Promise<OHLCVBar[]> {
  const yahooInterval = INTERVAL_MAP[interval] || "1d";
  const range = RANGE_MAP[interval] || "5y";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&range=${range}&includePrePost=false`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!resp.ok) {
    throw new Error(`Yahoo Finance returned ${resp.status}`);
  }

  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No data returned for symbol");

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    const d = new Date(timestamps[i] * 1000);
    bars.push({
      date: d.toISOString(),
      open: opens[i] ?? closes[i],
      high: highs[i] ?? closes[i],
      low: lows[i] ?? closes[i],
      close: closes[i],
      volume: volumes[i] ?? 0,
    });
  }

  // For 4h, aggregate 1h bars into 4h
  if (interval === "4h") {
    const aggregated: OHLCVBar[] = [];
    for (let i = 0; i < bars.length; i += 4) {
      const chunk = bars.slice(i, i + 4);
      if (chunk.length === 0) continue;
      aggregated.push({
        date: chunk[0].date,
        open: chunk[0].open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, c) => s + c.volume, 0),
      });
    }
    return aggregated;
  }

  return bars;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval } = await req.json();
    if (!symbol || typeof symbol !== "string") {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tf = interval || "1d";
    const bars = await fetchYahooFinance(symbol.toUpperCase(), tf);

    return new Response(JSON.stringify({
      symbol: symbol.toUpperCase(),
      interval: tf,
      bars,
      count: bars.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lavba-fetch-data error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch data" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
