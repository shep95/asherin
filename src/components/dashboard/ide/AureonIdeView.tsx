import { useState, useRef, useCallback, useEffect } from "react";
import { Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Globe, FileCode, FolderKanban, Save, Loader2 } from "lucide-react";
import IdeFileTree, { type IdeFile, getLanguage } from "./IdeFileTree";
import IdeCodeEditor from "./IdeCodeEditor";
import IdeChatPanel from "./IdeChatPanel";
import IdeTerminal from "./IdeTerminal";
import IdePreviewPanel from "./IdePreviewPanel";
import IdeSessionManager, { type IdeSession } from "./IdeSessionManager";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackType } from "../CalibrationFeedback";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type CenterTab = "code" | "preview";

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

const AureonIdeView = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Session state
  const [sessions, setSessions] = useState<IdeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  // File state
  const [files, setFiles] = useState<IdeFile[]>(STARTER_FILES);
  const [openFileIds, setOpenFileIds] = useState<string[]>(["app"]);
  const [activeFileId, setActiveFileId] = useState<string | null>("app");

  // Panel state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [centerTab, setCenterTab] = useState<CenterTab>("code");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Derived
  const allFiles = flattenFiles(files);
  const openFiles = openFileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as IdeFile[];
  const activeFile = allFiles.find(f => f.id === activeFileId);

  // ── Session CRUD ──
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ide_sessions")
      .select("id, name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSessions((data as IdeSession[]) ?? []);
    setSessionsLoading(false);
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadSession = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("ide_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (data) {
      setFiles(data.files as unknown as IdeFile[]);
      setOpenFileIds(data.open_file_ids ?? []);
      setActiveFileId(data.active_file_id ?? null);
      const cfg = data.panel_config as any;
      if (cfg) {
        setLeftOpen(cfg.leftOpen ?? true);
        setRightOpen(cfg.rightOpen ?? true);
        setBottomOpen(cfg.bottomOpen ?? true);
      }
      setActiveSessionId(id);
      setChatMessages([]);
      setShowSessions(false);
    }
  }, []);

  const createSession = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ide_sessions")
      .insert({
        user_id: user.id,
        name: `Project ${sessions.length + 1}`,
        files: STARTER_FILES as any,
        open_file_ids: ["app"],
        active_file_id: "app",
      })
      .select("id, name, updated_at")
      .single();
    if (data) {
      setSessions(prev => [data as IdeSession, ...prev]);
      loadSession(data.id);
    }
  }, [user, sessions.length, loadSession]);

  const deleteSession = useCallback(async (id: string) => {
    await supabase.from("ide_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setFiles(STARTER_FILES);
      setOpenFileIds(["app"]);
      setActiveFileId("app");
    }
  }, [activeSessionId]);

  const renameSession = useCallback(async (id: string, name: string) => {
    await supabase.from("ide_sessions").update({ name }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  const saveSession = useCallback(async () => {
    if (!activeSessionId || !user) return;
    setSaving(true);
    await supabase.from("ide_sessions").update({
      files: files as any,
      open_file_ids: openFileIds,
      active_file_id: activeFileId,
      panel_config: { leftOpen, rightOpen, bottomOpen } as any,
    }).eq("id", activeSessionId);
    setSaving(false);
    toast({ title: "Session saved", description: "Your project has been saved." });
  }, [activeSessionId, user, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen, toast]);

  // Auto-save every 30s
  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(() => {
      if (activeSessionId) {
        supabase.from("ide_sessions").update({
          files: files as any,
          open_file_ids: openFileIds,
          active_file_id: activeFileId,
          panel_config: { leftOpen, rightOpen, bottomOpen } as any,
        }).eq("id", activeSessionId);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeSessionId, files, openFileIds, activeFileId, leftOpen, rightOpen, bottomOpen]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveSession();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveSession]);

  // ── File operations ──
  const selectFile = (file: IdeFile) => {
    if (!openFileIds.includes(file.id)) setOpenFileIds(prev => [...prev, file.id]);
    setActiveFileId(file.id);
    setCenterTab("code");
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
    const newFile: IdeFile = {
      id: crypto.randomUUID(),
      name,
      type,
      content: type === "file" ? "" : undefined,
      children: type === "folder" ? [] : undefined,
    };
    if (!parentId) {
      setFiles(prev => [...prev, newFile]);
    } else {
      const addToParent = (nodes: IdeFile[]): IdeFile[] =>
        nodes.map(n => {
          if (n.id === parentId && n.type === "folder") return { ...n, children: [...(n.children || []), newFile] };
          if (n.children) return { ...n, children: addToParent(n.children) };
          return n;
        });
      setFiles(prev => addToParent(prev));
    }
    if (type === "file") selectFile(newFile);
  };

  const deleteFile = (id: string) => {
    const removeFromTree = (nodes: IdeFile[]): IdeFile[] =>
      nodes.filter(n => n.id !== id).map(n => n.children ? { ...n, children: removeFromTree(n.children) } : n);
    setFiles(prev => removeFromTree(prev));
    closeTab(id);
  };

  // ── Chat ──
  const sendChatMessage = useCallback(async (content: string) => {
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setSuggestions([]);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";

    const allMsgs = [...chatMessages, userMsg].map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    if (activeFile?.content) {
      allMsgs.unshift({
        role: "user" as const,
        content: `[IDE Context] Currently editing: ${activeFile.name}\n\`\`\`${getLanguage(activeFile.name)}\n${activeFile.content.slice(0, 4000)}\n\`\`\``,
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: allMsgs,
        mode: "code",
        depth: "deep",
        signal: controller.signal,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === assistantId) {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            }
            return [...prev, { id: assistantId, role: "assistant", content: assistantContent, timestamp: new Date() }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
          fetchSuggestions(assistantContent).then(setSuggestions).catch(() => {});
        },
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setChatMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `Error: ${err.message}`, timestamp: new Date() }]);
      }
      setIsStreaming(false);
    }
  }, [chatMessages, activeFile]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleTerminalAiCommand = useCallback((query: string) => {
    sendChatMessage(query);
    if (!rightOpen) setRightOpen(true);
  }, [sendChatMessage, rightOpen]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/20 border-b border-border/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-accent/70" />
          <span className="text-xs font-light tracking-widest text-foreground/80">AUREON IDE</span>
          {activeSessionId && (
            <span className="text-[9px] text-muted-foreground/50 bg-muted/10 rounded-full px-2 py-0.5 truncate max-w-[140px]">
              {sessions.find(s => s.id === activeSessionId)?.name ?? ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Center tab switcher */}
          <div className="flex items-center rounded-lg border border-border/20 overflow-hidden mr-2">
            <button
              onClick={() => setCenterTab("code")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-light transition-colors ${centerTab === "code" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}
            >
              <FileCode className="h-3 w-3" /> Code
            </button>
            <button
              onClick={() => setCenterTab("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-light transition-colors ${centerTab === "preview" ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`}
            >
              <Globe className="h-3 w-3" /> Preview
            </button>
          </div>

          <button onClick={() => setShowSessions(!showSessions)} className={`p-1.5 rounded-md transition-colors ${showSessions ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-foreground"}`} title="Sessions">
            <FolderKanban className="h-3.5 w-3.5" />
          </button>
          <button onClick={saveSession} disabled={!activeSessionId || saving} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30" title="Save (Ctrl+S)">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </button>
          <div className="w-px h-4 bg-border/20 mx-1" />
          <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle explorer">
            {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setBottomOpen(!bottomOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle terminal">
            {bottomOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setRightOpen(!rightOpen)} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Toggle AI chat">
            {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: Sessions or File explorer */}
        {leftOpen && (
          <div className="w-[200px] lg:w-[240px] flex-shrink-0 border-r border-border/20 bg-card/10 overflow-hidden flex flex-col">
            {showSessions ? (
              <IdeSessionManager
                sessions={sessions}
                activeSessionId={activeSessionId}
                loading={sessionsLoading}
                onSelect={loadSession}
                onCreate={createSession}
                onDelete={deleteSession}
                onRename={renameSession}
              />
            ) : (
              <IdeFileTree
                files={files}
                activeFileId={activeFileId}
                onSelectFile={selectFile}
                onCreateFile={createFile}
                onDeleteFile={deleteFile}
              />
            )}
          </div>
        )}

        {/* Center: Editor/Preview + Terminal */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {centerTab === "code" ? (
              <IdeCodeEditor
                openFiles={openFiles}
                activeFileId={activeFileId}
                onSelectTab={setActiveFileId}
                onCloseTab={closeTab}
                onContentChange={updateContent}
              />
            ) : (
              <IdePreviewPanel files={files} />
            )}
          </div>

          {/* Terminal */}
          {bottomOpen && (
            <div className="h-[180px] lg:h-[220px] flex-shrink-0 overflow-hidden">
              <IdeTerminal onAiCommand={handleTerminalAiCommand} />
            </div>
          )}
        </div>

        {/* Right: AI Chat */}
        {rightOpen && (
          <div className="w-[280px] lg:w-[320px] flex-shrink-0 border-l border-border/20 bg-card/10 overflow-hidden">
            <IdeChatPanel
              messages={chatMessages}
              isStreaming={isStreaming}
              onSend={sendChatMessage}
              onStop={stopStreaming}
              suggestions={suggestions}
              activeFileName={activeFile?.name}
              activeFileContent={activeFile?.content}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AureonIdeView;
