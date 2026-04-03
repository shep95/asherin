import React, { useState } from "react";
import { Shield, Check, X, Mic, Video, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrossSettings } from "./types";

interface Props {
  settings: CrossSettings;
  onConsentGranted: () => void;
  onConsentDeclined: () => void;
}

const CrossConsentBanner: React.FC<Props> = ({ settings, onConsentGranted, onConsentDeclined }) => {
  const [tier1, setTier1] = useState(false);
  const [tier2Audio, setTier2Audio] = useState(false);
  const [tier2Facial, setTier2Facial] = useState(false);

  if (settings.consentCollected) return null;
  if (!settings.audioEnabled && !settings.facialAnalysisEnabled) return null;

  const canProceed = tier1 && (tier2Audio || tier2Facial || (!settings.audioEnabled && !settings.facialAnalysisEnabled));

  return (
    <div className="mx-4 mt-3 p-4 rounded-xl bg-muted/10 border border-accent/20 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-accent" />
        <h3 className="text-sm font-medium text-foreground">Audio-Visual Analysis Consent</h3>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Cross can analyze audio and video for enhanced intelligence. All participants must consent.
        Data processing follows strict privacy protocols with automatic PII redaction.
      </p>

      <div className="space-y-2">
        {/* Tier 1 - Recording */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <button
            onClick={() => setTier1(!tier1)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition ${
              tier1 ? "bg-accent border-accent" : "border-border/50 hover:border-accent/50"
            }`}
          >
            {tier1 && <Check className="h-3 w-3 text-accent-foreground" />}
          </button>
          <span className="text-xs text-foreground/70 group-hover:text-foreground/90">
            I consent to recording and analysis of this session
          </span>
        </label>

        {/* Tier 2 - Granular */}
        {tier1 && (
          <div className="ml-6 space-y-1.5">
            {settings.audioEnabled && (
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  onClick={() => setTier2Audio(!tier2Audio)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                    tier2Audio ? "bg-teal-500 border-teal-500" : "border-border/40"
                  }`}
                >
                  {tier2Audio && <Check className="h-2.5 w-2.5 text-white" />}
                </button>
                <Mic className="h-3 w-3 text-teal-400/60" />
                <span className="text-[11px] text-muted-foreground/60">Voice analysis (transcription, emotion, speaker ID)</span>
              </label>
            )}

            {settings.facialAnalysisEnabled && (
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  onClick={() => setTier2Facial(!tier2Facial)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                    tier2Facial ? "bg-purple-500 border-purple-500" : "border-border/40"
                  }`}
                >
                  {tier2Facial && <Check className="h-2.5 w-2.5 text-white" />}
                </button>
                <Eye className="h-3 w-3 text-purple-400/60" />
                <span className="text-[11px] text-muted-foreground/60">Facial analysis (expressions, engagement, attention)</span>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onConsentGranted} disabled={!canProceed} className="text-xs h-7 rounded-lg">
          <Check className="h-3 w-3 mr-1" /> Accept & Continue
        </Button>
        <Button size="sm" variant="ghost" onClick={onConsentDeclined} className="text-xs h-7 text-muted-foreground">
          <X className="h-3 w-3 mr-1" /> Decline
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground/30">
        You can revoke consent and request data deletion at any time via Settings.
      </p>
    </div>
  );
};

export default CrossConsentBanner;
