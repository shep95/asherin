import { useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface TruthScoreProps {
  score: "high" | "medium" | "low";
  sources?: { title: string; url: string }[];
  assumptions?: string[];
  unknowns?: string[];
  wouldChange?: string;
}

const config = {
  high: { color: "bg-emerald-500", label: "Verified", ring: "ring-emerald-500/30" },
  medium: { color: "bg-amber-500", label: "High Confidence", ring: "ring-amber-500/30" },
  low: { color: "bg-orange-500", label: "Low Confidence", ring: "ring-orange-500/30" },
};

const TruthScore = ({ score, sources, assumptions, unknowns, wouldChange }: TruthScoreProps) => {
  const [open, setOpen] = useState(false);
  const c = config[score];

  const hasExtras = (assumptions && assumptions.length > 0) || (unknowns && unknowns.length > 0) || wouldChange;

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-light ring-1 ${c.ring} text-muted-foreground hover:text-foreground transition-colors`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${c.color}`} />
        {c.label}
        {hasExtras && <HelpCircle className="h-2.5 w-2.5 text-muted-foreground/40" />}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border/30 bg-card/90 backdrop-blur-xl p-3 shadow-xl z-50">
          <p className="text-xs font-light text-muted-foreground mb-2">Source Breakdown</p>
          {sources && sources.length > 0 ? (
            <ul className="space-y-1 mb-2">
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline font-light">
                    [{i + 1}] {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground/60 mb-2">Based on model training data</p>
          )}

          {/* Assumptions */}
          {assumptions && assumptions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <p className="text-[10px] font-light text-amber-500/70 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Assumptions Made
              </p>
              {assumptions.map((a, i) => (
                <p key={i} className="text-[10px] text-muted-foreground/50 font-light ml-4">• {a}</p>
              ))}
            </div>
          )}

          {/* Unknowns */}
          {unknowns && unknowns.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <p className="text-[10px] font-light text-muted-foreground/60 mb-1 flex items-center gap-1">
                <HelpCircle className="h-3 w-3" /> Unknowns
              </p>
              {unknowns.map((u, i) => (
                <p key={i} className="text-[10px] text-muted-foreground/40 font-light ml-4">• {u}</p>
              ))}
            </div>
          )}

          {/* What would change the answer */}
          {wouldChange && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <p className="text-[10px] font-light text-accent/60">What would change this answer:</p>
              <p className="text-[10px] text-muted-foreground/50 font-light mt-0.5">{wouldChange}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TruthScore;
