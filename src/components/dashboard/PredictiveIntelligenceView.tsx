import { useState, useEffect } from "react";
import {
  Brain, Activity, Clock, Loader2,
  Shield, UserMinus, DollarSign, Package, Target,
  ExternalLink, Calendar, Zap, Search, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Sparkles, Eye, History,
  GitBranch, Scale, BarChart3, Layers, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Prediction {
  id: string;
  company: string;
  event_type: string;
  prediction_text: string;
  confidence: number;
  severity: "critical" | "high" | "medium" | "low";
  time_horizon: string;
  estimated_date: string;
  signals: any[];
  reasoning_chain: any[];
  historical_comparison: any;
  status: string;
  created_at: string;
}

const eventIcons: Record<string, React.ElementType> = {
  regulatory_action: Shield,
  executive_departure: UserMinus,
  earnings_surprise: DollarSign,
  product_launch: Package,
  acquisition_target: Target,
  strategic_shift: GitBranch,
  financial_restructuring: BarChart3,
};

const eventNames: Record<string, string> = {
  regulatory_action: "Regulatory Action",
  executive_departure: "Executive Departure",
  earnings_surprise: "Earnings Surprise",
  product_launch: "Product Launch",
  acquisition_target: "Acquisition Activity",
  strategic_shift: "Strategic Shift",
  financial_restructuring: "Financial Restructuring",
};

const severityConfig: Record<string, { border: string; badge: string; dot: string }> = {
  critical: { border: "border-red-500/40 bg-red-500/5", badge: "bg-red-500/20 text-red-400 border-red-500/30", dot: "bg-red-500" },
  high: { border: "border-amber-500/40 bg-amber-500/5", badge: "bg-amber-500/20 text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  medium: { border: "border-blue-500/40 bg-blue-500/5", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
  low: { border: "border-emerald-500/40 bg-emerald-500/5", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
};

const PredictiveIntelligenceView = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>("detail");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    loadPredictions();
  }, [user]);

  const loadPredictions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user!.id)
      .in("status", ["active", "confirmed"])
      .order("confidence", { ascending: false });
    if (data) setPredictions(data as Prediction[]);
    setLoading(false);
  };

  const generatePredictions = async () => {
    if (!companyInput.trim()) {
      toast({ title: "Enter a company name", description: "Specify which company to analyze.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-predictions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ company: companyInput.trim() }),
        }
      );
      if (res.ok) {
        const result = await res.json();
        toast({ title: "Analysis Complete", description: `Generated ${result.count} deep predictions for ${companyInput}` });
        await loadPredictions();
        setShowSettings(false);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message || "Could not generate predictions.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  let filtered = selectedCategory === "all" ? predictions : predictions.filter(p => p.event_type === selectedCategory);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => p.company.toLowerCase().includes(q) || p.prediction_text.toLowerCase().includes(q));
  }

  const categoryStats = predictions.reduce((acc, p) => {
    acc[p.event_type] = (acc[p.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
      </div>
    );
  }

  // Helper to get historical comparison data
  const getHC = (prediction: Prediction) => prediction.historical_comparison || {};

  // Get the short title from historical_comparison or first line of prediction_text
  const getTitle = (prediction: Prediction) => {
    const hc = getHC(prediction);
    if (hc.prediction_title) return hc.prediction_title;
    const firstLine = prediction.prediction_text.split("\n")[0];
    return firstLine.length > 120 ? firstLine.slice(0, 120) + "…" : firstLine;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border/20 bg-card/20 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/30">
              <Brain className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-extralight tracking-wide text-foreground">
                Predictive Intelligence
              </h2>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase">
                Pattern-based forensic forecasting
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-violet-600/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-violet-600/30 text-purple-400 transition-all text-xs font-light"
          >
            <Zap className="h-3.5 w-3.5" />
            Analyze
          </button>
        </div>

        {/* Generate panel */}
        {showSettings && (
          <div className="rounded-xl border border-purple-500/20 bg-card/30 backdrop-blur-sm p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter a company to run deep pattern analysis — scans financial trajectories, historical precedents, executive movements, regulatory exposure, and competitive dynamics.
            </p>
            <div className="flex gap-2">
              <input
                value={companyInput}
                onChange={e => setCompanyInput(e.target.value)}
                placeholder="e.g., Tesla, Meta, Apple..."
                className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-purple-500/40"
                onKeyDown={e => { if (e.key === "Enter") generatePredictions(); }}
              />
              <button
                onClick={generatePredictions}
                disabled={generating || !companyInput.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all text-sm disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Analyzing..." : "Run Analysis"}
              </button>
            </div>
            {generating && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-purple-400/70">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Deep analysis in progress — scanning 7 intelligence categories...
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  {["Current Signals", "Historical Patterns", "Financial Data", "Executive Changes", "Legal/Regulatory", "Competitor Moves", "Industry Trends"].map(cat => (
                    <div key={cat} className="flex items-center gap-1.5 text-muted-foreground/50">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search & Filters */}
        {predictions.length > 0 && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search predictions..."
                className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  selectedCategory === "all"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "border border-border/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({predictions.length})
              </button>
              {Object.entries(categoryStats).map(([type, count]) => {
                const Icon = eventIcons[type] || Activity;
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedCategory(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      selectedCategory === type
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "border border-border/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {eventNames[type] || type} ({count})
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Empty state */}
      {predictions.length === 0 && !generating && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
          <div className="p-6 rounded-full bg-gradient-to-br from-purple-500/10 to-violet-600/10 border border-purple-500/20">
            <Brain className="h-16 w-16 text-purple-400/40" />
          </div>
          <div className="text-center max-w-md space-y-3">
            <h3 className="text-lg font-extralight tracking-wide text-foreground">No Predictions Yet</h3>
            <p className="text-xs font-extralight leading-relaxed text-muted-foreground/70">
              Run a deep analysis to generate pattern-based predictions. The engine scans historical precedents, financial trajectories, executive movements, and regulatory exposure to forecast what will happen — not just what people are talking about.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-violet-600/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-violet-600/30 text-purple-400 transition-all text-xs font-light"
            >
              Run Deep Analysis
            </button>
          </div>
        </div>
      )}

      {/* Predictions list */}
      {filtered.length > 0 && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 sm:p-6 space-y-4">
            {filtered.map(prediction => {
              const Icon = eventIcons[prediction.event_type] || Activity;
              const isExpanded = expandedId === prediction.id;
              const config = severityConfig[prediction.severity] || severityConfig.medium;
              const hc = getHC(prediction);
              const title = getTitle(prediction);

              return (
                <div key={prediction.id} className={`rounded-xl border transition-all ${config.border}`}>
                  {/* Card header */}
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : prediction.id);
                      setExpandedSection("detail");
                    }}
                    className="w-full p-4 text-left hover:bg-foreground/5 transition-colors rounded-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 p-2 rounded-lg bg-card/50 border border-border/20">
                          <Icon className="h-4 w-4 text-foreground/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider border ${config.badge}`}>
                              {prediction.severity}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40">•</span>
                            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                              {eventNames[prediction.event_type] || prediction.event_type}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground/70 mb-1.5">{prediction.company}</p>
                          <p className="text-sm font-light text-foreground leading-relaxed mb-3">{title}</p>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              <span>{prediction.signals?.length || 0} evidence sources</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <History className="h-3 w-3" />
                              <span>{hc.precedents?.length || 0} precedents</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{prediction.time_horizon}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Est. {new Date(prediction.estimated_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Confidence gauge */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className={`text-2xl font-light font-mono ${
                            prediction.confidence > 0.75 ? "text-emerald-400" :
                            prediction.confidence > 0.5 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {(prediction.confidence * 100).toFixed(0)}%
                          </div>
                          <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Confidence</div>
                        </div>
                        <svg width="48" height="48" className="transform -rotate-90">
                          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-border/20" />
                          <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3"
                            strokeDasharray={`${125.6 * prediction.confidence} 125.6`}
                            strokeLinecap="round"
                            className={prediction.confidence > 0.75 ? "text-emerald-400" : prediction.confidence > 0.5 ? "text-amber-400" : "text-red-400"}
                          />
                        </svg>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/10">
                      {/* Section tabs */}
                      <div className="flex items-center gap-1 p-3 border-b border-border/10 bg-background/10 overflow-x-auto">
                        {[
                          { id: "detail", label: "Full Analysis", icon: Eye },
                          { id: "precedents", label: "Historical Precedents", icon: History },
                          { id: "patterns", label: "Pattern Analysis", icon: TrendingUp },
                          { id: "chain", label: "Chain of Events", icon: GitBranch },
                          { id: "evidence", label: "Evidence", icon: Layers },
                          { id: "reasoning", label: "Reasoning", icon: Brain },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setExpandedSection(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                              expandedSection === tab.id
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                : "text-muted-foreground/60 hover:text-foreground"
                            }`}
                          >
                            <tab.icon className="h-3 w-3" />
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 space-y-4 bg-background/20">
                        {/* Full Analysis */}
                        {expandedSection === "detail" && (
                          <div className="space-y-4">
                            <div className="prose prose-sm prose-invert max-w-none">
                              {prediction.prediction_text.split("\n\n").map((paragraph, idx) => (
                                <p key={idx} className="text-xs font-light text-foreground/80 leading-relaxed mb-3">
                                  {paragraph}
                                </p>
                              ))}
                              {prediction.prediction_text.split("\n\n").length <= 1 && (
                                <p className="text-xs font-light text-foreground/80 leading-relaxed">
                                  {prediction.prediction_text}
                                </p>
                              )}
                            </div>
                            {hc.counter_arguments && (
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Scale className="h-3.5 w-3.5 text-amber-400" />
                                  <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">Counter-Arguments</span>
                                </div>
                                <p className="text-xs font-light text-foreground/70 leading-relaxed">{hc.counter_arguments}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Historical Precedents */}
                        {expandedSection === "precedents" && (
                          <div className="space-y-3">
                            {hc.precedents && hc.precedents.length > 0 ? (
                              hc.precedents.map((prec: any, idx: number) => (
                                <div key={idx} className="rounded-lg border border-border/10 bg-card/20 p-4 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-purple-400" />
                                    <span className="text-xs font-medium text-foreground">{prec.event}</span>
                                    {prec.date && (
                                      <span className="text-[10px] text-muted-foreground/50 ml-auto">{prec.date}</span>
                                    )}
                                  </div>
                                  {prec.outcome && (
                                    <div className="pl-5">
                                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">Outcome: </span>
                                      <span className="text-xs text-foreground/70">{prec.outcome}</span>
                                    </div>
                                  )}
                                  {prec.relevance && (
                                    <div className="pl-5">
                                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">Why this matters: </span>
                                      <span className="text-xs text-foreground/70">{prec.relevance}</span>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No historical precedents identified for this prediction.</p>
                            )}
                          </div>
                        )}

                        {/* Pattern Analysis */}
                        {expandedSection === "patterns" && (
                          <div className="space-y-3">
                            {hc.pattern_analysis ? (
                              Object.entries(hc.pattern_analysis)
                                .filter(([_, v]) => v && typeof v === "string" && (v as string).length > 5)
                                .map(([key, value]) => {
                                  const labelMap: Record<string, { label: string; icon: React.ElementType }> = {
                                    financial_trajectory: { label: "Financial Trajectory", icon: BarChart3 },
                                    structural_signals: { label: "Structural Signals", icon: Layers },
                                    regulatory_exposure: { label: "Regulatory Exposure", icon: Shield },
                                    competitive_pressure: { label: "Competitive Pressure", icon: Target },
                                    industry_context: { label: "Industry Context", icon: TrendingUp },
                                  };
                                  const cfg = labelMap[key] || { label: key.replace(/_/g, " "), icon: Activity };
                                  return (
                                    <div key={key} className="rounded-lg border border-border/10 bg-card/20 p-4">
                                      <div className="flex items-center gap-2 mb-2">
                                        <cfg.icon className="h-3.5 w-3.5 text-purple-400" />
                                        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">{cfg.label}</span>
                                      </div>
                                      <p className="text-xs font-light text-foreground/80 leading-relaxed">{value as string}</p>
                                    </div>
                                  );
                                })
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No pattern analysis available.</p>
                            )}
                          </div>
                        )}

                        {/* Chain of Events */}
                        {expandedSection === "chain" && (
                          <div className="space-y-1">
                            {hc.chain_of_events && hc.chain_of_events.length > 0 ? (
                              hc.chain_of_events.map((step: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3">
                                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                    <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-[10px] font-medium">
                                      {idx + 1}
                                    </div>
                                    {idx < hc.chain_of_events.length - 1 && (
                                      <div className="w-px h-6 bg-purple-500/20" />
                                    )}
                                  </div>
                                  <div className="flex-1 pt-1">
                                    <p className="text-xs font-light text-foreground/80 leading-relaxed">{step}</p>
                                  </div>
                                  {idx < hc.chain_of_events.length - 1 && (
                                    <ArrowRight className="h-3 w-3 text-purple-400/30 mt-2 flex-shrink-0" />
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No chain of events mapped.</p>
                            )}
                          </div>
                        )}

                        {/* Evidence (Signals) */}
                        {expandedSection === "evidence" && (
                          <div className="space-y-2">
                            {prediction.signals && prediction.signals.length > 0 ? (
                              prediction.signals.slice(0, 12).map((signal: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/10 bg-card/20 hover:bg-card/30 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-light text-foreground mb-1">
                                      {signal.name || signal.type?.replace(/_/g, " ")}
                                    </p>
                                    {signal.source && (
                                      <>
                                        <p className="text-[10px] text-foreground/70 line-clamp-1 mb-0.5">{signal.source.title}</p>
                                        <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mb-1.5">{signal.source.snippet}</p>
                                        {signal.source.url && (
                                          <a href={signal.source.url} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                                            <span>{signal.source.domain}</span>
                                            <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 text-[10px] text-muted-foreground/40 flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        (signal.scores?.credibility || 0) > 0.7 ? "bg-emerald-400" :
                                        (signal.scores?.credibility || 0) > 0.5 ? "bg-amber-400" : "bg-red-400"
                                      }`} />
                                      <span className="font-mono">{signal.scores?.credibility ? (signal.scores.credibility * 100).toFixed(0) : "?"}%</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No evidence sources available.</p>
                            )}
                          </div>
                        )}

                        {/* Reasoning Chain */}
                        {expandedSection === "reasoning" && prediction.reasoning_chain && (
                          <div className="space-y-3">
                            {prediction.reasoning_chain.map((step: any, idx: number) => (
                              <div key={idx} className="flex gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-[9px] font-medium">
                                  {step.step}
                                </div>
                                <div className="flex-1 pb-1">
                                  <p className="text-xs font-light text-foreground mb-0.5">{step.description}</p>
                                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{step.output}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-0.5 bg-card/30 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all ${
                                          step.confidence > 0.8 ? "bg-emerald-400" :
                                          step.confidence > 0.6 ? "bg-amber-400" : "bg-red-400"
                                        }`}
                                        style={{ width: `${(step.confidence || 0) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground/40">
                                      {((step.confidence || 0) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default PredictiveIntelligenceView;
