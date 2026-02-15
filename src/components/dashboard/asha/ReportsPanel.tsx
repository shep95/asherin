import { useState, useEffect } from "react";
import { FileText, Download, Clock, Play, Plus, Trash2, BarChart3, Shield, GitCompare, Sparkles, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

type ReportType = "executive" | "audit" | "analysis" | "comparison";

interface Report {
  id: string;
  name: string;
  type: ReportType;
  status: string;
  pages: number | null;
  content: string | null;
  schedule: string | null;
  created_at: string;
}

const typeIcons: Record<ReportType, React.ElementType> = { executive: BarChart3, audit: Shield, analysis: Sparkles, comparison: GitCompare };
const typeLabels: Record<ReportType, string> = { executive: "Executive Summary", audit: "Data Audit", analysis: "Analysis Report", comparison: "Comparison Report" };
const statusColors: Record<string, string> = { draft: "text-muted-foreground bg-secondary/30", generating: "text-amber-400 bg-amber-500/10", ready: "text-emerald-400 bg-emerald-500/10", scheduled: "text-accent bg-accent/10" };

const ReportsPanel = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<ReportType>("executive");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewingReport, setViewingReport] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("asha_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) setReports(data as any);
      setLoading(false);
    };
    load();
  }, [user]);

  const createReport = async () => {
    if (!newName.trim() || !user) return;
    const { data, error } = await supabase.from("asha_reports").insert({
      user_id: user.id, name: newName, type: newType, status: "generating",
    }).select().single();

    if (!data) return;
    setReports((prev) => [data as any, ...prev]);
    setShowCreate(false);
    setNewName("");

    // Trigger AI report generation
    const { data: session } = await supabase.auth.getSession();
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ reportId: data.id }),
    }).then(async (res) => {
      if (res.ok) {
        // Reload the report
        const { data: updated } = await supabase.from("asha_reports").select("*").eq("id", data.id).single();
        if (updated) setReports((prev) => prev.map((r) => r.id === data.id ? updated as any : r));
      } else {
        setReports((prev) => prev.map((r) => r.id === data.id ? { ...r, status: "draft" } : r));
      }
    });
  };

  const deleteReport = async (id: string) => {
    await supabase.from("asha_reports").delete().eq("id", id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  // Viewing a specific report
  if (viewingReport) {
    const report = reports.find((r) => r.id === viewingReport);
    if (report) {
      return (
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <button onClick={() => setViewingReport(null)} className="text-xs text-accent hover:underline">← Back to reports</button>
          <h2 className="text-lg font-extralight text-foreground">{report.name}</h2>
          <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-6 prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{report.content || "No content generated yet."}</ReactMarkdown>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Reports</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">AI-generated intelligence reports from your data</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
          <Plus className="h-3.5 w-3.5" />New Report
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Report title…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(typeLabels) as ReportType[]).map((type) => {
              const Icon = typeIcons[type];
              return (
                <button key={type} onClick={() => setNewType(type)} className={`rounded-lg border p-3 text-left transition-colors ${newType === type ? "border-accent/30 bg-accent/5" : "border-border/20 bg-card/30 hover:bg-foreground/5"}`}>
                  <Icon className="h-4 w-4 text-muted-foreground mb-1" />
                  <p className="text-[11px] font-light text-foreground">{typeLabels[type]}</p>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={createReport} className="rounded-lg bg-foreground/10 px-4 py-2 text-xs text-foreground hover:bg-foreground/15 transition-colors flex items-center gap-1.5"><Play className="h-3 w-3" />Generate</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {reports.map((report) => {
          const Icon = typeIcons[report.type as ReportType] || FileText;
          return (
            <div key={report.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-light text-foreground truncate">{report.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] ${statusColors[report.status] || ""}`}>
                      {report.status === "generating" ? "Generating…" : report.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
                    <span>{typeLabels[report.type as ReportType] || report.type}</span>
                    {report.pages && <span>{report.pages} pages</span>}
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {report.status === "ready" && (
                    <button onClick={() => setViewingReport(report.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="View"><Eye className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => deleteReport(report.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}

        {reports.length === 0 && (
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
