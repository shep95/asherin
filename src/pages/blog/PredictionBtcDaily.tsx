import { useEffect, useRef, useState } from "react";
import ArticleShell from "@/components/seo/ArticleShell";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import { TrendingUp, TrendingDown, Activity, Target, Shield, Zap } from "lucide-react";

/**
 * /blog/btc-daily-predictions — Live AXRLEN BTC long/short forecast.
 * - Auto-refreshes BTC price every 30s from CoinGecko.
 * - Loads server-stored predictions + win/loss tally from
 *   the `btc-prediction-public` edge function.
 * - Cron job (12:00 UTC daily) generates a fresh AXRLEN call.
 */

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btc-prediction-public`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Prediction {
  id: string;
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
  status: "OPEN" | "WIN" | "LOSS" | "EXPIRED";
  settled_at: string | null;
  settle_price: number | null;
  pnl_pct: number | null;
}

interface Payload {
  latest: Prediction | null;
  history: Prediction[];
  stats: { wins: number; losses: number; open: number; settled: number; winRate: number; totalPnl: number };
}

const PredictionBtcDaily = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(FN_URL, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
        const j = await r.json();
        setData(j);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  const [priceSource, setPriceSource] = useState<string>("");
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btc-spot`;
    const clientSources: { name: string; url: string; pick: (j: any) => number | null }[] = [
      { name: "Coinbase", url: "https://api.coinbase.com/v2/prices/BTC-USD/spot", pick: (j) => Number(j?.data?.amount) || null },
      { name: "Bitstamp", url: "https://www.bitstamp.net/api/v2/ticker/btcusd/", pick: (j) => Number(j?.last) || null },
      { name: "Kraken", url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD", pick: (j) => Number(j?.result?.XXBTZUSD?.c?.[0]) || null },
    ];
    const fetchPrice = async () => {
      // Server-side proxy first (no CORS / geo issues)
      try {
        const r = await fetch(proxyUrl, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
        if (r.ok) {
          const j = await r.json();
          if (j?.price > 0) { setLivePrice(j.price); setPriceSource(j.source); setPriceUpdatedAt(Date.now()); return; }
        }
      } catch { /* fall through */ }
      // Client-side fallback
      for (const s of clientSources) {
        try {
          const r = await fetch(s.url);
          if (!r.ok) continue;
          const j = await r.json();
          const p = s.pick(j);
          if (p && p > 0) { setLivePrice(p); setPriceSource(s.name); setPriceUpdatedAt(Date.now()); return; }
        } catch { /* next */ }
      }
    };
    fetchPrice();
    const i = setInterval(fetchPrice, 15_000);
    return () => clearInterval(i);
  }, []);

  const fmtAgo = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
  };

  const latest = data?.latest;
  const stats = data?.stats;

  return (
    <>
      <ArticleShell
        eyebrow="AXRLEN · BTC DAILY"
        title="AXRLEN BTC Daily — Live Long/Short Forecast"
        dek="Every day at 07:00 EST the AXRLEN engine reads live Bitcoin price action, momentum, and liquidity and publishes a 24-hour directional call with entry, stop loss, and take profit. Wins and losses are tallied automatically."
        publishedLabel="Updated continuously"
        readTime="Live"
      >
        {/* Live BTC price ticker */}
        <section className="mb-10 rounded-2xl border border-accent/30 bg-card/40 backdrop-blur-md p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] tracking-[0.4em] uppercase text-accent/80 mb-2">◈ Live BTC Spot</p>
              <p className="text-4xl font-light tabular-nums">
                {livePrice ? `$${livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {priceSource ? `Live spot · ${priceSource} public API · refreshes every 30s` : "Connecting to public exchange feed…"}
              </p>
              <p className="text-[10px] tracking-[0.3em] uppercase text-accent/70 mt-2">◈ Venue · Hyperliquid Perpetuals (BTC-PERP)</p>
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
            <div className="mt-4 pt-4 border-t border-border/20 flex items-center gap-6 text-xs text-muted-foreground">
              <span>Settled trades: <span className="text-foreground tabular-nums">{stats.settled}</span></span>
              <span>Open: <span className="text-foreground tabular-nums">{stats.open}</span></span>
              <span>Cumulative PnL: <span className={`tabular-nums ${stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(2)}%</span></span>
            </div>
          )}
        </section>

        {/* Today's call */}
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
                <p className="text-lg tabular-nums">${latest.entry_price.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-red-400/30 p-4">
                <div className="flex items-center gap-2 mb-1 text-red-400/80"><Shield className="h-3 w-3" /><span className="text-[10px] tracking-[0.3em] uppercase">Stop Loss</span></div>
                <p className="text-lg tabular-nums text-red-400">${latest.stop_loss.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-emerald-400/30 p-4">
                <div className="flex items-center gap-2 mb-1 text-emerald-400/80"><Target className="h-3 w-3" /><span className="text-[10px] tracking-[0.3em] uppercase">Take Profit</span></div>
                <p className="text-lg tabular-nums text-emerald-400">${latest.take_profit.toLocaleString()}</p>
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

        {/* History / Logs */}
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
                    <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Target</th>
                    <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Settle</th>
                    <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">Result</th>
                    <th className="p-3 font-normal tracking-[0.2em] uppercase text-[10px]">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((r) => {
                    const ts = new Date(r.generated_at);
                    const target = r.direction === "LONG" ? Number(r.take_profit) : Number(r.take_profit);
                    return (
                      <tr key={r.id} className="border-t border-border/20 hover:bg-muted/5">
                        <td className="p-3 tabular-nums">{r.prediction_date}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {ts.toISOString().slice(11, 16)}
                        </td>
                        <td className={`p-3 font-medium ${r.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>{r.direction}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">{r.confidence}%</td>
                        <td className="p-3 tabular-nums">${Number(r.entry_price).toLocaleString()}</td>
                        <td className="p-3 tabular-nums text-red-400/70">${Number(r.stop_loss).toLocaleString()}</td>
                        <td className="p-3 tabular-nums text-emerald-400/70">${Number(r.take_profit).toLocaleString()}</td>
                        <td className="p-3 tabular-nums text-foreground/80">
                          {r.direction === "LONG" ? "▲" : "▼"} ${target.toLocaleString()}
                        </td>
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {r.settle_price ? `$${Number(r.settle_price).toLocaleString()}` : "—"}
                        </td>
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
            Every day at 07:00 EST a scheduled cron job fires the <code className="text-accent">btc-predict-daily</code> edge function. It pulls a live BTC snapshot — spot price, 24h / 7d momentum, range, volume, market cap — from CoinGecko, then feeds it into the AXRLEN Nexus Prime engine running on the Lovable AI Gateway.
          </p>
          <p className="text-sm font-extralight leading-relaxed text-foreground/75 mb-3">
            AXRLEN returns a strict-JSON directional call: <code className="text-accent">LONG</code> or <code className="text-accent">SHORT</code>, a confidence score, stop loss, take profit, and a one-sentence thesis. Risk/reward is enforced at ≥ 1:1.5 and the stop sits 1.5–3% from entry on a 24h horizon.
          </p>
          <p className="text-sm font-extralight leading-relaxed text-foreground/75">
            The next morning the same job settles yesterday's open call by comparing the new spot price to its TP/SL bands and writes a <code className="text-emerald-400">WIN</code> or <code className="text-red-400">LOSS</code> with realized PnL into the track record above.
          </p>
        </section>
      </ArticleShell>

      <ArticleJsonLd
        id="btc-daily-predictions"
        url="https://aureonai.app/blog/btc-daily-predictions"
        headline="AXRLEN BTC Daily — Live Long/Short Forecast"
        description="Automated 24-hour Bitcoin long/short prediction generated every day at 07:00 EST by the AXRLEN engine. Live BTC price, entry/SL/TP, and a running win/loss tally."
        datePublished="2026-06-23"
      />
      <BreadcrumbJsonLd
        id="btc-daily-predictions"
        items={[
          { name: "Aureon", url: "https://aureonai.app" },
          { name: "Blog", url: "https://aureonai.app/blog" },
          { name: "AXRLEN BTC Daily", url: "https://aureonai.app/blog/btc-daily-predictions" },
        ]}
      />
      <FaqJsonLd
        id="btc-daily-predictions"
        items={[
          { q: "When is the next BTC prediction posted?", a: "Every day at 07:00 EST (12:00 UTC). A scheduled job calls the AXRLEN engine with a live BTC snapshot and publishes the long/short call to this page." },
          { q: "How are wins and losses tallied?", a: "Each prediction has a stop loss and take profit. After 24 hours the engine compares the new BTC spot price to those bands and writes WIN or LOSS plus realized PnL into the track record." },
          { q: "Is this trading advice?", a: "No. The AXRLEN BTC Daily call is a published predictive intelligence forecast for transparency and back-testing. It is not financial advice." },
        ]}
      />

    </>
  );
};

export default PredictionBtcDaily;
