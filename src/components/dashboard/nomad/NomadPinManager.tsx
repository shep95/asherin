import { Pin, X } from "lucide-react";

interface NomadPinManagerProps {
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  messages: { id: string; role: string; content: string }[];
}

const NomadPinManager = ({ pinnedIds, onTogglePin, messages }: NomadPinManagerProps) => {
  const pinned = messages.filter(m => pinnedIds.has(m.id) && m.role === "assistant");
  if (pinned.length === 0) return null;

  return (
    <div className="border-b border-border/15 bg-accent/5 px-4 py-2">
      <div className="flex items-center gap-1.5 text-[9px] font-extralight tracking-wider text-accent/60 uppercase mb-1.5">
        <Pin className="h-3 w-3" />
        Pinned Findings ({pinned.length})
      </div>
      <div className="space-y-1">
        {pinned.map(m => (
          <div key={m.id} className="flex items-start gap-2 group">
            <p className="text-[10px] font-extralight text-foreground/70 leading-relaxed flex-1 truncate">
              {m.content.slice(0, 120)}…
            </p>
            <button
              onClick={() => onTogglePin(m.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NomadPinManager;
