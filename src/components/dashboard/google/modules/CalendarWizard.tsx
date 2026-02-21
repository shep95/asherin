import {
  Calendar, Clock, Users, Zap, TrendingUp, BarChart3, Sun, Moon,
} from "lucide-react";

const suggestedMeetings = [
  {
    title: "Sprint Planning",
    suggested: "10:00 AM — Your peak focus time",
    confidence: 87,
    reasoning: "Based on 2 years of data, you have 87% success rate in meetings at 10am.",
    alternatives: ["2:00 PM (72%)", "11:00 AM (68%)"],
  },
  {
    title: "1:1 with Manager",
    suggested: "3:30 PM — Low energy slot (casual meetings work here)",
    confidence: 79,
    reasoning: "Your post-lunch energy dips; casual 1:1s don't need peak performance.",
    alternatives: ["9:00 AM (65%)", "4:00 PM (61%)"],
  },
];

const meetingStats = [
  { label: "Meetings/Week", value: "12.4" },
  { label: "Meeting Hours", value: "18h" },
  { label: "Avg Duration", value: "42 min" },
  { label: "No-Meeting Days", value: "0.8/wk" },
];

const energyMap = [
  { time: "7–9 AM", level: "Medium", type: "Ramp-up", best: "Email, planning" },
  { time: "9–11 AM", level: "Peak", type: "Deep focus", best: "Hard problems, coding" },
  { time: "11–12 PM", level: "High", type: "Collaborative", best: "Meetings, brainstorming" },
  { time: "12–2 PM", level: "Low", type: "Post-lunch dip", best: "Light tasks, 1:1s" },
  { time: "2–4 PM", level: "Medium", type: "Recovery", best: "Reviews, routine work" },
  { time: "4–6 PM", level: "Medium", type: "Wind-down", best: "Planning tomorrow, email" },
];

const insights = [
  "You're in 40% more meetings than 6 months ago — consider a meeting audit",
  "Tuesday is your heaviest meeting day (avg 5.2 meetings)",
  "You're most productive with ≤3 meetings per day",
  "Meetings with >5 attendees average 12 min longer than needed",
  "You rarely schedule before 9:30am — early morning is your quiet zone",
];

const CalendarWizard = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Calendar className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Calendar Wizard</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Auto-schedules meetings based on your energy levels, commute patterns, and historical success rates.
            Knows your peak focus times and protects your deep work hours.
          </p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {meetingStats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Optimal Scheduling */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Zap className="h-4 w-4" /> Optimal Meeting Suggestions
      </h3>
      {suggestedMeetings.map((m, i) => (
        <div key={i} className="rounded-xl border border-border/20 bg-foreground/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-light text-foreground">{m.title}</span>
            <span className="text-[10px] text-accent">{m.confidence}% optimal</span>
          </div>
          <p className="text-xs font-extralight text-muted-foreground">→ {m.suggested}</p>
          <p className="text-[10px] font-extralight text-muted-foreground/50">{m.reasoning}</p>
          <div className="flex gap-2 pt-1">
            {m.alternatives.map((a, j) => (
              <span key={j} className="text-[10px] rounded-lg bg-foreground/5 px-2 py-1 text-muted-foreground/50">{a}</span>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Energy Map */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
        <Sun className="h-3.5 w-3.5" /> Your Energy Map (AI-detected)
      </h3>
      <div className="space-y-1.5">
        {energyMap.map((e) => (
          <div key={e.time} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2">
            <span className="text-[10px] font-light text-muted-foreground w-16 shrink-0">{e.time}</span>
            <span className={`text-[10px] font-light w-14 shrink-0 ${
              e.level === "Peak" ? "text-foreground" : e.level === "Low" ? "text-muted-foreground/40" : "text-muted-foreground"
            }`}>{e.level}</span>
            <span className="text-[10px] text-muted-foreground/50 flex-1">{e.best}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Insights */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5" /> Meeting Insights
      </h3>
      <div className="space-y-1.5">
        {insights.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] font-extralight text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default CalendarWizard;
