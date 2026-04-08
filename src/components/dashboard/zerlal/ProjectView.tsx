import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Filter, GitBranch, Clock, User, X, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import { mockFindings, mockProjects } from "./mockData";
import type { FindingSeverity, FindingCategory, FindingStatus, ZerlalFinding } from "./types";

interface ProjectViewProps {
  projectId: string | null;
  onSelectFinding: (id: string) => void;
  onBack: () => void;
}

const severityOrder: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const severityBadge: Record<FindingSeverity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  info: "bg-muted/40 text-muted-foreground/60 border-border/20",
};
const statusBadge: Record<FindingStatus, string> = {
  open: "bg-red-500/10 text-red-400",
  "in-progress": "bg-yellow-500/10 text-yellow-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  waived: "bg-muted/30 text-muted-foreground/50",
};

const ProjectView = ({ projectId, onSelectFinding, onBack }: ProjectViewProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity[]>([]);
  const [statusFilter, setStatusFilter] = useState<FindingStatus[]>([]);
  const [activeTab, setActiveTab] = useState<"findings" | "deps" | "history" | "settings">("findings");

  const project = mockProjects.find((p) => p.id === projectId) || mockProjects[0];
  const findings = useMemo(() => {
    let f = mockFindings.filter((fi) => !projectId || fi.projectId === projectId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter((fi) => fi.title.toLowerCase().includes(q) || fi.file.toLowerCase().includes(q));
    }
    if (severityFilter.length > 0) f = f.filter((fi) => severityFilter.includes(fi.severity));
    if (statusFilter.length > 0) f = f.filter((fi) => statusFilter.includes(fi.status));
    return f.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [projectId, searchQuery, severityFilter, statusFilter]);

  const toggleSeverity = (s: FindingSeverity) => {
    setSeverityFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleStatus = (s: FindingStatus) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const gradeColor = project.riskGrade === "A" ? "text-emerald-400" : project.riskGrade === "B" ? "text-blue-400" : project.riskGrade === "C" ? "text-yellow-400" : project.riskGrade === "D" ? "text-orange-400" : "text-red-400";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-[1200px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[10px] text-muted-foreground/30 hover:text-foreground/50">← Back</button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-light tracking-wide text-foreground/80">{project.name}</h2>
              <span className={`text-lg font-extralight ${gradeColor}`}>{project.riskGrade}</span>
            </div>
            <div className="flex items-center gap-4 mt-0.5">
              <span className="text-[9px] text-muted-foreground/30 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> Last scan: {project.lastScanAt ? new Date(project.lastScanAt).toLocaleDateString() : "Never"}
              </span>
              {project.scanDuration && (
                <span className="text-[9px] text-muted-foreground/30">Duration: {Math.floor(project.scanDuration / 60)}m {project.scanDuration % 60}s</span>
              )}
              <span className="text-[9px] text-muted-foreground/30">{project.language}</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-0 border-b border-border/[0.06]">
          {(["findings", "deps", "history", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] tracking-wider uppercase transition-all border-b-2 ${
                activeTab === tab
                  ? "border-foreground/30 text-foreground/70"
                  : "border-transparent text-muted-foreground/30 hover:text-foreground/50"
              }`}
            >
              {tab === "deps" ? "Dependency Graph" : tab === "findings" ? `Findings (${findings.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "findings" && (
          <>
            {/* Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/25" />
                <input
                  type="text"
                  placeholder="Search title or file path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-foreground/[0.03] border border-border/[0.06] text-[10px] text-foreground/70 placeholder:text-muted-foreground/20 focus:outline-none focus:border-foreground/10"
                />
              </div>
              {/* Severity Filters */}
              <div className="flex gap-1">
                {(["critical", "high", "medium", "low", "info"] as FindingSeverity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSeverity(s)}
                    className={`px-2 py-1 rounded-md text-[9px] uppercase tracking-wider border transition-all ${
                      severityFilter.includes(s) ? severityBadge[s] : "border-border/[0.06] text-muted-foreground/25 hover:text-muted-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* Status Filters */}
              <div className="flex gap-1">
                {(["open", "in-progress", "resolved", "waived"] as FindingStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`px-2 py-1 rounded-md text-[9px] tracking-wider border transition-all ${
                      statusFilter.includes(s) ? statusBadge[s] + " border-current/20" : "border-border/[0.06] text-muted-foreground/25 hover:text-muted-foreground/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {(severityFilter.length > 0 || statusFilter.length > 0) && (
                <button onClick={() => { setSeverityFilter([]); setStatusFilter([]); }} className="text-[9px] text-muted-foreground/30 hover:text-foreground/50 flex items-center gap-0.5">
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>

            {/* Findings Table */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[80px_1fr_200px_100px_60px_60px_80px_80px] gap-2 px-4 py-2 border-b border-border/[0.06] text-[9px] text-muted-foreground/30 uppercase tracking-wider">
                <span>Severity</span>
                <span>Title</span>
                <span>File & Line</span>
                <span>Category</span>
                <span>Conf.</span>
                <span>Age</span>
                <span>Assignee</span>
                <span>Status</span>
              </div>

              {/* Rows */}
              {findings.map((f) => (
                <div key={f.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                    className="w-full grid grid-cols-[80px_1fr_200px_100px_60px_60px_80px_80px] gap-2 px-4 py-2.5 hover:bg-foreground/[0.02] transition-colors text-left items-center border-b border-border/[0.03]"
                  >
                    <span className={`text-[9px] px-2 py-0.5 rounded-md border text-center ${severityBadge[f.severity]}`}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-foreground/60 truncate flex items-center gap-1">
                      {expandedId === f.id ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
                      {f.title}
                    </span>
                    <span className="text-[9px] text-muted-foreground/30 truncate font-mono">{f.file}:{f.line}</span>
                    <span className="text-[9px] text-muted-foreground/40">{f.category}</span>
                    <span className="text-[9px] text-muted-foreground/40">{f.confidence}%</span>
                    <span className="text-[9px] text-muted-foreground/30">{f.age}d</span>
                    <span className="text-[9px] text-muted-foreground/30 truncate">{f.assignee || "—"}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded text-center ${statusBadge[f.status]}`}>
                      {f.status}
                    </span>
                  </button>

                  {/* Expanded Detail */}
                  {expandedId === f.id && (
                    <div className="px-6 py-4 bg-foreground/[0.01] border-b border-border/[0.06] space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {/* Description */}
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1">What's happening</h4>
                        <p className="text-[11px] text-foreground/60 leading-relaxed">{f.description}</p>
                      </div>

                      {/* Impact */}
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5 text-red-400/50" /> What an attacker would do
                        </h4>
                        <p className="text-[11px] text-foreground/50 leading-relaxed">{f.impact}</p>
                      </div>

                      {/* Vulnerable Code */}
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1">Vulnerable Code</h4>
                        <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-3 border border-red-500/10 text-red-300/70 overflow-x-auto whitespace-pre-wrap leading-5">
                          {f.codeSnippet}
                        </pre>
                      </div>

                      {/* Suggested Fix */}
                      <div>
                        <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-400/50" /> Suggested Fix
                        </h4>
                        <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-3 border border-emerald-500/10 text-emerald-300/70 overflow-x-auto whitespace-pre-wrap leading-5">
                          {f.suggestedFix}
                        </pre>
                      </div>

                      {/* Dataflow */}
                      {f.dataflowTrace.length > 0 && (
                        <div>
                          <h4 className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">Dataflow Trace</h4>
                          <div className="space-y-1">
                            {f.dataflowTrace.map((step, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                                  i === f.dataflowTrace.length - 1 ? "bg-red-500/20 text-red-400" : "bg-foreground/[0.04] text-muted-foreground/40"
                                }`}>
                                  {i + 1}
                                </div>
                                {i < f.dataflowTrace.length - 1 && (
                                  <div className="absolute ml-2 mt-6 w-px h-3 bg-border/10" />
                                )}
                                <span className="text-[9px] font-mono text-muted-foreground/30">{step.file}:{step.line}</span>
                                <span className="text-[9px] text-muted-foreground/40">→ {step.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/[0.04]">
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.06] text-[9px] text-foreground/60 hover:bg-foreground/[0.1] transition-colors">
                          Create PR with fix
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                          Assign
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                          Mark false positive
                        </button>
                        <button className="px-3 py-1.5 rounded-lg bg-foreground/[0.03] text-[9px] text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                          Waive
                        </button>
                        <button
                          onClick={() => onSelectFinding(f.id)}
                          className="ml-auto px-3 py-1.5 rounded-lg text-[9px] text-muted-foreground/30 hover:text-foreground/50 transition-colors flex items-center gap-1"
                        >
                          Full detail <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {findings.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle className="h-6 w-6 text-emerald-400/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground/30">No findings match your filters</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab !== "findings" && (
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-12 text-center">
            <p className="text-[11px] text-muted-foreground/30">{activeTab === "deps" ? "Dependency Graph" : activeTab === "history" ? "Scan History" : "Project Settings"} — Coming Soon</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectView;
