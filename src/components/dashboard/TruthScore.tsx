import { useState } from "react";

interface TruthScoreProps {
  score: "high" | "medium" | "low";
  sources?: { title: string; url: string }[];
}

const config = {
  high: { color: "bg-emerald-500", label: "Verified", ring: "ring-emerald-500/30" },
  medium: { color: "bg-amber-500", label: "High Confidence", ring: "ring-amber-500/30" },
  low: { color: "bg-orange-500", label: "Low Confidence", ring: "ring-orange-500/30" },
};

const TruthScore = ({ score, sources }: TruthScoreProps) => {
  const [open, setOpen] = useState(false);
  const c = config[score];

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-light ring-1 ${c.ring} text-muted-foreground hover:text-foreground transition-colors`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${c.color}`} />
        {c.label}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border/30 bg-card/90 backdrop-blur-xl p-3 shadow-xl z-50">
          <p className="text-xs font-light text-muted-foreground mb-2">Source Breakdown</p>
          {sources && sources.length > 0 ? (
            <ul className="space-y-1">
              {sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline font-light"
                  >
                    [{i + 1}] {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground/60">Based on model training data</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TruthScore;
