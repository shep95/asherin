import { PricePoint, LocalSignal, CrossContext } from "./types";

/**
 * LOCAL INTELLIGENCE ENGINE
 * Runs entirely in the browser — no API calls.
 * Tracks price history from AI responses and detects meme coin patterns locally.
 */
export class LocalIntelligenceEngine {
  private priceHistory: PricePoint[] = [];
  private maxHistory = 500;
  private lastFrameData: string | null = null;
  private changeThreshold = 0.02; // 2% pixel change to trigger re-analysis

  /** Record a price from AI analysis */
  recordPrice(context: CrossContext) {
    if (!context.price || !context.pair) return;
    const price = parseFloat(context.price.replace(/[$,]/g, ""));
    if (isNaN(price) || price <= 0) return;

    this.priceHistory.push({
      price,
      timestamp: Date.now(),
      pair: context.pair,
    });

    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory = this.priceHistory.slice(-this.maxHistory);
    }
  }

  /** Get price history for current pair */
  getHistory(pair?: string): PricePoint[] {
    if (!pair) return this.priceHistory;
    return this.priceHistory.filter(p => p.pair === pair);
  }

  /** Detect local patterns from price history (no API needed) */
  detectLocalPatterns(currentContext: CrossContext): LocalSignal[] {
    const signals: LocalSignal[] = [];
    if (!currentContext.pair || !currentContext.price) return signals;

    const currentPrice = parseFloat(currentContext.price.replace(/[$,]/g, ""));
    if (isNaN(currentPrice)) return signals;

    const history = this.getHistory(currentContext.pair);
    if (history.length < 5) return signals;

    const now = Date.now();
    const last1m = history.filter(p => now - p.timestamp < 60_000);
    const last5m = history.filter(p => now - p.timestamp < 300_000);
    const last30m = history.filter(p => now - p.timestamp < 1_800_000);

    // --- PUMP DETECTION ---
    if (last1m.length >= 3) {
      const oldest1m = last1m[0].price;
      const pctChange1m = ((currentPrice - oldest1m) / oldest1m) * 100;

      if (pctChange1m > 10) {
        signals.push({
          type: "PUMP_DETECTED",
          action: pctChange1m > 25 ? "MONITOR" : "BUY_NOW",
          reason: `Price up ${pctChange1m.toFixed(1)}% in 1 min${pctChange1m > 25 ? " — may be too late, watch for dump" : " — early pump detected"}`,
          confidence: pctChange1m > 25 ? 60 : 82,
          urgency: "immediate",
          price: currentPrice,
          entry: currentPrice,
          stopLoss: currentPrice * 0.9,
          takeProfit: currentPrice * 1.3,
        });
      }
    }

    // --- DUMP DETECTION ---
    if (last1m.length >= 3) {
      const oldest1m = last1m[0].price;
      const pctDrop = ((currentPrice - oldest1m) / oldest1m) * 100;

      if (pctDrop < -15) {
        signals.push({
          type: "DUMP_DETECTED",
          action: "EXIT_NOW",
          reason: `Price crashed ${pctDrop.toFixed(1)}% in 1 min — EXIT IMMEDIATELY`,
          confidence: 90,
          urgency: "immediate",
          price: currentPrice,
        });
      } else if (pctDrop < -8) {
        signals.push({
          type: "DUMP_DETECTED",
          action: "SELL_NOW",
          reason: `Price dropping ${pctDrop.toFixed(1)}% in 1 min — take profits or cut losses`,
          confidence: 78,
          urgency: "immediate",
          price: currentPrice,
        });
      }
    }

    // --- PRICE ACCELERATION ---
    if (last5m.length >= 5) {
      const firstHalf = last5m.slice(0, Math.floor(last5m.length / 2));
      const secondHalf = last5m.slice(Math.floor(last5m.length / 2));
      const firstRate = (firstHalf[firstHalf.length - 1].price - firstHalf[0].price) / firstHalf[0].price;
      const secondRate = (secondHalf[secondHalf.length - 1].price - secondHalf[0].price) / secondHalf[0].price;

      if (secondRate > firstRate * 2 && secondRate > 0.03) {
        signals.push({
          type: "PRICE_ACCELERATION",
          action: "BUY_NOW",
          reason: `Price acceleration detected — momentum building (${(secondRate * 100).toFixed(1)}% rate)`,
          confidence: 75,
          urgency: "immediate",
          price: currentPrice,
          entry: currentPrice,
          stopLoss: currentPrice * 0.92,
          takeProfit: currentPrice * 1.25,
        });
      }
    }

    // --- SUPPORT BOUNCE ---
    if (last30m.length >= 10) {
      const prices = last30m.map(p => p.price);
      const minPrice = Math.min(...prices);
      const distFromLow = ((currentPrice - minPrice) / minPrice) * 100;

      // Count how many times price touched near minimum
      const touchCount = prices.filter(p => Math.abs(p - minPrice) / minPrice < 0.02).length;

      if (distFromLow < 3 && touchCount >= 3) {
        signals.push({
          type: "SUPPORT_BOUNCE",
          action: "BUY_NOW",
          reason: `Price near support (touched ${touchCount}x) — bounce probability high`,
          confidence: 80,
          urgency: "soon",
          price: currentPrice,
          entry: currentPrice,
          stopLoss: minPrice * 0.95,
          takeProfit: currentPrice * 1.2,
        });
      }
    }

    // --- RESISTANCE HIT ---
    if (last30m.length >= 10) {
      const prices = last30m.map(p => p.price);
      const maxPrice = Math.max(...prices);
      const distFromHigh = ((maxPrice - currentPrice) / maxPrice) * 100;
      const touchCount = prices.filter(p => Math.abs(p - maxPrice) / maxPrice < 0.02).length;

      if (distFromHigh < 2 && touchCount >= 2) {
        signals.push({
          type: "RESISTANCE_HIT",
          action: "MONITOR",
          reason: `Price at resistance (touched ${touchCount}x) — watch for breakout or rejection`,
          confidence: 70,
          urgency: "soon",
          price: currentPrice,
        });
      }
    }

    // --- MOMENTUM SHIFT (bearish) ---
    if (last5m.length >= 8) {
      const recent3 = last5m.slice(-3);
      const allFalling = recent3.every((p, i) => i === 0 || p.price < recent3[i - 1].price);
      const prev3 = last5m.slice(-6, -3);
      const wereRising = prev3.length >= 3 && prev3.every((p, i) => i === 0 || p.price >= prev3[i - 1].price);

      if (allFalling && wereRising) {
        signals.push({
          type: "MOMENTUM_SHIFT",
          action: "SELL_NOW",
          reason: "Momentum shifted bearish — was rising, now falling",
          confidence: 72,
          urgency: "soon",
          price: currentPrice,
        });
      }
    }

    return signals;
  }

  /** Simple pixel-based change detection using canvas data */
  hasFrameChanged(frameDataUrl: string): boolean {
    if (!this.lastFrameData) {
      this.lastFrameData = frameDataUrl;
      return true;
    }

    // Simple length-based heuristic (actual pixel diff would need canvas comparison)
    const lenDiff = Math.abs(frameDataUrl.length - this.lastFrameData.length) / Math.max(frameDataUrl.length, 1);
    this.lastFrameData = frameDataUrl;

    return lenDiff > this.changeThreshold;
  }

  /** Get summary stats */
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
