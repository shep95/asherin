import { useState, useCallback, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Brain, BookOpen, Shield, Code2, Zap, Copy, Check, Download, Search,
  ChevronDown, ChevronRight, Scale, Lock, Bug, Gauge, Eye, RefreshCw, Terminal,
  Loader2, Sparkles, Clock, GitMerge, Activity, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

interface CodingLaw {
  id: string;
  law_number: string;
  name: string;
  domain: string;
  law: string;
  era: string;
  severity: string;
  active: boolean;
  rationale: string;
  source: string;
  generation_method: string | null;
  created_at: string;
}

interface EngineRun {
  id: string;
  run_type: string;
  laws_discovered: number;
  laws_cross_referenced: number;
  laws_created: number;
  status: string;
  details: any;
  created_at: string;
}

const DOMAIN_ICONS: Record<string, typeof Brain> = {
  "Architecture": Code2,
  "Security": Shield,
  "Error Handling": Bug,
  "API Engineering": Zap,
  "Language Design": Terminal,
  "Frontend Architecture": Eye,
  "Resilience": RefreshCw,
  "Cryptography": Lock,
  "Engineering": Gauge,
  "Craft": BookOpen,
  "Database Engineering": Code2,
  "Operations": Eye,
  "Infrastructure": Terminal,
  "Performance": Gauge,
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  standard: "border-accent/30 bg-accent/10 text-accent",
  advisory: "border-foreground/20 bg-foreground/5 text-muted-foreground",
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  seed: { label: "FOUNDING", color: "text-muted-foreground border-border/30" },
  discovered: { label: "DISCOVERED", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  synthesized: { label: "SYNTHESIZED", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
};

const CodingLawsView = () => {
  const { toast } = useToast();
  const [laws, setLaws] = useState<CodingLaw[]>([]);
  const [engineRuns, setEngineRuns] = useState<EngineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLaw, setExpandedLaw] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);
  const [triggeringEngine, setTriggeringEngine] = useState(false);

  // Load laws from DB
  const fetchLaws = useCallback(async () => {
    const { data, error } = await supabase
      .from("coding_laws")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setLaws(data as CodingLaw[]);
    else if (error) console.error("Failed to fetch laws:", error);
  }, []);

  const fetchRuns = useCallback(async () => {
    const { data, error } = await supabase
      .from("coding_laws_engine_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setEngineRuns(data as EngineRun[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLaws(), fetchRuns()]).finally(() => setLoading(false));
  }, [fetchLaws, fetchRuns]);

  const activeLaws = laws.filter(l => l.active).length;
  const domains = [...new Set(laws.map(l => l.domain))];
  const discoveredCount = laws.filter(l => l.source === "discovered").length;
  const synthesizedCount = laws.filter(l => l.source === "synthesized").length;

  const filteredLaws = laws.filter(l => {
    const matchesSearch = !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.law.toLowerCase().includes(searchQuery.toLowerCase()) || l.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = filterDomain === "all" || l.domain === filterDomain;
    const matchesSource = filterSource === "all" || l.source === filterSource;
    return matchesSearch && matchesDomain && matchesSource;
  });

  const toggleLaw = async (id: string, currentActive: boolean) => {
    setLaws(prev => prev.map(l => l.id === id ? { ...l, active: !currentActive } : l));
    const { error } = await supabase.from("coding_laws").update({ active: !currentActive }).eq("id", id);
    if (error) {
      setLaws(prev => prev.map(l => l.id === id ? { ...l, active: currentActive } : l));
      toast({ title: "Error", description: "Failed to update law", variant: "destructive" });
    }
  };

  const copyLaw = useCallback((law: CodingLaw) => {
    navigator.clipboard.writeText(`[${law.law_number}] ${law.name}\n${law.law}\n\nRationale: ${law.rationale}\nEra: ${law.era}\nSource: ${law.source}`);
    setCopiedId(law.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: law.name });
  }, [toast]);

  const exportAll = () => {
    const active = laws.filter(l => l.active);
    const text = active.map((l, i) =>
      `${l.law_number}: ${l.name}\nDomain: ${l.domain} | Severity: ${l.severity.toUpperCase()} | Era: ${l.era} | Source: ${l.source.toUpperCase()}\n\n${l.law}\n\nRationale: ${l.rationale}\n\n${"─".repeat(80)}`
    ).join("\n\n");
    const header = `AUREON — LAWS OF CODING (AUTONOMOUS ENGINE)\nActive Laws: ${active.length}/${laws.length}\nDiscovered: ${discoveredCount} | Synthesized: ${synthesizedCount}\nExported: ${new Date().toISOString()}\n${"═".repeat(80)}\n\n`;
    const blob = new Blob([header + text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-coding-laws-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${active.length} active laws exported.` });
  };

  const triggerEngine = async () => {
    setTriggeringEngine(true);
    try {
      const { data, error } = await supabase.functions.invoke("coding-laws-engine", { body: {} });
      if (error) throw error;
      toast({ title: "Engine Complete", description: `Created ${data?.laws_created || 0} new laws.` });
      await Promise.all([fetchLaws(), fetchRuns()]);
    } catch (err: any) {
      toast({ title: "Engine Error", description: err.message || "Failed to run engine", variant: "destructive" });
    } finally {
      setTriggeringEngine(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border border-border/30 bg-card/40 flex items-center justify-center">
              <Scale className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-[0.3em] uppercase text-foreground">Laws of Coding</h1>
              <p className="text-xs font-extralight text-muted-foreground tracking-wide">
                Autonomous engine • Discovers, cross-references & creates laws 24/7
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-border/30 bg-card/30 px-3 py-1.5">
              <span className="text-[10px] font-extralight tracking-widest uppercase text-muted-foreground">
                {activeLaws}/{laws.length} Active
              </span>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-3 py-1.5">
              <span className="text-[10px] font-extralight tracking-widest uppercase text-blue-400">
                {discoveredCount} Discovered
              </span>
            </div>
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-3 py-1.5">
              <span className="text-[10px] font-extralight tracking-widest uppercase text-purple-400">
                {synthesizedCount} Synthesized
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search laws..."
              className="flex-1 bg-transparent text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-extralight text-foreground outline-none"
          >
            <option value="all">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-extralight text-foreground outline-none"
          >
            <option value="all">All Sources</option>
            <option value="seed">Founding</option>
            <option value="discovered">Discovered</option>
            <option value="synthesized">Synthesized</option>
          </select>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 rounded-2xl border border-border/30 bg-card/30 px-4 py-2.5 text-xs font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            <Clock className="h-3.5 w-3.5" />
            History
          </button>
          <button onClick={triggerEngine} disabled={triggeringEngine} className="flex items-center gap-1.5 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-extralight tracking-wider text-accent hover:bg-accent/20 transition-colors disabled:opacity-50">
            {triggeringEngine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Run Engine
          </button>
          <button onClick={exportAll} className="flex items-center gap-1.5 rounded-2xl border border-border/30 bg-card/30 px-4 py-2.5 text-xs font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Analytics & Engine History Panel */}
      {showHistory && (
        <div className="flex-shrink-0 border-b border-border/20 bg-card/10 p-4">
          {/* Status Banner */}
          <div className="flex items-center gap-2 mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-extralight tracking-widest uppercase text-emerald-400">
              Engine Running 24/7 — Next run at the top of the hour
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Growth Chart */}
            <div className="rounded-2xl border border-border/20 bg-card/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                <h3 className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">Total Laws Over Time</h3>
              </div>
              {engineRuns.length === 0 ? (
                <p className="text-xs font-extralight text-muted-foreground/50 py-8 text-center">Waiting for first engine run...</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={[...engineRuns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).reduce((acc: any[], run) => {
                    const prev = acc.length > 0 ? acc[acc.length - 1].total : 20;
                    acc.push({
                      date: new Date(run.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                      total: prev + run.laws_created,
                      created: run.laws_created,
                    });
                    return acc;
                  }, [])}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" strokeWidth={2} name="Total Laws" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-Run Breakdown */}
            <div className="rounded-2xl border border-border/20 bg-card/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-3.5 w-3.5 text-accent" />
                <h3 className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">Laws Created Per Run</h3>
              </div>
              {engineRuns.length === 0 ? (
                <p className="text-xs font-extralight text-muted-foreground/50 py-8 text-center">No runs yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[...engineRuns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(run => ({
                    date: new Date(run.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    discovered: run.laws_discovered,
                    synthesized: run.laws_cross_referenced,
                    created: run.laws_created,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '11px' }} />
                    <Bar dataKey="discovered" fill="hsl(var(--accent))" name="Discovered" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="synthesized" fill="hsl(var(--primary))" name="Synthesized" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Run Log */}
          <div className="mt-3 rounded-2xl border border-border/20 bg-card/20 p-3 max-h-32 overflow-auto">
            <h3 className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground mb-2">Run Log (Autonomous — Every Hour)</h3>
            <div className="space-y-1">
              {engineRuns.map(run => (
                <div key={run.id} className="flex items-center gap-3 text-xs font-extralight">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${run.status === "completed" ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-muted-foreground/60 w-40 flex-shrink-0">{new Date(run.created_at).toLocaleString()}</span>
                  <span className="text-accent">+{run.laws_discovered} discovered</span>
                  <span className="text-primary">+{run.laws_cross_referenced} synthesized</span>
                  <span className="text-foreground">= {run.laws_created} created</span>
                  {(run.details as any)?.skipped_duplicates > 0 && (
                    <span className="text-muted-foreground/50">({(run.details as any).skipped_duplicates} skipped dupes)</span>
                  )}
                  {run.status === "failed" && <span className="text-destructive">FAILED</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Laws Grid */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {filteredLaws.map((law) => {
            const Icon = DOMAIN_ICONS[law.domain] || Brain;
            const isExpanded = expandedLaw === law.id;
            const sourceBadge = SOURCE_BADGES[law.source] || SOURCE_BADGES.seed;
            return (
              <div
                key={law.id}
                className={`rounded-2xl border bg-card/20 backdrop-blur-sm transition-all ${
                  law.active ? "border-border/30" : "border-border/10 opacity-50"
                }`}
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="flex-shrink-0 h-9 w-9 rounded-2xl border border-border/20 bg-card/30 flex items-center justify-center mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <button onClick={() => setExpandedLaw(isExpanded ? null : law.id)} className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-[10px] font-mono text-muted-foreground/40">{law.law_number}</span>
                        <h3 className="text-sm font-light tracking-wide text-foreground">{law.name}</h3>
                      </button>
                      <Badge variant="outline" className={`text-[9px] font-extralight tracking-wider rounded-xl ${SEVERITY_STYLES[law.severity] || SEVERITY_STYLES.standard}`}>
                        {law.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] font-extralight tracking-wider rounded-xl ${sourceBadge.color}`}>
                        {law.source === "synthesized" && <GitMerge className="h-2.5 w-2.5 mr-1" />}
                        {law.source === "discovered" && <Sparkles className="h-2.5 w-2.5 mr-1" />}
                        {sourceBadge.label}
                      </Badge>
                      <span className="text-[9px] font-extralight tracking-wider text-muted-foreground/50">{law.domain}</span>
                    </div>
                    <p className="text-xs font-extralight leading-relaxed text-muted-foreground pr-4">{law.law}</p>
                    {isExpanded && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-border/10 bg-card/10 p-4">
                        <div>
                          <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Rationale</span>
                          <p className="text-xs font-extralight leading-relaxed text-foreground/80 mt-1">{law.rationale}</p>
                        </div>
                        <div className="flex gap-8">
                          <div>
                            <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Origin Era</span>
                            <p className="text-xs font-extralight text-foreground/70 mt-1">{law.era}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Generation</span>
                            <p className="text-xs font-extralight text-foreground/70 mt-1">{law.generation_method || "Manual seed"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Added</span>
                            <p className="text-xs font-extralight text-foreground/70 mt-1">{new Date(law.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => copyLaw(law)} className="rounded-xl p-2 text-muted-foreground hover:text-foreground transition-colors">
                      {copiedId === law.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <Switch checked={law.active} onCheckedChange={() => toggleLaw(law.id, law.active)} />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLaws.length === 0 && (
            <div className="text-center py-16">
              <Scale className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-extralight text-muted-foreground">No laws match your search.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CodingLawsView;
