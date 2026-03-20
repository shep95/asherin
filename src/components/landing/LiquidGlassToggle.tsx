import { useState, useRef, useEffect } from "react";
import { Search, MessageSquare, Code, Shield } from "lucide-react";

const modes = [
  { id: "research", label: "RESEARCH", icon: Search },
  { id: "chat", label: "CHAT", icon: MessageSquare },
  { id: "code", label: "CODE", icon: Code },
  { id: "truth", label: "TRUTH", icon: Shield },
] as const;

type ModeId = (typeof modes)[number]["id"];

interface LiquidGlassToggleProps {
  active?: ModeId;
  onChange?: (mode: ModeId) => void;
}

const LiquidGlassToggle = ({ active: controlledActive, onChange }: LiquidGlassToggleProps) => {
  const [internalActive, setInternalActive] = useState<ModeId>("chat");
  const active = controlledActive ?? internalActive;
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const idx = modes.findIndex((m) => m.id === active);
    const btn = btnRefs.current[idx];
    const container = containerRef.current;
    if (btn && container) {
      const cr = container.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setIndicator({ left: br.left - cr.left, width: br.width });
    }
  }, [active]);

  const select = (id: ModeId) => {
    setInternalActive(id);
    onChange?.(id);
  };

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Outer shell — liquid glass pill */}
      <div className="relative rounded-full p-[1px] overflow-hidden">
        {/* Monochrome border */}
        <div className="absolute inset-0 rounded-full bg-border/30" />
        {/* Glass inner surface */}
        <div className="relative flex items-center rounded-full bg-background/80 backdrop-blur-xl border border-border/10">
          {/* Sliding active indicator */}
          <div
            className="absolute top-[3px] bottom-[3px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
            style={{
              left: indicator.left + 3,
              width: indicator.width - 6,
            }}
          >
            <div className="absolute inset-0 rounded-full bg-foreground/[0.08]" />
            <div className="absolute -inset-[1px] rounded-full border border-border/40" />
            <div className="absolute inset-[1px] rounded-full bg-background/90 backdrop-blur-md" />
          </div>

          {/* Buttons */}
          {modes.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => { btnRefs.current[i] = el; }}
              onClick={() => select(m.id)}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] font-light tracking-[0.15em] transition-colors duration-300 ${
                active === m.id
                  ? "text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              <m.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default LiquidGlassToggle;
