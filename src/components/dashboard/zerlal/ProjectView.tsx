import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, X, ExternalLink, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useZerlalFindings, useZerlalProjects, useZerlalScans } from "./useZerlalData";
import type { FindingSeverity, FindingStatus } from "./types";

interface ProjectViewProps {
  projectId: string | null;
  onSelectFinding: (id: string) => void;
  onBack: () => void;
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const severityBadge: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  info: "bg-muted/40 text-muted-foreground/60 border-border/20",
};
const statusBadge: Record<string, string> = {
  open: "bg-red-500/10 text-red-400",
  "in-progress": "bg-yellow-500/10 text-yellow-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  waived: "bg-muted/30 text-muted-foreground/50",
};

const ProjectView = ({ projectId, onSelectFinding, onBack }: ProjectViewProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"findings" | "history" | "sbom">("findings");

  const { projects } = useZerlalProjects();
  const { findings, loading: fLoading } = useZerlalFindings(projectId);
  const { scans, loading: sLoading } = useZerlalScans(projectId);

  const project = projects.find(p => p.id === projectId);

  const filtered = useMemo(() => {
    let f = [...findings];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(fi => fi.title.toLowerCase().includes(q) || (fi.file_path || "").toLowerCase().includes(q));
    }
    if (severityFilter.length > 0) f = f.filter(fi => severityFilter.includes(fi.severity));
    if (statusFilter.length > 0) f = f.filter(fi => statusFilter.includes(fi.status));
    return f.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
  }, [findings, searchQuery, severityFilter, statusFilter]);

  const gradeColor = !project ? "text-muted-foreground/30" :
    project.risk_grade === "A" ? "text-emerald-400" : project.risk_grade === "B" ? "text-blue-400" :
    project.risk_grade === "C" ? "text-yellow-400" : project.risk_grade === "D" ? "text-orange-400" : "text-red-400";

  if (fLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/20" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 max-w-[1200px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[10px] text-muted-foreground/30 hover:text-foreground/50">← Back</button>
          {project && (
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-light tracking-wide text-foreground/80">{project.name}</h2>
                <span className={`text-lg font-extralight ${gradeColor}`}>{project.risk_grade}</span>
              </div>
              <div className="flex items-center gap-4 mt-0.5">
                <span className="text-[9px] text-muted-foreground/30 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> Last scan: {project.last_scan_at ? new Date(project.last_scan_at).toLocaleDateString() : "Never"}
                </span>
                <span className="text-[9px] text-muted-foreground/30">{project.language} • {project.source_type}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border/[0.06]">
          {(["findings", "history", "sbom"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] tracking-wider uppercase border-b-2 transition-all ${
                activeTab === tab ? "border-foreground/30 text-foreground/70" : "border-transparent text-muted-foreground/30 hover:text-foreground/50"
              }`}
            >
              {tab === "findings" ? `Findings (${filtered.length})` : tab === "history" ? `Scan History (${scans.length})` : "SBOM"}
            </button>
          ))}
        </div>

        {activeTab === "findings" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/25" />
                <input type="text" placeholder="Search title or file..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-foreground/[0.03] border border-border/[0.06] text-[10px] text-foreground/70 placeholder:text-muted-foreground/20 focus:outline-none focus:border-foreground/10" />
              </div>
              <div className="flex gap-1">
                {["critical", "high", "medium", "low", "info"].map(s => (
                  <button key={s} onClick={() => setSeverityFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`px-2 py-1 rounded-md text-[9px] uppercase tracking-wider border transition-all ${
                      severityFilter.includes(s) ? severityBadge[s] : "border-border/[0.06] text-muted-foreground/25"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              {(severityFilter.length > 0 || statusFilter.length > 0) && (
                <button onClick={() => { setSeverityFilter([]); setStatusFilter([]); }} className="text-[9px] text-muted-foreground/30 flex items-center gap-0.5">
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>

            {/* Findings - ALL shown, no limit */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_180px_80px_50px_50px_70px_70px] gap-2 px-4 py-2 border-b border-border/[0.06] text-[9px] text-muted-foreground/30 uppercase tracking-wider">
                <span>Severity</span><span>Title</span><span>File & Line</span><span>Category</span><span>Conf.</span><span>Age</span><span>CVSS</span><span>Status</span>
              </div>

              {filtered.map(f => (
                <div key={f.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    className="w-full grid grid-cols-[80px_1fr_180px_80px_50px_50px_70px_70px] gap-2 px-4 py-2 hover:bg-foreground/[0.02] transition-colors text-left items-center border-b border-border/[0.03]"
                  >
                    <span className={`text-[9px] px-2 py-0.5 rounded-md border text-center ${severityBadge[f.severity] || severityBadge.info}`}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-foreground/60 truncate flex items-center gap-1">
                      {expandedId === f.id ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
                      {f.title}
                    </span>
                    <span className="text-[9px] text-muted-foreground/30 truncate font-mono">{f.file_path}:{f.line_number}</span>
                    <span className="text-[9px] text-muted-foreground/40">{f.category}</span>
                    <span className="text-[9px] text-muted-foreground/40">{f.confidence}%</span>
                    <span className="text-[9px] text-muted-foreground/30">{f.age_days}d</span>
                    <span className="text-[9px] text-muted-foreground/40">{f.cvss_score}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded text-center ${statusBadge[f.status] || ""}`}>{f.status}</span>
                  </button>

                  {expandedId === f.id && (
                    <div className="px-6 py-4 bg-foreground/[0.01] border-b border-border/[0.06] space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1">What's happening</h4>
                        <p className="text-[11px] text-foreground/60 leading-relaxed">{f.description}</p>
                      </div>
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5 text-red-400/50" /> What an attacker would do
                        </h4>
                        <p className="text-[11px] text-foreground/50 leading-relaxed">{f.impact}</p>
                      </div>

                      {/* Exploitation Steps */}
                      {f.exploitation_steps && f.exploitation_steps.length > 0 && (
                        <div>
                          <h4 className="text-[9px] text-red-400/50 uppercase tracking-wider mb-1">Step-by-Step Exploitation</h4>
                          <ol className="space-y-1">
                            {f.exploitation_steps.map((step, i) => (
                              <li key={i} className="text-[10px] text-foreground/50 flex gap-2">
                                <span className="text-red-400/40 font-mono shrink-0">{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {f.code_snippet && (
                        <div>
                          <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1">Vulnerable Code</h4>
                          <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-3 border border-red-500/10 text-red-300/70 overflow-x-auto whitespace-pre-wrap leading-5">{f.code_snippet}</pre>
                        </div>
                      )}
                      {f.suggested_fix && (
                        <div>
                          <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5 text-emerald-400/50" /> Suggested Fix
                          </h4>
                          <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-3 border border-emerald-500/10 text-emerald-300/70 overflow-x-auto whitespace-pre-wrap leading-5">{f.suggested_fix}</pre>
                        </div>
                      )}

                      {/* Compliance */}
                      {f.compliance_controls && f.compliance_controls.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {f.compliance_controls.map(c => (
                            <span key={c} className="text-[8px] px-1.5 py-0.5 rounded bg-foreground/[0.03] border border-border/[0.06] text-muted-foreground/40">{c}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-border/[0.04]">
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.06] text-[9px] text-foreground/60 hover:bg-foreground/[0.1]">Create PR with fix</button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40">Assign</button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40">False positive</button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40">Waive</button>
                        <button onClick={() => onSelectFinding(f.id)} className="ml-auto px-3 py-1.5 rounded-lg text-[9px] text-muted-foreground/30 hover:text-foreground/50 flex items-center gap-1">
                          Full detail <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle className="h-6 w-6 text-emerald-400/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground/30">{findings.length === 0 ? "No vulnerabilities found yet. Run a scan." : "No findings match your filters"}</p>
                </div>
              )}
            </div>

            {/* Count indicator */}
            {filtered.length > 0 && (
              <div className="text-[9px] text-muted-foreground/25 text-center">
                Showing all {filtered.length} findings — no limit applied
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_80px_80px_80px_80px_100px] gap-2 px-4 py-2 border-b border-border/[0.06] text-[9px] text-muted-foreground/30 uppercase tracking-wider">
              <span>Profile</span><span>Status</span><span>Findings</span><span>Critical</span><span>High</span><span>Duration</span><span>Date</span>
            </div>
            {scans.map(s => (
              <div key={s.id} className="grid grid-cols-[1fr_120px_80px_80px_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-border/[0.03] text-[10px]">
                <span className="text-foreground/60">{s.scan_profile}</span>
                <span className={s.status === "complete" ? "text-emerald-400" : s.status === "running" ? "text-yellow-400" : "text-red-400"}>{s.status}</span>
                <span className="text-foreground/50">{s.findings_count}</span>
                <span className="text-red-400">{s.critical_count}</span>
                <span className="text-orange-400">{s.high_count}</span>
                <span className="text-muted-foreground/40">{s.duration ? `${s.duration}s` : "—"}</span>
                <span className="text-muted-foreground/30">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {scans.length === 0 && (
              <div className="py-8 text-center text-[10px] text-muted-foreground/25">No scan history</div>
            )}
          </div>
        )}

        {activeTab === "sbom" && (
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-12 text-center">
            <p className="text-[11px] text-muted-foreground/30">SBOM data will be generated during compliance scans</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectView;
