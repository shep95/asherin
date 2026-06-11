import React, { useState } from "react";
import { Circle, Square, Download, Camera, Bookmark, StickyNote, Sparkles, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RecordingQuality = "economy" | "standard" | "high" | "ultra";

export interface RecordingSettings {
  quality: RecordingQuality;
  includeWebcam: boolean;
  includeMic: boolean;
  includeSystemAudio: boolean;
  includeAIOverlays: boolean;
  includeChatPanel: boolean;
  includeNotifications: boolean;
}

const QUALITY_PRESETS: Record<RecordingQuality, { label: string; desc: string; resolution: string; size: string; credits: string }> = {
  economy: { label: "Economy", desc: "720p 30fps", resolution: "1280×720", size: "~200 MB/hr", credits: "~100/hr" },
  standard: { label: "Standard", desc: "1080p 30fps", resolution: "1920×1080", size: "~500 MB/hr", credits: "~200/hr" },
  high: { label: "High", desc: "1080p 60fps", resolution: "1920×1080", size: "~900 MB/hr", credits: "~300/hr" },
  ultra: { label: "Ultra", desc: "4K 30fps", resolution: "3840×2160", size: "~1.8 GB/hr", credits: "~400/hr" },
};

interface CrossRecordingControlsProps {
  isRecording: boolean;
  isSharing: boolean;
  recordingDuration: number;
  hasRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDownloadRecording: () => void;
  onAddMarker?: () => void;
  onScreenshot?: () => void;
  onClose: () => void;
}

const CrossRecordingControls: React.FC<CrossRecordingControlsProps> = ({
  isRecording, isSharing, recordingDuration, hasRecording,
  onStartRecording, onStopRecording, onDownloadRecording,
  onAddMarker, onScreenshot, onClose,
}) => {
  const [recSettings, setRecSettings] = useState<RecordingSettings>({
    quality: "standard",
    includeWebcam: false,
    includeMic: true,
    includeSystemAudio: true,
    includeAIOverlays: true,
    includeChatPanel: true,
    includeNotifications: true,
  });
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const preset = QUALITY_PRESETS[recSettings.quality];

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors ${checked ? "bg-accent" : "bg-muted/30"}`}
      >
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5 left-0.5" : "left-0.5"}`}
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }} />
      </button>
    </label>
  );

  return (
    <div className="w-80 border-l border-border/20 flex flex-col bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Circle className="h-4 w-4 text-red-400" /> Recording Controls
        </h3>
        <button onClick={onClose} aria-label="Close recording controls"><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recording Status */}
        {isRecording ? (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
              </span>
              <span className="text-sm font-mono text-red-400">{formatTime(recordingDuration)}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={onStopRecording}>
                <Square className="h-3 w-3 mr-1.5" /> Stop
              </Button>
            </div>
            {/* Quick Actions */}
            <div className="flex gap-1.5 mt-3">
              {onScreenshot && (
                <button onClick={onScreenshot} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-white/5 hover:bg-white/10 transition text-muted-foreground" title="Screenshot">
                  <Camera className="h-3 w-3" /> Screenshot
                </button>
              )}
              {onAddMarker && (
                <button onClick={onAddMarker} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-white/5 hover:bg-white/10 transition text-muted-foreground" title="Add Marker">
                  <Bookmark className="h-3 w-3" /> Marker
                </button>
              )}
            </div>
          </div>
        ) : hasRecording ? (
          /* Post-Recording */
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">Recording Saved</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mb-3">
              Duration: {formatTime(recordingDuration)} • WebM format
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={onDownloadRecording}>
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          </div>
        ) : (
          /* Start Recording */
          <div className="space-y-3">
            <Button
              className="w-full h-10 gap-2 rounded-xl"
              onClick={onStartRecording}
              disabled={!isSharing}
            >
              <Circle className="h-4 w-4 text-red-400" />
              Start Recording
            </Button>
            {!isSharing && (
              <p className="text-[10px] text-amber-400/60 text-center">Start screen sharing first to enable recording</p>
            )}
          </div>
        )}

        {/* Quality Preset */}
        {!isRecording && (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-2">Quality Preset</p>
              <div className="relative">
                <button
                  onClick={() => setShowQualityDropdown(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/10 border border-border/20 text-xs hover:bg-muted/15 transition"
                >
                  <div>
                    <span className="text-foreground font-medium">{preset.label}</span>
                    <span className="text-muted-foreground/50 ml-2">{preset.desc}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition ${showQualityDropdown ? "rotate-180" : ""}`} />
                </button>
                {showQualityDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-background border border-border/30 shadow-xl z-20 overflow-hidden">
                    {(Object.entries(QUALITY_PRESETS) as [RecordingQuality, typeof preset][]).map(([key, p]) => (
                      <button
                        key={key}
                        onClick={() => { setRecSettings(s => ({ ...s, quality: key })); setShowQualityDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/10 transition ${key === recSettings.quality ? "bg-accent/5" : ""}`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium text-foreground">{p.label}</span>
                          <span className="text-muted-foreground/40">{p.size}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/40">{p.desc} • {p.resolution}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground/40">
                <span>Est. file size: {preset.size}</span>
                <span>Est. credits: {preset.credits}</span>
              </div>
            </div>

            {/* Track Toggles */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-2">Include in Recording</p>
              <div className="space-y-0.5">
                <Toggle label="Microphone" checked={recSettings.includeMic} onChange={v => setRecSettings(s => ({ ...s, includeMic: v }))} />
                <Toggle label="System Audio" checked={recSettings.includeSystemAudio} onChange={v => setRecSettings(s => ({ ...s, includeSystemAudio: v }))} />
                <Toggle label="Webcam (PiP)" checked={recSettings.includeWebcam} onChange={v => setRecSettings(s => ({ ...s, includeWebcam: v }))} />
                <Toggle label="AI Overlays" checked={recSettings.includeAIOverlays} onChange={v => setRecSettings(s => ({ ...s, includeAIOverlays: v }))} />
                <Toggle label="Chat Panel" checked={recSettings.includeChatPanel} onChange={v => setRecSettings(s => ({ ...s, includeChatPanel: v }))} />
                <Toggle label="Notifications" checked={recSettings.includeNotifications} onChange={v => setRecSettings(s => ({ ...s, includeNotifications: v }))} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CrossRecordingControls;
