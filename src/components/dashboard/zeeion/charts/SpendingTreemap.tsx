import { ResponsiveContainer, Treemap, Tooltip } from "recharts";

interface Props {
  categories?: { category: string; amount: number; percentage: number }[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(262, 80%, 60%)",
  "hsl(190, 80%, 50%)",
  "hsl(150, 60%, 50%)",
  "hsl(30, 90%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(210, 70%, 55%)",
  "hsl(45, 80%, 50%)",
];

const CustomContent = (props: any) => {
  const { x, y, width, height, name, value, index } = props;
  if (width < 40 || height < 30) return null;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={COLORS[index % COLORS.length]} fillOpacity={0.25} stroke="hsl(var(--background))" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="hsl(var(--foreground) / 0.6)" fontSize={width > 80 ? 10 : 8} fontWeight={300}>
        {name?.length > 14 ? name.slice(0, 14) + "…" : name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="hsl(var(--muted-foreground) / 0.4)" fontSize={8}>
        ${(value / 1000).toFixed(0)}K
      </text>
    </g>
  );
};

const SpendingTreemap = ({ categories }: Props) => {
  if (!categories?.length) return null;

  const data = categories.map((c, i) => ({
    name: c.category,
    size: c.amount,
    value: c.amount,
  }));

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Spending Treemap</h3>
      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          content={<CustomContent />}
        >
          <Tooltip
            formatter={(v: number) => [`$${v.toLocaleString()}`, "Spending"]}
            contentStyle={{
              background: "hsl(var(--background) / 0.95)",
              border: "1px solid hsl(var(--border) / 0.1)",
              borderRadius: 12,
              fontSize: 10,
              backdropFilter: "blur(12px)",
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

export default SpendingTreemap;
