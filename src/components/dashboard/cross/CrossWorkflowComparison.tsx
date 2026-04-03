import React, { useState, useMemo } from "react";
import {
  X, TrendingUp, TrendingDown, ArrowRight, CheckCircle, AlertTriangle,
  BarChart3, Clock, Activity, Zap, GitCompare, Award, Lightbulb, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowGraph } from "./workflowTypes";

interface Props {
  workflows: WorkflowGraph[];
  onClose: () => void;
}

const formatDur = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const CrossWorkflowComparison: React.FC<Props> = ({ workflows, onClose }) => {
  const [selected, setSelected] = useState<string[]>(
    workflows.slice(0, 2).map(w => w.id)
  );
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [tab, setTab] = useState<"compare" | "trends" | "practices">("trends");

  const selectedWorkflows = useMemo(
    () => workflows.filter(w => selected.includes(w.id)),
    [workflows, selected]
  );

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(-1), id]
    );
  };

  // ── Trend data ──
  const trendData = useMemo(() => {
    return workflows
      .slice()
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map(w => ({
        id: w.id,
        name: w.name,
        date: new Date(w.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        duration: w.metrics.totalDuration,
        steps: w.metrics.totalSteps,
        efficiency: w.metrics.efficiencyScore,
        errors: w.metrics.errorCount,
      }));
  }, [workflows]);

  const maxDuration = Math.max(...trendData.map(d => d.duration), 1);

  // ── Best practices extraction ──
  const bestPractices = useMemo(() => {
    if (workflows.length < 2) return [];
    const practices: { title: string; description: string; impact: string; icon: React.ReactNode }[] = [];

    const avgDuration = workflows.reduce((a, w) => a + w.metrics.totalDuration, 0) / workflows.length;
    const fastRuns = workflows.filter(w => w.metrics.totalDuration < avgDuration * 0.8);
    if (fastRuns.length > 0) {
      practices.push({
        title: "Automation Reduces Duration",
        description: `${fastRuns.length} of ${workflows.length} runs were 20%+ faster than average. These runs had fewer manual steps.`,
        impact: `${Math.round((1 - fastRuns.reduce((a, w) => a + w.metrics.totalDuration, 0) / fastRuns.length / avgDuration) * 100)}% time reduction`,
        icon: <Zap className="h-4 w-4 text-emerald-400" />,
      });
    }

    const errorRuns = workflows.filter(w => w.metrics.errorCount > 0);
    const cleanRuns = workflows.filter(w => w.metrics.errorCount === 0);
    if (errorRuns.length > 0 && cleanRuns.length > 0) {
      practices.push({
        title: "Validation Prevents Errors",
        description: `${cleanRuns.length} error-free runs vs ${errorRuns.length} with errors. Error-free runs averaged ${Math.round(cleanRuns.reduce((a, w) => a + w.metrics.efficiencyScore, 0) / cleanRuns.length)}% efficiency.`,
        impact: `${errorRuns.length > 0 ? Math.round(errorRuns.length / workflows.length * 100) : 0}% error rate reducible`,
        icon: <CheckCircle className="h-4 w-4 text-blue-400" />,
      });
    }

    const highEffRuns = workflows.filter(w => w.metrics.efficiencyScore >= 80);
    if (highEffRuns.length > 0) {
      practices.push({
        title: "Consistent High Performance",
        description: `${highEffRuns.length} runs achieved 80%+ efficiency. These runs used templates and reduced context switching.`,
        impact: `${Math.round(highEffRuns.reduce((a, w) => a + w.metrics.efficiencyScore, 0) / highEffRuns.length)}% avg efficiency`,
        icon: <Award className="h-4 w-4 text-amber-400" />,
      });
    }

    if (practices.length === 0) {
      practices.push({
        title: "Building Baseline",
        description: "Continue running workflows to establish performance patterns and extract best practices.",
        impact: "More data needed",
        icon: <Activity className="h-4 w-4 text-muted-foreground/50" />,
      });
    }

    return practices;
  }, [workflows]);

  return (
    <div className="border-t border-border/20 flex flex-col max-h-[50%] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-foreground">Workflow Comparison</span>
        </div>
        <div className="flex items-center gap-1">
          {(["trends", "compare", "practices"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 rounded text-[9px] capitalize transition ${tab === t ? "bg-accent/10 text-accent" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}
            >
              {t}
            </button>
          ))}
          <button onClick={onClose} className="ml-1"><X className="h-3 w-3 text-muted-foreground/40" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Trends Tab ── */}
        {tab === "trends" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/50">{workflows.length} workflow runs</p>
              {trendData.length >= 2 && (
                <span className={`text-[10px] flex items-center gap-1 ${trendData[trendData.length - 1].duration < trendData[0].duration ? "text-emerald-400" : "text-red-400"}`}>
                  {trendData[trendData.length - 1].duration < trendData[0].duration ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {Math.abs(Math.round((1 - trendData[trendData.length - 1].duration / trendData[0].duration) * 100))}% {trendData[trendData.length - 1].duration < trendData[0].duration ? "faster" : "slower"}
                </span>
              )}
            </div>

            {/* Duration bar chart */}
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Duration Trend</p>
              <div className="flex items-end gap-1 h-20">
                {trendData.map((d, i) => (
                  <div key={d.id} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <span className="text-[8px] text-muted-foreground/40">{formatDur(d.duration)}</span>
                    <div
                      className={`w-full rounded-t transition-all ${d.errors > 0 ? "bg-red-400/30" : d.efficiency >= 80 ? "bg-emerald-400/30" : "bg-accent/20"}`}
                      style={{ height: `${Math.max(4, (d.duration / maxDuration) * 60)}px` }}
                    />
                    <span className="text-[7px] text-muted-foreground/30 truncate w-full text-center">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Efficiency trend */}
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Efficiency Score</p>
              <div className="flex items-end gap-1 h-14">
                {trendData.map(d => (
                  <div key={d.id} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <span className="text-[8px] text-muted-foreground/40">{d.efficiency}%</span>
                    <div
                      className={`w-full rounded-t ${d.efficiency >= 80 ? "bg-emerald-400/40" : d.efficiency >= 50 ? "bg-amber-400/30" : "bg-red-400/30"}`}
                      style={{ height: `${Math.max(4, d.efficiency * 0.5)}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Key observations */}
            {trendData.length >= 3 && (
              <div className="space-y-1 pt-1">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Key Observations</p>
                <div className="space-y-1">
                  {trendData[trendData.length - 1].efficiency > trendData[0].efficiency && (
                    <div className="flex items-start gap-1.5 text-[10px]">
                      <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground/60">Efficiency improved from {trendData[0].efficiency}% to {trendData[trendData.length - 1].efficiency}%</span>
                    </div>
                  )}
                  {trendData.filter(d => d.errors === 0).length > trendData.length / 2 && (
                    <div className="flex items-start gap-1.5 text-[10px]">
                      <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground/60">No errors in {trendData.filter(d => d.errors === 0).length} of {trendData.length} runs</span>
                    </div>
                  )}
                  {trendData[trendData.length - 1].duration < trendData[0].duration * 0.7 && (
                    <div className="flex items-start gap-1.5 text-[10px]">
                      <TrendingDown className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground/60">Duration reduced by {Math.round((1 - trendData[trendData.length - 1].duration / trendData[0].duration) * 100)}% over time</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Compare Tab ── */}
        {tab === "compare" && (
          <div className="p-3 space-y-3">
            {/* Selector */}
            <div className="flex gap-1.5 flex-wrap">
              {workflows.slice(0, 8).map(w => (
                <button
                  key={w.id}
                  onClick={() => toggleSelect(w.id)}
                  className={`px-2 py-1 rounded-lg text-[9px] transition ${selected.includes(w.id) ? "bg-accent/10 text-accent border border-accent/20" : "bg-muted/5 text-muted-foreground/40 border border-border/10 hover:bg-muted/10"}`}
                >
                  {new Date(w.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
              ))}
            </div>

            {/* Side-by-side comparison */}
            {selectedWorkflows.length === 2 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {selectedWorkflows.map(w => (
                    <div key={w.id} className="rounded-lg border border-border/20 p-2 space-y-1.5">
                      <p className="text-[10px] font-medium text-foreground truncate">{w.name}</p>
                      <p className="text-[8px] text-muted-foreground/40">{new Date(w.startTime).toLocaleDateString()}</p>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground/50">Duration</span>
                          <span className="text-foreground/70">{formatDur(w.metrics.totalDuration)}</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground/50">Steps</span>
                          <span className="text-foreground/70">{w.metrics.totalSteps}</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground/50">Errors</span>
                          <span className={w.metrics.errorCount > 0 ? "text-red-400" : "text-emerald-400"}>{w.metrics.errorCount}</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground/50">Efficiency</span>
                          <span className={`${w.metrics.efficiencyScore >= 80 ? "text-emerald-400" : w.metrics.efficiencyScore >= 50 ? "text-amber-400" : "text-red-400"}`}>{w.metrics.efficiencyScore}%</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                          <span className="text-muted-foreground/50">Decisions</span>
                          <span className="text-foreground/70">{w.metrics.decisionPoints}</span>
                        </div>
                      </div>
                      {/* Mini node list */}
                      <div className="pt-1 space-y-0.5 max-h-24 overflow-y-auto">
                        {w.nodes.slice(0, 6).map((node, i) => (
                          <div key={node.id} className="flex items-center gap-1 text-[8px] text-muted-foreground/40">
                            <span className={`h-1.5 w-1.5 rounded-full ${node.result === "success" ? "bg-emerald-400" : node.result === "failure" ? "bg-red-400" : "bg-muted-foreground/20"}`} />
                            <span className="truncate">{node.name}</span>
                          </div>
                        ))}
                        {w.nodes.length > 6 && (
                          <span className="text-[8px] text-muted-foreground/30">+{w.nodes.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Diff summary */}
                <div className="rounded-lg border border-border/20 p-2 space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Differences</p>
                  {(() => {
                    const [a, b] = selectedWorkflows;
                    const diffs: { icon: React.ReactNode; text: string }[] = [];
                    const durDiff = a.metrics.totalDuration - b.metrics.totalDuration;
                    if (Math.abs(durDiff) > 60) {
                      diffs.push({
                        icon: durDiff > 0 ? <TrendingDown className="h-3 w-3 text-emerald-400" /> : <TrendingUp className="h-3 w-3 text-red-400" />,
                        text: `${Math.abs(durDiff) > 0 ? formatDur(Math.abs(durDiff)) : "same"} ${durDiff > 0 ? "slower" : "faster"} in first run`,
                      });
                    }
                    const stepDiff = a.metrics.totalSteps - b.metrics.totalSteps;
                    if (stepDiff !== 0) {
                      diffs.push({
                        icon: <Activity className="h-3 w-3 text-blue-400" />,
                        text: `${Math.abs(stepDiff)} ${stepDiff > 0 ? "more" : "fewer"} steps in first run`,
                      });
                    }
                    const errDiff = a.metrics.errorCount - b.metrics.errorCount;
                    if (errDiff !== 0) {
                      diffs.push({
                        icon: <AlertTriangle className="h-3 w-3 text-amber-400" />,
                        text: `${Math.abs(errDiff)} ${errDiff > 0 ? "more" : "fewer"} errors in first run`,
                      });
                    }
                    const effDiff = a.metrics.efficiencyScore - b.metrics.efficiencyScore;
                    if (Math.abs(effDiff) >= 5) {
                      diffs.push({
                        icon: <BarChart3 className="h-3 w-3 text-purple-400" />,
                        text: `${Math.abs(effDiff)}% ${effDiff > 0 ? "higher" : "lower"} efficiency in first run`,
                      });
                    }
                    if (diffs.length === 0) diffs.push({ icon: <CheckCircle className="h-3 w-3 text-muted-foreground/30" />, text: "No significant differences" });
                    return diffs.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                        {d.icon}
                        <span>{d.text}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {selectedWorkflows.length < 2 && (
              <p className="text-[10px] text-muted-foreground/40 text-center py-4">Select 2 workflows to compare</p>
            )}
          </div>
        )}

        {/* ── Best Practices Tab ── */}
        {tab === "practices" && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground/50">Extracted from {workflows.length} workflow runs</p>
            {bestPractices.map((bp, i) => (
              <div key={i} className="rounded-lg border border-border/20 p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  {bp.icon}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground">{bp.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{bp.description}</p>
                    <p className="text-[10px] text-emerald-400/70 mt-1">Impact: {bp.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossWorkflowComparison;
