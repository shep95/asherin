import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Trophy, Target, Activity, Sparkles, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    document.title = "AvaPicks — AI Sports Betting Predictions";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "AVA AI-powered daily sports picks with live win-rate tracking. Two predictions per day, fully transparent.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = desc;
      document.head.appendChild(m);
    }
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
    const [picksRes, statsRes] = await Promise.all([
      supabase.from("ava_picks").select("*").gte("pick_date", sevenAgo).order("picked_at", { ascending: false }),
      supabase.from("ava_win_stats").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const all = (picksRes.data ?? []) as Pick[];
    setToday(all.filter(p => p.pick_date === todayStr));
    setRecent(all.filter(p => p.pick_date !== todayStr));
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary)/0.25), transparent 60%), radial-gradient(ellipse at bottom right, hsl(var(--primary)/0.15), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            AVA Sports Brain · Live
          </div>
          <h1 className="mt-8 text-5xl md:text-7xl font-extralight tracking-tight">
            AvaPicks
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto">
            Two AI-selected sports picks. Every day. Fully tracked, fully transparent —
            powered by sharp moneyline consensus from DraftKings, FanDuel, BetMGM, ESPN BET, Circa & Bet365.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button onClick={generateNow} disabled={generating} variant="outline" className="border-border/60 backdrop-blur-sm">
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "AVA Analyzing…" : "Run AVA Now"}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-6 -mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={<Target className="h-4 w-4" />} label="Win Rate" value={`${stats?.win_rate?.toFixed(1) ?? "0.0"}%`} accent />
          <StatTile icon={<Trophy className="h-4 w-4" />} label="Wins" value={stats?.wins ?? 0} />
          <StatTile icon={<XCircle className="h-4 w-4" />} label="Losses" value={stats?.losses ?? 0} />
          <StatTile icon={<Activity className="h-4 w-4" />} label="Total Picks" value={stats?.total_picks ?? 0} />
        </div>
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

const StatTile = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent?: boolean }) => (
  <Card className={`p-5 border-border/40 backdrop-blur-md ${accent ? "bg-primary/5" : "bg-card/40"}`}>
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className={`mt-3 text-3xl font-extralight tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
  </Card>
);

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
  return (
    <Card className={`group relative overflow-hidden border-border/40 backdrop-blur-md transition-all hover:border-primary/40 ${hero ? "bg-card/50" : "bg-card/30"}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{pick.league}</div>
            <div className="mt-1 text-xs text-muted-foreground/70">{pick.sport}</div>
          </div>
          <Badge variant="outline" className={`border ${confidenceStyle(pick.confidence)} text-[10px] uppercase tracking-[0.15em]`}>
            {pick.confidence}
          </Badge>
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
