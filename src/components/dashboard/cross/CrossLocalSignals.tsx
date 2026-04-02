import React from "react";
import { Zap, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import { LocalSignal } from "./types";

interface Props {
  signals: LocalSignal[];
}

const SIGNAL_ICONS: Record<string, React.ReactNode> = {
  PUMP_DETECTED: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
  DUMP_DETECTED: <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
  PRICE_ACCELERATION: <Zap className="h-3.5 w-3.5 text-emerald-300" />,
  SUPPORT_BOUNCE: <Activity className="h-3.5 w-3.5 text-emerald-400" />,
  RESISTANCE_HIT: <Activity className="h-3.5 w-3.5 text-amber-400" />,
  MOMENTUM_SHIFT: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  RUG_WARNING: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  BREAKOUT: <TrendingUp className="h-3.5 w-3.5 text-blue-400" />,
  VOLUME_SPIKE: <Zap className="h-3.5 w-3.5 text-amber-400" />,
};

const ACTION_COLORS: Record<string, string> = {
  BUY_NOW: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  SELL_NOW: "bg-red-500/15 border-red-500/30 text-red-300",
  EXIT_NOW: "bg-red-600/20 border-red-600/40 text-red-200",
  HOLD: "bg-blue-500/10 border-blue-500/20 text-blue-300",
  WAIT: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  MONITOR: "bg-muted/20 border-border/30 text-muted-foreground",
};

const CrossLocalSignals: React.FC<Props> = ({ signals }) => {
  if (signals.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1">
        <Zap className="h-3 w-3" />
        Nestal Fractal Intelligence (Instant)
      </p>
      {signals.map((sig, i) => {
        const colorClass = ACTION_COLORS[sig.action] || ACTION_COLORS.MONITOR;
        return (
          <div key={i} className={`rounded-lg border ${colorClass} p-2.5`}>
            <div className="flex items-center gap-2">
              {SIGNAL_ICONS[sig.type] || <Zap className="h-3.5 w-3.5" />}
              <span className="text-xs font-bold">{sig.action.replace("_", " ")}</span>
              <span className="text-[10px] opacity-60">{sig.confidence}%</span>
              {sig.urgency === "immediate" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 animate-pulse">
                  URGENT
                </span>
              )}
            </div>
            <p className="text-[11px] mt-1 opacity-80">{sig.reason}</p>
            {(sig.entry || sig.stopLoss || sig.takeProfit) && (
              <div className="mt-1.5 flex gap-3 text-[10px] font-mono opacity-70">
                {sig.entry && <span>Entry: ${sig.entry.toFixed(8)}</span>}
                {sig.stopLoss && <span className="text-red-400">SL: ${sig.stopLoss.toFixed(8)}</span>}
                {sig.takeProfit && <span className="text-emerald-400">TP: ${sig.takeProfit.toFixed(8)}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CrossLocalSignals;
