const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const HL_API = "https://api.hyperliquid.xyz";
const LEVERAGE = 10;
const CAPITAL_PERCENT = 0.90; // 90% of available capital
const COINS = ["BTC", "ETH"];
const ASSET_MAP: Record<string, number> = { BTC: 0, ETH: 1 };

// Fee structure: Hyperliquid charges ~0.01% maker, ~0.035% taker
const TAKER_FEE_RATE = 0.00035;
const MAKER_FEE_RATE = 0.0001;

function getSupabase(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

function getServiceSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function verifyAdmin(authHeader: string) {
  const supabase = getSupabase(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || user?.email !== ADMIN_EMAIL) return null;
  return user;
}

// Get wallet balance from Hyperliquid
async function getHLState(walletAddress: string) {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
  });
  return await resp.json();
}

// Get open positions
async function getOpenPositions(walletAddress: string) {
  const state = await getHLState(walletAddress);
  return (state.assetPositions || []).filter((p: any) =>
    parseFloat(p.position?.szi || "0") !== 0
  );
}

// Place order via SDK
async function placeOrder(params: {
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
    await exchange.updateLeverage({ asset: params.asset, isCross: true, leverage: params.leverage });
  } catch (e) { console.warn("Leverage update:", e); }

  // Entry order
  const result = await exchange.order({
    orders: [{ a: params.asset, b: params.isBuy, p: params.price, s: params.size, r: false, t: { limit: { tif: "Gtc" } } }],
    grouping: "na",
  });

  // Stop loss
  if (params.slPrice) {
    try {
      await exchange.order({
        orders: [{ a: params.asset, b: !params.isBuy, p: params.slPrice, s: params.size, r: true, t: { trigger: { triggerPx: params.slPrice, isMarket: true, tpsl: "sl" } } }],
        grouping: "na",
      });
    } catch (e) { console.warn("SL:", e); }
  }

  // Take profits (split evenly)
  if (params.tpPrices?.length) {
    const tpSize = (parseFloat(params.size) / params.tpPrices.length).toFixed(6);
    for (const tp of params.tpPrices) {
      try {
        await exchange.order({
          orders: [{ a: params.asset, b: !params.isBuy, p: tp, s: tpSize, r: true, t: { trigger: { triggerPx: tp, isMarket: true, tpsl: "tp" } } }],
          grouping: "na",
        });
      } catch (e) { console.warn(`TP ${tp}:`, e); }
    }
  }

  return result;
}

// Calculate estimated fees for a trade
function estimateFees(sizeUsd: number, leverage: number): number {
  const notional = sizeUsd;
  // Entry + exit taker fees
  return notional * TAKER_FEE_RATE * 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const user = await verifyAdmin(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action } = body;
    const supabase = getSupabase(authHeader);
    const serviceDb = getServiceSupabase();
    const privateKey = Deno.env.get("HYPERLIQUID_PRIVATE_KEY")!;
    const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS")!;

    // ── GET DASHBOARD DATA ──
    if (action === "get_dashboard") {
      const [stateRes, tradesRes, pnlRes, hlState] = await Promise.all([
        supabase.from("lavba_bot_state").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("lavba_trades").select("*").eq("user_id", user.id).order("opened_at", { ascending: false }).limit(50),
        supabase.from("lavba_pnl_snapshots").select("*").eq("user_id", user.id).order("period_date", { ascending: false }).limit(90),
        getHLState(walletAddress),
      ]);

      const openPositions = await getOpenPositions(walletAddress);

      return new Response(JSON.stringify({
        botState: stateRes.data,
        trades: tradesRes.data || [],
        pnlSnapshots: pnlRes.data || [],
        hlBalance: {
          accountValue: hlState.marginSummary?.accountValue || "0",
          availableBalance: hlState.marginSummary?.totalRawUsd || "0",
        },
        openPositions,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── INITIALIZE BOT STATE ──
    if (action === "init_bot") {
      const hlState = await getHLState(walletAddress);
      const capital = parseFloat(hlState.marginSummary?.accountValue || "0");

      const { data, error } = await serviceDb.from("lavba_bot_state").upsert({
        user_id: user.id,
        enabled: false,
        emergency_stopped: false,
        current_coin: "BTC",
        total_capital: capital,
        available_capital: capital,
        daily_trade_count: 0,
        last_trade_date: null,
      }, { onConflict: "user_id" }).select().single();

      return new Response(JSON.stringify({ success: true, state: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── TOGGLE BOT ──
    if (action === "toggle_bot") {
      const { enabled } = body;
      const { data } = await serviceDb.from("lavba_bot_state").update({
        enabled,
        emergency_stopped: false,
        emergency_reason: null,
      }).eq("user_id", user.id).select().single();

      // Sync capital from Hyperliquid
      if (enabled) {
        const hlState = await getHLState(walletAddress);
        const capital = parseFloat(hlState.marginSummary?.accountValue || "0");
        await serviceDb.from("lavba_bot_state").update({
          total_capital: capital,
          available_capital: capital,
        }).eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ success: true, state: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EMERGENCY STOP ──
    if (action === "emergency_stop") {
      const { mode, reason } = body; // mode: "hold" | "close_all" | "cancel_pending"

      await serviceDb.from("lavba_bot_state").update({
        enabled: false,
        emergency_stopped: true,
        emergency_reason: reason || "Manual emergency stop",
      }).eq("user_id", user.id);

      if (mode === "close_all") {
        // Close all positions via market orders
        const positions = await getOpenPositions(walletAddress);
        for (const pos of positions) {
          const size = Math.abs(parseFloat(pos.position?.szi || "0"));
          const isBuy = parseFloat(pos.position?.szi || "0") < 0; // opposite side to close
          if (size > 0) {
            try {
              await placeOrder({
                privateKey,
                asset: pos.position.coin === "BTC" ? 0 : 1,
                isBuy,
                price: "0", // market order
                size: size.toFixed(6),
                leverage: LEVERAGE,
              });
            } catch (e) { console.error("Close position error:", e); }
          }
        }

        // Mark all open trades as stopped
        await serviceDb.from("lavba_trades").update({
          status: "stopped",
          closed_at: new Date().toISOString(),
        }).eq("user_id", user.id).in("status", ["open", "pending", "partial_tp"]);
      }

      return new Response(JSON.stringify({ success: true, mode }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EXECUTE SIGNAL (called by Lavba after Aureon generates) ──
    if (action === "execute_signal") {
      const { signal, symbol } = body;

      // Check bot state
      const { data: state } = await supabase.from("lavba_bot_state").select("*").eq("user_id", user.id).maybeSingle();
      if (!state?.enabled || state.emergency_stopped) {
        return new Response(JSON.stringify({ error: "Bot is not active" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check: 1 trade per day
      const today = new Date().toISOString().split("T")[0];
      if (state.last_trade_date === today && state.daily_trade_count >= 1) {
        return new Response(JSON.stringify({ error: "Daily trade limit reached (1/day)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check: no open trades
      const { data: openTrades } = await supabase.from("lavba_trades").select("id").eq("user_id", user.id).in("status", ["open", "pending", "partial_tp"]);
      if (openTrades && openTrades.length > 0) {
        return new Response(JSON.stringify({ error: "Active trade exists — wait for completion" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check: correct coin rotation
      const cleanSymbol = symbol.replace(/-USD$|-USDT$|-PERP$/i, "").toUpperCase();
      if (cleanSymbol !== state.current_coin) {
        return new Response(JSON.stringify({ error: `Rotation: waiting for ${state.current_coin}, got ${cleanSymbol}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (signal.direction === "NEUTRAL") {
        return new Response(JSON.stringify({ error: "NEUTRAL signal — no trade" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get fresh balance
      const hlState = await getHLState(walletAddress);
      const totalCapital = parseFloat(hlState.marginSummary?.accountValue || "0");
      const tradeCapital = totalCapital * CAPITAL_PERCENT;
      const entryPrice = parseFloat(signal.entry);
      const posSize = (tradeCapital * LEVERAGE / entryPrice).toFixed(6);
      const estFees = estimateFees(tradeCapital, LEVERAGE);

      const assetIdx = ASSET_MAP[cleanSymbol];
      if (assetIdx === undefined) {
        return new Response(JSON.stringify({ error: `Unsupported asset: ${cleanSymbol}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Place the trade
      const result = await placeOrder({
        privateKey,
        asset: assetIdx,
        isBuy: signal.direction === "LONG",
        price: signal.entry,
        size: posSize,
        leverage: LEVERAGE,
        slPrice: signal.stopLoss,
        tpPrices: [signal.takeProfit1].filter(Boolean),
      });

      // Record trade in database
      const nextCoin = cleanSymbol === "BTC" ? "ETH" : "BTC";

      const { data: trade } = await serviceDb.from("lavba_trades").insert({
        user_id: user.id,
        symbol: cleanSymbol,
        direction: signal.direction,
        entry_price: entryPrice,
        stop_loss: parseFloat(signal.stopLoss),
        take_profit1: parseFloat(signal.takeProfit1),
        take_profit2: signal.takeProfit2 ? parseFloat(signal.takeProfit2) : null,
        take_profit3: signal.takeProfit3 ? parseFloat(signal.takeProfit3) : null,
        position_size: parseFloat(posSize),
        size_usd: tradeCapital,
        leverage: LEVERAGE,
        fees: estFees,
        status: "open",
        signal_confidence: signal.confidence,
        signal_reasoning: signal.reasoning,
        chart_review: signal.chartReview,
        based_on_patterns: signal.basedOnPatterns || [],
        opened_at: new Date().toISOString(),
      }).select().single();

      // Update bot state
      await serviceDb.from("lavba_bot_state").update({
        current_coin: nextCoin,
        last_trade_date: today,
        daily_trade_count: (state.last_trade_date === today ? state.daily_trade_count : 0) + 1,
        total_capital: totalCapital,
        available_capital: totalCapital - tradeCapital,
        total_fees_paid: (state.total_fees_paid || 0) + estFees,
      }).eq("user_id", user.id);

      return new Response(JSON.stringify({
        success: true,
        trade,
        order: result,
        details: {
          symbol: cleanSymbol,
          direction: signal.direction,
          entry: signal.entry,
          sizeUsd: tradeCapital.toFixed(2),
          positionSize: posSize,
          leverage: LEVERAGE,
          estimatedFees: estFees.toFixed(2),
          nextCoin,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SYNC TRADE STATUS (check if trades closed, update PNL) ──
    if (action === "sync_trades") {
      const positions = await getOpenPositions(walletAddress);
      const hlState = await getHLState(walletAddress);
      const currentCapital = parseFloat(hlState.marginSummary?.accountValue || "0");

      // Get open trades from DB
      const { data: openTrades } = await supabase.from("lavba_trades").select("*").eq("user_id", user.id).in("status", ["open", "partial_tp"]);

      const results: any[] = [];

      for (const trade of (openTrades || [])) {
        const positionExists = positions.some((p: any) => {
          const coin = trade.symbol;
          return p.position?.coin === coin && Math.abs(parseFloat(p.position?.szi || "0")) > 0;
        });

        if (!positionExists) {
          // Position closed — calculate PNL
          const exitPrice = trade.direction === "LONG"
            ? Math.max(trade.take_profit1 || trade.entry_price, trade.entry_price)
            : Math.min(trade.take_profit1 || trade.entry_price, trade.entry_price);

          // Use Hyperliquid's reported PNL if available
          const pnlFromHL = positions.find((p: any) => p.position?.coin === trade.symbol);
          const realizedPnl = pnlFromHL
            ? parseFloat(pnlFromHL.position?.unrealizedPnl || "0")
            : (trade.direction === "LONG"
              ? (exitPrice - trade.entry_price) * trade.position_size
              : (trade.entry_price - exitPrice) * trade.position_size) - (trade.fees || 0);

          await serviceDb.from("lavba_trades").update({
            status: "closed",
            exit_price: exitPrice,
            realized_pnl: realizedPnl,
            closed_at: new Date().toISOString(),
          }).eq("id", trade.id);

          results.push({ id: trade.id, status: "closed", pnl: realizedPnl });

          // Update PNL snapshot
          const today = new Date().toISOString().split("T")[0];
          const isWin = realizedPnl > 0;

          await serviceDb.from("lavba_pnl_snapshots").upsert({
            user_id: user.id,
            period_type: "day",
            period_date: today,
            realized_pnl: realizedPnl,
            fees_paid: trade.fees || 0,
            trade_count: 1,
            win_count: isWin ? 1 : 0,
            loss_count: isWin ? 0 : 1,
            ending_balance: currentCapital,
          }, { onConflict: "user_id,period_type,period_date" });
        } else {
          // Update live P&L from position
          const livePos = positions.find((p: any) => p.position?.coin === trade.symbol);
          if (livePos) {
            const unrealizedPnl = parseFloat(livePos.position?.unrealizedPnl || "0");
            results.push({
              id: trade.id,
              status: "open",
              unrealizedPnl,
              currentPrice: parseFloat(livePos.position?.entryPx || "0"),
              liquidationPx: livePos.position?.liquidationPx,
            });
          }
        }
      }

      // Update bot capital
      await serviceDb.from("lavba_bot_state").update({
        total_capital: currentCapital,
        available_capital: currentCapital,
      }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, results, balance: currentCapital }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET PNL SUMMARY ──
    if (action === "get_pnl") {
      const { data: trades } = await supabase.from("lavba_trades").select("*").eq("user_id", user.id).eq("status", "closed").order("closed_at", { ascending: false });

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];

      const calcPnl = (trades: any[], since: string) => {
        const filtered = trades?.filter(t => (t.closed_at || t.opened_at) >= since) || [];
        const totalPnl = filtered.reduce((s, t) => s + (t.realized_pnl || 0), 0);
        const totalFees = filtered.reduce((s, t) => s + (t.fees || 0), 0);
        const wins = filtered.filter(t => (t.realized_pnl || 0) > 0).length;
        return { pnl: totalPnl, fees: totalFees, trades: filtered.length, wins, losses: filtered.length - wins, winRate: filtered.length > 0 ? wins / filtered.length : 0 };
      };

      return new Response(JSON.stringify({
        today: calcPnl(trades || [], todayStr),
        month: calcPnl(trades || [], monthStart),
        year: calcPnl(trades || [], yearStart),
        allTime: calcPnl(trades || [], "2000-01-01"),
        recentTrades: (trades || []).slice(0, 20),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Auto-trade engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
