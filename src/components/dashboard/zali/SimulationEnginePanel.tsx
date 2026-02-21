import { useState } from "react";
import { Activity, Thermometer, Zap, Wind, Shield, Waves, FlaskConical, Timer, CheckCircle2, XCircle, BarChart3, Play, Pause } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ZaliProject } from "./types";

const SIMULATION_TYPES = [
  { id: "mechanical", label: "Structural / FEA", icon: Activity, description: "Stress, strain, deformation analysis", engine: "PyBullet" },
  { id: "thermal", label: "Thermal", icon: Thermometer, description: "Heat transfer, hotspot detection", engine: "OpenFOAM" },
  { id: "electrical", label: "Circuit / SPICE", icon: Zap, description: "Voltage, current, signal integrity", engine: "SPICE" },
  { id: "fluids", label: "CFD / Fluids", icon: Wind, description: "Airflow, pressure drop, turbulence", engine: "CFD" },
  { id: "vibration", label: "Vibration", icon: Waves, description: "Resonance, damping, fatigue", engine: "Modal" },
  { id: "chemical", label: "Chemical", icon: FlaskConical, description: "Reaction rates, stability, corrosion", engine: "LAMMPS" },
];

const DEMO_RESULTS = {
  mechanical: {
    status: "pass", maxStress: "127 MPa", yield: "276 MPa", safetyFactor: "2.17",
    deformation: "0.34 mm", criticalPoint: "Joint A-3", duration: "12.4s"
  },
  thermal: {
    status: "warning", maxTemp: "92°C", limit: "85°C", timeToEquilibrium: "420s",
    hotspot: "CPU contact point", coolingEfficiency: "87%", fix: "Add thermal paste + spring mount → 74°C"
  },
};

interface Props {
  project: ZaliProject | null;
}

const SimulationEnginePanel = ({ project }: Props) => {
  const [selectedSim, setSelectedSim] = useState("mechanical");
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const runSimulation = (simId: string) => {
    setRunning(true);
    setSelectedSim(simId);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRunning(false);
          setCompleted(prev => [...prev, simId]);
          return 100;
        }
        return p + 2;
      });
    }, 50);
  };

  const result = (DEMO_RESULTS as any)[selectedSim];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Simulation Engine</h2>
          </div>
          <span className="text-[9px] text-muted-foreground/50">6 physics engines available</span>
        </div>

        {!project ? (
          <div className="text-center py-12">
            <p className="text-sm font-extralight text-muted-foreground/40">Create a project with design data to run simulations</p>
          </div>
        ) : (
          <>
            {/* Simulation type grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SIMULATION_TYPES.map(sim => {
                const isCompleted = completed.includes(sim.id);
                const isActive = running && selectedSim === sim.id;
                return (
                  <button
                    key={sim.id}
                    onClick={() => !running && runSimulation(sim.id)}
                    disabled={running}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isActive ? "border-amber-500/40 bg-amber-500/10" :
                      isCompleted ? "border-emerald-500/20 bg-emerald-500/5" :
                      selectedSim === sim.id ? "border-border/30 bg-card/30" :
                      "border-border/15 bg-card/20 hover:border-border/30"
                    } disabled:opacity-60`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <sim.icon className={`h-4 w-4 ${isCompleted ? "text-emerald-400" : isActive ? "text-amber-400 animate-pulse" : "text-muted-foreground/50"}`} />
                      {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                      {isActive && <Timer className="h-3 w-3 text-amber-400 animate-spin" />}
                    </div>
                    <p className="text-[10px] font-light text-foreground">{sim.label}</p>
                    <p className="text-[8px] text-muted-foreground/40">{sim.engine}</p>
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            {running && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-amber-400">Running {SIMULATION_TYPES.find(s => s.id === selectedSim)?.label}...</span>
                  <span className="text-[10px] text-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-100" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Results */}
            {result && completed.includes(selectedSim) && (
              <div className={`rounded-xl border p-4 ${result.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {result.status === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-400" />
                  )}
                  <h3 className="text-xs font-light text-foreground">
                    {result.status === "pass" ? "SIMULATION PASSED" : "⚠️ ISSUE DETECTED"}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(result).filter(([k]) => k !== "status" && k !== "fix").map(([key, val]) => (
                    <div key={key} className="rounded-lg bg-card/30 border border-border/10 p-2.5">
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                      <p className="text-[11px] font-light text-foreground">{String(val)}</p>
                    </div>
                  ))}
                </div>
                {result.fix && (
                  <div className="mt-3 pt-3 border-t border-border/10 flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-light text-emerald-400">Recommended Fix</p>
                      <p className="text-[10px] text-muted-foreground/70">{result.fix}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Run all button */}
            {!running && completed.length < SIMULATION_TYPES.length && (
              <button
                onClick={() => {
                  const next = SIMULATION_TYPES.find(s => !completed.includes(s.id));
                  if (next) runSimulation(next.id);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 py-3 text-xs font-light text-accent transition-all"
              >
                <Play className="h-3.5 w-3.5" />
                Run Next Simulation
              </button>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default SimulationEnginePanel;