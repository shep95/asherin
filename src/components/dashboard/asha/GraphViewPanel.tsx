import { useState, useEffect, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize2, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

const nodeColors: Record<string, string> = {
  dataset: "hsl(220, 60%, 60%)",
  column: "hsl(45, 80%, 55%)",
  type: "hsl(140, 50%, 50%)",
  tag: "hsl(280, 50%, 55%)",
};

const GraphViewPanel = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: datasets } = await supabase
        .from("asha_datasets")
        .select("id, file_name, schema, tags")
        .eq("user_id", user.id)
        .eq("status", "ready");

      if (!datasets || datasets.length === 0) { setLoading(false); return; }

      const gNodes: GraphNode[] = [];
      const gEdges: GraphEdge[] = [];
      const colMap = new Map<string, string>();

      // Place dataset nodes in a circle
      datasets.forEach((ds: any, i: number) => {
        const angle = (2 * Math.PI * i) / datasets.length;
        const cx = 400 + Math.cos(angle) * 200;
        const cy = 300 + Math.sin(angle) * 200;
        gNodes.push({ id: ds.id, label: ds.file_name, type: "dataset", x: cx, y: cy });

        // Add column nodes and edges
        const schema = ds.schema || [];
        schema.forEach((col: any, ci: number) => {
          const colKey = col.name.toLowerCase();
          if (!colMap.has(colKey)) {
            const colAngle = angle + ((ci - schema.length / 2) * 0.15);
            const colX = cx + Math.cos(colAngle) * 120;
            const colY = cy + Math.sin(colAngle) * 120;
            const colId = `col_${colKey}`;
            colMap.set(colKey, colId);
            gNodes.push({ id: colId, label: col.name, type: "column", x: colX, y: colY });
          }
          gEdges.push({ from: ds.id, to: colMap.get(colKey)!, label: `has ${col.type}` });
        });
      });

      // Find shared columns (join keys)
      const colDatasets = new Map<string, string[]>();
      datasets.forEach((ds: any) => {
        (ds.schema || []).forEach((col: any) => {
          const key = col.name.toLowerCase();
          if (!colDatasets.has(key)) colDatasets.set(key, []);
          colDatasets.get(key)!.push(ds.id);
        });
      });

      // Create edges between datasets sharing columns
      colDatasets.forEach((dsIds) => {
        if (dsIds.length > 1) {
          for (let i = 0; i < dsIds.length - 1; i++) {
            for (let j = i + 1; j < dsIds.length; j++) {
              gEdges.push({ from: dsIds[i], to: dsIds[j], label: "shared column" });
            }
          }
        }
      });

      setNodes(gNodes);
      setEdges(gEdges);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  if (nodes.length === 0) {
    return <div className="flex justify-center items-center h-full"><p className="text-xs text-muted-foreground/40">No datasets to visualize. Upload files first.</p></div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 relative bg-background/50">
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={() => setZoom(1)} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><Maximize2 className="h-4 w-4" /></button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Legend</p>
          <div className="space-y-1">
            {Object.entries(nodeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        <svg className="w-full h-full" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          {edges.map((edge, i) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="hsl(0, 0%, 25%)" strokeWidth={1} strokeDasharray="4,3" />
              </g>
            );
          })}
          {nodes.map((node) => (
            <g key={node.id} onClick={() => setSelectedNode(node)} className="cursor-pointer">
              <circle cx={node.x} cy={node.y} r={node.type === "dataset" ? 22 : 14} fill={nodeColors[node.type] || "hsl(0,0%,50%)"} opacity={0.15} stroke={nodeColors[node.type] || "hsl(0,0%,50%)"} strokeWidth={1.5} />
              <circle cx={node.x} cy={node.y} r={node.type === "dataset" ? 6 : 4} fill={nodeColors[node.type] || "hsl(0,0%,50%)"} />
              <text x={node.x} y={node.y + (node.type === "dataset" ? 36 : 24)} fill="hsl(0, 0%, 80%)" fontSize={node.type === "dataset" ? 10 : 8} textAnchor="middle" fontWeight={300}>
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {selectedNode && (
        <div className="w-64 border-l border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-light text-foreground">{selectedNode.label}</p>
            <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <p className="text-[10px] text-muted-foreground capitalize">Type: {selectedNode.type}</p>
          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Connections</p>
            {edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).map((e, i) => {
              const otherId = e.from === selectedNode.id ? e.to : e.from;
              const other = nodes.find((n) => n.id === otherId);
              return (
                <button key={i} onClick={() => other && setSelectedNode(other)} className="w-full text-left flex items-center gap-2 rounded-lg bg-card/30 px-2 py-1.5 text-[10px] hover:bg-foreground/5 transition-colors mb-1">
                  <span className="text-foreground truncate">{other?.label}</span>
                  <span className="text-muted-foreground/50 ml-auto text-[9px]">{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphViewPanel;
