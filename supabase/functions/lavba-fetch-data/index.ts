import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Common crypto tickers that need -USD suffix
const CRYPTO_TICKERS = new Set([
  "BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "DOT", "MATIC", "AVAX", "LINK",
  "UNI", "ATOM", "LTC", "BCH", "NEAR", "APT", "ARB", "OP", "FIL", "AAVE",
  "MKR", "SNX", "CRV", "COMP", "SUSHI", "YFI", "BNB", "TRX", "SHIB", "PEPE",
  "WIF", "BONK", "JUP", "RENDER", "FET", "RNDR", "INJ", "SUI", "SEI", "TIA",
  "MANA", "SAND", "AXS", "ICP", "FTM", "ALGO", "XLM", "VET", "EOS", "HBAR",
]);

function resolveSymbol(input: string): string {
  const upper = input.toUpperCase().trim();
  if (upper.includes("-") || upper.includes("=") || upper.includes(".")) return upper;
  if (CRYPTO_TICKERS.has(upper)) return `${upper}-USD`;
  return upper;
}

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "60m", "4h": "60m",
  "1d": "1d", "1w": "1wk", "1mo": "1mo",
};

const RANGE_MAP: Record<string, string> = {
  "1m": "7d", "5m": "60d", "15m": "60d", "30m": "60d",
  "1h": "730d", "4h": "730d",
  "1d": "10y", "1w": "10y", "1mo": "max",
};

// Validate symbol: alphanumeric with allowed special chars, max 20 chars
function isValidSymbol(s: string): boolean {
  return /^[A-Za-z0-9.\-=^]{1,20}$/.test(s);
}

const VALID_INTERVALS = new Set(Object.keys(INTERVAL_MAP));

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, { headers });
      if (resp.ok || resp.status === 404) return resp;
      if (resp.status === 429 && i < retries) {
        // Rate limited — backoff
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return resp; // Return non-ok for caller to handle
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

async function fetchYahooFinance(symbol: string, interval: string): Promise<OHLCVBar[]> {
  const resolved = resolveSymbol(symbol);
  const yahooInterval = INTERVAL_MAP[interval] || "1d";
  const range = RANGE_MAP[interval] || "5y";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved)}?interval=${yahooInterval}&range=${range}&includePrePost=false`;

  const resp = await fetchWithRetry(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });

  if (!resp.ok) {
    throw new Error(`Yahoo Finance returned ${resp.status} for ${resolved}`);
  }

  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for ${resolved}`);

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

  // For 4h, aggregate 1h bars
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
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { symbol, interval } = body;

    // Input validation
    if (!symbol || typeof symbol !== "string") {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidSymbol(symbol)) {
      return new Response(JSON.stringify({ error: "Invalid symbol format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tf = (typeof interval === "string" && VALID_INTERVALS.has(interval)) ? interval : "1d";
    const resolved = resolveSymbol(symbol);
    const bars = await fetchYahooFinance(symbol, tf);

    return new Response(JSON.stringify({
      symbol: resolved,
      interval: tf,
      bars,
      count: bars.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lavba-fetch-data error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to fetch data" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
