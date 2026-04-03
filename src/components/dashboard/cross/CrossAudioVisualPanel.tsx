import React from "react";
import { Mic, Video, Eye, Brain, Shield, AlertTriangle } from "lucide-react";
import { EmotionState, EngagementMetrics, SpeakerInfo, CrossSettings } from "./types";

interface Props {
  settings: CrossSettings;
  emotions?: EmotionState;
  engagement?: EngagementMetrics;
  speakers?: SpeakerInfo[];
  isActive: boolean;
}

const emotionEmoji: Record<string, string> = {
  happiness: "😊", sadness: "😢", anger: "😠", fear: "😨",
  surprise: "😲", disgust: "🤢", contempt: "😏", neutral: "😐",
  confusion: "😕", concentration: "🧐", interest: "🤔", boredom: "😴",
  stress: "😰",
};

const CrossAudioVisualPanel: React.FC<Props> = ({ settings, emotions, engagement, speakers, isActive }) => {
  if (!isActive) return null;

  const showAudio = settings.audioEnabled;
  const showFacial = settings.facialAnalysisEnabled;

  if (!showAudio && !showFacial) {
    return (
      <div className="px-3 py-2.5 rounded-xl bg-muted/5 border border-border/15">
        <div className="flex items-center gap-2 text-muted-foreground/40">
          <Mic className="h-3.5 w-3.5" />
          <span className="text-[10px]">Audio-visual intelligence disabled. Enable in settings.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Consent Banner */}
      {!settings.consentCollected && (showAudio || showFacial) && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] text-amber-300/80">Consent required from all participants before audio-visual analysis</span>
          </div>
        </div>
      )}

      {/* Emotion State */}
      {showFacial && emotions && (
        <div className="px-3 py-2.5 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-purple-400/60" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Emotional State</span>
            </div>
            <span className="text-sm">{emotionEmoji[emotions.primary] || "😐"}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[9px] text-muted-foreground/40">Primary</p>
              <p className="text-xs text-foreground/70 capitalize">{emotions.primary} ({emotions.intensity}%)</p>
            </div>
            {emotions.secondary && (
              <div>
                <p className="text-[9px] text-muted-foreground/40">Secondary</p>
                <p className="text-xs text-foreground/60 capitalize">{emotions.secondary}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] text-muted-foreground/40">Stress</p>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full bg-background/30 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    emotions.stressLevel > 70 ? "bg-red-400" : emotions.stressLevel > 40 ? "bg-amber-400" : "bg-emerald-400"
                  }`} style={{ width: `${emotions.stressLevel}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground/50">{emotions.stressLevel}%</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground/40">Confidence</p>
              <p className="text-[10px] text-muted-foreground/50">{emotions.confidence}%</p>
            </div>
          </div>

          {emotions.deceptionLikelihood !== undefined && emotions.deceptionLikelihood > 50 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-amber-400/60">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-[9px]">Incongruence detected ({emotions.deceptionLikelihood}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Engagement Metrics */}
      {engagement && (
        <div className="px-3 py-2.5 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-blue-400/60" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Engagement</span>
            </div>
            <span className={`text-xs font-medium ${
              engagement.trend === "rising" ? "text-emerald-400" : engagement.trend === "declining" ? "text-red-400" : "text-muted-foreground"
            }`}>
              {engagement.trend === "rising" ? "↑" : engagement.trend === "declining" ? "↓" : "→"} {engagement.overallScore}%
            </span>
          </div>

          <div className="space-y-1">
            {[
              { label: "Attention", value: engagement.attentionLevel, color: "bg-blue-400" },
              { label: "Comprehension", value: engagement.comprehensionSignals, color: "bg-cyan-400" },
              { label: "Participation", value: engagement.participationEquity, color: "bg-indigo-400" },
              { label: "Energy", value: engagement.energyLevel, color: "bg-purple-400" },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground/40 w-20">{m.label}</span>
                <div className="flex-1 h-1 rounded-full bg-background/30 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m.color}/60`} style={{ width: `${m.value}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground/40 w-6 text-right">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speaker Analysis */}
      {showAudio && speakers && speakers.length > 0 && (
        <div className="px-3 py-2.5 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="h-3.5 w-3.5 text-teal-400/60" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Speakers ({speakers.length})</span>
          </div>

          <div className="space-y-1.5">
            {speakers.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    s.sentiment === "positive" ? "bg-emerald-400" : s.sentiment === "negative" ? "bg-red-400" : "bg-amber-400"
                  }`} />
                  <span className="text-[10px] text-foreground/60">{s.label}</span>
                  {s.role && s.role !== "unknown" && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-muted/20 text-muted-foreground/40 capitalize">
                      {s.role.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground/40">{s.talkRatio}%</span>
                  {s.stressLevel !== undefined && s.stressLevel > 60 && (
                    <span className="text-[8px] text-amber-400/50">⚡{s.stressLevel}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PII Redaction Notice */}
      {settings.redactPII && (
        <div className="px-3 py-1.5 rounded-xl bg-muted/5 border border-border/10 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-muted-foreground/30" />
          <span className="text-[9px] text-muted-foreground/30">PII auto-redaction active</span>
        </div>
      )}
    </div>
  );
};

export default CrossAudioVisualPanel;
