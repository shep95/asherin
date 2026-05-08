import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Monitor, Play, Square, Settings, MessageSquare, EyeOff, ChevronUp, Loader2, Shield, X,
  Circle, BarChart3, Activity, Bell, Send, Download, Trash2, Video as VideoIcon, FolderOpen, History, GitBranch, Fingerprint
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { VoiceAlertEngine } from "./voiceEngine";
import CrossSettingsPanel from "./CrossSettings";
import CrossAlertFeed from "./CrossAlertFeed";
import CrossActivityFeed from "./CrossActivityFeed";
import CrossAnalyticsSummary from "./CrossAnalyticsSummary";
import CrossSalesIntelligence from "./CrossSalesIntelligence";
import CrossAudioVisualPanel from "./CrossAudioVisualPanel";
import CrossConsentBanner from "./CrossConsentBanner";
import CrossStatusBar from "./CrossStatusBar";
import CrossChatPanel, { ChatMessage } from "./CrossChatPanel";
import CrossToastSystem, { CrossToast } from "./CrossToastSystem";
import CrossRecordingControls from "./CrossRecordingControls";
import CrossRecordingLibrary from "./CrossRecordingLibrary";
import CrossSessionHistory from "./CrossSessionHistory";
import CrossWorkflowMap from "./CrossWorkflowMap";
import CrossSocialIntelProfiler from "./CrossSocialIntelProfiler";

import { ADMIN_EMAIL, VERDICT_STYLES, OVERLAY_COLORS, OVERLAY_POSITIONS } from "./constants";

/** Safely convert any value to a renderable string — prevents "Objects are not valid as React child" */
const safeStr = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

import {
  CrossAlert, CrossContext, CrossSettings, QuickVerdict, ScreenOverlay,
  VerdictAction, DEFAULT_SETTINGS, AnalysisMode, ActivityEntry, SessionAnalytics, MODE_CONFIG,
  SalesIntelligence, EmotionState, EngagementMetrics, SpeakerInfo,
} from "./types";

let voiceEngine: VoiceAlertEngine;
try {
  voiceEngine = new VoiceAlertEngine();
} catch (e) {
  console.error("Failed to initialize Cross engines:", e);
  voiceEngine = new VoiceAlertEngine();
}

// ── Notification type ──
interface CrossNotification {
  id: string;
  type: "insight" | "alert" | "verdict" | "system";
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  severity?: "low" | "medium" | "high" | "critical";
}

const CrossView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.email === ADMIN_EMAIL;

  // ── Core state ──
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showSocialIntel, setShowSocialIntel] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // ── Settings & session ──
  const [settings, setSettings] = useState<CrossSettings>(DEFAULT_SETTINGS);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  // ── Vision state ──
  const [quickVerdict, setQuickVerdict] = useState<QuickVerdict | null>(null);
  const [overlays, setOverlays] = useState<ScreenOverlay[]>([]);
  const [verdictVisible, setVerdictVisible] = useState(true);
  const [frameExplanations, setFrameExplanations] = useState<string[]>([]);

  // ── Activity & analytics ──
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [alertsAccepted, setAlertsAccepted] = useState(0);
  const [alertsDismissed, setAlertsDismissed] = useState(0);

  // ── Audio-visual intelligence ──
  const [salesIntel, setSalesIntel] = useState<SalesIntelligence | undefined>();
  const [emotions, setEmotions] = useState<EmotionState | undefined>();
  const [engagement, setEngagement] = useState<EngagementMetrics | undefined>();
  const [speakers, setSpeakers] = useState<SpeakerInfo[] | undefined>();
  const [psychProfile, setPsychProfile] = useState<any>(null);

  // ── Notifications ──
  const [notifications, setNotifications] = useState<CrossNotification[]>([]);

  // ── Toast system ──
  const [liveToasts, setLiveToasts] = useState<CrossToast[]>([]);

  // ── Recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // ── Refs ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousAlertsRef = useRef<CrossAlert[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeFrameRef = useRef<() => Promise<void>>();

  useEffect(() => { voiceEngine.setEnabled(settings.voiceEnabled); }, [settings.voiceEnabled]);
  useEffect(() => () => { stopSharing(); }, []);

  // ── Helpers ──
  const pushToast = useCallback((type: CrossToast["type"], title: string, body: string, actions?: CrossToast["actions"]) => {
    setLiveToasts(prev => [{
      id: crypto.randomUUID(), type, title, body, timestamp: new Date(), actions,
    }, ...prev].slice(0, 20));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setLiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const pushNotification = useCallback((type: CrossNotification["type"], title: string, body: string, severity?: CrossNotification["severity"]) => {
    setNotifications(prev => [{
      id: crypto.randomUUID(), type, title, body, timestamp: new Date(), read: false, severity,
    }, ...prev].slice(0, 100));

    // Also push to toast system for live display
    const toastType = severity === "critical" ? "critical" as const : severity === "high" ? "warning" as const : type === "verdict" ? "success" as const : "info" as const;
    setLiveToasts(prev => [{
      id: crypto.randomUUID(), type: toastType, title, body, timestamp: new Date(),
    }, ...prev].slice(0, 20));
  }, []);

  const addActivity = useCallback((action: string, detail: string, confidence?: number) => {
    setActivities(prev => [{
      id: crypto.randomUUID(), timestamp: new Date(), mode: settings.mode, action, detail, confidence,
    }, ...prev].slice(0, 50));
  }, [settings.mode]);

  const sessionAnalytics = useMemo((): SessionAnalytics => ({
    framesAnalyzed: frameCount,
    framesSkipped: skippedFrames,
    alertsFired: alerts.length,
    alertsAccepted,
    alertsDismissed,
    sessionDurationMs: sessionStart ? Date.now() - sessionStart.getTime() : 0,
    estimatedCost,
    modeBreakdown: { [settings.mode]: frameCount },
  }), [frameCount, skippedFrames, alerts.length, alertsAccepted, alertsDismissed, sessionStart, estimatedCost, settings.mode]);

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

  // ── Frame Analysis ──
  const analyzeFrame = useCallback(async () => {
    if (isAnalyzing || isPaused) return;
    const frame = captureFrame();
    if (!frame) return;

    if (settings.pauseOnNoChange) {
      setSkippedFrames(prev => prev + 1);
      return;
    }

    setIsAnalyzing(true);
    setFrameCount(prev => prev + 1);

    try {
      const headers = await getAuthHeaders();
      let activeBrainId: string | null = null;
      try { activeBrainId = localStorage.getItem("aureon_active_brain_id"); } catch { /* ignore */ }

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
            activeBrainId,
          }),
        }
      );

      if (!resp.ok) { console.error("Cross analyze error:", await resp.text()); return; }

      const analysis = await resp.json();

      if (analysis.context) {
        setContext({ ...analysis.context, mode: settings.mode });
      }

      if (analysis.salesIntel) setSalesIntel(analysis.salesIntel);
      if (analysis.emotions) setEmotions(analysis.emotions);
      if (analysis.engagement) setEngagement(analysis.engagement);
      if (analysis.speakers) setSpeakers(analysis.speakers);
      if (analysis.psychProfile?.humansDetected) setPsychProfile(analysis.psychProfile);
      else if (analysis.psychProfile?.humansDetected === false) setPsychProfile(null);

      if (analysis.observations?.length) {
        // Normalize observations: AI may return strings OR {type, title, description} objects
        const normalizedObs = analysis.observations.map((obs: any) => {
          if (typeof obs === "string") return obs;
          if (obs && typeof obs === "object") {
            const parts = [obs.title, obs.description].filter(Boolean).map(safeStr);
            return parts.join(" — ") || safeStr(obs);
          }
          return safeStr(obs);
        });
        setObservations(normalizedObs);
        setFrameExplanations(normalizedObs);
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
        addActivity(v.action.replace("_", " "), v.message, v.confidence);
        pushNotification("verdict", v.action.replace("_", " "), v.message, v.urgency === "immediate" ? "critical" : "high");

        if (v.urgency !== "immediate") setTimeout(() => setVerdictVisible(false), 15000);

        if (["FIX_NOW"].includes(v.action)) {
          if (settings.soundEnabled) {
            try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
          }
          if (settings.voiceEnabled) voiceEngine.speakVerdict(v.action, v.message, v.confidence);
        }
      } else if (analysis.quickVerdict?.action === "NONE" && quickVerdict && (Date.now() - quickVerdict.timestamp.getTime()) > 30000) {
        setVerdictVisible(false);
      }

      setOverlays(analysis.overlays?.length ? analysis.overlays : []);

      if (analysis.privacyWarning) {
        setPrivacyWarning(analysis.privacyWarning);
        setIsPaused(true);
        pushNotification("system", "Privacy Warning", analysis.privacyWarning, "critical");
      }

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
            domain: settings.mode,
          }));

        if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
          previousAlertsRef.current = [...newAlerts, ...previousAlertsRef.current].slice(0, 10);
          newAlerts.forEach(a => {
            addActivity(a.type, a.title, a.confidence);
            pushNotification("alert", a.title, a.reasoning?.join(" · ") || "", a.severity === "critical" ? "critical" : "medium");
          });

          if (settings.soundEnabled && newAlerts.some(a =>
            a.severity === "critical" || ["BUY", "SELL", "WARNING", "BUG", "VULNERABILITY"].includes(a.type)
          )) {
            try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==").play(); } catch {}
          }
        }
      }

      setEstimatedCost(prev => prev + 0.02);
    } catch (e) {
      console.error("Cross frame analysis failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPaused, captureFrame, getAuthHeaders, context, settings, quickVerdict, addActivity, pushNotification]);

  useEffect(() => { analyzeFrameRef.current = analyzeFrame; }, [analyzeFrame]);

  // ── Screen Sharing ──
  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5 } },
        audio: settings.audioEnabled,
      });
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
      setActivities([]);
      setAlertsAccepted(0);
      setAlertsDismissed(0);
      setRecordedChunks([]);
      setRecordingDuration(0);
      setFrameExplanations([]);
      setNotifications([]);
      setLiveToasts([]);
      

      // Create session in database
      if (user) {
        const modeLabel = MODE_CONFIG[settings.mode]?.label || settings.mode;
        const { data: sessionData } = await supabase.from("cross_sessions").insert({
          user_id: user.id,
          title: `${modeLabel} Session — ${new Date().toLocaleString()}`,
          mode: settings.mode,
          status: "active",
          settings: settings as any,
        }).select("id").single();
        if (sessionData) setActiveSessionId(sessionData.id);
      }

      intervalRef.current = setInterval(() => {
        analyzeFrameRef.current?.();
      }, settings.frameRate * 1000);

      const modeLabel = MODE_CONFIG[settings.mode]?.label || settings.mode;
      pushNotification("system", "Session Started", `Cross is watching in ${modeLabel} mode`);
      toast({ title: "Screen sharing started", description: `Cross is watching in ${modeLabel} mode` });
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        toast({ title: "Failed to start screen sharing", description: e.message, variant: "destructive" });
      }
    }
  }, [settings.frameRate, settings.mode, settings.audioEnabled, toast, pushNotification, user]);

  const stopSharing = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    stopRecording();

    // Save session to database
    if (activeSessionId && user) {
      const duration = sessionStart ? Math.floor((Date.now() - sessionStart.getTime()) / 1000) : 0;
      const summary = observations.length > 0 ? observations.slice(0, 3).join(" · ") : null;
      await supabase.from("cross_sessions").update({
        status: "completed",
        duration,
        frames_analyzed: frameCount,
        frames_skipped: skippedFrames,
        alerts_fired: alerts.length,
        credits_used: estimatedCost,
        ai_summary: summary,
        tags: [settings.mode, ...(context?.pair ? [context.pair] : []), ...(context?.app ? [context.app] : [])],
      }).eq("id", activeSessionId);
      setActiveSessionId(null);
    }

    setIsSharing(false);
    setIsPaused(false);
    setSessionStart(null);
  }, [activeSessionId, user, sessionStart, frameCount, skippedFrames, alerts.length, estimatedCost, observations, settings.mode, context]);

  useEffect(() => {
    if (isSharing && !isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => { analyzeFrameRef.current?.(); }, settings.frameRate * 1000);
    }
    return () => { if (intervalRef.current && !isSharing) clearInterval(intervalRef.current); };
  }, [settings.frameRate, isSharing, isPaused]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      setPrivacyWarning(null);
      intervalRef.current = setInterval(() => { analyzeFrameRef.current?.(); }, settings.frameRate * 1000);
    } else {
      setIsPaused(true);
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
  }, [isPaused, settings.frameRate]);

  // ── Screen Recording ──
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp9" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => { setRecordedChunks(chunks); };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => { setRecordingDuration(prev => prev + 1); }, 1000);
      pushToast("info", "Recording Started", "Screen recording is now active");
    } catch (e: any) {
      toast({ title: "Recording failed", description: e.message, variant: "destructive" });
    }
  }, [toast, pushToast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  }, []);

  const downloadRecording = useCallback(() => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cross-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Recording downloaded" });
  }, [recordedChunks, toast]);

  // ── Chat ──
  const sendChatMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || isChatLoading) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
    setIsChatLoading(true);

    try {
      const headers = await getAuthHeaders();
      let activeBrainId: string | null = null;
      try { activeBrainId = localStorage.getItem("aureon_active_brain_id"); } catch {}

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cross-analyze`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            frame: captureFrame(),
            chatMessage: msg,
            context: context ? JSON.stringify(context) : undefined,
            previousAlerts: previousAlertsRef.current.slice(-3).map(a => ({ type: a.type, title: a.title })),
            settings: { mode: settings.mode, sensitivity: settings.sensitivity },
            activeBrainId,
          }),
        }
      );

      if (!resp.ok) throw new Error("Analysis unavailable");

      const data = await resp.json();
      const reply = data.observations?.map((o: any) => typeof o === "string" ? o : o?.description || o?.title || safeStr(o)).join("\n\n") || data.quickVerdict?.message || "I'm analyzing your screen. Nothing notable right now.";

      // Determine message type from content
      let msgType: ChatMessage["type"] = "text";
      if (reply.includes("⚠️") || reply.includes("WARNING")) msgType = "warning";
      else if (reply.includes("📊") || reply.includes("ANALYSIS")) msgType = "analysis";
      else if (reply.includes("💡") || reply.includes("SUGGEST")) msgType = "suggestion";
      else if (reply.includes("🎯") || reply.includes("OPPORTUNITY")) msgType = "insight";

      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        timestamp: new Date(),
        type: msgType,
        confidence: data.quickVerdict?.confidence,
      }]);

      if (data.quickVerdict && data.quickVerdict.action !== "NONE") {
        const v: QuickVerdict = {
          action: data.quickVerdict.action as VerdictAction,
          urgency: data.quickVerdict.urgency || "watch",
          message: data.quickVerdict.message || "",
          confidence: data.quickVerdict.confidence || 50,
          timestamp: new Date(),
        };
        setQuickVerdict(v);
        setVerdictVisible(true);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Connection error — please try again.", timestamp: new Date(), type: "warning" }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, getAuthHeaders, captureFrame, context, settings]);

  const handleDismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    setAlertsDismissed(prev => prev + 1);
  }, []);

  const sessionDuration = useMemo(() => {
    if (!sessionStart) return "00:00";
    const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  }, [sessionStart, frameCount]);

  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setSettings(s => ({ ...s, mode }));
    if (!isSharing) {
      
      setAlerts([]);
      setObservations([]);
      setContext(null);
      setFrameExplanations([]);
    }
  }, [isSharing]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close other panels when opening one
  const openPanel = useCallback((panel: "chat" | "settings" | "notifications" | "recording" | "analytics" | "library" | "history" | "workflow" | "socialIntel") => {
    setShowChat(panel === "chat" ? c => !c : false);
    setShowSettings(panel === "settings" ? s => !s : false);
    setShowNotifications(panel === "notifications" ? n => !n : false);
    setShowRecordingPanel(panel === "recording" ? r => !r : false);
    setShowLibrary(panel === "library" ? l => !l : false);
    setShowHistory(panel === "history" ? h => !h : false);
    setShowWorkflow(panel === "workflow" ? w => !w : false);
    setShowSocialIntel(panel === "socialIntel" ? s => !s : false);
    if (panel !== "analytics") setShowAnalytics(false);
    else setShowAnalytics(a => !a);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Shield className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground font-extralight">Cross is restricted to authorized accounts only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Toast Notification System — floating on top */}
      <CrossToastSystem toasts={liveToasts} onDismiss={dismissToast} maxVisible={3} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-lg font-extralight tracking-wide text-foreground">Cross</h1>
            <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/50 uppercase">
              Cognitive Real-time Observation & Screen Synthesis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isSharing && (
            <div className="flex items-center gap-2 mr-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? "bg-amber-400" : "bg-emerald-400"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? "bg-amber-400" : "bg-emerald-400"}`} />
              </span>
              <span className="text-xs font-extralight text-muted-foreground">
                {isPaused ? "PAUSED" : "WATCHING"} · {sessionDuration}
              </span>
            </div>
          )}

          {/* Recording button */}
          <Button variant="ghost" size="icon" onClick={() => openPanel("recording")} className={`h-8 w-8 ${isRecording ? "text-red-400" : ""}`} title="Recording">
            {isRecording ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400" />
              </span>
            ) : (
              <VideoIcon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" onClick={() => openPanel("notifications")} className="h-8 w-8 relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("library")} className="h-8 w-8" title="Recording Library">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("history")} className="h-8 w-8" title="Session History">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("workflow")} className={`h-8 w-8 ${showWorkflow ? "text-accent" : ""}`} title="Workflow Intelligence">
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("socialIntel")} className={`h-8 w-8 ${showSocialIntel ? "text-amber-400" : ""}`} title="Social Intel Profiler">
            <Fingerprint className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("analytics")} className="h-8 w-8">
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("chat")} className="h-8 w-8">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openPanel("settings")} className="h-8 w-8">
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
          <div className="relative rounded-xl border border-border/30 bg-muted/10 overflow-hidden" style={{ minHeight: "260px" }}>
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline style={{ display: isSharing ? "block" : "none", maxHeight: "380px" }} />
            <canvas ref={canvasRef} className="hidden" />

            {!isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                <div className="relative">
                  <Monitor className="h-16 w-16 text-muted-foreground/15" />
                  <Activity className="h-6 w-6 text-accent/30 absolute -right-1 -bottom-1" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground/60 font-extralight">Share your screen to begin <span className="text-foreground/80">{MODE_CONFIG[settings.mode]?.label}</span> analysis</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">{MODE_CONFIG[settings.mode]?.description}</p>
                </div>
                <Button onClick={startSharing} className="gap-2 rounded-xl">
                  <Play className="h-4 w-4" />
                  Start Sharing Screen
                </Button>
              </div>
            )}

            {/* QUICK VERDICT BANNER */}
            {isSharing && quickVerdict && verdictVisible && quickVerdict.action !== "NONE" && VERDICT_STYLES[quickVerdict.action] && (
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
                  <div className={`rounded-lg border backdrop-blur-sm ${colorClass} ${sizeClass} font-medium shadow-md`}>
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
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50 rounded-lg" onClick={togglePause}>
                  {isPaused ? <Play className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs backdrop-blur-sm bg-background/50 text-red-400 hover:text-red-300 rounded-lg" onClick={stopSharing}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute bottom-3 left-3 z-30">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  <span className="text-[10px] text-muted-foreground">Analyzing ({MODE_CONFIG[settings.mode]?.label})...</span>
                </div>
              </div>
            )}
          </div>

          {/* Mini verdict bar */}
          {isSharing && quickVerdict && !verdictVisible && quickVerdict.action !== "NONE" && VERDICT_STYLES[quickVerdict.action] && (
            <button
              onClick={() => setVerdictVisible(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${VERDICT_STYLES[quickVerdict.action].bg} border border-white/10 transition hover:opacity-90`}
            >
              <span>{VERDICT_STYLES[quickVerdict.action].emoji}</span>
              <span className={`text-xs font-medium ${VERDICT_STYLES[quickVerdict.action].text}`}>{quickVerdict.action.replace("_", " ")} — {quickVerdict.confidence}%</span>
              <span className={`text-[10px] ${VERDICT_STYLES[quickVerdict.action].text} opacity-60`}>{quickVerdict.message.slice(0, 60)}</span>
              <ChevronUp className="h-3 w-3 ml-auto opacity-50" />
            </button>
          )}

          {/* Frame Explanations */}
          {/* ── What Cross Sees — Human-Readable ── */}
          {isSharing && frameExplanations.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/10">
              <p className="text-[10px] uppercase tracking-wider text-accent/60 mb-1.5 flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Live Scene Understanding
              </p>
              <div className="space-y-1.5">
                {frameExplanations.map((exp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">{i === 0 ? "👁️" : i === 1 ? "📍" : "💡"}</span>
                    <p className="text-xs text-foreground/80 font-extralight leading-relaxed">{safeStr(exp)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Psychological Profile — Human-Readable ── */}
          {isSharing && psychProfile?.humansDetected && Array.isArray(psychProfile.subjects) && psychProfile.subjects.length > 0 && (
            <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 overflow-hidden">
              <div className="px-3 py-2 border-b border-purple-500/10 flex items-center gap-2">
                <span className="text-sm">🧠</span>
                <span className="text-[10px] uppercase tracking-wider text-purple-300/70 font-medium">
                  People Detected — {psychProfile.subjects.length} {psychProfile.subjects.length === 1 ? "Person" : "People"}
                </span>
              </div>
              <div className="divide-y divide-purple-500/10">
                {psychProfile.subjects.map((subject: any, idx: number) => {
                  // Human-readable Big Five interpretation
                  const getBigFiveLabel = (key: string, val: number) => {
                    const labels: Record<string, [string, string]> = {
                      openness: ["Conventional", "Creative & Curious"],
                      conscientiousness: ["Laid-back", "Organized & Disciplined"],
                      extraversion: ["Introverted", "Outgoing & Social"],
                      agreeableness: ["Competitive", "Warm & Cooperative"],
                      neuroticism: ["Emotionally Stable", "Emotionally Reactive"],
                    };
                    const [low, high] = labels[key] || ["Low", "High"];
                    return val >= 70 ? high : val <= 30 ? low : `Moderate`;
                  };

                  // Human-readable emotion
                  const getEmotionEmoji = (emotion: string) => {
                    const map: Record<string, string> = {
                      happy: "😊", joy: "😊", calm: "😌", neutral: "😐", sad: "😔",
                      angry: "😠", fear: "😰", surprise: "😲", disgust: "🤢", contempt: "😏",
                      anxious: "😟", stressed: "😓", focused: "🎯", confused: "😕", bored: "😒",
                      excited: "🤩", confident: "😎", nervous: "😬",
                    };
                    return map[emotion?.toLowerCase()] || "😐";
                  };

                  // Mood bar color
                  const getMoodColor = (valence: number) => {
                    if (valence >= 0.7) return "bg-emerald-400";
                    if (valence >= 0.4) return "bg-blue-400";
                    if (valence >= 0.2) return "bg-amber-400";
                    return "bg-red-400";
                  };

                  // Deception interpretation
                  const getDeceptionLabel = (val: number) => {
                    if (val <= 15) return { label: "Very Honest", color: "text-emerald-400", icon: "✅" };
                    if (val <= 35) return { label: "Mostly Honest", color: "text-emerald-300", icon: "👍" };
                    if (val <= 55) return { label: "Some Inconsistencies", color: "text-amber-400", icon: "⚠️" };
                    if (val <= 75) return { label: "Likely Withholding", color: "text-orange-400", icon: "🚩" };
                    return { label: "High Deception Risk", color: "text-red-400", icon: "🚨" };
                  };

                  const stressLabel = (val: number) => {
                    if (val <= 20) return "Relaxed";
                    if (val <= 40) return "At Ease";
                    if (val <= 60) return "Moderate Stress";
                    if (val <= 80) return "Elevated Stress";
                    return "Highly Stressed";
                  };

                  return (
                    <div key={idx} className="p-3 space-y-3">
                      {/* Person Header */}
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm">
                          {subject.gender === "female" ? "👩" : subject.gender === "male" ? "👨" : "🧑"}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-foreground block">{safeStr(subject.label) || `Person ${idx + 1}`}</span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {subject.estimatedAge && `Age ~${safeStr(subject.estimatedAge)}`}
                            {subject.appearance && ` · ${safeStr(subject.appearance).slice(0, 80)}`}
                          </span>
                        </div>
                      </div>

                      {/* Emotional State — Plain Language */}
                      {subject.emotionalState && (
                        <div className="rounded-lg bg-muted/10 px-3 py-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{getEmotionEmoji(safeStr(subject.emotionalState.primary))}</span>
                            <div>
                              <p className="text-xs text-foreground/90 font-medium capitalize">
                                Feeling {safeStr(subject.emotionalState.primary)}
                                {subject.emotionalState.secondary && ` with hints of ${safeStr(subject.emotionalState.secondary).replace("_", " ")}`}
                              </p>
                            </div>
                          </div>
                          {/* Mood bar instead of raw V/A/D numbers */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground/40 w-10">Mood</span>
                            <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getMoodColor(subject.emotionalState.valence ?? 0.5)} transition-all`} style={{ width: `${(subject.emotionalState.valence ?? 0.5) * 100}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground/40 w-10">Energy</span>
                            <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(subject.emotionalState.arousal ?? 0.5) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Personality — Human Readable */}
                      {subject.bigFive && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-purple-400/40 mb-1.5">Personality Snapshot</p>
                          <div className="space-y-1">
                            {[
                              { key: "openness", label: "Openness", color: "bg-blue-400" },
                              { key: "conscientiousness", label: "Discipline", color: "bg-emerald-400" },
                              { key: "extraversion", label: "Social Energy", color: "bg-amber-400" },
                              { key: "agreeableness", label: "Warmth", color: "bg-pink-400" },
                              { key: "neuroticism", label: "Sensitivity", color: "bg-red-400" },
                            ].map(trait => {
                              const val = subject.bigFive[trait.key] ?? 50;
                              return (
                                <div key={trait.key} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground/50 w-20 shrink-0">{trait.label}</span>
                                  <div className="flex-1 h-1.5 bg-muted/15 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${trait.color}/40 transition-all`} style={{ width: `${val}%` }} />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground/40 w-28 text-right shrink-0">{getBigFiveLabel(trait.key, val)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Micro-Expressions — Readable */}
                      {subject.microExpressions?.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-purple-400/40 mb-1">Facial Cues Detected</p>
                          <div className="flex flex-wrap gap-1">
                            {subject.microExpressions.map((me: any, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-200/70">
                                ⚡ {safeStr(me)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Body Language — Readable */}
                      {subject.bodyLanguage && (
                        <div className="flex flex-wrap gap-1.5">
                          {subject.bodyLanguage.posture && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted/10 text-foreground/70">
                              🧍 {safeStr(subject.bodyLanguage.posture)}
                            </span>
                          )}
                          {subject.bodyLanguage.orientationSignal && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted/10 text-foreground/70">
                              🧭 {safeStr(subject.bodyLanguage.orientationSignal)}
                            </span>
                          )}
                          {Array.isArray(subject.bodyLanguage.selfTouchingBehaviors) && subject.bodyLanguage.selfTouchingBehaviors.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300/70">
                              🤚 {subject.bodyLanguage.selfTouchingBehaviors.map(safeStr).join(", ")}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Key Indicators — Human Language */}
                      <div className="flex flex-wrap gap-1.5">
                        {subject.stressLevel != null && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${subject.stressLevel > 60 ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                            {subject.stressLevel > 60 ? "😓" : "😌"} {stressLabel(subject.stressLevel)}
                          </span>
                        )}
                        {subject.engagementLevel != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                            {subject.engagementLevel >= 70 ? "🎯 Highly Engaged" : subject.engagementLevel >= 40 ? "👀 Paying Attention" : "💤 Disengaged"}
                          </span>
                        )}
                        {subject.confidenceLevel != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">
                            {subject.confidenceLevel >= 70 ? "💪 Very Confident" : subject.confidenceLevel >= 40 ? "🤔 Somewhat Confident" : "😶 Uncertain"}
                          </span>
                        )}
                        {subject.deceptionLikelihood != null && (() => {
                          const d = getDeceptionLabel(subject.deceptionLikelihood);
                          return (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${subject.deceptionLikelihood > 40 ? "bg-red-500/10" : "bg-emerald-500/10"} ${d.color}`}>
                              {d.icon} {d.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Dark Triad — Clear Warning Style */}
                      {subject.darkTriadIndicators && (
                        <div className="px-2.5 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                          <p className="text-[9px] uppercase tracking-wider text-red-400/50 mb-1.5">⚠️ Personality Red Flags</p>
                          <div className="space-y-1">
                            {[
                              { key: "narcissism", label: "Self-Centered Traits", emoji: "🪞" },
                              { key: "machiavellianism", label: "Manipulative Traits", emoji: "🎭" },
                              { key: "psychopathy", label: "Callous Traits", emoji: "🧊" },
                            ].filter(t => subject.darkTriadIndicators[t.key] != null).map(t => {
                              const val = subject.darkTriadIndicators[t.key];
                              return (
                                <div key={t.key} className="flex items-center gap-2">
                                  <span className="text-[10px]">{t.emoji}</span>
                                  <span className="text-[10px] text-muted-foreground/50 w-28 shrink-0">{t.label}</span>
                                  <div className="flex-1 h-1.5 bg-muted/15 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${val > 50 ? "bg-red-400" : "bg-emerald-400"}/40 transition-all`} style={{ width: `${val}%` }} />
                                  </div>
                                  <span className={`text-[9px] ${val > 50 ? "text-red-400" : "text-muted-foreground/40"}`}>{val > 70 ? "Elevated" : val > 50 ? "Notable" : "Low"}</span>
                                </div>
                              );
                            })}
                          </div>
                          {subject.darkTriadIndicators.assessment && <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-extralight italic">{safeStr(subject.darkTriadIndicators.assessment)}</p>}
                        </div>
                      )}

                      {/* Cognitive Load */}
                      {subject.cognitiveLoad && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span>{subject.cognitiveLoad.level === "high" ? "🧠💥" : subject.cognitiveLoad.level === "medium" ? "🧠" : "🧠✨"}</span>
                          <span className="text-muted-foreground/60">
                            Mental Load: {subject.cognitiveLoad.level === "high" ? "Thinking Hard" : subject.cognitiveLoad.level === "medium" ? "Moderate Focus" : "Relaxed & Clear"}
                          </span>
                        </div>
                      )}

                      {/* Summary */}
                      {subject.summary && (
                        <p className="text-[11px] text-foreground/70 font-extralight italic border-l-2 border-purple-400/30 pl-2">{safeStr(subject.summary)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showAnalytics && isSharing && (
            <CrossAnalyticsSummary analytics={sessionAnalytics} sessionDuration={sessionDuration} />
          )}

          

          {context && isSharing && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/10 border border-border/20 text-xs font-extralight text-muted-foreground flex-wrap">
              <span className="text-accent">Context:</span>
              {context.app && <span>{context.app}</span>}
              {context.pair && <span className="text-foreground font-normal">{context.pair}</span>}
              {context.timeframe && <span>{context.timeframe}</span>}
              {context.price && <span className="text-foreground">{context.price}</span>}
              {context.exchange && <span>{context.exchange}</span>}
              {context.language && <span className="text-blue-400/70">{context.language}</span>}
              {context.file && <span className="text-foreground/60 font-mono text-[10px]">{context.file}</span>}
              {context.tool && <span>{context.tool}</span>}
              {context.document && <span>{context.document}</span>}
              {context.url && <span className="text-foreground/40 text-[10px] truncate max-w-[200px]">{context.url}</span>}
            </div>
          )}

          {isSharing && <CrossSalesIntelligence intel={salesIntel} isActive={["negotiation"].includes(settings.mode)} />}
          {isSharing && <CrossAudioVisualPanel settings={settings} emotions={emotions} engagement={engagement} speakers={speakers} isActive={["hr", "legal", "support", "negotiation", "healthcare", "education"].includes(settings.mode)} />}

          <CrossConsentBanner
            settings={settings}
            onConsentGranted={() => setSettings(s => ({ ...s, consentCollected: true }))}
            onConsentDeclined={() => setSettings(s => ({ ...s, audioEnabled: false, facialAnalysisEnabled: false }))}
          />

          <CrossAlertFeed alerts={alerts} onDismiss={handleDismissAlert} isSharing={isSharing} />
          {activities.length > 0 && <CrossActivityFeed activities={activities} />}

        </div>

        {/* Side Panels */}
        {showNotifications && (
          <div className="w-80 border-l border-border/30 flex flex-col bg-background">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" /> Notifications
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-[10px] text-accent hover:text-accent/80 mr-2">Mark all read</button>
                <button onClick={() => setShowNotifications(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 text-center py-8 font-extralight">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border/10 cursor-pointer hover:bg-muted/5 transition ${!n.read ? "bg-accent/3" : ""}`}
                    onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                        n.severity === "critical" ? "bg-red-400" :
                        n.severity === "high" ? "bg-amber-400" :
                        n.type === "verdict" ? "bg-emerald-400" :
                        "bg-muted-foreground/30"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[9px] text-muted-foreground/30 mt-1">
                          {n.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showSettings && (
          <CrossSettingsPanel
            settings={settings}
            setSettings={setSettings}
            isSharing={isSharing}
            estimatedCost={estimatedCost}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showRecordingPanel && (
          <CrossRecordingControls
            isRecording={isRecording}
            isSharing={isSharing}
            recordingDuration={recordingDuration}
            hasRecording={recordedChunks.length > 0}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onDownloadRecording={downloadRecording}
            onClose={() => setShowRecordingPanel(false)}
          />
        )}

        {showChat && (
          <CrossChatPanel
            messages={chatMessages}
            input={chatInput}
            isLoading={isChatLoading}
            onInputChange={setChatInput}
            onSend={sendChatMessage}
            onClose={() => setShowChat(false)}
          />
        )}

        {showLibrary && (
          <div className="w-96 border-l border-border/20 flex flex-col bg-background">
            <CrossRecordingLibrary onClose={() => setShowLibrary(false)} />
          </div>
        )}

        {showHistory && (
          <CrossSessionHistory onClose={() => setShowHistory(false)} />
        )}

        {showWorkflow && (
          <CrossWorkflowMap
            onClose={() => setShowWorkflow(false)}
            isSharing={isSharing}
            currentSessionId={activeSessionId}
          />
        )}

        {showSocialIntel && (
          <CrossSocialIntelProfiler
            onClose={() => setShowSocialIntel(false)}
            isSharing={isSharing}
            currentObservations={observations}
            currentContext={context}
          />
        )}
      </div>

      {/* Status Bar — Bottom Strip */}
      <CrossStatusBar
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        isAnalyzing={isAnalyzing}
        isPaused={isPaused}
        isSharing={isSharing}
        mode={settings.mode}
        frameCount={frameCount}
        estimatedCost={estimatedCost}
        sessionDuration={sessionDuration}
        audioEnabled={settings.audioEnabled}
        onToggleSettings={() => openPanel("settings")}
      />
    </div>
  );
};

export default CrossView;
