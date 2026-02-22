import { useState, useRef, useCallback, useEffect } from "react";
import { Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Globe, FileCode, FolderKanban, Save, Loader2, Maximize2, Minimize2, Download, Search, Brain, Package, AlertTriangle, Terminal as TerminalIcon, Sparkles } from "lucide-react";
import IdeFileTree, { type IdeFile, getLanguage } from "./IdeFileTree";
import IdeCodeEditor from "./IdeCodeEditor";
import IdeChatPanel from "./IdeChatPanel";
import IdeTerminal from "./IdeTerminal";
import IdePreviewPanel from "./IdePreviewPanel";
import IdeSessionManager, { type IdeSession } from "./IdeSessionManager";
import IdeCommandPalette from "./IdeCommandPalette";
import IdeSearchPanel from "./IdeSearchPanel";
import IdeProblemsPanel from "./IdeProblemsPanel";
import IdeAiLogPanel, { type AiLogEntry } from "./IdeAiLogPanel";
import IdeQuickOpen from "./IdeQuickOpen";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FeedbackType } from "../CalibrationFeedback";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type CenterTab = "code" | "preview";
type MobilePanel = "explorer" | "editor" | "chat" | "terminal";
type LeftTab = "files" | "search" | "sessions";
type BottomTab = "terminal" | "problems" | "ai-log";

const STARTER_FILES: IdeFile[] = [
  {
    id: "src", name: "src", type: "folder", children: [
      { id: "app", name: "App.tsx", type: "file", content: `import React from "react";\n\nfunction App() {\n  return (\n    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">\n      <h1 className="text-4xl font-bold">Hello World</h1>\n    </div>\n  );\n}\n\nexport default App;` },
      { id: "main", name: "main.tsx", type: "file", content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);` },
      { id: "css", name: "index.css", type: "file", content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: Inter, sans-serif;\n}` },
    ],
  },
  { id: "pkg", name: "package.json", type: "file", content: `{\n  "name": "aureon-project",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}` },
  { id: "tsconfig", name: "tsconfig.json", type: "file", content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "jsx": "react-jsx",\n    "strict": true\n  }\n}` },
  { id: "indexhtml", name: "index.html", type: "file", content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Aureon Project</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>` },
];

function flattenFiles(files: IdeFile[]): IdeFile[] {
  const result: IdeFile[] = [];
  for (const f of files) {
    if (f.type === "file") result.push(f);
    if (f.children) result.push(...flattenFiles(f.children));
  }
  return result;
}

function getBreadcrumbs(files: IdeFile[], targetId: string): string[] {
  const find = (nodes: IdeFile[], path: string[]): string[] | null => {
    for (const n of nodes) {
      if (n.id === targetId) return [...path, n.name];
      if (n.children) {
        const found = find(n.children, [...path, n.name]);
        if (found) return found;
      }
    }
    return null;
  };
  return find(files, []) ?? [];
}

const AureonIdeView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Session state
  const [sessions, setSessions] = useState<IdeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // File state
  const [files, setFiles] = useState<IdeFile[]>(STARTER_FILES);
  const [openFileIds, setOpenFileIds] = useState<string[]>(["app"]);
  const [activeFileId, setActiveFileId] = useState<string | null>("app");

  // Panel state
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(!isMobile);
  const [bottomOpen, setBottomOpen] = useState(!isMobile);
  const [centerTab, setCenterTab] = useState<CenterTab>("code");
  const [zenMode, setZenMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [consciousnessMode, setConsciousnessMode] = useState(false);

  // Tab state for panels
  const [leftTab, setLeftTab] = useState<LeftTab>("files");
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");

  // Mobile
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // AI Activity Log
  const [aiLogs, setAiLogs] = useState<AiLogEntry[]>([
    { id: "init", timestamp: new Date(), type: "scan", message: "IDE initialized — Codebase Consciousness ready" },
  ]);

  const addAiLog = useCallback((type: AiLogEntry["type"], message: string) => {
    setAiLogs(prev => [...prev, { id: crypto.randomUUID(), timestamp: new Date(), type, message }]);
  }, []);

  // Derived
  const allFiles = flattenFiles(files);
  const openFiles = openFileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as IdeFile[];
  const activeFile = allFiles.find(f => f.id === activeFileId);
  const breadcrumbs = activeFileId ? getBreadcrumbs(files, activeFileId) : [];

  useEffect(() => {
    if (isMobile) { setLeftOpen(false); setRightOpen(false); setBottomOpen(false); }
  }, [isMobile]);

  // ── Session CRUD ──
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("ide_sessions").select("id, name, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
    setSessions((data as IdeSession[]) ?? []);
    setSessionsLoading(false);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadSession = useCallback(async (id: string) => {
    const { data } = await supabase.from("ide_sessions").select("*").eq("id", id).single();
    if (data) {
      setFiles(data.files as unknown as IdeFile[]);
      setOpenFileIds(data.open_file_ids ?? []);
      setActiveFileId(data.active_file_id ?? null);
      const cfg = data.panel_config as any;
      if (cfg && !isMobile) { setLeftOpen(cfg.leftOpen ?? true); setRightOpen(cfg.rightOpen ?? true); setBottomOpen(cfg.bottomOpen ?? true); }
      setActiveSessionId(id);
      setChatMessages([]);
      setLeftTab("files");
      addAiLog("scan", `Session loaded — scanning ${flattenFiles(data.files as unknown as IdeFile[]).length} files`);
      if (isMobile) setMobilePanel("editor");
    }
  }, [isMobile, addAiLog]);

  const createSession = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("ide_sessions").insert({ user_id: user.id, name: `Project ${sessions.length + 1}`, files: STARTER_FILES as any, open_file_ids: ["app"], active_file_id: "app" }).select("id, name, updated_at").single();
    if (data) { setSessions(prev => [data as IdeSession, ...prev]); loadSession(data.id); }
  }, [user, sessions.length, loadSession]);

  const deleteSession = useCallback(async (id: string) => {
    await supabase.from("ide_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setFiles(STARTER_FILES); setOpenFileIds(["app"]); setActiveFileId("app"); }
  }, [activeSessionId]);

  const renameSession = useCallback(async (id: string, name: string) => {
    await supabase.from("ide_sessions").update({ name }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const saveSession = useCallback(async () => {
    if (!activeSessionId || !user) return;
    setSaving(true);
    await supabase.from("ide_sessions").update({ files: files as any, open_file_ids: openFileIds, active_file_id: activeFileId, panel_config: { leftOpen, rightOpen, bottomOpen } as any }).eq("id", activeSessionId);
    setSaving(false);
    toast({ title: "Session saved" });
    addAiLog("scan", "Session saved successfully");
  }, [activeSessionId, user, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen, toast, addAiLog]);

  // Auto-save
  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(() => {
      supabase.from("ide_sessions").update({ files: files as any, open_file_ids: openFileIds, active_file_id: activeFileId, panel_config: { leftOpen, rightOpen, bottomOpen } as any }).eq("id", activeSessionId);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeSessionId, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveSession(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCommandPaletteOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "p") { e.preventDefault(); setQuickOpenOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); setLeftOpen(p => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") { e.preventDefault(); setBottomOpen(p => !p); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") { e.preventDefault(); setLeftTab("search"); setLeftOpen(true); }
      if (e.key === "Escape" && zenMode) setZenMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveSession, zenMode]);

  // ── File operations ──
  const selectFile = (file: IdeFile) => {
    if (!openFileIds.includes(file.id)) setOpenFileIds(prev => [...prev, file.id]);
    setActiveFileId(file.id);
    setCenterTab("code");
    if (isMobile) setMobilePanel("editor");
  };

  const closeTab = (id: string) => {
    setOpenFileIds(prev => {
      const next = prev.filter(fid => fid !== id);
      if (activeFileId === id) setActiveFileId(next[next.length - 1] ?? null);
      return next;
    });
  };

  const updateContent = (id: string, content: string) => {
    const updateInTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.map(n => {
        if (n.id === id) return { ...n, content };
        if (n.children) return { ...n, children: updateInTree(n.children) };
        return n;
      });
    setFiles(prev => updateInTree(prev));
  };

  const createFile = (parentId: string | null, name: string, type: "file" | "folder") => {
    const newFile: IdeFile = { id: crypto.randomUUID(), name, type, content: type === "file" ? "" : undefined, children: type === "folder" ? [] : undefined };
    if (!parentId) { setFiles(prev => [...prev, newFile]); }
    else {
      const addToParent = (nodes: IdeFile[]): IdeFile[] =>
        nodes.map(n => {
          if (n.id === parentId && n.type === "folder") return { ...n, children: [...(n.children || []), newFile] };
          if (n.children) return { ...n, children: addToParent(n.children) };
          return n;
        });
      setFiles(prev => addToParent(prev));
    }
    if (type === "file") selectFile(newFile);
    addAiLog("scan", `Created ${type}: ${name}`);
  };

  const deleteFile = (id: string) => {
    const removeFromTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.filter(n => n.id !== id).map(n => n.children ? { ...n, children: removeFromTree(n.children) } : n);
    setFiles(prev => removeFromTree(prev));
    closeTab(id);
  };

  const renameFile = (id: string, newName: string) => {
    const renameInTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.map(n => {
        if (n.id === id) return { ...n, name: newName };
        if (n.children) return { ...n, children: renameInTree(n.children) };
        return n;
      });
    setFiles(prev => renameInTree(prev));
  };

  // Export ZIP
  const exportProject = useCallback(async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const addToZip = (nodes: IdeFile[], path: string) => {
      for (const n of nodes) {
        if (n.type === "file" && n.content !== undefined) zip.file(`${path}${n.name}`, n.content);
        if (n.children) addToZip(n.children, `${path}${n.name}/`);
      }
    };
    addToZip(files, "");
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessions.find(s => s.id === activeSessionId)?.name ?? "aureon-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Project downloaded as ZIP." });
    addAiLog("scan", "Project exported as ZIP");
  }, [files, sessions, activeSessionId, toast, addAiLog]);

  // ── Chat ──
  const sendChatMessage = useCallback(async (content: string) => {
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setSuggestions([]);
    addAiLog("suggest", `Processing: "${content.slice(0, 50)}..."`);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    const allMsgs = [...chatMessages, userMsg].map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (activeFile?.content) {
      allMsgs.unshift({ role: "user" as const, content: `[IDE Context] Currently editing: ${activeFile.name}\n\`\`\`${getLanguage(activeFile.name)}\n${activeFile.content.slice(0, 4000)}\n\`\`\`` });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: allMsgs, mode: "code", depth: "deep", signal: controller.signal,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === assistantId) return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            return [...prev, { id: assistantId, role: "assistant", content: assistantContent, timestamp: new Date() }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
          addAiLog("suggest", "Response completed");
          fetchSuggestions(assistantContent).then(setSuggestions).catch(() => {});
        },
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setChatMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `Error: ${err.message}`, timestamp: new Date() }]);
        addAiLog("fix", `Error: ${err.message}`);
      }
      setIsStreaming(false);
    }
  }, [chatMessages, activeFile, addAiLog]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); setIsStreaming(false); }, []);

  const handleTerminalAiCommand = useCallback((query: string) => {
    sendChatMessage(query);
    if (!rightOpen && !isMobile) setRightOpen(true);
    if (isMobile) setMobilePanel("chat");
  }, [sendChatMessage, rightOpen, isMobile]);

  const handleAiFix = useCallback((problemsText: string) => {
    sendChatMessage(`Fix these problems in my code:\n${problemsText}`);
    if (!rightOpen) setRightOpen(true);
    addAiLog("fix", "AI Fix requested for detected problems");
  }, [sendChatMessage, rightOpen, addAiLog]);

  // Command palette actions
  const commandActions = [
    { id: "save", label: "Save Session", shortcut: "⌘S", action: saveSession },
    { id: "export", label: "Export as ZIP", action: exportProject },
    { id: "quick-open", label: "Go to File", shortcut: "⌘P", action: () => setQuickOpenOpen(true) },
    { id: "find-in-files", label: "Find in Files", shortcut: "⌘⇧F", action: () => { setLeftTab("search"); setLeftOpen(true); } },
    { id: "zen", label: zenMode ? "Exit Zen Mode" : "Enter Zen Mode", action: () => setZenMode(!zenMode) },
    { id: "preview", label: "Toggle Preview", action: () => setCenterTab(t => t === "code" ? "preview" : "code") },
    { id: "terminal", label: "Toggle Terminal", shortcut: "⌘J", action: () => setBottomOpen(p => !p) },
    { id: "sidebar", label: "Toggle Sidebar", shortcut: "⌘B", action: () => setLeftOpen(p => !p) },
    { id: "chat", label: "Toggle AI Chat", action: () => setRightOpen(p => !p) },
    { id: "problems", label: "Show Problems", action: () => { setBottomTab("problems"); setBottomOpen(true); } },
    { id: "ai-log", label: "Show AI Activity", action: () => { setBottomTab("ai-log"); setBottomOpen(true); } },
    { id: "consciousness", label: consciousnessMode ? "Disable Consciousness Mode" : "Enable Consciousness Mode", action: () => setConsciousnessMode(!consciousnessMode) },
    { id: "sessions", label: "Manage Sessions", action: () => { setLeftTab("sessions"); setLeftOpen(true); } },
    { id: "new-file", label: "New File", action: () => createFile(null, "untitled.tsx", "file") },
    { id: "new-folder", label: "New Folder", action: () => createFile(null, "new-folder", "folder") },
  ];

  // Left sidebar icon tabs
  const leftSidebarIcons: { id: LeftTab; icon: React.ElementType; label: string }[] = [
    { id: "files", icon: FolderKanban, label: "Explorer" },
    { id: "search", icon: Search, label: "Search" },
    { id: "sessions", icon: Package, label: "Sessions" },
  ];

  // Bottom panel tabs
  const bottomTabs: { id: BottomTab; icon: React.ElementType; label: string }[] = [
    { id: "terminal", icon: TerminalIcon, label: "Terminal" },
    { id: "problems", icon: AlertTriangle, label: "Problems" },
    { id: "ai-log", icon: Brain, label: "AI Activity" },
  ];

  // ── Zen Mode ──
  if (zenMode) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-1 bg-card/10 border-b border-border/10">
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-accent/50" />
            <span className="text-[10px] font-light text-muted-foreground/40">ZEN MODE</span>
            {activeFile && <span className="text-[10px] text-accent/50">{activeFile.name}</span>}
          </div>
          <button onClick={() => setZenMode(false)} className="p-1.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Exit (Esc)">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <IdeCodeEditor openFiles={activeFile ? [activeFile] : []} activeFileId={activeFileId} onSelectTab={setActiveFileId} onCloseTab={closeTab} onContentChange={updateContent} />
        </div>
      </div>
    );
  }

  // ── Mobile Layout ──
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 bg-card/20 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5 text-accent/70" />
            <span className="text-[10px] font-light tracking-widest text-foreground/80">IDE</span>
            {consciousnessMode && <Brain className="h-3 w-3 text-cyan-400 animate-pulse" />}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setConsciousnessMode(!consciousnessMode)} className={`p-1.5 rounded-md transition-colors ${consciousnessMode ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground/50"}`}>
              <Brain className="h-3.5 w-3.5" />
            </button>
            <button onClick={saveSession} disabled={!activeSessionId || saving} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </button>
            <button onClick={exportProject} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {mobilePanel === "explorer" && (
            leftTab === "sessions" ? (
              <IdeSessionManager sessions={sessions} activeSessionId={activeSessionId} loading={sessionsLoading} onSelect={loadSession} onCreate={createSession} onDelete={deleteSession} onRename={renameSession} />
            ) : leftTab === "search" ? (
              <IdeSearchPanel files={files} onOpenFile={selectFile} />
            ) : (
              <IdeFileTree files={files} activeFileId={activeFileId} onSelectFile={selectFile} onCreateFile={createFile} onDeleteFile={deleteFile} onRenameFile={renameFile} />
            )
          )}
          {mobilePanel === "editor" && (
            centerTab === "code" ? (
              <IdeCodeEditor openFiles={openFiles} activeFileId={activeFileId} onSelectTab={setActiveFileId} onCloseTab={closeTab} onContentChange={updateContent} />
            ) : (
              <IdePreviewPanel files={files} />
            )
          )}
          {mobilePanel === "chat" && (
            <IdeChatPanel messages={chatMessages} isStreaming={isStreaming} onSend={sendChatMessage} onStop={stopStreaming} suggestions={suggestions} activeFileName={activeFile?.name} activeFileContent={activeFile?.content} />
          )}
          {mobilePanel === "terminal" && (
            <IdeTerminal onAiCommand={handleTerminalAiCommand} />
          )}
        </div>

        <div className="flex items-center border-t border-border/20 bg-card/20 flex-shrink-0">
          {([
            { id: "explorer" as MobilePanel, icon: FolderKanban, label: "Files" },
            { id: "editor" as MobilePanel, icon: FileCode, label: centerTab === "preview" ? "Preview" : "Code" },
            { id: "chat" as MobilePanel, icon: Sparkles, label: "AI" },
            { id: "terminal" as MobilePanel, icon: TerminalIcon, label: "Term" },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "editor" && mobilePanel === "editor") setCenterTab(t => t === "code" ? "preview" : "code");
                else setMobilePanel(tab.id);
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-light transition-colors ${mobilePanel === tab.id ? "text-accent" : "text-muted-foreground/50"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <IdeCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} actions={commandActions} />
        <IdeQuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} files={files} onSelectFile={selectFile} />
      </div>
    );
  }

  // ── Desktop Layout ──
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/20 border-b border-border/20 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="h-4 w-4 text-accent/70 shrink-0" />
          <span className="text-xs font-light tracking-widest text-foreground/80 shrink-0">AUREON IDE</span>
          {activeSessionId && (
            <span className="text-[9px] text-muted-foreground/50 bg-muted/10 rounded-full px-2 py-0.5 truncate max-w-[140px]">
              {sessions.find(s => s.id === activeSessionId)?.name ?? ""}
            </span>
          )}
          {breadcrumbs.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[9px] text-muted-foreground/40 ml-2">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span>/</span>}
                  <span className={i === breadcrumbs.length - 1 ? "text-foreground/60" : ""}>{b}</span>
                </span>
              ))}
            </div>
          )}
          {/* Consciousness Mode Indicator */}
          {consciousnessMode && (
            <div className="hidden md:flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <Brain className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span className="text-[9px] font-light text-cyan-400">Consciousness Mode</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Code/Preview switcher */}
          <div className="flex items-center rounded-lg border border-border/20 overflow-hidden mr-2">
            <button onClick={() => setCenterTab("code")} className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-light transition-colors ${centerTab === "code" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}>
              <FileCode className="h-3 w-3" /> Code
            </button>
            <button onClick={() => setCenterTab("preview")} className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-light transition-colors ${centerTab === "preview" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}>
              <Globe className="h-3 w-3" /> Preview
            </button>
          </div>

          <button onClick={() => setQuickOpenOpen(true)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Go to File (⌘P)">
            <FileCode className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setCommandPaletteOpen(true)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Command Palette (⌘K)">
            <Search className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setConsciousnessMode(!consciousnessMode)} className={`p-1.5 rounded-md transition-colors ${consciousnessMode ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground/50 hover:text-foreground"}`} title="Consciousness Mode">
            <Brain className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setZenMode(true)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Zen Mode">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={exportProject} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Export ZIP">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={saveSession} disabled={!activeSessionId || saving} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30" title="Save (⌘S)">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </button>
          <div className="w-px h-4 bg-border/20 mx-1" />
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle Sidebar (⌘B)">
            {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setBottomOpen(!bottomOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle Panel (⌘J)">
            {bottomOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle AI Chat">
            {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Icon bar + Panel */}
        {leftOpen && (
          <div className="flex flex-shrink-0 border-r border-border/20 bg-card/10 overflow-hidden">
            {/* Icon strip */}
            <div className="flex flex-col items-center gap-0.5 py-2 px-1 border-r border-border/10 bg-card/5">
              {leftSidebarIcons.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLeftTab(tab.id)}
                  className={`p-2 rounded-md transition-colors ${leftTab === tab.id ? "bg-accent/15 text-accent" : "text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5"}`}
                  title={tab.label}
                >
                  <tab.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            {/* Panel content */}
            <div className="w-[160px] md:w-[180px] lg:w-[220px] overflow-hidden flex flex-col">
              {leftTab === "files" && (
                <IdeFileTree files={files} activeFileId={activeFileId} onSelectFile={selectFile} onCreateFile={createFile} onDeleteFile={deleteFile} onRenameFile={renameFile} />
              )}
              {leftTab === "search" && (
                <IdeSearchPanel files={files} onOpenFile={selectFile} />
              )}
              {leftTab === "sessions" && (
                <IdeSessionManager sessions={sessions} activeSessionId={activeSessionId} loading={sessionsLoading} onSelect={loadSession} onCreate={createSession} onDelete={deleteSession} onRename={renameSession} />
              )}
            </div>
          </div>
        )}

        {/* Center: Editor/Preview + Bottom Panel */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {centerTab === "code" ? (
              <IdeCodeEditor openFiles={openFiles} activeFileId={activeFileId} onSelectTab={setActiveFileId} onCloseTab={closeTab} onContentChange={updateContent} />
            ) : (
              <IdePreviewPanel files={files} />
            )}
          </div>

          {/* Bottom Panel with tabs */}
          {bottomOpen && (
            <div className="h-[140px] md:h-[180px] lg:h-[220px] flex-shrink-0 overflow-hidden border-t border-border/20 flex flex-col">
              {/* Bottom tab bar */}
              <div className="flex items-center gap-0.5 px-2 py-0.5 bg-card/10 border-b border-border/10 shrink-0">
                {bottomTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-light transition-colors ${bottomTab === tab.id ? "bg-accent/15 text-accent" : "text-muted-foreground/40 hover:text-foreground"}`}
                  >
                    <tab.icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
              {/* Tab content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {bottomTab === "terminal" && <IdeTerminal onAiCommand={handleTerminalAiCommand} />}
                {bottomTab === "problems" && <IdeProblemsPanel files={files} onAiFix={handleAiFix} />}
                {bottomTab === "ai-log" && <IdeAiLogPanel logs={aiLogs} onClear={() => setAiLogs([])} />}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Chat */}
        {rightOpen && (
          <div className="w-[240px] md:w-[280px] lg:w-[320px] flex-shrink-0 border-l border-border/20 bg-card/10 overflow-hidden">
            <IdeChatPanel messages={chatMessages} isStreaming={isStreaming} onSend={sendChatMessage} onStop={stopStreaming} suggestions={suggestions} activeFileName={activeFile?.name} activeFileContent={activeFile?.content} />
          </div>
        )}
      </div>

      <IdeCommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} actions={commandActions} />
      <IdeQuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} files={files} onSelectFile={selectFile} />
    </div>
  );
};

export default AureonIdeView;
