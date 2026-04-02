import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  stats: { current: number; high: number; low: number; change: number; dataPoints: number } | null;
  pair?: string;
}

const CrossPriceTracker: React.FC<Props> = ({ stats, pair }) => {
  if (!stats) return null;

  const isUp = stats.change > 0;
  const isFlat = Math.abs(stats.change) < 0.5;
  const changeColor = isFlat ? "text-muted-foreground" : isUp ? "text-emerald-400" : "text-red-400";

  return (
    <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/10 border border-border/20">
      <div className="flex items-center gap-1.5">
        {isFlat ? <Minus className="h-3 w-3 text-muted-foreground" /> : isUp ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
        <span className="text-xs font-medium text-foreground">{pair || "Tracking"}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
        <span>Now: <span className="text-foreground">${stats.current < 0.01 ? stats.current.toFixed(8) : stats.current.toFixed(4)}</span></span>
        <span className={changeColor}>{isUp ? "+" : ""}{stats.change.toFixed(2)}%</span>
        <span>H: <span className="text-emerald-400/70">${stats.high < 0.01 ? stats.high.toFixed(8) : stats.high.toFixed(4)}</span></span>
        <span>L: <span className="text-red-400/70">${stats.low < 0.01 ? stats.low.toFixed(8) : stats.low.toFixed(4)}</span></span>
        <span className="text-muted-foreground/40">{stats.dataPoints} pts</span>
      </div>
    </div>
  );
};

export default CrossPriceTracker;
