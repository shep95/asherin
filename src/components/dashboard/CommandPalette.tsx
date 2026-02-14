import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, MessageSquare, Code, FlaskConical, Shield, FolderOpen, Layers, Brain, BarChart3, Settings, Moon, Sun, Type, Focus, FileDown } from "lucide-react";
import type { ChatMode, DashboardView } from "./types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onViewChange: (view: DashboardView) => void;
  onModeChange: (mode: ChatMode) => void;
  onFocusMode?: () => void;
}

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

const CommandPalette = ({ open, onClose, onNewConversation, onViewChange, onModeChange, onFocusMode }: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "new", label: "New Conversation", category: "Actions", icon: Plus, action: () => { onNewConversation(); onClose(); }, keywords: ["create", "start"] },
    { id: "chat-mode", label: "Switch to Chat Mode", category: "Modes", icon: MessageSquare, action: () => { onModeChange("chat"); onClose(); } },
    { id: "code-mode", label: "Switch to Code Mode", category: "Modes", icon: Code, action: () => { onModeChange("code"); onClose(); } },
    { id: "research-mode", label: "Switch to Research Mode", category: "Modes", icon: FlaskConical, action: () => { onModeChange("research"); onClose(); } },
    { id: "truth-mode", label: "Switch to Truth Mode", category: "Modes", icon: Shield, action: () => { onModeChange("truth"); onClose(); } },
    { id: "library", label: "Open Library", category: "Navigation", icon: FolderOpen, action: () => { onViewChange("library"); onClose(); } },
    { id: "projects", label: "Open Projects", category: "Navigation", icon: Layers, action: () => { onViewChange("projects"); onClose(); } },
    { id: "memory", label: "Open Memory Center", category: "Navigation", icon: Brain, action: () => { onViewChange("memory"); onClose(); } },
    { id: "stats", label: "Open Stats", category: "Navigation", icon: BarChart3, action: () => { onViewChange("stats"); onClose(); } },
    { id: "settings", label: "Open Settings", category: "Navigation", icon: Settings, action: () => { onViewChange("settings"); onClose(); } },
    { id: "focus", label: "Toggle Focus Mode", category: "Actions", icon: Focus, action: () => { onFocusMode?.(); onClose(); }, keywords: ["distraction", "zen"] },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords?.some((k) => k.includes(query.toLowerCase()))
      )
    : commands;

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    (acc[cmd.category] ??= []).push(cmd);
    return acc;
  }, {});

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => setSelectedIdx(0), [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[selectedIdx]) { filtered[selectedIdx].action(); }
    else if (e.key === "Escape") { onClose(); }
  }, [filtered, selectedIdx, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
          <Search className="h-4 w-4 text-muted-foreground/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-border/30 bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {Object.entries(grouped).map(([cat, cmds]) => (
            <div key={cat} className="mb-2">
              <p className="px-3 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">{cat}</p>
              {cmds.map((cmd) => {
                const globalIdx = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light transition-colors ${
                      globalIdx === selectedIdx ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <cmd.icon className="h-4 w-4 shrink-0" />
                    {cmd.label}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm font-light text-muted-foreground/50">No commands found</p>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border/20 px-4 py-2 text-[10px] text-muted-foreground/40">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
