import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface SourceTelemetryEntry {
  source_name: string;
  response_time_ms: number;
  status: string;
  result_count: number;
  entity_yield: number;
}

interface NomadSourceTelemetryProps {
  telemetry: SourceTelemetryEntry[];
}

const STATUS_ICON: Record<string, React.ElementType> = {
  SUCCESS: CheckCircle,
  NO_RESULTS: AlertTriangle,
  TIMEOUT: Clock,
  ERROR: XCircle,
  RATE_LIMITED: AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "text-green-400",
  NO_RESULTS: "text-yellow-400",
  TIMEOUT: "text-orange-400",
  ERROR: "text-red-400",
  RATE_LIMITED: "text-orange-400",
};

const NomadSourceTelemetry = ({ telemetry }: NomadSourceTelemetryProps) => {
  const [expanded, setExpanded] = useState(false);
  if (!telemetry || telemetry.length === 0) return null;

  const successCount = telemetry.filter(t => t.status === "SUCCESS").length;
  const avgTime = Math.round(telemetry.reduce((s, t) => s + t.response_time_ms, 0) / telemetry.length);
  const totalEntities = telemetry.reduce((s, t) => s + t.entity_yield, 0);

  return (
    <div className="rounded-xl border border-border/15 bg-card/15 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-extralight text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          Sources Active: {successCount}/{telemetry.length} • Avg {avgTime}ms • {totalEntities} entities
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-0.5 animate-fade-in max-h-48 overflow-y-auto">
          {telemetry
            .sort((a, b) => (a.status === "SUCCESS" ? -1 : 1) - (b.status === "SUCCESS" ? -1 : 1))
            .map((t, idx) => {
              const Icon = STATUS_ICON[t.status] || AlertTriangle;
              const color = STATUS_COLOR[t.status] || "text-muted-foreground";
              return (
                <div key={idx} className="flex items-center gap-2 py-0.5">
                  <Icon className={`h-2.5 w-2.5 shrink-0 ${color}`} />
                  <span className="text-[9px] font-extralight text-foreground/70 truncate flex-1">{t.source_name}</span>
                  <span className="text-[8px] font-extralight text-muted-foreground/40 shrink-0">{t.response_time_ms}ms</span>
                  <span className="text-[8px] font-extralight text-muted-foreground/40 shrink-0">{t.entity_yield}e</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default NomadSourceTelemetry;
