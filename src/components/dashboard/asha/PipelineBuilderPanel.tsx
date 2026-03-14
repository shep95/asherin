import { useState, useCallback } from "react";
import { Workflow, Plus, Play, Pause, Trash2, GripVertical, Database, Filter, Merge, Calculator, FileOutput, Zap, Loader2, ArrowRight, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PipelineNode {
  id: string;
  type: "source" | "filter" | "join" | "transform" | "aggregate" | "enrich" | "output";
  label: string;
  config: Record<string, string>;
  status: "idle" | "running" | "done" | "error";
}

interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  status: "draft" | "running" | "paused" | "completed";
  lastRun?: string;
  runsCount: number;
}

const NODE_TYPES: { type: PipelineNode["type"]; icon: React.ElementType; label: string; desc: string }[] = [
  { type: "source", icon: Database, label: "Data Source", desc: "Connect a dataset or feed" },
  { type: "filter", icon: Filter, label: "Filter", desc: "Filter rows by condition" },
  { type: "join", icon: Merge, label: "Join", desc: "Merge two datasets" },
  { type: "transform", icon: Calculator, label: "Transform", desc: "Rename, cast, derive columns" },
  { type: "aggregate", icon: Calculator, label: "Aggregate", desc: "Group by and summarize" },
  { type: "enrich", icon: Zap, label: "AI Enrich", desc: "AI-powered column generation" },
  { type: "output", icon: FileOutput, label: "Output", desc: "Export or save results" },
];

const nodeColorMap: Record<string, string> = {
  source: "border-accent/30 bg-accent/8",
  filter: "border-amber-500/30 bg-amber-500/8",
  join: "border-cyan-500/30 bg-cyan-500/8",
  transform: "border-purple-500/30 bg-purple-500/8",
  aggregate: "border-pink-500/30 bg-pink-500/8",
  enrich: "border-emerald-500/30 bg-emerald-500/8",
  output: "border-foreground/20 bg-foreground/5",
};

const PipelineBuilderPanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAshaSession();
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [running, setRunning] = useState(false);

  const createPipeline = () => {
    const p: Pipeline = {
      id: crypto.randomUUID(),
      name: `Pipeline ${pipelines.length + 1}`,
      nodes: [],
      status: "draft",
      runsCount: 0,
    };
    setPipelines(prev => [...prev, p]);
    setActivePipeline(p);
  };

  const addNode = (type: PipelineNode["type"]) => {
    if (!activePipeline) return;
    const node: PipelineNode = {
      id: crypto.randomUUID(),
      type,
      label: NODE_TYPES.find(n => n.type === type)?.label || type,
      config: {},
      status: "idle",
    };
    const updated = { ...activePipeline, nodes: [...activePipeline.nodes, node] };
    setActivePipeline(updated);
    setPipelines(prev => prev.map(p => p.id === updated.id ? updated : p));
    setShowAddNode(false);
  };

  const removeNode = (nodeId: string) => {
    if (!activePipeline) return;
    const updated = { ...activePipeline, nodes: activePipeline.nodes.filter(n => n.id !== nodeId) };
    setActivePipeline(updated);
    setPipelines(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const runPipeline = async () => {
    if (!activePipeline || !user || !activeSession) return;
    setRunning(true);
    const updated = { ...activePipeline, status: "running" as const };
    setActivePipeline(updated);

    // Simulate node-by-node execution
    for (let i = 0; i < updated.nodes.length; i++) {
      updated.nodes[i].status = "running";
      setActivePipeline({ ...updated });
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      updated.nodes[i].status = "done";
      setActivePipeline({ ...updated });
    }

    // Register as workflow in backend
    await supabase.from("asha_workflows").insert({
      user_id: user.id,
      name: activePipeline.name,
      trigger_type: "manual",
      active: true,
      runs_count: 1,
      last_run: new Date().toISOString(),
    });

    const finalPipeline: Pipeline = {
      ...updated,
      status: "completed",
      runsCount: updated.runsCount + 1,
      lastRun: new Date().toISOString(),
    };
    setActivePipeline(finalPipeline);
    setPipelines(prev => prev.map(p => p.id === finalPipeline.id ? finalPipeline : p));
    setRunning(false);
    toast({ title: "Pipeline completed", description: `${updated.nodes.length} nodes executed successfully` });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Pipeline Builder</h2>
          </div>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Build drag-and-drop data pipelines — connect any feeds into unified models.</p>
        </div>
        <button onClick={createPipeline} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Pipeline
        </button>
      </div>

      {/* Pipeline list */}
      {pipelines.length > 0 && !activePipeline && (
        <div className="space-y-2">
          {pipelines.map(p => (
            <button key={p.id} onClick={() => setActivePipeline(p)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/20 bg-card/20 hover:bg-card/40 transition-colors text-left">
              <div>
                <p className="text-sm font-light text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.nodes.length} nodes · {p.runsCount} runs</p>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full ${p.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : p.status === "running" ? "bg-amber-500/10 text-amber-400" : "bg-muted/30 text-muted-foreground"}`}>
                {p.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Active pipeline editor */}
      {activePipeline && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setActivePipeline(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
              <input
                value={activePipeline.name}
                onChange={e => {
                  const updated = { ...activePipeline, name: e.target.value };
                  setActivePipeline(updated);
                  setPipelines(prev => prev.map(p => p.id === updated.id ? updated : p));
                }}
                className="bg-transparent text-sm font-light text-foreground border-b border-border/20 focus:border-accent/40 outline-none px-1 py-0.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={runPipeline} disabled={running || activePipeline.nodes.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 disabled:opacity-30 transition-colors">
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                {running ? "Running…" : "Run Pipeline"}
              </button>
            </div>
          </div>

          {/* Node chain visualization */}
          <div className="relative">
            {activePipeline.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/20 rounded-2xl">
                <Workflow className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-xs text-muted-foreground/50 mb-3">Add nodes to build your pipeline</p>
                <button onClick={() => setShowAddNode(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
                  <Plus className="h-3 w-3" /> Add First Node
                </button>
              </div>
            ) : (
              <div className="space-y-0">
                {activePipeline.nodes.map((node, i) => {
                  const nodeType = NODE_TYPES.find(n => n.type === node.type);
                  const Icon = nodeType?.icon || Database;
                  const colors = nodeColorMap[node.type] || "border-border/20 bg-card/20";
                  return (
                    <div key={node.id}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors} transition-all ${node.status === "running" ? "ring-1 ring-accent/30" : ""}`}>
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab" />
                        <div className={`p-1.5 rounded-lg ${colors}`}>
                          {node.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-light text-foreground">{node.label}</p>
                          <p className="text-[9px] text-muted-foreground/50">{nodeType?.desc}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {node.status === "done" && <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">✓ Done</span>}
                          <button onClick={() => removeNode(node.id)} className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {i < activePipeline.nodes.length - 1 && (
                        <div className="flex justify-center py-1">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 rotate-90" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add node button at end */}
                <div className="flex justify-center pt-2">
                  <div className="flex justify-center py-1 mb-1"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 rotate-90" /></div>
                </div>
                <div className="flex justify-center">
                  <button onClick={() => setShowAddNode(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/20 text-muted-foreground/50 text-xs hover:border-accent/30 hover:text-accent transition-colors">
                    <Plus className="h-3 w-3" /> Add Node
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add node modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddNode(false)}>
          <div className="bg-card rounded-2xl border border-border/20 p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-light text-foreground mb-4">Add Pipeline Node</h3>
            <div className="grid grid-cols-2 gap-2">
              {NODE_TYPES.map(nt => {
                const Icon = nt.icon;
                return (
                  <button key={nt.type} onClick={() => addNode(nt.type)} className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border ${nodeColorMap[nt.type]} hover:scale-[1.02] transition-all text-left`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-xs font-light text-foreground">{nt.label}</p>
                      <p className="text-[9px] text-muted-foreground/50">{nt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pipelines.length === 0 && !activePipeline && (
        <div className="flex flex-col items-center justify-center py-16">
          <Workflow className="h-12 w-12 text-muted-foreground/15 mb-4" />
          <p className="text-sm font-extralight text-muted-foreground/50 mb-1">No pipelines yet</p>
          <p className="text-[10px] text-muted-foreground/30 mb-4">Connect sensor feeds, databases, and APIs into unified data models</p>
          <button onClick={createPipeline} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Create First Pipeline
          </button>
        </div>
      )}
    </div>
  );
};

export default PipelineBuilderPanel;
