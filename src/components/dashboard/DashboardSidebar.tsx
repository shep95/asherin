import { ADMIN_EMAIL } from "@/lib/adminEmail";
import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, hasSearchAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { tierHasFeature, VIEW_FEATURE_MAP } from "@/config/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Search, LogOut, Zap,
  FolderOpen, Layers, Brain, BarChart3, Settings, X, Menu, CreditCard, ShieldCheck, Database, Download, MessageSquare, ChevronDown, Crosshair, Newspaper, Code2, Users, FileText, Globe, Puzzle, Activity, ClipboardList, Archive, ArchiveRestore, Trash2 as Trash2Icon, Pencil, MessagesSquare, Terminal, Sparkles, Lock as LockIcon, Shield, Moon, Workflow,
} from "lucide-react";
import type { Conversation, DashboardView, Persona, ChatMode, Message } from "./types";
import PersonaSelector from "./PersonaSelector";
import SwipeableConversationItem from "./SwipeableConversationItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useToast } from "@/hooks/use-toast";
import { decryptText } from "@/lib/encryption";
import NotificationInbox from "./NotificationInbox";

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
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  onViewChange: (view: DashboardView) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  personaId?: string | null;
  onPersonaChange?: (id: string | null) => void;
  customPersonas?: Persona[];
  onAddCustomPersona?: (persona: Persona) => void;
  onEditCustomPersona?: (persona: Persona) => void;
  onDeleteCustomPersona?: (id: string) => void;
  publishedAgents?: { id: string; name: string }[];
}

type NavItem = { id: DashboardView; icon: React.ElementType; label: string; access?: "search" | "pro" };
interface SubGroup { label: string; items: NavItem[] }
interface NavGroup { label: string; subgroups: SubGroup[] }

const subscriptionNavItem: NavItem = { id: "subscription", icon: CreditCard, label: "Subscription" };

const navGroups: NavGroup[] = [
  {
    label: "Intelligence",
    subgroups: [
      {
        label: "Research",
        items: [
          { id: "search", icon: Zap, label: "Zophiel Engine", access: "search" },
          { id: "briefing", icon: Newspaper, label: "Intel Briefings" },
          { id: "nomad", icon: Crosshair, label: "NOMAD Agent" },
        ],
      },
      {
        label: "Vision & Agents",
        items: [
          { id: "video-intelligence", icon: Crosshair, label: "Video Intelligence", access: "pro" },
          { id: "reverse-engineer" as DashboardView, icon: Search, label: "Reverse Engineer", access: "search" },
          { id: "zahten" as DashboardView, icon: Workflow, label: "Zahten Agent Forge" },
        ],
      },
    ],
  },
  {
    label: "Data & Analysis",
    subgroups: [
      {
        label: "Platforms",
        items: [
          { id: "azplen", icon: Database, label: "Azplen Intelligence", access: "pro" },
          { id: "pattern-analysis", icon: Activity, label: "Pattern Engine", access: "pro" },
          { id: "cross" as DashboardView, icon: Crosshair, label: "Cross", access: "pro" },
        ],
      },
      {
        label: "Specialized Engines",
        items: [
          { id: "zeeion" as DashboardView, icon: Database, label: "Zeeion FI", access: "pro" },
          { id: "axrlen" as DashboardView, icon: Brain, label: "Axrlen", access: "pro" },
          { id: "zerlal" as DashboardView, icon: Shield, label: "Zerlal", access: "pro" },
        ],
      },
      {
        label: "Analysis Tools",
        items: [
          { id: "timeseries", icon: Activity, label: "Time-Series", access: "pro" },
          { id: "geospatial", icon: Globe, label: "Geospatial", access: "pro" },
          { id: "notebooks", icon: FileText, label: "Notebooks", access: "pro" },
        ],
      },
    ],
  },
  {
    label: "Creation",
    subgroups: [
      {
        label: "Design & Code",
        items: [
          { id: "zali", icon: Zap, label: "ZANOEM Design Lab" },
          { id: "ide", icon: Terminal, label: "AUREON IDE" },
          { id: "imagine-to-code", icon: Code2, label: "Imagine To Code" },
          { id: "snippets", icon: Code2, label: "Code Snippets" },
          { id: "projects", icon: Layers, label: "Projects" },
        ],
      },
      {
        label: "Media Generation",
        items: [
          { id: "vibe-imager" as DashboardView, icon: Sparkles, label: "Vibe Imager" },
          { id: "pdf-generator", icon: FileText, label: "PDF Generator" },
          { id: "ebook" as DashboardView, icon: FileText, label: "E-Book Generator" },
          { id: "slideshow", icon: Layers, label: "Slideshow Generator", access: "search" },
        ],
      },
      {
        label: "Utilities",
        items: [
          { id: "file-scrapper" as DashboardView, icon: FileText, label: "File Scrapper", access: "search" },
          { id: "cipher" as DashboardView, icon: Shield, label: "Cipher Toolkit", access: "search" },
        ],
      },
    ],
  },
  {
    label: "Workspace",
    subgroups: [
      {
        label: "Collaboration",
        items: [
          { id: "teams", icon: Users, label: "Team Workspace", access: "pro" },
          { id: "community", icon: MessagesSquare, label: "Community", access: "pro" },
        ],
      },
      {
        label: "Personal",
        items: [
          { id: "persona-store", icon: Sparkles, label: "Persona Store" },
          { id: "library", icon: FolderOpen, label: "Library" },
          { id: "memory", icon: Brain, label: "Memory Center" },
        ],
      },
    ],
  },
  {
    label: "System",
    subgroups: [
      {
        label: "Security & Operations",
        items: [
          { id: "agents" as DashboardView, icon: Zap, label: "Agents", access: "pro" },
          { id: "security", icon: ShieldCheck, label: "Security Center", access: "pro" },
          { id: "guardian-vault" as DashboardView, icon: LockIcon, label: "Guardian Vault" },
          { id: "plugins", icon: Puzzle, label: "Plugins", access: "pro" },
          { id: "audit", icon: ClipboardList, label: "Audit Trail", access: "pro" },
        ],
      },
      {
        label: "Account",
        items: [
          { id: "self-access", icon: FileText, label: "Self-Access Learning" },
          { id: "bug-reports" as DashboardView, icon: ClipboardList, label: "Bug Reports" },
          { id: "stats", icon: BarChart3, label: "My Stats" },
          { id: "vedic-astrology" as DashboardView, icon: Moon, label: "Vedic Astrology" },
          { id: "settings", icon: Settings, label: "Settings" },
        ],
      },
    ],
  },

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
  onNewConversation, onDeleteConversation, onArchiveConversation, onRenameConversation, onTogglePin, onViewChange,
  sidebarOpen, onToggleSidebar, personaId: externalPersonaId, onPersonaChange,
  customPersonas, onAddCustomPersona, onEditCustomPersona, onDeleteCustomPersona, publishedAgents = [],
}: DashboardSidebarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tierKey } = useSubscription();
  const [search, setSearch] = useState("");
  const [showConvos, setShowConvos] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedConvos, setArchivedConvos] = useState<Conversation[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const personaId = externalPersonaId ?? null;
  const setPersonaId = onPersonaChange ?? (() => {});
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navGroups.forEach((g, i) => { init[g.label] = i < 2; });
    return init;
  });

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const itemAllowed = (item: NavItem) => {
    if (item.id === "security") return user?.email === ADMIN_EMAIL;
    if (item.id === "self-access") return user?.email === ADMIN_EMAIL;
    if (item.id === "ebook") return user?.email === ADMIN_EMAIL;
    const featureId = VIEW_FEATURE_MAP[item.id];
    if (featureId) {
      return tierHasFeature(tierKey, featureId) || user?.email === ADMIN_EMAIL;
    }
    if (user?.email === ADMIN_EMAIL) return true;
    if (!item.access) return true;
    if (item.access === "search") return hasSearchAccess(tierKey);
    if (item.access === "pro") return hasProAccess(tierKey);
    return true;
  };

  const filteredGroups = navGroups.map(group => ({
    ...group,
    subgroups: group.subgroups
      .map(sg => ({ ...sg, items: sg.items.filter(itemAllowed) }))
      .filter(sg => sg.items.length > 0),
  })).filter(group => group.subgroups.length > 0);

  // Append Zahten-published agents as a dynamic nav group (mirrors Asher Dashboard).
  const dynamicGroups: NavGroup[] = publishedAgents.length
    ? [{
        label: "Deployed Agents",
        subgroups: [{
          label: "Zahten",
          items: publishedAgents.map((a) => ({
            id: `agent:${a.id}` as DashboardView,
            icon: Workflow,
            label: a.name,
          })),
        }],
      }]
    : [];
  const allGroups = [...filteredGroups, ...dynamicGroups];

  // Load archived conversations
  const loadArchived = useCallback(async () => {
    if (!user) return;
    setArchivedLoading(true);
    const { data: convRows } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", true)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (convRows) {
      const convs: Conversation[] = convRows.map((c) => ({
        id: c.id,
        title: c.title,
        messages: [],
        createdAt: new Date(c.created_at),
        pinned: c.pinned,
        mode: c.mode as ChatMode,
      }));
      setArchivedConvos(convs);
    }
    setArchivedLoading(false);
  }, [user]);

  useEffect(() => {
    if (showArchived) loadArchived();
  }, [showArchived, loadArchived]);

  const unarchiveConversation = async (id: string) => {
    await supabase.from("conversations").update({ archived: false }).eq("id", id);
    setArchivedConvos((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Conversation restored" });
    // Trigger reload by navigating
    window.location.reload();
  };

  const permanentlyDeleteArchived = async (id: string) => {
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    setArchivedConvos((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Conversation permanently deleted" });
  };

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const MIN_WIDTH = 220;
  const MAX_WIDTH = 480;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = localStorage.getItem("aureon_sidebar_width");
      return stored ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(stored))) : 288;
    } catch { return 288; }
  });
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("aureon_sidebar_width", String(sidebarWidth));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("aureon_sidebar_width", String(sidebarWidth));
  }, [sidebarWidth]);

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
      <button
        onClick={onToggleSidebar}
        className={`fixed top-4 z-50 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5 lg:hidden transition-all duration-300 ease-out ${
          sidebarOpen ? "left-4 right-auto" : "left-auto right-4"
        }`}
      >
        {sidebarOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
      </button>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-background/50 lg:hidden" onClick={onToggleSidebar} />
      )}

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:relative lg:translate-x-0 flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col m-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden">
          <div onMouseDown={handleMouseDown} className="hidden lg:block absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-50 group">
            <div className="absolute inset-y-0 right-0 w-0.5 bg-border/0 group-hover:bg-foreground/20 transition-colors rounded-full" />
          </div>
          
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/20">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extralight tracking-[0.25em] text-foreground">AUREON</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
            </div>
            <div className="flex items-center gap-1">
              <NotificationInbox onNavigate={(v) => { onViewChange(v as DashboardView); onToggleSidebar(); }} />
              <button onClick={onNewConversation} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground" title="New conversation">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col">
              <div className="flex-shrink-0 px-2 pt-3">
                <button
                  onClick={() => setShowConvos(!showConvos)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                    showConvos ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
                  <div className="flex-shrink-0 px-3 pt-2">
                    <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
                    </div>
                  </div>

                  <div className="p-2 space-y-3">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="px-3 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">
                          {group.label === "Pinned" ? "◆ Pinned" : group.label}
                        </p>
                        <div className="space-y-0.5">
                          {group.items.map((conv) => (
                            editingId === conv.id ? (
                              <div key={conv.id} className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-foreground/10">
                                <input
                                  autoFocus
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditingId(null); setEditTitle(""); } }}
                                  className="flex-1 bg-transparent text-xs font-light text-foreground outline-none border-b border-foreground/30"
                                />
                              </div>
                            ) : (
                              <SwipeableConversationItem
                                key={conv.id}
                                conv={conv}
                                isActive={activeView === "chat" && conv.id === activeConversationId}
                                onSelect={() => { onSelectConversation(conv.id); onViewChange("chat"); onToggleSidebar(); }}
                                onTogglePin={() => onTogglePin(conv.id)}
                                onDelete={() => onDeleteConversation(conv.id)}
                                onArchive={() => onArchiveConversation(conv.id)}
                                onRename={() => startRename(conv)}
                              />
                            )
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Archived Convos Toggle */}
                  <div className="px-2 pb-2">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                        showArchived ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Archive className="h-4 w-4" />
                        Archived
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showArchived ? "rotate-180" : ""}`} />
                    </button>

                    {showArchived && (
                      <div className="mt-1 space-y-0.5">
                        {archivedLoading ? (
                          <p className="px-3 py-2 text-[10px] text-muted-foreground animate-pulse">Loading…</p>
                        ) : archivedConvos.length === 0 ? (
                          <p className="px-3 py-2 text-[10px] text-muted-foreground/50">No archived conversations.</p>
                        ) : (
                          archivedConvos.map((conv) => (
                            <div key={conv.id} className="group flex items-center gap-2 rounded-xl px-3 py-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors">
                              <Archive className="h-3.5 w-3.5 shrink-0 opacity-50" />
                              <span className="flex-1 truncate text-xs font-light">{conv.title}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => unarchiveConversation(conv.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title="Restore"
                                >
                                  <ArchiveRestore className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => permanentlyDeleteArchived(conv.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete permanently"
                                >
                                  <Trash2Icon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="px-2 py-2 border-t border-border/20">
                <PersonaSelector activeId={personaId} onSelect={setPersonaId} customPersonas={customPersonas} onAddCustomPersona={onAddCustomPersona} onEditCustomPersona={onEditCustomPersona} onDeleteCustomPersona={onDeleteCustomPersona} />
              </div>

              <div data-dashboard-sidebar-nav className="px-2 py-2 border-t border-border/20 space-y-1">
                {itemAllowed(subscriptionNavItem) && (
                  <button
                    onClick={() => { onViewChange(subscriptionNavItem.id); onToggleSidebar(); }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                      activeView === subscriptionNavItem.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <subscriptionNavItem.icon className="h-4 w-4" />
                    {subscriptionNavItem.label}
                  </button>
                )}

                {allGroups.map((group) => {
                  const isOpen = expandedGroups[group.label] ?? false;
                  const hasActive = group.subgroups.some(sg => sg.items.some(item => activeView === item.id));

                  return (
                    <div key={group.label}>
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] uppercase transition-colors ${
                          hasActive ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                        }`}
                      >
                        {group.label}
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="mt-0.5 mb-1 space-y-1 pl-2 border-l border-border/15 ml-3">
                          {group.subgroups.map((sg) => {
                            const sgKey = `${group.label}::${sg.label}`;
                            const sgOpen = expandedGroups[sgKey] ?? false;
                            const sgHasActive = sg.items.some(item => activeView === item.id);
                            return (
                              <div key={sg.label}>
                                <button
                                  onClick={() => toggleGroup(sgKey)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1 text-[9px] font-light tracking-[0.18em] uppercase transition-colors ${
                                    sgHasActive ? "text-foreground/80" : "text-muted-foreground/40 hover:text-muted-foreground/70"
                                  }`}
                                >
                                  {sg.label}
                                  <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${sgOpen ? "rotate-180" : ""}`} />
                                </button>
                                {sgOpen && (
                                  <div className="space-y-0.5 mt-0.5 mb-1">
                                    {sg.items.map((item) => (
                                      <button
                                        key={item.id}
                                        onClick={() => { onViewChange(item.id); onToggleSidebar(); }}
                                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-light transition-colors ${
                                          activeView === item.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                        }`}
                                      >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-3 pb-5 border-t border-border/20 space-y-1">
                <InstallBtn />
                <LogoutBtn />
              </div>
            </div>
          </ScrollArea>
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
