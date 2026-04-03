import React, { useState, useCallback } from "react";
import {
  X, Download, FileText, Code, Presentation, Globe, FileJson, Check,
  Eye, Shield, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowGraph } from "./workflowTypes";

interface Props {
  workflow: WorkflowGraph;
  onClose: () => void;
}

type ExportFormat = "json" | "markdown" | "mermaid" | "csv";
type PrivacyMode = "full" | "blur" | "diagrams_only";

const FORMATS: { id: ExportFormat; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: "json", icon: <FileJson className="h-4 w-4" />, label: "JSON Data", desc: "Complete workflow data structure" },
  { id: "markdown", icon: <FileText className="h-4 w-4" />, label: "Markdown Report", desc: "Formatted documentation" },
  { id: "mermaid", icon: <Code className="h-4 w-4" />, label: "Mermaid Diagram", desc: "Portable flowchart code" },
  { id: "csv", icon: <FileText className="h-4 w-4" />, label: "CSV Steps", desc: "Tabular step breakdown" },
];

const formatDur = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

const CrossWorkflowExport: React.FC<Props> = ({ workflow, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [includeScreenshots, setIncludeScreenshots] = useState(true);
  const [includeOptimizations, setIncludeOptimizations] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("full");
  const [isExporting, setIsExporting] = useState(false);

  const generateExport = useCallback(() => {
    setIsExporting(true);

    let content = "";
    let filename = "";
    let mime = "";

    switch (format) {
      case "json": {
        const data = {
          ...workflow,
          exported_at: new Date().toISOString(),
          export_settings: { includeScreenshots, includeOptimizations, privacyMode },
        };
        if (privacyMode === "diagrams_only") {
          data.nodes = data.nodes.map(n => ({ ...n, screenshotData: undefined, screenshotUrl: undefined }));
        }
        content = JSON.stringify(data, null, 2);
        filename = `workflow-${workflow.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
        mime = "application/json";
        break;
      }

      case "markdown": {
        const lines: string[] = [
          `# Workflow Report: ${workflow.name}`,
          "",
          `**Date:** ${new Date(workflow.startTime).toLocaleString()}`,
          `**Duration:** ${formatDur(workflow.metrics.totalDuration)}`,
          `**Status:** ${workflow.status}`,
          `**Efficiency Score:** ${workflow.metrics.efficiencyScore}%`,
          "",
          "## Metrics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Total Steps | ${workflow.metrics.totalSteps} |`,
          `| Decision Points | ${workflow.metrics.decisionPoints} |`,
          `| Applications Used | ${workflow.metrics.applicationsUsed} |`,
          `| Files Accessed | ${workflow.metrics.filesAccessed} |`,
          `| Active Time | ${formatDur(workflow.metrics.activeTime)} |`,
          `| Wait Time | ${formatDur(workflow.metrics.waitTime)} |`,
          `| Errors | ${workflow.metrics.errorCount} |`,
          `| Loops | ${workflow.metrics.loopCount} |`,
          "",
        ];

        if (workflow.phases.length > 0) {
          lines.push("## Phases", "");
          workflow.phases.forEach((phase, i) => {
            lines.push(`### Phase ${i + 1}: ${phase.name}`);
            lines.push(`- Duration: ${formatDur(phase.duration)}`);
            lines.push(`- Steps: ${phase.nodeIds.length}`);
            lines.push(`- Status: ${phase.status}`);
            lines.push("");
          });
        }

        if (includeTimeline) {
          lines.push("## Step-by-Step Breakdown", "");
          lines.push(`| # | Step | Type | Duration | Result |`);
          lines.push(`|---|------|------|----------|--------|`);
          workflow.nodes.forEach((node, i) => {
            lines.push(`| ${i + 1} | ${node.name} | ${node.type} | ${formatDur(node.duration)} | ${node.result || "—"} |`);
          });
          lines.push("");
        }

        if (includeOptimizations && workflow.insights.length > 0) {
          lines.push("## Insights & Optimizations", "");
          workflow.insights.forEach(insight => {
            lines.push(`### ${insight.title}`);
            lines.push(`- **Severity:** ${insight.severity}`);
            lines.push(`- **Type:** ${insight.type}`);
            lines.push(`- ${insight.description}`);
            if (insight.recommendation) lines.push(`- **Recommendation:** ${insight.recommendation}`);
            if (insight.potentialSavings) lines.push(`- **Potential Savings:** ${insight.potentialSavings}`);
            lines.push("");
          });
        }

        if (includeOptimizations && workflow.optimizations.length > 0) {
          lines.push("## Optimization Recommendations", "");
          workflow.optimizations.forEach((opt, i) => {
            lines.push(`### ${i + 1}. ${opt.title}`);
            lines.push(`- **Impact:** ${opt.impact} | **Effort:** ${opt.effort}`);
            lines.push(`- **Time Savings:** ${opt.savingsMinutes} minutes`);
            lines.push(`- **Current:** ${opt.currentApproach}`);
            lines.push(`- **Optimized:** ${opt.optimizedApproach}`);
            lines.push(`- **ROI:** ${opt.roi}`);
            lines.push("");
          });
        }

        lines.push("---", `*Generated by CROSS Workflow Intelligence — ${new Date().toISOString()}*`);
        content = lines.join("\n");
        filename = `workflow-report-${new Date().toISOString().slice(0, 10)}.md`;
        mime = "text/markdown";
        break;
      }

      case "mermaid": {
        const lines: string[] = ["graph TD"];
        workflow.nodes.forEach(node => {
          const label = node.name.replace(/"/g, "'");
          if (node.type === "decision") {
            lines.push(`  ${node.id}{{"${label}"}}`);
          } else {
            lines.push(`  ${node.id}["${label}"]`);
          }
        });
        workflow.edges.forEach(edge => {
          const arrow = edge.type === "conditional" ? "-.->" :
                        edge.type === "data_flow" ? "==>" :
                        "-->";
          const label = edge.label ? `|${edge.label}|` : "";
          lines.push(`  ${edge.source} ${arrow} ${label} ${edge.target}`);
        });
        // Style nodes by type
        const typeColors: Record<string, string> = {
          application: "#3b82f6", action: "#10b981", decision: "#f59e0b",
          data: "#a855f7", integration: "#06b6d4", wait: "#64748b",
        };
        const nodesByType: Record<string, string[]> = {};
        workflow.nodes.forEach(n => {
          if (!nodesByType[n.type]) nodesByType[n.type] = [];
          nodesByType[n.type].push(n.id);
        });
        Object.entries(nodesByType).forEach(([type, ids]) => {
          lines.push(`  style ${ids.join(",")} fill:${typeColors[type] || "#666"},color:#fff`);
        });
        content = lines.join("\n");
        filename = `workflow-diagram-${new Date().toISOString().slice(0, 10)}.mmd`;
        mime = "text/plain";
        break;
      }

      case "csv": {
        const headers = ["Step", "Name", "Type", "Duration (s)", "Result", "Timestamp"];
        const rows = workflow.nodes.map((n, i) => [
          i + 1, `"${n.name}"`, n.type, n.duration, n.result || "", n.timestamp,
        ]);
        content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        filename = `workflow-steps-${new Date().toISOString().slice(0, 10)}.csv`;
        mime = "text/csv";
        break;
      }
    }

    // Download
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setTimeout(() => setIsExporting(false), 1000);
  }, [format, workflow, includeScreenshots, includeOptimizations, includeTimeline, privacyMode]);

  return (
    <div className="border-t border-border/20 flex flex-col max-h-[45%] overflow-hidden">
      <div className="px-3 py-2 border-b border-border/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-foreground">Export Workflow</span>
        </div>
        <button onClick={onClose}><X className="h-3 w-3 text-muted-foreground/40" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Format selection */}
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Format</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${format === f.id ? "border-accent/30 bg-accent/5" : "border-border/15 hover:bg-muted/5"}`}
              >
                <span className="text-muted-foreground/60">{f.icon}</span>
                <div>
                  <p className="text-[10px] font-medium text-foreground">{f.label}</p>
                  <p className="text-[8px] text-muted-foreground/40">{f.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Include options */}
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Include</p>
          <div className="space-y-1">
            {[
              { label: "Step-by-step timeline", checked: includeTimeline, toggle: () => setIncludeTimeline(v => !v) },
              { label: "Optimization suggestions", checked: includeOptimizations, toggle: () => setIncludeOptimizations(v => !v) },
              { label: "Screenshots (if available)", checked: includeScreenshots, toggle: () => setIncludeScreenshots(v => !v) },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={opt.toggle}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] hover:bg-muted/5 transition"
              >
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${opt.checked ? "bg-accent/20 border-accent/30" : "border-border/30"}`}>
                  {opt.checked && <Check className="h-2.5 w-2.5 text-accent" />}
                </div>
                <span className="text-muted-foreground/60">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30">Privacy</p>
          <div className="flex gap-1.5">
            {([
              { id: "full" as const, label: "Full", icon: <Eye className="h-3 w-3" /> },
              { id: "blur" as const, label: "Blur Sensitive", icon: <Shield className="h-3 w-3" /> },
              { id: "diagrams_only" as const, label: "Diagrams Only", icon: <ImageIcon className="h-3 w-3" /> },
            ]).map(p => (
              <button
                key={p.id}
                onClick={() => setPrivacyMode(p.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] border transition ${privacyMode === p.id ? "border-accent/20 bg-accent/5 text-accent" : "border-border/15 text-muted-foreground/40 hover:bg-muted/5"}`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export button */}
        <Button
          onClick={generateExport}
          disabled={isExporting}
          className="w-full h-8 text-xs gap-1.5"
          size="sm"
        >
          {isExporting ? (
            <>Generating...</>
          ) : (
            <><Download className="h-3 w-3" /> Export {FORMATS.find(f => f.id === format)?.label}</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CrossWorkflowExport;
