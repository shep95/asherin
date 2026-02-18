import { useState, useEffect } from "react";
import { Bell, BellRing, Plus, Trash2, Clock, AlertTriangle, Activity, Pause, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MonitorRule { id: string; name: string; target: string; condition: string; threshold: string; frequency: string; active: boolean; lastChecked: string | null; triggerCount: number; }
interface AlertEvent { id: string; ruleId: string | null; ruleName: string; message: string; severity: "critical" | "warning" | "info"; timestamp: string; read: boolean; }

const severityStyles: Record<string, string> = { critical: "border-destructive/30 bg-destructive/5", warning: "border-amber-500/30 bg-amber-500/5", info: "border-accent/30 bg-accent/5" };
const severityIcons: Record<string, React.ElementType> = { critical: AlertTriangle, warning: BellRing, info: Bell };

const MonitoringPanel = () => {
  const [rules, setRules] = useState<MonitorRule[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [view, setView] = useState<"alerts" | "rules">("alerts");
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", target: "", condition: "", threshold: "", frequency: "Daily" });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [rulesRes, alertsRes] = await Promise.all([
        supabase.from("asha_monitor_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("asha_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (rulesRes.data) setRules(rulesRes.data.map((r: any) => ({ id: r.id, name: r.name, target: r.target, condition: r.condition, threshold: r.threshold, frequency: r.frequency, active: r.active, lastChecked: r.last_checked ? new Date(r.last_checked).toLocaleString() : null, triggerCount: r.trigger_count })));
      if (alertsRes.data) setAlerts(alertsRes.data.map((a: any) => ({ id: a.id, ruleId: a.rule_id, ruleName: a.rule_name, message: a.message, severity: a.severity as any, timestamp: new Date(a.created_at).toLocaleString(), read: a.read })));
      setLoading(false);
    };
    load();

    // Realtime subscription for alerts
    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asha_alerts', filter: `user_id=eq.${user.id}` }, (payload) => {
        const a = payload.new as any;
        setAlerts(prev => [{ id: a.id, ruleId: a.rule_id, ruleName: a.rule_name, message: a.message, severity: a.severity, timestamp: new Date(a.created_at).toLocaleString(), read: a.read }, ...prev]);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [user]);

  const toggleRule = async (id: string) => { const rule = rules.find(r => r.id === id); if (!rule) return; await supabase.from("asha_monitor_rules").update({ active: !rule.active }).eq("id", id); setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r)); };
  const deleteRule = async (id: string) => { await supabase.from("asha_monitor_rules").delete().eq("id", id); setRules(prev => prev.filter(r => r.id !== id)); };
  const markRead = async (id: string) => { await supabase.from("asha_alerts").update({ read: true }).eq("id", id); setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a)); };

  const createRule = async () => {
    if (!newRule.name.trim() || !user) return;
    const { data } = await supabase.from("asha_monitor_rules").insert({ user_id: user.id, ...newRule }).select().single();
    if (data) setRules(prev => [{ id: data.id, name: data.name, target: data.target, condition: data.condition, threshold: data.threshold, frequency: data.frequency, active: data.active, lastChecked: null, triggerCount: 0 }, ...prev]);
    setShowCreate(false); setNewRule({ name: "", target: "", condition: "", threshold: "", frequency: "Daily" });
  };

  const unreadCount = alerts.filter(a => !a.read).length;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-accent" /><div><h2 className="text-lg font-extralight tracking-wide text-foreground">Monitoring & Alerts</h2><p className="text-xs font-extralight text-muted-foreground mt-0.5">Automated surveillance with custom thresholds</p></div></div>
        <div className="flex rounded-lg border border-border/20 overflow-hidden">
          <button onClick={() => setView("alerts")} className={`px-3 py-1.5 text-[10px] font-light transition-colors ${view === "alerts" ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}>Alerts {unreadCount > 0 && <span className="ml-1 rounded-full bg-destructive/80 px-1.5 py-0.5 text-[8px] text-white">{unreadCount}</span>}</button>
          <button onClick={() => setView("rules")} className={`px-3 py-1.5 text-[10px] font-light transition-colors ${view === "rules" ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}>Rules ({rules.length})</button>
        </div>
      </div>

      {view === "alerts" && (
        <div className="space-y-3">
          {alerts.map(alert => { const Icon = severityIcons[alert.severity] || Bell; return (
            <div key={alert.id} className={`rounded-xl border backdrop-blur-sm p-4 ${severityStyles[alert.severity] || ""} ${!alert.read ? "ring-1 ring-inset ring-foreground/5" : "opacity-80"}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-destructive" : alert.severity === "warning" ? "text-amber-400" : "text-accent"}`} />
                <div className="flex-1"><div className="flex items-center gap-2"><span className="text-xs font-light text-foreground">{alert.ruleName}</span><span className={`text-[8px] uppercase px-1.5 py-0.5 rounded ${alert.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400"}`}>{alert.severity}</span></div>
                  <p className="text-xs font-extralight text-muted-foreground mt-1 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2"><span className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{alert.timestamp}</span>{!alert.read && <button onClick={() => markRead(alert.id)} className="text-[9px] text-accent hover:underline">Mark read</button>}</div>
                </div>
              </div>
            </div>
          ); })}
          {alerts.length === 0 && <div className="text-center py-12"><Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" /><p className="text-xs text-muted-foreground/40">No alerts. Create monitoring rules to get started.</p></div>}
        </div>
      )}

      {view === "rules" && (
        <div className="space-y-4">
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent hover:bg-accent/20 transition-colors"><Plus className="h-3.5 w-3.5" /> New Rule</button>
          {showCreate && (
            <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
              <input value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="Rule name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={newRule.target} onChange={e => setNewRule(p => ({ ...p, target: e.target.value }))} placeholder="Target" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <input value={newRule.condition} onChange={e => setNewRule(p => ({ ...p, condition: e.target.value }))} placeholder="Condition" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <input value={newRule.threshold} onChange={e => setNewRule(p => ({ ...p, threshold: e.target.value }))} placeholder="Threshold" className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
                <select value={newRule.frequency} onChange={e => setNewRule(p => ({ ...p, frequency: e.target.value }))} className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none"><option>Hourly</option><option>Daily</option><option>Weekly</option></select>
              </div>
              <button onClick={createRule} disabled={!newRule.name.trim()} className="rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 disabled:opacity-40">Create</button>
            </div>
          )}
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 group">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${rule.active ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1"><p className="text-xs font-light text-foreground">{rule.name}</p><div className="text-[10px] text-muted-foreground/50 mt-1">{rule.target} · {rule.condition} {rule.threshold} · {rule.frequency}</div></div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleRule(rule.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground">{rule.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
