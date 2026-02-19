import { useState, useMemo } from "react";
import { Atom, Layers, ChevronLeft, Maximize2 } from "lucide-react";
import type { ZaliProject } from "./types";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

interface Props {
  project: ZaliProject;
}

// Single material card with holographic visualization
function MaterialCard({
  label,
  color,
  index,
  isSelected,
  onSelect,
}: {
  label: string;
  color: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = isSelected || hovered;

  // Generate deterministic "properties" from label
  const properties = useMemo(() => {
    const props = [
      { key: "Density", value: `${(1.2 + (index * 1.7) % 8).toFixed(1)} g/cm³` },
      { key: "Hardness", value: `${20 + ((index * 13 + 7) % 60)} HRC` },
      { key: "Yield", value: `${100 + ((index * 37 + 11) % 400)} MPa` },
    ];
    return props;
  }, [index]);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative w-full text-left rounded-xl border transition-all duration-300 overflow-hidden ${
        isSelected
          ? "border-accent/40 bg-accent/5"
          : "border-border/20 bg-card/20 hover:border-border/40"
      }`}
    >
      {/* Mini visualization */}
      <div className="relative h-28 flex items-center justify-center overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute w-20 h-20 rounded-full blur-2xl transition-opacity duration-500"
          style={{ backgroundColor: color + "20", opacity: active ? 1 : 0.4 }}
        />
        {/* Orbiting ring */}
        <div
          className="absolute w-16 h-16 rounded-full border transition-all duration-500"
          style={{
            borderColor: active ? color + "40" : color + "15",
            animation: "spin 10s linear infinite",
          }}
        />
        {/* Core block */}
        <div
          className="relative w-10 h-10 rounded-lg border transition-all duration-300"
          style={{
            borderColor: active ? "#00ffcc" : color + "50",
            backgroundColor: color + (active ? "30" : "15"),
            boxShadow: active ? `0 0 25px ${color}25` : "none",
            transform: active ? "scale(1.15) rotate(12deg)" : "scale(1) rotate(0deg)",
          }}
        >
          <div
            className="absolute inset-0 rounded-lg border border-dashed"
            style={{ borderColor: "#00ffcc", opacity: active ? 0.25 : 0 }}
          />
        </div>
        {/* Satellite dots */}
        {[0, 120, 240].map((angle) => (
          <div
            key={angle}
            className="absolute w-1.5 h-1.5 rounded-full transition-all duration-500"
            style={{
              backgroundColor: color,
              opacity: active ? 0.7 : 0.2,
              transform: `rotate(${angle}deg) translateX(${active ? 30 : 24}px)`,
              top: "50%",
              left: "50%",
              marginTop: -3,
              marginLeft: -3,
            }}
          />
        ))}
      </div>
      {/* Label + properties */}
      <div className="px-3 pb-3">
        <p className="text-[11px] font-light text-foreground truncate">{label}</p>
        <div className="mt-1.5 space-y-0.5">
          {properties.map((p) => (
            <div key={p.key} className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/40">{p.key}</span>
              <span className="text-[9px] text-muted-foreground/60 font-mono">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

// Expanded single material detail
function MaterialExpanded({ label, color, index }: { label: string; color: string; index: number }) {
  const properties = useMemo(() => [
    { key: "Density", value: `${(1.2 + (index * 1.7) % 8).toFixed(1)} g/cm³` },
    { key: "Hardness", value: `${20 + ((index * 13 + 7) % 60)} HRC` },
    { key: "Yield Strength", value: `${100 + ((index * 37 + 11) % 400)} MPa` },
    { key: "Thermal Conductivity", value: `${10 + ((index * 23 + 5) % 200)} W/m·K` },
    { key: "Melting Point", value: `${400 + ((index * 53 + 17) % 1600)}°C` },
    { key: "Cost Index", value: `${(1 + (index * 0.7) % 5).toFixed(1)}x` },
  ], [index]);

  return (
    <div className="flex flex-col h-full">
      {/* Large visualization */}
      <div className="relative h-[280px] flex items-center justify-center overflow-hidden">
        <div className="absolute w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: color + "15" }} />
        <div className="absolute w-48 h-48 rounded-full border" style={{ borderColor: color + "10", animation: "spin 15s linear infinite" }} />
        <div className="absolute w-36 h-36 rounded-full border" style={{ borderColor: color + "15", animation: "spin 12s linear infinite reverse" }} />
        {/* Central material block */}
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl border backdrop-blur-sm flex items-center justify-center"
            style={{
              borderColor: color + "50",
              backgroundColor: color + "20",
              boxShadow: `0 0 40px ${color}15, 0 0 80px ${color}08`,
              animation: "float 4s ease-in-out infinite",
            }}
          >
            <Layers className="h-8 w-8" style={{ color: color + "90" }} />
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-2xl border border-dashed" style={{ borderColor: "#00ffcc20" }} />
        </div>
        {/* Orbiting nodes */}
        {[0, 60, 120, 180, 240, 300].map((angle, j) => (
          <div
            key={angle}
            className="absolute w-2 h-2 rounded-full"
            style={{
              backgroundColor: color,
              opacity: 0.4,
              top: "50%",
              left: "50%",
              transform: `rotate(${angle}deg) translateX(${70 + (j % 2) * 15}px)`,
              marginTop: -4,
              marginLeft: -4,
              animation: `float ${2.5 + j * 0.3}s ease-in-out ${j * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      {/* Properties grid */}
      <div className="px-4 pb-4">
        <p className="text-sm font-light text-foreground mb-3">{label}</p>
        <div className="grid grid-cols-2 gap-2">
          {properties.map((p) => (
            <div key={p.key} className="px-3 py-2 rounded-lg border border-border/15 bg-card/20">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">{p.key}</p>
              <p className="text-xs font-mono text-foreground/80 mt-0.5">{p.value}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

const ZaliMaterialsView = ({ project }: Props) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const specs = project.specifications as Record<string, any>;
  const materialsList: string[] = specs?.materials || [];

  const materials = useMemo(() => {
    if (materialsList.length === 0) {
      return [
        { label: "Primary Alloy", color: COLORS[0] },
        { label: "Composite Shell", color: COLORS[1] },
        { label: "Thermal Coating", color: COLORS[2] },
        { label: "Circuit Substrate", color: COLORS[3] },
      ];
    }
    return materialsList.map((m, i) => ({ label: m, color: COLORS[i % COLORS.length] }));
  }, [materialsList]);

  const selected = selectedIndex !== null ? materials[selectedIndex] : null;

  if (selected !== null && selectedIndex !== null) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-3 py-2 border-b border-border/15 flex items-center gap-2">
          <button
            onClick={() => setSelectedIndex(null)}
            className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-light text-foreground">{selected.label}</span>
          <div className="w-2 h-2 rounded-full ml-1" style={{ backgroundColor: selected.color }} />
        </div>
        <div className="flex-1 overflow-auto">
          <MaterialExpanded label={selected.label} color={selected.color} index={selectedIndex} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid grid-cols-2 gap-2">
        {materials.map((mat, i) => (
          <MaterialCard
            key={i}
            label={mat.label}
            color={mat.color}
            index={i}
            isSelected={selectedIndex === i}
            onSelect={() => setSelectedIndex(i)}
          />
        ))}
      </div>
    </div>
  );
};

export default ZaliMaterialsView;
