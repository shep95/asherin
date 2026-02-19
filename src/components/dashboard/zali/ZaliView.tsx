import { useState, useEffect, useRef, useCallback } from "react";
import { Atom, AlertTriangle, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ZaliProject, ZaliMessage, ZaliTab } from "./types";
import type { ChatMode } from "../types";
import type { ResponseDepth } from "../DepthSelector";
import ZaliWorkspace from "./ZaliWorkspace";
import ZaliChatPanel from "./ZaliChatPanel";
import ZaliResearchPanel from "./ZaliResearchPanel";
import ZaliProjectSelector from "./ZaliProjectSelector";
import ZaliAgentsPanel from "./ZaliAgentsPanel";
import ZaliSpecsPanel from "./ZaliSpecsPanel";
import EncryptionBadge from "../EncryptionBadge";
import React from "react";

// Error boundary for ZALI panels
class ZaliErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("ZALI panel error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-12">
          <AlertTriangle className="h-10 w-10 text-destructive/40" />
          <div className="text-center">
            <p className="text-sm font-light text-foreground">Something went wrong</p>
            <button onClick={() => this.setState({ hasError: false })} className="text-xs text-accent mt-2 hover:underline">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS: { id: ZaliTab; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "specs", label: "Specs" },
  { id: "agents", label: "Agents" },
  { id: "research", label: "Research" },
];

const ZaliView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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

  // Load projects
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("zali_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (data) {
        const mapped: ZaliProject[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          designType: p.design_type || "general",
          phase: (p.phase as ZaliProject["phase"]) || "understanding",
          status: p.status || "active",
          researchDomains: [],
          specifications: (p.specifications as Record<string, unknown>) || {},
          costAnalysis: (p.cost_analysis as Record<string, unknown>) || {},
          manufacturing: (p.manufacturing as Record<string, unknown>) || {},
          simulationResults: (p.simulation_results as Record<string, unknown>) || {},
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at),
        }));
        setProjects(mapped);
        if (mapped.length > 0 && !activeProject) setActiveProject(mapped[0]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Load messages when project changes
  useEffect(() => {
    if (!activeProject || !user) { setMessages([]); setFindings([]); return; }
    const loadMessages = async () => {
      const { data } = await supabase
        .from("zali_messages")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data.map((m) => ({
          id: m.id,
          projectId: m.project_id,
          role: m.role as "user" | "assistant",
          content: m.content,
          metadata: (m.metadata as Record<string, unknown>) || {},
          createdAt: new Date(m.created_at),
        })));
      }

      const { data: research } = await supabase
        .from("zali_research")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });

      if (research) {
        setFindings(research.map((r) => ({
          domain: r.domain,
          title: r.title,
          confidence: Number(r.confidence) || 0,
        })));
      }
    };
    loadMessages();
  }, [activeProject, user]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!activeProject) return;
    const channel = supabase
      .channel(`zali-msgs-${activeProject.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "zali_messages",
        filter: `project_id=eq.${activeProject.id}`,
      }, (payload) => {
        const m = payload.new as any;
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === m.id)) return prev;
          return [...prev, {
            id: m.id,
            projectId: m.project_id,
            role: m.role,
            content: m.content,
            metadata: m.metadata || {},
            createdAt: new Date(m.created_at),
          }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject]);

  const createProject = useCallback(async (name: string, designType: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("zali_projects")
      .insert({ user_id: user.id, name, design_type: designType })
      .select()
      .single();

    if (error) {
      console.error("Create project error:", error);
      toast({ title: "Error creating project", description: error.message, variant: "destructive" });
      return;
    }

    if (data) {
      const p: ZaliProject = {
        id: data.id, name: data.name, description: "", designType: data.design_type || "general",
        phase: "understanding", status: "active", researchDomains: [],
        specifications: {}, costAnalysis: {}, manufacturing: {}, simulationResults: {},
        createdAt: new Date(data.created_at), updatedAt: new Date(data.updated_at),
      };
      setProjects((prev) => [p, ...prev]);
      setActiveProject(p);
      setMessages([]);
      setFindings([]);
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

  const renameProject = useCallback(async (id: string, name: string) => {
    await supabase.from("zali_projects").update({ name }).eq("id", id);
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
    if (activeProject?.id === id) setActiveProject((prev) => prev ? { ...prev, name } : null);
  }, [activeProject]);

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
    const assistantMsg: ZaliMessage = {
      id: assistantId, projectId: activeProject.id, role: "assistant",
      content: "", metadata: {}, createdAt: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role, content: m.content,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zali-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: history,
            mode: chatMode,
            depth: chatDepth,
            projectContext: {
              name: activeProject.name,
              description: activeProject.description,
              phase: activeProject.phase,
              designType: activeProject.designType,
            },
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

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              fullContent += text;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
              );
            }
          } catch { /* skip */ }
        }
      }

      await supabase.from("zali_messages").insert({
        id: assistantId, project_id: activeProject.id, user_id: user.id,
        role: "assistant", content: fullContent,
      });

      const researchPatterns = [
        { regex: /\[RESEARCH[:\s]*(.*?)\]/gi, domain: "general" },
        { regex: /\[OPTIMUS\]/gi, domain: "physics" },
        { regex: /\[CHEMIX\]/gi, domain: "chemistry" },
        { regex: /\[BIOX\]/gi, domain: "biology" },
        { regex: /\[SYNTHIA\]/gi, domain: "manufacturing" },
        { regex: /\[ECONIA\]/gi, domain: "economics" },
        { regex: /\[ETHICA\]/gi, domain: "safety" },
      ];

      for (const pattern of researchPatterns) {
        if (pattern.regex.test(fullContent)) {
          const finding = {
            domain: pattern.domain,
            title: `${pattern.domain} analysis from conversation`,
            confidence: 0.8,
          };
          setFindings((prev) => [...prev, finding]);

          await supabase.from("zali_research").insert({
            project_id: activeProject.id,
            user_id: user.id,
            domain: pattern.domain,
            title: finding.title,
            confidence: finding.confidence,
          });
        }
      }

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
  }, [activeProject, user, messages, isStreaming, toast]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case "workspace":
        return <ZaliWorkspace project={activeProject} />;
      case "specs":
        return <ZaliSpecsPanel project={activeProject} />;
      case "agents":
        return <ZaliAgentsPanel />;
      case "research":
        return <ZaliResearchPanel project={activeProject} findings={findings} />;
      default:
        return <ZaliWorkspace project={activeProject} />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Atom className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            <div>
              <h1 className="text-base sm:text-lg font-extralight tracking-wide text-foreground">ZALI</h1>
              <p className="text-[9px] sm:text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">
                Design Intelligence Lab
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile chat toggle */}
            <button
              onClick={() => setShowMobileChat(!showMobileChat)}
              className="md:hidden p-1.5 rounded-lg border border-border/20 text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <MessageCircle className="h-4 w-4" />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
            <div className="hidden sm:block">
              <EncryptionBadge />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 sm:mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-light transition-colors ${
                activeTab === tab.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project selector - inline below header */}
      <ZaliProjectSelector
        projects={projects}
        activeProject={activeProject}
        onSelect={setActiveProject}
        onCreate={createProject}
        onDelete={deleteProject}
        onRename={renameProject}
      />

      {/* Main content */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Left: Tab content */}
        <div className="flex-1 min-w-0">
          <ZaliErrorBoundary key={activeTab}>
            {renderTabContent()}
          </ZaliErrorBoundary>
        </div>

        {/* Desktop: Chat panel */}
        <div className="w-[340px] lg:w-[380px] flex-shrink-0 border-l border-border/20 hidden md:flex flex-col">
          <ZaliErrorBoundary>
             <ZaliChatPanel
              messages={messages}
              project={activeProject}
              isStreaming={isStreaming}
              onSend={sendMessage}
              onStop={stopStreaming}
              mode={chatMode}
              onModeChange={setChatMode}
              depth={chatDepth}
              onDepthChange={setChatDepth}
            />
          </ZaliErrorBoundary>
        </div>

        {/* Mobile: Chat overlay */}
        {showMobileChat && (
          <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Conversation</h3>
              <button
                onClick={() => setShowMobileChat(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
               <ZaliChatPanel
                messages={messages}
                project={activeProject}
                isStreaming={isStreaming}
                onSend={sendMessage}
                onStop={stopStreaming}
                mode={chatMode}
                onModeChange={setChatMode}
                depth={chatDepth}
                onDepthChange={setChatDepth}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZaliView;