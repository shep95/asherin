import { useState } from "react";
import { Database, Upload, BarChart3, AlertTriangle, TrendingUp, FileText, Loader2 } from "lucide-react";
import ZeeionUpload from "./ZeeionUpload";
import ZeeionDashboard from "./ZeeionDashboard";

export interface AnalysisResult {
  id: string;
  fileName: string;
  uploadedAt: Date;
  status: "processing" | "complete" | "error";
  summary?: {
    totalRecords: number;
    totalSpending: number;
    potentialSavings: number;
    efficiencyScore: number;
    anomalyCount: number;
    wastefulSpending: number;
    departmentCount: number;
  };
  executiveSummary?: string;
  wastefulItems?: { description: string; annualCost: number; recommendation: string; severity: string }[];
  savingsOpportunities?: { category: string; description: string; currentCost: number; projectedSavings: number; confidence: number }[];
  departmentPerformance?: { department: string; totalSpending: number; budget: number; variance: number; efficiencyScore: number }[];
  anomalies?: { type: string; severity: string; description: string; recommendation: string }[];
  categoryBreakdown?: { category: string; amount: number; percentage: number }[];
}

const ZeeionView = () => {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null);
  const [view, setView] = useState<"upload" | "dashboard">("upload");

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalyses(prev => [result, ...prev]);
    setActiveAnalysis(result);
    setView("dashboard");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-6 py-4 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center">
            <Database className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">ZEEION</h1>
            <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">Financial Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("upload")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
              view === "upload"
                ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          {analyses.length > 0 && (
            <button
              onClick={() => { setActiveAnalysis(analyses[0]); setView("dashboard"); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${
                view === "dashboard"
                  ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70"
                  : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "upload" ? (
          <ZeeionUpload onAnalysisComplete={handleAnalysisComplete} pastAnalyses={analyses} onViewAnalysis={(a) => { setActiveAnalysis(a); setView("dashboard"); }} />
        ) : activeAnalysis ? (
          <ZeeionDashboard analysis={activeAnalysis} />
        ) : null}
      </div>
    </div>
  );
};

export default ZeeionView;
