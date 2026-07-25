import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Brain, Activity, Clock, Loader2,
  Shield, UserMinus, DollarSign, Package, Target,
  ExternalLink, Calendar, Zap, Search, ChevronDown, ChevronUp,
  TrendingUp, AlertTriangle, Sparkles, Eye, History,
  GitBranch, Scale, BarChart3, Layers, ArrowRight, Gauge, Timer,
  XCircle, CheckCircle2, Database, FlaskConical, Radio
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

const DataIntegrationEngine = lazy(() => import("./intel/DataIntegrationEngine"));
const ScenarioModelingEngine = lazy(() => import("./intel/ScenarioModelingEngine"));
const SignalDetectionEngine = lazy(() => import("./intel/SignalDetectionEngine"));

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

interface ProgressEvent {
  type: string;
  step?: string;
  message?: string;
  progress?: number;
  total?: number;
  eventType?: string;
  signals?: { name: string; strength: number }[];
  count?: number;
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
  const [progressData, setProgressData] = useState<ProgressEvent | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<"predictions" | "data-integration" | "scenario-modeling" | "signal-detection">("predictions");
  const abortRef = useRef<AbortController | null>(null);
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
    setGenerationError(null);
    setProgressData(null);
    setProgressLog([]);

    const controller = new AbortController();
    abortRef.current = controller;

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
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Generation failed (HTTP ${res.status})`);
      }

      // Check if response is SSE stream or JSON
      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 2);

            if (!chunk.startsWith("data: ")) continue;
            const jsonStr = chunk.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event: ProgressEvent = JSON.parse(jsonStr);
              setProgressData(event);

              if (event.message) {
                setProgressLog(prev => [...prev.slice(-20), event.message!]);
              }

              if (event.type === "complete") {
                toast({ title: "Analysis Complete", description: event.message || `Generated ${event.count} predictions` });
                await loadPredictions();
                setShowSettings(false);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } else {
        // Fallback: non-streaming JSON response
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        toast({ title: "Analysis Complete", description: `Generated ${result.count} predictions for ${companyInput}` });
        await loadPredictions();
        setShowSettings(false);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        setGenerationError("Analysis cancelled.");
      } else {
        const msg = e.message || "Could not generate predictions.";
        setGenerationError(msg);
        toast({ title: "Generation Failed", description: msg, variant: "destructive" });
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
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

  const getHC = (prediction: Prediction) => prediction.historical_comparison || {};

  const getTitle = (prediction: Prediction) => {
    const hc = getHC(prediction);
    if (hc.prediction_title) return hc.prediction_title;
    const firstLine = prediction.prediction_text.split("\n")[0];
    return firstLine.length > 120 ? firstLine.slice(0, 120) + "…" : firstLine;
  };

  const MiniBar = ({ value, color = "purple" }: { value: number; color?: string }) => (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-card/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            color === "emerald" ? "bg-emerald-400" :
            color === "amber" ? "bg-amber-400" :
            color === "red" ? "bg-red-400" :
            value > 0.7 ? "bg-emerald-400" : value > 0.4 ? "bg-amber-400" : "bg-red-400"
          }`}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/60 w-8 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );

  const progressPercent = progressData?.progress && progressData?.total
    ? Math.round((progressData.progress / progressData.total) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Engine Tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 p-2 border-b border-border/20 bg-card/10 overflow-x-auto">
        {[
          { id: "predictions" as const, label: "Predictions", icon: Brain },
          { id: "data-integration" as const, label: "Data Integration", icon: Database },
          { id: "scenario-modeling" as const, label: "Scenario Modeling", icon: FlaskConical },
          { id: "signal-detection" as const, label: "Signal Detection", icon: Radio },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveEngine(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
              activeEngine === tab.id
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
            }`}>
            <tab.icon className="h-3 w-3" /> {tab.label}
          </button>
        ))}
      </div>

      {activeEngine === "data-integration" ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-purple-400" /></div>}><DataIntegrationEngine /></Suspense>
      ) : activeEngine === "scenario-modeling" ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-purple-400" /></div>}><ScenarioModelingEngine /></Suspense>
      ) : activeEngine === "signal-detection" ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-purple-400" /></div>}><SignalDetectionEngine /></Suspense>
      ) : (
      <>
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border/20 bg-card/20 backdrop-blur-sm space-y-4">

        {showSettings && (
          <div className="rounded-xl border border-purple-500/20 bg-card/30 backdrop-blur-sm p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Asherin's prediction algorithm: signal detection → scoring → Jaccard pattern matching → 5-factor confidence → time estimation → AI intelligence briefing.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={companyInput}
                onChange={e => setCompanyInput(e.target.value)}
                placeholder="e.g., Tesla, Meta, Apple..."
                className="flex-1 bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-purple-500/40"
                onKeyDown={e => { if (e.key === "Enter" && !generating) generatePredictions(); }}
                disabled={generating}
              />
              {generating ? (
                <button
                  onClick={cancelGeneration}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all text-sm flex-shrink-0"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </button>
              ) : (
                <button
                  onClick={generatePredictions}
                  disabled={!companyInput.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all text-sm disabled:opacity-40 flex-shrink-0"
                >
                  <Sparkles className="h-4 w-4" />
                  Run Analysis
                </button>
              )}
            </div>

            {/* Progress Bar & Status */}
            {generating && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-400 font-medium flex items-center gap-1.5">
                      <Activity className="h-3 w-3 animate-pulse" />
                      {progressData?.message || "Initializing Asherin prediction engine..."}
                    </span>
                    <span className="text-muted-foreground/50 font-mono">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-card/30" />
                </div>
                
                {/* Live Log */}
                {progressLog.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-lg bg-background/30 border border-border/10 p-2 space-y-0.5">
                    {progressLog.map((log, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                        <div className={`w-1 h-1 rounded-full flex-shrink-0 ${idx === progressLog.length - 1 ? "bg-purple-400 animate-pulse" : "bg-muted-foreground/30"}`} />
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {generationError && !generating && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-400">Generation Failed</p>
                  <p className="text-[10px] text-red-400/70 mt-0.5">{generationError}</p>
                  <button
                    onClick={generatePredictions}
                    className="mt-2 text-[10px] text-red-400 underline hover:text-red-300"
                  >
                    Retry Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
            <h3 className="text-lg font-extralight tracking-wide text-foreground">Asherin Prediction Engine</h3>
            <p className="text-xs font-extralight leading-relaxed text-muted-foreground/70">
              Asherin searches for corporate signals, scores them by relevance/credibility/recency, matches patterns against historical precedents using Jaccard similarity, and calculates confidence with a 5-factor weighted model.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-violet-600/20 border border-purple-500/30 hover:from-purple-500/30 hover:to-violet-600/30 text-purple-400 transition-all text-xs font-light"
            >
              Run Asherin Prediction Algorithm
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
                <div key={prediction.id} className={`rounded-xl border transition-all overflow-hidden ${config.border}`}>
                  {/* Card header */}
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : prediction.id);
                      setExpandedSection("detail");
                    }}
                    className="w-full p-4 text-left hover:bg-foreground/5 transition-colors rounded-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
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
                              <span>{prediction.signals?.filter((s: any) => s.signalStrength > 0).length || 0} active signals</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <History className="h-3 w-3" />
                              <span>{hc.precedents?.length || 0} precedents</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              <span>{prediction.time_horizon}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Est. {new Date(prediction.estimated_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end gap-2 flex-shrink-0 mt-2 sm:mt-0">
                        <div className="text-right">
                          <div className={`text-lg sm:text-2xl font-light font-mono ${
                            prediction.confidence > 0.75 ? "text-emerald-400" :
                            prediction.confidence > 0.5 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {(prediction.confidence * 100).toFixed(0)}%
                          </div>
                          <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Confidence</div>
                        </div>
                        <svg width="48" height="48" className="transform -rotate-90 hidden sm:block">
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
                      <div className="flex items-center gap-1 p-3 border-b border-border/10 bg-background/10 overflow-x-auto">
                        {[
                          { id: "detail", label: "Intelligence Briefing", icon: Eye },
                          { id: "signals", label: "Signal Scores", icon: Gauge },
                          { id: "confidence", label: "5-Factor Model", icon: BarChart3 },
                          { id: "precedents", label: "Historical Matches", icon: History },
                          { id: "timing", label: "Time Estimation", icon: Timer },
                          { id: "chain", label: "Chain of Events", icon: GitBranch },
                          { id: "evidence", label: "Raw Evidence", icon: Layers },
                          { id: "reasoning", label: "Algorithm Steps", icon: Brain },
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

                      <div className="p-4 space-y-4 bg-background/20 overflow-hidden">
                        {/* Intelligence Briefing */}
                        {expandedSection === "detail" && (
                          <div className="space-y-4">
                            <div className="prose prose-sm prose-invert max-w-none break-words">
                              {prediction.prediction_text.split("\n\n").map((paragraph, idx) => (
                                <p key={idx} className="text-xs font-light text-foreground/80 leading-relaxed mb-3 break-words" style={{ overflowWrap: "anywhere" }}>
                                  {paragraph}
                                </p>
                              ))}
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

                        {/* Signal Scores */}
                        {expandedSection === "signals" && (
                          <div className="space-y-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                              Each signal scored by: Relevance (keyword match) + Credibility (source tier) + Recency (time decay) = Signal Strength
                            </p>
                            {prediction.signals && prediction.signals.length > 0 ? (
                              prediction.signals.map((signal: any, idx: number) => (
                                <div key={idx} className={`rounded-lg border p-4 space-y-3 ${
                                  signal.signalStrength > 0.5 ? "border-emerald-500/20 bg-emerald-500/5" :
                                  signal.signalStrength > 0.2 ? "border-amber-500/20 bg-amber-500/5" :
                                  "border-border/10 bg-card/20"
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-3.5 w-3.5 text-purple-400" />
                                      <span className="text-xs font-medium text-foreground">{signal.name || signal.type}</span>
                                      <span className="text-[9px] text-muted-foreground/40 font-mono">w={(signal.weight * 100).toFixed(0)}%</span>
                                    </div>
                                    <span className={`text-sm font-mono font-medium ${
                                      signal.signalStrength > 0.6 ? "text-emerald-400" :
                                      signal.signalStrength > 0.3 ? "text-amber-400" : "text-red-400"
                                    }`}>
                                      {(signal.signalStrength * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
                                    <div>
                                      <span className="text-muted-foreground/50 block mb-1">Relevance</span>
                                      <MiniBar value={signal.scores?.relevance || 0} />
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground/50 block mb-1">Credibility</span>
                                      <MiniBar value={signal.scores?.credibility || 0} />
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground/50 block mb-1">Recency</span>
                                      <MiniBar value={signal.scores?.recency || 0} />
                                    </div>
                                  </div>
                                  {signal.source && (
                                    <div className="border-t border-border/10 pt-2">
                                      <p className="text-[10px] text-foreground/60 line-clamp-1">{signal.source.title}</p>
                                      <a href={signal.source.url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 mt-0.5">
                                        {signal.source.domain} <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </div>
                                  )}
                                  {signal.historicalReliability != null && (
                                    <div className="text-[10px] text-muted-foreground/40">
                                      Historical reliability: {(signal.historicalReliability * 100).toFixed(0)}%
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No signal data available.</p>
                            )}
                          </div>
                        )}

                        {/* 5-Factor Model */}
                        {expandedSection === "confidence" && (
                          <div className="space-y-4">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                              Confidence = Σ(Factor × Weight) × Event Modifier − Uncertainty Penalty
                            </p>
                            {hc.confidence_factors ? (
                              <>
                                <div className="space-y-3">
                                  {[
                                    { key: "signalStrength", label: "Signal Strength", desc: "Active signals / expected signals", weight: 0.25, icon: Layers },
                                    { key: "signalQuality", label: "Signal Quality", desc: "Average signal strength score", weight: 0.25, icon: Gauge },
                                    { key: "historicalAccuracy", label: "Historical Accuracy", desc: "Past success rate for similar patterns", weight: 0.25, icon: History },
                                    { key: "recency", label: "Recency", desc: "Average temporal freshness of signals", weight: 0.15, icon: Clock },
                                    { key: "credibility", label: "Source Credibility", desc: "Average source tier score", weight: 0.10, icon: Shield },
                                  ].map(factor => {
                                    const value = hc.confidence_factors[factor.key] || 0;
                                    return (
                                      <div key={factor.key} className="rounded-lg border border-border/10 bg-card/20 p-3">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <factor.icon className="h-3.5 w-3.5 text-purple-400" />
                                            <span className="text-xs font-medium text-foreground">{factor.label}</span>
                                            <span className="text-[9px] font-mono text-muted-foreground/40">×{factor.weight}</span>
                                          </div>
                                          <span className="text-sm font-mono text-foreground">{(value * 100).toFixed(0)}%</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/40 mb-2">{factor.desc}</p>
                                        <MiniBar value={value} />
                                        <div className="text-[9px] font-mono text-muted-foreground/30 mt-1">
                                          Contribution: {(value * factor.weight * 100).toFixed(1)}%
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-purple-400">Final Confidence</span>
                                    <span className="text-xl font-mono text-purple-400">{(prediction.confidence * 100).toFixed(0)}%</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground/50 mt-1">After event-type modifier and uncertainty penalty</p>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-3">
                                {prediction.reasoning_chain?.filter((s: any) => s.description?.includes("Factor") || s.description?.includes("Confidence")).map((step: any, idx: number) => (
                                  <div key={idx} className="rounded-lg border border-border/10 bg-card/20 p-3">
                                    <p className="text-xs text-foreground mb-1">{step.description}</p>
                                    <p className="text-[10px] text-muted-foreground/60">{step.output}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Historical Matches */}
                        {expandedSection === "precedents" && (
                          <div className="space-y-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                              Jaccard Similarity: |Intersection| / |Union| of signal types
                            </p>
                            {hc.precedents && hc.precedents.length > 0 ? (
                              hc.precedents.map((prec: any, idx: number) => (
                                <div key={idx} className="rounded-lg border border-border/10 bg-card/20 p-4 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <History className="h-3.5 w-3.5 text-purple-400" />
                                      <span className="text-xs font-medium text-foreground">{prec.event}</span>
                                    </div>
                                    {prec.date && <span className="text-[10px] text-muted-foreground/50">{prec.date}</span>}
                                  </div>
                                  {prec.relevance && (
                                    <div className="pl-5 text-[10px]"><span className="text-purple-400 font-medium">{prec.relevance}</span></div>
                                  )}
                                  {prec.outcome && (
                                    <div className="pl-5">
                                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">Outcome: </span>
                                      <span className="text-xs text-foreground/70">{prec.outcome}</span>
                                    </div>
                                  )}
                                  {prec.signals_matched && (
                                    <div className="pl-5 flex flex-wrap gap-1 mt-1">
                                      {prec.signals_matched.map((sig: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                          {sig.replace(/_/g, " ")}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No historical precedents with sufficient similarity found.</p>
                            )}
                          </div>
                        )}

                        {/* Time Estimation */}
                        {expandedSection === "timing" && (
                          <div className="space-y-4">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                              Estimated date = Today + Average Historical Lead Time | Confidence Interval = ±1σ
                            </p>
                            {hc.timing ? (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="rounded-lg border border-border/10 bg-card/20 p-3 text-center">
                                    <div className="text-xl font-mono text-foreground">{hc.timing.avgLeadTime}d</div>
                                    <div className="text-[9px] text-muted-foreground/40 uppercase">Avg Lead Time</div>
                                  </div>
                                  <div className="rounded-lg border border-border/10 bg-card/20 p-3 text-center">
                                    <div className="text-xl font-mono text-foreground">±{hc.timing.stdDev}d</div>
                                    <div className="text-[9px] text-muted-foreground/40 uppercase">Std Deviation</div>
                                  </div>
                                  <div className="rounded-lg border border-border/10 bg-card/20 p-3 text-center">
                                    <div className="text-xl font-mono text-foreground">{hc.timing.patternsUsed}</div>
                                    <div className="text-[9px] text-muted-foreground/40 uppercase">Patterns Used</div>
                                  </div>
                                  <div className="rounded-lg border border-border/10 bg-card/20 p-3 text-center">
                                    <div className="text-xl font-mono text-purple-400">
                                      {new Date(prediction.estimated_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground/40 uppercase">Est. Date</div>
                                  </div>
                                </div>
                                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                                  <div className="text-[10px] text-muted-foreground/50 mb-3">Confidence Interval</div>
                                  <div className="relative h-8 bg-card/30 rounded-full overflow-hidden">
                                    <div className="absolute h-full bg-purple-500/20 rounded-full"
                                      style={{
                                        left: `${(hc.timing.confidenceInterval[0] / (hc.timing.confidenceInterval[1] * 1.3)) * 100}%`,
                                        width: `${((hc.timing.confidenceInterval[1] - hc.timing.confidenceInterval[0]) / (hc.timing.confidenceInterval[1] * 1.3)) * 100}%`,
                                      }}
                                    />
                                    <div className="absolute h-full w-0.5 bg-purple-400"
                                      style={{ left: `${(hc.timing.avgLeadTime / (hc.timing.confidenceInterval[1] * 1.3)) * 100}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[9px] text-muted-foreground/40 mt-1">
                                    <span>Earliest: {hc.timing.earliestDate ? new Date(hc.timing.earliestDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `${hc.timing.confidenceInterval[0]}d`}</span>
                                    <span className="text-purple-400 font-medium">Most likely: {new Date(prediction.estimated_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                    <span>Latest: {hc.timing.latestDate ? new Date(hc.timing.latestDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `${hc.timing.confidenceInterval[1]}d`}</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="rounded-lg border border-border/10 bg-card/20 p-4 text-center">
                                <p className="text-sm font-mono text-foreground mb-1">{prediction.time_horizon}</p>
                                <p className="text-[10px] text-muted-foreground/40">Est. {new Date(prediction.estimated_date).toLocaleDateString()}</p>
                              </div>
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
                                    {idx < hc.chain_of_events.length - 1 && <div className="w-px h-6 bg-purple-500/20" />}
                                  </div>
                                  <div className="flex-1 pt-1">
                                    <p className="text-xs font-light text-foreground/80 leading-relaxed">{step}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No chain of events mapped.</p>
                            )}
                          </div>
                        )}

                        {/* Raw Evidence */}
                        {expandedSection === "evidence" && (
                          <div className="space-y-2">
                            {prediction.signals && prediction.signals.filter((s: any) => s.source).length > 0 ? (
                              prediction.signals.filter((s: any) => s.source).map((signal: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/10 bg-card/20">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-light text-foreground mb-1">{signal.name || signal.type?.replace(/_/g, " ")}</p>
                                    <p className="text-[10px] text-foreground/70 line-clamp-1 mb-0.5">{signal.source.title}</p>
                                    <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mb-1.5">{signal.source.snippet}</p>
                                    <a href={signal.source.url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300">
                                      {signal.source.domain} <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
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
                              <p className="text-xs text-muted-foreground/50 text-center py-6">No raw evidence available.</p>
                            )}
                          </div>
                        )}

                        {/* Algorithm Steps */}
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
                                    <MiniBar value={step.confidence || 0} />
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
      </>
      )}
    </div>
  );
};

export default PredictiveIntelligenceView;
