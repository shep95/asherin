import { Crosshair, ArrowRight, Layers } from "lucide-react";

interface PivotEntity {
  name: string;
  type: string;
  appearances: number;
  sources: number;
  pivot_query: string;
  reason: string;
}

interface NomadPivotSuggestionsProps {
  suggestions: PivotEntity[];
  onPivot: (query: string) => void;
}

const NomadPivotSuggestions = ({ suggestions, onPivot }: NomadPivotSuggestionsProps) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 space-y-2 animate-fade-in">
      <div className="flex items-center gap-1.5 text-[9px] font-extralight tracking-wider text-accent/60 uppercase">
        <Crosshair className="h-3 w-3" />
        Investigation Branches — High-Value Secondary Targets
      </div>
      <div className="space-y-1.5">
        {suggestions.map((entity, idx) => (
          <button
            key={idx}
            onClick={() => onPivot(entity.pivot_query)}
            className="w-full flex items-center justify-between rounded-lg border border-border/15 bg-card/20 hover:bg-card/40 hover:border-accent/20 px-3 py-2 text-left transition-all group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extralight text-foreground truncate">{entity.name}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground/50 font-extralight">{entity.type}</span>
              </div>
              <p className="text-[8px] font-extralight text-muted-foreground/40 mt-0.5 truncate">{entity.reason}</p>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <div className="flex items-center gap-1 text-[8px] font-extralight text-muted-foreground/40">
                <Layers className="h-2.5 w-2.5" />
                {entity.appearances}×
              </div>
              <ArrowRight className="h-3 w-3 text-accent/40 group-hover:text-accent transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NomadPivotSuggestions;
