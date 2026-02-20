import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Copy, Check, Undo2, Redo2, ZoomIn, ZoomOut, Hand, Square, Paintbrush, Maximize2, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PixelRect {
  id: string;
  x: number;
  y: number;
  color: string; // "#RRGGBB"
}

type Tool = "pan" | "zoom-in" | "zoom-out" | "select-box" | "color-paint";

interface ViewBox { x: number; y: number; w: number; h: number; }

type ExportFormat = "svg" | "minified-svg" | "css-grid";

// ─── Utils ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function rgbaToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// ─── SVG Export ──────────────────────────────────────────────────────────────
function exportSvg(rects: PixelRect[], w: number, h: number, minify = false): string {
  const body = rects.map(r =>
    `<rect x="${r.x}" y="${r.y}" width="1" height="1" fill="${r.color}"/>`
  ).join(minify ? "" : "\n  ");
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n  ${body}\n</svg>`;
  return minify ? raw.replace(/\n\s*/g, "") : raw;
}

function exportCssGrid(rects: PixelRect[], w: number, h: number): string {
  const colorMap: string[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rects.find(r => r.x === x && r.y === y);
      colorMap.push(r ? r.color : "#FFFFFF");
    }
  }
  const css = `.pixel-grid{display:grid;grid-template-columns:repeat(${w},1fr);width:${w * 4}px;height:${h * 4}px;gap:0}
.pixel-grid div{width:4px;height:4px}`;
  const html = `<!DOCTYPE html><html><head><style>${css}</style></head><body>
<div class="pixel-grid">
${colorMap.map(c => `  <div style="background:${c}"></div>`).join("\n")}
</div></body></html>`;
  return html;
}

// ─── Image → Rects ───────────────────────────────────────────────────────────
function imageDataToRects(imageData: ImageData): PixelRect[] {
  const { width, height, data } = imageData;
  const out: PixelRect[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out.push({ id: uid(), x, y, color: rgbaToHex(data[i], data[i + 1], data[i + 2]) });
    }
  }
  return out;
}

const MAX_DIM = 128; // cap at 128×128 for performance

// ─── Main Component ───────────────────────────────────────────────────────────
const ImagineToCodeView = () => {
  const [rects, setRects] = useState<PixelRect[]>([]);
  const [gridW, setGridW] = useState(64);
  const [gridH, setGridH] = useState(64);
  const [history, setHistory] = useState<PixelRect[][]>([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [activeColor, setActiveColor] = useState("#FF0000");
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 64, h: 64 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("svg");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selStart, setSelStart] = useState<{ sx: number; sy: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);
  const isPainting = useRef(false);
  const panStart = useRef<{ mx: number; my: number; vb: ViewBox } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Generate code output whenever rects or format changes ─────────────────
  useEffect(() => {
    if (rects.length === 0) { setCode("// Upload an image or paint pixels to generate code"); return; }
    if (exportFormat === "svg") setCode(exportSvg(rects, gridW, gridH));
    else if (exportFormat === "minified-svg") setCode(exportSvg(rects, gridW, gridH, true));
    else setCode(exportCssGrid(rects, gridW, gridH));
  }, [rects, exportFormat, gridW, gridH]);

  // ── History helpers ────────────────────────────────────────────────────────
  const pushHistory = useCallback((next: PixelRect[]) => {
    setHistory(h => [...h.slice(0, histIdx + 1), next]);
    setHistIdx(i => i + 1);
    setRects(next);
  }, [histIdx]);

  const undo = () => {
    if (histIdx <= 0) return;
    const prev = history[histIdx - 1];
    setHistIdx(i => i - 1);
    setRects(prev);
  };

  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const next = history[histIdx + 1];
    setHistIdx(i => i + 1);
    setRects(next);
  };

  // ── Coordinate conversion ─────────────────────────────────────────────────
  const svgCoords = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * viewBox.w + viewBox.x;
    const y = (e.clientY - rect.top) / rect.height * viewBox.h + viewBox.y;
    return { x, y };
  };

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoom = (factor: number) => {
    setViewBox(vb => {
      const nw = vb.w * factor;
      const nh = vb.h * factor;
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  // ── Mouse events ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    const coords = svgCoords(e);
    if (!coords) return;
    const px = Math.floor(coords.x);
    const py = Math.floor(coords.y);

    if (activeTool === "pan") {
      panStart.current = { mx: e.clientX, my: e.clientY, vb: { ...viewBox } };
    } else if (activeTool === "zoom-in") {
      zoom(1 / 1.5);
    } else if (activeTool === "zoom-out") {
      zoom(1.5);
    } else if (activeTool === "color-paint") {
      isPainting.current = true;
      paintPixel(px, py);
    } else if (activeTool === "select-box") {
      setSelStart({ sx: coords.x, sy: coords.y });
      setSelRect(null);
      setSelectedIds(new Set());
    }
  };

  const paintPixel = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= gridW || py >= gridH) return;
    setRects(prev => {
      const next = prev.filter(r => !(r.x === px && r.y === py));
      next.push({ id: uid(), x: px, y: py, color: activeColor });
      return next;
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (activeTool === "pan" && panStart.current) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.clientX - panStart.current.mx) / rect.width * panStart.current.vb.w;
      const dy = (e.clientY - panStart.current.my) / rect.height * panStart.current.vb.h;
      setViewBox({ ...panStart.current.vb, x: panStart.current.vb.x - dx, y: panStart.current.vb.y - dy });
    } else if (activeTool === "color-paint" && isPainting.current) {
      const coords = svgCoords(e);
      if (coords) paintPixel(Math.floor(coords.x), Math.floor(coords.y));
    } else if (activeTool === "select-box" && selStart) {
      const coords = svgCoords(e);
      if (!coords) return;
      const x = Math.min(selStart.sx, coords.x);
      const y = Math.min(selStart.sy, coords.y);
      const w = Math.abs(coords.x - selStart.sx);
      const h = Math.abs(coords.y - selStart.sy);
      setSelRect({ x, y, w, h });
    }
  };

  const onMouseUp = () => {
    if (activeTool === "pan") panStart.current = null;
    if (activeTool === "color-paint" && isPainting.current) {
      isPainting.current = false;
      pushHistory([...rects]);
    }
    if (activeTool === "select-box" && selRect) {
      const ids = new Set(
        rects.filter(r => r.x >= selRect.x && r.x < selRect.x + selRect.w && r.y >= selRect.y && r.y < selRect.y + selRect.h).map(r => r.id)
      );
      setSelectedIds(ids);
      setSelStart(null);
    }
  };

  const fillSelection = () => {
    if (selectedIds.size === 0) return;
    const next = rects.map(r => selectedIds.has(r.id) ? { ...r, color: activeColor } : r);
    pushHistory(next);
    setSelectedIds(new Set());
    setSelRect(null);
  };

  const deleteSelection = () => {
    if (selectedIds.size === 0) return;
    const next = rects.filter(r => !selectedIds.has(r.id));
    pushHistory(next);
    setSelectedIds(new Set());
    setSelRect(null);
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const newRects = imageDataToRects(imageData);
        setGridW(width); setGridH(height);
        setViewBox({ x: 0, y: 0, w: width, h: height });
        pushHistory(newRects);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Copy & Download ───────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const downloadCode = () => {
    const ext = exportFormat === "css-grid" ? "html" : "svg";
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pixel-art.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Visible rects (clipped to viewBox) ────────────────────────────────────
  const visibleRects = rects.filter(r =>
    r.x < viewBox.x + viewBox.w && r.x + 1 > viewBox.x &&
    r.y < viewBox.y + viewBox.h && r.y + 1 > viewBox.y
  );

  const toolBtn = (tool: Tool, icon: React.ReactNode, title: string) => (
    <button
      title={title}
      onClick={() => setActiveTool(tool)}
      className={`p-2.5 rounded-xl border transition-all text-xs ${
        activeTool === tool
          ? "bg-accent/20 border-accent/40 text-accent"
          : "border-border/20 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex h-full overflow-hidden bg-background/30 backdrop-blur-sm">
      {/* ── Left Toolbar ── */}
      <aside className="flex-shrink-0 w-56 flex flex-col gap-3 p-3 border-r border-border/20 overflow-y-auto">
        {/* Upload */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Input</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 hover:bg-accent/10 hover:border-accent/30 px-3 py-2.5 text-xs font-light text-muted-foreground hover:text-accent transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Image
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Tools */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Tools</p>
          <div className="grid grid-cols-3 gap-1">
            {toolBtn("pan", <Hand className="h-3.5 w-3.5" />, "Pan")}
            {toolBtn("zoom-in", <ZoomIn className="h-3.5 w-3.5" />, "Zoom In")}
            {toolBtn("zoom-out", <ZoomOut className="h-3.5 w-3.5" />, "Zoom Out")}
            {toolBtn("select-box", <Square className="h-3.5 w-3.5" />, "Select Box")}
            {toolBtn("color-paint", <Paintbrush className="h-3.5 w-3.5" />, "Paint")}
            <button
              title="Fit view"
              onClick={() => setViewBox({ x: 0, y: 0, w: gridW, h: gridH })}
              className="p-2.5 rounded-xl border border-border/20 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Color picker */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Active Color</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={activeColor}
              onChange={e => setActiveColor(e.target.value)}
              className="w-9 h-9 rounded-lg border border-border/20 bg-transparent cursor-pointer p-0.5"
            />
            <span className="text-[10px] font-mono text-muted-foreground/70">{activeColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Selection actions */}
        {selectedIds.size > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">Selection ({selectedIds.size}px)</p>
            <button onClick={fillSelection} className="w-full rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 px-3 py-2 text-xs font-light text-accent transition-all">
              Fill with color
            </button>
            <button onClick={deleteSelection} className="w-full rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 px-3 py-2 text-xs font-light text-destructive transition-all">
              Delete selection
            </button>
          </div>
        )}

        {/* History */}
        <div className="space-y-1.5">
          <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50">History</p>
          <div className="flex gap-1">
            <button onClick={undo} disabled={histIdx <= 0} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border/20 px-2 py-2 text-[10px] text-muted-foreground disabled:opacity-30 hover:bg-foreground/5 hover:text-foreground transition-all disabled:cursor-not-allowed">
              <Undo2 className="h-3 w-3" /> Undo
            </button>
            <button onClick={redo} disabled={histIdx >= history.length - 1} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-border/20 px-2 py-2 text-[10px] text-muted-foreground disabled:opacity-30 hover:bg-foreground/5 hover:text-foreground transition-all disabled:cursor-not-allowed">
              <Undo2 className="h-3 w-3 scale-x-[-1]" /> Redo
            </button>
          </div>
        </div>

        {/* Grid info */}
        <div className="mt-auto text-[9px] text-muted-foreground/30 font-mono space-y-0.5 border-t border-border/10 pt-3">
          <p>Grid: {gridW} × {gridH}</p>
          <p>Pixels: {rects.length.toLocaleString()}</p>
          <p>Tool: {activeTool}</p>
        </div>
      </aside>

      {/* ── Canvas ── */}
      <main className="flex-1 flex items-center justify-center overflow-hidden bg-card/5 relative">
        {rects.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="h-16 w-16 rounded-full border border-accent/20 flex items-center justify-center bg-accent/5">
              <Paintbrush className="h-7 w-7 text-accent/30 animate-pulse" />
            </div>
            <p className="text-xs font-light text-muted-foreground/40">Upload an image to convert it to pixel art</p>
          </div>
        )}
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full"
          style={{ cursor: activeTool === "pan" ? "grab" : activeTool === "color-paint" ? "crosshair" : "default", imageRendering: "pixelated" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Background */}
          <rect x={0} y={0} width={gridW} height={gridH} fill="white" />

          {/* Checkerboard for transparency reference */}
          <defs>
            <pattern id="checker" width="2" height="2" patternUnits="userSpaceOnUse">
              <rect width="1" height="1" fill="#e0e0e0" />
              <rect x="1" y="1" width="1" height="1" fill="#e0e0e0" />
            </pattern>
          </defs>

          {/* Pixels */}
          {visibleRects.map(r => (
            <rect
              key={r.id}
              x={r.x} y={r.y}
              width={1} height={1}
              fill={r.color}
              stroke={selectedIds.has(r.id) ? "hsl(var(--accent))" : "none"}
              strokeWidth={selectedIds.has(r.id) ? 0.05 : 0}
            />
          ))}

          {/* Selection box overlay */}
          {selRect && (
            <rect
              x={selRect.x} y={selRect.y}
              width={selRect.w} height={selRect.h}
              fill="hsl(var(--accent) / 0.15)"
              stroke="hsl(var(--accent))"
              strokeWidth={0.3}
              strokeDasharray="1 0.5"
            />
          )}
        </svg>
      </main>

      {/* ── Right Code Panel ── */}
      <aside className="flex-shrink-0 w-72 flex flex-col border-l border-border/20">
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/20">
          <p className="text-[9px] font-light tracking-[0.15em] uppercase text-muted-foreground/50 mb-2">Code Output</p>
          <div className="flex gap-1.5 items-center">
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as ExportFormat)}
              className="flex-1 rounded-lg border border-border/20 bg-card/20 text-[10px] font-light text-foreground px-2 py-1.5 outline-none"
            >
              <option value="svg">Raw SVG</option>
              <option value="minified-svg">Minified SVG</option>
              <option value="css-grid">CSS Grid (HTML)</option>
            </select>
            <button onClick={copyCode} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/20 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all">
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={downloadCode} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/20 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all">
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <pre className="p-3 text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
            {code}
          </pre>
        </ScrollArea>
        <div className="flex-shrink-0 px-4 py-2 border-t border-border/10 text-[9px] text-muted-foreground/30 font-mono">
          {code.length.toLocaleString()} chars
        </div>
      </aside>
    </div>
  );
};

export default ImagineToCodeView;
