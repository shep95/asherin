import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, Activity, AlertTriangle, Bug,
  Globe, Bot, Zap, Eye, Lock, Radio, Target, TrendingUp, RefreshCw, Plus,
  ChevronDown, ChevronRight, Clock, Server, Skull, Crosshair, Layers
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface DashboardData {
  stats: {
    total_events_24h: number;
    total_events_7d: number;
    critical_events: number;
    high_events: number;
    medium_events: number;
    blocked_attacks: number;
    sql_injections: number;
    xss_attacks: number;
    ssrf_attempts: number;
    rate_limit_violations: number;
    malicious_bots: number;
    geo_blocks: number;
    honeypot_triggers: number;
    active_threats: number;
    auto_incidents: number;
    threat_score: number;
  };
  eventBreakdown: Record<string, number>;
  hourlyTimeline: { hour: string; count: number; critical: number }[];
  recentEvents: any[];
  incidents: any[];
  honeypotLogs: any[];
  threatIntel: any[];
  behaviorAnalytics: any[];
}

const SYSTEMS = [
  { id: "waf", name: "Web Application Firewall", icon: Shield, color: "text-blue-400", desc: "Blocks SQL injection, XSS, SSRF, path traversal" },
  { id: "ids", name: "Intrusion Detection System", icon: Eye, color: "text-purple-400", desc: "Pattern-based threat detection" },
  { id: "incident", name: "Automated Incident Response", icon: Zap, color: "text-amber-400", desc: "Auto-locks accounts, blocks IPs" },
  { id: "audit", name: "Comprehensive Audit Logging", icon: Layers, color: "text-cyan-400", desc: "Full forensic event recording" },
  { id: "honeypot", name: "Honeypot Traps", icon: Bug, color: "text-red-400", desc: "Decoy endpoints to trap attackers" },
  { id: "dashboard", name: "Security Dashboard", icon: Activity, color: "text-emerald-400", desc: "Real-time threat monitoring" },
  { id: "uba", name: "User Behavior Analytics", icon: Target, color: "text-pink-400", desc: "Anomaly detection via behavioral patterns" },
  { id: "threat_intel", name: "Threat Intelligence", icon: Skull, color: "text-orange-400", desc: "Known malicious IP/pattern database" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  sql_injection: ShieldX,
  xss_attack: ShieldAlert,
  ssrf_attempt: Globe,
  path_traversal: Server,
  malicious_bot: Bot,
  geo_blocked: Globe,
  rate_limit_exceeded: Clock,
  threat_intel_match: Skull,
  threat_intel_pattern: Crosshair,
  honeypot_triggered: Bug,
};

const SecurityDashboardView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "threats" | "honeypots" | "incidents">("overview");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [addingThreat, setAddingThreat] = useState(false);
  const [newThreat, setNewThreat] = useState({ indicator_type: "ip", indicator_value: "", threat_category: "malicious" });

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("security-gateway", {
        body: { action: "dashboard" },
      });
      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error("Failed to load security dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const addThreatIndicator = async () => {
    if (!newThreat.indicator_value.trim()) return;
    try {
      await supabase.functions.invoke("security-gateway", {
        body: { action: "add_threat", ...newThreat },
      });
      toast({ title: "Threat indicator added" });
      setAddingThreat(false);
      setNewThreat({ indicator_type: "ip", indicator_value: "", threat_category: "malicious" });
      loadDashboard();
    } catch {
      toast({ title: "Failed to add indicator", variant: "destructive" });
    }
  };

  const threatScore = data?.stats?.threat_score ?? 0;
  const scoreColor = threatScore > 60 ? "text-red-400" : threatScore > 30 ? "text-amber-400" : "text-emerald-400";
  const scoreGlow = threatScore > 60 ? "shadow-red-500/20" : threatScore > 30 ? "shadow-amber-500/20" : "shadow-emerald-500/20";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-8 w-8 text-accent animate-pulse" />
          <p className="text-xs font-light tracking-widest text-muted-foreground">INITIALIZING SECURITY SYSTEMS…</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-6 w-6 text-accent" />
              <h1 className="text-xl font-extralight tracking-[0.2em] text-foreground">SECURITY COMMAND CENTER</h1>
            </div>
            <p className="text-xs font-light text-muted-foreground">8 active defense systems • Real-time threat monitoring</p>
          </div>
          <button onClick={loadDashboard} className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-4 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Threat Score + Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Threat Score */}
          <div className={`col-span-1 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6 flex flex-col items-center justify-center shadow-lg ${scoreGlow}`}>
            <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase mb-3">Threat Level</p>
            <div className={`text-5xl font-extralight ${scoreColor}`}>{threatScore}</div>
            <p className={`text-xs font-light mt-2 ${scoreColor}`}>
              {threatScore > 60 ? "ELEVATED" : threatScore > 30 ? "MODERATE" : "LOW"}
            </p>
          </div>

          {/* Attack Stats */}
          <div className="col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Blocked (24h)", value: data?.stats.blocked_attacks ?? 0, icon: ShieldCheck, color: "text-emerald-400" },
              { label: "Critical", value: data?.stats.critical_events ?? 0, icon: ShieldX, color: "text-red-400" },
              { label: "Active Threats", value: data?.stats.active_threats ?? 0, icon: Skull, color: "text-orange-400" },
              { label: "Incidents", value: data?.stats.auto_incidents ?? 0, icon: AlertTriangle, color: "text-amber-400" },
              { label: "SQLi Blocked", value: data?.stats.sql_injections ?? 0, icon: ShieldX, color: "text-red-400" },
              { label: "XSS Blocked", value: data?.stats.xss_attacks ?? 0, icon: ShieldAlert, color: "text-purple-400" },
              { label: "Bot Detections", value: data?.stats.malicious_bots ?? 0, icon: Bot, color: "text-pink-400" },
              { label: "Honeypot Hits", value: data?.stats.honeypot_triggers ?? 0, icon: Bug, color: "text-cyan-400" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  <span className="text-[10px] font-light tracking-wider text-muted-foreground uppercase">{stat.label}</span>
                </div>
                <div className={`text-2xl font-extralight ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 8 Systems Status */}
        <div>
          <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-4">Active Defense Systems</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SYSTEMS.map((sys) => (
              <div key={sys.id} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`rounded-lg bg-card/60 p-2 ${sys.color}`}>
                    <sys.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light text-foreground truncate">{sys.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-light text-emerald-400">ACTIVE</span>
                  </div>
                </div>
                <p className="text-[10px] font-light text-muted-foreground/70">{sys.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detects & Blocks Checklist */}
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6">
          <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-4">Detection Capabilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "SQL Injection", examples: "' OR 1=1--, UNION SELECT, DROP TABLE", detected: data?.stats.sql_injections ?? 0 },
              { label: "XSS Attacks", examples: "<script>, javascript:, onerror=, eval()", detected: data?.stats.xss_attacks ?? 0 },
              { label: "SSRF Attacks", examples: "localhost, 127.0.0.1, internal IPs, metadata", detected: data?.stats.ssrf_attempts ?? 0 },
              { label: "Rate Limit Abuse", examples: ">60 requests/min = blocked", detected: data?.stats.rate_limit_violations ?? 0 },
              { label: "Malicious Bots", examples: "sqlmap, nikto, burp, metasploit, nmap", detected: data?.stats.malicious_bots ?? 0 },
              { label: "Geo-Blocking", examples: "China, Russia, North Korea", detected: data?.stats.geo_blocks ?? 0 },
            ].map((cap) => (
              <div key={cap.label} className="flex items-start gap-3 rounded-xl border border-border/10 bg-card/20 p-3">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-light text-foreground">{cap.label}</p>
                  <p className="text-[10px] font-light text-muted-foreground/60 mt-0.5">{cap.examples}</p>
                  {cap.detected > 0 && (
                    <span className="inline-block mt-1 text-[9px] font-light text-red-400 bg-red-400/10 rounded px-1.5 py-0.5">{cap.detected} detected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-1">
          {(["overview", "events", "threats", "honeypots", "incidents"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg px-4 py-2 text-xs font-light transition-colors capitalize ${
                activeTab === tab ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Activity Timeline */}
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6">
              <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-4">24-Hour Activity Timeline</h3>
              <div className="flex items-end gap-1 h-32">
                {(data?.hourlyTimeline ?? []).map((h, i) => {
                  const maxCount = Math.max(...(data?.hourlyTimeline ?? []).map(t => t.count), 1);
                  const height = Math.max(4, (h.count / maxCount) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: "100px" }}>
                        <div
                          className={`w-full rounded-t ${h.critical > 0 ? "bg-red-400/60" : "bg-accent/40"}`}
                          style={{ height: `${height}%`, minHeight: "4px" }}
                          title={`${h.hour}: ${h.count} events (${h.critical} critical)`}
                        />
                      </div>
                      {i % 4 === 0 && (
                        <span className="text-[8px] font-light text-muted-foreground/50">{h.hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Type Breakdown */}
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6">
              <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-4">Attack Vector Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(data?.eventBreakdown ?? {}).sort(([,a],[,b]) => b - a).map(([type, count]) => {
                  const total = Object.values(data?.eventBreakdown ?? {}).reduce((s, v) => s + v, 0) || 1;
                  const pct = Math.round((count / total) * 100);
                  const Icon = EVENT_ICONS[type] || Shield;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-light text-foreground w-40 truncate">{type.replace(/_/g, " ")}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-card/60 overflow-hidden">
                        <div className="h-full rounded-full bg-accent/50" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-light text-muted-foreground w-12 text-right">{count}</span>
                    </div>
                  );
                })}
                {Object.keys(data?.eventBreakdown ?? {}).length === 0 && (
                  <p className="text-xs font-light text-muted-foreground/50 text-center py-8">No attacks detected — all systems nominal</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6 space-y-2">
            <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-4">Recent Security Events</h3>
            {(data?.recentEvents ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-400/50" />
                <p className="text-xs font-light text-muted-foreground/50">No security events detected</p>
              </div>
            ) : (
              (data?.recentEvents ?? []).map((evt) => {
                const Icon = EVENT_ICONS[evt.event_type] || Shield;
                const isExpanded = expandedEvent === evt.id;
                return (
                  <button
                    key={evt.id}
                    onClick={() => setExpandedEvent(isExpanded ? null : evt.id)}
                    className="w-full text-left rounded-xl border border-border/10 bg-card/20 p-3 hover:bg-card/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-light text-foreground">{evt.event_type.replace(/_/g, " ")}</span>
                          <span className={`text-[9px] font-light rounded px-1.5 py-0.5 border ${SEVERITY_COLORS[evt.severity] || ""}`}>
                            {evt.severity}
                          </span>
                        </div>
                        <p className="text-[10px] font-light text-muted-foreground/60 mt-0.5 truncate">{evt.detection_rule}</p>
                      </div>
                      <span className="text-[10px] font-light text-muted-foreground/40 shrink-0">
                        {new Date(evt.created_at).toLocaleString()}
                      </span>
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/10 grid grid-cols-2 gap-2 text-[10px] font-light">
                        <div><span className="text-muted-foreground/50">IP:</span> <span className="text-foreground">{evt.source_ip}</span></div>
                        <div><span className="text-muted-foreground/50">Method:</span> <span className="text-foreground">{evt.request_method}</span></div>
                        <div><span className="text-muted-foreground/50">Path:</span> <span className="text-foreground">{evt.request_path}</span></div>
                        <div><span className="text-muted-foreground/50">Action:</span> <span className="text-emerald-400">{evt.action_taken}</span></div>
                        {evt.payload_snippet && (
                          <div className="col-span-2"><span className="text-muted-foreground/50">Payload:</span> <code className="text-red-400 bg-red-400/5 rounded px-1">{evt.payload_snippet}</code></div>
                        )}
                        {evt.geo_country && (
                          <div><span className="text-muted-foreground/50">Country:</span> <span className="text-foreground">{evt.geo_country}</span></div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {activeTab === "threats" && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Threat Intelligence Database</h3>
              <button
                onClick={() => setAddingThreat(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-card/40 px-3 py-1.5 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Indicator
              </button>
            </div>

            {addingThreat && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-light text-muted-foreground block mb-1">Type</label>
                    <select
                      value={newThreat.indicator_type}
                      onChange={(e) => setNewThreat({ ...newThreat, indicator_type: e.target.value })}
                      className="w-full rounded-lg border border-border/30 bg-card/40 px-3 py-1.5 text-xs font-light text-foreground"
                    >
                      <option value="ip">IP Address</option>
                      <option value="user_agent">User Agent</option>
                      <option value="pattern">Pattern</option>
                      <option value="geo_block">Geo Block</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-light text-muted-foreground block mb-1">Value</label>
                    <input
                      value={newThreat.indicator_value}
                      onChange={(e) => setNewThreat({ ...newThreat, indicator_value: e.target.value })}
                      className="w-full rounded-lg border border-border/30 bg-card/40 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40"
                      placeholder="e.g. 192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-light text-muted-foreground block mb-1">Category</label>
                    <select
                      value={newThreat.threat_category}
                      onChange={(e) => setNewThreat({ ...newThreat, threat_category: e.target.value })}
                      className="w-full rounded-lg border border-border/30 bg-card/40 px-3 py-1.5 text-xs font-light text-foreground"
                    >
                      <option value="malicious">Malicious</option>
                      <option value="scanner">Scanner</option>
                      <option value="brute_force">Brute Force</option>
                      <option value="exploit_tool">Exploit Tool</option>
                      <option value="geo_restricted">Geo Restricted</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddingThreat(false)} className="px-3 py-1.5 rounded-lg text-xs font-light text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button onClick={addThreatIndicator} className="px-4 py-1.5 rounded-lg bg-accent/20 text-xs font-light text-accent hover:bg-accent/30 transition-colors">Add</button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {(data?.threatIntel ?? []).map((threat) => (
                <div key={threat.id} className="flex items-center gap-3 rounded-xl border border-border/10 bg-card/20 p-3">
                  <Skull className="h-3.5 w-3.5 text-red-400/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-light text-muted-foreground/60 uppercase">{threat.indicator_type}</span>
                      <code className="text-xs font-light text-foreground">{threat.indicator_value}</code>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] font-light text-muted-foreground/50">{threat.threat_category}</span>
                      <span className="text-[9px] font-light text-muted-foreground/50">Confidence: {threat.confidence}%</span>
                      <span className="text-[9px] font-light text-muted-foreground/50">Hits: {threat.hit_count}</span>
                      <span className="text-[9px] font-light text-muted-foreground/50">Source: {threat.source}</span>
                    </div>
                  </div>
                  {threat.is_active && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
                </div>
              ))}
              {(data?.threatIntel ?? []).length === 0 && (
                <p className="text-xs font-light text-muted-foreground/50 text-center py-8">No active threat indicators</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "honeypots" && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Honeypot Trap Logs</h3>
              <div className="flex items-center gap-2">
                <Bug className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-light text-amber-400">{(data?.honeypotLogs ?? []).length} triggers</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 mb-4">
              <p className="text-[10px] font-light text-amber-400/80">
                Honeypots are decoy endpoints that look like real admin panels, API keys, and user databases. 
                Any entity that accesses them is automatically flagged as malicious and their IP is permanently blocked.
              </p>
            </div>

            <div className="space-y-1.5">
              {(data?.honeypotLogs ?? []).map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-xl border border-border/10 bg-card/20 p-3">
                  <Bug className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-light text-foreground">{log.trap_name}</span>
                      <span className="text-[9px] font-light text-muted-foreground/50 bg-card/40 rounded px-1.5">{log.trap_type}</span>
                    </div>
                    <p className="text-[10px] font-light text-muted-foreground/60 mt-0.5">
                      IP: {log.source_ip} • {log.geo_country || "Unknown"} • {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(data?.honeypotLogs ?? []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Bug className="h-8 w-8 text-amber-400/30" />
                  <p className="text-xs font-light text-muted-foreground/50">No honeypot triggers — traps are set and waiting</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-6 space-y-4">
            <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase mb-2">Incident Response Log</h3>
            <div className="space-y-1.5">
              {(data?.incidents ?? []).map((inc) => (
                <div key={inc.id} className="rounded-xl border border-border/10 bg-card/20 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-light text-foreground">{inc.incident_type.replace(/_/g, " ")}</span>
                        <span className={`text-[9px] font-light rounded px-1.5 py-0.5 border ${SEVERITY_COLORS[inc.severity] || ""}`}>
                          {inc.severity}
                        </span>
                        {inc.auto_resolved && (
                          <span className="text-[9px] font-light text-emerald-400 bg-emerald-400/10 rounded px-1.5 py-0.5">resolved</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-light text-muted-foreground/40">{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-light pl-7">
                    <div><span className="text-muted-foreground/50">Action:</span> <span className="text-accent">{inc.action_taken}</span></div>
                    {inc.target_ip && <div><span className="text-muted-foreground/50">Target IP:</span> <span className="text-foreground">{inc.target_ip}</span></div>}
                  </div>
                </div>
              ))}
              {(data?.incidents ?? []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ShieldCheck className="h-8 w-8 text-emerald-400/50" />
                  <p className="text-xs font-light text-muted-foreground/50">No incidents recorded — all clear</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default SecurityDashboardView;
