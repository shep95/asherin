import { useState, useMemo } from "react";
import { Atom, Layers, ChevronLeft, ExternalLink, DollarSign, Wrench, ShoppingCart, BookOpen } from "lucide-react";
import type { ZaliProject } from "./types";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

// Deterministic supplier/pricing data keyed off material index
function getMaterialMeta(label: string, index: number) {
  const priceBase = [12.49, 34.99, 8.75, 22.30, 45.00, 15.60, 28.90, 19.99];
  const unitOptions = ["/kg", "/m²", "/L", "/sheet", "/roll", "/bar", "/unit", "/pack"];
  const suppliers = [
    { name: "McMaster-Carr", base: "https://www.mcmaster.com" },
    { name: "Digi-Key", base: "https://www.digikey.com" },
    { name: "Amazon Industrial", base: "https://www.amazon.com" },
    { name: "Alibaba", base: "https://www.alibaba.com" },
    { name: "Grainger", base: "https://www.grainger.com" },
    { name: "Mouser", base: "https://www.mouser.com" },
    { name: "RS Components", base: "https://www.rs-online.com" },
    { name: "Uline", base: "https://www.uline.com" },
  ];

  const price = priceBase[index % priceBase.length] + (index * 3.17) % 20;
  const unit = unitOptions[index % unitOptions.length];
  const supplier = suppliers[index % suppliers.length];
  const altSupplier = suppliers[(index + 3) % suppliers.length];
  const searchTerm = encodeURIComponent(label.toLowerCase().replace(/\s+/g, "+"));

  return {
    price: price.toFixed(2),
    unit,
    suppliers: [
      { ...supplier, url: `${supplier.base}/s?q=${searchTerm}` },
      { ...altSupplier, url: `${altSupplier.base}/s?q=${searchTerm}` },
    ],
  };
}

function getAssemblySteps(materials: { label: string }[]) {
  if (materials.length === 0) return [];
  return [
    { step: 1, title: "Prepare Workspace", desc: `Clean and organize workspace. Gather all ${materials.length} materials and required tools (adhesives, fasteners, protective gear).` },
    { step: 2, title: "Inspect Materials", desc: `Verify quality and dimensions of each material: ${materials.map(m => m.label).join(", ")}. Check for defects before assembly.` },
    { step: 3, title: "Primary Structure", desc: `Begin with ${materials[0]?.label || "base material"} as the structural foundation. Measure, cut, and shape to specification.` },
    ...(materials.length > 1 ? [{ step: 4, title: "Layer Integration", desc: `Apply ${materials[1]?.label || "secondary material"} using recommended bonding method. Ensure even coverage and proper adhesion.` }] : []),
    ...(materials.length > 2 ? [{ step: 5, title: "Surface Treatment", desc: `Apply ${materials[2]?.label || "coating"} as protective/functional surface layer. Follow curing time specifications.` }] : []),
    ...(materials.length > 3 ? [{ step: 6, title: "Component Integration", desc: `Install ${materials.slice(3).map(m => m.label).join(", ")}. Align precisely and secure with appropriate fasteners.` }] : []),
    { step: materials.length + 3, title: "Quality Check", desc: "Inspect all joints, surfaces, and connections. Test structural integrity. Document any deviations from spec." },
    { step: materials.length + 4, title: "Final Assembly", desc: "Complete finishing touches—trim excess, clean surfaces, apply labels/markings. Record final measurements." },
  ];
}

interface Props {
  project: ZaliProject;
}

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
  const meta = useMemo(() => getMaterialMeta(label, index), [label, index]);

  const properties = useMemo(() => [
    { key: "Density", value: `${(1.2 + (index * 1.7) % 8).toFixed(1)} g/cm³` },
    { key: "Hardness", value: `${20 + ((index * 13 + 7) % 60)} HRC` },
    { key: "Yield", value: `${100 + ((index * 37 + 11) % 400)} MPa` },
  ], [index]);

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
      <div className="relative h-24 flex items-center justify-center overflow-hidden">
        <div
          className="absolute w-20 h-20 rounded-full blur-2xl transition-opacity duration-500"
          style={{ backgroundColor: color + "20", opacity: active ? 1 : 0.4 }}
        />
        <div
          className="absolute w-16 h-16 rounded-full border transition-all duration-500"
          style={{
            borderColor: active ? color + "40" : color + "15",
            animation: "spin 10s linear infinite",
          }}
        />
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
      {/* Label + price + properties */}
      <div className="px-3 pb-3">
        <p className="text-[11px] font-light text-foreground truncate">{label}</p>
        <div className="flex items-center gap-1 mt-1">
          <DollarSign className="h-2.5 w-2.5 text-accent/60" />
          <span className="text-[10px] font-mono text-accent/80">${meta.price}</span>
          <span className="text-[8px] text-muted-foreground/40">{meta.unit}</span>
        </div>
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

function MaterialExpanded({ label, color, index }: { label: string; color: string; index: number }) {
  const meta = useMemo(() => getMaterialMeta(label, index), [label, index]);

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
      <div className="relative h-[220px] flex items-center justify-center overflow-hidden">
        <div className="absolute w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: color + "15" }} />
        <div className="absolute w-48 h-48 rounded-full border" style={{ borderColor: color + "10", animation: "spin 15s linear infinite" }} />
        <div className="absolute w-36 h-36 rounded-full border" style={{ borderColor: color + "15", animation: "spin 12s linear infinite reverse" }} />
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

      <div className="px-4 pb-4 space-y-4">
        <p className="text-sm font-light text-foreground">{label}</p>

        {/* Pricing */}
        <div className="rounded-lg border border-accent/15 bg-accent/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] font-medium text-accent uppercase tracking-wider">Pricing</span>
          </div>
          <p className="text-lg font-mono text-foreground">
            ${meta.price}<span className="text-xs text-muted-foreground/50 ml-1">{meta.unit}</span>
          </p>
        </div>

        {/* Buy Links */}
        <div className="rounded-lg border border-border/15 bg-card/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingCart className="h-3.5 w-3.5 text-foreground/60" />
            <span className="text-[11px] font-medium text-foreground/70 uppercase tracking-wider">Where to Buy</span>
          </div>
          <div className="space-y-1.5">
            {meta.suppliers.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-2.5 py-2 rounded-md border border-border/10 bg-background/30 hover:bg-accent/5 hover:border-accent/20 transition-colors group"
              >
                <span className="text-[11px] text-foreground/70 group-hover:text-foreground transition-colors">{s.name}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-accent transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Properties grid */}
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

// Assembly instructions panel
function AssemblyInstructions({ materials }: { materials: { label: string }[] }) {
  const steps = useMemo(() => getAssemblySteps(materials), [materials]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <BookOpen className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-medium text-accent uppercase tracking-wider">Assembly Instructions</span>
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.step} className="rounded-lg border border-border/15 bg-card/20 p-3">
            <div className="flex items-start gap-2.5">
              <div
                className="flex-shrink-0 w-5 h-5 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center"
              >
                <span className="text-[9px] font-mono text-accent">{s.step}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-foreground/80">{s.title}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ZaliMaterialsView = ({ project }: Props) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAssembly, setShowAssembly] = useState(false);

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

  // Expanded single material
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

  // Assembly instructions view
  if (showAssembly) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-3 py-2 border-b border-border/15 flex items-center gap-2">
          <button
            onClick={() => setShowAssembly(false)}
            className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Wrench className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[11px] font-light text-foreground">Assembly Guide</span>
        </div>
        <div className="flex-1 overflow-auto pt-3">
          <AssemblyInstructions materials={materials} />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="h-full overflow-auto p-3 space-y-3">
      {/* Assembly button */}
      <button
        onClick={() => setShowAssembly(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors"
      >
        <Wrench className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] text-accent font-medium">View Assembly Instructions</span>
        <span className="ml-auto text-[9px] text-muted-foreground/40">{materials.length} materials</span>
      </button>

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
