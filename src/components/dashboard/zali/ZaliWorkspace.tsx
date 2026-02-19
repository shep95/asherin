import { useState, useEffect, Suspense, Component } from "react";
import React from "react";
import { Atom, Box, Layers, Microscope, Cpu, Activity, Grid3x3, CheckCircle2, AlertTriangle, Zap, Shield, Sparkles, Send, RotateCw } from "lucide-react";
import type { ZaliPhase, ZaliProject } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";
import ModelDetailsPanel from "./ModelDetailsPanel";
import Zali3DModel from "./Zali3DModel";

// Local error boundary for 3D canvas crashes
class Model3DErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[350px]">
          <div className="text-center">
            <AlertTriangle className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">3D viewport unavailable</p>
            <button onClick={() => this.setState({ hasError: false })} className="text-[10px] text-accent mt-2 hover:underline">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  autoBuild?: boolean;
  modelPrompt?: string;
}

const ZaliWorkspace = ({ project, autoBuild, modelPrompt }: Props) => {
  const [activeScale, setActiveScale] = useState(0);
  const [viewMode, setViewMode] = useState<"assembled" | "exploded" | "crosssection" | "simulation">("assembled");
  const [showModel, setShowModel] = useState(false);
  const [modelDescription, setModelDescription] = useState("");
  const [appliedDescription, setAppliedDescription] = useState("");

  const phase = project?.phase ?? "understanding";
  const phaseConfig = PHASE_CONFIG[phase];

  const hasSpecs = project && Object.keys(project.specifications).length > 0;
  const hasCost = project && Object.keys(project.costAnalysis).length > 0;
  const hasMfg = project && Object.keys(project.manufacturing).length > 0;
  const hasSims = project && Object.keys(project.simulationResults).length > 0;
  const hasDesignData = hasSpecs || hasCost || hasMfg || hasSims;

  // Auto-build when triggered from chat commands
  useEffect(() => {
    if (autoBuild && hasDesignData && !showModel) {
      setShowModel(true);
    }
  }, [autoBuild, hasDesignData]);

  // Apply model prompt from chat
  useEffect(() => {
    if (modelPrompt && modelPrompt !== appliedDescription) {
      setModelDescription(modelPrompt);
      setAppliedDescription(modelPrompt);
    }
  }, [modelPrompt]);

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

  const handleApplyDescription = () => {
    if (modelDescription.trim()) {
      setAppliedDescription(modelDescription.trim());
    }
  };

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
            <div className="relative z-10">
              {/* Build 3D Model button or 3D viewport */}
              {!showModel ? (
                <div className="flex flex-col items-center justify-center min-h-[350px] gap-4 p-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full border border-accent/20 flex items-center justify-center bg-accent/5">
                      <Box className="h-10 w-10 text-accent/50" />
                    </div>
                    <div className="absolute inset-0 h-24 w-24 rounded-full border border-accent/10 animate-ping" style={{ animationDuration: "3s" }} />
                  </div>
                  <div className="text-center max-w-sm">
                    <p className="text-sm font-light text-foreground">Design data ready</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      Your specifications, materials, and equipment have been compiled. Build the 3D model to visualize your design.
                    </p>
                  </div>

                  {/* Optional: describe the model */}
                  <div className="w-full max-w-sm">
                    <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
                      <input
                        value={modelDescription}
                        onChange={(e) => setModelDescription(e.target.value)}
                        placeholder="Describe model appearance (optional)..."
                        className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
                        onKeyDown={(e) => { if (e.key === "Enter") handleApplyDescription(); }}
                      />
                      {modelDescription.trim() && (
                        <button onClick={handleApplyDescription} className="p-1 rounded-md text-accent hover:bg-accent/10 transition-colors">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {appliedDescription && (
                      <p className="text-[9px] text-accent/60 mt-1.5 px-1">✓ Description applied: "{appliedDescription}"</p>
                    )}
                  </div>

                  <button
                    onClick={() => setShowModel(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-light hover:bg-accent/90 transition-all group"
                  >
                    <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                    Build 3D Model
                  </button>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* 3D Viewport */}
                  <div className="relative h-[400px] sm:h-[450px]">
                    <Model3DErrorBoundary>
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
                            <p className="text-[10px] text-muted-foreground/50 mt-3 tracking-wider">BUILDING MODEL...</p>
                          </div>
                        </div>
                      }>
                        <Zali3DModel project={project} viewMode={viewMode} />
                      </Suspense>
                    </Model3DErrorBoundary>
                    {/* Overlay info */}
                    <div className="absolute top-3 left-3 space-y-1">
                      <div className="px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-border/20">
                        <p className="text-[9px] text-muted-foreground/60">
                          <span className="text-accent">●</span> {project.name}
                        </p>
                      </div>
                      {appliedDescription && (
                        <div className="px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-accent/20 max-w-[200px]">
                          <p className="text-[9px] text-accent/70 truncate">"{appliedDescription}"</p>
                        </div>
                      )}
                    </div>
                    {/* Rebuild button */}
                    <button
                      onClick={() => setShowModel(false)}
                      className="absolute top-3 right-3 p-1.5 rounded-md bg-background/70 backdrop-blur-sm border border-border/20 text-muted-foreground/50 hover:text-foreground transition-colors"
                      title="Reconfigure model"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Model description input */}
                  <div className="px-4 py-3 border-t border-border/10">
                    <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2 max-w-lg">
                      <input
                        value={modelDescription}
                        onChange={(e) => setModelDescription(e.target.value)}
                        placeholder="Describe changes to the model design..."
                        className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && modelDescription.trim()) {
                            setAppliedDescription(modelDescription.trim());
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (modelDescription.trim()) {
                            setAppliedDescription(modelDescription.trim());
                          }
                        }}
                        disabled={!modelDescription.trim()}
                        className="p-1.5 rounded-md text-accent hover:bg-accent/10 transition-colors disabled:opacity-30"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Model Details */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] font-light tracking-wider text-foreground uppercase">Model Details</span>
                    </div>
                    <ModelDetailsPanel project={project} />
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
