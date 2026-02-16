import { useState } from "react";
import { Bell, BellRing, Plus, Trash2, Settings, Clock, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, Activity, Eye, Pause, Play } from "lucide-react";

interface MonitorRule {
  id: string;
  name: string;
  target: string;
  condition: string;
  threshold: string;
  frequency: string;
  active: boolean;
  lastChecked: string | null;
  lastTriggered: string | null;
  triggerCount: number;
}

interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  read: boolean;
}

const DEMO_RULES: MonitorRule[] = [
  { id: "r1", name: "Insider Selling Spike", target: "SEC Form 4 Filings", condition: "Volume exceeds", threshold: "$5M in 30 days", frequency: "Daily", active: true, lastChecked: "2 hours ago", lastTriggered: "3 days ago", triggerCount: 2 },
  { id: "r2", name: "Sentiment Drop", target: "News Sentiment Score", condition: "Drops below", threshold: "Score < 40", frequency: "Hourly", active: true, lastChecked: "45 min ago", lastTriggered: null, triggerCount: 0 },
  { id: "r3", name: "New Lawsuit Filed", target: "PACER / CourtListener", condition: "New filing detected", threshold: "Any new case", frequency: "Daily", active: true, lastChecked: "6 hours ago", lastTriggered: "1 week ago", triggerCount: 5 },
  { id: "r4", name: "C-Suite Departure", target: "SEC Filings + News", condition: "Executive change detected", threshold: "C-level departure", frequency: "Daily", active: false, lastChecked: "12 hours ago", lastTriggered: null, triggerCount: 0 },
  { id: "r5", name: "Revenue Anomaly", target: "Financial Data", condition: "YoY change exceeds", threshold: "±15%", frequency: "Quarterly", active: true, lastChecked: "2 days ago", lastTriggered: "2 weeks ago", triggerCount: 1 },
];

const DEMO_ALERTS: AlertEvent[] = [
  { id: "a1", ruleId: "r1", ruleName: "Insider Selling Spike", message: "CFO sold $8.2M in shares over the past 14 days — 340% above 5-year average for this role.", severity: "critical", timestamp: "3 days ago", read: false },
  { id: "a2", ruleId: "r3", ruleName: "New Lawsuit Filed", message: "New patent infringement case filed in Northern District of California. Plaintiff: TechPatent LLC. Estimated exposure: $12M.", severity: "warning", timestamp: "1 week ago", read: true },
  { id: "a3", ruleId: "r5", ruleName: "Revenue Anomaly", message: "Q4 revenue declined 17% YoY — exceeds your ±15% threshold. First decline in 8 quarters.", severity: "critical", timestamp: "2 weeks ago", read: true },
  { id: "a4", ruleId: "r3", ruleName: "New Lawsuit Filed", message: "Employment discrimination lawsuit filed. Class action potential flagged.", severity: "warning", timestamp: "3 weeks ago", read: true },
];

const severityStyles = {
  critical: "border-destructive/30 bg-destructive/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  info: "border-accent/30 bg-accent/5",
};

const severityIcons = {
  critical: AlertTriangle,
  warning: BellRing,
  info: Bell,
};

const MonitoringPanel = () => {
  const [rules, setRules] = useState(DEMO_RULES);
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [view, setView] = useState<"alerts" | "rules">("alerts");
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", target: "", condition: "", threshold: "", frequency: "Daily" });

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const createRule = () => {
    if (!newRule.name.trim()) return;
    setRules(prev => [{
      id: crypto.randomUUID(), ...newRule, active: true, lastChecked: null, lastTriggered: null, triggerCount: 0,
    }, ...prev]);
    setShowCreate(false);
    setNewRule({ name: "", target: "", condition: "", threshold: "", frequency: "Daily" });
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Monitoring & Alerts</h2>
            <p className="text-xs font-extralight text-muted-foreground mt-0.5">Automated surveillance with custom thresholds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/20 overflow-hidden">
            <button onClick={() => setView("alerts")} className={`px-3 py-1.5 text-[10px] font-light transition-colors ${view === "alerts" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Alerts {unreadCount > 0 && <span className="ml-1 rounded-full bg-destructive/80 px-1.5 py-0.5 text-[8px] text-white">{unreadCount}</span>}
            </button>
            <button onClick={() => setView("rules")} className={`px-3 py-1.5 text-[10px] font-light transition-colors ${view === "rules" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Rules ({rules.length})
            </button>
          </div>
        </div>
      </div>

      {view === "alerts" && (
        <div className="space-y-3">
          {alerts.map(alert => {
            const Icon = severityIcons[alert.severity];
            return (
              <div key={alert.id} className={`rounded-xl border backdrop-blur-sm p-4 transition-colors ${severityStyles[alert.severity]} ${!alert.read ? "ring-1 ring-inset ring-foreground/5" : "opacity-80"}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-destructive" : alert.severity === "warning" ? "text-amber-400" : "text-accent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-light text-foreground">{alert.ruleName}</span>
                      <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded ${alert.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400"}`}>{alert.severity}</span>
                    </div>
                    <p className="text-xs font-extralight text-muted-foreground mt-1 leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{alert.timestamp}</span>
                      {!alert.read && (
                        <button onClick={() => markRead(alert.id)} className="text-[9px] text-accent hover:underline">Mark as read</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {alerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground/40">No alerts yet. Configure monitoring rules to get started.</p>
            </div>
          )}
        </div>
      )}

      {view === "rules" && (
        <div className="space-y-4">
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Rule
          </button>

          {showCreate && (
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
              <input value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="Rule name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={newRule.target} onChange={e => setNewRule(p => ({ ...p, target: e.target.value }))} placeholder="Target (e.g. Revenue)" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <input value={newRule.condition} onChange={e => setNewRule(p => ({ ...p, condition: e.target.value }))} placeholder="Condition (e.g. Drops below)" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <input value={newRule.threshold} onChange={e => setNewRule(p => ({ ...p, threshold: e.target.value }))} placeholder="Threshold (e.g. $100K)" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <select value={newRule.frequency} onChange={e => setNewRule(p => ({ ...p, frequency: e.target.value }))} className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none">
                  <option>Hourly</option><option>Daily</option><option>Weekly</option><option>Monthly</option>
                </select>
              </div>
              <button onClick={createRule} disabled={!newRule.name.trim()} className="rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">Create Rule</button>
            </div>
          )}

          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${rule.active ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light text-foreground">{rule.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
                      <span>{rule.target}</span>
                      <span>·</span>
                      <span>{rule.condition} {rule.threshold}</span>
                      <span>·</span>
                      <span>{rule.frequency}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground/40">
                      {rule.lastChecked && <span>Last checked: {rule.lastChecked}</span>}
                      {rule.lastTriggered && <span>Last triggered: {rule.lastTriggered}</span>}
                      <span>{rule.triggerCount} triggers total</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleRule(rule.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title={rule.active ? "Pause" : "Resume"}>
                      {rule.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringPanel;
