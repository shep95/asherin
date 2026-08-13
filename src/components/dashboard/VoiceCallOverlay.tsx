import { PhoneOff, Download } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";

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

/* ── Iridescent Glass Orb ── */
function IridescentOrb({
  isConnecting,
  isSpeaking,
  userSpeaking,
  getInputVolume,
  getOutputVolume,
}: {
  isConnecting: boolean;
  isSpeaking: boolean;
  userSpeaking: boolean;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}) {
  const [volume, setVolume] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const getter = isSpeaking ? getOutputVolume : getInputVolume;
    if (!getter) return;
    const tick = () => {
      const v = getter();
      setVolume((prev) => prev * 0.7 + v * 0.3); // smooth
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isSpeaking, getInputVolume, getOutputVolume]);

  const scale = isConnecting ? 0.85 : 1 + volume * 0.35;
  const speed = isSpeaking ? "8s" : userSpeaking ? "10s" : "14s";
  const glowIntensity = isConnecting ? 0.3 : 0.5 + volume * 0.5;

  return (
    <div className="relative" style={{ width: 220, height: 220 }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsla(275, 95%, 55%, ${glowIntensity * 0.4}) 0%, 
            hsla(200, 90%, 50%, ${glowIntensity * 0.2}) 40%, 
            transparent 70%)`,
          transform: `scale(${1.6 + volume * 0.3})`,
          transition: "transform 0.3s ease-out",
          filter: "blur(30px)",
        }}
      />

      {/* Main orb container */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `scale(${scale})`,
          transition: "transform 0.15s ease-out",
        }}
      >
        {/* Layer 1: Base morphing blob */}
        <div
          className="absolute"
          style={{
            width: 160,
            height: 160,
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            background: `conic-gradient(
              from 0deg,
              hsl(275, 80%, 25%) 0deg,
              hsl(220, 90%, 30%) 60deg,
              hsl(180, 70%, 20%) 120deg,
              hsl(320, 80%, 25%) 180deg,
              hsl(40, 90%, 30%) 240deg,
              hsl(275, 80%, 25%) 360deg
            )`,
            animation: `orbMorph1 ${speed} ease-in-out infinite, orbRotate 12s linear infinite`,
            filter: "blur(2px)",
          }}
        />

        {/* Layer 2: Chromatic refraction ring */}
        <div
          className="absolute"
          style={{
            width: 140,
            height: 140,
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
            background: `conic-gradient(
              from 120deg,
              hsla(0, 100%, 60%, 0.6) 0deg,
              hsla(60, 100%, 50%, 0.5) 60deg,
              hsla(120, 100%, 40%, 0.5) 120deg,
              hsla(200, 100%, 50%, 0.6) 180deg,
              hsla(280, 100%, 60%, 0.5) 240deg,
              hsla(340, 100%, 55%, 0.6) 300deg,
              hsla(0, 100%, 60%, 0.6) 360deg
            )`,
            animation: `orbMorph2 ${speed} ease-in-out infinite reverse, orbRotate 8s linear infinite reverse`,
            filter: "blur(6px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Layer 3: Inner glass core */}
        <div
          className="absolute"
          style={{
            width: 100,
            height: 100,
            borderRadius: "40% 60% 55% 45% / 55% 45% 55% 45%",
            background: `radial-gradient(
              ellipse at 35% 35%,
              hsla(0, 0%, 100%, 0.35) 0%,
              hsla(275, 80%, 60%, 0.2) 30%,
              hsla(200, 90%, 50%, 0.15) 60%,
              transparent 100%
            )`,
            animation: `orbMorph3 ${speed} ease-in-out infinite, orbRotate 15s linear infinite`,
            filter: "blur(1px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Layer 4: Specular highlight */}
        <div
          className="absolute"
          style={{
            width: 70,
            height: 45,
            borderRadius: "50%",
            background: `radial-gradient(
              ellipse at 50% 50%,
              hsla(0, 0%, 100%, 0.5) 0%,
              hsla(0, 0%, 100%, 0.1) 50%,
              transparent 100%
            )`,
            top: "25%",
            left: "25%",
            animation: `specularDrift 6s ease-in-out infinite`,
            mixBlendMode: "screen",
          }}
        />

        {/* Layer 5: Rainbow caustics */}
        <div
          className="absolute"
          style={{
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: `conic-gradient(
              from 45deg,
              transparent 0deg,
              hsla(280, 100%, 70%, 0.15) 30deg,
              transparent 60deg,
              hsla(180, 100%, 60%, 0.12) 120deg,
              transparent 150deg,
              hsla(40, 100%, 60%, 0.15) 210deg,
              transparent 240deg,
              hsla(340, 100%, 65%, 0.12) 300deg,
              transparent 360deg
            )`,
            animation: `orbRotate 6s linear infinite`,
            filter: "blur(8px)",
            mixBlendMode: "screen",
          }}
        />

        {/* Layer 6: Outer glass rim */}
        <div
          className="absolute"
          style={{
            width: 155,
            height: 155,
            borderRadius: "50% 50% 50% 50% / 50% 50% 50% 50%",
            border: "1px solid hsla(0, 0%, 100%, 0.08)",
            boxShadow: `
              inset 0 0 30px hsla(275, 80%, 50%, 0.1),
              inset 0 0 60px hsla(200, 80%, 50%, 0.05),
              0 0 20px hsla(275, 80%, 50%, 0.1)
            `,
            animation: `orbMorph1 ${speed} ease-in-out infinite reverse`,
          }}
        />
      </div>

      {/* Ambient light spills */}
      <div
        className="absolute"
        style={{
          width: 300,
          height: 300,
          top: -40,
          left: -40,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 30% 40%, 
            hsla(275, 80%, 40%, ${0.08 + volume * 0.06}) 0%, 
            transparent 60%)`,
          animation: "ambientDrift1 10s ease-in-out infinite",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute"
        style={{
          width: 300,
          height: 300,
          top: -40,
          left: -40,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 70% 60%, 
            hsla(200, 80%, 40%, ${0.06 + volume * 0.05}) 0%, 
            transparent 60%)`,
          animation: "ambientDrift2 12s ease-in-out infinite",
          filter: "blur(25px)",
          pointerEvents: "none",
        }}
      />
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
  return (
    <span className="text-xs font-mono text-muted-foreground/50 tracking-[0.2em]">
      {mins}:{secs}
    </span>
  );
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

  const statusText = isConnecting
    ? "Connecting…"
    : isSpeaking
      ? "asherin is speaking"
      : userSpeechIndicator
        ? "Hearing you…"
        : "Listening…";

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/98 animate-fade-in overflow-hidden">
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, hsl(275, 80%, 40%) 0%, transparent 50%),
                            radial-gradient(circle at 30% 70%, hsl(200, 80%, 30%) 0%, transparent 40%)`,
        }}
      />

      {/* Orb + Status area */}
      <div className="relative flex flex-col items-center gap-8 z-10">
        <IridescentOrb
          isConnecting={isConnecting}
          isSpeaking={isSpeaking}
          userSpeaking={userSpeechIndicator}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
        />

        {/* Status text */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-lg font-extralight tracking-[0.15em] text-foreground/90">
            {statusText}
          </h3>
          {isConnected && <Timer />}
          {error && (
            <p className="text-[10px] text-destructive/80 font-light mt-1">{error}</p>
          )}
        </div>

        {/* Transcript log */}
        {transcriptLog.length > 0 && (
          <div className="w-80 max-h-40 overflow-y-auto rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 space-y-2">
            {transcriptLog.map((entry, i) => (
              <div key={i} className="text-[11px] leading-relaxed font-extralight">
                <span
                  className={`font-light ${entry.role === "user" ? "text-accent/80" : "text-primary/80"}`}
                >
                  {entry.role === "user" ? "You" : "Aureon"}:
                </span>{" "}
                <span className="text-foreground/50">{entry.text}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="absolute bottom-12 flex items-center gap-4 z-10">
        {transcriptLog.length > 0 && (
          <button
            onClick={onDownloadTranscript}
            className="flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.06] px-5 py-3 text-xs font-extralight tracking-[0.1em] text-foreground/50 hover:bg-white/[0.08] transition-all active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Transcript
          </button>
        )}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 rounded-full bg-destructive/90 px-7 py-3 text-xs font-light tracking-[0.1em] text-destructive-foreground hover:bg-destructive transition-all active:scale-95 shadow-lg shadow-destructive/20"
        >
          <PhoneOff className="h-4 w-4" />
          End Call
        </button>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes orbMorph1 {
          0%, 100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
          25% { border-radius: 58% 42% 34% 66% / 63% 68% 32% 37%; }
          50% { border-radius: 50% 50% 34% 66% / 56% 68% 32% 44%; }
          75% { border-radius: 33% 67% 58% 42% / 63% 38% 62% 37%; }
        }
        @keyframes orbMorph2 {
          0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25% { border-radius: 40% 60% 55% 45% / 35% 65% 35% 65%; }
          50% { border-radius: 55% 45% 60% 40% / 50% 50% 50% 50%; }
          75% { border-radius: 35% 65% 40% 60% / 65% 35% 65% 35%; }
        }
        @keyframes orbMorph3 {
          0%, 100% { border-radius: 40% 60% 55% 45% / 55% 45% 55% 45%; transform: scale(1); }
          33% { border-radius: 55% 45% 40% 60% / 45% 55% 45% 55%; transform: scale(1.05); }
          66% { border-radius: 45% 55% 60% 40% / 60% 40% 60% 40%; transform: scale(0.95); }
        }
        @keyframes orbRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes specularDrift {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(8px, -5px) scale(1.1); opacity: 0.3; }
        }
        @keyframes ambientDrift1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-15px, 10px); }
        }
        @keyframes ambientDrift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(12px, -8px); }
        }
      `}</style>
    </div>
  );
};

export default VoiceCallOverlay;
