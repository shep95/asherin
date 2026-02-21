import {
  Users, Star, MessageSquare, Clock, TrendingUp, Heart, Network,
  Zap, AlertTriangle,
} from "lucide-react";

const topContacts = [
  { name: "Sarah Chen", score: 94, type: "Close Friend", lastContact: "2 days ago", freq: "3.2×/wk", tone: "Positive", topics: ["work", "travel", "food"], nextPredicted: "3–4 days", tip: "You usually text Sarah on Fridays. Consider reaching out tomorrow." },
  { name: "Michael Torres", score: 87, type: "Work Colleague", lastContact: "Today", freq: "5×/wk", tone: "Professional", topics: ["projects", "deadlines"], nextPredicted: "Tomorrow", tip: "Your emails to Michael are 2× longer on Mondays." },
  { name: "Mom", score: 96, type: "Family", lastContact: "5 days ago", freq: "1.8×/wk", tone: "Warm", topics: ["health", "family", "plans"], nextPredicted: "Today", tip: "⚠️ You haven't called Mom in 5 days — longest gap in 3 months." },
  { name: "David Park", score: 72, type: "Acquaintance", lastContact: "2 weeks ago", freq: "0.5×/wk", tone: "Neutral", topics: ["tech", "news"], nextPredicted: "Unknown", tip: "Relationship cooling — down 40% in contact frequency." },
];

const networkStats = [
  { label: "Total Contacts", value: "1,847" },
  { label: "Active (30d)", value: "142" },
  { label: "Organizations", value: "23" },
  { label: "Social Clusters", value: "8" },
];

const alerts = [
  "Mom hasn't been contacted in 5 days — longest gap in 3 months",
  "3 contacts show declining frequency — relationships may be fading",
  "New contact pattern: You've been emailing recruiter@google.com",
  "Your response time to close friends has slowed 40% this week",
];

const ContactIntelligence = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Users className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Contact Intelligence</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Scores every relationship from emails, meetings, photos, and mentions. Maps your social graph,
            predicts who you'll contact next, and warns when relationships are fading.
          </p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {networkStats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Relationship Cards */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Heart className="h-4 w-4" /> Relationship Scores
      </h3>
      <div className="space-y-3">
        {topContacts.map((c) => (
          <div key={c.name} className="rounded-xl border border-border/20 bg-foreground/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-light text-foreground">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-light text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-2">{c.type}</span>
                </div>
              </div>
              <span className="text-sm font-extralight text-foreground">{c.score}/100</span>
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {c.lastContact}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {c.freq}</span>
              <span className="flex items-center gap-1"><Star className="h-2.5 w-2.5" /> {c.tone}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {c.topics.map((t) => (
                <span key={t} className="text-[10px] rounded-lg bg-foreground/5 px-2 py-0.5 text-muted-foreground/50">{t}</span>
              ))}
            </div>
            <p className="text-[10px] font-extralight text-accent/80">💡 {c.tip}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Alerts */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" /> Relationship Alerts
      </h3>
      <div className="space-y-1.5">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
            <Zap className="h-3 w-3 text-amber-400/60 shrink-0 mt-0.5" />
            <span className="text-[10px] font-extralight text-muted-foreground">{a}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ContactIntelligence;
