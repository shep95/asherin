import heroBg from "@/assets/hero-bg.png";
import { useState, useEffect } from "react";
import type { Conversation, ChatMode, DashboardView, Message } from "@/components/dashboard/types";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ChatView from "@/components/dashboard/ChatView";
import LibraryView from "@/components/dashboard/LibraryView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import MemoryCenterView from "@/components/dashboard/MemoryCenterView";
import StatsView from "@/components/dashboard/StatsView";
import SettingsView from "@/components/dashboard/SettingsView";
import { saveConversationsOffline, loadConversationsOffline } from "@/components/dashboard/offlineStorage";

const Dashboard = () => {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const offline = loadConversationsOffline();
    return offline ?? [{ id: "1", title: "New conversation", messages: [], createdAt: new Date() }];
  });
  const [activeConvId, setActiveConvId] = useState("1");
  const [activeView, setActiveView] = useState<DashboardView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");

  // Persist conversations to localStorage for offline access
  useEffect(() => {
    saveConversationsOffline(conversations);
  }, [conversations]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0];

  const sendMessage = (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content, timestamp: new Date(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, title: c.messages.length === 0 ? content.slice(0, 40) : c.title, messages: [...c.messages, userMsg] }
          : c
      )
    );

    setTimeout(() => {
      const scores: ("high" | "medium" | "low")[] = ["high", "medium", "low"];
      const assistantMsg: Message = {
        id: crypto.randomUUID(), role: "assistant",
        content: "This is a placeholder response. Connect to your AI backend to enable real conversations.",
        timestamp: new Date(),
        truthScore: scores[Math.floor(Math.random() * 3)],
        sources: mode === "research" ? [
          { title: "Example Source", url: "https://example.com" },
          { title: "Research Paper", url: "https://arxiv.org" },
        ] : [],
      };
      setConversations((prev) =>
        prev.map((c) => c.id === activeConvId ? { ...c, messages: [...c.messages, assistantMsg] } : c)
      );
    }, 800);
  };

  const newConversation = () => {
    const conv: Conversation = { id: crypto.randomUUID(), title: "New conversation", messages: [], createdAt: new Date() };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    setActiveView("chat");
    setSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const fresh: Conversation = { id: crypto.randomUUID(), title: "New conversation", messages: [], createdAt: new Date() };
      setConversations([fresh]);
      setActiveConvId(fresh.id);
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
  };

  const togglePin = (id: string) => {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, pinned: !c.pinned } : c));
  };

  const archiveConversation = (id: string) => {
    // For now, archive behaves like delete but could be moved to an archive list later
    deleteConversation(id);
  };

  const renderView = () => {
    switch (activeView) {
      case "library": return <LibraryView />;
      case "projects": return <ProjectsView />;
      case "memory": return <MemoryCenterView />;
      case "stats": return <StatsView />;
      case "settings": return <SettingsView />;
      default: return (
        <ChatView
          conversation={activeConv}
          onSendMessage={sendMessage}
          mode={mode}
          onModeChange={setMode}
        />
      );
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="fixed inset-0 bg-background/80" />

      <div className="relative z-10 flex h-screen">
        <DashboardSidebar
          conversations={conversations}
          activeConversationId={activeConvId}
          activeView={activeView}
          onSelectConversation={setActiveConvId}
          onNewConversation={newConversation}
          onDeleteConversation={deleteConversation}
          onArchiveConversation={archiveConversation}
          onTogglePin={togglePin}
          onViewChange={setActiveView}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex flex-1 flex-col min-w-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
