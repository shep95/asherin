import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);
const HL_API = "https://api.hyperliquid.xyz";
const LEVERAGE = 10;
const CAPITAL_PERCENT = 0.90;

// Brent Oil on Hyperliquid — if available. Fallback logic included.
const OIL_SYMBOL = "OIL";
const OIL_ASSET_IDX = -1; // Will be resolved dynamically

const log = (step: string, details?: any) => {
  console.log(`[AZIION] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { action, userId } = body;

    // ── Resolve adminUserId securely ──
    // Priority: 1) JWT identity (admin only); 2) Cron secret with body userId; otherwise reject.
    let adminUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!isAuthorizedAdminEmail(user?.email)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      adminUserId = user!.id;
    } else if (isCron && userId) {
      adminUserId = userId;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // ── GET STATUS ──
    if (action === "get_status") {
      const [botState, sessions, trades] = await Promise.all([
        sb.from("aziion_bot_state").select("*").eq("user_id", adminUserId).maybeSingle(),
        sb.from("aziion_sessions").select("*").eq("user_id", adminUserId).order("created_at", { ascending: false }).limit(20),
        sb.from("aziion_trades").select("*").eq("user_id", adminUserId).order("opened_at", { ascending: false }).limit(50),
      ]);

      // Get HL balance
      let hlBalance = { accountValue: "0", availableBalance: "0" };
      try {
        const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS");
        if (walletAddress) {
          const resp = await fetch(`${HL_API}/info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
          });
          const state = await resp.json();
          hlBalance = {
            accountValue: state.marginSummary?.accountValue || "0",
            availableBalance: state.marginSummary?.totalRawUsd || "0",
          };
        }
      } catch {}

      return new Response(JSON.stringify({
        botState: botState.data,
        sessions: sessions.data || [],
        trades: trades.data || [],
        hlBalance,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── INIT BOT ──
    if (action === "init_bot") {
      const { data } = await sb.from("aziion_bot_state").upsert({
        user_id: adminUserId,
        enabled: false,
        emergency_stopped: false,
      }, { onConflict: "user_id" }).select().single();

      return new Response(JSON.stringify({ success: true, state: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── TOGGLE BOT ──
    if (action === "toggle_bot") {
      const { enabled } = body;
      const { data } = await sb.from("aziion_bot_state").update({
        enabled,
        emergency_stopped: false,
        emergency_reason: null,
        next_prediction_at: enabled ? new Date(Date.now() + 5000).toISOString() : null, // First prediction in 5s
      }).eq("user_id", adminUserId).select().single();

      return new Response(JSON.stringify({ success: true, state: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EMERGENCY STOP ──
    if (action === "emergency_stop") {
      await sb.from("aziion_bot_state").update({
        enabled: false,
        emergency_stopped: true,
        emergency_reason: body.reason || "Manual emergency stop",
      }).eq("user_id", adminUserId);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── RUN PREDICTION (the core logic) ──
    if (action === "run_prediction") {
      log("Starting Brent Oil prediction cycle");

      // Check for active trade
      const { data: activeTrades } = await sb.from("aziion_trades")
        .select("id")
        .eq("user_id", adminUserId)
        .in("status", ["open", "pending"])
        .limit(1);

      if (activeTrades && activeTrades.length > 0) {
        log("Active trade exists, skipping prediction");
        return new Response(JSON.stringify({ skipped: true, reason: "Active trade exists" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create session
      const { data: session } = await sb.from("aziion_sessions").insert({
        user_id: adminUserId,
        title: `Brent Oil — ${new Date().toISOString().split("T")[0]}`,
        status: "analyzing",
      }).select().single();

      if (!session) throw new Error("Failed to create session");

      // ═══════════════════════════════════
      // STEP 1: Gather Brent Oil intelligence
      // ═══════════════════════════════════
      log("Gathering Brent Oil market intelligence");

      const searchPromises = [];
      let oilMarketData = "";
      let geopoliticalData = "";
      let technicalData = "";

      // Market data search
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `Search for the latest Brent crude oil price, market data, OPEC decisions, supply/demand reports, inventory data (EIA, API), and price forecasts from major banks and analysts. Include exact current price, recent highs/lows, and any breaking oil market news from the last 24 hours. Return only raw factual data with numbers and dates.` }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            oilMarketData = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";
          } else {
            const errBody = await resp.text();
            log("Oil market search failed", { status: resp.status, body: errBody.slice(0, 300) });
          }
        } catch (e: any) { log("Oil market search error", e.message); }
      })());

      // Geopolitical factors
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `Search for the latest geopolitical events affecting oil prices: Middle East tensions, Russia-Ukraine conflict impact on energy, Iran sanctions, OPEC+ production decisions, US strategic petroleum reserve status, China demand outlook, shipping/Strait of Hormuz news. Return only factual data from the last 48 hours.` }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            geopoliticalData = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";
          } else {
            log("Geo search failed", { status: resp.status });
          }
        } catch (e: any) { log("Geopolitical search error", e.message); }
      })());

      // Technical analysis
      searchPromises.push((async () => {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: `Search for Brent crude oil technical analysis: support/resistance levels, RSI, MACD, moving averages (50, 100, 200 day), chart patterns, volume analysis, and any technical analyst forecasts for the next 24-72 hours. Return specific numbers and levels.` }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
              }),
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            technicalData = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";
          } else {
            log("Tech search failed", { status: resp.status });
          }
        } catch (e: any) { log("Technical search error", e.message); }
      })());

      await Promise.all(searchPromises);
      log("Intelligence gathered", { market: oilMarketData.length, geo: geopoliticalData.length, tech: technicalData.length });

      // ═══════════════════════════════════
      // STEP 2: Load AXRLEN brains for pattern analysis
      // ═══════════════════════════════════
      // Note: AZIION does NOT use axrlen_brains — it's a pure data-driven trading bot

      // ═══════════════════════════════════
      // STEP 3: AI Prediction
      // ═══════════════════════════════════
      const trimmedMarket = (oilMarketData || "No data").slice(0, 1500);
      const trimmedGeo = (geopoliticalData || "No data").slice(0, 1500);
      const trimmedTech = (technicalData || "No data").slice(0, 1500);

      const predictionPrompt = `You are a quantitative Brent crude oil trading algorithm. Return ONLY a compact JSON object with your trade signal.

MARKET: ${trimmedMarket}

GEO: ${trimmedGeo}

TECH: ${trimmedTech}

Return ONLY this JSON (no markdown, no extra text):
{"direction":"LONG","confidence":75,"current_price":65.5,"entry_price":65.5,"take_profit":67.0,"stop_loss":64.0,"reasoning":"brief reason","key_factors":["f1","f2"],"timeframe":"24h"}`;

      log("Running AI prediction");

      let predData: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const predResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: predictionPrompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
            }),
          }
        );
        if (predResp.ok) {
          predData = await predResp.json();
          break;
        }
        log(`Gemini attempt ${attempt + 1} failed: ${predResp.status}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
      }
      if (!predData) throw new Error("Gemini API failed after 3 retries");

      const rawPrediction = predData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      log("Raw prediction received", { length: rawPrediction.length });

      // Parse JSON from response (handle markdown wrapping)
      let prediction: any;
      try {
        const jsonMatch = rawPrediction.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in prediction");
        prediction = JSON.parse(jsonMatch[0]);
      } catch (e) {
        log("Failed to parse prediction JSON", { raw: rawPrediction.slice(0, 500) });
        await sb.from("aziion_sessions").update({
          status: "failed",
          ai_prediction: rawPrediction,
        }).eq("id", session.id);
        throw new Error("Failed to parse AI prediction");
      }

      log("Prediction parsed", prediction);

      // Update session with prediction
      await sb.from("aziion_sessions").update({
        status: "predicted",
        ai_prediction: rawPrediction,
        predicted_direction: prediction.direction,
        predicted_entry: prediction.entry_price,
        predicted_tp: prediction.take_profit,
        predicted_sl: prediction.stop_loss,
        confidence_score: prediction.confidence,
        raw_intelligence: JSON.stringify({
          market: oilMarketData.slice(0, 2000),
          geopolitical: geopoliticalData.slice(0, 2000),
          technical: technicalData.slice(0, 2000),
        }),
      }).eq("id", session.id);

      // ═══════════════════════════════════
      // STEP 4: EXECUTE TRADE on Hyperliquid
      // ═══════════════════════════════════
      const privateKey = Deno.env.get("HYPERLIQUID_PRIVATE_KEY");
      const walletAddress = Deno.env.get("HYPERLIQUID_WALLET_ADDRESS");
      
      let tradeResult: any = null;
      let tradePlaced = false;

      if (privateKey && walletAddress && prediction.confidence >= 60) {
        log("Attempting trade execution");

        try {
          // Get available assets on Hyperliquid
          const metaResp = await fetch(`${HL_API}/info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "meta" }),
          });
          const meta = await metaResp.json();
          
          // Find oil/commodity asset
          const oilAsset = meta.universe?.find((a: any) => 
            a.name === "OIL" || a.name === "BRENT" || a.name === "WTI" || a.name === "CRUDE"
          );

          if (!oilAsset) {
            log("OIL asset not found on Hyperliquid — recording prediction only");
            await sb.from("aziion_sessions").update({
              status: "predicted_no_trade",
              trade_placed: false,
            }).eq("id", session.id);
          } else {
            const assetIdx = meta.universe.indexOf(oilAsset);
            
            // Get HL state for capital
            const hlStateResp = await fetch(`${HL_API}/info`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "clearinghouseState", user: walletAddress }),
            });
            const hlState = await hlStateResp.json();
            const totalCapital = parseFloat(hlState.marginSummary?.accountValue || "0");

            if (totalCapital <= 0) {
              log("No capital available");
            } else {
              const tradeCapital = totalCapital * CAPITAL_PERCENT;
              const entryPrice = prediction.entry_price;
              const rawSize = (tradeCapital * LEVERAGE) / entryPrice;
              const posSize = rawSize.toFixed(4);

              const { privateKeyToAccount } = await import("npm:viem@2.21.0/accounts");
              const { HttpTransport, ExchangeClient } = await import("npm:@nktkas/hyperliquid@5");

              const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
              const account = privateKeyToAccount(pk as `0x${string}`);
              const transport = new HttpTransport();
              const exchange = new ExchangeClient({ wallet: account, transport });

              // Set leverage
              try {
                await exchange.updateLeverage({ asset: assetIdx, isCross: true, leverage: LEVERAGE });
              } catch {}

              // Place entry order
              const result = await exchange.order({
                orders: [{
                  a: assetIdx,
                  b: prediction.direction === "LONG",
                  p: entryPrice.toFixed(2),
                  s: posSize,
                  r: false,
                  t: { limit: { tif: "Gtc" } },
                }],
                grouping: "na",
              });

              // Place TP
              if (prediction.take_profit) {
                try {
                  await exchange.order({
                    orders: [{
                      a: assetIdx,
                      b: prediction.direction !== "LONG",
                      p: prediction.take_profit.toFixed(2),
                      s: posSize,
                      r: true,
                      t: { trigger: { triggerPx: prediction.take_profit.toFixed(2), isMarket: true, tpsl: "tp" } },
                    }],
                    grouping: "na",
                  });
                } catch (e) { log("TP order error", e); }
              }

              // Place SL
              if (prediction.stop_loss) {
                try {
                  await exchange.order({
                    orders: [{
                      a: assetIdx,
                      b: prediction.direction !== "LONG",
                      p: prediction.stop_loss.toFixed(2),
                      s: posSize,
                      r: true,
                      t: { trigger: { triggerPx: prediction.stop_loss.toFixed(2), isMarket: true, tpsl: "sl" } },
                    }],
                    grouping: "na",
                  });
                } catch (e) { log("SL order error", e); }
              }

              // Record trade
              const { data: trade } = await sb.from("aziion_trades").insert({
                user_id: adminUserId,
                session_id: session.id,
                symbol: oilAsset.name,
                direction: prediction.direction,
                entry_price: entryPrice,
                take_profit: prediction.take_profit,
                stop_loss: prediction.stop_loss,
                position_size: parseFloat(posSize),
                size_usd: tradeCapital,
                leverage: LEVERAGE,
                fees: tradeCapital * 0.00035 * 2,
                status: "open",
                signal_confidence: prediction.confidence,
                signal_reasoning: prediction.reasoning,
              }).select().single();

              tradePlaced = true;
              tradeResult = { trade, order: result };

              // Update session
              await sb.from("aziion_sessions").update({
                status: "traded",
                trade_placed: true,
                trade_id: trade?.id,
              }).eq("id", session.id);

              // Update bot state
              await sb.from("aziion_bot_state").update({
                last_prediction_at: new Date().toISOString(),
                next_prediction_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                total_trades: sb.rpc ? undefined : undefined, // Will increment manually
                current_position_id: trade?.id,
              }).eq("user_id", adminUserId);

              log("Trade placed successfully", { tradeId: trade?.id });
            }
          }
        } catch (tradeErr: any) {
          log("Trade execution failed", { error: tradeErr.message });
          await sb.from("aziion_sessions").update({
            status: "prediction_only",
            trade_placed: false,
          }).eq("id", session.id);
        }
      } else {
        log("Trade not executed", { 
          hasKey: !!privateKey, 
          hasWallet: !!walletAddress, 
          confidence: prediction.confidence 
        });
        
        await sb.from("aziion_sessions").update({
          status: prediction.confidence < 60 ? "low_confidence" : "predicted_no_trade",
          trade_placed: false,
        }).eq("id", session.id);
      }

      // Set next prediction
      await sb.from("aziion_bot_state").update({
        last_prediction_at: new Date().toISOString(),
        next_prediction_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq("user_id", adminUserId);

      return new Response(JSON.stringify({
        success: true,
        prediction,
        tradePlaced,
        tradeResult,
        sessionId: session.id,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
