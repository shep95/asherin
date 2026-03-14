import { Zap, Target, Repeat } from "lucide-react";

export type QoSMode = "fast" | "accurate" | "deterministic";

interface QualityOfServiceControlsProps {
  mode: QoSMode;
  onChange: (mode: QoSMode) => void;
}

const modes: { id: QoSMode; label: string; icon: React.ElementType; description: string; impact: string }[] = [
  { id: "fast", label: "Fast", icon: Zap, description: "Lower latency, lighter model", impact: "~2s response" },
  { id: "accurate", label: "Accurate", icon: Target, description: "Best model, thorough analysis", impact: "~8s response" },
  { id: "deterministic", label: "Stable", icon: Repeat, description: "Same input → same output", impact: "Low variance" },
];

const QualityOfServiceControls = ({ mode, onChange }: QualityOfServiceControlsProps) => {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/20 bg-card/20 backdrop-blur-sm p-0.5">
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-light transition-all ${
            mode === m.id
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground/40 hover:text-muted-foreground/60"
          }`}
          title={`${m.description} — ${m.impact}`}
        >
          <m.icon className="h-3 w-3" />
          {m.label}
        </button>
      ))}
    </div>
  );
};

export default QualityOfServiceControls;
