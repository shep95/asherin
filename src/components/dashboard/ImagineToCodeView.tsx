import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Copy, Check, Undo2, ZoomIn, ZoomOut, Hand, Square, Paintbrush, Maximize2, Upload, Sparkles, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PixelRect {
  id: string;
  x: number;
  y: number;
  color: string;
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
  const css = `.pixel-grid{display:grid;grid-template-columns:repeat(${w},1fr);width:${w * 4}px;height:${h * 4}px;gap:0}\n.pixel-grid div{width:4px;height:4px}`;
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>\n<div class="pixel-grid">\n${colorMap.map(c => `  <div style="background:${c}"></div>`).join("\n")}\n</div></body></html>`;
}

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

const MAX_DIM = 128;

// ─── Main Component ───────────────────────────────────────────────────────────
const ImagineToCodeView = () => {
  const [rects, setRects] = useState<PixelRect[]>([]);
  const [gridW, setGridW] = useState(64);
  const [gridH, setGridH] = useState(64);
  const [history, setHistory] = useState<PixelRect[][]>([[]]);
  const [histIdx, setHistIdx] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  const [activeColor, setActiveColor] = useState("#7C3AED");
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 64, h: 64 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("svg");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selStart, setSelStart] = useState<{ sx: number; sy: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AUREON AI integration
  const [aureonPrompt, setAureonPrompt] = useState("");
  const [aureonResponse, setAureonResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const svgRef = useRef<SVGSVGElement>(null);
  const isPainting = useRef(false);
  const panStart = useRef<{ mx: number; my: number; vb: ViewBox } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rects.length === 0) { setCode("// Upload an image or paint pixels to generate code"); return; }
    if (exportFormat === "svg") setCode(exportSvg(rects, gridW, gridH));
    else if (exportFormat === "minified-svg") setCode(exportSvg(rects, gridW, gridH, true));
    else setCode(exportCssGrid(rects, gridW, gridH));
  }, [rects, exportFormat, gridW, gridH]);

  const pushHistory = useCallback((next: PixelRect[]) => {
    setHistory(h => [...h.slice(0, histIdx + 1), next]);
    setHistIdx(i => i + 1);
    setRects(next);
  }, [histIdx]);

  const undo = () => {
    if (histIdx <= 0) return;
    setHistIdx(i => i - 1);
    setRects(history[histIdx - 1]);
  };

  const redo = () => {
    if (histIdx >= history.length - 1) return;
    setHistIdx(i => i + 1);
    setRects(history[histIdx + 1]);
  };

  const svgCoords = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * viewBox.w + viewBox.x,
      y: (e.clientY - rect.top) / rect.height * viewBox.h + viewBox.y,
    };
  };

  const zoom = (factor: number) => {
    setViewBox(vb => {
      const nw = vb.w * factor; const nh = vb.h * factor;
      const cx = vb.x + vb.w / 2; const cy = vb.y + vb.h / 2;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const paintPixel = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= gridW || py >= gridH) return;
    setRects(prev => {
      const next = prev.filter(r => !(r.x === px && r.y === py));
      next.push({ id: uid(), x: px, y: py, color: activeColor });
      return next;
    });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const coords = svgCoords(e);
    if (!coords) return;
    const px = Math.floor(coords.x); const py = Math.floor(coords.y);
    if (activeTool === "pan") panStart.current = { mx: e.clientX, my: e.clientY, vb: { ...viewBox } };
    else if (activeTool === "zoom-in") zoom(1 / 1.5);
    else if (activeTool === "zoom-out") zoom(1.5);
    else if (activeTool === "color-paint") { isPainting.current = true; paintPixel(px, py); }
    else if (activeTool === "select-box") { setSelStart({ sx: coords.x, sy: coords.y }); setSelRect(null); setSelectedIds(new Set()); }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (activeTool === "pan" && panStart.current) {
      const svg = svgRef.current; if (!svg) return;
      const r = svg.getBoundingClientRect();
      const dx = (e.clientX - panStart.current.mx) / r.width * panStart.current.vb.w;
      const dy = (e.clientY - panStart.current.my) / r.height * panStart.current.vb.h;
      setViewBox({ ...panStart.current.vb, x: panStart.current.vb.x - dx, y: panStart.current.vb.y - dy });
    } else if (activeTool === "color-paint" && isPainting.current) {
      const c = svgCoords(e); if (c) paintPixel(Math.floor(c.x), Math.floor(c.y));
    } else if (activeTool === "select-box" && selStart) {
      const c = svgCoords(e); if (!c) return;
      setSelRect({ x: Math.min(selStart.sx, c.x), y: Math.min(selStart.sy, c.y), w: Math.abs(c.x - selStart.sx), h: Math.abs(c.y - selStart.sy) });
    }
  };

  const onMouseUp = () => {
    if (activeTool === "pan") panStart.current = null;
    if (activeTool === "color-paint" && isPainting.current) { isPainting.current = false; pushHistory([...rects]); }
    if (activeTool === "select-box" && selRect) {
      setSelectedIds(new Set(rects.filter(r => r.x >= selRect.x && r.x < selRect.x + selRect.w && r.y >= selRect.y && r.y < selRect.y + selRect.h).map(r => r.id)));
      setSelStart(null);
    }
  };

  const fillSelection = () => {
    if (selectedIds.size === 0) return;
    pushHistory(rects.map(r => selectedIds.has(r.id) ? { ...r, color: activeColor } : r));
    setSelectedIds(new Set()); setSelRect(null);
  };

  const deleteSelection = () => {
    if (selectedIds.size === 0) return;
    pushHistory(rects.filter(r => !selectedIds.has(r.id)));
    setSelectedIds(new Set()); setSelRect(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
        width = Math.floor(width * ratio); height = Math.floor(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const newRects = imageDataToRects(canvas.getContext("2d")!.getImageData(0, 0, width, height));
        setGridW(width); setGridH(height);
        setViewBox({ x: 0, y: 0, w: width, h: height });
        pushHistory(newRects);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const downloadCode = () => {
    const ext = exportFormat === "css-grid" ? "html" : "svg";
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `pixel-art.${ext}`; a.click(); URL.revokeObjectURL(a.href);
  };

  // ── AUREON AI Analysis ─────────────────────────────────────────────────────
  const analyzeWithAureon = async () => {
    if (!aureonPrompt.trim() && rects.length === 0) return;
    setIsAnalyzing(true);
    setAureonResponse("");

    const contextPrompt = rects.length > 0
      ? `I have a pixel art design (${gridW}×${gridH} grid, ${rects.length} pixels). The exported ${exportFormat.toUpperCase()} code is:\n\n${code.slice(0, 2000)}${code.length > 2000 ? "\n...(truncated)" : ""}\n\nUser question: ${aureonPrompt || "Analyze this pixel art and describe what you see. Suggest improvements or how to use this in a project."}`
      : aureonPrompt;

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{ role: "user", content: contextPrompt }],
          mode: "standard",
          model: "google/gemini-2.5-flash",
          systemPrompt: "You are AUREON, an elite AI assistant specializing in design, pixel art, SVG code, and front-end development. Be precise, insightful, and actionable. Analyze pixel art, suggest optimizations, and help users integrate their designs into real projects.",
        },
      });
      if (error) throw error;
      setAureonResponse(data?.content || data?.message || "No response received.");
    } catch (err) {
      toast({ title: "Analysis failed", description: "Could not connect to AUREON.", variant: "destructive" });
      setAureonResponse("Failed to connect to AUREON. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

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
    <div className="flex h-full overflow-hidden bg-background/30 backdrop-blur-sm flex-col">
      {/* ── Beta Banner ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-border/20 bg-accent/5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-light tracking-[0.2em] uppercase text-accent/70 border border-accent/20 rounded px-1.5 py-0.5">Beta</span>
          <span className="text-[10px] font-light text-muted-foreground/50 tracking-wide">This Software Was Created By ZALI Software</span>
        </div>
        <div className="text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground/30">Imagine to Code</div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Toolbar ── */}
        <aside className="flex-shrink-0 w-52 flex flex-col gap-3 p-3 border-r border-border/20 overflow-y-auto bg-card/10">
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
              <p className="text-xs font-light text-muted-foreground/40 tracking-wide">Upload an image to convert it to pixel art</p>
              <p className="text-[10px] font-light text-muted-foreground/25 tracking-widest uppercase">Or paint pixels directly</p>
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
            <rect x={0} y={0} width={gridW} height={gridH} fill="hsl(var(--card))" />
            {visibleRects.map(r => (
              <rect
                key={r.id}
                x={r.x} y={r.y} width={1} height={1} fill={r.color}
                stroke={selectedIds.has(r.id) ? "hsl(var(--accent))" : "none"}
                strokeWidth={selectedIds.has(r.id) ? 0.05 : 0}
              />
            ))}
            {selRect && (
              <rect
                x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
                fill="hsl(var(--accent) / 0.15)"
                stroke="hsl(var(--accent))"
                strokeWidth={0.3}
                strokeDasharray="1 0.5"
              />
            )}
          </svg>
        </main>

        {/* ── Right Panel ── */}
        <aside className="flex-shrink-0 w-72 flex flex-col border-l border-border/20 bg-card/10">
          {/* Code Output */}
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
                {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={downloadCode} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/20 text-[10px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all">
                <Download className="h-3 w-3" />
              </button>
            </div>
          </div>
          <ScrollArea className="flex-[1] min-h-0 max-h-48">
            <pre className="p-3 text-[10px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
              {code}
            </pre>
          </ScrollArea>
          <div className="flex-shrink-0 px-4 py-1.5 border-t border-border/10 text-[9px] text-muted-foreground/30 font-mono">
            {code.length.toLocaleString()} chars
          </div>

          {/* ── AUREON AI Panel ── */}
          <div className="flex-1 flex flex-col border-t border-border/20 min-h-0">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/10">
              <Sparkles className="h-3 w-3 text-accent animate-pulse" />
              <p className="text-[9px] font-light tracking-[0.2em] uppercase text-accent/70">AUREON Analysis</p>
            </div>

            <ScrollArea className="flex-1 min-h-0 p-3">
              {aureonResponse ? (
                <div className="text-[10px] font-light text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {aureonResponse}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
                  <Sparkles className="h-6 w-6 text-accent/20" />
                  <p className="text-[10px] font-light text-muted-foreground/30 text-center tracking-wide">
                    Ask AUREON to analyze your pixel art or generate integration code
                  </p>
                </div>
              )}
            </ScrollArea>

            <div className="flex-shrink-0 p-3 border-t border-border/10 space-y-2">
              <textarea
                value={aureonPrompt}
                onChange={e => setAureonPrompt(e.target.value)}
                placeholder="Ask AUREON about this design..."
                className="w-full h-16 rounded-xl border border-border/20 bg-card/20 text-[10px] font-light text-foreground placeholder:text-muted-foreground/30 px-3 py-2 outline-none resize-none focus:border-accent/30 transition-all"
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyzeWithAureon(); }}
              />
              <button
                onClick={analyzeWithAureon}
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/20 px-3 py-2 text-xs font-light text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <><Sparkles className="h-3 w-3 animate-pulse" /> Analyzing...</>
                ) : (
                  <><Send className="h-3 w-3" /> Ask AUREON</>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ImagineToCodeView;
