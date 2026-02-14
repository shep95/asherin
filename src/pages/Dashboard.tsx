import heroBg from "@/assets/hero-bg.png";
import { useState, useEffect, useCallback } from "react";
import type { Conversation, ChatMode, DashboardView, Message } from "@/components/dashboard/types";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ChatView from "@/components/dashboard/ChatView";
import LibraryView from "@/components/dashboard/LibraryView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import MemoryCenterView from "@/components/dashboard/MemoryCenterView";
import StatsView from "@/components/dashboard/StatsView";
import SettingsView from "@/components/dashboard/SettingsView";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load conversations from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: convRows } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (!convRows || convRows.length === 0) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: "New conversation", mode: "chat" })
          .select()
          .single();
        if (newConv) {
          setConversations([{ id: newConv.id, title: newConv.title, messages: [], createdAt: new Date(newConv.created_at), pinned: newConv.pinned, mode: newConv.mode as ChatMode }]);
          setActiveConvId(newConv.id);
        }
      } else {
        // Load messages for all conversations
        const convIds = convRows.map((c) => c.id);
        const { data: msgRows } = await supabase
          .from("messages")
          .select("*")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true });

        const msgMap = new Map<string, Message[]>();
        (msgRows ?? []).forEach((m) => {
          const list = msgMap.get(m.conversation_id) ?? [];
          list.push({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
            truthScore: m.truth_score as "high" | "medium" | "low" | undefined,
            sources: (m.sources as { title: string; url: string }[]) ?? [],
          });
          msgMap.set(m.conversation_id, list);
        });

        const convs: Conversation[] = convRows.map((c) => ({
          id: c.id,
          title: c.title,
          messages: msgMap.get(c.id) ?? [],
          createdAt: new Date(c.created_at),
          pinned: c.pinned,
          mode: c.mode as ChatMode,
          projectId: c.project_id ?? undefined,
        }));

        setConversations(convs);
        setActiveConvId(convs[0]?.id ?? null);
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? conversations[0];

  // Track usage
  const trackUsage = useCallback(async (modeUsed: ChatMode) => {
    if (!user) return;
    const modeCol = `${modeUsed}_prompts`;
    const { data: stats } = await supabase.from("usage_stats").select("*").eq("user_id", user.id).single();
    if (stats) {
      const today = new Date().toISOString().split("T")[0];
      const streakDays = stats.last_active_date === today ? stats.streak_days : 
        (stats.last_active_date === new Date(Date.now() - 86400000).toISOString().split("T")[0] ? stats.streak_days + 1 : 1);
      
      const update: Record<string, any> = {
        total_prompts: (stats.total_prompts ?? 0) + 1,
        streak_days: streakDays,
        last_active_date: today,
      };
      update[modeCol] = ((stats as any)[modeCol] ?? 0) + 1;
      
      await supabase.from("usage_stats").update(update).eq("user_id", user.id);
    }
  }, [user]);

  const sendMessage = async (content: string) => {
    if (!user || !activeConvId || isStreaming) return;
    setSuggestions([]);

    // Save user message to DB
    const { data: userMsgRow } = await supabase
      .from("messages")
      .insert({ conversation_id: activeConvId, user_id: user.id, role: "user", content })
      .select()
      .single();

    if (!userMsgRow) return;

    const userMsg: Message = {
      id: userMsgRow.id, role: "user", content, timestamp: new Date(userMsgRow.created_at),
    };

    // Update title if first message
    const isFirst = activeConv?.messages.length === 0;
    if (isFirst) {
      const newTitle = content.slice(0, 50);
      await supabase.from("conversations").update({ title: newTitle }).eq("id", activeConvId);
      setConversations((prev) =>
        prev.map((c) => c.id === activeConvId ? { ...c, title: newTitle, messages: [...c.messages, userMsg] } : c)
      );
    } else {
      setConversations((prev) =>
        prev.map((c) => c.id === activeConvId ? { ...c, messages: [...c.messages, userMsg] } : c)
      );
    }

    // Track usage
    trackUsage(mode);

    // Stream AI response
    setIsStreaming(true);
    let assistantContent = "";
    const assistantId = crypto.randomUUID();

    // Add empty assistant message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }] }
          : c
      )
    );

    const history = [...(activeConv?.messages ?? []), userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      await streamChat({
        messages: history,
        mode,
        personaId,
        onDelta: (chunk) => {
          assistantContent += chunk;
          const current = assistantContent;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId
                ? { ...c, messages: c.messages.map((m) => m.id === assistantId ? { ...m, content: current } : m) }
                : c
            )
          );
        },
        onDone: async () => {
          setIsStreaming(false);

          // Save assistant message to DB
          await supabase.from("messages").insert({
            id: assistantId,
            conversation_id: activeConvId,
            user_id: user.id,
            role: "assistant",
            content: assistantContent,
          });

          // Fetch follow-up suggestions
          const sug = await fetchSuggestions(assistantContent);
          setSuggestions(sug);
        },
      });
    } catch (e: any) {
      setIsStreaming(false);
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    }
  };

  const newConversation = async () => {
    if (!user) return;
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New conversation", mode })
      .select()
      .single();
    if (newConv) {
      const conv: Conversation = {
        id: newConv.id, title: newConv.title, messages: [],
        createdAt: new Date(newConv.created_at), pinned: newConv.pinned,
        mode: newConv.mode as ChatMode,
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(newConv.id);
      setActiveView("chat");
      setSidebarOpen(false);
      setSuggestions([]);
    }
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      await newConversation();
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
  };

  const togglePin = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const newPinned = !conv.pinned;
    await supabase.from("conversations").update({ pinned: newPinned }).eq("id", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, pinned: newPinned } : c));
  };

  const archiveConversation = async (id: string) => {
    await supabase.from("conversations").update({ archived: true }).eq("id", id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      await newConversation();
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "library": return <LibraryView />;
      case "projects": return <ProjectsView />;
      case "memory": return <MemoryCenterView />;
      case "stats": return <StatsView />;
      case "settings": return <SettingsView />;
      default: return activeConv ? (
        <ChatView
          conversation={activeConv}
          onSendMessage={sendMessage}
          mode={mode}
          onModeChange={setMode}
          isStreaming={isStreaming}
          suggestions={suggestions}
        />
      ) : null;
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">ZIALIEL</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="fixed inset-0 bg-background/80" />

      <div className="relative z-10 flex h-screen">
        <DashboardSidebar
          conversations={conversations}
          activeConversationId={activeConvId ?? ""}
          activeView={activeView}
          onSelectConversation={(id) => { setActiveConvId(id); setSuggestions([]); }}
          onNewConversation={newConversation}
          onDeleteConversation={deleteConversation}
          onArchiveConversation={archiveConversation}
          onTogglePin={togglePin}
          onViewChange={setActiveView}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          personaId={personaId}
          onPersonaChange={setPersonaId}
        />

        <main className="flex flex-1 flex-col min-w-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
