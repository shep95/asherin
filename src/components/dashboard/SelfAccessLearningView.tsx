import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  Brain, Play, Clock, FileSearch, Shield, Zap, Bug, Layers, Palette,
  ChevronDown, ChevronRight, Copy, Check, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Loader2, Eye, Filter, ClipboardCopy, Download, Lightbulb,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_EMAIL } from "@/lib/adminEmail";

interface Finding {
  id: string;
  run_id: string;
  file_path: string;
  finding_type: string;
  severity: string;
  title: string;
  finding: string;
  reasoning: string;
  recommendation: string;
  reason_needs_fix: string;
  output_code: string | null;
  status: string;
  created_at: string;
}

interface Run {
  id: string;
  status: string;
  files_analyzed: number;
  findings_count: number;
  duration_ms: number | null;
  scan_scope: string;
  created_at: string;
  completed_at: string | null;
}

const SCOPES = [
  { key: "full", label: "Full Codebase", icon: Layers },
  { key: "frontend", label: "Frontend Only", icon: Palette },
  { key: "backend", label: "Backend Only", icon: Zap },
  { key: "security", label: "Security Audit", icon: Shield },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  info: "text-muted-foreground bg-muted/20 border-border/20",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  bug: Bug,
  optimization: Zap,
  security: Shield,
  architecture: Layers,
  design: Palette,
  logic: Brain,
  workflow: ArrowRight,
  recommendation: Lightbulb,
};

const SelfAccessLearningView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { copy, copied } = useCopyToClipboard();
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scope, setScope] = useState("full");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const callApi = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/self-access-learning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    return resp.json();
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const data = await callApi("get-runs");
      setRuns(data.runs || []);
    } catch {}
  }, [callApi]);

  const loadFindings = useCallback(async (runId?: string) => {
    try {
      const data = await callApi("get-findings", { runId: runId || undefined });
      setFindings(data.findings || []);
    } catch {}
  }, [callApi]);

  // Load once on mount only
  useEffect(() => { loadRuns(); loadFindings(); }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const data = await callApi("analyze", { scope });
      toast({ title: "Analysis complete", description: `Found ${data.findings} issues in ${(data.duration / 1000).toFixed(1)}s` });
      loadRuns();
      loadFindings();
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateFinding = async (id: string, status: string) => {
    try {
      await callApi("update-finding", { findingId: id, status });
      setFindings(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      toast({ title: status === "approved" ? "Finding approved" : "Finding dismissed" });
    } catch {}
  };

  const filteredFindings = findings.filter(f => {
    if (selectedRun && f.run_id !== selectedRun) return false;
    if (filterStatus && f.status !== filterStatus) return false;
    if (filterSeverity === "recommendation") {
      if (f.finding_type !== "recommendation") return false;
    } else if (filterSeverity && f.severity !== filterSeverity) return false;
    return true;
  });

  const stats = {
    total: findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    pending: findings.filter(f => f.status === "pending").length,
    approved: findings.filter(f => f.status === "approved").length,
  };

  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
              <Eye className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Self-Access Learning</h1>
              <p className="text-xs text-muted-foreground font-extralight">Recursive codebase self-analysis • Finding → Reasoning → Recommendation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scope selector */}
            <div className="flex items-center gap-1 rounded-xl border border-border/20 bg-card/30 p-1">
              {SCOPES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all ${
                    scope === s.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  <s.icon className="h-3 w-3" />
                  <span className="hidden md:inline">{s.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-light tracking-wide hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {isAnalyzing ? "Analyzing…" : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Findings", value: stats.total, icon: FileSearch },
            { label: "Critical", value: stats.critical, icon: AlertTriangle },
            { label: "Pending Review", value: stats.pending, icon: Clock },
            { label: "Approved", value: stats.approved, icon: CheckCircle2 },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-light tracking-wide uppercase">{s.label}</span>
              </div>
              <p className="text-xl font-extralight text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar: Runs */}
        <div className="w-56 border-r border-border/20 bg-card/10 flex-shrink-0 hidden md:flex flex-col">
          <div className="p-3 border-b border-border/20">
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Analysis Runs</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedRun(null)}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                  !selectedRun ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                All Findings
              </button>
              {runs.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRun(r.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-colors ${
                    selectedRun === r.id ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{r.scan_scope}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5">
                      {r.findings_count}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(r.created_at).toLocaleDateString()} • {r.files_analyzed} files
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main: Findings */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {/* Actions bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {filteredFindings.length > 0 && (
                <>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => {
                        const allText = filteredFindings.map((f, i) =>
                          `[${i + 1}] ${f.title}\nSeverity: ${f.severity} | Type: ${f.finding_type} | File: ${f.file_path}\n\nFinding:\n${f.finding}\n\nReasoning:\n${f.reasoning}\n\nRecommendation:\n${f.recommendation}\n\nWhy This Needs Fixing:\n${f.reason_needs_fix}${f.output_code ? `\n\nCode Fix:\n${f.output_code}` : ""}\n\n${"─".repeat(80)}`
                        ).join("\n\n");
                        const header = `AUREON SELF-ACCESS LEARNING — FINDINGS EXPORT\nExported: ${new Date().toISOString()}\nTotal: ${filteredFindings.length}\n${"═".repeat(80)}\n\n`;
                        navigator.clipboard.writeText(header + allText);
                        toast({ title: "Copied", description: `${filteredFindings.length} findings copied to clipboard.` });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <ClipboardCopy className="h-3 w-3" />
                      Copy All ({filteredFindings.length})
                    </button>
                    <button
                      onClick={() => {
                        const allText = filteredFindings.map((f, i) =>
                          `[${i + 1}] ${f.title}\nSeverity: ${f.severity} | Type: ${f.finding_type} | File: ${f.file_path}\n\nFinding:\n${f.finding}\n\nReasoning:\n${f.reasoning}\n\nRecommendation:\n${f.recommendation}\n\nWhy This Needs Fixing:\n${f.reason_needs_fix}${f.output_code ? `\n\nCode Fix:\n${f.output_code}` : ""}\n\n${"─".repeat(80)}`
                        ).join("\n\n");
                        const header = `AUREON SELF-ACCESS LEARNING — FINDINGS EXPORT\nExported: ${new Date().toISOString()}\nTotal: ${filteredFindings.length}\n${"═".repeat(80)}\n\n`;
                        const blob = new Blob([header + allText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `aureon-findings-${new Date().toISOString().slice(0, 10)}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast({ title: "Exported", description: `${filteredFindings.length} findings exported as TXT.` });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Export TXT
                    </button>
                  </div>
                </>
              )}
              {["pending", "approved", "dismissed"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  className={`rounded-lg px-3 py-1 text-xs border transition-colors capitalize ${
                    filterStatus === s ? "border-accent/30 bg-accent/10 text-accent" : "border-border/20 text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  {s}
                </button>
              ))}
              <div className="w-px h-4 bg-border/20 mx-1" />
              {["critical", "high", "medium", "low", "recommendation"].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(filterSeverity === s ? null : s)}
                  className={`rounded-lg px-3 py-1 text-xs border transition-colors capitalize ${
                    filterSeverity === s ? "border-accent/30 bg-accent/10 text-accent" : "border-border/20 text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {filteredFindings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Eye className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground font-extralight">No findings yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Run an analysis to let Aureon inspect its own codebase.</p>
              </div>
            )}

            {filteredFindings.map(f => {
              const isExpanded = expandedFinding === f.id;
              const TypeIcon = TYPE_ICONS[f.finding_type] || Bug;
              return (
                <div
                  key={f.id}
                  className={`rounded-xl border backdrop-blur-sm transition-all ${
                    f.status === "dismissed" ? "opacity-50 border-border/10 bg-card/10" :
                    f.status === "approved" ? "border-emerald-500/20 bg-emerald-500/5" :
                    "border-border/20 bg-card/20"
                  }`}
                >
                  {/* Finding header */}
                  <button
                    onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                    className="w-full text-left p-4 flex items-start gap-3"
                  >
                    <div className={`p-1.5 rounded-lg border ${SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.info}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-light text-foreground">{f.title}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 capitalize ${SEVERITY_COLORS[f.severity]}`}>
                          {f.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 capitalize">
                          {f.finding_type}
                        </Badge>
                        {f.status !== "pending" && (
                          <Badge variant="outline" className={`text-[9px] px-1.5 capitalize ${
                            f.status === "approved" ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"
                          }`}>
                            {f.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-extralight">{f.file_path}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border/10 pt-4">
                      {/* Finding */}
                      <div>
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-1.5 flex items-center gap-1.5">
                          <FileSearch className="h-3 w-3" /> Finding
                        </p>
                        <p className="text-xs text-foreground/90 font-extralight leading-relaxed">{f.finding}</p>
                      </div>

                      {/* Reasoning */}
                      <div>
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-1.5 flex items-center gap-1.5">
                          <Brain className="h-3 w-3" /> Reasoning
                        </p>
                        <p className="text-xs text-foreground/90 font-extralight leading-relaxed">{f.reasoning}</p>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-1.5 flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3" /> Recommendation
                        </p>
                        <p className="text-xs text-foreground/90 font-extralight leading-relaxed">{f.recommendation}</p>
                      </div>

                      {/* Why it needs fixing */}
                      <div>
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" /> Why This Needs Fixing
                        </p>
                        <p className="text-xs text-foreground/90 font-extralight leading-relaxed">{f.reason_needs_fix}</p>
                      </div>

                      {/* Output code */}
                      {f.output_code && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase flex items-center gap-1.5">
                              <Zap className="h-3 w-3" /> Code Output — Copy & Paste
                            </p>
                            <button
                              onClick={() => copy(f.output_code!)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:bg-foreground/5 transition-colors"
                            >
                              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              {copied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <pre className="rounded-xl border border-border/20 bg-background/50 p-3 text-[11px] text-foreground/80 font-mono overflow-x-auto whitespace-pre-wrap">
                            {f.output_code}
                          </pre>
                        </div>
                      )}

                      {/* Actions */}
                      {f.status === "pending" && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => updateFinding(f.id, "approved")}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 text-xs hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => updateFinding(f.id, "dismissed")}
                            className="flex items-center gap-1.5 rounded-xl bg-muted/10 border border-border/20 text-muted-foreground px-4 py-2 text-xs hover:bg-foreground/5 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SelfAccessLearningView;
