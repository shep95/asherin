import React from "react";
import { AlertTriangle, Eye, Zap, Bug, Shield, Palette, Search, Clock, MessageCircle, Users, Scale, Brain } from "lucide-react";
import { AlertType, VerdictAction } from "./types";
import { ADMIN_EMAIL } from "@/lib/adminEmail";

export const ALERT_COLORS: Record<AlertType, { bg: string; border: string; icon: React.ReactNode }> = {
  WARNING: { bg: "bg-muted/30", border: "border-border", icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" /> },
  MONITOR: { bg: "bg-muted/20", border: "border-border", icon: <Eye className="h-4 w-4 text-muted-foreground" /> },
  INFO: { bg: "bg-muted/30", border: "border-border", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
  BUG: { bg: "bg-muted/30", border: "border-border", icon: <Bug className="h-4 w-4 text-muted-foreground" /> },
  VULNERABILITY: { bg: "bg-muted/30", border: "border-border", icon: <Shield className="h-4 w-4 text-muted-foreground" /> },
  DESIGN_ISSUE: { bg: "bg-muted/30", border: "border-border", icon: <Palette className="h-4 w-4 text-muted-foreground" /> },
  OPTIMIZATION: { bg: "bg-muted/30", border: "border-border", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
  COMPLIANCE: { bg: "bg-muted/30", border: "border-border", icon: <Shield className="h-4 w-4 text-muted-foreground" /> },
  DEADLINE: { bg: "bg-muted/30", border: "border-border", icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
  SUGGESTION: { bg: "bg-muted/30", border: "border-border", icon: <Search className="h-4 w-4 text-muted-foreground" /> },
  OBJECTION: { bg: "bg-muted/30", border: "border-border", icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" /> },
  COACHING: { bg: "bg-muted/30", border: "border-border", icon: <MessageCircle className="h-4 w-4 text-muted-foreground" /> },
  RISK: { bg: "bg-muted/30", border: "border-border", icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" /> },
  BIAS: { bg: "bg-muted/30", border: "border-border", icon: <Scale className="h-4 w-4 text-muted-foreground" /> },
  CREDIBILITY: { bg: "bg-muted/30", border: "border-border", icon: <Shield className="h-4 w-4 text-muted-foreground" /> },
  ENGAGEMENT: { bg: "bg-muted/30", border: "border-border", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
  EMOTION: { bg: "bg-muted/30", border: "border-border", icon: <Brain className="h-4 w-4 text-muted-foreground" /> },
};

export const VERDICT_STYLES: Record<VerdictAction, { bg: string; text: string; glow: string; emoji: string }> = {
  HOLD: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  WAIT: { bg: "from-muted/50 to-muted/30", text: "text-muted-foreground", glow: "", emoji: "" },
  NONE: { bg: "from-muted/50 to-muted/30", text: "text-muted-foreground", glow: "", emoji: "" },
  FIX_NOW: { bg: "from-muted/70 to-muted/50", text: "text-foreground", glow: "", emoji: "" },
  OPTIMIZE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  REFACTOR: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  APPROVE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  FLAG: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  IMPROVE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  PROBE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  PIVOT: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  COACH: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  ESCALATE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
  DE_ESCALATE: { bg: "from-muted/60 to-muted/40", text: "text-foreground", glow: "", emoji: "" },
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

export const ADMIN_EMAIL = ADMIN_EMAIL;
