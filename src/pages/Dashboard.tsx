import heroBgDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";

const WALLPAPER_MAP: Record<string, string> = {
  default: heroBgDefault,
  raven: wallpaperRaven,
  eclipse: wallpaperEclipse,
  glitch: wallpaperGlitch,
};
import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Conversation, ChatMode, DashboardView, Message, Persona, FileAttachment } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import type { FeedbackType } from "@/components/dashboard/CalibrationFeedback";
import type { UserProfile } from "@/lib/ai";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ChatView from "@/components/dashboard/ChatView";
import LibraryView from "@/components/dashboard/LibraryView";
import CodeSnippetsView from "@/components/dashboard/CodeSnippetsView";
import ProjectsView from "@/components/dashboard/ProjectsView";
import MemoryCenterView from "@/components/dashboard/MemoryCenterView";
import StatsView from "@/components/dashboard/StatsView";
import SettingsView from "@/components/dashboard/SettingsView";
import SubscriptionView from "@/components/dashboard/SubscriptionView";
import ZophielEngineView from "@/components/dashboard/ZophielEngineView";
import AshaView from "@/components/dashboard/asha/AshaView";
import ZaliView from "@/components/dashboard/zali/ZaliView";
import CommunityView from "@/components/dashboard/zali/CommunityView";
import NomadView from "@/components/dashboard/NomadView";
import BriefingView from "@/components/dashboard/BriefingView";
import TeamsView from "@/components/dashboard/TeamsView";
import NotebooksView from "@/components/dashboard/NotebooksView";
import GeospatialView from "@/components/dashboard/GeospatialView";
import PluginMarketplaceView from "@/components/dashboard/PluginMarketplaceView";
import TimeSeriesView from "@/components/dashboard/TimeSeriesView";
import AuditLogView from "@/components/dashboard/AuditLogView";
import PredictiveIntelligenceView from "@/components/dashboard/PredictiveIntelligenceView";
import ElionView from "@/components/dashboard/ElionView";
import SecurityDashboardView from "@/components/dashboard/SecurityDashboardView";
import ImagineToCodeView from "@/components/dashboard/ImagineToCodeView";
import TrackerView from "@/components/dashboard/TrackerView";
import PersonaStoreView from "@/components/dashboard/PersonaStoreView";
import GoogleIntelligenceView from "@/components/dashboard/google/GoogleIntelligenceView";
import AureonIdeView from "@/components/dashboard/ide/AureonIdeView";
import PdfGeneratorView from "@/components/dashboard/PdfGeneratorView";
import PatternAnalysisView from "@/components/dashboard/PatternAnalysisView";
import CommandPalette from "@/components/dashboard/CommandPalette";
import FocusMode from "@/components/dashboard/FocusMode";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, hasSearchAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { builtInPersonas } from "@/components/dashboard/PersonaSelector";
import { useToast } from "@/hooks/use-toast";
import { encryptText, decryptText } from "@/lib/encryption";
import { ToastAction } from "@/components/ui/toast";
import { pushNotification } from "@/components/dashboard/NotificationInbox";
import { Lock, ArrowRight, WifiOff } from "lucide-react";
import {
  enqueueMessage,
  updateMessageStatus,
  removeMessage,
  getPendingMessages,
  getRetryDelay,
  registerBackgroundSync,
  onOnline,
  isOnline,
  type QueuedMessage,
  type MessageStatus,
} from "@/lib/messageQueue";

const FeatureGate = ({ title, description, onUpgrade }: { title: string; description: string; onUpgrade: () => void }) => (
  <div className="flex flex-1 items-center justify-center p-6">
    <div className="max-w-md text-center space-y-6 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-10">
      <Lock className="h-10 w-10 text-accent mx-auto" />
      <h2 className="text-xl font-extralight tracking-wide text-foreground">{title}</h2>
      <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{description}</p>
      <button
        onClick={onUpgrade}
        className="group inline-flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-6 py-3 text-sm font-light tracking-wide hover:bg-accent/90 transition-all"
      >
        View Plans
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
  const conversationsRef = useRef<Conversation[]>([]);
  const attachmentMapRef = useRef<Map<string, FileAttachment[]>>(new Map());
  const [online, setOnline] = useState(navigator.onLine);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});
  const processingQueue = useRef(false);
  const pendingQueue = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const [queueItems, setQueueItems] = useState<{ id: string; content: string }[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const queuePausedRef = useRef(false);
  const [customPersonas, setCustomPersonas] = useState<Persona[]>(() => {
    try {
      const oldStored = localStorage.getItem("zialiel_custom_personas");
      const newStored = localStorage.getItem("aureon_custom_personas");
      if (oldStored && !newStored) {
        localStorage.setItem("aureon_custom_personas", oldStored);
        localStorage.removeItem("zialiel_custom_personas");
        return JSON.parse(oldStored);
      }
      return newStored ? JSON.parse(newStored) : [];
    } catch { return []; }
  });
  const [wallpaperKey, setWallpaperKey] = useState(() => {
    try { return localStorage.getItem("aureon_wallpaper") || "default"; } catch { return "default"; }
  });
  const activeWallpaper = WALLPAPER_MAP[wallpaperKey] || WALLPAPER_MAP.default;

  useEffect(() => {
    const handler = () => setWallpaperKey(localStorage.getItem("aureon_wallpaper") || "default");
    window.addEventListener("storage", handler);
    window.addEventListener("aureon-wallpaper-change", handler);
    return () => { window.removeEventListener("storage", handler); window.removeEventListener("aureon-wallpaper-change", handler); };
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast({ title: "Back online", description: "Sending queued messages…" });
      processMessageQueue();
    };
    const handleOffline = () => {
      setOnline(false);
      toast({ title: "You're offline", description: "Messages will be queued and sent when you reconnect.", variant: "destructive" });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Service Worker message handler
    const swHandler = (event: MessageEvent) => {
      if (event.data?.type === "PROCESS_QUEUE") {
        processMessageQueue();
      }
    };
    navigator.serviceWorker?.addEventListener("message", swHandler);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", swHandler);
    };
  }, []);

  // Process queued messages — actually persist to DB and trigger AI
  const processMessageQueue = useCallback(async () => {
    if (processingQueue.current || !user) return;
    processingQueue.current = true;
    try {
      const pending = await getPendingMessages();
      for (const msg of pending.sort((a, b) => a.createdAt - b.createdAt)) {
        if (!navigator.onLine) break;
        if (msg.retryCount >= msg.maxRetries) {
          await updateMessageStatus(msg.id, "failed");
          setMessageStatuses(prev => ({ ...prev, [msg.id]: "failed" }));
          continue;
        }
        try {
          await updateMessageStatus(msg.id, "sending");
          setMessageStatuses(prev => ({ ...prev, [msg.id]: "sending" }));

          // Actually persist the user message to DB
          const encryptedContent = await encryptText(msg.content, user.id);
          const { data: savedMsg } = await supabase
            .from("messages")
            .insert({ conversation_id: msg.conversationId, user_id: user.id, role: "user", content: encryptedContent })
            .select()
            .single();

          if (savedMsg) {
            // Update the optimistic message with the real DB id
            setConversations(prev => prev.map(c =>
              c.id === msg.conversationId
                ? { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, id: savedMsg.id } : m) }
                : c
            ));
          }

          await removeMessage(msg.id);
          setMessageStatuses(prev => ({ ...prev, [msg.id]: "sent" }));

          // Trigger AI response for this queued message
          const conv = conversationsRef.current.find(c => c.id === msg.conversationId);
          if (conv) {
            const assistantId = crypto.randomUUID();
            setConversations(prev => prev.map(c =>
              c.id === msg.conversationId
                ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }] }
                : c
            ));
            setIsStreaming(true);
            let assistantContent = "";
            const history = [...conv.messages, { role: "user" as const, content: msg.content }]
              .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

            const activePersona = customPersonas.find(p => p.id === personaId) || builtInPersonas.find(p => p.id === personaId);
            try {
              await streamChat({
                messages: history,
                mode,
                personaId,
                personaSystemPrompt: activePersona?.systemPrompt || null,
                depth,
                userProfile,
                onDelta: (chunk) => {
                  assistantContent += chunk;
                  const current = assistantContent;
                  setConversations(prev => prev.map(c =>
                    c.id === msg.conversationId
                      ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content: current } : m) }
                      : c
                  ));
                },
                onDone: async () => {
                  setIsStreaming(false);
                  const encAssistant = await encryptText(assistantContent, user.id);
                  await supabase.from("messages").insert({
                    id: assistantId, conversation_id: msg.conversationId,
                    user_id: user.id, role: "assistant", content: encAssistant,
                  });
                  pushNotification({
                    title: "Queued response ready",
                    message: assistantContent.slice(0, 80) + (assistantContent.length > 80 ? "…" : ""),
                    type: "success",
                    actionLabel: "View",
                    actionView: "chat",
                  });
                },
              });
            } catch {
              setIsStreaming(false);
            }
          }
        } catch {
          const delay = getRetryDelay(msg.retryCount);
          await updateMessageStatus(msg.id, "retrying");
          setMessageStatuses(prev => ({ ...prev, [msg.id]: "retrying" }));
          await new Promise(r => setTimeout(r, delay));
        }
      }
    } finally {
      processingQueue.current = false;
    }
  }, [user, conversations, customPersonas, personaId, mode, depth, userProfile]);

  // customPersonas declared above processMessageQueue

  const addCustomPersona = useCallback((persona: Persona) => {
    setCustomPersonas((prev) => {
      const next = [...prev, persona];
      localStorage.setItem("aureon_custom_personas", JSON.stringify(next));
      return next;
    });
  }, []);

  const editCustomPersona = useCallback((persona: Persona) => {
    setCustomPersonas((prev) => {
      const next = prev.map(p => p.id === persona.id ? persona : p);
      localStorage.setItem("aureon_custom_personas", JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteCustomPersona = useCallback((id: string) => {
    setCustomPersonas((prev) => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem("aureon_custom_personas", JSON.stringify(next));
      return next;
    });
    if (personaId === id) setPersonaId(null);
  }, [personaId]);

  // Sync custom personas to localStorage on every change (safety net)
  useEffect(() => {
    localStorage.setItem("aureon_custom_personas", JSON.stringify(customPersonas));
  }, [customPersonas]);

  // Listen for persona changes from store installs
  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem("aureon_custom_personas");
        if (stored) setCustomPersonas(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener("aureon-personas-change", handler);
    return () => window.removeEventListener("aureon-personas-change", handler);
  }, []);

  // CMD+K and CMD+1-4 global shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") { e.preventDefault(); setMode("chat"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") { e.preventDefault(); setMode("code"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "3") { e.preventDefault(); setMode("research"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "4") { e.preventDefault(); setMode("truth"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for navigation events from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent).detail as DashboardView;
      if (view) setActiveView(view);
    };
    window.addEventListener("aureon:navigate", handler);
    return () => window.removeEventListener("aureon:navigate", handler);
  }, []);

  // Load conversations and user profile from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [convResult, profileResult, settingsResult] = await Promise.all([
        supabase.from("conversations").select("*").eq("user_id", user.id).eq("archived", false).order("created_at", { ascending: false }),
        supabase.from("user_intelligence_profile").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
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

      // Restore wallpaper from DB (source of truth)
      if (settingsResult.data?.wallpaper) {
        const dbWallpaper = settingsResult.data.wallpaper as string;
        setWallpaperKey(dbWallpaper);
        localStorage.setItem("aureon_wallpaper", dbWallpaper);
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

  // Keep ref in sync so sendMessageCore always reads latest conversations
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

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
    const { data: profile } = await supabase.from("user_intelligence_profile").select("*").eq("user_id", user.id).maybeSingle();
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

  // Core send logic (called sequentially by queue processor)
  const sendMessageCore = async (content: string, convId: string, attachments?: FileAttachment[]) => {
    if (!user) return;
    setSuggestions([]);

    // Auto-suggest persona based on task content
    if (!personaId) {
      const lower = content.toLowerCase();
      const TASK_PERSONA_MAP: { keywords: string[]; personaId: string; label: string }[] = [
        { keywords: ["review code", "debug", "refactor", "fix bug", "code audit", "codebase", "architecture"], personaId: "codeforge", label: "The Code Forge" },
        { keywords: ["ui", "design", "layout", "css", "responsive", "component", "animation", "pixel"], personaId: "uiforge", label: "The UI Forge" },
        { keywords: ["research", "sources", "study", "paper", "academic", "citation", "literature"], personaId: "researcher", label: "The Researcher" },
        { keywords: ["strategy", "plan", "roadmap", "decision", "pros and cons", "trade-off", "long-term"], personaId: "strategist", label: "The Strategist" },
        { keywords: ["analyze", "data", "metrics", "numbers", "statistics", "trend", "forecast"], personaId: "analyst", label: "The Analyst" },
        { keywords: ["write", "blog", "article", "copy", "email", "story", "tone", "voice"], personaId: "writer", label: "The Writer" },
        { keywords: ["truth", "uncensored", "honest", "direct", "raw", "no filter"], personaId: "truth", label: "The Truth Engine" },
        { keywords: ["code", "function", "api", "implement", "build", "develop", "script", "python", "typescript", "react"], personaId: "engineer", label: "The Engineer" },
      ];
      const match = TASK_PERSONA_MAP.find(m => m.keywords.some(k => lower.includes(k)));
      if (match) {
        toast({
          title: `Persona suggestion: ${match.label}`,
          description: "Aureon detected a task that matches this persona.",
          action: React.createElement(ToastAction, {
            altText: "Switch persona",
            onClick: () => setPersonaId(match.personaId),
          } as any, "Switch") as any,
          duration: 6000,
        });
      }
    }

    const tempMsgId = crypto.randomUUID();
    const conv = conversationsRef.current.find(c => c.id === convId);
    const userMsg: Message = { id: tempMsgId, role: "user", content, timestamp: new Date(), attachments };
    const isFirst = conv?.messages.length === 0;
    if (isFirst) {
      const newTitle = content.slice(0, 50);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: newTitle, messages: [...c.messages, userMsg] } : c));
      supabase.from("conversations").update({ title: newTitle }).eq("id", convId).then();
    } else {
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, messages: [...c.messages, userMsg] } : c));
    }

    setMessageStatuses(prev => ({ ...prev, [tempMsgId]: "sending" }));
    await enqueueMessage({ id: tempMsgId, conversationId: convId, content, role: "user" }).catch(() => {});

    if (!navigator.onLine) {
      setMessageStatuses(prev => ({ ...prev, [tempMsgId]: "queued" }));
      registerBackgroundSync().catch(() => {});
      toast({ title: "Message queued", description: "Will send automatically when you're back online." });
      return;
    }

    try {
      const encryptedContent = await encryptText(content, user.id);
      const { data: userMsgRow } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, user_id: user.id, role: "user", content: encryptedContent })
        .select()
        .single();

      if (userMsgRow) {
        setConversations((prev) => prev.map((c) => c.id === convId
          ? { ...c, messages: c.messages.map(m => m.id === tempMsgId ? { ...m, id: userMsgRow.id } : m) }
          : c
        ));
      }

      setMessageStatuses(prev => ({ ...prev, [tempMsgId]: "sent" }));
      await removeMessage(tempMsgId).catch(() => {});
    } catch (err) {
      setMessageStatuses(prev => ({ ...prev, [tempMsgId]: "queued" }));
      registerBackgroundSync().catch(() => {});
      toast({ title: "Message queued", description: "Network issue. Will retry automatically." });
      return;
    }

    trackUsage(mode);
    setIsStreaming(true);
    isStreamingRef.current = true;
    let assistantContent = "";
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }] }
          : c
      )
    );

    const history = [...(conv?.messages ?? []), userMsg].map((m) => ({ role: m.role as "user" | "assistant", content: m.content, attachments: m.attachments }));

    const activePersona = customPersonas.find((p) => p.id === personaId) 
      || builtInPersonas.find((p) => p.id === personaId);
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
              c.id === convId
                ? { ...c, messages: c.messages.map((m) => m.id === assistantId ? { ...m, content: current } : m) }
                : c
            )
          );
        },
        onDone: async () => {
          setIsStreaming(false);
          isStreamingRef.current = false;
          const encryptedAssistant = await encryptText(assistantContent, user.id);
          await supabase.from("messages").insert({
            id: assistantId,
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: encryptedAssistant,
          });
          const sug = await fetchSuggestions(assistantContent);
          setSuggestions(sug);
          // In-app notification trigger for completed AI response
          pushNotification({
            title: "Aureon responded",
            message: assistantContent.slice(0, 80) + (assistantContent.length > 80 ? "…" : ""),
            type: "success",
            actionLabel: "View",
            actionView: "chat",
          });
        },
      });
    } catch (e: any) {
      setIsStreaming(false);
      isStreamingRef.current = false;
      if (e.name === "AbortError") {
        if (assistantContent) {
          const encryptedPartial = await encryptText(assistantContent, user.id);
          await supabase.from("messages").insert({
            id: assistantId,
            conversation_id: convId,
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

  // Queue processor — drains pending messages sequentially
  const processQueue = useCallback(async () => {
    if (processingQueue.current) return;
    processingQueue.current = true;
    while (pendingQueue.current.length > 0) {
      // Check if paused
      if (queuePausedRef.current) {
        processingQueue.current = false;
        return;
      }
      const next = pendingQueue.current.shift()!;
      // Remove from visible queue
      setQueueItems(prev => prev.length > 0 ? prev.slice(1) : prev);
      const [convId, ...contentParts] = next.split("||");
      const content = contentParts.join("||");
      const fileAttachments = attachmentMapRef.current.get(content);
      if (fileAttachments) attachmentMapRef.current.delete(content);
      await sendMessageCore(content, convId, fileAttachments);
      // Wait for streaming to finish before processing next
      await new Promise<void>(resolve => {
        const check = () => {
          if (!isStreamingRef.current) return resolve();
          setTimeout(check, 100);
        };
        check();
      });
    }
    processingQueue.current = false;
  }, [user, mode, depth, personaId, userProfile, customPersonas]);

  const toggleQueuePause = useCallback(() => {
    setQueuePaused(prev => {
      const next = !prev;
      queuePausedRef.current = next;
      // If unpausing, kick off processing
      if (!next && pendingQueue.current.length > 0) {
        processQueue();
      }
      return next;
    });
  }, [processQueue]);

  const forceProcessQueue = useCallback(() => {
    queuePausedRef.current = false;
    setQueuePaused(false);
    processQueue();
  }, [processQueue]);

  // Public sendMessage — adds to queue and kicks off processing
  const sendMessage = async (content: string, attachments?: FileAttachment[]) => {
    if (!user || !activeConvId) return;
    // Store attachments for the first message in a ref-based map
    if (attachments?.length) {
      attachmentMapRef.current.set(content, attachments);
    }
    // If currently streaming, show queued status and add to queue
    if (isStreamingRef.current) {
      const tempId = crypto.randomUUID();
      const userMsg: Message = { id: tempId, role: "user", content, timestamp: new Date(), attachments };
      setConversations((prev) => prev.map((c) => c.id === activeConvId ? { ...c, messages: [...c.messages, userMsg] } : c));
      setMessageStatuses(prev => ({ ...prev, [tempId]: "queued" }));
      const queueEntry = `${activeConvId}||${content}`;
      pendingQueue.current.push(queueEntry);
      setQueueItems(prev => [...prev, { id: tempId, content }]);
      toast({ title: "Message queued", description: "Will send after current response completes." });
      return;
    }
    pendingQueue.current.push(`${activeConvId}||${content}`);
    processQueue();
  };

  const removeFromQueue = useCallback((id: string) => {
    setQueueItems(prev => {
      const idx = prev.findIndex(q => q.id === id);
      if (idx >= 0) pendingQueue.current.splice(idx, 1);
      return prev.filter(q => q.id !== id);
    });
    // Remove from conversation messages too
    setConversations(prev => prev.map(c => ({
      ...c,
      messages: c.messages.filter(m => m.id !== id),
    })));
    setMessageStatuses(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    const ids = queueItems.map(q => q.id);
    pendingQueue.current = [];
    setQueueItems([]);
    // Remove queued messages from conversation
    setConversations(prev => prev.map(c => ({
      ...c,
      messages: c.messages.filter(m => !ids.includes(m.id)),
    })));
    setMessageStatuses(prev => {
      const next = { ...prev };
      ids.forEach(id => delete next[id]);
      return next;
    });
  }, [queueItems]);

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
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      await newConversation();
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
    toast({ title: "Conversation deleted permanently" });
  };

  const archiveConversation = async (id: string) => {
    const archived = conversations.find((c) => c.id === id);
    await supabase.from("conversations").update({ archived: true }).eq("id", id);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      await newConversation();
    } else {
      setConversations(remaining);
      if (activeConvId === id) setActiveConvId(remaining[0].id);
    }
    if (archived) {
      toast({
        title: "Conversation archived",
        description: archived.title,
        action: React.createElement(ToastAction, {
          altText: "Undo archive",
          onClick: async () => {
            await supabase.from("conversations").update({ archived: false }).eq("id", id);
            setConversations((prev) => [archived, ...prev]);
            setActiveConvId(id);
          },
        } as any, "Undo") as any,
      });
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    await supabase.from("conversations").update({ title: newTitle.trim() }).eq("id", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: newTitle.trim() } : c));
  };

  const togglePin = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const newPinned = !conv.pinned;
    await supabase.from("conversations").update({ pinned: newPinned }).eq("id", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, pinned: newPinned } : c));
  };

  const renderView = () => {
    switch (activeView) {
      case "search": 
        return hasSearchAccess(tierKey) 
          ? <ZophielEngineView /> 
          : <FeatureGate title="Zophiel Engine" description="The privacy-first search intelligence engine with source credibility tiers. Available on all paid plans." onUpgrade={() => setActiveView("subscription")} />;
      case "zali":
        return hasProAccess(tierKey)
          ? <ZaliView />
           : <FeatureGate title="ZALI Design Lab" description="Universal Design Intelligence — first-principles design from atoms to universes with cross-domain AI agents, plus a Community hub for questions, requests, and feature voting. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "community":
        return hasProAccess(tierKey)
          ? <CommunityView />
          : <FeatureGate title="Community" description="Join the community — ask questions, make requests, and vote on future features. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "asha": 
        return hasProAccess(tierKey) 
          ? <AshaView /> 
          : <FeatureGate title="Asha Intelligence" description="The full data intelligence platform — ingest, analyze, branch, and visualize any dataset with AI. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "elion":
        return hasProAccess(tierKey)
          ? <ElionView />
          : <FeatureGate title="Elion / Zohar Toolkit" description="Forensic-grade OSINT toolkit — 20+ DeepDive phases, HiveMind orchestration, Ghost Mode, and identity recon. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "nomad": 
        return hasProAccess(tierKey) 
          ? <NomadView /> 
          : <FeatureGate title="NOMAD Agent" description="Public intelligence agent — OSINT research across 40+ data sources with AI-powered correlation and structured dossier output. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "briefing":
        return hasProAccess(tierKey)
          ? <BriefingView />
          : <FeatureGate title="Intelligence Briefings" description="Personalized daily intelligence briefings — competitor tracking, regulatory monitoring, and market signals. Available on Pro and Enterprise plans." onUpgrade={() => setActiveView("subscription")} />;
      case "library": return <LibraryView />;
      case "snippets": return <CodeSnippetsView />;
      case "projects": return <ProjectsView />;
      case "memory": return <MemoryCenterView />;
      case "stats": return <StatsView />;
      case "settings": return <SettingsView />;
      case "subscription": return <SubscriptionView />;
      case "teams":
        return hasProAccess(tierKey)
          ? <TeamsView />
          : <FeatureGate title="Team Workspace" description="Collaborative intelligence with role-based access, team invites, and shared analysis. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "notebooks":
        return hasProAccess(tierKey)
          ? <NotebooksView />
          : <FeatureGate title="Intelligence Notebooks" description="Shared analysis sessions with versioning, scheduling, and collaborative editing. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "geospatial":
        return hasProAccess(tierKey)
          ? <GeospatialView />
          : <FeatureGate title="Geospatial Intelligence" description="Spatial-temporal analysis with location mapping, heatmaps, and route optimization. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "plugins":
        return hasProAccess(tierKey)
          ? <PluginMarketplaceView />
          : <FeatureGate title="Plugin Marketplace" description="Extend Asha with data connectors, analysis modules, and visualization plugins. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "timeseries":
        return hasProAccess(tierKey)
          ? <TimeSeriesView />
          : <FeatureGate title="Time-Series Intelligence" description="Automated temporal analysis with forecasting, anomaly detection, and correlation. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "audit":
        return hasProAccess(tierKey)
          ? <AuditLogView />
          : <FeatureGate title="Audit Trail" description="Complete access and activity logging for compliance and security. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "predictive":
        return hasProAccess(tierKey)
          ? <PredictiveIntelligenceView />
          : <FeatureGate title="Predictive Intelligence" description="AI-powered event forecasting — detect signals from web sources and predict regulatory actions, executive departures, earnings surprises, and more. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "security":
        return hasProAccess(tierKey)
          ? <SecurityDashboardView />
          : <FeatureGate title="Security Command Center" description="8-system defense suite — WAF, IDS, automated incident response, honeypots, threat intelligence, behavior analytics, and real-time monitoring. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "imagine-to-code":
        return hasProAccess(tierKey)
          ? <ImagineToCodeView />
          : <FeatureGate title="Imagine To Code" description="AI-powered pixel art editor — paint, upload images, and ask AUREON to design directly on the canvas. Created by ZALI Software. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "tracker":
        return (hasProAccess(tierKey) || user?.email === "ashernewtonx@gmail.com")
          ? <TrackerView />
          : <FeatureGate title="Location Tracker" description="Real-time geolocation tracking with reverse geocoding and interactive maps. Pin locations, log address history, and monitor coordinates with precision. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "google":
        return hasProAccess(tierKey)
          ? <GoogleIntelligenceView />
          : <FeatureGate title="Google Intelligence" description="Unified intelligence hub — full-spectrum Google account analysis with Gmail, Calendar, Drive, Photos, YouTube, Maps, and more. Available on Pro and Advisor plans." onUpgrade={() => setActiveView("subscription")} />;
      case "persona-store":
        return <PersonaStoreView />;
      case "ide":
        return <AureonIdeView />;
      case "pdf-generator":
        return <PdfGeneratorView />;
      case "pattern-analysis":
        return hasProAccess(tierKey)
          ? <PatternAnalysisView />
          : <FeatureGate title="Pattern Analysis Engine" description="Asha + Aureon powered data pattern recognition with visual graph forecasting. Upload historical data and visual patterns to detect trends and predict future outcomes. Available on Pro plans." onUpgrade={() => setActiveView("subscription")} />;
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
          messageStatuses={messageStatuses}
          queueItems={queueItems}
          onRemoveFromQueue={removeFromQueue}
          onClearQueue={clearQueue}
          onProcessQueueNow={forceProcessQueue}
          queuePaused={queuePaused}
          onToggleQueuePause={toggleQueuePause}
        />
      ) : null;
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">AUREON</div>
      </div>
    );
  }



  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${activeWallpaper})` }} />
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
            onRenameConversation={renameConversation}
            onTogglePin={togglePin}
            onViewChange={setActiveView}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            personaId={personaId}
            onPersonaChange={setPersonaId}
            customPersonas={customPersonas}
            onAddCustomPersona={addCustomPersona}
            onEditCustomPersona={editCustomPersona}
            onDeleteCustomPersona={deleteCustomPersona}
          />
        )}

        <main className="flex flex-1 flex-col min-w-0 overflow-hidden h-full">
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
