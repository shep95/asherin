import { useState, useEffect } from "react";
import { Palette, X, Save } from "lucide-react";

export interface StyleProfile {
  tone: string;
  cadence: string;
  formatting: string;
  vocabulary: string;
  active: boolean;
}

const DEFAULT_PROFILE: StyleProfile = {
  tone: "professional",
  cadence: "concise",
  formatting: "markdown",
  vocabulary: "standard",
  active: false,
};

const TONE_OPTIONS = ["professional", "casual", "academic", "creative", "technical", "friendly"];
const CADENCE_OPTIONS = ["concise", "detailed", "conversational", "telegraphic"];
const FORMAT_OPTIONS = ["markdown", "plain text", "structured headings", "bullet-heavy"];
const VOCAB_OPTIONS = ["standard", "simple", "technical", "executive"];

const STORAGE_KEY = "aureon_style_profile";

interface PersonalStyleProfileProps {
  open: boolean;
  onClose: () => void;
  onProfileChange?: (profile: StyleProfile) => void;
}

const PersonalStyleProfile = ({ open, onClose, onProfileChange }: PersonalStyleProfileProps) => {
  const [profile, setProfile] = useState<StyleProfile>(() => {
    try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; } catch { return DEFAULT_PROFILE; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    onProfileChange?.(profile);
  }, [profile, onProfileChange]);

  const update = (key: keyof StyleProfile, value: string | boolean) => setProfile(prev => ({ ...prev, [key]: value }));

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Writing Style</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/60">Apply to all outputs</span>
          <button
            onClick={() => update("active", !profile.active)}
            className={`w-8 h-4 rounded-full transition-colors relative ${profile.active ? "bg-accent" : "bg-muted"}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-background transition-transform ${profile.active ? "left-4" : "left-0.5"}`} />
          </button>
        </div>

        {/* Tone */}
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-1">Tone</label>
          <div className="flex flex-wrap gap-1">
            {TONE_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => update("tone", t)}
                className={`px-2 py-1 rounded-lg text-[10px] font-light transition-colors ${
                  profile.tone === t ? "bg-accent/20 text-accent border border-accent/30" : "text-muted-foreground/50 border border-border/20 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Cadence */}
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-1">Cadence</label>
          <div className="flex flex-wrap gap-1">
            {CADENCE_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => update("cadence", c)}
                className={`px-2 py-1 rounded-lg text-[10px] font-light transition-colors ${
                  profile.cadence === c ? "bg-accent/20 text-accent border border-accent/30" : "text-muted-foreground/50 border border-border/20 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Formatting */}
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-1">Formatting</label>
          <div className="flex flex-wrap gap-1">
            {FORMAT_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => update("formatting", f)}
                className={`px-2 py-1 rounded-lg text-[10px] font-light transition-colors ${
                  profile.formatting === f ? "bg-accent/20 text-accent border border-accent/30" : "text-muted-foreground/50 border border-border/20 hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Vocabulary */}
        <div>
          <label className="text-[9px] text-muted-foreground/50 uppercase tracking-wider block mb-1">Vocabulary</label>
          <div className="flex flex-wrap gap-1">
            {VOCAB_OPTIONS.map(v => (
              <button
                key={v}
                onClick={() => update("vocabulary", v)}
                className={`px-2 py-1 rounded-lg text-[10px] font-light transition-colors ${
                  profile.vocabulary === v ? "bg-accent/20 text-accent border border-accent/30" : "text-muted-foreground/50 border border-border/20 hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalStyleProfile;
