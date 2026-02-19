import { useState } from "react";
import { Atom, Box, Layers, Microscope, Cpu, Activity, RotateCw, ZoomIn, ZoomOut, Maximize2, Grid3x3, CheckCircle2, AlertTriangle, Zap, Shield } from "lucide-react";
import type { ZaliPhase, ZaliProject } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

const PHASE_CONFIG: Record<ZaliPhase, { label: string; color: string; description: string }> = {
  understanding: { label: "UNDERSTANDING", color: "text-blue-400", description: "Socratic questioning & first principles" },
  research: { label: "RESEARCH", color: "text-emerald-400", description: "Cross-domain knowledge acquisition" },
  design: { label: "DESIGN", color: "text-accent", description: "Atomic-level design synthesis" },
  simulation: { label: "SIMULATION", color: "text-amber-400", description: "Multi-scale physics simulation" },
  iteration: { label: "ITERATION", color: "text-cyan-400", description: "Design refinement & optimization" },
  documentation: { label: "DOCUMENTATION", color: "text-pink-400", description: "Professional documentation export" },
};

const SCALE_LEVELS = [
  { label: "Product", scale: "10cm", icon: Box },
  { label: "Component", scale: "1mm", icon: Layers },
  { label: "Material", scale: "1μm", icon: Grid3x3 },
  { label: "Molecular", scale: "1nm", icon: Microscope },
  { label: "Atomic", scale: "1Å", icon: Atom },
  { label: "Quantum", scale: "sub-Å", icon: Cpu },
];

interface Props {
  project: ZaliProject | null;
}

const ZaliWorkspace = ({ project }: Props) => {
  const [activeScale, setActiveScale] = useState(0);
  const [viewMode, setViewMode] = useState<"assembled" | "exploded" | "crosssection" | "simulation">("assembled");
  const phase = project?.phase ?? "understanding";
  const phaseConfig = PHASE_CONFIG[phase];

  const hasSpecs = project && Object.keys(project.specifications).length > 0;
  const hasCost = project && Object.keys(project.costAnalysis).length > 0;
  const hasMfg = project && Object.keys(project.manufacturing).length > 0;
  const hasSims = project && Object.keys(project.simulationResults).length > 0;
  const hasDesignData = hasSpecs || hasCost || hasMfg || hasSims;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="relative">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border border-border/20 flex items-center justify-center">
            <Atom className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/20 animate-spin" style={{ animationDuration: "8s" }} />
          </div>
          <div className="absolute inset-0 h-20 w-20 sm:h-24 sm:w-24 rounded-full border border-accent/10 animate-ping" style={{ animationDuration: "3s" }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-extralight text-muted-foreground">Design Workspace</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">Create a project to activate the holographic viewport</p>
        </div>
      </div>
    );
  }

  const specs = project.specifications as Record<string, any>;
  const cost = project.costAnalysis as Record<string, any>;
  const mfg = project.manufacturing as Record<string, any>;
  const sims = project.simulationResults as Record<string, any>;

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <div className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${phaseConfig.color} bg-current animate-pulse`} />
          <div>
            <span className={`text-[10px] font-light tracking-[0.2em] ${phaseConfig.color}`}>{phaseConfig.label}</span>
            <p className="text-[9px] text-muted-foreground/50 hidden sm:block">{phaseConfig.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {(["assembled", "exploded", "crosssection", "simulation"] as const).map((vm) => (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
              className={`px-2 py-1 rounded text-[9px] whitespace-nowrap transition-colors ${
                viewMode === vm ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {vm === "crosssection" ? "X-Section" : vm.charAt(0).toUpperCase() + vm.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main viewport */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="relative min-h-[400px]">
          {/* Grid background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {!hasDesignData ? (
            /* Waiting state — holographic animation */
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="relative">
                <div className="h-32 w-32 sm:h-48 sm:w-48 rounded-full border border-accent/20 animate-spin" style={{ animationDuration: "12s" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent/60" />
                </div>
                <div className="absolute inset-3 sm:inset-4 rounded-full border border-border/20 animate-spin" style={{ animationDuration: "8s", animationDirection: "reverse" }}>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                </div>
                <div className="absolute inset-6 sm:inset-8 rounded-full border border-border/10 animate-spin" style={{ animationDuration: "15s" }}>
                  <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-400/60" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Atom className="h-6 w-6 sm:h-8 sm:w-8 text-accent/40 mx-auto animate-pulse" />
                    <p className="text-[9px] sm:text-[10px] font-extralight text-muted-foreground/50 mt-2 tracking-wider">
                      AWAITING DESIGN DATA
                    </p>
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground/30">
                      Answer ZALI's questions to generate
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Design data visualization */
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 relative z-10">
              {/* Project header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-light text-foreground">{project.name}</h2>
                  <p className="text-[10px] text-muted-foreground/60">{project.designType} · Phase: {phaseConfig.label}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-current/20 ${phaseConfig.color}`}>
                  <Activity className="h-3 w-3" />
                  <span className="text-[9px] tracking-wider">{phaseConfig.label}</span>
                </div>
              </div>

              {/* Specifications card */}
              {hasSpecs && (
                <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/10 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-accent" />
                    <span className="text-[11px] font-light tracking-wider text-foreground uppercase">Specifications</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {specs.overview && (
                      <p className="text-xs font-light text-muted-foreground leading-relaxed">{specs.overview}</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {specs.dimensions && (
                        <div className="rounded-lg border border-border/10 bg-foreground/5 p-2.5">
                          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Dimensions</p>
                          <p className="text-[11px] text-foreground mt-0.5">{specs.dimensions}</p>
                        </div>
                      )}
                      {specs.weight && (
                        <div className="rounded-lg border border-border/10 bg-foreground/5 p-2.5">
                          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Weight</p>
                          <p className="text-[11px] text-foreground mt-0.5">{specs.weight}</p>
                        </div>
                      )}
                      {specs.power && (
                        <div className="rounded-lg border border-border/10 bg-foreground/5 p-2.5">
                          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Power</p>
                          <p className="text-[11px] text-foreground mt-0.5">{specs.power}</p>
                        </div>
                      )}
                    </div>
                    {specs.materials && Array.isArray(specs.materials) && specs.materials.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Materials</p>
                        <div className="flex flex-wrap gap-1.5">
                          {specs.materials.map((m: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px]">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {specs.key_features && Array.isArray(specs.key_features) && specs.key_features.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Key Features</p>
                        <div className="space-y-1">
                          {specs.key_features.map((f: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="text-[11px] text-foreground font-light">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {specs.performance_targets && typeof specs.performance_targets === "object" && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Performance Targets</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(specs.performance_targets).map(([key, val]) => (
                            <div key={key} className="rounded-lg border border-border/10 bg-foreground/5 p-2">
                              <p className="text-[9px] text-muted-foreground/50 capitalize">{key.replace(/_/g, " ")}</p>
                              <p className="text-[11px] text-foreground mt-0.5">{String(val)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cost Analysis card */}
              {hasCost && (
                <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/10 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-[11px] font-light tracking-wider text-foreground uppercase">Cost Analysis</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(cost).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border/10 bg-foreground/5 p-2.5">
                          <p className="text-[9px] text-muted-foreground/50 capitalize">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-light text-foreground mt-0.5">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Manufacturing card */}
              {hasMfg && (
                <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/10 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[11px] font-light tracking-wider text-foreground uppercase">Manufacturing</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(mfg).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border/10 bg-foreground/5 p-2.5">
                          <p className="text-[9px] text-muted-foreground/50 capitalize">{key.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-foreground mt-0.5">
                            {Array.isArray(val) ? val.join(", ") : String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Simulation Results card */}
              {hasSims && (
                <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/10 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[11px] font-light tracking-wider text-foreground uppercase">Simulation Results</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(sims).map(([key, val]) => {
                        const valStr = String(val).toLowerCase();
                        const isPass = valStr.includes("pass") || valStr.includes("excellent") || valStr.includes("high");
                        return (
                          <div key={key} className="rounded-lg border border-border/10 bg-foreground/5 p-2.5 flex items-start gap-2">
                            {isPass ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <p className="text-[9px] text-muted-foreground/50 capitalize">{key.replace(/_/g, " ")}</p>
                              <p className="text-[11px] text-foreground mt-0.5">{String(val)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Scale selector bar */}
      <div className="flex-shrink-0 px-2 sm:px-4 py-2 border-t border-border/20 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {SCALE_LEVELS.map((level, i) => (
          <button
            key={level.label}
            onClick={() => setActiveScale(i)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] whitespace-nowrap transition-colors ${
              activeScale === i
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <level.icon className="h-3 w-3" />
            <span className="hidden xs:inline">{level.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ZaliWorkspace;
