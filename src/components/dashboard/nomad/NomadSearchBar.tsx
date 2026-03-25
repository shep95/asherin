import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface NomadSearchBarProps {
  messages: { id: string; role: string; content: string }[];
  onScrollToMessage: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

const NomadSearchBar = ({ messages, onScrollToMessage, open, onClose }: NomadSearchBarProps) => {
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return messages
      .filter(m => m.content.toLowerCase().includes(q))
      .map(m => m.id);
  }, [query, messages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery("");
      setCurrentIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (matches.length > 0 && matches[currentIndex]) {
      onScrollToMessage(matches[currentIndex]);
    }
  }, [currentIndex, matches, onScrollToMessage]);

  const navigate = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    setCurrentIndex(prev => (prev + dir + matches.length) % matches.length);
  };

  if (!open) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/15 bg-card/20 backdrop-blur-md animate-fade-in">
      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setCurrentIndex(0); }}
        onKeyDown={e => {
          if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") onClose();
        }}
        placeholder="Search investigation messages…"
        className="flex-1 bg-transparent text-xs font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none"
      />
      {query && (
        <span className="text-[10px] font-extralight text-muted-foreground shrink-0">
          {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : "No matches"}
        </span>
      )}
      <div className="flex items-center gap-0.5">
        <button onClick={() => navigate(-1)} disabled={matches.length === 0} className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button onClick={() => navigate(1)} disabled={matches.length === 0} className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default NomadSearchBar;
