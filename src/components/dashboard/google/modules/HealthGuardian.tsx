import {
  Heart, Activity, Moon, Thermometer, AlertTriangle, TrendingUp,
  TrendingDown, Droplets, Brain, Zap, Footprints, Timer,
} from "lucide-react";

const healthScore = { total: 87, sleep: 92, activity: 78, heart: 91, trend: "+5" };

const anomalies = [
  {
    type: "Step Count Drop",
    severity: "medium",
    icon: Footprints,
    current: "4,200/day",
    baseline: "8,500/day",
    change: "-51%",
    duration: "9 days",
    causes: ["Illness or injury", "14 meetings this week (vs usual 6)", "Rainy weather 8 days straight"],
    recommendation: "Try to walk 10 min every 2 hours. Book no-meeting Thursday.",
  },
  {
    type: "Sleep Quality Decrease",
    severity: "low",
    icon: Moon,
    current: "62 min deep/night",
    baseline: "85 min deep/night",
    change: "-27%",
    duration: "5 days",
    causes: ["Stress (big presentation Friday)", "Screen time before bed"],
    recommendation: "Meditation before bed. Try going to bed at 10:15pm (your optimal time).",
  },
];

const illnessPrediction = {
  probability: 78,
  likely: "Common cold",
  evidence: [
    "Resting heart rate up 8 bpm (unusual)",
    "Steps down 51% for 9 days",
    "Sleeping 1.2 hrs more than usual",
    'You searched "sore throat remedies" 2 days ago',
  ],
  onset: "1–2 days",
};

const periodTracking = {
  nextPeriod: "March 12, 2026",
  daysAway: "14 days",
  cycleLength: "28.3 days (±2)",
  regularity: "98%",
  fertilityWindow: "March 1–5",
  ovulation: "March 2",
  pmsExpected: "March 9–11",
};

const trends = [
  { label: "Avg Steps", value: "8,200/day", trend: "up", change: "+800" },
  { label: "Sleep Quality", value: "Improving", trend: "up", change: "+12%" },
  { label: "Resting HR", value: "58 bpm", trend: "stable", change: "±0" },
  { label: "Weight", value: "-4 lbs", trend: "down", change: "gradual" },
];

const smartInsights = [
  "You walk 43% more on sunny days (weather matters!)",
  "Best sleep: Thursdays (avg 8.2 hrs, 91% efficiency)",
  "Most active 9–11am — plan workouts then",
  "Coffee after 2pm = 35 min less sleep (detected pattern)",
  "You hit 10K steps on 47% of days (goal: 60%)",
];

const HealthGuardian = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Heart className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Health Guardian</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Tracks steps, sleep, heart rate from Google Fit. Detects health anomalies before you notice them.
            Predicts illness, tracks periods, and suggests doctor visits based on your patterns.
          </p>
        </div>
      </div>
    </div>

    {/* Health Score */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
        <p className="text-2xl font-extralight text-foreground">{healthScore.total}</p>
        <p className="text-[10px] font-light text-muted-foreground/60 mt-1">Health Score</p>
      </div>
      {[
        { label: "Sleep", value: healthScore.sleep },
        { label: "Activity", value: healthScore.activity },
        { label: "Heart", value: healthScore.heart },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}/100</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
        <p className="text-xl font-extralight text-foreground">↗️ {healthScore.trend}</p>
        <p className="text-[10px] font-light text-muted-foreground/60 mt-1">vs Last Month</p>
      </div>
    </div>

    {/* Anomalies */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Anomalies Detected ({anomalies.length})
      </h3>
      {anomalies.map((a, i) => (
        <div key={i} className="rounded-xl border border-border/20 bg-foreground/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <a.icon className="h-4 w-4 text-foreground/50" />
              <span className="text-xs font-light text-foreground">{a.type}</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${
              a.severity === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-foreground/5 text-muted-foreground"
            }`}>{a.severity}</span>
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground/60">
            <span>Current: {a.current}</span>
            <span>Baseline: {a.baseline}</span>
            <span className="text-amber-400">{a.change}</span>
            <span>{a.duration}</span>
          </div>
          <div className="text-[10px] font-extralight text-muted-foreground">
            Causes: {a.causes.join(" · ")}
          </div>
          <div className="text-[10px] font-extralight text-accent/80">💡 {a.recommendation}</div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Illness Prediction */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <Thermometer className="h-3.5 w-3.5" /> Illness Prediction
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-extralight text-foreground">{illnessPrediction.probability}%</span>
          <div>
            <p className="text-xs font-light text-foreground">Likely: {illnessPrediction.likely}</p>
            <p className="text-[10px] text-muted-foreground/50">Onset: {illnessPrediction.onset}</p>
          </div>
        </div>
        <div className="space-y-1">
          {illnessPrediction.evidence.map((e, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="h-1 w-1 rounded-full bg-amber-400/60 shrink-0" />
              <span className="text-[10px] font-extralight text-muted-foreground">{e}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Period Tracking */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <Droplets className="h-3.5 w-3.5" /> Cycle Tracking
        </h3>
        <div className="space-y-1.5">
          {Object.entries(periodTracking).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-light text-muted-foreground/50 capitalize">
                {key.replace(/([A-Z])/g, " $1")}
              </span>
              <span className="text-[10px] font-light text-foreground">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Trends + Insights */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> 6-Month Trends
        </h3>
        <div className="space-y-2">
          {trends.map((t) => (
            <div key={t.label} className="flex items-center justify-between py-1 rounded-lg bg-foreground/5 px-3">
              <span className="text-[10px] font-light text-muted-foreground">{t.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-light text-foreground">{t.value}</span>
                <span className="text-[10px] text-muted-foreground/50">{t.change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <Brain className="h-3.5 w-3.5" /> Smart Insights
        </h3>
        <div className="space-y-1.5">
          {smartInsights.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <Zap className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] font-extralight text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default HealthGuardian;
