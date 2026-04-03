import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  X, ZoomIn, ZoomOut, Maximize2, Filter, Search, GitBranch, Clock,
  ArrowRight, Diamond, Database, Layers, Activity, AlertTriangle,
  CheckCircle, XCircle, Pause, Play, ChevronRight, ChevronDown,
  Lightbulb, Zap, BarChart3, RefreshCw, Download, Eye,
  Monitor as MonitorIcon, FileText, Link2, Timer, GitCompare
} from "lucide-react";
import CrossWorkflowComparison from "./CrossWorkflowComparison";
import CrossWorkflowExport from "./CrossWorkflowExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WorkflowGraph, WorkflowNode, WorkflowEdge, WorkflowInsight,
  WorkflowOptimization, WorkflowPhase, WorkflowMetrics, DetailLevel,
  LayoutMode, WorkflowNodeType, WorkflowStatus
} from "./workflowTypes";

// ── Node icon & color mapping ──
const NODE_STYLES: Record<WorkflowNodeType, { icon: React.ReactNode; bg: string; border: string; glow: string }> = {
  application: { icon: <MonitorIcon className="h-4 w-4" />, bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "shadow-blue-500/10" },
  action:      { icon: <Zap className="h-4 w-4" />,          bg: "bg-emerald-500/10", border: "border-emerald-500/30", glow: "shadow-emerald-500/10" },
  decision:    { icon: <Diamond className="h-4 w-4" />,      bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-amber-500/10" },
  data:        { icon: <Database className="h-4 w-4" />,     bg: "bg-purple-500/10", border: "border-purple-500/30", glow: "shadow-purple-500/10" },
  integration: { icon: <Link2 className="h-4 w-4" />,       bg: "bg-cyan-500/10", border: "border-cyan-500/30", glow: "shadow-cyan-500/10" },
  wait:        { icon: <Timer className="h-4 w-4" />,        bg: "bg-slate-500/10", border: "border-slate-500/30", glow: "shadow-slate-500/10" },
};

const RESULT_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-3 w-3 text-emerald-400" />,
  failure: <XCircle className="h-3 w-3 text-red-400" />,
  partial: <AlertTriangle className="h-3 w-3 text-amber-400" />,
  pending: <Pause className="h-3 w-3 text-muted-foreground/50" />,
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

interface Props {
  onClose: () => void;
  isSharing: boolean;
  currentSessionId?: string | null;
}

const CrossWorkflowMap: React.FC<Props> = ({ onClose, isSharing, currentSessionId }) => {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<WorkflowGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(2);
  const [layout, setLayout] = useState<LayoutMode>("hierarchical");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<WorkflowNodeType | "all">("all");
  const [showInsights, setShowInsights] = useState(false);
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [workflows, setWorkflows] = useState<WorkflowGraph[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // ── Load workflow data from DB ──
  const loadWorkflows = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("cross_workflows")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) { console.error("Load workflows error:", error); return; }
      if (data && data.length > 0) {
        const parsed = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status as WorkflowStatus,
          nodes: (row.nodes as any[]) || [],
          edges: (row.edges as any[]) || [],
          metrics: (row.metrics as WorkflowMetrics) || { totalSteps: 0, decisionPoints: 0, applicationsUsed: 0, filesAccessed: 0, efficiencyScore: 0, totalDuration: 0, waitTime: 0, activeTime: 0, errorCount: 0, loopCount: 0 },
          insights: (row.insights as any[]) || [],
          optimizations: (row.optimizations as any[]) || [],
          phases: (row.phases as any[]) || [],
          sessionId: row.session_id,
        }));
        setWorkflows(parsed);
        setWorkflow(parsed[0]);
      }
    } catch (err) {
      console.error("Workflow load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  // ── Build workflow from live session ──
  const buildWorkflowFromSession = useCallback(async () => {
    if (!user || !currentSessionId) return;
    try {
      const { data: session } = await (supabase as any)
        .from("cross_sessions")
        .select("*")
        .eq("id", currentSessionId)
        .single();

      if (!session) return;

      // Build a basic workflow graph from the session data
      const newWorkflow: WorkflowGraph = {
        id: crypto.randomUUID(),
        name: session.title || "Live Session",
        startTime: session.created_at,
        endTime: session.status === "completed" ? session.updated_at : undefined,
        status: session.status === "completed" ? "completed" : "active",
        nodes: [],
        edges: [],
        metrics: {
          totalSteps: session.frames_analyzed || 0,
          decisionPoints: 0,
          applicationsUsed: 1,
          filesAccessed: 0,
          efficiencyScore: Math.min(100, Math.round((session.frames_analyzed || 0) / Math.max(1, (session.frames_analyzed || 0) + (session.frames_skipped || 0)) * 100)),
          totalDuration: session.duration || 0,
          waitTime: 0,
          activeTime: session.duration || 0,
          errorCount: 0,
          loopCount: 0,
        },
        insights: [],
        optimizations: [],
        phases: [],
        sessionId: currentSessionId,
      };
      setWorkflow(newWorkflow);
    } catch (err) {
      console.error("Build workflow error:", err);
    }
  }, [user, currentSessionId]);

  // ── Node filtering & search ──
  const filteredNodes = useMemo(() => {
    if (!workflow) return [];
    let nodes = workflow.nodes;
    if (filterType !== "all") nodes = nodes.filter(n => n.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n =>
        n.name.toLowerCase().includes(q) ||
        (n.metadata && JSON.stringify(n.metadata).toLowerCase().includes(q))
      );
    }
    return nodes;
  }, [workflow, filterType, searchQuery]);

  // ── Layout computation ──
  const layoutNodes = useMemo(() => {
    if (!filteredNodes.length) return [];
    const nodeWidth = 200;
    const nodeHeight = 80;
    const gapX = 60;
    const gapY = 40;
    return filteredNodes.map((node, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return {
        ...node,
        x: col * (nodeWidth + gapX) + 40,
        y: row * (nodeHeight + gapY) + 40,
      };
    });
  }, [filteredNodes]);

  // ── Pan & Zoom handlers ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  // ── Render edge between two nodes ──
  const renderEdge = (edge: WorkflowEdge) => {
    const sourceNode = layoutNodes.find(n => n.id === edge.source);
    const targetNode = layoutNodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;
    const sx = (sourceNode.x || 0) + 100;
    const sy = (sourceNode.y || 0) + 80;
    const tx = (targetNode.x || 0) + 100;
    const ty = (targetNode.y || 0);
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const strokeClass = edge.type === "data_flow" ? "stroke-blue-400/40" :
                        edge.type === "conditional" ? "stroke-amber-400/40" :
                        edge.type === "loop" ? "stroke-purple-400/40" :
                        "stroke-muted-foreground/20";
    const dashArray = edge.type === "conditional" ? "6 3" :
                      edge.type === "loop" ? "4 4" : undefined;
    return (
      <g key={edge.id}>
        <path
          d={`M ${sx} ${sy} Q ${mx} ${sy} ${mx} ${my} Q ${mx} ${ty} ${tx} ${ty}`}
          fill="none"
          className={strokeClass}
          strokeWidth={1.5}
          strokeDasharray={dashArray}
          markerEnd="url(#arrowhead)"
        />
        {edge.label && (
          <text x={mx} y={my - 6} textAnchor="middle" className="fill-muted-foreground/40 text-[9px]">{edge.label}</text>
        )}
      </g>
    );
  };

  // ── Render a workflow node ──
  const renderNode = (node: WorkflowNode & { x: number; y: number }) => {
    const style = NODE_STYLES[node.type];
    const isSelected = selectedNode?.id === node.id;
    const isDecision = node.type === "decision";
    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        className="cursor-pointer"
        onClick={() => setSelectedNode(node)}
      >
        {isDecision ? (
          <g transform="translate(100, 40)">
            <polygon
              points="0,-40 60,0 0,40 -60,0"
              className={`${style.bg} ${style.border} ${isSelected ? "stroke-amber-400 stroke-2" : ""}`}
              fill="currentColor"
              strokeWidth={isSelected ? 2 : 1}
            />
            <text y={-5} textAnchor="middle" className="fill-foreground text-[11px] font-medium">{node.name.slice(0, 20)}</text>
            <text y={10} textAnchor="middle" className="fill-muted-foreground/50 text-[9px]">{formatDuration(node.duration)}</text>
          </g>
        ) : (
          <>
            <rect
              width={200}
              height={80}
              rx={12}
              className={`fill-background/80 ${style.border} ${isSelected ? "stroke-accent stroke-2" : "stroke-1"}`}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Icon badge */}
            <g transform="translate(12, 12)">
              <rect width={28} height={28} rx={6} className={style.bg} />
              <g transform="translate(6, 6)" className="text-muted-foreground/70">{style.icon}</g>
            </g>
            {/* Text */}
            <text x={48} y={26} className="fill-foreground text-[11px] font-medium">{node.name.slice(0, 22)}</text>
            <text x={48} y={42} className="fill-muted-foreground/50 text-[9px]">{formatDuration(node.duration)}</text>
            {/* Result badge */}
            {node.result && (
              <g transform="translate(170, 10)">
                {RESULT_ICONS[node.result]}
              </g>
            )}
            {/* Screenshot thumbnail */}
            {node.screenshotData && (
              <g transform="translate(8, 52)">
                <rect width={184} height={24} rx={4} className="fill-muted/10 stroke-border/10" strokeWidth={0.5} />
                <text x={92} y={15} textAnchor="middle" className="fill-muted-foreground/30 text-[8px]">📷 Screenshot available</text>
              </g>
            )}
            {/* Metadata hint */}
            {!node.screenshotData && Object.keys(node.metadata).length > 0 && (
              <text x={12} y={68} className="fill-muted-foreground/30 text-[8px]">
                {Object.keys(node.metadata).slice(0, 3).join(" · ")}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  return (
    <div className="w-[480px] border-l border-border/20 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-foreground">Workflow Intelligence</h3>
        </div>
        <div className="flex items-center gap-1">
          {isSharing && (
            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={buildWorkflowFromSession}>
              <RefreshCw className="h-3 w-3" /> Build from Session
            </Button>
          )}
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border/10 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="h-7 text-[10px] pl-7 bg-muted/5 border-border/20 rounded-lg"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="h-7 text-[10px] bg-muted/5 border border-border/20 rounded-lg px-2 text-foreground"
        >
          <option value="all">All Types</option>
          <option value="application">Application</option>
          <option value="action">Action</option>
          <option value="decision">Decision</option>
          <option value="data">Data</option>
          <option value="integration">Integration</option>
          <option value="wait">Wait</option>
        </select>
        <div className="flex items-center gap-0.5 border border-border/20 rounded-lg overflow-hidden">
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="p-1 hover:bg-muted/10"><ZoomIn className="h-3 w-3 text-muted-foreground" /></button>
          <button onClick={resetView} className="p-1 hover:bg-muted/10"><Maximize2 className="h-3 w-3 text-muted-foreground" /></button>
          <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))} className="p-1 hover:bg-muted/10"><ZoomOut className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Workflow selector (if multiple) */}
      {workflows.length > 1 && (
        <div className="px-3 py-1.5 border-b border-border/10 overflow-x-auto flex gap-1.5">
          {workflows.slice(0, 8).map(wf => (
            <button
              key={wf.id}
              onClick={() => setWorkflow(wf)}
              className={`px-2 py-1 rounded-lg text-[10px] whitespace-nowrap transition ${workflow?.id === wf.id ? "bg-accent/10 text-accent border border-accent/20" : "bg-muted/5 text-muted-foreground/60 hover:bg-muted/10"}`}
            >
              {wf.name.slice(0, 25)}
            </button>
          ))}
        </div>
      )}

      {/* Metrics Bar */}
      {workflow && (
        <div className="px-3 py-2 border-b border-border/10 flex items-center gap-3 text-[10px] text-muted-foreground/60 flex-wrap">
          <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-accent/50" />{workflow.metrics.totalSteps} steps</span>
          <span className="flex items-center gap-1"><Diamond className="h-3 w-3 text-amber-400/50" />{workflow.metrics.decisionPoints} decisions</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-400/50" />{formatDuration(workflow.metrics.totalDuration)}</span>
          <span className={`flex items-center gap-1 ${workflow.metrics.efficiencyScore >= 80 ? "text-emerald-400" : workflow.metrics.efficiencyScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
            <BarChart3 className="h-3 w-3" /> {workflow.metrics.efficiencyScore}% eff
          </span>
          {workflow.insights.length > 0 && (
            <button onClick={() => setShowInsights(!showInsights)} className="flex items-center gap-1 text-amber-400/70 hover:text-amber-400">
              <Lightbulb className="h-3 w-3" /> {workflow.insights.length} insights
            </button>
          )}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Activity className="h-6 w-6 text-muted-foreground/20 animate-pulse mx-auto" />
              <p className="text-xs text-muted-foreground/40">Loading workflows...</p>
            </div>
          </div>
        ) : !workflow || workflow.nodes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <GitBranch className="h-10 w-10 text-muted-foreground/15 mx-auto" />
              <div>
                <p className="text-sm text-muted-foreground/60 font-extralight">No workflow data yet</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Start a screen sharing session to begin mapping workflows automatically</p>
              </div>
              {isSharing && currentSessionId && (
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={buildWorkflowFromSession}>
                  <RefreshCw className="h-3 w-3" /> Build from Current Session
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Phase overview */}
            {workflow.phases.length > 0 && detailLevel <= 2 && (
              <div className="px-3 py-2 border-b border-border/10 space-y-1 max-h-32 overflow-y-auto">
                {workflow.phases.map(phase => (
                  <button
                    key={phase.id}
                    onClick={() => setExpandedPhases(prev => {
                      const next = new Set(prev);
                      next.has(phase.id) ? next.delete(phase.id) : next.add(phase.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/5 text-left transition"
                  >
                    {expandedPhases.has(phase.id) ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    <span className={`h-2 w-2 rounded-full ${phase.status === "completed" ? "bg-emerald-400" : phase.status === "active" ? "bg-blue-400 animate-pulse" : "bg-muted-foreground/20"}`} />
                    <span className="text-[11px] text-foreground/80 flex-1">{phase.name}</span>
                    <span className="text-[9px] text-muted-foreground/40">{formatDuration(phase.duration)}</span>
                    <span className="text-[9px] text-muted-foreground/30">{phase.nodeIds.length} steps</span>
                  </button>
                ))}
              </div>
            )}

            {/* SVG Workflow Graph */}
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="select-none"
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/30" />
                  </marker>
                </defs>
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {workflow.edges.map(renderEdge)}
                  {/* Nodes */}
                  {layoutNodes.map(node => renderNode(node as WorkflowNode & { x: number; y: number }))}
                </g>
              </svg>

              {/* Detail level control */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg border border-border/20 p-1">
                {([1, 2, 3, 4, 5] as DetailLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setDetailLevel(level)}
                    className={`px-2 py-0.5 rounded text-[9px] transition ${detailLevel === level ? "bg-accent/10 text-accent" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}
                  >
                    L{level}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="border-t border-border/20 max-h-[40%] overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/70">{NODE_STYLES[selectedNode.type].icon}</span>
                <span className="text-xs font-medium text-foreground">{selectedNode.name}</span>
                {selectedNode.result && RESULT_ICONS[selectedNode.result]}
              </div>
              <button onClick={() => setSelectedNode(null)}><X className="h-3 w-3 text-muted-foreground/40" /></button>
            </div>
            <div className="p-3 space-y-2.5">
              {/* Timing */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(selectedNode.timestamp).toLocaleTimeString()}</span>
                <span>Duration: {formatDuration(selectedNode.duration)}</span>
                <span className="capitalize text-foreground/50">{selectedNode.type}</span>
              </div>

              {/* Screenshot */}
              {selectedNode.screenshotData && (
                <div className="rounded-lg border border-border/20 overflow-hidden">
                  <img src={selectedNode.screenshotData} alt="Screenshot" className="w-full h-auto max-h-32 object-contain bg-black/50" />
                </div>
              )}

              {/* Decision info */}
              {selectedNode.type === "decision" && selectedNode.options && (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-amber-400/40">Decision Options</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedNode.options.map((opt, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded text-[10px] ${opt === selectedNode.choiceMade ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-muted/10 text-muted-foreground/50"}`}>
                        {opt === selectedNode.choiceMade && "✓ "}{opt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {Object.keys(selectedNode.metadata).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Details</p>
                  <div className="space-y-0.5">
                    {Object.entries(selectedNode.metadata).slice(0, 8).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 text-[10px]">
                        <span className="text-muted-foreground/40 capitalize min-w-[60px]">{key.replace(/_/g, " ")}:</span>
                        <span className="text-foreground/70">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected edges info */}
              {workflow && (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Connections</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {workflow.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map(edge => {
                      const otherNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const otherNode = workflow.nodes.find(n => n.id === otherNodeId);
                      return (
                        <button
                          key={edge.id}
                          onClick={() => otherNode && setSelectedNode(otherNode)}
                          className="px-2 py-0.5 rounded bg-muted/5 text-[9px] text-muted-foreground/50 hover:text-foreground/70 border border-border/10 flex items-center gap-1"
                        >
                          {edge.source === selectedNode.id ? <ArrowRight className="h-2.5 w-2.5" /> : <ArrowRight className="h-2.5 w-2.5 rotate-180" />}
                          {otherNode?.name.slice(0, 18) || otherNodeId.slice(0, 8)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Insights Panel */}
        {showInsights && workflow && workflow.insights.length > 0 && (
          <div className="border-t border-border/20 max-h-[35%] overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/10 flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400/80 flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Insights ({workflow.insights.length})</span>
              <button onClick={() => setShowInsights(false)}><X className="h-3 w-3 text-muted-foreground/40" /></button>
            </div>
            <div className="divide-y divide-border/10">
              {workflow.insights.map(insight => (
                <div key={insight.id} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${insight.severity === "critical" ? "bg-red-400" : insight.severity === "warning" ? "bg-amber-400" : "bg-blue-400"}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-foreground">{insight.title}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{insight.description}</p>
                      {insight.potentialSavings && (
                        <p className="text-[10px] text-emerald-400/70 mt-1">💡 Potential savings: {insight.potentialSavings}</p>
                      )}
                      {insight.automationPotential != null && insight.automationPotential > 50 && (
                        <div className="mt-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[9px] gap-1 text-accent">
                            <Zap className="h-2.5 w-2.5" /> Create Automation ({insight.automationPotential}% potential)
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossWorkflowMap;
