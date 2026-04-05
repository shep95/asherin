import { useState } from "react";
import { Shield, TrendingUp, Zap, GitBranch, FileText, AlertTriangle, Globe, BarChart3, ChevronRight, Copy, Check, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AxrlenSession } from "./AxrlenView";

interface Props { session: AxrlenSession; }

type Tab = "overview" | "predictions" | "threats" | "resources" | "policy" | "timeline";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Executive Summary", icon: FileText },
  { id: "predictions", label: "Predictions", icon: Zap },
  { id: "threats", label: "Threat Assessment", icon: Shield },
  { id: "resources", label: "Resources", icon: BarChart3 },
  { id: "policy", label: "Policy Simulations", icon: Globe },
  { id: "timeline", label: "Timeline Divergence", icon: GitBranch },
];

const severityBadge = (s: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300/80 border-red-500/20",
    high: "bg-amber-500/20 text-amber-300/80 border-amber-500/20",
    elevated: "bg-amber-500/20 text-amber-300/80 border-amber-500/20",
    medium: "bg-yellow-500/20 text-yellow-300/80 border-yellow-500/20",
    guarded: "bg-yellow-500/20 text-yellow-300/80 border-yellow-500/20",
    low: "bg-emerald-500/20 text-emerald-300/80 border-emerald-500/20",
  };
  return colors[s] || colors.medium;
};

const AxrlenAnalysis = ({ session }: Props) => {
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState(false);
  const [expandedPred, setExpandedPred] = useState<string | null>(null);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportReport = () => {
    const lines: string[] = [
      `AXRLEN INTELLIGENCE REPORT`,
      `Generated: ${session.createdAt.toLocaleString()}`,
      `Region: ${session.region || "Global"}`,
      `Confidence: ${session.confidenceScore}%`,
      ``,
      `EXECUTIVE SUMMARY`,
      session.aiSummary || "N/A",
      ``,
      `PREDICTIONS (${(session.predictions || []).length})`,
    ];
    (session.predictions || []).forEach((p: any, i: number) => {
      lines.push(`\n${i + 1}. [${p.severity?.toUpperCase()}] ${p.title}`);
      lines.push(`   Category: ${p.category} | Probability: ${p.probability}% | Timeframe: ${p.timeframe}`);
      lines.push(`   ${p.description}`);
      if (p.recommendedAction) lines.push(`   Recommended Action: ${p.recommendedAction}`);
      if (p.dataPoints?.length) lines.push(`   Evidence: ${p.dataPoints.join("; ")}`);
    });
    lines.push(`\nTHREAT ASSESSMENT`);
    lines.push(`Overall: ${session.threatAssessment?.overallThreatLevel || "N/A"}`);
    (session.threatAssessment?.vectors || []).forEach((v: any) => {
      lines.push(`  - [${v.type}] ${v.description} (${v.probability}%)`);
    });
    lines.push(`\nPOLICY SIMULATIONS`);
    (session.policySimulations || []).forEach((p: any) => {
      lines.push(`  - ${p.policy}: ${p.projectedOutcome} (Risk: ${p.riskLevel})`);
    });
    lines.push(`\nTIMELINE DIVERGENCES`);
    (session.timelineDivergences || []).forEach((d: any) => {
      lines.push(`  - ${d.inflectionPoint}`);
      lines.push(`    Branch A (${d.branchA?.probability}%): ${d.branchA?.description}`);
      lines.push(`    Branch B (${d.branchB?.probability}%): ${d.branchB?.description}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axrlen_report_${session.region || "global"}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const predictions = session.predictions || [];
  const threats = session.threatAssessment;
  const resources = session.resourceAnalysis;
  const policies = session.policySimulations || [];
  const divergences = session.timelineDivergences || [];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-4 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[9px] tracking-wide whitespace-nowrap border-b-2 transition-all ${tab === t.id
                ? "border-foreground/30 text-foreground/80"
                : "border-transparent text-muted-foreground/40 hover:text-foreground/50"}`}>
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 py-2">
          <button onClick={() => copyText(session.aiSummary || "")} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-all">
            {copied ? <Check className="h-3 w-3 text-emerald-400/60" /> : <Copy className="h-3 w-3 text-muted-foreground/30" />}
          </button>
          <button onClick={exportReport} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/[0.1] bg-foreground/[0.03] text-[9px] text-foreground/50 hover:bg-foreground/[0.06] transition-all">
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full select-text">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Confidence", value: `${session.confidenceScore || 0}%`, sub: "Overall model confidence" },
                { label: "Predictions", value: predictions.length, sub: "Active forecasts" },
                { label: "Threat Level", value: threats?.overallThreatLevel?.toUpperCase() || "N/A", sub: "Current assessment" },
                { label: "Data Sources", value: session.dataSources?.total || 0, sub: `${session.dataSources?.verified || 0} verified` },
              ].map((kpi, i) => (
                <div key={i} className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02]">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">{kpi.label}</p>
                  <p className="text-lg font-light text-foreground/80 mt-1">{kpi.value}</p>
                  <p className="text-[8px] text-muted-foreground/30 mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Executive summary */}
            <div className="p-5 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] space-y-3">
              <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Executive Summary</h3>
              <div className="text-[11px] text-foreground/60 font-light leading-relaxed select-text">
                <ReactMarkdown>{session.aiSummary || "No summary available."}</ReactMarkdown>
              </div>
            </div>

            {/* Top predictions preview */}
            {predictions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Top Predictions</h3>
                {predictions.slice(0, 3).map((p: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] flex items-start gap-3">
                    <div className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border ${severityBadge(p.severity)}`}>
                      {p.severity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground/70">{p.title}</p>
                      <p className="text-[8px] text-muted-foreground/40 mt-0.5">{p.probability}% probability · {p.timeframe} · {p.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Predictions ── */}
        {tab === "predictions" && (
          <div className="space-y-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">
              All Predictions ({predictions.length})
            </h3>
            {predictions.map((p: any, i: number) => (
              <div key={p.id || i}
                className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                <button onClick={() => setExpandedPred(expandedPred === (p.id || `${i}`) ? null : (p.id || `${i}`))}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-foreground/[0.02] transition-all">
                  <div className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border shrink-0 ${severityBadge(p.severity)}`}>
                    {p.severity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground/70">{p.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[8px] text-muted-foreground/40">{p.probability}% probability</span>
                      <span className="text-[8px] text-muted-foreground/40">{p.timeframe}</span>
                      <span className="text-[8px] text-muted-foreground/40">{p.category}</span>
                      <span className="text-[8px] text-foreground/40">{p.confidence}% confidence</span>
                    </div>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-muted-foreground/30 shrink-0 transition-transform ${expandedPred === (p.id || `${i}`) ? "rotate-90" : ""}`} />
                </button>
                {expandedPred === (p.id || `${i}`) && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/[0.06]">
                    <div className="pt-3">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Analysis</p>
                      <p className="text-[10px] text-foreground/60 font-light leading-relaxed select-text">{p.description}</p>
                    </div>
                    {p.dataPoints?.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Supporting Evidence</p>
                        <ul className="space-y-1">
                          {p.dataPoints.map((dp: string, j: number) => (
                            <li key={j} className="text-[9px] text-foreground/50 flex items-start gap-2 select-text">
                              <span className="text-muted-foreground/30 mt-0.5">◈</span> {dp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.historicalPrecedent && (
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Historical Precedent</p>
                        <p className="text-[9px] text-foreground/50 select-text">{p.historicalPrecedent}</p>
                      </div>
                    )}
                    {p.recommendedAction && (
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-1">Recommended Action</p>
                        <p className="text-[9px] text-foreground/50 select-text">{p.recommendedAction}</p>
                      </div>
                    )}
                    <button onClick={() => copyText(`${p.title}\n${p.description}\nProbability: ${p.probability}%\nTimeframe: ${p.timeframe}\n${p.recommendedAction ? `Action: ${p.recommendedAction}` : ""}`)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/[0.1] text-[8px] text-muted-foreground/40 hover:bg-foreground/[0.04] transition-all">
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Threat Assessment ── */}
        {tab === "threats" && threats && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] flex items-center gap-4">
              <AlertTriangle className={`h-6 w-6 ${threats.overallThreatLevel === "critical" ? "text-red-400/70" : threats.overallThreatLevel === "elevated" ? "text-amber-400/70" : "text-emerald-400/70"}`} />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40">Overall Threat Level</p>
                <p className="text-lg font-light text-foreground/80 uppercase tracking-wider">{threats.overallThreatLevel}</p>
              </div>
            </div>
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Threat Vectors</h3>
            {(threats.vectors || []).map((v: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border border-foreground/[0.1] bg-foreground/[0.04] text-foreground/50">{v.type}</span>
                    <span className="text-[9px] text-foreground/40">{v.probability}% probability</span>
                  </div>
                  <span className="text-[8px] text-muted-foreground/40">{v.timeToImpact}</span>
                </div>
                <p className="text-[10px] text-foreground/60 font-light select-text">{v.description}</p>
                {v.mitigationOptions?.length > 0 && (
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">Mitigation</p>
                    <ul className="space-y-0.5">
                      {v.mitigationOptions.map((m: string, j: number) => (
                        <li key={j} className="text-[9px] text-foreground/50 select-text">◈ {m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Resources ── */}
        {tab === "resources" && resources && (
          <div className="space-y-4">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Resource Security Scores</h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Economic Health", value: resources.economicHealth },
                { label: "Food Security", value: resources.foodSecurity },
                { label: "Energy Security", value: resources.energySecurity },
                { label: "Water Stress", value: resources.waterStress },
                { label: "Infrastructure", value: resources.infrastructureResilience },
              ].map((r, i) => (
                <div key={i} className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] text-center">
                  <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">{r.label}</p>
                  <p className={`text-2xl font-light mt-2 ${(r.value || 0) >= 70 ? "text-emerald-400/70" : (r.value || 0) >= 40 ? "text-amber-400/70" : "text-red-400/70"}`}>
                    {r.value || 0}
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                    <div className={`h-full rounded-full ${(r.value || 0) >= 70 ? "bg-emerald-400/40" : (r.value || 0) >= 40 ? "bg-amber-400/40" : "bg-red-400/40"}`}
                      style={{ width: `${r.value || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {resources.indicators?.length > 0 && (
              <>
                <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Key Indicators</h3>
                <div className="space-y-1.5">
                  {resources.indicators.map((ind: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground/60 select-text">{ind.name}</span>
                        <span className="text-[8px] text-muted-foreground/30">({ind.source})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground/70 select-text">{ind.value}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase ${ind.trend === "improving" ? "text-emerald-400/70 bg-emerald-500/10" : ind.trend === "declining" || ind.trend === "critical" ? "text-red-400/70 bg-red-500/10" : "text-foreground/40 bg-foreground/[0.04]"}`}>
                          {ind.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Policy Simulations ── */}
        {tab === "policy" && (
          <div className="space-y-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Policy Simulations ({policies.length})</h3>
            {policies.map((p: any, i: number) => (
              <div key={p.id || i} className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-foreground/70 select-text">{p.policy}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase border ${severityBadge(p.riskLevel)}`}>{p.riskLevel} risk</span>
                </div>
                <p className="text-[10px] text-foreground/55 font-light select-text">{p.projectedOutcome}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">Time to Effect</p>
                    <p className="text-[9px] text-foreground/50 select-text">{p.timeToEffect}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">Confidence</p>
                    <p className="text-[9px] text-foreground/50">{p.confidenceInOutcome}%</p>
                  </div>
                </div>
                {p.sideEffects?.length > 0 && (
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">Side Effects</p>
                    <ul className="space-y-0.5">
                      {p.sideEffects.map((s: string, j: number) => (
                        <li key={j} className="text-[9px] text-foreground/50 select-text">◈ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.historicalAnalog && (
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">Historical Analog</p>
                    <p className="text-[9px] text-foreground/50 select-text">{p.historicalAnalog}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Timeline Divergences ── */}
        {tab === "timeline" && (
          <div className="space-y-3">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Timeline Divergences ({divergences.length})</h3>
            {divergences.map((d: any, i: number) => (
              <div key={d.id || i} className="p-4 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] space-y-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-foreground/40" />
                  <p className="text-[11px] font-medium text-foreground/70 select-text">{d.inflectionPoint}</p>
                </div>
                {d.criticalDate && (
                  <p className="text-[8px] text-muted-foreground/40">Critical date: {d.criticalDate}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03]">
                    <p className="text-[8px] uppercase tracking-wider text-emerald-400/50 mb-1">Branch A ({d.branchA?.probability}%)</p>
                    <p className="text-[9px] text-foreground/55 select-text">{d.branchA?.description}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.03]">
                    <p className="text-[8px] uppercase tracking-wider text-amber-400/50 mb-1">Branch B ({d.branchB?.probability}%)</p>
                    <p className="text-[9px] text-foreground/55 select-text">{d.branchB?.description}</p>
                  </div>
                </div>
                {d.keyIndicators?.length > 0 && (
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 mb-1">What to Watch</p>
                    <ul className="space-y-0.5">
                      {d.keyIndicators.map((k: string, j: number) => (
                        <li key={j} className="text-[9px] text-foreground/50 select-text">◈ {k}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AxrlenAnalysis;
