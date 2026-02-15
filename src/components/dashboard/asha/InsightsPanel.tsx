import { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, Share2, BarChart3, HelpCircle, LineChart, X, Pin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const typeIcon: Record<string, React.ElementType> = {
  trend: TrendingUp, anomaly: AlertTriangle, relationship: Share2,
  correlation: BarChart3, gap: HelpCircle, forecast: LineChart,
};

const typeColor: Record<string, string> = {
  trend: "text-emerald-400", anomaly: "text-amber-400", relationship: "text-accent",
  correlation: "text-purple-400", gap: "text-muted-foreground", forecast: "text-cyan-400",
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
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("asha_insights")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setInsights(data as any);
      setLoading(false);
    };
    load();
  }, [user]);

  const dismiss = async (id: string) => {
    await supabase.from("asha_insights").update({ dismissed: true }).eq("id", id);
    setInsights((prev) => prev.map((i) => i.id === id ? { ...i, dismissed: true } : i));
  };

  const visible = insights.filter((i) => !i.dismissed && (filter ? i.type === filter : true));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Intelligence Briefing</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Asha found <span className="text-foreground">{visible.length} insights</span> across your datasets
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
        <div className="space-y-3">
          {visible.map((insight) => {
            const Icon = typeIcon[insight.type] || TrendingUp;
            return (
              <div key={insight.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${typeColor[insight.type] || "text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{insight.icon}</span>
                      <h3 className="text-sm font-light text-foreground">{insight.title}</h3>
                    </div>
                    <p className="text-xs font-extralight text-muted-foreground mt-1.5 leading-relaxed">{insight.description}</p>
                  </div>
                  <button onClick={() => dismiss(insight.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xs text-muted-foreground/40 font-extralight">No active insights. Upload data for Asha to analyze.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InsightsPanel;
