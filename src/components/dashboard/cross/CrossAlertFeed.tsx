import React from "react";
import { X } from "lucide-react";
import { CrossAlert } from "./types";
import { ALERT_COLORS } from "./constants";

interface Props {
  alerts: CrossAlert[];
  onDismiss: (id: string) => void;
  isSharing: boolean;
}

const CrossAlertFeed: React.FC<Props> = ({ alerts, onDismiss, isSharing }) => (
  <div className="space-y-2">
    {alerts.length === 0 && isSharing && (
      <p className="text-xs text-muted-foreground/40 font-extralight text-center py-4">
        No alerts yet — Aureon is monitoring your screen...
      </p>
    )}
    {alerts.map(alert => {
      const style = ALERT_COLORS[alert.type] || ALERT_COLORS.INFO;
      return (
        <div key={alert.id} className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {style.icon}
              <span className="text-sm font-medium text-foreground">{alert.type} — {alert.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/30 text-muted-foreground">
                {alert.confidence}%
              </span>
            </div>
            <button onClick={() => onDismiss(alert.id)} className="text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>

          {alert.reasoning.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {alert.reasoning.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground font-extralight flex items-start gap-1.5">
                  <span className="text-muted-foreground/30 mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}

          {(alert.entry || alert.stopLoss || alert.takeProfit) && (
            <div className="mt-2 flex gap-3 text-[10px] font-mono text-muted-foreground">
              {alert.entry && <span>Entry: <span className="text-foreground">{alert.entry}</span></span>}
              {alert.stopLoss && <span>SL: <span className="text-red-400">{alert.stopLoss}</span></span>}
              {alert.takeProfit && <span>TP: <span className="text-emerald-400">{alert.takeProfit}</span></span>}
            </div>
          )}

          {alert.action && (
            <p className="mt-1.5 text-xs text-accent font-extralight">{alert.action}</p>
          )}

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground/30">{alert.timestamp.toLocaleTimeString()}</span>
            {alert.validFor && <span className="text-[9px] text-muted-foreground/30">Valid for: {alert.validFor}</span>}
          </div>
        </div>
      );
    })}
  </div>
);

export default CrossAlertFeed;
