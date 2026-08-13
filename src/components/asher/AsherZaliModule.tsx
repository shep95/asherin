// AsherZaliModule — ZALI Design Intelligence reskinned for the Asher Dashboard.
// Reuses every live ZALI panel + the same Supabase data plumbing as ZaliView,
// but wrapped in monochrome / glassmorphic Asher chrome (no Asherin header,
// no atom logo, no accent colors — just the dossier aesthetic).
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import {
  GripVertical,
  Download,
  Shield,
  AlertTriangle,
  MessageSquare,
  X,
  Loader2,
  Plus,
  Trash2,
  Check,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ZaliProject, ZaliMessage, ZaliTab } from "@/components/dashboard/zali/types";
import type { ChatMode } from "@/components/dashboard/types";
import type { ResponseDepth } from "@/components/dashboard/DepthSelector";
import { extractZanoemCodeFiles } from "@/components/dashboard/zali/zanoemOutput";
import React from "react";
import { ADMIN_EMAIL } from "@/lib/adminEmail";

const ZaliWorkspace = lazy(() => import("@/components/dashboard/zali/ZaliWorkspace"));
const ZaliChatPanel = lazy(() => import("@/components/dashboard/zali/ZaliChatPanel"));
const ZaliResearchPanel = lazy(() => import("@/components/dashboard/zali/ZaliResearchPanel"));
const ZaliAgentsPanel = lazy(() => import("@/components/dashboard/zali/ZaliAgentsPanel"));
const ZaliSpecsPanel = lazy(() => import("@/components/dashboard/zali/ZaliSpecsPanel"));
const CommunityView = lazy(() => import("@/components/dashboard/zali/CommunityView"));
const MaterialIntelligencePanel = lazy(() => import("@/components/dashboard/zali/MaterialIntelligencePanel"));
const ComponentLibraryPanel = lazy(() => import("@/components/dashboard/zali/ComponentLibraryPanel"));
const SimulationEnginePanel = lazy(() => import("@/components/dashboard/zali/SimulationEnginePanel"));
const ManufacturingVerifyPanel = lazy(() => import("@/components/dashboard/zali/ManufacturingVerifyPanel"));
const OptimizationPanel = lazy(() => import("@/components/dashboard/zali/OptimizationPanel"));
const GodModePanel = lazy(() => import("@/components/dashboard/zali/GodModePanel"));
// Asher-themed tab definitions — Unicode markers, no colored icons
const TABS: { id: ZaliTab; label: string; mark: string }[] = [
  { id: "workspace",    label: "Workspace",     mark: "◈" },
  { id: "specs",        label: "Specs",         mark: "◉" },
  { id: "materials-db", label: "Materials",     mark: "◆" },
  { id: "components",   label: "Components",    mark: "◇" },
  { id: "sim-engine",   label: "Simulation",    mark: "◐" },
  { id: "mfg-verify",   label: "Manufacture",   mark: "◑" },
  { id: "optimization", label: "Optimize",      mark: "◒" },
  { id: "agents",       label: "Agents",        mark: "◓" },
  { id: "research",     label: "Research",      mark: "◔" },
  { id: "god-mode",     label: "God Mode",      mark: "◕" },
  { id: "community",    label: "Community",     mark: "◖" },
];

class ZaliErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("ZALI panel error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-12">
          <AlertTriangle className="h-8 w-8 text-foreground/30" strokeWidth={1.2} />
          <p className="text-[11px] font-light tracking-[0.2em] text-muted-foreground/80 uppercase">Panel Fault</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-[10px] tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground transition border border-border/30 px-3 py-1.5 rounded"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PanelLoader = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Loader2 className="h-4 w-4 animate-spin text-foreground/40" strokeWidth={1.2} />
  </div>
);

const AsherZaliModule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [downloading, setDownloading] = useState(false);
  const [projects, setProjects] = useState<ZaliProject[]>([]);
  const [activeProject, setActiveProject] = useState<ZaliProject | null>(null);
  const [messages, setMessages] = useState<ZaliMessage[]>([]);
  const [findings, setFindings] = useState<Array<{ domain: string; title: string; confidence: number }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<ZaliTab>("workspace");
  const [loading, setLoading] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [chatDepth, setChatDepth] = useState<ResponseDepth>("standard");
  const abortRef = useRef<AbortController | null>(null);
  const [autopilot, setAutopilot] = useState(() => localStorage.getItem("asherZanoem.autopilot") === "1");
  const autopilotRoundsRef = useRef(0);
  const wasStreamingRef = useRef(false);
  const AUTOPILOT_MAX_ROUNDS = 6;
  useEffect(() => { localStorage.setItem("asherZanoem.autopilot", autopilot ? "1" : "0"); }, [autopilot]);
  const [autoBuildModel, setAutoBuildModel] = useState(false);
  const [modelPrompt, setModelPrompt] = useState("");
  const [codeFiles, setCodeFiles] = useState<Array<{ filename: string; language: string; content: string }>>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    const latestCode = [...messages].reverse().find((m) => m.role === "assistant" && extractZanoemCodeFiles(m.content).length > 0);
    if (!latestCode) return;
    const files = extractZanoemCodeFiles(latestCode.content);
    if (files.length) setCodeFiles(files);
  }, [messages]);

  // Resizable chat width
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem("asher_zali_chat_width");
    return saved ? Math.max(280, Math.min(640, parseInt(saved, 10))) : 380;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = chatWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const w = Math.max(280, Math.min(640, dragStartWidth.current + delta));
      setChatWidth(w);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setChatWidth((w) => { localStorage.setItem("asher_zali_chat_width", String(w)); return w; });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [chatWidth]);

  // Load projects
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("zali_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (data) {
        const mapped: ZaliProject[] = data.map((p) => ({
          id: p.id, name: p.name, description: p.description || "",
          designType: p.design_type || "general",
          phase: (p.phase as ZaliProject["phase"]) || "understanding",
          status: p.status || "active", researchDomains: [],
          specifications: (p.specifications as Record<string, unknown>) || {},
          costAnalysis: (p.cost_analysis as Record<string, unknown>) || {},
          manufacturing: (p.manufacturing as Record<string, unknown>) || {},
          simulationResults: (p.simulation_results as Record<string, unknown>) || {},
          createdAt: new Date(p.created_at), updatedAt: new Date(p.updated_at),
        }));
        setProjects(mapped);
        if (mapped.length > 0 && !activeProject) setActiveProject(mapped[0]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load messages + findings
  useEffect(() => {
    if (!activeProject || !user) { setMessages([]); setFindings([]); return; }
    (async () => {
      const { data } = await supabase
        .from("zali_messages").select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((m) => ({
          id: m.id, projectId: m.project_id, role: m.role as "user" | "assistant",
          content: m.content, metadata: (m.metadata as Record<string, unknown>) || {},
          createdAt: new Date(m.created_at),
        })));
      }
      const { data: research } = await supabase
        .from("zali_research").select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });
      if (research) {
        setFindings(research.map((r) => ({
          domain: r.domain, title: r.title, confidence: Number(r.confidence) || 0,
        })));
      }
    })();
  }, [activeProject, user]);

  // Realtime
  useEffect(() => {
    if (!activeProject) return;
    const channel = supabase
      .channel(`asher-zali-msgs-${activeProject.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "zali_messages",
        filter: `project_id=eq.${activeProject.id}`,
      }, (payload) => {
        const m = payload.new as any;
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === m.id)) return prev;
          return [...prev, {
            id: m.id, projectId: m.project_id, role: m.role,
            content: m.content, metadata: m.metadata || {}, createdAt: new Date(m.created_at),
          }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject]);

  const createProject = useCallback(async (name: string) => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase
      .from("zali_projects")
      .insert({ user_id: user.id, name: name.trim(), design_type: "general" })
      .select().single();
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      const p: ZaliProject = {
        id: data.id, name: data.name, description: "",
        designType: data.design_type || "general", phase: "understanding",
        status: "active", researchDomains: [], specifications: {},
        costAnalysis: {}, manufacturing: {}, simulationResults: {},
        createdAt: new Date(data.created_at), updatedAt: new Date(data.updated_at),
      };
      setProjects((prev) => [p, ...prev]);
      setActiveProject(p);
      setMessages([]); setFindings([]);
      setNewProjectName(""); setShowProjectMenu(false);
      toast({ title: "Project created", description: name });
    }
  }, [user, toast]);

  const deleteProject = useCallback(async (id: string) => {
    await supabase.from("zali_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveProject(remaining[0] || null);
    }
  }, [activeProject, projects]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeProject || !user || isStreaming) return;
    const userMsgId = crypto.randomUUID();
    const userMsg: ZaliMessage = {
      id: userMsgId, projectId: activeProject.id, role: "user",
      content, metadata: {}, createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    await supabase.from("zali_messages").insert({
      id: userMsgId, project_id: activeProject.id, user_id: user.id,
      role: "user", content,
    });

    setIsStreaming(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, {
      id: assistantId, projectId: activeProject.id, role: "assistant",
      content: "", metadata: {}, createdAt: new Date(),
    }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      let brainContext: { prompt: string; fileContents: { name: string; content: string }[] } | null = null;

      const activeBrainId = localStorage.getItem("aureon_active_brain_id");
      if (activeBrainId) {
        try {
          const { data: brain } = await supabase.from("brains").select("system_prompt, file_ids").eq("id", activeBrainId).single();
          if (brain) {
            const fileContents: { name: string; content: string }[] = [];
            if (brain.file_ids?.length) {
              const { data: files } = await supabase.from("library_files").select("file_name, storage_path, file_type").in("id", brain.file_ids);
              if (files) {
                for (const f of files) {
                  const isText = !f.file_type.startsWith("image/") && !f.file_type.startsWith("video/") && !f.file_type.startsWith("audio/");
                  if (!isText) continue;
                  const { data: blob } = await supabase.storage.from("library").download(f.storage_path);
                  if (blob) fileContents.push({ name: f.file_name, content: (await blob.text()).slice(0, 80000) });
                }
              }
            }
            brainContext = { prompt: brain.system_prompt || "", fileContents };
          }
        } catch (e) { console.error("Failed to load ZANOEM brain context:", e); }
      }
      let _zaliToken: string | undefined;
      try {
        const { data: { session: _zaliSession } } = await supabase.auth.getSession();
        _zaliToken = _zaliSession?.access_token;
      } catch (e) {
        console.error("[Zali] getSession failed", e);
      }
      if (!_zaliToken) throw new Error("Sign in required to use Zali chat.");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zali-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${_zaliToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: history, mode: chatMode, depth: chatDepth,
            projectContext: {
              name: activeProject.name, description: activeProject.description,
              phase: activeProject.phase, designType: activeProject.designType,
            },
            brainContext,
          }),
          signal: controller.signal,
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              fullContent += text;
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m));
            }
          } catch { /* skip */ }
        }
      }

      await supabase.from("zali_messages").insert({
        id: assistantId, project_id: activeProject.id, user_id: user.id,
        role: "assistant", content: fullContent,
      });

      // Code output always routes into the workspace, never the chat bubble.
      const allFiles = extractZanoemCodeFiles(fullContent);
      if (allFiles.length) { setCodeFiles(allFiles); setActiveTab("workspace"); }

      // Design output → project state
      const designMatch = fullContent.match(/```design_output\n([\s\S]*?)```/);
      if (designMatch) {
        try {
          const d = JSON.parse(designMatch[1]);
          const payload: Record<string, unknown> = {};
          if (d.phase) payload.phase = d.phase;
          if (d.design_type) payload.design_type = d.design_type;
          if (d.specifications) payload.specifications = d.specifications;
          if (d.cost_analysis) payload.cost_analysis = d.cost_analysis;
          if (d.manufacturing) payload.manufacturing = d.manufacturing;
          if (d.simulation_results) payload.simulation_results = d.simulation_results;
          if (Object.keys(payload).length) {
            await supabase.from("zali_projects").update(payload).eq("id", activeProject.id);
            setActiveProject((prev) => prev ? {
              ...prev,
              phase: (d.phase as ZaliProject["phase"]) || prev.phase,
              designType: d.design_type || prev.designType,
              specifications: d.specifications || prev.specifications,
              costAnalysis: d.cost_analysis || prev.costAnalysis,
              manufacturing: d.manufacturing || prev.manufacturing,
              simulationResults: d.simulation_results || prev.simulationResults,
            } : prev);
            setAutoBuildModel(true);
            setActiveTab("workspace");
          }
        } catch (e) { console.error(e); }
      }

      const buildRe = /\b(build|generate|create|show|render|visualize)\b.*\b(3d|model|design|prototype|viewport)\b/i;
      const lc = content.toLowerCase();
      if (buildRe.test(lc)) { setAutoBuildModel(true); setActiveTab("workspace"); }
      const describe = lc.match(/(?:make it|design it|style it|model should be|i want it to look)\s+(.+)/i);
      if (describe) setModelPrompt(describe[1].trim());

    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("ZALI chat error:", err);
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [activeProject, user, messages, isStreaming, chatMode, chatDepth, toast]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    autopilotRoundsRef.current = 0;
  }, []);

  // ── "You Decide ZANOEM" autopilot helpers ──
  const needsHumanDecision = useCallback((text: string): boolean => {
    if (!text) return false;
    const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
    if (!stripped) return false;
    const lower = stripped.toLowerCase();
    if (/\?\s*$/m.test(stripped)) return true;
    const cues = [
      "would you like", "do you want", "should i", "shall i",
      "which option", "which one", "which approach", "which would you",
      "let me know", "your preference", "your choice", "your call",
      "please confirm", "please choose", "please pick", "please select",
      "option a", "option 1", "recommendation:", "recommendations:",
      "which do you prefer", "what would you like", "what do you want",
      "next steps?", "proceed?", "continue?", "ready to proceed",
    ];
    return cues.some((c) => lower.includes(c));
  }, []);

  const buildAutopilotReply = useCallback((round: number, max: number): string => [
    `[YOU DECIDE ZANOEM — autopilot round ${round}/${max}]`,
    "",
    "Decide on my behalf. Pick the best option from your recommendations and proceed.",
    "Rules:",
    "- Make every decision yourself using first-principles reasoning.",
    "- Choose the most production-ready, secure, and maintainable path.",
    "- Do NOT ask me any more questions in this round.",
    "- Continue building / writing / fixing until the task is complete.",
    "- If the task is functionally complete, say 'AUTOPILOT COMPLETE' and stop.",
  ].join("\n"), []);

  // Wrap sendMessage so user-initiated turns reset the autopilot counter.
  const sendMessageHuman = useCallback((content: string) => {
    autopilotRoundsRef.current = 0;
    void sendMessage(content);
  }, [sendMessage]);

  // Watcher: when streaming finishes, if autopilot is on and ZANOEM asked
  // a question / made a recommendation, auto-reply on the human's behalf.
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const last = messages[messages.length - 1];
      if (
        autopilot &&
        last?.role === "assistant" &&
        last.content &&
        needsHumanDecision(last.content) &&
        autopilotRoundsRef.current < AUTOPILOT_MAX_ROUNDS
      ) {
        autopilotRoundsRef.current += 1;
        const reply = buildAutopilotReply(autopilotRoundsRef.current, AUTOPILOT_MAX_ROUNDS);
        const t = setTimeout(() => { void sendMessage(reply); }, 400);
        wasStreamingRef.current = isStreaming;
        return () => clearTimeout(t);
      } else if (autopilotRoundsRef.current > 0) {
        toast({
          title: "ZANOEM autopilot complete",
          description: `${autopilotRoundsRef.current} round${autopilotRoundsRef.current === 1 ? "" : "s"} executed`,
        });
        autopilotRoundsRef.current = 0;
      }
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, messages, autopilot, needsHumanDecision, buildAutopilotReply, sendMessage, toast]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "workspace":    return <ZaliWorkspace project={activeProject} autoBuild={autoBuildModel} modelPrompt={modelPrompt} codeFiles={codeFiles} />;
      case "specs":        return <ZaliSpecsPanel project={activeProject} />;
      case "materials-db": return <MaterialIntelligencePanel />;
      case "components":   return <ComponentLibraryPanel />;
      case "sim-engine":   return <SimulationEnginePanel project={activeProject} />;
      case "mfg-verify":   return <ManufacturingVerifyPanel project={activeProject} />;
      case "optimization": return <OptimizationPanel project={activeProject} />;
      case "agents":       return <ZaliAgentsPanel />;
      case "research":     return <ZaliResearchPanel project={activeProject} findings={findings} />;
      case "god-mode":     return <GodModePanel />;
      case "community":    return <CommunityView />;
      default:             return <ZaliWorkspace project={activeProject} autoBuild={autoBuildModel} modelPrompt={modelPrompt} codeFiles={codeFiles} />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/40" strokeWidth={1.2} />
        <span className="ml-3 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/80">
          Booting ZANOEM ◈ Design Intelligence
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* === ASHER-THEMED HEADER ============================================ */}
      <div className="flex-shrink-0 border-b border-border/15 bg-card/30 backdrop-blur-md">
        {/* Title row */}
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-foreground/70 text-base leading-none select-none">◈</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[13px] font-light tracking-[0.25em] uppercase text-foreground truncate">ZANOEM</h1>
                <span className="text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/60 hidden sm:inline">
                  Design Intelligence
                </span>
              </div>
              <p className="text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/50 hidden sm:block mt-0.5">
                FEA · Thermal · Manufacturing · Optimization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Project selector trigger */}
            <button
              onClick={() => setShowProjectMenu((v) => !v)}
              className="text-[10px] tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground border border-border/30 hover:border-border/60 px-2.5 py-1.5 rounded transition-colors max-w-[180px] truncate"
              title="Switch project"
            >
              {activeProject ? activeProject.name : "No Project"}
            </button>

            {isAdmin && (
              <button
                onClick={async () => {
                  setDownloading(true);
                  try {
                    const res = await fetch("/docs/ZALI_BLUEPRINT.md");
                    const text = await res.text();
                    const blob = new Blob([text], { type: "text/markdown" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "ZALI_BLUEPRINT_INTERNAL.md"; a.click();
                    URL.revokeObjectURL(url);
                  } finally { setDownloading(false); }
                }}
                disabled={downloading}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border/30 hover:border-border/60 text-foreground/70 hover:text-foreground text-[10px] tracking-[0.2em] uppercase transition-colors disabled:opacity-50"
                title="Blueprint (Admin)"
              >
                <Shield className="h-3 w-3" strokeWidth={1.4} />
                <Download className="h-3 w-3" strokeWidth={1.4} />
                <span>{downloading ? "…" : "Blueprint"}</span>
              </button>
            )}

            <button
              onClick={() => setShowMobileChat(!showMobileChat)}
              className="md:hidden p-2 rounded border border-border/30 text-foreground/70 hover:text-foreground transition relative"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.4} />
              {messages.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-foreground/70" />
              )}
            </button>
          </div>
        </div>

        {/* Project menu drawer */}
        {showProjectMenu && (
          <div className="border-t border-border/10 bg-background/60 backdrop-blur-md px-4 sm:px-6 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createProject(newProjectName); }}
                placeholder="New project name…"
                className="flex-1 bg-transparent border border-border/30 focus:border-border/70 outline-none rounded px-2.5 py-1.5 text-[11px] font-light tracking-wide text-foreground placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => createProject(newProjectName)}
                disabled={!newProjectName.trim()}
                className="px-3 py-1.5 rounded border border-border/30 hover:border-border/60 text-foreground/80 hover:text-foreground text-[10px] tracking-[0.2em] uppercase transition disabled:opacity-40 flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" strokeWidth={1.4} /> Create
              </button>
            </div>
            {projects.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] font-light tracking-wide cursor-pointer transition ${
                      activeProject?.id === p.id
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                    }`}
                    onClick={() => { setActiveProject(p); setShowProjectMenu(false); }}
                  >
                    <span className="text-foreground/40 text-xs">{activeProject?.id === p.id ? "◉" : "◯"}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/50">{p.phase}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-foreground transition"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.4} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab bar — monochrome, Unicode marks, no atom icon */}
        <div className="border-t border-border/10 px-2 sm:px-4 flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap relative px-3 sm:px-4 py-2.5 text-[10px] font-light tracking-[0.2em] uppercase transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground/70 hover:text-foreground/90"
                }`}
              >
                <span className={`text-[11px] leading-none ${isActive ? "text-foreground/80" : "text-foreground/30"}`}>{tab.mark}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute left-2 right-2 -bottom-px h-px bg-foreground/60" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* === MAIN CONTENT =================================================== */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Left: tab content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ZaliErrorBoundary key={activeTab}>
            <Suspense fallback={<PanelLoader />}>
              {renderTabContent()}
            </Suspense>
          </ZaliErrorBoundary>
        </div>

        {/* Desktop: resizable chat */}
        <div className="hidden md:flex flex-shrink-0 relative">
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 bottom-0 w-2 z-10 cursor-col-resize group flex items-center justify-center hover:bg-foreground/5 transition -translate-x-1/2"
            title="Drag to resize"
          >
            <div className="w-px h-8 bg-border/40 group-hover:bg-foreground/40 transition-colors" />
          </div>
          <div
            style={{ width: chatWidth }}
            className="border-l border-border/15 bg-card/20 backdrop-blur-sm flex flex-col overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border/10 flex items-center gap-2 flex-wrap">
              <span className="text-foreground/50 text-xs">◈</span>
              <span className="text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/80">
                ZANOEM Conversation
              </span>
              <label
                title="You Decide ZANOEM: autopilot. ZANOEM auto-answers its own questions and recommendations on your behalf for up to 6 rounds. Includes auto-fix loop and vision UI verification."
                className={`ml-2 inline-flex items-center gap-1 text-[8.5px] font-light tracking-[0.2em] uppercase cursor-pointer ${
                  autopilot ? "text-foreground" : "text-muted-foreground/70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={autopilot}
                  onChange={(e) => setAutopilot(e.target.checked)}
                  className="accent-foreground h-2.5 w-2.5"
                />
                <Zap className="h-2.5 w-2.5" />
                You Decide ZANOEM
                {autopilot && autopilotRoundsRef.current > 0 && (
                  <span className="ml-1 text-foreground/70">{autopilotRoundsRef.current}/{AUTOPILOT_MAX_ROUNDS}</span>
                )}
              </label>
              {isStreaming && (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-foreground/60 animate-pulse" />
                  <span className="text-[9px] tracking-[0.25em] uppercase text-foreground/60">live</span>
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ZaliErrorBoundary>
                <Suspense fallback={<PanelLoader />}>
                  <ZaliChatPanel
                    messages={messages}
                    project={activeProject}
                    isStreaming={isStreaming}
                    onSend={sendMessageHuman}
                    onStop={stopStreaming}
                    mode={chatMode}
                    onModeChange={setChatMode}
                    depth={chatDepth}
                    onDepthChange={setChatDepth}
                  />
                </Suspense>
              </ZaliErrorBoundary>
            </div>
          </div>
        </div>

        {/* Mobile chat overlay */}
        {showMobileChat && (
          <div className="absolute inset-0 z-30 bg-background/98 backdrop-blur-md flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/15 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-foreground/60 text-xs">◈</span>
                <h3 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground">
                  ZANOEM Conversation
                </h3>
              </div>
              <button
                onClick={() => setShowMobileChat(false)}
                className="p-2 rounded text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.4} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Suspense fallback={<PanelLoader />}>
                <ZaliChatPanel
                  messages={messages}
                  project={activeProject}
                  isStreaming={isStreaming}
                  onSend={sendMessageHuman}
                  onStop={stopStreaming}
                  mode={chatMode}
                  onModeChange={setChatMode}
                  depth={chatDepth}
                  onDepthChange={setChatDepth}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsherZaliModule;
