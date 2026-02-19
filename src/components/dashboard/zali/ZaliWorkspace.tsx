import { useState } from "react";
import { Atom, Box, Layers, Microscope, Cpu, Activity, RotateCw, ZoomIn, ZoomOut, Maximize2, Grid3x3 } from "lucide-react";
import type { ZaliPhase, ZaliProject } from "./types";

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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="relative">
          <div className="h-24 w-24 rounded-full border border-border/20 flex items-center justify-center">
            <Atom className="h-10 w-10 text-muted-foreground/20 animate-spin" style={{ animationDuration: "8s" }} />
          </div>
          <div className="absolute inset-0 h-24 w-24 rounded-full border border-accent/10 animate-ping" style={{ animationDuration: "3s" }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-extralight text-muted-foreground">Design Workspace</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">Create a project to activate the holographic viewport</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${phaseConfig.color} bg-current animate-pulse`} />
          <div>
            <span className={`text-[10px] font-light tracking-[0.2em] ${phaseConfig.color}`}>{phaseConfig.label}</span>
            <p className="text-[9px] text-muted-foreground/50">{phaseConfig.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(["assembled", "exploded", "crosssection", "simulation"] as const).map((vm) => (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
              className={`px-2 py-1 rounded text-[9px] transition-colors ${
                viewMode === vm ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {vm === "crosssection" ? "X-Section" : vm.charAt(0).toUpperCase() + vm.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main viewport */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Animated holographic element */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Orbiting rings */}
            <div className="h-48 w-48 rounded-full border border-accent/20 animate-spin" style={{ animationDuration: "12s" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent/60" />
            </div>
            <div className="absolute inset-4 rounded-full border border-border/20 animate-spin" style={{ animationDuration: "8s", animationDirection: "reverse" }}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
            </div>
            <div className="absolute inset-8 rounded-full border border-border/10 animate-spin" style={{ animationDuration: "15s" }}>
              <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-400/60" />
            </div>

            {/* Center element */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Atom className="h-8 w-8 text-accent/40 mx-auto animate-pulse" />
                <p className="text-[10px] font-extralight text-muted-foreground/50 mt-2 tracking-wider">
                  {viewMode.toUpperCase()} VIEW
                </p>
                <p className="text-[9px] text-muted-foreground/30">
                  Scale: {SCALE_LEVELS[activeScale].scale}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scale info overlay */}
        <div className="absolute top-4 left-4 space-y-1">
          <p className="text-[9px] text-muted-foreground/40 tracking-wider">SCALE</p>
          <p className="text-xs font-light text-foreground">{SCALE_LEVELS[activeScale].label}</p>
          <p className="text-[10px] text-muted-foreground/60">{SCALE_LEVELS[activeScale].scale}</p>
        </div>

        {/* Project info */}
        <div className="absolute top-4 right-4 text-right">
          <p className="text-[9px] text-muted-foreground/40 tracking-wider">PROJECT</p>
          <p className="text-xs font-light text-foreground truncate max-w-[180px]">{project.name}</p>
          <p className="text-[10px] text-muted-foreground/60">{project.designType}</p>
        </div>

        {/* View controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm px-2 py-1">
          <button className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border/20" />
          <button className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scale selector bar */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-border/20 flex items-center gap-1 overflow-x-auto">
        {SCALE_LEVELS.map((level, i) => (
          <button
            key={level.label}
            onClick={() => setActiveScale(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] whitespace-nowrap transition-colors ${
              activeScale === i
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <level.icon className="h-3 w-3" />
            {level.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ZaliWorkspace;
