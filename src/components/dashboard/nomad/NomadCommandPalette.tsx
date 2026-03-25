import { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare, Search, Layers, Map, Network, Clock,
  Crosshair, Shield, Fingerprint, TrendingUp, Eye, Video,
  GitBranch, Sparkles, FileText, User, StickyNote,
} from "lucide-react";

type NomadTab = string;

interface NomadCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSwitchTab: (tab: NomadTab) => void;
  onAction: (action: string) => void;
  entities: { type: string; value: string }[];
}

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  action: () => void;
}

const NomadCommandPalette = ({ open, onClose, onSwitchTab, onAction, entities }: NomadCommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const tabs: Command[] = [
      { id: "tab-chat", label: "Intel Chat", category: "Navigate", icon: MessageSquare, action: () => onSwitchTab("chat") },
      { id: "tab-entities", label: "Entities", category: "Navigate", icon: User, action: () => onSwitchTab("entities") },
      { id: "tab-graph", label: "Graph Analysis", category: "Navigate", icon: Network, action: () => onSwitchTab("graph") },
      { id: "tab-map", label: "Map Layer", category: "Navigate", icon: Map, action: () => onSwitchTab("map") },
      { id: "tab-timeline", label: "Timeline", category: "Navigate", icon: Clock, action: () => onSwitchTab("timeline") },
      { id: "tab-objects", label: "Objects", category: "Navigate", icon: Layers, action: () => onSwitchTab("objects") },
      { id: "tab-sources", label: "Sources", category: "Navigate", icon: Shield, action: () => onSwitchTab("sources") },
      { id: "tab-handles", label: "Handle Hunter", category: "Navigate", icon: Fingerprint, action: () => onSwitchTab("handles") },
      { id: "tab-adversary", label: "Adversary", category: "Navigate", icon: Crosshair, action: () => onSwitchTab("adversary") },
      { id: "tab-predictive", label: "Predictive Intel", category: "Navigate", icon: TrendingUp, action: () => onSwitchTab("predictive") },
      { id: "tab-imagine", label: "Imagine Intel", category: "Navigate", icon: Eye, action: () => onSwitchTab("imagine") },
      { id: "tab-video", label: "Video Intel", category: "Navigate", icon: Video, action: () => onSwitchTab("video-intel") },
    ];

    const actions: Command[] = [
      { id: "act-export", label: "Export Dossier", category: "Actions", icon: FileText, action: () => onAction("export") },
      { id: "act-search", label: "Search Messages", category: "Actions", icon: Search, action: () => onAction("search") },
      { id: "act-notepad", label: "Toggle Notepad", category: "Actions", icon: StickyNote, action: () => onAction("notepad") },
      { id: "act-history", label: "Investigation History", category: "Actions", icon: Clock, action: () => onAction("history") },
    ];

    const entityCmds: Command[] = entities.slice(0, 8).map(e => ({
      id: `entity-${e.type}-${e.value}`,
      label: `${e.value}`,
      category: `Entity: ${e.type}`,
      icon: Crosshair,
      action: () => onAction(`investigate:${e.value}`),
    }));

    return [...actions, ...tabs, ...entityCmds];
  }, [onSwitchTab, onAction, entities]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  const execute = (cmd: Command) => {
    cmd.action();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[selectedIndex]) { execute(filtered[selectedIndex]); }
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/15">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, tabs, entities…"
            className="flex-1 bg-transparent text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          <kbd className="text-[9px] font-extralight text-muted-foreground/50 border border-border/20 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs font-extralight text-muted-foreground py-8">No results</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => execute(cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? "bg-accent/10" : "hover:bg-foreground/5"
                }`}
              >
                <cmd.icon className={`h-3.5 w-3.5 ${i === selectedIndex ? "text-accent" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-light truncate ${i === selectedIndex ? "text-foreground" : "text-muted-foreground"}`}>{cmd.label}</p>
                </div>
                <span className="text-[9px] font-extralight text-muted-foreground/40 shrink-0">{cmd.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NomadCommandPalette;
