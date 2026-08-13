import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);
const HL_API = "https://api.hyperliquid.xyz";
const LEVERAGE = 10;
const CAPITAL_PERCENT = 0.90;
const COINS = ["BTC", "ETH"];
const ASSET_MAP: Record<string, number> = { BTC: 0, ETH: 1 };

// SECURITY: pre-trade risk caps (audit C-06)
const MAX_LOSS_PCT_OF_EQUITY = 0.02; // refuse any signal that risks >2% equity
const MAX_DRAWDOWN_HALT_PCT = 0.15;  // halt bot when 15% below peak equity
const MIN_SL_DISTANCE_PCT = 0.001;   // SL must be at least 0.1% away from entry
const MAX_SL_DISTANCE_PCT = 0.10;    // and at most 10% (else position too large for risk cap)

// Hyperliquid precision rules per asset
const SZ_DECIMALS: Record<string, number> = { BTC: 5, ETH: 4 };
const PRICE_DECIMALS: Record<string, number> = { BTC: 1, ETH: 2 }; // MAX_DECIMALS(6) - szDecimals

// Fee structure
const TAKER_FEE_RATE = 0.00035;

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
  if (error || !isAuthorizedAdminEmail(user?.email)) return null;
  return user;
}

// ── HYPERLIQUID API HELPERS ──

async function getHLState(walletAddress: string) {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
  });
  return await resp.json();
}

async function getOpenPositions(walletAddress: string) {
  const state = await getHLState(walletAddress);
  return (state.assetPositions || []).filter((p: any) =>
    parseFloat(p.position?.szi || "0") !== 0
  );
}

// Get current mid price for an asset
async function getMidPrice(coin: string): Promise<number> {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  const mids = await resp.json();
  const price = parseFloat(mids[coin] || "0");
  if (price <= 0) throw new Error(`Could not fetch mid price for ${coin}`);
  return price;
}

// Get recent fills for PNL calculation
async function getUserFills(walletAddress: string): Promise<any[]> {
  const resp = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "userFills", user: walletAddress }),
  });
  return await resp.json();
}

// Round size to correct decimals for the asset
function roundSize(size: number, coin: string): string {
  const decimals = SZ_DECIMALS[coin] ?? 4;
  const factor = Math.pow(10, decimals);
  return (Math.floor(size * factor) / factor).toFixed(decimals);
}

// Round price to correct significant figures / decimals
function roundPrice(price: number, coin: string): string {
  const maxDecimals = PRICE_DECIMALS[coin] ?? 2;
  return price.toFixed(maxDecimals);
}

// ── ORDER EXECUTION ──

async function placeOrder(params: {
  privateKey: string;
  asset: number;
  isBuy: boolean;
  price: string;
  size: string;
  leverage: number;
  slPrice?: string;
  tpPrices?: string[];
  isMarketClose?: boolean;
}) {
  const { privateKeyToAccount } = await import("npm:viem@2.21.0/accounts");
  const { HttpTransport, ExchangeClient } = await import("npm:@nktkas/hyperliquid@5");

  const pk = params.privateKey.startsWith("0x") ? params.privateKey : `0x${params.privateKey}`;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const transport = new HttpTransport();
  const exchange = new ExchangeClient({ wallet: account, transport });

  // Set leverage (skip for market close orders)
  if (!params.isMarketClose) {
    try {
      await exchange.updateLeverage({ asset: params.asset, isCross: true, leverage: params.leverage });
    } catch (e) { console.warn("Leverage update:", e); }
  }

  // Entry/close order
  const result = await exchange.order({
    orders: [{
      a: params.asset,
      b: params.isBuy,
      p: params.price,
      s: params.size,
      r: params.isMarketClose ? true : false,
      t: { limit: { tif: params.isMarketClose ? "Ioc" : "Gtc" } },
    }],
    grouping: "na",
  });

  // Check if order filled (for non-close orders)
  if (!params.isMarketClose && result?.response?.data?.statuses) {
    const statuses = result.response.data.statuses;
    const firstStatus = statuses[0];
    if (firstStatus?.error) {
      throw new Error(`Order rejected: ${firstStatus.error}`);
    }
  }

  // Stop loss
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
    } catch (e) { console.warn("SL order error:", e); }
  }

  // Take profit (single TP1 only)
  if (params.tpPrices?.length) {
    for (const tp of params.tpPrices) {
      try {
        await exchange.order({
          orders: [{
            a: params.asset,
            b: !params.isBuy,
            p: tp,
            s: params.size,
            r: true,
            t: { trigger: { triggerPx: tp, isMarket: true, tpsl: "tp" } },
          }],
          grouping: "na",
        });
      } catch (e) { console.warn(`TP ${tp} error:`, e); }
    }
  }

  return result;
}

function estimateFees(sizeUsd: number): number {
  return sizeUsd * TAKER_FEE_RATE * 2;
}

// ── MAIN HANDLER ──

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
    // Only read-only actions are allowed without a configured trading key.
    const READ_ONLY_ACTIONS = new Set(["get_dashboard", "get_state", "get_trades", "get_pnl"]);
    const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS") ?? "";
    let privateKey = "";
    if (!READ_ONLY_ACTIONS.has(action)) {
      const pk = Deno.env.get("HYPERLIQUID_PRIVATE_KEY");
      if (!pk) {
        return new Response(
          JSON.stringify({ error: "Trading not configured (missing HYPERLIQUID_PRIVATE_KEY)" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      privateKey = pk;
    }

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
      const { mode, reason } = body;

      await serviceDb.from("lavba_bot_state").update({
        enabled: false,
        emergency_stopped: true,
        emergency_reason: reason || "Manual emergency stop",
      }).eq("user_id", user.id);

      if (mode === "close_all") {
        const positions = await getOpenPositions(walletAddress);
        for (const pos of positions) {
          const size = Math.abs(parseFloat(pos.position?.szi || "0"));
          const isLong = parseFloat(pos.position?.szi || "0") > 0;
          const coin = pos.position?.coin || "BTC";

          if (size > 0) {
            try {
              // FIX #4: Use far-away slippage price instead of "0"
              // For closing a LONG → sell at very low price (IOC will fill at market)
              // For closing a SHORT → buy at very high price
              const closePrice = isLong ? "1" : "999999";
              const assetIdx = ASSET_MAP[coin] ?? 0;

              await placeOrder({
                privateKey,
                asset: assetIdx,
                isBuy: !isLong,
                price: closePrice,
                size: roundSize(size, coin),
                leverage: LEVERAGE,
                isMarketClose: true,
              });
            } catch (e) { console.error("Close position error:", e); }
          }
        }

        await serviceDb.from("lavba_trades").update({
          status: "stopped",
          closed_at: new Date().toISOString(),
        }).eq("user_id", user.id).in("status", ["open", "pending", "partial_tp"]);
      }

      return new Response(JSON.stringify({ success: true, mode }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EXECUTE SIGNAL ──
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

      const assetIdx = ASSET_MAP[cleanSymbol];
      if (assetIdx === undefined) {
        return new Response(JSON.stringify({ error: `Unsupported asset: ${cleanSymbol}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // FIX #1: Validate entry price against current market price
      const midPrice = await getMidPrice(cleanSymbol);
      const entryPrice = parseFloat(signal.entry);
      const priceDrift = Math.abs(entryPrice - midPrice) / midPrice;

      if (priceDrift > 0.02) {
        // Entry price is >2% away from current market — reject stale signal
        return new Response(JSON.stringify({
          error: `Entry price ${entryPrice} is ${(priceDrift * 100).toFixed(1)}% away from market (${midPrice}). Signal may be stale.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get fresh balance
      const hlState = await getHLState(walletAddress);
      const totalCapital = parseFloat(hlState.marginSummary?.accountValue || "0");

      if (totalCapital <= 0) {
        return new Response(JSON.stringify({ error: "No capital available" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tradeCapital = totalCapital * CAPITAL_PERCENT;

      // FIX #5: Use proper size rounding per asset
      const rawSize = (tradeCapital * LEVERAGE) / entryPrice;
      const posSize = roundSize(rawSize, cleanSymbol);
      const estFees = estimateFees(tradeCapital);

      // Round prices properly
      const roundedEntry = roundPrice(entryPrice, cleanSymbol);
      const roundedSL = signal.stopLoss ? roundPrice(parseFloat(signal.stopLoss), cleanSymbol) : undefined;
      const roundedTP1 = signal.takeProfit1 ? roundPrice(parseFloat(signal.takeProfit1), cleanSymbol) : undefined;

      // ── SECURITY (C-06): PRE-TRADE RISK CIRCUIT BREAKERS ──
      // 1. Stop-loss is mandatory. No SL = no trade.
      if (!signal.stopLoss || !roundedSL) {
        return new Response(JSON.stringify({
          error: "RISK_GATE: Stop-loss is required. Refusing market order with no SL.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const slPriceNum = parseFloat(roundedSL);
      const slDistancePct = Math.abs(entryPrice - slPriceNum) / entryPrice;
      if (slDistancePct < MIN_SL_DISTANCE_PCT || slDistancePct > MAX_SL_DISTANCE_PCT) {
        return new Response(JSON.stringify({
          error: `RISK_GATE: SL distance ${(slDistancePct * 100).toFixed(2)}% out of bounds [${MIN_SL_DISTANCE_PCT * 100}%–${MAX_SL_DISTANCE_PCT * 100}%].`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // 2. Implied loss at SL must not exceed MAX_LOSS_PCT_OF_EQUITY of total equity.
      const positionNotional = parseFloat(posSize) * entryPrice;
      const impliedLoss = positionNotional * slDistancePct;
      const maxAllowedLoss = totalCapital * MAX_LOSS_PCT_OF_EQUITY;
      if (impliedLoss > maxAllowedLoss) {
        return new Response(JSON.stringify({
          error: `RISK_GATE: Implied SL loss $${impliedLoss.toFixed(2)} exceeds max $${maxAllowedLoss.toFixed(2)} (${MAX_LOSS_PCT_OF_EQUITY * 100}% of $${totalCapital.toFixed(2)} equity). Reduce position size or tighten SL.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // 3. Drawdown circuit breaker: halt bot if current equity < peak * (1 - MAX_DRAWDOWN_HALT_PCT).
      const peakEquity = (state as any).peak_equity ? parseFloat((state as any).peak_equity) : totalCapital;
      if (peakEquity > 0 && totalCapital < peakEquity * (1 - MAX_DRAWDOWN_HALT_PCT)) {
        await serviceDb.from("lavba_bot_state").update({
          enabled: false,
          emergency_stopped: true,
          emergency_reason: `DRAWDOWN_HALT: equity $${totalCapital.toFixed(2)} fell ${(((peakEquity - totalCapital) / peakEquity) * 100).toFixed(2)}% below peak $${peakEquity.toFixed(2)}`,
        }).eq("user_id", user.id);
        return new Response(JSON.stringify({
          error: `RISK_GATE: Drawdown circuit breaker triggered. Bot halted. Manual restart required.`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Track peak equity going forward
      if (totalCapital > peakEquity) {
        await serviceDb.from("lavba_bot_state").update({ peak_equity: totalCapital } as any).eq("user_id", user.id).then(() => {}, () => {});
      }


      // Place the trade
      const result = await placeOrder({
        privateKey,
        asset: assetIdx,
        isBuy: signal.direction === "LONG",
        price: roundedEntry,
        size: posSize,
        leverage: LEVERAGE,
        slPrice: roundedSL,
        tpPrices: roundedTP1 ? [roundedTP1] : [],
      });

      // FIX #3: Check fill confirmation from order result
      let fillStatus = "open";
      let fillWarning: string | undefined;

      if (result?.response?.data?.statuses) {
        const statuses = result.response.data.statuses;
        const firstStatus = statuses[0];
        if (firstStatus?.error) {
          return new Response(JSON.stringify({
            error: `Order rejected by exchange: ${firstStatus.error}`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (firstStatus?.resting) {
          fillStatus = "pending";
          fillWarning = "Order is resting (not yet filled). Will be tracked.";
        }
        // "filled" status means immediate fill
      }

      // Record trade in database
      const nextCoin = cleanSymbol === "BTC" ? "ETH" : "BTC";

      const { data: trade } = await serviceDb.from("lavba_trades").insert({
        user_id: user.id,
        symbol: cleanSymbol,
        direction: signal.direction,
        entry_price: entryPrice,
        stop_loss: signal.stopLoss ? parseFloat(signal.stopLoss) : null,
        take_profit1: signal.takeProfit1 ? parseFloat(signal.takeProfit1) : null,
        take_profit2: null,
        take_profit3: null,
        position_size: parseFloat(posSize),
        size_usd: tradeCapital,
        leverage: LEVERAGE,
        fees: estFees,
        status: fillStatus,
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
        fillWarning,
        details: {
          symbol: cleanSymbol,
          direction: signal.direction,
          entry: roundedEntry,
          marketPrice: midPrice,
          sizeUsd: tradeCapital.toFixed(2),
          positionSize: posSize,
          leverage: LEVERAGE,
          estimatedFees: estFees.toFixed(2),
          nextCoin,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SYNC TRADE STATUS ──
    if (action === "sync_trades") {
      const positions = await getOpenPositions(walletAddress);
      const hlState = await getHLState(walletAddress);
      const currentCapital = parseFloat(hlState.marginSummary?.accountValue || "0");

      // FIX #2: Fetch actual fill history for accurate PNL
      const fills = await getUserFills(walletAddress);

      const { data: openTrades } = await supabase.from("lavba_trades").select("*").eq("user_id", user.id).in("status", ["open", "pending", "partial_tp"]);

      const results: any[] = [];

      for (const trade of (openTrades || [])) {
        const positionExists = positions.some((p: any) =>
          p.position?.coin === trade.symbol && Math.abs(parseFloat(p.position?.szi || "0")) > 0
        );

        if (!positionExists) {
          // Position closed — calculate actual PNL from fills
          const tradeFills = fills.filter((f: any) =>
            f.coin === trade.symbol &&
            new Date(f.time).getTime() >= new Date(trade.opened_at).getTime()
          );

          // Calculate actual average exit price from closing fills
          let exitPrice = trade.entry_price;
          let realizedPnl = 0;
          let totalFees = 0;

          if (tradeFills.length > 0) {
            // Separate entry fills and exit fills
            const isLong = trade.direction === "LONG";
            const exitFills = tradeFills.filter((f: any) =>
              isLong ? f.side === "A" : f.side === "B" // A = sell, B = buy
            );

            if (exitFills.length > 0) {
              // Weighted average exit price
              let totalExitSize = 0;
              let weightedExitPrice = 0;
              for (const f of exitFills) {
                const sz = parseFloat(f.sz || "0");
                const px = parseFloat(f.px || "0");
                weightedExitPrice += sz * px;
                totalExitSize += sz;
                totalFees += parseFloat(f.fee || "0");
              }
              exitPrice = totalExitSize > 0 ? weightedExitPrice / totalExitSize : trade.entry_price;

              // Calculate PNL from actual prices
              realizedPnl = isLong
                ? (exitPrice - trade.entry_price) * trade.position_size
                : (trade.entry_price - exitPrice) * trade.position_size;
              realizedPnl -= totalFees;
            } else {
              // Use closedPnl from fills if available
              const closingFill = tradeFills.find((f: any) => f.closedPnl && parseFloat(f.closedPnl) !== 0);
              if (closingFill) {
                realizedPnl = parseFloat(closingFill.closedPnl);
                exitPrice = parseFloat(closingFill.px);
              }
            }
          }

          await serviceDb.from("lavba_trades").update({
            status: "closed",
            exit_price: exitPrice,
            realized_pnl: realizedPnl,
            fees: totalFees > 0 ? totalFees : (trade.fees || 0),
            closed_at: new Date().toISOString(),
          }).eq("id", trade.id);

          results.push({ id: trade.id, status: "closed", pnl: realizedPnl, exitPrice });

          // Update PNL snapshot
          const today = new Date().toISOString().split("T")[0];
          const isWin = realizedPnl > 0;

          await serviceDb.from("lavba_pnl_snapshots").upsert({
            user_id: user.id,
            period_type: "day",
            period_date: today,
            realized_pnl: realizedPnl,
            fees_paid: totalFees > 0 ? totalFees : (trade.fees || 0),
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

      // Also check for "pending" trades that may have been filled or expired
      const { data: pendingTrades } = await supabase.from("lavba_trades").select("*").eq("user_id", user.id).eq("status", "pending");
      for (const trade of (pendingTrades || [])) {
        const positionExists = positions.some((p: any) =>
          p.position?.coin === trade.symbol && Math.abs(parseFloat(p.position?.szi || "0")) > 0
        );
        if (positionExists) {
          // Pending order filled — update to open
          await serviceDb.from("lavba_trades").update({ status: "open" }).eq("id", trade.id);
          results.push({ id: trade.id, status: "open", note: "Pending order now filled" });
        }
        // If pending for >24h with no fill, mark as expired
        const openedAt = new Date(trade.opened_at).getTime();
        const now = Date.now();
        if (!positionExists && (now - openedAt) > 24 * 60 * 60 * 1000) {
          await serviceDb.from("lavba_trades").update({
            status: "expired",
            closed_at: new Date().toISOString(),
          }).eq("id", trade.id);
          results.push({ id: trade.id, status: "expired", note: "Order expired after 24h without fill" });
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
