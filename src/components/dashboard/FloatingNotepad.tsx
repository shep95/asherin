import { useState, useRef, useCallback, useEffect } from "react";
import { StickyNote, X, Copy, Check, Download, Minus, Maximize2, GripHorizontal } from "lucide-react";

const STORAGE_KEY = "aureon_floating_notepad";
const POS_KEY = "aureon_notepad_pos";

interface Size { w: number; h: number }
interface Pos { x: number; y: number }

function loadNotepad(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}
function saveNotepad(text: string) {
  localStorage.setItem(STORAGE_KEY, text);
}
function loadPos(): Pos & Size {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || "null") ?? { x: 80, y: 80, w: 380, h: 340 };
  } catch {
    return { x: 80, y: 80, w: 380, h: 340 };
  }
}
function savePos(p: Pos & Size) {
  localStorage.setItem(POS_KEY, JSON.stringify(p));
}

interface FloatingNotepadProps {
  open: boolean;
  onClose: () => void;
}

const MIN_W = 260;
const MIN_H = 200;
const MAX_W = 900;
const MAX_H = 800;

const FloatingNotepad = ({ open, onClose }: FloatingNotepadProps) => {
  const [text, setText] = useState(loadNotepad);
  const [pos, setPos] = useState<Pos & Size>(loadPos);
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist text
  useEffect(() => {
    const t = setTimeout(() => saveNotepad(text), 400);
    return () => clearTimeout(t);
  }, [text]);

  // Persist position
  useEffect(() => {
    savePos(pos);
  }, [pos]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos.x, pos.y]);

  // Resize handlers
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    offset.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos((p) => ({
          ...p,
          x: Math.max(0, e.clientX - offset.current.x),
          y: Math.max(0, e.clientY - offset.current.y),
        }));
      }
      if (resizing.current) {
        const dx = e.clientX - offset.current.x;
        const dy = e.clientY - offset.current.y;
        offset.current = { x: e.clientX, y: e.clientY };
        setPos((p) => ({
          ...p,
          w: Math.min(MAX_W, Math.max(MIN_W, p.w + dx)),
          h: Math.min(MAX_H, Math.max(MIN_H, p.h + dy)),
        }));
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-notes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[100] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col animate-scale-in select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: minimized ? 260 : pos.w,
        height: minimized ? 44 : pos.h,
      }}
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={onDragStart}
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b border-border/20 shrink-0 rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5 text-amber-500/70" />
          <span className="text-xs font-light text-foreground tracking-wide select-none">Notepad</span>
          {text.length > 0 && (
            <span className="text-[9px] text-muted-foreground/40 font-light">{text.length} chars</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
            title="Copy all"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
            title="Download as .txt"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your notes here…"
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none resize-none p-3 leading-relaxed"
            spellCheck
          />

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity"
            title="Resize"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground rotate-[-45deg]" />
          </div>
        </>
      )}
    </div>
  );
};

export default FloatingNotepad;
