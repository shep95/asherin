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
  TrendingUp,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  const [timescale, setTimescale] = useState<"hours" | "days" | "weeks" | "months" | "years">("days");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runsRef = useRef<Run[]>([]);
  useEffect(() => { runsRef.current = runs; }, [runs]);
  const autoIterateInFlight = useRef(false);

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
        // Read freshest runs via ref (avoids stale closure spamming duplicate iterations)
        const lastRun = runsRef.current[0];
        if (lastRun?.status === "completed" && lastRun.completed_at && !autoIterateInFlight.current) {
          const elapsed = Date.now() - new Date(lastRun.completed_at).getTime();
          if (elapsed > 2 * 60 * 1000) {
            autoIterateInFlight.current = true;
            try {
              await supabase.functions.invoke("self-learning-loop", { body: { action: "run" } });
              await fetchData();
            } catch (e) {
              console.error("Auto-iteration error:", e);
            } finally {
              autoIterateInFlight.current = false;
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
  }, [loopRunning, fetchData]);

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
          <Tabs defaultValue="progress" className="space-y-4">
            <TabsList className="bg-card/30 border border-border/30 rounded-2xl">
              <TabsTrigger value="progress" className="text-xs font-extralight tracking-wider rounded-xl">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="brains" className="text-xs font-extralight tracking-wider rounded-xl">
                <Brain className="h-3.5 w-3.5 mr-1.5" />
                Brains ({brains.length})
              </TabsTrigger>
              <TabsTrigger value="runs" className="text-xs font-extralight tracking-wider rounded-xl">Runs ({runs.length})</TabsTrigger>
              <TabsTrigger value="agents" className="text-xs font-extralight tracking-wider rounded-xl">Logs ({logs.length})</TabsTrigger>
              <TabsTrigger value="domains" className="text-xs font-extralight tracking-wider rounded-xl">Domains ({DOMAINS.length})</TabsTrigger>
            </TabsList>

            {/* PROGRESS TAB */}
            <TabsContent value="progress" className="space-y-4">
              {(() => {
                const sortedRuns = [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                const bucketRuns = (scale: string) => {
                  const buckets = new Map<string, { bugs: number; optimizations: number; security: number; brains: number; findings: number; count: number; firstDate: Date }>();
                  sortedRuns.forEach(r => {
                    const d = new Date(r.created_at);
                    let key: string;
                    if (scale === "hours") key = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:00`;
                    else if (scale === "days") key = `${d.getMonth()+1}/${d.getDate()}`;
                    else if (scale === "weeks") {
                      const jan1 = new Date(d.getFullYear(), 0, 1);
                      const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
                      key = `W${week} ${d.getFullYear()}`;
                    }
                    else if (scale === "months") key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
                    else key = `${d.getFullYear()}`;
                    const b = buckets.get(key) || { bugs: 0, optimizations: 0, security: 0, brains: 0, findings: 0, count: 0, firstDate: d };
                    b.bugs += r.bugs_found || 0;
                    b.optimizations += r.optimizations_applied || 0;
                    b.security += r.security_patches || 0;
                    b.brains += r.brains_generated || 0;
                    b.findings += r.findings?.length || 0;
                    b.count += 1;
                    buckets.set(key, b);
                  });
                  return Array.from(buckets.entries()).map(([label, v]) => ({ label, ...v }));
                };
                const chartData = bucketRuns(timescale);

                // Realistic scoring: based on bug density, severity weighting, and fix efficiency
                // Lower bug density per code reviewed = higher score (AI is writing cleaner code)
                let cumB = 0, cumO = 0, cumS = 0, cumCode = 0, cumFindings = 0;
                const cumulativeData = chartData.map((d, i) => {
                  cumB += d.bugs; cumO += d.optimizations; cumS += d.security;
                  const totalFixed = cumB + cumO + cumS;

                  // Count total code reviewed and findings across runs in this bucket
                  const runsInBucket = sortedRuns.filter(r => {
                    const rd = new Date(r.created_at);
                    if (timescale === "hours") return `${rd.getMonth()+1}/${rd.getDate()} ${rd.getHours()}:00` === d.label;
                    if (timescale === "days") return `${rd.getMonth()+1}/${rd.getDate()}` === d.label;
                    if (timescale === "months") return `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,"0")}` === d.label;
                    if (timescale === "years") return `${rd.getFullYear()}` === d.label;
                    return true;
                  });
                  const periodCode = runsInBucket.reduce((s, r) => s + (r.code_reviewed || 0), 0);
                  const periodFindings = runsInBucket.reduce((s, r) => s + (r.findings?.length || 0), 0);
                  cumCode += periodCode;
                  cumFindings += periodFindings;

                  // Bug density: findings per file reviewed (lower = better)
                  // Severity weights: critical=3, high=2, medium=1, low=0.3
                  const sevWeights = runsInBucket.flatMap(r => (r.findings || []) as any[]);
                  const weightedIssues = sevWeights.reduce((sum, f) => {
                    const w = f.severity === "critical" ? 3 : f.severity === "high" ? 2 : f.severity === "medium" ? 1 : 0.3;
                    return sum + w;
                  }, 0);

                  // Score formula: 100 - (weighted_issues / max(code_reviewed, 1)) * scaling
                  // Capped between 5-99. More code reviewed with fewer weighted issues = higher score
                  const density = cumCode > 0 ? (weightedIssues / Math.max(cumCode, 1)) : 1;
                  // Fix ratio: how many issues were resolved vs found (brains cover fixes)
                  const fixRatio = cumFindings > 0 ? Math.min(1, totalFixed / cumFindings) : 0;
                  // Combined: density drives the ceiling, fixRatio lifts from the floor
                  const rawScore = Math.round(
                    Math.max(5, Math.min(99,
                      (1 - Math.min(1, density * 0.6)) * 60 + fixRatio * 35 + (d.brains > 0 ? 4 : 0)
                    ))
                  );

                  return { ...d, cumulative: totalFixed, version: `v${i + 1}`, score: rawScore, bugDensity: cumCode > 0 ? (cumFindings / cumCode * 100).toFixed(1) : "—", periodFindings, periodCode };
                });

                const totalImprovements = totalBugs + totalOptimizations + totalSecurityPatches;
                const firstRunDate = sortedRuns[0]?.created_at ? new Date(sortedRuns[0].created_at) : null;
                const daysSinceStart = firstRunDate ? Math.max(1, Math.floor((Date.now() - firstRunDate.getTime()) / 86400000)) : 0;
                const improvementRate = daysSinceStart > 0 ? (totalImprovements / daysSinceStart).toFixed(1) : "0";
                const totalCodeReviewed = runs.reduce((s, r) => s + (r.code_reviewed || 0), 0);
                const totalFindingsCount = runs.reduce((s, r) => s + (r.findings?.length || 0), 0);
                const bugDensity = totalCodeReviewed > 0 ? (totalFindingsCount / totalCodeReviewed * 100).toFixed(1) : "0";
                const codeHealth = totalCodeReviewed > 0 ? Math.round(Math.max(10, 100 - parseFloat(bugDensity) * 5)) : 50;

                const currentScore = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1].score : 0;
                const previousScore = cumulativeData.length > 1 ? cumulativeData[cumulativeData.length - 2].score : 0;
                const scoreDelta = currentScore - previousScore;
                const firstScore = cumulativeData.length > 0 ? cumulativeData[0].score : 0;
                const totalGain = currentScore - firstScore;

                return (
                  <>
                    {/* Version Improvement Hero */}
                    <div className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-extralight tracking-[0.3em] text-muted-foreground uppercase">System Intelligence Score</p>
                        {scoreDelta !== 0 && (
                          <Badge variant="outline" className={`text-[10px] font-extralight border-border/30 ${scoreDelta > 0 ? "text-green-400" : "text-destructive"}`}>
                            {scoreDelta > 0 ? "+" : ""}{scoreDelta}% from last {timescale.slice(0, -1)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-end gap-6">
                        <div>
                          <p className="text-6xl font-extralight text-foreground">{currentScore}<span className="text-2xl text-muted-foreground">%</span></p>
                          <p className="text-xs font-extralight text-muted-foreground mt-1">current version quality</p>
                        </div>
                        <div className="flex-1">
                          <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-destructive via-yellow-500 to-green-500 transition-all duration-1000"
                              style={{ width: `${currentScore}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[9px] font-extralight text-muted-foreground/50">0%</span>
                            <span className="text-[9px] font-extralight text-muted-foreground/50">50%</span>
                            <span className="text-[9px] font-extralight text-muted-foreground/50">100%</span>
                          </div>
                        </div>
                      </div>
                      {/* Version timeline */}
                      {cumulativeData.length > 1 && (
                        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
                          {cumulativeData.map((d, i) => (
                            <div key={d.version} className="flex items-center gap-1 shrink-0">
                              <div className={`flex flex-col items-center rounded-xl px-2.5 py-1.5 ${i === cumulativeData.length - 1 ? "bg-accent/15 border border-accent/30" : "bg-card/30 border border-border/20"}`}>
                                <span className="text-[9px] font-extralight text-muted-foreground">{d.version}</span>
                                <span className={`text-sm font-extralight ${i === cumulativeData.length - 1 ? "text-accent" : "text-foreground"}`}>{d.score}%</span>
                              </div>
                              {i < cumulativeData.length - 1 && (
                                <span className="text-muted-foreground/30 text-[10px]">→</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      {[
                        { label: "Code Health", value: `${codeHealth}%`, sub: <div className="mt-2 h-1.5 rounded-full bg-muted/20 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${codeHealth}%` }} /></div> },
                        { label: "Bug Density", value: `${bugDensity}%`, sub: <p className="text-[10px] text-muted-foreground font-extralight mt-1">{totalFindingsCount} issues / {totalCodeReviewed} files</p> },
                        { label: "Total Gain", value: `${totalGain >= 0 ? "+" : ""}${totalGain}%`, sub: <p className="text-[10px] text-muted-foreground font-extralight mt-1">{firstScore}% → {currentScore}%</p> },
                        { label: "Fixes Applied", value: totalImprovements, sub: <p className="text-[10px] text-muted-foreground font-extralight mt-1">{improvementRate} / day avg</p> },
                        { label: "Learning Cycles", value: runs.length, sub: <p className="text-[10px] text-muted-foreground font-extralight mt-1">across {daysSinceStart} day{daysSinceStart !== 1 ? "s" : ""}</p> },
                        { label: "Active Brains", value: activeBrains, sub: <p className="text-[10px] text-muted-foreground font-extralight mt-1">{brains.length} total generated</p> },
                      ].map(c => (
                        <div key={c.label} className="rounded-2xl border border-border/30 bg-card/20 backdrop-blur-sm p-4">
                          <p className="text-[10px] font-extralight tracking-widest text-muted-foreground uppercase mb-1">{c.label}</p>
                          <p className="text-2xl font-extralight text-foreground">{c.value}</p>
                          {c.sub}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extralight tracking-wider text-muted-foreground uppercase">Intelligence Score Over Time</p>
                      <div className="flex items-center gap-1 rounded-2xl border border-border/30 bg-card/30 p-1">
                        {(["hours", "days", "weeks", "months", "years"] as const).map(t => (
                          <button key={t} onClick={() => setTimescale(t)} className={`rounded-xl px-3 py-1.5 text-xs font-extralight tracking-wider capitalize transition-all ${timescale === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cumulativeData.length > 0 ? (
                      <div className="rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm p-4">
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gradCum2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
                            <XAxis dataKey="version" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 300 }} formatter={(v: number, name: string) => name === "Score" ? [`${v}%`, name] : [v, name]} />
                            <Area type="monotone" dataKey="score" name="Score" stroke="hsl(var(--accent))" fill="url(#gradScore)" strokeWidth={2.5} dot={{ fill: "hsl(var(--accent))", r: 3, strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="cumulative" name="Total Fixes" stroke="hsl(var(--primary))" fill="url(#gradCum2)" strokeWidth={1} />
                          </AreaChart>
                        </ResponsiveContainer>
                        {/* Graph Logic Legend */}
                        <div className="mt-4 rounded-xl border border-border/20 bg-card/30 p-3 space-y-2">
                          <p className="text-[10px] font-extralight tracking-[0.2em] text-muted-foreground uppercase mb-2">Graph Logic</p>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-green-500/80 shrink-0" />
                            <p className="text-[11px] font-extralight text-foreground/80">
                              <span className="text-green-400 font-light">Fewer bugs found + fewer fixes needed = AI is improving.</span>
                              {" "}The system is writing cleaner code. Score rises as the AI learns to avoid mistakes before they happen.
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-destructive/80 shrink-0" />
                            <p className="text-[11px] font-extralight text-foreground/80">
                              <span className="text-destructive font-light">More bugs found + more fixes needed = AI is not improving.</span>
                              {" "}The system is still generating problematic code. Score stalls or drops — more learning cycles are needed.
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-accent/80 shrink-0" />
                            <p className="text-[11px] font-extralight text-foreground/80">
                              <span className="text-accent font-light">Score line (accent)</span> = overall intelligence quality. <span className="text-muted-foreground font-light">Fixes line (dim)</span> = cumulative issues resolved. Ideal trend: score ↑ while fixes plateau.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-sm font-extralight">
                        <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p>No data yet. Run iterations to see progress.</p>
                      </div>
                    )}
                    {chartData.length > 0 && (
                      <div className="rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden">
                        <div className="p-3 border-b border-border/20">
                          <p className="text-[10px] font-extralight tracking-widest text-muted-foreground uppercase">Version Breakdown by {timescale}</p>
                        </div>
                        <div className="divide-y divide-border/10">
                          {cumulativeData.map((d, i) => {
                            const periodTotal = d.bugs + d.optimizations + d.security;
                            const prevScore = i > 0 ? cumulativeData[i-1].score : d.score;
                            const delta = d.score - prevScore;
                            return (
                              <div key={d.label} className="flex items-center justify-between px-4 py-2.5 text-xs font-extralight gap-2">
                                <span className="text-accent w-10 shrink-0">{d.version}</span>
                                <span className="text-foreground w-20 shrink-0">{d.label}</span>
                                <span className="text-muted-foreground shrink-0">{d.count} runs</span>
                                <span className="text-muted-foreground shrink-0">{d.periodCode} files</span>
                                <span className="text-muted-foreground shrink-0">{d.periodFindings} issues</span>
                                <span className="text-muted-foreground shrink-0">{d.bugDensity}% density</span>
                                <span className="text-foreground font-light shrink-0">{d.score}%</span>
                                {i > 0 ? (
                                  <span className={`shrink-0 ${delta >= 0 ? "text-green-400" : "text-destructive"}`}>{delta >= 0 ? "+" : ""}{delta}%</span>
                                ) : (
                                  <span className="text-muted-foreground/40 shrink-0">baseline</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>

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
