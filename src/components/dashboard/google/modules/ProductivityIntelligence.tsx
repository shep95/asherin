import { useState } from "react";
import {
  Clock, BarChart3, Target, Mail, Users, FolderOpen, Zap,
  Moon, Award, TrendingUp, AlertTriangle, CheckCircle2,
  ChevronRight, Brain,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const features = [
  { icon: Clock, name: "Productivity Timeline", desc: "Tracks when you're most productive", stat: "Peak: 9-11am weekdays" },
  { icon: BarChart3, name: "Work-Life Balance Tracker", desc: "Monitors work hours vs personal time", stat: "52 hrs/week" },
  { icon: Target, name: "Focus Time Analyzer", desc: "Identifies uninterrupted work blocks", stat: "2.3 hrs/day" },
  { icon: Mail, name: "Email Load Monitor", desc: "Tracks email volume impact on productivity", stat: "2.8 hrs/day on email" },
  { icon: Users, name: "Collaboration Mapper", desc: "Maps who you work with most", stat: "Top: Sarah (94 interactions)" },
  { icon: FolderOpen, name: "Project Detector", desc: "Identifies all active projects automatically", stat: "7 active projects" },
  { icon: Zap, name: "Context Switch Tracker", desc: "Counts task switching frequency", stat: "23x/day" },
  { icon: Moon, name: "After-Hours Work Detector", desc: "Tracks work outside normal hours", stat: "8.5 hrs after 6pm/week" },
  { icon: Award, name: "Top Collaborators", desc: "Identifies key work relationships", stat: "Sarah, John, Maria" },
];

const insights = [
  { type: "strength", text: "You're a morning person — peak productivity 9-11am" },
  { type: "strength", text: "Thursday is your most productive day (fewest meetings)" },
  { type: "strength", text: "You respond to urgent emails quickly (32 min avg)" },
  { type: "warning", text: "Block 9-11am for deep work (currently interrupted 4x/week)" },
  { type: "warning", text: "Reduce Tuesday meetings (you have 6, you need 3 max)" },
  { type: "warning", text: "Batch email processing — you check 47x/day, reduce to 3x" },
  { type: "warning", text: "Weekly status meeting — you haven't spoken in 6 weeks" },
];

const ProductivityIntelligence = () => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Productive Hours", value: "6.2h/day", trend: "+8%" },
          { label: "Focus Time", value: "2.3h/day", trend: "-12%" },
          { label: "Email Time", value: "2.8h/day", trend: "+5%" },
          { label: "Context Switches", value: "23/day", trend: "+15%" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-1">
            <span className="text-[10px] font-extralight text-muted-foreground">{s.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-light text-foreground">{s.value}</span>
              <span className={`text-[10px] ${s.trend.startsWith("+") && s.label !== "Productive Hours" ? "text-red-400" : "text-emerald-400"}`}>{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Productivity Timeline Visual */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" /> Daily Productivity Timeline
        </h3>
        <div className="flex gap-1 items-end h-20">
          {[20, 35, 85, 95, 70, 45, 60, 75, 50, 30, 25, 15].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-foreground/20 transition-all hover:bg-foreground/40"
                style={{ height: `${h}%` }}
              />
              <span className="text-[8px] text-muted-foreground/50">{6 + i}am</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-extralight text-muted-foreground/60">
          Peak performance: 9-11am · Low energy: 2-3pm · Second wind: 4-5pm
        </p>
      </div>

      {/* Features Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground">All Productivity Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {features.map((f) => (
            <button
              key={f.name}
              onClick={() => setSelectedFeature(selectedFeature === f.name ? null : f.name)}
              className="flex items-start gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-left hover:bg-foreground/5 transition-all group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <f.icon className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <span className="text-xs font-light text-foreground">{f.name}</span>
                <p className="text-[10px] font-extralight text-muted-foreground">{f.desc}</p>
                <span className="text-[10px] font-light text-foreground/50">{f.stat}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/50 mt-1" />
            </button>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4" /> AI Productivity Insights
        </h3>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              {ins.type === "strength" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span className="text-[11px] font-extralight text-muted-foreground">{ins.text}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-foreground/5 p-3 mt-2">
          <p className="text-[10px] font-extralight text-foreground/60">
            💡 If you implement these changes: <span className="text-foreground">+8.5 hrs/week productive time</span> — a 34% productivity increase
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductivityIntelligence;
