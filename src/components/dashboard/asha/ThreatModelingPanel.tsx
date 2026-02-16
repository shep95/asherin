import { useState } from "react";
import { Shield, Target, Users, TrendingDown, AlertTriangle, Loader2, Search, Building2, CreditCard, BarChart3, ArrowRight, Play, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

type ThreatType = "competitive" | "churn" | "fraud" | "market";

interface ThreatAnalysis {
  id: string;
  type: ThreatType;
  target: string;
  status: "idle" | "running" | "complete";
  response?: string;
  createdAt: Date;
}

const THREAT_TYPES = [
  { id: "competitive" as ThreatType, icon: Target, label: "Competitive Threat", desc: "Analyze competitor moves, patent filings, hiring patterns, and market positioning to predict their next actions.", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  { id: "churn" as ThreatType, icon: TrendingDown, label: "Customer Churn", desc: "Detect pre-churn behavioral patterns: login frequency, support tickets, feature adoption decline.", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { id: "fraud" as ThreatType, icon: Shield, label: "Fraud Detection", desc: "Flag anomalous transactions: impossible travel, velocity limit gaming, deviation scores.", color: "text-destructive border-destructive/30 bg-destructive/10" },
  { id: "market" as ThreatType, icon: BarChart3, label: "Market Risk", desc: "Macro-economic indicators, sector rotation signals, and regulatory environment changes.", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
];

const ThreatModelingPanel = () => {
  const [analyses, setAnalyses] = useState<ThreatAnalysis[]>([]);
  const [selectedType, setSelectedType] = useState<ThreatType | null>(null);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ThreatAnalysis | null>(null);
  const { user } = useAuth();

  const runAnalysis = async () => {
    if (!target.trim() || !user || !selectedType) return;
    setLoading(true);

    const analysis: ThreatAnalysis = {
      id: crypto.randomUUID(),
      type: selectedType,
      target: target.trim(),
      status: "running",
      createdAt: new Date(),
    };

    setAnalyses(prev => [analysis, ...prev]);
    setSelectedAnalysis(analysis);

    try {
      const { data: session } = await supabase.auth.getSession();
      const typeConfig = THREAT_TYPES.find(t => t.id === selectedType)!;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: `[THREAT MODELING — ${typeConfig.label.toUpperCase()}] Perform a comprehensive ${selectedType} threat analysis for "${target}". ${
            selectedType === "competitive" ? "Analyze their recent hires, patent filings, product launches, funding rounds, and market moves. Predict their next 6-12 month strategy. Identify which of our features are most exposed. Provide probability estimates and recommended defensive actions." :
            selectedType === "churn" ? "Analyze behavioral patterns that predict customer churn. Identify pre-churn signals (login decline, support escalation, feature stagnation). Provide a risk-scored list of accounts with recommended interventions and expected retention value." :
            selectedType === "fraud" ? "Analyze transaction patterns for anomalies. Look for impossible travel, velocity limit gaming, unusual timing patterns, and deviation from baseline behavior. Provide fraud probability scores and recommended actions (FREEZE, FLAG, MONITOR)." :
            "Analyze macro-economic indicators, sector trends, regulatory changes, and geopolitical risks. Provide probability-weighted scenarios and recommended portfolio/business adjustments."
          } Use BLUF format. Include confidence scores on every assessment. End with actionable recommendations with [ACTION BUTTONS] notation.`,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const result = await res.json();

      const updated = { ...analysis, status: "complete" as const, response: result.response };
      setAnalyses(prev => prev.map(a => a.id === analysis.id ? updated : a));
      setSelectedAnalysis(updated);
    } catch {
      setAnalyses(prev => prev.map(a => a.id === analysis.id ? { ...a, status: "complete" as const, response: "Analysis could not be completed. Please try again." } : a));
    } finally {
      setLoading(false);
      setTarget("");
      setSelectedType(null);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-border/20 bg-card/10 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-light tracking-wide text-foreground">Threat Modeling</h2>
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">
            Adversarial intelligence — predict threats before they materialize.
          </p>
        </div>

        {/* Threat type selector */}
        <div className="p-3 border-b border-border/20 space-y-2">
          {THREAT_TYPES.map(t => (
            <button key={t.id} onClick={() => setSelectedType(selectedType === t.id ? null : t.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedType === t.id ? t.color : "border-border/20 bg-card/20 hover:bg-foreground/5"}`}>
              <div className="flex items-center gap-2">
                <t.icon className="h-3.5 w-3.5" />
                <span className="text-xs font-light text-foreground">{t.label}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-1 line-clamp-2">{t.desc}</p>
            </button>
          ))}
        </div>

        {selectedType && (
          <div className="p-3 border-b border-border/20 space-y-2">
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder={selectedType === "competitive" ? "Competitor name…" : selectedType === "churn" ? "Customer segment…" : selectedType === "fraud" ? "Account or transaction…" : "Market/sector…"}
              className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <button onClick={runAnalysis} disabled={!target.trim() || loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/20 border border-destructive/30 py-2 text-xs text-destructive hover:bg-destructive/30 transition-colors disabled:opacity-40">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Threat Analysis
            </button>
          </div>
        )}

        {/* History */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {analyses.map(a => {
            const t = THREAT_TYPES.find(t => t.id === a.type)!;
            return (
              <button key={a.id} onClick={() => setSelectedAnalysis(a)}
                className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${selectedAnalysis?.id === a.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
                <div className="flex items-center gap-2">
                  <t.icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-light text-foreground truncate">{a.target}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/50">
                  <span>{t.label}</span>
                  <span>·</span>
                  {a.status === "running" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <span>{a.createdAt.toLocaleDateString()}</span>}
                </div>
              </button>
            );
          })}
          {analyses.length === 0 && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-8">No analyses yet. Select a threat type to begin.</p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {selectedAnalysis?.status === "complete" && selectedAnalysis.response ? (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-extralight tracking-wide text-foreground">{selectedAnalysis.target}</h2>
              <p className="text-xs text-muted-foreground mt-1">{THREAT_TYPES.find(t => t.id === selectedAnalysis.type)?.label} Analysis</p>
            </div>
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-6">
              <div className="prose prose-sm prose-invert max-w-none font-extralight [&_h1]:text-lg [&_h1]:font-light [&_h2]:text-base [&_h2]:font-light [&_h3]:text-sm [&_h3]:font-light [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_strong]:text-foreground [&_code]:text-xs">
                <ReactMarkdown>{selectedAnalysis.response}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : selectedAnalysis?.status === "running" ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <p className="text-sm font-extralight text-muted-foreground">Running adversarial analysis…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Shield className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-extralight text-muted-foreground">Select a threat type and target to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatModelingPanel;
