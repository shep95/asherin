import { useState } from "react";
import { Puzzle, Search, CheckCircle2, AlertTriangle, Clock, DollarSign, Star, Layers, ArrowRight, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const COMPONENTS = [
  { id: "c1", name: "Servo Controller Board v2.1", type: "electrical", reused: 47, success: 96, cost: 89, leadDays: 2, supplier: "Digi-Key", compatible: ["c2", "c3"], description: "6-channel servo driver with PWM output" },
  { id: "c2", name: "Emergency Stop Circuit (OSHA)", type: "safety", reused: 112, success: 100, cost: 34, leadDays: 1, supplier: "McMaster-Carr", compatible: ["c1"], description: "Industrial-rated E-stop with mechanical lockout" },
  { id: "c3", name: "Warehouse Gripper v3.2", type: "mechanical", reused: 23, success: 91, cost: 43, leadDays: 3, supplier: "3D Printable", compatible: ["c1"], description: "Handles boxes 5–50cm, 3D printable (STL available)" },
  { id: "c4", name: "BMS Module (4S LiPo)", type: "electrical", reused: 67, success: 94, cost: 12, leadDays: 2, supplier: "AliExpress", compatible: [], description: "Battery management for 4-cell lithium packs" },
  { id: "c5", name: "IMU Sensor Fusion (MPU6050)", type: "sensor", reused: 89, success: 88, cost: 7, leadDays: 1, supplier: "Digi-Key", compatible: ["c1", "c4"], description: "6-axis accelerometer + gyroscope with I2C" },
  { id: "c6", name: "Thermal Paste + Spring Mount Kit", type: "thermal", reused: 34, success: 98, cost: 15, leadDays: 2, supplier: "McMaster-Carr", compatible: [], description: "CPU/heat-pipe thermal contact optimization" },
  { id: "c7", name: "Waterproof Enclosure IP67", type: "mechanical", reused: 56, success: 95, cost: 28, leadDays: 3, supplier: "Bud Industries", compatible: ["c4", "c5"], description: "UV-resistant outdoor-rated enclosure" },
  { id: "c8", name: "ESP32-S3 Dev Module", type: "microcontroller", reused: 145, success: 92, cost: 9, leadDays: 1, supplier: "Digi-Key", compatible: ["c4", "c5"], description: "WiFi + BLE with dual-core 240 MHz" },
];

const COMPATIBILITY_ISSUES = [
  { compA: "High-freq PWM Motor Controller", compB: "Analog Sensor Array", issue: "PWM noise corrupts analog readings at 20kHz", fix: "Add ferrite bead filter ($4)", fixCost: 4 },
  { compA: "3.3V Logic MCU", compB: "5V Relay Module", issue: "Logic level mismatch", fix: "Add level shifter ($2)", fixCost: 2 },
];

const ComponentLibraryPanel = () => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"browse" | "compatibility" | "stats">("browse");
  const [typeFilter, setTypeFilter] = useState("all");

  const types = ["all", ...new Set(COMPONENTS.map(c => c.type))];
  const filtered = COMPONENTS.filter(c =>
    (typeFilter === "all" || c.type === typeFilter) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalTimeSaved = COMPONENTS.reduce((s, c) => s + c.reused * 4, 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Component Reuse Library</h2>
          </div>
          <span className="text-[9px] text-muted-foreground/50">{COMPONENTS.length} proven components · ~{totalTimeSaved.toLocaleString()} hrs saved</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(["browse", "compatibility", "stats"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors capitalize ${tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}
            >{t}</button>
          ))}
        </div>

        {tab === "browse" && (
          <>
            {/* Search + Filter */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components..." className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-2 text-[10px] text-foreground font-light outline-none capitalize">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Components */}
            <div className="grid gap-2.5">
              {filtered.map(comp => (
                <div key={comp.id} className="rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm p-4 hover:border-border/30 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-[11px] font-light text-foreground">{comp.name}</h3>
                      <p className="text-[9px] text-muted-foreground/50">{comp.description}</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md border ${comp.success >= 95 ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : comp.success >= 85 ? "border-amber-500/20 text-amber-400 bg-amber-500/5" : "border-red-500/20 text-red-400 bg-red-500/5"}`}>
                      {comp.success}% reliable
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-3">
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Reused</p>
                      <p className="text-[11px] text-foreground">{comp.reused}x</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Cost</p>
                      <p className="text-[11px] text-foreground">${comp.cost}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Lead</p>
                      <p className="text-[11px] text-foreground">{comp.leadDays}d</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Type</p>
                      <p className="text-[11px] text-foreground capitalize">{comp.type}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Supplier</p>
                      <p className="text-[11px] text-foreground truncate">{comp.supplier}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "compatibility" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-light text-foreground">Known Compatibility Issues</h3>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mb-4">ZALI automatically detects when selected components have known conflicts.</p>
              <div className="space-y-3">
                {COMPATIBILITY_ISSUES.map((iss, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/15 bg-card/30 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-foreground">{iss.compA}</span>
                      <span className="text-[9px] text-muted-foreground/30">×</span>
                      <span className="text-[10px] text-foreground">{iss.compB}</span>
                    </div>
                    <p className="text-[9px] text-amber-400/80 mb-2">⚠️ {iss.issue}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-emerald-400/80">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{iss.fix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Components", value: COMPONENTS.length.toString(), icon: Package, color: "text-cyan-400" },
              { label: "Total Reuses", value: COMPONENTS.reduce((s, c) => s + c.reused, 0).toLocaleString(), icon: Layers, color: "text-accent" },
              { label: "Avg Reliability", value: (COMPONENTS.reduce((s, c) => s + c.success, 0) / COMPONENTS.length).toFixed(1) + "%", icon: Star, color: "text-emerald-400" },
              { label: "Hours Saved", value: "~" + totalTimeSaved.toLocaleString(), icon: Clock, color: "text-amber-400" },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border/15 bg-card/20 p-4">
                <stat.icon className={`h-4 w-4 ${stat.color} mb-2`} />
                <p className="text-lg font-extralight text-foreground">{stat.value}</p>
                <p className="text-[9px] text-muted-foreground/50">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ComponentLibraryPanel;