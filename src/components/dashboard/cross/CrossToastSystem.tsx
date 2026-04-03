import React, { useState, useEffect, useCallback } from "react";
import { X, Check, AlertTriangle, Info, Zap } from "lucide-react";

export interface CrossToast {
  id: string;
  type: "success" | "warning" | "critical" | "info";
  title: string;
  body: string;
  timestamp: Date;
  duration?: number; // ms, 0 = stay until dismissed
  actions?: { label: string; onClick?: () => void }[];
}

interface CrossToastSystemProps {
  toasts: CrossToast[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

const TOAST_STYLES: Record<CrossToast["type"], { border: string; bg: string; icon: React.ReactNode; glow: string }> = {
  success: {
    border: "border-emerald-500/40",
    bg: "from-emerald-900/80 to-emerald-950/80",
    icon: <Check className="h-4 w-4 text-emerald-400" />,
    glow: "shadow-emerald-500/10",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "from-amber-900/80 to-amber-950/80",
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    glow: "shadow-amber-500/10",
  },
  critical: {
    border: "border-red-500/40",
    bg: "from-red-900/80 to-red-950/80",
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    glow: "shadow-red-500/10",
  },
  info: {
    border: "border-blue-500/40",
    bg: "from-blue-900/80 to-blue-950/80",
    icon: <Info className="h-4 w-4 text-blue-400" />,
    glow: "shadow-blue-500/10",
  },
};

const DEFAULT_DURATIONS: Record<CrossToast["type"], number> = {
  info: 5000,
  success: 5000,
  warning: 8000,
  critical: 0, // stay until dismissed
};

const CrossToastSystem: React.FC<CrossToastSystemProps> = ({ toasts, onDismiss, maxVisible = 3 }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Auto-dismiss with timer
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    toasts.slice(0, maxVisible).forEach(t => {
      if (t.id === hoveredId) return;
      const duration = t.duration ?? DEFAULT_DURATIONS[t.type];
      if (duration > 0) {
        timers.push(setTimeout(() => onDismiss(t.id), duration));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, hoveredId, onDismiss, maxVisible]);

  const visibleToasts = toasts.slice(0, maxVisible);
  const queuedCount = Math.max(0, toasts.length - maxVisible);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none" style={{ maxWidth: 420, width: "90vw" }}>
      {visibleToasts.map((t, i) => {
        const style = TOAST_STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto w-full rounded-xl border-2 ${style.border} bg-gradient-to-r ${style.bg} backdrop-blur-xl shadow-lg ${style.glow} p-4 transition-all duration-300 animate-in slide-in-from-top-2 fade-in-0`}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">{style.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground tracking-wide">{t.title}</h4>
                  <button onClick={() => onDismiss(t.id)} className="flex-shrink-0 p-0.5 hover:bg-white/10 rounded transition">
                    <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">{t.body}</p>

                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {t.actions.map((action, ai) => (
                      <button
                        key={ai}
                        onClick={() => { action.onClick?.(); onDismiss(t.id); }}
                        className="px-3 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 border border-white/10 transition"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Auto-dismiss progress bar */}
            {(t.duration ?? DEFAULT_DURATIONS[t.type]) > 0 && hoveredId !== t.id && (
              <div className="mt-2 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-white/20 rounded-full"
                  style={{
                    animation: `shrink ${(t.duration ?? DEFAULT_DURATIONS[t.type]) / 1000}s linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {queuedCount > 0 && (
        <div className="pointer-events-auto px-3 py-1 rounded-full bg-muted/40 backdrop-blur text-[10px] text-muted-foreground/60 border border-border/20">
          +{queuedCount} more notification{queuedCount > 1 ? "s" : ""}
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default CrossToastSystem;
