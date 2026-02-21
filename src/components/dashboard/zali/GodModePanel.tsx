import { useState } from "react";
import { Sparkles, Waves, Atom, Heart, Brain, Hexagon, Music, Eye, Zap, Sun, Moon, Star, Shield, Activity, Cpu, FlaskConical, Timer } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const SOLFEGGIO_FREQUENCIES = [
  { freq: "396 Hz", label: "Liberation", color: "text-red-400", desc: "Releases guilt & fear" },
  { freq: "417 Hz", label: "Change", color: "text-orange-400", desc: "Facilitates transformation" },
  { freq: "528 Hz", label: "DNA Repair", color: "text-emerald-400", desc: "Healing & restoration" },
  { freq: "639 Hz", label: "Connection", color: "text-cyan-400", desc: "Relationships & harmony" },
  { freq: "741 Hz", label: "Awakening", color: "text-blue-400", desc: "Intuition & expression" },
  { freq: "852 Hz", label: "Intuition", color: "text-indigo-400", desc: "Inner awareness" },
  { freq: "963 Hz", label: "Crown", color: "text-violet-400", desc: "Divine consciousness" },
];

const SACRED_GEOMETRIES = [
  { name: "Flower of Life", amplification: "8.2x", use: "Healing, water structuring" },
  { name: "Metatron's Cube", amplification: "12.7x", use: "Energy channeling" },
  { name: "Sri Yantra", amplification: "15.3x", use: "Consciousness expansion" },
  { name: "Fibonacci Spiral", amplification: "6.4x", use: "Natural growth patterns" },
  { name: "Torus Field", amplification: "9.8x", use: "Energy containment" },
  { name: "Platonic Solids", amplification: "7.1x", use: "Elemental alignment" },
];

const CONSCIOUSNESS_FEATURES = [
  { icon: Waves, name: "Consciousness Field Simulator", desc: "Maps intentions to resonant frequencies", active: true },
  { icon: Heart, name: "Biofield Optimizer", desc: "Aligns with human electromagnetic field", active: true },
  { icon: Brain, name: "Brainwave Entrainment", desc: "Alpha, theta, delta wave targeting", active: false },
  { icon: Atom, name: "Quantum Entanglement Engine", desc: "Non-local communication design", active: false },
  { icon: Hexagon, name: "Sacred Geometry Generator", desc: "Auto-applies phi ratio & Fibonacci", active: true },
  { icon: Music, name: "Cymatics Pattern Engine", desc: "Sound → geometric pattern mapping", active: false },
  { icon: Eye, name: "Third Eye Resonator", desc: "Pineal gland frequency optimization", active: false },
  { icon: Zap, name: "Zero-Point Energy Harvester", desc: "Casimir effect + consciousness amp", active: false },
  { icon: Sun, name: "Schumann Resonance Harmonizer", desc: "Earth frequency alignment (7.83 Hz)", active: true },
  { icon: FlaskConical, name: "Living Material Synthesizer", desc: "Consciousness-responsive mycelium", active: false },
];

const QUANTUM_TECH = [
  { name: "Quantum Coherence Stabilizer", status: "Research", progress: 35 },
  { name: "Probability Field Manipulator", status: "Theoretical", progress: 15 },
  { name: "Retrocausal Communication", status: "Experimental", progress: 8 },
  { name: "Observer Effect Amplifier", status: "Research", progress: 42 },
  { name: "Consciousness-Stabilized Qubits", status: "Theoretical", progress: 22 },
];

const GodModePanel = () => {
  const [tab, setTab] = useState<"consciousness" | "frequencies" | "geometry" | "quantum">("consciousness");
  const [selectedFreq, setSelectedFreq] = useState<string | null>(null);
  const [godModeActive, setGodModeActive] = useState(false);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">God Mode</h2>
            <span className="text-[8px] px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">EXPERIMENTAL</span>
          </div>
          <button
            onClick={() => setGodModeActive(!godModeActive)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-all ${
              godModeActive
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "bg-foreground/5 text-muted-foreground/50 border border-border/20 hover:text-foreground"
            }`}
          >
            {godModeActive ? "● Active" : "○ Inactive"}
          </button>
        </div>

        {/* Banner */}
        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-indigo-500/5 to-purple-500/5 p-4">
          <p className="text-[11px] font-light text-foreground mb-1">Beyond Technology: Consciousness-Integrated Design</p>
          <p className="text-[9px] text-muted-foreground/60">
            God Mode integrates consciousness fields, sacred geometry, quantum mechanics, and biofield science into the design pipeline.
            Designs are enhanced with frequency tuning, geometric amplification, and consciousness coupling.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(["consciousness", "frequencies", "geometry", "quantum"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors capitalize ${tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}
            >{t}</button>
          ))}
        </div>

        {tab === "consciousness" && (
          <div className="space-y-2.5">
            {CONSCIOUSNESS_FEATURES.map(feat => (
              <div key={feat.name} className={`rounded-xl border p-3.5 transition-all ${
                feat.active && godModeActive
                  ? "border-violet-500/20 bg-violet-500/5"
                  : "border-border/15 bg-card/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <feat.icon className={`h-4 w-4 ${feat.active && godModeActive ? "text-violet-400" : "text-muted-foreground/30"}`} />
                    <div>
                      <p className="text-[11px] font-light text-foreground">{feat.name}</p>
                      <p className="text-[9px] text-muted-foreground/50">{feat.desc}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] px-2 py-0.5 rounded-md ${
                    feat.active ? "bg-emerald-500/10 text-emerald-400" : "bg-foreground/5 text-muted-foreground/30"
                  }`}>
                    {feat.active ? "Available" : "Coming Soon"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "frequencies" && (
          <div className="space-y-3">
            <p className="text-[10px] text-muted-foreground/60">
              Solfeggio frequencies are ancient tones used in sacred music. ZALI maps design intent to resonant frequencies for consciousness-enhanced design.
            </p>
            <div className="grid gap-2">
              {SOLFEGGIO_FREQUENCIES.map(f => (
                <button
                  key={f.freq}
                  onClick={() => setSelectedFreq(selectedFreq === f.freq ? null : f.freq)}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedFreq === f.freq
                      ? "border-violet-500/30 bg-violet-500/10"
                      : "border-border/15 bg-card/20 hover:border-border/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-extralight ${f.color}`}>{f.freq}</span>
                      <div>
                        <p className="text-[11px] font-light text-foreground">{f.label}</p>
                        <p className="text-[9px] text-muted-foreground/50">{f.desc}</p>
                      </div>
                    </div>
                    <Music className={`h-3.5 w-3.5 ${selectedFreq === f.freq ? "text-violet-400 animate-pulse" : "text-muted-foreground/20"}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "geometry" && (
          <div className="space-y-3">
            <p className="text-[10px] text-muted-foreground/60">
              Sacred geometry patterns are automatically applied to optimize structural integrity, energy flow, and consciousness amplification.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {SACRED_GEOMETRIES.map(geo => (
                <div key={geo.name} className="rounded-xl border border-border/15 bg-card/20 p-3.5">
                  <Hexagon className="h-5 w-5 text-violet-400/50 mb-2" />
                  <p className="text-[11px] font-light text-foreground">{geo.name}</p>
                  <p className="text-[9px] text-muted-foreground/50 mb-2">{geo.use}</p>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[10px] text-amber-400">{geo.amplification} amplification</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "quantum" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Atom className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-light text-foreground">Quantum Technologies Research</h3>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-4">
                Advanced quantum technologies in various stages of research and development. These features push the boundaries of physics and consciousness.
              </p>
              <div className="space-y-3">
                {QUANTUM_TECH.map(qt => (
                  <div key={qt.name} className="rounded-lg border border-border/10 bg-card/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-light text-foreground">{qt.name}</span>
                      <span className="text-[9px] text-blue-400">{qt.status}</span>
                    </div>
                    <div className="h-1 rounded-full bg-background/50 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400/60 transition-all" style={{ width: `${qt.progress}%` }} />
                    </div>
                    <p className="text-[8px] text-muted-foreground/30 mt-1">{qt.progress}% complete</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default GodModePanel;