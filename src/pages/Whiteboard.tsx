import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Pencil, Type, Eraser, Move, Minus, Plus,
  Square, Circle as CircleIcon, Triangle, Diamond, Star,
  MousePointer, Image as ImageIcon, Undo2, Redo2, Trash2,
  Wallpaper, ChevronDown
} from "lucide-react";

import heroBgDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import wallpaperSeraph from "@/assets/wallpaper-seraph.png";
import wallpaperProphet from "@/assets/wallpaper-prophet.png";
import wallpaperNexus from "@/assets/wallpaper-nexus.png";
import wallpaperSentinel from "@/assets/wallpaper-sentinel.png";
import wallpaperInferno from "@/assets/wallpaper-inferno.png";
import wallpaperSorrow from "@/assets/wallpaper-sorrow.png";
import wallpaperSilhouette from "@/assets/wallpaper-silhouette.png";
import wallpaperPhantom from "@/assets/wallpaper-phantom.png";
import wallpaperAbyss from "@/assets/wallpaper-abyss.png";

const WALLPAPERS = [
  { key: "none", label: "Dark", src: "" },
  { key: "default", label: "Original", src: heroBgDefault },
  { key: "raven", label: "Raven", src: wallpaperRaven },
  { key: "eclipse", label: "Eclipse", src: wallpaperEclipse },
  { key: "glitch", label: "Glitch", src: wallpaperGlitch },
  { key: "aureon", label: "Aureon", src: wallpaperAureon },
  { key: "seraph", label: "Seraph", src: wallpaperSeraph },
  { key: "prophet", label: "Prophet", src: wallpaperProphet },
  { key: "nexus", label: "Nexus", src: wallpaperNexus },
  { key: "sentinel", label: "Sentinel", src: wallpaperSentinel },
  { key: "inferno", label: "Inferno", src: wallpaperInferno },
  { key: "sorrow", label: "Sorrow", src: wallpaperSorrow },
  { key: "silhouette", label: "Silhouette", src: wallpaperSilhouette },
  { key: "phantom", label: "Phantom", src: wallpaperPhantom },
  { key: "abyss", label: "Abyss", src: wallpaperAbyss },
];

/* ─── Types ─── */
type Tool = "select" | "draw" | "text" | "eraser" | "pan" | "rect" | "circle" | "triangle" | "diamond" | "star" | "line";
interface Point { x: number; y: number }

interface DrawElement {
  id: string;
  type: "path" | "text" | "image" | "rect" | "circle" | "triangle" | "diamond" | "star" | "line";
  points?: Point[];
  color?: string;
  fillColor?: string;
  width?: number;
  text?: string;
  x?: number; y?: number;
  x2?: number; y2?: number;
  w?: number; h?: number;
  fontSize?: number;
  src?: string;
  imgWidth?: number; imgHeight?: number;
  borderRadius?: number;
  radius?: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const COLORS = [
  "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e",
  "#14b8a6", "#84cc16", "#000000", "#6b7280", "#d1d5db",
];

const SHAPE_TOOLS: { tool: Tool; icon: any; label: string }[] = [
  { tool: "rect", icon: Square, label: "Rectangle" },
  { tool: "circle", icon: CircleIcon, label: "Circle" },
  { tool: "triangle", icon: Triangle, label: "Triangle" },
  { tool: "diamond", icon: Diamond, label: "Diamond" },
  { tool: "star", icon: Star, label: "Star" },
  { tool: "line", icon: Minus, label: "Line" },
];

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ffffff");
  const [fillColor, setFillColor] = useState("transparent");
  const [brushSize, setBrushSize] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#ffffff");
  const [customFill, setCustomFill] = useState("#3b82f6");
  const [showShapes, setShowShapes] = useState(false);
  const [showWallpapers, setShowWallpapers] = useState(false);
  const [wallpaper, setWallpaper] = useState("none");

  const [elements, setElements] = useState<DrawElement[]>([]);
  const [undoStack, setUndoStack] = useState<DrawElement[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawElement[][]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);

  const [editingText, setEditingText] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textFontSize, setTextFontSize] = useState(18);

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageRadius, setImageRadius] = useState(0);
  const [dragStart, setDragStart] = useState<Point | null>(null);

  const wpSrc = WALLPAPERS.find(w => w.key === wallpaper)?.src || "";
  const isShapeTool = ["rect", "circle", "triangle", "diamond", "star", "line"].includes(tool);

  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return { x: (sx - rect.left - panOffset.x) / zoom, y: (sy - rect.top - panOffset.y) / zoom };
  }, [panOffset, zoom]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), elements.map(e => ({ ...e, points: e.points ? [...e.points] : undefined }))]);
    setRedoStack([]);
  }, [elements]);

  const undo = () => { if (!undoStack.length) return; setRedoStack(p => [...p, elements]); setElements(undoStack[undoStack.length - 1]); setUndoStack(p => p.slice(0, -1)); };
  const redo = () => { if (!redoStack.length) return; setUndoStack(p => [...p, elements]); setElements(redoStack[redoStack.length - 1]); setRedoStack(p => p.slice(0, -1)); };

  /* ─── Pointer handlers ─── */
  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (tool === "pan" || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (tool === "select") {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === "image" && el.x != null && el.y != null && el.imgWidth && el.imgHeight) {
          if (x >= el.x && x <= el.x + el.imgWidth && y >= el.y && y <= el.y + el.imgHeight) {
            setSelectedElement(el.id); setSelectedImageId(el.id); setImageRadius(el.borderRadius || 0);
            setDragStart({ x: x - el.x, y: y - el.y }); return;
          }
        }
        if (el.type === "text" && el.x != null && el.y != null) {
          const tw = (el.text?.length || 1) * (el.fontSize || 18) * 0.6;
          const th = (el.fontSize || 18) * 1.4;
          if (x >= el.x && x <= el.x + tw && y >= el.y - th && y <= el.y) {
            setSelectedElement(el.id); setSelectedImageId(null); setDragStart({ x: x - el.x, y: y - el.y }); return;
          }
        }
        // Shape hit test (bounding box)
        if (["rect", "circle", "triangle", "diamond", "star", "line"].includes(el.type) && el.x != null && el.y != null) {
          const sw = el.w || 0; const sh = el.h || 0;
          const minX = Math.min(el.x, el.x + sw); const maxX = Math.max(el.x, el.x + sw);
          const minY = Math.min(el.y, el.y + sh); const maxY = Math.max(el.y, el.y + sh);
          if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
            setSelectedElement(el.id); setSelectedImageId(null); setDragStart({ x: x - el.x, y: y - el.y }); return;
          }
        }
      }
      setSelectedElement(null); setSelectedImageId(null); return;
    }

    if (tool === "text") { setEditingText({ x, y }); setTextValue(""); return; }

    if (isShapeTool) {
      pushUndo();
      setShapeStart({ x, y });
      setElements(prev => [...prev, { id: uid(), type: tool as any, x, y, w: 0, h: 0, color, fillColor, width: brushSize }]);
      setIsDrawing(true);
      return;
    }

    if (tool === "draw" || tool === "eraser") {
      pushUndo();
      setElements(prev => [...prev, {
        id: uid(), type: "path", points: [{ x, y }],
        color: tool === "eraser" ? "eraser" : color,
        width: tool === "eraser" ? brushSize * 4 : brushSize,
      }]);
      setIsDrawing(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) { setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }

    if (tool === "select" && selectedElement && dragStart) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setElements(prev => prev.map(el => el.id !== selectedElement ? el : { ...el, x: x - dragStart.x, y: y - dragStart.y }));
      return;
    }

    if (!isDrawing) return;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (isShapeTool && shapeStart) {
      setElements(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) { last.w = x - shapeStart.x; last.h = y - shapeStart.y; }
        return updated;
      });
      return;
    }

    setElements(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.points) last.points = [...last.points, { x, y }];
      return updated;
    });
  };

  const handlePointerUp = () => { setIsDrawing(false); setIsPanning(false); setDragStart(null); setShapeStart(null); };

  const submitText = () => {
    if (!editingText || !textValue.trim()) { setEditingText(null); return; }
    pushUndo();
    setElements(prev => [...prev, { id: uid(), type: "text", text: textValue, x: editingText.x, y: editingText.y, fontSize: textFontSize, color }]);
    setEditingText(null); setTextValue("");
  };

  /* ─── Image paste ─── */
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const img = new window.Image();
            img.onload = () => {
              const maxDim = 400;
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w *= r; h *= r; }
              pushUndo();
              setElements(prev => [...prev, { id: uid(), type: "image", src: reader.result as string, x: -panOffset.x / zoom + 100, y: -panOffset.y / zoom + 100, imgWidth: w, imgHeight: h, borderRadius: 0 }]);
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [panOffset, zoom, pushUndo]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w *= r; h *= r; }
        pushUndo();
        setElements(prev => [...prev, { id: uid(), type: "image", src: reader.result as string, x: -panOffset.x / zoom + 100, y: -panOffset.y / zoom + 100, imgWidth: w, imgHeight: h, borderRadius: 0 }]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* ─── Render ─── */
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const bgLoadedSrc = useRef("");

  useEffect(() => {
    if (wpSrc && wpSrc !== bgLoadedSrc.current) {
      const img = new window.Image();
      img.src = wpSrc;
      img.onload = () => { bgImageRef.current = img; bgLoadedSrc.current = wpSrc; };
    } else if (!wpSrc) {
      bgImageRef.current = null;
      bgLoadedSrc.current = "";
    }
  }, [wpSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Background
    if (bgImageRef.current && bgImageRef.current.complete && wpSrc) {
      ctx.drawImage(bgImageRef.current, 0, 0, rect.width, rect.height);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      // Blur effect via re-draw with filter
      ctx.filter = "blur(4px)";
      ctx.drawImage(bgImageRef.current, 0, 0, rect.width, rect.height);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, rect.width, rect.height);
    } else {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Grid
    const gridSize = 40;
    const sX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize - gridSize;
    const sY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize - gridSize;
    const eX = sX + rect.width / zoom + gridSize * 2;
    const eY = sY + rect.height / zoom + gridSize * 2;
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 0.5;
    for (let gx = sX; gx < eX; gx += gridSize) { ctx.beginPath(); ctx.moveTo(gx, sY); ctx.lineTo(gx, eY); ctx.stroke(); }
    for (let gy = sY; gy < eY; gy += gridSize) { ctx.beginPath(); ctx.moveTo(sX, gy); ctx.lineTo(eX, gy); ctx.stroke(); }

    // Elements
    for (const el of elements) {
      if (el.type === "path" && el.points && el.points.length > 1) {
        ctx.beginPath(); ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
        if (el.color === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; }
        else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = el.color || "#fff"; }
        ctx.lineWidth = el.width || 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }

      if (el.type === "text" && el.text && el.x != null && el.y != null) {
        ctx.font = `${el.fontSize || 18}px 'Inter', sans-serif`;
        ctx.fillStyle = el.color || "#fff";
        ctx.fillText(el.text, el.x, el.y);
        if (el.id === selectedElement) {
          const tw = ctx.measureText(el.text).width;
          ctx.strokeStyle = "rgba(59,130,246,0.5)"; ctx.lineWidth = 1;
          ctx.strokeRect(el.x - 4, el.y - (el.fontSize || 18) - 4, tw + 8, (el.fontSize || 18) * 1.4 + 8);
        }
      }

      if (el.type === "image" && el.src && el.x != null && el.y != null) {
        let cached = imageCache.current.get(el.id);
        if (!cached) { cached = new window.Image(); cached.src = el.src; imageCache.current.set(el.id, cached); cached.onload = () => setElements(p => [...p]); }
        if (cached.complete) {
          const iw = el.imgWidth || 200, ih = el.imgHeight || 200, ir = el.borderRadius || 0;
          ctx.save();
          if (ir > 0) {
            ctx.beginPath();
            ctx.moveTo(el.x + ir, el.y); ctx.lineTo(el.x + iw - ir, el.y);
            ctx.quadraticCurveTo(el.x + iw, el.y, el.x + iw, el.y + ir);
            ctx.lineTo(el.x + iw, el.y + ih - ir);
            ctx.quadraticCurveTo(el.x + iw, el.y + ih, el.x + iw - ir, el.y + ih);
            ctx.lineTo(el.x + ir, el.y + ih);
            ctx.quadraticCurveTo(el.x, el.y + ih, el.x, el.y + ih - ir);
            ctx.lineTo(el.x, el.y + ir);
            ctx.quadraticCurveTo(el.x, el.y, el.x + ir, el.y);
            ctx.closePath(); ctx.clip();
          }
          ctx.drawImage(cached, el.x, el.y, iw, ih);
          ctx.restore();
          if (el.id === selectedElement) { ctx.strokeStyle = "rgba(59,130,246,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(el.x - 2, el.y - 2, iw + 4, ih + 4); }
        }
      }

      // ── Shapes ──
      if (["rect", "circle", "triangle", "diamond", "star", "line"].includes(el.type) && el.x != null && el.y != null) {
        const sw = el.w || 0, sh = el.h || 0;
        ctx.strokeStyle = el.color || "#fff";
        ctx.lineWidth = el.width || 2;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const fc = el.fillColor && el.fillColor !== "transparent" ? el.fillColor : null;

        if (el.type === "rect") {
          if (fc) { ctx.fillStyle = fc; ctx.fillRect(el.x, el.y, sw, sh); }
          ctx.strokeRect(el.x, el.y, sw, sh);
        }
        if (el.type === "circle") {
          const cx = el.x + sw / 2, cy = el.y + sh / 2;
          const rx = Math.abs(sw / 2), ry = Math.abs(sh / 2);
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (fc) { ctx.fillStyle = fc; ctx.fill(); }
          ctx.stroke();
        }
        if (el.type === "triangle") {
          ctx.beginPath();
          ctx.moveTo(el.x + sw / 2, el.y);
          ctx.lineTo(el.x + sw, el.y + sh);
          ctx.lineTo(el.x, el.y + sh);
          ctx.closePath();
          if (fc) { ctx.fillStyle = fc; ctx.fill(); }
          ctx.stroke();
        }
        if (el.type === "diamond") {
          ctx.beginPath();
          ctx.moveTo(el.x + sw / 2, el.y);
          ctx.lineTo(el.x + sw, el.y + sh / 2);
          ctx.lineTo(el.x + sw / 2, el.y + sh);
          ctx.lineTo(el.x, el.y + sh / 2);
          ctx.closePath();
          if (fc) { ctx.fillStyle = fc; ctx.fill(); }
          ctx.stroke();
        }
        if (el.type === "star") {
          const cx = el.x + sw / 2, cy = el.y + sh / 2;
          const outerR = Math.min(Math.abs(sw), Math.abs(sh)) / 2;
          const innerR = outerR * 0.4;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          if (fc) { ctx.fillStyle = fc; ctx.fill(); }
          ctx.stroke();
        }
        if (el.type === "line") {
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + sw, el.y + sh); ctx.stroke();
        }

        if (el.id === selectedElement) {
          ctx.strokeStyle = "rgba(59,130,246,0.4)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.strokeRect(Math.min(el.x, el.x + sw) - 4, Math.min(el.y, el.y + sh) - 4, Math.abs(sw) + 8, Math.abs(sh) + 8);
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();
  }, [elements, panOffset, zoom, selectedElement, wpSrc]);

  /* ─── Zoom via wheel ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(prev => Math.max(0.1, Math.min(5, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
      } else {
        setPanOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => { const h = () => setZoom(z => z); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const updateImageRadius = (val: number) => { setImageRadius(val); if (!selectedImageId) return; setElements(prev => prev.map(el => el.id === selectedImageId ? { ...el, borderRadius: val } : el)); };
  const resizeSelectedImage = (factor: number) => { if (!selectedImageId) return; setElements(prev => prev.map(el => el.id !== selectedImageId ? el : { ...el, imgWidth: (el.imgWidth || 200) * factor, imgHeight: (el.imgHeight || 200) * factor })); };
  const clearAll = () => { pushUndo(); setElements([]); setSelectedElement(null); setSelectedImageId(null); };
  const deleteSelected = () => { if (!selectedElement) return; pushUndo(); setElements(prev => prev.filter(el => el.id !== selectedElement)); setSelectedElement(null); setSelectedImageId(null); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingText) return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const toolBtn = (t: Tool) => `p-2 rounded-lg transition-all duration-200 ${tool === t ? "bg-foreground/15 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`;

  const cursorStyle = tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div className="h-screen w-screen overflow-hidden bg-background relative flex flex-col">
      {/* ─── Header watermark ─── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/60 backdrop-blur-xl px-5 py-2.5 hover:bg-card/80 transition-colors">
            <span className="text-base font-extralight tracking-[0.25em] text-foreground">AUREON</span>
          </Link>
          <span className="text-[10px] font-extralight tracking-[0.3em] text-muted-foreground/40 uppercase hidden sm:block">Whiteboard</span>
        </div>
        <div className="text-[9px] font-extralight tracking-[0.25em] text-muted-foreground/20 uppercase">◈ AUREON INTELLIGENCE PLATFORM</div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl px-3 py-2 shadow-2xl flex-wrap justify-center">
        <button onClick={() => setTool("select")} className={toolBtn("select")} title="Select"><MousePointer className="h-4 w-4" /></button>
        <button onClick={() => setTool("draw")} className={toolBtn("draw")} title="Draw"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => setTool("text")} className={toolBtn("text")} title="Text"><Type className="h-4 w-4" /></button>
        <button onClick={() => setTool("eraser")} className={toolBtn("eraser")} title="Eraser"><Eraser className="h-4 w-4" /></button>
        <button onClick={() => setTool("pan")} className={toolBtn("pan")} title="Pan"><Move className="h-4 w-4" /></button>

        <div className="w-px h-6 bg-border/20 mx-1" />

        {/* Shapes dropdown */}
        <div className="relative">
          <button onClick={() => setShowShapes(!showShapes)} className={`p-2 rounded-lg transition-all duration-200 ${isShapeTool ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`} title="Shapes">
            <Square className="h-4 w-4" />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-1 right-1" />
          </button>
          {showShapes && (
            <div className="absolute top-full mt-2 left-0 p-2 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 flex gap-1" onClick={e => e.stopPropagation()}>
              {SHAPE_TOOLS.map(s => (
                <button key={s.tool} onClick={() => { setTool(s.tool); setShowShapes(false); }} className={`p-2.5 rounded-lg transition-all ${tool === s.tool ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`} title={s.label}>
                  <s.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border/20 mx-1" />

        {/* Stroke color */}
        <div className="relative">
          <button onClick={() => { setShowColorPicker(!showColorPicker); setShowFillPicker(false); }} className="p-2 rounded-lg hover:bg-foreground/5 transition-colors flex items-center gap-1" title="Stroke Color">
            <div className="h-4 w-4 rounded-full border border-border/40" style={{ backgroundColor: color }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full mt-2 left-0 p-3 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 w-[200px]" onClick={e => e.stopPropagation()}>
              <p className="text-[8px] tracking-wider uppercase text-muted-foreground/50 mb-1.5">Stroke</p>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); setShowColorPicker(false); }}
                    className={`h-7 w-7 rounded-lg border transition-all ${color === c ? "border-foreground scale-110" : "border-border/30 hover:scale-105"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="h-7 w-7 rounded cursor-pointer bg-transparent border-0" />
                <button onClick={() => { setColor(customColor); setShowColorPicker(false); }} className="flex-1 text-xs py-1.5 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20">Use Custom</button>
              </div>
            </div>
          )}
        </div>

        {/* Fill color (shapes only) */}
        {isShapeTool && (
          <div className="relative">
            <button onClick={() => { setShowFillPicker(!showFillPicker); setShowColorPicker(false); }} className="p-2 rounded-lg hover:bg-foreground/5 transition-colors flex items-center gap-1" title="Fill Color">
              <div className="h-4 w-4 rounded border border-border/40" style={{ backgroundColor: fillColor === "transparent" ? "transparent" : fillColor, backgroundImage: fillColor === "transparent" ? "repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 8px 8px" : "none" }} />
            </button>
            {showFillPicker && (
              <div className="absolute top-full mt-2 left-0 p-3 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 w-[200px]" onClick={e => e.stopPropagation()}>
                <p className="text-[8px] tracking-wider uppercase text-muted-foreground/50 mb-1.5">Fill</p>
                <button onClick={() => { setFillColor("transparent"); setShowFillPicker(false); }} className={`w-full mb-2 text-xs py-1.5 rounded-lg ${fillColor === "transparent" ? "bg-foreground/15 text-foreground" : "bg-foreground/5 text-muted-foreground"}`}>No Fill</button>
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => { setFillColor(c); setShowFillPicker(false); }}
                      className={`h-7 w-7 rounded-lg border transition-all ${fillColor === c ? "border-foreground scale-110" : "border-border/30 hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={customFill} onChange={e => setCustomFill(e.target.value)} className="h-7 w-7 rounded cursor-pointer bg-transparent border-0" />
                  <button onClick={() => { setFillColor(customFill); setShowFillPicker(false); }} className="flex-1 text-xs py-1.5 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20">Use Custom</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brush size */}
        <div className="flex items-center gap-1 px-1">
          <button onClick={() => setBrushSize(Math.max(1, brushSize - 1))} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="h-3 w-3" /></button>
          <span className="text-[10px] text-muted-foreground w-5 text-center">{brushSize}</span>
          <button onClick={() => setBrushSize(Math.min(30, brushSize + 1))} className="p-1 text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /></button>
        </div>

        {tool === "text" && (
          <>
            <div className="w-px h-6 bg-border/20 mx-1" />
            <div className="flex items-center gap-1 px-1">
              <span className="text-[9px] text-muted-foreground/60">SIZE</span>
              <button onClick={() => setTextFontSize(Math.max(8, textFontSize - 2))} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="h-3 w-3" /></button>
              <span className="text-[10px] text-muted-foreground w-5 text-center">{textFontSize}</span>
              <button onClick={() => setTextFontSize(Math.min(120, textFontSize + 2))} className="p-1 text-muted-foreground hover:text-foreground"><Plus className="h-3 w-3" /></button>
            </div>
          </>
        )}

        <div className="w-px h-6 bg-border/20 mx-1" />

        {/* Wallpaper picker */}
        <div className="relative">
          <button onClick={() => setShowWallpapers(!showWallpapers)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Background">
            <Wallpaper className="h-4 w-4" />
          </button>
          {showWallpapers && (
            <div className="absolute top-full mt-2 right-0 p-3 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 w-[280px] max-h-[50vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <p className="text-[8px] tracking-wider uppercase text-muted-foreground/50 mb-2">Background</p>
              <div className="grid grid-cols-4 gap-2">
                {WALLPAPERS.map(wp => (
                  <button key={wp.key} onClick={() => { setWallpaper(wp.key); setShowWallpapers(false); }}
                    className={`rounded-lg overflow-hidden border-2 transition-all ${wallpaper === wp.key ? "border-foreground/60 scale-105" : "border-border/20 hover:border-border/50"}`}>
                    {wp.src ? (
                      <img src={wp.src} alt={wp.label} className="w-full h-12 object-cover" />
                    ) : (
                      <div className="w-full h-12 bg-[#111]" />
                    )}
                    <p className="text-[7px] text-muted-foreground/60 text-center py-0.5 truncate">{wp.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5" title="Add Image"><ImageIcon className="h-4 w-4" /></button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <button onClick={undo} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5" title="Undo"><Undo2 className="h-4 w-4" /></button>
        <button onClick={redo} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5" title="Redo"><Redo2 className="h-4 w-4" /></button>
        <button onClick={clearAll} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Clear"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* ─── Image controls ─── */}
      {selectedImageId && (
        <div className="absolute top-[7.5rem] left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-border/30 bg-card/80 backdrop-blur-xl px-4 py-2 shadow-xl">
          <span className="text-[9px] text-muted-foreground/60 tracking-wider uppercase">Image</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/60">Radius</span>
            <input type="range" min="0" max="50" value={imageRadius} onChange={e => updateImageRadius(Number(e.target.value))} className="w-20 h-1 accent-foreground" />
            <span className="text-[10px] text-muted-foreground w-6">{imageRadius}%</span>
          </div>
          <div className="w-px h-5 bg-border/20" />
          <button onClick={() => resizeSelectedImage(1.1)} className="p-1 text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
          <button onClick={() => resizeSelectedImage(0.9)} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
          <div className="w-px h-5 bg-border/20" />
          <button onClick={deleteSelected} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ─── Zoom ─── */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl border border-border/30 bg-card/60 backdrop-blur-xl px-3 py-1.5">
        <button onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
        <span className="text-[10px] text-muted-foreground font-light w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="p-1 text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="text-[9px] text-muted-foreground/50 hover:text-foreground px-1">Reset</button>
      </div>

      <div className="absolute bottom-4 left-4 z-40 text-[9px] text-muted-foreground/30 font-extralight tracking-wider">
        Scroll to pan · Ctrl+Scroll zoom · Ctrl+V paste images · Alt+Drag pan
      </div>

      {/* ─── Canvas ─── */}
      <div ref={containerRef} className="flex-1" style={{ cursor: cursorStyle }}>
        <canvas ref={canvasRef} className="w-full h-full"
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
      </div>

      {/* ─── Text input ─── */}
      {editingText && (
        <div className="absolute z-50" style={{ left: editingText.x * zoom + panOffset.x, top: editingText.y * zoom + panOffset.y }}>
          <input autoFocus value={textValue} onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitText(); if (e.key === "Escape") setEditingText(null); }}
            onBlur={submitText}
            className="bg-transparent border border-border/40 rounded-lg px-2 py-1 text-foreground outline-none backdrop-blur-md min-w-[100px]"
            style={{ fontSize: textFontSize * zoom, color }} placeholder="Type..." />
        </div>
      )}

      {/* ─── Watermark ─── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-[0.015]">
        <span className="text-[200px] font-extralight tracking-[0.5em] text-foreground select-none">A</span>
      </div>
    </div>
  );
};

export default Whiteboard;
