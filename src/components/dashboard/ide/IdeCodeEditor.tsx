import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Copy, Check, Undo2, Redo2, Search, Replace, ChevronDown } from "lucide-react";
import type { IdeFile } from "./IdeFileTree";
import { getLanguage } from "./IdeFileTree";

interface Props {
  openFiles: IdeFile[];
  activeFileId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
}

// Syntax keyword maps for basic highlighting
const KEYWORDS_TS = /\b(import|export|from|const|let|var|function|return|if|else|switch|case|break|default|for|while|do|new|class|extends|implements|interface|type|enum|async|await|try|catch|finally|throw|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|as|is|in|of|yield|delete|debugger|with|continue)\b/g;
const STRINGS = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
const COMMENTS_SINGLE = /\/\/.*/g;
const COMMENTS_MULTI = /\/\*[\s\S]*?\*\//g;
const NUMBERS = /\b\d+\.?\d*\b/g;

function highlightLine(text: string, language: string): React.ReactNode[] {
  if (!text) return [text];
  // Simple approach: return plain text with keyword spans
  // For performance, just return plain text - real syntax highlighting would use a library
  return [text];
}

const IdeCodeEditor = ({ openFiles, activeFileId, onSelectTab, onCloseTab, onContentChange }: Props) => {
  const [copied, setCopied] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => openFiles.find(f => f.id === activeFileId), [openFiles, activeFileId]);
  const content = activeFile?.content ?? "";
  const lines = content.split("\n");
  const language = activeFile ? getLanguage(activeFile.name) : "plaintext";

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault(); // prevent browser save
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Tab handling in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + "  " + content.slice(end);
      onContentChange(activeFile!.id, newContent);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
  };

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50">
        <div className="text-center space-y-2 animate-fade-in">
          <p className="text-sm font-extralight text-muted-foreground/40">No files open</p>
          <p className="text-[10px] font-light text-muted-foreground/30">Select a file from the explorer or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Tabs */}
      <div className="flex items-center border-b border-border/20 bg-card/20 overflow-x-auto">
        {openFiles.map(f => (
          <button
            key={f.id}
            onClick={() => onSelectTab(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light border-r border-border/10 whitespace-nowrap transition-colors group ${
              f.id === activeFileId ? "bg-background text-foreground border-b-2 border-b-accent" : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            <span className="truncate max-w-[120px]">{f.name}</span>
            <X
              onClick={(e) => { e.stopPropagation(); onCloseTab(f.id); }}
              className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            />
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setShowSearch(s => !s)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors">
            <Search className="h-3 w-3" />
          </button>
          <button onClick={handleCopyAll} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors">
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/30 border-b border-border/10">
          <Search className="h-3 w-3 text-muted-foreground/40" />
          <input
            autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in file..."
            className="flex-1 bg-transparent text-[11px] font-light outline-none text-foreground placeholder:text-muted-foreground/30"
          />
          <button onClick={() => { setShowSearch(false); setSearchTerm(""); }} className="p-0.5">
            <X className="h-3 w-3 text-muted-foreground/40" />
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 overflow-hidden select-none bg-card/10 border-r border-border/10 py-3 px-1"
          style={{ width: "40px" }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className="text-[10px] font-light text-muted-foreground/30 text-right pr-2 leading-[1.6rem]"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code textarea */}
        <div className="flex-1 relative overflow-hidden">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => activeFile && onContentChange(activeFile.id, e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-[12px] font-mono leading-[1.6rem] text-foreground/90 p-3 outline-none overflow-auto caret-accent"
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-card/20 border-t border-border/10 text-[9px] font-light text-muted-foreground/40">
        <div className="flex items-center gap-3">
          <span>{language}</span>
          <span>Ln {textareaRef.current?.selectionStart ? content.slice(0, textareaRef.current.selectionStart).split("\n").length : 1}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{lines.length} lines</span>
          <span>{content.length} chars</span>
        </div>
      </div>
    </div>
  );
};

export default IdeCodeEditor;
