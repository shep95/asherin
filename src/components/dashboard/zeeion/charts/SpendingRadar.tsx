import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

interface Props {
  departments?: { department: string; efficiencyScore: number; totalSpending: number; budget: number }[];
}

const SpendingRadar = ({ departments }: Props) => {
  if (!departments?.length) return null;

  const data = departments.slice(0, 8).map(d => ({
    dept: d.department.length > 12 ? d.department.slice(0, 12) + "…" : d.department,
    efficiency: d.efficiencyScore,
    utilization: Math.min(Math.round((d.totalSpending / d.budget) * 100), 150),
  }));

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Department Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(var(--border) / 0.1)" />
          <PolarAngleAxis dataKey="dept" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.4)" }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} stroke="hsl(var(--border) / 0.06)" />
          <Radar name="Efficiency" dataKey="efficiency" stroke="hsl(150, 60%, 50%)" fill="hsl(150, 60%, 50%)" fillOpacity={0.15} strokeWidth={1.5} />
          <Radar name="Utilization" dataKey="utilization" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={1.5} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--background) / 0.95)",
              border: "1px solid hsl(var(--border) / 0.1)",
              borderRadius: 12,
              fontSize: 10,
              backdropFilter: "blur(12px)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
          <span className="text-[8px] text-muted-foreground/40">Efficiency</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <span className="text-[8px] text-muted-foreground/40">Utilization %</span>
        </div>
      </div>
    </div>
  );
};

export default SpendingRadar;
