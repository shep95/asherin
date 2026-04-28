import { Construction } from "lucide-react";

interface Props { title: string; sub?: string; }

const ComingSoonModule = ({ title, sub }: Props) => (
  <div className="flex h-full w-full items-center justify-center bg-background">
    <div className="text-center max-w-md px-6">
      <Construction className="h-8 w-8 text-muted-foreground/40 mx-auto mb-6" strokeWidth={1.25} />
      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase mb-3">Asher Module</p>
      <h2 className="text-3xl font-extralight tracking-wide text-foreground mb-3">{title}</h2>
      {sub && <p className="text-sm font-extralight text-muted-foreground/70">{sub}</p>}
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/60 backdrop-blur-md px-4 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">Coming Soon</span>
      </div>
    </div>
  </div>
);

export default ComingSoonModule;
