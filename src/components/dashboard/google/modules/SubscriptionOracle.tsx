import {
  CreditCard, DollarSign, AlertTriangle, TrendingUp, Calendar,
  Tv, Briefcase, Dumbbell, Newspaper, HardDrive, Zap, X,
} from "lucide-react";

const subscriptions = [
  { name: "Netflix", amount: 15.99, category: "Entertainment", next: "Feb 26", status: "urgent" },
  { name: "Spotify", amount: 10.99, category: "Entertainment", next: "Feb 27", status: "urgent" },
  { name: "Adobe CC", amount: 54.99, category: "Productivity", next: "Feb 28", status: "urgent" },
  { name: "ChatGPT Plus", amount: 20.00, category: "Productivity", next: "Mar 1", status: "warning" },
  { name: "Notion", amount: 10.00, category: "Productivity", next: "Mar 3", status: "warning" },
  { name: "Google One", amount: 9.99, category: "Storage", next: "Mar 15", status: "normal" },
  { name: "NY Times", amount: 17.00, category: "News", next: "Mar 20", status: "normal" },
  { name: "Peloton", amount: 19.99, category: "Fitness", next: "Mar 22", status: "normal" },
];

const categories = [
  { name: "Entertainment", icon: Tv, total: 67.97, pct: 36 },
  { name: "Productivity", icon: Briefcase, total: 84.99, pct: 45 },
  { name: "Fitness", icon: Dumbbell, total: 19.99, pct: 11 },
  { name: "Storage", icon: HardDrive, total: 9.99, pct: 5 },
  { name: "News", icon: Newspaper, total: 4.51, pct: 3 },
];

const alerts = [
  { type: "warning", text: "Hulu ($14.99) — not used in 60 days. Cancel to save $180/yr" },
  { type: "warning", text: "Disney+ ($10.99) — last used Nov 3. Potential savings: $132/yr" },
  { type: "info", text: "Spotify raised price from $9.99 → $10.99 (effective Feb 1)" },
  { type: "tip", text: "You pay for Dropbox AND Google One — consolidate to save $144/yr" },
];

const predictions = [
  "Next month total: $189.23 (+$1.78 from new Audible subscription detected)",
  "Likely cancellation: Disney+ (usage dropped 80% in 3 months)",
  "Likely new subscription: GitHub Copilot (you searched it 3 times)",
];

const SubscriptionOracle = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
          <CreditCard className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Subscription Oracle</h2>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
            Scans every email for subscription confirmations. Tracks recurring payments,
            predicts next charge date, and finds subscriptions you forgot about.
          </p>
        </div>
      </div>
    </div>

    {/* Summary Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: "Monthly Cost", value: "$187.45" },
        { label: "Annual Cost", value: "$2,249" },
        { label: "Active Subs", value: "23" },
        { label: "YoY Growth", value: "+29%" },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
          <p className="text-xl font-extralight text-foreground">{s.value}</p>
          <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
        </div>
      ))}
    </div>

    {/* Upcoming Payments */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
        <Calendar className="h-4 w-4" /> Upcoming Payments
      </h3>
      <div className="space-y-1.5">
        {subscriptions.map((s) => (
          <div key={s.name} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              s.status === "urgent" ? "bg-red-400" : s.status === "warning" ? "bg-amber-400" : "bg-muted-foreground/30"
            }`} />
            <span className="text-xs font-light text-foreground flex-1">{s.name}</span>
            <span className="text-[10px] text-muted-foreground/50">{s.category}</span>
            <span className="text-[10px] text-muted-foreground">{s.next}</span>
            <span className="text-xs font-light text-foreground w-16 text-right">${s.amount}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Categories */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5" /> Spending by Category
        </h3>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <c.icon className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[10px] font-light text-muted-foreground">{c.name}</span>
                </div>
                <span className="text-[10px] font-light text-foreground">${c.total}/mo ({c.pct}%)</span>
              </div>
              <div className="h-1 rounded-full bg-foreground/5">
                <div className="h-1 rounded-full bg-foreground/20" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Alerts & Savings
        </h3>
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <AlertTriangle className="h-3 w-3 text-amber-400/60 shrink-0 mt-0.5" />
              <span className="text-[10px] font-extralight text-muted-foreground">{a.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Predictions */}
    <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
      <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5" /> Predictions
      </h3>
      <div className="space-y-1.5">
        {predictions.map((p, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5">
            <Zap className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] font-extralight text-muted-foreground">{p}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SubscriptionOracle;
