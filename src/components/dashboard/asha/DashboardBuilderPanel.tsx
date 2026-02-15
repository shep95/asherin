import { useState, useEffect } from "react";
import { BarChart3, LineChart, PieChart, TrendingUp, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart as RLineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PIE_COLORS = ["hsl(220, 60%, 60%)", "hsl(280, 50%, 55%)", "hsl(180, 50%, 50%)", "hsl(45, 80%, 55%)", "hsl(0, 60%, 55%)"];

const DashboardBuilderPanel = () => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("asha_datasets")
        .select("id, file_name, row_count, col_count, quality_score, schema, created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: true });
      if (data) setDatasets(data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  if (datasets.length === 0) {
    return <div className="flex justify-center items-center h-full"><p className="text-xs text-muted-foreground/40">Upload datasets to build dashboards.</p></div>;
  }

  const totalRows = datasets.reduce((s, d) => s + (d.row_count || 0), 0);
  const totalCols = datasets.reduce((s, d) => s + (d.col_count || 0), 0);
  const avgQuality = Math.round(datasets.reduce((s, d) => s + (d.quality_score || 0), 0) / datasets.length);

  // Compute stats for charts
  const qualityData = datasets.map((d) => ({ name: d.file_name.slice(0, 15), quality: d.quality_score || 0 }));
  const sizeData = datasets.map((d) => ({ name: d.file_name.slice(0, 15), rows: d.row_count || 0 }));

  // Column type distribution
  const typeCounts: Record<string, number> = {};
  datasets.forEach((d) => {
    (d.schema || []).forEach((col: any) => {
      typeCounts[col.type] = (typeCounts[col.type] || 0) + 1;
    });
  });
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-extralight tracking-wide text-foreground">Dashboard</h2>
        <p className="text-xs font-extralight text-muted-foreground mt-1">Live metrics from your uploaded data</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Datasets", value: String(datasets.length) },
          { label: "Total Rows", value: totalRows.toLocaleString() },
          { label: "Total Columns", value: String(totalCols) },
          { label: "Avg Quality", value: `${avgQuality}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-extralight text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Data Quality by Dataset</h3>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="quality" fill="hsl(140, 50%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Column Type Distribution</h3>
            <PieChart className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RPieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {typeData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-muted-foreground">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Rows by Dataset</h3>
            <LineChart className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sizeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="rows" fill="hsl(220, 60%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardBuilderPanel;
