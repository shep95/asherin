import { useState, useEffect, useCallback } from "react";
import { Database, Upload, BarChart3, Clock, Trash2, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ZeeionUpload from "./ZeeionUpload";
import ZeeionDashboard from "./ZeeionDashboard";
import ZeeionGovData from "./ZeeionGovData";

export interface AnalysisResult {
  id: string;
  fileName: string;
  uploadedAt: Date;
  status: "processing" | "complete" | "error";
  summary?: {
    totalRecords: number;
    totalSpending: number;
    potentialSavings: number;
    efficiencyScore: number;
    anomalyCount: number;
    wastefulSpending: number;
    departmentCount: number;
  };
  executiveSummary?: string;
  wastefulItems?: { description: string; annualCost: number; recommendation: string; severity: string }[];
  savingsOpportunities?: { category: string; description: string; currentCost: number; projectedSavings: number; confidence: number }[];
  departmentPerformance?: { department: string; totalSpending: number; budget: number; variance: number; efficiencyScore: number }[];
  anomalies?: { type: string; severity: string; description: string; recommendation: string }[];
  categoryBreakdown?: { category: string; amount: number; percentage: number }[];
}

const ZeeionView = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AnalysisResult[]>([]);
  const [activeSession, setActiveSession] = useState<AnalysisResult | null>(null);
  const [view, setView] = useState<"sessions" | "upload" | "dashboard" | "gov_data">("sessions");
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("zeeion_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: AnalysisResult[] = (data || []).map((s: any) => ({
        id: s.id,
        fileName: s.file_name,
        uploadedAt: new Date(s.created_at),
        status: s.status as AnalysisResult["status"],
        summary: s.summary as any,
        executiveSummary: s.executive_summary,
        wastefulItems: s.wasteful_items as any,
        savingsOpportunities: s.savings_opportunities as any,
        departmentPerformance: s.department_performance as any,
        anomalies: s.anomalies as any,
        categoryBreakdown: s.category_breakdown as any,
      }));

      setSessions(mapped);
    } catch (err) {
      console.error("Failed to load Zeeion sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleAnalysisComplete = async (result: AnalysisResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("zeeion_sessions")
        .insert({
          user_id: user.id,
          file_name: result.fileName,
          file_type: result.fileName.split(".").pop()?.toLowerCase() || "csv",
          status: "complete",
          summary: result.summary as any,
          executive_summary: result.executiveSummary || null,
          wasteful_items: result.wastefulItems as any || null,
          savings_opportunities: result.savingsOpportunities as any || null,
          department_performance: result.departmentPerformance as any || null,
          anomalies: result.anomalies as any || null,
          category_breakdown: result.categoryBreakdown as any || null,
        })
        .select()
        .single();

      if (error) throw error;

      const saved: AnalysisResult = { ...result, id: data.id };
      setSessions(prev => [saved, ...prev]);
      setActiveSession(saved);
      setView("dashboard");
    } catch (err: any) {
      console.error("Failed to save session:", err);
      toast({ title: "Session save failed", description: err.message, variant: "destructive" });
      setSessions(prev => [result, ...prev]);
      setActiveSession(result);
      setView("dashboard");
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await supabase.from("zeeion_sessions").delete().eq("id", id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) {
        setActiveSession(null);
        setView("sessions");
      }
      toast({ title: "Session deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const openSession = (s: AnalysisResult) => {
    setActiveSession(s);
    setView("dashboard");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-6 py-4 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center">
            <Database className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">ZEEION</h1>
            <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">Financial Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("sessions")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
              view === "sessions"
                ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            <Clock className="h-3 w-3" />
            Sessions
          </button>
          <button
            onClick={() => setView("upload")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
              view === "upload"
                ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            <Upload className="h-3 w-3" />
            New Analysis
          </button>
          {activeSession && (
            <button
              onClick={() => setView("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
                view === "dashboard"
                  ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                  : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </button>
          )}
          <button
            onClick={() => setView("gov_data")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
              view === "gov_data"
                ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            <Globe className="h-3 w-3" />
            Gov Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "sessions" && (
          <div className="p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Analysis Sessions</h2>
              <button
                onClick={() => setView("upload")}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/[0.1] bg-foreground/[0.04] text-[10px] text-foreground/60 hover:bg-foreground/[0.08] transition-all"
              >
                <Upload className="h-3 w-3" />
                New Analysis
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-foreground/[0.03] border border-border/[0.08] flex items-center justify-center">
                  <Database className="h-7 w-7 text-muted-foreground/20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-light text-foreground/50">No analysis sessions yet</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Upload financial data to get started</p>
                </div>
                <button
                  onClick={() => setView("upload")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/[0.06] border border-border/[0.1] text-[11px] text-foreground/60 hover:bg-foreground/[0.1] transition-all"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Data
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all group"
                  >
                    <button
                      onClick={() => openSession(s)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        s.status === "complete" ? "bg-emerald-400/60" : s.status === "processing" ? "bg-yellow-400/60 animate-pulse" : "bg-red-400/60"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-light text-foreground/70 truncate">{s.fileName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[8px] text-muted-foreground/30">{s.uploadedAt.toLocaleDateString()}</span>
                          {s.summary && (
                            <>
                              <span className="text-[8px] text-muted-foreground/30">{s.summary.totalRecords.toLocaleString()} records</span>
                              <span className="text-[8px] text-emerald-400/50">${s.summary.potentialSavings.toLocaleString()} savings</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="p-2 rounded-lg hover:bg-foreground/[0.06] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground/30 hover:text-red-400/60" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "upload" && (
          <ZeeionUpload onAnalysisComplete={handleAnalysisComplete} />
        )}

        {view === "dashboard" && activeSession && (
          <ZeeionDashboard analysis={activeSession} />
        )}

        {view === "gov_data" && (
          <div className="p-6">
            <ZeeionGovData />
          </div>
        )}
      </div>
    </div>
  );

export default ZeeionView;
