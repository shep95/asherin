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

export interface LocalSignal {
  type: "PUMP_DETECTED" | "DUMP_DETECTED" | "VOLUME_SPIKE" | "SUPPORT_BOUNCE" | "RESISTANCE_HIT" | "BREAKOUT" | "RUG_WARNING" | "PRICE_ACCELERATION" | "MOMENTUM_SHIFT";
  action: "BUY_NOW" | "SELL_NOW" | "EXIT_NOW" | "HOLD" | "WAIT" | "MONITOR";
  reason: string;
  confidence: number;
  urgency: "immediate" | "soon" | "watch";
  price?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}
