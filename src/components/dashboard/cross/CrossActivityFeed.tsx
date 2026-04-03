import React from "react";
import { ActivityEntry, MODE_CONFIG } from "./types";
import { CheckCircle, X, Clock } from "lucide-react";

interface Props {
  activities: ActivityEntry[];
  maxItems?: number;
}

const CrossActivityFeed: React.FC<Props> = ({ activities, maxItems = 10 }) => {
  if (activities.length === 0) return null;

  const shown = activities.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-border/20 bg-muted/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/10">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium">Recent Activity</p>
      </div>
      <div className="divide-y divide-border/10 max-h-[250px] overflow-y-auto">
        {shown.map(entry => {
          const cfg = MODE_CONFIG[entry.mode];
          const timeAgo = getTimeAgo(entry.timestamp);
          return (
            <div key={entry.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/5 transition-colors">
              <div className="mt-0.5">
                {entry.accepted === true && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                {entry.accepted === false && <X className="h-3.5 w-3.5 text-red-400/50" />}
                {entry.accepted === undefined && <Clock className="h-3.5 w-3.5 text-muted-foreground/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${cfg?.color || "text-muted-foreground"} bg-current/5 font-medium`}>
                    {cfg?.label || entry.mode}
                  </span>
                  <span className="text-xs text-foreground truncate">{entry.action}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{entry.detail}</p>
              </div>
              <span className="text-[9px] text-muted-foreground/30 whitespace-nowrap flex-shrink-0">{timeAgo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default CrossActivityFeed;
