import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Loader2, Search, Sparkles, TrendingUp, Clock, BarChart3, Target,
  AlertTriangle, ArrowRight, Zap, Activity, DollarSign, Volume2, RefreshCw,
  CandlestickChart, LineChart, Minus, Plus, ChevronLeft, ChevronRight,
} from "lucide-react";
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

type ChartType = "candle" | "line" | "ohlc";

/* ── Get auth token helper ── */
const getAuthHeaders = async () => {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
    }
  } catch { /* fallback */ }
  return { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
};

/* ── Live price ticker (visibility-aware) ── */
const useLivePrice = (symbol: string, enabled: boolean) => {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [changePct, setChangePct] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!enabled || !symbol) return;
    let cancelled = false;

    const fetchLive = async () => {
      // Don't poll when tab is hidden
      if (document.hidden) return;
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lavba-fetch-data`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ symbol, interval: "5m" }),
          }
        );
        if (!resp.ok || cancelled) return;
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
    intervalRef.current = setInterval(fetchLive, 30000);
    return () => { cancelled = true; clearInterval(intervalRef.current); };
  }, [symbol, enabled]);

  return { price, change, changePct };
};

/* ── format price ── */
const fmt = (v: number) => {
  if (v >= 10000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

/* ──────────── CANVAS CANDLESTICK CHART ──────────── */
interface CandleChartProps {
  data: ChartBar[];
  chartType: ChartType;
  patternZones: { startIdx: number; endIdx: number; type: "bullish" | "bearish"; name: string }[];
}

const CandleChart = ({ data, chartType, patternZones }: CandleChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewStart, setViewStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(100);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, viewStart: 0 });
  const [containerSize, setContainerSize] = useState({ w: 800, h: 400 });

  // Initialize view to show latest bars
  useEffect(() => {
    if (data.length > 0) {
      setViewStart(Math.max(0, data.length - visibleCount));
    }
  }, [data.length]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerSize.w;
    const h = containerSize.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const priceH = h * 0.75;
    const volH = h * 0.18;
    const volTop = priceH + h * 0.04;
    const padR = 70;
    const padL = 10;
    const chartW = w - padL - padR;

    // Get visible slice
    const end = Math.min(viewStart + visibleCount, data.length);
    const start = Math.max(0, end - visibleCount);
    const visible = data.slice(start, end);
    if (visible.length === 0) return;

    // Price range
    let minP = Infinity, maxP = -Infinity, maxV = 0;
    for (const b of visible) {
      if (b.low < minP) minP = b.low;
      if (b.high > maxP) maxP = b.high;
      if (b.volume > maxV) maxV = b.volume;
    }
    const pRange = maxP - minP || 1;
    const pPad = pRange * 0.05;
    minP -= pPad;
    maxP += pPad;
    const totalPRange = maxP - minP;

    const priceY = (p: number) => 20 + (1 - (p - minP) / totalPRange) * (priceH - 40);
    const volY = (v: number) => volTop + volH - (v / (maxV || 1)) * (volH - 5);

    const barW = chartW / visible.length;
    const candleW = Math.max(1, barW * 0.65);
    const barX = (i: number) => padL + i * barW + barW / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // CSS variable colors
    const style = getComputedStyle(document.documentElement);
    const bullColor = "#22c55e"; // green
    const bearColor = "#ef4444"; // red
    const gridColor = "rgba(128,128,128,0.08)";
    const textColor = "rgba(128,128,128,0.4)";
    const crosshairColor = "rgba(128,128,128,0.15)";

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    const gridCount = 6;
    for (let i = 0; i <= gridCount; i++) {
      const y = 20 + (i / gridCount) * (priceH - 40);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // Pattern zone overlays
    for (const zone of patternZones) {
      const zs = zone.startIdx - start;
      const ze = zone.endIdx - start;
      if (ze < 0 || zs >= visible.length) continue;
      const x1 = barX(Math.max(0, zs)) - barW / 2;
      const x2 = barX(Math.min(visible.length - 1, ze)) + barW / 2;
      ctx.fillStyle = zone.type === "bullish" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)";
      ctx.fillRect(x1, 20, x2 - x1, priceH - 40);
      ctx.strokeStyle = zone.type === "bullish" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(x1, 20, x2 - x1, priceH - 40);
      ctx.setLineDash([]);
      // Label
      ctx.font = "9px sans-serif";
      ctx.fillStyle = zone.type === "bullish" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
      ctx.fillText(zone.name, x1 + 4, 32);
    }

    // Draw candles/line
    if (chartType === "line") {
      ctx.beginPath();
      ctx.strokeStyle = bullColor;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < visible.length; i++) {
        const x = barX(i);
        const y = priceY(visible[i].close);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Area fill
      const lastX = barX(visible.length - 1);
      ctx.lineTo(lastX, priceH);
      ctx.lineTo(barX(0), priceH);
      ctx.closePath();
      ctx.fillStyle = "rgba(34,197,94,0.04)";
      ctx.fill();
    } else {
      // Candlestick or OHLC
      for (let i = 0; i < visible.length; i++) {
        const b = visible[i];
        const x = barX(i);
        const bullish = b.close >= b.open;
        const color = bullish ? bullColor : bearColor;

        if (chartType === "candle") {
          // Wick
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, priceY(b.high));
          ctx.lineTo(x, priceY(b.low));
          ctx.stroke();

          // Body
          const bodyTop = priceY(Math.max(b.open, b.close));
          const bodyBot = priceY(Math.min(b.open, b.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);

          if (bullish) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - candleW / 2, bodyTop, candleW, bodyH);
            // Hollow body for bullish (or fill — using fill for clarity)
            ctx.fillStyle = color;
            ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
          }
        } else {
          // OHLC bars
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          // Vertical line (high-low)
          ctx.beginPath();
          ctx.moveTo(x, priceY(b.high));
          ctx.lineTo(x, priceY(b.low));
          ctx.stroke();
          // Open tick (left)
          ctx.beginPath();
          ctx.moveTo(x - candleW / 2, priceY(b.open));
          ctx.lineTo(x, priceY(b.open));
          ctx.stroke();
          // Close tick (right)
          ctx.beginPath();
          ctx.moveTo(x, priceY(b.close));
          ctx.lineTo(x + candleW / 2, priceY(b.close));
          ctx.stroke();
        }
      }
    }

    // Volume bars
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i];
      const x = barX(i);
      const bullish = b.close >= b.open;
      const vTop = volY(b.volume);
      const vBot = volTop + volH;
      ctx.fillStyle = bullish ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.15)";
      ctx.fillRect(x - candleW / 2, vTop, candleW, vBot - vTop);
    }

    // Y-axis labels (price)
    ctx.font = "10px sans-serif";
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    for (let i = 0; i <= gridCount; i++) {
      const p = maxP - (i / gridCount) * totalPRange;
      const y = 20 + (i / gridCount) * (priceH - 40);
      ctx.fillText(`$${fmt(p)}`, w - padR + 8, y + 3);
    }

    // X-axis labels (date)
    ctx.textAlign = "center";
    const labelStep = Math.max(1, Math.floor(visible.length / 8));
    for (let i = 0; i < visible.length; i += labelStep) {
      const d = visible[i].date;
      const label = d.length > 10 ? d.slice(5, 10) : d.slice(0, 10);
      ctx.fillText(label, barX(i), priceH + 2);
    }

    // Volume label
    ctx.font = "9px sans-serif";
    ctx.fillStyle = "rgba(128,128,128,0.2)";
    ctx.textAlign = "left";
    ctx.fillText("Vol", padL, volTop - 2);

    // Crosshair on hover
    if (hoveredIdx !== null) {
      const hi = hoveredIdx - start;
      if (hi >= 0 && hi < visible.length) {
        const hb = visible[hi];
        const hx = barX(hi);
        const hy = priceY(hb.close);

        ctx.strokeStyle = crosshairColor;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL, hy);
        ctx.lineTo(w - padR, hy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price label on axis
        ctx.fillStyle = hb.close >= hb.open ? bullColor : bearColor;
        ctx.fillRect(w - padR + 2, hy - 9, padR - 4, 18);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`$${fmt(hb.close)}`, w - padR + 6, hy + 4);

        // OHLCV tooltip
        const bullish = hb.close >= hb.open;
        const tooltipW = 160;
        const tooltipH = 82;
        let tx = hx + 15;
        if (tx + tooltipW > w - padR) tx = hx - tooltipW - 15;
        const ty = 30;

        ctx.fillStyle = "rgba(15,15,20,0.92)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(128,128,128,0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.font = "9px sans-serif";
        ctx.textAlign = "left";
        const dateLabel = hb.date.slice(0, 16).replace("T", " ");
        ctx.fillStyle = "rgba(200,200,200,0.4)";
        ctx.fillText(dateLabel, tx + 8, ty + 14);

        const labels = ["O", "H", "L", "C", "V"];
        const vals = [hb.open, hb.high, hb.low, hb.close, hb.volume];
        labels.forEach((l, i) => {
          const ly = ty + 28 + i * 11;
          ctx.fillStyle = "rgba(200,200,200,0.35)";
          ctx.fillText(l, tx + 8, ly);
          ctx.fillStyle = i === 3 ? (bullish ? bullColor : bearColor) : "rgba(230,230,230,0.7)";
          const vStr = i === 4 ? `${(vals[i] / 1e6).toFixed(1)}M` : `$${fmt(vals[i])}`;
          ctx.textAlign = "right";
          ctx.fillText(vStr, tx + tooltipW - 8, ly);
          ctx.textAlign = "left";
        });
      }
    }
  }, [data, viewStart, visibleCount, hoveredIdx, chartType, containerSize, patternZones]);

  // Mouse handlers for drag + hover
  const getBarIndex = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const padR = 70;
    const padL = 10;
    const chartW = rect.width - padL - padR;
    const end = Math.min(viewStart + visibleCount, data.length);
    const start = Math.max(0, end - visibleCount);
    const visible = end - start;
    const barW = chartW / visible;
    const idx = Math.floor((x - padL) / barW);
    if (idx < 0 || idx >= visible) return null;
    return start + idx;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, viewStart };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const chartW = rect.width - 80;
      const barW = chartW / visibleCount;
      const barShift = Math.round(-dx / barW);
      const newStart = Math.max(0, Math.min(data.length - visibleCount, dragStartRef.current.viewStart + barShift));
      setViewStart(newStart);
    } else {
      setHoveredIdx(getBarIndex(e.clientX));
    }
  };

  const onMouseUp = () => setIsDragging(false);
  const onMouseLeave = () => { setIsDragging(false); setHoveredIdx(null); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setVisibleCount(prev => Math.max(20, prev - 10));
    } else {
      // Zoom out
      setVisibleCount(prev => Math.min(data.length, prev + 10));
    }
  };

  const navigate = (dir: "left" | "right") => {
    const step = Math.max(1, Math.floor(visibleCount * 0.3));
    if (dir === "left") {
      setViewStart(prev => Math.max(0, prev - step));
    } else {
      setViewStart(prev => Math.min(data.length - visibleCount, prev + step));
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 400 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      />
      {/* Navigation buttons */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button onClick={() => navigate("left")} className="rounded-lg bg-card/60 border border-border/15 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <ChevronLeft className="h-3 w-3" />
        </button>
        <button onClick={() => setVisibleCount(prev => Math.max(20, prev - 20))} className="rounded-lg bg-card/60 border border-border/15 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" />
        </button>
        <span className="text-[9px] text-muted-foreground/30 min-w-[60px] text-center">
          {viewStart + 1}–{Math.min(viewStart + visibleCount, data.length)} / {data.length}
        </span>
        <button onClick={() => setVisibleCount(prev => Math.min(data.length, prev + 20))} className="rounded-lg bg-card/60 border border-border/15 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <Minus className="h-3 w-3" />
        </button>
        <button onClick={() => navigate("right")} className="rounded-lg bg-card/60 border border-border/15 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

/* ──────────── MAIN LAVBA VIEW ──────────── */
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
  const [chartType, setChartType] = useState<ChartType>("candle");
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
    const sym = symbol.trim().toUpperCase();
    setActiveSymbol(sym);

    const results: Record<string, ChartBar[]> = {};

    for (const tf of selectedTimeframes) {
      try {
        setProgress(`Pulling ${sym} ${tf} from live market data…`);
        const headers = await getAuthHeaders();
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lavba-fetch-data`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ symbol: sym, interval: tf }),
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        // Update activeSymbol with resolved name from API
        if (data.symbol) setActiveSymbol(data.symbol);
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

    const prompt = `You are Aureon — an elite quantitative pattern recognition engine.

SYMBOL: ${activeSymbol}
TIMEFRAMES: ${Object.keys(bars).join(", ")}

HISTORICAL OHLCV DATA:
${barSummaries}

MISSION: Find 2-4 REPEATING fractal patterns. NOT standard textbook patterns. Find UNIQUE structures from market microstructure, liquidity dynamics, behavioral psychology.

For each pattern provide:
1. Original name
2. Detailed description (market mechanics)
3. Occurrence count from data
4. Win rate and avg return %
5. Entry/exit rules
6. Bar index ranges where pattern appeared
7. Confidence 0-1

Return ONLY valid JSON array:
[{"name":"Pattern Name","description":"...","occurrences":12,"winRate":0.75,"avgReturn":3.2,"riskReward":"1:2.5","timeframe":"1d","entryRules":["..."],"exitRules":["..."],"patternZones":[{"startIdx":50,"endIdx":65,"type":"bullish"}],"confidence":0.82}]`;

    try {
      setProgress("Running Aureon fractal analysis…");
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

  // Pattern zone overlay data
  const activePatternZones = useMemo(() => patterns
    .flatMap(p => p.patternZones?.map(z => ({
      ...z,
      name: p.name,
    })) || []), [patterns]);

  const lastBar = activeData[activeData.length - 1];
  const firstBar = activeData[0];
  const totalChange = lastBar && firstBar ? ((lastBar.close - firstBar.close) / firstBar.close * 100) : 0;

  const CHART_TYPES: { value: ChartType; label: string; icon: any }[] = [
    { value: "candle", label: "Candles", icon: CandlestickChart },
    { value: "line", label: "Line", icon: LineChart },
    { value: "ohlc", label: "OHLC", icon: BarChart3 },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
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

          {activeSymbol && price !== null && (
            <div className="flex items-center gap-4 rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm px-4 py-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span className="text-xs font-medium text-foreground tracking-wider">{activeSymbol}</span>
              </div>
              <span className="text-sm font-light text-foreground">${fmt(price)}</span>
              <span className={`text-[11px] font-medium ${change >= 0 ? "text-accent" : "text-destructive"}`}>
                {change >= 0 ? "+" : ""}{fmt(Math.abs(change))} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
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
        {/* Ticker Input */}
        <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && fetchData()}
                placeholder="Enter ticker… BTC, AAPL, ETH, TSLA, EUR=X, GC=F"
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

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive font-light">{error}</span>
          </div>
        )}

        {(loading || analyzing) && (
          <div className="rounded-xl border border-accent/15 bg-accent/5 backdrop-blur-sm p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <div>
              <span className="text-xs font-light text-accent">{progress}</span>
              {analyzing && (
                <p className="text-[10px] text-accent/50 mt-0.5">Analyzing {activeData.length} candles across {Object.keys(bars).length} timeframe(s)</p>
              )}
            </div>
          </div>
        )}

        {/* Main Chart */}
        {Object.keys(bars).length > 0 && (
          <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs font-medium text-foreground tracking-wider">{activeSymbol}</span>
                </div>
                <div className="h-4 w-px bg-border/15" />
                {/* Timeframe tabs */}
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
                {/* Chart type tabs */}
                <div className="flex gap-1">
                  {CHART_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => setChartType(ct.value)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        chartType === ct.value
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground/35 hover:text-muted-foreground"
                      }`}
                    >
                      <ct.icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{ct.label}</span>
                    </button>
                  ))}
                </div>
                <div className="h-4 w-px bg-border/15" />
                <span className="text-[10px] text-muted-foreground/30">{activeData.length} bars</span>
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

            {/* Canvas Chart */}
            <div className="px-2 py-2">
              <CandleChart data={activeData} chartType={chartType} patternZones={activePatternZones} />
            </div>
          </div>
        )}

        {/* Discovered Strategies */}
        {patterns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent/60" />
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
                Aureon Discovered {patterns.length} Novel Strategies
              </p>
            </div>

            {patterns.map(pattern => (
              <div key={pattern.id} className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl p-4 sm:p-5">
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Occurrences", value: pattern.occurrences?.toString() || "—", color: "text-foreground" },
                    { label: "Win Rate", value: pattern.winRate ? `${Math.round(pattern.winRate * 100)}%` : "—", color: (pattern.winRate || 0) >= 0.6 ? "text-accent" : "text-muted-foreground" },
                    { label: "Avg Return", value: pattern.avgReturn ? `${pattern.avgReturn > 0 ? "+" : ""}${pattern.avgReturn.toFixed(1)}%` : "—", color: (pattern.avgReturn || 0) > 0 ? "text-accent" : "text-destructive" },
                    { label: "R:R", value: pattern.riskReward || "—", color: "text-foreground" },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl bg-background/20 border border-border/10 p-2.5 text-center">
                      <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">{stat.label}</p>
                      <p className={`text-sm font-light mt-0.5 ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pattern.entryRules?.length > 0 && (
                    <div className="rounded-xl bg-accent/[0.03] border border-accent/10 p-3">
                      <p className="text-[9px] font-light tracking-[0.1em] text-accent/60 uppercase mb-2">Entry Rules</p>
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
                      <p className="text-[9px] font-light tracking-[0.1em] text-destructive/60 uppercase mb-2">Exit Rules</p>
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

        {/* Empty State */}
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
                Type BTC, ETH, AAPL, TSLA — Aureon auto-resolves crypto tickers and pulls full history with real candlestick charts
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LavbaView;
