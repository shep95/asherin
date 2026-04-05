import { useMemo, useState } from "react";
import { AlertTriangle, Bell, Shield, TrendingDown, DollarSign, ChevronRight, CheckCircle } from "lucide-react";
import type { AnalysisResult } from "./ZeeionView";
import ZeeionDeepDive from "./ZeeionDeepDive";

interface Props {
  analysis: AnalysisResult;
}

interface Alert {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  recommendation: string;
  metric?: string;
  dismissed: boolean;
}

const ZeeionAlerts = ({ analysis }: Props) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium">("all");

  // Auto-generate alerts from analysis data
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    const s = analysis.summary;
    if (!s) return result;

    // Budget threshold alerts
    analysis.departmentPerformance?.forEach((dept, i) => {
      const utilization = (dept.totalSpending / dept.budget) * 100;
      if (utilization > 100) {
        result.push({
          id: `budget-over-${i}`,
          severity: utilization > 115 ? "critical" : "high",
          category: "Budget",
          title: `${dept.department} Over Budget`,
          description: `${dept.department} has spent $${dept.totalSpending.toLocaleString()} against a $${dept.budget.toLocaleString()} budget (${utilization.toFixed(1)}% utilized).`,
          recommendation: `Freeze non-essential spending in ${dept.department} and review all pending commitments.`,
          metric: `+${dept.variance.toFixed(1)}%`,
          dismissed: false,
        });
      } else if (utilization > 90) {
        result.push({
          id: `budget-warn-${i}`,
          severity: "medium",
          category: "Budget",
          title: `${dept.department} Approaching Budget Limit`,
          description: `${dept.department} has used ${utilization.toFixed(1)}% of allocated budget.`,
          recommendation: `Monitor spending closely and prioritize remaining commitments.`,
          metric: `${utilization.toFixed(0)}%`,
          dismissed: false,
        });
      }
    });

    // Anomaly alerts
    analysis.anomalies?.forEach((a, i) => {
      result.push({
        id: `anomaly-${i}`,
        severity: a.severity === "high" ? "critical" : a.severity === "medium" ? "high" : "medium",
        category: "Anomaly",
        title: `Anomaly: ${a.type}`,
        description: a.description,
        recommendation: a.recommendation,
        dismissed: false,
      });
    });

    // Wasteful spending alerts (high severity only)
    analysis.wastefulItems?.filter(w => w.severity === "high").forEach((w, i) => {
      result.push({
        id: `waste-${i}`,
        severity: "high",
        category: "Waste",
        title: "Critical Wasteful Spending",
        description: w.description,
        recommendation: w.recommendation,
        metric: `$${w.annualCost.toLocaleString()}/yr`,
        dismissed: false,
      });
    });

    // Efficiency alert
    if (s.efficiencyScore < 60) {
      result.push({
        id: "efficiency-low",
        severity: "high",
        category: "Performance",
        title: "Low Overall Efficiency Score",
        description: `Your efficiency score is ${s.efficiencyScore}/100 — this indicates significant optimization opportunities across departments.`,
        recommendation: "Focus on the top 3 savings opportunities and conduct departmental spending reviews.",
        metric: `${s.efficiencyScore}/100`,
        dismissed: false,
      });
    }

    // Savings opportunity alert
    if (s.potentialSavings > s.totalSpending * 0.1) {
      result.push({
        id: "savings-large",
        severity: "medium",
        category: "Opportunity",
        title: "Significant Savings Available",
        description: `$${s.potentialSavings.toLocaleString()} in savings identified — representing ${((s.potentialSavings / s.totalSpending) * 100).toFixed(1)}% of total spending.`,
        recommendation: "Review and prioritize savings opportunities by confidence score and implementation effort.",
        metric: `$${s.potentialSavings.toLocaleString()}`,
        dismissed: false,
      });
    }

    // Sort by severity
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return result.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [analysis]);

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));

  const filteredAlerts = alerts.filter(a => {
    if (dismissedIds.has(a.id)) return false;
    if (filter === "all") return true;
    return a.severity === filter;
  });

  const counts = {
    critical: alerts.filter(a => a.severity === "critical" && !dismissedIds.has(a.id)).length,
    high: alerts.filter(a => a.severity === "high" && !dismissedIds.has(a.id)).length,
    medium: alerts.filter(a => a.severity === "medium" && !dismissedIds.has(a.id)).length,
  };

  const severityConfig = {
    critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/10", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Critical" },
    high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/10", icon: <Shield className="h-3.5 w-3.5" />, label: "High" },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/10", icon: <Bell className="h-3.5 w-3.5" />, label: "Medium" },
    low: { color: "text-muted-foreground/50", bg: "bg-foreground/[0.04] border-border/[0.06]", icon: <TrendingDown className="h-3.5 w-3.5" />, label: "Low" },
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-4 ${counts.critical > 0 ? "border-red-500/15 bg-red-500/[0.04]" : "border-border/[0.08] bg-foreground/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`h-4 w-4 ${counts.critical > 0 ? "text-red-400/70" : "text-muted-foreground/30"}`} />
            <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Critical</span>
          </div>
          <p className={`text-2xl font-light ${counts.critical > 0 ? "text-red-400/80" : "text-foreground/40"}`}>{counts.critical}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${counts.high > 0 ? "border-orange-500/15 bg-orange-500/[0.04]" : "border-border/[0.08] bg-foreground/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className={`h-4 w-4 ${counts.high > 0 ? "text-orange-400/70" : "text-muted-foreground/30"}`} />
            <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">High</span>
          </div>
          <p className={`text-2xl font-light ${counts.high > 0 ? "text-orange-400/80" : "text-foreground/40"}`}>{counts.high}</p>
        </div>
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-muted-foreground/30" />
            <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Medium</span>
          </div>
          <p className="text-2xl font-light text-foreground/40">{counts.medium}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5">
        {(["all", "critical", "high", "medium"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg border text-[9px] transition-all ${
              filter === f
                ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                : "border-border/[0.06] bg-foreground/[0.02] text-muted-foreground/40 hover:bg-foreground/[0.04]"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && <span className="ml-1 text-[8px] text-muted-foreground/30">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-400/30" />
            <p className="text-[10px] text-muted-foreground/30">
              {filter === "all" ? "All alerts have been addressed" : `No ${filter} alerts`}
            </p>
          </div>
        )}

        {filteredAlerts.map(alert => {
          const config = severityConfig[alert.severity];
          return (
            <div key={alert.id} className={`rounded-xl border p-4 ${config.bg} transition-all`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${config.color}`}>{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${config.bg} ${config.color} uppercase tracking-wider`}>
                      {config.label}
                    </span>
                    <span className="text-[8px] text-muted-foreground/30">{alert.category}</span>
                    {alert.metric && (
                      <span className="text-[9px] text-foreground/50 font-medium ml-auto">{alert.metric}</span>
                    )}
                  </div>
                  <h4 className="text-[11px] text-foreground/70 font-light mb-1">{alert.title}</h4>
                  <p className="text-[9px] text-foreground/45 font-light leading-relaxed">{alert.description}</p>
                  <div className="mt-2 p-2 rounded-lg bg-foreground/[0.03] border border-border/[0.04]">
                    <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-1">Recommendation</p>
                    <p className="text-[9px] text-foreground/50 font-light">{alert.recommendation}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => dismiss(alert.id)}
                      className="text-[8px] text-muted-foreground/30 hover:text-foreground/50 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ZeeionAlerts;
