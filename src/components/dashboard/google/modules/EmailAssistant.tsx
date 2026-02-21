import {
  Mail, Send, Inbox, Star, Clock, AlertTriangle, CheckCircle2,
  PenTool, BarChart3, Users, Zap, Eye, MessageSquare,
} from "lucide-react";

const mockDrafts = [
  {
    to: "Boss (Sarah Chen)",
    subject: "RE: Q4 Budget Review",
    confidence: 94,
    preview: "Hey Sarah, I'll have the budget analysis ready by 4pm today. Quick question — should I include the new hire projections? Thanks!",
    style: "casual-professional",
  },
  {
    to: "Client (Michael Torres)",
    subject: "RE: Project deadline",
    confidence: 89,
    preview: "Hi Michael, Understood on the Friday deadline. We're on track to deliver by Thursday EOD. I'll send you a progress update tomorrow morning. Best,",
    style: "formal",
  },
];

const inboxStats = [
  { label: "Unread", value: "127", color: "text-foreground" },
  { label: "Critical", value: "8", color: "text-red-400" },
  { label: "Important", value: "23", color: "text-amber-400" },
  { label: "Low Priority", value: "42", color: "text-muted-foreground/50" },
];

const emailPatterns = [
  { icon: Clock, text: "Average response time: 3.2 hours" },
  { icon: Mail, text: "Response rate: 68% — you reply to 2/3 emails" },
  { icon: BarChart3, text: "Busiest email time: 9–11am, 2–4pm" },
  { icon: Star, text: "You respond fastest to: Boss (28 min), Partner (45 min)" },
  { icon: Users, text: "You often ignore: Newsletters (92%), Recruiters (78%)" },
];

const aiInsights = [
  "You're 3 hours slower than usual responding today — stressed?",
  "Pattern: You respond to work emails 2× faster on Mondays",
  "Email from legal@company.com — unusual sender, high importance",
  "You have 8 emails waiting >3 days — should I draft quick replies?",
];

const styleProfile = [
  { label: "Tone", value: "Casual 67% · Professional 28% · Humorous 5%" },
  { label: "Avg. Length", value: "12 words/sentence, concise style" },
  { label: "Greeting", value: '"Hey [name]" (45%) · "Hi [name]" (35%)' },
  { label: "Closing", value: '"Thanks!" (40%) · "Best," (30%)' },
  { label: "Emoji", value: "2.1 per email — 😊 most common" },
];

const EmailAssistant = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <Mail className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">AI Email Assistant</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Learns YOUR writing style from every sent email. Auto-replies in YOUR voice, prioritizes inbox,
            and drafts emails before you even start typing.
          </p>
        </div>
      </div>
    </div>

    {/* Inbox Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {inboxStats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className={`text-xl font-extralight ${s.color}`}>{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Draft Replies */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-4">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <PenTool className="h-4 w-4" /> Draft Replies Ready
      </h3>
      <div className="space-y-3">
        {mockDrafts.map((d, i) => (
          <div key={i} className="rounded-xl border border-border/20 bg-foreground/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-light text-foreground">To: {d.to}</span>
                <span className="text-[10px] text-muted-foreground/50 ml-2">RE: {d.subject}</span>
              </div>
              <span className="text-[10px] font-light text-accent">{d.confidence}% match</span>
            </div>
            <p className="text-xs font-extralight text-muted-foreground leading-relaxed italic">"{d.preview}"</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-muted-foreground/40">Style: {d.style}</span>
              <div className="flex gap-1.5 ml-auto">
                <button className="rounded-lg bg-foreground/10 px-3 py-1 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all flex items-center gap-1">
                  <Send className="h-2.5 w-2.5" /> Send
                </button>
                <button className="rounded-lg bg-foreground/5 px-3 py-1 text-[10px] font-light text-muted-foreground hover:bg-foreground/10 transition-all">
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Your Writing Style */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <Eye className="h-3.5 w-3.5" /> Your Writing Style Profile
        </h3>
        <div className="space-y-2">
          {styleProfile.map((s) => (
            <div key={s.label} className="flex items-start gap-2 py-1">
              <span className="text-[10px] font-light text-muted-foreground/50 w-16 shrink-0">{s.label}</span>
              <span className="text-[10px] font-extralight text-muted-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Email Patterns */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" /> Email Patterns
        </h3>
        <div className="space-y-2">
          {emailPatterns.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <p.icon className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] font-extralight text-muted-foreground">{p.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* AI Insights */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
        <Zap className="h-3.5 w-3.5" /> AI Insights
      </h3>
      <div className="space-y-1.5">
        {aiInsights.map((insight, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 rounded-lg bg-foreground/5 px-3">
            <MessageSquare className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] font-extralight text-muted-foreground">{insight}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default EmailAssistant;
