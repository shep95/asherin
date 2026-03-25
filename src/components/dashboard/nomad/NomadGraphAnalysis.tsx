import { useMemo, useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Hash, X, ArrowRight, Search } from "lucide-react";

/* ─── Types ─── */
interface GraphNode {
  id: string;
  label: string;
  type: string;           // person | organization | legal | document | subject | financial | location
  confidence: number;
  tier?: number;
  sourceCount?: number;
  tags?: string[];
  bridge?: boolean;
  singleSource?: boolean;
  cluster?: "professional" | "financial" | "legal";
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  dateRange?: string;
  edgeType: "confirmed" | "probable" | "adversarial";
  confidence?: number;
}

interface NomadGraphAnalysisProps {
  entities: { type: string; value: string; confidence: number; source?: string }[];
  crossRefMap: Record<string, string[]>;
  subjectName?: string;
  onPivot?: (query: string) => void;
}

/* ─── Cluster definitions ─── */
const CLUSTER_CONFIG: Record<string, { color: string; label: string; fill: string; border: string }> = {
  professional: { color: "#3b82f6", label: "Professional", fill: "rgba(59,130,246,0.04)", border: "rgba(59,130,246,0.15)" },
  financial:    { color: "#10b981", label: "Financial",    fill: "rgba(16,185,129,0.04)", border: "rgba(16,185,129,0.15)" },
  legal:        { color: "#ef4444", label: "Legal",        fill: "rgba(239,68,68,0.04)",  border: "rgba(239,68,68,0.15)"  },
};

/* ─── Node color by type ─── */
function getNodeColor(type: string, isSubject: boolean): string {
  if (isSubject) return "#d97706";            // amber
  if (type.includes("person"))       return "#8b5cf6"; // purple
  if (type.includes("organization") || type.includes("institution")) return "#3b82f6"; // blue
  if (type.includes("financial") || type.includes("transaction")) return "#10b981"; // teal
  if (type.includes("legal") || type.includes("case") || type.includes("filing")) return "#ef4444"; // red
  if (type.includes("location"))     return "#14b8a6";
  if (type.includes("email"))        return "#06b6d4";
  if (type.includes("phone"))        return "#22c55e";
  return "#64748b";
}

/* ─── Cluster assignment ─── */
function assignCluster(type: string): GraphNode["cluster"] {
  if (type.includes("legal") || type.includes("case") || type.includes("filing") || type.includes("court")) return "legal";
  if (type.includes("financial") || type.includes("transaction") || type.includes("investor") || type.includes("company") || type.includes("holding")) return "financial";
  return "professional";
}

/* ─── Force-directed layout ─── */
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  // Cluster center targets
  const clusterCenters: Record<string, { x: number; y: number }> = {
    professional: { x: width * 0.5,  y: height * 0.25 },
    financial:    { x: width * 0.25, y: height * 0.72 },
    legal:        { x: width * 0.75, y: height * 0.72 },
  };

  const positioned = nodes.map((n, i) => {
    const center = clusterCenters[n.cluster || "professional"];
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const spread = Math.min(width, height) * 0.18;
    return {
      ...n,
      x: center.x + Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
      y: center.y + Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
    };
  });

  // Force simulation — 40 iterations
  for (let iter = 0; iter < 40; iter++) {
    // Repulsion
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 4000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        positioned[i].x -= fx;
        positioned[i].y -= fy;
        positioned[j].x += fx;
        positioned[j].y += fy;
      }
    }

    // Edge attraction
    for (const edge of edges) {
      const src = positioned.find(n => n.id === edge.source);
      const tgt = positioned.find(n => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 140) * 0.012;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx; src.y += fy;
      tgt.x -= fx; tgt.y -= fy;
    }

    // Cluster gravity
    for (const node of positioned) {
      const target = clusterCenters[node.cluster || "professional"];
      node.x += (target.x - node.x) * 0.008;
      node.y += (target.y - node.y) * 0.008;
    }

    // Center gravity
    for (const node of positioned) {
      node.x += (width / 2 - node.x) * 0.003;
      node.y += (height / 2 - node.y) * 0.003;
      node.x = Math.max(80, Math.min(width - 80, node.x));
      node.y = Math.max(60, Math.min(height - 60, node.y));
    }
  }

  return positioned;
}

/* ─── Component ─── */
const NomadGraphAnalysis = ({ entities, crossRefMap, subjectName, onPivot }: NomadGraphAnalysisProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 560 });
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<"all" | "people" | "orgs" | "legal">("all");

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: Math.max(500, entry.contentRect.height) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* Build graph */
  const { nodes, edges, clusterBounds } = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const topEntities = [...entities]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 40);

    // Detect primary subject
    const subjectNameLower = (subjectName || "").toLowerCase().trim();

    for (const e of topEntities) {
      const id = `${e.type}:${e.value}`.replace(/[^a-zA-Z0-9:]/g, "_");
      if (nodeIds.has(id)) continue;
      nodeIds.add(id);

      const isSubject = subjectNameLower && e.value.toLowerCase().includes(subjectNameLower);
      const cluster = assignCluster(e.type);
      const sourceKey = `${e.type}:${e.value.toLowerCase().trim()}`;
      const sources = crossRefMap[sourceKey] || [];
      const isBridge = sources.length >= 3;
      const isSingleSource = sources.length <= 1;

      graphNodes.push({
        id, label: e.value.length > 22 ? e.value.slice(0, 19) + "…" : e.value,
        type: isSubject ? "subject" : e.type,
        confidence: e.confidence,
        tier: e.source?.includes("T1") ? 1 : e.source?.includes("T2") ? 2 : 3,
        sourceCount: sources.length,
        tags: e.source ? [e.source] : [],
        bridge: isBridge,
        singleSource: isSingleSource,
        cluster,
        x: 0, y: 0,
      });
    }

    // Edges from crossRefMap
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
            const isLegal = topEntities[i].type.includes("legal") || topEntities[j].type.includes("legal");
            graphEdges.push({
              source: srcId, target: tgtId,
              label: shared.length > 1 ? `${shared.length} sources` : shared[0]?.slice(0, 30) || "",
              edgeType: isLegal ? "adversarial" : shared.length >= 2 ? "confirmed" : "probable",
              confidence: shared.length >= 2 ? undefined : Math.round(Math.min(topEntities[i].confidence, topEntities[j].confidence) * 100),
            });
          }
        }
      }
    }

    const positioned = layoutGraph(graphNodes, graphEdges, dimensions.width, dimensions.height);

    // Compute cluster bounding boxes
    const bounds: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const key of ["professional", "financial", "legal"]) {
      const clusterNodes = positioned.filter(n => n.cluster === key);
      if (clusterNodes.length === 0) continue;
      const pad = 45;
      const minX = Math.min(...clusterNodes.map(n => n.x)) - pad;
      const minY = Math.min(...clusterNodes.map(n => n.y)) - pad;
      const maxX = Math.max(...clusterNodes.map(n => n.x)) + pad;
      const maxY = Math.max(...clusterNodes.map(n => n.y)) + pad;
      bounds[key] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { nodes: positioned, edges: graphEdges, clusterBounds: bounds };
  }, [entities, crossRefMap, dimensions, subjectName]);

  /* Filter logic */
  const isNodeVisible = (node: GraphNode): boolean => {
    if (filter === "all") return true;
    if (filter === "people") return node.type.includes("person") || node.type === "subject";
    if (filter === "orgs") return node.type.includes("organization") || node.type.includes("institution") || node.type.includes("company");
    if (filter === "legal") return node.type.includes("legal") || node.type.includes("filing") || node.type.includes("case");
    return true;
  };

  /* Node shape renderer */
  const renderNodeShape = (node: GraphNode, isSubject: boolean, isHovered: boolean) => {
    const color = getNodeColor(node.type, isSubject);
    const radius = isSubject ? 26 : node.type.includes("person") ? 22 : 20;

    if (node.type.includes("person") || isSubject) {
      return (
        <>
          {/* Pulse ring for subject */}
          {isSubject && (
            <circle cx={node.x} cy={node.y} r={radius + 6}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.3}>
              <animate attributeName="r" from={String(radius + 4)} to={String(radius + 14)} dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}
          {/* Glow */}
          {isHovered && <circle cx={node.x} cy={node.y} r={radius + 6} fill={color} opacity={0.12} />}
          {/* Circle */}
          <circle cx={node.x} cy={node.y} r={radius}
            fill={color} fillOpacity={isSubject ? 0.4 : 0.25}
            stroke={color} strokeWidth={isHovered ? 2.5 : 1.5} />
        </>
      );
    }

    if (node.type.includes("organization") || node.type.includes("institution") || node.type.includes("company") || node.type.includes("holding")) {
      const w = 110, h = 36, rx = 8;
      return (
        <>
          {isHovered && <rect x={node.x - w / 2 - 3} y={node.y - h / 2 - 3} width={w + 6} height={h + 6} rx={rx + 2} fill={color} opacity={0.1} />}
          <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={rx}
            fill={color} fillOpacity={0.15}
            stroke={color} strokeWidth={isHovered ? 2 : 1} />
        </>
      );
    }

    // Legal / document: sharp rect with diamond
    const w = 110, h = 36;
    return (
      <>
        {isHovered && <rect x={node.x - w / 2 - 3} y={node.y - h / 2 - 3} width={w + 6} height={h + 6} rx={3} fill={color} opacity={0.1} />}
        <rect x={node.x - w / 2} y={node.y - h / 2} width={w} height={h} rx={2}
          fill={color} fillOpacity={0.15}
          stroke={color} strokeWidth={isHovered ? 2 : 1} />
        {/* Diamond indicator */}
        <polygon
          points={`${node.x - w / 2 - 6},${node.y} ${node.x - w / 2 - 1},${node.y - 5} ${node.x - w / 2 + 4},${node.y} ${node.x - w / 2 - 1},${node.y + 5}`}
          fill={color} fillOpacity={0.6} />
      </>
    );
  };

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Hash className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-extralight text-muted-foreground">No graph data available.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Run investigations to build the network graph.</p>
      </div>
    );
  }

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "people", label: "People" },
    { id: "orgs", label: "Orgs" }, { id: "legal", label: "Legal" },
  ];

  return (
    <div className="relative h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded-full border border-border/30 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
            </div>
            <span className="text-[12px] font-light tracking-wide text-foreground/80">Intelligence graph</span>
          </div>
          {subjectName && (
            <span className="text-[10px] font-extralight px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
              {subjectName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-[10px] font-extralight tracking-wide transition-colors ${
                filter === f.id
                  ? "bg-foreground/10 text-foreground border border-foreground/15"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 border border-transparent"
              }`}>
              {f.label}
            </button>
          ))}
          <button onClick={() => { setFilter("all"); setSelectedNode(null); }}
            className="px-3 py-1 rounded-lg text-[10px] font-extralight text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Canvas + Detail Panel */}
      <div className="flex-1 relative overflow-hidden">
        {/* Zoom controls */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1.5 rounded-lg bg-card/60 border border-border/15 text-muted-foreground/50 hover:text-foreground transition-colors backdrop-blur-sm">
            <ZoomIn className="h-3 w-3" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-1.5 rounded-lg bg-card/60 border border-border/15 text-muted-foreground/50 hover:text-foreground transition-colors backdrop-blur-sm">
            <ZoomOut className="h-3 w-3" />
          </button>
          <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg bg-card/60 border border-border/15 text-muted-foreground/50 hover:text-foreground transition-colors backdrop-blur-sm">
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>

        {/* SVG Canvas */}
        <div ref={containerRef} className="w-full h-full">
          <svg
            width={dimensions.width} height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            {/* Cluster backgrounds */}
            {Object.entries(clusterBounds).map(([key, b]) => {
              const cfg = CLUSTER_CONFIG[key];
              if (!cfg) return null;
              return (
                <g key={`cluster-${key}`}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12}
                    fill={cfg.fill} stroke={cfg.border}
                    strokeWidth={1} strokeDasharray="6 4" />
                  <text x={b.x + 8} y={b.y + 14} fontSize={9} fill={cfg.color} opacity={0.5} fontWeight={300}>
                    {cfg.label}
                  </text>
                </g>
              );
            })}

            {/* Edges */}
            {edges.map((edge, idx) => {
              const src = nodes.find(n => n.id === edge.source);
              const tgt = nodes.find(n => n.id === edge.target);
              if (!src || !tgt) return null;
              const srcVis = isNodeVisible(src);
              const tgtVis = isNodeVisible(tgt);
              if (!srcVis && !tgtVis) return null;

              const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
              const dimmed = hoveredNode && !isHighlighted;
              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              let strokeColor = "hsl(var(--muted-foreground) / 0.25)";
              let dash = "none";
              if (edge.edgeType === "adversarial") { strokeColor = "#ef4444"; dash = "6 3"; }
              else if (edge.edgeType === "probable") { strokeColor = "hsl(var(--muted-foreground) / 0.2)"; dash = "5 3"; }
              if (isHighlighted) strokeColor = edge.edgeType === "adversarial" ? "#f87171" : "hsl(var(--foreground) / 0.5)";

              return (
                <g key={`edge-${idx}`} opacity={dimmed ? 0.08 : 1} style={{ transition: "opacity 0.25s" }}>
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor} strokeWidth={edge.edgeType === "confirmed" ? 1.2 : 1}
                    strokeDasharray={dash} />
                  {/* Edge label */}
                  <text x={midX} y={midY - 4} textAnchor="middle" fontSize={8.5}
                    fill="hsl(var(--muted-foreground))" opacity={isHighlighted ? 0.7 : 0.35}
                    fontWeight={200}>
                    {edge.label}{edge.dateRange ? ` · ${edge.dateRange}` : ""}
                    {edge.edgeType === "probable" && edge.confidence ? ` · ${edge.confidence}%` : ""}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isSubject = node.type === "subject";
              const color = getNodeColor(node.type, isSubject);
              const isHovered = hoveredNode === node.id;
              const visible = isNodeVisible(node);
              const isConnected = hoveredNode
                ? edges.some(e => (e.source === hoveredNode && e.target === node.id) || (e.target === hoveredNode && e.source === node.id))
                : false;
              const dimmed = (!visible || (hoveredNode && !isHovered && !isConnected));
              const isPerson = node.type.includes("person") || isSubject;
              const isOrg = node.type.includes("organization") || node.type.includes("institution") || node.type.includes("company") || node.type.includes("holding");

              return (
                <g key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: "pointer", opacity: dimmed ? 0.12 : 1, transition: "opacity 0.25s" }}>

                  {renderNodeShape(node, isSubject, isHovered)}

                  {/* Label inside rect nodes, below circle nodes */}
                  {isPerson ? (
                    <>
                      <text x={node.x} y={node.y + (isSubject ? 26 : 22) + 14}
                        textAnchor="middle" fontSize={isSubject ? 12 : 10.5}
                        fill="hsl(var(--foreground))" fontWeight={isSubject ? 500 : 300}>
                        {node.label}
                      </text>
                      {/* Subtitle */}
                      {node.tags?.[0] && (
                        <text x={node.x} y={node.y + (isSubject ? 26 : 22) + 26}
                          textAnchor="middle" fontSize={8} fill={color} opacity={0.6} fontWeight={200}>
                          {node.tags[0]}
                        </text>
                      )}
                    </>
                  ) : (
                    <>
                      <text x={node.x} y={node.y - 2} textAnchor="middle" fontSize={10.5}
                        fill="hsl(var(--foreground))" fontWeight={300}>
                        {node.label}
                      </text>
                      {node.tags?.[0] && (
                        <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize={8}
                          fill={color} opacity={0.6} fontWeight={200}>
                          {node.tags[0]}
                        </text>
                      )}
                    </>
                  )}

                  {/* Confidence badge */}
                  {node.confidence > 0 && (
                    <g>
                      <rect x={node.x + (isPerson ? (isSubject ? 18 : 14) : 38)} y={node.y - (isPerson ? (isSubject ? 30 : 26) : 22)}
                        width={30} height={14} rx={7} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={0.5} />
                      <text x={node.x + (isPerson ? (isSubject ? 33 : 29) : 53)} y={node.y - (isPerson ? (isSubject ? 20 : 16) : 12)}
                        textAnchor="middle" fontSize={8} fill={color} fontWeight={400}>
                        {Math.round(node.confidence * 100)}%
                      </text>
                    </g>
                  )}

                  {/* BRIDGE badge */}
                  {node.bridge && (
                    <g>
                      <rect x={node.x - 20} y={node.y + (isPerson ? (isSubject ? 28 : 24) + 24 : 22)}
                        width={40} height={12} rx={6}
                        fill="rgba(217,119,6,0.15)" stroke="rgba(217,119,6,0.3)" strokeWidth={0.5} />
                      <text x={node.x} y={node.y + (isPerson ? (isSubject ? 28 : 24) + 33 : 31)}
                        textAnchor="middle" fontSize={7} fill="#d97706" fontWeight={500} letterSpacing={0.8}>
                        BRIDGE
                      </text>
                    </g>
                  )}

                  {/* SINGLE SOURCE badge */}
                  {node.singleSource && !node.bridge && (
                    <g>
                      <rect x={node.x - 30} y={node.y + (isPerson ? (isSubject ? 28 : 24) + 24 : 22)}
                        width={60} height={12} rx={6}
                        fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.2)" strokeWidth={0.5} />
                      <text x={node.x} y={node.y + (isPerson ? (isSubject ? 28 : 24) + 33 : 31)}
                        textAnchor="middle" fontSize={7} fill="#ef4444" fontWeight={400} opacity={0.7} letterSpacing={0.5}>
                        SINGLE SOURCE
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Detail Panel (slides in from right) ── */}
        <div className={`absolute top-3 right-3 z-30 w-[220px] rounded-xl border border-border/20 bg-card/80 backdrop-blur-xl transition-opacity duration-200 ${
          selectedNode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}>
          {selectedNode && (() => {
            const isSubject = selectedNode.type === "subject";
            const color = getNodeColor(selectedNode.type, isSubject);
            return (
              <div className="p-3 space-y-3">
                {/* Close */}
                <button onClick={() => setSelectedNode(null)}
                  className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground/30 hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                </button>

                {/* Type label */}
                <span className="text-[8px] font-extralight tracking-[0.15em] text-muted-foreground/50 uppercase">
                  {selectedNode.type.replace(/_/g, " ")}
                </span>

                {/* Name */}
                <p className="text-[14px] font-medium text-foreground leading-tight pr-4">{selectedNode.label}</p>

                {/* Confidence bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-extralight text-muted-foreground/50">
                    <span>Confidence</span>
                    <span style={{ color }}>{Math.round(selectedNode.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${selectedNode.confidence * 100}%`, backgroundColor: color }} />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {selectedNode.tier && (
                    <span className="text-[7px] font-extralight px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground/60">
                      Tier {selectedNode.tier}
                    </span>
                  )}
                  {selectedNode.sourceCount !== undefined && (
                    <span className="text-[7px] font-extralight px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground/60">
                      {selectedNode.sourceCount} sources
                    </span>
                  )}
                  {selectedNode.bridge && (
                    <span className="text-[7px] font-extralight px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      BRIDGE
                    </span>
                  )}
                  {selectedNode.singleSource && (
                    <span className="text-[7px] font-extralight px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      SINGLE SOURCE
                    </span>
                  )}
                  {selectedNode.cluster && (
                    <span className="text-[7px] font-extralight px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground/60">
                      {selectedNode.cluster}
                    </span>
                  )}
                </div>

                {/* Investigate button */}
                {onPivot && (
                  <button onClick={() => onPivot(`Investigate ${selectedNode.type.replace(/_/g, " ")}: ${selectedNode.label}`)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-[9px] font-extralight text-accent hover:bg-accent/20 transition-colors">
                    <Search className="h-3 w-3" />
                    Investigate
                    <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center justify-center gap-5 px-4 py-2 border-t border-border/10 bg-card/5">
        {/* Node types */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500/60" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500/30 border border-purple-500/50" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Person</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded-md bg-blue-500/20 border border-blue-500/40" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Organization</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Legal event</span>
        </div>

        <div className="w-px h-3 bg-border/15" />

        {/* Edge types */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0 border-t border-foreground/30" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0 border-t border-dashed border-foreground/20" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Probable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0 border-t border-dashed border-red-400/60" />
          <span className="text-[9px] font-extralight text-muted-foreground/50">Adversarial</span>
        </div>
      </div>
    </div>
  );
};

export default NomadGraphAnalysis;
