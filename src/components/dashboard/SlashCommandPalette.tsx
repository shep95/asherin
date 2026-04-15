import { useState, useEffect, useRef } from "react";
import { getCommandSuggestions, COMMAND_CATEGORY_COLORS, type SlashCommand } from "@/lib/slashCommands";
import {
  BarChart3, Calculator, TrendingUp, FileText, Shield, Radar, User,
  CandlestickChart, Layers, Bug, Eye, Microscope, FileBarChart,
  Scale, Lock, Dna, Stethoscope, Database, LayoutDashboard, Search, Target
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, Calculator, TrendingUp, FileText, Shield, Radar, User,
  CandlestickChart, Layers, Bug, Eye, Microscope, FileBarChart,
  Scale, Lock, Dna, Stethoscope, Database, LayoutDashboard, Search, Target,
};

interface Props {
  input: string;
  onSelect: (command: SlashCommand) => void;
  visible: boolean;
}

const SlashCommandPalette = ({ input, onSelect, visible }: Props) => {
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !input.startsWith("/")) {
      setSuggestions([]);
      return;
    }
    const results = getCommandSuggestions(input);
    setSuggestions(results);
    setSelectedIdx(0);
  }, [input, visible]);

  useEffect(() => {
    if (!visible || suggestions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (suggestions[selectedIdx]) {
          e.preventDefault();
          onSelect(suggestions[selectedIdx]);
        }
      } else if (e.key === "Escape") {
        setSuggestions([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [visible, suggestions, selectedIdx, onSelect]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-card/95 backdrop-blur-xl border border-border/30 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in"
    >
      <div className="px-3 py-1.5 border-b border-border/15">
        <span className="text-[9px] font-extralight text-muted-foreground/50 uppercase tracking-widest">
          Commands
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {suggestions.map((cmd, idx) => {
          const Icon = ICON_MAP[cmd.icon] || Search;
          const catColor = COMMAND_CATEGORY_COLORS[cmd.category] || "text-muted-foreground";
          return (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                idx === selectedIdx ? "bg-foreground/10" : "hover:bg-foreground/5"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${catColor} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground">{cmd.command}</span>
                  <span className="text-[10px] font-light text-muted-foreground">{cmd.label}</span>
                </div>
                <p className="text-[9px] font-extralight text-muted-foreground/60 truncate">
                  {cmd.description}
                </p>
              </div>
              <span className={`text-[8px] font-extralight uppercase tracking-wider ${catColor}`}>
                {cmd.category}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-1 border-t border-border/15 flex items-center gap-3">
        <span className="text-[8px] text-muted-foreground/40">↑↓ Navigate</span>
        <span className="text-[8px] text-muted-foreground/40">↵ Select</span>
        <span className="text-[8px] text-muted-foreground/40">ESC Close</span>
      </div>
    </div>
  );
};

export default SlashCommandPalette;
