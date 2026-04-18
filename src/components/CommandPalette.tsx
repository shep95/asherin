// Global Cmd+K Command Palette — keyboard-first navigation
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Search, Folder, Bookmark, Bell, Eye, Network, Calendar,
  FileText, History, Shield, Layers, Users, Settings, Database,
  Image, Code, BookOpen, Brain, Zap, Globe, Sparkles, X
} from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
  keywords?: string[];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items: PaletteItem[] = useMemo(() => [
    // Elite Suite
    { id: "elite", label: "Open Elite Research Suite", icon: <Sparkles className="h-4 w-4" />, action: () => navigate("/elite"), group: "Elite", keywords: ["workspace", "research"] },
    { id: "workspaces", label: "Research Workspaces", icon: <Folder className="h-4 w-4" />, action: () => navigate("/elite?tab=workspaces"), group: "Elite" },
    { id: "saved", label: "Saved Searches & Alerts", icon: <Bell className="h-4 w-4" />, action: () => navigate("/elite?tab=alerts"), group: "Elite" },
    { id: "watchlist", label: "Entity Watchlist", icon: <Eye className="h-4 w-4" />, action: () => navigate("/elite?tab=watchlist"), group: "Elite" },
    { id: "timeline", label: "Timeline View", icon: <Calendar className="h-4 w-4" />, action: () => navigate("/elite?tab=timeline"), group: "Elite" },
    { id: "rooms", label: "Shared Intel Rooms", icon: <Users className="h-4 w-4" />, action: () => navigate("/elite?tab=rooms"), group: "Elite" },
    { id: "sources", label: "Custom Source Lists", icon: <Layers className="h-4 w-4" />, action: () => navigate("/elite?tab=sources"), group: "Elite" },
    { id: "history", label: "Search History & Replay", icon: <History className="h-4 w-4" />, action: () => navigate("/elite?tab=history"), group: "Elite" },
    { id: "audit", label: "Chain of Custody Audit Log", hint: "Forensic trail", icon: <Shield className="h-4 w-4" />, action: () => navigate("/elite?tab=audit"), group: "Elite" },
    { id: "annotations", label: "My Annotations", icon: <Bookmark className="h-4 w-4" />, action: () => navigate("/elite?tab=annotations"), group: "Elite" },

    // Navigation
    { id: "dashboard", label: "Dashboard", icon: <Database className="h-4 w-4" />, action: () => navigate("/dashboard"), group: "Navigate" },
    { id: "search", label: "Zophiel Search", icon: <Search className="h-4 w-4" />, action: () => navigate("/zophiel"), group: "Navigate" },
    { id: "whiteboard", label: "Whiteboard", icon: <Image className="h-4 w-4" />, action: () => navigate("/whiteboard"), group: "Navigate" },
    { id: "ide", label: "Aureon IDE", icon: <Code className="h-4 w-4" />, action: () => navigate("/feature/ide"), group: "Navigate" },
    { id: "notebooks", label: "Intelligence Notebooks", icon: <BookOpen className="h-4 w-4" />, action: () => navigate("/feature/notebooks"), group: "Navigate" },
    { id: "brains", label: "Brains", icon: <Brain className="h-4 w-4" />, action: () => navigate("/feature/brains"), group: "Navigate" },
    { id: "library", label: "Library", icon: <FileText className="h-4 w-4" />, action: () => navigate("/feature/library"), group: "Navigate" },
    { id: "nomad", label: "NOMAD Investigation", icon: <Globe className="h-4 w-4" />, action: () => navigate("/feature/nomad"), group: "Navigate" },
    { id: "azplen", label: "Azplen Foundry", icon: <Zap className="h-4 w-4" />, action: () => navigate("/feature/azplen"), group: "Navigate" },
    { id: "agents", label: "Automated Agents", icon: <Network className="h-4 w-4" />, action: () => navigate("/feature/automated-agents"), group: "Navigate" },
    { id: "pricing", label: "Pricing", icon: <Settings className="h-4 w-4" />, action: () => navigate("/pricing"), group: "Navigate" },
  ], [navigate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-background/80 backdrop-blur-sm pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="bg-card text-foreground">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search commands, navigate, run actions..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:inline-block rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-muted"
              aria-label="Close palette"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No commands match "{query}"
            </Command.Empty>
            {["Elite", "Navigate"].map((g) => (
              <Command.Group key={g} heading={g} className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                {items.filter((i) => i.group === g).map((i) => (
                  <Command.Item
                    key={i.id}
                    value={`${i.label} ${i.keywords?.join(" ") ?? ""}`}
                    onSelect={() => { i.action(); setOpen(false); }}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-muted"
                  >
                    <span className="text-muted-foreground">{i.icon}</span>
                    <span className="flex-1">{i.label}</span>
                    {i.hint && <span className="text-xs text-muted-foreground">{i.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Press <kbd className="rounded border border-border px-1">↑↓</kbd> navigate <kbd className="rounded border border-border px-1 ml-1">↵</kbd> select</span>
            <span><kbd className="rounded border border-border px-1">⌘K</kbd> toggle</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
