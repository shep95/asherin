import { useMemo } from "react";

interface FlowNode {
  name: string;
  value: number;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
}

interface Props {
  categories?: { category: string; amount: number; percentage: number }[];
  totalSpending: number;
}

const SankeyFlow = ({ categories, totalSpending }: Props) => {
  const data = useMemo(() => {
    if (!categories?.length) return null;

    const width = 900;
    const height = 400;
    const nodeWidth = 18;
    const padding = 40;

    // Left column: Total Budget
    // Middle column: Categories
    // Right column: Sub-items (derived from categories)
    const leftX = padding;
    const midX = width / 2 - nodeWidth / 2;
    const rightX = width - padding - nodeWidth;

    const totalH = height - padding * 2;
    const sourceNode = { name: "Total Budget", x: leftX, y: padding, h: totalH, value: totalSpending };

    // Category nodes
    let yOffset = padding;
    const catNodes = categories.map((c) => {
      const h = Math.max(16, (c.amount / totalSpending) * totalH);
      const node = { name: c.category, x: midX, y: yOffset, h, value: c.amount, pct: c.percentage };
      yOffset += h + 6;
      return node;
    });

    // Normalize if overflow
    const totalCatH = catNodes.reduce((s, n) => s + n.h + 6, 0) - 6;
    if (totalCatH > totalH) {
      const scale = totalH / totalCatH;
      let y = padding;
      catNodes.forEach(n => { n.h *= scale; n.y = y; y += n.h + 4; });
    }

    return { sourceNode, catNodes, width, height, midX, rightX, nodeWidth };
  }, [categories, totalSpending]);

  if (!data || !categories?.length) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[10px] text-muted-foreground/30">No flow data available</p>
      </div>
    );
  }

  const { sourceNode, catNodes, width, height, midX, nodeWidth } = data;

  const colors = [
    "hsl(var(--primary))",
    "hsl(262, 80%, 60%)",
    "hsl(190, 80%, 50%)",
    "hsl(150, 60%, 50%)",
    "hsl(30, 90%, 55%)",
    "hsl(340, 70%, 55%)",
    "hsl(210, 70%, 55%)",
    "hsl(45, 80%, 50%)",
  ];

  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
      <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Money Flow Analysis</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 600 }}>
          {/* Source node */}
          <rect
            x={sourceNode.x}
            y={sourceNode.y}
            width={nodeWidth}
            height={sourceNode.h}
            rx={4}
            fill="hsl(var(--foreground) / 0.15)"
          />
          <text
            x={sourceNode.x + nodeWidth + 8}
            y={sourceNode.y + 14}
            className="text-[10px] fill-[hsl(var(--foreground)/0.5)]"
            fontWeight={300}
          >
            Total Budget
          </text>
          <text
            x={sourceNode.x + nodeWidth + 8}
            y={sourceNode.y + 28}
            className="text-[9px] fill-[hsl(var(--muted-foreground)/0.3)]"
          >
            ${totalSpending.toLocaleString()}
          </text>

          {/* Category nodes & flow paths */}
          {catNodes.map((cat, i) => {
            const color = colors[i % colors.length];

            // Calculate source offset for this flow
            const prevH = catNodes.slice(0, i).reduce((s, n) => s + n.h + 6, 0);
            const srcY = sourceNode.y + (prevH / (catNodes.reduce((s, n) => s + n.h + 6, 0) - 6 || 1)) * sourceNode.h;
            const srcH = (cat.h / (catNodes.reduce((s, n) => s + n.h + 6, 0) - 6 || 1)) * sourceNode.h;

            const x0 = sourceNode.x + nodeWidth;
            const x1 = cat.x;
            const cx = (x0 + x1) / 2;

            return (
              <g key={cat.name}>
                {/* Flow path */}
                <path
                  d={`M${x0},${srcY} C${cx},${srcY} ${cx},${cat.y} ${x1},${cat.y} L${x1},${cat.y + cat.h} C${cx},${cat.y + cat.h} ${cx},${srcY + srcH} ${x0},${srcY + srcH} Z`}
                  fill={color}
                  opacity={0.12}
                />
                {/* Category node */}
                <rect
                  x={cat.x}
                  y={cat.y}
                  width={nodeWidth}
                  height={cat.h}
                  rx={4}
                  fill={color}
                  opacity={0.6}
                />
                {/* Label */}
                <text
                  x={cat.x + nodeWidth + 8}
                  y={cat.y + Math.min(cat.h / 2 + 4, 16)}
                  className="text-[9px] fill-[hsl(var(--foreground)/0.5)]"
                  fontWeight={300}
                >
                  {cat.name}
                </text>
                <text
                  x={cat.x + nodeWidth + 8}
                  y={cat.y + Math.min(cat.h / 2 + 18, 30)}
                  className="text-[8px] fill-[hsl(var(--muted-foreground)/0.3)]"
                >
                  ${cat.amount.toLocaleString()} ({cat.pct}%)
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default SankeyFlow;
