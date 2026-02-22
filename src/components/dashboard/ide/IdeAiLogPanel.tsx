import { useState, useEffect } from "react";
import { Brain, Trash2, Sparkles, Search, Bug, TestTubes, FileCode, Zap, Shield } from "lucide-react";

export interface AiLogEntry {
  id: string;
  timestamp: Date;
  type: "scan" | "fix" | "suggest" | "test" | "security" | "predict";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  logs: AiLogEntry[];
  onClear: () => void;
}

const TYPE_ICONS = {
  scan: Search,
  fix: Bug,
  suggest: Sparkles,
  test: TestTubes,
  security: Shield,
  predict: Zap,
};

const TYPE_COLORS = {
  scan: "text-accent/60",
  fix: "text-emerald-400",
  suggest: "text-amber-400",
  test: "text-violet-400",
  security: "text-destructive/70",
  predict: "text-cyan-400",
};

const IdeAiLogPanel = ({ logs, onClear }: Props) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-card/20 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Brain className="h-3 w-3 text-accent/60" />
          <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">AI Activity</span>
          <span className="text-[9px] text-muted-foreground/30">({logs.length})</span>
        </div>
        <button onClick={onClear} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Clear">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 font-mono text-[10px]">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground/30 text-[10px] font-sans">
            AI activity will appear here
          </div>
        ) : (
          logs.map(log => {
            const Icon = TYPE_ICONS[log.type];
            return (
              <div key={log.id} className="flex items-start gap-2 px-3 py-1 hover:bg-foreground/5 transition-colors">
                <span className="text-muted-foreground/30 shrink-0">
                  {log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${TYPE_COLORS[log.type]}`} />
                <span className="text-foreground/70 flex-1">{log.message}</span>
                {log.actionLabel && log.onAction && (
                  <button
                    onClick={log.onAction}
                    className="text-accent text-[9px] hover:underline shrink-0 font-sans"
                  >
                    [{log.actionLabel}]
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IdeAiLogPanel;
