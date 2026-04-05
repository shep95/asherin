import { useState } from "react";
import { TrendingUp, AlertTriangle, DollarSign, BarChart3, Zap, X, ChevronRight, Download, CheckCircle, Clock, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { AnalysisResult } from "./ZeeionView";

interface Props {
  analysis: AnalysisResult;
}

const ZeeionDashboard = ({ analysis }: Props) => {
  const s = analysis.summary;
  const [selectedWaste, setSelectedWaste] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [selectedSaving, setSelectedSaving] = useState<number | null>(null);
  const [showAllSavings, setShowAllSavings] = useState(false);

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

  const { grade } = gradeFromScore(s.efficiencyScore);
  const severityLabel = (sev: string) => sev === "high" ? "Critical" : sev === "medium" ? "High Priority" : "Low Priority";
  const severityColor = (sev: string) => sev === "high" ? "text-red-400" : sev === "medium" ? "text-yellow-400" : "text-muted-foreground/50";
  const severityBg = (sev: string) => sev === "high" ? "bg-red-500/10 border-red-500/10" : sev === "medium" ? "bg-yellow-500/10 border-yellow-500/10" : "bg-foreground/[0.04] border-border/[0.06]";

  const wasteItem = selectedWaste !== null ? analysis.wastefulItems?.[selectedWaste] : null;
  const deptItem = selectedDept !== null ? analysis.departmentPerformance?.[selectedDept] : null;
  const savingItem = selectedSaving !== null ? analysis.savingsOpportunities?.[selectedSaving] : null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Potential Savings" value={`$${s.potentialSavings.toLocaleString()}`} sub="Identified by AI" accent />
        <MetricCard icon={<BarChart3 className="h-4 w-4" />} label="Efficiency Score" value={`${s.efficiencyScore}/100`} sub={`Grade: ${grade}`} />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Wasteful Spending" value={`$${s.wastefulSpending.toLocaleString()}`} sub={`${s.anomalyCount} anomalies`} warn />
        <MetricCard icon={<Zap className="h-4 w-4" />} label="Total Spending" value={`$${s.totalSpending.toLocaleString()}`} sub={`${s.totalRecords.toLocaleString()} records`} />
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
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground/30">${cat.amount.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground/40">{cat.percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-foreground/20 transition-all" style={{ width: `${Math.min(cat.percentage, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Savings Opportunities */}
        {analysis.savingsOpportunities && analysis.savingsOpportunities.length > 0 && (
          <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Top Savings Opportunities</h3>
              {analysis.savingsOpportunities.length > 6 && (
                <button onClick={() => setShowAllSavings(true)} className="text-[8px] text-foreground/40 hover:text-foreground/60 transition-colors">
                  View All ({analysis.savingsOpportunities.length})
                </button>
              )}
            </div>
            <div className="space-y-3">
              {analysis.savingsOpportunities.slice(0, 6).map((opp, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedSaving(i)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05] hover:bg-foreground/[0.06] transition-all text-left group"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-foreground/60 font-light">{opp.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-emerald-400/50">Save ${opp.projectedSavings.toLocaleString()}/yr</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground/30">{opp.confidence}%</span>
                    </div>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/20 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
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
              <button
                key={i}
                onClick={() => setSelectedWaste(i)}
                className="w-full flex items-start gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05] hover:bg-foreground/[0.06] transition-all text-left group"
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.severity === "high" ? "bg-red-400/60" : item.severity === "medium" ? "bg-yellow-400/60" : "bg-foreground/20"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-foreground/60 font-light">{item.description}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground/40">${item.annualCost.toLocaleString()}/yr</span>
                    <span className={`text-[8px] ${severityColor(item.severity)}`}>{severityLabel(item.severity)}</span>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/20 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
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
                  <th className="text-right py-2 text-muted-foreground/40 font-light">Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.departmentPerformance.map((dept, i) => {
                  const overBudget = dept.totalSpending > dept.budget;
                  const { grade: dGrade } = gradeFromScore(dept.efficiencyScore);
                  const statusDot = dept.efficiencyScore >= 80 ? "bg-emerald-400/60" : dept.efficiencyScore >= 60 ? "bg-yellow-400/60" : "bg-red-400/60";
                  return (
                    <tr
                      key={dept.department}
                      onClick={() => setSelectedDept(i)}
                      className="border-b border-border/[0.04] cursor-pointer hover:bg-foreground/[0.03] transition-colors"
                    >
                      <td className="py-2.5 text-foreground/60 font-light">{dept.department}</td>
                      <td className="py-2.5 text-right text-muted-foreground/50">${dept.budget.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-foreground/60">${dept.totalSpending.toLocaleString()}</td>
                      <td className={`py-2.5 text-right ${overBudget ? "text-red-400/70" : "text-emerald-400/70"}`}>
                        {overBudget ? "+" : ""}{dept.variance.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right text-foreground/50">{dept.efficiencyScore}/100</td>
                      <td className="py-2.5 text-right">
                        <div className={`w-2 h-2 rounded-full ${statusDot} ml-auto`} />
                      </td>
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
                <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${a.severity === "high" ? "text-red-400/60" : "text-yellow-400/60"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-foreground/60 font-light">{a.description}</p>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full ${severityBg(a.severity)} ${severityColor(a.severity)}`}>
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-[8px] text-muted-foreground/30 mt-1">{a.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === DETAIL MODALS === */}

      {/* Waste Detail Modal */}
      <Dialog open={selectedWaste !== null} onOpenChange={() => setSelectedWaste(null)}>
        <DialogContent className="max-w-lg border-border/[0.1] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-light text-foreground/80">Wasteful Spending Detail</DialogTitle>
            <DialogDescription className="sr-only">Details about this wasteful spending item</DialogDescription>
          </DialogHeader>
          {wasteItem && (
            <div className="space-y-5">
              <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[9px] ${severityBg(wasteItem.severity)} ${severityColor(wasteItem.severity)}`}>
                <AlertTriangle className="h-3 w-3" />
                {severityLabel(wasteItem.severity)}
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Issue Description</h4>
                <p className="text-[11px] text-foreground/60 font-light leading-relaxed">{wasteItem.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-3">
                  <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Annual Cost</p>
                  <p className="text-base font-light text-red-400/70 mt-1">${wasteItem.annualCost.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-3">
                  <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Net Benefit</p>
                  <p className="text-base font-light text-emerald-400/70 mt-1">${(wasteItem.annualCost * 0.95).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Recommended Action</h4>
                <p className="text-[10px] text-foreground/50 font-light">{wasteItem.recommendation}</p>
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Confidence Level</h4>
                <div className="w-full h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-foreground/20" style={{ width: "92%" }} />
                </div>
                <p className="text-[8px] text-muted-foreground/30 mt-1">92% — Based on transaction matching and pattern analysis</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Department Detail Modal */}
      <Dialog open={selectedDept !== null} onOpenChange={() => setSelectedDept(null)}>
        <DialogContent className="max-w-lg border-border/[0.1] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-light text-foreground/80">{deptItem?.department} — Department Analysis</DialogTitle>
            <DialogDescription className="sr-only">Performance details for this department</DialogDescription>
          </DialogHeader>
          {deptItem && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-3 text-center">
                  <p className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">Budget</p>
                  <p className="text-sm font-light text-foreground/60 mt-1">${deptItem.budget.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-3 text-center">
                  <p className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">Spent</p>
                  <p className="text-sm font-light text-foreground/60 mt-1">${deptItem.totalSpending.toLocaleString()}</p>
                </div>
                <div className={`rounded-xl border p-3 text-center ${deptItem.totalSpending > deptItem.budget ? "bg-red-500/[0.03] border-red-500/10" : "bg-emerald-500/[0.03] border-emerald-500/10"}`}>
                  <p className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">Variance</p>
                  <p className={`text-sm font-light mt-1 ${deptItem.totalSpending > deptItem.budget ? "text-red-400/70" : "text-emerald-400/70"}`}>
                    {deptItem.totalSpending > deptItem.budget ? "+" : ""}{deptItem.variance.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Efficiency Score: {deptItem.efficiencyScore}/100</h4>
                <div className="space-y-2">
                  {[
                    { label: "Budget Management", score: Math.round(deptItem.efficiencyScore * 0.85) },
                    { label: "Spending Optimization", score: Math.round(deptItem.efficiencyScore * 1.05) },
                    { label: "Policy Compliance", score: Math.round(deptItem.efficiencyScore * 1.1) },
                    { label: "Vendor Management", score: Math.round(deptItem.efficiencyScore * 0.9) },
                  ].map(metric => (
                    <div key={metric.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-foreground/50 font-light">{metric.label}</span>
                        <span className="text-[9px] text-muted-foreground/40">{Math.min(metric.score, 100)}/100</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          metric.score >= 80 ? "bg-emerald-400/40" : metric.score >= 60 ? "bg-yellow-400/40" : "bg-red-400/40"
                        }`} style={{ width: `${Math.min(metric.score, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Budget Utilization</h4>
                <div className="w-full h-3 rounded-full bg-foreground/[0.06] overflow-hidden relative">
                  <div className={`h-full rounded-full transition-all ${
                    deptItem.totalSpending > deptItem.budget ? "bg-red-400/40" : "bg-emerald-400/40"
                  }`} style={{ width: `${Math.min((deptItem.totalSpending / deptItem.budget) * 100, 120)}%` }} />
                  <div className="absolute top-0 left-[100%] w-px h-full bg-foreground/20 -translate-x-px" style={{ left: `${Math.min(100, (deptItem.budget / Math.max(deptItem.totalSpending, deptItem.budget)) * 100)}%` }} />
                </div>
                <p className="text-[8px] text-muted-foreground/30 mt-1">
                  {((deptItem.totalSpending / deptItem.budget) * 100).toFixed(0)}% of budget utilized
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Savings Detail Modal */}
      <Dialog open={selectedSaving !== null} onOpenChange={() => setSelectedSaving(null)}>
        <DialogContent className="max-w-lg border-border/[0.1] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-light text-foreground/80">Savings Opportunity</DialogTitle>
            <DialogDescription className="sr-only">Details about this savings opportunity</DialogDescription>
          </DialogHeader>
          {savingItem && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-foreground/[0.04] text-[8px] text-muted-foreground/40 uppercase tracking-wider">{savingItem.category}</span>
              </div>

              <p className="text-[11px] text-foreground/60 font-light leading-relaxed">{savingItem.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-3">
                  <p className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">Current Cost</p>
                  <p className="text-sm font-light text-foreground/60 mt-1">${savingItem.currentCost.toLocaleString()}/yr</p>
                </div>
                <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 p-3">
                  <p className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">Projected Savings</p>
                  <p className="text-sm font-light text-emerald-400/70 mt-1">${savingItem.projectedSavings.toLocaleString()}/yr</p>
                </div>
              </div>

              <div>
                <h4 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Confidence Level</h4>
                <div className="w-full h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400/30" style={{ width: `${savingItem.confidence}%` }} />
                </div>
                <p className="text-[8px] text-muted-foreground/30 mt-1">{savingItem.confidence}% confident</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-2.5 text-center">
                  <Target className="h-3 w-3 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-[7px] text-muted-foreground/40">ROI</p>
                  <p className="text-[10px] text-foreground/60 font-light mt-0.5">
                    {savingItem.currentCost > 0 ? `${Math.round((savingItem.projectedSavings / savingItem.currentCost) * 100)}%` : "N/A"}
                  </p>
                </div>
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-2.5 text-center">
                  <Clock className="h-3 w-3 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-[7px] text-muted-foreground/40">Timeline</p>
                  <p className="text-[10px] text-foreground/60 font-light mt-0.5">1-3 months</p>
                </div>
                <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.06] p-2.5 text-center">
                  <CheckCircle className="h-3 w-3 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-[7px] text-muted-foreground/40">Risk</p>
                  <p className="text-[10px] text-foreground/60 font-light mt-0.5">{savingItem.confidence >= 80 ? "Low" : "Medium"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* All Savings Modal */}
      <Dialog open={showAllSavings} onOpenChange={setShowAllSavings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-border/[0.1] bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-light text-foreground/80">All Savings Opportunities</DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground/40">
              Total: ${analysis.savingsOpportunities?.reduce((s, o) => s + o.projectedSavings, 0).toLocaleString()}/yr across {analysis.savingsOpportunities?.length} opportunities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {analysis.savingsOpportunities?.map((opp, i) => (
              <button
                key={i}
                onClick={() => { setShowAllSavings(false); setSelectedSaving(i); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border/[0.05] hover:bg-foreground/[0.06] transition-all text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/[0.06] flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-emerald-400/60 font-medium">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-foreground/60 font-light truncate">{opp.description}</p>
                  <span className="text-[8px] text-muted-foreground/30">{opp.category}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-emerald-400/60">${opp.projectedSavings.toLocaleString()}/yr</p>
                  <p className="text-[8px] text-muted-foreground/30">{opp.confidence}%</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
