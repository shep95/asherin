import { useEffect, useState } from "react";
import { Command } from "lucide-react";

/**
 * Floating ⌘K hint pinned to bottom-right.
 * Listens for ⌘K / Ctrl+K and dispatches a window event so any palette host can pick it up.
 */
const CommandPaletteHint = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("aureon:open-command-palette"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("aureon:open-command-palette"))}
      className="fixed bottom-4 right-4 z-40 hidden md:inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/70 backdrop-blur-xl px-3 py-2 text-[10px] tracking-[0.2em] uppercase text-muted-foreground/80 hover:text-foreground hover:bg-card/90 transition-all shadow-lg animate-fade-in"
      aria-label="Open command palette"
    >
      <Command className="h-3 w-3" />
      <kbd className="rounded border border-border/40 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono tracking-wider">
        ⌘K
      </kbd>
      <span className="text-foreground/70">Quick jump</span>
    </button>
  );
};

export default CommandPaletteHint;
