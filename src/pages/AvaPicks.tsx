import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { applySeoHead } from "@/lib/seoHead";
import {
  TrendingUp, Trophy, Target, Activity, Sparkles, Clock,
  CheckCircle2, XCircle, RefreshCw, Timer, Flame, Zap,
} from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from "recharts";

interface Pick {
  id: string;
  game_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_time: string;
  predicted_winner: string;
  confidence: string;
  reasoning: string;
  sharp_angle: string | null;
  odds_analysis: any;
  status: string;
  actual_winner: string | null;
  final_score: string | null;
  pick_date: string;
  picked_at: string;
}

interface Stats {
  total_picks: number;
  wins: number;
  losses: number;
  pending: number;
  win_rate: number;
}

const AvaPicks = () => {
  const [today, setToday] = useState<Pick[]>([]);
  const [recent, setRecent] = useState<Pick[]>([]);
  const [history14, setHistory14] = useState<Pick[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    applySeoHead({
      title: "AvaPicks — AI Sports Betting Predictions",
      description: "AVA AI-powered daily sports picks with live win-rate tracking. Two predictions per day, fully transparent.",
      path: "/avapicks",
    });
    load();
    const ch = supabase.channel("ava-picks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ava_picks" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ava_win_stats" }, () => load())
      .subscribe();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, []);

  const load = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const fourteenAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const [picksRes, statsRes, hist14Res] = await Promise.all([
      supabase.from("ava_picks").select("*").gte("pick_date", sevenAgo).order("picked_at", { ascending: false }),
      supabase.from("ava_win_stats").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ava_picks").select("*").gte("pick_date", fourteenAgo).order("pick_date", { ascending: true }),
    ]);
    const all = (picksRes.data ?? []) as Pick[];
    setToday(all.filter(p => p.pick_date === todayStr));
    setRecent(all.filter(p => p.pick_date !== todayStr));
    setHistory14((hist14Res.data ?? []) as Pick[]);
    setStats((statsRes.data as Stats) ?? { total_picks: 0, wins: 0, losses: 0, pending: 0, win_rate: 0 });
    setLoading(false);
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ava-generate-picks", { body: {} });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`AVA generated ${data.picks?.length ?? 0} picks`);
        await load();
      } else {
        toast.error(data?.reason ?? "No picks generated");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ---- Derived analytics ----
  const streak = useMemo(() => {
    const decided = [...history14].filter(p => p.status === "WIN" || p.status === "LOSS")
      .sort((a, b) => new Date(b.picked_at).getTime() - new Date(a.picked_at).getTime());
    if (decided.length === 0) return { type: "—", count: 0 };
    const first = decided[0].status;
    let count = 0;
    for (const p of decided) {
      if (p.status === first) count++; else break;
    }
    return { type: first, count };
  }, [history14]);

  const sparkData = useMemo(() => {
    // Cumulative net units (W = +1, L = -1) across last 14 days
    const decided = [...history14]
      .filter(p => p.status === "WIN" || p.status === "LOSS")
      .sort((a, b) => new Date(a.picked_at).getTime() - new Date(b.picked_at).getTime());
    let cum = 0;
    return decided.map((p, i) => {
      cum += p.status === "WIN" ? 1 : -1;
      return { i, units: cum, date: p.pick_date };
    });
  }, [history14]);

  const recentResults = useMemo(() => {
    return [...history14]
      .filter(p => p.status === "WIN" || p.status === "LOSS")
      .sort((a, b) => new Date(b.picked_at).getTime() - new Date(a.picked_at).getTime())
      .slice(0, 20);
  }, [history14]);

  return (
    <div className="relative min-h-screen text-foreground">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${wallpaperAureon})` }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 bg-background/70 backdrop-blur-[2px]" />
      <Header />

      {/* Result Ticker */}
      {recentResults.length > 0 && <ResultTicker items={recentResults} />}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary)/0.25), transparent 60%), radial-gradient(ellipse at bottom right, hsl(var(--primary)/0.15), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            AVA Sports Brain · Dual-Model Consensus · Live
          </div>
          <h1 className="mt-8 text-5xl md:text-7xl font-extralight tracking-tight">
            AvaPicks
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
            Two AI-selected sports picks. Every day. Validated by two independent Gemini models —
            we only post when both agree.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <NextDropCountdown />
            <Button onClick={generateNow} disabled={generating} variant="outline" className="border-border/60 backdrop-blur-sm">
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "AVA Analyzing…" : "Run AVA Now"}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="mx-auto max-w-6xl px-6 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <WinRateTile winRate={stats?.win_rate ?? 0} />
          <StatTile icon={<Trophy className="h-4 w-4" />} label="Wins" value={stats?.wins ?? 0} />
          <StatTile icon={<XCircle className="h-4 w-4" />} label="Losses" value={stats?.losses ?? 0} />
          <StreakTile streak={streak} />
          <StatTile icon={<Activity className="h-4 w-4" />} label="Total" value={stats?.total_picks ?? 0} />
        </div>

        {/* Sparkline */}
        <Card className="mt-3 p-5 border-border/40 bg-card/40 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3" /> 14-Day Net Units
            </div>
            <div className="text-xs text-muted-foreground">
              {sparkData.length > 0
                ? <span className={sparkData[sparkData.length - 1].units >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {sparkData[sparkData.length - 1].units >= 0 ? "+" : ""}{sparkData[sparkData.length - 1].units}u
                  </span>
                : "No data"}
            </div>
          </div>
          <div className="h-24">
            {sparkData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [`${v >= 0 ? "+" : ""}${v}u`, "Net"]}
                    labelFormatter={() => ""}
                  />
                  <Area type="monotone" dataKey="units" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sparkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Awaiting graded picks…
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Today's Picks */}
      <section className="mx-auto max-w-6xl px-6 mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light tracking-tight flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Today's Picks
          </h2>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-5">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : today.length === 0 ? (
          <Card className="p-12 border-dashed border-border/40 bg-card/30 backdrop-blur-sm text-center">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-light">
              AVA posts picks daily at <span className="text-foreground">11:00 AM ET</span>.
              <br />Hit "Run AVA Now" above to scan today's slate manually.
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {today.map(p => <PickCard key={p.id} pick={p} hero />)}
          </div>
        )}
      </section>

      {/* History */}
      <section className="mx-auto max-w-6xl px-6 mt-20 mb-24">
        <h2 className="text-2xl font-light tracking-tight mb-6">Recent History · 7 Days</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground font-light">No graded picks yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(p => <HistoryRow key={p.id} pick={p} />)}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
};

// ---------- Result Ticker (marquee) ----------
const ResultTicker = ({ items }: { items: Pick[] }) => {
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-b border-border/40 bg-card/30 backdrop-blur-md">
      <div className="flex animate-[ticker_45s_linear_infinite] whitespace-nowrap py-2">
        {loop.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-5 text-xs">
            {p.status === "WIN"
              ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              : <XCircle className="h-3 w-3 text-red-400" />}
            <span className={`uppercase tracking-[0.15em] ${p.status === "WIN" ? "text-emerald-400" : "text-red-400"}`}>
              {p.status}
            </span>
            <span className="text-muted-foreground">{p.league}</span>
            <span className="text-foreground/80">{p.predicted_winner}</span>
            <span className="text-muted-foreground/40">·</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
};

// ---------- Countdown to next 11 AM ET drop ----------
const NextDropCountdown = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // 11 AM America/New_York → 15:00 or 16:00 UTC depending on DST. Approximate via offset detection.
  const nextDrop = useMemo(() => {
    const d = new Date(now);
    // Build today's 11AM ET via formatter trick
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
    const etHour = parseInt(fmt.format(d), 10);
    const target = new Date(d);
    // shift by difference: we want ET hour to be 11
    target.setHours(target.getHours() + (11 - etHour));
    target.setMinutes(0, 0, 0);
    if (target.getTime() <= now) target.setTime(target.getTime() + 24 * 3600 * 1000);
    return target.getTime();
  }, [now]);
  const diff = Math.max(0, nextDrop - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm backdrop-blur-sm">
      <Timer className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground text-xs uppercase tracking-[0.18em]">Next Drop</span>
      <span className="font-mono tabular-nums text-foreground">
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
};

// ---------- Animated win-rate tile w/ radial ring ----------
const WinRateTile = ({ winRate }: { winRate: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = winRate;
    const dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [winRate]); // eslint-disable-line

  return (
    <Card className="relative p-5 border-border/40 bg-primary/5 backdrop-blur-md overflow-hidden">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Target className="h-4 w-4" />
        Win Rate
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-3xl font-extralight tracking-tight text-primary tabular-nums">
          {display.toFixed(1)}%
        </div>
        <RadialGauge value={winRate} size={48} />
      </div>
    </Card>
  );
};

const RadialGauge = ({ value, size = 64, label }: { value: number; size?: number; label?: string }) => {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--primary))" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 0.8s ease-out" }}
        />
      </svg>
      {label && (
        <span className="absolute text-[10px] font-mono tabular-nums text-foreground">
          {Math.round(pct)}
        </span>
      )}
    </div>
  );
};

const StreakTile = ({ streak }: { streak: { type: string; count: number } }) => {
  const isWin = streak.type === "WIN";
  return (
    <Card className="p-5 border-border/40 bg-card/40 backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Flame className={`h-4 w-4 ${isWin ? "text-emerald-400" : streak.type === "LOSS" ? "text-red-400" : ""}`} />
        Streak
      </div>
      <div className="mt-3 text-3xl font-extralight tracking-tight">
        {streak.count > 0 ? (
          <span className={isWin ? "text-emerald-400" : "text-red-400"}>
            {streak.count}{isWin ? "W" : "L"}
          </span>
        ) : "—"}
      </div>
    </Card>
  );
};

const StatTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <Card className="p-5 border-border/40 bg-card/40 backdrop-blur-md">
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className="mt-3 text-3xl font-extralight tracking-tight">{value}</div>
  </Card>
);

const confidenceValue = (c: string) => {
  switch (c?.toUpperCase()) {
    case "HIGH": return 90;
    case "MEDIUM": return 65;
    case "LOW": return 35;
    default: return 50;
  }
};
const confidenceStyle = (c: string) => {
  switch (c?.toUpperCase()) {
    case "HIGH": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "MEDIUM": return "border-amber-500/40 bg-amber-500/10 text-amber-400";
    default: return "border-border/40 bg-muted/40 text-muted-foreground";
  }
};

const PickCard = ({ pick, hero }: { pick: Pick; hero?: boolean }) => {
  const time = new Date(pick.game_time).toLocaleString("en-US", {
    weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const consensusMode = pick.odds_analysis?.consensus_mode;
  const isDualConsensus = consensusMode === "dual_agreement";

  const statusGlow = pick.status === "WIN"
    ? "border-emerald-500/40 shadow-[0_0_40px_-10px_hsl(142_71%_45%/0.4)]"
    : pick.status === "LOSS"
      ? "border-red-500/30 opacity-80"
      : "border-border/40 hover:border-primary/40";

  return (
    <Card className={`group relative overflow-hidden backdrop-blur-md transition-all ${hero ? "bg-card/50" : "bg-card/30"} ${statusGlow}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {pick.status === "PENDING" && (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{pick.league}</div>
            <div className="mt-1 text-xs text-muted-foreground/70">{pick.sport}</div>
            {isDualConsensus && (
              <Badge variant="outline" className="mt-2 border-primary/40 bg-primary/10 text-primary text-[9px] uppercase tracking-[0.15em]">
                <Sparkles className="h-2.5 w-2.5 mr-1" /> Dual-Model Consensus
              </Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={`border ${confidenceStyle(pick.confidence)} text-[10px] uppercase tracking-[0.15em]`}>
              {pick.confidence}
            </Badge>
            <RadialGauge value={confidenceValue(pick.confidence)} size={56} label={String(confidenceValue(pick.confidence))} />
          </div>
        </div>

        <div className="mt-5">
          <div className="text-lg font-light tracking-tight">
            <span className="text-muted-foreground">{pick.away_team}</span>
            <span className="mx-2 text-muted-foreground/40">@</span>
            <span>{pick.home_team}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />{time}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 mb-1">AVA Pick</div>
          <div className="text-xl font-light tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {pick.predicted_winner}
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground leading-relaxed font-light">
          {pick.reasoning}
        </p>

        {pick.sharp_angle && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">Sharp Angle</div>
            <p className="text-sm font-light text-foreground/80">{pick.sharp_angle}</p>
          </div>
        )}

        {pick.status !== "PENDING" && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            {pick.status === "WIN" ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">WIN</span></>
            ) : pick.status === "LOSS" ? (
              <><XCircle className="h-4 w-4 text-red-400" /><span className="text-red-400">LOSS</span></>
            ) : <span className="text-muted-foreground">{pick.status}</span>}
            {pick.final_score && <span className="text-muted-foreground font-light">· {pick.final_score}</span>}
          </div>
        )}
      </div>
    </Card>
  );
};

const HistoryRow = ({ pick }: { pick: Pick }) => {
  const cfg = pick.status === "WIN"
    ? { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, color: "text-emerald-400", label: "WIN" }
    : pick.status === "LOSS"
      ? { icon: <XCircle className="h-4 w-4 text-red-400" />, color: "text-red-400", label: "LOSS" }
      : { icon: <Clock className="h-4 w-4 text-muted-foreground" />, color: "text-muted-foreground", label: pick.status };

  return (
    <div className="grid grid-cols-12 items-center gap-3 rounded-lg border border-border/30 bg-card/30 backdrop-blur-sm px-4 py-3 hover:border-border/60 transition-colors">
      <div className="col-span-2 flex items-center gap-2">
        {cfg.icon}
        <span className={`text-xs uppercase tracking-[0.15em] ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="col-span-2 text-xs text-muted-foreground">
        {new Date(pick.pick_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </div>
      <div className="col-span-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{pick.league}</div>
      <div className="col-span-4 text-sm font-light truncate">
        <span className="text-muted-foreground">{pick.away_team}</span>
        <span className="mx-1.5 text-muted-foreground/40">@</span>
        {pick.home_team}
      </div>
      <div className="col-span-3 text-sm text-right font-light truncate">
        <span className="text-muted-foreground">Pick: </span>{pick.predicted_winner}
        {pick.final_score && <div className="text-[10px] text-muted-foreground/70">{pick.final_score}</div>}
      </div>
    </div>
  );
};

export default AvaPicks;
