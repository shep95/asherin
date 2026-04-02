import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Eye, Zap } from "lucide-react";
import { AlertType, VerdictAction } from "./types";

export const ALERT_COLORS: Record<AlertType, { bg: string; border: string; icon: React.ReactNode }> = {
  BUY: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  SELL: { bg: "bg-red-500/10", border: "border-red-500/30", icon: <TrendingDown className="h-4 w-4 text-red-400" /> },
  WARNING: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  MONITOR: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: <Eye className="h-4 w-4 text-blue-400" /> },
  INFO: { bg: "bg-muted/30", border: "border-border", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
};

export const VERDICT_STYLES: Record<VerdictAction, { bg: string; text: string; glow: string; emoji: string }> = {
  BUY_NOW: { bg: "from-emerald-600/90 to-emerald-800/90", text: "text-emerald-50", glow: "shadow-emerald-500/40", emoji: "🟢" },
  SELL_NOW: { bg: "from-red-600/90 to-red-800/90", text: "text-red-50", glow: "shadow-red-500/40", emoji: "🔴" },
  EXIT_NOW: { bg: "from-red-700/90 to-red-900/90", text: "text-red-50", glow: "shadow-red-600/50", emoji: "🚨" },
  HOLD: { bg: "from-blue-600/80 to-blue-800/80", text: "text-blue-50", glow: "shadow-blue-500/30", emoji: "🔵" },
  WAIT: { bg: "from-amber-600/70 to-amber-800/70", text: "text-amber-50", glow: "shadow-amber-500/20", emoji: "⏳" },
  NONE: { bg: "from-muted/50 to-muted/30", text: "text-muted-foreground", glow: "", emoji: "" },
};

export const OVERLAY_COLORS: Record<string, string> = {
  green: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
  red: "text-red-400 border-red-400/40 bg-red-500/10",
  yellow: "text-amber-400 border-amber-400/40 bg-amber-500/10",
  blue: "text-blue-400 border-blue-400/40 bg-blue-500/10",
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
