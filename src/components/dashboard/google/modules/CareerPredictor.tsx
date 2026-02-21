import {
  Briefcase, TrendingUp, FileText, Search, Users, DollarSign,
  Zap, AlertTriangle, GraduationCap, Target,
} from "lucide-react";

const prediction = {
  probability: 73,
  timeframe: "3–6 months",
  predictedRole: "Senior Software Engineer",
  predictedSalary: "$150,000 – $180,000",
  trajectory: "Upward (based on role progression in emails)",
  evidence: [
    "You updated your resume 2 weeks ago (detected in Drive)",
    '3 "coffee chats" scheduled with people at other companies',
    "Recruiter email frequency up 340% in last month",
    'You searched "how to negotiate salary" 4 times',
  ],
};

const careerStats = [
  { label: "Current Role", value: "Software Eng" },
  { label: "Tenure", value: "2.3 years" },
  { label: "Recruiter Emails", value: "47/month" },
  { label: "Interview Signals", value: "6" },
];

const skillSignals = [
  { skill: "React/TypeScript", strength: 95, trend: "stable" },
  { skill: "System Design", strength: 78, trend: "growing" },
  { skill: "Python/ML", strength: 65, trend: "growing" },
  { skill: "Leadership", strength: 52, trend: "growing" },
  { skill: "Public Speaking", strength: 38, trend: "stable" },
];

const marketInsights = [
  "Your skill set matches 847 open roles in your area",
  "Average tenure at your company is 2.1 years — you're past the median",
  "Companies actively hiring your profile: Google, Meta, Stripe, Anthropic",
  "Remote roles matching your skills increased 23% this quarter",
];

const CareerPredictor = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Briefcase className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Career Predictor</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Predicts job changes, promotions, and career trajectory by analyzing recruiter emails,
            resume updates, calendar patterns, and search history.
          </p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {careerStats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Job Change Prediction */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Target className="h-4 w-4" /> Job Change Prediction
      </h3>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-3xl font-extralight text-foreground">{prediction.probability}%</p>
          <p className="text-[10px] text-muted-foreground/50">Probability</p>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Timeframe</span>
            <span className="text-foreground">{prediction.timeframe}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Predicted Role</span>
            <span className="text-foreground">{prediction.predictedRole}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Salary Range</span>
            <span className="text-foreground">{prediction.predictedSalary}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Trajectory</span>
            <span className="text-foreground">{prediction.trajectory}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {prediction.evidence.map((e, i) => (
          <div key={i} className="flex items-center gap-2 py-1 rounded-lg bg-foreground/5 px-3">
            <AlertTriangle className="h-3 w-3 text-amber-400/60 shrink-0" />
            <span className="text-[10px] font-extralight text-muted-foreground">{e}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Skill Signals */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" /> Skill Signals (from activity)
        </h3>
        <div className="space-y-2">
          {skillSignals.map((s) => (
            <div key={s.skill} className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{s.skill}</span>
                <span className="text-foreground">{s.strength}% · {s.trend}</span>
              </div>
              <div className="h-1 rounded-full bg-foreground/5">
                <div className="h-1 rounded-full bg-foreground/20" style={{ width: `${s.strength}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Insights */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> Market Insights
        </h3>
        <div className="space-y-1.5">
          {marketInsights.map((m, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <Zap className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] font-extralight text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default CareerPredictor;
