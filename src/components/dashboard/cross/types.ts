export type AlertType = "BUY" | "SELL" | "WARNING" | "MONITOR" | "INFO" | "BUG" | "VULNERABILITY" | "DESIGN_ISSUE" | "OPTIMIZATION" | "COMPLIANCE" | "DEADLINE" | "SUGGESTION";
export type AnalysisMode = "trading" | "coding" | "design" | "finance" | "writing" | "research" | "healthcare" | "education" | "music" | "gaming" | "email" | "general";
export type Sensitivity = "low" | "medium" | "high";
export type VerdictAction = "BUY_NOW" | "SELL_NOW" | "HOLD" | "EXIT_NOW" | "WAIT" | "NONE" | "FIX_NOW" | "OPTIMIZE" | "REFACTOR" | "APPROVE" | "FLAG" | "IMPROVE";

export const MODE_CONFIG: Record<AnalysisMode, { label: string; icon: string; description: string; color: string }> = {
  trading:    { label: "Trading",     icon: "TrendingUp",    description: "Nestal Fractal meme coin analysis",      color: "text-emerald-400" },
  coding:     { label: "Coding",      icon: "Code",          description: "Bug detection, code review, refactoring", color: "text-blue-400" },
  design:     { label: "Design",      icon: "Palette",       description: "UI/UX critique, accessibility, layout",   color: "text-purple-400" },
  finance:    { label: "Finance",     icon: "Calculator",    description: "Formula errors, anomalies, validation",   color: "text-amber-400" },
  writing:    { label: "Writing",     icon: "PenTool",       description: "Grammar, style, tone, clarity analysis",  color: "text-cyan-400" },
  research:   { label: "Research",    icon: "Search",        description: "Source analysis, fact checking, gaps",     color: "text-indigo-400" },
  healthcare: { label: "Healthcare",  icon: "Heart",         description: "Clinical notes, compliance, dosage",      color: "text-red-400" },
  education:  { label: "Education",   icon: "GraduationCap", description: "Tutoring, grading, curriculum help",      color: "text-orange-400" },
  music:      { label: "Music",       icon: "Music",         description: "DAW analysis, mixing, arrangement",       color: "text-pink-400" },
  gaming:     { label: "Gaming",      icon: "Gamepad2",      description: "Game dev, QA, balance analysis",          color: "text-lime-400" },
  email:      { label: "Email",       icon: "Mail",          description: "Inbox triage, drafting, scheduling",      color: "text-sky-400" },
  general:    { label: "General",     icon: "Monitor",       description: "Universal screen intelligence",           color: "text-muted-foreground" },
};

export interface QuickVerdict {
  action: VerdictAction;
  urgency: "immediate" | "soon" | "watch";
  message: string;
  confidence: number;
  timestamp: Date;
}

export interface ScreenOverlay {
  type: "zone" | "line" | "label" | "arrow" | "price_level" | "highlight" | "annotation";
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
  domain?: AnalysisMode;
}

export interface CrossContext {
  app?: string;
  pair?: string;
  timeframe?: string;
  price?: string;
  exchange?: string;
  language?: string;
  file?: string;
  tool?: string;
  project?: string;
  document?: string;
  url?: string;
  mode?: AnalysisMode;
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
    | "WAVE_IMPULSE"
    | "WAVE_EXHAUSTION"
    | "FRACTAL_CORRECTION"
    | "STRUCTURE_BREAK"
    | "STRUCTURE_SHIFT"
    | "LIQUIDITY_SWEEP"
    | "LIQUIDITY_VOID"
    | "FVG_RETEST"
    | "FRACTAL_PATTERN";
  action: "BUY_NOW" | "SELL_NOW" | "EXIT_NOW" | "HOLD" | "WAIT" | "MONITOR";
  reason: string;
  confidence: number;
  urgency: "immediate" | "soon" | "watch";
  price?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

/** Session activity log entry */
export interface ActivityEntry {
  id: string;
  timestamp: Date;
  mode: AnalysisMode;
  action: string;
  detail: string;
  confidence?: number;
  accepted?: boolean;
}

/** Session analytics */
export interface SessionAnalytics {
  framesAnalyzed: number;
  framesSkipped: number;
  alertsFired: number;
  alertsAccepted: number;
  alertsDismissed: number;
  sessionDurationMs: number;
  estimatedCost: number;
  modeBreakdown: Partial<Record<AnalysisMode, number>>;
}
