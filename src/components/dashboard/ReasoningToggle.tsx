import { Brain, Zap } from "lucide-react";

export type ReasoningMode = "deep" | "simplified";

interface ReasoningToggleProps {
  mode: ReasoningMode;
  onChange: (mode: ReasoningMode) => void;
}

const ReasoningToggle = ({ mode, onChange }: ReasoningToggleProps) => (
  <div className="flex items-center gap-0.5 rounded-lg border border-border/20 bg-card/20 backdrop-blur-sm p-0.5">
    <button
      onClick={() => onChange("deep")}
      title="Deep Reasoning — detailed, technical analysis"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-light transition-all ${
        mode === "deep"
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/5"
      }`}
    >
      <Brain className="h-3 w-3" />
      Deep
    </button>
    <button
      onClick={() => onChange("simplified")}
      title="Simplified — clear, concise answers without jargon"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-light transition-all ${
        mode === "simplified"
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/5"
      }`}
    >
      <Zap className="h-3 w-3" />
      Simple
    </button>
  </div>
);

export default ReasoningToggle;
