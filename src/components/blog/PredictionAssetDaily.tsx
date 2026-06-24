import { useEffect, useRef, useState } from "react";
import ArticleShell from "@/components/seo/ArticleShell";
import { TrendingUp, TrendingDown, Activity, Target, Shield, Zap } from "lucide-react";

/**
 * Generic AXRLEN daily-forecast blog page. One asset per route.
 * Mirrors PredictionBtcDaily.tsx but talks to the multi-asset edge functions:
 *   asset-prediction-public, asset-spot, asset-settle (?asset=KEY)
 */

export interface AxrlenAssetConfig {
  key: "ETH" | "CRUDE" | "SPX" | "NDX";
  title: string;          // page title
  eyebrow: string;        // top eyebrow label
  shortName: string;      // "ETH", "WTI Crude", "S&P 500", "NASDAQ 100"
  venue: string;          // trading venue line
  unitPrefix?: string;    // "$" for USD, "" for index points
  unitSuffix?: string;    // "" or " pts"
  decimals: number;       // display precision
  dek: string;
  description: string;    // long-form intro
}

interface Prediction {
  id: string;
  asset: string;
  prediction_date: string;
  generated_at: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  horizon_hours: number;
  thesis: string;
  reasoning: string | null;
  status: "OPEN" | "WIN" | "LOSS" | "EXPIRED" | "CANCELLED";
  settled_at: string | null;
  settle_price: number | null;
  pnl_pct: number | null;
}

interface Payload {
  asset: string;
  latest: Prediction | null;
  history: Prediction[];
  stats: { wins: number; losses: number; open: number; settled: number; winRate: number; totalPnl: number };
}

const SUPA = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fmtAgo = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
};

const PredictionAssetDaily = ({ cfg }: { cfg: AxrlenAssetConfig }) => {
  const [data, setData] = useState<Payload | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now());

  const FN_PUBLIC = `${SUPA}/functions/v1/asset-prediction-public?asset=${cfg.key}`;
  const FN_SPOT = `${SUPA}/functions/v1/asset-spot?asset=${cfg.key}`;
  const FN_SETTLE = `${SUPA}/functions/v1/asset-settle`;

  const fmt = (v: number | string | null | undefined) => {
    if (v == null) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${cfg.unitPrefix ?? "$"}${n.toLocaleString(undefined, { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals })}${cfg.unitSuffix ?? ""}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(FN_PUBLIC, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
        const j = await r.json();
        setData(j);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [FN_PUBLIC]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const r = await fetch(FN_SPOT, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
        if (r.ok) {
          const j = await r.json();
          if (j?.price > 0) { setLivePrice(j.price); setPriceSource(j.source); }
        }
      } catch { /* swallow */ }
    };
    fetchPrice();
    const i = setInterval(fetchPrice, 30_000);
    return () => clearInterval(i);
  }, [FN_SPOT]);

  const latest = data?.latest;
  const stats = data?.stats;

  const settledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!latest || latest.status !== "OPEN" || livePrice == null) return;
    const ageMs = Date.now() - new Date(latest.generated_at).getTime();
    const entry = Number(latest.entry_price);
    const tp = Number(latest.take_profit);
    const sl = Number(latest.stop_loss);
    const long = latest.direction === "LONG";
    const entryHit = long ? livePrice <= entry : livePrice >= entry;
    const tpHit = long ? livePrice >= tp : livePrice <= tp;
    const slHit = long ? livePrice <= sl : livePrice >= sl;
    const cancelExpired = !entryHit && ageMs > 30 * 60_000;

    if (!tpHit && !slHit && !cancelExpired) return;
    const key = `${latest.id}:${tpHit ? "WIN" : slHit ? "LOSS" : "CANCELLED"}`;
    if (settledRef.current.has(key)) return;
    settledRef.current.add(key);

    fetch(FN_SETTLE, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ id: latest.id, price: livePrice }),
    })
      .then((r) => r.json())
      .then((j) => { if (j?.settled) {
        fetch(FN_PUBLIC, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
          .then((r) => r.json()).then(setData).catch(() => {});
      }})
      .catch(() => settledRef.current.delete(key));
  }, [latest, livePrice, FN_PUBLIC, FN_SETTLE]);

  return (
    <ArticleShell
      eyebrow={cfg.eyebrow}
      title={cfg.title}
      dek={cfg.dek}
      publishedLabel="Updated continuously"
      readTime="Live"
    >
      <section className="mb-10 rounded-2xl border border-accent/30 bg-card/40 backdrop-blur-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-accent/80 mb-2">◈ Live {cfg.shortName} Spot</p>
            <p className="text-4xl font-light tabular-nums">{fmt(livePrice)}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {priceSource ? `Live · ${priceSource} · refreshes every 30s` : "Connecting to public quote feed…"}
            </p>
            <p className="text-[10px] tracking-[0.3em] uppercase text-accent/70 mt-2">◈ Venue · {cfg.venue}</p>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-light text-emerald-400 tabular-nums">{stats.wins}</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Wins</p>
              </div>
              <div>
                <p className="text-2xl font-light text-red-400 tabular-nums">{stats.losses}</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Losses</p>
              </div>
              <div>
                <p className="text-2xl font-light tabular-nums">{stats.winRate.toFixed(1)}%</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Win rate</p>
              </div>
            </div>
          )}
        </div>
        {stats && (
          <div className="mt-4 pt-4 border-t border-border/20 flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
            <span>Settled trades: <span className="text-foreground tabular-nums">{stats.settled}</span></span>
            <span>Open: <span className="text-foreground tabular-nums">{stats.open}</span></span>
            <span>Cumulative PnL: <span className={`tabular-nums ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)}%</span></span>
          </div>
        )}
      </section>

      {loading && <p className="text-sm text-muted-foreground">Loading AXRLEN call…</p>}
      {!loading && !latest && (
        <div className="rounded-xl border border-border/40 p-6 text-sm text-muted-foreground">
          No prediction yet — the next AXRLEN call generates at 07:00 EST.
        </div>
      )}
      {latest && (() => {
        const generatedMs = new Date(latest.generated_at).getTime();
        const ageMs = now - generatedMs;
        const within30 = ageMs <= 30 * 60_000;
        const entryHit = livePrice != null && (
          latest.direction === "LONG" ? livePrice <= latest.entry_price : livePrice >= latest.entry_price
        );
        const cancelled = latest.status === "OPEN" && !within30 && !entryHit;
        const displayStatus = cancelled ? "CANCELLED" : latest.status;
        return (
          <section className="mb-12 rounded-2xl border border-border/40 bg-card/30 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[10px] tracking-[0.4em] uppercase text-accent/80">
                  ◈ AXRLEN Call · {new Date(latest.generated_at).toUTCString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  Prediction made <span className="text-foreground">{fmtAgo(ageMs)}</span>
                  {latest.status === "OPEN" && (
                    within30
                      ? <span className="ml-2 text-accent/80">· {fmtAgo(30 * 60_000 - ageMs).replace(" ago", "")} until entry-fill window closes</span>
                      : !entryHit && <span className="ml-2 text-red-400/80">· entry never filled within 30m window</span>
                  )}
                </p>
              </div>
              <span className={`text-[10px] tracking-[0.3em] uppercase px-2 py-1 rounded-full border ${
                displayStatus === "WIN" ? "border-emerald-400/40 text-emerald-400" :
                displayStatus === "LOSS" ? "border-red-400/40 text-red-400" :
                displayStatus === "CANCELLED" ? "border-muted-foreground/40 text-muted-foreground" :
                "border-accent/40 text-accent"
              }`}>{displayStatus}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {latest.direction === "LONG" ? (
                <TrendingUp className="h-7 w-7 text-emerald-400" />
              ) : (
                <TrendingDown className="h-7 w-7 text-red-400" />
              )}
              <div>
                <p className="text-3xl font-light">{latest.direction}</p>
                <p className="text-xs text-muted-foreground">Confidence {latest.confidence}% · {latest.horizon_hours}h horizon</p>
              </div>
            </div>

            <p className="text-base font-extralight leading-relaxed text-foreground/85 mb-6">
              {latest.thesis}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground"><Zap className="h-3 w-3" /><span className="text-[10px] tracking-[0.3em] uppercase">Entry</span></div>
                <p className="text-lg tabular-nums">{fmt(latest.entry_price)}</p>
              </div>
              <div className="rounded-lg border border-red-400/30 p-4">
                <div className="flex items-center gap-2 mb-1 text-red-400/80"><Shield className="h-3 w-3" /><span className="text-[10px] tracking-[0.3em] uppercase">Stop Loss</span></div>
                <p className="text-lg tabular-nums text-red-400">{fmt(latest.stop_loss)}</p>
              </div>
              <div className="rounded-lg border border-emerald-400/30 p-4">
                <div className="flex items-center gap-2 mb-1 text-emerald-400/80"><Target className="h-3 w-3" /><span className="text-[10px] tracking-[0.3em] uppercase">Take Profit</span></div>
                <p className="text-lg tabular-nums text-emerald-400">{fmt(latest.take_profit)}</p>
              </div>
            </div>

            {latest.reasoning && (
              <div className="rounded-lg bg-muted/10 border border-border/20 p-4">
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2 flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Intelligence Brief
                </p>
                <p className="text-sm font-extralight leading-relaxed text-foreground/75">{latest.reasoning}</p>
              </div>
            )}
          </section>
        );
      })()}

      {data?.history && data.history.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-2xl font-light">Prediction Logs</h2>
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Auto-settled hourly · TP/SL hit detection
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/30">
            <table className="w-full text-xs">
              <thead className="bg-muted/10 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Date</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Time (UTC)</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Dir</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Conf</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Entry</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Stop Loss</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Take Profit</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Settle</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Result</th>
                  <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">PnL</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((r) => {
                  const ts = new Date(r.generated_at);
                  return (
                    <tr key={r.id} className="border-t border-border/20 hover:bg-muted/5">
                      <td className="p-3 tabular-nums">{r.prediction_date}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{ts.toISOString().slice(11, 16)}</td>
                      <td className={`p-3 font-medium ${r.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>{r.direction}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{r.confidence}%</td>
                      <td className="p-3 tabular-nums">{fmt(r.entry_price)}</td>
                      <td className="p-3 tabular-nums text-red-400/70">{fmt(r.stop_loss)}</td>
                      <td className="p-3 tabular-nums text-emerald-400/70">{fmt(r.take_profit)}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{r.settle_price ? fmt(r.settle_price) : "—"}</td>
                      <td className={`p-3 ${r.status === "WIN" ? "text-emerald-400" : r.status === "LOSS" ? "text-red-400" : "text-muted-foreground"}`}>{r.status}</td>
                      <td className={`p-3 tabular-nums ${r.pnl_pct == null ? "text-muted-foreground" : Number(r.pnl_pct) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {r.pnl_pct == null ? "—" : `${Number(r.pnl_pct) >= 0 ? "+" : ""}${Number(r.pnl_pct).toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-2xl font-light mb-3">How it works</h2>
        <p className="text-sm font-extralight leading-relaxed text-foreground/75 mb-3">
          Every day at 07:00 EST a scheduled cron job fires the <code className="text-accent">asset-predict-daily</code> edge function. It pulls a live {cfg.shortName} snapshot — spot price, 24-hour change, intraday range, and volume — from a public quote feed, then feeds it into the AXRLEN Nexus Prime engine.
        </p>
        <p className="text-sm font-extralight leading-relaxed text-foreground/75 mb-3">
          {cfg.description}
        </p>
        <p className="text-sm font-extralight leading-relaxed text-foreground/75">
          Every hour <code className="text-accent">asset-settle-hourly</code> re-checks open trades against live price. If TP or SL is hit, the trade is closed and tallied. If entry never fills within 30 minutes, the call is cancelled. If neither TP nor SL is hit by the horizon, it expires.
        </p>
      </section>
    </ArticleShell>
  );
};

export default PredictionAssetDaily;
