import { useState, useRef, useCallback } from "react";
import { Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Plus } from "lucide-react";
import IdeFileTree, { type IdeFile, getLanguage } from "./IdeFileTree";
import IdeCodeEditor from "./IdeCodeEditor";
import IdeChatPanel from "./IdeChatPanel";
import IdeTerminal from "./IdeTerminal";
import { streamChat, fetchSuggestions } from "@/lib/ai";
import type { FeedbackType } from "../CalibrationFeedback";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const STARTER_FILES: IdeFile[] = [
  {
    id: "src", name: "src", type: "folder", children: [
      { id: "app", name: "App.tsx", type: "file", content: `import React from "react";\n\nfunction App() {\n  return (\n    <div className="min-h-screen bg-background">\n      <h1>Hello World</h1>\n    </div>\n  );\n}\n\nexport default App;` },
      { id: "main", name: "main.tsx", type: "file", content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);` },
      { id: "css", name: "index.css", type: "file", content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  margin: 0;\n  font-family: Inter, sans-serif;\n}` },
    ],
  },
  { id: "pkg", name: "package.json", type: "file", content: `{\n  "name": "aureon-project",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}` },
  { id: "tsconfig", name: "tsconfig.json", type: "file", content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "jsx": "react-jsx",\n    "strict": true\n  }\n}` },
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
  // File state
  const [files, setFiles] = useState<IdeFile[]>(STARTER_FILES);
  const [openFileIds, setOpenFileIds] = useState<string[]>(["app"]);
  const [activeFileId, setActiveFileId] = useState<string | null>("app");

  // Panel state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Get flat list and active file
  const allFiles = flattenFiles(files);
  const openFiles = openFileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as IdeFile[];
  const activeFile = allFiles.find(f => f.id === activeFileId);

  // File operations
  const selectFile = (file: IdeFile) => {
    if (!openFileIds.includes(file.id)) setOpenFileIds(prev => [...prev, file.id]);
    setActiveFileId(file.id);
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

  // Chat operations — uses same streaming as Aureon main chat
  const sendChatMessage = useCallback(async (content: string) => {
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setSuggestions([]);

    const assistantId = crypto.randomUUID();
    let assistantContent = "";

    const allMsgs = [...chatMessages, userMsg].map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Add file context as system-level info
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
          // Check if AI response contains code that could be applied
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
        </div>
        <div className="flex items-center gap-1">
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
        {/* Left: File explorer */}
        {leftOpen && (
          <div className="w-[200px] lg:w-[240px] flex-shrink-0 border-r border-border/20 bg-card/10 overflow-hidden">
            <IdeFileTree
              files={files}
              activeFileId={activeFileId}
              onSelectFile={selectFile}
              onCreateFile={createFile}
              onDeleteFile={deleteFile}
            />
          </div>
        )}

        {/* Center: Editor + Terminal */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Code editor */}
          <div className={`flex-1 min-h-0 overflow-hidden ${bottomOpen ? "" : ""}`}>
            <IdeCodeEditor
              openFiles={openFiles}
              activeFileId={activeFileId}
              onSelectTab={setActiveFileId}
              onCloseTab={closeTab}
              onContentChange={updateContent}
            />
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
