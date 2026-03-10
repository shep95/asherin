import { useState, useRef, useCallback, useEffect } from "react";
import { StickyNote, X, Copy, Check, Download, Minus, Maximize2, GripHorizontal } from "lucide-react";

const NOTES_KEY = "aureon_conv_notes";
const POS_KEY = "aureon_notepad_pos";

interface Size { w: number; h: number }
interface Pos { x: number; y: number }

function loadAllNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
}
function loadNotepad(convId: string): string {
  return loadAllNotes()[convId] || "";
}
function saveNotepad(convId: string, text: string) {
  const all = loadAllNotes();
  if (text.trim()) all[convId] = text;
  else delete all[convId];
  localStorage.setItem(NOTES_KEY, JSON.stringify(all));
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
  conversationId: string;
}

const MIN_W = 260;
const MIN_H = 200;
const MAX_W = 900;
const MAX_H = 800;

const FloatingNotepad = ({ open, onClose, conversationId }: FloatingNotepadProps) => {
  const [text, setText] = useState(() => loadNotepad(conversationId));
  const [pos, setPos] = useState<Pos & Size>(loadPos);
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist text per conversation
  useEffect(() => {
    const t = setTimeout(() => saveNotepad(conversationId, text), 400);
    return () => clearTimeout(t);
  }, [text, conversationId]);

  // Reload notes when switching conversations
  useEffect(() => {
    setText(loadNotepad(conversationId));
  }, [conversationId]);

  // Persist position
  useEffect(() => {
    savePos(pos);
  }, [pos]);

  // Drag handlers (mouse + touch)
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    const pt = "touches" in e ? e.touches[0] : e;
    offset.current = { x: pt.clientX - pos.x, y: pt.clientY - pos.y };
  }, [pos.x, pos.y]);

  // Resize handlers (mouse + touch)
  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const pt = "touches" in e ? e.touches[0] : e;
    offset.current = { x: pt.clientX, y: pt.clientY };
  }, []);

  useEffect(() => {
    const getPoint = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e && e.touches.length > 0) return e.touches[0];
      if ("clientX" in e) return e as MouseEvent;
      return null;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const pt = getPoint(e);
      if (!pt) return;
      if (dragging.current) {
        e.preventDefault();
        setPos((p) => ({
          ...p,
          x: Math.max(0, pt.clientX - offset.current.x),
          y: Math.max(0, pt.clientY - offset.current.y),
        }));
      }
      if (resizing.current) {
        e.preventDefault();
        const dx = pt.clientX - offset.current.x;
        const dy = pt.clientY - offset.current.y;
        offset.current = { x: pt.clientX, y: pt.clientY };
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
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
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
        onTouchStart={onDragStart}
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
            onTouchStart={onResizeStart}
            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-center justify-center opacity-40 hover:opacity-70 active:opacity-70 transition-opacity"
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
