import { useMemo } from "react";
import type { GraphEdge, GraphNode } from "./types";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect?: (node: GraphNode) => void;
  height?: number;
}

const KIND_RADIUS: Record<GraphNode["kind"], number> = {
  document: 5, host: 8, author: 9, device: 9, ip: 7, asn: 7, geo: 8, software: 7,
};

/**
 * Deterministic radial layout — documents on the outer ring, shared dimensions
 * on the inner ring. No physics loop: the render is O(n) and never animates a
 * layout, so the panel stays at 60fps with hundreds of nodes and honours
 * reduced-motion by construction.
 */
const GhostGraph = ({ nodes, edges, onSelect, height = 380 }: Props) => {
  const layout = useMemo(() => {
    const W = 800, H = height, cx = W / 2, cy = H / 2;
    const docs = nodes.filter((n) => n.kind === "document");
    const dims = nodes.filter((n) => n.kind !== "document");
    const pos = new Map<string, { x: number; y: number }>();

    const place = (list: GraphNode[], radius: number, offset: number) => {
      const n = Math.max(list.length, 1);
      list.forEach((node, i) => {
        const a = offset + (i / n) * Math.PI * 2;
        pos.set(node.id, { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius * 0.78 });
      });
    };
    place(docs, Math.min(W, H) * 0.42, -Math.PI / 2);
    place(dims, Math.min(W, H) * 0.17, Math.PI / 6);

    return { W, H, pos };
  }, [nodes, height]);

  if (!nodes.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground/40">
        No graph edges — nothing in this corpus shares a metadata dimension yet.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${layout.W} ${layout.H}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Metadata graph with ${nodes.length} nodes and ${edges.length} edges`}
    >
      <g stroke="currentColor" className="text-foreground/12">
        {edges.map((e, i) => {
          const a = layout.pos.get(e.source), b = layout.pos.get(e.target);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={Math.min(e.weight, 3)} />;
        })}
      </g>
      <g>
        {nodes.map((n) => {
          const p = layout.pos.get(n.id);
          if (!p) return null;
          const isDoc = n.kind === "document";
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              onClick={() => onSelect?.(n)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              <circle
                r={KIND_RADIUS[n.kind]}
                className={isDoc ? "fill-foreground/25 stroke-foreground/40" : "fill-foreground/60 stroke-foreground"}
                strokeWidth={1}
              />
              {!isDoc && (
                <text y={-KIND_RADIUS[n.kind] - 5} textAnchor="middle" className="fill-foreground/70" style={{ fontSize: 9 }}>
                  {n.label.length > 26 ? `${n.label.slice(0, 26)}…` : n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default GhostGraph;
