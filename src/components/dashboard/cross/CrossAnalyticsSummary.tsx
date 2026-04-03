import React from "react";
import { SessionAnalytics } from "./types";
import { BarChart3, Zap, Eye, CheckCircle } from "lucide-react";

interface Props {
  analytics: SessionAnalytics;
  sessionDuration: string;
}

const CrossAnalyticsSummary: React.FC<Props> = ({ analytics, sessionDuration }) => {
  const acceptRate = analytics.alertsFired > 0
    ? Math.round((analytics.alertsAccepted / analytics.alertsFired) * 100)
    : 0;

  const stats = [
    { icon: <Eye className="h-3.5 w-3.5 text-blue-400" />, label: "Frames", value: `${analytics.framesAnalyzed}`, sub: `${analytics.framesSkipped} skipped` },
    { icon: <Zap className="h-3.5 w-3.5 text-amber-400" />, label: "Alerts", value: `${analytics.alertsFired}`, sub: `${acceptRate}% accepted` },
    { icon: <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />, label: "Session", value: sessionDuration, sub: `~$${analytics.estimatedCost.toFixed(2)}` },
    { icon: <CheckCircle className="h-3.5 w-3.5 text-purple-400" />, label: "Accuracy", value: `${acceptRate}%`, sub: `${analytics.alertsDismissed} dismissed` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border border-border/20 bg-muted/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            {s.icon}
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{s.label}</span>
          </div>
          <div className="text-lg font-light text-foreground leading-none">{s.value}</div>
          <div className="text-[9px] text-muted-foreground/40 mt-0.5">{s.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default CrossAnalyticsSummary;
