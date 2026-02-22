import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Copy, Check, Search, WrapText, AlignLeft } from "lucide-react";
import type { IdeFile } from "./IdeFileTree";
import { getLanguage } from "./IdeFileTree";

interface Props {
  openFiles: IdeFile[];
  activeFileId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
}

const IdeCodeEditor = ({ openFiles, activeFileId, onSelectTab, onCloseTab, onContentChange }: Props) => {
  const [copied, setCopied] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [wordWrap, setWordWrap] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => openFiles.find(f => f.id === activeFileId), [openFiles, activeFileId]);
  const content = activeFile?.content ?? "";
  const lines = content.split("\n");
  const language = activeFile ? getLanguage(activeFile.name) : "plaintext";

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(s => !s);
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

  // Search match count
  const matchCount = searchTerm ? (content.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))?.length ?? 0) : 0;

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50 h-full">
        <div className="text-center space-y-2 animate-fade-in">
          <p className="text-sm font-extralight text-muted-foreground/40">No files open</p>
          <p className="text-[10px] font-light text-muted-foreground/30">Select a file from the explorer or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Tabs — horizontally scrollable */}
      <div className="flex items-center border-b border-border/20 bg-card/20 overflow-x-auto scrollbar-none">
        <div className="flex items-center min-w-0 overflow-x-auto scrollbar-none">
          {openFiles.map(f => (
            <button
              key={f.id}
              onClick={() => onSelectTab(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-light border-r border-border/10 whitespace-nowrap transition-colors group shrink-0 ${
                f.id === activeFileId ? "bg-background text-foreground border-b-2 border-b-accent" : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span className="truncate max-w-[100px] sm:max-w-[120px]">{f.name}</span>
              <X
                onClick={(e) => { e.stopPropagation(); onCloseTab(f.id); }}
                className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0"
              />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2 shrink-0">
          <button onClick={() => setWordWrap(w => !w)} className={`p-1 rounded transition-colors ${wordWrap ? "text-accent" : "text-muted-foreground/40 hover:text-foreground"}`} title="Word Wrap">
            <WrapText className="h-3 w-3" />
          </button>
          <button onClick={() => setShowMinimap(m => !m)} className={`p-1 rounded transition-colors hidden md:block ${showMinimap ? "text-accent" : "text-muted-foreground/40 hover:text-foreground"}`} title="Minimap">
            <AlignLeft className="h-3 w-3" />
          </button>
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
          <Search className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <input
            autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in file..."
            className="flex-1 bg-transparent text-[11px] font-light outline-none text-foreground placeholder:text-muted-foreground/30 min-w-0"
          />
          {searchTerm && <span className="text-[9px] text-muted-foreground/40 shrink-0">{matchCount} found</span>}
          <button onClick={() => { setShowSearch(false); setSearchTerm(""); }} className="p-0.5 shrink-0">
            <X className="h-3 w-3 text-muted-foreground/40" />
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 overflow-hidden select-none bg-card/10 border-r border-border/10 py-3 px-1 hidden sm:block"
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
        <div className="flex-1 relative overflow-hidden min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => activeFile && onContentChange(activeFile.id, e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-[11px] sm:text-[12px] font-mono leading-[1.6rem] text-foreground/90 p-3 outline-none overflow-auto caret-accent"
            style={{ tabSize: 2, whiteSpace: wordWrap ? "pre-wrap" : "pre", overflowWrap: wordWrap ? "break-word" : "normal" }}
          />
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="w-[60px] flex-shrink-0 bg-card/5 border-l border-border/10 overflow-hidden hidden md:block">
            <div className="p-1 text-[2px] leading-[3px] text-muted-foreground/20 font-mono whitespace-pre overflow-hidden select-none" style={{ maxHeight: "100%" }}>
              {content.slice(0, 3000)}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-card/20 border-t border-border/10 text-[9px] font-light text-muted-foreground/40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="shrink-0">{language}</span>
          <span className="hidden sm:inline">Ln {textareaRef.current?.selectionStart ? content.slice(0, textareaRef.current.selectionStart).split("\n").length : 1}</span>
          <span className="hidden sm:inline">UTF-8</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span>{lines.length} lines</span>
          <span className="hidden sm:inline">{content.length} chars</span>
        </div>
      </div>
    </div>
  );
};

export default IdeCodeEditor;
