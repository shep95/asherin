import { useMemo, useState } from "react";
import {
  Shield, Zap, GitBranch, AlertTriangle, Globe, BarChart3, ChevronRight,
  Copy, Check, Download, CalendarClock, Brain, FileText, Activity, Layers,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AxrlenSession } from "./AxrlenView";

interface Props { session: AxrlenSession; }

const severityBadge = (s: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-300/80 border-red-500/20",
    high: "bg-amber-500/15 text-amber-300/80 border-amber-500/20",
    elevated: "bg-amber-500/15 text-amber-300/80 border-amber-500/20",
    medium: "bg-yellow-500/15 text-yellow-300/80 border-yellow-500/20",
    guarded: "bg-yellow-500/15 text-yellow-300/80 border-yellow-500/20",
    low: "bg-emerald-500/15 text-emerald-300/80 border-emerald-500/20",
  };
  return colors[s?.toLowerCase?.() || ""] || colors.medium;
};

const vitalTone = (v: number) =>
  v >= 70 ? "text-emerald-400/80" : v >= 40 ? "text-amber-400/80" : "text-red-400/80";
const vitalBar = (v: number) =>
  v >= 70 ? "bg-emerald-400/50" : v >= 40 ? "bg-amber-400/50" : "bg-red-400/50";

/* ── Glass tile primitive ── */
const Tile = ({
  title, icon: Icon, className = "", children, action,
}: {
  title?: string;
  icon?: any;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div
    className={`relative rounded-2xl border border-border/[0.08] bg-gradient-to-br from-foreground/[0.025] via-foreground/[0.015] to-transparent
                backdrop-blur-xl overflow-hidden flex flex-col min-h-0 ${className}`}
  >
    {title && (
      <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/[0.05]">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-foreground/55" strokeWidth={1.5} />}
          <h3 className="text-[11px] uppercase tracking-[0.26em] text-foreground/85 font-normal">{title}</h3>
        </div>
        {action}
      </div>
    )}
    <div className="flex-1 min-h-0 overflow-auto px-4 py-3 select-text">{children}</div>
    {/* hairline corner gloss */}
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
  </div>
);

/* ── Circular Confidence HUD ── */
const ConfidenceRing = ({ value }: { value: number }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value || 0));
  const dash = (pct / 100) * c;
  const tone =
    pct >= 70 ? "stroke-emerald-400/85" :
    pct >= 40 ? "stroke-amber-400/85" :
    "stroke-red-400/80";
  return (
    <div className="relative h-[96px] w-[96px] shrink-0 aureon-confidence-pulse">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-foreground/[0.06]" strokeWidth="4" />
        <circle
          cx="40" cy="40" r={r}
          className={`fill-none ${tone} transition-all duration-700`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extralight tracking-tight text-foreground leading-none tabular-nums">{pct}</span>
        <span className="text-[8px] uppercase tracking-[0.32em] text-muted-foreground/55 mt-1">conf</span>
      </div>
    </div>
  );
};

const AxrlenDashboard = ({ session }: Props) => {
  const [copied, setCopied] = useState(false);
  const [expandedPred, setExpandedPred] = useState<string | null>(null);

  const predictions = useMemo(() => session.predictions || [], [session.predictions]);
  const threats = session.threatAssessment;
  const resources = session.resourceAnalysis;
  const policies = session.policySimulations || [];
  const divergences = session.timelineDivergences || [];

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
      `PREDICTIONS (${predictions.length})`,
    ];
    predictions.forEach((p: any, i: number) => {
      lines.push(`\n${i + 1}. [${p.severity?.toUpperCase()}] ${p.title}`);
      lines.push(`   Category: ${p.category} | Probability: ${p.probability}% | Timeframe: ${p.timeframe}`);
      lines.push(`   ${p.description}`);
      if (p.timingWindow) lines.push(`   Timing Window: ${p.timingWindow}`);
      if (p.temporalMultiplier) lines.push(`   Temporal Multiplier: ${p.temporalMultiplier}`);
      if (p.structuralAnalysis) lines.push(`   Structural Analysis: ${p.structuralAnalysis}`);
      if (p.actorIncentive) lines.push(`   Actor Incentive: ${p.actorIncentive}`);
      if (p.warStrategy) lines.push(`   War Strategy: ${p.warStrategy}`);
      if (p.publicSentiment) lines.push(`   Public Sentiment: ${p.publicSentiment}`);
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

  const threatLevel = (threats?.overallThreatLevel || "n/a").toString().toLowerCase();
  const threatTone =
    threatLevel === "critical" ? "text-red-400/80" :
    threatLevel === "elevated" || threatLevel === "high" ? "text-amber-400/80" :
    threatLevel === "guarded" || threatLevel === "medium" ? "text-yellow-400/80" :
    "text-emerald-400/80";

  const vitals: { label: string; value: number }[] = [
    { label: "Economy", value: resources?.economicHealth || 0 },
    { label: "Food", value: resources?.foodSecurity || 0 },
    { label: "Energy", value: resources?.energySecurity || 0 },
    { label: "Water", value: resources?.waterStress || 0 },
    { label: "Infra", value: resources?.infrastructureResilience || 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-background/40 relative aureon-grid-bg">
      {/* ── Top command strip ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/[0.05] flex items-stretch gap-3">
        <ConfidenceRing value={session.confidenceScore || 0} />
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-2">
          <Kpi label="Region" value={session.region || "Global"} />
          <Kpi label="Threat" value={threatLevel.toUpperCase()} tone={threatTone} />
          <Kpi label="Predictions" value={predictions.length} />
          <Kpi label="Sources" value={session.dataSources?.total || 0} />
        </div>
        <div className="flex items-start gap-1 shrink-0">
          <button
            onClick={() => copyText(session.aiSummary || "")}
            className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition"
            title="Copy summary"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400/70" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/[0.1] bg-foreground/[0.03] text-[9px] tracking-[0.18em] uppercase text-foreground/55 hover:bg-foreground/[0.07] transition"
          >
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      {/* ── Bento canvas ── */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gridAutoRows: "minmax(120px, auto)",
          }}
        >
          {/* Executive Summary — wide */}
          <Tile title="Executive Summary" icon={FileText} className="col-span-12 lg:col-span-8 row-span-2">
            <div className="prose prose-invert max-w-none text-[11px] leading-relaxed font-light text-foreground/70
                            [&_strong]:text-foreground/90 [&_strong]:font-medium [&_h1]:text-[12px] [&_h2]:text-[11px] [&_h3]:text-[11px]">
              <ReactMarkdown>{session.aiSummary || "_No summary available for this session._"}</ReactMarkdown>
            </div>
          </Tile>

          {/* Resource Vitals — right column, tall */}
          <Tile title="Resource Vitals" icon={Activity} className="col-span-12 lg:col-span-4 row-span-2">
            <div className="space-y-3">
              {vitals.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50">{r.label}</span>
                    <span className={`text-[11px] font-light tabular-nums ${vitalTone(r.value)}`}>{r.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-foreground/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${vitalBar(r.value)}`}
                      style={{ width: `${Math.max(2, r.value)}%` }}
                    />
                  </div>
                </div>
              ))}
              {resources?.indicators?.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border/[0.06] space-y-1">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Indicators</p>
                  {resources.indicators.slice(0, 6).map((ind: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[9px] text-foreground/55 truncate">{ind.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-foreground/70 tabular-nums">{ind.value}</span>
                        <span className={`px-1 py-0.5 rounded text-[7px] uppercase tracking-wider ${
                          ind.trend === "improving" ? "text-emerald-400/70 bg-emerald-500/10" :
                          ind.trend === "declining" || ind.trend === "critical" ? "text-red-400/70 bg-red-500/10" :
                          "text-foreground/40 bg-foreground/[0.05]"
                        }`}>{ind.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tile>

          {/* Predictions — left tall */}
          <Tile
            title={`Predictions · ${predictions.length}`}
            icon={Zap}
            className="col-span-12 lg:col-span-7 row-span-3"
          >
            {predictions.length === 0 && (
              <p className="text-[10px] text-muted-foreground/40 italic">No predictions generated.</p>
            )}
            <div className="space-y-1.5">
              {predictions.map((p: any, i: number) => {
                const key = p.id || `p-${i}`;
                const open = expandedPred === key;
                return (
                  <div key={key} className="rounded-xl border border-border/[0.07] bg-foreground/[0.015] hover:bg-foreground/[0.03] transition-all overflow-hidden">
                    <button
                      onClick={() => setExpandedPred(open ? null : key)}
                      className="w-full p-2.5 flex items-start gap-2 text-left"
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border shrink-0 ${severityBadge(p.severity)}`}>
                        {p.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-foreground/80 leading-snug">{p.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[8px] text-muted-foreground/50 tabular-nums">{p.probability}%</span>
                          <span className="text-[8px] text-muted-foreground/50">{p.timeframe}</span>
                          <span className="text-[8px] text-muted-foreground/50">{p.category}</span>
                          {p.temporalMultiplier && (
                            <span className="text-[7px] text-amber-300/60 px-1 py-0.5 rounded border border-amber-500/15 bg-amber-500/[0.05]">
                              ⊛ {String(p.temporalMultiplier).slice(0, 28)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`h-3 w-3 text-muted-foreground/30 mt-0.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                    </button>
                    {open && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/[0.05]">
                        <Field label="Analysis" text={p.description} />
                        {p.timingWindow && <Field label="Timing Window" text={p.timingWindow} icon={CalendarClock} />}
                        {p.temporalMultiplier && <Field label="Temporal Multiplier" text={p.temporalMultiplier} tone="text-amber-300/70" />}
                        {p.structuralAnalysis && <Field label="Structural Analysis" text={p.structuralAnalysis} icon={Layers} />}
                        {p.actorIncentive && <Field label="Actor Incentive" text={p.actorIncentive} />}
                        {p.warStrategy && <Field label="War Strategy" text={p.warStrategy} />}
                        {p.publicSentiment && <Field label="Public Sentiment" text={p.publicSentiment} icon={Brain} />}
                        {p.historicalPrecedent && <Field label="Historical Precedent" text={p.historicalPrecedent} />}
                        {p.dataPoints?.length > 0 && (
                          <div>
                            <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-1">Evidence</p>
                            <ul className="space-y-0.5">
                              {p.dataPoints.map((dp: string, j: number) => (
                                <li key={j} className="text-[9px] text-foreground/55 flex items-start gap-1.5">
                                  <span className="text-muted-foreground/30 mt-0.5">◈</span> {dp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {p.recommendedAction && <Field label="Recommended Action" text={p.recommendedAction} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Tile>

          {/* Threat Matrix */}
          <Tile
            title="Threat Matrix"
            icon={Shield}
            className="col-span-12 lg:col-span-5 row-span-3"
            action={
              <span className={`px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider border ${severityBadge(threatLevel)}`}>
                {threatLevel}
              </span>
            }
          >
            {!threats?.vectors?.length && (
              <p className="text-[10px] text-muted-foreground/40 italic">No threat vectors detected.</p>
            )}
            <div className="space-y-2">
              {(threats?.vectors || []).map((v: any, i: number) => (
                <div key={i} className="p-2.5 rounded-xl border border-border/[0.07] bg-foreground/[0.015] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className={`h-3 w-3 shrink-0 ${threatTone}`} strokeWidth={1.5} />
                      <span className="px-1 py-0.5 rounded text-[7px] uppercase border border-foreground/[0.1] bg-foreground/[0.04] text-foreground/60 shrink-0">{v.type}</span>
                      <span className="text-[8px] text-foreground/50 tabular-nums">{v.probability}%</span>
                    </div>
                    <span className="text-[8px] text-muted-foreground/40 shrink-0">{v.timeToImpact}</span>
                  </div>
                  <p className="text-[9px] text-foreground/60 leading-relaxed">{v.description}</p>
                  {v.actorIncentive && <p className="text-[8px] text-foreground/45 italic">◈ {v.actorIncentive}</p>}
                  {v.leadingIndicator && <p className="text-[8px] text-amber-300/55 italic">▲ {v.leadingIndicator}</p>}
                  {v.mitigationOptions?.length > 0 && (
                    <ul className="space-y-0.5 pt-1">
                      {v.mitigationOptions.map((m: string, j: number) => (
                        <li key={j} className="text-[8px] text-foreground/55">◈ {m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Tile>

          {/* Policy Simulations */}
          <Tile title={`Policy Simulations · ${policies.length}`} icon={Globe} className="col-span-12 lg:col-span-6 row-span-2">
            {!policies.length && <p className="text-[10px] text-muted-foreground/40 italic">No policy simulations.</p>}
            <div className="space-y-2">
              {policies.map((p: any, i: number) => (
                <div key={p.id || i} className="p-2.5 rounded-xl border border-border/[0.07] bg-foreground/[0.015] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium text-foreground/75 leading-snug min-w-0 truncate">{p.policy}</p>
                    <span className={`px-1 py-0.5 rounded text-[7px] uppercase border shrink-0 ${severityBadge(p.riskLevel)}`}>{p.riskLevel}</span>
                  </div>
                  <p className="text-[9px] text-foreground/55 leading-relaxed">{p.projectedOutcome}</p>
                  {p.philosophicalBasis && <p className="text-[8px] text-foreground/45 italic">⊛ {p.philosophicalBasis}</p>}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40">Time to Effect</p>
                      <p className="text-[9px] text-foreground/60">{p.timeToEffect}</p>
                    </div>
                    <div>
                      <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40">Confidence</p>
                      <p className="text-[9px] text-foreground/60 tabular-nums">{p.confidenceInOutcome}%</p>
                    </div>
                  </div>
                  {p.historicalAnalog && (
                    <p className="text-[8px] text-foreground/45"><span className="text-muted-foreground/40">Analog: </span>{p.historicalAnalog}</p>
                  )}
                </div>
              ))}
            </div>
          </Tile>

          {/* Timeline Divergences */}
          <Tile title={`Timeline Divergences · ${divergences.length}`} icon={GitBranch} className="col-span-12 lg:col-span-6 row-span-2">
            {!divergences.length && <p className="text-[10px] text-muted-foreground/40 italic">No divergences mapped.</p>}
            <div className="space-y-2">
              {divergences.map((d: any, i: number) => (
                <div key={d.id || i} className="p-2.5 rounded-xl border border-border/[0.07] bg-foreground/[0.015] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3 w-3 text-foreground/40" strokeWidth={1.5} />
                    <p className="text-[10px] font-medium text-foreground/75 leading-snug">{d.inflectionPoint}</p>
                  </div>
                  {d.criticalDate && <p className="text-[8px] text-muted-foreground/45">Critical: {d.criticalDate}</p>}
                  {d.decisionWindow && (
                    <p className="text-[8px] text-amber-300/55 italic flex items-center gap-1">
                      <CalendarClock className="h-2.5 w-2.5" /> {d.decisionWindow}
                    </p>
                  )}
                  {d.structuralTrigger && <p className="text-[8px] text-foreground/45 italic">◈ {d.structuralTrigger}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative p-3 rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent overflow-hidden">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-emerald-300/90">Branch A</span>
                        <span className="aureon-branch-pct text-[26px] text-emerald-300">{d.branchA?.probability ?? 0}<span className="text-[12px] text-emerald-300/60">%</span></span>
                      </div>
                      <p className="text-[9px] text-foreground/70 leading-snug">{d.branchA?.description}</p>
                    </div>
                    <div className="relative p-3 rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.04] to-transparent overflow-hidden">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[8px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">Branch B</span>
                        <span className="aureon-branch-pct text-[26px] text-amber-300">{d.branchB?.probability ?? 0}<span className="text-[12px] text-amber-300/60">%</span></span>
                      </div>
                      <p className="text-[9px] text-foreground/70 leading-snug">{d.branchB?.description}</p>
                    </div>
                  </div>
                  {d.keyIndicators?.length > 0 && (
                    <ul className="space-y-0.5">
                      {d.keyIndicators.map((k: string, j: number) => (
                        <li key={j} className="text-[8px] text-foreground/55">◈ {k}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Tile>

          {/* Data Sources footer tile */}
          {session.dataSources && (
            <Tile title="Data Sources" icon={Layers} className="col-span-12 row-span-1">
              <div className="flex flex-wrap gap-1.5">
                {(session.dataSources.list || session.dataSources.sources || []).slice(0, 40).map((s: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/[0.08] bg-foreground/[0.025] text-[8px] tracking-wider text-foreground/55">
                    <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
                    {typeof s === "string" ? s : s.name || s.label || "source"}
                  </span>
                ))}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border/[0.08] bg-foreground/[0.025] text-[8px] tracking-wider text-foreground/55 tabular-nums">
                  Σ {session.dataSources.total || 0}
                </span>
              </div>
            </Tile>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Helpers ── */
const Kpi = ({ label, value, tone }: { label: string; value: any; tone?: string }) => (
  <div className="rounded-xl border border-border/[0.08] bg-foreground/[0.025] px-3 py-2 flex flex-col justify-center">
    <p className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/55">{label}</p>
    <p className={`text-[16px] font-extralight mt-1 truncate tracking-tight ${tone || "text-foreground"}`}>{String(value)}</p>
  </div>
);

const Field = ({
  label, text, icon: Icon, italic, tone,
}: { label: string; text: string; icon?: any; italic?: boolean; tone?: string }) => (
  <div>
    <p className="text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5 flex items-center gap-1">
      {Icon && <Icon className="h-2 w-2" />} {label}
    </p>
    <p className={`text-[9px] leading-relaxed ${italic ? "italic" : ""} ${tone || "text-foreground/60"}`}>{text}</p>
  </div>
);

export default AxrlenDashboard;
