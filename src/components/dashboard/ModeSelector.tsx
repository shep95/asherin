import { Search, MessageSquare, Code, Shield } from "lucide-react";
import type { ChatMode } from "./types";

const modes: { id: ChatMode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "research", label: "Research", icon: Search, desc: "Web search, cited sources" },
  { id: "chat", label: "Chat", icon: MessageSquare, desc: "Pure LLM, fastest" },
  { id: "code", label: "Code", icon: Code, desc: "Code-optimized output" },
  { id: "truth", label: "Truth", icon: Shield, desc: "No filters, maximum directness" },
];

interface ModeSelectorProps {
  active: ChatMode;
  onChange: (mode: ChatMode) => void;
}

const ModeSelector = ({ active, onChange }: ModeSelectorProps) => (
  <div className="flex items-center gap-0.5 sm:gap-1 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-0.5 sm:p-1 shrink-0">
    {modes.map((m) => (
      <button
        key={m.id}
        onClick={() => onChange(m.id)}
        title={m.desc}
        className={`flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-light transition-all ${
          active === m.id
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        }`}
      >
        <m.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">{m.label}</span>
      </button>
    ))}
  </div>
);

export default ModeSelector;
