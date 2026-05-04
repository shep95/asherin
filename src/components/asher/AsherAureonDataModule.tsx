import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3, Users, Activity, DollarSign, Globe, Smartphone, RefreshCw,
  ShieldAlert, TrendingUp, Eye, Monitor, Laptop, Tablet, Apple,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart as RBarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

type Range = 7 | 14 | 30 | 90;

const fmt = (n: number) => new Intl.NumberFormat().format(n);
const COLORS = ["#d4af37", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"];

// Device / OS color codes (per spec)
const DEVICE_COLORS: Record<string, string> = {
  iOS: "#60a5fa",          // blue
  Android: "#22c55e",      // green
  macOS: "#fb923c",        // orange (Mac)
  Mac: "#fb923c",
  Windows: "#a855f7",      // purple
  "Windows 10/11": "#a855f7",
  Linux: "#facc15",        // yellow
  ChromeOS: "#06b6d4",     // cyan
  Laptop: "#d4af37",       // gold
  Desktop: "#9ca3af",
  Mobile: "#22c55e",
  Tablet: "#fb923c",
  Unknown: "#6b7280",
};
const colorFor = (name: string) => DEVICE_COLORS[name] || DEVICE_COLORS[name?.split(" ")[0]] || "#9ca3af";

// "Active session" pages — dashboard, zophiel and any sub-page of those
const ACTIVE_PATH_PREFIXES = ["/dashboard", "/zophiel", "/asher-dashboard", "/asher", "/elite", "/whiteboard", "/proj-aureon"];
const isActivePath = (p?: string | null) => !!p && ACTIVE_PATH_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
// Sessions are considered "live" if last_active within 10 minutes
const LIVE_WINDOW_MS = 10 * 60 * 1000;

interface SessionRow {
  device_type: string | null;
  os: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  current_path: string | null;
  last_active_at: string;
  revoked_at: string | null;
}

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
  osBreakdown: { name: string; value: number }[];
  browsers: { name: string; value: number }[];
  countries: { name: string; value: number }[];
  tiers: { name: string; value: number }[];
  recent: { id: string; event_type: string; description: string; created_at: string; outcome: string }[];
  liveSessions: SessionRow[];
  pageActivity: { path: string; count: number }[];
  geoPoints: { lat: number; lon: number; city: string | null; country: string | null; count: number }[];
}

const initial: Stats = {
  loading: true, totalUsers: 0, newUsers: 0, activeSessions: 0, activeSubs: 0, mrr: 0, totalEvents: 0,
  signupSeries: [], eventSeries: [], topEvents: [], devices: [], osBreakdown: [], browsers: [],
  countries: [], tiers: [], recent: [], liveSessions: [], pageActivity: [], geoPoints: [],
};

const TIER_PRICES: Record<string, number> = { chat: 47, aureon: 199, pro: 740, lifetime: 0 };

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
      const liveCutoff = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();

      const [
        profilesAll, profilesNew, sessions, subs, activity, recent,
      ] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id, created_at").gte("created_at", since),
        supabase.from("user_sessions")
          .select("device_type, os, browser, country, city, region, latitude, longitude, current_path, last_active_at, revoked_at")
          .is("revoked_at", null)
          .gte("last_active_at", liveCutoff),
        supabase.from("user_subscriptions").select("product_id, status, subscription_type").eq("status", "active"),
        supabase.from("account_activity_log").select("event_type, created_at").gte("created_at", since).limit(5000),
        supabase.from("account_activity_log").select("id, event_type, description, created_at, outcome").order("created_at", { ascending: false }).limit(40),
      ]);

      if (cancelled) return;

      const allSessions = (sessions.data || []) as SessionRow[];
      // Active session = on /dashboard, /zophiel or sub-pages
      const liveSessions = allSessions.filter((s) => isActivePath(s.current_path));

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

      const evCount: Record<string, number> = {};
      (activity.data || []).forEach((a: any) => { evCount[a.event_type] = (evCount[a.event_type] || 0) + 1; });
      const topEvents = Object.entries(evCount).map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count).slice(0, 8);

      // Device, OS, Browser breakdowns from LIVE active sessions
      const devCount: Record<string, number> = {};
      const osCount: Record<string, number> = {};
      const brCount: Record<string, number> = {};
      const cCount: Record<string, number> = {};
      const pageCount: Record<string, number> = {};
      const geoMap: Record<string, { lat: number; lon: number; city: string | null; country: string | null; count: number }> = {};

      liveSessions.forEach((s) => {
        const d = s.device_type || "Unknown";
        devCount[d] = (devCount[d] || 0) + 1;
        const o = s.os || "Unknown";
        osCount[o] = (osCount[o] || 0) + 1;
        const b = s.browser || "Unknown";
        brCount[b] = (brCount[b] || 0) + 1;
        const c = s.country || "Unknown";
        cCount[c] = (cCount[c] || 0) + 1;
        if (s.current_path) pageCount[s.current_path] = (pageCount[s.current_path] || 0) + 1;
        if (s.latitude != null && s.longitude != null) {
          const k = `${s.latitude.toFixed(2)}_${s.longitude.toFixed(2)}`;
          if (!geoMap[k]) geoMap[k] = { lat: s.latitude, lon: s.longitude, city: s.city, country: s.country, count: 0 };
          geoMap[k].count++;
        }
      });

      const devices = Object.entries(devCount).map(([name, value]) => ({ name, value }));
      const osBreakdown = Object.entries(osCount).map(([name, value]) => ({ name, value }));
      const browsers = Object.entries(brCount).map(([name, value]) => ({ name, value }));
      const countries = Object.entries(cCount).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 8);
      const pageActivity = Object.entries(pageCount).map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count).slice(0, 10);
      const geoPoints = Object.values(geoMap);

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
        activeSessions: liveSessions.length,
        activeSubs: (subs.data || []).length,
        mrr,
        totalEvents: (activity.data || []).length,
        signupSeries, eventSeries, topEvents,
        devices, osBreakdown, browsers, countries, tiers,
        recent: (recent.data as any) || [],
        liveSessions, pageActivity, geoPoints,
      });
    })();
    return () => { cancelled = true; };
  }, [isAdmin, range, refreshKey]);

  // Auto-refresh every 30s for "live" feel
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 30_000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const kpis = useMemo(() => ([
    { label: "Total Users", value: fmt(stats.totalUsers), icon: Users },
    { label: `New (${range}d)`, value: fmt(stats.newUsers), icon: TrendingUp },
    { label: "Live Active", value: fmt(stats.activeSessions), icon: Activity },
    { label: "Paying Subs", value: fmt(stats.activeSubs), icon: DollarSign },
    { label: "Est. MRR", value: `$${fmt(stats.mrr)}`, icon: BarChart3 },
    { label: `Events (${range}d)`, value: fmt(stats.totalEvents), icon: Eye },
  ]), [stats, range]);

  const maxGeo = Math.max(1, ...stats.geoPoints.map((p) => p.count));

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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <p className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/70">Live · Auto-refresh 30s</p>
          </div>
          <h1 className="mt-1 text-2xl font-extralight tracking-[0.25em]">AUREON DATA</h1>
          <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/60">
            Active = /dashboard, /zophiel & sub-pages · last 10 min
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as Range)}
              className={`px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase rounded-md border transition-colors ${
                range === r ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-border/20 hover:bg-foreground/5"
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

        {/* GLOBAL REGION MAP — gold themed */}
        <div className="rounded-xl border border-amber-400/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.25em] uppercase text-amber-200/80">Global Activity Map · Live Regions</p>
            </div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
              {stats.geoPoints.length} regions · {stats.activeSessions} live
            </p>
          </div>
          <div className="rounded-lg overflow-hidden h-[380px] border border-amber-400/10" style={{ background: "#0a0a0a" }}>
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={2}
              scrollWheelZoom
              style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
              worldCopyJump
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                attribution=""
              />
              {stats.geoPoints.map((p, i) => {
                const intensity = p.count / maxGeo;
                const radius = 6 + intensity * 18;
                return (
                  <CircleMarker
                    key={i}
                    center={[p.lat, p.lon]}
                    radius={radius}
                    pathOptions={{
                      color: "#d4af37",
                      fillColor: "#fbbf24",
                      fillOpacity: 0.35 + intensity * 0.5,
                      weight: 1.5,
                    }}
                  >
                    <LTooltip>
                      <div style={{ fontSize: 11 }}>
                        <strong>{p.city || "Unknown"}, {p.country || "—"}</strong><br />
                        {p.count} active session{p.count > 1 ? "s" : ""}
                      </div>
                    </LTooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Live sessions table */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/70">Live Sessions · /dashboard & /zophiel</p>
            <Activity className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase">
                  <th className="text-left py-2">Device</th>
                  <th className="text-left">OS</th>
                  <th className="text-left">Browser</th>
                  <th className="text-left">Page</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {stats.liveSessions.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground/60">No live activity right now.</td></tr>
                )}
                {stats.liveSessions.slice(0, 30).map((s, i) => (
                  <tr key={i} className="font-light">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: colorFor(s.device_type || "Unknown") }} />
                        {s.device_type || "Unknown"}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: colorFor(s.os || "Unknown") }} />
                        {s.os || "Unknown"}
                      </span>
                    </td>
                    <td>{s.browser || "—"}</td>
                    <td className="text-amber-200/80 font-mono text-[10px]">{s.current_path}</td>
                    <td className="text-muted-foreground/70">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="text-muted-foreground/60">{formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Page Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Active by Page" icon={Eye}>
            <ResponsiveContainer width="100%" height={240}>
              <RBarChart data={stats.pageActivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="path" stroke="hsl(var(--muted-foreground))" fontSize={10} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="count" fill="#d4af37" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="OS · Recognition" icon={Apple}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stats.osBreakdown} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42} paddingAngle={2}>
                  {stats.osBreakdown.map((e, i) => <Cell key={i} fill={colorFor(e.name)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Device Type · Recognition" icon={Smartphone}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={stats.devices} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42} paddingAngle={2}>
                  {stats.devices.map((e, i) => <Cell key={i} fill={colorFor(e.name)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Color legend */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
          <p className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/70 mb-3">Device · Color Codes</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(DEVICE_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border/20">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time series */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Signups Over Time">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.signupSeries}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#fbbf24" fill="url(#g1)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Activity Events">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.eventSeries}>
                <defs>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#cbd5e1" fill="url(#g2)" strokeWidth={1.5} />
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

          <ChartCard title="Browsers · Live" icon={Monitor}>
            <ResponsiveContainer width="100%" height={220}>
              <RBarChart data={stats.browsers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="value" fill="#d4af37" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Countries · Live" icon={Globe}>
            <ResponsiveContainer width="100%" height={220}>
              <RBarChart data={stats.countries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="value" fill="#fbbf24" radius={[0, 4, 4, 0]} />
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
