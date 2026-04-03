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
  edgeType: "confirmed" | "probable" | "inferred";
  confidence?: number;
}

/* ─── Theme-matched color palette (dark mode HSL-based) ─── */
const NODE_PALETTE: Record<string, { fill: string; stroke: string; text: string; textSub: string }> = {
  document:       { fill: "hsl(220, 30%, 15%)", stroke: "hsl(220, 50%, 50%)", text: "hsl(220, 50%, 80%)", textSub: "hsl(220, 40%, 60%)" },
  dataset:        { fill: "hsl(220, 30%, 15%)", stroke: "hsl(220, 50%, 50%)", text: "hsl(220, 50%, 80%)", textSub: "hsl(220, 40%, 60%)" },
  person:         { fill: "hsl(275, 30%, 18%)", stroke: "hsl(275, 50%, 55%)", text: "hsl(275, 40%, 85%)", textSub: "hsl(275, 40%, 65%)" },
  organization:   { fill: "hsl(200, 30%, 15%)", stroke: "hsl(200, 50%, 50%)", text: "hsl(200, 50%, 80%)", textSub: "hsl(200, 40%, 60%)" },
  party:          { fill: "hsl(200, 30%, 15%)", stroke: "hsl(200, 50%, 50%)", text: "hsl(200, 50%, 80%)", textSub: "hsl(200, 40%, 60%)" },
  location:       { fill: "hsl(160, 25%, 14%)", stroke: "hsl(160, 45%, 45%)", text: "hsl(160, 40%, 80%)", textSub: "hsl(160, 35%, 55%)" },
  amount:         { fill: "hsl(45, 30%, 14%)",  stroke: "hsl(45, 60%, 50%)",  text: "hsl(45, 50%, 85%)",  textSub: "hsl(45, 45%, 60%)"  },
  date:           { fill: "hsl(140, 25%, 14%)", stroke: "hsl(140, 40%, 45%)", text: "hsl(140, 35%, 80%)", textSub: "hsl(140, 30%, 55%)" },
  obligation:     { fill: "hsl(0, 25%, 16%)",   stroke: "hsl(0, 50%, 50%)",   text: "hsl(0, 40%, 85%)",   textSub: "hsl(0, 40%, 60%)"   },
  clause:         { fill: "hsl(280, 25%, 16%)", stroke: "hsl(280, 40%, 50%)", text: "hsl(280, 35%, 80%)", textSub: "hsl(280, 30%, 60%)" },
  email:          { fill: "hsl(50, 25%, 14%)",  stroke: "hsl(50, 50%, 50%)",  text: "hsl(50, 45%, 80%)",  textSub: "hsl(50, 40%, 60%)"  },
  phone:          { fill: "hsl(90, 20%, 14%)",  stroke: "hsl(90, 40%, 45%)",  text: "hsl(90, 35%, 80%)",  textSub: "hsl(90, 30%, 55%)"  },
  url:            { fill: "hsl(210, 25%, 15%)", stroke: "hsl(210, 45%, 50%)", text: "hsl(210, 40%, 80%)", textSub: "hsl(210, 35%, 60%)" },
  product:        { fill: "hsl(160, 25%, 14%)", stroke: "hsl(160, 50%, 45%)", text: "hsl(160, 40%, 80%)", textSub: "hsl(160, 35%, 55%)" },
  regulation:     { fill: "hsl(15, 30%, 15%)",  stroke: "hsl(15, 55%, 50%)",  text: "hsl(15, 45%, 80%)",  textSub: "hsl(15, 40%, 60%)"  },
  case_reference: { fill: "hsl(260, 25%, 16%)", stroke: "hsl(260, 40%, 55%)", text: "hsl(260, 35%, 80%)", textSub: "hsl(260, 30%, 60%)" },
  job_title:      { fill: "hsl(310, 25%, 16%)", stroke: "hsl(310, 40%, 50%)", text: "hsl(310, 35%, 80%)", textSub: "hsl(310, 30%, 60%)" },
  contract_term:  { fill: "hsl(180, 20%, 14%)", stroke: "hsl(180, 40%, 45%)", text: "hsl(180, 35%, 80%)", textSub: "hsl(180, 30%, 55%)" },
  column:         { fill: "hsl(45, 25%, 14%)",  stroke: "hsl(45, 50%, 50%)",  text: "hsl(45, 45%, 80%)",  textSub: "hsl(45, 40%, 60%)"  },
  type:           { fill: "hsl(140, 20%, 14%)", stroke: "hsl(140, 40%, 45%)", text: "hsl(140, 35%, 80%)", textSub: "hsl(140, 30%, 55%)" },
  tag:            { fill: "hsl(280, 20%, 16%)", stroke: "hsl(280, 35%, 50%)", text: "hsl(280, 30%, 80%)", textSub: "hsl(280, 25%, 60%)" },
};

const DEFAULT_PALETTE = { fill: "hsl(0, 0%, 12%)", stroke: "hsl(0, 0%, 40%)", text: "hsl(0, 0%, 80%)", textSub: "hsl(0, 0%, 55%)" };

function getPalette(type: string) {
  return NODE_PALETTE[type] || DEFAULT_PALETTE;
}

/* ─── Cluster config ─── */
const CLUSTER_CONFIG: Record<string, { fill: string; stroke: string; labelColor: string; label: string }> = {
  data:         { fill: "hsl(220, 50%, 50%)", stroke: "hsl(220, 50%, 50%)", labelColor: "hsl(220, 40%, 60%)", label: "Documents & Data" },
  entity:       { fill: "hsl(275, 50%, 55%)", stroke: "hsl(275, 50%, 55%)", labelColor: "hsl(275, 40%, 60%)", label: "Extracted Entities" },
  relationship: { fill: "hsl(160, 45%, 45%)", stroke: "hsl(160, 45%, 45%)", labelColor: "hsl(160, 35%, 55%)", label: "Cross-References" },
};

function assignCluster(type: string): GraphNode["cluster"] {
  if (type === "document" || type === "dataset") return "data";
  return "entity";
}

function isDocType(type: string): boolean {
  return type === "document" || type === "dataset";
}

function isPersonType(type: string): boolean {
  return type === "person" || type === "party";
}

/* ─── Force-directed layout ─── */
function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): GraphNode[] {
  const clusterCenters: Record<string, { x: number; y: number }> = {
    data:   { x: w * 0.5, y: h * 0.28 },
    entity: { x: w * 0.5, y: h * 0.72 },
  };

  const pos = nodes.map((n, i) => {
    const center = clusterCenters[n.cluster || "entity"];
    const count = nodes.filter(nn => nn.cluster === n.cluster).length;
    const idx = nodes.filter((nn, ni) => nn.cluster === n.cluster && ni < i).length;
    const angle = (idx / Math.max(1, count)) * Math.PI * 2;
    const spread = Math.min(w, h) * 0.18;
    return {
      ...n,
      x: center.x + Math.cos(angle) * spread + (Math.random() - 0.5) * 25,
      y: center.y + Math.sin(angle) * spread + (Math.random() - 0.5) * 25,
    };
  });

  for (let iter = 0; iter < 45; iter++) {
    // Repulsion
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = 4500 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pos[i].x -= fx; pos[i].y -= fy;
        pos[j].x += fx; pos[j].y += fy;
      }
    }
    // Edge attraction
    for (const edge of edges) {
      const src = pos.find(n => n.id === edge.source);
      const tgt = pos.find(n => n.id === edge.target);
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
    // Cluster gravity
    for (const node of pos) {
      const target = clusterCenters[node.cluster || "entity"];
      node.x += (target.x - node.x) * 0.006;
      node.y += (target.y - node.y) * 0.006;
      node.x = Math.max(70, Math.min(w - 70, node.x));
      node.y = Math.max(40, Math.min(h - 40, node.y));
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

  // Resize observer
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
  const loadGraph = useCallback(async () => {
    if (!user || !activeSession) return;
    setLoading(true);
    if (viewMode === "entities") {
      await loadEntityGraph();
    } else {
      await loadDatasetGraph();
    }
    setLoading(false);
  }, [user, activeSession, viewMode]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Realtime
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

    // Document nodes
    docs.forEach((doc: any) => {
      const nodeId = `doc_${doc.id}`;
      nodeMap.set(doc.id, nodeId);
      gNodes.push({
        id: nodeId, label: doc.file_name.length > 22 ? doc.file_name.slice(0, 20) + "…" : doc.file_name,
        type: "document", cluster: "data", x: 0, y: 0,
        confidence: 1, tier: 1, tierLabel: "T1 (Uploaded)", sourceCount: 1,
        tags: ["Source document"],
      });
    });

    // Deduplicate entities
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

      // Edge to each document
      entityDocIds.forEach((docId: string) => {
        const docNodeId = nodeMap.get(docId);
        if (docNodeId) {
          gEdges.push({
            source: docNodeId, target: nodeId,
            label: entity.entity_type,
            edgeType: (entity.confidence || 0) >= 0.8 ? "confirmed" : "probable",
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
            gEdges.push({ source: dsIds[i], target: dsIds[j], label: "shared column", edgeType: "inferred" });
          }
        }
      }
    });

    setRawNodes(gNodes);
    setRawEdges(gEdges);
  };

  /* ── Layout ── */
  const { graphNodes, graphEdges, clusterBounds } = useMemo(() => {
    if (rawNodes.length === 0) return { graphNodes: [], graphEdges: [], clusterBounds: {} as Record<string, { x: number; y: number; w: number; h: number }> };
    const positioned = layoutGraph(rawNodes, rawEdges, dimensions.width, dimensions.height);

    const bounds: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const key of ["data", "entity"] as const) {
      const cn = positioned.filter(n => n.cluster === key);
      if (cn.length === 0) continue;
      const pad = 35;
      const minX = Math.min(...cn.map(n => n.x)) - pad - 55;
      const minY = Math.min(...cn.map(n => n.y)) - pad - 10;
      const maxX = Math.max(...cn.map(n => n.x)) + pad + 55;
      const maxY = Math.max(...cn.map(n => n.y)) + pad + 25;
      bounds[key] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { graphNodes: positioned, graphEdges: rawEdges, clusterBounds: bounds };
  }, [rawNodes, rawEdges, dimensions]);

  /* ── Filter ── */
  const isVisible = useCallback((node: GraphNode): boolean => {
    if (filter === "all") return true;
    if (filter === "docs") return isDocType(node.type);
    if (filter === "people") return isPersonType(node.type);
    if (filter === "orgs") return node.type === "organization";
    return !isDocType(node.type) && !isPersonType(node.type) && node.type !== "organization";
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

  /* ── Active legend types ── */
  const activeTypes = useMemo(() => {
    const types = new Set(graphNodes.map(n => n.type));
    return Array.from(types).slice(0, 8);
  }, [graphNodes]);

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
        <p className="text-sm font-extralight text-muted-foreground">No data to visualize.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Upload files or documents to build the graph.</p>
      </div>
    );
  }

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "docs", label: "Documents" },
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
          Entity graph
          {activeSession && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {activeSession.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
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

          {/* Filters */}
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition-all duration-150 cursor-pointer ${
                filter === f.id
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "text-muted-foreground/50 border-border/20 hover:bg-secondary/50 hover:text-foreground"
              }`}>
              {f.label}
            </button>
          ))}
          <button onClick={resetView}
            className="px-2.5 py-1 rounded-md text-[11px] text-muted-foreground/30 border border-border/20 hover:bg-secondary/50 hover:text-foreground transition-all cursor-pointer">
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
            <marker id="asha-arr-conf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="hsl(0, 0%, 45%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="asha-arr-prob" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="hsl(0, 0%, 35%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="asha-arr-inf" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="hsl(275, 50%, 55%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="asha-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
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
                    stroke={cfg.stroke} strokeWidth={0.5} strokeOpacity={0.15}
                    strokeDasharray="4 3" />
                  <text x={b.x + 10} y={b.y + 16} fontSize={10}
                    fill={cfg.labelColor} fillOpacity={0.6}
                    fontWeight={500} style={{ fontFamily: "Inter, sans-serif" }}>
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
              const opacity = (!isVisible(src) || !isVisible(tgt)) ? 0.1 : 0.8;

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              let strokeColor = "hsl(0, 0%, 30%)";
              let strokeWidth = 1.2;
              let dash = "none";
              let markerEnd = "url(#asha-arr-conf)";

              if (edge.edgeType === "probable") {
                strokeColor = "hsl(0, 0%, 22%)";
                strokeWidth = 1;
                dash = "5 3";
                markerEnd = "url(#asha-arr-prob)";
              } else if (edge.edgeType === "inferred") {
                strokeColor = "hsl(275, 30%, 35%)";
                strokeWidth = 0.8;
                dash = "3 3";
                markerEnd = "url(#asha-arr-inf)";
              }

              return (
                <g key={`edge-${idx}`} style={{ opacity, transition: "opacity 0.2s" }}>
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor} strokeWidth={strokeWidth}
                    strokeDasharray={dash} markerEnd={markerEnd} />
                  <text x={midX} y={midY - 5} fontSize={8}
                    fill="hsl(0, 0%, 40%)" fillOpacity={0.6}
                    textAnchor="middle" style={{ fontFamily: "Inter, sans-serif" }}>
                    {edge.label}
                    {edge.edgeType === "probable" && edge.confidence ? ` · ${edge.confidence}%` : ""}
                  </text>
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {graphNodes.map((node) => {
              const pal = getPalette(node.type);
              const vis = isVisible(node);
              const nodeOpacity = vis ? 1 : 0.12;
              const isDoc = isDocType(node.type);
              const isPerson_ = isPersonType(node.type);

              return (
                <g key={node.id} className="node-group"
                  style={{ cursor: "pointer", opacity: nodeOpacity, transition: "opacity 0.2s" }}
                  onClick={() => setSelectedNode(node)}>

                  {/* ── Document / Dataset node (rounded rect, larger) ── */}
                  {isDoc && (
                    <>
                      <rect x={node.x - 54} y={node.y - 25} width={108} height={50} rx={6}
                        fill={pal.fill} stroke={pal.stroke} strokeWidth={1.2}
                        filter="url(#asha-shadow)" />
                      <text x={node.x} y={node.y - 4} fontSize={10} fontWeight={500}
                        textAnchor="middle" fill={pal.text}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 11} fontSize={8}
                        textAnchor="middle" fill={pal.textSub}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        Source · T1
                      </text>
                    </>
                  )}

                  {/* ── Person node (circle) ── */}
                  {isPerson_ && (
                    <>
                      <circle cx={node.x} cy={node.y} r={22}
                        fill={pal.fill} stroke={pal.stroke} strokeWidth={0.8} />
                      {node.label.includes(" ") ? (
                        <>
                          <text x={node.x} y={node.y - 3} fontSize={10} fontWeight={500}
                            textAnchor="middle" fill={pal.text}
                            style={{ fontFamily: "Inter, sans-serif" }}>
                            {node.label.split(" ")[0]}
                          </text>
                          <text x={node.x} y={node.y + 10} fontSize={10} fontWeight={500}
                            textAnchor="middle" fill={pal.text}
                            style={{ fontFamily: "Inter, sans-serif" }}>
                            {node.label.split(" ").slice(1).join(" ")}
                          </text>
                        </>
                      ) : (
                        <text x={node.x} y={node.y + 4} fontSize={10} fontWeight={500}
                          textAnchor="middle" fill={pal.text}
                          style={{ fontFamily: "Inter, sans-serif" }}>
                          {node.label}
                        </text>
                      )}
                    </>
                  )}

                  {/* ── Organization node (rounded rect, blue-ish) ── */}
                  {node.type === "organization" && (
                    <>
                      <rect x={node.x - 54} y={node.y - 22} width={108} height={44} rx={6}
                        fill={pal.fill} stroke={pal.stroke} strokeWidth={0.8} />
                      <text x={node.x} y={node.y - 2} fontSize={10} fontWeight={500}
                        textAnchor="middle" fill={pal.text}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 12} fontSize={8}
                        textAnchor="middle" fill={pal.textSub}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {node.tags?.[0] || "Organization"}
                      </text>
                    </>
                  )}

                  {/* ── All other entity types (small rounded rect with left dot) ── */}
                  {!isDoc && !isPerson_ && node.type !== "organization" && (
                    <>
                      <rect x={node.x - 48} y={node.y - 18} width={96} height={36} rx={4}
                        fill={pal.fill} stroke={pal.stroke} strokeWidth={0.6} />
                      {/* Type dot */}
                      <circle cx={node.x - 40} cy={node.y} r={3}
                        fill={pal.stroke} fillOpacity={0.6} />
                      <text x={node.x + 2} y={node.y - 2} fontSize={9} fontWeight={500}
                        textAnchor="middle" fill={pal.text}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {node.label}
                      </text>
                      <text x={node.x + 2} y={node.y + 10} fontSize={7}
                        textAnchor="middle" fill={pal.textSub}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {node.type}
                      </text>
                    </>
                  )}

                  {/* ── BRIDGE badge ── */}
                  {node.bridge && (
                    <>
                      <rect x={node.x - 22} y={node.y + (isPerson_ ? 24 : isDoc ? 28 : 20)} width={44} height={12} rx={6}
                        fill="hsl(275, 50%, 55%)" fillOpacity={0.15}
                        stroke="hsl(275, 50%, 55%)" strokeWidth={0.5} strokeOpacity={0.3} />
                      <text x={node.x} y={node.y + (isPerson_ ? 33 : isDoc ? 37 : 29)} fontSize={7} fontWeight={500}
                        textAnchor="middle" fill="hsl(275, 40%, 65%)"
                        style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.06em" }}>
                        BRIDGE
                      </text>
                    </>
                  )}

                  {/* ── Confidence badge ── */}
                  {node.confidence !== undefined && node.confidence < 1 && !isDoc && (
                    <g transform={`translate(${node.x + (isPerson_ ? 16 : 40)}, ${node.y - (isPerson_ ? 28 : 24)})`}>
                      <rect x={0} y={0} width={40} height={16} rx={8}
                        fill={pal.stroke} fillOpacity={0.12}
                        stroke={pal.stroke} strokeWidth={0.4} />
                      <text x={20} y={12} fontSize={8} fontWeight={500}
                        textAnchor="middle" fill={pal.textSub}
                        style={{ fontFamily: "Inter, sans-serif" }}>
                        {Math.round(node.confidence * 100)}%
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
            const pal = getPalette(selectedNode.type);
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

                {/* Confidence bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "hsl(0, 0%, 14%)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${confPct}%`, backgroundColor: pal.stroke }} />
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

                {/* Tags */}
                {selectedNode.tags && selectedNode.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border/20 text-muted-foreground/70">
                        {t}
                      </span>
                    ))}
                    {selectedNode.bridge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                        BRIDGE
                      </span>
                    )}
                  </div>
                )}

                {/* Connections */}
                {selectedConnections.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/15">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">Connections</span>
                    {selectedConnections.map((c, i) => (
                      <button key={i} onClick={() => c.other && setSelectedNode(c.other)}
                        className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1 text-[10px] hover:bg-secondary/50 transition-colors cursor-pointer">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: getPalette(c.other!.type).stroke }} />
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
        {activeTypes.map(type => {
          const pal = getPalette(type);
          const isCircle = isPersonType(type);
          return (
            <div key={type} className="flex items-center gap-1.5">
              {isCircle ? (
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: pal.fill, border: `1px solid ${pal.stroke}` }} />
              ) : (
                <div className="w-3 h-2 rounded-sm" style={{ background: pal.fill, border: `1px solid ${pal.stroke}` }} />
              )}
              <span className="text-[11px] text-muted-foreground/60 capitalize">{type.replace(/_/g, " ")}</span>
            </div>
          );
        })}

        <div className="w-px h-3 bg-border/15" />

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "1.5px solid hsl(0, 0%, 30%)" }} />
          <span className="text-[11px] text-muted-foreground/60">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "2px dashed hsl(0, 0%, 22%)", opacity: 0.7 }} />
          <span className="text-[11px] text-muted-foreground/60">Probable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: "1.5px dashed hsl(275, 30%, 35%)", opacity: 0.6 }} />
          <span className="text-[11px] text-muted-foreground/60">Inferred</span>
        </div>
      </div>
    </div>
  );
};

export default GraphViewPanel;
