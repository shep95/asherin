import { useState, useEffect, useCallback } from "react";
import { TrendingUp, AlertTriangle, Calendar, BarChart3, Activity, Zap, Loader2, Upload, Database, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SeasonalityData { pattern: string; peakDay: string; troughDay: string; variance: number; confidence: number; dayBreakdown?: { day: string; value: number }[]; }
interface TrendData { direction: "up" | "down"; monthlyGrowth: number; r_squared: number; }
interface ChangePoint { date: string; shift: string; description: string; probability: number; }
interface Forecast { month: string; value: number; lower: number; upper: number; confidence: number; }
interface Correlation { series_a: string; series_b: string; lag: number; coefficient: number; relationship: string; }
interface Anomaly { date: string; metric: string; actual: number; expected: number; stdDevs: number; probability: string; severity: "critical" | "warning"; }

interface AnalysisResult {
  seasonality?: SeasonalityData;
  trend?: TrendData;
  changePoints?: ChangePoint[];
  forecasts?: Forecast[];
  correlations?: Correlation[];
  anomalies?: Anomaly[];
}

const severityStyles: Record<string, string> = { critical: "border-red-500/30 bg-red-500/5", warning: "border-amber-500/30 bg-amber-500/5" };

const TimeSeriesView = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<"overview" | "seasonality" | "forecast" | "correlations" | "anomalies">("overview");
  const [datasets, setDatasets] = useState<{ id: string; file_name: string }[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const sections = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "seasonality" as const, label: "Seasonality", icon: Activity },
    { id: "forecast" as const, label: "Forecast", icon: TrendingUp },
    { id: "correlations" as const, label: "Correlations", icon: Zap },
    { id: "anomalies" as const, label: "Anomalies", icon: AlertTriangle },
  ];

  const loadDatasets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("asha_datasets")
      .select("id, file_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDatasets((data ?? []) as { id: string; file_name: string }[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDatasets(); }, [loadDatasets]);

  const runAnalysis = async (datasetId: string) => {
    if (!user) return;
    setSelectedDataset(datasetId);
    setAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ query: `[TIME-SERIES ANALYSIS] Analyze dataset ${datasetId} for temporal patterns. Return ONLY valid JSON: {"seasonality":{"pattern":"Weekly|Monthly|Quarterly","peakDay":"Day","troughDay":"Day","variance":1.0,"confidence":90,"dayBreakdown":[{"day":"Mon","value":80}]},"trend":{"direction":"up|down","monthlyGrowth":2.3,"r_squared":0.87},"changePoints":[{"date":"YYYY-MM-DD","shift":"significant|moderate|minor","description":"text","probability":0.93}],"forecasts":[{"month":"Mon YYYY","value":143000,"lower":131000,"upper":155000,"confidence":85}],"correlations":[{"series_a":"name","series_b":"name","lag":11,"coefficient":0.78,"relationship":"text"}],"anomalies":[{"date":"YYYY-MM-DD","metric":"name","actual":3200,"expected":8400,"stdDevs":3.2,"probability":"0.07%","severity":"critical|warning"}]}` }),
      });
      if (res.ok) {
        const result = await res.json();
        const jsonMatch = (result.response || "").match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setAnalysis(parsed);
          setAnalyzing(false);
          return;
        }
      }
      throw new Error("Analysis failed");
    } catch {
      setAnalysis(null);
      setAnalyzing(false);
    }
  };

  const seasonality = analysis?.seasonality;
  const trend = analysis?.trend;
  const changePoints = analysis?.changePoints ?? [];
  const forecasts = analysis?.forecasts ?? [];
  const correlations = analysis?.correlations ?? [];
  const anomalies = analysis?.anomalies ?? [];

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">TIME-SERIES INTELLIGENCE</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Automated temporal analysis from your uploaded datasets</p>
          </div>
          {datasets.length > 0 && (
            <select
              value={selectedDataset ?? ""}
              onChange={e => { if (e.target.value) runAnalysis(e.target.value); }}
              className="rounded-xl border border-border/20 bg-card/20 px-3 py-2 text-xs text-foreground outline-none"
            >
              <option value="">Select dataset…</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.file_name}</option>)}
            </select>
          )}
        </div>
        {analysis && (
          <div className="flex gap-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-light transition-colors ${activeSection === s.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}>
                <s.icon className="h-3 w-3" /> {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* No datasets */}
          {datasets.length === 0 && !analyzing && (
            <div className="flex flex-col items-center justify-center py-20">
              <Upload className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-extralight text-muted-foreground">No datasets available</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Upload time-series data via Asha to activate temporal analysis</p>
            </div>
          )}

          {/* No analysis yet */}
          {datasets.length > 0 && !analysis && !analyzing && (
            <div className="flex flex-col items-center justify-center py-20">
              <Database className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-extralight text-muted-foreground">Select a dataset to analyze</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Choose from your uploaded datasets above</p>
            </div>
          )}

          {/* Analyzing */}
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
              <p className="text-sm font-extralight text-muted-foreground">Running time-series analysis…</p>
            </div>
          )}

          {/* Results */}
          {analysis && !analyzing && (
            <>
              {activeSection === "overview" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {trend && (
                      <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          {trend.direction === "up" ? <ArrowUpRight className="h-5 w-5 text-emerald-400" /> : <ArrowDownRight className="h-5 w-5 text-red-400" />}
                          <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Underlying Trend</p>
                        </div>
                        <p className="text-2xl font-extralight text-foreground">{trend.direction === "up" ? "+" : ""}{trend.monthlyGrowth}%</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Monthly growth (seasonal noise removed)</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-2">R² = {trend.r_squared}</p>
                      </div>
                    )}
                    {seasonality && (
                      <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Activity className="h-5 w-5 text-blue-400" />
                          <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Seasonality</p>
                        </div>
                        <p className="text-2xl font-extralight text-foreground">{seasonality.pattern}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Peak: {seasonality.peakDay} • Trough: {seasonality.troughDay}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-2">Seasonal index: {seasonality.variance} variance</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                        <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Active Anomalies</p>
                      </div>
                      <p className="text-2xl font-extralight text-foreground">{anomalies.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{anomalies.filter(a => a.severity === "critical").length} critical • {anomalies.filter(a => a.severity === "warning").length} warnings</p>
                      {anomalies[0] && <p className="text-[9px] text-muted-foreground/50 mt-2">Last detected: {anomalies[0].date}</p>}
                    </div>
                  </div>

                  {changePoints.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Change Point Detection</p>
                      {changePoints.map(cp => (
                        <div key={cp.date} className="rounded-xl border border-border/10 bg-card/20 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-accent" />
                              <span className="text-xs font-light text-foreground">{cp.date}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${cp.shift === "significant" ? "text-red-400 bg-red-500/10" : cp.shift === "moderate" ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground bg-muted/20"}`}>{cp.shift}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{(cp.probability * 100).toFixed(0)}% confidence</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{cp.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeSection === "seasonality" && seasonality && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/10 bg-card/20 p-6">
                    <h3 className="text-xs font-light text-foreground mb-4">Seasonality Decomposition</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-card/20 p-4"><p className="text-[10px] text-muted-foreground mb-1">Pattern</p><p className="text-lg font-extralight text-foreground">{seasonality.pattern}</p></div>
                      <div className="rounded-xl bg-card/20 p-4"><p className="text-[10px] text-muted-foreground mb-1">Confidence</p><p className="text-lg font-extralight text-foreground">{seasonality.confidence}%</p></div>
                      <div className="rounded-xl bg-card/20 p-4"><p className="text-[10px] text-muted-foreground mb-1">Peak</p><p className="text-lg font-extralight text-emerald-400">{seasonality.peakDay}</p></div>
                      <div className="rounded-xl bg-card/20 p-4"><p className="text-[10px] text-muted-foreground mb-1">Trough</p><p className="text-lg font-extralight text-red-400">{seasonality.troughDay}</p></div>
                    </div>
                    {seasonality.dayBreakdown && seasonality.dayBreakdown.length > 0 && (
                      <div className="mt-6 space-y-2">
                        {seasonality.dayBreakdown.map(d => (
                          <div key={d.day} className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground w-8">{d.day}</span>
                            <div className="flex-1 h-3 rounded-full bg-card/30 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.value}%`, background: d.value >= 90 ? "hsl(var(--accent))" : d.value >= 70 ? "hsl(var(--accent) / 0.6)" : "hsl(var(--accent) / 0.3)" }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-8 text-right">{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === "forecast" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Revenue Forecast</p>
                  {forecasts.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No forecast data available.</p>}
                  {forecasts.map(f => (
                    <div key={f.month} className="rounded-xl border border-border/10 bg-card/20 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-light text-foreground">{f.month}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded ${f.confidence >= 80 ? "text-emerald-400 bg-emerald-500/10" : f.confidence >= 70 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>{f.confidence}% confidence</span>
                      </div>
                      <p className="text-xl font-extralight text-foreground">${(f.value / 1000).toFixed(0)}K</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Range: ${(f.lower / 1000).toFixed(0)}K — ${(f.upper / 1000).toFixed(0)}K</p>
                      <div className="mt-2 h-2 rounded-full bg-card/30 overflow-hidden relative">
                        <div className="absolute h-full bg-accent/20 rounded-full" style={{ left: `${(f.lower / f.upper) * 100 - 10}%`, right: "0%" }} />
                        <div className="absolute h-full w-1 bg-accent rounded-full" style={{ left: `${(f.value / f.upper) * 100 - 5}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "correlations" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Cross-Series Correlation Analysis</p>
                  {correlations.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No correlations detected.</p>}
                  {correlations.map(c => (
                    <div key={c.series_a + c.series_b} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400">{c.series_a}</span>
                        <Zap className="h-3 w-3 text-accent" />
                        <span className="text-xs text-purple-400">{c.series_b}</span>
                      </div>
                      <p className="text-[10px] text-foreground/80">{c.relationship}</p>
                      <div className="flex gap-4">
                        <div><p className="text-[9px] text-muted-foreground">Lag</p><p className="text-xs text-foreground">{c.lag} days</p></div>
                        <div><p className="text-[9px] text-muted-foreground">Correlation</p><p className={`text-xs ${c.coefficient >= 0.8 ? "text-emerald-400" : c.coefficient >= 0.6 ? "text-amber-400" : "text-red-400"}`}>{c.coefficient}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "anomalies" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Detected Anomalies</p>
                  {anomalies.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No anomalies detected.</p>}
                  {anomalies.map(a => (
                    <div key={a.date + a.metric} className={`rounded-xl border p-4 space-y-2 ${severityStyles[a.severity] || ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${a.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
                          <span className="text-xs font-light text-foreground">{a.metric}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{a.date}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><p className="text-[9px] text-muted-foreground">Actual</p><p className="text-xs text-foreground">{typeof a.actual === "number" && a.actual > 10000 ? `${(a.actual / 1000).toFixed(0)}K` : `$${a.actual?.toLocaleString()}`}</p></div>
                        <div><p className="text-[9px] text-muted-foreground">Expected</p><p className="text-xs text-foreground">{typeof a.expected === "number" && a.expected > 10000 ? `${(a.expected / 1000).toFixed(0)}K` : `$${a.expected?.toLocaleString()}`}</p></div>
                        <div><p className="text-[9px] text-muted-foreground">σ Deviation</p><p className={`text-xs ${a.stdDevs >= 3 ? "text-red-400" : "text-amber-400"}`}>{a.stdDevs}σ</p></div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Probability of random occurrence: {a.probability}. <span className="text-foreground">Investigate.</span></p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TimeSeriesView;
