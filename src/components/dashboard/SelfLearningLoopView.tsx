import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Zap, ShieldCheck, Bug, Gauge, Code2, Play, Square, RefreshCw, Activity,
  CheckCircle2, XCircle, Clock, Loader2, Terminal, Eye, ChevronDown, ChevronRight, Download,
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
  "Generator": Code2,
  "Analyzer": Bug,
  "Brain Builder": Brain,
  "Rebuilder": RefreshCw,
  "Verifier": CheckCircle2,
  "Scout": Zap,
  "System": Terminal,
};

const DOMAINS = [
  "Authentication & Authorization", "API Engineering", "Database Engineering",
  "Frontend Architecture", "Cybersecurity", "Realtime Systems",
  "Data Pipeline", "ML Engineering", "Infrastructure",
  "Quality Assurance", "Concurrency & Parallelism", "Network Programming",
  "Compiler & Interpreter Design", "Cryptography", "Systems Programming",
  "Data Structures & Algorithms",
];

const SelfLearningLoopView = () => {
  const { toast } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [brains, setBrains] = useState<BrainDirective[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loopRunning, setLoopRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [expandedBrain, setExpandedBrain] = useState<string | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [runsResp, brainsResp, logsResp, statusResp] = await Promise.all([
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-runs" } }),
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-brains" } }),
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-logs" } }),
        supabase.functions.invoke("self-learning-loop", { body: { action: "get-status" } }),
      ]);
      if (runsResp.data?.runs) setRuns(runsResp.data.runs);
      if (brainsResp.data?.brains) setBrains(brainsResp.data.brains);
      if (logsResp.data?.logs) setLogs(logsResp.data.logs);
      if (statusResp.data) {
        setLoopRunning(statusResp.data.running === true);
        if (statusResp.data.lastRun?.created_at) setLastRunTime(statusResp.data.lastRun.created_at);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    if (showSpinner) setRefreshing(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [fetchData]);

  // Poll for updates and auto-trigger new iterations when loop is running
  useEffect(() => {
    if (loopRunning) {
      const poll = async () => {
        await fetchData();
        // Auto-trigger a new iteration if last run completed > 2 min ago
        const lastRun = runs[0];
        if (lastRun?.status === "completed" && lastRun.completed_at) {
          const elapsed = Date.now() - new Date(lastRun.completed_at).getTime();
          if (elapsed > 2 * 60 * 1000) {
            try {
              await supabase.functions.invoke("self-learning-loop", { body: { action: "run" } });
              await fetchData();
            } catch (e) {
              console.error("Auto-iteration error:", e);
            }
          }
        }
      };
      pollRef.current = setInterval(poll, 30000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loopRunning, fetchData, runs]);

  const startLoop = async () => {
    setStarting(true);
    toast({ title: "Starting Self-Learning Loop", description: "The loop will run continuously until you stop it — even if you close the app." });
    try {
      const { error } = await supabase.functions.invoke("self-learning-loop", { body: { action: "start-loop" } });
      if (error) throw error;
      setLoopRunning(true);
      toast({ title: "Loop is running", description: "Continuous learning iterations active. Close the app — it keeps going." });
      fetchData();
    } catch (e: any) {
      toast({ title: "Failed to start", description: e.message, variant: "destructive" });
    }
    setStarting(false);
  };

  const stopLoop = async () => {
    setStopping(true);
    try {
      const { error } = await supabase.functions.invoke("self-learning-loop", { body: { action: "stop-loop" } });
      if (error) throw error;
      setLoopRunning(false);
      toast({ title: "Loop stopped", description: "Self-learning has been halted." });
      fetchData();
    } catch (e: any) {
      toast({ title: "Failed to stop", description: e.message, variant: "destructive" });
    }
    setStopping(false);
  };

  const runNow = async () => {
    setStarting(true);
    toast({ title: "Triggering iteration", description: "Running a new learning cycle now..." });
    try {
      await supabase.functions.invoke("self-learning-loop", { body: { action: "run" } });
      toast({ title: "Iteration complete", description: "New brains generated. Refreshing data..." });
      await fetchData(true);
    } catch (e: any) {
      toast({ title: "Iteration failed", description: e.message, variant: "destructive" });
    }
    setStarting(false);
  };

  const toggleBrain = async (brainId: string, active: boolean) => {
    await supabase.functions.invoke("self-learning-loop", { body: { action: "toggle-brain", brainId, active } });
    setBrains(prev => prev.map(b => b.id === brainId ? { ...b, active } : b));
  };

  const exportBrains = () => {
    if (!brains.length) return;
    const lines = brains.map((b, i) =>
      `[${String(i + 1).padStart(3, "0")}] ${b.name}\nDomain: ${b.domain}\nConfidence: ${(b.confidence * 100).toFixed(0)}%\nActive: ${b.active ? "YES" : "NO"}\nCreated: ${new Date(b.created_at).toLocaleString()}\n\n${b.directive}\n\n${"─".repeat(80)}`
    ).join("\n\n");
    const header = `AUREON SELF-LEARNING LOOP — BRAIN EXPORT\nExported: ${new Date().toISOString()}\nTotal Brains: ${brains.length}\nActive: ${brains.filter(b => b.active).length}\n${"═".repeat(80)}\n\n`;
    const blob = new Blob([header + lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-brains-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${brains.length} brains exported as TXT.` });
  };

  const activeBrains = brains.filter(b => b.active).length;
  const totalFindings = runs.reduce((sum, r) => sum + (r.findings?.length || 0), 0);
  const totalBugs = runs.reduce((sum, r) => sum + (r.bugs_found || 0), 0);
  const totalOptimizations = runs.reduce((sum, r) => sum + (r.optimizations_applied || 0), 0);
  const totalSecurityPatches = runs.reduce((sum, r) => sum + (r.security_patches || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/40 bg-card/30 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border border-border/40 bg-card/50 flex items-center justify-center">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-[0.3em] uppercase text-foreground">Self-Learning Loop</h1>
              <p className="text-xs font-extralight text-muted-foreground tracking-wide">
                {loopRunning ? "Running continuously — survives app close" : "Autonomous code intelligence"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            {loopRunning && (
              <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/30 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-extralight tracking-widest uppercase text-foreground">LIVE</span>
              </div>
            )}

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="rounded-2xl border border-border/40 bg-card/30 p-2.5 text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            {/* Run Now - trigger single iteration */}
            <button
              onClick={runNow}
              disabled={starting || stopping}
              className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/30 px-4 py-2.5 text-xs font-extralight tracking-wider text-foreground hover:bg-card/50 transition-all disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              <span>Run Now</span>
            </button>

            {/* Run / Stop Toggle */}
            {loopRunning ? (
              <button
                onClick={stopLoop}
                disabled={stopping}
                className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-extralight tracking-wider text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {stopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={startLoop}
                disabled={starting}
                className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/50 px-5 py-2.5 text-sm font-extralight tracking-wider text-foreground hover:bg-card/80 transition-all disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>Run</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-5">
          {[
            { label: "Total Runs", value: runs.length, icon: Activity },
            { label: "Active Brains", value: activeBrains, icon: Brain },
            { label: "All Brains", value: brains.length, icon: Brain },
            { label: "Findings", value: totalFindings, icon: Zap },
            { label: "Bugs", value: totalBugs, icon: Bug },
            { label: "Optimizations", value: totalOptimizations, icon: Gauge },
            { label: "Security", value: totalSecurityPatches, icon: ShieldCheck },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-extralight tracking-widest text-muted-foreground uppercase">{stat.label}</span>
              </div>
              <p className="text-xl font-extralight text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Status bar */}
        {lastRunTime && (
          <div className="mt-3 flex items-center gap-4 rounded-2xl border border-border/20 bg-card/10 px-4 py-2 text-xs font-extralight text-muted-foreground">
            <span className="tracking-wider uppercase">Status</span>
            <span className={loopRunning ? "text-green-400" : "text-muted-foreground"}>
              {loopRunning ? "Running (persistent)" : "Stopped"}
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>Last iteration: {new Date(lastRunTime).toLocaleString()}</span>
            {loopRunning && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-foreground/60">Polling every 15s</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <Tabs defaultValue="brains" className="space-y-4">
            <TabsList className="bg-card/30 border border-border/30 rounded-2xl">
              <TabsTrigger value="brains" className="text-xs font-extralight tracking-wider rounded-xl">
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Brains ({brains.length})
              </TabsTrigger>
              <TabsTrigger value="runs" className="text-xs font-extralight tracking-wider rounded-xl">Runs ({runs.length})</TabsTrigger>
              <TabsTrigger value="agents" className="text-xs font-extralight tracking-wider rounded-xl">Logs ({logs.length})</TabsTrigger>
              <TabsTrigger value="domains" className="text-xs font-extralight tracking-wider rounded-xl">Domains ({DOMAINS.length})</TabsTrigger>
            </TabsList>

            {/* BRAINS TAB */}
            <TabsContent value="brains" className="space-y-3">
              {brains.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={exportBrains}
                    className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/30 px-4 py-2 text-xs font-extralight tracking-wider text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export All as TXT
                  </button>
                </div>
              )}
              {brains.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm font-extralight">
                  <Brain className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p>No brains generated yet.</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">Click Run to start the learning loop.</p>
                </div>
              ) : brains.map((brain) => (
                <div key={brain.id} className={`rounded-2xl border ${brain.active ? "border-border/50 bg-card/20" : "border-border/20 bg-card/5 opacity-60"} backdrop-blur-sm transition-all`}>
                  <div className="flex items-center justify-between p-4">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedBrain(expandedBrain === brain.id ? null : brain.id)}
                    >
                      <Brain className={`h-4 w-4 flex-shrink-0 ${brain.active ? "text-foreground" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-extralight text-foreground truncate">{brain.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-lg font-extralight">{brain.domain}</Badge>
                          <span className="text-[10px] text-muted-foreground font-extralight">
                            {(brain.confidence * 100).toFixed(0)}% confidence
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 font-extralight">
                            {new Date(brain.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedBrain(expandedBrain === brain.id ? null : brain.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedBrain === brain.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <Switch checked={brain.active} onCheckedChange={(v) => toggleBrain(brain.id, v)} />
                    </div>
                  </div>
                  {expandedBrain === brain.id && (
                    <div className="px-4 pb-4 border-t border-border/20 mt-0 pt-3">
                      <p className="text-[10px] font-extralight text-muted-foreground mb-2 uppercase tracking-widest">Directive</p>
                      <pre className="text-xs font-extralight text-foreground/70 whitespace-pre-wrap bg-background/30 rounded-xl p-3 border border-border/20 max-h-96 overflow-auto">
                        {brain.directive}
                      </pre>
                      {brain.findings?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-extralight text-muted-foreground mb-1 uppercase tracking-widest">Findings ({brain.findings.length})</p>
                          <div className="space-y-1.5">
                            {brain.findings.map((f: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <Badge variant={f.severity === "critical" ? "destructive" : "outline"} className="text-[9px] px-1 py-0 flex-shrink-0 rounded-lg font-extralight">{f.severity}</Badge>
                                <span className="font-extralight text-foreground/60">{f.title}</span>
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
                  No runs yet. Click Run to start.
                </div>
              ) : runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-border/20 bg-card/10 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-foreground" /> : run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-extralight text-foreground capitalize tracking-wider">{run.status}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-extralight">
                      <Clock className="h-3 w-3" />
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "--"}
                      <span className="text-muted-foreground/30">|</span>
                      {new Date(run.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    {[
                      { label: "Domains", value: run.domains_analyzed?.length || 0 },
                      { label: "Brains", value: run.brains_generated || 0 },
                      { label: "Bugs", value: run.bugs_found || 0 },
                      { label: "Optimizations", value: run.optimizations_applied || 0 },
                      { label: "Security", value: run.security_patches || 0 },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl bg-background/20 p-2">
                        <p className="text-muted-foreground font-extralight">{s.label}</p>
                        <p className="text-foreground font-extralight">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {run.domains_analyzed?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {run.domains_analyzed.map((d) => (
                        <Badge key={d} variant="outline" className="text-[9px] rounded-lg font-extralight">{d}</Badge>
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
                  <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/20 bg-card/5 p-3">
                    <IconComp className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extralight text-foreground">{log.agent_name}</span>
                        <span className="text-[10px] text-muted-foreground font-extralight">{log.action}</span>
                      </div>
                      {log.details && (
                        <p className="text-[11px] font-extralight text-muted-foreground mt-0.5 line-clamp-2">{log.details}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 font-extralight">
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
                    <div key={domain} className="rounded-2xl border border-border/20 bg-card/10 backdrop-blur-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-extralight text-foreground">{domain}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-extralight">
                        <span>{domainBrains.length} brains</span>
                        <span>{activeDomainBrains} active</span>
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
