import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, Hash } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface NomadGraphAnalysisProps {
  entities: { type: string; value: string; confidence: number; source?: string }[];
  crossRefMap: Record<string, string[]>;
}

// Force-directed layout (simplified)
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positioned = nodes.map((n, i) => ({
    ...n,
    x: width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * Math.min(width, height) * 0.35,
    y: height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * Math.min(width, height) * 0.35,
  }));

  // Simple force simulation (10 iterations)
  for (let iter = 0; iter < 30; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 3000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        positioned[i].x -= fx;
        positioned[i].y -= fy;
        positioned[j].x += fx;
        positioned[j].y += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const src = positioned.find(n => n.id === edge.source);
      const tgt = positioned.find(n => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 120) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx; src.y += fy;
      tgt.x -= fx; tgt.y -= fy;
    }

    // Center gravity
    for (const node of positioned) {
      node.x += (width / 2 - node.x) * 0.01;
      node.y += (height / 2 - node.y) * 0.01;
      // Bounds
      node.x = Math.max(60, Math.min(width - 60, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    }
  }

  return positioned;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6", email: "#06b6d4", phone: "#22c55e",
  organization: "#f59e0b", financial: "#10b981", transaction: "#10b981",
  vehicle: "#f97316", location: "#14b8a6", ip_address: "#ef4444",
  cell_tower: "#ef4444", handle: "#6366f1", url: "#8b5cf6",
  role: "#3b82f6", institution: "#f59e0b",
};

function getNodeColor(type: string): string {
  for (const [key, color] of Object.entries(TYPE_COLORS)) {
    if (type.includes(key)) return color;
  }
  return "#64748b";
}

const NomadGraphAnalysis = ({ entities, crossRefMap }: NomadGraphAnalysisProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Build graph from entities + crossRefMap
  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Limit to top 40 entities by confidence
    const topEntities = [...entities]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 40);

    for (const e of topEntities) {
      const id = `${e.type}:${e.value}`.replace(/[^a-zA-Z0-9:]/g, "_");
      if (nodeIds.has(id)) continue;
      nodeIds.add(id);
      graphNodes.push({
        id,
        label: e.value.length > 25 ? e.value.slice(0, 22) + "…" : e.value,
        type: e.type,
        confidence: e.confidence,
        x: 0, y: 0,
      });
    }

    // Create edges based on shared sources
    const entityKeys = topEntities.map(e => `${e.type}:${e.value.toLowerCase().trim()}`);
    for (let i = 0; i < entityKeys.length; i++) {
      const sourcesA = crossRefMap[entityKeys[i]] || [];
      for (let j = i + 1; j < entityKeys.length; j++) {
        const sourcesB = crossRefMap[entityKeys[j]] || [];
        const shared = sourcesA.filter(s => sourcesB.includes(s));
        if (shared.length > 0) {
          const srcId = `${topEntities[i].type}:${topEntities[i].value}`.replace(/[^a-zA-Z0-9:]/g, "_");
          const tgtId = `${topEntities[j].type}:${topEntities[j].value}`.replace(/[^a-zA-Z0-9:]/g, "_");
          if (nodeIds.has(srcId) && nodeIds.has(tgtId)) {
            graphEdges.push({
              source: srcId,
              target: tgtId,
              label: shared.length > 1 ? `${shared.length} sources` : shared[0],
            });
          }
        }
      }
    }

    const positioned = layoutGraph(graphNodes, graphEdges, dimensions.width, dimensions.height);
    return { nodes: positioned, edges: graphEdges };
  }, [entities, crossRefMap, dimensions]);

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Hash className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-extralight text-muted-foreground">No graph data available.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Run investigations to build the network graph.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1.5 rounded-lg bg-card/60 border border-border/20 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-1.5 rounded-lg bg-card/60 border border-border/20 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg bg-card/60 border border-border/20 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border/20 text-[9px] font-extralight tracking-wider text-muted-foreground/50 uppercase">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden bg-card/5">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="w-full h-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          {/* Edges */}
          {edges.map((edge, idx) => {
            const src = nodes.find(n => n.id === edge.source);
            const tgt = nodes.find(n => n.id === edge.target);
            if (!src || !tgt) return null;
            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={isHighlighted ? "hsl(var(--accent))" : "hsl(var(--border) / 0.3)"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  opacity={hoveredNode && !isHighlighted ? 0.1 : 0.6}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const color = getNodeColor(node.type);
            const isHovered = hoveredNode === node.id;
            const isConnected = hoveredNode
              ? edges.some(e => (e.source === hoveredNode && e.target === node.id) || (e.target === hoveredNode && e.source === node.id))
              : false;
            const dimmed = hoveredNode && !isHovered && !isConnected;
            const radius = Math.max(6, Math.min(14, node.confidence * 15));

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer", opacity: dimmed ? 0.15 : 1, transition: "opacity 0.2s" }}
              >
                {/* Glow */}
                {isHovered && (
                  <circle cx={node.x} cy={node.y} r={radius + 8} fill={color} opacity={0.15} />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x} cy={node.y} r={radius}
                  fill={color} fillOpacity={0.3}
                  stroke={color} strokeWidth={isHovered ? 2 : 1}
                />
                {/* Label */}
                <text
                  x={node.x} y={node.y + radius + 14}
                  textAnchor="middle" fontSize={isHovered ? 11 : 9}
                  fill="hsl(var(--foreground))" opacity={dimmed ? 0.3 : 0.8}
                  fontWeight={isHovered ? 400 : 200}
                >
                  {node.label}
                </text>
                {/* Type label */}
                {isHovered && (
                  <text
                    x={node.x} y={node.y + radius + 26}
                    textAnchor="middle" fontSize={8}
                    fill="hsl(var(--muted-foreground))" opacity={0.5}
                  >
                    {node.type.replace(/_/g, " ")} · {Math.round(node.confidence * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default NomadGraphAnalysis;
