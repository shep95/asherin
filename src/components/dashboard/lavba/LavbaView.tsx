import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import {
  Loader2, Search, Sparkles, TrendingUp, Clock, BarChart3, Target,
  AlertTriangle, ArrowRight, Zap, Activity, DollarSign, Volume2, RefreshCw,
  CandlestickChart, LineChart, Minus, Plus, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/adminEmail";
const LavbaAutoTradeComponent = lazy(() => import("./LavbaAutoTrade"));

interface ChartBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PatternAnnotation {
  type: "box" | "trendline" | "wave_count" | "duration";
  startIdx: number;
  endIdx: number;
  label: string;
  color?: string;
  priceStart?: number;
  priceEnd?: number;
  wavePoints?: { idx: number; label: string; price: number }[];
  durationText?: string;
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
  annotations?: PatternAnnotation[];
  confidence: number;
}

interface LiveSignal {
  direction: "LONG" | "SHORT" | "NEUTRAL";
  entry: string;
  stopLoss: string;
  takeProfit1: string;
  takeProfit2: string;
  takeProfit3: string;
  etaTP1?: string;
  etaTP2?: string;
  etaTP3?: string;
  reasoning: string;
  confidence: number;
  invalidation: string;
  basedOnPatterns: string[];
  predictedCandles?: { open: number; high: number; low: number; close: number }[];
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
  annotations: PatternAnnotation[];
  signal?: LiveSignal | null;
  predictedBars?: { open: number; high: number; low: number; close: number }[];
}

const CandleChart = ({ data, chartType, patternZones, annotations, signal, predictedBars }: CandleChartProps) => {
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

    const pBars = predictedBars || [];
    const predCount = pBars.length;

    const end = Math.min(viewStart + visibleCount, data.length);
    const start = Math.max(0, end - visibleCount);
    const visible = data.slice(start, end);
    if (visible.length === 0) return;

    const isAtEnd = end >= data.length;
    const showPredicted = isAtEnd && predCount > 0;
    const totalSlots = visible.length + (showPredicted ? predCount : 0);

    let minP = Infinity, maxP = -Infinity, maxV = 0;
    for (const b of visible) {
      if (b.low < minP) minP = b.low;
      if (b.high > maxP) maxP = b.high;
      if (b.volume > maxV) maxV = b.volume;
    }
    if (showPredicted) {
      for (const pb of pBars) {
        if (pb.low < minP) minP = pb.low;
        if (pb.high > maxP) maxP = pb.high;
      }
    }
    if (signal && isAtEnd) {
      const sLevels = [signal.entry, signal.stopLoss, signal.takeProfit1, signal.takeProfit2, signal.takeProfit3]
        .map(s => parseFloat(s)).filter(n => !isNaN(n));
      for (const lv of sLevels) {
        if (lv < minP) minP = lv;
        if (lv > maxP) maxP = lv;
      }
    }
    const pRange = maxP - minP || 1;
    const pPad = pRange * 0.05;
    minP -= pPad;
    maxP += pPad;
    const totalPRange = maxP - minP;

    const priceY = (p: number) => 20 + (1 - (p - minP) / totalPRange) * (priceH - 40);
    const volY = (v: number) => volTop + volH - (v / (maxV || 1)) * (volH - 5);

    const barW = chartW / totalSlots;
    const candleW = Math.max(1, barW * 0.65);
    const barX = (i: number) => padL + i * barW + barW / 2;

    ctx.clearRect(0, 0, w, h);

    const bullColor = "#d4a843";
    const bearColor = "rgba(200,200,220,0.7)";
    const gridColor = "rgba(128,128,128,0.08)";
    const textColor = "rgba(128,128,128,0.4)";
    const crosshairColor = "rgba(128,128,128,0.15)";
    const predBullColor = "rgba(220,220,230,0.55)";
    const predBearColor = "rgba(160,160,175,0.45)";
    const predWickColor = "rgba(180,180,195,0.35)";

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    const gridCount = 6;
    for (let i = 0; i <= gridCount; i++) {
      const y = 20 + (i / gridCount) * (priceH - 40);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }

    // Pattern zones (yellow boxes like TradingView)
    for (const zone of patternZones) {
      const zs = zone.startIdx - start;
      const ze = zone.endIdx - start;
      if (ze < 0 || zs >= visible.length) continue;
      const x1 = barX(Math.max(0, zs)) - barW / 2;
      const x2 = barX(Math.min(visible.length - 1, ze)) + barW / 2;

      // Find price range within zone for tighter boxes
      let zMinP = Infinity, zMaxP = -Infinity;
      for (let i = Math.max(0, zone.startIdx); i <= Math.min(zone.endIdx, data.length - 1); i++) {
        const vi = i - start;
        if (vi >= 0 && vi < visible.length) {
          if (visible[vi].low < zMinP) zMinP = visible[vi].low;
          if (visible[vi].high > zMaxP) zMaxP = visible[vi].high;
        }
      }
      const y1 = zMaxP > -Infinity ? priceY(zMaxP) - 4 : 20;
      const y2 = zMinP < Infinity ? priceY(zMinP) + 4 : priceH - 20;

      // Filled box
      ctx.fillStyle = zone.type === "bullish" ? "rgba(212,168,67,0.06)" : "rgba(180,180,200,0.06)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      // Solid yellow/white border (like TradingView yellow boxes)
      ctx.strokeStyle = zone.type === "bullish" ? "rgba(212,168,67,0.45)" : "rgba(200,200,220,0.4)";
      ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      // Label above box
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = zone.type === "bullish" ? "rgba(212,168,67,0.8)" : "rgba(200,200,220,0.7)";
      ctx.textAlign = "center";
      ctx.fillText(zone.name, (x1 + x2) / 2, y1 - 6);
      ctx.textAlign = "left";

      // Duration label below box
      const zoneStartBar = data[zone.startIdx];
      const zoneEndBar = data[Math.min(zone.endIdx, data.length - 1)];
      if (zoneStartBar && zoneEndBar) {
        const daysSpan = Math.round((new Date(zoneEndBar.date).getTime() - new Date(zoneStartBar.date).getTime()) / 86400000);
        const durLabel = daysSpan > 30 ? `${Math.round(daysSpan / 30)}mo` : `${daysSpan}d`;
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "rgba(200,200,220,0.35)";
        ctx.textAlign = "center";
        ctx.fillText(`${zone.endIdx - zone.startIdx} bars · ${durLabel}`, (x1 + x2) / 2, y2 + 12);
        ctx.textAlign = "left";
      }
    }

    // ── PATTERN ANNOTATIONS (wave counts, trendlines, labels) ──
    for (const ann of annotations) {
      const as = ann.startIdx - start;
      const ae = ann.endIdx - start;
      if (ae < 0 || as >= visible.length) continue;

      const annColor = ann.color || "rgba(100,180,255,0.7)";

      if (ann.type === "wave_count" && ann.wavePoints) {
        // Draw wave count numbers at swing points
        for (const wp of ann.wavePoints) {
          const wi = wp.idx - start;
          if (wi < 0 || wi >= visible.length) continue;
          const wx = barX(wi);
          const wy = priceY(wp.price);
          // Draw the wave label
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = annColor;
          ctx.textAlign = "center";
          const isHigh = wp.price >= visible[wi].close;
          ctx.fillText(`(${wp.label})`, wx, isHigh ? wy - 8 : wy + 14);
          // Small dot at the point
          ctx.beginPath();
          ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = annColor;
          ctx.fill();
          ctx.textAlign = "left";
        }
      }

      if (ann.type === "trendline") {
        const x1 = barX(Math.max(0, as));
        const x2 = barX(Math.min(visible.length - 1, ae));
        const y1t = ann.priceStart ? priceY(ann.priceStart) : priceY(visible[Math.max(0, as)]?.high ?? 0);
        const y2t = ann.priceEnd ? priceY(ann.priceEnd) : priceY(visible[Math.min(visible.length - 1, ae)]?.low ?? 0);
        ctx.save();
        ctx.strokeStyle = annColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1t);
        ctx.lineTo(x2, y2t);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label
        if (ann.label) {
          ctx.font = "bold 9px sans-serif";
          ctx.fillStyle = annColor;
          ctx.textAlign = "center";
          ctx.fillText(ann.label, (x1 + x2) / 2, Math.min(y1t, y2t) - 6);
          ctx.textAlign = "left";
        }
        ctx.restore();
      }

      if (ann.type === "duration") {
        const x1 = barX(Math.max(0, as));
        const x2 = barX(Math.min(visible.length - 1, ae));
        const dy = priceH - 8;
        ctx.save();
        ctx.strokeStyle = "rgba(212,168,67,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, dy - 6); ctx.lineTo(x1, dy + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, dy - 6); ctx.lineTo(x2, dy + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, dy); ctx.lineTo(x2, dy); ctx.stroke();
        ctx.font = "bold 8px sans-serif";
        ctx.fillStyle = "rgba(212,168,67,0.6)";
        ctx.textAlign = "center";
        ctx.fillText(ann.durationText || ann.label, (x1 + x2) / 2, dy - 8);
        ctx.textAlign = "left";
        ctx.restore();
      }

      if (ann.type === "box") {
        const x1 = barX(Math.max(0, as)) - barW / 2;
        const x2 = barX(Math.min(visible.length - 1, ae)) + barW / 2;
        const py1 = ann.priceStart ? priceY(ann.priceStart) : 20;
        const py2 = ann.priceEnd ? priceY(ann.priceEnd) : priceH - 20;
        ctx.save();
        ctx.strokeStyle = annColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x1, Math.min(py1, py2), x2 - x1, Math.abs(py2 - py1));
        if (ann.label) {
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = annColor;
          ctx.textAlign = "center";
          ctx.fillText(ann.label, (x1 + x2) / 2, Math.min(py1, py2) - 6);
          ctx.textAlign = "left";
        }
        ctx.restore();
      }
    }

    // ── DRAW REAL BARS ──
    if (chartType === "line") {
      ctx.beginPath(); ctx.strokeStyle = bullColor; ctx.lineWidth = 1.5;
      for (let i = 0; i < visible.length; i++) {
        const x = barX(i), y = priceY(visible[i].close);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (showPredicted) {
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(200,200,215,0.5)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(barX(visible.length - 1), priceY(visible[visible.length - 1].close));
        for (let i = 0; i < pBars.length; i++) ctx.lineTo(barX(visible.length + i), priceY(pBars[i].close));
        ctx.stroke(); ctx.restore();
      }
      const lastX = barX(visible.length - 1);
      ctx.beginPath();
      for (let i = 0; i < visible.length; i++) { const x = barX(i), y = priceY(visible[i].close); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.lineTo(lastX, priceH); ctx.lineTo(barX(0), priceH); ctx.closePath();
      ctx.fillStyle = "rgba(212,168,67,0.04)"; ctx.fill();
    } else {
      for (let i = 0; i < visible.length; i++) {
        const b = visible[i], x = barX(i), bullish = b.close >= b.open, color = bullish ? bullColor : bearColor;
        if (chartType === "candle") {
          ctx.strokeStyle = color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, priceY(b.high)); ctx.lineTo(x, priceY(b.low)); ctx.stroke();
          const bT = priceY(Math.max(b.open, b.close)), bB = priceY(Math.min(b.open, b.close)), bH = Math.max(1, bB - bT);
          ctx.fillStyle = color; ctx.fillRect(x - candleW / 2, bT, candleW, bH);
        } else {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, priceY(b.high)); ctx.lineTo(x, priceY(b.low)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - candleW / 2, priceY(b.open)); ctx.lineTo(x, priceY(b.open)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, priceY(b.close)); ctx.lineTo(x + candleW / 2, priceY(b.close)); ctx.stroke();
        }
      }

      // ── PREDICTED CANDLES (grey/white glass) ──
      if (showPredicted) {
        const sepX = barX(visible.length) - barW / 2;
        ctx.strokeStyle = "rgba(200,200,215,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sepX, 20); ctx.lineTo(sepX, priceH); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "bold 8px sans-serif"; ctx.fillStyle = "rgba(200,200,215,0.2)"; ctx.textAlign = "center";
        ctx.fillText("AUREON FORECAST", sepX + (pBars.length * barW) / 2, 16);

        for (let i = 0; i < pBars.length; i++) {
          const pb = pBars[i], x = barX(visible.length + i), bullish = pb.close >= pb.open;
          if (chartType === "candle") {
            ctx.strokeStyle = predWickColor; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, priceY(pb.high)); ctx.lineTo(x, priceY(pb.low)); ctx.stroke();
            const bT = priceY(Math.max(pb.open, pb.close)), bB = priceY(Math.min(pb.open, pb.close)), bH = Math.max(1, bB - bT);
            ctx.fillStyle = bullish ? predBullColor : predBearColor;
            ctx.fillRect(x - candleW / 2, bT, candleW, bH);
            ctx.strokeStyle = bullish ? "rgba(220,220,230,0.25)" : "rgba(160,160,175,0.25)";
            ctx.lineWidth = 0.5; ctx.strokeRect(x - candleW / 2, bT, candleW, bH);
          } else {
            ctx.strokeStyle = bullish ? predBullColor : predBearColor; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, priceY(pb.high)); ctx.lineTo(x, priceY(pb.low)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - candleW / 2, priceY(pb.open)); ctx.lineTo(x, priceY(pb.open)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, priceY(pb.close)); ctx.lineTo(x + candleW / 2, priceY(pb.close)); ctx.stroke();
          }
        }
      }
    }

    // Volume bars
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i], x = barX(i), bullish = b.close >= b.open;
      const vTop2 = volY(b.volume), vBot = volTop + volH;
      ctx.fillStyle = bullish ? "rgba(212,168,67,0.2)" : "rgba(180,180,200,0.15)";
      ctx.fillRect(x - candleW / 2, vTop2, candleW, vBot - vTop2);
    }

    // ── CURRENT PRICE LINE ──
    const currentPrice = visible[visible.length - 1]?.close;
    if (currentPrice) {
      const cpY = priceY(currentPrice);
      const cpBull = visible[visible.length - 1].close >= visible[visible.length - 1].open;
      ctx.save();
      ctx.strokeStyle = cpBull ? "rgba(212,168,67,0.45)" : "rgba(180,180,200,0.45)";
      ctx.lineWidth = 1; ctx.setLineDash([6, 3]);
      ctx.beginPath(); ctx.moveTo(padL, cpY); ctx.lineTo(w - padR, cpY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cpBull ? "rgba(212,168,67,0.85)" : "rgba(180,180,200,0.85)";
      ctx.beginPath(); ctx.roundRect(w - padR + 2, cpY - 9, padR - 6, 18, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`$${fmt(currentPrice)}`, w - padR + 6, cpY + 3);
      ctx.restore();
    }

    // ── SIGNAL LEVELS ──
    if (signal && isAtEnd) {
      const drawLevel = (priceStr: string, label: string, color: string, dash: number[]) => {
        const p = parseFloat(priceStr); if (isNaN(p)) return;
        const ly = priceY(p); if (ly < 10 || ly > priceH + 10) return;
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w - padR, ly); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "bold 8px sans-serif"; ctx.fillStyle = color; ctx.textAlign = "left";
        ctx.fillText(`${label} $${fmt(p)}`, padL + 4, ly - 4); ctx.restore();
      };
      drawLevel(signal.entry, "ENTRY", "rgba(255,255,255,0.5)", [4, 3]);
      drawLevel(signal.stopLoss, "SL", "rgba(180,180,200,0.6)", [3, 3]);
      drawLevel(signal.takeProfit1, "TP1", "rgba(212,168,67,0.5)", [4, 3]);
      drawLevel(signal.takeProfit2, "TP2", "rgba(212,168,67,0.4)", [4, 3]);
      drawLevel(signal.takeProfit3, "TP3", "rgba(212,168,67,0.3)", [4, 3]);
    }

    // Y-axis labels
    ctx.font = "10px sans-serif"; ctx.fillStyle = textColor; ctx.textAlign = "left";
    for (let i = 0; i <= gridCount; i++) {
      const p = maxP - (i / gridCount) * totalPRange;
      const y = 20 + (i / gridCount) * (priceH - 40);
      ctx.fillText(`$${fmt(p)}`, w - padR + 8, y + 3);
    }

    // X-axis labels
    ctx.textAlign = "center";
    const labelStep = Math.max(1, Math.floor(visible.length / 8));
    for (let i = 0; i < visible.length; i += labelStep) {
      const d = visible[i].date;
      ctx.fillText(d.length > 10 ? d.slice(5, 10) : d.slice(0, 10), barX(i), priceH + 2);
    }

    ctx.font = "9px sans-serif"; ctx.fillStyle = "rgba(128,128,128,0.2)"; ctx.textAlign = "left";
    ctx.fillText("Vol", padL, volTop - 2);

    // Crosshair
    if (hoveredIdx !== null) {
      const hi = hoveredIdx - start;
      if (hi >= 0 && hi < visible.length) {
        const hb = visible[hi], hx = barX(hi), hy = priceY(hb.close);
        ctx.strokeStyle = crosshairColor; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, hy); ctx.lineTo(w - padR, hy); ctx.stroke(); ctx.setLineDash([]);

        ctx.fillStyle = hb.close >= hb.open ? bullColor : bearColor;
        ctx.fillRect(w - padR + 2, hy - 9, padR - 4, 18);
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`$${fmt(hb.close)}`, w - padR + 6, hy + 4);

        const bullish = hb.close >= hb.open;
        const tooltipW = 160, tooltipH = 82;
        let tx = hx + 15; if (tx + tooltipW > w - padR) tx = hx - tooltipW - 15;
        const ty = 30;
        ctx.fillStyle = "rgba(15,15,20,0.92)";
        ctx.beginPath(); ctx.roundRect(tx, ty, tooltipW, tooltipH, 8); ctx.fill();
        ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.font = "9px sans-serif"; ctx.textAlign = "left";
        ctx.fillStyle = "rgba(200,200,200,0.4)";
        ctx.fillText(hb.date.slice(0, 16).replace("T", " "), tx + 8, ty + 14);
        const labels = ["O", "H", "L", "C", "V"];
        const vals = [hb.open, hb.high, hb.low, hb.close, hb.volume];
        labels.forEach((l, i) => {
          const ly = ty + 28 + i * 11;
          ctx.fillStyle = "rgba(200,200,200,0.35)"; ctx.fillText(l, tx + 8, ly);
          ctx.fillStyle = i === 3 ? (bullish ? bullColor : bearColor) : "rgba(230,230,230,0.7)";
          const vStr = i === 4 ? `${(vals[i] / 1e6).toFixed(1)}M` : `$${fmt(vals[i])}`;
          ctx.textAlign = "right"; ctx.fillText(vStr, tx + tooltipW - 8, ly); ctx.textAlign = "left";
        });
      }
    }
  }, [data, viewStart, visibleCount, hoveredIdx, chartType, containerSize, patternZones, annotations, signal, predictedBars]);

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

/* ──────────── PATTERN MINI CHART ──────────── */
interface PatternMiniChartProps {
  data: ChartBar[];
  startIdx: number;
  endIdx: number;
  type: "bullish" | "bearish";
}

const PatternMiniChart = ({ data, startIdx, endIdx, type }: PatternMiniChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pad = 8;
  const from = Math.max(0, startIdx - pad);
  const to = Math.min(data.length - 1, endIdx + pad);
  const slice = data.slice(from, to + 1);
  const zoneStart = startIdx - from;
  const zoneEnd = endIdx - from;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || slice.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 200, h = 80;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    let minP = Infinity, maxP = -Infinity;
    for (const b of slice) { if (b.low < minP) minP = b.low; if (b.high > maxP) maxP = b.high; }
    const range = maxP - minP || 1;
    minP -= range * 0.05; maxP += range * 0.05;
    const totalR = maxP - minP;

    const py = (p: number) => 6 + (1 - (p - minP) / totalR) * (h - 12);
    const barW = (w - 4) / slice.length;
    const candleW = Math.max(1, barW * 0.6);
    const bx = (i: number) => 2 + i * barW + barW / 2;

    ctx.clearRect(0, 0, w, h);

    // Zone highlight
    const zx1 = bx(zoneStart) - barW / 2;
    const zx2 = bx(Math.min(zoneEnd, slice.length - 1)) + barW / 2;
    ctx.fillStyle = type === "bullish" ? "rgba(212,168,67,0.1)" : "rgba(180,180,200,0.1)";
    ctx.fillRect(zx1, 0, zx2 - zx1, h);
    ctx.strokeStyle = type === "bullish" ? "rgba(212,168,67,0.35)" : "rgba(180,180,200,0.35)";
    ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.strokeRect(zx1, 0, zx2 - zx1, h);
    ctx.setLineDash([]);

    // Candles
    for (let i = 0; i < slice.length; i++) {
      const b = slice[i], x = bx(i), bull = b.close >= b.open;
      const inZone = i >= zoneStart && i <= zoneEnd;
      const color = bull ? (inZone ? "#d4a843" : "rgba(212,168,67,0.35)") : (inZone ? "rgba(200,200,220,0.8)" : "rgba(200,200,220,0.3)");
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, py(b.high)); ctx.lineTo(x, py(b.low)); ctx.stroke();
      const bT = py(Math.max(b.open, b.close)), bB = py(Math.min(b.open, b.close)), bH = Math.max(1, bB - bT);
      ctx.fillStyle = color; ctx.fillRect(x - candleW / 2, bT, candleW, bH);
    }
  }, [slice, zoneStart, zoneEnd, type]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-border/10 bg-background/20"
      style={{ width: 200, height: 80 }}
    />
  );
};

/* ──────────── AUTO-TRADE LOGIC (Admin only) ──────────── */
const ADMIN_EMAIL = ADMIN_EMAIL;

const executeAutoTrade = async (sig: LiveSignal, sym: string, leverage: number, sizeUsd: number) => {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyperliquid-trade`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "place_trade",
          symbol: sym,
          direction: sig.direction,
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit1,
          takeProfit2: sig.takeProfit2,
          takeProfit3: sig.takeProfit3,
          leverage,
          sizeUsd,
        }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Trade failed");
    return { success: true, data };
  } catch (e: any) {
    console.error("Auto-trade error:", e);
    return { success: false, error: e.message };
  }
};

const fetchHLBalance = async () => {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyperliquid-trade`,
      { method: "POST", headers, body: JSON.stringify({ action: "get_balance" }) }
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
};

/* ──────────── MAIN LAVBA VIEW ──────────── */
const LavbaView = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [symbol, setSymbol] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["1d"]);
  const [bars, setBars] = useState<Record<string, ChartBar[]>>({});
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([]);
  const [chartAnnotations, setChartAnnotations] = useState<PatternAnnotation[]>([]);
  const [signal, setSignal] = useState<LiveSignal | null>(null);
  const [reviewingChart, setReviewingChart] = useState(false);
  const [activeChart, setActiveChart] = useState<string>("1d");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [error, setError] = useState("");
  const strategiesRef = useRef<HTMLDivElement>(null);

  // Auto-trade state (admin only)
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lavba_auto_trade") === "true";
    return false;
  });
  const [leverage, setLeverage] = useState(() => {
    if (typeof window !== "undefined") return parseInt(localStorage.getItem("lavba_leverage") || "10", 10);
    return 10;
  });
  const [positionSizeUsd, setPositionSizeUsd] = useState(() => {
    if (typeof window !== "undefined") return parseInt(localStorage.getItem("lavba_size_usd") || "100", 10);
    return 100;
  });
  const [tradeStatus, setTradeStatus] = useState<{ type: "idle" | "executing" | "success" | "error"; message?: string }>({ type: "idle" });
  const [hlBalance, setHlBalance] = useState<any>(null);
  const [showTradeSettings, setShowTradeSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "autotrade">("chart");

  // Persist settings
  useEffect(() => {
    localStorage.setItem("lavba_auto_trade", String(autoTradeEnabled));
    localStorage.setItem("lavba_leverage", String(leverage));
    localStorage.setItem("lavba_size_usd", String(positionSizeUsd));
  }, [autoTradeEnabled, leverage, positionSizeUsd]);

  // Fetch balance on mount for admin
  useEffect(() => {
    if (isAdmin) fetchHLBalance().then(b => b && setHlBalance(b));
  }, [isAdmin]);

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

    // Get latest bar across all timeframes for current price
    const allBarArrays = Object.values(bars).filter(b => b.length > 0);
    const lastBarAll = allBarArrays.length > 0 ? allBarArrays[0][allBarArrays[0].length - 1] : null;

    setAnalyzing(true);
    setSignal(null);
    setChartAnnotations([]);
    setReviewingChart(true);
    setProgress("Aureon is reviewing the chart structure before generating signals…");
    let result = "";

    const barSummaries = allBars.map(([tf, data]) => {
      const sampled = data.length > 200
        ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0)
        : data;
      return `[${tf} — ${data.length} bars]\n${sampled.map(b =>
        `${b.date.slice(0, 10)},O:${b.open.toFixed(2)},H:${b.high.toFixed(2)},L:${b.low.toFixed(2)},C:${b.close.toFixed(2)},V:${b.volume}`
      ).join("\n")}`;
    }).join("\n\n");

    const prompt = `You are Aureon — an elite quantitative pattern recognition engine. You must VISUALLY ANNOTATE the chart like a professional technical analyst before issuing any signal.

SYMBOL: ${activeSymbol}
TIMEFRAMES: ${Object.keys(bars).join(", ")}
CURRENT PRICE: ${lastBarAll ? `$${lastBarAll.close}` : "unknown"}
TOTAL BARS: ${allBarArrays.length > 0 ? allBarArrays[0].length : 0}

HISTORICAL OHLCV DATA:
${barSummaries}

MISSION (3 PHASES):

PHASE 1 — CHART REVIEW (Draw annotations before signaling)
Study the ENTIRE price history. Identify:
- Repeating structural patterns (descending wedges, distribution zones, liquidity sweeps)
- Measure the GEOMETRY: how many bars each pattern lasted, what % move it produced
- Find where the SAME pattern structure repeated at different price levels
- Count wave swings inside each pattern (like Elliott counts: 1, 2, 3, 4, 5)
- Draw trendlines connecting major highs/lows

PHASE 2 — PATTERN DISCOVERY
Find 2-4 REPEATING fractal patterns with:
- Original name, detailed description (market mechanics)
- Occurrence count, win rate, avg return %, risk:reward ratio
- Entry/exit rules
- Bar index ranges where pattern appeared
- Confidence 0-1
- ANNOTATIONS: For each pattern, provide chart annotations:
  - "box" type: yellow rectangle around the pattern zone with priceStart/priceEnd (high/low of zone)
  - "wave_count" type: numbered swing points inside each zone with idx, label ("1","2","3","4","5"), and price
  - "trendline" type: connecting major highs or lows across the pattern with priceStart/priceEnd
  - "duration" type: showing how long the pattern lasted (e.g. "45 bars · 23d")

PHASE 3 — SIGNAL (Only AFTER reviewing the chart)
Based on patterns found AND current price action, generate a LIVE TRADE SIGNAL:
- direction: "LONG" or "SHORT" or "NEUTRAL"
- entry, stopLoss, takeProfit1, takeProfit2, takeProfit3: exact price levels
- etaTP1, etaTP2, etaTP3: estimated time to reach each TP (e.g. "4-8 hours", "1-2 days")
- reasoning: 2-3 sentences explaining WHY
- confidence: 0-1
- invalidation: price/condition that invalidates
- basedOnPatterns: pattern names
- predictedCandles: 5-8 predicted candles as {open,high,low,close}
- chartReview: 2-3 sentence summary of what you found reviewing the full chart BEFORE signaling

Return ONLY valid JSON:
{"patterns":[{"name":"...","description":"...","occurrences":2,"winRate":0.75,"avgReturn":3.2,"riskReward":"1:2.5","timeframe":"1d","entryRules":["..."],"exitRules":["..."],"patternZones":[{"startIdx":50,"endIdx":65,"type":"bullish"}],"annotations":[{"type":"box","startIdx":50,"endIdx":65,"label":"Pattern One","color":"rgba(212,168,67,0.7)","priceStart":95000,"priceEnd":85000},{"type":"wave_count","startIdx":50,"endIdx":65,"label":"Wave Count","color":"rgba(100,180,255,0.8)","wavePoints":[{"idx":52,"label":"1","price":88000},{"idx":55,"label":"2","price":86000},{"idx":58,"label":"3","price":91000},{"idx":61,"label":"4","price":87500},{"idx":64,"label":"5","price":93000}]},{"type":"trendline","startIdx":50,"endIdx":65,"label":"Descending Resistance","color":"rgba(255,100,100,0.6)","priceStart":95000,"priceEnd":90000},{"type":"duration","startIdx":50,"endIdx":65,"label":"Pattern Duration","durationText":"15 bars · 15d"}],"confidence":0.82}],"signal":{"direction":"LONG","entry":"95000","stopLoss":"93500","takeProfit1":"97000","takeProfit2":"99000","takeProfit3":"102000","etaTP1":"4-8 hours","etaTP2":"1-2 days","etaTP3":"3-5 days","reasoning":"...","confidence":0.78,"invalidation":"Break below 93000","basedOnPatterns":["Pattern Name"],"predictedCandles":[{"open":95100,"high":96200,"low":94800,"close":96000}],"chartReview":"Full chart review summary here"}}`;
    try {
      setProgress("Phase 1: Aureon reviewing chart structure…");
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        mode: "research",
        onDelta: (chunk) => { result += chunk; },
        onDone: () => {
          try {
            // Strip markdown code blocks and clean response
            let cleaned = result
              .replace(/```json\s*/gi, "")
              .replace(/```\s*/g, "")
              .trim();

            // Find the outermost JSON object
            const jsonStart = cleaned.indexOf("{");
            const jsonEnd = cleaned.lastIndexOf("}");

            let parsed: any = null;

            if (jsonStart !== -1 && jsonEnd > jsonStart) {
              let jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
              try {
                parsed = JSON.parse(jsonStr);
              } catch {
                // Fix common LLM JSON issues
                jsonStr = jsonStr
                  .replace(/,\s*}/g, "}")
                  .replace(/,\s*]/g, "]")
                  .replace(/[\x00-\x1F\x7F]/g, " ")
                  .replace(/\n/g, " ");
                try {
                  parsed = JSON.parse(jsonStr);
                } catch { /* fall through */ }
              }
            }

            // Fallback: try array-only format
            if (!parsed) {
              const arrStart = cleaned.indexOf("[");
              const arrEnd = cleaned.lastIndexOf("]");
              if (arrStart !== -1 && arrEnd > arrStart) {
                let arrStr = cleaned.substring(arrStart, arrEnd + 1)
                  .replace(/,\s*]/g, "]")
                  .replace(/[\x00-\x1F\x7F]/g, " ");
                try {
                  const arr = JSON.parse(arrStr) as DiscoveredPattern[];
                  parsed = { patterns: arr };
                } catch { /* fall through */ }
              }
            }

            if (parsed?.patterns && Array.isArray(parsed.patterns)) {
              setPatterns(parsed.patterns.map((p: DiscoveredPattern, i: number) => ({ ...p, id: `lv-${i}-${Date.now()}` })));
              // Collect all annotations from patterns
              const allAnns: PatternAnnotation[] = parsed.patterns.flatMap((p: any) => p.annotations || []);
              setChartAnnotations(allAnns);
              setTimeout(() => strategiesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
            }
            if (parsed?.signal) {
              const sig = parsed.signal as LiveSignal;
              setSignal(sig);
              setReviewingChart(false);
              if (parsed.signal.chartReview) {
                setProgress(`Chart Review: ${parsed.signal.chartReview}`);
                setTimeout(() => setProgress(""), 5000);
              }
              // AUTO-TRADE: Execute if enabled and direction is actionable
              if (isAdmin && autoTradeEnabled && sig.direction !== "NEUTRAL" && activeSymbol) {
                setTradeStatus({ type: "executing", message: `Placing ${sig.direction} on Hyperliquid…` });
                executeAutoTrade(sig, activeSymbol, leverage, positionSizeUsd).then(res => {
                  if (res.success) {
                    setTradeStatus({ type: "success", message: `${sig.direction} executed @ $${sig.entry} · ${leverage}x · $${positionSizeUsd}` });
                    fetchHLBalance().then(b => b && setHlBalance(b));
                  } else {
                    setTradeStatus({ type: "error", message: res.error || "Trade failed" });
                  }
                  setTimeout(() => setTradeStatus({ type: "idle" }), 8000);
                });
              }
            }
            if (!parsed) {
              console.error("Lavba raw AI result:", result.slice(0, 500));
              setPatterns([]);
              setError("Failed to parse Aureon analysis results.");
            }
          } catch (e) {
            console.error("Lavba parse error:", e, "Raw:", result.slice(0, 500));
            setPatterns([]);
            setError("Failed to parse Aureon analysis results.");
          }
          setAnalyzing(false);
          setReviewingChart(false);
          setProgress("");
        },
      });
    } catch {
      setAnalyzing(false);
      setReviewingChart(false);
      setProgress("");
    }
  }, [bars, activeSymbol, isAdmin, autoTradeEnabled, leverage, positionSizeUsd]);

  const activeData = bars[activeChart] || [];

  // Pattern zone overlay data
  const activePatternZones = useMemo(() => patterns
    .flatMap(p => p.patternZones?.map(z => ({
      ...z,
      name: p.name,
    })) || []), [patterns]);

  // Merge all annotations from patterns
  const activeAnnotations = useMemo(() => [
    ...chartAnnotations,
    ...patterns.flatMap(p => p.annotations || []),
  ], [patterns, chartAnnotations]);

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

      {/* Tab bar (admin only sees both) */}
      {isAdmin && (
        <div className="flex-shrink-0 border-b border-border/10 px-4 sm:px-6 bg-card/5">
          <div className="flex gap-4">
            {[
              { key: "chart", label: "Strategy Engine" },
              { key: "autotrade", label: "Auto-Trading" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as "chart" | "autotrade")}
                className={`py-2 text-[10px] font-light tracking-[0.1em] uppercase border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground/30 hover:text-muted-foreground/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === "autotrade" && isAdmin ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-32"><Loader2 className="h-4 w-4 text-accent animate-spin" /></div>}>
            <LavbaAutoTradeComponent />
          </Suspense>
        </div>
      ) : (
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
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-accent/50">
                    {reviewingChart ? "Phase 1: Reviewing chart structure & drawing annotations…" : "Phase 3: Generating signal…"}
                  </p>
                  <span className="text-[9px] text-accent/30">{activeData.length} candles · {Object.keys(bars).length} TF</span>
                </div>
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
              <CandleChart data={activeData} chartType={chartType} patternZones={activePatternZones} annotations={activeAnnotations} signal={signal} predictedBars={signal?.predictedCandles} />
            </div>
          </div>
        )}

        {/* CHART REVIEW SUMMARY */}
        {signal && (signal as any).chartReview && (
          <div className="rounded-2xl border border-accent/15 bg-accent/[0.03] backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-3.5 w-3.5 text-accent/60" />
              <span className="text-[10px] font-light tracking-[0.15em] text-accent/60 uppercase">Aureon Chart Review (Pre-Signal)</span>
            </div>
            <p className="text-[11px] font-extralight text-muted-foreground/70 leading-relaxed">{(signal as any).chartReview}</p>
          </div>
        )}

        {/* LIVE SIGNAL CARD */}
        {signal && (
          <div className={`rounded-2xl border backdrop-blur-xl p-4 sm:p-5 ${
            signal.direction === "LONG" ? "border-accent/25 bg-accent/[0.04]" :
            signal.direction === "SHORT" ? "border-destructive/25 bg-destructive/[0.04]" :
            "border-border/15 bg-card/10"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium ${
                  signal.direction === "LONG" ? "bg-accent/15 text-accent" :
                  signal.direction === "SHORT" ? "bg-destructive/15 text-destructive" :
                  "bg-muted/15 text-muted-foreground"
                }`}>
                  {signal.direction === "LONG" ? "▲" : signal.direction === "SHORT" ? "▼" : "◆"} {signal.direction}
                </div>
                <span className="text-xs font-light text-foreground tracking-wider">{activeSymbol}</span>
                <span className="text-[9px] text-muted-foreground/40">Live Signal</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/15 px-2.5 py-1">
                <Target className="h-3 w-3 text-accent" />
                <span className="text-[10px] text-accent font-medium">{Math.round((signal.confidence || 0) * 100)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {[
                { label: "Entry", value: `$${signal.entry}`, color: "text-foreground" },
                { label: "Stop Loss", value: `$${signal.stopLoss}`, color: "text-destructive" },
                { label: "TP1", value: `$${signal.takeProfit1}`, color: "text-accent", eta: signal.etaTP1 },
                { label: "TP2", value: `$${signal.takeProfit2}`, color: "text-accent", eta: signal.etaTP2 },
                { label: "TP3", value: `$${signal.takeProfit3}`, color: "text-accent", eta: signal.etaTP3 },
              ].map((s, i) => (
                <div key={i} className="rounded-xl bg-background/20 border border-border/10 p-2.5 text-center">
                  <p className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em]">{s.label}</p>
                  <p className={`text-sm font-light mt-0.5 ${s.color}`}>{s.value}</p>
                  {(s as any).eta && (
                    <p className="text-[8px] font-extralight text-muted-foreground/50 mt-0.5">≈ {(s as any).eta}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-background/10 border border-border/10 p-3 mb-3">
              <p className="text-[9px] font-light tracking-[0.1em] text-muted-foreground/50 uppercase mb-1.5">Reasoning</p>
              <p className="text-[11px] font-extralight text-muted-foreground/70 leading-relaxed">{signal.reasoning}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-destructive/50" />
                <span className="text-[10px] font-extralight text-destructive/50">Invalidation: {signal.invalidation}</span>
              </div>
              {signal.basedOnPatterns?.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground/30">Based on:</span>
                  {signal.basedOnPatterns.map((p, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/8 border border-accent/10 text-accent/60">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUTO-TRADE PANEL (Admin Only) */}
        {isAdmin && (
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.03] backdrop-blur-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-accent" />
                <span className="text-[10px] font-light tracking-[0.15em] text-accent uppercase">Hyperliquid Auto-Trade</span>
              </div>
              <div className="flex items-center gap-3">
                {hlBalance && (
                  <span className="text-[10px] font-light text-muted-foreground/50">
                    Balance: ${parseFloat(hlBalance.balance || 0).toFixed(2)}
                  </span>
                )}
                <button
                  onClick={() => setShowTradeSettings(!showTradeSettings)}
                  className="text-[9px] px-2 py-1 rounded-lg bg-background/20 border border-border/15 text-muted-foreground/50 hover:text-foreground transition-all"
                >
                  ⚙ Settings
                </button>
                <button
                  onClick={() => setAutoTradeEnabled(!autoTradeEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-all ${
                    autoTradeEnabled ? "bg-accent/30 border border-accent/50" : "bg-background/30 border border-border/20"
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    autoTradeEnabled ? "left-5 bg-accent" : "left-0.5 bg-muted-foreground/30"
                  }`} />
                </button>
              </div>
            </div>

            {/* Trade Status */}
            {tradeStatus.type !== "idle" && (
              <div className={`rounded-xl border p-3 mb-3 ${
                tradeStatus.type === "executing" ? "border-accent/20 bg-accent/[0.05]" :
                tradeStatus.type === "success" ? "border-accent/30 bg-accent/[0.08]" :
                "border-destructive/20 bg-destructive/[0.05]"
              }`}>
                <div className="flex items-center gap-2">
                  {tradeStatus.type === "executing" && <Loader2 className="h-3 w-3 text-accent animate-spin" />}
                  {tradeStatus.type === "success" && <Target className="h-3 w-3 text-accent" />}
                  {tradeStatus.type === "error" && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  <span className={`text-[11px] font-extralight ${
                    tradeStatus.type === "executing" ? "text-accent" :
                    tradeStatus.type === "success" ? "text-accent" : "text-destructive"
                  }`}>{tradeStatus.message}</span>
                </div>
              </div>
            )}

            {/* Settings Panel */}
            {showTradeSettings && (
              <div className="grid grid-cols-2 gap-3 mt-3 rounded-xl border border-border/10 bg-background/10 p-3">
                <div>
                  <label className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em] block mb-1">Leverage</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLeverage(Math.max(1, leverage - 1))} className="w-6 h-6 rounded bg-background/30 border border-border/15 text-muted-foreground/50 text-xs">−</button>
                    <span className="text-sm font-light text-foreground w-10 text-center">{leverage}x</span>
                    <button onClick={() => setLeverage(Math.min(50, leverage + 1))} className="w-6 h-6 rounded bg-background/30 border border-border/15 text-muted-foreground/50 text-xs">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground/40 uppercase tracking-[0.1em] block mb-1">Position Size (USD)</label>
                  <input
                    type="number"
                    value={positionSizeUsd}
                    onChange={e => setPositionSizeUsd(Math.max(10, parseInt(e.target.value) || 100))}
                    className="w-full bg-background/30 border border-border/15 rounded-lg px-3 py-1.5 text-sm font-light text-foreground outline-none focus:border-accent/40"
                  />
                </div>
              </div>
            )}

            {!autoTradeEnabled && (
              <p className="text-[9px] font-extralight text-muted-foreground/30 mt-2">
                Enable to automatically execute Aureon signals on Hyperliquid
              </p>
            )}
            {autoTradeEnabled && (
              <p className="text-[9px] font-extralight text-accent/50 mt-2">
                ⚡ Active — Signals will auto-execute on Hyperliquid at {leverage}x leverage, ${positionSizeUsd} per trade
              </p>
            )}
          </div>
        )}

        {/* Discovered Strategies */}
        {patterns.length > 0 && (
          <div ref={strategiesRef} className="space-y-3">
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

                {/* Pattern Occurrence Mini Charts */}
                {pattern.patternZones?.length > 0 && activeData.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-3 w-3 text-accent/50" />
                      <p className="text-[9px] font-light tracking-[0.1em] text-muted-foreground/50 uppercase">
                        Where This Pattern Repeats ({pattern.patternZones.length} occurrences)
                      </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {pattern.patternZones.map((zone, zi) => (
                        <div key={zi} className="flex-shrink-0 rounded-xl border border-border/10 bg-background/10 p-2">
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-[8px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                              #{zi + 1} — {zone.type === "bullish" ? "▲ Bull" : "▼ Bear"}
                            </span>
                            <span className="text-[8px] text-muted-foreground/30">
                              Bars {zone.startIdx}–{zone.endIdx}
                            </span>
                          </div>
                          <PatternMiniChart
                            data={activeData}
                            startIdx={zone.startIdx}
                            endIdx={zone.endIdx}
                            type={zone.type}
                          />
                          {activeData[zone.startIdx] && activeData[Math.min(zone.endIdx, activeData.length - 1)] && (
                            <div className="flex items-center justify-between mt-1.5 px-1">
                              <span className="text-[7px] text-muted-foreground/30">
                                {activeData[zone.startIdx].date.slice(0, 10)}
                              </span>
                              <span className={`text-[8px] font-medium ${zone.type === "bullish" ? "text-accent/60" : "text-muted-foreground/50"}`}>
                                {(() => {
                                  const s = activeData[zone.startIdx];
                                  const e = activeData[Math.min(zone.endIdx, activeData.length - 1)];
                                  const pctChange = ((e.close - s.open) / s.open * 100);
                                  return `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`;
                                })()}
                              </span>
                              <span className="text-[7px] text-muted-foreground/30">
                                {activeData[Math.min(zone.endIdx, activeData.length - 1)].date.slice(0, 10)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
      )}
    </div>
  );
};

export default LavbaView;
