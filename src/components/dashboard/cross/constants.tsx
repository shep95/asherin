import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Eye, Zap, Bug, Shield, Palette, Search, CheckCircle, Clock, Target, MessageCircle, Users, Scale, Headphones, Brain } from "lucide-react";
import { AlertType, VerdictAction } from "./types";

export const ALERT_COLORS: Record<AlertType, { bg: string; border: string; icon: React.ReactNode }> = {
  BUY: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  SELL: { bg: "bg-red-500/10", border: "border-red-500/30", icon: <TrendingDown className="h-4 w-4 text-red-400" /> },
  WARNING: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  MONITOR: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: <Eye className="h-4 w-4 text-blue-400" /> },
  INFO: { bg: "bg-muted/30", border: "border-border", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
  BUG: { bg: "bg-red-500/10", border: "border-red-500/30", icon: <Bug className="h-4 w-4 text-red-400" /> },
  VULNERABILITY: { bg: "bg-red-600/10", border: "border-red-600/30", icon: <Shield className="h-4 w-4 text-red-500" /> },
  DESIGN_ISSUE: { bg: "bg-purple-500/10", border: "border-purple-500/30", icon: <Palette className="h-4 w-4 text-purple-400" /> },
  OPTIMIZATION: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: <Zap className="h-4 w-4 text-cyan-400" /> },
  COMPLIANCE: { bg: "bg-amber-600/10", border: "border-amber-600/30", icon: <Shield className="h-4 w-4 text-amber-500" /> },
  DEADLINE: { bg: "bg-orange-500/10", border: "border-orange-500/30", icon: <Clock className="h-4 w-4 text-orange-400" /> },
  SUGGESTION: { bg: "bg-indigo-500/10", border: "border-indigo-500/30", icon: <Search className="h-4 w-4 text-indigo-400" /> },
  OBJECTION: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  BUYING_SIGNAL: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <Target className="h-4 w-4 text-emerald-400" /> },
  COACHING: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: <MessageCircle className="h-4 w-4 text-blue-400" /> },
  RISK: { bg: "bg-red-500/10", border: "border-red-500/30", icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
  BIAS: { bg: "bg-violet-500/10", border: "border-violet-500/30", icon: <Scale className="h-4 w-4 text-violet-400" /> },
  CREDIBILITY: { bg: "bg-slate-500/10", border: "border-slate-500/30", icon: <Shield className="h-4 w-4 text-slate-400" /> },
  ENGAGEMENT: { bg: "bg-teal-500/10", border: "border-teal-500/30", icon: <Users className="h-4 w-4 text-teal-400" /> },
  EMOTION: { bg: "bg-pink-500/10", border: "border-pink-500/30", icon: <Brain className="h-4 w-4 text-pink-400" /> },
};

export const VERDICT_STYLES: Record<VerdictAction, { bg: string; text: string; glow: string; emoji: string }> = {
  BUY_NOW: { bg: "from-emerald-600/90 to-emerald-800/90", text: "text-emerald-50", glow: "shadow-emerald-500/40", emoji: "🟢" },
  SELL_NOW: { bg: "from-red-600/90 to-red-800/90", text: "text-red-50", glow: "shadow-red-500/40", emoji: "🔴" },
  EXIT_NOW: { bg: "from-red-700/90 to-red-900/90", text: "text-red-50", glow: "shadow-red-600/50", emoji: "🚨" },
  HOLD: { bg: "from-blue-600/80 to-blue-800/80", text: "text-blue-50", glow: "shadow-blue-500/30", emoji: "🔵" },
  WAIT: { bg: "from-amber-600/70 to-amber-800/70", text: "text-amber-50", glow: "shadow-amber-500/20", emoji: "⏳" },
  NONE: { bg: "from-muted/50 to-muted/30", text: "text-muted-foreground", glow: "", emoji: "" },
  FIX_NOW: { bg: "from-red-600/90 to-orange-700/90", text: "text-red-50", glow: "shadow-red-500/40", emoji: "🔧" },
  OPTIMIZE: { bg: "from-cyan-600/80 to-cyan-800/80", text: "text-cyan-50", glow: "shadow-cyan-500/30", emoji: "⚡" },
  REFACTOR: { bg: "from-purple-600/80 to-purple-800/80", text: "text-purple-50", glow: "shadow-purple-500/30", emoji: "🔄" },
  APPROVE: { bg: "from-emerald-600/80 to-emerald-800/80", text: "text-emerald-50", glow: "shadow-emerald-500/30", emoji: "✅" },
  FLAG: { bg: "from-amber-600/80 to-amber-800/80", text: "text-amber-50", glow: "shadow-amber-500/30", emoji: "🚩" },
  IMPROVE: { bg: "from-indigo-600/80 to-indigo-800/80", text: "text-indigo-50", glow: "shadow-indigo-500/30", emoji: "💡" },
  CLOSE_NOW: { bg: "from-emerald-700/90 to-emerald-900/90", text: "text-emerald-50", glow: "shadow-emerald-600/50", emoji: "🎯" },
  PROBE: { bg: "from-blue-600/80 to-indigo-800/80", text: "text-blue-50", glow: "shadow-blue-500/30", emoji: "🔍" },
  PIVOT: { bg: "from-violet-600/80 to-violet-800/80", text: "text-violet-50", glow: "shadow-violet-500/30", emoji: "🔀" },
  COACH: { bg: "from-teal-600/80 to-teal-800/80", text: "text-teal-50", glow: "shadow-teal-500/30", emoji: "🎓" },
  ESCALATE: { bg: "from-orange-600/80 to-orange-800/80", text: "text-orange-50", glow: "shadow-orange-500/30", emoji: "⬆️" },
  DE_ESCALATE: { bg: "from-sky-600/80 to-sky-800/80", text: "text-sky-50", glow: "shadow-sky-500/30", emoji: "⬇️" },
};

export const OVERLAY_COLORS: Record<string, string> = {
  green: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
  red: "text-red-400 border-red-400/40 bg-red-500/10",
  yellow: "text-amber-400 border-amber-400/40 bg-amber-500/10",
  blue: "text-blue-400 border-blue-400/40 bg-blue-500/10",
  purple: "text-purple-400 border-purple-400/40 bg-purple-500/10",
  cyan: "text-cyan-400 border-cyan-400/40 bg-cyan-500/10",
  white: "text-foreground border-foreground/30 bg-background/50",
};

export const OVERLAY_POSITIONS: Record<string, string> = {
  "top": "top-12 left-1/2 -translate-x-1/2",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "bottom": "bottom-12 left-1/2 -translate-x-1/2",
  "top-left": "top-12 left-3",
  "top-right": "top-12 right-14",
  "bottom-left": "bottom-12 left-3",
  "bottom-right": "bottom-12 right-3",
};

export const ADMIN_EMAIL = "ashernewtonx@gmail.com";
