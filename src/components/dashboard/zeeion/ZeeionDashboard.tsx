import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart3, Shield, Zap } from "lucide-react";
import type { AnalysisResult } from "./ZeeionView";

interface Props {
  analysis: AnalysisResult;
}

const ZeeionDashboard = ({ analysis }: Props) => {
  const s = analysis.summary;

  if (!s) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[11px] text-muted-foreground/40">No analysis data available</p>
      </div>
    );
  }

  const gradeFromScore = (score: number) => {
    if (score >= 90) return { grade: "A+", color: "text-emerald-400" };
    if (score >= 80) return { grade: "A", color: "text-emerald-400" };
    if (score >= 70) return { grade: "B", color: "text-yellow-400" };
    if (score >= 60) return { grade: "C", color: "text-orange-400" };
    return { grade: "D", color: "text-red-400" };
  };

  const { grade, color } = gradeFromScore(s.efficiencyScore);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Potential Savings"
          value={`$${s.potentialSavings.toLocaleString()}`}
          sub="Identified by AI"
          accent
        />
        <MetricCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Efficiency Score"
          value={`${s.efficiencyScore}/100`}
          sub={`Grade: ${grade}`}
        />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Wasteful Spending"
          value={`$${s.wastefulSpending.toLocaleString()}`}
          sub={`${s.anomalyCount} anomalies`}
          warn
        />
        <MetricCard
          icon={<Zap className="h-4 w-4" />}
          label="Total Spending"
          value={`$${s.totalSpending.toLocaleString()}`}
          sub={`${s.totalRecords.toLocaleString()} records`}
        />
      </div>

      {/* Executive Summary */}
      {analysis.executiveSummary && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Executive Summary</h3>
          <p className="text-[11px] leading-relaxed text-foreground/60 font-light whitespace-pre-line">{analysis.executiveSummary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        {analysis.categoryBreakdown && analysis.categoryBreakdown.length > 0 && (
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Spending by Category</h3>
            <div className="space-y-2.5">
              {analysis.categoryBreakdown.map(cat => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-foreground/60 font-light">{cat.category}</span>
                    <span className="text-[10px] text-muted-foreground/40">{cat.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-foreground/20 transition-all" style={{ width: `${cat.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Savings Opportunities */}
        {analysis.savingsOpportunities && analysis.savingsOpportunities.length > 0 && (
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Top Savings Opportunities</h3>
            <div className="space-y-3">
              {analysis.savingsOpportunities.slice(0, 6).map((opp, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05]">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-foreground/60 font-light">{opp.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-muted-foreground/40">Save ${opp.projectedSavings.toLocaleString()}/yr</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground/30">{opp.confidence}% confidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wasteful Spending */}
      {analysis.wastefulItems && analysis.wastefulItems.length > 0 && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Wasteful Spending Identified</h3>
          <div className="space-y-2">
            {analysis.wastefulItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05]">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.severity === "high" ? "bg-red-400/60" : item.severity === "medium" ? "bg-yellow-400/60" : "bg-foreground/20"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-foreground/60 font-light">{item.description}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground/40">${item.annualCost.toLocaleString()}/yr</span>
                    <span className="text-[8px] text-muted-foreground/30">{item.recommendation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Performance */}
      {analysis.departmentPerformance && analysis.departmentPerformance.length > 0 && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Department Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border/[0.06]">
                  <th className="text-left py-2 text-muted-foreground/40 font-light">Department</th>
                  <th className="text-right py-2 text-muted-foreground/40 font-light">Budget</th>
                  <th className="text-right py-2 text-muted-foreground/40 font-light">Spent</th>
                  <th className="text-right py-2 text-muted-foreground/40 font-light">Variance</th>
                  <th className="text-right py-2 text-muted-foreground/40 font-light">Score</th>
                </tr>
              </thead>
              <tbody>
                {analysis.departmentPerformance.map(dept => {
                  const overBudget = dept.totalSpending > dept.budget;
                  return (
                    <tr key={dept.department} className="border-b border-border/[0.04]">
                      <td className="py-2.5 text-foreground/60 font-light">{dept.department}</td>
                      <td className="py-2.5 text-right text-muted-foreground/50">${dept.budget.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-foreground/60">${dept.totalSpending.toLocaleString()}</td>
                      <td className={`py-2.5 text-right ${overBudget ? "text-red-400/70" : "text-emerald-400/70"}`}>
                        {overBudget ? "+" : ""}{dept.variance.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right text-foreground/50">{dept.efficiencyScore}/100</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {analysis.anomalies && analysis.anomalies.length > 0 && (
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Anomalies Detected</h3>
          <div className="space-y-2">
            {analysis.anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05]">
                <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                  a.severity === "high" ? "text-red-400/60" : "text-yellow-400/60"
                }`} />
                <div>
                  <p className="text-[10px] text-foreground/60 font-light">{a.description}</p>
                  <p className="text-[8px] text-muted-foreground/30 mt-1">{a.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, sub, accent, warn }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean; warn?: boolean;
}) => (
  <div className={`rounded-2xl border p-4 backdrop-blur-sm ${
    accent ? "border-emerald-500/10 bg-emerald-500/[0.03]" : warn ? "border-red-500/10 bg-red-500/[0.03]" : "border-border/[0.08] bg-foreground/[0.02]"
  }`}>
    <div className="flex items-center gap-2 mb-2">
      <div className="text-muted-foreground/40">{icon}</div>
      <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">{label}</span>
    </div>
    <p className="text-lg font-light text-foreground/80">{value}</p>
    <p className="text-[9px] text-muted-foreground/30 mt-1">{sub}</p>
  </div>
);

export default ZeeionDashboard;
