import { useMemo } from "react";
import { Activity } from "lucide-react";

interface NomadContextHealthProps {
  messages: { role: string; content: string }[];
}

const MAX_CONTEXT = 120000; // ~120K chars ≈ model context window

const NomadContextHealth = ({ messages }: NomadContextHealthProps) => {
  const { used, percentage, status } = useMemo(() => {
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const pct = Math.min(100, Math.round((totalChars / MAX_CONTEXT) * 100));
    const status = pct > 85 ? "critical" : pct > 60 ? "warning" : "healthy";
    return { used: totalChars, percentage: pct, status };
  }, [messages]);

  const colorMap = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  };
  const bgMap = {
    healthy: "bg-emerald-400",
    warning: "bg-amber-400",
    critical: "bg-red-400",
  };

  return (
    <div className="flex items-center gap-2 text-[9px] font-extralight text-muted-foreground/50" title={`${(used / 1000).toFixed(1)}K / ${(MAX_CONTEXT / 1000).toFixed(0)}K chars used`}>
      <Activity className={`h-3 w-3 ${colorMap[status]}`} />
      <div className="w-16 h-1 rounded-full bg-secondary/30 overflow-hidden">
        <div className={`h-full rounded-full ${bgMap[status]} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
      <span className={colorMap[status]}>{percentage}%</span>
    </div>
  );
};

export default NomadContextHealth;
