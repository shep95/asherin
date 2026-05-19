import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Zap, Activity, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Target, Shield, Clock, BarChart3, RefreshCw,
  StopCircle, X, ChevronDown, ChevronUp, Wallet, Percent,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/adminEmail";

const ADMIN_EMAIL = ADMIN_EMAIL;

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number;
  take_profit1: number;
  take_profit2: number | null;
  take_profit3: number | null;
  position_size: number;
  size_usd: number;
  leverage: number;
  fees: number;
  realized_pnl: number | null;
  status: string;
  signal_confidence: number;
  signal_reasoning: string;
  opened_at: string;
  closed_at: string | null;
}

interface BotState {
  enabled: boolean;
  emergency_stopped: boolean;
  emergency_reason: string | null;
  current_coin: string;
  last_trade_date: string | null;
  daily_trade_count: number;
  total_capital: number;
  available_capital: number;
  total_fees_paid: number;
}

interface PnlData {
  pnl: number;
  fees: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getAuthHeaders = async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  } catch {}
  return { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
};

const apiCall = async (action: string, extra: any = {}) => {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyperliquid-trade`, {
    method: "POST", headers, body: JSON.stringify({ action, ...extra }),
  });
  return resp.json();
};

const LavbaAutoTrade = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [loading, setLoading] = useState(true);
  const [botState, setBotState] = useState<BotState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [hlBalance, setHlBalance] = useState({ accountValue: "0", availableBalance: "0" });
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [pnl, setPnl] = useState<{ today: PnlData; month: PnlData; year: PnlData; allTime: PnlData } | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState<"hold" | "close_all" | "cancel_pending">("hold");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval>>();

  const loadDashboard = useCallback(async () => {
    try {
      const [dash, pnlData] = await Promise.all([apiCall("get_dashboard"), apiCall("get_pnl")]);
      if (dash.botState) setBotState(dash.botState);
      if (dash.trades) setTrades(dash.trades);
      if (dash.hlBalance) setHlBalance(dash.hlBalance);
      if (dash.openPositions) setOpenPositions(dash.openPositions);
      if (pnlData.today) setPnl(pnlData);
    } catch (e) { console.error("Dashboard load error:", e); }
    setLoading(false);
  }, []);

  const initBot = async () => {
    const res = await apiCall("init_bot");
    if (res.state) setBotState(res.state);
  };

  const toggleBot = async () => {
    if (!botState) return;
    const res = await apiCall("toggle_bot", { enabled: !botState.enabled });
    if (res.state) setBotState(res.state);
    loadDashboard();
  };

  const emergencyStop = async () => {
    await apiCall("emergency_stop", { mode: emergencyMode, reason: emergencyReason || "Manual stop" });
    setShowEmergency(false);
    loadDashboard();
  };

  const syncTrades = async () => {
    setSyncing(true);
    await apiCall("sync_trades");
    await loadDashboard();
    setSyncing(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
      refreshRef.current = setInterval(loadDashboard, 30000); // Refresh every 30s
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [isAdmin, loadDashboard]);

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 text-accent animate-spin" />
      </div>
    );
  }

  if (!botState) {
    return (
      <div className="text-center py-20 space-y-4">
        <Zap className="h-10 w-10 text-muted-foreground/10 mx-auto" />
        <p className="text-sm font-extralight text-muted-foreground/30">Auto-trading not initialized</p>
        <button onClick={initBot} className="px-4 py-2 rounded-xl bg-accent/15 border border-accent/20 text-xs font-light text-accent hover:bg-accent/25 transition-all">
          Initialize Trading Bot
        </button>
      </div>
    );
  }

  const totalValue = parseFloat(hlBalance.accountValue);
  const activeTrades = trades.filter(t => ["open", "pending", "partial_tp"].includes(t.status));
  const closedTrades = trades.filter(t => t.status === "closed" || t.status === "stopped");
  const todayPnl = pnl?.today.pnl || 0;
  const allTimePnl = pnl?.allTime.pnl || 0;

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap className="h-5 w-5 text-accent" />
            {botState.enabled && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-light text-foreground tracking-wide">Auto-Trading</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                botState.enabled ? "bg-accent/15 text-accent" :
                botState.emergency_stopped ? "bg-destructive/15 text-destructive" :
                "bg-muted/15 text-muted-foreground/50"
              }`}>
                {botState.enabled ? "● LIVE" : botState.emergency_stopped ? "⊘ STOPPED" : "○ OFF"}
              </span>
            </div>
            <p className="text-[9px] font-extralight text-muted-foreground/40">
              Next: {botState.current_coin} · 10x Leverage · 90% Capital · 1D Chart
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={syncTrades} disabled={syncing} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background/20 border border-border/15 text-[10px] text-muted-foreground/50 hover:text-foreground transition-all">
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            onClick={toggleBot}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              botState.enabled
                ? "bg-accent/15 border border-accent/25 text-accent hover:bg-accent/25"
                : "bg-background/20 border border-border/15 text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {botState.enabled ? "Disable Bot" : "Enable Bot"}
          </button>
          <button
            onClick={() => setShowEmergency(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] text-destructive hover:bg-destructive/20 transition-all"
          >
            <StopCircle className="h-3 w-3" />
            Emergency Stop
          </button>
        </div>
      </div>

      {/* Emergency stopped banner */}
      {botState.emergency_stopped && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.05] p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-[11px] font-extralight text-destructive">
            Emergency stopped{botState.emergency_reason ? `: ${botState.emergency_reason}` : ""}
          </span>
        </div>
      )}

      {/* ── PORTFOLIO OVERVIEW ── */}
      <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Portfolio Overview</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl bg-background/20 border border-border/10 p-3">
            <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">Total Value</p>
            <p className="text-lg font-light text-foreground mt-1">${fmt(totalValue)}</p>
          </div>
          <div className="rounded-xl bg-background/20 border border-border/10 p-3">
            <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">Today P&L</p>
            <p className={`text-lg font-light mt-1 ${todayPnl >= 0 ? "text-accent" : "text-destructive"}`}>
              {todayPnl >= 0 ? "+" : ""}{fmt(todayPnl)}
            </p>
            {totalValue > 0 && (
              <p className={`text-[9px] ${todayPnl >= 0 ? "text-accent/60" : "text-destructive/60"}`}>
                {todayPnl >= 0 ? "+" : ""}{((todayPnl / totalValue) * 100).toFixed(2)}%
              </p>
            )}
          </div>
          <div className="rounded-xl bg-background/20 border border-border/10 p-3">
            <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">All-Time P&L</p>
            <p className={`text-lg font-light mt-1 ${allTimePnl >= 0 ? "text-accent" : "text-destructive"}`}>
              {allTimePnl >= 0 ? "+" : ""}{fmt(allTimePnl)}
            </p>
          </div>
          <div className="rounded-xl bg-background/20 border border-border/10 p-3">
            <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">Total Fees</p>
            <p className="text-lg font-light text-muted-foreground mt-1">${fmt(botState.total_fees_paid || 0)}</p>
          </div>
        </div>

        {/* PNL breakdown */}
        {pnl && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Today", data: pnl.today },
              { label: "Month", data: pnl.month },
              { label: "Year", data: pnl.year },
              { label: "All-Time", data: pnl.allTime },
            ].map((p, i) => (
              <div key={i} className="rounded-xl bg-background/10 border border-border/5 p-2.5 text-center">
                <p className="text-[7px] text-muted-foreground/30 uppercase tracking-[0.1em]">{p.label}</p>
                <p className={`text-xs font-light mt-0.5 ${p.data.pnl >= 0 ? "text-accent" : "text-destructive"}`}>
                  {p.data.pnl >= 0 ? "+" : ""}${fmt(p.data.pnl)}
                </p>
                <p className="text-[8px] text-muted-foreground/30 mt-0.5">
                  {p.data.trades}T · {p.data.wins}W · {p.data.losses}L
                </p>
                {p.data.trades > 0 && (
                  <p className="text-[8px] text-muted-foreground/20">WR: {(p.data.winRate * 100).toFixed(0)}%</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ACTIVE POSITIONS ── */}
      <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-accent/60" />
            <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
              Active Positions ({activeTrades.length})
            </span>
          </div>
        </div>

        {activeTrades.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[11px] font-extralight text-muted-foreground/25">No active positions</p>
            <p className="text-[9px] font-extralight text-muted-foreground/15 mt-1">
              Next trade: {botState.current_coin} on 1D chart
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTrades.map(trade => {
              const livePos = openPositions.find((p: any) => p.position?.coin === trade.symbol);
              const unrealizedPnl = livePos ? parseFloat(livePos.position?.unrealizedPnl || "0") : 0;
              const currentPrice = livePos ? parseFloat(livePos.position?.entryPx || String(trade.entry_price)) : trade.entry_price;
              const pnlPct = trade.size_usd > 0 ? (unrealizedPnl / trade.size_usd) * 100 : 0;
              const isUp = unrealizedPnl >= 0;

              // Calculate progress to TP/SL
              const range = trade.take_profit1 - trade.entry_price;
              const progress = range !== 0 ? ((currentPrice - trade.entry_price) / range) * 100 : 0;

              const expanded = expandedTrade === trade.id;

              return (
                <div key={trade.id} className="rounded-xl border border-border/10 bg-background/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedTrade(expanded ? null : trade.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-background/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${
                        trade.direction === "LONG" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"
                      }`}>
                        {trade.direction === "LONG" ? "▲" : "▼"} {trade.symbol}
                      </div>
                      <span className="text-xs font-light text-foreground">${fmt(trade.entry_price)}</span>
                      <span className={`text-[11px] font-medium ${isUp ? "text-accent" : "text-destructive"}`}>
                        {isUp ? "+" : ""}{fmt(unrealizedPnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground/30">
                        {new Date(trade.opened_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border/10 p-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "Entry", value: `$${fmt(trade.entry_price)}`, color: "text-foreground" },
                          { label: "Stop Loss", value: `$${fmt(trade.stop_loss)}`, color: "text-destructive" },
                          { label: "TP1", value: `$${fmt(trade.take_profit1)}`, color: "text-accent" },
                          { label: "TP2", value: trade.take_profit2 ? `$${fmt(trade.take_profit2)}` : "—", color: "text-accent" },
                          { label: "TP3", value: trade.take_profit3 ? `$${fmt(trade.take_profit3)}` : "—", color: "text-accent" },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg bg-background/20 border border-border/5 p-2 text-center">
                            <p className="text-[7px] text-muted-foreground/30 uppercase">{s.label}</p>
                            <p className={`text-[11px] font-light ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-[8px] text-muted-foreground/30 mb-1">
                          <span>SL ${fmt(trade.stop_loss)}</span>
                          <span>{Math.max(0, Math.min(100, progress)).toFixed(0)}% to TP1</span>
                          <span>TP ${fmt(trade.take_profit1)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-background/30 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isUp ? "bg-accent/50" : "bg-destructive/50"}`}
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[7px] text-muted-foreground/30 uppercase">Size</p>
                          <p className="text-[10px] font-light text-foreground">${fmt(trade.size_usd)}</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-muted-foreground/30 uppercase">Leverage</p>
                          <p className="text-[10px] font-light text-foreground">{trade.leverage}x</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-muted-foreground/30 uppercase">Confidence</p>
                          <p className="text-[10px] font-light text-accent">{Math.round((trade.signal_confidence || 0) * 100)}%</p>
                        </div>
                      </div>

                      {trade.signal_reasoning && (
                        <div className="rounded-lg bg-background/10 border border-border/5 p-2">
                          <p className="text-[8px] text-muted-foreground/30 uppercase mb-1">Signal Reasoning</p>
                          <p className="text-[10px] font-extralight text-muted-foreground/50 leading-relaxed">{trade.signal_reasoning}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PERFORMANCE METRICS ── */}
      {pnl && pnl.allTime.trades > 0 && (
        <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-3.5 w-3.5 text-accent/60" />
            <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Performance Metrics</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-background/20 border border-border/10 p-3 text-center">
              <p className="text-[8px] text-muted-foreground/40 uppercase">Win Rate</p>
              <p className="text-xl font-light text-foreground mt-1">{(pnl.allTime.winRate * 100).toFixed(1)}%</p>
              <p className="text-[9px] text-muted-foreground/30">{pnl.allTime.wins}W / {pnl.allTime.losses}L</p>
            </div>
            <div className="rounded-xl bg-background/20 border border-border/10 p-3 text-center">
              <p className="text-[8px] text-muted-foreground/40 uppercase">Total Trades</p>
              <p className="text-xl font-light text-foreground mt-1">{pnl.allTime.trades}</p>
            </div>
            <div className="rounded-xl bg-background/20 border border-border/10 p-3 text-center">
              <p className="text-[8px] text-muted-foreground/40 uppercase">Avg P&L / Trade</p>
              <p className={`text-xl font-light mt-1 ${(pnl.allTime.pnl / pnl.allTime.trades) >= 0 ? "text-accent" : "text-destructive"}`}>
                ${fmt(pnl.allTime.pnl / pnl.allTime.trades)}
              </p>
            </div>
            <div className="rounded-xl bg-background/20 border border-border/10 p-3 text-center">
              <p className="text-[8px] text-muted-foreground/40 uppercase">Fee Impact</p>
              <p className="text-xl font-light text-muted-foreground mt-1">${fmt(pnl.allTime.fees)}</p>
              {pnl.allTime.pnl !== 0 && (
                <p className="text-[9px] text-muted-foreground/30">{((pnl.allTime.fees / Math.abs(pnl.allTime.pnl)) * 100).toFixed(1)}% of P&L</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RECENT TRADES ── */}
      {closedTrades.length > 0 && (
        <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-3.5 w-3.5 text-accent/60" />
            <span className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
              Trade History ({closedTrades.length})
            </span>
          </div>

          <div className="space-y-1">
            {closedTrades.slice(0, 15).map(trade => {
              const isWin = (trade.realized_pnl || 0) > 0;
              return (
                <div key={trade.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${isWin ? "bg-accent" : "bg-destructive"}`} />
                    <span className={`text-[10px] font-medium ${
                      trade.direction === "LONG" ? "text-accent/70" : "text-destructive/70"
                    }`}>
                      {trade.direction === "LONG" ? "▲" : "▼"} {trade.symbol}
                    </span>
                    <span className="text-[10px] font-light text-muted-foreground/40">
                      ${fmt(trade.entry_price)} → ${trade.exit_price ? fmt(trade.exit_price) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-light ${isWin ? "text-accent" : "text-destructive"}`}>
                      {(trade.realized_pnl || 0) >= 0 ? "+" : ""}${fmt(trade.realized_pnl || 0)}
                    </span>
                    <span className="text-[8px] text-muted-foreground/25">
                      {trade.closed_at ? new Date(trade.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                      trade.status === "closed" ? "bg-accent/10 text-accent/50" :
                      trade.status === "stopped" ? "bg-destructive/10 text-destructive/50" :
                      "bg-muted/10 text-muted-foreground/40"
                    }`}>{trade.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOT CONFIG INFO ── */}
      <div className="rounded-2xl border border-border/10 bg-card/5 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-3 w-3 text-muted-foreground/30" />
          <span className="text-[9px] font-light tracking-[0.1em] text-muted-foreground/30 uppercase">Bot Configuration</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {[
            { label: "Leverage", value: "10x" },
            { label: "Capital / Trade", value: "90%" },
            { label: "Max Trades / Day", value: "1" },
            { label: "Coins", value: "BTC ↔ ETH" },
            { label: "Timeframe", value: "1D" },
          ].map((c, i) => (
            <div key={i} className="rounded-lg bg-background/10 border border-border/5 p-2">
              <p className="text-[7px] text-muted-foreground/25 uppercase">{c.label}</p>
              <p className="text-[10px] font-light text-muted-foreground/50 mt-0.5">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── EMERGENCY STOP MODAL ── */}
      {showEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StopCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm font-light text-foreground">Emergency Stop</span>
              </div>
              <button onClick={() => setShowEmergency(false)} className="p-1 rounded-lg hover:bg-background/20 transition-all">
                <X className="h-4 w-4 text-muted-foreground/50" />
              </button>
            </div>

            <div className="rounded-xl border border-destructive/10 bg-destructive/[0.05] p-3 mb-4">
              <p className="text-[11px] font-extralight text-destructive/70">
                ⚠️ This will immediately stop the auto-trading bot
              </p>
              <p className="text-[10px] font-extralight text-muted-foreground/40 mt-1">
                Active positions: {activeTrades.length} · Total value: ${fmt(totalValue)}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { value: "hold" as const, label: "Hold positions, stop new trades", desc: "Keep current positions open, no new trades" },
                { value: "close_all" as const, label: "Close all positions immediately", desc: "Market sell everything right now" },
                { value: "cancel_pending" as const, label: "Cancel pending orders only", desc: "Keep filled positions, remove unfilled orders" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setEmergencyMode(opt.value)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    emergencyMode === opt.value
                      ? "border-destructive/30 bg-destructive/[0.05]"
                      : "border-border/10 hover:border-border/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      emergencyMode === opt.value ? "border-destructive bg-destructive" : "border-muted-foreground/20"
                    }`} />
                    <span className="text-[11px] font-light text-foreground">{opt.label}</span>
                  </div>
                  <p className="text-[9px] font-extralight text-muted-foreground/40 ml-5 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            <input
              value={emergencyReason}
              onChange={e => setEmergencyReason(e.target.value)}
              placeholder="Reason (optional)..."
              className="w-full bg-background/30 border border-border/15 rounded-xl px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/25 outline-none mb-4"
            />

            <div className="flex gap-2">
              <button onClick={() => setShowEmergency(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-border/15 text-xs font-light text-muted-foreground hover:text-foreground transition-all">
                Cancel
              </button>
              <button onClick={emergencyStop} className="flex-1 px-4 py-2.5 rounded-xl bg-destructive/15 border border-destructive/25 text-xs font-medium text-destructive hover:bg-destructive/25 transition-all">
                EMERGENCY STOP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LavbaAutoTrade;
