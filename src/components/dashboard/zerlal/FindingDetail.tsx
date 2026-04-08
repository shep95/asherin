import { ArrowLeft, ExternalLink, AlertTriangle, CheckCircle, Clock, Tag, Shield, Link2 } from "lucide-react";
import { mockFindings } from "./mockData";

interface FindingDetailProps {
  findingId: string;
  onBack: () => void;
}

const severityBg: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  info: "bg-muted/40 text-muted-foreground/60 border-border/20",
};

const FindingDetail = ({ findingId, onBack }: FindingDetailProps) => {
  const finding = mockFindings.find((f) => f.id === findingId);
  if (!finding) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground/30">Finding not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Back */}
        <button onClick={onBack} className="text-[10px] text-muted-foreground/30 hover:text-foreground/50 flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Back to findings
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column (2/3) */}
          <div className="col-span-2 space-y-5">
            {/* Title Block */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-[10px] px-2.5 py-1 rounded-md border ${severityBg[finding.severity]}`}>
                  {finding.severity.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground/40 font-mono">CVSS {finding.cvssScore}</span>
                <span className="text-[10px] text-muted-foreground/30 font-mono">{finding.cweId}</span>
              </div>
              <h1 className="text-sm font-light text-foreground/80 leading-relaxed">{finding.title}</h1>
              <div className="mt-3 p-3 rounded-lg bg-red-500/[0.03] border border-red-500/[0.06]">
                <h4 className="text-[9px] text-red-400/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Impact Statement
                </h4>
                <p className="text-[11px] text-foreground/50 leading-relaxed">{finding.impact}</p>
              </div>
            </div>

            {/* Vulnerable Code */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-5">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-3">Vulnerable Code</h3>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/30 rounded" />
                <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-4 pl-5 border border-red-500/10 text-foreground/60 overflow-x-auto whitespace-pre-wrap leading-6">
                  {finding.codeSnippet}
                </pre>
              </div>
              <div className="text-[9px] text-muted-foreground/25 mt-2 font-mono">
                {finding.file}:{finding.line}
              </div>
            </div>

            {/* Dataflow Trace */}
            {finding.dataflowTrace.length > 0 && (
              <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-5">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-3">Dataflow Trace</h3>
                <div className="relative space-y-0">
                  {finding.dataflowTrace.map((step, i) => (
                    <div key={i} className="flex gap-3 relative">
                      {/* Connector line */}
                      {i < finding.dataflowTrace.length - 1 && (
                        <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border/10" />
                      )}
                      <div className={`w-[19px] h-[19px] rounded-full flex items-center justify-center text-[8px] shrink-0 z-10 ${
                        i === 0
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                          : i === finding.dataflowTrace.length - 1
                            ? "bg-red-500/20 text-red-400 border border-red-500/20"
                            : "bg-foreground/[0.04] text-muted-foreground/40 border border-border/[0.08]"
                      }`}>
                        {i + 1}
                      </div>
                      <div className="pb-4">
                        <span className="text-[9px] font-mono text-muted-foreground/40">{step.file}:{step.line}</span>
                        <p className="text-[10px] text-foreground/50 mt-0.5">{step.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Fix */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-5">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-3 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-400/50" /> Suggested Fix
              </h3>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500/30 rounded" />
                <pre className="text-[10px] font-mono bg-background/60 rounded-lg p-4 pl-5 border border-emerald-500/10 text-emerald-300/70 overflow-x-auto whitespace-pre-wrap leading-6">
                  {finding.suggestedFix}
                </pre>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="px-4 py-2 rounded-lg bg-foreground/[0.06] text-[10px] text-foreground/60 hover:bg-foreground/[0.1] transition-colors">
                  Create PR with this fix
                </button>
                <button className="px-4 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                  Export to JIRA
                </button>
                <button className="px-4 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                  Export to Linear
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-4">
            {/* Metadata */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Metadata</h3>
              <div className="space-y-2.5">
                {[
                  ["Category", finding.category],
                  ["CWE", finding.cweId],
                  ["CVSS", finding.cvssScore.toString()],
                  ["Confidence", `${finding.confidence}%`],
                  ["Discovered", new Date(finding.discoveredAt).toLocaleDateString()],
                  ["Age", `${finding.age} days`],
                  ["Status", finding.status],
                  ["Assignee", finding.assignee || "Unassigned"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[9px] text-muted-foreground/30">{label}</span>
                    <span className="text-[9px] text-foreground/50">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Similar CVEs */}
            {finding.similarCves.length > 0 && (
              <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 space-y-2">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Similar CVEs
                </h3>
                {finding.similarCves.map((cve) => (
                  <div key={cve} className="text-[10px] text-foreground/40 font-mono hover:text-foreground/60 cursor-pointer flex items-center gap-1">
                    {cve} <ExternalLink className="h-2.5 w-2.5" />
                  </div>
                ))}
              </div>
            )}

            {/* Compliance */}
            {finding.complianceControls.length > 0 && (
              <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 space-y-2">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Compliance
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {finding.complianceControls.map((ctrl) => (
                    <span key={ctrl} className="text-[8px] px-2 py-0.5 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-muted-foreground/40">
                      {ctrl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 space-y-2">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Actions</h3>
              <div className="space-y-1.5">
                <button className="w-full text-left px-3 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors">
                  Assign to team member
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors">
                  Mark as false positive
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors">
                  Accept risk (waive)
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-foreground/[0.03] text-[10px] text-red-400/50 hover:text-red-400/70 hover:bg-red-500/[0.05] transition-colors">
                  Escalate to PagerDuty
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4 space-y-2">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Timeline
              </h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="w-1 h-1 rounded-full bg-foreground/10 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-[9px] text-muted-foreground/30">Discovered by deep scan</span>
                    <p className="text-[8px] text-muted-foreground/20">{new Date(finding.discoveredAt).toLocaleString()}</p>
                  </div>
                </div>
                {finding.assignee && (
                  <div className="flex gap-2">
                    <div className="w-1 h-1 rounded-full bg-foreground/10 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-[9px] text-muted-foreground/30">Assigned to {finding.assignee}</span>
                      <p className="text-[8px] text-muted-foreground/20">Auto-assigned by policy</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindingDetail;
