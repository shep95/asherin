import { useState } from "react";
import { FileText, Download, Mail, Clock, Calendar, Play, Plus, Trash2, Edit3, BarChart3, Shield, AlertTriangle, GitCompare, Sparkles } from "lucide-react";

type ReportType = "executive" | "audit" | "analysis" | "comparison";
type ReportStatus = "draft" | "generating" | "ready" | "scheduled";

interface Report {
  id: string;
  name: string;
  type: ReportType;
  status: ReportStatus;
  createdAt: Date;
  scheduledFor?: string;
  pages?: number;
}

const MOCK_REPORTS: Report[] = [
  { id: "1", name: "Q4 Executive Summary", type: "executive", status: "ready", createdAt: new Date(Date.now() - 86400000), pages: 12 },
  { id: "2", name: "Data Quality Audit — March", type: "audit", status: "ready", createdAt: new Date(Date.now() - 86400000 * 3), pages: 8 },
  { id: "3", name: "Customer Segmentation Analysis", type: "analysis", status: "generating", createdAt: new Date() },
  { id: "4", name: "YoY Revenue Comparison", type: "comparison", status: "scheduled", createdAt: new Date(Date.now() - 86400000 * 7), scheduledFor: "Every Monday 9:00 AM" },
  { id: "5", name: "Anomaly Investigation Report", type: "analysis", status: "ready", createdAt: new Date(Date.now() - 86400000 * 2), pages: 5 },
];

const typeIcons: Record<ReportType, React.ElementType> = {
  executive: BarChart3,
  audit: Shield,
  analysis: Sparkles,
  comparison: GitCompare,
};

const typeLabels: Record<ReportType, string> = {
  executive: "Executive Summary",
  audit: "Data Audit",
  analysis: "Analysis Report",
  comparison: "Comparison Report",
};

const statusColors: Record<ReportStatus, string> = {
  draft: "text-muted-foreground bg-secondary/30",
  generating: "text-amber-400 bg-amber-500/10",
  ready: "text-emerald-400 bg-emerald-500/10",
  scheduled: "text-accent bg-accent/10",
};

const ReportsPanel = () => {
  const [reports, setReports] = useState(MOCK_REPORTS);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<ReportType>("executive");
  const [newName, setNewName] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  const createReport = () => {
    if (!newName.trim()) return;
    const report: Report = {
      id: crypto.randomUUID(),
      name: newName,
      type: newType,
      status: "generating",
      createdAt: new Date(),
    };
    setReports((prev) => [report, ...prev]);
    setShowCreate(false);
    setNewName("");

    // Simulate generation
    setTimeout(() => {
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: "ready" as ReportStatus, pages: Math.floor(Math.random() * 15) + 4 } : r));
    }, 4000);
  };

  const deleteReport = (id: string) => setReports((prev) => prev.filter((r) => r.id !== id));

  const filtered = filterType ? reports.filter((r) => r.type === filterType) : reports;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Reports</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Auto-generated intelligence reports from your data</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          New Report
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
          <h3 className="text-xs font-light text-foreground">Generate New Report</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Report title…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1.5">Report type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(typeLabels) as ReportType[]).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => setNewType(type)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      newType === type ? "border-accent/30 bg-accent/5" : "border-border/20 bg-card/30 hover:bg-foreground/5"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground mb-1" />
                    <p className="text-[11px] font-light text-foreground">{typeLabels[type]}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                      {type === "executive" && "Key metrics, charts, AI narrative"}
                      {type === "audit" && "Data quality, schema, anomalies"}
                      {type === "analysis" && "Selected insights with methodology"}
                      {type === "comparison" && "Period-over-period benchmarks"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground block mb-1.5">Schedule (optional)</label>
            <select className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none w-full">
              <option value="">One-time generation</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Monday 9 AM)</option>
              <option value="monthly">Monthly (1st of month)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={createReport} className="rounded-lg bg-foreground/10 px-4 py-2 text-xs text-foreground hover:bg-foreground/15 transition-colors flex items-center gap-1.5">
              <Play className="h-3 w-3" />Generate
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none">
          <option value="">All types</option>
          {(Object.keys(typeLabels) as ReportType[]).map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
        </select>
        <span className="text-[10px] text-muted-foreground/40 ml-auto">{filtered.length} reports</span>
      </div>

      {/* Report list */}
      <div className="space-y-2">
        {filtered.map((report) => {
          const Icon = typeIcons[report.type];
          return (
            <div key={report.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-light text-foreground truncate">{report.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] ${statusColors[report.status]}`}>
                      {report.status === "generating" ? "Generating…" : report.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
                    <span>{typeLabels[report.type]}</span>
                    {report.pages && <span>{report.pages} pages</span>}
                    <span>{report.createdAt.toLocaleDateString()}</span>
                    {report.scheduledFor && (
                      <span className="flex items-center gap-0.5 text-accent"><Clock className="h-2.5 w-2.5" />{report.scheduledFor}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {report.status === "ready" && (
                    <>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Download PDF">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Email report">
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button onClick={() => deleteReport(report.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/40 font-extralight">No reports yet. Generate your first intelligence report.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPanel;
