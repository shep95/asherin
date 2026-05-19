import heroBgDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import wallpaperSeraph from "@/assets/wallpaper-seraph.png";
import wallpaperProphet from "@/assets/wallpaper-prophet.png";
import wallpaperNexus from "@/assets/wallpaper-nexus.png";
import wallpaperSentinel from "@/assets/wallpaper-sentinel.png";
import wallpaperInferno from "@/assets/wallpaper-inferno.png";
import wallpaperSorrow from "@/assets/wallpaper-sorrow.png";
import wallpaperSilhouette from "@/assets/wallpaper-silhouette.png";
import wallpaperPhantom from "@/assets/wallpaper-phantom.png";
import wallpaperAbyss from "@/assets/wallpaper-abyss.png";
import wallpaperStealth from "@/assets/wallpaper-stealth.png";
import wallpaperStatic from "@/assets/wallpaper-static.png";
import wallpaperMane from "@/assets/wallpaper-mane.png";
import wallpaperImpact from "@/assets/wallpaper-impact.png";
import wallpaperOracle from "@/assets/wallpaper-oracle.png";
import wallpaperAscend from "@/assets/wallpaper-ascend.png";
import wallpaperCosmos from "@/assets/wallpaper-cosmos.png";

const WALLPAPER_MAP: Record<string, string> = {
  default: heroBgDefault,
  raven: wallpaperRaven,
  eclipse: wallpaperEclipse,
  glitch: wallpaperGlitch,
  aureon: wallpaperAureon,
  seraph: wallpaperSeraph,
  prophet: wallpaperProphet,
  nexus: wallpaperNexus,
  sentinel: wallpaperSentinel,
  inferno: wallpaperInferno,
  sorrow: wallpaperSorrow,
  silhouette: wallpaperSilhouette,
  phantom: wallpaperPhantom,
  abyss: wallpaperAbyss,
  stealth: wallpaperStealth,
  static: wallpaperStatic,
  mane: wallpaperMane,
  impact: wallpaperImpact,
  oracle: wallpaperOracle,
  ascend: wallpaperAscend,
  cosmos: wallpaperCosmos,
};
import React, { Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Conversation, ChatMode, DashboardView, Message, Persona, FileAttachment } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import type { FeedbackType } from "@/components/dashboard/CalibrationFeedback";
import type { UserProfile } from "@/lib/ai";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ChatView from "@/components/dashboard/ChatView";
import { useAccess } from "@/hooks/useAccess";

// Lazy-load heavy views
const LibraryView = lazyWithRetry(() => import("@/components/dashboard/LibraryView"));
const CodeSnippetsView = lazyWithRetry(() => import("@/components/dashboard/CodeSnippetsView"));
const ProjectsView = lazyWithRetry(() => import("@/components/dashboard/ProjectsView"));
const MemoryCenterView = lazyWithRetry(() => import("@/components/dashboard/MemoryCenterView"));
const StatsView = lazyWithRetry(() => import("@/components/dashboard/StatsView"));
const VedicAstrologyView = lazyWithRetry(() => import("@/components/dashboard/VedicAstrologyView"));
const SettingsView = lazyWithRetry(() => import("@/components/dashboard/SettingsView"));
const SubscriptionView = lazyWithRetry(() => import("@/components/dashboard/SubscriptionView"));
const ZophielEngineView = lazyWithRetry(() => import("@/components/dashboard/ZophielEngineView"));
const AzplenView = lazyWithRetry(() => import("@/components/dashboard/azplen/AzplenView"));
const ZaliView = lazyWithRetry(() => import("@/components/dashboard/zali/ZaliView"));
const CommunityView = lazyWithRetry(() => import("@/components/dashboard/zali/CommunityView"));
const NomadView = lazyWithRetry(() => import("@/components/dashboard/NomadView"));
const BriefingView = lazyWithRetry(() => import("@/components/dashboard/BriefingView"));
const TeamsView = lazyWithRetry(() => import("@/components/dashboard/TeamsView"));
const NotebooksView = lazyWithRetry(() => import("@/components/dashboard/NotebooksView"));
const GeospatialView = lazyWithRetry(() => import("@/components/dashboard/GeospatialView"));
const PluginMarketplaceView = lazyWithRetry(() => import("@/components/dashboard/PluginMarketplaceView"));
const TimeSeriesView = lazyWithRetry(() => import("@/components/dashboard/TimeSeriesView"));
const AuditLogView = lazyWithRetry(() => import("@/components/dashboard/AuditLogView"));
const PredictiveIntelligenceView = lazyWithRetry(() => import("@/components/dashboard/PredictiveIntelligenceView"));

const ImagineToCodeView = lazyWithRetry(() => import("@/components/dashboard/ImagineToCodeView"));

const PersonaStoreView = lazyWithRetry(() => import("@/components/dashboard/PersonaStoreView"));
const AureonIdeView = lazyWithRetry(() => import("@/components/dashboard/ide/AureonIdeView"));
const PdfGeneratorView = lazyWithRetry(() => import("@/components/dashboard/PdfGeneratorView"));
const PatternAnalysisView = lazyWithRetry(() => import("@/components/dashboard/PatternAnalysisView"));
const SlideshowGeneratorView = lazyWithRetry(() => import("@/components/dashboard/SlideshowGeneratorView"));

const SelfAccessLearningView = lazyWithRetry(() => import("@/components/dashboard/SelfAccessLearningView"));
const ImagineIntelligenceView = lazyWithRetry(() => import("@/components/dashboard/OracleLocusView"));
const VideoIntelligenceView = lazyWithRetry(() => import("@/components/dashboard/VideoIntelligenceView"));
const VibeImagerView = lazyWithRetry(() => import("@/components/dashboard/VibeImagerView"));
const VibeVideoView = lazyWithRetry(() => import("@/components/dashboard/VibeVideoView"));
const AgentsView = lazyWithRetry(() => import("@/components/dashboard/agents/AgentsView"));
const BugReportsView = lazyWithRetry(() => import("@/components/dashboard/BugReportsView"));
const EBookGeneratorView = lazyWithRetry(() => import("@/components/dashboard/ebook/EBookGeneratorView"));
const ReverseEngineerView = lazyWithRetry(() => import("@/components/dashboard/ReverseEngineerView"));
const CrossView = lazyWithRetry(() => import("@/components/dashboard/cross/CrossView"));
const GuardianVaultView = lazyWithRetry(() => import("@/components/dashboard/GuardianVaultView"));
const ZeeionView = lazyWithRetry(() => import("@/components/dashboard/zeeion/ZeeionView"));
const AxrlenView = lazyWithRetry(() => import("@/components/dashboard/axrlen/AxrlenView"));
const ZerlalView = lazyWithRetry(() => import("@/components/dashboard/zerlal/ZerlalView"));
const FileScrapperView = lazyWithRetry(() => import("@/components/dashboard/scrapper/FileScrapperView"));

const CipherView = lazyWithRetry(() => import("@/components/dashboard/cipher/CipherToolkit"));
const AsherZahtenModule = lazyWithRetry(() => import("@/components/asher/AsherZahtenModule"));
const AsherPublishedTabRenderer = lazyWithRetry(() => import("@/components/asher/AsherPublishedTabRenderer"));
import CommandPalette from "@/components/dashboard/CommandPalette";
import FocusMode from "@/components/dashboard/FocusMode";
import SplitPaneManager, { type SplitPane } from "@/components/dashboard/SplitPaneManager";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, hasSearchAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, fetchSuggestions, fetchConsensus } from "@/lib/ai";
import type { SelectedModel } from "@/components/dashboard/MultiModelSelector";
import { builtInPersonas } from "@/components/dashboard/PersonaSelector";
import { getActiveBranch, getMessageBranch, tagMessageBranch, retargetMessageBranch, hydrateMessageBranches, restoreBranchesFromDB, saveBranchesToDB } from "@/components/dashboard/ConversationBranches";
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

const LazyFallback = () => (
  <div className="flex flex-1 items-center justify-center">
    <div className="text-xs font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">Loading…</div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canAccess, tierKey } = useAccess();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    try { return localStorage.getItem("aureon_active_conv_id") || null; } catch { return null; }
  });
  const hydratedConvsRef = useRef<Set<string>>(new Set());
  const hydrateConvRef = useRef<((cid: string) => Promise<void>) | null>(null);
  const asherEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("asherEmbed") === "1";
  const [activeViewRaw, setActiveViewRaw] = useState<DashboardView>("chat");
  const activeView: DashboardView = asherEmbed ? "chat" : activeViewRaw;
  const setActiveView = (v: DashboardView) => {
    if (asherEmbed && v !== "chat") return;
    setActiveViewRaw(v);
    // Stale follow-up suggestions from a previous response should not survive
    // a view switch.
    setSuggestions([]);
  };
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
  const activeConvIdRef = useRef<string | null>(null);
  const bootstrapConversationRef = useRef(false);
  const attachmentMapRef = useRef<Map<string, FileAttachment[]>>(new Map());
  const [online, setOnline] = useState(navigator.onLine);
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});
  // Two independent locks — offline-sync drain and live send queue must not block each other.
  const processingQueue = useRef(false);          // live send queue (processQueue)
  const processingOfflineQueue = useRef(false);   // offline-sync drain (processMessageQueue)
  const pendingQueue = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const [queueItems, setQueueItems] = useState<{ id: string; content: string }[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const queuePausedRef = useRef(false);
  const [consensusEnabled, setConsensusEnabled] = useState(false);
  const [consensusModels, setConsensusModels] = useState<SelectedModel[]>([]);
  const [storedProviders, setStoredProviders] = useState<string[]>([]);
  const [splitPanes, setSplitPanes] = useState<SplitPane[]>([]);
  const [publishedAgents, setPublishedAgents] = useState<{ id: string; name: string; entry_html: string | null }[]>([]);
  const [isDraggingConvo, setIsDraggingConvo] = useState(false);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(() => {
    try { return localStorage.getItem("aureon_active_brain_id") || null; } catch { return null; }
  });
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
    try { return localStorage.getItem("aureon_wallpaper") || "aureon"; } catch { return "aureon"; }
  });
  const [prevDashWallpaper, setPrevDashWallpaper] = useState<string | null>(null);
  const [isDashTransitioning, setIsDashTransitioning] = useState(false);
  const dashTransRef = useRef<ReturnType<typeof setTimeout>>();
  const activeWallpaper = WALLPAPER_MAP[wallpaperKey] || WALLPAPER_MAP.aureon || WALLPAPER_MAP.default;

  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    document.title = "Dashboard — Aureon Workspace";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Your Aureon workspace — chats, agents, projects, intelligence modules, and BYOK controls in one private dashboard.");
    let canon = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevHref = canon?.getAttribute("href") || "";
    if (canon) canon.setAttribute("href", "https://aureonai.app/dashboard");
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
      if (canon && prevHref) canon.setAttribute("href", prevHref);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const newKey = localStorage.getItem("aureon_wallpaper") || "aureon";
      const newSrc = WALLPAPER_MAP[newKey] || WALLPAPER_MAP.aureon || WALLPAPER_MAP.default;
      const oldSrc = WALLPAPER_MAP[wallpaperKey] || WALLPAPER_MAP.aureon || WALLPAPER_MAP.default;
      if (newSrc !== oldSrc) {
        setPrevDashWallpaper(oldSrc);
        setIsDashTransitioning(true);
        if (dashTransRef.current) clearTimeout(dashTransRef.current);
        dashTransRef.current = setTimeout(() => {
          setIsDashTransitioning(false);
          setPrevDashWallpaper(null);
        }, 900);
      }
      setWallpaperKey(newKey);
    };
    window.addEventListener("storage", handler);
    window.addEventListener("aureon-wallpaper-change", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("aureon-wallpaper-change", handler);
      if (dashTransRef.current) clearTimeout(dashTransRef.current);
    };
  }, [wallpaperKey]);

  // Global drag detection for split-pane drop zones
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("text/aureon-conversation-id")) {
        setIsDraggingConvo(true);
      }
    };
    const onDragEnd = () => setIsDraggingConvo(false);
    const onDrop = () => setIsDraggingConvo(false);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const addSplitPane = useCallback((convId: string) => {
    if (splitPanes.length >= 4) return;
    if (splitPanes.some(p => p.conversationId === convId)) return;
    setSplitPanes(prev => [...prev, { id: crypto.randomUUID(), conversationId: convId }]);
  }, [splitPanes]);

  const removeSplitPane = useCallback((paneId: string) => {
    setSplitPanes(prev => {
      const next = prev.filter(p => p.id !== paneId);
      return next;
    });
  }, []);

  const handleSplitSendMessage = useCallback(async (content: string, convId: string, attachments?: FileAttachment[]) => {
    // Temporarily switch active conv to send to the right conversation
    const prevActive = activeConvId;
    setActiveConvId(convId);
    await sendMessageCore(content, convId, attachments);
    if (prevActive) setActiveConvId(prevActive);
  }, [activeConvId]);

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
    if (processingOfflineQueue.current || !user) return;
    processingOfflineQueue.current = true;
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
                conversationId: msg.conversationId,
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
      processingOfflineQueue.current = false;
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

  // Load stored BYOK providers for consensus selector
  useEffect(() => {
    if (!user) return;
    supabase.from("user_api_keys").select("provider").eq("user_id", user.id).eq("is_active", true).then(({ data }) => {
      if (data) setStoredProviders(data.map(d => d.provider));
    });
  }, [user]);

  // Load conversations and user profile from DB
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const [convResult, profileResult, settingsResult] = await Promise.all([
        supabase.from("conversations").select("*").eq("user_id", user.id).eq("archived", false).order("created_at", { ascending: false }),
        supabase.from("user_intelligence_profile").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (cancelled) return;

      if (convResult.error) {
        console.error("Failed to load conversations:", convResult.error);
        setLoaded(true);
        return;
      }

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

      const convRows = convResult.data ?? [];
      if (convRows.length === 0) {
        const savedConvId = localStorage.getItem("aureon_active_conv_id");
        const canBootstrapConversation =
          !bootstrapConversationRef.current &&
          conversationsRef.current.length === 0 &&
          !savedConvId;

        if (canBootstrapConversation) {
          bootstrapConversationRef.current = true;
          const { data: newConv, error: newConvError } = await supabase
            .from("conversations")
            .insert({ user_id: user.id, title: "New conversation", mode: "chat" })
            .select()
            .single();

          if (cancelled) return;

          if (newConvError) {
            console.error("Failed to create bootstrap conversation:", newConvError);
            bootstrapConversationRef.current = false;
            setLoaded(true);
            return;
          }

          if (newConv) {
            setConversations([{ id: newConv.id, title: newConv.title, messages: [], createdAt: new Date(newConv.created_at), pinned: newConv.pinned, mode: newConv.mode as ChatMode }]);
            setActiveConvId(newConv.id);
          }
        }

        setLoaded(true);
        return;
      }

      bootstrapConversationRef.current = true;

      // FAST PATH: render dashboard immediately with conversation list (no messages yet),
      // then lazy-hydrate messages in the background. Cuts loading screen from 10s+ to <1s.
      const preferredConvId = activeConvIdRef.current ?? localStorage.getItem("aureon_active_conv_id");
      const shellConvs: Conversation[] = convRows.map((c) => ({
        id: c.id,
        title: c.title,
        messages: [],
        createdAt: new Date(c.created_at),
        pinned: c.pinned,
        mode: c.mode as ChatMode,
        projectId: c.project_id ?? undefined,
      }));
      setConversations(shellConvs);
      const initialActiveId = (preferredConvId && shellConvs.find(c => c.id === preferredConvId))
        ? preferredConvId
        : (shellConvs[0]?.id ?? null);
      setActiveConvId(initialActiveId);
      setLoaded(true);

      // Restore branches in background
      convRows.forEach((c) => {
        restoreBranchesFromDB(c.id, (c as any).branches);
        const restored = localStorage.getItem("aureon_conv_branches");
        const parsed = restored ? JSON.parse(restored) : {};
        const current = parsed[c.id];
        if (!Array.isArray((c as any).branches) || (c as any).branches.length === 0 || !current?.some((branch: any) => branch.id === "main")) {
          void saveBranchesToDB(c.id, current && current.length > 0 ? current : [{ id: "main", name: "Main", createdAt: 0 }]);
        }
      });

      // Hydrate messages: active conversation FIRST, then the rest in the background.
      const hydrateConv = async (cid: string) => {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: true })
          .limit(500);
        const rows = data ?? [];
        hydrateMessageBranches(rows.map(m => ({ id: m.id, branch_id: (m as any).branch_id })));
        let decryptFailures = 0;
        const decrypted = await Promise.all(rows.map(async (m) => {
          let content: string;
          try {
            content = await decryptText(m.content, user.id);
          } catch {
            decryptFailures += 1;
            content = "🔒 [Encrypted on another device — cannot be read here]";
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            content,
            timestamp: new Date(m.created_at),
            truthScore: m.truth_score as "high" | "medium" | "low" | undefined,
            sources: (m.sources as { title: string; url: string }[]) ?? [],
          } as Message;
        }));
        if (decryptFailures > 0 && !sessionStorage.getItem("aureon_decrypt_warned")) {
          sessionStorage.setItem("aureon_decrypt_warned", "1");
          toast({
            title: "Some messages can't be decrypted here",
            description: `${decryptFailures} message(s) were encrypted on a different device or browser. They're safe — but unreadable from this device. Sign in on the original device to view them.`,
            variant: "default",
          });
        }
        if (cancelled) return;
        // Merge — don't overwrite optimistic messages added during hydration.
        setConversations(prev => prev.map(c => {
          if (c.id !== cid) return c;
          const byId = new Map<string, Message>();
          for (const m of decrypted) byId.set(m.id, m);
          for (const m of c.messages) if (!byId.has(m.id)) byId.set(m.id, m);
          const merged = Array.from(byId.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          return { ...c, messages: merged };
        }));
        hydratedConvsRef.current.add(cid);
      };
      hydrateConvRef.current = hydrateConv;

      (async () => {
        if (initialActiveId) await hydrateConv(initialActiveId);
        if (cancelled) return;
        for (const c of convRows) {
          if (cancelled) return;
          if (c.id === initialActiveId) continue;
          if (hydratedConvsRef.current.has(c.id)) continue;
          await hydrateConv(c.id);
        }
      })();
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist active conversation id so tab-switching remembers it
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (activeConvId) {
      localStorage.setItem("aureon_active_conv_id", activeConvId);
    }
  }, [activeConvId]);

  // Persist active brain id
  useEffect(() => {
    if (activeBrainId) {
      localStorage.setItem("aureon_active_brain_id", activeBrainId);
    } else {
      localStorage.removeItem("aureon_active_brain_id");
    }
  }, [activeBrainId]);

  useEffect(() => {
    if (personaId) {
      localStorage.setItem("aureon_active_persona_id", personaId);
    } else {
      localStorage.removeItem("aureon_active_persona_id");
    }
  }, [personaId]);

  useEffect(() => {
    if (!loaded || conversations.length === 0) return;
    if (!activeConvId || !conversations.some((conversation) => conversation.id === activeConvId)) {
      setActiveConvId(conversations[0].id);
    }
  }, [loaded, conversations, activeConvId]);

  // Keep ref in sync so sendMessageCore always reads latest conversations
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // Re-sync UI when tab becomes visible again (prevents stale/blank messages after tab switch)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        // First, force re-render from the ref (covers streaming updates that happened while backgrounded)
        const refConvs = conversationsRef.current;
        setConversations(refConvs.map(c => ({ ...c, messages: [...c.messages] })));

        // If we were NOT streaming when we came back, re-fetch messages for the active conversation
        // from DB to catch any saves that completed while backgrounded
        const currentConvId = activeConvIdRef.current;
        if (!isStreamingRef.current && user && currentConvId) {
          // Skip re-sync if user is on a non-main branch to prevent branch messages from disappearing
          const currentBranch = getActiveBranch(currentConvId);
          if (currentBranch !== "main") return;
          // Small delay to let any in-flight DB writes complete
          await new Promise(r => setTimeout(r, 500));
          // Re-check streaming state after delay (user might have sent a message)
          if (isStreamingRef.current) return;
          try {
            const { data: freshMsgs } = await supabase
              .from("messages")
              .select("*")
              .eq("conversation_id", currentConvId)
              .order("created_at", { ascending: true })
              .limit(500);
            if (freshMsgs && freshMsgs.length > 0) {
              // Only update if we have MORE messages from DB than local (don't lose unsaved messages)
              const localConv = conversationsRef.current.find(c => c.id === currentConvId);
              const localCount = localConv?.messages.length ?? 0;
              if (freshMsgs.length >= localCount) {
                const decrypted = await Promise.all(
                  freshMsgs.map(async (m) => {
                    let content: string;
                    try { content = await decryptText(m.content, user.id); }
                    catch { content = "🔒 [Encrypted on another device — cannot be read here]"; }
                    return {
                      id: m.id,
                      role: m.role as "user" | "assistant",
                      content,
                      timestamp: new Date(m.created_at),
                      truthScore: m.truth_score as "high" | "medium" | "low" | undefined,
                      sources: (m.sources as { title: string; url: string }[]) ?? [],
                    };
                  })
                );
                setConversations(prev => prev.map(c => {
                  if (c.id !== currentConvId) return c;
                  // Merge fresh DB rows with existing in-memory entries so we
                  // don't wipe attachments / consensusData / branch metadata
                  // that only live in memory.
                  const existingById = Object.fromEntries(c.messages.map(m => [m.id, m]));
                  return {
                    ...c,
                    messages: decrypted.map(dm => ({
                      ...existingById[dm.id],
                      ...dm,
                    })),
                  };
                }));
              }
            }
          } catch {
            // Non-critical — local state is still valid
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user]);

  const activeConv = activeConvId
    ? conversations.find((c) => c.id === activeConvId) ?? null
    : conversations[0] ?? null;

  const handleDepthChange = useCallback((newDepth: ResponseDepth) => {
    setDepth(newDepth);
    if (user) {
      supabase.from("user_settings").update({ response_depth: newDepth }).eq("user_id", user.id).then();
    }
  }, [user]);

  // Load Zahten-published agents so they surface as dynamic dashboard tabs (mirrors Asher Dashboard).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("asher_agents" as any)
        .select("id, name, entry_html")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled && data) setPublishedAgents(data as any);
    };
    load();
    const onUpd = () => load();
    window.addEventListener("asher-agents-updated", onUpd);
    return () => { cancelled = true; window.removeEventListener("asher-agents-updated", onUpd); };
  }, [user?.id]);

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
    // The queue processor polls the ref — without this, queued messages get
    // stuck behind a "still streaming" lock even after the user hit Stop.
    isStreamingRef.current = false;
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
    const currentBranch = getActiveBranch(convId);
    tagMessageBranch(tempMsgId, currentBranch);
    const branchMsgs = conv?.messages.filter(m => getMessageBranch(m.id) === currentBranch) ?? [];
    const isFirst = branchMsgs.length === 0 && (conv?.messages.length === 0);
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
        retargetMessageBranch(tempMsgId, userMsgRow.id);
        tagMessageBranch(userMsgRow.id, currentBranch); // ensure tag exists even if retarget missed
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
    tagMessageBranch(assistantId, currentBranch);
    const controller = new AbortController();
    abortRef.current = controller;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: assistantId, role: "assistant" as const, content: "", timestamp: new Date() }] }
          : c
      )
    );

    // Only send branch-scoped history to AI (no memory leaking between branches)
    const history = [...branchMsgs, userMsg].map((m) => ({ role: m.role as "user" | "assistant", content: m.content, attachments: m.attachments }));

    const activePersona = customPersonas.find((p) => p.id === personaId) 
      || builtInPersonas.find((p) => p.id === personaId);
    const personaSystemPrompt = activePersona?.systemPrompt || null;

    // ── BRAIN CONTEXT ─────────────────────────────────────────────────
    let brainContext: { prompt: string; fileContents: { name: string; content: string }[] } | null = null;
    if (activeBrainId) {
      try {
        const { data: brain } = await supabase.from("brains").select("system_prompt, file_ids").eq("id", activeBrainId).single();
        if (brain) {
          const fileContents: { name: string; content: string }[] = [];
          if (brain.file_ids?.length) {
            const { data: files } = await supabase.from("library_files").select("file_name, storage_path, file_type").in("id", brain.file_ids);
            if (files) {
              for (const f of files) {
                // Only load text-readable files as context
                const isText = !f.file_type.startsWith("image/") && !f.file_type.startsWith("video/") && !f.file_type.startsWith("audio/");
                if (isText) {
                  const { data: blob } = await supabase.storage.from("library").download(f.storage_path);
                  if (blob) {
                    const text = await blob.text();
                    fileContents.push({ name: f.file_name, content: text.slice(0, 80000) });
                  }
                }
              }
            }
          }
          brainContext = { prompt: brain.system_prompt || "", fileContents };
        }
      } catch (e) {
        console.error("Failed to load brain context:", e);
      }
    }

    // ── CONSENSUS MODE ──────────────────────────────────────────────
    if (consensusEnabled && consensusModels.length >= 2) {
      try {
        const result = await fetchConsensus({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          models: consensusModels.map(m => ({ provider: m.provider, model: m.model })),
          mode,
        });

        // Pick the best content: use verdict response if available
        const verdictIdx = result.verdict?.index ?? 0;
        const successfulResponses = result.responses.filter(r => r.content && !r.error);
        const bestContent = successfulResponses[verdictIdx]?.content
          || successfulResponses[0]?.content
          || result.responses.filter(r => r.content).map(r => `**${r.provider}/${r.model}:**\n${r.content}`).join("\n\n---\n\n")
          || "No models responded successfully.";

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.map((m) => m.id === assistantId ? { ...m, content: bestContent, consensusData: result as any } : m) }
              : c
          )
        );
        setIsStreaming(false);
        isStreamingRef.current = false;

        const encryptedAssistant = await encryptText(bestContent, user.id);
        await supabase.from("messages").insert({
          id: assistantId,
          conversation_id: convId,
          user_id: user.id,
          role: "assistant",
          content: encryptedAssistant,
        });
        const sug = await fetchSuggestions(bestContent);
        setSuggestions(sug);

        const confLevel = result.confidence?.level || "medium";
        const successCount = successfulResponses.length;
        const totalCount = result.responses.length;
        pushNotification({
          title: `Consensus: ${result.consensus ? "Models agree" : "Models diverge"}`,
          message: `${successCount}/${totalCount} responded · ${result.confidence?.overallConfidence ?? 0}% confidence${result.confidence?.needsHumanReview ? " · ⚠ Human review recommended" : ""}`,
          type: confLevel === "high" ? "success" : confLevel === "critical_divergence" ? "error" : "info",
          actionLabel: "View",
          actionView: "chat",
        });
      } catch (e: any) {
        setIsStreaming(false);
        isStreamingRef.current = false;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter(m => m.id !== assistantId) }
              : c
          )
        );
        toast({ title: "Consensus Error", description: e.message, variant: "destructive" });
      }
      return;
    }

    // ── STANDARD STREAMING ──────────────────────────────────────────
    try {
      await streamChat({
        messages: history,
        mode,
        personaId,
        personaSystemPrompt,
        depth,
        userProfile,
        brainContext,
        conversationId: convId,
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
          // Persist assistant message — retry once on failure to prevent disappearing messages
          try {
            const encryptedAssistant = await encryptText(assistantContent, user.id);
            await supabase.from("messages").insert({
              id: assistantId,
              conversation_id: convId,
              user_id: user.id,
              role: "assistant",
              content: encryptedAssistant,
            });
          } catch (saveErr) {
            console.error("Failed to save assistant message, retrying:", saveErr);
            try {
              const enc2 = await encryptText(assistantContent, user.id);
              await supabase.from("messages").insert({
                id: assistantId,
                conversation_id: convId,
                user_id: user.id,
                role: "assistant",
                content: enc2,
              });
            } catch (retryErr) {
              console.error("Retry save also failed:", retryErr);
              // Message remains in local state even if DB save fails
            }
          }
          try {
            const sug = await fetchSuggestions(assistantContent);
            setSuggestions(sug);
          } catch { /* suggestions are non-critical */ }
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
          try {
            const encryptedPartial = await encryptText(assistantContent, user.id);
            await supabase.from("messages").insert({
              id: assistantId,
              conversation_id: convId,
              user_id: user.id,
              role: "assistant",
              content: encryptedPartial,
            });
          } catch { /* best-effort save */ }
        }
        toast({ title: "Stopped", description: "Generation stopped. Partial response saved." });
      } else {
        // Save partial content if we got any before the error
        if (assistantContent) {
          try {
            const encPartial = await encryptText(assistantContent, user.id);
            await supabase.from("messages").insert({
              id: assistantId,
              conversation_id: convId,
              user_id: user.id,
              role: "assistant",
              content: encPartial,
            });
          } catch { /* best-effort save */ }
        }
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
    const convId = activeConvIdRef.current;
    if (!user || !convId) return;
    // Store attachments for the first message in a ref-based map
    if (attachments?.length) {
      attachmentMapRef.current.set(content, attachments);
    }
    // If currently streaming, show queued status and add to queue
    if (isStreamingRef.current) {
      const tempId = crypto.randomUUID();
      const userMsg: Message = { id: tempId, role: "user", content, timestamp: new Date(), attachments };
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, messages: [...c.messages, userMsg] } : c));
      setMessageStatuses(prev => ({ ...prev, [tempId]: "queued" }));
      const queueEntry = `${convId}||${content}`;
      pendingQueue.current.push(queueEntry);
      setQueueItems(prev => [...prev, { id: tempId, content }]);
      toast({ title: "Message queued", description: "Will send after current response completes." });
      return;
    }
    pendingQueue.current.push(`${convId}||${content}`);
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
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New conversation", mode })
      .select()
      .single();
    if (error || !newConv) {
      toast({ title: "Failed to create conversation", description: error?.message, variant: "destructive" });
      return;
    }
    const conv: Conversation = {
      id: newConv.id, title: newConv.title, messages: [],
      createdAt: new Date(newConv.created_at), pinned: newConv.pinned,
      mode: newConv.mode as ChatMode,
    };
    // CRITICAL: sync the ref synchronously so any sendMessage fired before
    // React commits the state still routes to the new conversation.
    activeConvIdRef.current = newConv.id;
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(newConv.id);
    setActiveView("chat");
    setSidebarOpen(false);
    setSuggestions([]);
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
    // Gate map: view -> { component, title, description }
    const gatedView = (view: DashboardView, Component: React.ComponentType, title: string, description: string) => {
      if (canAccess(view)) return <ErrorBoundary><Suspense fallback={<LazyFallback />}><Component /></Suspense></ErrorBoundary>;
      return <FeatureGate title={title} description={description} onUpgrade={() => setActiveView("subscription")} />;
    };

    // Dynamic Zahten-published agent tabs (id format: "agent:<uuid>")
    if (typeof activeView === "string" && (activeView as string).startsWith("agent:")) {
      const a = publishedAgents.find((x) => `agent:${x.id}` === activeView);
      if (a) {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LazyFallback />}>
              <AsherPublishedTabRenderer name={a.name} entryHtml={a.entry_html || ""} />
            </Suspense>
          </ErrorBoundary>
        );
      }
    }

    switch (activeView) {
      case "search": return gatedView("search", ZophielEngineView, "Zophiel Engine", "The privacy-first search intelligence engine with source credibility tiers. Available on all paid plans.");
      case "zali": return gatedView("zali", ZaliView, "ZANOEM Design Lab", "Universal Design Intelligence — first-principles design from atoms to universes with cross-domain AI agents. Available on Pro plans.");
      case "community": return gatedView("community", CommunityView, "Community", "Join the community — ask questions, make requests, and vote on future features. Available on Pro plans.");
      case "azplen": return gatedView("azplen", AzplenView, "Azplen Intelligence", "The full data intelligence platform — ingest, analyze, branch, and visualize any dataset with AI. Available on Pro plans.");
      // case "elion" removed
      case "nomad": return gatedView("nomad", NomadView, "NOMAD Agent", "Public intelligence agent — OSINT research across 40+ data sources with AI-powered correlation. Available on Pro plans.");
      case "briefing": return gatedView("briefing", BriefingView, "Intelligence Briefings", "Personalized daily intelligence briefings — competitor tracking, regulatory monitoring, and market signals. Available on Pro plans.");
      case "teams": return gatedView("teams", TeamsView, "Team Workspace", "Collaborative intelligence with role-based access, team invites, and shared analysis. Available on Pro plans.");
      case "notebooks": return gatedView("notebooks", NotebooksView, "Intelligence Notebooks", "Shared analysis sessions with versioning, scheduling, and collaborative editing. Available on Pro plans.");
      case "geospatial": return gatedView("geospatial", GeospatialView, "Geospatial Intelligence", "Spatial-temporal analysis with location mapping, heatmaps, and route optimization. Available on Pro plans.");
      case "plugins": return gatedView("plugins", PluginMarketplaceView, "Plugin Marketplace", "Extend Azplen with data connectors, analysis modules, and visualization plugins. Available on Pro plans.");
      case "timeseries": return gatedView("timeseries", TimeSeriesView, "Time-Series Intelligence", "Automated temporal analysis with forecasting, anomaly detection, and correlation. Available on Pro plans.");
      case "audit": return gatedView("audit", AuditLogView, "Audit Trail", "Complete access and activity logging for compliance and security. Available on Pro plans.");
      case "zahten": return gatedView("zahten" as DashboardView, AsherZahtenModule, "Zahten Agent Forge", "Autonomous agent builder — design, scaffold, and harden production-grade automated agents. Available on the Chat plan ($47/mo) and above.");
      case "imagine-to-code": return gatedView("imagine-to-code", ImagineToCodeView, "Imagine To Code", "AI-powered pixel art editor — paint, upload images, and ask AUREON to design directly on the canvas. Available on Pro plans.");
      
      case "pattern-analysis": return gatedView("pattern-analysis", PatternAnalysisView, "Pattern Analysis Engine", "Azplen + Aureon powered data pattern recognition with visual graph forecasting. Available on Pro plans.");
      case "cross": return gatedView("cross", CrossView, "Cross — Live Screen Intelligence", "Real-time screen analysis — share your screen with Aureon for instant pattern detection, alerts, and recommendations. Admin only.");
      case "zeeion": return gatedView("zeeion", ZeeionView, "Zeeion — Financial Intelligence", "AI-powered financial analysis — upload data for cost savings, efficiency scoring, and budget optimization. Available on Pro plans.");
      case "axrlen": return gatedView("axrlen", AxrlenView, "Axrlen — Predictive Intelligence", "Real-time global event prediction and policy simulation — powered by live data from 9+ intelligence sources. Available on Pro plans.");
      case "zerlal": return gatedView("zerlal", ZerlalView, "Zerlal — Cyber Security", "AI-powered cyber security intelligence — threat analysis, vulnerability detection, and defense strategies powered by AUREON. Available on Pro plans.");
      
      // case "imagine-intelligence" removed
      case "file-scrapper": return gatedView("file-scrapper", FileScrapperView, "File Scrapper", "Upload unstructured documents and extract all text into a single downloadable TXT file. Available on Aureon ($199/mo) and above.");
      case "video-intelligence": return gatedView("video-intelligence", VideoIntelligenceView, "Video Intelligence", "Behavioral analysis, deception detection, and personality profiling. Available on Pro plans.");
      case "vibe-imager": return gatedView("vibe-imager", VibeImagerView, "Vibe Imager", "Conversational AI image creation — describe, iterate, version control. Available on all paid plans.");
      case "vibe-video": return gatedView("vibe-video", VibeVideoView, "Vibe Video", "Conversational AI video editing — upload, describe edits, and Aureon analyzes your footage. Available on Pro plans.");
      case "agents": return gatedView("agents", AgentsView, "Automated Agents", "AI-powered automation — create agents that run tasks on autopilot forever. Available as an add-on subscription.");
      case "bug-reports": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><BugReportsView /></Suspense></ErrorBoundary>;
      case "guardian-vault": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><GuardianVaultView /></Suspense></ErrorBoundary>;
      case "reverse-engineer": return gatedView("reverse-engineer", ReverseEngineerView, "Reverse Engineering Intelligence", "Upload screenshots of any software or hardware system — Aureon deconstructs the entire architecture. Available on Aureon and Pro plans.");
      case "cipher": return gatedView("cipher", CipherView, "Cipher — Data Operations", "Intelligence-grade data toolkit — encoding, hashing, encryption, format conversion, and recipe chaining. All operations run client-side. Available on Aureon and above.");
      // Always-accessible views
      case "library": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><LibraryView /></Suspense></ErrorBoundary>;
      case "snippets": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><CodeSnippetsView /></Suspense></ErrorBoundary>;
      case "projects": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><ProjectsView /></Suspense></ErrorBoundary>;
      case "memory": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><MemoryCenterView /></Suspense></ErrorBoundary>;
      case "stats": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><StatsView /></Suspense></ErrorBoundary>;
      case "vedic-astrology": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><VedicAstrologyView /></Suspense></ErrorBoundary>;
      case "settings": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><SettingsView /></Suspense></ErrorBoundary>;
      case "subscription": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><SubscriptionView /></Suspense></ErrorBoundary>;
      case "persona-store": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><PersonaStoreView /></Suspense></ErrorBoundary>;
      case "ide": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><AureonIdeView /></Suspense></ErrorBoundary>;
      case "pdf-generator": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><PdfGeneratorView /></Suspense></ErrorBoundary>;
      case "ebook": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><EBookGeneratorView /></Suspense></ErrorBoundary>;
      case "slideshow": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><SlideshowGeneratorView /></Suspense></ErrorBoundary>;
      
      case "self-access": return <ErrorBoundary><Suspense fallback={<LazyFallback />}><SelfAccessLearningView /></Suspense></ErrorBoundary>;
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
          personaSystemPrompt={
            (customPersonas.find(p => p.id === personaId) || builtInPersonas.find(p => p.id === personaId))?.systemPrompt || null
          }
          consensusEnabled={consensusEnabled}
          onConsensusToggle={setConsensusEnabled}
          consensusModels={consensusModels}
          onConsensusModelsChange={setConsensusModels}
          storedProviders={storedProviders}
          activeBrainId={activeBrainId}
          onBrainChange={setActiveBrainId}
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
      <h1 className="sr-only">Aureon Dashboard — Your Intelligence Workspace</h1>
      {/* Previous wallpaper (fades out during transition) */}
      {prevDashWallpaper && isDashTransitioning && (
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none" style={{ backgroundImage: `url(${prevDashWallpaper})`, zIndex: 0 }} />
      )}
      {/* Current wallpaper (fades in) */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${activeWallpaper})`,
          zIndex: 1,
          opacity: isDashTransitioning ? 0 : 1,
          animation: isDashTransitioning ? "wpFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" : undefined,
        }}
      />
      {/* Dark overlay — dims during transition to reveal the light streak */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          zIndex: 3,
          backgroundColor: 'hsl(0 0% 0% / 0.8)',
          opacity: isDashTransitioning ? 0.5 : 1,
        }}
      />
      {/* Light streak wipe — ABOVE overlay */}
      {isDashTransitioning && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 4 }}>
          <div style={{
            position: "absolute", top: "-20%", bottom: "-20%", width: "35%",
            background: "linear-gradient(90deg, transparent 0%, hsla(275,80%,70%,0.12) 15%, hsla(275,80%,85%,0.3) 35%, hsla(0,0%,100%,0.5) 50%, hsla(275,80%,85%,0.3) 65%, hsla(275,80%,70%,0.12) 85%, transparent 100%)",
            filter: "blur(25px)",
            animation: "wpLightStreak 0.85s cubic-bezier(0.25,0.1,0.25,1) forwards",
            transform: "translateX(-100%) skewX(-8deg)",
          }} />
          <div style={{
            position: "absolute", top: "-10%", bottom: "-10%", width: "3px",
            background: "linear-gradient(180deg, transparent 5%, hsla(275,80%,85%,0.7) 30%, hsla(0,0%,100%,0.95) 50%, hsla(275,80%,85%,0.7) 70%, transparent 95%)",
            filter: "blur(1px)",
            animation: "wpLightStreak 0.85s cubic-bezier(0.25,0.1,0.25,1) forwards",
            transform: "translateX(-100%) skewX(-8deg)",
          }} />
          <div style={{
            position: "absolute", top: "-30%", bottom: "-30%", width: "60%",
            background: "radial-gradient(ellipse at center, hsla(275,60%,70%,0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
            animation: "wpLightStreak 0.85s cubic-bezier(0.25,0.1,0.25,1) forwards",
            transform: "translateX(-100%) skewX(-5deg)",
          }} />
        </div>
      )}

      <FocusMode active={focusMode} onExit={() => setFocusMode(false)} />

      {asherEmbed && (
        <style>{`
          /* Asher embed: lock dashboard to chat conversations only */
          [data-dashboard-sidebar-nav] { display: none !important; }
          [data-dashboard-mode-switcher] { display: none !important; }
          [data-dashboard-view-switcher] { display: none !important; }
          [data-dashboard-app-launcher] { display: none !important; }
        `}</style>
      )}

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
            publishedAgents={publishedAgents}
          />
        )}

        <main
          className="flex flex-1 flex-col min-w-0 overflow-hidden h-full relative"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/aureon-conversation-id") && splitPanes.length === 0 && activeView === "chat") {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const convId = e.dataTransfer.getData("text/aureon-conversation-id");
            if (convId && splitPanes.length === 0 && activeView === "chat") {
              e.preventDefault();
              // Don't add the currently active conversation
              if (convId !== activeConvId) {
                addSplitPane(activeConvId!);
                addSplitPane(convId);
              }
            }
          }}
        >
          {splitPanes.length > 0 ? (
            <SplitPaneManager
              panes={splitPanes}
              conversations={conversations}
              onRemovePane={(paneId) => {
                const next = splitPanes.filter(p => p.id !== paneId);
                if (next.length <= 1) {
                  // If only one pane left, exit split mode and set it as active
                  if (next.length === 1) setActiveConvId(next[0].conversationId);
                  setSplitPanes([]);
                } else {
                  setSplitPanes(next);
                }
              }}
              onSendMessage={handleSplitSendMessage}
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
              personaSystemPrompt={
                (customPersonas.find(p => p.id === personaId) || builtInPersonas.find(p => p.id === personaId))?.systemPrompt || null
              }
              storedProviders={storedProviders}
              activeBrainId={activeBrainId}
              onBrainChange={setActiveBrainId}
              onDropConversation={(convId) => {
                if (!splitPanes.some(p => p.conversationId === convId)) {
                  addSplitPane(convId);
                }
              }}
              isDraggingConvo={isDraggingConvo}
            />
          ) : (
            <>
              {renderView()}
              {/* Drop zone overlay when dragging a convo onto chat */}
              {isDraggingConvo && activeView === "chat" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none animate-fade-in">
                  <div className="text-center space-y-3 pointer-events-none">
                    <div className="w-16 h-16 mx-auto rounded-2xl border-2 border-dashed border-foreground/30 flex items-center justify-center">
                      <span className="text-2xl font-extralight text-foreground/40">◫</span>
                    </div>
                    <p className="text-xs font-light text-foreground/50">Drop to split view</p>
                  </div>
                </div>
              )}
            </>
          )}
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
      <style>{`
        @keyframes wpFadeIn {
          from { opacity: 0; transform: scale(1.015); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wpLightStreak {
          from { transform: translateX(-50%) skewX(-8deg); }
          to { transform: translateX(calc(100vw + 50%)) skewX(-8deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;


