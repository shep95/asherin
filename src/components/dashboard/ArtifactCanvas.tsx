import { useState, useRef, useCallback, useEffect } from "react";
import { X, Download, Copy, Check, History, Code2, FileText, GitBranch, Maximize2, Minimize2, GripVertical } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ArtifactVersion {
  id: string;
  content: string;
  label: string;
  timestamp: Date;
}

interface ArtifactCanvasProps {
  open: boolean;
  onClose: () => void;
  initialContent?: string;
  /** Stable key (e.g. `${conversationId}::${messageId}`). When set, versions
   *  persist to localStorage and survive close/reopen. */
  persistKey?: string;
}

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.8;
const STORAGE_PREFIX = "aureon_artifact_v1::";

type StoredVersion = { id: string; content: string; label: string; timestamp: string };

const loadVersions = (key?: string): ArtifactVersion[] | null => {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const arr = JSON.parse(raw) as StoredVersion[];
    return arr.map(v => ({ ...v, timestamp: new Date(v.timestamp) }));
  } catch { return null; }
};

const saveVersions = (key: string | undefined, versions: ArtifactVersion[]) => {
  if (!key) return;
  try {
    const serializable: StoredVersion[] = versions.map(v => ({ ...v, timestamp: v.timestamp.toISOString() }));
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(serializable));
  } catch { /* quota — ignore */ }
};

const ArtifactCanvas = ({ open, onClose, initialContent = "", persistKey }: ArtifactCanvasProps) => {
  const [content, setContent] = useState(initialContent);
  const [versions, setVersions] = useState<ArtifactVersion[]>(() => {
    const restored = loadVersions(persistKey);
    if (restored && restored.length) return restored;
    return initialContent ? [{ id: "v1", content: initialContent, label: "v1", timestamp: new Date() }] : [];
  });
  const [activeVersionIdx, setActiveVersionIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist versions whenever they change
  useEffect(() => { saveVersions(persistKey, versions); }, [versions, persistKey]);

  // When persistKey changes (different message), rehydrate from storage.
  useEffect(() => {
    const restored = loadVersions(persistKey);
    if (restored && restored.length) {
      setVersions(restored);
      setActiveVersionIdx(restored.length - 1);
      setContent(restored[restored.length - 1].content);
    }
  }, [persistKey]);

  // Live-update: if the source message keeps streaming new content while the
  // canvas is open, push the latest content into the active version so the
  // canvas reflects what the user sees in chat.
  useEffect(() => {
    if (!open || !initialContent) return;
    setContent(prev => (prev === initialContent ? prev : initialContent));
    setVersions(prev => {
      if (!prev.length) {
        return [{ id: "v1", content: initialContent, label: "v1", timestamp: new Date() }];
      }
      const next = [...prev];
      const idx = next.length - 1;
      if (next[idx].content !== initialContent) {
        next[idx] = { ...next[idx], content: initialContent, timestamp: new Date() };
      }
      return next;
    });
  }, [initialContent, open]);

  // On small screens, default to preview-only and auto-fullscreen
  useEffect(() => {
    const w = window.innerWidth;
    if (w < 640) {
      setViewMode("preview");
      setIsFullscreen(true);
    } else if (w < 1024) {
      setViewMode("preview");
      setPanelWidth(Math.min(400, w * 0.5));
    }
  }, [open]);

  // Resize drag handler
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;
    const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, startWidth + delta));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  const saveVersion = useCallback(() => {
    const label = `v${versions.length + 1}`;
    const newVersion: ArtifactVersion = { id: label, content, label, timestamp: new Date() };
    setVersions(prev => [...prev, newVersion]);
    setActiveVersionIdx(versions.length);
  }, [content, versions.length]);

  const restoreVersion = (idx: number) => {
    setContent(versions[idx].content);
    setActiveVersionIdx(idx);
    setShowHistory(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aureon-artifact.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const isCode = content.trimStart().startsWith("```") || /^(import |export |const |function |class |def |#include)/.test(content.trim());
  const effectiveWidth = isFullscreen ? "100%" : `${panelWidth}px`;

  // On small screens in split, force stacked layout
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const splitDirection = isMobile ? "flex-col" : "";

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full border-l border-border/20 bg-card/10 backdrop-blur-sm transition-all duration-200 ${isFullscreen ? "fixed inset-0 z-50 border-l-0 bg-background/95 backdrop-blur-xl" : "relative"}`}
      style={isFullscreen ? undefined : { width: effectiveWidth, minWidth: `${MIN_WIDTH}px` }}
    >
      {/* Resize handle (left edge) — hidden in fullscreen or mobile */}
      {!isFullscreen && !isMobile && (
        <div
          onMouseDown={startResize}
          className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 flex items-center justify-center hover:bg-accent/20 transition-colors ${isResizing ? "bg-accent/30" : ""}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/20" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {isCode ? <Code2 className="h-3.5 w-3.5 text-accent/60 shrink-0" /> : <FileText className="h-3.5 w-3.5 text-accent/60 shrink-0" />}
          <span className="text-[11px] font-light text-foreground truncate">Artifact Canvas</span>
          {versions.length > 0 && (
            <span className="text-[9px] text-muted-foreground/40 bg-muted/20 rounded px-1.5 py-0.5 shrink-0">
              {versions[activeVersionIdx]?.label || "draft"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* View mode toggle */}
          <div className="hidden xs:flex items-center gap-0.5">
            {(["edit", "split", "preview"] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-1.5 sm:px-2 py-1 text-[9px] rounded-md transition-colors ${
                  viewMode === m ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-foreground"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {/* Mobile view mode - single toggle */}
          <div className="flex xs:hidden items-center gap-0.5">
            <button
              onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
              className="px-1.5 py-1 text-[9px] rounded-md bg-foreground/10 text-foreground"
            >
              {viewMode === "edit" ? "Preview" : "Edit"}
            </button>
          </div>
          <div className="w-px h-4 bg-border/20 mx-0.5 sm:mx-1" />
          <button onClick={saveVersion} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Save version">
            <GitBranch className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Version history">
            <History className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleCopy} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleExport} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Export">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Version History Panel */}
      {showHistory && versions.length > 0 && (
        <div className="border-b border-border/20 bg-card/20 px-2 sm:px-3 py-2 max-h-[150px] overflow-y-auto shrink-0">
          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5">Version History</p>
          {versions.map((v, idx) => (
            <button
              key={v.id}
              onClick={() => restoreVersion(idx)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-light transition-colors ${
                idx === activeVersionIdx ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <span>{v.label}</span>
              <span className="text-[9px] text-muted-foreground/30">{v.timestamp.toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className={`flex-1 min-h-0 flex ${viewMode === "split" ? `divide-border/20 ${splitDirection || "divide-x"}` : ""} ${splitDirection}`}>
        {(viewMode === "edit" || viewMode === "split") && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            className={`${viewMode === "split" ? (isMobile ? "w-full h-1/2" : "w-1/2 h-full") : "w-full h-full"} bg-transparent resize-none p-3 sm:p-4 text-[13px] sm:text-sm font-mono font-light text-foreground placeholder:text-muted-foreground/30 outline-none`}
            placeholder="Start writing or paste content here..."
            spellCheck={false}
          />
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? (isMobile ? "w-full h-1/2 border-t border-border/20" : "w-1/2 h-full") : "w-full h-full"} overflow-y-auto p-3 sm:p-4`}>
            <div className="prose prose-sm prose-invert max-w-none [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:sm:text-[13px] [&_pre]:overflow-x-auto">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactCanvas;
