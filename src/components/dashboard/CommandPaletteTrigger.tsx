// Visible front-door pill that prompts users to use the global Command Palette.
// Fires a window event the global CommandPalette listens for.
import { Search } from "lucide-react";

export default function CommandPaletteTrigger() {
  const open = () => window.dispatchEvent(new CustomEvent("aureon-open-command-palette"));
  return (
    <button
      onClick={open}
      title="Open command palette  (/  or  ⌘K)"
      className="group inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 backdrop-blur-md px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card/60 hover:border-border/70 transition-all"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline font-light">What do you want to do?</span>
      <span className="sm:hidden font-light">Find a tool</span>
      <kbd className="hidden sm:inline-block rounded border border-border/40 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/70 ml-1">/</kbd>
    </button>
  );
}
