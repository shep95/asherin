import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const HL_API = "https://api.hyperliquid.xyz";

// Asset name → Hyperliquid asset index mapping (most common perpetuals)
const ASSET_MAP: Record<string, number> = {
  BTC: 0, ETH: 1, SOL: 2, AVAX: 3, ARB: 4, DOGE: 5, LINK: 6, MATIC: 7,
  OP: 8, SUI: 9, APT: 10, INJ: 11, TIA: 12, SEI: 13, NEAR: 14, WIF: 15,
  PEPE: 16, BONK: 17, FTM: 18, RUNE: 19, AAVE: 20, MKR: 21, ATOM: 22,
  DOT: 23, ADA: 24, XRP: 25, BNB: 26, LTC: 27, BCH: 28, FIL: 29,
  RENDER: 30, JUP: 31, W: 32, ORDI: 33, STX: 34, WLD: 35, PYTH: 36,
  PENDLE: 37, STRK: 38, ONDO: 39, ENA: 40, HYPE: 41,
};

// EIP-712 typed data for Hyperliquid order signing
function buildOrderTypedData(action: any, nonce: number, vaultAddress: string | null) {
  const domain = {
    name: "Exchange",
    version: "1",
    chainId: 1337,
    verifyingContract: "0x0000000000000000000000000000000000000000",
  };

  const types = {
    "HyperliquidTransaction:Order": [
      { name: "hyperliquidChain", type: "string" },
      { name: "action", type: "string" },
      { name: "nonce", type: "uint64" },
      ...(vaultAddress ? [{ name: "vaultAddress", type: "address" }] : []),
    ],
  };

  const message: Record<string, any> = {
    hyperliquidChain: "Mainnet",
    action: JSON.stringify(action),
    nonce,
    ...(vaultAddress ? { vaultAddress } : {}),
  };

  return { domain, types, primaryType: "HyperliquidTransaction:Order", message };
}

// Sign with ethers-style EIP-712 using viem (available in Deno via npm)
async function signTypedData(privateKey: string, typedData: any): Promise<string> {
  // Use the Web Crypto API + manual EIP-712 hashing
  // For simplicity and reliability, we'll use the Hyperliquid REST build-order flow
  // which doesn't require local EIP-712 signing
  throw new Error("Direct signing not used - using build-order flow");
}

// Resolve asset index from symbol
function resolveAssetIndex(symbol: string): number | null {
  const clean = symbol.replace(/-USD$|-USDT$|-PERP$/i, "").toUpperCase();
  return ASSET_MAP[clean] ?? null;
}

// Get current mid price for an asset
async function getMidPrice(assetIndex: number): Promise<number> {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  const mids = await resp.json();
  const keys = Object.keys(mids);
  if (assetIndex < keys.length) {
    return parseFloat(mids[keys[assetIndex]]);
  }
  throw new Error(`No mid price for asset index ${assetIndex}`);
}

// Get meta info (universe) to validate asset and get size decimals
async function getAssetMeta(): Promise<any> {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });
  return await resp.json();
}

// Set leverage for an asset
async function setLeverage(walletAddress: string, assetIndex: number, leverage: number): Promise<void> {
  // Update leverage via info endpoint
  console.log(`Setting leverage for asset ${assetIndex} to ${leverage}x for wallet ${walletAddress}`);
  // Hyperliquid leverage is set per-position via the exchange endpoint
  // We'll handle it as part of the order action
}

// Place order using Hyperliquid's exchange API with the Python SDK approach
// Since Deno doesn't have ethers/viem natively for EIP-712, we use a simplified approach
async function placeOrder(params: {
  privateKey: string;
  walletAddress: string;
  asset: number;
  isBuy: boolean;
  price: string;
  size: string;
  leverage: number;
  slPrice?: string;
  tpPrices?: string[];
  reduceOnly?: boolean;
}): Promise<any> {
  const { privateKey, walletAddress, asset, isBuy, price, size, leverage, slPrice, tpPrices, reduceOnly } = params;

  // First, set leverage
  const leverageAction = {
    type: "updateLeverage",
    asset,
    isCross: true,
    leverage,
  };

  const nonce = Date.now();

  // Build the order action
  const orderAction = {
    type: "order",
    orders: [{
      a: asset,
      b: isBuy,
      p: price,
      s: size,
      r: reduceOnly || false,
      t: { limit: { tif: "Gtc" } },
    }],
    grouping: "na",
  };

  // For Hyperliquid, we need to sign with EIP-712
  // Import viem for signing
  const { privateKeyToAccount } = await import("npm:viem@2.21.0/accounts");
  const { hashTypedData, toHex } = await import("npm:viem@2.21.0");

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`);

  // Set leverage first
  const levDomain = {
    name: "Exchange",
    version: "1",
    chainId: 1337,
    verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  };

  const actionHash = (action: any, nonce: number) => {
    const types = {
      "HyperliquidTransaction:Withdraw" as string: [
        { name: "hyperliquidChain", type: "string" },
        { name: "action", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    };
    return { domain: levDomain, types, primaryType: "HyperliquidTransaction:Withdraw", message: { hyperliquidChain: "Mainnet", action: JSON.stringify(action), nonce } };
  };

  // Sign leverage update
  try {
    const levSig = await account.signTypedData({
      domain: levDomain,
      types: {
        "HyperliquidTransaction:UpdateLeverage": [
          { name: "hyperliquidChain", type: "string" },
          { name: "action", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "HyperliquidTransaction:UpdateLeverage",
      message: {
        hyperliquidChain: "Mainnet",
        action: JSON.stringify(leverageAction),
        nonce: BigInt(nonce),
      },
    });

    const levResp = await fetch(`${HL_API}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: leverageAction,
        nonce,
        signature: levSig,
      }),
    });
    const levResult = await levResp.json();
    console.log("Leverage update result:", JSON.stringify(levResult));
  } catch (e) {
    console.warn("Leverage update skipped:", e);
  }

  // Sign and place the main order
  const orderNonce = Date.now();

  const orderSig = await account.signTypedData({
    domain: levDomain,
    types: {
      "HyperliquidTransaction:Order": [
        { name: "hyperliquidChain", type: "string" },
        { name: "action", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:Order",
    message: {
      hyperliquidChain: "Mainnet",
      action: JSON.stringify(orderAction),
      nonce: BigInt(orderNonce),
    },
  });

  const orderResp = await fetch(`${HL_API}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: orderAction,
      nonce: orderNonce,
      signature: orderSig,
    }),
  });

  const orderResult = await orderResp.json();
  console.log("Order result:", JSON.stringify(orderResult));

  // Place stop loss if provided
  if (slPrice) {
    const slAction = {
      type: "order",
      orders: [{
        a: asset,
        b: !isBuy, // opposite side
        p: slPrice,
        s: size,
        r: true, // reduce only
        t: { trigger: { triggerPx: slPrice, isMarket: true, tpsl: "sl" } },
      }],
      grouping: "na",
    };

    const slNonce = Date.now();
    const slSig = await account.signTypedData({
      domain: levDomain,
      types: {
        "HyperliquidTransaction:Order": [
          { name: "hyperliquidChain", type: "string" },
          { name: "action", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "HyperliquidTransaction:Order",
      message: {
        hyperliquidChain: "Mainnet",
        action: JSON.stringify(slAction),
        nonce: BigInt(slNonce),
      },
    });

    const slResp = await fetch(`${HL_API}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: slAction,
        nonce: slNonce,
        signature: slSig,
      }),
    });
    const slResult = await slResp.json();
    console.log("SL result:", JSON.stringify(slResult));
  }

  // Place take profit orders
  if (tpPrices?.length) {
    const tpSize = (parseFloat(size) / tpPrices.length).toFixed(6);
    for (const tpPrice of tpPrices) {
      const tpAction = {
        type: "order",
        orders: [{
          a: asset,
          b: !isBuy,
          p: tpPrice,
          s: tpSize,
          r: true,
          t: { trigger: { triggerPx: tpPrice, isMarket: true, tpsl: "tp" } },
        }],
        grouping: "na",
      };

      const tpNonce = Date.now();
      const tpSig = await account.signTypedData({
        domain: levDomain,
        types: {
          "HyperliquidTransaction:Order": [
            { name: "hyperliquidChain", type: "string" },
            { name: "action", type: "string" },
            { name: "nonce", type: "uint64" },
          ],
        },
        primaryType: "HyperliquidTransaction:Order",
        message: {
          hyperliquidChain: "Mainnet",
          action: JSON.stringify(tpAction),
          nonce: BigInt(tpNonce),
        },
      });

      const tpResp = await fetch(`${HL_API}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tpAction,
          nonce: tpNonce,
          signature: tpSig,
        }),
      });
      const tpResult = await tpResp.json();
      console.log(`TP result (${tpPrice}):`, JSON.stringify(tpResult));
    }
  }

  return orderResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get full user to verify email
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const privateKey = Deno.env.get("HYPERLIQUID_PRIVATE_KEY");
    const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS");

    if (!privateKey || !walletAddress) {
      return new Response(JSON.stringify({ error: "Hyperliquid credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place_trade") {
      const { symbol, direction, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, leverage = 10, sizeUsd = 100 } = body;

      const assetIndex = resolveAssetIndex(symbol);
      if (assetIndex === null) {
        return new Response(JSON.stringify({ error: `Unknown asset: ${symbol}. Supported: ${Object.keys(ASSET_MAP).join(", ")}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isBuy = direction === "LONG";
      const entryPrice = parseFloat(entry);
      const posSize = (sizeUsd * leverage / entryPrice).toFixed(6);

      console.log(`Placing ${direction} on asset ${assetIndex} (${symbol}), size: ${posSize}, entry: ${entry}, leverage: ${leverage}x`);

      const result = await placeOrder({
        privateKey,
        walletAddress,
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
        details: {
          symbol,
          direction,
          entry,
          stopLoss,
          takeProfit1,
          takeProfit2,
          takeProfit3,
          leverage,
          sizeUsd,
          positionSize: posSize,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Hyperliquid trade error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
