import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { X, Loader2, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";

/* ─── Types ─── */
interface GraphNode {
  id: string;
  label: string;
  type: string;
  confidence?: number;
  tier?: number;
  tierLabel?: string;
  sourceCount?: number;
  tags?: string[];
  bridge?: boolean;
  singleSource?: boolean;
  cluster?: "data" | "entity" | "relationship";
  x: number;
  y: number;
  docIds?: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  edgeType: "confirmed" | "probable" | "inferred" | "adversarial";
  confidence?: number;
}

/* ─── Modern color palette (Zophiel/Nomad parity) ─── */
const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string; textDark: string }> = {
  document:       { fill: "#FAEEDA", stroke: "#BA7517", text: "#633806", textDark: "#854F0B" },
  dataset:        { fill: "#FAEEDA", stroke: "#BA7517", text: "#633806", textDark: "#854F0B" },
  person:         { fill: "#EEEDFE", stroke: "#7F77DD", text: "#3C3489", textDark: "#534AB7" },
  person_alt:     { fill: "#FBEAF0", stroke: "#D4537E", text: "#4B1528", textDark: "#993556" },
  party:          { fill: "#EEEDFE", stroke: "#7F77DD", text: "#3C3489", textDark: "#534AB7" },
  organization:   { fill: "#E6F1FB", stroke: "#378ADD", text: "#0C447C", textDark: "#185FA5" },
  organization_alt:{ fill: "#EAF3DE", stroke: "#639922", text: "#173404", textDark: "#3B6D11" },
  location:       { fill: "#E1F5EE", stroke: "#1D9E75", text: "#085041", textDark: "#0F6E56" },
  amount:         { fill: "#FDF3D6", stroke: "#C8911A", text: "#5A3F03", textDark: "#8A6510" },
  date:           { fill: "#E5F2DA", stroke: "#5C9A2C", text: "#1F3D08", textDark: "#3F6D14" },
  obligation:     { fill: "#FCEBEB", stroke: "#E24B4A", text: "#501313", textDark: "#A32D2D" },
  clause:         { fill: "#F2EAFB", stroke: "#9159C6", text: "#321454", textDark: "#5A2A8A" },
  email:          { fill: "#FDF3D6", stroke: "#C8911A", text: "#5A3F03", textDark: "#8A6510" },
  phone:          { fill: "#EAF3DE", stroke: "#639922", text: "#173404", textDark: "#3B6D11" },
  url:            { fill: "#E6F1FB", stroke: "#378ADD", text: "#0C447C", textDark: "#185FA5" },
  product:        { fill: "#E1F5EE", stroke: "#1D9E75", text: "#085041", textDark: "#0F6E56" },
  regulation:     { fill: "#FCEBEB", stroke: "#E24B4A", text: "#501313", textDark: "#A32D2D" },
  case_reference: { fill: "#F2EAFB", stroke: "#9159C6", text: "#321454", textDark: "#5A2A8A" },
  job_title:      { fill: "#FBEAF0", stroke: "#D4537E", text: "#4B1528", textDark: "#993556" },
  contract_term:  { fill: "#E1F5EE", stroke: "#1D9E75", text: "#085041", textDark: "#0F6E56" },
  column:         { fill: "#FDF3D6", stroke: "#C8911A", text: "#5A3F03", textDark: "#8A6510" },
  type:           { fill: "#E5F2DA", stroke: "#5C9A2C", text: "#1F3D08", textDark: "#3F6D14" },
  tag:            { fill: "#F2EAFB", stroke: "#9159C6", text: "#321454", textDark: "#5A2A8A" },
};

const DEFAULT_COLORS = { fill: "#EEEDFE", stroke: "#7F77DD", text: "#3C3489", textDark: "#534AB7" };

function getColors(type: string, idx?: number) {
  if (type === "person" || type === "party") {
    return (idx !== undefined && idx % 2 === 1) ? NODE_COLORS.person_alt : NODE_COLORS.person;
  }
  if (type === "organization") {
    return (idx !== undefined && idx % 3 === 1) ? NODE_COLORS.organization_alt : NODE_COLORS.organization;
  }
  return NODE_COLORS[type] || DEFAULT_COLORS;
}

/* ─── Cluster config (matches Zophiel/Nomad style) ─── */
const CLUSTER_CONFIG: Record<string, { fill: string; stroke: string; labelColor: string; label: string }> = {
  data:         { fill: "#BA7517", stroke: "#BA7517", labelColor: "#854F0B", label: "Documents & Data" },
  entity:       { fill: "#7F77DD", stroke: "#7F77DD", labelColor: "#534AB7", label: "Extracted Entities" },
  relationship: { fill: "#1D9E75", stroke: "#1D9E75", labelColor: "#0F6E56", label: "Cross-References" },
};

function isDocType(type: string): boolean {
  return type === "document" || type === "dataset";
}

function isPersonType(type: string): boolean {
  return type === "person" || type === "party";
}

function isOrgType(type: string): boolean {
  return type === "organization";
}

/* ─── Force-directed layout ─── */
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): GraphNode[] {
  const clusterCenters: Record<string, { x: number; y: number }> = {
    data:   { x: w * 0.5, y: h * 0.26 },
    entity: { x: w * 0.5, y: h * 0.74 },
  };

  const pos = nodes.map((n, i) => {
    const center = clusterCenters[n.cluster || "entity"];
    const count = nodes.filter(nn => nn.cluster === n.cluster).length;
    const idx = nodes.filter((nn, ni) => nn.cluster === n.cluster && ni < i).length;
    const angle = (idx / Math.max(1, count)) * Math.PI * 2;
    const spread = Math.min(w, h) * 0.2;
    return {
      ...n,
      x: center.x + Math.cos(angle) * spread + (Math.random() - 0.5) * 30,
      y: center.y + Math.sin(angle) * spread + (Math.random() - 0.5) * 30,
    };
  });

  for (let iter = 0; iter < 50; iter++) {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pos[i].x -= fx; pos[i].y -= fy;
        pos[j].x += fx; pos[j].y += fy;
      }
    }
    for (const edge of edges) {
      const src = pos.find(n => n.id === edge.source);
      const tgt = pos.find(n => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - 130) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx; src.y += fy;
      tgt.x -= fx; tgt.y -= fy;
    }
    for (const node of pos) {
      const target = clusterCenters[node.cluster || "entity"];
      node.x += (target.x - node.x) * 0.006;
      node.y += (target.y - node.y) * 0.006;
      node.x = Math.max(70, Math.min(w - 70, node.x));
      node.y = Math.max(50, Math.min(h - 50, node.y));
    }
  }

  return pos;
}

/* ─── Component ─── */
const GraphViewPanel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawNodes, setRawNodes] = useState<GraphNode[]>([]);
  const [rawEdges, setRawEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"datasets" | "entities">("entities");
  const [filter, setFilter] = useState<"all" | "docs" | "people" | "orgs" | "other">("all");
  const [dimensions, setDimensions] = useState({ width: 760, height: 440 });
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 760,
          height: Math.max(440, entry.contentRect.height || 440)
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  /* ── Data loading ── */
  const loadEntityGraph = async () => {
    const { data: docs } = await supabase
      .from("asha_documents")
      .select("id, file_name")
      .eq("user_id", user!.id)
      .eq("session_id", activeSession!.id)
      .eq("status", "ready");

    if (!docs || docs.length === 0) { setRawNodes([]); setRawEdges([]); return; }
    const docIds = docs.map((d: any) => d.id);

    const { data: entities } = await supabase
      .from("asha_document_entities")
      .select("*")
      .eq("user_id", user!.id)
      .in("document_id", docIds)
      .order("confidence", { ascending: false })
      .limit(200);

    if (!entities || entities.length === 0) { setRawNodes([]); setRawEdges([]); return; }

    const gNodes: GraphNode[] = [];
    const gEdges: GraphEdge[] = [];
    const nodeMap = new Map<string, string>();

    docs.forEach((doc: any) => {
      const nodeId = `doc_${doc.id}`;
      nodeMap.set(doc.id, nodeId);
      gNodes.push({
        id: nodeId,
        label: doc.file_name.length > 22 ? doc.file_name.slice(0, 20) + "…" : doc.file_name,
        type: "document", cluster: "data", x: 0, y: 0,
        confidence: 1, tier: 1, tierLabel: "T1 (Uploaded)", sourceCount: 1,
        tags: ["Source document"],
      });
    });

    const uniqueEntities = new Map<string, { entity: any; docIds: string[] }>();
    entities.forEach((e: any) => {
      const key = `${e.entity_type}:${e.entity_value.toLowerCase().trim()}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, { entity: e, docIds: [e.document_id] });
      } else {
        const existing = uniqueEntities.get(key)!;
        if (!existing.docIds.includes(e.document_id)) existing.docIds.push(e.document_id);
      }
    });

    uniqueEntities.forEach(({ entity, docIds: entityDocIds }, key) => {
      const nodeId = `entity_${key}`;
      const isBridge = entityDocIds.length >= 2;
      const isSingle = entityDocIds.length <= 1;

      gNodes.push({
        id: nodeId,
        label: entity.entity_value.length > 20 ? entity.entity_value.slice(0, 18) + "…" : entity.entity_value,
        type: entity.entity_type,
        cluster: "entity",
        x: 0, y: 0,
        confidence: entity.confidence || 0.7,
        tier: isBridge ? 1 : 2,
        tierLabel: isBridge ? `T1 (${entityDocIds.length} docs)` : "T2 (single doc)",
        sourceCount: entityDocIds.length,
        tags: [entity.entity_type, ...(entity.entity_label ? [entity.entity_label] : [])],
        bridge: isBridge,
        singleSource: isSingle,
        docIds: entityDocIds,
      });

      entityDocIds.forEach((docId: string) => {
        const docNodeId = nodeMap.get(docId);
        if (docNodeId) {
          const isAdverse = entity.entity_type === "obligation" || entity.entity_type === "regulation";
          gEdges.push({
            source: docNodeId, target: nodeId,
            label: entity.entity_type,
            edgeType: isAdverse
              ? "adversarial"
              : (entity.confidence || 0) >= 0.8 ? "confirmed" : "probable",
            confidence: entity.confidence ? Math.round(entity.confidence * 100) : undefined,
          });
        }
      });
    });

    setRawNodes(gNodes);
    setRawEdges(gEdges);
  };

  const loadDatasetGraph = async () => {
    const { data: datasets } = await supabase
      .from("asha_datasets")
      .select("id, file_name, schema, tags")
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .eq("session_id", activeSession!.id);

    if (!datasets || datasets.length === 0) { setRawNodes([]); setRawEdges([]); return; }

    const gNodes: GraphNode[] = [];
    const gEdges: GraphEdge[] = [];
    const colMap = new Map<string, string>();

    datasets.forEach((ds: any) => {
      gNodes.push({
        id: ds.id,
        label: ds.file_name.length > 20 ? ds.file_name.slice(0, 18) + "…" : ds.file_name,
        type: "dataset", cluster: "data", x: 0, y: 0,
        confidence: 1, tier: 1, tierLabel: "T1 (Uploaded)", sourceCount: 1,
        tags: ds.tags || ["Dataset"],
      });

      const schema = ds.schema || [];
      schema.forEach((col: any) => {
        const colKey = col.name.toLowerCase();
        if (!colMap.has(colKey)) {
          const colId = `col_${colKey}`;
          colMap.set(colKey, colId);
          gNodes.push({
            id: colId, label: col.name, type: "column",
            cluster: "entity", x: 0, y: 0,
            confidence: 1, tags: [col.type || "column"],
          });
        }
        gEdges.push({
          source: ds.id, target: colMap.get(colKey)!,
          label: `has ${col.type || "column"}`,
          edgeType: "confirmed",
        });
      });
    });

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
            gEdges.push({ source: dsIds[i], target: dsIds[j], label: "shared column", edgeType: "inferred" });
          }
        }
      }
    });

    setRawNodes(gNodes);
    setRawEdges(gEdges);
  };

  const loadGraph = useCallback(async () => {
    if (!user || !activeSession) return;
    setLoading(true);
    if (viewMode === "entities") {
      await loadEntityGraph();
    } else {
      await loadDatasetGraph();
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeSession, viewMode]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`graph-rt-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_document_entities' }, () => {
        if (viewMode === "entities") loadGraph();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_datasets', filter: `session_id=eq.${activeSession.id}` }, () => {
        if (viewMode === "datasets") loadGraph();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, viewMode, loadGraph]);

  /* ── Layout ── */
  const { graphNodes, graphEdges, clusterBounds } = useMemo(() => {
    if (rawNodes.length === 0) return { graphNodes: [], graphEdges: [], clusterBounds: {} as Record<string, { x: number; y: number; w: number; h: number }> };
    const positioned = layoutGraph(rawNodes, rawEdges, dimensions.width, dimensions.height);

    const bounds: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const key of ["data", "entity"] as const) {
      const cn = positioned.filter(n => n.cluster === key);
      if (cn.length === 0) continue;
      const pad = 40;
      const minX = Math.min(...cn.map(n => n.x)) - pad - 55;
      const minY = Math.min(...cn.map(n => n.y)) - pad - 10;
      const maxX = Math.max(...cn.map(n => n.x)) + pad + 55;
      const maxY = Math.max(...cn.map(n => n.y)) + pad + 30;
      bounds[key] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { graphNodes: positioned, graphEdges: rawEdges, clusterBounds: bounds };
  }, [rawNodes, rawEdges, dimensions]);

  /* ── Filter ── */
  const isVisible = useCallback((node: GraphNode): boolean => {
    if (filter === "all") return true;
    if (filter === "docs") return isDocType(node.type);
    if (filter === "people") return isPersonType(node.type);
    if (filter === "orgs") return isOrgType(node.type);
    return !isDocType(node.type) && !isPersonType(node.type) && !isOrgType(node.type);
  }, [filter]);

  /* ── Pan/zoom ── */
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

  const resetView = () => { setFilter("all"); setSelectedNode(null); setZoom(1); setPan({ x: 0, y: 0 }); };

  /* ── Connections for selected node ── */
  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return graphEdges
      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
      .map(e => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const other = graphNodes.find(n => n.id === otherId);
        return { edge: e, other };
      })
      .filter(c => c.other)
      .slice(0, 15);
  }, [selectedNode, graphEdges, graphNodes]);

  const vw = dimensions.width;
  const vh = dimensions.height;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <svg width="40" height="40" viewBox="0 0 14 14" fill="none" className="mb-4 opacity-20">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </svg>
        <p className="text-sm font-extralight text-muted-foreground">No graph data in this session yet.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1 max-w-xs">
          {viewMode === "entities"
            ? "Upload documents via Doc Intel to extract entities and build the knowledge graph."
            : "Upload structured datasets (CSV, JSON) via Ingest to visualize schema relationships."}
        </p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setViewMode(viewMode === "entities" ? "datasets" : "entities")}
            className="px-3 py-1.5 rounded-lg border border-border/20 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Try {viewMode === "entities" ? "Dataset" : "Entity"} View
          </button>
        </div>
      </div>
    );
  }

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "docs", label: "Docs" },
    { id: "people", label: "People" }, { id: "orgs", label: "Orgs" },
    { id: "other", label: "Other" },
  ];

  return (
    <div className="relative flex flex-col h-full rounded-xl border border-border/20 overflow-hidden bg-background">

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
          {activeSession && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {activeSession.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-border/20 overflow-hidden mr-2">
            <button onClick={() => setViewMode("entities")}
              className={`px-2 py-1 text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "entities" ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"
              }`}>
              <Users className="h-3 w-3" /> Entities
            </button>
            <button onClick={() => setViewMode("datasets")}
              className={`px-2 py-1 text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "datasets" ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"
              }`}>
              <FileText className="h-3 w-3" /> Datasets
            </button>
          </div>

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
      <div className="relative flex-1 overflow-hidden" ref={containerRef}>
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
            <marker id="azp-arr-conf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#888780" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="azp-arr-prob" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#B4B2A9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="azp-arr-adv" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="azp-arr-inf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="#9159C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="azp-soft-shadow">
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
              let markerEnd = "url(#azp-arr-conf)";
              let labelColor = "#888780";

              if (edge.edgeType === "probable") {
                strokeColor = "#B4B2A9";
                strokeWidth = 1;
                dash = "5 3";
                markerEnd = "url(#azp-arr-prob)";
                labelColor = "#B4B2A9";
              } else if (edge.edgeType === "adversarial") {
                strokeColor = "#E24B4A";
                strokeWidth = 1.2;
                dash = "4 2";
                markerEnd = "url(#azp-arr-adv)";
                labelColor = "#E24B4A";
              } else if (edge.edgeType === "inferred") {
                strokeColor = "#9159C6";
                strokeWidth = 0.9;
                dash = "3 3";
                markerEnd = "url(#azp-arr-inf)";
                labelColor = "#9159C6";
              }

              if (edge.edgeType === "adversarial") {
                const cx = midX + (tgt.y - src.y) * 0.3;
                const cy = midY - (tgt.x - src.x) * 0.15;
                return (
                  <g key={`edge-${idx}`} style={{ opacity, transition: "opacity 0.2s" }}>
                    <path d={`M${src.x} ${src.y} Q${cx} ${cy} ${tgt.x} ${tgt.y}`}
                      stroke={strokeColor} strokeWidth={strokeWidth}
                      strokeDasharray={dash} markerEnd={markerEnd} fill="none" />
                    <text x={cx} y={cy - 6} fontSize={9} fill={labelColor}
                      textAnchor="middle" style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                      {edge.label}
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
                    fill={labelColor}
                    textAnchor="middle" style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                    {edge.label}
                    {edge.edgeType === "probable" && edge.confidence ? ` · ${edge.confidence}%` : ""}
                  </text>
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {graphNodes.map((node, nodeIdx) => {
              const colors = getColors(node.type, nodeIdx);
              const vis = isVisible(node);
              const nodeOpacity = vis ? 1 : 0.15;
              const isDoc = isDocType(node.type);
              const isPerson_ = isPersonType(node.type);
              const isOrg = isOrgType(node.type);

              return (
                <g key={node.id} className="node-group"
                  style={{ cursor: "pointer", opacity: nodeOpacity, transition: "opacity 0.2s" }}
                  onClick={() => setSelectedNode(node)}>

                  {/* ── DOCUMENT / DATASET (rounded rect with diamond accent) ── */}
                  {isDoc && (
                    <>
                      <rect x={node.x - 54} y={node.y - 26} width={108} height={52} rx={6}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={1.2}
                        filter="url(#azp-soft-shadow)" />
                      <rect x={node.x - 49} y={node.y - 20} width={10} height={10} rx={1}
                        transform={`rotate(45 ${node.x - 44} ${node.y - 15})`}
                        fill={colors.stroke} fillOpacity={0.4} />
                      <text x={node.x + 5} y={node.y - 4} fontSize={10} fontWeight={500}
                        textAnchor="middle" fill={colors.text}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.label}
                      </text>
                      <text x={node.x + 5} y={node.y + 11} fontSize={9}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        Source · T1
                      </text>
                    </>
                  )}

                  {/* ── PERSON (circle) ── */}
                  {isPerson_ && (
                    <>
                      <circle cx={node.x} cy={node.y} r={22}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8}
                        filter="url(#azp-soft-shadow)" />
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

                  {/* ── ORGANIZATION (rounded rect) ── */}
                  {isOrg && (
                    <>
                      <rect x={node.x - 54} y={node.y - 25} width={108} height={50} rx={6}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8}
                        filter="url(#azp-soft-shadow)" />
                      <text x={node.x} y={node.y - 4} fontSize={11} fontWeight={500}
                        textAnchor="middle" fill={colors.text}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 11} fontSize={9}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.tags?.[0] ? `${node.tags[0].slice(0, 18)} · T${node.tier ?? 2}` : `Organization · T${node.tier ?? 2}`}
                      </text>
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

                  {/* ── OTHER ENTITY (small rounded rect) ── */}
                  {!isDoc && !isPerson_ && !isOrg && (
                    <>
                      <rect x={node.x - 50} y={node.y - 20} width={100} height={40} rx={5}
                        fill={colors.fill} stroke={colors.stroke} strokeWidth={0.7}
                        filter="url(#azp-soft-shadow)" />
                      <circle cx={node.x - 42} cy={node.y} r={3.2}
                        fill={colors.stroke} fillOpacity={0.7} />
                      <text x={node.x + 4} y={node.y - 2} fontSize={10} fontWeight={500}
                        textAnchor="middle" fill={colors.text}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.label}
                      </text>
                      <text x={node.x + 4} y={node.y + 10} fontSize={8}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        {node.type.replace(/_/g, " ")}
                      </text>
                    </>
                  )}

                  {/* ── BRIDGE badge ── */}
                  {node.bridge && (
                    <>
                      <rect x={node.x - 28} y={node.y + (isPerson_ ? 26 : isDoc ? 30 : 22)} width={56} height={13} rx={6}
                        fill={colors.stroke} fillOpacity={0.18}
                        stroke={colors.stroke} strokeWidth={0.5} />
                      <text x={node.x} y={node.y + (isPerson_ ? 36 : isDoc ? 40 : 32)} fontSize={8} fontWeight={500}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)", letterSpacing: "0.06em" }}>
                        BRIDGE
                      </text>
                    </>
                  )}

                  {/* ── Confidence pill (top-right) ── */}
                  {node.confidence !== undefined && node.confidence < 1 && !isDoc && (
                    <g transform={`translate(${node.x + (isPerson_ ? 18 : 38)}, ${node.y - (isPerson_ ? 28 : 26)})`}>
                      <rect x={0} y={0} width={52} height={18} rx={9}
                        fill={colors.stroke} fillOpacity={0.12}
                        stroke={colors.stroke} strokeWidth={0.5} />
                      <text x={26} y={13} fontSize={9} fontWeight={500}
                        textAnchor="middle" fill={colors.textDark}
                        style={{ fontFamily: "var(--font-sans, sans-serif)" }}>
                        conf {Math.round(node.confidence * 100)}%
                      </text>
                    </g>
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
            const colors = getColors(selectedNode.type);
            const confPct = Math.round((selectedNode.confidence || 0) * 100);
            return (
              <div className="p-3.5 space-y-2.5 relative">
                <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/50 hover:bg-secondary transition-colors cursor-pointer">
                  <X className="h-3 w-3" />
                </button>

                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                  {selectedNode.type.replace(/_/g, " ")}
                </div>

                <div className="text-[14px] font-medium text-foreground leading-tight pr-5">
                  {selectedNode.label}
                </div>

                <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${confPct}%`, backgroundColor: colors.stroke }} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground/60">Confidence</span>
                    <span className="font-medium text-foreground">{confPct}%</span>
                  </div>
                  {selectedNode.tierLabel && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground/60">Tier</span>
                      <span className="font-medium text-foreground">{selectedNode.tierLabel}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground/60">Sources</span>
                    <span className="font-medium text-foreground">{selectedNode.sourceCount || 1} source{(selectedNode.sourceCount || 1) !== 1 ? "s" : ""}</span>
                  </div>
                </div>

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

                {selectedConnections.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/15">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">Connections</span>
                    {selectedConnections.map((c, i) => (
                      <button key={i} onClick={() => c.other && setSelectedNode(c.other)}
                        className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1 text-[10px] hover:bg-secondary/50 transition-colors cursor-pointer">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: getColors(c.other!.type).stroke }} />
                        <span className="text-foreground truncate">{c.other!.label}</span>
                        <span className="text-muted-foreground/40 ml-auto text-[8px]">{c.edge.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center flex-wrap gap-4 px-4 py-2.5 border-t border-border/20 bg-secondary/30">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2" style={{ background: "#FAEEDA", border: "1px solid #BA7517", borderRadius: "2px" }} />
          <span className="text-[11px] text-muted-foreground/70">Document</span>
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
          <div className="w-3 h-2" style={{ background: "#E1F5EE", border: "1px solid #1D9E75", borderRadius: "2px" }} />
          <span className="text-[11px] text-muted-foreground/70">Entity</span>
        </div>

        <div className="w-px h-3 bg-border/20" />

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
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "1.5px dashed #9159C6", opacity: 0.7 }} />
          <span className="text-[11px] text-muted-foreground/70">Inferred</span>
        </div>
      </div>
    </div>
  );
};

export default GraphViewPanel;
