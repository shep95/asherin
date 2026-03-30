import { useState, useCallback } from "react";
import { Loader2, Search, Sparkles, TrendingUp, Clock, BarChart3, Target, AlertTriangle, ArrowRight, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
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

const LavbaView = () => {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState("");
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["1d"]);
  const [bars, setBars] = useState<Record<string, ChartBar[]>>({});
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([]);
  const [activeChart, setActiveChart] = useState<string>("1d");
  const [error, setError] = useState("");

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

    const results: Record<string, ChartBar[]> = {};

    for (const tf of selectedTimeframes) {
      try {
        setProgress(`Fetching ${symbol.toUpperCase()} ${tf} data…`);
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

    // Compress bar data for prompt
    const barSummaries = allBars.map(([tf, data]) => {
      const sampled = data.length > 200
        ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0)
        : data;
      return `[${tf} — ${data.length} bars]\n${sampled.map(b =>
        `${b.date.slice(0, 10)},O:${b.open.toFixed(2)},H:${b.high.toFixed(2)},L:${b.low.toFixed(2)},C:${b.close.toFixed(2)},V:${b.volume}`
      ).join("\n")}`;
    }).join("\n\n");

    const prompt = `You are Aureon's Strategy Discovery Engine — a quantitative pattern recognition system specialized in finding repeating price action patterns across multiple timeframes.

SYMBOL: ${symbol.toUpperCase()}
TIMEFRAMES ANALYZED: ${Object.keys(bars).join(", ")}

HISTORICAL OHLCV DATA:
${barSummaries}

MISSION: Analyze this historical price data to discover 2-4 REPEATING patterns that could form the basis of a novel trading strategy. These should NOT be standard textbook patterns (head & shoulders, double top, etc). Find UNIQUE fractal structures.

For each discovered pattern:
1. Name it something original (e.g., "The Coiled Serpent", "Phase Shift Reversal")
2. Describe the exact price structure
3. Count how many times it has occurred historically
4. Calculate approximate win rate and average return
5. Define precise entry and exit rules
6. Mark the approximate bar index ranges where the pattern appeared (use startIdx/endIdx relative to the data)
7. Rate your confidence 0-1

Return ONLY valid JSON array:
[{
  "name": "Pattern Name",
  "description": "Detailed description of the price structure and what causes it",
  "occurrences": 12,
  "winRate": 0.75,
  "avgReturn": 3.2,
  "riskReward": "1:2.5",
  "timeframe": "1d",
  "entryRules": ["Rule 1", "Rule 2"],
  "exitRules": ["Stop loss rule", "Take profit rule"],
  "patternZones": [{"startIdx": 50, "endIdx": 65, "type": "bullish"}],
  "confidence": 0.82
}]

Return ONLY the JSON array, no markdown.`;

    try {
      setProgress("Running fractal pattern recognition across all timeframes…");
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
            setError("Failed to parse pattern analysis results.");
          }
          setAnalyzing(false);
          setProgress("");
        },
      });
    } catch {
      setAnalyzing(false);
      setProgress("");
    }
  }, [bars, symbol]);

  const activeData = bars[activeChart] || [];
  const chartData = activeData.map((b, i) => ({
    idx: i,
    date: b.date.slice(0, 10),
    close: b.close,
    high: b.high,
    low: b.low,
    open: b.open,
  }));

  // Get pattern zones for overlay
  const activePatternZones = patterns
    .flatMap(p => p.patternZones?.map(z => ({ ...z, name: p.name, color: p.patternZones?.[0]?.type === "bullish" ? "hsl(var(--accent))" : "#ef4444" })) || [])
    .filter(z => z.startIdx < chartData.length);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Lavba</h1>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">
                Autonomous Strategy Discovery Engine
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Ticker Input */}
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-6">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-3">
            Target Asset
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && fetchData()}
                placeholder="Enter ticker… AAPL, TSLA, BTC-USD, EUR=X"
                className="w-full bg-card/30 border border-border/20 rounded-xl pl-9 pr-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={!symbol.trim() || loading}
              className="flex items-center gap-2 rounded-xl bg-accent/20 px-5 py-2.5 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Pull Data
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[10px] text-muted-foreground/50 self-center mr-1">
              <Clock className="h-3 w-3 inline mr-1" />Timeframes:
            </span>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => toggleTimeframe(tf.value)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  selectedTimeframes.includes(tf.value)
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-card/30 text-muted-foreground/50 border border-border/10 hover:text-foreground"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive">{error}</span>
          </div>
        )}

        {/* Progress */}
        {(loading || analyzing) && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <span className="text-xs font-light text-accent">{progress}</span>
          </div>
        )}

        {/* Chart + Data Summary */}
        {Object.keys(bars).length > 0 && (
          <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">
                  Historical Price Data — {symbol}
                </p>
                <div className="flex gap-2 mt-2">
                  {Object.keys(bars).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setActiveChart(tf)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
                        activeChart === tf
                          ? "bg-accent/20 text-accent"
                          : "text-muted-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {tf} ({bars[tf]?.length || 0})
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={discoverPatterns}
                disabled={analyzing}
                className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Discover Patterns
              </button>
            </div>

            {/* Price chart with pattern overlays */}
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                    interval={Math.max(1, Math.floor(chartData.length / 12))}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                  />
                  {/* Pattern zone overlays */}
                  {activePatternZones.map((zone, i) => (
                    <ReferenceArea
                      key={`zone-${i}`}
                      x1={chartData[Math.min(zone.startIdx, chartData.length - 1)]?.date}
                      x2={chartData[Math.min(zone.endIdx, chartData.length - 1)]?.date}
                      fill={zone.type === "bullish" ? "hsl(var(--accent))" : "#ef4444"}
                      fillOpacity={0.08}
                      stroke={zone.type === "bullish" ? "hsl(var(--accent))" : "#ef4444"}
                      strokeOpacity={0.3}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(var(--accent))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="high"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={0.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="low"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={0.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Discovered Strategies */}
        {patterns.length > 0 && (
          <div className="space-y-4">
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">
              Discovered Strategies — {patterns.length} Patterns Found
            </p>

            {patterns.map(pattern => (
              <div
                key={pattern.id}
                className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 sm:p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-accent" />
                      <h3 className="text-sm font-light text-foreground">{pattern.name}</h3>
                    </div>
                    <p className="text-xs font-light text-muted-foreground leading-relaxed">
                      {pattern.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 shrink-0 ml-3">
                    <BarChart3 className="h-3 w-3 text-accent" />
                    <span className="text-[10px] text-accent font-medium">
                      {Math.round((pattern.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg bg-card/30 border border-border/10 p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Occurrences</p>
                    <p className="text-sm font-light text-foreground mt-0.5">{pattern.occurrences || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-card/30 border border-border/10 p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Win Rate</p>
                    <p className={`text-sm font-light mt-0.5 ${(pattern.winRate || 0) >= 0.6 ? "text-green-400" : "text-amber-400"}`}>
                      {pattern.winRate ? `${Math.round(pattern.winRate * 100)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card/30 border border-border/10 p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Avg Return</p>
                    <p className={`text-sm font-light mt-0.5 ${(pattern.avgReturn || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                      {pattern.avgReturn ? `${pattern.avgReturn > 0 ? "+" : ""}${pattern.avgReturn.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card/30 border border-border/10 p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">R:R Ratio</p>
                    <p className="text-sm font-light text-foreground mt-0.5">{pattern.riskReward || "—"}</p>
                  </div>
                </div>

                {/* Entry & Exit Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pattern.entryRules && pattern.entryRules.length > 0 && (
                    <div>
                      <p className="text-[9px] font-light tracking-[0.1em] text-green-400/70 uppercase mb-1.5">
                        Entry Rules
                      </p>
                      <div className="space-y-1">
                        {pattern.entryRules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3 w-3 text-green-400/50 mt-0.5 shrink-0" />
                            <span className="text-[11px] font-light text-muted-foreground">{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pattern.exitRules && pattern.exitRules.length > 0 && (
                    <div>
                      <p className="text-[9px] font-light tracking-[0.1em] text-red-400/70 uppercase mb-1.5">
                        Exit Rules
                      </p>
                      <div className="space-y-1">
                        {pattern.exitRules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className="h-3 w-3 text-red-400/50 mt-0.5 shrink-0" />
                            <span className="text-[11px] font-light text-muted-foreground">{rule}</span>
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

        {/* Empty state */}
        {Object.keys(bars).length === 0 && !loading && (
          <div className="text-center py-16 space-y-4">
            <Zap className="h-10 w-10 text-muted-foreground/10 mx-auto" />
            <div>
              <p className="text-sm font-extralight text-muted-foreground/30">
                Enter a ticker symbol and select timeframes
              </p>
              <p className="text-[10px] font-extralight text-muted-foreground/15 mt-1">
                Aureon will scan historical data for repeating fractal patterns and generate novel strategies
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LavbaView;
