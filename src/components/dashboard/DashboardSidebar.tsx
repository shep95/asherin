import { useState, createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  Plus, Search, LogOut, Zap,
  FolderOpen, Layers, Brain, BarChart3, Settings, X, Menu, CreditCard, ShieldCheck, Database, Download, MessageSquare, ChevronDown,
} from "lucide-react";
import type { Conversation, DashboardView } from "./types";
import PersonaSelector from "./PersonaSelector";
import SwipeableConversationItem from "./SwipeableConversationItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePwaInstall } from "@/hooks/use-pwa-install";

// Sidebar context for shared state
interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useSidebarContext = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarContext must be used within DashboardSidebar");
  return ctx;
};

interface DashboardSidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  activeView: DashboardView;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onArchiveConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onViewChange: (view: DashboardView) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  personaId?: string | null;
  onPersonaChange?: (id: string | null) => void;
}

const allNavItems: { id: DashboardView; icon: React.ElementType; label: string; enterprise?: boolean }[] = [
  { id: "search", icon: Zap, label: "Zophiel Engine", enterprise: true },
  { id: "asha", icon: Database, label: "Asha Intelligence", enterprise: true },
  { id: "library", icon: FolderOpen, label: "Library" },
  { id: "projects", icon: Layers, label: "Projects" },
  { id: "memory", icon: Brain, label: "Memory Center" },
  { id: "stats", icon: BarChart3, label: "My Stats" },
  { id: "subscription", icon: CreditCard, label: "Subscription" },
  { id: "settings", icon: Settings, label: "Settings" },
];

function groupByDate(convs: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  const month = new Date(today); month.setDate(today.getDate() - 30);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 Days", items: [] },
    { label: "Last 30 Days", items: [] },
    { label: "Older", items: [] },
  ];

  convs.forEach((c) => {
    if (c.pinned) { groups[0].items.push(c); return; }
    const d = new Date(c.createdAt);
    if (d >= today) groups[1].items.push(c);
    else if (d >= yesterday) groups[2].items.push(c);
    else if (d >= week) groups[3].items.push(c);
    else if (d >= month) groups[4].items.push(c);
    else groups[5].items.push(c);
  });

  return groups.filter((g) => g.items.length > 0);
}

const DashboardSidebar = ({
  conversations, activeConversationId, activeView, onSelectConversation,
  onNewConversation, onDeleteConversation, onArchiveConversation, onTogglePin, onViewChange,
  sidebarOpen, onToggleSidebar, personaId: externalPersonaId, onPersonaChange,
}: DashboardSidebarProps) => {
  const { tierKey } = useSubscription();
  const [search, setSearch] = useState("");
  const [showConvos, setShowConvos] = useState(false);
  const personaId = externalPersonaId ?? null;
  const setPersonaId = onPersonaChange ?? (() => {});
  const navItems = allNavItems.filter((item) => !item.enterprise || tierKey === "enterprise");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );
  const groups = groupByDate(filtered);

  const contextValue: SidebarContextValue = {
    isOpen: sidebarOpen,
    toggle: onToggleSidebar,
    activeView,
    setActiveView: onViewChange,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* Mobile toggle */}
      <button
        onClick={onToggleSidebar}
        className="fixed top-4 left-4 z-50 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5 lg:hidden"
      >
        {sidebarOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-background/50 lg:hidden" onClick={onToggleSidebar} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col m-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/20">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extralight tracking-[0.25em] text-foreground">ZIALIEL</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onNewConversation}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Past Convos Toggle */}
          <div className="flex-shrink-0 px-2 pt-3">
            <button
              onClick={() => setShowConvos(!showConvos)}
              className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                showConvos
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4" />
                Past Convos
              </div>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showConvos ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showConvos && (
            <>
              {/* Search */}
              <div className="flex-shrink-0 px-3 pt-2">
                <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search conversations…"
                    className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                </div>
              </div>

              {/* Scrollable conversation list */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-3">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="px-3 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
                        {group.label === "Pinned" ? "📌 Pinned" : group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((conv) => (
                          <SwipeableConversationItem
                            key={conv.id}
                            conv={conv}
                            isActive={activeView === "chat" && conv.id === activeConversationId}
                            onSelect={() => {
                              onSelectConversation(conv.id);
                              onViewChange("chat");
                              onToggleSidebar();
                            }}
                            onTogglePin={() => onTogglePin(conv.id)}
                            onDelete={() => onDeleteConversation(conv.id)}
                            onArchive={() => onArchiveConversation(conv.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Personas */}
          <div className="flex-shrink-0 px-2 py-2 border-t border-border/20">
            <PersonaSelector activeId={personaId} onSelect={setPersonaId} />
          </div>

          {/* Navigation */}
          <div className="flex-shrink-0 px-2 py-2 border-t border-border/20 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onViewChange(item.id); onToggleSidebar(); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                  activeView === item.id
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-shrink-0 p-3 pb-5 border-t border-border/20 space-y-1">
            <InstallBtn />
            <LogoutBtn />
          </div>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
};

const InstallBtn = () => {
  const { canInstall, install } = usePwaInstall();
  if (!canInstall) return null;
  return (
    <button onClick={install} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-light text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
      <Download className="h-4 w-4" />
      Download App
    </button>
  );
};

const LogoutBtn = () => {
  const { signOut } = useAuth();
  return (
    <button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-light text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );
};

export default DashboardSidebar;
