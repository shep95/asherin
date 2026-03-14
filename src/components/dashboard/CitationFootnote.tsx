import { useState, useRef } from "react";
import { ExternalLink, Shield, Clock, AlertTriangle } from "lucide-react";

interface Source {
  title: string;
  url: string;
  tier?: "primary" | "secondary" | "tertiary";
  date?: string;
  credibility?: number; // 0-100
}

interface CitationFootnoteProps {
  sources: Source[];
}

function getTierConfig(tier?: string) {
  switch (tier) {
    case "primary": return { label: "Primary", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Shield };
    case "secondary": return { label: "Secondary", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock };
    case "tertiary": return { label: "Tertiary", color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle };
    default: return { label: "Unverified", color: "text-muted-foreground/50", bg: "bg-muted/10", icon: AlertTriangle };
  }
}

function CredibilityBar({ value }: { value: number }) {
  const color = value > 75 ? "bg-emerald-500" : value > 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-muted/20 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/50">{value}%</span>
    </div>
  );
}

const CitationFootnote = ({ sources }: CitationFootnoteProps) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!sources.length) return null;

  return (
    <div ref={containerRef} className="mt-3 pt-2 border-t border-border/10">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Sources</span>
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        >
          {expandAll ? "Collapse" : "Expand All"}
        </button>
      </div>
      <div className="space-y-1">
        {sources.map((source, idx) => {
          const tier = getTierConfig(source.tier);
          const isHovered = hoveredIdx === idx;
          const showDetail = isHovered || expandAll;

          return (
            <div
              key={idx}
              className="relative"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Inline footnote reference */}
              <div className="flex items-center gap-2 group">
                <span className={`text-[10px] font-mono ${tier.color} shrink-0`}>[{idx + 1}]</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-light text-accent/80 hover:text-accent underline-offset-2 hover:underline transition-colors truncate flex-1"
                >
                  {source.title}
                </a>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.color} shrink-0`}>
                  {tier.label}
                </span>
              </div>

              {/* Hover preview panel */}
              {showDetail && (
                <div className="ml-6 mt-1 mb-1 rounded-lg border border-border/20 bg-card/40 backdrop-blur-sm p-2.5 animate-fade-in">
                  <div className="flex items-center gap-3 flex-wrap">
                    {source.date && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/50">{source.date}</span>
                      </div>
                    )}
                    {source.credibility !== undefined && (
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-muted-foreground/40" />
                        <CredibilityBar value={source.credibility} />
                      </div>
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent transition-colors ml-auto"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CitationFootnote;
