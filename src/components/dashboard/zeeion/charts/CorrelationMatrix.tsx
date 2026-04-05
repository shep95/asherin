import { useMemo } from "react";

interface Props {
  departments?: { department: string; efficiencyScore: number; totalSpending: number; budget: number; variance: number }[];
}

const CorrelationMatrix = ({ departments }: Props) => {
  const matrix = useMemo(() => {
    if (!departments?.length || departments.length < 2) return null;

    const depts = departments.slice(0, 8);
    const metrics = depts.map(d => [d.totalSpending, d.budget, d.efficiencyScore, d.variance]);

    // Compute pairwise correlation between departments based on their metric profiles
    const n = depts.length;
    const corr: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { corr[i][j] = 1; continue; }
        // Simple cosine similarity between metric vectors
        const a = metrics[i];
        const b = metrics[j];
        const dot = a.reduce((s, v, k) => s + v * b[k], 0);
        const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
        const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
        corr[i][j] = magA && magB ? dot / (magA * magB) : 0;
      }
    }

    return { depts, corr };
  }, [departments]);

  if (!matrix) return null;

  const { depts, corr } = matrix;
  const cellSize = 48;

  const getColor = (v: number) => {
    if (v >= 0.9) return "hsl(150, 60%, 50% / 0.5)";
    if (v >= 0.7) return "hsl(150, 60%, 50% / 0.3)";
    if (v >= 0.5) return "hsl(45, 80%, 50% / 0.2)";
    if (v >= 0.3) return "hsl(30, 90%, 55% / 0.15)";
    return "hsl(var(--foreground) / 0.04)";
  };

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Department Correlation Matrix</h3>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Header row */}
          <div className="flex items-end mb-1" style={{ paddingLeft: 80 }}>
            {depts.map((d, i) => (
              <div key={i} className="text-center" style={{ width: cellSize }}>
                <span className="text-[7px] text-muted-foreground/40 block transform -rotate-45 origin-bottom-left whitespace-nowrap">
                  {d.department.length > 10 ? d.department.slice(0, 10) + "…" : d.department}
                </span>
              </div>
            ))}
          </div>

          {/* Matrix rows */}
          {depts.map((d, i) => (
            <div key={i} className="flex items-center">
              <div className="w-20 pr-2 text-right">
                <span className="text-[8px] text-muted-foreground/40">{d.department.length > 10 ? d.department.slice(0, 10) + "…" : d.department}</span>
              </div>
              {depts.map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-center border border-background/50 rounded-sm transition-all hover:scale-110"
                  style={{ width: cellSize, height: cellSize - 8, background: getColor(corr[i][j]) }}
                  title={`${d.department} × ${depts[j].department}: ${corr[i][j].toFixed(2)}`}
                >
                  <span className="text-[7px] text-foreground/40">{corr[i][j].toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CorrelationMatrix;
