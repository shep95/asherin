import { useState } from "react";
import { BarChart3, LineChart, PieChart, TrendingUp, Plus, Share, Download, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart as RLineChart, Line } from "recharts";

const barData = [
  { region: "US", revenue: 1200000 },
  { region: "EU", revenue: 890000 },
  { region: "APAC", revenue: 650000 },
  { region: "LATAM", revenue: 320000 },
  { region: "MEA", revenue: 180000 },
];

const pieData = [
  { name: "Enterprise", value: 62 },
  { name: "Mid-Market", value: 24 },
  { name: "SMB", value: 14 },
];

const lineData = [
  { month: "Jul", users: 42000 },
  { month: "Aug", users: 48000 },
  { month: "Sep", users: 55000 },
  { month: "Oct", users: 61000 },
  { month: "Nov", users: 72000 },
  { month: "Dec", users: 84000 },
];

const PIE_COLORS = ["hsl(220, 60%, 60%)", "hsl(280, 50%, 55%)", "hsl(180, 50%, 50%)"];

const DashboardBuilderPanel = () => {
  const [selectedChart, setSelectedChart] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Dashboard Builder</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Drag and drop charts from your data</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
            <Plus className="h-3.5 w-3.5" />Add Chart
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
            <Share className="h-3.5 w-3.5" />Share
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" />Export PDF
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: "$3.24M", trend: "+12.4%", up: true },
          { label: "Active Customers", value: "4,721", trend: "+8.2%", up: true },
          { label: "Avg Transaction", value: "$502", trend: "-3.1%", up: false },
          { label: "Churn Rate", value: "4.2%", trend: "-1.8%", up: true },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-extralight text-foreground mt-1">{stat.value}</p>
            <p className={`text-[10px] mt-1 ${stat.up ? "text-emerald-400" : "text-destructive"}`}>
              <TrendingUp className={`h-2.5 w-2.5 inline mr-0.5 ${stat.up ? "" : "rotate-180"}`} />
              {stat.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue by Region */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Revenue by Region</h3>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis dataKey="region" tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="revenue" fill="hsl(220, 60%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Segment */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Revenue by Segment</h3>
            <PieChart className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RPieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                <span className="text-muted-foreground">{d.name} ({d.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Active Users */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-light text-foreground">Monthly Active Users</h3>
            <LineChart className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RLineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: "hsl(0, 0%, 6%)", border: "1px solid hsl(0, 0%, 14%)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="users" stroke="hsl(180, 50%, 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(180, 50%, 50%)" }} />
            </RLineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardBuilderPanel;
