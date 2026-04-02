import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Play, Square, Settings, MessageSquare, EyeOff, ChevronUp, Loader2, Shield, X, Download, Chrome, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LocalIntelligenceEngine } from "./localIntelligence";
import { VoiceAlertEngine } from "./voiceEngine";
import CrossSettingsPanel from "./CrossSettings";
import CrossAlertFeed from "./CrossAlertFeed";
import CrossLocalSignals from "./CrossLocalSignals";
import CrossPriceTracker from "./CrossPriceTracker";
import { ADMIN_EMAIL, VERDICT_STYLES, OVERLAY_COLORS, OVERLAY_POSITIONS } from "./constants";
import {
  CrossAlert, CrossContext, CrossSettings, QuickVerdict, ScreenOverlay, LocalSignal,
  VerdictAction, DEFAULT_SETTINGS,
} from "./types";

// Singletons
const localEngine = new LocalIntelligenceEngine();
const voiceEngine = new VoiceAlertEngine();

const CrossView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [isSharing, setIsSharing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [alerts, setAlerts] = useState<CrossAlert[]>([]);
  const [context, setContext] = useState<CrossContext | null>(null);
  const [observations, setObservations] = useState<string[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [skippedFrames, setSkippedFrames] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [settings, setSettings] = useState<CrossSettings>(DEFAULT_SETTINGS);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [quickVerdict, setQuickVerdict] = useState<QuickVerdict | null>(null);
  const [overlays, setOverlays] = useState<ScreenOverlay[]>([]);
  const [verdictVisible, setVerdictVisible] = useState(true);
  const [localSignals, setLocalSignals] = useState<LocalSignal[]>([]);
  const [priceStats, setPriceStats] = useState<ReturnType<LocalIntelligenceEngine["getStats"]>>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousAlertsRef = useRef<CrossAlert[]>([]);

  // Sync voice engine state
  useEffect(() => { voiceEngine.setEnabled(settings.voiceEnabled); }, [settings.voiceEnabled]);

  useEffect(() => () => { stopSharing(); }, []);

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

    // --- LOCAL CHANGE DETECTION ---
    if (settings.pauseOnNoChange && !localEngine.hasFrameChanged(frame)) {
      setSkippedFrames(prev => prev + 1);

      // Still run local pattern detection on existing data
      if (context) {
        const signals = localEngine.detectLocalPatterns(context);
        setLocalSignals(signals);

        // Voice alert for urgent local signals
        const urgent = signals.find(s => s.urgency === "immediate" && s.confidence >= 75);
        if (urgent && settings.voiceEnabled) {
          voiceEngine.speakLocalSignal(urgent);
        }
      }
      return;
    }

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
        console.error("Cross analyze error:", await resp.text());
        return;
      }

      const analysis = await resp.json();

      // Update context + record price locally
      if (analysis.context) {
        setContext(analysis.context);
        localEngine.recordPrice(analysis.context);
        setPriceStats(localEngine.getStats());
      }

      // --- LOCAL PATTERN DETECTION (instant, no API) ---
      if (analysis.context) {
        const signals = localEngine.detectLocalPatterns(analysis.context);
        setLocalSignals(signals);

        const urgent = signals.find(s => s.urgency === "immediate" && s.confidence >= 75);
        if (urgent && settings.voiceEnabled) {
          voiceEngine.speakLocalSignal(urgent);
        }
      }

      // Quick Verdict
      if (analysis.quickVerdict && analysis.quickVerdict.action !== "NONE") {
        const v: QuickVerdict = {
          action: analysis.quickVerdict.action as VerdictAction,
          urgency: analysis.quickVerdict.urgency || "watch",
          message: analysis.quickVerdict.message || "",
          confidence: analysis.quickVerdict.confidence || 50,
          timestamp: new Date(),
        };
        setQuickVerdict(v);
        setVerdictVisible(true);

        if (v.urgency !== "immediate") {
          setTimeout(() => setVerdictVisible(false), 15000);
        }

        // Sound + Voice for verdicts
        if (["BUY_NOW", "SELL_NOW", "EXIT_NOW"].includes(v.action)) {
          if (settings.soundEnabled) {
            try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
          }
          if (settings.voiceEnabled) {
            voiceEngine.speakVerdict(v.action, v.message, v.confidence);
          }
        }
      } else if (analysis.quickVerdict?.action === "NONE" && quickVerdict && (Date.now() - quickVerdict.timestamp.getTime()) > 30000) {
        setVerdictVisible(false);
      }

      // Overlays
      setOverlays(analysis.overlays?.length ? analysis.overlays : []);

      // Privacy
      if (analysis.privacyWarning) {
        setPrivacyWarning(analysis.privacyWarning);
        setIsPaused(true);
        if (settings.soundEnabled) {
          try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
        }
      }

      // Alerts
      if (analysis.alerts?.length) {
        const newAlerts: CrossAlert[] = analysis.alerts
          .filter((a: any) => a.confidence >= settings.minConfidence)
          .map((a: any) => ({
            id: crypto.randomUUID(),
            type: a.type,
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

          if (settings.soundEnabled && newAlerts.some(a => a.severity === "critical" || a.type === "BUY" || a.type === "SELL" || a.type === "WARNING")) {
            try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
          }
        }
      }

      if (analysis.observations?.length) setObservations(analysis.observations);
      setEstimatedCost(prev => prev + 0.02);
    } catch (e) {
      console.error("Cross frame analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPaused, captureFrame, getAuthHeaders, context, settings, quickVerdict]);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].onended = () => stopSharing();

      setIsSharing(true);
      setSessionStart(new Date());
      setEstimatedCost(0);
      setFrameCount(0);
      setSkippedFrames(0);
      setAlerts([]);
      setContext(null);
      setLocalSignals([]);
      localEngine.reset();

      intervalRef.current = setInterval(() => analyzeFrame(), settings.frameRate * 1000);
      toast({ title: "Screen sharing started", description: "Aureon Cross is watching with local intelligence active" });
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        toast({ title: "Failed to start screen sharing", description: e.message, variant: "destructive" });
      }
    }
  }, [settings.frameRate, analyzeFrame, toast]);

  const stopSharing = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setIsSharing(false);
    setIsPaused(false);
    setSessionStart(null);
  }, []);

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
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [isPaused, analyzeFrame, settings.frameRate]);

  const sessionDuration = useMemo(() => {
    if (!sessionStart) return "00:00";
    const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  }, [sessionStart, frameCount]);

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
              Live Screen Intelligence + Local Pattern Engine
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
                {isPaused ? "PAUSED" : "WATCHING"} · {sessionDuration} · F{frameCount} · Skip:{skippedFrames} · ~${estimatedCost.toFixed(2)}
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

      {/* Privacy Warning */}
      {privacyWarning && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">Sensitive Information Detected</span>
          </div>
          <p className="text-xs text-red-200/70 mt-1">{privacyWarning}</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setPrivacyWarning(null); setIsPaused(false); }}>Dismiss & Resume</Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-red-400" onClick={stopSharing}>Stop Sharing</Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 gap-3">
          {/* Screen Preview */}
          <div className="relative rounded-lg border border-border/30 bg-muted/10 overflow-hidden" style={{ minHeight: "280px" }}>
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline style={{ display: isSharing ? "block" : "none", maxHeight: "400px" }} />
            <canvas ref={canvasRef} className="hidden" />

            {!isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Monitor className="h-16 w-16 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/50 font-extralight">Share your screen to begin live analysis</p>
                <div className="flex gap-3">
                  <Button onClick={startSharing} className="gap-2">
                    <Play className="h-4 w-4" />
                    Start Sharing Screen
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      fetch("/aureon-cross-extension.zip")
                        .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                        .then(blob => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "aureon-cross-extension.zip";
                          a.click();
                          URL.revokeObjectURL(a.href);
                        })
                        .catch(() => toast({ title: "Download failed", variant: "destructive" }));
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Chrome Extension
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/30 max-w-md text-center">
                  <strong className="text-muted-foreground/50">Screen Share:</strong> Analyze any tab from here · <strong className="text-muted-foreground/50">Extension:</strong> Overlay alerts, chat & signals directly on your trading tab
                </p>
                <div className="mt-2 px-4 py-2.5 rounded-lg bg-muted/10 border border-border/20 max-w-md">
                  <p className="text-[10px] text-muted-foreground/40 mb-1.5 flex items-center gap-1.5">
                    <Chrome className="h-3 w-3" /> Extension Install Guide
                  </p>
                  <ol className="text-[10px] text-muted-foreground/30 space-y-0.5 list-decimal list-inside">
                    <li>Download & unzip the extension</li>
                    <li>Open <span className="text-muted-foreground/50 font-mono">chrome://extensions</span></li>
                    <li>Enable <span className="text-muted-foreground/50">Developer mode</span> (top-right)</li>
                    <li>Click <span className="text-muted-foreground/50">Load unpacked</span> → select folder</li>
                    <li>Open any trading tab → press <span className="text-muted-foreground/50 font-mono">Ctrl+Shift+A</span></li>
                  </ol>
                </div>
              </div>
            )}

            {/* QUICK VERDICT BANNER */}
            {isSharing && quickVerdict && verdictVisible && quickVerdict.action !== "NONE" && (
              <div className="absolute top-0 left-0 right-0 z-20">
                <div
                  className={`mx-auto max-w-md mt-3 px-4 py-3 rounded-xl bg-gradient-to-r ${VERDICT_STYLES[quickVerdict.action].bg} backdrop-blur-md shadow-lg ${VERDICT_STYLES[quickVerdict.action].glow} border border-white/10 cursor-pointer transition-all hover:scale-[1.02] ${quickVerdict.urgency === "immediate" ? "animate-pulse" : ""}`}
                  onClick={() => setVerdictVisible(false)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{VERDICT_STYLES[quickVerdict.action].emoji}</span>
                      <div>
                        <div className={`text-lg font-bold tracking-wide ${VERDICT_STYLES[quickVerdict.action].text}`}>
                          {quickVerdict.action.replace("_", " ")}
                        </div>
                        <div className={`text-xs font-extralight ${VERDICT_STYLES[quickVerdict.action].text} opacity-80`}>
                          {quickVerdict.message}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${VERDICT_STYLES[quickVerdict.action].text}`}>{quickVerdict.confidence}%</div>
                      <div className={`text-[9px] uppercase tracking-wider ${VERDICT_STYLES[quickVerdict.action].text} opacity-50`}>{quickVerdict.urgency}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN OVERLAYS */}
            {isSharing && overlays.length > 0 && overlays.map((overlay, i) => {
              const posClass = OVERLAY_POSITIONS[overlay.position] || OVERLAY_POSITIONS["bottom-left"];
              const colorClass = OVERLAY_COLORS[overlay.color] || OVERLAY_COLORS["white"];
              const sizeClass = overlay.size === "large" ? "text-sm px-3 py-2" : overlay.size === "small" ? "text-[9px] px-1.5 py-0.5" : "text-xs px-2 py-1";
              return (
                <div key={i} className={`absolute z-10 ${posClass} pointer-events-none`}>
                  <div className={`rounded-md border backdrop-blur-sm ${colorClass} ${sizeClass} font-medium shadow-md`}>
                    {overlay.type === "arrow" && <span className="mr-1">{overlay.color === "green" ? "↑" : overlay.color === "red" ? "↓" : "→"}</span>}
                    {overlay.type === "price_level" && <span className="mr-1 font-mono">$</span>}
                    {overlay.text}
                    {overlay.subtext && <div className="text-[8px] opacity-60 font-extralight mt-0.5">{overlay.subtext}</div>}
                  </div>
                </div>
              );
            })}

            {/* Controls */}
            {isSharing && (
              <div className="absolute top-3 right-3 flex gap-1.5 z-30">
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50" onClick={togglePause}>
                  {isPaused ? <Play className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50 text-red-400 hover:text-red-300" onClick={stopSharing}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute bottom-3 left-3 z-30">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  <span className="text-[10px] text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Mini verdict bar */}
          {isSharing && quickVerdict && !verdictVisible && quickVerdict.action !== "NONE" && (
            <button
              onClick={() => setVerdictVisible(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${VERDICT_STYLES[quickVerdict.action].bg} border border-white/10 transition hover:opacity-90`}
            >
              <span>{VERDICT_STYLES[quickVerdict.action].emoji}</span>
              <span className={`text-xs font-medium ${VERDICT_STYLES[quickVerdict.action].text}`}>{quickVerdict.action.replace("_", " ")} — {quickVerdict.confidence}%</span>
              <span className={`text-[10px] ${VERDICT_STYLES[quickVerdict.action].text} opacity-60`}>{quickVerdict.message.slice(0, 60)}</span>
              <ChevronUp className="h-3 w-3 ml-auto opacity-50" />
            </button>
          )}

          {/* Price Tracker (local) */}
          {isSharing && <CrossPriceTracker stats={priceStats} pair={context?.pair} />}

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

          {/* Local Intelligence Signals (instant, no API) */}
          {isSharing && <CrossLocalSignals signals={localSignals} />}

          {/* Observations */}
          {observations.length > 0 && isSharing && (
            <div className="px-3 py-2 rounded-lg bg-muted/5 border border-border/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">Observations</p>
              {observations.map((o, i) => <p key={i} className="text-xs text-muted-foreground font-extralight">{o}</p>)}
            </div>
          )}

          {/* AI Alerts Feed */}
          <CrossAlertFeed alerts={alerts} onDismiss={(id) => setAlerts(prev => prev.filter(a => a.id !== id))} isSharing={isSharing} />
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <CrossSettingsPanel
            settings={settings}
            setSettings={setSettings}
            isSharing={isSharing}
            estimatedCost={estimatedCost}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Chat Panel */}
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
                      const contextStr = context ? `Context: ${JSON.stringify(context)}. Recent alerts: ${alerts.slice(0, 3).map(a => a.title).join(", ")}` : "No screen shared yet.";
                      setChatMessages(prev => [...prev, { role: "assistant", content: `Based on what I see: ${contextStr}\n\nRegarding "${msg}" — I'll analyze the next frame with this in mind.` }]);
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
