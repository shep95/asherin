/**
 * AUREON QLIB QUANT ENGINE
 * Reverse-engineered from Microsoft's Qlib (15K+ ⭐)
 * Implements alpha factor engineering, portfolio optimization,
 * and quantitative trading signal generation for AZIION/Lavba.
 */

// ── ALPHA FACTORS ───────────────────────────────────────────────────────

export interface AlphaFactor {
  id: string;
  name: string;
  category: "momentum" | "value" | "quality" | "volatility" | "liquidity" | "sentiment";
  formula: string;
  lookback: number; // days
  description: string;
  weight: number;
}

export const ALPHA_FACTORS: AlphaFactor[] = [
  // Momentum Factors
  {
    id: "mom_5d",
    name: "5-Day Momentum",
    category: "momentum",
    formula: "close / delay(close, 5) - 1",
    lookback: 5,
    description: "Short-term price momentum over 5 trading days",
    weight: 0.15,
  },
  {
    id: "mom_20d",
    name: "20-Day Momentum",
    category: "momentum",
    formula: "close / delay(close, 20) - 1",
    lookback: 20,
    description: "Medium-term price momentum over 20 trading days",
    weight: 0.12,
  },
  {
    id: "mom_rsi",
    name: "RSI Divergence",
    category: "momentum",
    formula: "RSI(14) - SMA(RSI(14), 5)",
    lookback: 14,
    description: "RSI divergence from its moving average — signals overbought/oversold reversal",
    weight: 0.10,
  },
  // Value Factors
  {
    id: "val_pb",
    name: "Price-to-Book Ratio",
    category: "value",
    formula: "1 / (price / book_value)",
    lookback: 1,
    description: "Inverse P/B — higher values indicate cheaper stocks",
    weight: 0.08,
  },
  {
    id: "val_ep",
    name: "Earnings Yield",
    category: "value",
    formula: "earnings / market_cap",
    lookback: 1,
    description: "Earnings yield — higher indicates undervaluation",
    weight: 0.10,
  },
  // Quality Factors
  {
    id: "qual_roe",
    name: "Return on Equity",
    category: "quality",
    formula: "net_income / shareholders_equity",
    lookback: 1,
    description: "ROE — measures profitability relative to equity",
    weight: 0.10,
  },
  {
    id: "qual_gm",
    name: "Gross Margin Stability",
    category: "quality",
    formula: "std(gross_margin, 8Q) * -1",
    lookback: 90,
    description: "Negative standard deviation of gross margin — stability is good",
    weight: 0.05,
  },
  // Volatility Factors
  {
    id: "vol_realized",
    name: "Realized Volatility",
    category: "volatility",
    formula: "std(returns, 20) * sqrt(252)",
    lookback: 20,
    description: "Annualized 20-day realized volatility",
    weight: 0.08,
  },
  {
    id: "vol_atr",
    name: "ATR Ratio",
    category: "volatility",
    formula: "ATR(14) / close",
    lookback: 14,
    description: "Average True Range as percentage of price — measures intraday volatility",
    weight: 0.07,
  },
  // Liquidity Factors
  {
    id: "liq_turnover",
    name: "Turnover Rate",
    category: "liquidity",
    formula: "volume / shares_outstanding",
    lookback: 20,
    description: "20-day average turnover rate — liquidity proxy",
    weight: 0.05,
  },
  // Sentiment Factors
  {
    id: "sent_vwap",
    name: "VWAP Deviation",
    category: "sentiment",
    formula: "(close - VWAP) / VWAP",
    lookback: 1,
    description: "Price deviation from VWAP — institutional flow signal",
    weight: 0.10,
  },
];

// ── PORTFOLIO OPTIMIZATION ──────────────────────────────────────────────

export interface PortfolioAsset {
  symbol: string;
  weight: number;
  expectedReturn: number;
  risk: number;
  alphaScore: number;
  factorExposures: Record<string, number>;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  diversificationRatio: number;
  herfindahlIndex: number;
}

/**
 * Calculate composite alpha score from individual factors.
 * Qlib-style weighted factor combination.
 */
export function calculateAlphaScore(
  factorValues: Record<string, number>,
  customWeights?: Record<string, number>
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const factor of ALPHA_FACTORS) {
    const value = factorValues[factor.id];
    if (value === undefined || isNaN(value)) continue;
    
    const weight = customWeights?.[factor.id] ?? factor.weight;
    // Z-score normalization (simplified — in production would use rolling window)
    const normalizedValue = Math.tanh(value * 2); // soft clipping to [-1, 1]
    totalScore += normalizedValue * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Calculate portfolio-level metrics.
 * Simplified Markowitz-inspired optimization.
 */
export function calculatePortfolioMetrics(assets: PortfolioAsset[]): PortfolioMetrics {
  const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) {
    return { expectedReturn: 0, risk: 0, sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, calmarRatio: 0, diversificationRatio: 0, herfindahlIndex: 0 };
  }
  
  const normalizedAssets = assets.map(a => ({ ...a, weight: a.weight / totalWeight }));
  
  const expectedReturn = normalizedAssets.reduce((sum, a) => sum + a.weight * a.expectedReturn, 0);
  const portfolioVariance = normalizedAssets.reduce((sum, a) => sum + (a.weight * a.risk) ** 2, 0);
  const risk = Math.sqrt(portfolioVariance);
  
  const riskFreeRate = 0.045; // 4.5% risk-free rate
  const sharpeRatio = risk > 0 ? (expectedReturn - riskFreeRate) / risk : 0;
  
  // Sortino (simplified — using risk as downside deviation proxy)
  const sortinoRatio = risk > 0 ? (expectedReturn - riskFreeRate) / (risk * 0.7) : 0;
  
  // Max drawdown estimate (simplified from volatility)
  const maxDrawdown = risk * 2.5;
  const calmarRatio = maxDrawdown > 0 ? expectedReturn / maxDrawdown : 0;
  
  // Diversification ratio
  const weightedAvgRisk = normalizedAssets.reduce((sum, a) => sum + a.weight * a.risk, 0);
  const diversificationRatio = risk > 0 ? weightedAvgRisk / risk : 1;
  
  // Herfindahl concentration index
  const herfindahlIndex = normalizedAssets.reduce((sum, a) => sum + a.weight ** 2, 0);
  
  return { expectedReturn, risk, sharpeRatio, sortinoRatio, maxDrawdown, calmarRatio, diversificationRatio, herfindahlIndex };
}

// ── SIGNAL GENERATION ───────────────────────────────────────────────────

export interface TradeSignal {
  symbol: string;
  direction: "long" | "short" | "neutral";
  confidence: number;
  alphaScore: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  positionSizePercent: number;
  factors: { name: string; value: number; contribution: number }[];
  reasoning: string;
}

/**
 * Generate trade signal from alpha factors.
 * Kelly criterion for position sizing.
 */
export function generateTradeSignal(
  symbol: string,
  currentPrice: number,
  factorValues: Record<string, number>,
  volatility: number,
  winRate: number = 0.55
): TradeSignal {
  const alphaScore = calculateAlphaScore(factorValues);
  const direction = alphaScore > 0.15 ? "long" : alphaScore < -0.15 ? "short" : "neutral";
  const confidence = Math.min(Math.abs(alphaScore) * 2, 1.0);
  
  // ATR-based stop loss
  const atrMultiplier = 2.0;
  const atr = currentPrice * volatility * Math.sqrt(1 / 252);
  
  const stopLoss = direction === "long"
    ? currentPrice - atr * atrMultiplier
    : currentPrice + atr * atrMultiplier;
  
  const riskPerTrade = Math.abs(currentPrice - stopLoss);
  const takeProfit1 = direction === "long" ? currentPrice + riskPerTrade * 1.5 : currentPrice - riskPerTrade * 1.5;
  const takeProfit2 = direction === "long" ? currentPrice + riskPerTrade * 2.5 : currentPrice - riskPerTrade * 2.5;
  const takeProfit3 = direction === "long" ? currentPrice + riskPerTrade * 4.0 : currentPrice - riskPerTrade * 4.0;
  
  const riskRewardRatio = riskPerTrade > 0 ? Math.abs(takeProfit2 - currentPrice) / riskPerTrade : 0;
  
  // Kelly criterion position sizing
  const avgWin = riskPerTrade * 2.5;
  const avgLoss = riskPerTrade;
  const kellyFraction = avgLoss > 0 ? (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin : 0;
  const positionSizePercent = Math.max(0, Math.min(kellyFraction * 0.5, 0.25)) * 100; // half-Kelly, max 25%
  
  // Factor contributions
  const factors = ALPHA_FACTORS.filter(f => factorValues[f.id] !== undefined).map(f => ({
    name: f.name,
    value: factorValues[f.id],
    contribution: Math.tanh(factorValues[f.id] * 2) * f.weight,
  }));
  
  const topFactors = factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
  const reasoning = `${direction.toUpperCase()} signal (${(confidence * 100).toFixed(0)}% confidence) driven by ${topFactors.map(f => f.name).join(", ")}. Alpha: ${alphaScore.toFixed(3)}, R:R ${riskRewardRatio.toFixed(1)}, Kelly size: ${positionSizePercent.toFixed(1)}%`;
  
  return {
    symbol, direction, confidence, alphaScore,
    entryPrice: currentPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3,
    riskRewardRatio, positionSizePercent, factors, reasoning,
  };
}

// ── RISK MANAGEMENT ─────────────────────────────────────────────────────

export interface RiskLimits {
  maxPositionSize: number;
  maxPortfolioExposure: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxCorrelation: number;
  maxLeverage: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSize: 0.25,    // 25% of portfolio
  maxPortfolioExposure: 1.0, // 100% net exposure
  maxDailyLoss: 0.03,       // 3% daily loss limit
  maxDrawdown: 0.15,        // 15% max drawdown
  maxCorrelation: 0.7,      // 70% max pair correlation
  maxLeverage: 3.0,         // 3x max leverage
};

/**
 * Validate a trade signal against risk limits.
 */
export function validateRiskLimits(
  signal: TradeSignal,
  currentExposure: number,
  dailyPnL: number,
  limits: RiskLimits = DEFAULT_RISK_LIMITS
): { approved: boolean; violations: string[] } {
  const violations: string[] = [];
  
  if (signal.positionSizePercent / 100 > limits.maxPositionSize) {
    violations.push(`Position size ${signal.positionSizePercent.toFixed(1)}% exceeds limit ${(limits.maxPositionSize * 100).toFixed(0)}%`);
  }
  if (currentExposure + signal.positionSizePercent / 100 > limits.maxPortfolioExposure) {
    violations.push(`Total exposure would exceed ${(limits.maxPortfolioExposure * 100).toFixed(0)}%`);
  }
  if (dailyPnL < -limits.maxDailyLoss) {
    violations.push(`Daily loss limit breached: ${(dailyPnL * 100).toFixed(1)}%`);
  }
  
  return { approved: violations.length === 0, violations };
}
