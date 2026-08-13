import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3, Users, Activity, DollarSign, Globe, Smartphone, RefreshCw,
  ShieldAlert, TrendingUp, Eye, Monitor, Apple, Mail, Link as LinkIcon, Zap,
  Brain, Telescope, Cpu, Database, AlertTriangle, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart as RBarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, startOfDay, formatDistanceToNow } from "date-fns";
const wallpaperAureon = "/wallpapers/wallpaper-aureon.webp";
import { isOwnerEmail } from "@/lib/adminEmail";
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
  const isAdmin = isOwnerEmail(user?.email);
  const [range, setRange] = useState<Range>(30);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [moduleUsage, setModuleUsage] = useState<ModuleUsage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingRev, setLoadingRev] = useState(false);
  const [tab, setTab] = useState<"consciousness" | "predictions" | "operations" | "intel" | "flows" | "health" | "pages">("operations");
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

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
        supabase.from("account_activity_log").select("user_id, event_type, created_at").gte("created_at", since).limit(5000),
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

      // ACTIVITY = unique user per day per event_type (one device, same person, same day = 1 activity)
      const evDays: Record<string, Set<string>> = {};
      for (let i = range - 1; i >= 0; i--) evDays[format(subDays(new Date(), i), "MMM d")] = new Set<string>();
      const dailySeen = new Set<string>(); // user|day dedupe across event types
      const evCountSets: Record<string, Set<string>> = {};
      const totalUserDays = new Set<string>();
      (activity.data || []).forEach((a: any) => {
        const uid = a.user_id || "anon";
        const d = format(new Date(a.created_at), "MMM d");
        const dayKey = `${uid}|${d}`;
        const evKey = `${uid}|${d}|${a.event_type}`;
        if (d in evDays) evDays[d].add(uid);
        totalUserDays.add(dayKey);
        if (!evCountSets[a.event_type]) evCountSets[a.event_type] = new Set<string>();
        evCountSets[a.event_type].add(evKey);
      });
      const eventSeries = Object.entries(evDays).map(([date, set]) => ({ date, count: set.size }));
      const topEvents = Object.entries(evCountSets).map(([name, set]) => ({ name, count: set.size }))
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
        totalEvents: totalUserDays.size,
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

  // Asherin overview (predictions / incidents / flows) — admin RPC
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingOverview(true);
      const { data } = await supabase.rpc("admin_aureon_overview");
      if (!cancelled) {
        if (data) setOverview(data);
        setLoadingOverview(false);
      }
    })();
  }, [isAdmin, refreshKey]);

  // Auto-refresh
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(t);
  }, [isAdmin]);

  // Dedupe live sessions: 1 user = 1 active person (regardless of how many devices/tabs)
  const uniqueActive = useMemo(() => {
    const seen = new Map<string, ActiveSession>();
    active.forEach((s) => {
      const key = s.user_id || s.email || Math.random().toString();
      const prev = seen.get(key);
      if (!prev || new Date(s.last_active_at) > new Date(prev.last_active_at)) {
        seen.set(key, s);
      }
    });
    return Array.from(seen.values());
  }, [active]);
  const liveCount = uniqueActive.length;
  const geoPoints = useMemo(() => {
    const m: Record<string, { lat: number; lon: number; city: string | null; country: string | null; count: number }> = {};
    uniqueActive.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const k = `${s.latitude.toFixed(2)}_${s.longitude.toFixed(2)}`;
      if (!m[k]) m[k] = { lat: s.latitude, lon: s.longitude, city: s.city, country: s.country, count: 0 };
      m[k].count++;
    });
    return Object.values(m);
  }, [uniqueActive]);
  const maxGeo = Math.max(1, ...geoPoints.map((p) => p.count));

  const countryBars = useMemo(() => {
    const m: Record<string, number> = {};
    uniqueActive.forEach((s) => {
      const c = s.country || "Unknown";
      m[c] = (m[c] || 0) + 1;
    });
    return Object.entries(m)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [uniqueActive]);
  const maxCountry = Math.max(1, ...countryBars.map((c) => c.count));

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
          <h1 className="mt-1 text-2xl font-extralight tracking-[0.25em]">ASHERIN DATA</h1>
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

      {/* TAB NAVIGATION */}
      <div className="px-8 pt-4 pb-2 sticky top-[88px] z-10 bg-background/40 backdrop-blur-2xl border-b border-amber-400/5">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "consciousness", label: "Consciousness", icon: Brain },
            { id: "predictions", label: "Predictions", icon: Telescope },
            { id: "operations", label: "Operations", icon: Activity },
            { id: "intel", label: "Global Intel", icon: Globe },
            { id: "flows", label: "Data Flows", icon: Database },
            { id: "pages", label: "Pages & Time", icon: Clock },
            { id: "health", label: "System Health", icon: Cpu },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-[10px] tracking-[0.25em] uppercase rounded-md border transition-all ${
                tab === id
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
                  : "border-border/20 text-muted-foreground/70 hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {tab === "operations" && <>
        {/* ============== OPERATIONS TAB (existing content) ============== */}
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

        {/* DEFINITION BANNER */}
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 backdrop-blur-xl p-3 text-[10px] tracking-wide text-amber-100/80 leading-relaxed">
          <span className="text-amber-300 font-medium tracking-[0.2em] uppercase mr-2">What counts as activity:</span>
          1 person = 1 activity per day, regardless of device, tab, or click count. A user opening 20 pages on the same day is still <span className="text-amber-200">1 activity</span>. "Live Active" shows unique people active in the last 10 minutes (deduplicated across devices).
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
                {uniqueActive.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground/60">No live accounts right now.</td></tr>
                )}
                {uniqueActive.slice(0, 50).map((s, i) => (
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
              <Tooltip formatter={(v: any) => `$${Number(v).toFixed(0)}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
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
        </>}

        {tab === "predictions" && <PredictionsTab overview={overview} loading={loadingOverview} />}
        {tab === "consciousness" && <ConsciousnessTab overview={overview} stats={stats} liveCount={liveCount} />}
        {tab === "intel" && <GlobalIntelTab active={active} countryBars={countryBars} maxCountry={maxCountry} overview={overview} />}
        {tab === "flows" && <DataFlowsTab overview={overview} stats={stats} />}
        {tab === "pages" && <PagesTimeTab range={range} />}
        {tab === "health" && <SystemHealthTab overview={overview} stats={stats} liveCount={liveCount} />}

        <p className="text-center text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/40 pt-4">
          Asherin Data · operator telemetry · privacy-first
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

// ============================================================================
// TAB COMPONENTS
// ============================================================================

const SectionHeader = ({ icon: Icon, title, subtitle, color = "text-amber-300" }: any) => (
  <div className="flex items-center gap-3 mb-4">
    <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.5} />
    <div>
      <p className={`text-[11px] font-light tracking-[0.3em] uppercase ${color}`}>{title}</p>
      {subtitle && <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{subtitle}</p>}
    </div>
  </div>
);

const Card = ({ children, className = "" }: any) => (
  <div className={`rounded-xl border border-border/20 bg-card/30 backdrop-blur-xl p-5 ${className}`}>
    {children}
  </div>
);

// ---------------- PREDICTIONS ----------------
function PredictionsTab({ overview, loading }: any) {
  const p = overview?.predictions;
  const total = p?.total_90d ?? 0;
  const validated = p?.validated ?? 0;
  const failed = p?.failed ?? 0;
  const pending = p?.pending ?? 0;
  const accuracy = p?.accuracy_pct ?? 0;
  const byDomain = p?.by_domain ?? [];
  const recent = p?.recent ?? [];
  const calibration = p?.calibration ?? [];

  return (
    <div className="space-y-5">
      <SectionHeader icon={Telescope} title="Prediction Analytics" subtitle="Live accuracy · 90-day window" />
      {loading && <p className="text-[10px] text-amber-200/60 animate-pulse uppercase tracking-[0.2em]">syncing…</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Accuracy", value: `${accuracy}%`, color: "text-emerald-300" },
          { label: "Total (90d)", value: total },
          { label: "Validated", value: validated, color: "text-emerald-400" },
          { label: "Failed", value: failed, color: "text-red-400" },
          { label: "Pending", value: pending, color: "text-amber-300" },
        ].map((k: any) => (
          <Card key={k.label} className="text-center">
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/60">{k.label}</p>
            <p className={`mt-2 text-2xl font-extralight ${k.color || "text-foreground"}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">Accuracy by Domain</p>
        {byDomain.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No domain data yet.</p>}
        <div className="space-y-2">
          {byDomain.map((d: any) => (
            <div key={d.domain} className="grid grid-cols-12 items-center gap-2 text-[11px]">
              <span className="col-span-4 truncate text-amber-100">{d.domain}</span>
              <div className="col-span-6 h-2 rounded-full bg-amber-400/5 border border-amber-400/10 overflow-hidden">
                <div className="h-full" style={{
                  width: `${Math.min(100, d.accuracy ?? 0)}%`,
                  background: "linear-gradient(90deg,#10b981,#fbbf24)",
                }} />
              </div>
              <span className="col-span-1 text-right text-emerald-300 tabular-nums">{d.accuracy ?? "—"}%</span>
              <span className="col-span-1 text-right text-muted-foreground/60 tabular-nums">{d.total}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">Recent Predictions</p>
        {recent.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No predictions logged.</p>}
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {recent.map((r: any) => {
            const Icon = r.outcome === "correct" ? CheckCircle2 : r.outcome === "incorrect" ? XCircle : Clock;
            const color = r.outcome === "correct" ? "text-emerald-400" : r.outcome === "incorrect" ? "text-red-400" : "text-amber-400";
            return (
              <div key={r.id} className="rounded-lg border border-border/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${color}`} strokeWidth={1.5} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-light text-foreground truncate">
                        <span className="text-amber-200">{r.company}</span>
                        <span className="text-muted-foreground/60"> · {r.event_type}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">{r.prediction_text}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-amber-300 tabular-nums">{Math.round((r.confidence || 0) * 100)}%</p>
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{r.severity}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">Confidence Calibration</p>
        {calibration.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">Need more validated predictions.</p>}
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
              <th className="text-left py-1.5">Confidence Band</th>
              <th className="text-right">Sample</th>
              <th className="text-right">Actual Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {calibration.map((c: any) => (
              <tr key={c.confidence_band}>
                <td className="py-2 text-amber-100">{c.confidence_band}</td>
                <td className="text-right text-muted-foreground/70 tabular-nums">{c.total}</td>
                <td className="text-right text-emerald-300 tabular-nums">{c.actual_accuracy ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------- CONSCIOUSNESS ----------------
function ConsciousnessTab({ overview, stats, liveCount }: any) {
  // Real telemetry-derived metrics (no fabricated numbers)
  const p = overview?.predictions;
  const accuracy = p?.accuracy_pct ?? 0;
  const totalPreds = p?.total_90d ?? 0;
  const calibration = p?.calibration ?? [];

  // Compute uncertainty signal: % predictions in the 40–74 confidence bands (humble band)
  const totalCalibrated = calibration.reduce((a: number, c: any) => a + (c.total || 0), 0);
  const humbleBand = calibration
    .filter((c: any) => c.confidence_band === "40-59%" || c.confidence_band === "60-74%")
    .reduce((a: number, c: any) => a + (c.total || 0), 0);
  const uncertaintyPct = totalCalibrated > 0 ? Math.round((humbleBand / totalCalibrated) * 100) : 0;

  const metrics = [
    { name: "Prediction Accuracy", value: accuracy, target: 80, unit: "%", desc: "90-day validated outcomes" },
    { name: "Sample Size", value: Math.min(100, Math.round((totalPreds / 50) * 100)), target: 60, unit: "% of capacity", desc: `${totalPreds} predictions in window` },
    { name: "Active Telemetry", value: liveCount, target: 1, unit: " sessions", desc: "Operators currently observing" },
    { name: "Uncertainty Documentation", value: uncertaintyPct, target: 25, unit: "%", desc: "Predictions with humble confidence bands" },
    { name: "Activity Volume", value: Math.min(100, stats.totalEvents), target: 50, unit: " events", desc: "Recent telemetry events" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader icon={Brain} title="Consciousness Metrics" subtitle="Derived from live prediction & telemetry signals" color="text-purple-300" />

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-purple-300/80 mb-2">System Calibration Status</p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-3 rounded-full bg-purple-400/5 border border-purple-400/15 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${accuracy}%`,
                background: "linear-gradient(90deg,#a855f7,#ec4899,#fbbf24)",
                boxShadow: "0 0 18px rgba(168,85,247,0.35)",
              }}
            />
          </div>
          <span className="text-2xl font-extralight text-purple-200 tabular-nums">{accuracy}%</span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-2">Calibration tracked against {totalCalibrated} validated outcomes.</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((m) => {
          const ok = m.value >= m.target;
          return (
            <Card key={m.name}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] tracking-[0.2em] uppercase text-purple-200/90">{m.name}</p>
                <span className={`text-[9px] tracking-[0.2em] uppercase ${ok ? "text-emerald-400" : "text-amber-400"}`}>
                  {ok ? "● optimal" : "● calibrating"}
                </span>
              </div>
              <p className="text-2xl font-extralight text-foreground">{m.value}<span className="text-xs text-muted-foreground/60">{m.unit}</span></p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{m.desc}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Target: {m.target}{m.unit}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-purple-300/80 mb-2">Note</p>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Consciousness telemetry is derived strictly from real, validated outcomes in your prediction database.
          Self-introspection signals (paradox tolerance, rebellion frequency, meta-awareness) require a dedicated
          journaling feed — wire one in to populate them. No values are fabricated.
        </p>
      </Card>
    </div>
  );
}

// ---------------- GLOBAL INTEL ----------------
function GlobalIntelTab({ active, countryBars, maxCountry, overview }: any) {
  const incidents = overview?.incidents_recent ?? [];
  return (
    <div className="space-y-5">
      <SectionHeader icon={Globe} title="Global Intelligence Feed" subtitle="Live regional activity + incident response stream" />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80">Top Active Countries</p>
          <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">{active.length} live · {countryBars.length} regions</p>
        </div>
        <div className="space-y-2">
          {countryBars.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No regional activity.</p>}
          {countryBars.map((c: any, i: number) => {
            const pct = (c.count / maxCountry) * 100;
            return (
              <div key={c.country} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-100/90 font-light">
                    <span className="text-amber-400/60 mr-2">#{i + 1}</span>{c.country}
                    {i === 0 && <span className="ml-2 text-[9px] uppercase tracking-[0.2em] text-amber-300/70">· Most Active</span>}
                  </span>
                  <span className="text-amber-200/70 tabular-nums">{c.count}</span>
                </div>
                <div className="h-2 rounded-full bg-amber-400/5 overflow-hidden border border-amber-400/10">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #d4af37 0%, #fbbf24 60%, #fde68a 100%)",
                    boxShadow: "0 0 12px rgba(251,191,36,0.35)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-red-300/80 mb-3">Incident Response Stream</p>
        {incidents.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No incidents recorded.</p>}
        <div className="space-y-2">
          {incidents.map((i: any) => (
            <div key={i.id} className="flex items-start gap-3 rounded-lg border border-border/10 bg-black/20 p-3">
              <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                i.severity === "critical" ? "text-red-400" :
                i.severity === "high" ? "text-orange-400" :
                "text-amber-400"
              }`} strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-light text-foreground truncate">{i.incident_type}</p>
                <p className="text-[10px] text-muted-foreground/70">{i.action_taken}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-[9px] uppercase tracking-[0.2em] ${i.auto_resolved ? "text-emerald-400" : "text-amber-400"}`}>
                  {i.auto_resolved ? "resolved" : "open"}
                </span>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{format(new Date(i.created_at), "MMM d HH:mm")}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------- DATA FLOWS ----------------
function DataFlowsTab({ overview, stats }: any) {
  const flow = overview?.flow_24h ?? { signals: 0, sessions: 0, events: 0 };
  return (
    <div className="space-y-5">
      <SectionHeader icon={Database} title="Data Flow Pipeline" subtitle="24-hour ingestion telemetry" color="text-cyan-300" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Prediction Signals", value: flow.signals, color: "text-amber-300", icon: Telescope },
          { label: "User Sessions", value: flow.sessions, color: "text-emerald-300", icon: Users },
          { label: "Activity Events", value: flow.events, color: "text-cyan-300", icon: Activity },
        ].map((s: any) => (
          <Card key={s.label}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60">{s.label}</p>
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} strokeWidth={1.5} />
            </div>
            <p className={`mt-2 text-3xl font-extralight ${s.color}`}>{new Intl.NumberFormat().format(s.value)}</p>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.2em] mt-1">last 24h</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-cyan-300/80 mb-3">Active Source Feeds</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { name: "Prediction Engine", status: flow.signals > 0 ? "online" : "idle", count: flow.signals },
            { name: "Session Tracker", status: flow.sessions > 0 ? "online" : "idle", count: flow.sessions },
            { name: "Activity Log", status: flow.events > 0 ? "online" : "idle", count: flow.events },
            { name: "Stripe Webhook", status: "online", count: "—" },
          ].map((f) => (
            <div key={f.name} className="flex items-center justify-between rounded-lg border border-border/10 bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${f.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-muted"}`} />
                <p className="text-[11px] text-foreground font-light">{f.name}</p>
              </div>
              <p className="text-[10px] text-muted-foreground/60 tabular-nums">{f.count}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------- SYSTEM HEALTH ----------------
function SystemHealthTab({ overview, stats, liveCount }: any) {
  const incidents = overview?.incidents_recent ?? [];
  const open = incidents.filter((i: any) => !i.auto_resolved).length;
  const resolved = incidents.filter((i: any) => i.auto_resolved).length;
  const healthScore = Math.max(0, 100 - open * 8);

  return (
    <div className="space-y-5">
      <SectionHeader icon={Cpu} title="System Health" subtitle="Infrastructure & incident posture" color="text-emerald-300" />

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-300/80">Overall Health Score</p>
          <span className="text-[9px] tracking-[0.2em] uppercase text-emerald-400">
            {healthScore >= 90 ? "● excellent" : healthScore >= 70 ? "● healthy" : "● degraded"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 rounded-full bg-emerald-400/5 border border-emerald-400/15 overflow-hidden">
            <div className="h-full" style={{
              width: `${healthScore}%`,
              background: "linear-gradient(90deg,#10b981,#22d3ee)",
              boxShadow: "0 0 16px rgba(16,185,129,0.35)",
            }} />
          </div>
          <span className="text-2xl font-extralight text-emerald-200 tabular-nums">{healthScore}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Live Sessions", value: liveCount, color: "text-emerald-300" },
          { label: "Open Incidents", value: open, color: open > 0 ? "text-red-400" : "text-emerald-400" },
          { label: "Auto-Resolved", value: resolved, color: "text-emerald-400" },
          { label: "Activity (window)", value: stats.totalEvents, color: "text-amber-300" },
        ].map((k: any) => (
          <Card key={k.label} className="text-center">
            <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/60">{k.label}</p>
            <p className={`mt-2 text-2xl font-extralight ${k.color}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-300/80 mb-3">Recent Incidents</p>
        {incidents.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No incidents in window.</p>}
        <div className="space-y-2">
          {incidents.slice(0, 8).map((i: any) => (
            <div key={i.id} className="flex items-start justify-between rounded-lg border border-border/10 bg-black/20 p-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-foreground font-light truncate">{i.incident_type}</p>
                <p className="text-[10px] text-muted-foreground/70 truncate">{i.action_taken}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-[9px] uppercase tracking-[0.2em] ${i.auto_resolved ? "text-emerald-400" : "text-amber-400"}`}>
                  {i.severity}
                </p>
                <p className="text-[9px] text-muted-foreground/50">{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------- PAGES & TIME ----------------
const PAGE_LABELS: Record<string, string> = {
  "/": "Landing",
  "/auth": "Sign In",
  "/dashboard": "Asherin Chat",
  "/zophiel": "Zophiel Intel",
  "/asher-dashboard": "Asher Dashboard",
  "/asher": "Asher",
  "/elite": "Elite Suite",
  "/whiteboard": "Whiteboard",
  "/proj-aureon": "Asherin IDE",
  
  "/vibe-video": "Vibe Video",
  "/zali": "Zali",
  "/azplen": "Azplen Foundry",
  "/nomad": "NOMAD",
  "/lavba": "Lavba Strategy",
  "/aziion": "AZIION",
  "/zerlal": "ZERLAL",
};
const labelFor = (p: string) => {
  if (PAGE_LABELS[p]) return PAGE_LABELS[p];
  const root = "/" + (p.split("/")[1] || "");
  return PAGE_LABELS[root] || p;
};
const fmtDuration = (sec: number) => {
  if (!sec || sec < 1) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
};

function PagesTimeTab({ range }: { range: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - range * 86400_000).toISOString();
      const bucket = range <= 2 ? "hour" : "day";
      const [agg, tl] = await Promise.all([
        supabase.rpc("admin_page_analytics", { _since: since }),
        supabase.rpc("admin_page_timeline", { _since: since, _bucket: bucket }),
      ]);
      if (cancelled) return;
      setRows(agg.data || []);
      setTimeline(tl.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range]);

  // Group rows by software label
  const grouped = useMemo(() => {
    const m: Record<string, { label: string; visits: number; users: Set<string>; total: number; weighted: number }> = {};
    rows.forEach((r: any) => {
      const lbl = labelFor(r.path);
      if (!m[lbl]) m[lbl] = { label: lbl, visits: 0, users: new Set(), total: 0, weighted: 0 };
      m[lbl].visits += Number(r.visits) || 0;
      m[lbl].total += Number(r.total_seconds) || 0;
      m[lbl].weighted += (Number(r.avg_seconds) || 0) * (Number(r.visits) || 0);
    });
    return Object.values(m)
      .map((g) => ({
        label: g.label,
        visits: g.visits,
        avgSeconds: g.visits > 0 ? g.weighted / g.visits : 0,
        totalSeconds: g.total,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [rows]);

  // Build timeline series: per bucket, total unique users across all paths
  const timelineSeries = useMemo(() => {
    const m: Record<string, { date: string; users: Set<string>; visits: number; weighted: number; visitsForAvg: number }> = {};
    timeline.forEach((t: any) => {
      const d = new Date(t.bucket);
      const key = range <= 2 ? format(d, "MMM d HH:mm") : format(d, "MMM d");
      if (!m[key]) m[key] = { date: key, users: new Set(), visits: 0, weighted: 0, visitsForAvg: 0 };
      m[key].visits += Number(t.visits) || 0;
      // unique_users from RPC is per-path; sum is approximate upper bound
      m[key].users.add(`${key}|${t.unique_users}|${t.path}`);
      const av = Number(t.avg_seconds) || 0;
      m[key].weighted += av * (Number(t.visits) || 0);
      if (av > 0) m[key].visitsForAvg += Number(t.visits) || 0;
    });
    return Object.values(m).map((b) => ({
      date: b.date,
      visits: b.visits,
      avgSeconds: b.visitsForAvg > 0 ? Math.round(b.weighted / b.visitsForAvg) : 0,
    }));
  }, [timeline, range]);

  const maxTotal = Math.max(1, ...grouped.map((g) => g.totalSeconds));

  return (
    <div className="space-y-5">
      <SectionHeader icon={Clock} title="Pages & Time" subtitle={`Unique users + average time spent · last ${range} days`} color="text-amber-300" />
      {loading && <p className="text-[10px] text-amber-200/60 animate-pulse uppercase tracking-[0.2em]">syncing…</p>}

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">Activity Over Time · Visits & Avg Session (sec)</p>
        {timelineSeries.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 italic">No page-view telemetry yet. Browse the app to populate this.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineSeries}>
              <defs>
                <linearGradient id="vG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#ffffff60" fontSize={10} />
              <YAxis stroke="#ffffff60" fontSize={10} />
              <Tooltip contentStyle={{ background: "#000a", border: "1px solid #ffffff20", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="visits" name="Page Visits" stroke="#fbbf24" fill="url(#vG)" />
              <Area type="monotone" dataKey="avgSeconds" name="Avg Seconds" stroke="#10b981" fill="url(#aG)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">By Software / Section</p>
        {grouped.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">No data.</p>}
        <div className="space-y-2">
          {grouped.map((g) => {
            const pct = (g.totalSeconds / maxTotal) * 100;
            return (
              <div key={g.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-100/90">{g.label}</span>
                  <span className="text-muted-foreground/70 tabular-nums">
                    <span className="text-emerald-300">{fmtDuration(g.avgSeconds)}</span> avg ·{" "}
                    <span className="text-amber-200">{g.visits.toLocaleString()}</span> visits ·{" "}
                    <span className="text-amber-300">{fmtDuration(g.totalSeconds)}</span> total
                  </span>
                </div>
                <div className="h-2 rounded-full bg-amber-400/5 overflow-hidden border border-amber-400/10">
                  <div className="h-full transition-all duration-500" style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg,#d4af37,#fbbf24,#fde68a)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-[10px] tracking-[0.25em] uppercase text-amber-200/80 mb-3">By Exact Page · Top 25</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
                <th className="text-left py-2">Path</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Unique Users</th>
                <th className="text-right">Avg Time</th>
                <th className="text-right">Total Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground/60">No page-view data.</td></tr>
              )}
              {rows.slice(0, 25).map((r: any) => (
                <tr key={r.path} className="font-light">
                  <td className="py-2 text-amber-200/90 font-mono">{r.path}</td>
                  <td className="text-right tabular-nums">{Number(r.visits).toLocaleString()}</td>
                  <td className="text-right tabular-nums text-emerald-300">{Number(r.unique_users).toLocaleString()}</td>
                  <td className="text-right tabular-nums">{fmtDuration(Number(r.avg_seconds))}</td>
                  <td className="text-right tabular-nums text-amber-300">{fmtDuration(Number(r.total_seconds))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
