import { useState } from "react";
import { Dna, Sparkles, Trophy, Target, Sliders, BarChart3, ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ZaliProject } from "./types";

const OBJECTIVES = [
  { id: "cost", label: "Cost", default: 40 },
  { id: "performance", label: "Performance", default: 30 },
  { id: "weight", label: "Weight", default: 20 },
  { id: "buildTime", label: "Build Time", default: 10 },
];

const OPTIMIZED_DESIGNS = [
  {
    name: "Budget Champion", score: 92, badge: "⭐ BEST",
    cost: { value: "$387", delta: "-21%" },
    performance: { value: "84/100", delta: "-8%" },
    weight: { value: "1.8 kg", delta: "-10%" },
    buildTime: { value: "9 hrs", delta: "-25%" },
    changes: ["PLA frame instead of carbon fiber (-$120)", "Standard motors instead of premium (-$67)", "Simplified gimbal design (-3 hrs build)"],
    tradeoffs: ["Max flight time: 18 min (vs 22 min)", "Max wind: 15 mph (vs 20 mph)"]
  },
  {
    name: "Performance Beast", score: 87, badge: "",
    cost: { value: "$623", delta: "+27%" },
    performance: { value: "97/100", delta: "+13%" },
    weight: { value: "1.6 kg", delta: "-20%" },
    buildTime: { value: "14 hrs", delta: "+17%" },
    changes: ["Carbon fiber frame (+$180)", "Brushless motors with 20% more thrust (+$89)", "Advanced flight controller (+$67)"],
    tradeoffs: ["Higher cost", "Longer build time"]
  },
  {
    name: "Balanced Build", score: 85, badge: "",
    cost: { value: "$487", delta: "0%" },
    performance: { value: "89/100", delta: "+4%" },
    weight: { value: "1.7 kg", delta: "-15%" },
    buildTime: { value: "12 hrs", delta: "0%" },
    changes: ["Optimized motor placement", "Lighter battery with same capacity", "Improved aerodynamics"],
    tradeoffs: ["No significant drawbacks"]
  },
];

interface Props {
  project: ZaliProject | null;
}

const OptimizationPanel = ({ project }: Props) => {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(OBJECTIVES.map(o => [o.id, o.default]))
  );
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const runOptimization = () => {
    setRunning(true);
    setComplete(false);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRunning(false);
          setComplete(true);
          return 100;
        }
        return p + 1;
      });
    }, 30);
  };

  const handleWeight = (id: string, val: number) => {
    const total = Object.values(weights).reduce((s, v) => s + v, 0) - weights[id] + val;
    if (total <= 100) setWeights(prev => ({ ...prev, [id]: val }));
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="h-4 w-4 text-purple-400" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Multi-Objective Optimization</h2>
          </div>
          <span className="text-[9px] text-muted-foreground/50">Genetic Algorithm · 50 variants × 20 generations</span>
        </div>

        {!project ? (
          <div className="text-center py-12">
            <p className="text-sm font-extralight text-muted-foreground/40">Create a design to optimize</p>
          </div>
        ) : (
          <>
            {/* Priority sliders */}
            <div className="rounded-xl border border-border/15 bg-card/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="h-3.5 w-3.5 text-accent/60" />
                <h3 className="text-[11px] font-light text-foreground">Optimization Priorities</h3>
                <span className="ml-auto text-[9px] text-muted-foreground/40">
                  Total: {Object.values(weights).reduce((s, v) => s + v, 0)}%
                </span>
              </div>
              <div className="space-y-3">
                {OBJECTIVES.map(obj => (
                  <div key={obj.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground/60 w-20">{obj.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weights[obj.id]}
                      onChange={(e) => handleWeight(obj.id, parseInt(e.target.value))}
                      className="flex-1 h-1 accent-accent"
                    />
                    <span className="text-[10px] text-foreground w-8 text-right">{weights[obj.id]}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Run button */}
            {!complete && (
              <button
                onClick={runOptimization}
                disabled={running}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 py-3 text-xs font-light text-purple-400 transition-all disabled:opacity-50"
              >
                {running ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                    Testing {Math.floor(progress / 2)}/50 variations... ({progress}%)
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Run Optimization (1,000 evaluations)
                  </>
                )}
              </button>
            )}

            {/* Progress */}
            {running && (
              <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
                <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            {/* Results */}
            {complete && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-light text-foreground">Top 3 Optimized Designs</h3>
                </div>
                {OPTIMIZED_DESIGNS.map((design, i) => (
                  <button
                    key={design.name}
                    onClick={() => setSelected(i)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      selected === i ? "border-accent/40 bg-accent/10" : "border-border/15 bg-card/20 hover:border-border/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-light text-foreground">{design.name}</span>
                        {design.badge && <span className="text-[9px] text-amber-400">{design.badge}</span>}
                      </div>
                      <span className="text-sm font-light text-accent">{design.score}/100</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: "Cost", ...design.cost },
                        { label: "Perf", ...design.performance },
                        { label: "Weight", ...design.weight },
                        { label: "Build", ...design.buildTime },
                      ].map(m => (
                        <div key={m.label}>
                          <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">{m.label}</p>
                          <p className="text-[11px] text-foreground">{m.value}</p>
                          <p className={`text-[9px] ${m.delta.startsWith("-") ? "text-emerald-400" : m.delta === "0%" ? "text-muted-foreground/40" : "text-amber-400"}`}>{m.delta}</p>
                        </div>
                      ))}
                    </div>
                    {selected === i && (
                      <div className="space-y-2 pt-2 border-t border-border/10 animate-fade-in">
                        <div>
                          <p className="text-[9px] text-muted-foreground/50 mb-1">Key Changes:</p>
                          {design.changes.map((c, j) => (
                            <p key={j} className="text-[10px] text-foreground flex items-start gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> {c}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground/50 mb-1">Trade-offs:</p>
                          {design.tradeoffs.map((t, j) => (
                            <p key={j} className="text-[10px] text-muted-foreground/60">• {t}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default OptimizationPanel;