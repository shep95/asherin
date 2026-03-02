import { PhoneOff, Mic, Volume2, Download } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

interface VoiceCallOverlayProps {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  currentText: string;
  transcriptLog: TranscriptEntry[];
  userSpeechIndicator: boolean;
  error: string | null;
  onDisconnect: () => void;
  onDownloadTranscript: () => void;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}

/* ── Audio Wave Bars ── */
function AudioWave({ label, getVolume, color }: { label: string; getVolume?: () => number; color: string }) {
  const NUM_BARS = 5;
  const [levels, setLevels] = useState<number[]>(Array(NUM_BARS).fill(0.08));
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!getVolume) return;
    const tick = () => {
      const vol = getVolume();
      setLevels(
        Array.from({ length: NUM_BARS }, (_, i) => {
          const jitter = 0.6 + Math.random() * 0.8;
          const positional = 1 - Math.abs(i - 2) * 0.15;
          return Math.max(0.08, Math.min(1, vol * jitter * positional * 4));
        }),
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getVolume]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-[3px] h-10">
        {levels.map((h, i) => (
          <div
            key={i}
            className="w-[4px] rounded-full transition-all duration-75"
            style={{
              height: `${h * 40}px`,
              backgroundColor: color,
              opacity: 0.6 + h * 0.4,
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{label}</span>
    </div>
  );
}

function Timer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return <span className="text-xs font-mono text-muted-foreground/70">{mins}:{secs}</span>;
}

const VoiceCallOverlay = ({
  isConnected,
  isConnecting,
  isSpeaking,
  currentText,
  transcriptLog,
  userSpeechIndicator,
  error,
  onDisconnect,
  onDownloadTranscript,
  getInputVolume,
  getOutputVolume,
}: VoiceCallOverlayProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLog]);

  if (!isConnected && !isConnecting) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl animate-fade-in">
      {/* Status */}
      <div className="flex flex-col items-center gap-5">
        <h3 className="text-lg font-light text-foreground">
          {isConnecting
            ? "Connecting…"
            : isSpeaking
              ? "Aureon is speaking"
              : userSpeechIndicator
                ? "Hearing you…"
                : "Listening…"}
        </h3>
        {isConnected && <Timer />}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}

        {/* Audio Waves */}
        {isConnected && (
          <div className="flex items-center gap-10">
            <AudioWave label="You" getVolume={getInputVolume} color="hsl(var(--accent))" />
            <AudioWave label="Aureon" getVolume={getOutputVolume} color="hsl(var(--primary))" />
          </div>
        )}

        {/* Live transcript log */}
        {transcriptLog.length > 0 && (
          <div className="w-80 max-h-48 overflow-y-auto rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-4 py-3 space-y-2">
            {transcriptLog.map((entry, i) => (
              <div key={i} className="text-xs leading-relaxed">
                <span className={`font-semibold ${entry.role === "user" ? "text-accent" : "text-primary"}`}>
                  {entry.role === "user" ? "You" : "Aureon"}:
                </span>{" "}
                <span className="text-muted-foreground">{entry.text}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-10 flex items-center gap-4">
        {transcriptLog.length > 0 && (
          <button
            onClick={onDownloadTranscript}
            className="flex items-center gap-2 rounded-full bg-muted px-5 py-3 text-sm font-light text-muted-foreground hover:bg-muted/80 transition-all active:scale-95"
            title="Download transcript"
          >
            <Download className="h-4 w-4" />
            Transcript
          </button>
        )}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-light text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/20"
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </button>
      </div>
    </div>
  );
};

export default VoiceCallOverlay;
