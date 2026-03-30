import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Loader2, Search, Sparkles, TrendingUp, Clock, BarChart3, Target,
  AlertTriangle, ArrowRight, Zap, Activity, DollarSign, Volume2, RefreshCw,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Cell,
} from "recharts";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";

interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface DiscoveredPattern {
  id: string;
  name: string;
  description: string;
  occurrences: number;
  winRate: number;
  avgReturn: number;
  riskReward: string;
  timeframe: string;
  entryRules: string[];
  exitRules: string[];
  patternZones: { startIdx: number; endIdx: number; type: "bullish" | "bearish" }[];
  confidence: number;
}

const TIMEFRAMES = [
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1mo", label: "1M" },
];

/* ── Live price ticker ── */
const useLivePrice = (symbol: string, enabled: boolean) => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [changePct, setChangePct] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!enabled || !symbol) return;
    const fetchLive = async () => {
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lavba-fetch-data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ symbol, interval: "5m" }),
          }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const bars = data.bars || [];
        if (bars.length >= 2) {
          const latest = bars[bars.length - 1];
          const prev = bars[bars.length - 2];
          setPrice(latest.close);
          setChange(latest.close - prev.close);
          setChangePct(((latest.close - prev.close) / prev.close) * 100);
        } else if (bars.length === 1) {
          setPrice(bars[0].close);
        }
      } catch { /* silent */ }
    };
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 30000); // refresh every 30s
    return () => clearInterval(intervalRef.current);
  }, [symbol, enabled]);

  return { price, change, changePct };
};

/* ── Custom Candlestick Tooltip ── */
const CandleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const bullish = d.close >= d.open;
  return (
    <div className="rounded-xl border border-border/20 bg-background/95 backdrop-blur-md p-3 shadow-xl">
      <p className="text-[10px] text-muted-foreground/60 mb-1.5">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <span className="text-muted-foreground/50">Open</span>
        <span className="text-foreground text-right">${d.open?.toFixed(2)}</span>
        <span className="text-muted-foreground/50">High</span>
        <span className="text-foreground text-right">${d.high?.toFixed(2)}</span>
        <span className="text-muted-foreground/50">Low</span>
        <span className="text-foreground text-right">${d.low?.toFixed(2)}</span>
        <span className="text-muted-foreground/50">Close</span>
        <span className={`text-right font-medium ${bullish ? "text-accent" : "text-destructive"}`}>
          ${d.close?.toFixed(2)}
        </span>
        <span className="text-muted-foreground/50">Volume</span>
        <span className="text-foreground text-right">{(d.volume / 1e6).toFixed(1)}M</span>
      </div>
    </div>
  );
};

const LavbaView = () => {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["1d"]);
  const [bars, setBars] = useState<Record<string, ChartBar[]>>({});
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([]);
  const [activeChart, setActiveChart] = useState<string>("1d");
  const [error, setError] = useState("");

  const { price, change, changePct } = useLivePrice(activeSymbol, !!activeSymbol);

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes(prev =>
      prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf]
    );
  };

  const fetchData = useCallback(async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError("");
    setBars({});
    setPatterns([]);
    setActiveSymbol(symbol.trim().toUpperCase());

    const results: Record<string, ChartBar[]> = {};

    for (const tf of selectedTimeframes) {
      try {
        setProgress(`Pulling ${symbol.toUpperCase()} ${tf} from live market data…`);
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lavba-fetch-data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ symbol: symbol.trim(), interval: tf }),
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        results[tf] = data.bars || [];
      } catch (e: any) {
        console.error(`Failed to fetch ${tf}:`, e);
        setError(e.message || "Failed to fetch data");
      }
    }

    setBars(results);
    setActiveChart(selectedTimeframes[0] || "1d");
    setLoading(false);
    setProgress("");
  }, [symbol, selectedTimeframes]);

  const discoverPatterns = useCallback(async () => {
    const allBars = Object.entries(bars);
    if (allBars.length === 0) return;

    setAnalyzing(true);
    setProgress("Aureon is scanning historical data for repeating fractal patterns…");
    let result = "";

    const barSummaries = allBars.map(([tf, data]) => {
      const sampled = data.length > 200
        ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0)
        : data;
      return `[${tf} — ${data.length} bars]\n${sampled.map(b =>
        `${b.date.slice(0, 10)},O:${b.open.toFixed(2)},H:${b.high.toFixed(2)},L:${b.low.toFixed(2)},C:${b.close.toFixed(2)},V:${b.volume}`
      ).join("\n")}`;
    }).join("\n\n");

    const prompt = `You are Aureon — an elite quantitative pattern recognition engine. You think like a quant researcher with decades of market microstructure experience.

SYMBOL: ${activeSymbol}
TIMEFRAMES ANALYZED: ${Object.keys(bars).join(", ")}

HISTORICAL OHLCV DATA:
${barSummaries}

MISSION: Analyze this REAL historical price data to discover 2-4 REPEATING patterns that form the basis of novel trading strategies. These must NOT be standard textbook patterns (head & shoulders, double top, etc). Find UNIQUE fractal structures — price behaviors that repeat due to underlying market microstructure, liquidity dynamics, or behavioral psychology.

Think like Aureon — the patterns you discover should reflect deep understanding of WHY price moves, not just what shape it makes. Consider:
- Liquidity gaps and how they get filled
- Institutional order flow signatures
- Volatility compression → expansion cycles
- Multi-timeframe confluence zones

For each discovered pattern, provide:
1. An original name reflecting its market nature
2. A detailed description of the exact price structure and WHY it occurs (market psychology/mechanics)
3. Historical occurrence count from the data
4. Approximate win rate and average return percentage
5. Precise entry and exit rules a trader could follow
6. Bar index ranges (startIdx/endIdx) where the pattern appeared in the data
7. Confidence score 0-1

Return ONLY valid JSON array:
[{
  "name": "Pattern Name",
  "description": "Detailed description including market mechanics explanation",
  "occurrences": 12,
  "winRate": 0.75,
  "avgReturn": 3.2,
  "riskReward": "1:2.5",
  "timeframe": "1d",
  "entryRules": ["Rule 1", "Rule 2", "Rule 3"],
  "exitRules": ["Stop loss rule", "Take profit rule", "Trail stop rule"],
  "patternZones": [{"startIdx": 50, "endIdx": 65, "type": "bullish"}],
  "confidence": 0.82
}]

Return ONLY the JSON array.`;

    try {
      setProgress("Running Aureon fractal analysis across all timeframes…");
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        mode: "research",
        onDelta: (chunk) => { result += chunk; },
        onDone: () => {
          try {
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as DiscoveredPattern[];
              setPatterns(parsed.map((p, i) => ({ ...p, id: `lv-${i}-${Date.now()}` })));
            }
          } catch {
            setPatterns([]);
            setError("Failed to parse Aureon analysis results.");
          }
          setAnalyzing(false);
          setProgress("");
        },
      });
    } catch {
      setAnalyzing(false);
      setProgress("");
    }
  }, [bars, activeSymbol]);

  const activeData = bars[activeChart] || [];
  const chartData = useMemo(() => activeData.map((b, i) => ({
    idx: i,
    date: b.date.length > 10 ? b.date.slice(5, 16) : b.date.slice(0, 10),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
    bullish: b.close >= b.open,
    // For candlestick body rendering
    bodyBottom: Math.min(b.open, b.close),
    bodyHeight: Math.abs(b.close - b.open),
  })), [activeData]);

  // Pattern zone overlay data
  const activePatternZones = useMemo(() => patterns
    .flatMap(p => p.patternZones?.map(z => ({
      ...z,
      name: p.name,
    })) || [])
    .filter(z => z.startIdx < chartData.length), [patterns, chartData.length]);

  // Summary stats
  const lastBar = activeData[activeData.length - 1];
  const firstBar = activeData[0];
  const totalChange = lastBar && firstBar ? ((lastBar.close - firstBar.close) / firstBar.close * 100) : 0;
  const maxVol = Math.max(...(activeData.map(b => b.volume) || [1]));

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-border/15 bg-card/10 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Zap className="h-5 w-5 text-accent" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Lavba</h1>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/50 uppercase hidden sm:block">
                Autonomous Strategy Discovery Engine
              </p>
            </div>
          </div>

          {/* Live Price Ticker */}
          {activeSymbol && price !== null && (
            <div className="flex items-center gap-4 rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm px-4 py-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span className="text-xs font-medium text-foreground tracking-wider">{activeSymbol}</span>
              </div>
              <span className="text-sm font-light text-foreground">${price.toFixed(2)}</span>
              <span className={`text-[11px] font-medium ${change >= 0 ? "text-accent" : "text-destructive"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
              </span>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                <RefreshCw className="h-2.5 w-2.5" />
                <span>30s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* ── Ticker Input ── */}
        <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && fetchData()}
                placeholder="Enter ticker… AAPL, TSLA, BTC-USD, EUR=X, GC=F"
                className="w-full bg-background/30 border border-border/15 rounded-xl pl-9 pr-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={!symbol.trim() || loading}
              className="flex items-center gap-2 rounded-xl bg-accent/15 border border-accent/20 px-5 py-2.5 text-xs font-light text-accent hover:bg-accent/25 transition-all disabled:opacity-30"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Pull Live Data
            </button>
          </div>

          {/* Timeframes */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/30 mr-1" />
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => toggleTimeframe(tf.value)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  selectedTimeframes.includes(tf.value)
                    ? "bg-accent/15 text-accent border border-accent/25"
                    : "bg-background/20 text-muted-foreground/40 border border-border/10 hover:text-muted-foreground hover:border-border/20"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive font-light">{error}</span>
          </div>
        )}

        {/* ── Progress ── */}
        {(loading || analyzing) && (
          <div className="rounded-xl border border-accent/15 bg-accent/5 backdrop-blur-sm p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <div>
              <span className="text-xs font-light text-accent">{progress}</span>
              {analyzing && (
                <p className="text-[10px] text-accent/50 mt-0.5">Aureon is analyzing {activeData.length} candles across {Object.keys(bars).length} timeframe(s)</p>
              )}
            </div>
          </div>
        )}

        {/* ── Main Chart ── */}
        {Object.keys(bars).length > 0 && (
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl overflow-hidden">
            {/* Chart toolbar */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-medium text-foreground tracking-wider">{activeSymbol}</span>
                </div>
                <div className="h-4 w-px bg-border/15" />
                <div className="flex gap-1">
                  {Object.keys(bars).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setActiveChart(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        activeChart === tf
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground/35 hover:text-muted-foreground"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="h-4 w-px bg-border/15" />
                <span className="text-[10px] text-muted-foreground/30">
                  {activeData.length} bars
                </span>
              </div>

              <div className="flex items-center gap-3">
                {lastBar && (
                  <span className={`text-[11px] font-medium ${totalChange >= 0 ? "text-accent" : "text-destructive"}`}>
                    {totalChange >= 0 ? "▲" : "▼"} {Math.abs(totalChange).toFixed(2)}%
                  </span>
                )}
                <button
                  onClick={discoverPatterns}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 rounded-lg bg-accent/15 border border-accent/20 px-3 py-1.5 text-[11px] font-light text-accent hover:bg-accent/25 transition-all disabled:opacity-30"
                >
                  {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Discover Patterns
                </button>
              </div>
            </div>

            {/* Price Chart */}
            <div className="px-2 pt-3 pb-1">
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} barGap={0} barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.08)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.3)" }}
                      interval={Math.max(1, Math.floor(chartData.length / 10))}
                      axisLine={{ stroke: "hsl(var(--border) / 0.1)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.3)" }}
                      width={65}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${v.toFixed(v > 100 ? 0 : 2)}`}
                    />
                    <Tooltip content={<CandleTooltip />} />

                    {/* Pattern zone overlays */}
                    {activePatternZones.map((zone, i) => (
                      <ReferenceArea
                        key={`zone-${i}`}
                        x1={chartData[Math.min(zone.startIdx, chartData.length - 1)]?.date}
                        x2={chartData[Math.min(zone.endIdx, chartData.length - 1)]?.date}
                        fill={zone.type === "bullish" ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
                        fillOpacity={0.06}
                        stroke={zone.type === "bullish" ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
                        strokeOpacity={0.2}
                        strokeDasharray="4 2"
                        label={{
                          value: zone.name,
                          position: "insideTop",
                          fill: zone.type === "bullish" ? "hsl(var(--accent))" : "hsl(var(--destructive))",
                          fontSize: 8,
                          opacity: 0.6,
                        }}
                      />
                    ))}

                    {/* High/Low range (wick) */}
                    <Line type="monotone" dataKey="high" stroke="hsl(var(--muted-foreground) / 0.08)" strokeWidth={0.5} dot={false} />
                    <Line type="monotone" dataKey="low" stroke="hsl(var(--muted-foreground) / 0.08)" strokeWidth={0.5} dot={false} />

                    {/* Close price line */}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="hsl(var(--accent))"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: "hsl(var(--accent))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Volume Chart */}
            <div className="px-2 pb-2">
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={60}>
                  <ComposedChart data={chartData} barGap={0} barCategoryGap="10%">
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, maxVol * 1.5]} />
                    <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={`vol-${i}`}
                          fill={entry.bullish ? "hsl(var(--accent) / 0.25)" : "hsl(var(--destructive) / 0.2)"}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-1.5 px-3 pb-1">
                <Volume2 className="h-2.5 w-2.5 text-muted-foreground/20" />
                <span className="text-[9px] text-muted-foreground/20">Volume</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Discovered Strategies ── */}
        {patterns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent/60" />
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
                Aureon Discovered {patterns.length} Novel Strategies
              </p>
            </div>

            {patterns.map(pattern => (
              <div
                key={pattern.id}
                className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5"
              >
                {/* Pattern Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-3.5 w-3.5 text-accent" />
                      <h3 className="text-sm font-light text-foreground tracking-wide">{pattern.name}</h3>
                    </div>
                    <p className="text-[11px] font-extralight text-muted-foreground/60 leading-relaxed">
                      {pattern.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/15 px-2.5 py-1 shrink-0 ml-3">
                    <BarChart3 className="h-3 w-3 text-accent" />
                    <span className="text-[10px] text-accent font-medium">
                      {Math.round((pattern.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Occurrences", value: pattern.occurrences?.toString() || "—", color: "text-foreground" },
                    {
                      label: "Win Rate",
                      value: pattern.winRate ? `${Math.round(pattern.winRate * 100)}%` : "—",
                      color: (pattern.winRate || 0) >= 0.6 ? "text-accent" : "text-muted-foreground",
                    },
                    {
                      label: "Avg Return",
                      value: pattern.avgReturn ? `${pattern.avgReturn > 0 ? "+" : ""}${pattern.avgReturn.toFixed(1)}%` : "—",
                      color: (pattern.avgReturn || 0) > 0 ? "text-accent" : "text-destructive",
                    },
                    { label: "R:R", value: pattern.riskReward || "—", color: "text-foreground" },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl bg-background/20 border border-border/10 p-2.5 text-center">
                      <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">{stat.label}</p>
                      <p className={`text-sm font-light mt-0.5 ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Entry & Exit Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pattern.entryRules?.length > 0 && (
                    <div className="rounded-xl bg-accent/[0.03] border border-accent/10 p-3">
                      <p className="text-[9px] font-light tracking-[0.1em] text-accent/60 uppercase mb-2">
                        Entry Rules
                      </p>
                      <div className="space-y-1.5">
                        {pattern.entryRules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3 w-3 text-accent/40 mt-0.5 shrink-0" />
                            <span className="text-[11px] font-extralight text-muted-foreground/70">{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pattern.exitRules?.length > 0 && (
                    <div className="rounded-xl bg-destructive/[0.03] border border-destructive/10 p-3">
                      <p className="text-[9px] font-light tracking-[0.1em] text-destructive/60 uppercase mb-2">
                        Exit Rules
                      </p>
                      <div className="space-y-1.5">
                        {pattern.exitRules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3 w-3 text-destructive/40 mt-0.5 shrink-0" />
                            <span className="text-[11px] font-extralight text-muted-foreground/70">{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {Object.keys(bars).length === 0 && !loading && (
          <div className="text-center py-20 space-y-5">
            <div className="relative inline-block">
              <Zap className="h-12 w-12 text-muted-foreground/8 mx-auto" />
              <Activity className="h-5 w-5 text-accent/15 absolute -top-1 -right-2" />
            </div>
            <div>
              <p className="text-sm font-extralight text-muted-foreground/25 tracking-wide">
                Enter a ticker symbol to begin
              </p>
              <p className="text-[10px] font-extralight text-muted-foreground/12 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Aureon pulls real-time market data and scans for repeating fractal patterns across all timeframes — discovering novel strategies invisible to the human eye
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LavbaView;
