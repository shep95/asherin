import { useState } from "react";
import { TrendingUp, AlertTriangle, Share2, BarChart3, HelpCircle, LineChart, X, Pin } from "lucide-react";
import type { Insight } from "./types";

const MOCK_INSIGHTS: Insight[] = [
  { id: "1", type: "trend", icon: "📈", title: "Revenue per customer +12%", description: "Revenue per customer has increased 12% over the last 3 months, driven primarily by the Enterprise segment.", createdAt: new Date(), dismissed: false },
  { id: "2", type: "anomaly", icon: "⚠️", title: "47 suspicious transactions", description: "47 transactions in the last 24 hours are 3× above average value. All from new accounts. Potential fraud pattern.", createdAt: new Date(), dismissed: false },
  { id: "3", type: "relationship", icon: "🔗", title: "Support → Churn correlation", description: "Customers who contact support within 7 days of purchase are 3× more likely to churn. 412 at-risk customers identified.", createdAt: new Date(), dismissed: false },
  { id: "4", type: "correlation", icon: "📊", title: "Google Ads ROI strong", description: "Marketing spend on Google Ads correlates with new signups (r=0.87). Facebook spend shows no correlation (r=0.12).", createdAt: new Date(), dismissed: false },
  { id: "5", type: "gap", icon: "❓", title: "Missing product in inventory", description: "Product SKU #4421 appears in sales.csv but not in inventory.xlsx. Is this product discontinued?", createdAt: new Date(), dismissed: false },
  { id: "6", type: "forecast", icon: "🗓️", title: "100K MAU by May 2026", description: "Based on current trajectory, monthly active users will reach 100,000 by May 2026 ± 12%.", createdAt: new Date(), dismissed: false },
];

const typeIcon: Record<string, React.ElementType> = {
  trend: TrendingUp,
  anomaly: AlertTriangle,
  relationship: Share2,
  correlation: BarChart3,
  gap: HelpCircle,
  forecast: LineChart,
};

const typeColor: Record<string, string> = {
  trend: "text-emerald-400",
  anomaly: "text-amber-400",
  relationship: "text-accent",
  correlation: "text-purple-400",
  gap: "text-muted-foreground",
  forecast: "text-cyan-400",
};

const InsightsPanel = () => {
  const [insights, setInsights] = useState(MOCK_INSIGHTS);
  const [filter, setFilter] = useState<string>("");

  const dismiss = (id: string) => setInsights((prev) => prev.map((i) => i.id === id ? { ...i, dismissed: true } : i));
  const visible = insights.filter((i) => !i.dismissed && (filter ? i.type === filter : true));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Intelligence Briefing</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Asha found <span className="text-foreground">{visible.length} insights</span> across your uploaded files
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

      <div className="space-y-3">
        {visible.map((insight) => {
          const Icon = typeIcon[insight.type];
          return (
            <div key={insight.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${typeColor[insight.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{insight.icon}</span>
                    <h3 className="text-sm font-light text-foreground">{insight.title}</h3>
                  </div>
                  <p className="text-xs font-extralight text-muted-foreground mt-1.5 leading-relaxed">{insight.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button className="rounded-md bg-foreground/10 px-3 py-1 text-[10px] text-foreground hover:bg-foreground/15 transition-colors">
                      View Analysis
                    </button>
                    <button className="rounded-md border border-border/20 px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      <Pin className="h-2.5 w-2.5 inline mr-1" />
                      Pin to Dashboard
                    </button>
                  </div>
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
    </div>
  );
};

export default InsightsPanel;
