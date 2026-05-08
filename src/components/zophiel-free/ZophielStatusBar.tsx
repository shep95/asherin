import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

// Honest, ambient status bar. No fake counters — just engine state, source
// count, build version, and a real local clock.
const SOURCE_COUNT = 30;
const VERSION = "v3.0";

const ZophielStatusBar = () => {
  const [time, setTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 30_000);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border/20 bg-card/40 backdrop-blur-xl px-3 py-1">
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          {online && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              online ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
        </span>
        <span className="text-[9px] font-light tracking-[0.22em] text-foreground/70 uppercase">
          {online ? "Engine Online" : "Engine Offline"}
        </span>
      </span>
      <span className="h-3 w-px bg-border/30" />
      <span className="text-[9px] font-light tracking-[0.22em] text-muted-foreground/60 uppercase">
        {SOURCE_COUNT} Sources
      </span>
      <span className="h-3 w-px bg-border/30" />
      <span className="inline-flex items-center gap-1.5 text-[9px] font-light tracking-[0.22em] text-muted-foreground/60 uppercase">
        <Activity className="h-2.5 w-2.5" /> {VERSION}
      </span>
      <span className="h-3 w-px bg-border/30 hidden sm:block" />
      <span className="hidden sm:inline text-[9px] font-light tracking-[0.22em] text-muted-foreground/50 uppercase tabular-nums">
        {time}
      </span>
    </div>
  );
};

export default ZophielStatusBar;
