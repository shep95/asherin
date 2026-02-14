import { BarChart3, Clock, Zap, TrendingUp, MessageSquare, Star } from "lucide-react";

const stats = [
  { label: "Prompts This Month", value: "247", icon: MessageSquare, change: "+18%" },
  { label: "Time Saved", value: "47h", icon: Clock, change: "~$2,350 value" },
  { label: "Current Streak", value: "12 days", icon: Zap, change: "Best: 34 days" },
  { label: "Saved Prompts", value: "23", icon: Star, change: "8 starred" },
];

const topModes = [
  { name: "Research", pct: 42 },
  { name: "Code", pct: 31 },
  { name: "Truth", pct: 18 },
  { name: "Chat", pct: 9 },
];

const topTopics = ["AI Architecture", "TypeScript", "Market Analysis", "Prompt Engineering", "Security"];

const StatsView = () => (
  <div className="max-w-3xl mx-auto p-6 space-y-6">
    <div>
      <h2 className="text-xl font-extralight tracking-wide text-foreground">Your Zialiel Stats</h2>
      <p className="text-sm font-extralight text-muted-foreground mt-1">Your personal intelligence dashboard.</p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <s.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">{s.label}</span>
          </div>
          <p className="text-2xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{s.change}</p>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">Mode Usage</span>
        </div>
        <div className="space-y-2">
          {topModes.map((m) => (
            <div key={m.name} className="flex items-center gap-2">
              <span className="text-xs font-light text-muted-foreground w-16">{m.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-border/30">
                <div className="h-full rounded-full bg-foreground/30" style={{ width: `${m.pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{m.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">Top Topics</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {topTopics.map((t) => (
            <span key={t} className="text-[10px] font-light text-muted-foreground rounded-full border border-border/20 px-2.5 py-1">{t}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default StatsView;
