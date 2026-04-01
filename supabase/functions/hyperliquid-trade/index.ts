import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const HL_API = "https://api.hyperliquid.xyz";

// Asset name → Hyperliquid asset index
const ASSET_MAP: Record<string, number> = {
  BTC: 0, ETH: 1, SOL: 2, AVAX: 3, ARB: 4, DOGE: 5, LINK: 6, MATIC: 7,
  OP: 8, SUI: 9, APT: 10, INJ: 11, TIA: 12, SEI: 13, NEAR: 14, WIF: 15,
  PEPE: 16, BONK: 17, FTM: 18, RUNE: 19, AAVE: 20, MKR: 21, ATOM: 22,
  DOT: 23, ADA: 24, XRP: 25, BNB: 26, LTC: 27, BCH: 28, FIL: 29,
  RENDER: 30, JUP: 31, W: 32, ORDI: 33, STX: 34, WLD: 35, PYTH: 36,
  PENDLE: 37, STRK: 38, ONDO: 39, ENA: 40, HYPE: 41,
};

function resolveAssetIndex(symbol: string): number | null {
  const clean = symbol.replace(/-USD$|-USDT$|-PERP$/i, "").toUpperCase();
  return ASSET_MAP[clean] ?? null;
}

async function placeOrderViaSDK(params: {
  privateKey: string;
  asset: number;
  isBuy: boolean;
  price: string;
  size: string;
  leverage: number;
  slPrice?: string;
  tpPrices?: string[];
}) {
  const { privateKeyToAccount } = await import("npm:viem@2.21.0/accounts");
  const { HttpTransport, ExchangeClient } = await import("npm:@nktkas/hyperliquid@5");

  const pk = params.privateKey.startsWith("0x") ? params.privateKey : `0x${params.privateKey}`;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const transport = new HttpTransport();
  const exchange = new ExchangeClient({ wallet: account, transport });

  // Set leverage
  try {
    await exchange.updateLeverage({
      asset: params.asset,
      isCross: true,
      leverage: params.leverage,
    });
    console.log(`Leverage set to ${params.leverage}x for asset ${params.asset}`);
  } catch (e) {
    console.warn("Leverage update note:", e);
  }

  // Place main entry order
  const orderResult = await exchange.order({
    orders: [{
      a: params.asset,
      b: params.isBuy,
      p: params.price,
      s: params.size,
      r: false,
      t: { limit: { tif: "Gtc" } },
    }],
    grouping: "na",
  });
  console.log("Entry order result:", JSON.stringify(orderResult));

  // Place stop loss
  if (params.slPrice) {
    try {
      await exchange.order({
        orders: [{
          a: params.asset,
          b: !params.isBuy,
          p: params.slPrice,
          s: params.size,
          r: true,
          t: { trigger: { triggerPx: params.slPrice, isMarket: true, tpsl: "sl" } },
        }],
        grouping: "na",
      });
      console.log("SL placed at", params.slPrice);
    } catch (e) {
      console.warn("SL order note:", e);
    }
  }

  // Place take profits (split size evenly)
  if (params.tpPrices?.length) {
    const tpSize = (parseFloat(params.size) / params.tpPrices.length).toFixed(6);
    for (const tpPrice of params.tpPrices) {
      try {
        await exchange.order({
          orders: [{
            a: params.asset,
            b: !params.isBuy,
            p: tpPrice,
            s: tpSize,
            r: true,
            t: { trigger: { triggerPx: tpPrice, isMarket: true, tpsl: "tp" } },
          }],
          grouping: "na",
        });
        console.log(`TP placed at ${tpPrice} for ${tpSize}`);
      } catch (e) {
        console.warn(`TP order note (${tpPrice}):`, e);
      }
    }
  }

  return orderResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const privateKey = Deno.env.get("HYPERLIQUID_PRIVATE_KEY");
    const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS");

    if (!privateKey || !walletAddress) {
      return new Response(JSON.stringify({ error: "Hyperliquid credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place_trade") {
      const { symbol, direction, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, leverage = 10, sizeUsd = 100 } = body;

      const assetIndex = resolveAssetIndex(symbol);
      if (assetIndex === null) {
        return new Response(JSON.stringify({ error: `Unknown asset: ${symbol}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isBuy = direction === "LONG";
      const entryPrice = parseFloat(entry);
      const posSize = (sizeUsd * leverage / entryPrice).toFixed(6);

      console.log(`[AUTO-TRADE] ${direction} ${symbol} @ $${entry} | Size: ${posSize} | Lev: ${leverage}x | SL: ${stopLoss}`);

      const result = await placeOrderViaSDK({
        privateKey,
        asset: assetIndex,
        isBuy,
        price: entry,
        size: posSize,
        leverage,
        slPrice: stopLoss,
        tpPrices: [takeProfit1, takeProfit2, takeProfit3].filter(Boolean),
      });

      return new Response(JSON.stringify({
        success: true,
        order: result,
        details: { symbol, direction, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, leverage, sizeUsd, positionSize: posSize },
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_balance") {
      const resp = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
      });
      const data = await resp.json();
      return new Response(JSON.stringify({
        balance: data.marginSummary?.accountValue,
        availableBalance: data.marginSummary?.totalRawUsd,
        positions: data.assetPositions?.length || 0,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_positions") {
      const resp = await fetch(`${HL_API}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Hyperliquid trade error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
