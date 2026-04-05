import { useState, useEffect, useCallback } from "react";
import { Brain, Globe, Loader2, Trash2, Clock, Zap, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AxrlenAnalysis from "./AxrlenAnalysis";
import AxrlenNewScan from "./AxrlenNewScan";

export interface AxrlenSession {
  id: string;
  title: string;
  region: string | null;
  predictionType: string;
  status: string;
  predictions: any;
  resourceAnalysis: any;
  threatAssessment: any;
  policySimulations: any;
  timelineDivergences: any;
  dataSources: any;
  confidenceScore: number | null;
  aiSummary: string | null;
  createdAt: Date;
}

const AxrlenView = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AxrlenSession[]>([]);
  const [activeSession, setActiveSession] = useState<AxrlenSession | null>(null);
  const [view, setView] = useState<"sessions" | "new" | "analysis">("sessions");
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("axrlen_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSessions((data || []).map((s: any) => ({
        id: s.id, title: s.title, region: s.region,
        predictionType: s.prediction_type, status: s.status,
        predictions: s.predictions, resourceAnalysis: s.resource_analysis,
        threatAssessment: s.threat_assessment, policySimulations: s.policy_simulations,
        timelineDivergences: s.timeline_divergences, dataSources: s.data_sources,
        confidenceScore: s.confidence_score, aiSummary: s.ai_summary,
        createdAt: new Date(s.created_at),
      })));
    } catch (err) {
      console.error("Failed to load Axrlen sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const deleteSession = async (id: string) => {
    try {
      await supabase.from("axrlen_sessions").delete().eq("id", id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession?.id === id) { setActiveSession(null); setView("sessions"); }
      toast({ title: "Session deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleScanComplete = (session: AxrlenSession) => {
    setSessions(prev => [session, ...prev]);
    setActiveSession(session);
    setView("analysis");
  };

  const severityColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-500/60";
      case "elevated": return "bg-amber-500/60";
      case "guarded": return "bg-yellow-400/60";
      default: return "bg-emerald-400/60";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-6 py-4 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center">
            <Brain className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">AXRLEN</h1>
            <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">Predictive Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("sessions")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${view === "sessions" ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
            <Clock className="h-3 w-3" /> Sessions
          </button>
          <button onClick={() => setView("new")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${view === "new" ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
            <Plus className="h-3 w-3" /> New Scan
          </button>
          {activeSession && (
            <button onClick={() => setView("analysis")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${view === "analysis" ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
              <Zap className="h-3 w-3" /> Analysis
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "sessions" && (
          <div className="p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Prediction Sessions</h2>
              <button onClick={() => setView("new")}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/[0.1] bg-foreground/[0.04] text-[10px] text-foreground/60 hover:bg-foreground/[0.08] transition-all">
                <Plus className="h-3 w-3" /> New Scan
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-foreground/[0.03] border border-border/[0.08] flex items-center justify-center">
                  <Globe className="h-7 w-7 text-muted-foreground/20" />
                </div>
                <p className="text-sm font-light text-foreground/50">No prediction sessions yet</p>
                <p className="text-[10px] text-muted-foreground/30">Start a new global scan to generate predictions</p>
                <button onClick={() => setView("new")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/[0.06] border border-border/[0.1] text-[11px] text-foreground/60 hover:bg-foreground/[0.1] transition-all">
                  <Zap className="h-3.5 w-3.5" /> Launch Scan
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all group">
                    <button onClick={() => { setActiveSession(s); setView("analysis"); }} className="flex items-center gap-3 flex-1 text-left">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === "complete" ? severityColor(s.threatAssessment?.overallThreatLevel || "low") : s.status === "processing" ? "bg-yellow-400/60 animate-pulse" : "bg-red-400/60"}`} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-light text-foreground/70 truncate">{s.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[8px] text-muted-foreground/30">{s.createdAt.toLocaleDateString()}</span>
                          {s.region && <span className="text-[8px] text-muted-foreground/40">{s.region}</span>}
                          {s.confidenceScore != null && <span className="text-[8px] text-foreground/40">{s.confidenceScore}% confidence</span>}
                          {s.predictions && <span className="text-[8px] text-foreground/40">{Array.isArray(s.predictions) ? s.predictions.length : 0} predictions</span>}
                        </div>
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="p-2 rounded-lg hover:bg-foreground/[0.06] opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="h-3 w-3 text-muted-foreground/30 hover:text-red-400/60" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {view === "new" && <AxrlenNewScan onComplete={handleScanComplete} />}
        {view === "analysis" && activeSession && <AxrlenAnalysis session={activeSession} />}
      </div>
    </div>
  );
};

export default AxrlenView;
