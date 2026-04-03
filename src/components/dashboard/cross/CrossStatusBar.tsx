import React from "react";
import { Circle, Loader2, Wifi, WifiOff, Save, Settings, Mic, Video } from "lucide-react";
import { AnalysisMode, MODE_CONFIG } from "./types";

interface CrossStatusBarProps {
  isRecording: boolean;
  recordingDuration: number;
  isAnalyzing: boolean;
  isPaused: boolean;
  isSharing: boolean;
  mode: AnalysisMode;
  frameCount: number;
  estimatedCost: number;
  sessionDuration: string;
  audioEnabled: boolean;
  webcamEnabled?: boolean;
  onToggleSettings?: () => void;
}

const CrossStatusBar: React.FC<CrossStatusBarProps> = ({
  isRecording, recordingDuration, isAnalyzing, isPaused, isSharing,
  mode, frameCount, estimatedCost, sessionDuration, audioEnabled,
  webcamEnabled, onToggleSettings,
}) => {
  if (!isSharing) return null;

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const creditUsed = Math.round(estimatedCost * 50);
  const creditPercent = Math.min((creditUsed / 15000) * 100, 100);
  const creditColor = creditPercent > 90 ? "text-red-400" : creditPercent > 70 ? "text-amber-400" : "text-emerald-400";

  const aiState = isAnalyzing
    ? { label: "Analyzing", color: "text-blue-400", icon: <Loader2 className="h-3 w-3 animate-spin text-blue-400" /> }
    : isPaused
    ? { label: "Paused", color: "text-amber-400", icon: <Circle className="h-2.5 w-2.5 text-amber-400 fill-amber-400" /> }
    : { label: "Active", color: "text-emerald-400", icon: <Circle className="h-2.5 w-2.5 text-emerald-400 fill-emerald-400" /> };

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-background/95 backdrop-blur-md border-t border-border/20 text-[11px] font-extralight select-none" style={{ height: 36 }}>
      {/* Left — Recording / Session */}
      <div className="flex items-center gap-4">
        {isRecording ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
            </span>
            <span className="text-red-400 font-mono tracking-wider">REC {formatTime(recordingDuration)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 text-muted-foreground/40 fill-muted-foreground/40" />
            <span className="text-muted-foreground/60 font-mono">{sessionDuration}</span>
          </div>
        )}

        <div className="h-3 w-px bg-border/30" />

        {/* AI Status */}
        <div className="flex items-center gap-1.5">
          {aiState.icon}
          <span className={`${aiState.color}`}>AI: {aiState.label}</span>
          {isAnalyzing && (
            <span className="text-muted-foreground/40 ml-0.5">
              ({MODE_CONFIG[mode]?.label})
            </span>
          )}
        </div>
      </div>

      {/* Center — Credits & Frames */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className={creditColor}>◈ Credits: {creditUsed.toLocaleString()} / 15,000</span>
        </div>
        <div className="h-3 w-px bg-border/30" />
        <span className="text-muted-foreground/50">F{frameCount}</span>
        <span className="text-muted-foreground/50">~${estimatedCost.toFixed(2)}</span>
      </div>

      {/* Right — Quick Toggles */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Save className="h-3 w-3 text-emerald-400/60" />
          <span className="text-emerald-400/60">Auto-save ON</span>
        </div>

        <div className="h-3 w-px bg-border/30" />

        <div className="flex items-center gap-1">
          <Wifi className="h-3 w-3 text-emerald-400/60" />
          <span className="text-emerald-400/60">Connected</span>
        </div>

        {audioEnabled && (
          <>
            <div className="h-3 w-px bg-border/30" />
            <Mic className="h-3 w-3 text-accent/50" />
          </>
        )}

        {webcamEnabled && (
          <>
            <div className="h-3 w-px bg-border/30" />
            <Video className="h-3 w-3 text-accent/50" />
          </>
        )}

        {onToggleSettings && (
          <>
            <div className="h-3 w-px bg-border/30" />
            <button onClick={onToggleSettings} className="hover:text-foreground text-muted-foreground/50 transition">
              <Settings className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CrossStatusBar;
