import { useState } from "react";
import { Shield, TrendingUp, Zap, GitBranch, FileText, AlertTriangle, Globe, BarChart3, ChevronRight, Copy, Check, Download, Eye, Orbit, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AxrlenSession } from "./AxrlenView";

interface Props { session: AxrlenSession; }

type Tab = "overview" | "predictions" | "threats" | "resources" | "policy" | "timeline";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Summary", icon: FileText },
  { id: "predictions", label: "Predictions", icon: Zap },
  { id: "threats", label: "Threats", icon: Shield },
  { id: "resources", label: "Resources", icon: BarChart3 },
  { id: "policy", label: "Policy", icon: Globe },
  { id: "timeline", label: "Timeline", icon: GitBranch },
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

const AxrlenDashboard = ({ session }: Props) => {
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
      `AXRLEN INTELLIGENCE REPORT — NEXUS-PRIME 30-DOMAIN ANALYSIS`,
      `Generated: ${session.createdAt.toLocaleString()}`,
      `Region: ${session.region || "Global"}`,
      `Confidence: ${session.confidenceScore}%`,
      ``, `EXECUTIVE SUMMARY`, session.aiSummary || "N/A", ``,
      `PREDICTIONS (${(session.predictions || []).length})`,
    ];
    (session.predictions || []).forEach((p: any, i: number) => {
      lines.push(`\n${i + 1}. [${p.severity?.toUpperCase()}] ${p.title}`);
      lines.push(`   Category: ${p.category} | Probability: ${p.probability}% | Timeframe: ${p.timeframe}`);
      lines.push(`   ${p.description}`);
      if (p.vedicTiming) lines.push(`   Vedic Timing: ${p.vedicTiming}`);
      if (p.temporalMultiplier) lines.push(`   Temporal Multiplier: ${p.temporalMultiplier}`);
      if (p.esotericAnalysis) lines.push(`   Esoteric: ${p.esotericAnalysis}`);
      if (p.archetypeDriver) lines.push(`   Archetype: ${p.archetypeDriver}`);
      if (p.warStrategy) lines.push(`   War Strategy: ${p.warStrategy}`);
      if (p.consciousnessField) lines.push(`   Consciousness Field: ${p.consciousnessField}`);
      if (p.recommendedAction) lines.push(`   Action: ${p.recommendedAction}`);
      if (p.dataPoints?.length) lines.push(`   Evidence: ${p.dataPoints.join("; ")}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axrlen_${session.region || "global"}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const predictions = session.predictions || [];
  const threats = session.threatAssessment;
  const resources = session.resourceAnalysis;
  const policies = session.policySimulations || [];
  const divergences = session.timelineDivergences || [];

  return (
    <div className="flex flex-col h-full bg-background/60">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-2 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[8px] tracking-wide whitespace-nowrap border-b-2 transition-all ${tab === t.id
                ? "border-foreground/30 text-foreground/80"
                : "border-transparent text-muted-foreground/40 hover:text-foreground/50"}`}>
              <Icon className="h-2.5 w-2.5" />
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1 py-1.5">
          <button onClick={() => copyText(session.aiSummary || "")} className="p-1 rounded hover:bg-foreground/[0.06]">
            {copied ? <Check className="h-2.5 w-2.5 text-emerald-400/60" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground/30" />}
          </button>
          <button onClick={exportReport} className="flex items-center gap-1 px-2 py-0.5 rounded border border-border/[0.1] bg-foreground/[0.03] text-[8px] text-foreground/50 hover:bg-foreground/[0.06]">
            <Download className="h-2.5 w-2.5" /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 select-text">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Confidence", value: `${session.confidenceScore || 0}%` },
                { label: "Predictions", value: predictions.length },
                { label: "Threat Level", value: threats?.overallThreatLevel?.toUpperCase() || "N/A" },
                { label: "Sources", value: session.dataSources?.total || 0 },
              ].map((kpi, i) => (
                <div key={i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
                  <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground/40">{kpi.label}</p>
                  <p className="text-base font-light text-foreground/80 mt-0.5">{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl border border-border/[0.08] bg-foreground/[0.02] space-y-2">
              <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Executive Summary</h3>
              <div className="text-[10px] text-foreground/60 font-light leading-relaxed">
                <ReactMarkdown>{session.aiSummary || "No summary available."}</ReactMarkdown>
              </div>
            </div>
            {predictions.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Top Predictions</h3>
                {predictions.slice(0, 4).map((p: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg border border-border/[0.08] bg-foreground/[0.02] flex items-start gap-2">
                    <div className={`px-1 py-0.5 rounded text-[6px] uppercase tracking-wider border shrink-0 ${severityBadge(p.severity)}`}>
                      {p.severity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-medium text-foreground/70">{p.title}</p>
                      <p className="text-[7px] text-muted-foreground/40 mt-0.5">{p.probability}% · {p.timeframe} · {p.category}</p>
                      {p.temporalMultiplier && (
                        <p className="text-[6px] text-amber-400/50 mt-0.5">⊛ {p.temporalMultiplier}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Predictions ── */}
        {tab === "predictions" && (
          <div className="space-y-2">
            <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">All Predictions ({predictions.length})</h3>
            {predictions.map((p: any, i: number) => (
              <div key={p.id || i} className="rounded-xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                <button onClick={() => setExpandedPred(expandedPred === (p.id || `${i}`) ? null : (p.id || `${i}`))}
                  className="w-full p-3 flex items-start gap-2 text-left hover:bg-foreground/[0.02] transition-all">
                  <div className={`px-1 py-0.5 rounded text-[6px] uppercase tracking-wider border shrink-0 ${severityBadge(p.severity)}`}>{p.severity}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-foreground/70">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[7px] text-muted-foreground/40">{p.probability}%</span>
                      <span className="text-[7px] text-muted-foreground/40">{p.timeframe}</span>
                      <span className="text-[7px] text-muted-foreground/40">{p.category}</span>
                      {p.temporalMultiplier && (
                        <span className="text-[6px] text-amber-400/50 px-1 py-0.5 rounded border border-amber-500/10 bg-amber-500/[0.05]">
                          {typeof p.temporalMultiplier === 'string' && p.temporalMultiplier.length > 20 ? p.temporalMultiplier.slice(0, 20) + '…' : p.temporalMultiplier}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-muted-foreground/30 shrink-0 transition-transform ${expandedPred === (p.id || `${i}`) ? "rotate-90" : ""}`} />
                </button>
                {expandedPred === (p.id || `${i}`) && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/[0.06]">
                    <div className="pt-2">
                      <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Analysis</p>
                      <p className="text-[9px] text-foreground/60 leading-relaxed">{p.description}</p>
                    </div>
                    {p.vedicTiming && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5 flex items-center gap-1">
                          <Orbit className="h-2 w-2" /> Vedic Timing Grid
                        </p>
                        <p className="text-[9px] text-foreground/55 leading-relaxed">{p.vedicTiming}</p>
                      </div>
                    )}
                    {p.temporalMultiplier && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Temporal Multiplier</p>
                        <p className="text-[9px] text-amber-300/60 leading-relaxed">{p.temporalMultiplier}</p>
                      </div>
                    )}
                    {p.esotericAnalysis && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5 flex items-center gap-1">
                          <Eye className="h-2 w-2" /> Esoteric Analysis
                        </p>
                        <p className="text-[9px] text-foreground/55 leading-relaxed italic">{p.esotericAnalysis}</p>
                      </div>
                    )}
                    {p.archetypeDriver && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Archetype Driver</p>
                        <p className="text-[9px] text-foreground/55">{p.archetypeDriver}</p>
                      </div>
                    )}
                    {p.warStrategy && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">War Strategy Framework</p>
                        <p className="text-[9px] text-foreground/55">{p.warStrategy}</p>
                      </div>
                    )}
                    {p.consciousnessField && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5 flex items-center gap-1">
                          <Brain className="h-2 w-2" /> Consciousness Field
                        </p>
                        <p className="text-[9px] text-foreground/55">{p.consciousnessField}</p>
                      </div>
                    )}
                    {p.historicalPrecedent && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Historical Precedent</p>
                        <p className="text-[9px] text-foreground/55">{p.historicalPrecedent}</p>
                      </div>
                    )}
                    {p.dataPoints?.length > 0 && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Evidence</p>
                        <ul className="space-y-0.5">
                          {p.dataPoints.map((dp: string, j: number) => (
                            <li key={j} className="text-[8px] text-foreground/50 flex items-start gap-1.5">
                              <span className="text-muted-foreground/30 mt-0.5">◈</span> {dp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.recommendedAction && (
                      <div>
                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">Recommended Action</p>
                        <p className="text-[9px] text-foreground/55">{p.recommendedAction}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Threats ── */}
        {tab === "threats" && threats && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${threats.overallThreatLevel === "critical" ? "text-red-400/70" : threats.overallThreatLevel === "elevated" ? "text-amber-400/70" : "text-emerald-400/70"}`} />
              <div>
                <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40">Overall Threat Level</p>
                <p className="text-sm font-light text-foreground/80 uppercase tracking-wider">{threats.overallThreatLevel}</p>
              </div>
            </div>
            {(threats.vectors || []).map((v: any, i: number) => (
              <div key={i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1 py-0.5 rounded text-[6px] uppercase border border-foreground/[0.1] bg-foreground/[0.04] text-foreground/50">{v.type}</span>
                    <span className="text-[8px] text-foreground/40">{v.probability}%</span>
                  </div>
                  <span className="text-[7px] text-muted-foreground/40">{v.timeToImpact}</span>
                </div>
                <p className="text-[9px] text-foreground/60">{v.description}</p>
                {v.archetypeDriver && (
                  <p className="text-[8px] text-foreground/45 italic">⊛ Archetype: {v.archetypeDriver}</p>
                )}
                {v.vedicIndicator && (
                  <p className="text-[8px] text-amber-300/50 italic">☉ Vedic: {v.vedicIndicator}</p>
                )}
                {v.mitigationOptions?.length > 0 && (
                  <ul className="space-y-0.5">
                    {v.mitigationOptions.map((m: string, j: number) => (
                      <li key={j} className="text-[8px] text-foreground/50">◈ {m}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Resources ── */}
        {tab === "resources" && resources && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Economy", value: resources.economicHealth },
                { label: "Food", value: resources.foodSecurity },
                { label: "Energy", value: resources.energySecurity },
                { label: "Water", value: resources.waterStress },
                { label: "Infra", value: resources.infrastructureResilience },
              ].map((r, i) => (
                <div key={i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] text-center">
                  <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40">{r.label}</p>
                  <p className={`text-lg font-light mt-1 ${(r.value || 0) >= 70 ? "text-emerald-400/70" : (r.value || 0) >= 40 ? "text-amber-400/70" : "text-red-400/70"}`}>
                    {r.value || 0}
                  </p>
                  <div className="mt-1.5 h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                    <div className={`h-full rounded-full ${(r.value || 0) >= 70 ? "bg-emerald-400/40" : (r.value || 0) >= 40 ? "bg-amber-400/40" : "bg-red-400/40"}`}
                      style={{ width: `${r.value || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {resources.indicators?.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Key Indicators</h3>
                {resources.indicators.map((ind: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/[0.08] bg-foreground/[0.02]">
                    <span className="text-[9px] text-foreground/60">{ind.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-foreground/70">{ind.value}</span>
                      <span className={`px-1 py-0.5 rounded text-[6px] uppercase ${ind.trend === "improving" ? "text-emerald-400/70 bg-emerald-500/10" : ind.trend === "declining" || ind.trend === "critical" ? "text-red-400/70 bg-red-500/10" : "text-foreground/40 bg-foreground/[0.04]"}`}>
                        {ind.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Policy ── */}
        {tab === "policy" && (
          <div className="space-y-2">
            <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Policy Simulations ({policies.length})</h3>
            {policies.map((p: any, i: number) => (
              <div key={p.id || i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-foreground/70">{p.policy}</p>
                  <span className={`px-1 py-0.5 rounded text-[6px] uppercase border ${severityBadge(p.riskLevel)}`}>{p.riskLevel}</span>
                </div>
                <p className="text-[9px] text-foreground/55">{p.projectedOutcome}</p>
                {p.philosophicalBasis && (
                  <p className="text-[8px] text-foreground/45 italic">⊛ Framework: {p.philosophicalBasis}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[7px] uppercase text-muted-foreground/40">Time to Effect</p>
                    <p className="text-[8px] text-foreground/50">{p.timeToEffect}</p>
                  </div>
                  <div>
                    <p className="text-[7px] uppercase text-muted-foreground/40">Confidence</p>
                    <p className="text-[8px] text-foreground/50">{p.confidenceInOutcome}%</p>
                  </div>
                </div>
                {p.historicalAnalog && (
                  <div>
                    <p className="text-[7px] uppercase text-muted-foreground/40">Historical Analog</p>
                    <p className="text-[8px] text-foreground/50">{p.historicalAnalog}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Timeline ── */}
        {tab === "timeline" && (
          <div className="space-y-2">
            <h3 className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">Timeline Divergences ({divergences.length})</h3>
            {divergences.map((d: any, i: number) => (
              <div key={d.id || i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3 w-3 text-foreground/40" />
                  <p className="text-[10px] font-medium text-foreground/70">{d.inflectionPoint}</p>
                </div>
                {d.criticalDate && <p className="text-[7px] text-muted-foreground/40">Critical: {d.criticalDate}</p>}
                {d.vedicWindow && (
                  <p className="text-[8px] text-amber-300/50 italic flex items-center gap-1">
                    <Orbit className="h-2 w-2" /> Vedic Window: {d.vedicWindow}
                  </p>
                )}
                {d.esotericTrigger && (
                  <p className="text-[8px] text-foreground/45 italic">⊛ Esoteric Trigger: {d.esotericTrigger}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03]">
                    <p className="text-[7px] uppercase text-emerald-400/50 mb-0.5">Branch A ({d.branchA?.probability}%)</p>
                    <p className="text-[8px] text-foreground/55">{d.branchA?.description}</p>
                  </div>
                  <div className="p-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03]">
                    <p className="text-[7px] uppercase text-amber-400/50 mb-0.5">Branch B ({d.branchB?.probability}%)</p>
                    <p className="text-[8px] text-foreground/55">{d.branchB?.description}</p>
                  </div>
                </div>
                {d.keyIndicators?.length > 0 && (
                  <ul className="space-y-0.5">
                    {d.keyIndicators.map((k: string, j: number) => (
                      <li key={j} className="text-[8px] text-foreground/50">◈ {k}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AxrlenDashboard;
