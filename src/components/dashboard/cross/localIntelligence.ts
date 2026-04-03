import { PricePoint, LocalSignal, CrossContext } from "./types";

/**
 * NESTAL FRACTAL LOCAL INTELLIGENCE ENGINE
 * Runs entirely in the browser — no API calls.
 * Pure Nestal Fractal strategy: Wave Structure, Liquidity, FVGs, BOS/CHOCH, Fractal Geometry.
 * NO generic TA (no RSI, no MACD, no "support bounce", no "breakout" retail patterns).
 */

interface SwingPoint {
  price: number;
  timestamp: number;
  type: "high" | "low";
  index: number;
}

interface WaveState {
  currentWave: number; // 1-5 impulse, or -1/-2/-3 for A-B-C correction
  direction: "bullish" | "bearish";
  waveStart: number;
  confidence: number;
}

interface FairValueGap {
  high: number;
  low: number;
  timestamp: number;
  filled: boolean;
}

export class LocalIntelligenceEngine {
  private priceHistory: PricePoint[] = [];
  private maxHistory = 500;
  private lastFrameData: string | null = null;
  private changeThreshold = 0.02;

  recordPrice(context: CrossContext) {
    if (!context.price || !context.pair) return;
    const price = parseFloat(context.price.replace(/[$,]/g, ""));
    if (isNaN(price) || price <= 0) return;

    this.priceHistory.push({ price, timestamp: Date.now(), pair: context.pair });

    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory = this.priceHistory.slice(-this.maxHistory);
    }
  }

  getHistory(pair?: string): PricePoint[] {
    if (!pair) return this.priceHistory;
    return this.priceHistory.filter(p => p.pair === pair);
  }

  /** NESTAL FRACTAL pattern detection — pure fractal logic, <50ms */
  detectLocalPatterns(currentContext: CrossContext): LocalSignal[] {
    const signals: LocalSignal[] = [];
    if (!currentContext.pair || !currentContext.price) return signals;

    const currentPrice = parseFloat(currentContext.price.replace(/[$,]/g, ""));
    if (isNaN(currentPrice)) return signals;

    const history = this.getHistory(currentContext.pair);
    if (history.length < 10) return signals;

    const now = Date.now();
    const last5m = history.filter(p => now - p.timestamp < 300_000);
    const last30m = history.filter(p => now - p.timestamp < 1_800_000);

    // ── CATASTROPHIC EXIT — Displacement candle (rug/dump) ──
    // Not a "pattern" — this is a liquidity void event
    if (last5m.length >= 3) {
      const oldest = last5m[0].price;
      const pctDrop = ((currentPrice - oldest) / oldest) * 100;
      if (pctDrop < -30) {
        signals.push({
          type: "LIQUIDITY_VOID",
          action: "EXIT_NOW",
          reason: `LIQUIDITY VOID — ${pctDrop.toFixed(0)}% displacement candle in <5 min. Institutional exit. No bid-side liquidity. EXIT.`,
          confidence: 96,
          urgency: "immediate",
          price: currentPrice,
        });
        return signals;
      }
      if (pctDrop < -15) {
        signals.push({
          type: "LIQUIDITY_VOID",
          action: "EXIT_NOW",
          reason: `DISPLACEMENT — ${pctDrop.toFixed(0)}% drop. Sell-side aggression, no fractal support below. Exit now.`,
          confidence: 90,
          urgency: "immediate",
          price: currentPrice,
        });
        return signals;
      }
    }

    // Find swing points for fractal analysis
    const swings = this.findSwingPoints(last30m);
    const waveState = this.detectWaveStructure(swings, currentPrice);
    const fvgs = this.detectFairValueGaps(last30m);
    const structureShift = this.detectMarketStructure(swings, currentPrice);
    const fractalRepetitions = this.countFractalRepetitions(last30m);
    const liquiditySweep = this.detectLiquiditySweep(swings, last5m, currentPrice);

    // ── WAVE 5 EXHAUSTION — Prepare to exit ──
    if (waveState && waveState.currentWave === 5 && waveState.direction === "bullish") {
      signals.push({
        type: "WAVE_EXHAUSTION",
        action: "SELL_NOW",
        reason: `WAVE 5 EXHAUSTION — Impulse wave completing. Fractal geometry signals reversal imminent. Take profits.`,
        confidence: 82,
        urgency: "immediate",
        price: currentPrice,
      });
    }

    if (waveState && waveState.currentWave === 5 && waveState.direction === "bearish") {
      signals.push({
        type: "WAVE_EXHAUSTION",
        action: "BUY_NOW",
        reason: `BEARISH WAVE 5 COMPLETE — Selling exhaustion. Fractal bottom forming. Prepare for corrective bounce or trend reversal.`,
        confidence: 78,
        urgency: "soon",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.92,
        takeProfit: currentPrice * 1.25,
      });
    }

    // ── WAVE 3 ENTRY — The strongest move ──
    if (waveState && waveState.currentWave === 3 && waveState.direction === "bullish") {
      const conf = 85 + (fractalRepetitions >= 3 ? 10 : fractalRepetitions >= 2 ? 5 : 0);
      signals.push({
        type: "WAVE_IMPULSE",
        action: "BUY_NOW",
        reason: `WAVE 3 IMPULSE — Strongest wave in fractal structure. ${fractalRepetitions > 0 ? `${fractalRepetitions}x fractal repetition confirmed.` : "Momentum building."} Ride it.`,
        confidence: Math.min(conf, 97),
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.92,
        takeProfit: currentPrice * 1.4,
      });
    }

    // ── WAVE 4 CORRECTION — Prepare for Wave 5 entry ──
    if (waveState && waveState.currentWave === 4 && waveState.direction === "bullish") {
      signals.push({
        type: "FRACTAL_CORRECTION",
        action: "WAIT",
        reason: `WAVE 4 CORRECTION — Fractal pullback in progress. Wait for completion, then enter Wave 5.`,
        confidence: 72,
        urgency: "soon",
        price: currentPrice,
      });
    }

    // ── BOS (Break of Structure) — Trend continuation ──
    if (structureShift === "BOS_BULLISH") {
      const conf = 80 + (fractalRepetitions >= 3 ? 10 : 0);
      signals.push({
        type: "STRUCTURE_BREAK",
        action: "BUY_NOW",
        reason: `BULLISH BOS — Higher high confirmed. Market structure intact. Fractal trend continuation.`,
        confidence: Math.min(conf, 95),
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.94,
        takeProfit: currentPrice * 1.3,
      });
    }

    // ── CHOCH (Change of Character) — Reversal warning ──
    if (structureShift === "CHOCH_BEARISH") {
      signals.push({
        type: "STRUCTURE_SHIFT",
        action: "SELL_NOW",
        reason: `BEARISH CHOCH — First lower low after uptrend. Character changed. Fractal structure broken. Exit longs.`,
        confidence: 83,
        urgency: "immediate",
        price: currentPrice,
      });
    }

    if (structureShift === "CHOCH_BULLISH") {
      signals.push({
        type: "STRUCTURE_SHIFT",
        action: "BUY_NOW",
        reason: `BULLISH CHOCH — First higher high after downtrend. Reversal confirmed. Enter with tight stop.`,
        confidence: 80,
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.93,
        takeProfit: currentPrice * 1.3,
      });
    }

    // ── LIQUIDITY SWEEP + DISPLACEMENT — Institutional entry ──
    if (liquiditySweep === "bullish") {
      const conf = 88 + (fractalRepetitions >= 3 ? 7 : 0);
      signals.push({
        type: "LIQUIDITY_SWEEP",
        action: "BUY_NOW",
        reason: `LIQUIDITY SWEEP — Stop hunt below lows followed by displacement candle. Institutional entry zone. High probability long.`,
        confidence: Math.min(conf, 97),
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.93,
        takeProfit: currentPrice * 1.35,
      });
    }

    if (liquiditySweep === "bearish") {
      signals.push({
        type: "LIQUIDITY_SWEEP",
        action: "SELL_NOW",
        reason: `BEARISH LIQUIDITY GRAB — Sweep above highs then rejection. Smart money distribution. Exit longs.`,
        confidence: 85,
        urgency: "immediate",
        price: currentPrice,
      });
    }

    // ── FVG (Fair Value Gap) — Price magnet ──
    const activeFVGs = fvgs.filter(g => !g.filled);
    for (const gap of activeFVGs.slice(-2)) {
      const gapMid = (gap.high + gap.low) / 2;
      const distToGap = Math.abs(currentPrice - gapMid) / currentPrice;

      if (distToGap < 0.02) {
        const isBelowPrice = gapMid < currentPrice;
        signals.push({
          type: "FVG_RETEST",
          action: isBelowPrice ? "BUY_NOW" : "WAIT",
          reason: `FVG RETEST — Price at Fair Value Gap ($${gap.low.toFixed(8)} - $${gap.high.toFixed(8)}). ${isBelowPrice ? "Bullish FVG fill = entry zone." : "Bearish FVG above = resistance."}`,
          confidence: 76,
          urgency: isBelowPrice ? "immediate" : "soon",
          price: currentPrice,
          entry: isBelowPrice ? currentPrice : undefined,
          stopLoss: isBelowPrice ? gap.low * 0.97 : undefined,
          takeProfit: isBelowPrice ? currentPrice * 1.25 : undefined,
        });
      }
    }

    // ── FRACTAL REPETITION — Self-similar patterns across scales ──
    if (fractalRepetitions >= 3 && signals.length === 0) {
      signals.push({
        type: "FRACTAL_PATTERN",
        action: "MONITOR",
        reason: `FRACTAL REPETITION — ${fractalRepetitions}x self-similar pattern detected across scales. High confidence setup forming. Wait for trigger.`,
        confidence: 74,
        urgency: "soon",
        price: currentPrice,
      });
    }

    return signals;
  }

  /** Find swing highs and lows in price data */
  private findSwingPoints(data: PricePoint[]): SwingPoint[] {
    const swings: SwingPoint[] = [];
    if (data.length < 5) return swings;

    for (let i = 2; i < data.length - 2; i++) {
      const isHigh = data[i].price > data[i - 1].price && data[i].price > data[i - 2].price &&
                     data[i].price > data[i + 1].price && data[i].price > data[i + 2].price;
      const isLow = data[i].price < data[i - 1].price && data[i].price < data[i - 2].price &&
                    data[i].price < data[i + 1].price && data[i].price < data[i + 2].price;

      if (isHigh) swings.push({ price: data[i].price, timestamp: data[i].timestamp, type: "high", index: i });
      if (isLow) swings.push({ price: data[i].price, timestamp: data[i].timestamp, type: "low", index: i });
    }
    return swings;
  }

  /** Detect wave structure (1-2-3-4-5 impulse or A-B-C correction) */
  private detectWaveStructure(swings: SwingPoint[], currentPrice: number): WaveState | null {
    if (swings.length < 5) return null;

    const recent = swings.slice(-6);
    const highs = recent.filter(s => s.type === "high");
    const lows = recent.filter(s => s.type === "low");

    if (highs.length < 2 || lows.length < 2) return null;

    // Check for bullish impulse: higher highs + higher lows
    const lastHighs = highs.slice(-3);
    const lastLows = lows.slice(-3);
    const hhCount = lastHighs.filter((h, i) => i === 0 || h.price > lastHighs[i - 1].price).length;
    const hlCount = lastLows.filter((l, i) => i === 0 || l.price > lastLows[i - 1].price).length;

    if (hhCount >= 2 && hlCount >= 2) {
      // Bullish impulse — estimate wave number
      const totalSwings = recent.length;
      const waveNum = Math.min(5, Math.ceil(totalSwings / 2));

      // Check for Wave 5 divergence (price higher but momentum weaker)
      if (waveNum >= 4) {
        const recentMoves = [];
        for (let i = 1; i < recent.length; i++) {
          recentMoves.push(Math.abs(recent[i].price - recent[i - 1].price));
        }
        const firstHalf = recentMoves.slice(0, Math.floor(recentMoves.length / 2));
        const secondHalf = recentMoves.slice(Math.floor(recentMoves.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (secondAvg < firstAvg * 0.6) {
          return { currentWave: 5, direction: "bullish", waveStart: recent[0].price, confidence: 78 };
        }
      }

      // Is current price pulling back? → Wave 4 correction
      const lastHigh = highs[highs.length - 1];
      if (currentPrice < lastHigh.price * 0.97) {
        return { currentWave: 4, direction: "bullish", waveStart: recent[0].price, confidence: 72 };
      }

      return { currentWave: waveNum <= 3 ? 3 : waveNum, direction: "bullish", waveStart: recent[0].price, confidence: 80 };
    }

    // Check for bearish impulse
    const lhCount = lastHighs.filter((h, i) => i === 0 || h.price < lastHighs[i - 1].price).length;
    const llCount = lastLows.filter((l, i) => i === 0 || l.price < lastLows[i - 1].price).length;

    if (lhCount >= 2 && llCount >= 2) {
      const totalSwings = recent.length;
      const waveNum = Math.min(5, Math.ceil(totalSwings / 2));
      return { currentWave: waveNum, direction: "bearish", waveStart: recent[0].price, confidence: 75 };
    }

    return null;
  }

  /** Detect Fair Value Gaps (imbalanced candle bodies with no overlap) */
  private detectFairValueGaps(data: PricePoint[]): FairValueGap[] {
    const gaps: FairValueGap[] = [];
    if (data.length < 4) return gaps;

    // Simulate candles from tick data (group by ~30s intervals)
    const candles = this.groupToCandles(data, 30_000);
    if (candles.length < 3) return gaps;

    for (let i = 2; i < candles.length; i++) {
      const prev = candles[i - 2];
      const curr = candles[i];

      // Bullish FVG: candle[i] low > candle[i-2] high
      if (curr.low > prev.high) {
        gaps.push({ high: curr.low, low: prev.high, timestamp: candles[i - 1].timestamp, filled: false });
      }
      // Bearish FVG: candle[i] high < candle[i-2] low
      if (curr.high < prev.low) {
        gaps.push({ high: prev.low, low: curr.high, timestamp: candles[i - 1].timestamp, filled: false });
      }
    }

    return gaps;
  }

  /** Detect BOS (Break of Structure) and CHOCH (Change of Character) */
  private detectMarketStructure(swings: SwingPoint[], currentPrice: number): string | null {
    if (swings.length < 6) return null;

    const highs = swings.filter(s => s.type === "high").slice(-4);
    const lows = swings.filter(s => s.type === "low").slice(-4);

    if (highs.length < 3 || lows.length < 3) return null;

    // Was in uptrend (HH + HL)?
    const wasUptrend = highs[highs.length - 2].price > highs[highs.length - 3].price &&
                       lows[lows.length - 2].price > lows[lows.length - 3].price;

    // Was in downtrend (LH + LL)?
    const wasDowntrend = highs[highs.length - 2].price < highs[highs.length - 3].price &&
                         lows[lows.length - 2].price < lows[lows.length - 3].price;

    const latestHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const latestLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    // BOS: trend continues
    if (wasUptrend && currentPrice > prevHigh) return "BOS_BULLISH";
    if (wasDowntrend && currentPrice < prevLow) return "BOS_BEARISH";

    // CHOCH: trend breaks
    if (wasUptrend && currentPrice < prevLow) return "CHOCH_BEARISH";
    if (wasDowntrend && currentPrice > prevHigh) return "CHOCH_BULLISH";

    return null;
  }

  /** Detect liquidity sweeps (stop hunts followed by reversal) */
  private detectLiquiditySweep(swings: SwingPoint[], recentData: PricePoint[], currentPrice: number): string | null {
    if (swings.length < 4 || recentData.length < 5) return null;

    const lows = swings.filter(s => s.type === "low").slice(-3);
    const highs = swings.filter(s => s.type === "high").slice(-3);

    // Bullish sweep: price went below recent equal lows then reversed sharply
    if (lows.length >= 2) {
      const equalLows = Math.abs(lows[lows.length - 1].price - lows[lows.length - 2].price) / lows[lows.length - 2].price < 0.015;
      const sweptBelow = recentData.some(p => p.price < lows[lows.length - 1].price * 0.99);
      const reversedUp = currentPrice > lows[lows.length - 1].price * 1.01;

      if (equalLows && sweptBelow && reversedUp) return "bullish";
    }

    // Bearish sweep: price went above equal highs then reversed
    if (highs.length >= 2) {
      const equalHighs = Math.abs(highs[highs.length - 1].price - highs[highs.length - 2].price) / highs[highs.length - 2].price < 0.015;
      const sweptAbove = recentData.some(p => p.price > highs[highs.length - 1].price * 1.01);
      const reversedDown = currentPrice < highs[highs.length - 1].price * 0.99;

      if (equalHighs && sweptAbove && reversedDown) return "bearish";
    }

    return null;
  }

  /** Count fractal repetitions — self-similar patterns at different scales */
  private countFractalRepetitions(data: PricePoint[]): number {
    if (data.length < 20) return 0;

    // Compare move ratios at different scales (mini-fractals)
    const scales = [
      data.slice(-10),
      data.slice(-20, -10),
      data.slice(-30, -20),
    ].filter(s => s.length >= 5);

    if (scales.length < 2) return 0;

    let matches = 0;
    const getRatio = (segment: PricePoint[]) => {
      const high = Math.max(...segment.map(p => p.price));
      const low = Math.min(...segment.map(p => p.price));
      const start = segment[0].price;
      const end = segment[segment.length - 1].price;
      return { range: (high - low) / low, direction: end > start ? 1 : -1 };
    };

    const baseRatio = getRatio(scales[0]);
    for (let i = 1; i < scales.length; i++) {
      const ratio = getRatio(scales[i]);
      // Similar range ratio AND same direction = fractal repetition
      if (ratio.direction === baseRatio.direction &&
          Math.abs(ratio.range - baseRatio.range) < baseRatio.range * 0.4) {
        matches++;
      }
    }

    return matches;
  }

  /** Group tick data into pseudo-candles */
  private groupToCandles(data: PricePoint[], intervalMs: number): Array<{ open: number; high: number; low: number; close: number; timestamp: number }> {
    if (data.length === 0) return [];

    const candles: Array<{ open: number; high: number; low: number; close: number; timestamp: number }> = [];
    let bucket = [data[0]];
    let bucketStart = data[0].timestamp;

    for (let i = 1; i < data.length; i++) {
      if (data[i].timestamp - bucketStart < intervalMs) {
        bucket.push(data[i]);
      } else {
        const prices = bucket.map(b => b.price);
        candles.push({
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[prices.length - 1],
          timestamp: bucketStart,
        });
        bucket = [data[i]];
        bucketStart = data[i].timestamp;
      }
    }
    // Last bucket
    if (bucket.length > 0) {
      const prices = bucket.map(b => b.price);
      candles.push({
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        timestamp: bucketStart,
      });
    }

    return candles;
  }

  hasFrameChanged(frameDataUrl: string): boolean {
    if (!this.lastFrameData) {
      this.lastFrameData = frameDataUrl;
      return true;
    }
    const lenDiff = Math.abs(frameDataUrl.length - this.lastFrameData.length) / Math.max(frameDataUrl.length, 1);
    this.lastFrameData = frameDataUrl;
    return lenDiff > this.changeThreshold;
  }

  getStats() {
    if (this.priceHistory.length < 2) return null;
    const prices = this.priceHistory.map(p => p.price);
    const current = prices[prices.length - 1];
    const oldest = prices[0];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const change = ((current - oldest) / oldest) * 100;
    return { current, high, low, change, dataPoints: prices.length };
  }

  reset() {
    this.priceHistory = [];
    this.lastFrameData = null;
  }
}
