import { Activity } from "lucide-react";

interface ContextHealthIndicatorProps {
  messageCount: number;
  maxMessages?: number;
}

const ContextHealthIndicator = ({ messageCount, maxMessages = 50 }: ContextHealthIndicatorProps) => {
  // Estimate context usage based on message count (rough token proxy)
  const usage = Math.min((messageCount / maxMessages) * 100, 100);
  const isWarning = usage >= 75;
  const isCritical = usage >= 90;

  const barColor = isCritical
    ? "bg-destructive"
    : isWarning
    ? "bg-amber-500"
    : "bg-accent";

  const label = isCritical
    ? "Context almost full"
    : isWarning
    ? "Context filling up"
    : "Context healthy";

  return (
    <div className="flex items-center gap-2 group relative">
      <Activity className={`h-3.5 w-3.5 ${isCritical ? "text-destructive" : isWarning ? "text-amber-500" : "text-muted-foreground/50"}`} />
      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${usage}%` }}
        />
      </div>
      <span className="text-[10px] font-light text-muted-foreground/50">
        {Math.round(usage)}%
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
        <div className="rounded-lg border border-border/30 bg-card/90 backdrop-blur-xl px-3 py-2 shadow-xl">
          <p className="text-[10px] font-light text-foreground whitespace-nowrap">{label}</p>
          <p className="text-[10px] font-light text-muted-foreground">{messageCount} messages in context</p>
          {isWarning && (
            <p className="text-[10px] font-light text-amber-500 mt-1">
              Consider starting a new conversation for best results.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextHealthIndicator;
