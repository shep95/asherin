export type AlertType = "WARNING" | "MONITOR" | "INFO" | "BUG" | "VULNERABILITY" | "DESIGN_ISSUE" | "OPTIMIZATION" | "COMPLIANCE" | "DEADLINE" | "SUGGESTION" | "OBJECTION" | "COACHING" | "RISK" | "BIAS" | "CREDIBILITY" | "ENGAGEMENT" | "EMOTION";
export type AnalysisMode = "coding" | "design" | "writing" | "research" | "healthcare" | "education" | "music" | "gaming" | "email" | "general" | "hr" | "legal" | "support" | "negotiation";
export type Sensitivity = "low" | "medium" | "high";
export type VerdictAction = "HOLD" | "WAIT" | "NONE" | "FIX_NOW" | "OPTIMIZE" | "REFACTOR" | "APPROVE" | "FLAG" | "IMPROVE" | "PROBE" | "PIVOT" | "COACH" | "ESCALATE" | "DE_ESCALATE";

export const MODE_CONFIG: Record<AnalysisMode, { label: string; icon: string; description: string; color: string; category: string }> = {
  coding:       { label: "Coding",       icon: "Code",          description: "Bug detection, code review, refactoring",      color: "text-foreground",          category: "Engineering" },
  design:       { label: "Design",       icon: "Palette",       description: "UI/UX critique, accessibility, layout",        color: "text-foreground",          category: "Creative" },
  writing:      { label: "Writing",      icon: "PenTool",       description: "Grammar, style, tone, clarity analysis",       color: "text-foreground",          category: "Creative" },
  research:     { label: "Research",     icon: "Search",        description: "Source analysis, fact checking, gaps",          color: "text-foreground",          category: "Analysis" },
  healthcare:   { label: "Healthcare",   icon: "Heart",         description: "Clinical notes, compliance, dosage",           color: "text-foreground",          category: "Professional" },
  education:    { label: "Education",    icon: "GraduationCap", description: "Tutoring, grading, curriculum help",           color: "text-foreground",          category: "Professional" },
  music:        { label: "Music",        icon: "Music",         description: "DAW analysis, mixing, arrangement",            color: "text-foreground",          category: "Creative" },
  gaming:       { label: "Gaming",       icon: "Gamepad2",      description: "Game dev, QA, balance analysis",               color: "text-foreground",          category: "Engineering" },
  email:        { label: "Email",        icon: "Mail",          description: "Inbox triage, drafting, scheduling",           color: "text-foreground",          category: "Productivity" },
  general:      { label: "General",      icon: "Monitor",       description: "Universal screen intelligence",                color: "text-muted-foreground",    category: "General" },
  hr:           { label: "HR",           icon: "Users",         description: "Interview analysis, bias detection, scoring",  color: "text-foreground",          category: "Professional" },
  legal:        { label: "Legal",        icon: "Scale",         description: "Deposition analysis, credibility scoring",     color: "text-foreground",          category: "Professional" },
  support:      { label: "Support",      icon: "Headphones",    description: "Agent QA, satisfaction prediction, coaching",  color: "text-foreground",          category: "Professional" },
  negotiation:  { label: "Negotiation",  icon: "Handshake",     description: "Power dynamics, concession tracking, leverage", color: "text-foreground",         category: "Professional" },
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
  // Audio-visual intelligence
  speakers?: SpeakerInfo[];
  emotions?: EmotionState;
  engagement?: EngagementMetrics;
  salesIntel?: SalesIntelligence;
}

export interface SpeakerInfo {
  id: string;
  label: string;
  talkRatio: number;
  avgPitch?: number;
  sentiment?: "positive" | "neutral" | "negative";
  stressLevel?: number;
  role?: "decision_maker" | "influencer" | "champion" | "blocker" | "user" | "unknown";
}

export interface EmotionState {
  primary: string;
  intensity: number;
  confidence: number;
  secondary?: string;
  stressLevel: number;
  engagementLevel: number;
  deceptionLikelihood?: number;
}

export interface EngagementMetrics {
  overallScore: number;
  attentionLevel: number;
  comprehensionSignals: number;
  participationEquity: number;
  energyLevel: number;
  trend: "rising" | "stable" | "declining";
}

export interface SalesIntelligence {
  closingReadiness: number;
  objectionsDetected: string[];
  buyingSignals: string[];
  talkRatio: { prospect: number; seller: number };
  questionDepth: number;
  rapportScore: number;
  nextBestAction?: string;
  competitorMentions?: string[];
  stakeholderMap?: StakeholderInfo[];
  concessionBalance?: { given: number; received: number };
}

export interface StakeholderInfo {
  name: string;
  role: "decision_maker" | "influencer" | "champion" | "blocker" | "user";
  engagementLevel: number;
  sentiment: "positive" | "neutral" | "negative";
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
  // Audio-visual settings
  audioEnabled: boolean;
  facialAnalysisEnabled: boolean;
  consentCollected: boolean;
  redactPII: boolean;
}

export const DEFAULT_SETTINGS: CrossSettings = {
  mode: "general",
  sensitivity: "medium",
  frameRate: 2,
  quality: "medium",
  minConfidence: 70,
  soundEnabled: true,
  voiceEnabled: true,
  budgetLimit: 20,
  pauseOnNoChange: true,
  audioEnabled: false,
  facialAnalysisEnabled: false,
  consentCollected: false,
  redactPII: true,
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
