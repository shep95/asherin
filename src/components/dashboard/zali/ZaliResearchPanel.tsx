import { Activity, Microscope, Scale, Zap } from "lucide-react";

const ZaliResearchPanel = () => {
  return (
    <div className="h-full bg-card/20 backdrop-blur-xl border-t border-border/20 flex flex-col">
      <div className="p-3 border-b border-border/20 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-muted-foreground tracking-wider">ACTIVE RESEARCH</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-500">LIVE</span>
        </div>
      </div>
      
      <div className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-accent text-xs font-bold">
            <Microscope className="h-3 w-3" />
            DOMAINS
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>PHYSICS</span>
              <span className="text-foreground">87%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-accent w-[87%]" />
            </div>
            
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>BIOLOGY</span>
              <span className="text-foreground">94%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[94%]" />
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>ECONOMICS</span>
              <span className="text-foreground">62%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 w-[62%]" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-accent text-xs font-bold">
            <Activity className="h-3 w-3" />
            FINDINGS
          </div>
          <div className="space-y-2">
            <div className="p-2 rounded bg-white/5 border border-white/5 text-[10px] text-muted-foreground">
              <span className="text-accent block mb-1">OPTICAL LIMIT</span>
              Diffraction limit at 5mm aperture = 0.134 mrad
            </div>
            <div className="p-2 rounded bg-white/5 border border-white/5 text-[10px] text-muted-foreground">
              <span className="text-emerald-500 block mb-1">BIOMIMICRY</span>
              Rhodopsin QE: 67% vs Silicon: 95%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZaliResearchPanel;
