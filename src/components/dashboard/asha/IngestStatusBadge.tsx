import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type IngestStatus = "analyzing" | "ready" | "error" | "uploading";

interface IngestStatusBadgeProps {
  status: IngestStatus;
  onRetry?: () => void;
}

const statusConfig: Record<IngestStatus, {
  label: string;
  color: string;       // HSL base
  glowColor: string;   // for top-edge glow
  iconBg: string;
}> = {
  uploading: {
    label: "Uploading",
    color: "45, 90%, 55%",
    glowColor: "45, 90%, 55%",
    iconBg: "hsla(45, 90%, 55%, 0.15)",
  },
  analyzing: {
    label: "Pending",
    color: "40, 95%, 55%",
    glowColor: "40, 95%, 55%",
    iconBg: "hsla(40, 95%, 55%, 0.15)",
  },
  ready: {
    label: "Success",
    color: "160, 75%, 48%",
    glowColor: "160, 80%, 50%",
    iconBg: "hsla(160, 75%, 48%, 0.15)",
  },
  error: {
    label: "Failed",
    color: "0, 80%, 55%",
    glowColor: "0, 80%, 55%",
    iconBg: "hsla(0, 80%, 55%, 0.15)",
  },
};

const IngestStatusBadge = ({ status, onRetry }: IngestStatusBadgeProps) => {
  const [displayStatus, setDisplayStatus] = useState(status);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== status) {
      setIsTransitioning(true);
      // Phase 1: fade out old
      const t1 = setTimeout(() => {
        setDisplayStatus(status);
        // Phase 2: fade in new
        const t2 = setTimeout(() => setIsTransitioning(false), 50);
        return () => clearTimeout(t2);
      }, 250);
      prevStatus.current = status;
      return () => clearTimeout(t1);
    }
  }, [status]);

  const config = statusConfig[displayStatus];
  const isPending = displayStatus === "analyzing" || displayStatus === "uploading";

  return (
    <button
      onClick={displayStatus === "error" ? onRetry : undefined}
      className={`
        group relative inline-flex items-center gap-2 
        rounded-full px-4 py-2
        text-xs font-light tracking-wide
        transition-all duration-500 ease-out
        overflow-hidden
        ${displayStatus === "error" ? "cursor-pointer" : "cursor-default"}
        ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}
      `}
      style={{
        background: `linear-gradient(180deg, 
          hsla(${config.color}, 0.08) 0%, 
          hsla(${config.color}, 0.03) 100%)`,
        border: `1px solid hsla(${config.color}, 0.15)`,
        color: `hsl(${config.color})`,
        boxShadow: `
          0 0 20px -8px hsla(${config.color}, 0.2),
          inset 0 1px 0 hsla(0, 0%, 100%, 0.04)
        `,
      }}
      title={displayStatus === "error" ? "Click to retry" : undefined}
    >
      {/* Top-edge glow strip */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[1.5px] rounded-full"
        style={{
          width: "60%",
          background: `linear-gradient(90deg, 
            transparent, 
            hsl(${config.glowColor}) 30%, 
            hsl(${config.glowColor}) 70%, 
            transparent)`,
          boxShadow: `0 0 8px 1px hsla(${config.glowColor}, 0.5)`,
        }}
      />

      {/* Shimmer sweep for pending states */}
      {isPending && (
        <span
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
          style={{ opacity: 0.15 }}
        >
          <span
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, 
                transparent 40%, 
                hsla(${config.color}, 0.4) 50%, 
                transparent 60%)`,
              animation: "ingestShimmer 2.5s ease-in-out infinite",
            }}
          />
        </span>
      )}

      {/* Icon */}
      <span
        className="relative flex items-center justify-center w-5 h-5 rounded-full"
        style={{ background: config.iconBg }}
      >
        {isPending && (
          <Loader2
            className="h-3 w-3 animate-spin"
            style={{ color: `hsl(${config.color})` }}
          />
        )}
        {displayStatus === "ready" && (
          <CheckCircle2
            className="h-3 w-3"
            style={{ color: `hsl(${config.color})` }}
          />
        )}
        {displayStatus === "error" && (
          <XCircle
            className="h-3 w-3"
            style={{ color: `hsl(${config.color})` }}
          />
        )}
      </span>

      {/* Label */}
      <span className="relative font-light">{config.label}</span>

      {/* Inline styles for shimmer keyframe */}
      <style>{`
        @keyframes ingestShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </button>
  );
};

export default IngestStatusBadge;
