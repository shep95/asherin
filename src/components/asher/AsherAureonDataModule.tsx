import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, Users, Activity, DollarSign, Globe, Smartphone, RefreshCw, ShieldAlert, TrendingUp, Eye } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart as RBarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

type Range = 7 | 14 | 30 | 90;

const fmt = (n: number) => new Intl.NumberFormat().format(n);
const COLORS = ["#94a3b8", "#cbd5e1", "#64748b", "#475569", "#334155", "#1e293b"];

interface Stats {
  loading: boolean;
  totalUsers: number;
  newUsers: number;
  activeSessions: number;
  activeSubs: number;
  mrr: number;
  totalEvents: number;
  signupSeries: { date: string; count: number }[];
  eventSeries: { date: string; count: number }[];
  topEvents: { name: string; count: number }[];
  devices: { name: string; value: number }[];
  countries: { name: string; value: number }[];
  tiers: { name: string; value: number }[];
  recent: { id: string; event_type: string; description: string; created_at: string; outcome: string }[];
}

const initial: Stats = {
  loading: true, totalUsers: 0, newUsers: 0, activeSessions: 0, activeSubs: 0, mrr: 0, totalEvents: 0,
  signupSeries: [], eventSeries: [], topEvents: [], devices: [], countries: [], tiers: [], recent: [],
};

const TIER_PRICES: Record<string, number> = {
  chat: 47, aureon: 199, pro: 740, lifetime: 0,
};

const tierFromProduct = (pid: string): string => {
  const p = (pid || "").toLowerCase();
  if (p.includes("lifetime")) return "lifetime";
  if (p.includes("pro")) return "pro";
  if (p.includes("aureon")) return "aureon";
  if (p.includes("chat")) return "chat";
  return "other";
};

export default function AsherAureonDataModule() {
  const { user } = useAuth();
  const isAdmin = (user?.email || "").toLowerCase() === ADMIN_EMAIL;
  const [range, setRange] = useState<Range>(30);
  const [stats, setStats] = useState<Stats>(initial);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setStats((s) => ({ ...s, loading: true }));
      const since = subDays(startOfDay(new Date()), range).toISOString();

      const [
        profilesAll, profilesNew, sessions, subs, activity, recent,
      ] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id, created_at").gte("created_at", since),
        supabase.from("user_sessions").select("device_type, country, last_active_at, revoked_at").is("revoked_at", null),
        supabase.from("user_subscriptions").select("product_id, status, subscription_type").eq("status", "active"),
        supabase.from("account_activity_log").select("event_type, created_at").gte("created_at", since).limit(5000),
        supabase.from("account_activity_log").select("id, event_type, description, created_at, outcome").order("created_at", { ascending: false }).limit(40),
      ]);

      if (cancelled) return;

      // Signup series
      const days: Record<string, number> = {};
      for (let i = range - 1; i >= 0; i--) days[format(subDays(new Date(), i), "MMM d")] = 0;
      (profilesNew.data || []).forEach((p: any) => {
        const d = format(new Date(p.created_at), "MMM d");
        if (d in days) days[d]++;
      });
      const signupSeries = Object.entries(days).map(([date, count]) => ({ date, count }));

      // Event series
      const evDays: Record<string, number> = {};
      for (let i = range - 1; i >= 0; i--) evDays[format(subDays(new Date(), i), "MMM d")] = 0;
      (activity.data || []).forEach((a: any) => {
        const d = format(new Date(a.created_at), "MMM d");
        if (d in evDays) evDays[d]++;
      });
      const eventSeries = Object.entries(evDays).map(([date, count]) => ({ date, count }));

      // Top events
      const evCount: Record<string, number> = {};
      (activity.data || []).forEach((a: any) => { evCount[a.event_type] = (evCount[a.event_type] || 0) + 1; });
      const topEvents = Object.entries(evCount).map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count).slice(0, 8);

      // Devices
      const devCount: Record<string, number> = {};
      (sessions.data || []).forEach((s: any) => { const k = s.device_type || "unknown"; devCount[k] = (devCount[k] || 0) + 1; });
      const devices = Object.entries(devCount).map(([name, value]) => ({ name, value }));

      // Countries
      const cCount: Record<string, number> = {};
      (sessions.data || []).forEach((s: any) => { const k = s.country || "Unknown"; cCount[k] = (cCount[k] || 0) + 1; });
      const countries = Object.entries(cCount).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 8);

      // Tiers + MRR
      const tierCount: Record<string, number> = {};
      let mrr = 0;
      (subs.data || []).forEach((s: any) => {
        const t = tierFromProduct(s.product_id);
        tierCount[t] = (tierCount[t] || 0) + 1;
        if (s.subscription_type !== "lifetime") mrr += TIER_PRICES[t] || 0;
      });
      const tiers = Object.entries(tierCount).map(([name, value]) => ({ name, value }));

      setStats({
        loading: false,
        totalUsers: profilesAll.count || 0,
        newUsers: (profilesNew.data || []).length,
        activeSessions: (sessions.data || []).length,
        activeSubs: (subs.data || []).length,
        mrr,
        totalEvents: (activity.data || []).length,
        signupSeries, eventSeries, topEvents, devices, countries, tiers,
        recent: (recent.data as any) || [],
      });
    })();
    return () => { cancelled = true; };
  }, [isAdmin, range, refreshKey]);

  const kpis = useMemo(() => ([
    { label: "Total Users", value: fmt(stats.totalUsers), icon: Users },
    { label: `New (${range}d)`, value: fmt(stats.newUsers), icon: TrendingUp },
    { label: "Active Sessions", value: fmt(stats.activeSessions), icon: Activity },
    { label: "Paying Subs", value: fmt(stats.activeSubs), icon: DollarSign },
    { label: "Est. MRR", value: `$${fmt(stats.mrr)}`, icon: BarChart3 },
    { label: `Events (${range}d)`, value: fmt(stats.totalEvents), icon: Eye },
  ]), [stats, range]);

  if (!isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-10 max-w-md text-center">
          <ShieldAlert className="h-8 w-8 text-red-400 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-xs font-light tracking-[0.3em] uppercase text-red-300">Access Denied</p>
          <p className="mt-3 text-[11px] tracking-wide text-muted-foreground">
            Aureon Data is restricted to the primary operator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <div className="px-8 py-6 border-b border-border/15 flex items-center justify-between sticky top-0 z-10 bg-background/85 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/70">Live · Privacy-First</p>
          </div>
          <h1 className="mt-1 text-2xl font-extralight tracking-[0.25em]">AUREON DATA</h1>
          <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/60">
            Product analytics · operator-only telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as Range)}
              className={`px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase rounded-md border transition-colors ${
                range === r ? "border-foreground/40 bg-foreground/10" : "border-border/20 hover:bg-foreground/5"
              }`}
            >
              {r}d
            </button>
          ))}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-2 flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase rounded-md border border-border/20 hover:bg-foreground/5"
          >
            <RefreshCw className={`h-3 w-3 ${stats.loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-light tracking-[0.25em] uppercase text-muted-foreground/70">{k.label}</p>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-xl font-extralight tracking-wide">{k.value}</p>
              </div>
            );
          })}
        </div>

        {/* Time series */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Signups Over Time">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.signupSeries}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#cbd5e1" fill="url(#g1)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Activity Events">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.eventSeries}>
                <defs>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#94a3b8" fill="url(#g2)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Distributions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Subscription Tiers" icon={DollarSign}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.tiers} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40} paddingAngle={2}>
                  {stats.tiers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Devices" icon={Smartphone}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.devices} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40} paddingAngle={2}>
                  {stats.devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Countries" icon={Globe}>
            <ResponsiveContainer width="100%" height={220}>
              <RBarChart data={stats.countries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="value" fill="#94a3b8" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Top events + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Top Event Types" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={260}>
              <RBarChart data={stats.topEvents} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="count" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/70">Recent Activity</p>
              <Activity className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <div className="overflow-y-auto max-h-[260px] divide-y divide-border/10">
              {stats.recent.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 py-6 text-center">No recent activity.</p>
              )}
              {stats.recent.map((r) => (
                <div key={r.id} className="py-2 flex items-start gap-3">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    r.outcome === "success" ? "bg-emerald-400" : r.outcome === "failure" ? "bg-red-400" : "bg-muted-foreground/40"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-light tracking-wide truncate">{r.event_type}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{r.description}</p>
                  </div>
                  <p className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground/40 flex-shrink-0">
                    {format(new Date(r.created_at), "MMM d HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/40 pt-4">
          Aureon Data · privacy-first analytics · zero third-party trackers
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/70">{title}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />}
      </div>
      {children}
    </div>
  );
}
