import { useState } from "react";
import { Gauge, Sparkles, Lock } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface DeterminismSliderProps {
  value: number; // 0-100, 0 = deterministic, 100 = creative
  onChange: (value: number) => void;
}

const LABELS = [
  { threshold: 0, label: "Deterministic", icon: Lock, description: "Stable, repeatable outputs" },
  { threshold: 33, label: "Balanced", icon: Gauge, description: "Good mix of consistency and variety" },
  { threshold: 66, label: "Creative", icon: Sparkles, description: "More varied, exploratory outputs" },
];

function getLabel(value: number) {
  if (value < 33) return LABELS[0];
  if (value < 66) return LABELS[1];
  return LABELS[2];
}

const DeterminismSlider = ({ value, onChange }: DeterminismSliderProps) => {
  const [hovered, setHovered] = useState(false);
  const label = getLabel(value);
  const Icon = label.icon;

  return (
    <div
      className="relative flex items-center gap-2 shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-16"
      />
      <span className="text-[9px] text-muted-foreground/40 font-light whitespace-nowrap">{label.label}</span>

      {hovered && (
        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-2 shadow-xl z-50">
          <p className="text-[10px] font-light text-foreground">{label.label}</p>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{label.description}</p>
          <p className="text-[9px] text-muted-foreground/30 mt-1">Temperature: {(value / 100).toFixed(2)}</p>
        </div>
      )}
    </div>
  );
};

export default DeterminismSlider;
