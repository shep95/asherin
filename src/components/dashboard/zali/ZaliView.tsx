import { useState } from "react";
import ZaliThreeView from "./ZaliThreeView";
import ZaliChatPanel from "./ZaliChatPanel";
import ZaliResearchPanel from "./ZaliResearchPanel";
import { Save, Share2, Settings, Download } from "lucide-react";

const ZaliView = () => {
  const [viewMode, setViewMode] = useState("assembly"); // assembly, atomic, biological

  return (
    <div className="flex flex-col h-full bg-[#050505] text-foreground overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-border/20 flex items-center justify-between px-4 bg-card/10 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
            <span className="text-xs font-bold text-black">Z</span>
          </div>
          <h1 className="text-sm font-bold tracking-[0.2em] text-foreground">ZALI <span className="text-muted-foreground font-light normal-case tracking-normal">| Universal Design Lab</span></h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Save className="h-4 w-4" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-border/20 mx-1" />
          <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: 3D Viewport (70%) */}
        <div className="flex-1 relative p-4 flex flex-col gap-4">
          <div className="flex-1 relative min-h-0">
            <ZaliThreeView mode={viewMode} />
          </div>
          
          {/* Bottom Control Bar */}
          <div className="h-12 bg-card/20 backdrop-blur-md rounded-xl border border-border/20 flex items-center px-4 gap-4 shrink-0">
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-mono hover:bg-accent/20 transition-colors">RESET VIEW</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground text-xs font-mono hover:bg-white/10 transition-colors">EXPLODE</button>
              <button className="px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground text-xs font-mono hover:bg-white/10 transition-colors">X-RAY</button>
            </div>
            <div className="flex-1" />
            <div className="text-[10px] font-mono text-muted-foreground">
              SIMULATION: <span className="text-emerald-500">RUNNING</span>
            </div>
          </div>
        </div>

        {/* Right: Panels (30%) */}
        <div className="w-[400px] flex flex-col border-l border-border/20 shrink-0">
          <div className="flex-1 min-h-0">
            <ZaliChatPanel onModeChange={setViewMode} />
          </div>
          <div className="h-[250px] shrink-0">
            <ZaliResearchPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZaliView;
