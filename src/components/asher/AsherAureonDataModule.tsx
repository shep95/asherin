import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3, Users, Activity, DollarSign, Globe, Smartphone, RefreshCw,
  ShieldAlert, TrendingUp, Eye, Monitor, Apple, Mail, Link as LinkIcon, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart as RBarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

type Range = 7 | 14 | 30 | 90;

const fmt = (n: number) => new Intl.NumberFormat().format(n);
const money = (n: number) => `$${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)}`;
const COLORS = ["#d4af37", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"];

const DEVICE_COLORS: Record<string, string> = {
  iOS: "#60a5fa", Android: "#22c55e", macOS: "#fb923c", Mac: "#fb923c",
  Windows: "#a855f7", "Windows 10/11": "#a855f7", Linux: "#facc15",
  ChromeOS: "#06b6d4", Laptop: "#d4af37", Desktop: "#9ca3af",
  Mobile: "#22c55e", Tablet: "#fb923c", Unknown: "#6b7280",
};
const colorFor = (n: string) => DEVICE_COLORS[n] || DEVICE_COLORS[n?.split(" ")[0]] || "#9ca3af";

const ACTIVE_PATH_PREFIXES = ["/dashboard", "/zophiel", "/asher-dashboard", "/asher", "/elite", "/whiteboard", "/proj-aureon"];
const isActivePath = (p?: string | null) => !!p && ACTIVE_PATH_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
const LIVE_WINDOW_MS = 10 * 60 * 1000;

interface ActiveSession {
  user_id: string;
  email: string;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  current_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  last_active_at: string;
}

interface RevenueBucket { gross: number; net: number; refunds: number; count: number; }
interface RevenueData {
  revenue: Record<"3d" | "7d" | "30d" | "90d" | "lifetime", RevenueBucket>;
  productMRR: { product: string; mrr: number }[];
  sources: { source: string; amount: number }[];
}

interface ModuleUsage { module: string; tier: string; usage_count: number; user_count: number; }

interface Stats {
  loading: boolean;
  totalUsers: number;
  newUsers: number;
  activeSubs: number;
  totalEvents: number;
  signupSeries: { date: string; count: number }[];
  eventSeries: { date: string; count: number }[];
  topEvents: { name: string; count: number }[];
  countries: { name: string; value: number }[];
  recent: { id: string; event_type: string; description: string; created_at: string; outcome: string }[];
  trafficSources: { name: string; value: number }[];
}

const initialStats: Stats = {
  loading: true, totalUsers: 0, newUsers: 0, activeSubs: 0, totalEvents: 0,
  signupSeries: [], eventSeries: [], topEvents: [], countries: [], recent: [], trafficSources: [],
};

export default function AsherAureonDataModule() {
  const { user } = useAuth();
  const isAdmin = (user?.email || "").toLowerCase() === ADMIN_EMAIL;
  const [range, setRange] = useState<Range>(30);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [moduleUsage, setModuleUsage] = useState<ModuleUsage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingRev, setLoadingRev] = useState(false);

  // Core stats
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setStats((s) => ({ ...s, loading: true }));
      const since = subDays(startOfDay(new Date()), range).toISOString();

      const [profilesAll, profilesNew, sessionsAll, subs, activity, recent] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        supabase.from("profiles").select("user_id, created_at").gte("created_at", since),
        supabase.from("user_sessions").select("referrer, utm_source, country, created_at").gte("created_at", since),
        supabase.from("user_subscriptions").select("product_id, status").eq("status", "active"),
        supabase.from("account_activity_log").select("event_type, created_at").gte("created_at", since).limit(5000),
        supabase.from("account_activity_log").select("id, event_type, description, created_at, outcome").order("created_at", { ascending: false }).limit(40),
      ]);
      if (cancelled) return;

      const days: Record<string, number> = {};
      for (let i = range - 1; i >= 0; i--) days[format(subDays(new Date(), i), "MMM d")] = 0;
      (profilesNew.data || []).forEach((p: any) => {
        const d = format(new Date(p.created_at), "MMM d");
        if (d in days) days[d]++;
      });
      const signupSeries = Object.entries(days).map(([date, count]) => ({ date, count }));

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

      // Traffic sources from sessions in window
      const srcCount: Record<string, number> = {};
      const cCount: Record<string, number> = {};
      (sessionsAll.data || []).forEach((s: any) => {
        let src = (s.utm_source || "").trim().toLowerCase();
        if (!src && s.referrer) {
          try { src = new URL(s.referrer).hostname.replace(/^www\./, ""); } catch { src = "direct"; }
        }
        if (!src) src = "direct";
        srcCount[src] = (srcCount[src] || 0) + 1;
        const c = s.country || "Unknown";
        cCount[c] = (cCount[c] || 0) + 1;
      });
      const trafficSources = Object.entries(srcCount).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 10);
      const countries = Object.entries(cCount).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 8);

      setStats({
        loading: false,
        totalUsers: profilesAll.count || 0,
        newUsers: (profilesNew.data || []).length,
        activeSubs: (subs.data || []).length,
        totalEvents: (activity.data || []).length,
        signupSeries, eventSeries, topEvents, countries,
        recent: (recent.data as any) || [],
        trafficSources,
      });
    })();
    return () => { cancelled = true; };
  }, [isAdmin, range, refreshKey]);

  // Active sessions w/ emails (admin RPC)
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc("admin_active_sessions", { _window_minutes: 10 });
      if (cancelled) return;
      const rows = ((data as any[]) || []).filter((r) => isActivePath(r.current_path));
      setActive(rows);
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [isAdmin, refreshKey]);

  // Revenue from Stripe
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingRev(true);
      const { data, error } = await supabase.functions.invoke("admin-revenue", { body: {} });
      if (!cancelled) {
        if (!error && data) setRevenue(data as RevenueData);
        setLoadingRev(false);
      }
    })();
  }, [isAdmin, refreshKey]);

  // Module usage by tier
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const since = subDays(new Date(), range).toISOString();
      const { data } = await supabase.rpc("admin_module_usage", { _since: since });
      if (!cancelled) setModuleUsage((data as any) || []);
    })();
  }, [isAdmin, range, refreshKey]);

  // Auto-refresh
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const liveCount = active.length;
  const geoPoints = useMemo(() => {
    const m: Record<string, { lat: number; lon: number; city: string | null; country: string | null; count: number }> = {};
    active.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const k = `${s.latitude.toFixed(2)}_${s.longitude.toFixed(2)}`;
      if (!m[k]) m[k] = { lat: s.latitude, lon: s.longitude, city: s.city, country: s.country, count: 0 };
      m[k].count++;
    });
    return Object.values(m);
  }, [active]);
  const maxGeo = Math.max(1, ...geoPoints.map((p) => p.count));

  // Build module-by-tier matrix
  const tierOrder = ["chat", "aureon", "pro", "lifetime", "free"];
  const moduleMatrix = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    moduleUsage.forEach((m) => {
      if (!map[m.module]) map[m.module] = {};
      map[m.module][m.tier] = m.usage_count;
    });
    return Object.entries(map).map(([mod, tiers]) => ({
      module: mod,
      total: Object.values(tiers).reduce((a, b) => a + b, 0),
      ...tiers,
    })).sort((a: any, b: any) => b.total - a.total);
  }, [moduleUsage]);

  const revKpis = useMemo(() => ([
    { label: "3 Days", value: revenue ? money(revenue.revenue["3d"].net) : "—", count: revenue?.revenue["3d"].count || 0 },
    { label: "7 Days", value: revenue ? money(revenue.revenue["7d"].net) : "—", count: revenue?.revenue["7d"].count || 0 },
    { label: "30 Days", value: revenue ? money(revenue.revenue["30d"].net) : "—", count: revenue?.revenue["30d"].count || 0 },
    { label: "90 Days", value: revenue ? money(revenue.revenue["90d"].net) : "—", count: revenue?.revenue["90d"].count || 0 },
    { label: "Lifetime", value: revenue ? money(revenue.revenue.lifetime.net) : "—", count: revenue?.revenue.lifetime.count || 0 },
  ]), [revenue]);

  if (!isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-10 max-w-md text-center">
          <ShieldAlert className="h-8 w-8 text-red-400 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-xs font-light tracking-[0.3em] uppercase text-red-300">Access Denied</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-y-auto text-foreground relative"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.78), rgba(0,0,0,0.92)), url(${wallpaperAureon})`,
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      <style>{`
        .leaflet-control-attribution, .leaflet-bottom { display: none !important; }
        .leaflet-container { background: #050505 !important; }
      `}</style>

      <div className="px-8 py-6 border-b border-amber-400/10 flex items-center justify-between sticky top-0 z-10 bg-background/40 backdrop-blur-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <p className="text-[10px] font-light tracking-[0.3em] uppercase text-amber-200/70">Live · Stripe + Sessions · Auto 60s</p>
          </div>
          <h1 className="mt-1 text-2xl font-extralight tracking-[0.25em]">AUREON DATA</h1>
          <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/60">
            Revenue · Active Accounts · Module Telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((r) => (
            <button key={r} onClick={() => setRange(r as Range)}
              className={`px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase rounded-md border transition-colors ${
                range === r ? "border-amber-400/50 bg-amber-400/10 text-amber-200" : "border-border/20 hover:bg-foreground/5"
              }`}>{r}d</button>
          ))}
          <button onClick={() => setRefreshKey((k) => k + 1)}
            className="ml-2 flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase rounded-md border border-border/20 hover:bg-foreground/5">
            <RefreshCw className={`h-3 w-3 ${stats.loading || loadingRev ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* REVENUE BAND */}
        <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-950/30 via-black/40 to-black/40 backdrop-blur-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
              <p className="text-[11px] font-light tracking-[0.3em] uppercase text-amber-200">Stripe Revenue · Net of Refunds</p>
            </div>
            {loadingRev && <p className="text-[9px] tracking-wider uppercase text-amber-200/60 animate-pulse">syncing stripe…</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {revKpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-amber-400/20 bg-black/30 p-4">
                <p className="text-[9px] font-light tracking-[0.25em] uppercase text-amber-200/60">{k.label}</p>
                <p className="mt-2 text-2xl font-extralight tracking-wide text-amber-100">{k.value}</p>
                <p className="mt-1 text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{k.count} charges</p>
              </div>
            ))}
          </div>
        </div>

        {/* High-level KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: fmt(stats.totalUsers), icon: Users },
            { label: `New (${range}d)`, value: fmt(stats.newUsers), icon: TrendingUp },
            { label: "Live Active", value: fmt(liveCount), icon: Activity },
            { label: "Paying Subs", value: fmt(stats.activeSubs), icon: Zap },
          ].map((k) => {
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

        {/* GLOBAL ACTIVITY · COUNTRY BARS */}
        <div className="rounded-xl border border-amber-400/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.25em] uppercase text-amber-200/80">Global Activity · Top Countries</p>
            </div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">{countryBars.length} countries · {liveCount} live</p>
          </div>
          <div className="space-y-2">
            {countryBars.length === 0 && (
              <p className="text-[11px] text-muted-foreground/60 italic">No regional activity yet.</p>
            )}
            {countryBars.map((c, i) => {
              const pct = (c.count / maxCountry) * 100;
              return (
                <div key={c.country} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-100/90 font-light tracking-wide">
                      <span className="text-amber-400/60 mr-2">#{i + 1}</span>{c.country}
                      {i === 0 && <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-amber-300/70">· Most Active</span>}
                    </span>
                    <span className="text-amber-200/70 tabular-nums">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-400/5 overflow-hidden border border-amber-400/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #d4af37 0%, #fbbf24 60%, #fde68a 100%)`,
                        boxShadow: "0 0 12px rgba(251,191,36,0.35)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTIVE ACCOUNTS (with email) */}
        <div className="rounded-xl border border-emerald-500/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.25em] uppercase text-emerald-300/80">Active Accounts · /dashboard & /zophiel</p>
            </div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">{liveCount} live · 10 min window</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase">
                  <th className="text-left py-2">Email</th>
                  <th className="text-left">Device</th>
                  <th className="text-left">OS</th>
                  <th className="text-left">Page</th>
                  <th className="text-left">Source</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {active.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground/60">No live accounts right now.</td></tr>
                )}
                {active.slice(0, 50).map((s, i) => (
                  <tr key={i} className="font-light">
                    <td className="py-2 text-emerald-200/90">{s.email}</td>
                    <td>
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
                    <td className="text-amber-200/80 font-mono text-[10px]">{s.current_path}</td>
                    <td className="text-muted-foreground/70">{s.utm_source || (s.referrer ? new URL(s.referrer).hostname.replace(/^www\./, "") : "direct")}</td>
                    <td className="text-muted-foreground/70">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="text-muted-foreground/60">{formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODULE USAGE BY TIER */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
              <p className="text-[10px] font-light tracking-[0.25em] uppercase text-amber-200/80">Module Usage · By Subscription Tier ({range}d)</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase">
                  <th className="text-left py-2">Module</th>
                  {tierOrder.map((t) => <th key={t} className="text-right pr-3 capitalize">{t}</th>)}
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {moduleMatrix.length === 0 && (
                  <tr><td colSpan={tierOrder.length + 2} className="py-6 text-center text-muted-foreground/60">No usage in this window.</td></tr>
                )}
                {moduleMatrix.map((m: any) => (
                  <tr key={m.module} className="font-light">
                    <td className="py-2 text-amber-100">{m.module}</td>
                    {tierOrder.map((t) => (
                      <td key={t} className="text-right pr-3 text-muted-foreground/80">{fmt(m[t] || 0)}</td>
                    ))}
                    <td className="text-right font-medium text-amber-300">{fmt(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TRAFFIC + REVENUE-SOURCE row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title={`Click Sources · last ${range}d`} icon={LinkIcon}>
            <ResponsiveContainer width="100%" height={260}>
              <RBarChart data={stats.trafficSources} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="value" fill="#d4af37" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Revenue · By Stripe Source" icon={DollarSign}>
            <ResponsiveContainer width="100%" height={260}>
              <RBarChart data={(revenue?.sources || []).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis type="category" dataKey="source" stroke="hsl(var(--muted-foreground))" fontSize={10} width={120} />
                <Tooltip formatter={(v: any) => `$${Number(v).toFixed(0)}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="amount" fill="#fbbf24" radius={[0, 4, 4, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Product MRR */}
        <ChartCard title="Active Subscription Products · MRR" icon={Zap}>
          <ResponsiveContainer width="100%" height={260}>
            <RBarChart data={revenue?.productMRR || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(0)}/mo`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="mrr" fill="#d4af37" radius={[4, 4, 0, 0]} />
            </RBarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Time series */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Signups Over Time">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.signupSeries}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d4af37" stopOpacity={0.6} /><stop offset="100%" stopColor="#d4af37" stopOpacity={0} /></linearGradient></defs>
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
                <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} /><stop offset="100%" stopColor="#94a3b8" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#cbd5e1" fill="url(#g2)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/70">Recent Activity</p>
            <Activity className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
          </div>
          <div className="overflow-y-auto max-h-[260px] divide-y divide-border/10">
            {stats.recent.length === 0 && <p className="text-[11px] text-muted-foreground/60 py-6 text-center">No recent activity.</p>}
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

        <p className="text-center text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/40 pt-4">
          Aureon Data · operator telemetry · privacy-first
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
