import { useMemo } from "react";
import { TrendingDown, TrendingUp, AlertTriangle, Shield, ArrowRight, User } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { mockProjects, mockFindings, trendData } from "./mockData";
import type { ZerlalScreen } from "./types";

interface DashboardScreenProps {
  onNavigate: (screen: ZerlalScreen) => void;
  onSelectProject: (id: string) => void;
  onSelectFinding: (id: string) => void;
}

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const categoryLabels: Record<string, string> = {
  "memory-safety": "Memory Safety",
  injection: "Injection",
  secrets: "Secrets",
  dependencies: "Dependencies",
  logic: "Logic",
  crypto: "Crypto",
  auth: "Auth",
  config: "Config",
};

const DashboardScreen = ({ onNavigate, onSelectProject, onSelectFinding }: DashboardScreenProps) => {
  const totalCritical = mockProjects.reduce((s, p) => s + p.criticalCount, 0);
  const totalHigh = mockProjects.reduce((s, p) => s + p.highCount, 0);
  const totalMedium = mockProjects.reduce((s, p) => s + p.mediumCount, 0);
  const totalLow = mockProjects.reduce((s, p) => s + p.lowCount, 0);
  const totalInfo = mockProjects.reduce((s, p) => s + p.infoCount, 0);

  const severityData = [
    { name: "Critical", value: totalCritical, color: severityColors.critical },
    { name: "High", value: totalHigh, color: severityColors.high },
    { name: "Medium", value: totalMedium, color: severityColors.medium },
    { name: "Low", value: totalLow, color: severityColors.low },
    { name: "Info", value: totalInfo, color: severityColors.info },
  ];

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    mockFindings.forEach((f) => {
      cats[f.category] = (cats[f.category] || 0) + 1;
    });
    const colors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#6b7280"];
    return Object.entries(cats).map(([k, v], i) => ({
      name: categoryLabels[k] || k,
      value: v,
      color: colors[i % colors.length],
    }));
  }, []);

  const topFindings = mockFindings
    .filter((f) => f.status === "open")
    .sort((a, b) => b.cvssScore - a.cvssScore)
    .slice(0, 5);

  const prevCritical = trendData[trendData.length - 2]?.critical ?? 0;
  const trending = totalCritical > prevCritical ? "up" : "down";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Security Posture Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-light tracking-[0.1em] text-foreground/80 uppercase">Security Posture</h2>
            <p className="text-[10px] text-muted-foreground/35 mt-0.5">Real-time vulnerability intelligence across {mockProjects.length} projects</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          {severityData.map((s) => (
            <div key={s.name} className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4">
              <div className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">{s.name}</div>
              <div className="text-2xl font-extralight mt-1" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Trend Chart */}
          <div className="col-span-1 rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">30-Day Trend</span>
              {trending === "up" ? (
                <TrendingUp className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(0 0% 40%)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0 0% 6%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                      fontSize: "10px",
                    }}
                  />
                  <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#critGrad)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="high" stroke="#f97316" fill="url(#highGrad)" strokeWidth={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity Donut */}
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4">
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">By Severity</span>
            <div className="h-36 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0 0% 6%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                      fontSize: "10px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {severityData.map((s) => (
                <div key={s.name} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[9px] text-muted-foreground/40">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Donut */}
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm p-4">
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">By Category</span>
            <div className="h-36 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0 0% 6%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                      fontSize: "10px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-[9px] text-muted-foreground/40">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Projects + Action Required */}
        <div className="grid grid-cols-3 gap-4">
          {/* Projects */}
          <div className="col-span-2 rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-border/[0.06] flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Projects</span>
              <button
                onClick={() => onNavigate("project")}
                className="text-[9px] text-muted-foreground/30 hover:text-foreground/50 transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="divide-y divide-border/[0.04]">
              {mockProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-foreground/[0.02] transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-medium ${
                    p.riskGrade === "A" ? "bg-emerald-500/10 text-emerald-400" :
                    p.riskGrade === "B" ? "bg-blue-500/10 text-blue-400" :
                    p.riskGrade === "C" ? "bg-yellow-500/10 text-yellow-400" :
                    p.riskGrade === "D" ? "bg-orange-500/10 text-orange-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {p.riskGrade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-foreground/70 truncate">{p.name}</div>
                    <div className="text-[9px] text-muted-foreground/30">{p.language}</div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    {p.criticalCount > 0 && <span className="text-red-400">{p.criticalCount}C</span>}
                    {p.highCount > 0 && <span className="text-orange-400">{p.highCount}H</span>}
                    <span className="text-muted-foreground/25">{p.mediumCount + p.lowCount + p.infoCount} other</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Required */}
          <div className="rounded-xl border border-border/[0.06] bg-card/20 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-border/[0.06] flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400/60" />
                Action Required
              </span>
            </div>
            <div className="divide-y divide-border/[0.04]">
              {topFindings.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectFinding(f.id)}
                  className="w-full px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      f.severity === "critical" ? "bg-red-400" :
                      f.severity === "high" ? "bg-orange-400" :
                      "bg-yellow-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-foreground/60 line-clamp-1">{f.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] text-muted-foreground/25">{f.file.split("/").pop()}</span>
                        <span className="text-[8px] text-muted-foreground/20">{f.age}d old</span>
                        {!f.assignee && (
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="text-[8px] text-foreground/30 hover:text-foreground/60 flex items-center gap-0.5"
                          >
                            <User className="h-2 w-2" /> Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border/[0.04]">
              <button
                onClick={() => onNavigate("finding")}
                className="text-[9px] text-muted-foreground/30 hover:text-foreground/50 transition-colors flex items-center gap-1"
              >
                View all findings <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
