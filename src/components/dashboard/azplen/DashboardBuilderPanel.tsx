import { useState, useEffect } from "react";
import {
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, TrendingUp, Loader2,
  AlertTriangle, Shield, TrendingDown, Activity, Eye, ArrowUpRight, ArrowDownRight,
  Users, DollarSign, Zap, ChevronRight, Bell, Clock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart as RLineChart, Line, AreaChart, Area
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PIE_COLORS = ["hsl(220, 60%, 60%)", "hsl(280, 50%, 55%)", "hsl(180, 50%, 50%)", "hsl(45, 80%, 55%)", "hsl(0, 60%, 55%)"];

const DashboardBuilderPanel = () => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [dsRes, insRes, alertRes] = await Promise.all([
        supabase.from("asha_datasets").select("id, file_name, row_count, col_count, quality_score, schema, created_at, status").eq("user_id", user.id).eq("status", "ready").order("created_at", { ascending: true }),
        supabase.from("asha_insights").select("*").eq("user_id", user.id).eq("dismissed", false).order("created_at", { ascending: false }).limit(10),
        supabase.from("asha_alerts").select("*").eq("user_id", user.id).eq("read", false).order("created_at", { ascending: false }).limit(5),
      ]);
      if (dsRes.data) setDatasets(dsRes.data);
      if (insRes.data) setInsights(insRes.data);
      if (alertRes.data) setAlerts(alertRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  const totalRows = datasets.reduce((s, d) => s + (d.row_count || 0), 0);
  const totalCols = datasets.reduce((s, d) => s + (d.col_count || 0), 0);
  const avgQuality = datasets.length > 0 ? Math.round(datasets.reduce((s, d) => s + (d.quality_score || 0), 0) / datasets.length) : 0;

  const qualityData = datasets.map((d) => ({ name: d.file_name.slice(0, 15), quality: d.quality_score || 0 }));
  const sizeData = datasets.map((d) => ({ name: d.file_name.slice(0, 15), rows: d.row_count || 0 }));

  const typeCounts: Record<string, number> = {};
  datasets.forEach((d) => {
    (d.schema || []).forEach((col: any) => {
      typeCounts[col.type] = (typeCounts[col.type] || 0) + 1;
    });
  });
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Executive Dashboard</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Single-page intelligence summary</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Clock className="h-3 w-3" />
            <span>Last updated: just now</span>
          </div>
        </div>
      </div>

      {/* Vital signs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Total Datasets</p>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/20" />
          </div>
          <p className="text-2xl font-extralight text-foreground mt-2">{datasets.length}</p>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400">Active</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Total Records</p>
            <Activity className="h-3.5 w-3.5 text-muted-foreground/20" />
          </div>
          <p className="text-2xl font-extralight text-foreground mt-2">{totalRows.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/40">{totalCols} columns</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Data Quality</p>
            <Shield className="h-3.5 w-3.5 text-muted-foreground/20" />
          </div>
          <p className={`text-2xl font-extralight mt-2 ${avgQuality >= 80 ? "text-emerald-400" : avgQuality >= 60 ? "text-amber-400" : "text-destructive"}`}>
            {avgQuality || "--"}%
          </p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/40">{avgQuality >= 80 ? "Healthy" : "Needs attention"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Active Alerts</p>
            <Bell className="h-3.5 w-3.5 text-muted-foreground/20" />
          </div>
          <p className={`text-2xl font-extralight mt-2 ${alerts.length > 0 ? "text-amber-400" : "text-foreground"}`}>
            {alerts.length}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/40">{alerts.length > 0 ? "Unread" : "All clear"}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Data Quality by Dataset</h3>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          {qualityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={qualityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="quality" fill="hsl(140, 50%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[10px] text-muted-foreground/30">No data</div>
          )}
        </div>

        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Column Type Distribution</h3>
            <PieChartIcon className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          {typeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <RPieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {typeData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[10px] text-muted-foreground/30">No data</div>
          )}
        </div>
      </div>

      {/* Row size chart */}
      {sizeData.length > 0 && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Records by Dataset</h3>
            <LineChartIcon className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sizeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="rows" stroke="hsl(220, 60%, 60%)" fill="hsl(220, 60%, 60%)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights feed */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-xs font-light text-foreground mb-3">Recent Insights</h3>
          <div className="space-y-2">
            {insights.slice(0, 5).map(insight => (
              <div key={insight.id} className="rounded-xl border border-border/20 bg-card/20 p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-light text-foreground">{insight.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-2">{insight.description}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground/30 shrink-0">{new Date(insight.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats sidebar info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/20 bg-card/20 p-4">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Data Sources</p>
          <p className="text-lg font-extralight text-foreground mt-1">{datasets.length}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">active</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 p-4">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Insights</p>
          <p className="text-lg font-extralight text-foreground mt-1">{insights.length}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">active</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/20 p-4">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Coverage</p>
          <p className="text-lg font-extralight text-foreground mt-1">{totalRows > 0 ? "Active" : "--"}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">{totalRows.toLocaleString()} records</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardBuilderPanel;
