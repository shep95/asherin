import { useState, useEffect, useCallback } from "react";
import { Brain, Droplets, Loader2, Power, PowerOff, AlertTriangle, TrendingUp, TrendingDown, Clock, RefreshCw, Trash2, X, DollarSign, BarChart3, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isOwnerEmail } from "@/lib/adminEmail";
interface BotState {
  enabled: boolean;
  emergency_stopped: boolean;
  emergency_reason: string | null;
  last_prediction_at: string | null;
  next_prediction_at: string | null;
  total_trades: number;
  successful_trades: number;
  total_pnl: number;
  current_position_id: string | null;
}

interface AziionSession {
  id: string;
  title: string;
  status: string;
  ai_prediction: string | null;
  predicted_direction: string | null;
  predicted_entry: number | null;
  predicted_tp: number | null;
  predicted_sl: number | null;
  confidence_score: number | null;
  trade_placed: boolean;
  created_at: string;
}

interface AziionTrade {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  take_profit: number | null;
  stop_loss: number | null;
  position_size: number | null;
  size_usd: number | null;
  leverage: number;
  fees: number;
  status: string;
  pnl: number | null;
  signal_confidence: number | null;
  signal_reasoning: string | null;
  opened_at: string;
  closed_at: string | null;
}

const AziionView = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [botState, setBotState] = useState<BotState | null>(null);
  const [sessions, setSessions] = useState<AziionSession[]>([]);
  const [trades, setTrades] = useState<AziionTrade[]>([]);
  const [hlBalance, setHlBalance] = useState({ accountValue: "0", availableBalance: "0" });
  const [running, setRunning] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AziionSession | null>(null);
  const [tab, setTab] = useState<"overview" | "sessions" | "trades">("overview");

  const invoke = useCallback(async (action: string, extra: any = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isOwnerEmail(user.email)) throw new Error("Unauthorized");

    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aziion-predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action, userId: user.id, ...extra }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await invoke("get_status");
      setBotState(data.botState);
      setSessions(data.sessions || []);
      setTrades(data.trades || []);
      setHlBalance(data.hlBalance || { accountValue: "0", availableBalance: "0" });
    } catch (err: any) {
      console.error("Failed to load Aziion data:", err);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { loadData(); }, [loadData]);

  const initBot = async () => {
    try {
      await invoke("init_bot");
      await loadData();
      toast({ title: "Bot initialized" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleBot = async (enabled: boolean) => {
    try {
      await invoke("toggle_bot", { enabled });
      await loadData();
      toast({ title: enabled ? "Bot activated — first prediction in 5s" : "Bot deactivated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const emergencyStop = async () => {
    try {
      await invoke("emergency_stop", { reason: "Manual emergency stop" });
      await loadData();
      toast({ title: "Emergency stop activated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const runPrediction = async () => {
    setRunning(true);
    try {
      const result = await invoke("run_prediction");
      await loadData();
      toast({
        title: result.tradePlaced ? "Prediction + Trade executed" : "Prediction complete",
        description: result.prediction ? `${result.prediction.direction} @ ${result.prediction.confidence}% confidence` : undefined,
      });
    } catch (err: any) {
      toast({ title: "Prediction failed", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  const activeTrade = trades.find(t => t.status === "open" || t.status === "pending");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-4 py-3 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.15] flex items-center justify-center">
            <Droplets className="h-4 w-4 text-amber-400/70" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">AZIION</h1>
            <p className="text-[8px] text-muted-foreground/40 tracking-[0.2em] uppercase">Automated Brent Oil Trading · 24h Cycle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {botState?.enabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/[0.15]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400/80">LIVE</span>
            </div>
          )}
          {botState?.emergency_stopped && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/[0.08] border border-red-500/[0.15]">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-[9px] text-red-400/80">STOPPED</span>
            </div>
          )}
          <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border/[0.06]">
        {(["overview", "sessions", "trades"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] tracking-wide transition-all ${tab === t ? "bg-foreground/[0.06] text-foreground/70 border border-border/[0.1]" : "text-muted-foreground/40 hover:text-foreground/50"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!botState ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Droplets className="h-12 w-12 text-amber-400/20" />
            <p className="text-[11px] text-foreground/40">Initialize the Aziion bot to begin</p>
            <button onClick={initBot} className="px-4 py-2 rounded-xl bg-amber-500/[0.1] border border-amber-500/[0.2] text-[11px] text-amber-400/80 hover:bg-amber-500/[0.15] transition">
              Initialize Bot
            </button>
          </div>
        ) : tab === "overview" ? (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Balance Card */}
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">Hyperliquid Balance</span>
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-light text-foreground/80">${parseFloat(hlBalance.accountValue).toFixed(2)}</span>
                <span className="text-[9px] text-muted-foreground/40">available: ${parseFloat(hlBalance.availableBalance).toFixed(2)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => toggleBot(!botState.enabled)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${botState.enabled ? "border-emerald-500/[0.2] bg-emerald-500/[0.05] hover:bg-emerald-500/[0.1]" : "border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04]"}`}>
                {botState.enabled ? <PowerOff className="h-5 w-5 text-emerald-400/70" /> : <Power className="h-5 w-5 text-muted-foreground/40" />}
                <span className="text-[10px] text-foreground/60">{botState.enabled ? "Deactivate" : "Activate"}</span>
              </button>

              <button onClick={runPrediction} disabled={running}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-amber-500/[0.15] bg-amber-500/[0.05] hover:bg-amber-500/[0.1] transition-all disabled:opacity-40">
                {running ? <Loader2 className="h-5 w-5 text-amber-400/70 animate-spin" /> : <Zap className="h-5 w-5 text-amber-400/70" />}
                <span className="text-[10px] text-foreground/60">{running ? "Analyzing..." : "Run Now"}</span>
              </button>

              <button onClick={emergencyStop}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-red-500/[0.15] bg-red-500/[0.05] hover:bg-red-500/[0.1] transition-all">
                <AlertTriangle className="h-5 w-5 text-red-400/70" />
                <span className="text-[10px] text-foreground/60">Emergency Stop</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Trades", value: botState.total_trades, icon: BarChart3 },
                { label: "Successful", value: botState.successful_trades, icon: TrendingUp },
                { label: "Total P&L", value: `$${(botState.total_pnl || 0).toFixed(2)}`, icon: DollarSign },
                { label: "Win Rate", value: botState.total_trades > 0 ? `${((botState.successful_trades / botState.total_trades) * 100).toFixed(0)}%` : "—", icon: BarChart3 },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <s.icon className="h-3 w-3 text-muted-foreground/30" />
                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground/40">{s.label}</span>
                  </div>
                  <span className="text-sm font-light text-foreground/70">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Timing */}
            <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/30" />
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">Prediction Schedule</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <span className="text-muted-foreground/40">Last prediction:</span>
                  <p className="text-foreground/60 mt-0.5">{botState.last_prediction_at ? new Date(botState.last_prediction_at).toLocaleString() : "Never"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/40">Next prediction:</span>
                  <p className="text-foreground/60 mt-0.5">{botState.next_prediction_at ? new Date(botState.next_prediction_at).toLocaleString() : "Not scheduled"}</p>
                </div>
              </div>
            </div>

            {/* Active Trade */}
            {activeTrade && (
              <div className="rounded-xl border border-amber-500/[0.15] bg-amber-500/[0.03] p-4">
                <div className="flex items-center gap-2 mb-3">
                  {activeTrade.direction === "LONG" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                  <span className="text-[10px] font-medium text-foreground/70">ACTIVE: {activeTrade.symbol} {activeTrade.direction}</span>
                  <span className="text-[9px] text-muted-foreground/40 ml-auto">{activeTrade.signal_confidence}% confidence</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-[10px]">
                  <div><span className="text-muted-foreground/40">Entry</span><p className="text-foreground/70">${activeTrade.entry_price}</p></div>
                  <div><span className="text-muted-foreground/40">TP</span><p className="text-emerald-400/70">${activeTrade.take_profit || "—"}</p></div>
                  <div><span className="text-muted-foreground/40">SL</span><p className="text-red-400/70">${activeTrade.stop_loss || "—"}</p></div>
                  <div><span className="text-muted-foreground/40">Size</span><p className="text-foreground/70">${activeTrade.size_usd?.toFixed(0) || "—"}</p></div>
                </div>
                {activeTrade.signal_reasoning && (
                  <p className="text-[9px] text-muted-foreground/50 mt-2 border-t border-border/[0.06] pt-2">{activeTrade.signal_reasoning}</p>
                )}
              </div>
            )}
          </div>
        ) : tab === "sessions" ? (
          <div className="space-y-2 max-w-2xl mx-auto">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <Droplets className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-[11px] text-foreground/40">No prediction sessions yet</p>
              </div>
            ) : sessions.map(s => (
              <div key={s.id} onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.trade_placed ? "bg-emerald-400/60" : s.status === "failed" ? "bg-red-400/60" : "bg-amber-400/60"}`} />
                    <span className="text-[11px] text-foreground/70">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.predicted_direction && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${s.predicted_direction === "LONG" ? "bg-emerald-500/[0.1] text-emerald-400" : "bg-red-500/[0.1] text-red-400"}`}>
                        {s.predicted_direction}
                      </span>
                    )}
                    {s.confidence_score != null && (
                      <span className="text-[9px] text-foreground/40">{s.confidence_score}%</span>
                    )}
                    <span className="text-[8px] text-muted-foreground/30">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {selectedSession?.id === s.id && (
                  <div className="mt-3 pt-3 border-t border-border/[0.06] space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div><span className="text-muted-foreground/40">Entry</span><p className="text-foreground/60">${s.predicted_entry || "—"}</p></div>
                      <div><span className="text-muted-foreground/40">TP</span><p className="text-emerald-400/60">${s.predicted_tp || "—"}</p></div>
                      <div><span className="text-muted-foreground/40">SL</span><p className="text-red-400/60">${s.predicted_sl || "—"}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${s.trade_placed ? "bg-emerald-500/[0.1] text-emerald-400" : "bg-foreground/[0.06] text-muted-foreground/50"}`}>
                        {s.trade_placed ? "Trade placed" : s.status}
                      </span>
                    </div>
                    {s.ai_prediction && (
                      <div className="mt-2 p-2 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/50 max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {s.ai_prediction.slice(0, 1000)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <BarChart3 className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-[11px] text-foreground/40">No trades yet</p>
              </div>
            ) : trades.map(t => (
              <div key={t.id} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {t.direction === "LONG" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                    <span className="text-[11px] text-foreground/70">{t.symbol} {t.direction}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${t.status === "open" ? "bg-amber-500/[0.1] text-amber-400" : t.status === "closed" ? "bg-foreground/[0.06] text-muted-foreground/50" : "bg-red-500/[0.1] text-red-400"}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.pnl != null && (
                      <span className={`text-[10px] font-medium ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[8px] text-muted-foreground/30">{new Date(t.opened_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 text-[9px]">
                  <div><span className="text-muted-foreground/40">Entry</span><p className="text-foreground/60">${t.entry_price}</p></div>
                  <div><span className="text-muted-foreground/40">TP</span><p className="text-emerald-400/60">${t.take_profit || "—"}</p></div>
                  <div><span className="text-muted-foreground/40">SL</span><p className="text-red-400/60">${t.stop_loss || "—"}</p></div>
                  <div><span className="text-muted-foreground/40">Size</span><p className="text-foreground/60">${t.size_usd?.toFixed(0) || "—"}</p></div>
                  <div><span className="text-muted-foreground/40">Confidence</span><p className="text-foreground/60">{t.signal_confidence || "—"}%</p></div>
                </div>
                {t.signal_reasoning && (
                  <p className="text-[8px] text-muted-foreground/40 mt-2 border-t border-border/[0.06] pt-1.5">{t.signal_reasoning}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AziionView;
