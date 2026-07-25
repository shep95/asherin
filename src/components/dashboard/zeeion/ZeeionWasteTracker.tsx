import { useState, useCallback } from "react";
import {
  Loader2, CheckCircle2, Clock, AlertTriangle, ArrowRight, ChevronRight, ChevronDown,
  FileText, Download, Sparkles, Send, X, Shield, Target, TrendingUp, RefreshCw,
  Eye, Filter, BarChart3, Layers, Zap, Circle, ArrowUpRight, ClipboardList
} from "lucide-react";
import { streamChat } from "@/lib/ai";
import ReactMarkdown from "react-markdown";

/* ── Types ── */
export type WasteStatus =
  | "identified" | "under_review" | "plan_created" | "in_progress"
  | "partially_resolved" | "fully_resolved" | "verified" | "recurring" | "false_positive" | "accepted_risk";

export interface WasteItem {
  id: string;
  type: string;
  description: string;
  amount: number;
  annualImpact: number;
  discoveredDate: string;
  status: WasteStatus;
  confidence: number;
  department?: string;
  evidence?: string;
  recommendation?: string;
  severity: "high" | "medium" | "low";
  progress?: number;
  actualSavings?: number;
  verificationDate?: string;
  rootCause?: string;
  timeline?: { date: string; status: WasteStatus; action: string; user: string }[];
  remediationPlan?: RemediationPlan | null;
}

export interface RemediationPlan {
  phases: { name: string; duration: string; steps: { action: string; responsible: string; timeline: string; status: string }[] }[];
  totalCost: number;
  expectedSavings: number;
  roi: number;
  paybackPeriod: string;
  budgetRedirection?: { destination: string; amount: number; percentage: number; rationale: string }[];
}

interface ChatMsg { role: "user" | "assistant"; content: string }

/* ── Config ── */
const STATUS_CONFIG: Record<WasteStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  identified: { label: "Identified", icon: <Circle className="h-3 w-3" />, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  under_review: { label: "Under Review", icon: <Eye className="h-3 w-3" />, color: "text-blue-400", bg: "bg-blue-500/10" },
  plan_created: { label: "Plan Created", icon: <ClipboardList className="h-3 w-3" />, color: "text-purple-400", bg: "bg-purple-500/10" },
  in_progress: { label: "In Progress", icon: <RefreshCw className="h-3 w-3" />, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  partially_resolved: { label: "Partially Resolved", icon: <TrendingUp className="h-3 w-3" />, color: "text-teal-400", bg: "bg-teal-500/10" },
  fully_resolved: { label: "Resolved", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  verified: { label: "Verified", icon: <Shield className="h-3 w-3" />, color: "text-green-400", bg: "bg-green-500/10" },
  recurring: { label: "Recurring", icon: <AlertTriangle className="h-3 w-3" />, color: "text-red-400", bg: "bg-red-500/10" },
  false_positive: { label: "False Positive", icon: <X className="h-3 w-3" />, color: "text-muted-foreground/50", bg: "bg-foreground/[0.04]" },
  accepted_risk: { label: "Accepted Risk", icon: <Target className="h-3 w-3" />, color: "text-orange-400", bg: "bg-orange-500/10" },
};

const fmtUsd = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
};

interface Props {
  wasteItems: WasteItem[];
  onUpdateStatus: (id: string, status: WasteStatus) => void;
  onCreatePlan: (item: WasteItem) => void;
  countryName: string;
}

const ZeeionWasteTracker = ({ wasteItems, onUpdateStatus, onCreatePlan, countryName }: Props) => {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WasteItem | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const activeStatuses: WasteStatus[] = ["identified", "under_review", "plan_created", "in_progress", "partially_resolved", "recurring"];
  const resolvedStatuses: WasteStatus[] = ["fully_resolved", "verified", "false_positive", "accepted_risk"];

  const filtered = wasteItems.filter(w => {
    if (filter === "active") return activeStatuses.includes(w.status);
    if (filter === "resolved") return resolvedStatuses.includes(w.status);
    return true;
  });

  const totalIdentified = wasteItems.reduce((s, w) => s + w.annualImpact, 0);
  const activeWaste = wasteItems.filter(w => activeStatuses.includes(w.status)).reduce((s, w) => s + w.annualImpact, 0);
  const resolvedWaste = wasteItems.filter(w => resolvedStatuses.includes(w.status)).reduce((s, w) => s + w.annualImpact, 0);
  const savingsRealized = wasteItems.filter(w => w.actualSavings).reduce((s, w) => s + (w.actualSavings || 0), 0);
  const resolvedCount = wasteItems.filter(w => resolvedStatuses.includes(w.status)).length;
  const resolutionRate = wasteItems.length > 0 ? (resolvedCount / wasteItems.length) * 100 : 0;

  // Asherin investigation chat
  const sendChat = useCallback(async (text?: string) => {
    const msg = text || chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }]);
    setChatLoading(true);
    let content = "";

    const wasteCtx = JSON.stringify(wasteItems.map(w => ({
      type: w.type, desc: w.description, amount: fmtUsd(w.annualImpact),
      status: w.status, severity: w.severity, confidence: w.confidence,
      department: w.department, rootCause: w.rootCause
    }))).substring(0, 6000);

    try {
      await streamChat({
        messages: [
          { role: "user", content: `[WASTE INTELLIGENCE DATA - ${countryName}]\n${wasteCtx}\n\nTotal waste: ${fmtUsd(totalIdentified)} | Active: ${fmtUsd(activeWaste)} | Resolved: ${fmtUsd(resolvedWaste)} | Savings realized: ${fmtUsd(savingsRealized)}\n\n---\nYou are Asherin's Waste Intelligence Analyst. Provide forensic-grade analysis of government waste. Be specific with numbers, identify root causes, and suggest actionable remediation steps. Focus on: prioritization, cascading impacts, false positive detection, and budget redirection strategies.` },
          ...chatMsgs.map(m => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: msg },
        ],
        mode: "research",
        onDelta: (chunk) => {
          content += chunk;
          setChatMsgs(p => {
            const last = p[p.length - 1];
            if (last?.role === "assistant") return p.map((m, i) => i === p.length - 1 ? { ...m, content } : m);
            return [...p, { role: "assistant", content }];
          });
        },
        onReplace: (text) => {
          content = text;
          setChatMsgs(p => {
            const last = p[p.length - 1];
            if (last?.role === "assistant") return p.map((m, i) => i === p.length - 1 ? { ...m, content } : m);
            return [...p, { role: "assistant", content }];
          });
        },
        onDone: () => setChatLoading(false),
      });
    } catch {
      setChatMsgs(p => [...p, { role: "assistant", content: "Analysis failed. Please try again." }]);
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMsgs, wasteItems, countryName, totalIdentified, activeWaste, resolvedWaste, savingsRealized]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-light tracking-wider text-foreground/60">Waste Intelligence — {countryName}</h2>
          <p className="text-[8px] text-muted-foreground/30 mt-0.5">Lifecycle tracking, remediation monitoring & strategic planning</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-3 w-3 text-red-400/40" />
            <p className="text-[7px] uppercase tracking-[0.2em] text-red-400/40">Total Identified</p>
          </div>
          <p className="text-xl font-light text-red-400/70">{fmtUsd(totalIdentified)}</p>
          <p className="text-[7px] text-muted-foreground/25 mt-0.5">{wasteItems.length} items</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400/40" />
            <p className="text-[7px] uppercase tracking-[0.2em] text-emerald-400/40">Resolved</p>
          </div>
          <p className="text-xl font-light text-emerald-400/70">{fmtUsd(resolvedWaste)}</p>
          <p className="text-[7px] text-muted-foreground/25 mt-0.5">{resolutionRate.toFixed(0)}% resolution rate</p>
        </div>
        <div className="rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-yellow-400/40" />
            <p className="text-[7px] uppercase tracking-[0.2em] text-yellow-400/40">Active Waste</p>
          </div>
          <p className="text-xl font-light text-yellow-400/70">{fmtUsd(activeWaste)}</p>
          <p className="text-[7px] text-muted-foreground/25 mt-0.5">{wasteItems.filter(w => activeStatuses.includes(w.status)).length} items pending</p>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3 text-primary/40" />
            <p className="text-[7px] uppercase tracking-[0.2em] text-primary/40">Savings Realized</p>
          </div>
          <p className="text-xl font-light text-primary/70">{fmtUsd(savingsRealized)}</p>
        </div>
      </div>

      {/* Remediation Progress Bar */}
      <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-foreground/50 font-light">Remediation Progress</span>
          <span className="text-[9px] text-foreground/50">{resolutionRate.toFixed(0)}% Complete</span>
        </div>
        <div className="w-full h-2 rounded-full bg-foreground/[0.04] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/50 to-emerald-400/30 transition-all" style={{ width: `${resolutionRate}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-[8px] text-muted-foreground/30">{resolvedCount} resolved</span>
          <span className="text-[8px] text-muted-foreground/30">{wasteItems.filter(w => w.status === "in_progress").length} in progress</span>
          <span className="text-[8px] text-muted-foreground/30">{wasteItems.filter(w => w.status === "identified").length} not started</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-3 w-3 text-muted-foreground/30" />
        {(["all", "active", "resolved"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-lg text-[9px] transition-all ${filter === f ? "bg-foreground/[0.08] border border-foreground/[0.12] text-foreground/60" : "border border-border/[0.06] text-muted-foreground/40 hover:bg-foreground/[0.04]"}`}>
            {f === "all" ? `All (${wasteItems.length})` : f === "active" ? `Active (${wasteItems.filter(w => activeStatuses.includes(w.status)).length})` : `Resolved (${resolvedCount})`}
          </button>
        ))}
      </div>

      {/* Waste Inventory */}
      <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-border/[0.06] flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Waste Inventory</span>
          <span className="text-[8px] text-muted-foreground/25">{filtered.length} items</span>
        </div>
        <div className="divide-y divide-border/[0.04]">
          {filtered.sort((a, b) => b.annualImpact - a.annualImpact).map((item, idx) => {
            const cfg = STATUS_CONFIG[item.status];
            const expanded = expandedItem === item.id;
            return (
              <div key={item.id} className="p-4 hover:bg-foreground/[0.02] transition-all">
                <button onClick={() => setExpandedItem(expanded ? null : item.id)} className="w-full text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-[9px] text-muted-foreground/25 mt-1 w-4">{idx + 1}</span>
                    <span className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-foreground/60 font-light">{item.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                        <span className={`text-[8px] px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-[9px] text-foreground/45 mt-0.5 font-light line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] text-red-400/60 font-medium">{fmtUsd(item.annualImpact)}/yr</span>
                        <span className="text-[7px] text-muted-foreground/25">{item.confidence}% confidence</span>
                        {item.department && <span className="text-[7px] text-muted-foreground/25">{item.department}</span>}
                        {item.progress != null && item.progress > 0 && (
                          <span className="text-[7px] text-cyan-400/50">{item.progress}% complete</span>
                        )}
                      </div>

                      {/* Progress bar for in-progress items */}
                      {item.progress != null && item.progress > 0 && (
                        <div className="w-full h-1 rounded-full bg-foreground/[0.04] mt-2 overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-400/40 transition-all" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`h-3 w-3 text-muted-foreground/20 mt-1 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {/* Expanded Details */}
                {expanded && (
                  <div className="mt-4 ml-10 space-y-3 border-t border-border/[0.04] pt-3">
                    {item.evidence && (
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Evidence</p>
                        <p className="text-[9px] text-foreground/50 font-light">{item.evidence}</p>
                      </div>
                    )}
                    {item.rootCause && (
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Root Cause</p>
                        <p className="text-[9px] text-foreground/50 font-light">{item.rootCause}</p>
                      </div>
                    )}
                    {item.recommendation && (
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-0.5">Recommendation</p>
                        <p className="text-[9px] text-foreground/50 font-light">{item.recommendation}</p>
                      </div>
                    )}
                    {item.actualSavings != null && (
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.15em] text-emerald-400/40 mb-0.5">Actual Savings Realized</p>
                        <p className="text-[10px] text-emerald-400/60 font-light">{fmtUsd(item.actualSavings)}</p>
                      </div>
                    )}

                    {/* Timeline */}
                    {item.timeline && item.timeline.length > 0 && (
                      <div>
                        <p className="text-[7px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-2">Timeline</p>
                        <div className="space-y-1.5">
                          {item.timeline.map((t, ti) => {
                            const tcfg = STATUS_CONFIG[t.status];
                            return (
                              <div key={ti} className="flex items-start gap-2">
                                <div className="flex flex-col items-center">
                                  <div className={`w-1.5 h-1.5 rounded-full ${tcfg.bg} ${tcfg.color} mt-1.5`} />
                                  {ti < item.timeline!.length - 1 && <div className="w-px h-4 bg-border/[0.08]" />}
                                </div>
                                <div>
                                  <p className="text-[8px] text-foreground/50 font-light">{t.action}</p>
                                  <p className="text-[7px] text-muted-foreground/25">{t.date} — {t.user}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      {activeStatuses.includes(item.status) && !item.remediationPlan && (
                        <button onClick={() => onCreatePlan(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary/70 text-[9px] hover:bg-primary/20 transition-all">
                          <Sparkles className="h-3 w-3" /> Generate Remediation Plan
                        </button>
                      )}
                      {item.status === "identified" && (
                        <button onClick={() => onUpdateStatus(item.id, "under_review")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/[0.08] text-[9px] text-foreground/50 hover:bg-foreground/[0.04]">
                          <Eye className="h-3 w-3" /> Mark Under Review
                        </button>
                      )}
                      {item.status === "in_progress" && (
                        <button onClick={() => onUpdateStatus(item.id, "fully_resolved")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-[9px] text-emerald-400/60 hover:bg-emerald-500/10">
                          <CheckCircle2 className="h-3 w-3" /> Mark Resolved
                        </button>
                      )}
                      <button onClick={() => { setSelectedItem(item); setChatMsgs([]); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/[0.08] text-[9px] text-foreground/50 hover:bg-foreground/[0.04]">
                        <Sparkles className="h-3 w-3" /> Investigate
                      </button>
                    </div>

                    {/* Remediation Plan — Full Detail View */}
                    {item.remediationPlan && (
                      <div className="rounded-2xl border border-primary/10 bg-primary/[0.02] p-4 mt-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[8px] uppercase tracking-[0.2em] text-primary/40">Remediation Plan</p>
                            <p className="text-[9px] text-foreground/50 font-light mt-0.5">Objective: Eliminate {fmtUsd(item.annualImpact)}/yr waste via {item.type.replace(/_/g, " ")}</p>
                          </div>
                          <button onClick={() => {
                            const planTxt = JSON.stringify(item.remediationPlan, null, 2);
                            const blob = new Blob([planTxt], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = `remediation_plan_${item.id}.json`; a.click();
                            URL.revokeObjectURL(url);
                          }} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/[0.08] text-[8px] text-foreground/40 hover:bg-foreground/[0.04]">
                            <Download className="h-2.5 w-2.5" /> Download Plan
                          </button>
                        </div>

                        {/* Phases with steps */}
                        <div className="space-y-3">
                          {item.remediationPlan.phases.map((phase, pi) => {
                            const allDone = phase.steps.every(s => s.status === "done" || s.status === "complete" || s.status === "completed");
                            const someInProgress = phase.steps.some(s => s.status === "in_progress" || s.status === "in progress");
                            const phaseIcon = allDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60" /> : someInProgress ? <RefreshCw className="h-3.5 w-3.5 text-cyan-400/60 animate-spin" style={{ animationDuration: "3s" }} /> : <Clock className="h-3.5 w-3.5 text-muted-foreground/25" />;
                            const phaseLabel = allDone ? "Complete" : someInProgress ? "In Progress" : "Not Started";
                            const phaseLabelColor = allDone ? "text-emerald-400/50" : someInProgress ? "text-cyan-400/50" : "text-muted-foreground/25";

                            return (
                              <div key={pi} className="rounded-xl border border-border/[0.06] bg-foreground/[0.01] p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {phaseIcon}
                                    <span className="text-[10px] text-foreground/60 font-light">Phase {pi + 1}: {phase.name}</span>
                                    <span className="text-[7px] text-muted-foreground/25">({phase.duration})</span>
                                  </div>
                                  <span className={`text-[7px] ${phaseLabelColor}`}>{phaseLabel}</span>
                                </div>
                                <div className="space-y-1.5 ml-5">
                                  {phase.steps.map((step, si) => {
                                    const isDone = step.status === "done" || step.status === "complete" || step.status === "completed";
                                    const isActive = step.status === "in_progress" || step.status === "in progress";
                                    return (
                                      <div key={si} className="flex items-start gap-2">
                                        {isDone ? (
                                          <CheckCircle2 className="h-3 w-3 text-emerald-400/50 mt-0.5 shrink-0" />
                                        ) : isActive ? (
                                          <RefreshCw className="h-3 w-3 text-cyan-400/50 mt-0.5 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
                                        ) : (
                                          <Circle className="h-3 w-3 text-muted-foreground/20 mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-light ${isDone ? "text-foreground/40 line-through" : isActive ? "text-foreground/60" : "text-foreground/40"}`}>
                                              Step {(pi * 4) + si + 1}: {step.action}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[7px] text-muted-foreground/25">{step.responsible}</span>
                                            <span className="text-[7px] text-muted-foreground/20">•</span>
                                            <span className="text-[7px] text-muted-foreground/25">{step.timeline}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary metrics */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/[0.04]">
                          <div className="text-center p-2 rounded-lg bg-foreground/[0.02]">
                            <p className="text-[7px] text-muted-foreground/30 uppercase tracking-wider">Cost</p>
                            <p className="text-[11px] text-foreground/60 font-light">{fmtUsd(item.remediationPlan.totalCost)}</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-emerald-500/[0.03]">
                            <p className="text-[7px] text-emerald-400/40 uppercase tracking-wider">ROI</p>
                            <p className="text-[11px] text-emerald-400/60 font-light">{item.remediationPlan.roi.toLocaleString()}%</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-foreground/[0.02]">
                            <p className="text-[7px] text-muted-foreground/30 uppercase tracking-wider">Payback</p>
                            <p className="text-[11px] text-foreground/60 font-light">{item.remediationPlan.paybackPeriod}</p>
                          </div>
                        </div>

                        {/* Budget Redirection Plan */}
                        {item.remediationPlan.budgetRedirection && item.remediationPlan.budgetRedirection.length > 0 && (
                          <div className="pt-2 border-t border-border/[0.04]">
                            <p className="text-[8px] uppercase tracking-[0.15em] text-primary/35 mb-2">Budget Redirection Plan</p>
                            <p className="text-[8px] text-foreground/40 mb-3 font-light">Once {fmtUsd(item.annualImpact)} is saved, recommended allocation:</p>
                            <div className="space-y-2">
                              {item.remediationPlan.budgetRedirection.map((rd, ri) => (
                                <div key={ri}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[8px] text-foreground/50 font-light">{rd.percentage}% → {rd.destination}</span>
                                    <span className="text-[8px] text-foreground/40">{fmtUsd(rd.amount)}</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden">
                                    <div className="h-full rounded-full bg-primary/30 transition-all" style={{ width: `${rd.percentage}%` }} />
                                  </div>
                                  <p className="text-[7px] text-muted-foreground/25 mt-0.5 font-light">{rd.rationale}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/[0.04]">
                          <button onClick={() => onUpdateStatus(item.id, "in_progress")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[8px] text-cyan-400/70 hover:bg-cyan-500/20">
                            <ArrowRight className="h-2.5 w-2.5" /> Start Implementation
                          </button>
                          <button onClick={() => { setSelectedItem(item); setChatMsgs([]); sendChat(`Analyze the remediation plan for "${item.type}" waste item. What are the risks, and how can we accelerate the timeline?`); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/[0.08] text-[8px] text-foreground/40 hover:bg-foreground/[0.04]">
                            <Sparkles className="h-2.5 w-2.5" /> Ask Asherin
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Layers className="h-6 w-6 text-muted-foreground/15 mb-2" />
              <p className="text-[10px] text-muted-foreground/30">No waste items match current filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Asherin Intelligence Insights Panel */}
      <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-foreground/40" />
            <span className="text-[10px] font-light tracking-wider text-foreground/60">ASHERIN WASTE INTELLIGENCE</span>
          </div>
          {chatMsgs.length > 0 && (
            <button onClick={() => setChatMsgs([])} className="p-1 rounded-lg hover:bg-foreground/[0.06]">
              <X className="h-3 w-3 text-muted-foreground/40" />
            </button>
          )}
        </div>

        {/* Quick insights */}
        {chatMsgs.length === 0 && (
          <div className="px-4 py-3 space-y-3 border-b border-border/[0.04]">
            {/* Priority recommendation */}
            {wasteItems.filter(w => w.status === "identified" && w.severity === "high").length > 0 && (
              <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3 w-3 text-yellow-400/50" />
                  <span className="text-[8px] uppercase tracking-[0.15em] text-yellow-400/50">Priority Recommendation</span>
                </div>
                <p className="text-[9px] text-foreground/50 font-light">
                  Focus on the {wasteItems.filter(w => w.status === "identified" && w.severity === "high").length} high-severity items not yet under review — potential {fmtUsd(wasteItems.filter(w => w.status === "identified" && w.severity === "high").reduce((s, w) => s + w.annualImpact, 0))} in savings
                </p>
                <button onClick={() => sendChat("Analyze the highest priority waste items and create a step-by-step action plan")} className="mt-2 flex items-center gap-1 text-[8px] text-yellow-400/60 hover:text-yellow-400/80">
                  <Sparkles className="h-2.5 w-2.5" /> Generate Action Plan
                </button>
              </div>
            )}

            {/* Recurring waste alert */}
            {wasteItems.filter(w => w.status === "recurring").length > 0 && (
              <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3 w-3 text-red-400/50" />
                  <span className="text-[8px] uppercase tracking-[0.15em] text-red-400/50">Recurring Waste Alert</span>
                </div>
                <p className="text-[9px] text-foreground/50 font-light">
                  {wasteItems.filter(w => w.status === "recurring").length} previously resolved items have reappeared — systemic fix required
                </p>
                <button onClick={() => sendChat("Investigate all recurring waste items. Why did they reappear and what systemic changes are needed?")} className="mt-2 flex items-center gap-1 text-[8px] text-red-400/60 hover:text-red-400/80">
                  <Sparkles className="h-2.5 w-2.5" /> Investigate Root Cause
                </button>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { l: "Quick Wins", q: "Identify all quick wins — low-difficulty, high-savings items that can be resolved in under 30 days" },
                { l: "False Positives", q: "Review all waste items for potential false positives. Which ones need manual verification?" },
                { l: "Budget Redirection", q: "For all resolved waste, recommend how to redirect the recovered budget for maximum impact" },
                { l: "Cascading Impact", q: "Analyze the cascading second-order effects of eliminating the top 5 waste items" },
              ].map(a => (
                <button key={a.l} onClick={() => sendChat(a.q)} className="px-2.5 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03] text-[8px] text-foreground/50 hover:bg-foreground/[0.06]">
                  {a.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3">
          {chatMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === "user" ? "bg-foreground/[0.08] border border-border/[0.08] text-foreground/70" : "bg-foreground/[0.03] border border-border/[0.05] text-foreground/60"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-[10px] leading-relaxed font-light"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                ) : (
                  <p className="text-[10px] font-light">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {chatLoading && chatMsgs[chatMsgs.length - 1]?.role !== "assistant" && (
            <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" /><span className="text-[9px] text-muted-foreground/30">Analyzing...</span></div>
          )}
        </div>

        {/* Chat Input */}
        <div className="px-3 py-2.5 border-t border-border/[0.06]">
          <div className="flex items-center gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Investigate waste patterns, ask for remediation plans..." className="flex-1 bg-transparent text-[10px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none font-light" disabled={chatLoading} />
            <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} className="p-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] disabled:opacity-30">
              <Send className="h-3 w-3 text-foreground/50" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZeeionWasteTracker;
