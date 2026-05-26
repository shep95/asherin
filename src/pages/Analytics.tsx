import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminEmail";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import LandingBackground from "@/components/LandingBackground";
import { applySeoHead } from "@/lib/seoHead";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from "recharts";

type PageView = { path: string; entered_at: string; duration_seconds: number; user_id: string };
type Session = {
  session_token_hash: string;
  country: string | null;
  device_type: string | null;
  browser: string | null;
  referrer: string | null;
  utm_source: string | null;
  created_at: string;
  last_active_at: string | null;
  user_id: string;
};

const RANGES = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d",  label: "7d",  days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
] as const;

const dayKey = (iso: string) => iso.slice(0, 10);

function fillDays(days: number) {
  const out: { date: string; key: string }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, date: key.slice(5) });
  }
  return out;
}

function parseReferrer(ref: string | null, utm: string | null): string {
  if (utm) return utm;
  if (!ref) return "Direct";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (!h || h === window.location.hostname) return "Direct";
    return h;
  } catch { return "Direct"; }
}

const Section = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="relative rounded-2xl border border-foreground/10 bg-foreground/[0.025] backdrop-blur-2xl p-5 overflow-hidden">
    <span aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
    <div className="text-[9px] font-mono tracking-[0.28em] uppercase text-foreground/40">{label}</div>
    <div className="mt-3 text-3xl sm:text-4xl font-extralight tracking-tight text-foreground tabular-nums">{value}</div>
    {hint && <div className="mt-1 text-[10px] font-mono tracking-[0.18em] uppercase text-foreground/35">{hint}</div>}
  </div>
);

const Panel = ({ title, eyebrow, children, className = "" }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) => (
  <div className={`relative rounded-2xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-2xl p-5 overflow-hidden ${className}`}>
    <span aria-hidden className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/25 to-transparent" />
    <div className="flex items-baseline justify-between mb-4">
      <div className="text-[10px] font-mono tracking-[0.28em] uppercase text-foreground/55">◈ {title}</div>
      {eyebrow && <div className="text-[9px] font-mono tracking-[0.22em] uppercase text-foreground/30">{eyebrow}</div>}
    </div>
    {children}
  </div>
);

const BarList = ({ rows, prefix }: { rows: { label: string; value: number }[]; prefix?: string }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <div className="text-[11px] text-muted-foreground font-light">No data in this range.</div>;
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="group">
          <div className="flex items-center justify-between text-[12px] font-light text-foreground/90 mb-1">
            <span className="truncate max-w-[78%] tracking-wide">
              {prefix && <span className="text-foreground/30 mr-1.5">{prefix}</span>}{r.label}
            </span>
            <span className="text-foreground/55 font-mono text-[11px] tabular-nums">{r.value}</span>
          </div>
          <div className="h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-foreground/30 via-foreground/70 to-foreground/40 transition-all" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const Analytics = () => {
  const { user, loading } = useAuth();
  const [range, setRange] = useState<typeof RANGES[number]>(RANGES[2]);
  const [views, setViews] = useState<PageView[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) return;
    let alive = true;
    (async () => {
      setBusy(true);
      const since = new Date(Date.now() - range.days * 86400_000).toISOString();
      const [{ data: pv }, { data: ss }] = await Promise.all([
        supabase.from("page_view_events")
          .select("path,entered_at,duration_seconds,user_id")
          .gte("entered_at", since)
          .order("entered_at", { ascending: false })
          .limit(20000),
        supabase.from("user_sessions")
          .select("session_token_hash,country,device_type,browser,referrer,utm_source,created_at,last_active_at,user_id")
          .gte("last_active_at", since)
          .limit(20000),
      ]);
      if (!alive) return;
      setViews((pv as PageView[]) || []);
      setSessions((ss as Session[]) || []);
      setBusy(false);
    })();
    return () => { alive = false; };
  }, [user, range]);

  // ----- METRICS -----
  // "One device = one person per day": unique session_token_hash (device+browser) per day.
  // Visitors metric = distinct devices in the range, counted once per day they were active.
  const metrics = useMemo(() => {
    const pageviews = views.length;

    // Daily unique-device set (active on that day)
    const dailyDevices = new Map<string, Set<string>>();      // day -> set of session_token_hash
    const dailyPV = new Map<string, number>();
    for (const v of views) {
      const d = dayKey(v.entered_at);
      dailyPV.set(d, (dailyPV.get(d) || 0) + 1);
    }
    for (const s of sessions) {
      const active = s.last_active_at || s.created_at;
      if (!active) continue;
      const d = dayKey(active);
      if (!dailyDevices.has(d)) dailyDevices.set(d, new Set());
      dailyDevices.get(d)!.add(s.session_token_hash);
    }
    // Total visitors = sum of unique devices per day (one device counts once per day)
    let visitors = 0;
    dailyDevices.forEach(set => { visitors += set.size; });

    // Avg session duration (seconds) — per device's total time on site in the range
    const perDevice = new Map<string, number>();
    // map user_id -> set of session hashes (so we can attribute pageviews→a device)
    const userDevices = new Map<string, string[]>();
    for (const s of sessions) {
      if (!userDevices.has(s.user_id)) userDevices.set(s.user_id, []);
      userDevices.get(s.user_id)!.push(s.session_token_hash);
      perDevice.set(s.session_token_hash, 0);
    }
    for (const v of views) {
      const devs = userDevices.get(v.user_id);
      const key = devs && devs.length ? devs[0] : v.user_id; // attribute to first device or fall back
      perDevice.set(key, (perDevice.get(key) || 0) + (v.duration_seconds || 0));
    }
    const totalDur = Array.from(perDevice.values()).reduce((a, b) => a + b, 0);
    const devCount = perDevice.size || 1;
    const avgDur = Math.round(totalDur / devCount);

    const ppv = visitors ? +(pageviews / visitors).toFixed(2) : 0;

    // Bounce: device-days where that device had only 1 pageview
    const deviceDayPV = new Map<string, number>();
    for (const v of views) {
      const d = dayKey(v.entered_at);
      const devs = userDevices.get(v.user_id);
      const dev = devs && devs.length ? devs[0] : v.user_id;
      const k = dev + "|" + d;
      deviceDayPV.set(k, (deviceDayPV.get(k) || 0) + 1);
    }
    const totalDeviceDays = deviceDayPV.size || 1;
    const bounces = Array.from(deviceDayPV.values()).filter(n => n === 1).length;
    const bounceRate = Math.round((bounces / totalDeviceDays) * 100);

    return { pageviews, visitors, avgDur, ppv, bounceRate, dailyPV, dailyDevices };
  }, [views, sessions]);

  const series = useMemo(() => {
    const days = fillDays(range.days);
    return days.map(d => ({
      date: d.date,
      pageviews: metrics.dailyPV.get(d.key) || 0,
      visitors: metrics.dailyDevices.get(d.key)?.size || 0,
    }));
  }, [metrics, range]);

  // ----- TOP LISTS -----
  const topPages = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of views) m.set(v.path, (m.get(v.path) || 0) + 1);
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [views]);

  const topSources = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const k = parseReferrer(s.referrer, s.utm_source);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [sessions]);

  const topDevices = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const k = (s.device_type || "unknown").toLowerCase();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [sessions]);

  const topCountries = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const k = s.country || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [sessions]);

  if (loading) return null;
  if (!user) return <Navigate to="/?next=%2Fanalytics" replace />;
  if (!isAdminEmail(user.email)) return <Navigate to="/" replace />;

  return (
    <LandingBackground>
      <Header />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 pt-28 pb-24">
        {/* Title row */}
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
          <div>
            <div className="text-[10px] font-mono tracking-[0.32em] uppercase text-foreground/40 mb-3">
              ◈ Admin · Aureon Analytics
            </div>
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-foreground">
              Traffic <span className="text-foreground/40">·</span> Engagement <span className="text-foreground/40">·</span> Reach
            </h1>
            <p className="mt-3 text-sm font-extralight tracking-wide text-muted-foreground max-w-2xl">
              First-party telemetry from the Aureon platform. One device counts as one visitor per day. Lovable's hosted analytics dashboard is closed to API access, so this view ingests directly from on-platform tracking.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-foreground/15 bg-background/40 backdrop-blur-2xl p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r)}
                className={`px-4 py-2 text-[10px] font-light tracking-[0.25em] uppercase rounded-full transition-all ${
                  range.key === r.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Section label="Visitors" value={metrics.visitors} hint="unique devices · per day" />
          <Section label="Pageviews" value={metrics.pageviews} />
          <Section label="Pages / Visit" value={metrics.ppv} />
          <Section label="Session Duration" value={`${metrics.avgDur}s`} hint="avg per device" />
          <Section label="Bounce Rate" value={`${metrics.bounceRate}%`} />
        </div>

        {/* Time series */}
        <Panel title="Traffic Over Time" eyebrow={`${range.label} window`} className="mb-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--foreground) / 0.08)" />
                <XAxis dataKey="date" stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(20px)", border: "1px solid hsl(var(--foreground) / 0.15)", borderRadius: 12, fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                  labelStyle={{ color: "hsl(var(--foreground) / 0.5)", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: 9 }}
                />
                <Area type="monotone" dataKey="pageviews" stroke="hsl(var(--foreground))" strokeWidth={1.5} fill="url(#pv)" />
                <Area type="monotone" dataKey="visitors" stroke="hsl(var(--foreground) / 0.5)" strokeWidth={1} fill="url(#vis)" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-6 text-[10px] font-mono tracking-[0.22em] uppercase text-foreground/50">
            <span className="flex items-center gap-2"><span className="h-[2px] w-4 bg-foreground" /> Pageviews</span>
            <span className="flex items-center gap-2"><span className="h-[2px] w-4 bg-foreground/50" style={{ borderTop: "1px dashed" }} /> Visitors</span>
          </div>
        </Panel>

        {/* Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel title="Top Pages" eyebrow={`${topPages.length} routes`}>
            <BarList rows={topPages} />
          </Panel>
          <Panel title="Top Sources" eyebrow="referrers & utm">
            <BarList rows={topSources} />
          </Panel>
          <Panel title="Devices" eyebrow="device type">
            <BarList rows={topDevices} />
          </Panel>
          <Panel title="Countries" eyebrow="geo · ip">
            <BarList rows={topCountries} />
          </Panel>
        </div>

        <div className="mt-8 text-center text-[9px] font-mono tracking-[0.3em] uppercase text-foreground/30">
          {busy ? "◈ Synchronizing live telemetry…" : `◈ ${views.length} pageviews · ${sessions.length} sessions · last sync ${new Date().toLocaleTimeString()}`}
        </div>
      </main>
      <SiteFooter />
    </LandingBackground>
  );
};

export default Analytics;
