import { PricePoint, LocalSignal, CrossContext } from "./types";

/**
 * NESTAL FRACTAL LOCAL INTELLIGENCE ENGINE
 * Runs entirely in the browser — no API calls.
 * Pure Nestal Fractal strategy:
 *   - 3 engine patterns: Sweep→Reclaim, Break→Retest→Continuation, Range Fade
 *   - 2 confirmations required: Structure + Execution
 *   - Two Strikes rule, Distance/Time filters, Risk rules
 *   - Fractal geometry layer: waves, liquidity, FVGs, BOS/CHOCH
 */

interface SwingPoint {
  price: number;
  timestamp: number;
  type: "high" | "low";
  index: number;
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
  // Track pattern strikes per session
  private patternStrikes: Record<string, number> = {};
  private sessionTradeCount = 0;
  private sessionLossCount = 0;

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

  /** NESTAL FRACTAL pattern detection — 3 engine patterns only, <50ms */
  detectLocalPatterns(currentContext: CrossContext): LocalSignal[] {
    const signals: LocalSignal[] = [];
    if (!currentContext.pair || !currentContext.price) return signals;

    const currentPrice = parseFloat(currentContext.price.replace(/[$,]/g, ""));
    if (isNaN(currentPrice)) return signals;

    const history = this.getHistory(currentContext.pair);
    if (history.length < 10) return signals;

    // Session limits: max 3 trades, max 2 losses
    if (this.sessionTradeCount >= 3) {
      signals.push({
        type: "FRACTAL_PATTERN",
        action: "WAIT",
        reason: "SESSION LIMIT — Max 3 trades reached. Stop trading this session.",
        confidence: 99,
        urgency: "watch",
        price: currentPrice,
      });
      return signals;
    }
    if (this.sessionLossCount >= 2) {
      signals.push({
        type: "FRACTAL_PATTERN",
        action: "WAIT",
        reason: "SESSION LIMIT — 2 losses hit. Stop trading this session.",
        confidence: 99,
        urgency: "watch",
        price: currentPrice,
      });
      return signals;
    }

    const now = Date.now();
    const last5m = history.filter(p => now - p.timestamp < 300_000);
    const last30m = history.filter(p => now - p.timestamp < 1_800_000);

    // ── DISPLACEMENT EVENT (Liquidity void — exit immediately) ──
    if (last5m.length >= 3) {
      const oldest = last5m[0].price;
      const pctDrop = ((currentPrice - oldest) / oldest) * 100;
      if (pctDrop < -30) {
        signals.push({
          type: "LIQUIDITY_VOID",
          action: "EXIT_NOW",
          reason: `LIQUIDITY VOID — ${pctDrop.toFixed(0)}% displacement in <5 min. No bid-side liquidity. EXIT EVERYTHING.`,
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
          reason: `DISPLACEMENT — ${pctDrop.toFixed(0)}% drop. Sell-side aggression. Exit now.`,
          confidence: 90,
          urgency: "immediate",
          price: currentPrice,
        });
        return signals;
      }
    }

    const swings = this.findSwingPoints(last30m);
    const fractalRepetitions = this.countFractalRepetitions(last30m);

    // ── ENGINE PATTERN A: SWEEP → RECLAIM (Liquidity Grab) ──
    const sweepSignal = this.detectSweepReclaim(swings, last5m, currentPrice, fractalRepetitions);
    if (sweepSignal) signals.push(sweepSignal);

    // ── ENGINE PATTERN B: BREAKOUT → RETEST → CONTINUATION ──
    const retestSignal = this.detectBreakRetest(swings, last5m, last30m, currentPrice, fractalRepetitions);
    if (retestSignal) signals.push(retestSignal);

    // ── ENGINE PATTERN C: RANGE FADE (Mean Reversion) ──
    const rangeSignal = this.detectRangeFade(last30m, currentPrice, fractalRepetitions);
    if (rangeSignal) signals.push(rangeSignal);

    // ── FRACTAL GEOMETRY OVERLAY ──
    // Wave structure context
    const waveState = this.detectWaveStructure(swings, currentPrice);
    if (waveState) {
      if (waveState.wave === 5 && waveState.direction === "bullish" && signals.length === 0) {
        signals.push({
          type: "WAVE_EXHAUSTION",
          action: "SELL_NOW",
          reason: `WAVE 5 EXHAUSTION — Impulse completing. Fractal geometry signals reversal. Take profits.`,
          confidence: 80,
          urgency: "immediate",
          price: currentPrice,
        });
      }
      if (waveState.wave === 3 && waveState.direction === "bullish") {
        // Boost any existing buy signals
        for (const sig of signals) {
          if (sig.action === "BUY_NOW") {
            sig.confidence = Math.min(97, sig.confidence + 10);
            sig.reason += " | Wave 3 impulse confirmation.";
          }
        }
      }
    }

    // Market structure context (BOS/CHOCH)
    const structure = this.detectMarketStructure(swings, currentPrice);
    if (structure === "CHOCH_BEARISH" && signals.length === 0) {
      signals.push({
        type: "STRUCTURE_SHIFT",
        action: "SELL_NOW",
        reason: `BEARISH CHOCH — Character changed. First lower low after uptrend. Exit longs.`,
        confidence: 83,
        urgency: "immediate",
        price: currentPrice,
      });
    }
    if (structure === "CHOCH_BULLISH" && signals.length === 0) {
      signals.push({
        type: "STRUCTURE_SHIFT",
        action: "BUY_NOW",
        reason: `BULLISH CHOCH — First higher high after downtrend. Reversal confirmed.`,
        confidence: 80,
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss: currentPrice * 0.93,
        takeProfit: currentPrice * 1.3,
      });
    }

    // FVG context
    const fvgs = this.detectFairValueGaps(last30m);
    const activeFVGs = fvgs.filter(g => !g.filled);
    for (const gap of activeFVGs.slice(-1)) {
      const gapMid = (gap.high + gap.low) / 2;
      const distToGap = Math.abs(currentPrice - gapMid) / currentPrice;
      if (distToGap < 0.02 && signals.length === 0) {
        const isBelowPrice = gapMid < currentPrice;
        signals.push({
          type: "FVG_RETEST",
          action: isBelowPrice ? "MONITOR" : "WAIT",
          reason: `FVG zone ($${gap.low.toFixed(8)} - $${gap.high.toFixed(8)}). ${isBelowPrice ? "Potential support — wait for engine pattern trigger." : "Resistance overhead."}`,
          confidence: 68,
          urgency: "soon",
          price: currentPrice,
        });
      }
    }

    // Fractal repetition context (no pattern yet)
    if (fractalRepetitions >= 3 && signals.length === 0) {
      signals.push({
        type: "FRACTAL_PATTERN",
        action: "MONITOR",
        reason: `${fractalRepetitions}x self-similar fractal detected. High-confidence setup forming. Wait for engine pattern trigger.`,
        confidence: 74,
        urgency: "soon",
        price: currentPrice,
      });
    }

    return signals;
  }

  /** ENGINE PATTERN A: Sweep → Reclaim */
  private detectSweepReclaim(swings: SwingPoint[], recentData: PricePoint[], currentPrice: number, fractalReps: number): LocalSignal | null {
    const lows = swings.filter(s => s.type === "low").slice(-3);
    const highs = swings.filter(s => s.type === "high").slice(-3);

    // Bullish sweep-reclaim: equal lows swept then reclaimed
    if (lows.length >= 2) {
      const equalLows = Math.abs(lows[lows.length - 1].price - lows[lows.length - 2].price) / lows[lows.length - 2].price < 0.015;
      const sweptBelow = recentData.some(p => p.price < lows[lows.length - 1].price * 0.99);
      const reclaimedAbove = currentPrice > lows[lows.length - 1].price * 1.005;

      if (equalLows && sweptBelow && reclaimedAbove) {
        const sweepExtreme = Math.min(...recentData.map(p => p.price));
        const stopLoss = sweepExtreme * 0.995;
        const target = currentPrice + (currentPrice - stopLoss) * 2;
        const rr = (target - currentPrice) / (currentPrice - stopLoss);

        if (rr < 1.5) return null; // R:R too low

        const strikes = this.patternStrikes["sweep_reclaim"] || 0;
        if (strikes >= 2) {
          return {
            type: "FRACTAL_PATTERN",
            action: "WAIT",
            reason: `SWEEP-RECLAIM invalidated — Failed ${strikes}x this session. Done.`,
            confidence: 90,
            urgency: "watch",
            price: currentPrice,
          };
        }

        const conf = 85 + (fractalReps >= 3 ? 10 : fractalReps >= 2 ? 5 : 0);
        return {
          type: "LIQUIDITY_SWEEP",
          action: "BUY_NOW",
          reason: `SWEEP → RECLAIM — Liquidity grabbed below equal lows, price reclaimed. Stop hunt complete. R:R ${rr.toFixed(1)}R.${strikes === 1 ? " ⚠️ 2nd attempt — be cautious on 3rd." : ""}`,
          confidence: Math.min(conf, 97),
          urgency: "immediate",
          price: currentPrice,
          entry: currentPrice,
          stopLoss,
          takeProfit: target,
        };
      }
    }

    // Bearish sweep-reclaim: equal highs swept then rejected
    if (highs.length >= 2) {
      const equalHighs = Math.abs(highs[highs.length - 1].price - highs[highs.length - 2].price) / highs[highs.length - 2].price < 0.015;
      const sweptAbove = recentData.some(p => p.price > highs[highs.length - 1].price * 1.01);
      const rejectedBelow = currentPrice < highs[highs.length - 1].price * 0.995;

      if (equalHighs && sweptAbove && rejectedBelow) {
        return {
          type: "LIQUIDITY_SWEEP",
          action: "SELL_NOW",
          reason: `BEARISH SWEEP → RECLAIM — Liquidity grabbed above equal highs, rejected. Smart money distribution.`,
          confidence: 84,
          urgency: "immediate",
          price: currentPrice,
        };
      }
    }

    return null;
  }

  /** ENGINE PATTERN B: Breakout → Retest → Continuation */
  private detectBreakRetest(swings: SwingPoint[], recentData: PricePoint[], allData: PricePoint[], currentPrice: number, fractalReps: number): LocalSignal | null {
    if (swings.length < 6 || allData.length < 15) return null;

    const highs = swings.filter(s => s.type === "high").slice(-4);
    const lows = swings.filter(s => s.type === "low").slice(-4);

    // Bullish break-retest: broke above resistance, now retesting it as support
    if (highs.length >= 3) {
      const resistanceLevel = highs[highs.length - 2].price;
      const brokeAbove = highs[highs.length - 1].price > resistanceLevel * 1.01;
      const retesting = Math.abs(currentPrice - resistanceLevel) / resistanceLevel < 0.015;
      const holdingAbove = currentPrice > resistanceLevel * 0.995;

      // Execution confirmation: check for rejection wick or hold
      const recentAboveLevel = recentData.filter(p => p.price >= resistanceLevel * 0.99).length;
      const hasHold = recentAboveLevel >= Math.floor(recentData.length * 0.6);

      if (brokeAbove && retesting && holdingAbove && hasHold) {
        const stopLoss = resistanceLevel * 0.985;
        const target = currentPrice + (currentPrice - stopLoss) * 2;
        const rr = (target - currentPrice) / (currentPrice - stopLoss);

        if (rr < 1.5) return null;

        const strikes = this.patternStrikes["break_retest"] || 0;
        if (strikes >= 2) {
          return {
            type: "FRACTAL_PATTERN",
            action: "WAIT",
            reason: `BREAK-RETEST invalidated — Failed ${strikes}x this session.`,
            confidence: 90,
            urgency: "watch",
            price: currentPrice,
          };
        }

        const conf = 82 + (fractalReps >= 3 ? 10 : 0);
        return {
          type: "STRUCTURE_BREAK",
          action: "BUY_NOW",
          reason: `BREAK → RETEST → CONTINUATION — Broke $${resistanceLevel.toFixed(8)}, retesting as support, holding. R:R ${rr.toFixed(1)}R.`,
          confidence: Math.min(conf, 95),
          urgency: "immediate",
          price: currentPrice,
          entry: currentPrice,
          stopLoss,
          takeProfit: target,
        };
      }
    }

    return null;
  }

  /** ENGINE PATTERN C: Range Fade (Mean Reversion) */
  private detectRangeFade(data: PricePoint[], currentPrice: number, fractalReps: number): LocalSignal | null {
    if (data.length < 20) return null;

    const prices = data.map(p => p.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const range = (high - low) / low;

    // Only valid if range is < 15% (actual range, not trending)
    if (range > 0.15 || range < 0.02) return null;

    const mid = (high + low) / 2;
    const distFromHigh = (high - currentPrice) / (high - low);
    const distFromLow = (currentPrice - low) / (high - low);

    // At upper boundary — fade short
    if (distFromHigh < 0.1) {
      const stopLoss = high * 1.005;
      const target = mid;
      const rr = (currentPrice - target) / (stopLoss - currentPrice);

      if (rr < 1.5) return null;

      return {
        type: "FRACTAL_PATTERN",
        action: "SELL_NOW",
        reason: `RANGE FADE — At upper boundary ($${high.toFixed(8)}). Mean reversion to $${mid.toFixed(8)}. R:R ${rr.toFixed(1)}R.`,
        confidence: 74 + (fractalReps >= 3 ? 8 : 0),
        urgency: "immediate",
        price: currentPrice,
      };
    }

    // At lower boundary — fade long
    if (distFromLow < 0.1) {
      const stopLoss = low * 0.995;
      const target = mid;
      const rr = (target - currentPrice) / (currentPrice - stopLoss);

      if (rr < 1.5) return null;

      return {
        type: "FRACTAL_PATTERN",
        action: "BUY_NOW",
        reason: `RANGE FADE — At lower boundary ($${low.toFixed(8)}). Mean reversion to $${mid.toFixed(8)}. R:R ${rr.toFixed(1)}R.`,
        confidence: 74 + (fractalReps >= 3 ? 8 : 0),
        urgency: "immediate",
        price: currentPrice,
        entry: currentPrice,
        stopLoss,
        takeProfit: target,
      };
    }

    return null;
  }

  /** Find swing highs and lows */
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

  /** Detect wave structure (1-5 impulse) */
  private detectWaveStructure(swings: SwingPoint[], currentPrice: number): { wave: number; direction: "bullish" | "bearish" } | null {
    if (swings.length < 5) return null;

    const recent = swings.slice(-6);
    const highs = recent.filter(s => s.type === "high");
    const lows = recent.filter(s => s.type === "low");
    if (highs.length < 2 || lows.length < 2) return null;

    const lastHighs = highs.slice(-3);
    const lastLows = lows.slice(-3);
    const hhCount = lastHighs.filter((h, i) => i === 0 || h.price > lastHighs[i - 1].price).length;
    const hlCount = lastLows.filter((l, i) => i === 0 || l.price > lastLows[i - 1].price).length;

    if (hhCount >= 2 && hlCount >= 2) {
      const totalSwings = recent.length;
      const waveNum = Math.min(5, Math.ceil(totalSwings / 2));

      // Wave 5 divergence check
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
          return { wave: 5, direction: "bullish" };
        }
      }

      if (currentPrice < highs[highs.length - 1].price * 0.97) {
        return { wave: 4, direction: "bullish" };
      }

      return { wave: waveNum <= 3 ? 3 : waveNum, direction: "bullish" };
    }

    return null;
  }

  /** Detect BOS/CHOCH */
  private detectMarketStructure(swings: SwingPoint[], currentPrice: number): string | null {
    if (swings.length < 6) return null;

    const highs = swings.filter(s => s.type === "high").slice(-4);
    const lows = swings.filter(s => s.type === "low").slice(-4);
    if (highs.length < 3 || lows.length < 3) return null;

    const wasUptrend = highs[highs.length - 2].price > highs[highs.length - 3].price &&
                       lows[lows.length - 2].price > lows[lows.length - 3].price;
    const wasDowntrend = highs[highs.length - 2].price < highs[highs.length - 3].price &&
                         lows[lows.length - 2].price < lows[lows.length - 3].price;

    const prevHigh = highs[highs.length - 2].price;
    const prevLow = lows[lows.length - 2].price;

    if (wasUptrend && currentPrice < prevLow) return "CHOCH_BEARISH";
    if (wasDowntrend && currentPrice > prevHigh) return "CHOCH_BULLISH";
    if (wasUptrend && currentPrice > prevHigh) return "BOS_BULLISH";

    return null;
  }

  /** Detect Fair Value Gaps */
  private detectFairValueGaps(data: PricePoint[]): FairValueGap[] {
    const gaps: FairValueGap[] = [];
    if (data.length < 4) return gaps;

    const candles = this.groupToCandles(data, 30_000);
    if (candles.length < 3) return gaps;

    for (let i = 2; i < candles.length; i++) {
      const prev = candles[i - 2];
      const curr = candles[i];
      if (curr.low > prev.high) {
        gaps.push({ high: curr.low, low: prev.high, timestamp: candles[i - 1].timestamp, filled: false });
      }
      if (curr.high < prev.low) {
        gaps.push({ high: prev.low, low: curr.high, timestamp: candles[i - 1].timestamp, filled: false });
      }
    }
    return gaps;
  }

  /** Count fractal repetitions across scales */
  private countFractalRepetitions(data: PricePoint[]): number {
    if (data.length < 20) return 0;

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
    this.patternStrikes = {};
    this.sessionTradeCount = 0;
    this.sessionLossCount = 0;
  }

  /** Call when a trade completes to track session limits */
  recordTradeResult(won: boolean) {
    this.sessionTradeCount++;
    if (!won) this.sessionLossCount++;
  }

  /** Call when a pattern fails to track strikes */
  recordPatternFailure(pattern: "sweep_reclaim" | "break_retest" | "range_fade") {
    this.patternStrikes[pattern] = (this.patternStrikes[pattern] || 0) + 1;
  }
}
