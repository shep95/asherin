import { useState, useEffect, useRef } from "react";
import { Search, Command } from "lucide-react";

interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

const IdeCommandPalette = ({ open, onClose, actions }: Props) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const filtered = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

  const execute = (action: CommandAction) => {
    action.action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-[90vw] max-w-md bg-card border border-border/30 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
          <Command className="h-4 w-4 text-accent/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) execute(filtered[0]);
            }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm font-light text-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground/40">No commands found</div>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                onClick={() => execute(a)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-light text-foreground hover:bg-accent/10 transition-colors"
              >
                <span>{a.label}</span>
                {a.shortcut && (
                  <span className="text-[10px] text-muted-foreground/40 bg-muted/20 rounded px-1.5 py-0.5">{a.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeCommandPalette;
