import { useState, useRef, useCallback } from "react";
import { X, Download, Copy, Check, History, ChevronLeft, ChevronRight, Code2, FileText, GitBranch } from "lucide-react";
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
}

const ArtifactCanvas = ({ open, onClose, initialContent = "" }: ArtifactCanvasProps) => {
  const [content, setContent] = useState(initialContent);
  const [versions, setVersions] = useState<ArtifactVersion[]>(() =>
    initialContent ? [{ id: "v1", content: initialContent, label: "v1", timestamp: new Date() }] : []
  );
  const [activeVersionIdx, setActiveVersionIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex flex-col h-full border-l border-border/20 bg-card/10 backdrop-blur-sm min-w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          {isCode ? <Code2 className="h-3.5 w-3.5 text-accent/60" /> : <FileText className="h-3.5 w-3.5 text-accent/60" />}
          <span className="text-[11px] font-light text-foreground">Artifact Canvas</span>
          {versions.length > 0 && (
            <span className="text-[9px] text-muted-foreground/40 bg-muted/20 rounded px-1.5 py-0.5">
              {versions[activeVersionIdx]?.label || "draft"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          {(["edit", "split", "preview"] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-2 py-1 text-[9px] rounded-md transition-colors ${
                viewMode === m ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <div className="w-px h-4 bg-border/20 mx-1" />
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
          <button onClick={onClose} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Version History Panel */}
      {showHistory && versions.length > 0 && (
        <div className="border-b border-border/20 bg-card/20 px-3 py-2 max-h-[150px] overflow-y-auto">
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
      <div className={`flex-1 min-h-0 flex ${viewMode === "split" ? "divide-x divide-border/20" : ""}`}>
        {(viewMode === "edit" || viewMode === "split") && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            className={`${viewMode === "split" ? "w-1/2" : "w-full"} h-full bg-transparent resize-none p-4 text-sm font-mono font-light text-foreground placeholder:text-muted-foreground/30 outline-none`}
            placeholder="Start writing or paste content here..."
            spellCheck={false}
          />
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "w-1/2" : "w-full"} h-full overflow-y-auto p-4`}>
            <div className="prose prose-sm prose-invert max-w-none [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactCanvas;
