import { useState, useEffect, useMemo } from "react";
import { ZoomIn, ZoomOut, Maximize2, Filter, Loader2, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

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
  // Document entity types
  person: "hsl(340, 60%, 55%)",
  organization: "hsl(200, 60%, 55%)",
  party: "hsl(200, 60%, 55%)",
  amount: "hsl(45, 80%, 55%)",
  date: "hsl(140, 50%, 50%)",
  location: "hsl(30, 70%, 55%)",
  clause: "hsl(280, 50%, 55%)",
  obligation: "hsl(0, 60%, 55%)",
  document: "hsl(170, 50%, 50%)",
  // Extended entity types from asha-extract
  product: "hsl(160, 60%, 50%)",
  regulation: "hsl(15, 70%, 55%)",
  case_reference: "hsl(260, 50%, 60%)",
  email: "hsl(50, 70%, 55%)",
  phone: "hsl(90, 50%, 50%)",
  url: "hsl(210, 50%, 60%)",
  job_title: "hsl(310, 50%, 55%)",
  contract_term: "hsl(180, 50%, 50%)",
};

const GraphViewPanel = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"datasets" | "entities">("datasets");
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);

    const load = async () => {
      if (viewMode === "entities") {
        await loadEntityGraph();
      } else {
        await loadDatasetGraph();
      }
      setLoading(false);
    };
    load();
  }, [user, activeSession, viewMode]);

  const loadEntityGraph = async () => {
    // Get documents in this session
    const { data: docs } = await supabase
      .from("asha_documents")
      .select("id, file_name")
      .eq("user_id", user!.id)
      .eq("session_id", activeSession!.id)
      .eq("status", "ready");

    if (!docs || docs.length === 0) { setNodes([]); setEdges([]); return; }

    const docIds = docs.map((d: any) => d.id);

    // Get entities for these documents
    const { data: entities } = await supabase
      .from("asha_document_entities")
      .select("*")
      .eq("user_id", user!.id)
      .in("document_id", docIds)
      .order("confidence", { ascending: false })
      .limit(200);

    if (!entities || entities.length === 0) { setNodes([]); setEdges([]); return; }

    const gNodes: GraphNode[] = [];
    const gEdges: GraphEdge[] = [];
    const nodeMap = new Map<string, string>();

    // Place document nodes in center circle
    docs.forEach((doc: any, i: number) => {
      const angle = (2 * Math.PI * i) / docs.length;
      const cx = 400 + Math.cos(angle) * 120;
      const cy = 300 + Math.sin(angle) * 120;
      const nodeId = `doc_${doc.id}`;
      nodeMap.set(doc.id, nodeId);
      gNodes.push({ id: nodeId, label: doc.file_name, type: "document", x: cx, y: cy });
    });

    // Place entity nodes around their documents
    const byDocument = new Map<string, any[]>();
    entities.forEach((e: any) => {
      if (!byDocument.has(e.document_id)) byDocument.set(e.document_id, []);
      byDocument.get(e.document_id)!.push(e);
    });

    // Deduplicate entities by value
    const uniqueEntities = new Map<string, { entity: any; docIds: string[] }>();
    entities.forEach((e: any) => {
      const key = `${e.entity_type}:${e.entity_value.toLowerCase().trim()}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, { entity: e, docIds: [e.document_id] });
      } else {
        const existing = uniqueEntities.get(key)!;
        if (!existing.docIds.includes(e.document_id)) {
          existing.docIds.push(e.document_id);
        }
      }
    });

    let entityIdx = 0;
    const totalEntities = uniqueEntities.size;
    uniqueEntities.forEach(({ entity, docIds: entityDocIds }, key) => {
      const angle = (2 * Math.PI * entityIdx) / totalEntities;
      const radius = 220 + (entityIdx % 3) * 40;
      const cx = 400 + Math.cos(angle) * radius;
      const cy = 300 + Math.sin(angle) * radius;
      const nodeId = `entity_${key}`;

      gNodes.push({
        id: nodeId,
        label: entity.entity_value.length > 25 ? entity.entity_value.slice(0, 25) + "…" : entity.entity_value,
        type: entity.entity_type,
        x: cx,
        y: cy,
      });

      // Link to all documents this entity appears in
      entityDocIds.forEach((docId: string) => {
        const docNodeId = nodeMap.get(docId);
        if (docNodeId) {
          gEdges.push({ from: docNodeId, to: nodeId, label: entity.entity_type });
        }
      });

      // Cross-document links (entity appears in multiple docs)
      if (entityDocIds.length > 1) {
        for (let i = 0; i < entityDocIds.length - 1; i++) {
          for (let j = i + 1; j < entityDocIds.length; j++) {
            const a = nodeMap.get(entityDocIds[i]);
            const b = nodeMap.get(entityDocIds[j]);
            if (a && b) {
              gEdges.push({ from: a, to: b, label: `shared: ${entity.entity_value.slice(0, 20)}` });
            }
          }
        }
      }

      entityIdx++;
    });

    setNodes(gNodes);
    setEdges(gEdges);
  };

  const loadDatasetGraph = async () => {
    const { data: datasets } = await supabase
      .from("asha_datasets")
      .select("id, file_name, schema, tags")
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .eq("session_id", activeSession!.id);

    if (!datasets || datasets.length === 0) { setNodes([]); setEdges([]); return; }

    const gNodes: GraphNode[] = [];
    const gEdges: GraphEdge[] = [];
    const colMap = new Map<string, string>();

    datasets.forEach((ds: any, i: number) => {
      const angle = (2 * Math.PI * i) / datasets.length;
      const cx = 400 + Math.cos(angle) * 200;
      const cy = 300 + Math.sin(angle) * 200;
      gNodes.push({ id: ds.id, label: ds.file_name, type: "dataset", x: cx, y: cy });

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

    // Shared columns
    const colDatasets = new Map<string, string[]>();
    datasets.forEach((ds: any) => {
      (ds.schema || []).forEach((col: any) => {
        const key = col.name.toLowerCase();
        if (!colDatasets.has(key)) colDatasets.set(key, []);
        colDatasets.get(key)!.push(ds.id);
      });
    });

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
  };

  // Collect unique types for legend
  const activeColors = useMemo(() => {
    const types = new Set(nodes.map(n => n.type));
    return Object.entries(nodeColors).filter(([type]) => types.has(type));
  }, [nodes]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  if (nodes.length === 0) {
    return <div className="flex justify-center items-center h-full"><p className="text-xs text-muted-foreground/40">No data to visualize. Upload files or documents first.</p></div>;
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 relative bg-background/50">
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={() => setZoom(1)} className="rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors"><Maximize2 className="h-4 w-4" /></button>
        </div>

        {/* View mode toggle */}
        <div className="absolute top-4 right-4 z-10 flex rounded-lg border border-border/20 bg-card/60 backdrop-blur-sm overflow-hidden">
          <button onClick={() => setViewMode("datasets")} className={`px-3 py-1.5 text-[10px] transition-colors ${viewMode === "datasets" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Filter className="h-3 w-3 inline mr-1" />Datasets
          </button>
          <button onClick={() => setViewMode("entities")} className={`px-3 py-1.5 text-[10px] transition-colors ${viewMode === "entities" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Users className="h-3 w-3 inline mr-1" />Entities
          </button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Legend</p>
          <div className="space-y-1">
            {activeColors.map(([type, color]) => (
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
              <circle cx={node.x} cy={node.y} r={node.type === "dataset" || node.type === "document" ? 22 : 14} fill={nodeColors[node.type] || "hsl(0,0%,50%)"} opacity={0.15} stroke={nodeColors[node.type] || "hsl(0,0%,50%)"} strokeWidth={1.5} />
              <circle cx={node.x} cy={node.y} r={node.type === "dataset" || node.type === "document" ? 6 : 4} fill={nodeColors[node.type] || "hsl(0,0%,50%)"} />
              <text x={node.x} y={node.y + (node.type === "dataset" || node.type === "document" ? 36 : 24)} fill="hsl(0, 0%, 80%)" fontSize={node.type === "dataset" || node.type === "document" ? 10 : 8} textAnchor="middle" fontWeight={300}>
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
            {edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).slice(0, 20).map((e, i) => {
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
