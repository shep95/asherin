import { useState } from "react";
import {
  Briefcase, DollarSign, Home, Heart, Plane, BookOpen,
  Users, Target, AlertTriangle, Sparkles, ChevronRight,
  Clock, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Play, Pause, RotateCcw, SlidersHorizontal, Eye,
  Plus, ArrowRight, Zap, BarChart3, Brain,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

/* ── Types ─────────────────────────────────────────────── */

interface ScenarioPrediction {
  month: number;
  label: string;
  salary?: number;
  satisfaction?: number;
  stress?: number;
  weight?: number;
  savings?: number;
  note: string;
}

interface ScenarioRisk {
  label: string;
  probability: number;
  consequence: string;
}

interface Scenario {
  id: string;
  name: string;
  probability: number;
  impact: "Low" | "Medium" | "High" | "Life-changing";
  timeline: string;
  description: string;
  recommended: boolean;
  confidence: number;
  category: string;
  predictions: ScenarioPrediction[];
  risks: ScenarioRisk[];
  pros: string[];
  cons: string[];
  expectedValue: string;
}

interface ScenarioCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  count: number;
  color: string;
}

/* ── Mock Data ─────────────────────────────────────────── */

const categories: ScenarioCategory[] = [
  { id: "career", label: "Career", icon: Briefcase, count: 12, color: "text-foreground/70" },
  { id: "financial", label: "Financial", icon: DollarSign, count: 15, color: "text-foreground/70" },
  { id: "life", label: "Life Changes", icon: Home, count: 10, color: "text-foreground/70" },
  { id: "health", label: "Health", icon: Heart, count: 8, color: "text-foreground/70" },
  { id: "travel", label: "Travel", icon: Plane, count: 5, color: "text-foreground/70" },
  { id: "learning", label: "Learning", icon: BookOpen, count: 5, color: "text-foreground/70" },
  { id: "relationship", label: "Relationships", icon: Users, count: 10, color: "text-foreground/70" },
  { id: "goals", label: "Goal Achievement", icon: Target, count: 8, color: "text-foreground/70" },
  { id: "risk", label: "Risk Analysis", icon: AlertTriangle, count: 6, color: "text-foreground/70" },
  { id: "wildcard", label: "Wildcards", icon: Sparkles, count: 4, color: "text-foreground/70" },
];

const topScenarios: Scenario[] = [
  {
    id: "s1",
    name: "Accept the senior role at a larger company",
    probability: 0.67,
    impact: "High",
    timeline: "3 months",
    description: "Based on recruiter emails, resume updates, and interview calendar entries",
    recommended: true,
    confidence: 0.84,
    category: "career",
    predictions: [
      { month: 0, label: "Today", salary: 120000, satisfaction: 4.2, stress: 5.2, note: "Current state" },
      { month: 3, label: "3 months", salary: 165000, satisfaction: 7.5, stress: 7.8, note: "Onboarding — steep learning curve, higher stress" },
      { month: 6, label: "6 months", salary: 165000, satisfaction: 8.1, stress: 6.5, note: "Settling in, new skills acquired" },
      { month: 12, label: "1 year", salary: 165000, satisfaction: 8.4, stress: 5.8, note: "23% promotion probability to Senior Engineer" },
      { month: 36, label: "3 years", salary: 215000, satisfaction: 8.8, stress: 5.0, note: "Total comp ~$340k with vested equity" },
    ],
    risks: [
      { label: "Culture mismatch", probability: 0.18, consequence: "Job search again in 12-18 months" },
      { label: "Relocation stress", probability: 0.35, consequence: "Higher living costs, distance from family" },
      { label: "Performance pressure", probability: 0.22, consequence: "Higher initial stress, imposter syndrome" },
    ],
    pros: [
      "+37.5% salary increase ($45k/year)",
      "$250k equity over 4 years",
      "3-5 year career acceleration",
      "Elite alumni network (worth $500k+ long-term)",
      "Exposure to massive-scale systems",
    ],
    cons: [
      "$12k moving costs",
      "+$1,800/month higher living costs",
      "2,940 miles from family",
      "Relationship risk if partner can't relocate",
      "Higher stress in first 6 months",
    ],
    expectedValue: "+$209k net gain over 4 years (82% success probability)",
  },
  {
    id: "s2",
    name: "Stay at current company",
    probability: 0.22,
    impact: "Low",
    timeline: "3 years",
    description: "Continue current trajectory — declining satisfaction, stagnant growth",
    recommended: false,
    confidence: 0.91,
    category: "career",
    predictions: [
      { month: 0, label: "Today", salary: 120000, satisfaction: 4.2, stress: 5.2, note: "Current state" },
      { month: 12, label: "1 year", salary: 124800, satisfaction: 3.8, stress: 5.8, note: "4% raise, satisfaction declining, burnout risk 42%" },
      { month: 24, label: "2 years", salary: 130000, satisfaction: 3.2, stress: 6.4, note: "Skills becoming outdated" },
      { month: 36, label: "3 years", salary: 145000, satisfaction: 2.9, stress: 7.0, note: "Career plateaued, market value declining" },
    ],
    risks: [
      { label: "Career stagnation", probability: 0.73, consequence: "Skills outdated, harder to get offers later" },
      { label: "Layoff", probability: 0.23, consequence: "2 weeks severance per year, 4-6 month job search" },
      { label: "Burnout", probability: 0.42, consequence: "Mental health impact, forced sabbatical" },
    ],
    pros: [
      "No disruption to personal life",
      "Comfortable routine",
      "Known team and environment",
    ],
    cons: [
      "Career stagnation (-$50k/yr future earning potential)",
      "Declining satisfaction (4.2 → 2.9/10)",
      "Skills becoming outdated",
      "23% layoff risk from weak company financials",
    ],
    expectedValue: "-$50k annual opportunity cost vs market alternatives",
  },
  {
    id: "s3",
    name: "Join early-stage startup as founding engineer",
    probability: 0.11,
    impact: "Life-changing",
    timeline: "2 years",
    description: "High risk, high reward — based on startup job search activity",
    recommended: false,
    confidence: 0.73,
    category: "career",
    predictions: [
      { month: 0, label: "Today", salary: 120000, satisfaction: 4.2, stress: 5.2, note: "Current state" },
      { month: 3, label: "3 months", salary: 140000, satisfaction: 7.0, stress: 9.2, note: "Exciting but brutal — 60+ hour weeks" },
      { month: 12, label: "1 year", salary: 140000, satisfaction: 6.5, stress: 8.5, note: "15% chance startup succeeds" },
      { month: 24, label: "2 years", salary: 140000, satisfaction: 5.0, stress: 8.0, note: "60% chance startup fails, equity = $0" },
    ],
    risks: [
      { label: "Startup failure", probability: 0.60, consequence: "Equity worth $0, starting over" },
      { label: "Burnout", probability: 0.55, consequence: "Extreme work hours, no work-life balance" },
      { label: "Financial strain", probability: 0.30, consequence: "Below-market salary with uncertain upside" },
    ],
    pros: [
      "1.2% equity (could be worth $12M if successful)",
      "9.8/10 learning opportunity",
      "VP Engineering title possibility",
      "Founding team experience",
    ],
    cons: [
      "60% chance of failure",
      "9.2/10 stress level",
      "3.1/10 work-life balance",
      "Below top-market salary",
    ],
    expectedValue: "$300k expected value (but 60% chance = $0)",
  },
];

/* ── Sub-Components ────────────────────────────────────── */

const ProbabilityRing = ({ value, size = 48 }: { value: number; size?: number }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-foreground/10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="text-foreground/60" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-foreground text-[10px] font-light">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
};

const TimelineExplorer = ({ predictions }: { predictions: ScenarioPrediction[] }) => {
  const [idx, setIdx] = useState(0);
  const p = predictions[idx];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-foreground/50" />
        <span className="text-xs font-light text-foreground">Timeline Explorer</span>
      </div>

      {/* timeline dots */}
      <div className="flex items-center gap-1">
        {predictions.map((pred, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${i === idx ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
            <div className={`h-2 w-2 rounded-full ${i === idx ? "bg-foreground" : "bg-foreground/20"}`} />
            <span className="text-[9px] text-muted-foreground">{pred.label}</span>
          </button>
        ))}
      </div>

      {/* metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {p.salary != null && (
          <div className="rounded-xl bg-foreground/5 p-3 text-center">
            <p className="text-sm font-light text-foreground">${(p.salary / 1000).toFixed(0)}k</p>
            <p className="text-[9px] text-muted-foreground">Salary</p>
          </div>
        )}
        {p.satisfaction != null && (
          <div className="rounded-xl bg-foreground/5 p-3 text-center">
            <p className="text-sm font-light text-foreground">{p.satisfaction}/10</p>
            <p className="text-[9px] text-muted-foreground">Satisfaction</p>
          </div>
        )}
        {p.stress != null && (
          <div className="rounded-xl bg-foreground/5 p-3 text-center">
            <p className="text-sm font-light text-foreground">{p.stress}/10</p>
            <p className="text-[9px] text-muted-foreground">Stress</p>
          </div>
        )}
        {p.savings != null && (
          <div className="rounded-xl bg-foreground/5 p-3 text-center">
            <p className="text-sm font-light text-foreground">${p.savings.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">Savings</p>
          </div>
        )}
      </div>

      <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">{p.note}</p>
    </div>
  );
};

const VariableAdjuster = () => {
  const [vars, setVars] = useState({
    risk: [50],
    family: [70],
    career: [80],
    financial: [60],
    location: [30],
  });
  const sliders: { key: keyof typeof vars; label: string }[] = [
    { key: "risk", label: "Risk Tolerance" },
    { key: "family", label: "Family Priority" },
    { key: "career", label: "Career Priority" },
    { key: "financial", label: "Financial Priority" },
    { key: "location", label: "Location Flexibility" },
  ];
  return (
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-foreground/50" />
        <span className="text-sm font-light text-foreground">Adjust Your Priorities</span>
      </div>
      {sliders.map((s) => (
        <div key={s.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-light text-muted-foreground">{s.label}</span>
            <span className="text-[10px] text-foreground/50">{vars[s.key][0]}%</span>
          </div>
          <Slider value={vars[s.key]} max={100} step={5}
            onValueChange={(v) => setVars((prev) => ({ ...prev, [s.key]: v }))}
            className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3" />
        </div>
      ))}
      <p className="text-[9px] font-extralight text-muted-foreground/50 leading-relaxed">
        Adjusting priorities recalculates scenario recommendations based on your values.
      </p>
    </div>
  );
};

/* ── Scenario Detail Panel ─────────────────────────────── */

const ScenarioDetail = ({ scenario, onBack }: { scenario: Scenario; onBack: () => void }) => (
  <div className="space-y-5">
    <button onClick={onBack} className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
      ← Back to scenarios
    </button>

    {/* Header */}
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5">
      <div className="flex items-start gap-4">
        <ProbabilityRing value={scenario.probability} size={56} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-light tracking-wide text-foreground">{scenario.name}</h2>
            {scenario.recommended ? (
              <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] text-foreground">
                <CheckCircle2 className="h-3 w-3" /> Recommended
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[9px] text-muted-foreground">
                <XCircle className="h-3 w-3" /> Not Recommended
              </span>
            )}
          </div>
          <p className="text-xs font-extralight text-muted-foreground">{scenario.description}</p>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-[10px] text-muted-foreground/60">Impact: {scenario.impact}</span>
            <span className="text-[10px] text-muted-foreground/60">Timeline: {scenario.timeline}</span>
            <span className="text-[10px] text-muted-foreground/60">Confidence: {Math.round(scenario.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    </div>

    {/* Timeline Explorer */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5">
      <TimelineExplorer predictions={scenario.predictions} />
    </div>

    {/* Pros & Cons */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 space-y-2">
        <span className="text-xs font-light text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Pros
        </span>
        <ul className="space-y-1.5">
          {scenario.pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-[10px] font-extralight text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-foreground/30 shrink-0 mt-0.5" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 space-y-2">
        <span className="text-xs font-light text-foreground flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5" /> Cons
        </span>
        <ul className="space-y-1.5">
          {scenario.cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-[10px] font-extralight text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-foreground/20 shrink-0 mt-0.5" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    {/* Risks */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 space-y-3">
      <span className="text-xs font-light text-foreground flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" /> Risk Analysis
      </span>
      <div className="space-y-2">
        {scenario.risks.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
            <div className="flex-1">
              <span className="text-[10px] font-light text-foreground">{r.label}</span>
              <p className="text-[9px] text-muted-foreground/50">{r.consequence}</p>
            </div>
            <span className="text-[10px] text-foreground/50">{Math.round(r.probability * 100)}%</span>
          </div>
        ))}
      </div>
    </div>

    {/* Expected Value */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-foreground/50" />
        <span className="text-xs font-light text-foreground">Expected Value</span>
      </div>
      <p className="text-sm font-extralight text-foreground/80 mt-2">{scenario.expectedValue}</p>
    </div>

    {/* Variable Adjuster */}
    <VariableAdjuster />
  </div>
);

/* ── Main Component ────────────────────────────────────── */

const ScenarioEngine = () => {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (activeScenario) {
    return <ScenarioDetail scenario={activeScenario} onBack={() => setActiveScenario(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <Brain className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Scenario Engine</h2>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              "See your future before it happens." Aureon analyzes your complete digital twin to run
              predictive life simulations — explore consequences before making decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Scenario Types", value: "50+" },
          { label: "Categories", value: "10" },
          { label: "Data Points", value: "4.2M" },
          { label: "Accuracy", value: "84%" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
            <p className="text-xl font-extralight text-foreground">{s.value}</p>
            <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Situation Detected */}
      <div className="rounded-2xl border border-border/20 bg-foreground/5 backdrop-blur-md p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-foreground/70" />
          <span className="text-sm font-light text-foreground">Situation Detected</span>
        </div>
        <p className="text-xs font-extralight text-muted-foreground leading-relaxed">
          You're actively job hunting (67% confidence). Evidence: Resume updated, 12 recruiter emails,
          4 coffee chats scheduled, salary comparison searches detected.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[9px] text-muted-foreground/40">⏰ Decision deadline: 14 days (offer expires)</span>
        </div>
      </div>

      {/* Top 3 Scenarios */}
      <div className="space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">Top 3 Scenarios For You</h3>
        <div className="space-y-3">
          {topScenarios.map((s, i) => (
            <button key={s.id} onClick={() => setActiveScenario(s)}
              className="w-full flex items-start gap-4 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 text-left hover:bg-foreground/5 transition-all group">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground/40">#{i + 1}</span>
                <ProbabilityRing value={s.probability} />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-light tracking-wide text-foreground">{s.name}</span>
                  {s.recommended && (
                    <span className="flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[8px] text-foreground shrink-0">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Best
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-extralight text-muted-foreground">{s.description}</p>
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="text-[9px] text-muted-foreground/50">Impact: {s.impact}</span>
                  <span className="text-[9px] text-muted-foreground/50">Timeline: {s.timeline}</span>
                  <span className="text-[9px] text-muted-foreground/50">Confidence: {Math.round(s.confidence * 100)}%</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground/50 transition-colors mt-2" />
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Categories */}
      <div className="space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">All Scenario Categories</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {categories.map((c) => (
            <button key={c.id}
              onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border border-border/20 p-4 transition-all ${
                activeCategory === c.id ? "bg-foreground/10" : "bg-card/20 hover:bg-foreground/5"
              }`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <span className="text-[10px] font-light text-foreground">{c.label}</span>
              <span className="text-[9px] text-muted-foreground/50">{c.count} types</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Detail (if expanded) */}
      {activeCategory && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h4 className="text-xs font-light text-foreground capitalize">{activeCategory} Scenarios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getCategoryScenarios(activeCategory).map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2.5">
                <ArrowRight className="h-3 w-3 text-foreground/20 shrink-0" />
                <span className="text-[10px] font-extralight text-muted-foreground">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Custom */}
      <button className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/30 bg-card/10 p-5 text-xs font-light text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-all">
        <Plus className="h-4 w-4" />
        Create Custom "What If" Scenario
      </button>

      {/* Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { icon: Eye, title: "Explore Timelines", desc: "Scrub through time to see consequences at every stage" },
          { icon: SlidersHorizontal, title: "Adjust Variables", desc: "Change priorities and see how it affects recommendations" },
          { icon: BarChart3, title: "Compare Side-by-Side", desc: "Compare multiple scenarios head-to-head" },
          { icon: Target, title: "Decision Points", desc: "Interactive branching decisions that change the future" },
          { icon: RotateCcw, title: "Track Reality", desc: "Compare predicted vs actual outcomes over time" },
          { icon: Sparkles, title: "AI Recommendations", desc: "Data-driven suggestions with confidence scores" },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <c.icon className="h-4 w-4 text-foreground/50" />
              <span className="text-xs font-light text-foreground">{c.title}</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Helper ────────────────────────────────────────────── */

function getCategoryScenarios(cat: string): string[] {
  const map: Record<string, string[]> = {
    career: ["Job change", "Promotion pursuit", "Career pivot", "Startup vs corporate", "Remote vs office", "Freelance vs employee", "Side hustle", "Retirement timeline", "Sabbatical", "Back to school", "Negotiation", "Layoff preparation"],
    financial: ["Subscription optimization", "Debt payoff", "Investment allocation", "Buy vs rent", "Car buy vs lease", "Emergency fund", "Retirement savings", "College savings", "Budget optimization", "Side income", "Tax optimization", "Insurance optimization", "Credit score", "Bankruptcy recovery", "Windfall scenarios"],
    life: ["Moving cities", "Moving countries", "Buying first home", "Having kids", "Marriage timing", "Divorce scenarios", "Work-life balance", "Aging parents care", "Friendship cultivation", "Dating scenarios"],
    health: ["Weight loss", "Muscle gain", "Marathon training", "Quit smoking/drinking", "Sleep optimization", "Diet changes", "Mental health", "Longevity optimization"],
    travel: ["Vacation planning", "Relocation abroad", "Digital nomad", "Road trip", "Budget travel"],
    learning: ["New skill", "Certification", "Career change via education", "Language learning", "Hobby pursuit"],
    relationship: ["Dating scenarios", "Marriage timing", "Having kids", "Long-distance", "Breakup analysis", "Friendship building", "Family planning", "Partner career support", "Blended families", "Empty nest transition"],
    goals: ["Fitness goal", "Financial goal", "Career goal", "Education goal", "Travel goal", "Creative goal", "Social goal", "Habit formation"],
    risk: ["Job loss preparation", "Health emergency", "Market crash impact", "Identity theft", "Natural disaster", "Pandemic planning"],
    wildcard: ["Lottery win", "Unexpected inheritance", "Viral fame", "Black swan events"],
  };
  return map[cat] ?? [];
}

export default ScenarioEngine;
