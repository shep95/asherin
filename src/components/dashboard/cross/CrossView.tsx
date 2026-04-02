import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Play, Square, Settings, MessageSquare, AlertTriangle, TrendingUp, TrendingDown, Eye, EyeOff, Volume2, VolumeX, ChevronDown, ChevronUp, Loader2, Shield, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

type AlertType = "BUY" | "SELL" | "WARNING" | "MONITOR" | "INFO";
type AnalysisMode = "trading" | "coding" | "design" | "general";
type Sensitivity = "low" | "medium" | "high";
type VerdictAction = "BUY_NOW" | "SELL_NOW" | "HOLD" | "EXIT_NOW" | "WAIT" | "NONE";

interface QuickVerdict {
  action: VerdictAction;
  urgency: "immediate" | "soon" | "watch";
  message: string;
  confidence: number;
  timestamp: Date;
}

interface ScreenOverlay {
  type: "zone" | "line" | "label" | "arrow" | "price_level";
  position: string;
  color: string;
  text: string;
  subtext?: string;
  size: "small" | "medium" | "large";
}

interface CrossAlert {
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

interface CrossContext {
  app?: string;
  pair?: string;
  timeframe?: string;
  price?: string;
  exchange?: string;
  language?: string;
  file?: string;
}

interface CrossSettings {
  mode: AnalysisMode;
  sensitivity: Sensitivity;
  frameRate: number;
  quality: "low" | "medium" | "high";
  minConfidence: number;
  soundEnabled: boolean;
  budgetLimit: number;
  pauseOnNoChange: boolean;
}

const DEFAULT_SETTINGS: CrossSettings = {
  mode: "trading",
  sensitivity: "medium",
  frameRate: 2,
  quality: "medium",
  minConfidence: 70,
  soundEnabled: true,
  budgetLimit: 20,
  pauseOnNoChange: true,
};

const ALERT_COLORS: Record<AlertType, { bg: string; border: string; icon: React.ReactNode }> = {
  BUY: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  SELL: { bg: "bg-red-500/10", border: "border-red-500/30", icon: <TrendingDown className="h-4 w-4 text-red-400" /> },
  WARNING: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  MONITOR: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: <Eye className="h-4 w-4 text-blue-400" /> },
  INFO: { bg: "bg-muted/30", border: "border-border", icon: <Zap className="h-4 w-4 text-muted-foreground" /> },
};

const VERDICT_STYLES: Record<VerdictAction, { bg: string; text: string; glow: string; emoji: string }> = {
  BUY_NOW: { bg: "from-emerald-600/90 to-emerald-800/90", text: "text-emerald-50", glow: "shadow-emerald-500/40", emoji: "🟢" },
  SELL_NOW: { bg: "from-red-600/90 to-red-800/90", text: "text-red-50", glow: "shadow-red-500/40", emoji: "🔴" },
  EXIT_NOW: { bg: "from-red-700/90 to-red-900/90", text: "text-red-50", glow: "shadow-red-600/50", emoji: "🚨" },
  HOLD: { bg: "from-blue-600/80 to-blue-800/80", text: "text-blue-50", glow: "shadow-blue-500/30", emoji: "🔵" },
  WAIT: { bg: "from-amber-600/70 to-amber-800/70", text: "text-amber-50", glow: "shadow-amber-500/20", emoji: "⏳" },
  NONE: { bg: "from-muted/50 to-muted/30", text: "text-muted-foreground", glow: "", emoji: "" },
};

const OVERLAY_COLORS: Record<string, string> = {
  green: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
  red: "text-red-400 border-red-400/40 bg-red-500/10",
  yellow: "text-amber-400 border-amber-400/40 bg-amber-500/10",
  blue: "text-blue-400 border-blue-400/40 bg-blue-500/10",
  white: "text-foreground border-foreground/30 bg-background/50",
};

const OVERLAY_POSITIONS: Record<string, string> = {
  "top": "top-12 left-1/2 -translate-x-1/2",
  "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "bottom": "bottom-12 left-1/2 -translate-x-1/2",
  "top-left": "top-12 left-3",
  "top-right": "top-12 right-14",
  "bottom-left": "bottom-12 left-3",
  "bottom-right": "bottom-12 right-3",
};

const CrossView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.email === ADMIN_EMAIL;

  // State
  const [isSharing, setIsSharing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [alerts, setAlerts] = useState<CrossAlert[]>([]);
  const [context, setContext] = useState<CrossContext | null>(null);
  const [observations, setObservations] = useState<string[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [settings, setSettings] = useState<CrossSettings>(DEFAULT_SETTINGS);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousAlertsRef = useRef<CrossAlert[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;

    const quality = settings.quality === "low" ? 0.4 : settings.quality === "medium" ? 0.6 : 0.8;
    const scale = settings.quality === "low" ? 0.5 : settings.quality === "medium" ? 0.75 : 1;

    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }, [settings.quality]);

  const analyzeFrame = useCallback(async () => {
    if (isAnalyzing || isPaused) return;

    const frame = captureFrame();
    if (!frame) return;

    setIsAnalyzing(true);
    setFrameCount(prev => prev + 1);

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cross-analyze`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            frame,
            context: context ? JSON.stringify(context) : undefined,
            previousAlerts: previousAlertsRef.current.slice(-3).map(a => ({ type: a.type, title: a.title })),
            settings: { mode: settings.mode, sensitivity: settings.sensitivity },
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown" }));
        console.error("Cross analyze error:", err);
        return;
      }

      const analysis = await resp.json();

      // Update context
      if (analysis.context) setContext(analysis.context);

      // Privacy warning
      if (analysis.privacyWarning) {
        setPrivacyWarning(analysis.privacyWarning);
        setIsPaused(true);
        if (settings.soundEnabled) {
          try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
        }
      }

      // Process alerts
      if (analysis.alerts?.length) {
        const newAlerts: CrossAlert[] = analysis.alerts
          .filter((a: any) => a.confidence >= settings.minConfidence)
          .map((a: any) => ({
            id: crypto.randomUUID(),
            type: a.type as AlertType,
            severity: a.severity || "medium",
            confidence: a.confidence || 50,
            title: a.title || "Signal detected",
            reasoning: a.reasoning || [],
            action: a.action,
            entry: a.entry,
            stopLoss: a.stopLoss,
            takeProfit: a.takeProfit,
            validFor: a.validFor,
            timestamp: new Date(),
          }));

        if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
          previousAlertsRef.current = [...newAlerts, ...previousAlertsRef.current].slice(0, 10);

          // Sound for critical alerts
          if (settings.soundEnabled && newAlerts.some(a => a.severity === "critical" || a.type === "BUY" || a.type === "SELL" || a.type === "WARNING")) {
            try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
          }
        }
      }

      // Observations
      if (analysis.observations?.length) {
        setObservations(analysis.observations);
      }

      // Update cost estimate (~$0.02 per frame)
      setEstimatedCost(prev => prev + 0.02);
    } catch (e) {
      console.error("Cross frame analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPaused, captureFrame, getAuthHeaders, context, settings]);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Listen for user stopping via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      setIsSharing(true);
      setSessionStart(new Date());
      setEstimatedCost(0);
      setFrameCount(0);
      setAlerts([]);
      setContext(null);

      // Start analysis loop
      intervalRef.current = setInterval(() => {
        analyzeFrame();
      }, settings.frameRate * 1000);

      toast({ title: "Screen sharing started", description: "Aureon is now watching your screen" });
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        toast({ title: "Failed to start screen sharing", description: e.message, variant: "destructive" });
      }
    }
  }, [settings.frameRate, analyzeFrame, toast]);

  const stopSharing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setIsPaused(false);
    setSessionStart(null);
  }, []);

  // Update interval when frameRate changes
  useEffect(() => {
    if (isSharing && !isPaused && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => analyzeFrame(), settings.frameRate * 1000);
    }
  }, [settings.frameRate, isSharing, isPaused, analyzeFrame]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      setPrivacyWarning(null);
      intervalRef.current = setInterval(() => analyzeFrame(), settings.frameRate * 1000);
    } else {
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isPaused, analyzeFrame, settings.frameRate]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const sessionDuration = useMemo(() => {
    if (!sessionStart) return "00:00";
    const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [sessionStart, frameCount]); // frameCount forces re-render

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Shield className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground font-extralight">Cross is restricted to authorized accounts only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-lg font-extralight tracking-wide text-foreground">Cross</h1>
            <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/50 uppercase">
              Live Screen Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSharing && (
            <div className="flex items-center gap-2 mr-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? "bg-amber-400" : "bg-emerald-400"}`} />
              </span>
              <span className="text-xs font-extralight text-muted-foreground">
                {isPaused ? "PAUSED" : "WATCHING"} · {sessionDuration} · F{frameCount} · ~${estimatedCost.toFixed(2)}
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowChat(c => !c)} className="h-8 w-8">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(s => !s)} className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Privacy Warning Overlay */}
      {privacyWarning && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">Sensitive Information Detected</span>
          </div>
          <p className="text-xs text-red-200/70 mt-1">{privacyWarning}</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setPrivacyWarning(null); setIsPaused(false); }}>
              Dismiss & Resume
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-red-400" onClick={stopSharing}>
              Stop Sharing
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Screen + Alerts */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 gap-4">
          {/* Screen Preview */}
          <div className="relative rounded-lg border border-border/30 bg-muted/10 overflow-hidden" style={{ minHeight: "280px" }}>
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline style={{ display: isSharing ? "block" : "none", maxHeight: "400px" }} />
            <canvas ref={canvasRef} className="hidden" />

            {!isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Monitor className="h-16 w-16 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/50 font-extralight">Share your screen to begin live analysis</p>
                <Button onClick={startSharing} className="gap-2">
                  <Play className="h-4 w-4" />
                  Start Sharing Screen
                </Button>
              </div>
            )}

            {isSharing && (
              <div className="absolute top-3 right-3 flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50" onClick={togglePause}>
                  {isPaused ? <Play className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50 text-red-400 hover:text-red-300" onClick={stopSharing}>
                  <Square className="h-3 w-3 mr-1" />
                  Stop
                </Button>
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute bottom-3 left-3">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  <span className="text-[10px] text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Context Bar */}
          {context && isSharing && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/10 border border-border/20 text-xs font-extralight text-muted-foreground">
              <span className="text-accent">Context:</span>
              {context.app && <span>{context.app}</span>}
              {context.pair && <span className="text-foreground font-normal">{context.pair}</span>}
              {context.timeframe && <span>{context.timeframe}</span>}
              {context.price && <span className="text-foreground">{context.price}</span>}
              {context.exchange && <span>{context.exchange}</span>}
            </div>
          )}

          {/* Observations */}
          {observations.length > 0 && isSharing && (
            <div className="px-3 py-2 rounded-lg bg-muted/5 border border-border/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">Observations</p>
              {observations.map((o, i) => (
                <p key={i} className="text-xs text-muted-foreground font-extralight">{o}</p>
              ))}
            </div>
          )}

          {/* Alerts Feed */}
          <div className="space-y-2">
            {alerts.length === 0 && isSharing && (
              <p className="text-xs text-muted-foreground/40 font-extralight text-center py-4">
                No alerts yet — Aureon is monitoring your screen...
              </p>
            )}
            {alerts.map(alert => {
              const style = ALERT_COLORS[alert.type] || ALERT_COLORS.INFO;
              return (
                <div key={alert.id} className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {style.icon}
                      <span className="text-sm font-medium text-foreground">{alert.type} — {alert.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/30 text-muted-foreground">
                        {alert.confidence}%
                      </span>
                    </div>
                    <button onClick={() => dismissAlert(alert.id)} className="text-muted-foreground/40 hover:text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {alert.reasoning.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {alert.reasoning.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground font-extralight flex items-start gap-1.5">
                          <span className="text-muted-foreground/30 mt-0.5">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}

                  {(alert.entry || alert.stopLoss || alert.takeProfit) && (
                    <div className="mt-2 flex gap-3 text-[10px] font-mono text-muted-foreground">
                      {alert.entry && <span>Entry: <span className="text-foreground">{alert.entry}</span></span>}
                      {alert.stopLoss && <span>SL: <span className="text-red-400">{alert.stopLoss}</span></span>}
                      {alert.takeProfit && <span>TP: <span className="text-emerald-400">{alert.takeProfit}</span></span>}
                    </div>
                  )}

                  {alert.action && (
                    <p className="mt-1.5 text-xs text-accent font-extralight">{alert.action}</p>
                  )}

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground/30">
                      {alert.timestamp.toLocaleTimeString()}
                    </span>
                    {alert.validFor && (
                      <span className="text-[9px] text-muted-foreground/30">Valid for: {alert.validFor}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Settings Panel */}
        {showSettings && (
          <div className="w-72 border-l border-border/30 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Settings</h3>
              <button onClick={() => setShowSettings(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {/* Analysis Mode */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">Analysis Mode</label>
              <div className="grid grid-cols-2 gap-1">
                {(["trading", "coding", "design", "general"] as AnalysisMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setSettings(s => ({ ...s, mode: m }))}
                    className={`text-xs px-2 py-1.5 rounded border transition ${
                      settings.mode === m ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sensitivity */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">Alert Sensitivity</label>
              <div className="grid grid-cols-3 gap-1">
                {(["low", "medium", "high"] as Sensitivity[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSettings(prev => ({ ...prev, sensitivity: s }))}
                    className={`text-xs px-2 py-1.5 rounded border transition ${
                      settings.sensitivity === s ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Rate */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">
                Frame Rate: 1 frame every {settings.frameRate}s
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.frameRate}
                onChange={e => setSettings(s => ({ ...s, frameRate: Number(e.target.value) }))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/40">
                <span>Fast (1s)</span>
                <span>Slow (10s)</span>
              </div>
            </div>

            {/* Quality */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">Capture Quality</label>
              <div className="grid grid-cols-3 gap-1">
                {(["low", "medium", "high"] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setSettings(s => ({ ...s, quality: q }))}
                    className={`text-xs px-2 py-1.5 rounded border transition ${
                      settings.quality === q ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Confidence */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">
                Min Confidence: {settings.minConfidence}%
              </label>
              <input
                type="range"
                min={30}
                max={95}
                step={5}
                value={settings.minConfidence}
                onChange={e => setSettings(s => ({ ...s, minConfidence: Number(e.target.value) }))}
                className="w-full accent-accent"
              />
            </div>

            {/* Sound */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Sound Alerts</span>
              <button onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))}>
                {settings.soundEnabled
                  ? <Volume2 className="h-4 w-4 text-accent" />
                  : <VolumeX className="h-4 w-4 text-muted-foreground/40" />}
              </button>
            </div>

            {/* Cost */}
            <div className="pt-2 border-t border-border/20">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">Cost Estimate</p>
              <p className="text-xs text-muted-foreground">
                ~${((3600 / settings.frameRate) * 0.02).toFixed(0)}/hour at current settings
              </p>
              {isSharing && (
                <p className="text-xs text-foreground mt-1">Session: ${estimatedCost.toFixed(2)}</p>
              )}
            </div>
          </div>
        )}

        {/* Right: Chat Panel */}
        {showChat && (
          <div className="w-80 border-l border-border/30 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-sm font-medium text-foreground">Chat with Aureon</h3>
              <button onClick={() => setShowChat(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground/40 text-center py-8 font-extralight">
                  Ask Aureon about what it sees on your screen
                </p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`text-xs ${m.role === "user" ? "text-right" : ""}`}>
                  <div className={`inline-block px-3 py-2 rounded-lg max-w-[90%] ${
                    m.role === "user" ? "bg-accent/10 text-foreground" : "bg-muted/20 text-muted-foreground"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border/20">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && chatInput.trim()) {
                      const msg = chatInput.trim();
                      setChatInput("");
                      setChatMessages(prev => [...prev, { role: "user", content: msg }]);
                      // Quick contextual response
                      const contextStr = context ? `Context: ${JSON.stringify(context)}. Recent alerts: ${alerts.slice(0, 3).map(a => a.title).join(", ")}` : "No screen shared yet.";
                      setChatMessages(prev => [...prev, { role: "assistant", content: `Based on what I see: ${contextStr}\n\nRegarding your question: "${msg}" — I'll analyze the next frame with this in mind.` }]);
                    }
                  }}
                  placeholder="Ask about what's on screen..."
                  className="flex-1 bg-muted/10 border border-border/30 rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossView;
