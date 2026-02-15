import heroBg from "@/assets/hero-bg.png";
import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Conversation, ChatMode, DashboardView, Message, Persona } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import type { FeedbackType } from "@/components/dashboard/CalibrationFeedback";
import type { UserProfile } from "@/lib/ai";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ChatView from "@/components/dashboard/ChatView";
import LibraryView from "@/components/dashboard/LibraryView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import MemoryCenterView from "@/components/dashboard/MemoryCenterView";
import StatsView from "@/components/dashboard/StatsView";
import SettingsView from "@/components/dashboard/SettingsView";
import SubscriptionView from "@/components/dashboard/SubscriptionView";
import ZophielEngineView from "@/components/dashboard/ZophielEngineView";
import AshaView from "@/components/dashboard/asha/AshaView";
import CommandPalette from "@/components/dashboard/CommandPalette";
import FocusMode from "@/components/dashboard/FocusMode";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { useToast } from "@/hooks/use-toast";
import { encryptText, decryptText } from "@/lib/encryption";
import { ToastAction } from "@/components/ui/toast";
import { Lock, ArrowRight } from "lucide-react";

const AshaGate = ({ onUpgrade }: { onUpgrade: () => void }) => (
  <div className="flex flex-1 items-center justify-center p-6">
    <div className="max-w-md text-center space-y-6 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-10">
      <Lock className="h-10 w-10 text-accent mx-auto" />
      <h2 className="text-xl font-extralight tracking-wide text-foreground">Asha Intelligence</h2>
      <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
        Asha is the full data intelligence platform — ingest, analyze, branch, and visualize any dataset with AI. It's available exclusively on the <span className="text-accent">ZIALIEL Enterprise</span> plan.
      </p>
      <button
        onClick={onUpgrade}
        className="group inline-flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-6 py-3 text-sm font-light tracking-wide hover:bg-accent/90 transition-all"
      >
        View Enterprise Plan
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tierKey } = useSubscription();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [depth, setDepth] = useState<ResponseDepth>("standard");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [customPersonas, setCustomPersonas] = useState<Persona[]>(() => {
    try {
      const stored = localStorage.getItem("zialiel_custom_personas");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const addCustomPersona = useCallback((persona: Persona) => {
    setCustomPersonas((prev) => {
      const next = [...prev, persona];
      localStorage.setItem("zialiel_custom_personas", JSON.stringify(next));
      return next;
    });
  }, []);

  // CMD+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load conversations and user profile from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [convResult, profileResult, settingsResult] = await Promise.all([
        supabase.from("conversations").select("*").eq("user_id", user.id).eq("archived", false).order("created_at", { ascending: false }),
        supabase.from("user_intelligence_profile").select("*").eq("user_id", user.id).single(),
        supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      ]);

      if (profileResult.data) {
        setUserProfile({
          tone_preference: profileResult.data.tone_preference,
          topics_of_interest: profileResult.data.topics_of_interest,
          inferred_traits: profileResult.data.inferred_traits as Record<string, unknown>,
        });
      }

      if (settingsResult.data?.response_depth) {
        setDepth(settingsResult.data.response_depth as ResponseDepth);
      }

      const convRows = convResult.data;
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
        const convIds = convRows.map((c) => c.id);
        const { data: msgRows } = await supabase
          .from("messages")
          .select("*")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true });

        const msgMap = new Map<string, Message[]>();
        const decryptPromises = (msgRows ?? []).map(async (m) => {
          const decryptedContent = await decryptText(m.content, user.id);
          return { ...m, content: decryptedContent };
        });
        const decryptedMsgs = await Promise.all(decryptPromises);
        decryptedMsgs.forEach((m) => {
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

  const handleDepthChange = useCallback((newDepth: ResponseDepth) => {
    setDepth(newDepth);
    if (user) {
      supabase.from("user_settings").update({ response_depth: newDepth }).eq("user_id", user.id).then();
    }
  }, [user]);

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

  const handleCalibrationFeedback = useCallback(async (messageId: string, feedback: FeedbackType) => {
    if (!user) return;
    await supabase.from("calibration_feedback").insert({ user_id: user.id, message_id: messageId, feedback });
    const { data: profile } = await supabase.from("user_intelligence_profile").select("*").eq("user_id", user.id).single();
    if (profile) {
      const updates: Record<string, any> = { total_calibrations: (profile.total_calibrations ?? 0) + 1 };
      if (feedback === "too_shallow") {
        const depthOrder: ResponseDepth[] = ["shallow", "standard", "deep", "expert"];
        const idx = depthOrder.indexOf(profile.depth_auto as ResponseDepth);
        if (idx < depthOrder.length - 1) updates.depth_auto = depthOrder[idx + 1];
      } else if (feedback === "too_deep") {
        const depthOrder: ResponseDepth[] = ["shallow", "standard", "deep", "expert"];
        const idx = depthOrder.indexOf(profile.depth_auto as ResponseDepth);
        if (idx > 0) updates.depth_auto = depthOrder[idx - 1];
      } else if (feedback === "perfect") {
        updates.tone_preference = "direct";
      }
      await supabase.from("user_intelligence_profile").update(updates).eq("user_id", user.id);
    }
    toast({ title: "Calibrated", description: "Aureon adjusted to your preference." });
  }, [user, toast]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const sendMessage = async (content: string) => {
    if (!user || !activeConvId || isStreaming) return;
    setSuggestions([]);

    const encryptedContent = await encryptText(content, user.id);
    const { data: userMsgRow } = await supabase
      .from("messages")
      .insert({ conversation_id: activeConvId, user_id: user.id, role: "user", content: encryptedContent })
      .select()
      .single();
    if (!userMsgRow) return;

    const userMsg: Message = { id: userMsgRow.id, role: "user", content, timestamp: new Date(userMsgRow.created_at) };
    const isFirst = activeConv?.messages.length === 0;
    if (isFirst) {
      const newTitle = content.slice(0, 50);
      await supabase.from("conversations").update({ title: newTitle }).eq("id", activeConvId);
      setConversations((prev) => prev.map((c) => c.id === activeConvId ? { ...c, title: newTitle, messages: [...c.messages, userMsg] } : c));
    } else {
      setConversations((prev) => prev.map((c) => c.id === activeConvId ? { ...c, messages: [...c.messages, userMsg] } : c));
    }

    trackUsage(mode);
    setIsStreaming(true);
    let assistantContent = "";
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }] }
          : c
      )
    );

    const history = [...(activeConv?.messages ?? []), userMsg].map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Resolve custom persona system prompt
    const activePersona = customPersonas.find((p) => p.id === personaId);
    const personaSystemPrompt = activePersona?.systemPrompt || null;

    try {
      await streamChat({
        messages: history,
        mode,
        personaId,
        personaSystemPrompt,
        depth,
        userProfile,
        signal: controller.signal,
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
          const encryptedAssistant = await encryptText(assistantContent, user.id);
          await supabase.from("messages").insert({
            id: assistantId,
            conversation_id: activeConvId,
            user_id: user.id,
            role: "assistant",
            content: encryptedAssistant,
          });
          const sug = await fetchSuggestions(assistantContent);
          setSuggestions(sug);
        },
      });
    } catch (e: any) {
      setIsStreaming(false);
      if (e.name === "AbortError") {
        // Save partial response
        if (assistantContent) {
          const encryptedPartial = await encryptText(assistantContent, user.id);
          await supabase.from("messages").insert({
            id: assistantId,
            conversation_id: activeConvId,
            user_id: user.id,
            role: "assistant",
            content: encryptedPartial,
          });
        }
        toast({ title: "Stopped", description: "Generation stopped. Partial response saved." });
      } else {
        toast({ title: "AI Error", description: e.message, variant: "destructive" });
      }
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
    const deleted = conversations.find((c) => c.id === id);
    await supabase.from("conversations").update({ archived: true }).eq("id", id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      await newConversation();
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
    // Undo toast
    if (deleted) {
      toast({
        title: "Conversation archived",
        description: deleted.title,
        action: React.createElement(ToastAction, {
          altText: "Undo archive",
          onClick: async () => {
            await supabase.from("conversations").update({ archived: false }).eq("id", id);
            setConversations((prev) => [deleted, ...prev]);
            setActiveConvId(id);
          },
        } as any, "Undo") as any,
      });
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
    await deleteConversation(id); // Uses same logic with undo
  };

  const renderView = () => {
    switch (activeView) {
      case "search": return tierKey === "enterprise" ? <ZophielEngineView /> : <AshaGate onUpgrade={() => setActiveView("subscription")} />;
      case "asha": return tierKey === "enterprise" ? <AshaView /> : <AshaGate onUpgrade={() => setActiveView("subscription")} />;
      case "library": return <LibraryView />;
      case "projects": return <ProjectsView />;
      case "memory": return <MemoryCenterView />;
      case "stats": return <StatsView />;
      case "settings": return <SettingsView />;
      case "subscription": return <SubscriptionView />;
      default: return activeConv ? (
        <ChatView
          conversation={activeConv}
          onSendMessage={sendMessage}
          mode={mode}
          onModeChange={setMode}
          depth={depth}
          onDepthChange={handleDepthChange}
          isStreaming={isStreaming}
          suggestions={suggestions}
          onCalibrationFeedback={handleCalibrationFeedback}
          onStopStreaming={stopStreaming}
          focusMode={focusMode}
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

      <FocusMode active={focusMode} onExit={() => setFocusMode(false)} />

      <div className="relative z-10 flex h-screen">
        {!focusMode && (
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
            customPersonas={customPersonas}
            onAddCustomPersona={addCustomPersona}
          />
        )}

        <main className="flex flex-1 flex-col min-w-0">
          {renderView()}
        </main>
      </div>

      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNewConversation={() => { newConversation(); setCmdPaletteOpen(false); }}
        onViewChange={(v) => { setActiveView(v); setCmdPaletteOpen(false); }}
        onModeChange={(m) => { setMode(m); setCmdPaletteOpen(false); }}
        onFocusMode={() => setFocusMode((f) => !f)}
      />
    </div>
  );
};

export default Dashboard;
