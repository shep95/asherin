import { Shield } from "lucide-react";

const ZerlalView = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-border/[0.06] px-6 py-4 flex items-center gap-3 backdrop-blur-md bg-background/40">
        <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center">
          <Shield className="h-4 w-4 text-foreground/60" />
        </div>
        <div>
          <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">ZERLAL</h1>
          <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">Cyber Security Intelligence</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-foreground/[0.03] border border-border/[0.08] flex items-center justify-center">
            <Shield className="h-7 w-7 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-light text-foreground/50">Zerlal — Coming Soon</p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">Cyber security intelligence powered by AUREON</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZerlalView;
