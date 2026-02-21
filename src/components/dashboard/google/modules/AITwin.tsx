import {
  Brain, Cpu, Zap, Shield, Eye, MessageSquare, Target,
  Clock, CheckCircle2, Sparkles,
} from "lucide-react";

const twinCapabilities = [
  { icon: MessageSquare, label: "Communication Style", desc: "Writes emails, messages, and replies in YOUR voice with 94% authenticity" },
  { icon: Target, label: "Decision Making", desc: "Predicts your choices with 89% accuracy based on historical patterns" },
  { icon: Clock, label: "Schedule Management", desc: "Knows your routines, energy levels, and optimal work patterns" },
  { icon: Eye, label: "Preference Engine", desc: "Understands your food, entertainment, travel, and shopping preferences" },
  { icon: Shield, label: "Privacy Guardian", desc: "Monitors your digital footprint and alerts on exposure risks" },
  { icon: Sparkles, label: "Life Automator", desc: "Handles tasks before you even think about them" },
];

const automations = [
  { task: "Morning briefing email drafted", status: "active", frequency: "Daily 7:30am", success: "96%" },
  { task: "Grocery list generated from calendar meals", status: "active", frequency: "Sundays", success: "88%" },
  { task: "Meeting prep notes compiled", status: "active", frequency: "30min before meetings", success: "91%" },
  { task: "Weekly expense summary", status: "active", frequency: "Fridays 5pm", success: "94%" },
  { task: "Birthday reminders + gift suggestions", status: "active", frequency: "7 days before", success: "100%" },
  { task: "Travel itinerary auto-built from bookings", status: "active", frequency: "On detection", success: "85%" },
];

const futurePredictions = [
  { prediction: "Next vacation: Lisbon, Portugal — June 2026", confidence: 78, basis: "Annual travel pattern + recent searches" },
  { prediction: "Next major purchase: MacBook Pro — April 2026", confidence: 72, basis: "3-year upgrade cycle + browsing activity" },
  { prediction: "Next career move: Senior role at mid-size startup", confidence: 73, basis: "Recruiter patterns + resume updates" },
  { prediction: "Next fitness goal: Half marathon — Fall 2026", confidence: 65, basis: "Running distance increasing + race searches" },
];

const twinStats = [
  { label: "Data Points", value: "4.2M" },
  { label: "Accuracy", value: "91%" },
  { label: "Automations", value: "24" },
  { label: "Hours Saved/Wk", value: "8.3" },
];

const AITwin = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Brain className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">AI Digital Twin</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Your complete digital replica. Knows your patterns, predicts your future,
            makes decisions like you would, and automates your entire life.
            "I know you better than you know yourself."
          </p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {twinStats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Capabilities */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {twinCapabilities.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 space-y-2">
          <div className="flex items-center gap-2">
            <c.icon className="h-4 w-4 text-foreground/50" />
            <span className="text-xs font-light text-foreground">{c.label}</span>
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">{c.desc}</p>
        </div>
      ))}
    </div>

    {/* Active Automations */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Cpu className="h-4 w-4" /> Active Automations
      </h3>
      <div className="space-y-1.5">
        {automations.map((a) => (
          <div key={a.task} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
            <span className="text-xs font-light text-foreground flex-1">{a.task}</span>
            <span className="text-[10px] text-muted-foreground/50">{a.frequency}</span>
            <span className="text-[10px] text-foreground/50">{a.success}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Future Predictions */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4" /> Future Predictions
      </h3>
      <div className="space-y-3">
        {futurePredictions.map((p, i) => (
          <div key={i} className="rounded-xl border border-border/20 bg-foreground/5 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-light text-foreground">{p.prediction}</span>
              <span className="text-[10px] text-accent">{p.confidence}%</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground/50">Basis: {p.basis}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AITwin;
