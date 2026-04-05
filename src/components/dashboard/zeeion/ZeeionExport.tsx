import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Loader2, CheckCircle } from "lucide-react";
import type { AnalysisResult } from "./ZeeionView";

interface Props {
  analysis: AnalysisResult;
}

const ZeeionExport = ({ analysis }: Props) => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());

  const exportCSV = () => {
    setExporting("csv");
    try {
      const rows: string[] = [];

      // Executive summary
      rows.push("=== ZEEION FINANCIAL ANALYSIS ===");
      rows.push(`File,${analysis.fileName}`);
      if (analysis.summary) {
        const s = analysis.summary;
        rows.push(`Total Spending,$${s.totalSpending}`);
        rows.push(`Potential Savings,$${s.potentialSavings}`);
        rows.push(`Efficiency Score,${s.efficiencyScore}/100`);
        rows.push(`Anomalies,${s.anomalyCount}`);
        rows.push(`Wasteful Spending,$${s.wastefulSpending}`);
        rows.push(`Total Records,${s.totalRecords}`);
        rows.push(`Departments,${s.departmentCount}`);
      }
      rows.push("");

      // Department performance
      if (analysis.departmentPerformance?.length) {
        rows.push("=== DEPARTMENT PERFORMANCE ===");
        rows.push("Department,Budget,Spent,Variance %,Efficiency Score");
        analysis.departmentPerformance.forEach(d => {
          rows.push(`${d.department},$${d.budget},$${d.totalSpending},${d.variance.toFixed(1)}%,${d.efficiencyScore}`);
        });
        rows.push("");
      }

      // Category breakdown
      if (analysis.categoryBreakdown?.length) {
        rows.push("=== CATEGORY BREAKDOWN ===");
        rows.push("Category,Amount,Percentage");
        analysis.categoryBreakdown.forEach(c => {
          rows.push(`${c.category},$${c.amount},${c.percentage}%`);
        });
        rows.push("");
      }

      // Savings
      if (analysis.savingsOpportunities?.length) {
        rows.push("=== SAVINGS OPPORTUNITIES ===");
        rows.push("Category,Description,Current Cost,Projected Savings,Confidence");
        analysis.savingsOpportunities.forEach(o => {
          rows.push(`${o.category},"${o.description}",$${o.currentCost},$${o.projectedSavings},${o.confidence}%`);
        });
        rows.push("");
      }

      // Wasteful items
      if (analysis.wastefulItems?.length) {
        rows.push("=== WASTEFUL SPENDING ===");
        rows.push("Description,Annual Cost,Severity,Recommendation");
        analysis.wastefulItems.forEach(w => {
          rows.push(`"${w.description}",$${w.annualCost},${w.severity},"${w.recommendation}"`);
        });
      }

      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      downloadBlob(blob, `zeeion-analysis-${Date.now()}.csv`);
      markExported("csv");
    } finally {
      setExporting(null);
    }
  };

  const exportJSON = () => {
    setExporting("json");
    try {
      const data = {
        metadata: { fileName: analysis.fileName, exportedAt: new Date().toISOString(), platform: "Zeeion Financial Intelligence" },
        summary: analysis.summary,
        executiveSummary: analysis.executiveSummary,
        departmentPerformance: analysis.departmentPerformance,
        categoryBreakdown: analysis.categoryBreakdown,
        savingsOpportunities: analysis.savingsOpportunities,
        wastefulItems: analysis.wastefulItems,
        anomalies: analysis.anomalies,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `zeeion-analysis-${Date.now()}.json`);
      markExported("json");
    } finally {
      setExporting(null);
    }
  };

  const exportText = () => {
    setExporting("text");
    try {
      const lines: string[] = [];
      lines.push("════════════════════════════════════════════════════");
      lines.push("  ZEEION FINANCIAL INTELLIGENCE — ANALYSIS REPORT  ");
      lines.push("════════════════════════════════════════════════════");
      lines.push("");
      lines.push(`File: ${analysis.fileName}`);
      lines.push(`Date: ${new Date().toLocaleDateString()}`);
      lines.push("");

      if (analysis.summary) {
        const s = analysis.summary;
        lines.push("─── KEY METRICS ───");
        lines.push(`  Total Spending:    $${s.totalSpending.toLocaleString()}`);
        lines.push(`  Potential Savings: $${s.potentialSavings.toLocaleString()}`);
        lines.push(`  Efficiency Score:  ${s.efficiencyScore}/100`);
        lines.push(`  Anomalies:         ${s.anomalyCount}`);
        lines.push(`  Wasteful Spending: $${s.wastefulSpending.toLocaleString()}`);
        lines.push(`  Records Analyzed:  ${s.totalRecords.toLocaleString()}`);
        lines.push("");
      }

      if (analysis.executiveSummary) {
        lines.push("─── EXECUTIVE SUMMARY ───");
        lines.push(analysis.executiveSummary);
        lines.push("");
      }

      if (analysis.departmentPerformance?.length) {
        lines.push("─── DEPARTMENT PERFORMANCE ───");
        analysis.departmentPerformance.forEach(d => {
          const status = d.efficiencyScore >= 80 ? "✓" : d.efficiencyScore >= 60 ? "⚠" : "✗";
          lines.push(`  ${status} ${d.department}: $${d.totalSpending.toLocaleString()} / $${d.budget.toLocaleString()} (${d.variance.toFixed(1)}% variance, score: ${d.efficiencyScore}/100)`);
        });
        lines.push("");
      }

      if (analysis.savingsOpportunities?.length) {
        lines.push("─── SAVINGS OPPORTUNITIES ───");
        analysis.savingsOpportunities.forEach((o, i) => {
          lines.push(`  ${i + 1}. ${o.description}`);
          lines.push(`     Save: $${o.projectedSavings.toLocaleString()}/yr | Confidence: ${o.confidence}%`);
        });
        lines.push("");
      }

      if (analysis.wastefulItems?.length) {
        lines.push("─── WASTEFUL SPENDING ───");
        analysis.wastefulItems.forEach((w, i) => {
          lines.push(`  ${i + 1}. [${w.severity.toUpperCase()}] ${w.description} — $${w.annualCost.toLocaleString()}/yr`);
          lines.push(`     → ${w.recommendation}`);
        });
        lines.push("");
      }

      if (analysis.anomalies?.length) {
        lines.push("─── ANOMALIES ───");
        analysis.anomalies.forEach((a, i) => {
          lines.push(`  ${i + 1}. [${a.severity.toUpperCase()}] ${a.description}`);
          lines.push(`     → ${a.recommendation}`);
        });
      }

      lines.push("");
      lines.push("════════════════════════════════════════════════════");
      lines.push("  Generated by Zeeion Financial Intelligence");
      lines.push("════════════════════════════════════════════════════");

      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      downloadBlob(blob, `zeeion-report-${Date.now()}.txt`);
      markExported("text");
    } finally {
      setExporting(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markExported = (type: string) => {
    setExported(prev => new Set(prev).add(type));
    setTimeout(() => setExported(prev => { const n = new Set(prev); n.delete(type); return n; }), 3000);
  };

  const formats = [
    {
      id: "csv",
      label: "CSV Spreadsheet",
      description: "Import into Excel, Google Sheets, or any analytics tool",
      icon: <FileSpreadsheet className="h-5 w-5" />,
      action: exportCSV,
    },
    {
      id: "json",
      label: "JSON Data",
      description: "Structured data for integrations, APIs, and custom processing",
      icon: <FileJson className="h-5 w-5" />,
      action: exportJSON,
    },
    {
      id: "text",
      label: "Executive Report",
      description: "Formatted text report for stakeholders and presentations",
      icon: <FileText className="h-5 w-5" />,
      action: exportText,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4 text-muted-foreground/40" />
          <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Export Analysis</h3>
        </div>
        <p className="text-[10px] text-foreground/50 font-light mb-5">
          Export your financial analysis in multiple formats. All exports include key metrics, department performance, savings opportunities, and anomalies.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {formats.map(f => (
            <button
              key={f.id}
              onClick={f.action}
              disabled={exporting !== null}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.05] disabled:opacity-50 transition-all text-center group"
            >
              <div className="text-muted-foreground/30 group-hover:text-foreground/50 transition-colors">
                {exporting === f.id ? <Loader2 className="h-5 w-5 animate-spin" /> : exported.has(f.id) ? <CheckCircle className="h-5 w-5 text-emerald-400/60" /> : f.icon}
              </div>
              <div>
                <p className="text-[10px] text-foreground/60 font-light">{f.label}</p>
                <p className="text-[8px] text-muted-foreground/30 mt-1">{f.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Data preview */}
      <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
        <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Export Preview</h3>
        <div className="grid grid-cols-2 gap-3 text-[9px]">
          <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.05] p-3">
            <p className="text-muted-foreground/30 uppercase tracking-wider text-[7px] mb-1">Records</p>
            <p className="text-foreground/60 font-light">{analysis.summary?.totalRecords.toLocaleString() ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.05] p-3">
            <p className="text-muted-foreground/30 uppercase tracking-wider text-[7px] mb-1">Departments</p>
            <p className="text-foreground/60 font-light">{analysis.summary?.departmentCount ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.05] p-3">
            <p className="text-muted-foreground/30 uppercase tracking-wider text-[7px] mb-1">Savings Items</p>
            <p className="text-foreground/60 font-light">{analysis.savingsOpportunities?.length ?? 0}</p>
          </div>
          <div className="rounded-xl bg-foreground/[0.03] border border-border/[0.05] p-3">
            <p className="text-muted-foreground/30 uppercase tracking-wider text-[7px] mb-1">Anomalies</p>
            <p className="text-foreground/60 font-light">{analysis.anomalies?.length ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZeeionExport;
