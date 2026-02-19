import { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, Share2, BarChart3, HelpCircle, LineChart, X, Pin, Loader2, Play, ListChecks, Bell, FileOutput, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

const typeIcon: Record<string, React.ElementType> = {
  trend: TrendingUp, anomaly: AlertTriangle, relationship: Share2,
  correlation: BarChart3, gap: HelpCircle, forecast: LineChart,
};

const typeColor: Record<string, string> = {
  trend: "text-emerald-400", anomaly: "text-amber-400", relationship: "text-accent",
  correlation: "text-purple-400", gap: "text-muted-foreground", forecast: "text-cyan-400",
};

const severityStyles: Record<string, { badge: string; border: string }> = {
  critical: { badge: "bg-destructive/15 text-destructive", border: "border-destructive/20" },
  significant: { badge: "bg-amber-500/15 text-amber-400", border: "border-amber-500/20" },
  pattern: { badge: "bg-accent/15 text-accent", border: "border-accent/20" },
  informational: { badge: "bg-secondary/30 text-muted-foreground", border: "border-border/20" },
};

interface Insight {
  id: string;
  type: string;
  icon: string;
  title: string;
  description: string;
  dismissed: boolean;
  pinned: boolean;
  created_at: string;
}

const InsightsPanel = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  const loadInsights = async () => {
    if (!user || !activeSession) return;
    const { data: sessionDatasets } = await supabase
      .from("asha_datasets")
      .select("id")
      .eq("user_id", user.id)
      .eq("session_id", activeSession.id);
    const datasetIds = (sessionDatasets || []).map((d: any) => d.id);

    if (datasetIds.length === 0) {
      setInsights([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("asha_insights")
      .select("*")
      .eq("user_id", user.id)
      .in("dataset_id", datasetIds)
      .order("created_at", { ascending: false });
    if (data) setInsights(data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    loadInsights();
  }, [user, activeSession]);

  // Realtime subscription
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`insights-rt-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_insights' }, () => {
        loadInsights();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, user]);

  const dismiss = async (id: string) => {
    await supabase.from("asha_insights").update({ dismissed: true }).eq("id", id);
    setInsights((prev) => prev.map((i) => i.id === id ? { ...i, dismissed: true } : i));
  };

  const togglePin = async (id: string) => {
    const insight = insights.find(i => i.id === id);
    if (!insight) return;
    await supabase.from("asha_insights").update({ pinned: !insight.pinned }).eq("id", id);
    setInsights((prev) => prev.map((i) => i.id === id ? { ...i, pinned: !i.pinned } : i));
  };

  const visible = insights.filter((i) => !i.dismissed && (filter ? i.type === filter : true));
  const pinned = visible.filter(i => i.pinned);
  const unpinned = visible.filter(i => !i.pinned);

  // Determine severity based on type
  const getSeverity = (type: string) => {
    if (type === "anomaly") return "critical";
    if (type === "trend" || type === "forecast") return "significant";
    if (type === "correlation" || type === "relationship") return "pattern";
    return "informational";
  };

  // Generate action buttons based on insight type
  const getActions = (insight: Insight) => {
    const actions = [];
    if (insight.type === "anomaly" || insight.type === "trend") {
      actions.push({ label: "Generate Report", icon: FileOutput, action: "report" });
      actions.push({ label: "Set Alert", icon: Bell, action: "alert" });
    }
    if (insight.type === "correlation" || insight.type === "relationship") {
      actions.push({ label: "View in Graph", icon: Share2, action: "graph" });
      actions.push({ label: "Run Scenario", icon: Play, action: "scenario" });
    }
    if (insight.type === "forecast") {
      actions.push({ label: "Schedule Monitoring", icon: Bell, action: "monitor" });
      actions.push({ label: "Export Analysis", icon: FileOutput, action: "export" });
    }
    actions.push({ label: "Create Task", icon: ListChecks, action: "task" });
    return actions;
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Intelligence Briefing</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Asha found <span className="text-foreground">{visible.length} insights</span> across your datasets.
            Insight → Action → Execution — all in one surface.
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none">
          <option value="">All types</option>
          <option value="trend">Trends</option>
          <option value="anomaly">Anomalies</option>
          <option value="relationship">Relationships</option>
          <option value="correlation">Correlations</option>
          <option value="gap">Gaps</option>
          <option value="forecast">Forecasts</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
      ) : (
        <>
          {/* Pinned insights */}
          {pinned.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Pinned</p>
              {pinned.map(insight => renderInsight(insight))}
            </div>
          )}

          {/* Regular insights */}
          <div className="space-y-3">
            {unpinned.map(insight => renderInsight(insight))}
          </div>

          {visible.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xs text-muted-foreground/40 font-extralight">No active insights. Upload data for Asha to analyze.</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderInsight(insight: Insight) {
    const Icon = typeIcon[insight.type] || TrendingUp;
    const severity = getSeverity(insight.type);
    const styles = severityStyles[severity];
    const actions = getActions(insight);
    const isExpanded = expandedInsight === insight.id;

    return (
      <div key={insight.id} className={`rounded-xl border backdrop-blur-sm group ${styles.border} bg-card/20`}>
        <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}>
          <div className={`mt-0.5 ${typeColor[insight.type] || "text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded ${styles.badge}`}>{severity}</span>
              <span className="text-sm">{insight.icon}</span>
              <h3 className="text-sm font-light text-foreground">{insight.title}</h3>
            </div>
            <p className="text-xs font-extralight text-muted-foreground mt-1.5 leading-relaxed">{insight.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); togglePin(insight.id); }} className={`p-1 transition-colors ${insight.pinned ? "text-accent" : "text-muted-foreground/30 hover:text-accent opacity-0 group-hover:opacity-100"}`}>
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); dismiss(insight.id); }} className="p-1 text-muted-foreground/30 hover:text-foreground transition-all opacity-0 group-hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>

        {/* Expanded: Action Buttons */}
        {isExpanded && (
          <div className="border-t border-border/15 px-4 py-3">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2">Actions</p>
            <div className="flex flex-wrap gap-2">
              {actions.map(action => (
                <button key={action.action} className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/30 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/5 transition-colors">
                  <action.icon className="h-3 w-3 text-accent" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default InsightsPanel;
