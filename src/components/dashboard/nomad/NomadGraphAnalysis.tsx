import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { X, Search, ArrowRight } from "lucide-react";

/* ─── Types ─── */
interface GraphNode {
  id: string;
  label: string;
  type: string;           // person | organization | legal | document | subject
  confidence: number;     // 0-1
  tier?: number;
  tierLabel?: string;
  sourceCount?: number;
  tags?: string[];
  bridge?: boolean;
  singleSource?: boolean;
  cluster?: "professional" | "financial" | "legal";
  x: number;
  y: number;
  pivotQuery?: string;
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

/* ─── Color palette matching the HTML reference exactly ─── */
const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string; textDark: string }> = {
  subject:      { fill: "#FAEEDA", stroke: "#BA7517", text: "#633806", textDark: "#854F0B" },
  person:       { fill: "#EEEDFE", stroke: "#7F77DD", text: "#3C3489", textDark: "#534AB7" },
  person_alt:   { fill: "#FBEAF0", stroke: "#D4537E", text: "#4B1528", textDark: "#993556" },
  org_pro:      { fill: "#E6F1FB", stroke: "#378ADD", text: "#0C447C", textDark: "#185FA5" },
  org_fin:      { fill: "#E1F5EE", stroke: "#1D9E75", text: "#085041", textDark: "#0F6E56" },
  org_fin_alt:  { fill: "#EAF3DE", stroke: "#639922", text: "#173404", textDark: "#3B6D11" },
  legal:        { fill: "#FCEBEB", stroke: "#E24B4A", text: "#501313", textDark: "#A32D2D" },
};

const CLUSTER_CONFIG: Record<string, { fill: string; stroke: string; labelColor: string; label: string }> = {
  professional: { fill: "#185FA5", stroke: "#185FA5", labelColor: "#0C447C", label: "Professional" },
  financial:    { fill: "#1D9E75", stroke: "#1D9E75", labelColor: "#0F6E56", label: "Financial" },
  legal:        { fill: "#E24B4A", stroke: "#E24B4A", labelColor: "#A32D2D", label: "Legal" },
};

/* ─── Helpers ─── */
function getNodeColorSet(type: string, cluster?: string, index?: number): typeof NODE_COLORS.subject {
  if (type === "subject") return NODE_COLORS.subject;
  if (type.includes("legal") || type.includes("case") || type.includes("filing") || type.includes("court") || type.includes("document"))
    return NODE_COLORS.legal;
  if (type.includes("person")) {
    return (index !== undefined && index % 2 === 1) ? NODE_COLORS.person_alt : NODE_COLORS.person;
  }
  if (type.includes("organization") || type.includes("institution") || type.includes("company") || type.includes("holding")) {
    if (cluster === "financial") {
      return (index !== undefined && index % 2 === 1) ? NODE_COLORS.org_fin_alt : NODE_COLORS.org_fin;
    }
    return NODE_COLORS.org_pro;
  }
  return NODE_COLORS.person;
}

function assignCluster(type: string): GraphNode["cluster"] {
  if (type.includes("legal") || type.includes("case") || type.includes("filing") || type.includes("court") || type.includes("document")) return "legal";
  if (type.includes("financial") || type.includes("transaction") || type.includes("investor") || type.includes("holding")) return "financial";
  return "professional";
}

function isPerson(type: string): boolean {
  return type.includes("person") || type === "subject";
}

function isOrg(type: string): boolean {
  return type.includes("organization") || type.includes("institution") || type.includes("company") || type.includes("holding");
}

function isLegal(type: string): boolean {
  return type.includes("legal") || type.includes("case") || type.includes("filing") || type.includes("court") || type.includes("document");
}

/* ─── Force-directed layout ─── */
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const clusterCenters: Record<string, { x: number; y: number }> = {
    professional: { x: width * 0.5,  y: height * 0.22 },
    financial:    { x: width * 0.18, y: height * 0.72 },
    legal:        { x: width * 0.82, y: height * 0.72 },
  };

  const positioned = nodes.map((n, i) => {
    const center = clusterCenters[n.cluster || "professional"];
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const spread = Math.min(width, height) * 0.15;
    return {
      ...n,
      x: center.x + Math.cos(angle) * spread + (Math.random() - 0.5) * 30,
      y: center.y + Math.sin(angle) * spread + (Math.random() - 0.5) * 30,
    };
  });

  // Subject always centered
  const subjectNode = positioned.find(n => n.type === "subject");
  if (subjectNode) {
    subjectNode.x = width * 0.45;
    subjectNode.y = height * 0.48;
  }

  for (let iter = 0; iter < 50; iter++) {
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (positioned[i].type !== "subject") { positioned[i].x -= fx; positioned[i].y -= fy; }
        if (positioned[j].type !== "subject") { positioned[j].x += fx; positioned[j].y += fy; }
      }
    }

    for (const edge of edges) {
      const src = positioned.find(n => n.id === edge.source);
      const tgt = positioned.find(n => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 130) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (src.type !== "subject") { src.x += fx; src.y += fy; }
      if (tgt.type !== "subject") { tgt.x -= fx; tgt.y -= fy; }
    }

    for (const node of positioned) {
      if (node.type === "subject") continue;
      const target = clusterCenters[node.cluster || "professional"];
      node.x += (target.x - node.x) * 0.006;
      node.y += (target.y - node.y) * 0.006;
      node.x = Math.max(70, Math.min(width - 70, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    }
  }

  return positioned;
}

/* ─── Component ─── */
const NomadGraphAnalysis = ({ entities, crossRefMap, subjectName, onPivot }: NomadGraphAnalysisProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 760, height: 440 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<"all" | "person" | "org" | "legal">("all");

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width || 760, height: Math.max(440, entry.contentRect.height || 440) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* Build graph from entities */
  const { graphNodes, graphEdges, clusterBounds } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const topEntities = [...entities]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 35);

    const subjectNameLower = (subjectName || "").toLowerCase().trim();
    let personIdx = 0;
    let orgIdx = 0;

    for (const e of topEntities) {
      const id = `${e.type}:${e.value}`.replace(/[^a-zA-Z0-9:]/g, "_");
      if (nodeIds.has(id)) continue;
      nodeIds.add(id);

      const isSubject = subjectNameLower.length > 2 && e.value.toLowerCase().includes(subjectNameLower);
      const nodeType = isSubject ? "subject" : e.type;
      const cluster = isSubject ? "professional" as const : assignCluster(e.type);
      const sourceKey = `${e.type}:${e.value.toLowerCase().trim()}`;
      const sources = crossRefMap[sourceKey] || [];
      const isBridge = sources.length >= 3;
      const isSingleSource = sources.length <= 1;

      const tierMatch = e.source?.match(/T(\d)/);
      const tier = tierMatch ? parseInt(tierMatch[1]) : 3;
      const tierLabel = e.source || `T${tier}`;

      if (isPerson(nodeType)) personIdx++;
      if (isOrg(nodeType)) orgIdx++;

      nodes.push({
        id,
        label: e.value.length > 20 ? e.value.slice(0, 18) + "…" : e.value,
        type: nodeType,
        confidence: e.confidence,
        tier,
        tierLabel,
        sourceCount: Math.max(sources.length, 1),
        tags: e.source ? [e.source] : [],
        bridge: isBridge,
        singleSource: isSingleSource,
        cluster,
        x: 0, y: 0,
        pivotQuery: `${e.value} ${e.type} background investigation`,
      });
    }

    // Build edges from shared sources
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
            const isLegalEdge = topEntities[i].type.includes("legal") || topEntities[j].type.includes("legal");
            edges.push({
              source: srcId, target: tgtId,
              label: shared.length > 1 ? `${shared.length} sources` : shared[0]?.slice(0, 28) || "",
              edgeType: isLegalEdge ? "adversarial" : shared.length >= 2 ? "confirmed" : "probable",
              confidence: shared.length >= 2 ? undefined : Math.round(Math.min(topEntities[i].confidence, topEntities[j].confidence) * 100),
            });
          }
        }
      }
    }

    const positioned = layoutGraph(nodes, edges, dimensions.width, dimensions.height);

    // Cluster bounds
    const bounds: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const key of ["professional", "financial", "legal"] as const) {
      const cn = positioned.filter(n => n.cluster === key && n.type !== "subject");
      if (cn.length === 0) continue;
      const pad = 40;
      const minX = Math.min(...cn.map(n => n.x)) - pad - (isOrg(cn[0]?.type || "") ? 54 : 22);
      const minY = Math.min(...cn.map(n => n.y)) - pad;
      const maxX = Math.max(...cn.map(n => n.x)) + pad + (isOrg(cn[0]?.type || "") ? 54 : 22);
      const maxY = Math.max(...cn.map(n => n.y)) + pad + 30;
      bounds[key] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { graphNodes: positioned, graphEdges: edges, clusterBounds: bounds };
  }, [entities, crossRefMap, dimensions, subjectName]);

  /* Filter visibility */
  const isVisible = useCallback((node: GraphNode): boolean => {
    if (filter === "all") return true;
    if (filter === "person") return isPerson(node.type);
    if (filter === "org") return isOrg(node.type);
    if (filter === "legal") return isLegal(node.type);
    return true;
  }, [filter]);

  /* Pan handlers */
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest(".node-group")) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)));
  };

  /* Reset view */
  const resetView = () => {
    setFilter("all");
    setSelectedNode(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <svg width="40" height="40" viewBox="0 0 14 14" fill="none" className="mb-4 opacity-20">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </svg>
        <p className="text-sm font-extralight text-muted-foreground">No graph data available.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Run investigations to build the network graph.</p>
      </div>
    );
  }

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "person", label: "People" },
    { id: "org", label: "Orgs" }, { id: "legal", label: "Legal" },
  ];

  const vw = dimensions.width;
  const vh = dimensions.height;

  return (
    <div className="relative flex flex-col rounded-xl border border-border/20 overflow-hidden bg-background">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-secondary/30">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-60">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" />
            <circle cx="7" cy="7" r="2" fill="currentColor" />
            <line x1="7" y1="1" x2="7" y2="4" stroke="currentColor" strokeWidth="1" />
            <line x1="7" y1="10" x2="7" y2="13" stroke="currentColor" strokeWidth="1" />
            <line x1="1" y1="7" x2="4" y2="7" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" />
          </svg>
          Intelligence graph
          {subjectName && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {subjectName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition-all duration-150 cursor-pointer ${
                filter === f.id
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "text-muted-foreground/60 border-border/20 hover:bg-secondary/50 hover:text-foreground"
              }`}>
              {f.label}
            </button>
          ))}
          <button onClick={resetView}
            className="px-2.5 py-1 rounded-md text-[11px] text-muted-foreground/40 border border-border/20 hover:bg-secondary/50 hover:text-foreground transition-all cursor-pointer">
            Reset
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="relative overflow-hidden" style={{ height: `${vh}px` }} ref={containerRef}>
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${vw} ${vh}`}
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            {/* Arrow markers */}
            <marker id="arr-conf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#888780" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="arr-prob" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#B4B2A9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="arr-adv" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="soft-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: `${vw / 2}px ${vh / 2}px` }}>

            {/* ── Cluster backgrounds ── */}
            {Object.entries(clusterBounds).map(([key, b]) => {
              const cfg = CLUSTER_CONFIG[key];
              if (!cfg) return null;
              return (
                <g key={`cluster-${key}`}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10}
                    fill={cfg.fill} fillOpacity={0.04}
                    stroke={cfg.stroke} strokeWidth={0.5} strokeOpacity={0.2}
                    strokeDasharray="4 3" />
                  <text x={b.x + 10} y={b.y + 16} fontSize={10}
                    fill={cfg.labelColor} fillOpacity={0.7}
                    fontWeight={500} style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                    {cfg.label}
                  </text>
                </g>
              );
            })}

            {/* ── Edges ── */}
            {graphEdges.map((edge, idx) => {
              const src = graphNodes.find(n => n.id === edge.source);
              const tgt = graphNodes.find(n => n.id === edge.target);
              if (!src || !tgt) return null;
              if (!isVisible(src) && !isVisible(tgt)) return null;
              const opacity = (!isVisible(src) || !isVisible(tgt)) ? 0.15 : 1;

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              let strokeColor = "#5F5E5A";
              let strokeWidth = 1.2;
              let dash = "none";
              let markerEnd = "url(#arr-conf)";

              if (edge.edgeType === "probable") {
                strokeColor = "#B4B2A9";
                strokeWidth = 1;
                dash = "5 3";
                markerEnd = "url(#arr-prob)";
              } else if (edge.edgeType === "adversarial") {
                strokeColor = "#E24B4A";
                strokeWidth = 1.2;
                dash = "4 2";
                markerEnd = "url(#arr-adv)";
              }

              // Use curved path for adversarial edges
              if (edge.edgeType === "adversarial") {
                const cx = midX + (tgt.y - src.y) * 0.3;
                const cy = midY - (tgt.x - src.x) * 0.15;
                return (
                  <g key={`edge-${idx}`} style={{ opacity, transition: "opacity 0.2s" }}>
                    <path d={`M${src.x} ${src.y} Q${cx} ${cy} ${tgt.x} ${tgt.y}`}
                      stroke={strokeColor} strokeWidth={strokeWidth}
                      strokeDasharray={dash} markerEnd={markerEnd} fill="none" />
                    <text x={cx} y={cy - 6} fontSize={9} fill={strokeColor}
                      textAnchor="middle" style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                      {edge.label}{edge.dateRange ? ` · ${edge.dateRange}` : ""}
                    </text>
                  </g>
                );
              }

              return (
                <g key={`edge-${idx}`} style={{ opacity, transition: "opacity 0.2s" }}>
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor} strokeWidth={strokeWidth}
                    strokeDasharray={dash} markerEnd={markerEnd} />
                  <text x={midX} y={midY - 6} fontSize={9}
                    fill={edge.edgeType === "probable" ? "#B4B2A9" : "#888780"}
                    textAnchor="middle" style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                    {edge.label}{edge.dateRange ? ` · ${edge.dateRange}` : ""}
                    {edge.edgeType === "probable" && edge.confidence ? ` · ${edge.confidence}%` : ""}
                  </text>
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {graphNodes.map((node, nodeIdx) => {
              const isSubject = node.type === "subject";
              const colors = getNodeColorSet(node.type, node.cluster, nodeIdx);
              const vis = isVisible(node);
              const nodeOpacity = vis ? 1 : 0.15;

              return (
                <g key={node.id} className="node-group"
                  style={{ cursor: "pointer", opacity: nodeOpacity, transition: "opacity 0.2s" }}
                  onClick={() => setSelectedNode(node)}>

                  {/* ── SUBJECT NODE (large circle, pulsing ring) ── */}
                  {isSubject && (
                    <>
                      {/* Pulse ring */}
                      <circle cx={node.x} cy={node.y} r={18} fill="none"
                        stroke={colors.stroke} strokeWidth={0.5} opacity={0}>
                        <animate attributeName="r" from="18" to="28" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      {/* Main circle */}
                      <circle cx={node.x} cy={node.y} r={26}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5}
                        className="node-bg" />
                      {/* Name (2 lines inside) */}
                      {node.label.includes(" ") ? (
                        <>
                          <text x={node.x} y={node.y - 4} fontSize={11} fontWeight={500}
                            textAnchor="middle" fill={colors.text}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            {node.label.split(" ").slice(0, -1).join(" ")}
                          </text>
                          <text x={node.x} y={node.y + 10} fontSize={11} fontWeight={500}
                            textAnchor="middle" fill={colors.text}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            {node.label.split(" ").slice(-1)[0]}
                          </text>
                        </>
                      ) : (
                        <text x={node.x} y={node.y + 4} fontSize={11} fontWeight={500}
                          textAnchor="middle" fill={colors.text}
                          style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                          {node.label}
                        </text>
                      )}
                      {/* BRIDGE badge below */}
                      {node.bridge && (
                        <>
                          <rect x={node.x - 28} y={node.y + 30} width={56} height={13} rx={6}
                            fill={colors.stroke} fillOpacity={0.15}
                            stroke={colors.stroke} strokeWidth={0.5} />
                          <text x={node.x} y={node.y + 40} fontSize={8} fontWeight={500}
                            textAnchor="middle" fill={colors.textDark}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            BRIDGE
                          </text>
                        </>
                      )}
                      {/* Confidence badge top-right */}
                      <g transform={`translate(${node.x + 26}, ${node.y - 27})`}>
                        <rect x={0} y={0} width={52} height={18} rx={9}
                          fill={colors.stroke} fillOpacity={0.12}
                          stroke={colors.stroke} strokeWidth={0.5} />
                        <text x={26} y={13} fontSize={9} fontWeight={500}
                          textAnchor="middle" fill={colors.textDark}
                          style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                          conf {Math.round(node.confidence * 100)}%
                        </text>
                      </g>
                    </>
                  )}

                  {/* ── PERSON NODE (circle, r=22) ── */}
                  {isPerson(node.type) && !isSubject && (
                    <>
                      <circle cx={node.x} cy={node.y} r={22}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8}
                        className="node-bg" />
                      {node.label.includes(" ") ? (
                        <>
                          <text x={node.x} y={node.y - 3} fontSize={10} fontWeight={500}
                            textAnchor="middle" fill={colors.text}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            {node.label.split(" ")[0]}
                          </text>
                          <text x={node.x} y={node.y + 10} fontSize={10} fontWeight={500}
                            textAnchor="middle" fill={colors.text}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            {node.label.split(" ").slice(1).join(" ")}
                          </text>
                        </>
                      ) : (
                        <text x={node.x} y={node.y + 4} fontSize={10} fontWeight={500}
                          textAnchor="middle" fill={colors.text}
                          style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                          {node.label}
                        </text>
                      )}
                    </>
                  )}

                  {/* ── ORG NODE (rounded rect) ── */}
                  {isOrg(node.type) && (
                    <>
                      <rect x={node.x - 54} y={node.y - 25} width={108} height={50} rx={6}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8}
                        className="node-bg" />
                      <text x={node.x} y={node.y - 4} fontSize={11} fontWeight={500}
                        textAnchor="middle" fill={colors.text}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 11} fontSize={9}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.tags?.[0] ? `${node.tags[0].slice(0, 20)} · T${node.tier}` : `T${node.tier}`}
                      </text>
                      {/* SINGLE SOURCE badge */}
                      {node.singleSource && !node.bridge && (
                        <>
                          <rect x={node.x - 37} y={node.y + 22} width={74} height={11} rx={5}
                            fill={colors.stroke} fillOpacity={0.15}
                            stroke={colors.stroke} strokeWidth={0.4} />
                          <text x={node.x} y={node.y + 30} fontSize={7.5}
                            textAnchor="middle" fill={colors.text}
                            style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                            SINGLE SOURCE
                          </text>
                        </>
                      )}
                    </>
                  )}

                  {/* ── LEGAL / DOCUMENT NODE (sharp rect + diamond) ── */}
                  {isLegal(node.type) && (
                    <>
                      <rect x={node.x - 52} y={node.y - 26} width={104} height={52} rx={4}
                        fill={colors.fill} stroke={colors.stroke}
                        strokeWidth={node.confidence > 0.8 ? 1 : 0.5}
                        strokeDasharray={node.confidence < 0.7 ? "4 2" : "none"}
                        className="node-bg" />
                      {/* Diamond indicator */}
                      <rect x={node.x - 47} y={node.y - 20} width={10} height={10} rx={1}
                        transform={`rotate(45 ${node.x - 42} ${node.y - 15})`}
                        fill={colors.stroke} fillOpacity={0.4} />
                      <text x={node.x + 5} y={node.y - 4} fontSize={10} fontWeight={500}
                        textAnchor="middle" fill={colors.text}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.label}
                      </text>
                      <text x={node.x + 5} y={node.y + 11} fontSize={9}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.tags?.[0] || `T${node.tier}`}
                      </text>
                    </>
                  )}

                </g>
              );
            })}

          </g>
        </svg>

        {/* ── Detail Panel ── */}
        <div className={`absolute top-3 right-3 z-30 w-[220px] rounded-xl bg-background border border-border/30 transition-opacity duration-200 ${
          selectedNode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`} style={{ fontSize: "12px" }}>
          {selectedNode && (() => {
            const colors = getNodeColorSet(selectedNode.type, selectedNode.cluster);
            const confPct = Math.round(selectedNode.confidence * 100);
            return (
              <div className="p-3.5 space-y-2.5 relative">
                {/* Close */}
                <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/50 hover:bg-secondary transition-colors cursor-pointer">
                  <X className="h-3 w-3" />
                </button>

                {/* Type */}
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                  {selectedNode.type.replace(/_/g, " ")}
                </div>

                {/* Name */}
                <div className="text-[14px] font-medium text-foreground leading-tight pr-5">
                  {selectedNode.label}
                </div>

                {/* Confidence bar */}
                <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${confPct}%`, backgroundColor: colors.stroke }} />
                </div>

                {/* Stats rows */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground/60">Confidence</span>
                    <span className="font-medium text-foreground">{confPct}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground/60">Tier</span>
                    <span className="font-medium text-foreground">{selectedNode.tierLabel || `T${selectedNode.tier}`}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground/60">Sources</span>
                    <span className="font-medium text-foreground">{selectedNode.sourceCount} source{(selectedNode.sourceCount || 0) !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Tags */}
                {selectedNode.tags && selectedNode.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border/20 text-muted-foreground/70">
                        {t}
                      </span>
                    ))}
                    {selectedNode.bridge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        BRIDGE NODE
                      </span>
                    )}
                    {selectedNode.singleSource && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        SINGLE SOURCE
                      </span>
                    )}
                  </div>
                )}

                {/* Investigate button */}
                {onPivot && (
                  <button onClick={() => onPivot(selectedNode.pivotQuery || `Investigate ${selectedNode.label}`)}
                    className="w-full flex items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1.5 text-[12px] text-foreground hover:bg-secondary transition-all cursor-pointer text-left">
                    Investigate → <span className="font-medium">{selectedNode.label}</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center flex-wrap gap-4 px-4 py-2.5 border-t border-border/20 bg-secondary/30">
        {/* Node types */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FAEEDA", border: "1.5px solid #BA7517" }} />
          <span className="text-[11px] text-muted-foreground/70">Subject</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#EEEDFE", border: "1px solid #7F77DD" }} />
          <span className="text-[11px] text-muted-foreground/70">Person</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2" style={{ background: "#E6F1FB", border: "1px solid #378ADD", borderRadius: "2px" }} />
          <span className="text-[11px] text-muted-foreground/70">Organization</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2" style={{ background: "#FCEBEB", border: "1px solid #E24B4A", borderRadius: "2px" }} />
          <span className="text-[11px] text-muted-foreground/70">Legal event</span>
        </div>

        {/* Separator */}
        <div className="w-px h-3 bg-border/20" />

        {/* Edge types */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "1.5px solid #5F5E5A" }} />
          <span className="text-[11px] text-muted-foreground/70">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "2px dashed #B4B2A9", opacity: 0.7 }} />
          <span className="text-[11px] text-muted-foreground/70">Probable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "1.5px solid #E24B4A" }} />
          <span className="text-[11px] text-muted-foreground/70">Adversarial</span>
        </div>
      </div>
    </div>
  );
};

export default NomadGraphAnalysis;
