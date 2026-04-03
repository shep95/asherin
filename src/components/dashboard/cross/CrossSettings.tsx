import React from "react";
import { Volume2, VolumeX, Mic, MicOff, X, Video, Eye, Shield } from "lucide-react";
import { CrossSettings as SettingsType, AnalysisMode, Sensitivity, MODE_CONFIG } from "./types";

interface Props {
  settings: SettingsType;
  setSettings: React.Dispatch<React.SetStateAction<SettingsType>>;
  isSharing: boolean;
  estimatedCost: number;
  onClose: () => void;
}

const ALL_MODES = Object.keys(MODE_CONFIG) as AnalysisMode[];
const AV_MODES: AnalysisMode[] = ["sales", "hr", "legal", "support", "negotiation", "healthcare", "education"];

const CrossSettingsPanel: React.FC<Props> = ({ settings, setSettings, isSharing, estimatedCost, onClose }) => {
  const showAVSection = AV_MODES.includes(settings.mode);

  return (
    <div className="w-72 border-l border-border/30 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Settings</h3>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>

      {/* Analysis Mode */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5 block">Analysis Mode</label>
        <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
          {ALL_MODES.map(m => {
            const cfg = MODE_CONFIG[m];
            return (
              <button
                key={m}
                onClick={() => setSettings(s => ({ ...s, mode: m }))}
                className={`text-xs px-2 py-1.5 rounded-lg border transition text-left ${
                  settings.mode === m
                    ? `border-accent bg-accent/10 ${cfg.color}`
                    : "border-border/30 text-muted-foreground hover:border-border"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
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
              className={`text-xs px-2 py-1.5 rounded-lg border transition ${
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
              className={`text-xs px-2 py-1.5 rounded-lg border transition ${
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

      {/* Sound & Voice */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Sound Alerts</span>
          <button onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))}>
            {settings.soundEnabled
              ? <Volume2 className="h-4 w-4 text-accent" />
              : <VolumeX className="h-4 w-4 text-muted-foreground/40" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Voice Alerts</span>
          <button onClick={() => setSettings(s => ({ ...s, voiceEnabled: !s.voiceEnabled }))}>
            {settings.voiceEnabled
              ? <Mic className="h-4 w-4 text-accent" />
              : <MicOff className="h-4 w-4 text-muted-foreground/40" />}
          </button>
        </div>
      </div>

      {/* Audio-Visual Intelligence Section */}
      {showAVSection && (
        <div className="pt-2 border-t border-border/20 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Audio-Visual Intelligence</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-teal-400/60" />
              <span className="text-xs text-muted-foreground">Audio Analysis</span>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, audioEnabled: !s.audioEnabled }))}
              className={`text-xs px-2 py-1 rounded-lg border ${settings.audioEnabled ? "border-teal-400/30 bg-teal-400/10 text-teal-400" : "border-border/30 text-muted-foreground/40"}`}
            >
              {settings.audioEnabled ? "ON" : "OFF"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-purple-400/60" />
              <span className="text-xs text-muted-foreground">Facial Analysis</span>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, facialAnalysisEnabled: !s.facialAnalysisEnabled }))}
              className={`text-xs px-2 py-1 rounded-lg border ${settings.facialAnalysisEnabled ? "border-purple-400/30 bg-purple-400/10 text-purple-400" : "border-border/30 text-muted-foreground/40"}`}
            >
              {settings.facialAnalysisEnabled ? "ON" : "OFF"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">PII Redaction</span>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, redactPII: !s.redactPII }))}
              className={`text-xs px-2 py-1 rounded-lg border ${settings.redactPII ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-muted-foreground/40"}`}
            >
              {settings.redactPII ? "ON" : "OFF"}
            </button>
          </div>

          <p className="text-[9px] text-muted-foreground/30 leading-relaxed">
            Audio-visual analysis requires participant consent. Enable features then grant consent when sharing starts.
          </p>
        </div>
      )}

      {/* Change Detection */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Skip unchanged frames</span>
        <button
          onClick={() => setSettings(s => ({ ...s, pauseOnNoChange: !s.pauseOnNoChange }))}
          className={`text-xs px-2 py-1 rounded-lg border ${settings.pauseOnNoChange ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-muted-foreground"}`}
        >
          {settings.pauseOnNoChange ? "ON" : "OFF"}
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
  );
};

export default CrossSettingsPanel;
