import { useState } from "react";
import {
  GitBranch, Plus, Trash2, ArrowRight, Play, Pause, Settings,
  Download, Upload, Filter, Layers, AlertTriangle, Check, RefreshCw
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PipelineNode {
  id: string;
  type: "collect" | "normalize" | "deduplicate" | "enrich" | "alert" | "export";
  label: string;
  config: Record<string, string>;
  inputCount: number;
  outputCount: number;
  status: "idle" | "running" | "complete" | "error";
}

interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  active: boolean;
  createdAt: number;
  lastRun?: number;
}

const STORAGE_KEY = "nomad_pipelines";

function loadPipelines(): Pipeline[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function savePipelines(p: Pipeline[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const NODE_TYPES: { type: PipelineNode["type"]; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "collect", label: "Collect", icon: Download, desc: "Gather data from sources" },
  { type: "normalize", label: "Normalize", icon: Filter, desc: "Standardize formats" },
  { type: "deduplicate", label: "Deduplicate", icon: Layers, desc: "Remove duplicate entries" },
  { type: "enrich", label: "Enrich", icon: RefreshCw, desc: "Add context from APIs" },
  { type: "alert", label: "Alert", icon: AlertTriangle, desc: "Trigger on conditions" },
  { type: "export", label: "Export", icon: Upload, desc: "Output results" },
];

const NODE_COLORS: Record<string, string> = {
  collect: "border-blue-500/30 bg-blue-500/8",
  normalize: "border-cyan-500/30 bg-cyan-500/8",
  deduplicate: "border-purple-500/30 bg-purple-500/8",
  enrich: "border-emerald-500/30 bg-emerald-500/8",
  alert: "border-amber-500/30 bg-amber-500/8",
  export: "border-rose-500/30 bg-rose-500/8",
};

const NomadCollectionPipeline = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>(loadPipelines);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(pipelines[0]?.id || null);
  const [addingNode, setAddingNode] = useState(false);

  const save = (updated: Pipeline[]) => { setPipelines(updated); savePipelines(updated); };

  const activePipeline = pipelines.find(p => p.id === activePipelineId);

  const createPipeline = () => {
    const pipeline: Pipeline = {
      id: crypto.randomUUID(),
      name: `Pipeline ${pipelines.length + 1}`,
      nodes: [
        { id: crypto.randomUUID(), type: "collect", label: "Collect", config: { source: "web" }, inputCount: 0, outputCount: 0, status: "idle" },
        { id: crypto.randomUUID(), type: "normalize", label: "Normalize", config: {}, inputCount: 0, outputCount: 0, status: "idle" },
        { id: crypto.randomUUID(), type: "deduplicate", label: "Deduplicate", config: {}, inputCount: 0, outputCount: 0, status: "idle" },
      ],
      active: false,
      createdAt: Date.now(),
    };
    const updated = [...pipelines, pipeline];
    save(updated);
    setActivePipelineId(pipeline.id);
  };

  const addNode = (type: PipelineNode["type"]) => {
    if (!activePipeline) return;
    const nodeType = NODE_TYPES.find(n => n.type === type);
    const node: PipelineNode = {
      id: crypto.randomUUID(),
      type,
      label: nodeType?.label || type,
      config: {},
      inputCount: 0,
      outputCount: 0,
      status: "idle",
    };
    const updated = pipelines.map(p =>
      p.id === activePipelineId ? { ...p, nodes: [...p.nodes, node] } : p
    );
    save(updated);
    setAddingNode(false);
  };

  const removeNode = (nodeId: string) => {
    const updated = pipelines.map(p =>
      p.id === activePipelineId ? { ...p, nodes: p.nodes.filter(n => n.id !== nodeId) } : p
    );
    save(updated);
  };

  const togglePipeline = () => {
    const updated = pipelines.map(p =>
      p.id === activePipelineId ? { ...p, active: !p.active } : p
    );
    save(updated);
  };

  const simulateRun = () => {
    if (!activePipeline) return;
    const updated = pipelines.map(p => {
      if (p.id !== activePipelineId) return p;
      const nodes = p.nodes.map((n, i) => ({
        ...n,
        status: "complete" as const,
        inputCount: i === 0 ? 100 : p.nodes[i - 1]?.outputCount || 0,
        outputCount: Math.max(1, Math.floor((i === 0 ? 100 : p.nodes[i - 1]?.outputCount || 50) * (n.type === "deduplicate" ? 0.7 : n.type === "alert" ? 0.1 : 0.9))),
      }));
      return { ...p, nodes, lastRun: Date.now() };
    });
    save(updated);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline selector */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 overflow-x-auto">
        {pipelines.map(p => (
          <button key={p.id} onClick={() => setActivePipelineId(p.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-light whitespace-nowrap transition-colors ${activePipelineId === p.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            {p.name}
          </button>
        ))}
        <button onClick={createPipeline} className="px-2 py-1.5 rounded-lg text-[10px] text-foreground/50 hover:text-foreground">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {!activePipeline ? (
            <div className="text-center py-12">
              <GitBranch className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[11px] text-muted-foreground/40 font-light mb-4">Create a collection pipeline to automate your OSINT workflow.</p>
              <button onClick={createPipeline} className="px-4 py-2 rounded-xl text-xs bg-foreground/[0.1] text-accent border border-foreground/15 hover:bg-accent/30 transition-colors">
                Create Pipeline
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-light text-foreground">{activePipeline.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={simulateRun} className="px-3 py-1.5 rounded-xl text-[10px] bg-foreground/[0.1] text-accent border border-foreground/15 hover:bg-accent/30 transition-colors">
                    <Play className="h-3 w-3 inline mr-1" /> Run
                  </button>
                  <button onClick={togglePipeline} className={`px-3 py-1.5 rounded-xl text-[10px] border transition-colors ${activePipeline.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "text-muted-foreground/40 border-border/20"}`}>
                    {activePipeline.active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>

              {activePipeline.lastRun && (
                <p className="text-[9px] text-muted-foreground/30">Last run: {new Date(activePipeline.lastRun).toLocaleString()}</p>
              )}

              {/* Pipeline Nodes - Visual */}
              <div className="space-y-1">
                {activePipeline.nodes.map((node, idx) => {
                  const nodeType = NODE_TYPES.find(n => n.type === node.type);
                  const Icon = nodeType?.icon || Settings;
                  return (
                    <div key={node.id}>
                      <div className={`rounded-xl border p-3 ${NODE_COLORS[node.type] || "border-border/20 bg-card/10"} group`}>
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0 opacity-60" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-light">{node.label}</p>
                            <p className="text-[9px] opacity-50">{nodeType?.desc}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] opacity-40">
                            {node.inputCount > 0 && <span>In: {node.inputCount}</span>}
                            {node.outputCount > 0 && <span>Out: {node.outputCount}</span>}
                            {node.status === "complete" && <Check className="h-3 w-3 text-emerald-400" />}
                          </div>
                          <button onClick={() => removeNode(node.id)} className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {idx < activePipeline.nodes.length - 1 && (
                        <div className="flex items-center justify-center py-0.5">
                          <ArrowRight className="h-3 w-3 text-muted-foreground/20 rotate-90" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add node */}
              {addingNode ? (
                <div className="grid grid-cols-3 gap-2">
                  {NODE_TYPES.map(n => (
                    <button key={n.type} onClick={() => addNode(n.type)} className={`rounded-xl border p-3 text-left transition-colors hover:border-border/25 ${NODE_COLORS[n.type]}`}>
                      <n.icon className="h-3.5 w-3.5 mb-1 opacity-60" />
                      <p className="text-[10px] font-light">{n.label}</p>
                      <p className="text-[8px] opacity-40">{n.desc}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => setAddingNode(true)} className="w-full rounded-xl border border-dashed border-border/20 py-3 text-[10px] text-muted-foreground/40 hover:text-foreground hover:border-border/40 transition-colors">
                  <Plus className="h-3 w-3 inline mr-1" /> Add Node
                </button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadCollectionPipeline;
