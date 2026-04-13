import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Pencil, Type, Eraser, Move, Minus, Plus, Palette, 
  Square, Circle, Download, Trash2, Undo2, Redo2,
  MousePointer, Image as ImageIcon, Copy, ClipboardPaste
} from "lucide-react";

/* ─── Types ─── */
type Tool = "select" | "draw" | "text" | "eraser" | "pan";

interface Point { x: number; y: number }

interface DrawElement {
  id: string;
  type: "path" | "text" | "image";
  points?: Point[];
  color?: string;
  width?: number;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  src?: string;
  imgWidth?: number;
  imgHeight?: number;
  borderRadius?: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const COLORS = [
  "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e",
  "#14b8a6", "#84cc16", "#000000", "#6b7280", "#d1d5db",
];

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#ffffff");

  const [elements, setElements] = useState<DrawElement[]>([]);
  const [undoStack, setUndoStack] = useState<DrawElement[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawElement[][]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const [editingText, setEditingText] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textFontSize, setTextFontSize] = useState(18);

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageRadius, setImageRadius] = useState(0);

  /* ─── Canvas coordinate transform ─── */
  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return {
      x: (sx - rect.left - panOffset.x) / zoom,
      y: (sy - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom]);

  /* ─── Save undo state ─── */
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), elements.map(e => ({ ...e, points: e.points ? [...e.points] : undefined }))]);
    setRedoStack([]);
  }, [elements]);

  const undo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, elements]);
    setElements(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, elements]);
    setElements(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  /* ─── Drawing ─── */
  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (tool === "pan" || (e.button === 1) || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (tool === "select") {
      // Find clicked element (reverse order = top first)
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === "image" && el.x !== undefined && el.y !== undefined && el.imgWidth && el.imgHeight) {
          if (x >= el.x && x <= el.x + el.imgWidth && y >= el.y && y <= el.y + el.imgHeight) {
            setSelectedElement(el.id);
            setSelectedImageId(el.id);
            setImageRadius(el.borderRadius || 0);
            setDragStart({ x: x - el.x, y: y - el.y });
            return;
          }
        }
        if (el.type === "text" && el.x !== undefined && el.y !== undefined) {
          const w = (el.text?.length || 1) * (el.fontSize || 18) * 0.6;
          const h = (el.fontSize || 18) * 1.4;
          if (x >= el.x && x <= el.x + w && y >= el.y - h && y <= el.y) {
            setSelectedElement(el.id);
            setSelectedImageId(null);
            setDragStart({ x: x - el.x, y: y - el.y });
            return;
          }
        }
      }
      setSelectedElement(null);
      setSelectedImageId(null);
      return;
    }

    if (tool === "text") {
      setEditingText({ x, y });
      setTextValue("");
      return;
    }

    if (tool === "draw" || tool === "eraser") {
      pushUndo();
      const newEl: DrawElement = {
        id: uid(),
        type: "path",
        points: [{ x, y }],
        color: tool === "eraser" ? "eraser" : color,
        width: tool === "eraser" ? brushSize * 4 : brushSize,
      };
      setElements(prev => [...prev, newEl]);
      setIsDrawing(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (tool === "select" && selectedElement && dragStart) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setElements(prev => prev.map(el => {
        if (el.id !== selectedElement) return el;
        return { ...el, x: x - dragStart.x, y: y - dragStart.y };
      }));
      return;
    }

    if (!isDrawing) return;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    setElements(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.points) {
        last.points = [...last.points, { x, y }];
      }
      return updated;
    });
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    setIsPanning(false);
    setDragStart(null);
  };

  /* ─── Text submit ─── */
  const submitText = () => {
    if (!editingText || !textValue.trim()) {
      setEditingText(null);
      return;
    }
    pushUndo();
    setElements(prev => [...prev, {
      id: uid(),
      type: "text",
      text: textValue,
      x: editingText.x,
      y: editingText.y,
      fontSize: textFontSize,
      color,
    }]);
    setEditingText(null);
    setTextValue("");
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
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w *= ratio;
                h *= ratio;
              }
              pushUndo();
              setElements(prev => [...prev, {
                id: uid(),
                type: "image",
                src: reader.result as string,
                x: -panOffset.x / zoom + 100,
                y: -panOffset.y / zoom + 100,
                imgWidth: w,
                imgHeight: h,
                borderRadius: 0,
              }]);
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(blob);
        }
        if (item.type === "text/plain") {
          // Allow normal text paste
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [panOffset, zoom, pushUndo]);

  /* ─── Image upload via file input ─── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w *= ratio;
          h *= ratio;
        }
        pushUndo();
        setElements(prev => [...prev, {
          id: uid(),
          type: "image",
          src: reader.result as string,
          x: -panOffset.x / zoom + 100,
          y: -panOffset.y / zoom + 100,
          imgWidth: w,
          imgHeight: h,
          borderRadius: 0,
        }]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* ─── Render canvas ─── */
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

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

    // Clear
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Grid
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const gridSize = 40;
    const startX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize - gridSize;
    const endX = startX + rect.width / zoom + gridSize * 2;
    const endY = startY + rect.height / zoom + gridSize * 2;

    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 0.5;
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Draw elements
    for (const el of elements) {
      if (el.type === "path" && el.points && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        if (el.color === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = el.color || "#fff";
        }
        ctx.lineWidth = el.width || 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }

      if (el.type === "text" && el.text && el.x !== undefined && el.y !== undefined) {
        ctx.font = `${el.fontSize || 18}px 'Inter', sans-serif`;
        ctx.fillStyle = el.color || "#fff";
        ctx.fillText(el.text, el.x, el.y);

        if (el.id === selectedElement) {
          const w = ctx.measureText(el.text).width;
          ctx.strokeStyle = "rgba(59,130,246,0.5)";
          ctx.lineWidth = 1;
          ctx.strokeRect(el.x - 4, el.y - (el.fontSize || 18) - 4, w + 8, (el.fontSize || 18) * 1.4 + 8);
        }
      }

      if (el.type === "image" && el.src && el.x !== undefined && el.y !== undefined) {
        let cachedImg = imageCache.current.get(el.id);
        if (!cachedImg) {
          cachedImg = new window.Image();
          cachedImg.src = el.src;
          imageCache.current.set(el.id, cachedImg);
          cachedImg.onload = () => {
            // Re-render
            canvasRef.current?.dispatchEvent(new Event("render"));
          };
        }
        if (cachedImg.complete) {
          const w = el.imgWidth || 200;
          const h = el.imgHeight || 200;
          const r = el.borderRadius || 0;

          ctx.save();
          if (r > 0) {
            ctx.beginPath();
            ctx.moveTo(el.x + r, el.y);
            ctx.lineTo(el.x + w - r, el.y);
            ctx.quadraticCurveTo(el.x + w, el.y, el.x + w, el.y + r);
            ctx.lineTo(el.x + w, el.y + h - r);
            ctx.quadraticCurveTo(el.x + w, el.y + h, el.x + w - r, el.y + h);
            ctx.lineTo(el.x + r, el.y + h);
            ctx.quadraticCurveTo(el.x, el.y + h, el.x, el.y + h - r);
            ctx.lineTo(el.x, el.y + r);
            ctx.quadraticCurveTo(el.x, el.y, el.x + r, el.y);
            ctx.closePath();
            ctx.clip();
          }
          ctx.drawImage(cachedImg, el.x, el.y, w, h);
          ctx.restore();

          if (el.id === selectedElement) {
            ctx.strokeStyle = "rgba(59,130,246,0.6)";
            ctx.lineWidth = 2;
            ctx.strokeRect(el.x - 2, el.y - 2, w + 4, h + 4);
          }
        }
      }
    }

    ctx.restore();
  }, [elements, panOffset, zoom, selectedElement]);

  /* ─── Zoom ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
      } else {
        setPanOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, []);

  /* ─── Resize ─── */
  useEffect(() => {
    const handler = () => {
      // Trigger re-render
      setZoom(z => z);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  /* ─── Image border radius change ─── */
  const updateImageRadius = (val: number) => {
    setImageRadius(val);
    if (!selectedImageId) return;
    setElements(prev => prev.map(el =>
      el.id === selectedImageId ? { ...el, borderRadius: val } : el
    ));
  };

  /* ─── Image resize via selected element ─── */
  const resizeSelectedImage = (factor: number) => {
    if (!selectedImageId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedImageId) return el;
      return {
        ...el,
        imgWidth: (el.imgWidth || 200) * factor,
        imgHeight: (el.imgHeight || 200) * factor,
      };
    }));
  };

  const clearAll = () => {
    pushUndo();
    setElements([]);
    setSelectedElement(null);
    setSelectedImageId(null);
  };

  const deleteSelected = () => {
    if (!selectedElement) return;
    pushUndo();
    setElements(prev => prev.filter(el => el.id !== selectedElement));
    setSelectedElement(null);
    setSelectedImageId(null);
  };

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingText) return;
        deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const toolBtnClass = (t: Tool) =>
    `p-2 rounded-lg transition-all duration-200 ${tool === t
      ? "bg-foreground/15 text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
    }`;

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
        <div className="text-[9px] font-extralight tracking-[0.25em] text-muted-foreground/20 uppercase">
          ◈ AUREON INTELLIGENCE PLATFORM
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl px-3 py-2 shadow-2xl">
        <button onClick={() => setTool("select")} className={toolBtnClass("select")} title="Select (V)">
          <MousePointer className="h-4 w-4" />
        </button>
        <button onClick={() => setTool("draw")} className={toolBtnClass("draw")} title="Draw (B)">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => setTool("text")} className={toolBtnClass("text")} title="Text (T)">
          <Type className="h-4 w-4" />
        </button>
        <button onClick={() => setTool("eraser")} className={toolBtnClass("eraser")} title="Eraser (E)">
          <Eraser className="h-4 w-4" />
        </button>
        <button onClick={() => setTool("pan")} className={toolBtnClass("pan")} title="Pan (H)">
          <Move className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border/20 mx-1" />

        {/* Color */}
        <div className="relative">
          <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 rounded-lg hover:bg-foreground/5 transition-colors" title="Color">
            <div className="h-4 w-4 rounded-full border border-border/40" style={{ backgroundColor: color }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full mt-2 left-0 p-3 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 w-[200px]" onClick={e => e.stopPropagation()}>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setShowColorPicker(false); }}
                    className={`h-7 w-7 rounded-lg border transition-all ${color === c ? "border-foreground scale-110 shadow-lg" : "border-border/30 hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-7 w-7 rounded cursor-pointer bg-transparent border-0"
                />
                <button
                  onClick={() => { setColor(customColor); setShowColorPicker(false); }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors"
                >
                  Use Custom
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-1 px-1">
          <button onClick={() => setBrushSize(Math.max(1, brushSize - 1))} className="p-1 text-muted-foreground hover:text-foreground">
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-muted-foreground w-5 text-center">{brushSize}</span>
          <button onClick={() => setBrushSize(Math.min(30, brushSize + 1))} className="p-1 text-muted-foreground hover:text-foreground">
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="w-px h-6 bg-border/20 mx-1" />

        {/* Text size (when text tool) */}
        {tool === "text" && (
          <>
            <div className="flex items-center gap-1 px-1">
              <span className="text-[9px] text-muted-foreground/60">SIZE</span>
              <button onClick={() => setTextFontSize(Math.max(8, textFontSize - 2))} className="p-1 text-muted-foreground hover:text-foreground">
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-[10px] text-muted-foreground w-5 text-center">{textFontSize}</span>
              <button onClick={() => setTextFontSize(Math.min(120, textFontSize + 2))} className="p-1 text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="w-px h-6 bg-border/20 mx-1" />
          </>
        )}

        {/* Image upload */}
        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Add Image">
          <ImageIcon className="h-4 w-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {/* Undo / Redo */}
        <button onClick={undo} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button onClick={redo} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </button>

        {/* Clear */}
        <button onClick={clearAll} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Clear All">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Image controls (when image selected) ─── */}
      {selectedImageId && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-border/30 bg-card/80 backdrop-blur-xl px-4 py-2 shadow-xl">
          <span className="text-[9px] text-muted-foreground/60 tracking-wider uppercase">Image</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground/60">Radius</span>
            <input
              type="range"
              min="0"
              max="50"
              value={imageRadius}
              onChange={(e) => updateImageRadius(Number(e.target.value))}
              className="w-20 h-1 accent-foreground"
            />
            <span className="text-[10px] text-muted-foreground w-6">{imageRadius}%</span>
          </div>
          <div className="w-px h-5 bg-border/20" />
          <button onClick={() => resizeSelectedImage(1.1)} className="p-1 text-muted-foreground hover:text-foreground" title="Bigger">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => resizeSelectedImage(0.9)} className="p-1 text-muted-foreground hover:text-foreground" title="Smaller">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-5 bg-border/20" />
          <button onClick={deleteSelected} className="p-1 text-muted-foreground hover:text-destructive" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ─── Zoom indicator ─── */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl border border-border/30 bg-card/60 backdrop-blur-xl px-3 py-1.5">
        <button onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} className="p-1 text-muted-foreground hover:text-foreground">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground font-light w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="p-1 text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="text-[9px] text-muted-foreground/50 hover:text-foreground px-1">
          Reset
        </button>
      </div>

      {/* ─── Tip ─── */}
      <div className="absolute bottom-4 left-4 z-40 text-[9px] text-muted-foreground/30 font-extralight tracking-wider">
        Scroll to pan · Ctrl+Scroll to zoom · Ctrl+V paste images · Alt+Drag to pan
      </div>

      {/* ─── Canvas ─── */}
      <div
        ref={containerRef}
        className="flex-1 cursor-crosshair"
        style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* ─── Text input overlay ─── */}
      {editingText && (
        <div
          className="absolute z-50"
          style={{
            left: editingText.x * zoom + panOffset.x,
            top: editingText.y * zoom + panOffset.y,
          }}
        >
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitText(); if (e.key === "Escape") setEditingText(null); }}
            onBlur={submitText}
            className="bg-transparent border border-border/40 rounded-lg px-2 py-1 text-foreground outline-none backdrop-blur-md min-w-[100px]"
            style={{ fontSize: textFontSize * zoom, color }}
            placeholder="Type..."
          />
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
