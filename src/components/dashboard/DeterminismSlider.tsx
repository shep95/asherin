import { useState } from "react";
import { Gauge, Sparkles, Lock } from "lucide-react";

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
      className="relative flex items-center gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon className="h-3 w-3 text-muted-foreground/50" />
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 h-1 accent-accent cursor-pointer"
        title={`${label.label}: ${label.description}`}
      />
      <span className="text-[9px] text-muted-foreground/40 font-light w-20">{label.label}</span>

      {hovered && (
        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-border/30 bg-card/95 backdrop-blur-xl p-2 shadow-xl z-50">
          <p className="text-[10px] font-light text-foreground">{label.label}</p>
          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{label.description}</p>
          <p className="text-[9px] text-muted-foreground/30 mt-1">Temperature: {(value / 100).toFixed(2)}</p>
        </div>
      )}
    </div>
  );
};

export default DeterminismSlider;
