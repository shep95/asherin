export type AlertType = "BUY" | "SELL" | "WARNING" | "MONITOR" | "INFO";
export type AnalysisMode = "trading" | "coding" | "design" | "general";
export type Sensitivity = "low" | "medium" | "high";
export type VerdictAction = "BUY_NOW" | "SELL_NOW" | "HOLD" | "EXIT_NOW" | "WAIT" | "NONE";

export interface QuickVerdict {
  action: VerdictAction;
  urgency: "immediate" | "soon" | "watch";
  message: string;
  confidence: number;
  timestamp: Date;
}

export interface ScreenOverlay {
  type: "zone" | "line" | "label" | "arrow" | "price_level";
  position: string;
  color: string;
  text: string;
  subtext?: string;
  size: "small" | "medium" | "large";
}

export interface CrossAlert {
  id: string;
  type: AlertType;
  severity: string;
  confidence: number;
  title: string;
  reasoning: string[];
  action?: string;
  entry?: string;
  stopLoss?: string;
  takeProfit?: string;
  validFor?: string;
  timestamp: Date;
}

export interface CrossContext {
  app?: string;
  pair?: string;
  timeframe?: string;
  price?: string;
  exchange?: string;
  language?: string;
  file?: string;
}

export interface CrossSettings {
  mode: AnalysisMode;
  sensitivity: Sensitivity;
  frameRate: number;
  quality: "low" | "medium" | "high";
  minConfidence: number;
  soundEnabled: boolean;
  voiceEnabled: boolean;
  budgetLimit: number;
  pauseOnNoChange: boolean;
}

export const DEFAULT_SETTINGS: CrossSettings = {
  mode: "trading",
  sensitivity: "medium",
  frameRate: 2,
  quality: "medium",
  minConfidence: 70,
  soundEnabled: true,
  voiceEnabled: true,
  budgetLimit: 20,
  pauseOnNoChange: true,
};

export interface PricePoint {
  price: number;
  timestamp: number;
  pair: string;
}

/** Nestal Fractal signal types — NO generic TA */
export interface LocalSignal {
  type:
    | "WAVE_IMPULSE"       // Wave 3 entry (strongest move)
    | "WAVE_EXHAUSTION"    // Wave 5 completion (exit)
    | "FRACTAL_CORRECTION" // Wave 4 pullback (wait)
    | "STRUCTURE_BREAK"    // BOS — Break of Structure (continuation)
    | "STRUCTURE_SHIFT"    // CHOCH — Change of Character (reversal)
    | "LIQUIDITY_SWEEP"    // Stop hunt + displacement (institutional entry)
    | "LIQUIDITY_VOID"     // Catastrophic displacement candle (exit)
    | "FVG_RETEST"         // Fair Value Gap retest (entry zone)
    | "FRACTAL_PATTERN";   // Multi-scale fractal repetition (monitor)
  action: "BUY_NOW" | "SELL_NOW" | "EXIT_NOW" | "HOLD" | "WAIT" | "MONITOR";
  reason: string;
  confidence: number;
  urgency: "immediate" | "soon" | "watch";
  price?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}
