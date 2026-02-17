import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Calendar, BarChart3, Activity, Zap, Target, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Simulated time-series analysis data
const seasonalityData = {
  pattern: "Weekly",
  peakDay: "Wednesday",
  troughDay: "Sunday",
  variance: 1.34,
  confidence: 92,
};

const trendData = {
  direction: "up" as const,
  monthlyGrowth: 2.3,
  adjustedForSeason: true,
  r_squared: 0.87,
};

const changePoints = [
  { date: "2025-02-14", shift: "significant", description: "Structural break — pattern shifted. Revenue dropped 23% in 48 hours.", probability: 0.93 },
  { date: "2025-06-01", shift: "moderate", description: "Seasonal adjustment — summer dip detected earlier than historical average.", probability: 0.78 },
  { date: "2025-09-15", shift: "minor", description: "Recovery pattern — growth rate returned to pre-break trajectory.", probability: 0.65 },
];

const forecasts = [
  { month: "Mar 2026", value: 143000, lower: 131000, upper: 155000, confidence: 85 },
  { month: "Apr 2026", value: 148000, lower: 132000, upper: 164000, confidence: 80 },
  { month: "May 2026", value: 152000, lower: 130000, upper: 174000, confidence: 72 },
  { month: "Jun 2026", value: 141000, lower: 118000, upper: 164000, confidence: 65 },
];

const correlations = [
  { series_a: "Ad Spend", series_b: "Sales Revenue", lag: 11, coefficient: 0.78, relationship: "Ad spend leads sales by 11 days" },
  { series_a: "Support Tickets", series_b: "Churn Rate", lag: 21, coefficient: 0.65, relationship: "Ticket volume precedes churn by 3 weeks" },
  { series_a: "Website Traffic", series_b: "Trial Signups", lag: 2, coefficient: 0.91, relationship: "Near-instant conversion from traffic" },
];

const anomalies = [
  { date: "2026-02-12", metric: "Daily Revenue", actual: 3200, expected: 8400, stdDevs: 3.2, probability: "0.07%", severity: "critical" as const },
  { date: "2026-02-09", metric: "API Calls", actual: 142000, expected: 89000, stdDevs: 2.1, probability: "1.8%", severity: "warning" as const },
];

const severityStyles: Record<string, string> = { critical: "border-red-500/30 bg-red-500/5", warning: "border-amber-500/30 bg-amber-500/5" };

const TimeSeriesView = () => {
  const [activeSection, setActiveSection] = useState<"overview" | "seasonality" | "forecast" | "correlations" | "anomalies">("overview");

  const sections = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "seasonality" as const, label: "Seasonality", icon: Activity },
    { id: "forecast" as const, label: "Forecast", icon: TrendingUp },
    { id: "correlations" as const, label: "Correlations", icon: Zap },
    { id: "anomalies" as const, label: "Anomalies", icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">TIME-SERIES INTELLIGENCE</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Automated temporal analysis with forecasting and anomaly detection</p>
          </div>
        </div>
        <div className="flex gap-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-light transition-colors ${activeSection === s.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}>
              <s.icon className="h-3 w-3" /> {s.label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {activeSection === "overview" && (
            <>
              {/* Trend summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    {trendData.direction === "up" ? <ArrowUpRight className="h-5 w-5 text-emerald-400" /> : <ArrowDownRight className="h-5 w-5 text-red-400" />}
                    <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Underlying Trend</p>
                  </div>
                  <p className="text-2xl font-extralight text-foreground">+{trendData.monthlyGrowth}%</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Monthly growth (seasonal noise removed)</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-2">R² = {trendData.r_squared}</p>
                </div>
                <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-5 w-5 text-blue-400" />
                    <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Seasonality</p>
                  </div>
                  <p className="text-2xl font-extralight text-foreground">{seasonalityData.pattern}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Peak: {seasonalityData.peakDay} • Trough: {seasonalityData.troughDay}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-2">Seasonal index: {seasonalityData.variance} variance</p>
                </div>
                <div className="rounded-2xl border border-border/10 bg-card/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Active Anomalies</p>
                  </div>
                  <p className="text-2xl font-extralight text-foreground">{anomalies.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{anomalies.filter(a => a.severity === "critical").length} critical • {anomalies.filter(a => a.severity === "warning").length} warnings</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-2">Last detected: {anomalies[0]?.date}</p>
                </div>
              </div>

              {/* Change points */}
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
            </>
          )}

          {activeSection === "seasonality" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/10 bg-card/20 p-6">
                <h3 className="text-xs font-light text-foreground mb-4">Seasonality Decomposition</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Pattern</p>
                    <p className="text-lg font-extralight text-foreground">{seasonalityData.pattern}</p>
                  </div>
                  <div className="rounded-xl bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Confidence</p>
                    <p className="text-lg font-extralight text-foreground">{seasonalityData.confidence}%</p>
                  </div>
                  <div className="rounded-xl bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Peak Day</p>
                    <p className="text-lg font-extralight text-emerald-400">{seasonalityData.peakDay}</p>
                  </div>
                  <div className="rounded-xl bg-card/20 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Trough Day</p>
                    <p className="text-lg font-extralight text-red-400">{seasonalityData.troughDay}</p>
                  </div>
                </div>
                {/* Visual bars for each day */}
                <div className="mt-6 space-y-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                    const vals = [78, 85, 100, 92, 88, 60, 45];
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-8">{day}</span>
                        <div className="flex-1 h-3 rounded-full bg-card/30 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${vals[i]}%`, background: vals[i] >= 90 ? "hsl(var(--accent))" : vals[i] >= 70 ? "hsl(var(--accent) / 0.6)" : "hsl(var(--accent) / 0.3)" }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{vals[i]}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSection === "forecast" && (
            <div className="space-y-4">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Revenue Forecast (18 months historical data)</p>
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
              {correlations.map(c => (
                <div key={c.series_a + c.series_b} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400">{c.series_a}</span>
                    <Zap className="h-3 w-3 text-accent" />
                    <span className="text-xs text-purple-400">{c.series_b}</span>
                  </div>
                  <p className="text-[10px] text-foreground/80">{c.relationship}</p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Lag</p>
                      <p className="text-xs text-foreground">{c.lag} days</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Correlation</p>
                      <p className={`text-xs ${c.coefficient >= 0.8 ? "text-emerald-400" : c.coefficient >= 0.6 ? "text-amber-400" : "text-red-400"}`}>{c.coefficient}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "anomalies" && (
            <div className="space-y-4">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Detected Anomalies</p>
              {anomalies.map(a => (
                <div key={a.date + a.metric} className={`rounded-xl border p-4 space-y-2 ${severityStyles[a.severity]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${a.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
                      <span className="text-xs font-light text-foreground">{a.metric}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{a.date}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[9px] text-muted-foreground">Actual</p>
                      <p className="text-xs text-foreground">{typeof a.actual === "number" && a.actual > 10000 ? `${(a.actual / 1000).toFixed(0)}K` : `$${a.actual.toLocaleString()}`}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">Expected</p>
                      <p className="text-xs text-foreground">{typeof a.expected === "number" && a.expected > 10000 ? `${(a.expected / 1000).toFixed(0)}K` : `$${a.expected.toLocaleString()}`}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground">σ Deviation</p>
                      <p className={`text-xs ${a.stdDevs >= 3 ? "text-red-400" : "text-amber-400"}`}>{a.stdDevs}σ</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Probability of random occurrence: {a.probability}. <span className="text-foreground">Something changed. Investigate.</span></p>
                </div>
              ))}

              {/* Auto-alert config */}
              <div className="rounded-xl border border-border/10 bg-card/10 p-4">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase mb-3">Auto-Alert Configuration</p>
                <div className="space-y-2">
                  {[
                    { label: "Alert when value > 2σ from expected", enabled: true },
                    { label: "Alert on structural break detection", enabled: true },
                    { label: "Weekly trend deviation summary", enabled: false },
                  ].map(alert => (
                    <div key={alert.label} className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">{alert.label}</p>
                      <div className={`h-4 w-8 rounded-full transition-colors ${alert.enabled ? "bg-accent" : "bg-card/40"} relative`}>
                        <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-foreground transition-transform ${alert.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TimeSeriesView;
