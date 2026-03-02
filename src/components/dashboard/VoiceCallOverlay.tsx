import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface VoiceCallOverlayProps {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  onDisconnect: () => void;
}

function PulseRing({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      {active && (
        <>
          <div className="absolute h-24 w-24 rounded-full border border-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute h-20 w-20 rounded-full border border-accent/30 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
        </>
      )}
      <div className={`relative z-10 h-16 w-16 rounded-full flex items-center justify-center transition-all ${
        active ? "bg-accent/20 border-2 border-accent shadow-lg shadow-accent/20" : "bg-muted/20 border-2 border-muted-foreground/20"
      }`}>
        {active ? (
          <Volume2 className="h-7 w-7 text-accent animate-pulse" />
        ) : (
          <Mic className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
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

const VoiceCallOverlay = ({ isConnected, isConnecting, isSpeaking, transcript, error, onDisconnect }: VoiceCallOverlayProps) => {
  if (!isConnected && !isConnecting) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl animate-fade-in">
      {/* Visual */}
      <div className="flex flex-col items-center gap-6">
        <PulseRing active={isSpeaking} />

        <div className="text-center space-y-1">
          <h3 className="text-lg font-light text-foreground">
            {isConnecting ? "Connecting…" : isSpeaking ? "Aureon is speaking" : "Listening…"}
          </h3>
          {isConnected && <Timer />}
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>

        {/* Live transcript */}
        {transcript && (
          <div className="max-w-sm max-h-32 overflow-y-auto rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-4 py-3">
            <p className="text-xs font-light text-muted-foreground leading-relaxed">{transcript}</p>
          </div>
        )}
      </div>

      {/* End call */}
      <button
        onClick={onDisconnect}
        className="mt-10 flex items-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-light text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-lg shadow-destructive/20"
      >
        <PhoneOff className="h-4 w-4" />
        End Call
      </button>
    </div>
  );
};

export default VoiceCallOverlay;
