import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Filter, Search } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: "person" | "company" | "transaction" | "event" | "location" | "product";
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  style: "solid" | "dashed" | "wavy";
}

const nodeColors: Record<string, string> = {
  person: "hsl(220, 60%, 60%)",
  company: "hsl(45, 80%, 55%)",
  transaction: "hsl(140, 50%, 50%)",
  event: "hsl(0, 60%, 55%)",
  location: "hsl(280, 50%, 55%)",
  product: "hsl(180, 50%, 50%)",
};

const nodeShapes: Record<string, string> = {
  person: "●",
  company: "■",
  transaction: "◆",
  event: "▲",
  location: "⬟",
  product: "◯",
};

const MOCK_NODES: GraphNode[] = [
  { id: "1", label: "Alice Chen", type: "person", x: 200, y: 150 },
  { id: "2", label: "Acme Corp", type: "company", x: 450, y: 120 },
  { id: "3", label: "TXN-4721", type: "transaction", x: 350, y: 280 },
  { id: "4", label: "Bob Martinez", type: "person", x: 550, y: 300 },
  { id: "5", label: "New York", type: "location", x: 150, y: 350 },
  { id: "6", label: "Product X", type: "product", x: 650, y: 200 },
  { id: "7", label: "Q4 Review", type: "event", x: 400, y: 420 },
];

const MOCK_EDGES: GraphEdge[] = [
  { from: "1", to: "2", label: "works at", style: "solid" },
  { from: "1", to: "3", label: "initiated", style: "solid" },
  { from: "3", to: "4", label: "received by", style: "solid" },
  { from: "1", to: "5", label: "based in", style: "dashed" },
  { from: "2", to: "6", label: "manufactures", style: "solid" },
  { from: "4", to: "7", label: "attended", style: "dashed" },
  { from: "2", to: "7", label: "organized", style: "solid" },
];

const GraphViewPanel = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [filterType, setFilterType] = useState<string>("");

  const filteredNodes = filterType ? MOCK_NODES.filter((n) => n.type === filterType) : MOCK_NODES;
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = MOCK_EDGES.filter((e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 relative bg-background/50">
        {/* Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={() => setZoom(1)} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Filter */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-card/60 backdrop-blur-sm border border-border/20 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none">
            <option value="">All types</option>
            {Object.keys(nodeColors).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(nodeShapes).map(([type, shape]) => (
              <div key={type} className="flex items-center gap-1.5 text-[10px]">
                <span style={{ color: nodeColors[type] }}>{shape}</span>
                <span className="text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Graph SVG */}
        <svg className="w-full h-full" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          {/* Edges */}
          {filteredEdges.map((edge, i) => {
            const from = MOCK_NODES.find((n) => n.id === edge.from);
            const to = MOCK_NODES.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            return (
              <g key={i}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="hsl(0, 0%, 25%)"
                  strokeWidth={1.5}
                  strokeDasharray={edge.style === "dashed" ? "6,4" : undefined}
                />
                <text
                  x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6}
                  fill="hsl(0, 0%, 45%)" fontSize={9} textAnchor="middle"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => (
            <g key={node.id} onClick={() => setSelectedNode(node)} className="cursor-pointer">
              <circle cx={node.x} cy={node.y} r={22} fill={nodeColors[node.type]} opacity={0.15} stroke={nodeColors[node.type]} strokeWidth={1.5} />
              <circle cx={node.x} cy={node.y} r={6} fill={nodeColors[node.type]} />
              <text x={node.x} y={node.y + 36} fill="hsl(0, 0%, 80%)" fontSize={10} textAnchor="middle" fontWeight={300}>
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-72 border-l border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color: nodeColors[selectedNode.type] }} className="text-lg">{nodeShapes[selectedNode.type]}</span>
              <div>
                <p className="text-sm font-light text-foreground">{selectedNode.label}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{selectedNode.type}</p>
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Properties</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">ID</span><span className="text-foreground font-mono">{selectedNode.id}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Type</span><span className="text-foreground capitalize">{selectedNode.type}</span></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Connections</p>
            <div className="space-y-1">
              {MOCK_EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).map((e, i) => {
                const otherId = e.from === selectedNode.id ? e.to : e.from;
                const other = MOCK_NODES.find((n) => n.id === otherId);
                return (
                  <button key={i} onClick={() => other && setSelectedNode(other)} className="w-full text-left flex items-center gap-2 rounded-lg bg-card/30 px-2 py-1.5 text-[10px] hover:bg-foreground/5 transition-colors">
                    <span style={{ color: nodeColors[other?.type ?? "person"] }}>{nodeShapes[other?.type ?? "person"]}</span>
                    <span className="text-foreground">{other?.label}</span>
                    <span className="text-muted-foreground/50 ml-auto">{e.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphViewPanel;
