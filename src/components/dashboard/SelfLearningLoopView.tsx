import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Zap, ShieldCheck, Bug, Gauge, Code2, Play, RefreshCw, Activity,
  CheckCircle2, XCircle, Clock, Loader2, Terminal, Eye, ChevronDown, ChevronRight,
} from "lucide-react";

interface Run {
  id: string;
  status: string;
  domains_analyzed: string[];
  findings: any[];
  brains_generated: number;
  code_reviewed: number;
  bugs_found: number;
  optimizations_applied: number;
  security_patches: number;
  duration_ms: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface BrainDirective {
  id: string;
  run_id: string;
  name: string;
  domain: string;
  directive: string;
  confidence: number;
  auto_approved: boolean;
  active: boolean;
  findings: any[];
  created_at: string;
}

interface AgentLog {
  id: string;
  run_id: string;
  agent_name: string;
  action: string;
  details: string;
  severity: string;
  created_at: string;
}

const AGENT_ICONS: Record<string, typeof Brain> = {
  "Debugging Agent": Bug,
  "Optimization Agent": Gauge,
  "Security Agent": ShieldCheck,
  "Design Agent": Eye,
  "Architecture Agent": Code2,
  "Scout": Zap,
  "System": Terminal,
};

const DOMAINS = [
  "Software Design & Architecture", "Frontend Development", "Backend Development",
  "Database Engineering", "Systems Programming", "Cybersecurity Engineering",
  "Quality Assurance & Testing", "DevOps & Infrastructure-as-Code",
  "Data Engineering & Science", "AI/Machine Learning Engineering",
  "Intelligence Architecture", "Computational Linguistics", "Specialized Computing",
];

const SelfLearningLoopView = () => {
  const { toast } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [brains, setBrains] = useState<BrainDirective[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [expandedBrain, setExpandedBrain] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runsResp, brainsResp, logsResp] = await Promise.all([
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-runs" } }),
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-brains" } }),
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-logs" } }),
      ]);
      if (runsResp.data?.runs) setRuns(runsResp.data.runs);
      if (brainsResp.data?.brains) setBrains(brainsResp.data.brains);
      if (logsResp.data?.logs) setLogs(logsResp.data.logs);
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerRun = async () => {
    setRunning(true);
    toast({ title: "Self-Learning Loop initiated", description: "Agents are analyzing domains…" });
    try {
      const { data, error } = await supabase.functions.invoke("self-learning-loop", { body: { action: "run" } });
      if (error) throw error;
      toast({ title: "Loop completed", description: `${data.findings} findings generated in ${(data.duration / 1000).toFixed(1)}s` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Loop failed", description: e.message, variant: "destructive" });
    }
    setRunning(false);
  };

  const toggleBrain = async (brainId: string, active: boolean) => {
    await supabase.functions.invoke("self-learning-loop", { body: { action: "toggle-brain", brainId, active } });
    setBrains(prev => prev.map(b => b.id === brainId ? { ...b, active } : b));
  };

  const activeBrains = brains.filter(b => b.active).length;
  const totalFindings = runs.reduce((sum, r) => sum + (r.findings?.length || 0), 0);
  const totalBugs = runs.reduce((sum, r) => sum + (r.bugs_found || 0), 0);
  const totalOptimizations = runs.reduce((sum, r) => sum + (r.optimizations_applied || 0), 0);
  const totalSecurityPatches = runs.reduce((sum, r) => sum + (r.security_patches || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Brain className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Self-Learning Loop</h1>
              <p className="text-xs font-extralight text-muted-foreground">Autonomous code intelligence — self-improving feedback loop</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="rounded-xl border border-border/30 bg-card/30 px-3 py-2 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={triggerRun}
              disabled={running}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2.5 text-sm font-light text-white hover:from-emerald-500 hover:to-cyan-500 transition-all disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running…" : "Execute Loop"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-5">
          {[
            { label: "Total Runs", value: runs.length, icon: Activity, color: "text-blue-400" },
            { label: "Active Brains", value: activeBrains, icon: Brain, color: "text-emerald-400" },
            { label: "Total Findings", value: totalFindings, icon: Zap, color: "text-amber-400" },
            { label: "Bugs Found", value: totalBugs, icon: Bug, color: "text-red-400" },
            { label: "Optimizations", value: totalOptimizations, icon: Gauge, color: "text-cyan-400" },
            { label: "Security Patches", value: totalSecurityPatches, icon: ShieldCheck, color: "text-violet-400" },
            { label: "Domains", value: DOMAINS.length, icon: Code2, color: "text-pink-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] font-light tracking-wider text-muted-foreground uppercase">{stat.label}</span>
              </div>
              <p className={`text-xl font-extralight ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <Tabs defaultValue="brains" className="space-y-4">
            <TabsList className="bg-card/30 border border-border/20">
              <TabsTrigger value="brains" className="text-xs">Generated Brains ({brains.length})</TabsTrigger>
              <TabsTrigger value="runs" className="text-xs">Run History ({runs.length})</TabsTrigger>
              <TabsTrigger value="agents" className="text-xs">Agent Logs ({logs.length})</TabsTrigger>
              <TabsTrigger value="domains" className="text-xs">Domains ({DOMAINS.length})</TabsTrigger>
            </TabsList>

            {/* BRAINS TAB */}
            <TabsContent value="brains" className="space-y-3">
              {brains.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-extralight">
                  No brains generated yet. Execute a loop to begin.
                </div>
              ) : brains.map((brain) => (
                <div key={brain.id} className={`rounded-xl border ${brain.active ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/20 bg-card/10"} backdrop-blur-sm transition-all`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Brain className={`h-4 w-4 flex-shrink-0 ${brain.active ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-light text-foreground truncate">{brain.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{brain.domain}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Confidence: {(brain.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setExpandedBrain(expandedBrain === brain.id ? null : brain.id)} className="text-muted-foreground hover:text-foreground">
                        {expandedBrain === brain.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <Switch checked={brain.active} onCheckedChange={(v) => toggleBrain(brain.id, v)} />
                    </div>
                  </div>
                  {expandedBrain === brain.id && (
                    <div className="px-4 pb-4 border-t border-border/10 mt-0 pt-3">
                      <p className="text-xs font-light text-muted-foreground mb-2 uppercase tracking-wider">Directive</p>
                      <pre className="text-xs font-light text-foreground/80 whitespace-pre-wrap bg-background/30 rounded-lg p-3 border border-border/10 max-h-64 overflow-auto">
                        {brain.directive}
                      </pre>
                      {brain.findings?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-light text-muted-foreground mb-1 uppercase tracking-wider">Findings ({brain.findings.length})</p>
                          <div className="space-y-1.5">
                            {brain.findings.slice(0, 5).map((f: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <Badge variant={f.severity === "critical" ? "destructive" : "outline"} className="text-[9px] px-1 py-0 flex-shrink-0">{f.severity}</Badge>
                                <span className="font-light text-foreground/70">{f.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* RUNS TAB */}
            <TabsContent value="runs" className="space-y-3">
              {runs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-extralight">
                  No runs yet. Click "Execute Loop" to start.
                </div>
              ) : runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-border/20 bg-card/10 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                      <span className="text-sm font-light text-foreground capitalize">{run.status}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                      <span className="text-muted-foreground/50">•</span>
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="rounded-lg bg-background/20 p-2">
                      <p className="text-muted-foreground font-light">Domains</p>
                      <p className="text-foreground font-light">{run.domains_analyzed?.length || 0}</p>
                    </div>
                    <div className="rounded-lg bg-background/20 p-2">
                      <p className="text-muted-foreground font-light">Brains</p>
                      <p className="text-foreground font-light">{run.brains_generated || 0}</p>
                    </div>
                    <div className="rounded-lg bg-background/20 p-2">
                      <p className="text-muted-foreground font-light">Bugs</p>
                      <p className="text-red-400 font-light">{run.bugs_found || 0}</p>
                    </div>
                    <div className="rounded-lg bg-background/20 p-2">
                      <p className="text-muted-foreground font-light">Optimizations</p>
                      <p className="text-cyan-400 font-light">{run.optimizations_applied || 0}</p>
                    </div>
                    <div className="rounded-lg bg-background/20 p-2">
                      <p className="text-muted-foreground font-light">Security</p>
                      <p className="text-violet-400 font-light">{run.security_patches || 0}</p>
                    </div>
                  </div>
                  {run.domains_analyzed?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {run.domains_analyzed.map((d) => (
                        <Badge key={d} variant="outline" className="text-[9px]">{d}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* AGENT LOGS TAB */}
            <TabsContent value="agents" className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-extralight">
                  No agent logs yet.
                </div>
              ) : logs.slice(0, 100).map((log) => {
                const IconComp = AGENT_ICONS[log.agent_name] || Terminal;
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/10 bg-card/5 p-3">
                    <IconComp className={`h-4 w-4 flex-shrink-0 mt-0.5 ${log.severity === "warning" ? "text-amber-400" : log.severity === "error" ? "text-red-400" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{log.agent_name}</span>
                        <span className="text-[10px] text-muted-foreground">{log.action}</span>
                      </div>
                      {log.details && (
                        <p className="text-[11px] font-light text-muted-foreground mt-0.5 line-clamp-2">{log.details}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </TabsContent>

            {/* DOMAINS TAB */}
            <TabsContent value="domains">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DOMAINS.map((domain) => {
                  const domainBrains = brains.filter(b => b.domain === domain);
                  const activeDomainBrains = domainBrains.filter(b => b.active).length;
                  return (
                    <div key={domain} className="rounded-xl border border-border/20 bg-card/10 backdrop-blur-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Code2 className="h-4 w-4 text-accent" />
                        <span className="text-sm font-light text-foreground">{domain}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{domainBrains.length} brains</span>
                        <span className="text-emerald-400">{activeDomainBrains} active</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};

export default SelfLearningLoopView;
