import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminEmail";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";

type PageView = { path: string; entered_at: string; duration_seconds: number; user_id: string };
type Session = { country: string | null; device_type: string | null; browser: string | null; referrer: string | null; created_at: string; user_id: string };

const RANGES = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
] as const;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function bucketByDay(rows: { entered_at: string }[], days: number) {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    buckets.set(fmtDate(d), 0);
  }
  for (const r of rows) {
    const key = r.entered_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets, ([date, value]) => ({ date: date.slice(5), value }));
}

function topN<T extends string>(rows: { v: T | null | undefined }[], n = 8) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = (r.v || "Unknown").toString().trim() || "Unknown";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Array.from(m, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, n);
}

function parseReferrer(ref: string | null): string {
  if (!ref) return "Direct";
  try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return "Direct"; }
}

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-foreground/10 bg-card/40 backdrop-blur-xl p-5 ${className}`}>
    <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-foreground/50 mb-4">{title}</div>
    {children}
  </div>
);

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card title={label}>
    <div className="text-3xl font-extralight text-foreground">{value}</div>
    {sub && <div className="mt-1 text-[11px] text-muted-foreground font-light">{sub}</div>}
  </Card>
);

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
          .limit(10000),
        supabase.from("user_sessions")
          .select("country,device_type,browser,referrer,created_at,user_id")
          .gte("created_at", since)
          .limit(10000),
      ]);
      if (!alive) return;
      setViews((pv as PageView[]) || []);
      setSessions((ss as Session[]) || []);
      setBusy(false);
    })();
    return () => { alive = false; };
  }, [user, range]);

  const metrics = useMemo(() => {
    const pageviews = views.length;
    const uniqueVisitors = new Set(views.map(v => v.user_id)).size;
    const totalDur = views.reduce((s, v) => s + (v.duration_seconds || 0), 0);
    const avgDur = views.length ? Math.round(totalDur / views.length) : 0;
    const ppv = uniqueVisitors ? +(pageviews / uniqueVisitors).toFixed(2) : 0;
    // bounce: visitors with only 1 pageview
    const counts = new Map<string, number>();
    for (const v of views) counts.set(v.user_id, (counts.get(v.user_id) || 0) + 1);
    const bounces = Array.from(counts.values()).filter(c => c === 1).length;
    const bounceRate = uniqueVisitors ? Math.round((bounces / uniqueVisitors) * 100) : 0;
    return { pageviews, uniqueVisitors, avgDur, ppv, bounceRate };
  }, [views]);

  const series = useMemo(() => bucketByDay(views, range.days), [views, range]);
  const topPages = useMemo(() => topN(views.map(v => ({ v: v.path }))), [views]);
  const topSources = useMemo(() => topN(sessions.map(s => ({ v: parseReferrer(s.referrer) as any }))), [sessions]);
  const topDevices = useMemo(() => topN(sessions.map(s => ({ v: s.device_type as any }))), [sessions]);
  const topCountries = useMemo(() => topN(sessions.map(s => ({ v: s.country as any }))), [sessions]);
  const topBrowsers = useMemo(() => topN(sessions.map(s => ({ v: s.browser as any }))), [sessions]);

  if (loading) return null;
  if (!user) return <Navigate to="/?next=%2Fanalytics" replace />;
  if (!isAdminEmail(user.email)) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-28 pb-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-foreground/40 mb-2">◈ Admin · Analytics</div>
            <h1 className="text-3xl sm:text-4xl font-extralight tracking-wide text-foreground">Aureon Analytics</h1>
            <p className="mt-2 text-sm text-muted-foreground font-light">Live traffic and engagement across the platform.</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-card/40 backdrop-blur-xl p-1">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-[11px] font-light tracking-[0.2em] uppercase rounded-full transition-colors ${
                  range.key === r.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >{r.label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Stat label="Pageviews" value={metrics.pageviews} />
          <Stat label="Visitors" value={metrics.uniqueVisitors} />
          <Stat label="Pages / Visit" value={metrics.ppv} />
          <Stat label="Avg Duration" value={`${metrics.avgDur}s`} />
          <Stat label="Bounce Rate" value={`${metrics.bounceRate}%`} />
        </div>

        <Card title="Traffic Over Time" className="mb-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.08)" />
                <XAxis dataKey="date" stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} />
                <YAxis stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.1)", borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card title="Top Pages">
            <BarList rows={topPages} />
          </Card>
          <Card title="Top Sources">
            <BarList rows={topSources} />
          </Card>
          <Card title="Devices">
            <BarList rows={topDevices} />
          </Card>
          <Card title="Countries">
            <BarList rows={topCountries} />
          </Card>
          <Card title="Browsers" className="md:col-span-2">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBrowsers} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--foreground) / 0.08)" />
                  <XAxis dataKey="label" stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} />
                  <YAxis stroke="hsl(var(--foreground) / 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.1)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--foreground) / 0.7)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {busy && <div className="text-center text-[11px] font-mono tracking-[0.2em] uppercase text-foreground/40 mt-6">Loading live data…</div>}
      </main>
      <SiteFooter />
    </div>
  );
};

const BarList = ({ rows }: { rows: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <div className="text-[11px] text-muted-foreground font-light">No data in this range.</div>;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.label} className="relative">
          <div className="flex items-center justify-between text-[12px] font-light text-foreground/90 mb-1">
            <span className="truncate max-w-[75%]">{r.label}</span>
            <span className="text-foreground/60 font-mono text-[11px]">{r.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
            <div className="h-full bg-foreground/60" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Analytics;
