import { useState, useCallback, useRef, useEffect } from "react";
import {
  Loader2, Play, Pause, SkipForward, BarChart3, Target, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle, XCircle, Brain, RotateCcw,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { streamChat } from "@/lib/ai";

interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestTrade {
  id: number;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  entryIdx: number;
  exitIdx: number;
  exitPrice: number;
  result: "WIN" | "LOSS";
  pnlPct: number;
  reasoning: string;
  mistakeAnalysis?: string;
}

interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
}

interface LavbaBacktestProps {
  data: ChartBar[];
  symbol: string;
  patterns: { name: string; description: string; entryRules: string[]; exitRules: string[] }[];
}

const fmt = (v: number) => {
  if (Math.abs(v) >= 10000) return v.toFixed(0);
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

/* ── Mini chart for a single trade ── */
const TradeMiniChart = ({ data, trade }: { data: ChartBar[]; trade: BacktestTrade }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pad = 6;
  const from = Math.max(0, trade.entryIdx - pad);
  const to = Math.min(data.length - 1, trade.exitIdx + pad);
  const slice = data.slice(from, to + 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || slice.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 180, h = 60;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    let minP = Infinity, maxP = -Infinity;
    for (const b of slice) { if (b.low < minP) minP = b.low; if (b.high > maxP) maxP = b.high; }
    const range = maxP - minP || 1;
    minP -= range * 0.08; maxP += range * 0.08;
    const totalR = maxP - minP;

    const py = (p: number) => 4 + (1 - (p - minP) / totalR) * (h - 8);
    const barW = (w - 4) / slice.length;
    const candleW = Math.max(1, barW * 0.55);
    const bx = (i: number) => 2 + i * barW + barW / 2;

    ctx.clearRect(0, 0, w, h);

    // Entry/exit zone
    const entryI = trade.entryIdx - from;
    const exitI = trade.exitIdx - from;
    const zx1 = bx(Math.max(0, entryI)) - barW / 2;
    const zx2 = bx(Math.min(slice.length - 1, exitI)) + barW / 2;
    ctx.fillStyle = trade.result === "WIN" ? "rgba(212,168,67,0.08)" : "rgba(200,200,220,0.08)";
    ctx.fillRect(zx1, 0, zx2 - zx1, h);

    // Entry line
    const entryY = py(trade.entry);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(0, entryY); ctx.lineTo(w, entryY); ctx.stroke(); ctx.setLineDash([]);

    // SL line
    const slY = py(trade.stopLoss);
    ctx.strokeStyle = "rgba(200,200,220,0.25)"; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(0, slY); ctx.lineTo(w, slY); ctx.stroke(); ctx.setLineDash([]);

    // TP line
    const tpY = py(trade.takeProfit);
    ctx.strokeStyle = "rgba(212,168,67,0.25)"; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(0, tpY); ctx.lineTo(w, tpY); ctx.stroke(); ctx.setLineDash([]);

    // Candles
    for (let i = 0; i < slice.length; i++) {
      const b = slice[i], x = bx(i), bull = b.close >= b.open;
      const color = bull ? "#d4a843" : "rgba(200,200,220,0.7)";
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, py(b.high)); ctx.lineTo(x, py(b.low)); ctx.stroke();
      const bT = py(Math.max(b.open, b.close)), bB = py(Math.min(b.open, b.close)), bH = Math.max(1, bB - bT);
      ctx.fillStyle = color; ctx.fillRect(x - candleW / 2, bT, candleW, bH);
    }

    // Entry marker
    if (entryI >= 0 && entryI < slice.length) {
      const ex = bx(entryI);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, entryY, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Exit marker
    if (exitI >= 0 && exitI < slice.length) {
      const ex2 = bx(exitI);
      ctx.fillStyle = trade.result === "WIN" ? "#d4a843" : "rgba(200,200,220,0.8)";
      ctx.beginPath(); ctx.arc(ex2, py(trade.exitPrice), 3, 0, Math.PI * 2); ctx.fill();
    }
  }, [slice, trade]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-border/10 bg-background/20"
      style={{ width: 180, height: 60 }}
    />
  );
};

const LavbaBacktest = ({ data, symbol, patterns }: LavbaBacktestProps) => {
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [running, setRunning] = useState(false);
  const [currentTradeIdx, setCurrentTradeIdx] = useState(0);
  const [progress, setProgress] = useState("");
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [lessons, setLessons] = useState<string[]>([]);
  const abortRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const stats: BacktestStats | null = trades.length > 0 ? (() => {
    const wins = trades.filter(t => t.result === "WIN");
    const losses = trades.filter(t => t.result === "LOSS");
    const winPnls = wins.map(t => t.pnlPct);
    const lossPnls = losses.map(t => t.pnlPct);
    const totalPnl = trades.reduce((s, t) => s + t.pnlPct, 0);
    const grossWin = winPnls.reduce((s, v) => s + v, 0);
    const grossLoss = Math.abs(lossPnls.reduce((s, v) => s + v, 0));

    // Max drawdown
    let peak = 0, dd = 0, maxDd = 0;
    let equity = 0;
    for (const t of trades) {
      equity += t.pnlPct;
      if (equity > peak) peak = equity;
      dd = peak - equity;
      if (dd > maxDd) maxDd = dd;
    }

    return {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: wins.length / trades.length,
      totalPnl,
      avgWin: winPnls.length > 0 ? grossWin / winPnls.length : 0,
      avgLoss: lossPnls.length > 0 ? grossLoss / lossPnls.length : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      maxDrawdown: maxDd,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnlPct)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnlPct)) : 0,
    };
  })() : null;

  const runBacktest = useCallback(async () => {
    if (data.length < 50 || patterns.length === 0) return;
    setRunning(true);
    setTrades([]);
    setLessons([]);
    setCurrentTradeIdx(0);
    abortRef.current = false;

    const patternContext = patterns.map(p =>
      `Pattern: ${p.name}\nDescription: ${p.description}\nEntry Rules: ${p.entryRules.join("; ")}\nExit Rules: ${p.exitRules.join("; ")}`
    ).join("\n\n");

    // Walk through data in chunks, finding trades one at a time
    const windowSize = 60;
    const stepSize = 20;
    let cursor = windowSize;
    let tradeCount = 0;
    const accumulatedLessons: string[] = [];
    const accumulatedTrades: BacktestTrade[] = [];

    while (cursor < data.length - 10 && !abortRef.current && tradeCount < 20) {
      const windowStart = Math.max(0, cursor - windowSize);
      const windowEnd = cursor;
      const window = data.slice(windowStart, windowEnd);
      const futureEnd = Math.min(data.length, cursor + 30);
      const future = data.slice(cursor, futureEnd);

      if (window.length < 20 || future.length < 5) { cursor += stepSize; continue; }

      const windowSummary = window.map(b =>
        `${b.date.slice(0, 10)},O:${b.open.toFixed(2)},H:${b.high.toFixed(2)},L:${b.low.toFixed(2)},C:${b.close.toFixed(2)},V:${b.volume}`
      ).join("\n");

      const futureSummary = future.map(b =>
        `${b.date.slice(0, 10)},O:${b.open.toFixed(2)},H:${b.high.toFixed(2)},L:${b.low.toFixed(2)},C:${b.close.toFixed(2)},V:${b.volume}`
      ).join("\n");

      // Build lessons from past mistakes
      const lessonsCtx = accumulatedLessons.length > 0
        ? `\n\nLESSONS FROM PAST MISTAKES (DO NOT REPEAT THESE):\n${accumulatedLessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}`
        : "";

      const pastTradesCtx = accumulatedTrades.length > 0
        ? `\n\nPAST TRADES THIS SESSION:\n${accumulatedTrades.map(t =>
          `Trade #${t.id}: ${t.direction} entry $${fmt(t.entry)} → ${t.result} (${t.pnlPct > 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%)`
        ).join("\n")}`
        : "";

      setProgress(`Aureon analyzing trade opportunity ${tradeCount + 1} at bar ${cursor}/${data.length}…`);
      setCurrentTradeIdx(tradeCount);

      const prompt = `You are Aureon — backtesting your own discovered strategies on historical data. You MUST be brutally honest about whether a trade setup exists.

SYMBOL: ${symbol}
DISCOVERED STRATEGIES:
${patternContext}
${lessonsCtx}
${pastTradesCtx}

HISTORICAL WINDOW (bars ${windowStart}-${windowEnd}):
${windowSummary}

FUTURE DATA (what actually happened next — use this to determine the trade outcome):
${futureSummary}

TASK: Look at the end of the historical window. Is there a valid trade setup based on your discovered patterns?

If YES — simulate the trade:
1. Determine direction (LONG/SHORT), entry price, stop loss, take profit
2. Walk forward through the FUTURE DATA to see if SL or TP was hit first
3. Calculate exact PnL %
4. If it was a LOSS, explain EXACTLY what went wrong and what you should have seen differently

If NO valid setup — respond with {"skip": true}

Return ONLY valid JSON:
{"skip": false, "direction": "LONG", "entry": 95000, "stopLoss": 93500, "takeProfit": 97500, "entryBarDate": "2024-01-15", "exitBarDate": "2024-01-20", "exitPrice": 97500, "result": "WIN", "pnlPct": 2.62, "reasoning": "Pattern X formed at bars 45-55...", "mistakeAnalysis": "Only if LOSS — what went wrong and lesson learned"}`;

      let result = "";
      try {
        await streamChat({
          messages: [{ role: "user", content: prompt }],
          mode: "research",
          onDelta: (chunk) => { result += chunk; },
          onDone: () => {},
        });

        const objMatch = result.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const parsed = JSON.parse(objMatch[0]);
          if (!parsed.skip) {
            tradeCount++;
            // Find bar indices by date
            const entryIdx = data.findIndex(b => b.date.includes(parsed.entryBarDate)) || cursor;
            const exitIdx = data.findIndex(b => b.date.includes(parsed.exitBarDate)) || cursor + 5;

            const trade: BacktestTrade = {
              id: tradeCount,
              direction: parsed.direction || "LONG",
              entry: parsed.entry || window[window.length - 1].close,
              stopLoss: parsed.stopLoss || 0,
              takeProfit: parsed.takeProfit || 0,
              entryIdx: entryIdx >= 0 ? entryIdx : cursor,
              exitIdx: exitIdx >= 0 ? exitIdx : cursor + 5,
              exitPrice: parsed.exitPrice || 0,
              result: parsed.result === "WIN" ? "WIN" : "LOSS",
              pnlPct: parsed.pnlPct || 0,
              reasoning: parsed.reasoning || "",
              mistakeAnalysis: parsed.mistakeAnalysis || undefined,
            };

            accumulatedTrades.push(trade);
            setTrades(prev => [...prev, trade]);

            // If loss, accumulate lesson
            if (trade.result === "LOSS" && trade.mistakeAnalysis) {
              accumulatedLessons.push(trade.mistakeAnalysis);
              setLessons(prev => [...prev, trade.mistakeAnalysis!]);
            }

            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 200);
          }
        }
      } catch (e) {
        console.error("Backtest trade error:", e);
      }

      cursor += stepSize + (tradeCount > 0 ? 5 : 0);
    }

    setRunning(false);
    setProgress("");
  }, [data, symbol, patterns]);

  const stopBacktest = () => { abortRef.current = true; };

  if (data.length < 50) return null;

  return (
    <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-light text-foreground tracking-wide">Aureon Backtester</h3>
          <span className="text-[9px] text-muted-foreground/40 bg-background/20 rounded px-1.5 py-0.5">
            {data.length} bars
          </span>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button
              onClick={stopBacktest}
              className="flex items-center gap-1.5 rounded-lg bg-destructive/15 border border-destructive/20 px-3 py-1.5 text-[11px] font-light text-destructive hover:bg-destructive/25 transition-all"
            >
              <Pause className="h-3 w-3" /> Stop
            </button>
          ) : (
            <button
              onClick={runBacktest}
              disabled={patterns.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-accent/15 border border-accent/20 px-3 py-1.5 text-[11px] font-light text-accent hover:bg-accent/25 transition-all disabled:opacity-30"
            >
              <Play className="h-3 w-3" /> Run Backtest
            </button>
          )}
          {trades.length > 0 && !running && (
            <button
              onClick={() => { setTrades([]); setLessons([]); }}
              className="flex items-center gap-1 rounded-lg bg-background/20 border border-border/10 px-2.5 py-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-all"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {running && (
        <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 mb-4 flex items-center gap-3">
          <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />
          <div className="flex-1">
            <p className="text-[11px] font-light text-accent">{progress}</p>
            <div className="mt-1.5 h-1 rounded-full bg-background/30 overflow-hidden">
              <div
                className="h-full bg-accent/40 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (currentTradeIdx / 20) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-accent/60">{trades.length} trades found</span>
        </div>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <div className="mb-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            {[
              { label: "Win Rate", value: `${Math.round(stats.winRate * 100)}%`, color: stats.winRate >= 0.5 ? "text-accent" : "text-destructive" },
              { label: "Total P&L", value: `${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(1)}%`, color: stats.totalPnl >= 0 ? "text-accent" : "text-destructive" },
              { label: "Trades", value: `${stats.wins}W / ${stats.losses}L`, color: "text-foreground" },
              { label: "Avg Win", value: `+${stats.avgWin.toFixed(1)}%`, color: "text-accent" },
              { label: "Avg Loss", value: `-${stats.avgLoss.toFixed(1)}%`, color: "text-destructive" },
              { label: "Profit Factor", value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1.5 ? "text-accent" : "text-muted-foreground" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl bg-background/20 border border-border/10 p-2 text-center">
                <p className="text-[7px] text-muted-foreground/40 uppercase tracking-[0.1em]">{s.label}</p>
                <p className={`text-sm font-light mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Equity curve mini */}
          <EquityCurve trades={trades} />

          {/* Additional stats row */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="rounded-xl bg-background/20 border border-border/10 p-2 text-center">
              <p className="text-[7px] text-muted-foreground/40 uppercase tracking-[0.1em]">Max Drawdown</p>
              <p className="text-sm font-light mt-0.5 text-destructive">-{stats.maxDrawdown.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl bg-background/20 border border-border/10 p-2 text-center">
              <p className="text-[7px] text-muted-foreground/40 uppercase tracking-[0.1em]">Best Trade</p>
              <p className="text-sm font-light mt-0.5 text-accent">+{stats.bestTrade.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl bg-background/20 border border-border/10 p-2 text-center">
              <p className="text-[7px] text-muted-foreground/40 uppercase tracking-[0.1em]">Worst Trade</p>
              <p className="text-sm font-light mt-0.5 text-destructive">{stats.worstTrade.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Lessons Learned */}
      {lessons.length > 0 && (
        <div className="rounded-xl bg-destructive/[0.03] border border-destructive/10 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3 w-3 text-destructive/60" />
            <p className="text-[9px] font-light tracking-[0.1em] text-destructive/60 uppercase">
              Aureon's Lessons Learned ({lessons.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {lessons.map((lesson, i) => (
              <div key={i} className="flex items-start gap-2">
                <XCircle className="h-3 w-3 text-destructive/40 mt-0.5 shrink-0" />
                <span className="text-[10px] font-extralight text-muted-foreground/60 leading-relaxed">{lesson}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade-by-Trade Results */}
      {trades.length > 0 && (
        <div ref={resultsRef} className="space-y-2">
          <p className="text-[9px] font-light tracking-[0.1em] text-muted-foreground/50 uppercase mb-2">
            Trade Log — {trades.length} Executed
          </p>
          {trades.map(trade => (
            <div
              key={trade.id}
              className={`rounded-xl border backdrop-blur-sm transition-all ${
                trade.result === "WIN"
                  ? "border-accent/15 bg-accent/[0.03]"
                  : "border-destructive/15 bg-destructive/[0.03]"
              }`}
            >
              {/* Trade header */}
              <button
                onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium ${
                    trade.result === "WIN"
                      ? "bg-accent/12 text-accent"
                      : "bg-destructive/12 text-destructive"
                  }`}>
                    {trade.result === "WIN" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {trade.result}
                  </div>
                  <span className="text-[10px] text-muted-foreground/50">#{trade.id}</span>
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${
                    trade.direction === "LONG" ? "text-accent" : "text-muted-foreground"
                  }`}>
                    {trade.direction === "LONG" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trade.direction}
                  </div>
                  <span className="text-[10px] text-muted-foreground/40">
                    ${fmt(trade.entry)} → ${fmt(trade.exitPrice)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${trade.pnlPct >= 0 ? "text-accent" : "text-destructive"}`}>
                    {trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%
                  </span>
                  {expandedTrade === trade.id ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />}
                </div>
              </button>

              {/* Expanded details */}
              {expandedTrade === trade.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/10 pt-3">
                  <div className="flex items-start gap-3">
                    <TradeMiniChart data={data} trade={trade} />
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="rounded-lg bg-background/20 border border-border/10 p-1.5 text-center">
                          <p className="text-[7px] text-muted-foreground/40 uppercase">Entry</p>
                          <p className="text-[10px] font-light text-foreground">${fmt(trade.entry)}</p>
                        </div>
                        <div className="rounded-lg bg-background/20 border border-border/10 p-1.5 text-center">
                          <p className="text-[7px] text-muted-foreground/40 uppercase">SL</p>
                          <p className="text-[10px] font-light text-destructive">${fmt(trade.stopLoss)}</p>
                        </div>
                        <div className="rounded-lg bg-background/20 border border-border/10 p-1.5 text-center">
                          <p className="text-[7px] text-muted-foreground/40 uppercase">TP</p>
                          <p className="text-[10px] font-light text-accent">${fmt(trade.takeProfit)}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-background/10 border border-border/10 p-2">
                        <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mb-1">Reasoning</p>
                        <p className="text-[10px] font-extralight text-muted-foreground/60 leading-relaxed">{trade.reasoning}</p>
                      </div>
                    </div>
                  </div>

                  {trade.mistakeAnalysis && (
                    <div className="rounded-lg bg-destructive/[0.04] border border-destructive/10 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3 w-3 text-destructive/50" />
                        <p className="text-[8px] font-medium text-destructive/60 uppercase tracking-wider">What Went Wrong</p>
                      </div>
                      <p className="text-[10px] font-extralight text-muted-foreground/60 leading-relaxed">{trade.mistakeAnalysis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!running && trades.length === 0 && patterns.length > 0 && (
        <div className="text-center py-8">
          <BarChart3 className="h-8 w-8 text-muted-foreground/10 mx-auto mb-3" />
          <p className="text-[11px] font-extralight text-muted-foreground/30">
            Run backtest to validate Aureon's strategies against historical data
          </p>
          <p className="text-[9px] font-extralight text-muted-foreground/15 mt-1">
            Aureon will simulate trades one at a time, learn from mistakes, and show you its real win rate
          </p>
        </div>
      )}

      {patterns.length === 0 && (
        <div className="text-center py-6">
          <p className="text-[11px] font-extralight text-muted-foreground/25">
            Discover patterns first, then backtest them
          </p>
        </div>
      )}
    </div>
  );
};

/* ── Equity curve ── */
const EquityCurve = ({ trades }: { trades: BacktestTrade[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trades.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 400;
    const h = 50;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Build equity points
    const points: number[] = [0];
    let eq = 0;
    for (const t of trades) { eq += t.pnlPct; points.push(eq); }

    const minE = Math.min(...points);
    const maxE = Math.max(...points);
    const range = maxE - minE || 1;
    const py = (v: number) => 4 + (1 - (v - minE + range * 0.1) / (range * 1.2)) * (h - 8);
    const px = (i: number) => (i / (points.length - 1)) * (w - 8) + 4;

    ctx.clearRect(0, 0, w, h);

    // Zero line
    const zeroY = py(0);
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke(); ctx.setLineDash([]);

    // Equity line
    ctx.beginPath(); ctx.strokeStyle = points[points.length - 1] >= 0 ? "#d4a843" : "rgba(200,200,220,0.7)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < points.length; i++) {
      const x = px(i), y = py(points[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill
    ctx.lineTo(px(points.length - 1), py(0));
    ctx.lineTo(px(0), py(0));
    ctx.closePath();
    ctx.fillStyle = points[points.length - 1] >= 0 ? "rgba(212,168,67,0.08)" : "rgba(200,200,220,0.05)";
    ctx.fill();

    // Dot markers
    for (let i = 1; i < points.length; i++) {
      const t = trades[i - 1];
      ctx.fillStyle = t.result === "WIN" ? "#d4a843" : "rgba(200,200,220,0.7)";
      ctx.beginPath(); ctx.arc(px(i), py(points[i]), 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }, [trades]);

  return (
    <div className="rounded-xl bg-background/10 border border-border/10 p-2">
      <p className="text-[7px] text-muted-foreground/30 uppercase tracking-wider mb-1">Equity Curve</p>
      <canvas ref={canvasRef} style={{ height: 50 }} className="w-full" />
    </div>
  );
};

export default LavbaBacktest;
