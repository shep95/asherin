import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Download, Copy, Check, Undo2, ZoomIn, ZoomOut, Hand, Square, Paintbrush, Maximize2, Upload, Sparkles, Send, User, Wand2, Eraser, RefreshCw, Plus, FolderOpen, Trash2, Pencil, RotateCcw, Square as StopIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PixelRect { id: string; x: number; y: number; color: string; }
type Tool = "pan" | "zoom-in" | "zoom-out" | "select-box" | "color-paint" | "erase";
interface ViewBox { x: number; y: number; w: number; h: number; }
type ExportFormat = "svg" | "minified-svg" | "css-grid";

interface AureonMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  canvasEdit?: PixelRect[];
  timestamp: Date;
}

interface ImagineSession {
  id: string;
  name: string;
  pixels: PixelRect[];
  grid_w: number;
  grid_h: number;
  aureon_messages: AureonMessage[];
  created_at: string;
  updated_at: string;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function rgbaToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// ─── SVG Export (runs only on demand, not live) ───────────────────────────────
function exportSvg(rects: PixelRect[], w: number, h: number, minify = false): string {
  if (rects.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  const body = rects.map(r =>
    `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="${r.color}"/>`
  ).join(minify ? "" : "\n  ");
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n  ${body}\n</svg>`;
  return minify ? raw.replace(/\n\s*/g, "") : raw;
}

function exportCssGrid(rects: PixelRect[], w: number, h: number): string {
  const pixelMap = new Map<string, string>();
  for (const r of rects) pixelMap.set(`${r.x},${r.y}`, r.color);
  const colorMap: string[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      colorMap.push(pixelMap.get(`${x},${y}`) ?? "transparent");
  const css = `.pixel-grid{display:grid;grid-template-columns:repeat(${w},1fr);width:${w * 4}px;height:${h * 4}px;gap:0}\n.pixel-grid div{width:4px;height:4px}`;
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>\n<div class="pixel-grid">\n${colorMap.map(c => `  <div style="background:${c}"></div>`).join("\n")}\n</div></body></html>`;
}

function imageDataToRects(imageData: ImageData): PixelRect[] {
  const { width, height, data } = imageData;
  const out: PixelRect[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 20) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 220 && g > 220 && b > 220) continue;
      out.push({ id: uid(), x, y, color: rgbaToHex(r, g, b) });
    }
  }
  return out;
}

function parseAureonPixelEdit(response: string, currentRects: PixelRect[], currentW: number, currentH: number): PixelRect[] | null {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[1]);
    if (!parsed.pixels || !Array.isArray(parsed.pixels)) return null;
    const pixelMap = new Map<string, PixelRect>();
    for (const r of currentRects) pixelMap.set(`${r.x},${r.y}`, { ...r });
    for (const edit of parsed.pixels) {
      if (typeof edit.x !== "number" || typeof edit.y !== "number" || !edit.color) continue;
      if (edit.x < 0 || edit.y < 0 || edit.x >= currentW || edit.y >= currentH) continue;
      const key = `${edit.x},${edit.y}`;
      if (edit.color === "transparent" || edit.color === "erase") {
        pixelMap.delete(key);
      } else {
        pixelMap.set(key, { id: uid(), x: edit.x, y: edit.y, color: edit.color });
      }
    }
    return Array.from(pixelMap.values());
  } catch {
    return null;
  }
}

// Constants
const MAX_SIDE = 10_000;
const PIXEL_BUDGET_BASE = 1_000_000;
const ZOOM_FACTOR = 0.8;
// Max history frames stored — older ones are pruned to prevent OOM with 1M pixel canvases
const MAX_HISTORY_FRAMES = 10;
// Canvas rendering: use HTML Canvas instead of SVG <rect> for performance
const CANVAS_RENDER_PIXEL_THRESHOLD = 5_000; // below this, SVG is fine

// ─── Sessions Panel ────────────────────────────────────────────────────────────
interface SessionsPanelProps {
  sessions: ImagineSession[];
  activeId: string | null;
  onSelect: (s: ImagineSession) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  saving: boolean;
}

const SessionsPanel = ({ sessions, activeId, onSelect, onCreate, onDelete, onRename, saving }: SessionsPanelProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (s: ImagineSession) => {
    setEditingId(s.id);
    setEditName(s.name);
  };
  const commitEdit = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3 w-3 text-accent/60" />
          <span className="text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/60">Sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          {saving && <span className="text-[8px] text-accent/50 animate-pulse">Saving…</span>}
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/15 text-[9px] font-light text-accent transition-all"
          >
            <Plus className="h-2.5 w-2.5" /> New
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-[9px] text-muted-foreground/30 text-center py-4 tracking-wide">No sessions yet</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all ${
                activeId === s.id
                  ? "bg-accent/15 border border-accent/25 text-foreground"
                  : "border border-transparent hover:border-border/20 hover:bg-foreground/5 text-muted-foreground"
              }`}
              onClick={() => activeId !== s.id && onSelect(s)}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 bg-transparent text-[10px] font-light outline-none border-b border-accent/40 text-foreground"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 text-[10px] font-light truncate">{s.name}</span>
              )}
              <div className={`flex gap-1 ${editingId === s.id ? "flex" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                <button
                  onClick={e => { e.stopPropagation(); startEdit(s); }}
                  className="p-0.5 rounded hover:text-accent transition-colors"
                  title="Rename"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                  className="p-0.5 rounded hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ─── Canvas Renderer (HTML Canvas for high pixel counts) ──────────────────────
interface CanvasRendererProps {
  rects: PixelRect[];
  gridW: number;
  gridH: number;
  viewBox: ViewBox;
  selectedIds: Set<string>;
  selRect: { x: number; y: number; w: number; h: number } | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  cursorStyle: string;
  canvasLocked: boolean;
}

const CanvasRenderer = ({
  rects, gridW, gridH, viewBox, selectedIds, selRect,
  onMouseDown, onMouseMove, onMouseUp, onWheel, cursorStyle, canvasLocked
}: CanvasRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (canvas.width !== Math.floor(width) || canvas.height !== Math.floor(height)) {
      canvas.width = Math.floor(width) || 800;
      canvas.height = Math.floor(height) || 600;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Scale from viewBox space to canvas pixels
    const scaleX = cw / viewBox.w;
    const scaleY = ch / viewBox.h;

    ctx.clearRect(0, 0, cw, ch);

    // Checkerboard background
    const cellSize = Math.max(1, Math.min(scaleX, scaleY) * 2);
    for (let cy = 0; cy < ch; cy += cellSize) {
      for (let cx = 0; cx < cw; cx += cellSize) {
        const even = (Math.floor(cx / cellSize) + Math.floor(cy / cellSize)) % 2 === 0;
        ctx.fillStyle = even ? "#e5e7eb" : "#f9fafb";
        ctx.fillRect(cx, cy, cellSize, cellSize);
      }
    }

    // Pixel size in canvas pixels
    const pixW = scaleX;
    const pixH = scaleY;

    // Only draw pixels in viewport
    const x0 = Math.max(0, Math.floor(viewBox.x));
    const y0 = Math.max(0, Math.floor(viewBox.y));
    const x1 = Math.min(gridW, Math.ceil(viewBox.x + viewBox.w));
    const y1 = Math.min(gridH, Math.ceil(viewBox.y + viewBox.h));

    // Build a fast lookup for visible pixels
    const visibleMap = new Map<string, string>();
    for (const r of rects) {
      if (r.x >= x0 && r.x < x1 && r.y >= y0 && r.y < y1) {
        visibleMap.set(`${r.x},${r.y}`, r.color);
      }
    }

    // Batch draw by color for performance
    const byColor = new Map<string, Array<[number, number]>>();
    for (const [key, color] of visibleMap) {
      const [sx, sy] = key.split(",").map(Number);
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color)!.push([sx, sy]);
    }

    for (const [color, coords] of byColor) {
      ctx.fillStyle = color;
      for (const [px, py] of coords) {
        const cx = (px - viewBox.x) * scaleX;
        const cy = (py - viewBox.y) * scaleY;
        ctx.fillRect(cx, cy, Math.max(1, pixW), Math.max(1, pixH));
      }
    }

    // Selected pixels highlight
    if (selectedIds.size > 0) {
      ctx.strokeStyle = "hsl(250 100% 60%)";
      ctx.lineWidth = Math.max(0.5, Math.min(scaleX, scaleY) * 0.1);
      for (const r of rects) {
        if (selectedIds.has(r.id) && r.x >= x0 && r.x < x1 && r.y >= y0 && r.y < y1) {
          const cx = (r.x - viewBox.x) * scaleX;
          const cy = (r.y - viewBox.y) * scaleY;
          ctx.strokeRect(cx, cy, Math.max(1, pixW), Math.max(1, pixH));
        }
      }
    }

    // Selection box overlay
    if (selRect) {
      const sx = (selRect.x - viewBox.x) * scaleX;
      const sy = (selRect.y - viewBox.y) * scaleY;
      const sw = selRect.w * scaleX;
      const sh = selRect.h * scaleY;
      ctx.fillStyle = "hsla(250, 100%, 60%, 0.12)";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = "hsl(250 100% 60%)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
    }
  }, [rects, gridW, gridH, viewBox, selectedIds, selRect]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: canvasLocked ? "default" : cursorStyle, imageRendering: "pixelated" }}
        onMouseDown={canvasLocked ? undefined : onMouseDown}
        onMouseMove={canvasLocked ? undefined : onMouseMove}
        onMouseUp={canvasLocked ? undefined : onMouseUp}
        onMouseLeave={canvasLocked ? undefined : onMouseUp}
        onWheel={canvasLocked ? undefined : onWheel}
      />
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const ImagineToCodeView = () => {
  // ── Sessions state ────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ImagineSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas state
  const historyStack = useRef<PixelRect[][]>([[]]);
  const histIdx = useRef(0);
  const [rects, setRects] = useState<PixelRect[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [gridW, setGridW] = useState(512);
  const [gridH, setGridH] = useState(512);
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [activeColor, setActiveColor] = useState("#7C3AED");
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 512, h: 512 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("svg");
  const [copied, setCopied] = useState(false);
  const [selStart, setSelStart] = useState<{ sx: number; sy: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AUREON
  const [aureonMessages, setAureonMessages] = useState<AureonMessage[]>([]);
  const [aureonInput, setAureonInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ── Autonomous loop state ─────────────────────────────────────────────────
  const [loopActive, setLoopActive] = useState(false);
  const [loopIteration, setLoopIteration] = useState(0);
  const [loopStatus, setLoopStatus] = useState<string>("");
  const loopAbortRef = useRef(false);
  const MAX_LOOP_ITERATIONS = 12;

  // ── Code generation — debounced, not on every render ─────────────────────
  const [code, setCode] = useState("");
  const codeGenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce code generation — never regenerate more than once per 500ms
  // and never block the main thread for 1M pixel SVG on every keystroke
  useEffect(() => {
    if (codeGenTimerRef.current) clearTimeout(codeGenTimerRef.current);
    if (rects.length === 0) { setCode(""); return; }
    codeGenTimerRef.current = setTimeout(() => {
      if (exportFormat === "svg") setCode(exportSvg(rects, gridW, gridH));
      else if (exportFormat === "minified-svg") setCode(exportSvg(rects, gridW, gridH, true));
      else setCode(exportCssGrid(rects, gridW, gridH));
    }, 500);
    return () => { if (codeGenTimerRef.current) clearTimeout(codeGenTimerRef.current); };
  }, [rects, exportFormat, gridW, gridH]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPainting = useRef(false);
  const panStart = useRef<{ mx: number; my: number; vb: ViewBox } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rectsRef = useRef<PixelRect[]>([]);
  // Pending paint batch — flush on mouseUp instead of per-pixel setState
  const paintBatchRef = useRef<Map<string, PixelRect | null>>(new Map());
  useEffect(() => { rectsRef.current = rects; }, [rects]);
  const gridWRef = useRef(512);
  const gridHRef = useRef(512);
  useEffect(() => { gridWRef.current = gridW; gridHRef.current = gridH; }, [gridW, gridH]);

  // Auto-scroll AUREON chat
  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [aureonMessages]);

  // ── Load sessions on mount ────────────────────────────────────────────────
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setSessionsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSessionsLoading(false); return; }
    const { data, error } = await supabase
      .from("imagine_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (!error && data) {
      const parsed = data.map(row => ({
        ...row,
        pixels: (row.pixels as unknown as PixelRect[]) || [],
        aureon_messages: (row.aureon_messages as unknown as AureonMessage[]) || [],
      }));
      setSessions(parsed);
    }
    setSessionsLoading(false);
  };

  // ── Auto-save current session (debounced 2s, guards massive payloads) ─────
  const scheduleSave = useCallback((
    sessionId: string,
    pixels: PixelRect[],
    w: number,
    h: number,
    msgs: AureonMessage[]
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // For very large pixel sets, extend debounce to 4s to avoid thrashing
    const delay = pixels.length > 100_000 ? 4000 : 2000;
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      // Cap pixels saved to 500k to prevent Supabase payload size errors
      const pixelsToSave = pixels.length > 500_000 ? pixels.slice(0, 500_000) : pixels;
      await supabase
        .from("imagine_sessions")
        .update({
          pixels: pixelsToSave as unknown as never,
          grid_w: w,
          grid_h: h,
          aureon_messages: msgs as unknown as never,
        })
        .eq("id", sessionId);
      setSaving(false);
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === sessionId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], pixels, grid_w: w, grid_h: h, aureon_messages: msgs, updated_at: new Date().toISOString() };
        const rest = prev.filter(s => s.id !== sessionId);
        return [updated, ...rest];
      });
    }, delay);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    scheduleSave(activeSessionId, rects, gridW, gridH, aureonMessages);
  }, [rects, aureonMessages, activeSessionId, gridW, gridH, scheduleSave]);

  // ── Session CRUD ──────────────────────────────────────────────────────────
  const createSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("imagine_sessions")
      .insert({ user_id: user.id, name: "Untitled Session" })
      .select()
      .single();
    if (error || !data) { toast({ title: "Error", description: "Could not create session.", variant: "destructive" }); return; }
    const newSession: ImagineSession = {
      ...data,
      pixels: [],
      aureon_messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    loadSessionIntoEditor(newSession);
  };

  const loadSessionIntoEditor = (s: ImagineSession) => {
    setActiveSessionId(s.id);
    historyStack.current = [[], s.pixels.length > 0 ? s.pixels : []];
    histIdx.current = s.pixels.length > 0 ? 1 : 0;
    setRects(s.pixels);
    rectsRef.current = s.pixels;
    setGridW(s.grid_w);
    setGridH(s.grid_h);
    gridWRef.current = s.grid_w;
    gridHRef.current = s.grid_h;
    setViewBox({ x: 0, y: 0, w: s.grid_w, h: s.grid_h });
    syncUndoRedo();
    const msgs = s.aureon_messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    setAureonMessages(msgs);
    setSelRect(null);
    setSelectedIds(new Set());
  };

  const deleteSession = async (id: string) => {
    await supabase.from("imagine_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setRects([]);
      setAureonMessages([]);
      historyStack.current = [[]];
      histIdx.current = 0;
      syncUndoRedo();
    }
  };

  const renameSession = async (id: string, name: string) => {
    await supabase.from("imagine_sessions").update({ name }).eq("id", id);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  // ── History — capped to MAX_HISTORY_FRAMES to prevent OOM ─────────────────
  const syncUndoRedo = () => {
    setCanUndo(histIdx.current > 0);
    setCanRedo(histIdx.current < historyStack.current.length - 1);
  };

  const pushHistory = useCallback((next: PixelRect[]) => {
    // Slice future redos
    historyStack.current = historyStack.current.slice(0, histIdx.current + 1);
    historyStack.current.push(next);
    // Prune oldest frames if over cap
    if (historyStack.current.length > MAX_HISTORY_FRAMES) {
      historyStack.current = historyStack.current.slice(historyStack.current.length - MAX_HISTORY_FRAMES);
    }
    histIdx.current = historyStack.current.length - 1;
    setRects(next);
    syncUndoRedo();
  }, []);

  const undo = useCallback(() => {
    if (histIdx.current <= 0) return;
    histIdx.current -= 1;
    setRects(historyStack.current[histIdx.current]);
    syncUndoRedo();
  }, []);

  const redo = useCallback(() => {
    if (histIdx.current >= historyStack.current.length - 1) return;
    histIdx.current += 1;
    setRects(historyStack.current[histIdx.current]);
    syncUndoRedo();
  }, []);

  const clearCanvas = () => {
    pushHistory([]);
    setSelRect(null);
    setSelectedIds(new Set());
  };

  // ── SVG coordinate mapping (works for both Canvas and SVG modes) ───────────
  const getContainerCoords = (e: React.MouseEvent | React.WheelEvent, el: HTMLElement | SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    return {
      x: ((e as React.MouseEvent).clientX - r.left) / r.width * viewBox.w + viewBox.x,
      y: ((e as React.MouseEvent).clientY - r.top) / r.height * viewBox.h + viewBox.y,
    };
  };

  const getEventCoords = (e: React.MouseEvent | React.WheelEvent) => {
    const el = e.currentTarget as HTMLElement;
    return getContainerCoords(e, el);
  };

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setViewBox(vb => {
      const nw = vb.w * factor;
      const nh = vb.h * factor;
      const pivotX = cx ?? (vb.x + vb.w / 2);
      const pivotY = cy ?? (vb.y + vb.h / 2);
      return { x: pivotX - (pivotX - vb.x) * factor, y: pivotY - (pivotY - vb.y) * factor, w: nw, h: nh };
    });
  }, []);

  // ── Batched painting — accumulate changes, flush on mouseUp ───────────────
  const flushPaintBatch = useCallback(() => {
    const batch = paintBatchRef.current;
    if (batch.size === 0) return;
    paintBatchRef.current = new Map();
    setRects(prev => {
      const map = new Map<string, PixelRect>();
      for (const r of prev) map.set(`${r.x},${r.y}`, r);
      for (const [key, val] of batch) {
        if (val === null) map.delete(key);
        else map.set(key, val);
      }
      const next = Array.from(map.values());
      rectsRef.current = next;
      return next;
    });
  }, []);

  const paintPixelBatched = useCallback((px: number, py: number, erase = false) => {
    if (px < 0 || py < 0 || px >= gridWRef.current || py >= gridHRef.current) return;
    const key = `${px},${py}`;
    if (erase) {
      paintBatchRef.current.set(key, null);
    } else {
      paintBatchRef.current.set(key, { id: uid(), x: px, y: py, color: activeColor });
    }
    // Apply visually every ~16ms (one frame) by doing a lightweight local state update
    // We DON'T setState here — the canvas re-renders on next animation frame via the batch
  }, [activeColor]);

  // For live preview during painting, we still need to update rects periodically
  const paintFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const schedulePaintFlush = useCallback(() => {
    if (paintFrameRef.current) return;
    paintFrameRef.current = requestAnimationFrame(() => {
      paintFrameRef.current = null;
      const batch = paintBatchRef.current;
      if (batch.size === 0) return;
      setRects(prev => {
        const map = new Map<string, PixelRect>();
        for (const r of prev) map.set(`${r.x},${r.y}`, r);
        for (const [key, val] of batch) {
          if (val === null) map.delete(key);
          else map.set(key, val);
        }
        const next = Array.from(map.values());
        rectsRef.current = next;
        return next;
      });
      paintBatchRef.current = new Map();
    });
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const coords = getEventCoords(e);
    zoomAt(factor, coords.x, coords.y);
  }, [zoomAt, viewBox]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getEventCoords(e);
    const px = Math.floor(coords.x);
    const py = Math.floor(coords.y);
    if (activeTool === "pan") {
      panStart.current = { mx: e.clientX, my: e.clientY, vb: { ...viewBox } };
    } else if (activeTool === "zoom-in") {
      zoomAt(ZOOM_FACTOR, coords.x, coords.y);
    } else if (activeTool === "zoom-out") {
      zoomAt(1 / ZOOM_FACTOR, coords.x, coords.y);
    } else if (activeTool === "color-paint") {
      isPainting.current = true;
      paintPixelBatched(px, py);
      schedulePaintFlush();
    } else if (activeTool === "erase") {
      isPainting.current = true;
      paintPixelBatched(px, py, true);
      schedulePaintFlush();
    } else if (activeTool === "select-box") {
      setSelStart({ sx: coords.x, sy: coords.y });
      setSelRect(null); setSelectedIds(new Set());
    }
  }, [activeTool, viewBox, zoomAt, paintPixelBatched, schedulePaintFlush]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (activeTool === "pan" && panStart.current) {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - panStart.current.mx) / r.width * panStart.current.vb.w;
      const dy = (e.clientY - panStart.current.my) / r.height * panStart.current.vb.h;
      setViewBox({ ...panStart.current.vb, x: panStart.current.vb.x - dx, y: panStart.current.vb.y - dy });
    } else if ((activeTool === "color-paint" || activeTool === "erase") && isPainting.current) {
      const c = getEventCoords(e);
      paintPixelBatched(Math.floor(c.x), Math.floor(c.y), activeTool === "erase");
      schedulePaintFlush();
    } else if (activeTool === "select-box" && selStart) {
      const c = getEventCoords(e);
      setSelRect({ x: Math.min(selStart.sx, c.x), y: Math.min(selStart.sy, c.y), w: Math.abs(c.x - selStart.sx), h: Math.abs(c.y - selStart.sy) });
    }
  }, [activeTool, selStart, paintPixelBatched, schedulePaintFlush, viewBox]);

  const onMouseUp = useCallback(() => {
    if (activeTool === "pan") panStart.current = null;
    if ((activeTool === "color-paint" || activeTool === "erase") && isPainting.current) {
      isPainting.current = false;
      if (paintFrameRef.current) {
        cancelAnimationFrame(paintFrameRef.current);
        paintFrameRef.current = null;
      }
      // Final flush — commit to history
      const batch = paintBatchRef.current;
      paintBatchRef.current = new Map();
      setRects(prev => {
        const map = new Map<string, PixelRect>();
        for (const r of prev) map.set(`${r.x},${r.y}`, r);
        for (const [key, val] of batch) {
          if (val === null) map.delete(key);
          else map.set(key, val);
        }
        const next = Array.from(map.values());
        rectsRef.current = next;
        // Push to history after state update
        setTimeout(() => {
          historyStack.current = historyStack.current.slice(0, histIdx.current + 1);
          historyStack.current.push([...next]);
          if (historyStack.current.length > MAX_HISTORY_FRAMES) {
            historyStack.current = historyStack.current.slice(historyStack.current.length - MAX_HISTORY_FRAMES);
          }
          histIdx.current = historyStack.current.length - 1;
          syncUndoRedo();
        }, 0);
        return next;
      });
    }
    if (activeTool === "select-box" && selRect) {
      setSelectedIds(new Set(
        rectsRef.current
          .filter(r => r.x >= selRect.x && r.x < selRect.x + selRect.w && r.y >= selRect.y && r.y < selRect.y + selRect.h)
          .map(r => r.id)
      ));
      setSelStart(null);
    }
  }, [activeTool, selRect]);

  const fillSelection = () => {
    if (selectedIds.size === 0) return;
    pushHistory(rectsRef.current.map(r => selectedIds.has(r.id) ? { ...r, color: activeColor } : r));
    setSelectedIds(new Set()); setSelRect(null);
  };

  const deleteSelection = () => {
    if (selectedIds.size === 0) return;
    pushHistory(rectsRef.current.filter(r => !selectedIds.has(r.id)));
    setSelectedIds(new Set()); setSelRect(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const aspect = width / height;
        const imageArea = width * height;
        const scaledBudget = PIXEL_BUDGET_BASE * Math.sqrt(imageArea / (512 * 512));
        let newH = Math.round(Math.sqrt(scaledBudget / aspect));
        let newW = Math.round(newH * aspect);
        if (newW > MAX_SIDE || newH > MAX_SIDE) {
          const clamp = Math.min(MAX_SIDE / newW, MAX_SIDE / newH);
          newW = Math.round(newW * clamp);
          newH = Math.round(newH * clamp);
        }
        newW = Math.max(1, newW);
        newH = Math.max(1, newH);
        width = newW; height = newH;
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const newRects = imageDataToRects(ctx.getImageData(0, 0, width, height));
        setGridW(width); setGridH(height);
        gridWRef.current = width; gridHRef.current = height;
        setViewBox({ x: 0, y: 0, w: width, h: height });
        historyStack.current = [[], newRects];
        histIdx.current = 1;
        setRects(newRects);
        rectsRef.current = newRects;
        syncUndoRedo();
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  };

  const downloadCode = () => {
    if (!code) return;
    const ext = exportFormat === "css-grid" ? "html" : "svg";
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pixel-art.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── AUREON SSE streaming helper ────────────────────────────────────────────
  const callAureonStream = async (
    messages: { role: "user" | "assistant"; content: string }[],
    systemPrompt: string
  ): Promise<string> => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, mode: "standard", systemPrompt }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let fullText = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) fullText += content;
        } catch { /* ignore partial */ }
      }
    }

    // Flush remaining buffer
    for (let raw of textBuffer.split("\n")) {
      if (!raw || raw.startsWith(":")) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) fullText += content;
      } catch { /* ignore */ }
    }

    return fullText || "No response received.";
  };

  // ── AUREON ─────────────────────────────────────────────────────────────────
  const buildSystemPrompt = (currentRects: PixelRect[], currentW: number, currentH: number, forLoop = false) => {
    const canvasContext = currentRects.length > 0
      ? `[Canvas: ${currentW}×${currentH} grid, ${currentRects.length} pixels. Dominant colors: ${[...new Set(currentRects.map(r => r.color))].slice(0, 6).join(", ")}. Sample pixels: ${currentRects.slice(0, 12).map(r => `(${r.x},${r.y})=${r.color}`).join(", ")}${currentRects.length > 12 ? `...+${currentRects.length - 12} more` : ""}]`
      : `[Canvas: Empty ${currentW}×${currentH} grid]`;

    const loopInstructions = forLoop ? `
AUTONOMOUS LOOP MODE: You are operating in a self-correcting autonomous loop.
- After editing, you MUST critically "imagine" the result in your mind and score your confidence: DONE (90%+ satisfied) or ITERATE (needs more work).
- End your response with one of these two tags on its own line:
  <LOOP_STATUS: DONE> — you are satisfied with the result
  <LOOP_STATUS: ITERATE reason="what still needs fixing"> — you will continue improving
- Always include a pixel edit JSON block to apply changes. Never just describe — always edit.
- Be systematic: each iteration should address one specific improvement.
` : "";

    return `You are AUREON, an elite AI assistant embedded in a pixel art and SVG editor called "Imagine To Code" (created by ZALI Software).

Your capabilities:
1. Analyze and describe the current pixel art
2. Suggest creative ideas, color palettes, and design improvements
3. Ask 1-2 focused clarifying questions when the user's intent is unclear
4. DIRECTLY EDIT the canvas by outputting a JSON code block

When you want to edit the canvas, respond with a JSON block in this EXACT format:
\`\`\`json
{"pixels":[{"x":5,"y":3,"color":"#FF4400"},{"x":6,"y":3,"color":"#FF4400"}]}
\`\`\`

Pixel edit rules:
- x: 0 to ${currentW - 1}, y: 0 to ${currentH - 1}
- Colors: valid hex strings like #FF4400
- Use color "erase" to remove a pixel
- Only include pixels that CHANGE — do not send the full grid
- For drawing shapes, calculate exact pixel coordinates mathematically

Current canvas: ${canvasContext}
${loopInstructions}
When drawing, be precise and systematic. If the request is ambiguous, ask one focused clarifying question first, then draw.`;
  };

  const sendToAureon = async () => {
    const inputText = aureonInput.trim();
    if (!inputText) return;
    const userMsg: AureonMessage = { id: uid(), role: "user", content: inputText, timestamp: new Date() };
    const currentMessages = [...aureonMessages, userMsg];
    setAureonMessages(currentMessages);
    setAureonInput("");
    setIsAnalyzing(true);
    const currentRects = rectsRef.current;
    const currentW = gridWRef.current;
    const currentH = gridHRef.current;
    const apiMessages = currentMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    const systemPrompt = buildSystemPrompt(currentRects, currentW, currentH, false);

    try {
      const responseText = await callAureonStream(apiMessages, systemPrompt);
      const editedRects = parseAureonPixelEdit(responseText, currentRects, currentW, currentH);
      const assistantMsg: AureonMessage = { id: uid(), role: "assistant", content: responseText, canvasEdit: editedRects ?? undefined, timestamp: new Date() };
      setAureonMessages(prev => [...prev, assistantMsg]);
    } catch {
      toast({ title: "AUREON error", description: "Could not connect to AUREON. Please try again.", variant: "destructive" });
      setAureonMessages(prev => [...prev, { id: uid(), role: "assistant", content: "I couldn't connect to the AUREON intelligence engine. Please try again.", timestamp: new Date() }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyCanvasEdit = (newRects: PixelRect[]) => {
    pushHistory(newRects);
    toast({ title: "Canvas updated", description: "AUREON's edits applied." });
  };

  // ── Autonomous Edit → Imagine → Fix Loop (all technology preserved) ────────
  const startAutonomousLoop = async (goal: string) => {
    if (loopActive) return;
    loopAbortRef.current = false;
    setLoopActive(true);
    setLoopIteration(0);
    setIsAnalyzing(true);

    const goalMsg: AureonMessage = {
      id: uid(), role: "user",
      content: `◌ **AUTONOMOUS LOOP INITIATED**\n\n**Goal:** ${goal}\n\nAUREON will now enter an autonomous edit→imagine→fix cycle until the result is satisfactory.`,
      timestamp: new Date()
    };
    setAureonMessages(prev => [...prev, goalMsg]);

    let iteration = 0;
    let conversationHistory: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: goal }
    ];
    let currentRects = rectsRef.current;

    while (iteration < MAX_LOOP_ITERATIONS && !loopAbortRef.current) {
      iteration++;
      setLoopIteration(iteration);

      const phase = iteration === 1 ? "IMAGINE & DRAW" : "RE-IMAGINE & REFINE";
      setLoopStatus(`[Iteration ${iteration}/${MAX_LOOP_ITERATIONS}] ${phase}...`);

      const currentW = gridWRef.current;
      const currentH = gridHRef.current;
      const systemPrompt = buildSystemPrompt(currentRects, currentW, currentH, true);

      const iterationNote = iteration > 1
        ? `\n\n[LOOP ITERATION ${iteration}]: Re-examine your previous edit. Visually imagine the result pixel by pixel. What is still imperfect? Apply targeted corrections now.`
        : "";

      const messagesPayload = [
        ...conversationHistory.slice(0, -1),
        { role: "user" as const, content: conversationHistory[conversationHistory.length - 1].content + iterationNote }
      ];

      try {
        const responseText = await callAureonStream(messagesPayload, systemPrompt);

        const editedRects = parseAureonPixelEdit(responseText, currentRects, currentW, currentH);
        if (editedRects) {
          currentRects = editedRects;
          pushHistory(editedRects);
        }

        const doneMatch = responseText.match(/<LOOP_STATUS:\s*DONE>/i);
        const iterateMatch = responseText.match(/<LOOP_STATUS:\s*ITERATE\s+reason="([^"]+)">/i);
        const cleanResponse = responseText
          .replace(/<LOOP_STATUS:[^>]+>/gi, "")
          .trim();

        const loopTag = doneMatch
          ? `\n\n**Loop complete** — AUREON is satisfied after ${iteration} iteration${iteration > 1 ? "s" : ""}.`
          : iterateMatch
            ? `\n\n**Continuing** — ${iterateMatch[1]}`
            : "";

        const assistantMsg: AureonMessage = {
          id: uid(), role: "assistant",
          content: `**[Iteration ${iteration}]** ${cleanResponse}${loopTag}`,
          canvasEdit: editedRects ?? undefined,
          timestamp: new Date()
        };
        setAureonMessages(prev => [...prev, assistantMsg]);

        conversationHistory = [
          ...conversationHistory,
          { role: "assistant", content: responseText }
        ];

        if (doneMatch || loopAbortRef.current) break;
        if (!iterateMatch && !editedRects) break;

        await new Promise(r => setTimeout(r, 800));

      } catch {
        setAureonMessages(prev => [...prev, {
          id: uid(), role: "assistant",
          content: `**Loop error at iteration ${iteration}.** Stopping autonomous cycle.`,
          timestamp: new Date()
        }]);
        break;
      }
    }

    const finalStatus = loopAbortRef.current
      ? `Loop manually stopped after ${iteration} iteration${iteration > 1 ? "s" : ""}.`
      : iteration >= MAX_LOOP_ITERATIONS
        ? `Loop reached maximum depth (${MAX_LOOP_ITERATIONS} iterations). Final state applied.`
        : null;

    if (finalStatus) {
      setAureonMessages(prev => [...prev, { id: uid(), role: "assistant", content: finalStatus, timestamp: new Date() }]);
    }

    setLoopActive(false);
    setLoopIteration(0);
    setLoopStatus("");
    setIsAnalyzing(false);
  };

  const stopLoop = () => {
    loopAbortRef.current = true;
    setLoopStatus("Stopping...");
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const toolBtn = (tool: Tool, icon: React.ReactNode, title: string) => (
    <button
      key={tool}
      title={title}
      onClick={() => setActiveTool(tool)}
      className={`p-2.5 rounded-xl border transition-all ${
        activeTool === tool
          ? "bg-accent/20 border-accent/40 text-accent"
          : "border-border/20 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );

  const cursorStyle =
    activeTool === "pan" ? "grab" :
    activeTool === "color-paint" ? "crosshair" :
    activeTool === "erase" ? "cell" :
    activeTool === "zoom-in" ? "zoom-in" :
    activeTool === "zoom-out" ? "zoom-out" : "default";

  const canvasLocked = !activeSessionId;

  // Stats — memoized to avoid recalc
  const pixelCount = useMemo(() => rects.length, [rects]);
  const zoomPct = useMemo(() => Math.round(gridW / viewBox.w * 100), [gridW, viewBox.w]);

  return (
    <div className="flex h-full overflow-hidden bg-background/30 backdrop-blur-sm flex-col">
      {/* ── Beta Banner ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-border/20 bg-accent/5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-light tracking-[0.2em] uppercase text-accent/70 border border-accent/20 rounded-lg px-1.5 py-0.5">Beta</span>
          <span className="text-[10px] font-light text-muted-foreground/50 tracking-wide">Created by ZALI Software</span>
        </div>
        <div className="text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/30">Imagine to Code</div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sessions Sidebar ── */}
        <div className="flex-shrink-0 w-44 border-r border-border/20 bg-card/10 flex flex-col overflow-hidden">
          {sessionsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border border-accent/30 border-t-accent animate-spin" />
            </div>
          ) : (
            <SessionsPanel
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={loadSessionIntoEditor}
              onCreate={createSession}
              onDelete={deleteSession}
              onRename={renameSession}
              saving={saving}
            />
          )}
        </div>

        {/* ── Left Toolbar ── */}
        <aside className={`flex-shrink-0 w-48 flex flex-col gap-3 p-3 border-r border-border/20 overflow-y-auto bg-card/10 transition-opacity ${canvasLocked ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="space-y-1.5">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Canvas</p>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 hover:bg-accent/10 hover:border-accent/30 px-3 py-2.5 text-xs font-light text-muted-foreground hover:text-accent transition-all">
              <Upload className="h-3.5 w-3.5" /> Upload Image
            </button>
            <button onClick={clearCanvas} disabled={rects.length === 0} className="w-full flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 hover:bg-destructive/10 hover:border-destructive/30 px-3 py-2.5 text-xs font-light text-muted-foreground hover:text-destructive transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <RefreshCw className="h-3.5 w-3.5" /> Clear Canvas
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Tools</p>
            <div className="grid grid-cols-3 gap-1">
              {toolBtn("pan", <Hand className="h-3.5 w-3.5" />, "Pan")}
              {toolBtn("zoom-in", <ZoomIn className="h-3.5 w-3.5" />, "Zoom In")}
              {toolBtn("zoom-out", <ZoomOut className="h-3.5 w-3.5" />, "Zoom Out")}
              {toolBtn("select-box", <Square className="h-3.5 w-3.5" />, "Select Box")}
              {toolBtn("color-paint", <Paintbrush className="h-3.5 w-3.5" />, "Paint")}
              {toolBtn("erase", <Eraser className="h-3.5 w-3.5" />, "Erase")}
            </div>
            <button onClick={() => setViewBox({ x: 0, y: 0, w: gridW, h: gridH })} className="w-full flex items-center gap-2 rounded-xl border border-border/20 px-3 py-2 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all">
              <Maximize2 className="h-3 w-3" /> Fit to View
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Paint Color</p>
            <div className="flex items-center gap-2">
              <input type="color" value={activeColor} onChange={e => setActiveColor(e.target.value)} className="w-9 h-9 rounded-xl border border-border/20 bg-transparent cursor-pointer p-0.5" />
              <span className="text-[10px] font-mono text-muted-foreground/70">{activeColor.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {["#EF4444","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#000000","#FFFFFF","#6B7280","#7C3AED","#06B6D4"].map(c => (
                <button key={c} title={c} onClick={() => setActiveColor(c)} className={`w-5 h-5 rounded-lg border-2 transition-all ${activeColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`} style={{ background: c }} />
              ))}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Selection ({selectedIds.size}px)</p>
              <button onClick={fillSelection} className="w-full rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 px-3 py-2 text-xs font-light text-accent transition-all">Fill with color</button>
              <button onClick={deleteSelection} className="w-full rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 px-3 py-2 text-xs font-light text-destructive transition-all">Delete selection</button>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">History</p>
            <div className="flex gap-1">
              <button onClick={undo} disabled={!canUndo} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border/20 px-2 py-2 text-[10px] text-muted-foreground disabled:opacity-30 hover:bg-foreground/5 hover:text-foreground transition-all disabled:cursor-not-allowed">
                <Undo2 className="h-3 w-3" /> Undo
              </button>
              <button onClick={redo} disabled={!canRedo} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border/20 px-2 py-2 text-[10px] text-muted-foreground disabled:opacity-30 hover:bg-foreground/5 hover:text-foreground transition-all disabled:cursor-not-allowed">
                <Undo2 className="h-3 w-3 scale-x-[-1]" /> Redo
              </button>
            </div>
          </div>

          <div className="mt-auto text-[9px] text-muted-foreground/30 font-mono space-y-0.5 border-t border-border/10 pt-3">
            <p>Grid: {gridW} × {gridH}</p>
            <p>Pixels: {pixelCount.toLocaleString()}</p>
            <p>Zoom: {zoomPct}%</p>
          </div>
        </aside>

        {/* ── Canvas — HTML Canvas renderer for performance ── */}
        <main className="flex-1 flex items-center justify-center overflow-hidden bg-card/5 relative">
          {canvasLocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
              <div className="h-16 w-16 rounded-full border border-border/20 flex items-center justify-center bg-card/20">
                <FolderOpen className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-xs font-light text-muted-foreground/40 tracking-wide">Select or create a session to begin</p>
            </div>
          ) : rects.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="h-16 w-16 rounded-full border border-accent/20 flex items-center justify-center bg-accent/5">
                <Paintbrush className="h-7 w-7 text-accent/30 animate-pulse" />
              </div>
              <p className="text-xs font-light text-muted-foreground/40 tracking-wide">Upload an image or paint pixels</p>
              <p className="text-[10px] font-light text-muted-foreground/25 tracking-widest uppercase">Or ask AUREON to create something →</p>
            </div>
          ) : null}
          {/* Canvas-based renderer replaces SVG <rect> loop — handles 1M pixels smoothly */}
          <CanvasRenderer
            rects={rects}
            gridW={gridW}
            gridH={gridH}
            viewBox={viewBox}
            selectedIds={selectedIds}
            selRect={selRect}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onWheel={onWheel}
            cursorStyle={cursorStyle}
            canvasLocked={canvasLocked}
          />
        </main>

        {/* ── Right Panel ── */}
        <aside className={`flex-shrink-0 w-80 flex flex-col border-l border-border/20 bg-card/10 transition-opacity ${canvasLocked ? "opacity-40 pointer-events-none" : ""}`}>
          {/* Code Output */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/20">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50 mb-2">Code Output</p>
            <div className="flex gap-1.5 items-center">
              <select value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} className="flex-1 rounded-xl border border-border/20 bg-card/20 text-[10px] font-light text-foreground px-2 py-1.5 outline-none">
                <option value="svg">Raw SVG</option>
                <option value="minified-svg">Minified SVG</option>
                <option value="css-grid">CSS Grid (HTML)</option>
              </select>
              <button onClick={copyCode} disabled={!code} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border/20 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={downloadCode} disabled={!code} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border/20 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <Download className="h-3 w-3" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-shrink-0 max-h-28">
            <pre className="p-3 text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
              {code || "// Draw something to generate code"}
            </pre>
          </ScrollArea>
          {code && (
            <div className="flex-shrink-0 px-4 py-1 border-b border-border/20 text-[9px] text-muted-foreground/30 font-mono">
              {code.length.toLocaleString()} chars
            </div>
          )}

          {/* AUREON Panel */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-border/20">
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/10 bg-accent/5">
              <div className="flex items-center gap-2">
                <Sparkles className={`h-3 w-3 text-accent ${loopActive ? "animate-spin" : "animate-pulse"}`} />
                <p className="text-[9px] font-light tracking-[0.2em] uppercase text-accent/80">AUREON — Design Intelligence</p>
              </div>
              {loopActive && (
                <span className="text-[8px] font-mono text-accent/60 border border-accent/20 rounded-md px-1.5 py-0.5 bg-accent/5">
                  Loop {loopIteration}/{MAX_LOOP_ITERATIONS}
                </span>
              )}
            </div>
            <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {aureonMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                  <div className="h-10 w-10 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-center">
                    <Wand2 className="h-5 w-5 text-accent/40" />
                  </div>
                  <p className="text-[10px] font-light text-muted-foreground/40 text-center tracking-wide leading-relaxed">
                    Ask AUREON to design, edit, or analyze your pixel art. It will ask questions and draw directly on the canvas.
                  </p>
                  <div className="flex flex-col gap-1.5 w-full">
                    <p className="text-[8px] text-muted-foreground/30 text-center tracking-widest uppercase mt-1">Single shot</p>
                    {["Draw a simple house", "Suggest a color palette"].map(s => (
                      <button key={s} onClick={() => setAureonInput(s)} className="w-full text-left text-[10px] font-light text-muted-foreground/50 hover:text-accent/70 border border-border/10 hover:border-accent/20 rounded-xl px-3 py-2 transition-all hover:bg-accent/5">
                        {s}
                      </button>
                    ))}
                    <p className="text-[8px] text-muted-foreground/30 text-center tracking-widest uppercase mt-1">◌ Autonomous loop</p>
                    {["Draw a detailed pixel landscape and refine until perfect", "Create a complex character sprite and self-correct details"].map(s => (
                      <button key={s} onClick={() => { setAureonInput(""); startAutonomousLoop(s); }} className="w-full text-left text-[10px] font-light text-muted-foreground/50 hover:text-accent/70 border border-accent/10 hover:border-accent/30 rounded-xl px-3 py-2 transition-all hover:bg-accent/5">
                        <span className="text-accent/50 mr-1">↺</span>{s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                aureonMessages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${msg.role === "user" ? "bg-foreground/10 border border-border/20" : "bg-accent/15 border border-accent/20"}`}>
                      {msg.role === "user" ? <User className="h-3 w-3 text-muted-foreground" /> : <Sparkles className="h-3 w-3 text-accent" />}
                    </div>
                    <div className={`flex-1 min-w-0 space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`rounded-xl px-3 py-2 text-[10px] font-light leading-relaxed max-w-full ${msg.role === "user" ? "bg-accent/15 border border-accent/20 text-foreground/90" : "bg-card/30 border border-border/20 text-muted-foreground"}`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs max-w-none text-[10px]">
                            <ReactMarkdown
                              components={{
                                code: ({ children, className }) => {
                                  const isBlock = className?.includes("language-");
                                  if (isBlock) return (
                                    <div className="mt-1.5 rounded-lg bg-background/40 border border-border/20 p-2 overflow-x-auto">
                                      <code className="text-[9px] font-mono text-accent/70">{children}</code>
                                    </div>
                                  );
                                  return <code className="bg-accent/10 rounded px-1 text-[9px] font-mono text-accent/80">{children}</code>;
                                },
                                p: ({ children }) => <p className="mb-1 last:mb-0 text-muted-foreground">{children}</p>,
                              }}
                            >
                              {msg.content.replace(/```json[\s\S]*?```/g, "[Canvas edit ready ↓]")}
                            </ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                      {msg.role === "assistant" && msg.canvasEdit && (
                        <button onClick={() => applyCanvasEdit(msg.canvasEdit!)} className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 px-3 py-1.5 text-[10px] font-light text-accent transition-all">
                          <Wand2 className="h-3 w-3" /> Apply to canvas
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isAnalyzing && (
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-accent animate-pulse" />
                  </div>
                  <div className="rounded-xl px-3 py-2 bg-card/30 border border-border/20">
                    <div className="flex gap-1 items-center">
                      <div className="w-1 h-1 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1 h-1 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1 h-1 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 p-3 border-t border-border/10 space-y-2">
              {loopActive && (
                <div className="flex items-center justify-between rounded-xl border border-accent/25 bg-accent/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-[9px] font-light text-accent/80 truncate">{loopStatus}</span>
                  </div>
                  <button
                    onClick={stopLoop}
                    className="flex-shrink-0 flex items-center gap-1 text-[9px] text-destructive/70 hover:text-destructive border border-destructive/20 hover:border-destructive/40 rounded-lg px-2 py-1 transition-all ml-2"
                  >
                    <StopIcon className="h-2.5 w-2.5" /> Stop
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={aureonInput}
                  onChange={e => setAureonInput(e.target.value)}
                  placeholder="Ask AUREON to design or edit..."
                  rows={2}
                  className="flex-1 rounded-xl border border-border/20 bg-card/20 text-[10px] font-light text-foreground placeholder:text-muted-foreground/30 px-3 py-2 outline-none resize-none focus:border-accent/30 transition-all"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToAureon(); } }}
                />
                <div className="flex flex-col gap-1.5 self-end">
                  <button
                    onClick={sendToAureon}
                    disabled={isAnalyzing || !aureonInput.trim()}
                    title="Single message"
                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/20 text-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { const goal = aureonInput.trim(); if (goal) { setAureonInput(""); startAutonomousLoop(goal); } }}
                    disabled={isAnalyzing || !aureonInput.trim() || loopActive}
                    title="Autonomous loop: AUREON edits → imagines → fixes, unlimited iterations"
                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-accent/40 bg-accent/20 hover:bg-accent/35 text-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/25 tracking-wide">
                Enter / <Send className="inline h-2.5 w-2.5" /> send once · <RotateCcw className="inline h-2.5 w-2.5" /> autonomous loop
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ImagineToCodeView;
