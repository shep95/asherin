import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from "recharts";

interface Props {
  categories?: { category: string; amount: number; percentage: number }[];
  totalSpending: number;
  potentialSavings: number;
}

const WaterfallChart = ({ categories, totalSpending, potentialSavings }: Props) => {
  if (!categories?.length) return null;

  // Build waterfall: start with total, subtract each category, end with savings
  let running = totalSpending;
  const data = [
    { name: "Total", value: totalSpending, fill: "hsl(var(--foreground) / 0.2)", isTotal: true },
    ...categories.slice(0, 6).map(c => {
      running -= c.amount;
      return { name: c.category.length > 10 ? c.category.slice(0, 10) + "…" : c.category, value: -c.amount, base: running, fill: "hsl(var(--primary) / 0.4)" };
    }),
    { name: "Savings", value: potentialSavings, fill: "hsl(150, 60%, 50% / 0.5)", isTotal: false },
  ];

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Financial Waterfall</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.4)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground) / 0.3)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(Math.abs(v) / 1000).toFixed(0)}K`} />
          <Tooltip
            formatter={(v: number) => [`$${Math.abs(v).toLocaleString()}`, "Amount"]}
            contentStyle={{
              background: "hsl(var(--background) / 0.95)",
              border: "1px solid hsl(var(--border) / 0.1)",
              borderRadius: 12,
              fontSize: 10,
              backdropFilter: "blur(12px)",
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border) / 0.1)" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WaterfallChart;
