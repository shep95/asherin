import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell } from "recharts";

interface Props {
  anomalies?: { type: string; severity: string; description: string; recommendation: string }[];
  wastefulItems?: { description: string; annualCost: number; recommendation: string; severity: string }[];
}

const AnomalyScatter = ({ anomalies, wastefulItems }: Props) => {
  if (!anomalies?.length && !wastefulItems?.length) return null;

  // Combine anomalies and wasteful items into scatter data
  const data = [
    ...(anomalies || []).map((a, i) => ({
      x: i + 1,
      y: a.severity === "high" ? 90 : a.severity === "medium" ? 60 : 30,
      z: a.severity === "high" ? 400 : a.severity === "medium" ? 250 : 150,
      name: a.description.slice(0, 50),
      severity: a.severity,
      type: "anomaly",
    })),
    ...(wastefulItems || []).map((w, i) => ({
      x: (anomalies?.length || 0) + i + 1,
      y: w.severity === "high" ? 85 : w.severity === "medium" ? 55 : 25,
      z: Math.min(w.annualCost / 100, 600),
      name: w.description.slice(0, 50),
      severity: w.severity,
      type: "waste",
    })),
  ];

  const getColor = (severity: string) => {
    if (severity === "high") return "hsl(0, 70%, 55%)";
    if (severity === "medium") return "hsl(40, 90%, 55%)";
    return "hsl(var(--muted-foreground) / 0.3)";
  };

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Anomaly & Risk Scatter</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis dataKey="x" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} axisLine={false} tickLine={false} name="Index" />
          <YAxis dataKey="y" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} axisLine={false} tickLine={false} name="Severity" domain={[0, 100]} />
          <ZAxis dataKey="z" range={[60, 400]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-xl bg-background/95 border border-border/[0.1] backdrop-blur-xl px-3 py-2 shadow-lg">
                  <p className="text-[9px] text-foreground/60 font-light">{d.name}…</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${d.severity === "high" ? "bg-red-500/10 text-red-400" : d.severity === "medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-foreground/[0.04] text-muted-foreground/50"}`}>
                      {d.severity}
                    </span>
                    <span className="text-[8px] text-muted-foreground/30">{d.type}</span>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={getColor(d.severity)} fillOpacity={0.6} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400/60" />
          <span className="text-[8px] text-muted-foreground/40">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
          <span className="text-[8px] text-muted-foreground/40">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-foreground/20" />
          <span className="text-[8px] text-muted-foreground/40">Low</span>
        </div>
      </div>
    </div>
  );
};

export default AnomalyScatter;
