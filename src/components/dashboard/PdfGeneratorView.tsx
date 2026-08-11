import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import DOMPurify from "dompurify";
import { FileText, Upload, Download, Image as ImageIcon, Loader2, Trash2, Plus, Wand2 } from "lucide-react";
import { ALL_WALLPAPERS as WALLPAPERS } from "@/lib/wallpapers";
const wallpaperDefault = WALLPAPERS[0].src;

// Strip scripts / event handlers from any user/AI-derived HTML before injecting
// into the live DOM for html2canvas rasterization. Keep inline styles (needed
// for the ebook layout) but block all execution surfaces.
const sanitizePdfHtml = (html: string) =>
  DOMPurify.sanitize(html, { ADD_ATTR: ["style"], FORBID_TAGS: ["script", "iframe", "object", "embed"] });

// Standard ebook trim size: 6" × 9" @ 96dpi → 576 × 864 px (preview)
// jsPDF uses points: 6" × 9" = 432pt × 648pt
const PAGE_W = 576;
const PAGE_H = 864;
const PAGE_PAD_Y = 56;
const PAGE_PAD_X = 48;
const PAGE_SAFE_GAP = 18;
const PAGE_INNER_H = PAGE_H - PAGE_PAD_Y * 2 - PAGE_SAFE_GAP;
const PAGE_INNER_W = PAGE_W - PAGE_PAD_X * 2;
const FONT_HEAD = "'Playfair Display', 'Cormorant Garamond', Georgia, serif";
const FONT_BODY = "'Lora', Georgia, 'Times New Roman', serif";

// Collapse spaced-out titles like "T H E  B O O K" → "THE BOOK"
// and strip ASCII decorator lines (═══, ───, ===, ***, ___) without reordering text.
const normalizePdfLine = (raw: string) => {
  let s = raw.replace(/[═━─–—=*_]{3,}/g, "").trim();
  if (!s) return "";
  const toks = s.split(/\s+/).filter(Boolean);
  if (toks.length >= 4 && toks.filter(t => t.length === 1).length / toks.length > 0.6) {
    const groups = s.split(/\s{2,}/).map(g => g.replace(/\s+/g, ""));
    s = groups.join(" ");
  }
  return s.trim();
};

const parseTextIntoSections = (text: string, stamp = Date.now()): PdfSection[] => {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const out: PdfSection[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    out.push({ id: `s-${out.length}-${stamp}`, type: "list", content: listBuf.join("\n") });
    listBuf = [];
  };

  rawLines.forEach((raw) => {
    const line = normalizePdfLine(raw);
    if (!line) { flushList(); return; }

    if (/^[-•*]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      listBuf.push(line);
      return;
    }
    flushList();

    if (/^#{1,2}\s/.test(line)) {
      out.push({ id: `s-${out.length}-${stamp}`, type: "heading", content: line.replace(/^#{1,2}\s+/, "") });
      return;
    }
    if (/^#{3,6}\s/.test(line)) {
      out.push({ id: `s-${out.length}-${stamp}`, type: "subheading", content: line.replace(/^#{3,6}\s+/, "") });
      return;
    }
    if (/^>\s?/.test(line)) {
      out.push({ id: `s-${out.length}-${stamp}`, type: "quote", content: line.replace(/^>\s?/, "") });
      return;
    }
    out.push({ id: `s-${out.length}-${stamp}`, type: "paragraph", content: line });
  });
  flushList();
  return out;
};

const renderSectionToHtml = (s: { type: string; content: string }): string => {
  const t = String(s.content ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  switch (s.type) {
    case "heading":
      return `<h2 style="font-family:${FONT_HEAD};font-size:24px;font-weight:700;line-height:1.2;margin:24px 0 12px;color:#f5f1e8;letter-spacing:0;text-align:left;">${t}</h2>`;
    case "subheading":
      return `<h3 style="font-family:${FONT_HEAD};font-size:16px;font-weight:600;font-style:italic;margin:18px 0 6px;color:#e8dfc9;text-align:left;letter-spacing:0;">${t}</h3>`;
    case "paragraph":
      return `<p style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.75;margin-bottom:14px;color:#e8e3d6;text-align:left;">${t}</p>`;
    case "quote":
      return `<blockquote style="font-family:${FONT_HEAD};font-size:14px;font-style:italic;line-height:1.7;margin:20px 28px;padding:8px 0 8px 18px;color:#d8c89a;border-left:2px solid rgba(216,200,154,0.6);">"${t}"</blockquote>`;
    case "list": {
      const items = t.split("\n").filter(l => l.trim()).map(l =>
        `<li style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.7;color:#e8e3d6;margin-bottom:6px;position:relative;padding-left:14px;list-style:none;"><span style="position:absolute;left:0;color:#d8c89a;">◆</span>${l.replace(/^([-•*]|\d+[.)])\s*/, "")}</li>`
      ).join("");
      return `<ul style="padding-left:22px;margin:10px 0 16px;list-style:none;">${items}</ul>`;
    }
    case "divider":
      return `<div style="display:flex;justify-content:center;margin:24px 0;color:#a89968;"><span style="font-family:${FONT_HEAD};font-size:16px;letter-spacing:1em;">◈ ◈ ◈</span></div>`;
    default:
      return "";
  }
};

const escHtml = (s: string) => s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const buildTitleBlockHtml = (title: string, author: string) => {
  if (!title && !author) return "";
  return `<div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid rgba(216,200,154,0.25);">
    ${title ? `<div style="font-family:${FONT_HEAD};font-size:22px;font-weight:700;color:#f5f1e8;letter-spacing:0.02em;">${escHtml(title)}</div>` : ""}
    ${author ? `<div style="font-family:${FONT_HEAD};font-style:italic;font-size:11px;color:#d8c89a;margin-top:6px;letter-spacing:0.15em;text-transform:uppercase;">${escHtml(author)}</div>` : ""}
  </div>`;
};

// Height memo — the paginator measures the same block markup repeatedly
// (binary-split + cumulative page fill). Without a cache a book-length paste
// costs thousands of innerHTML reflows on the main thread and the tab stalls,
// which reads to the user as "the generator is broken".
const measureCache = new Map<string, number>();

// Paginate sections into ebook-sized pages of HTML strings.
const paginateSections = (sections: PdfSection[], title: string, author: string): string[] => {
  const measure = document.createElement("div");
  measure.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_INNER_W}px;visibility:hidden;overflow:visible;box-sizing:border-box;`;
  document.body.appendChild(measure);
  const measureHtml = (html: string) => {
    const hit = measureCache.get(html);
    if (hit !== undefined) return hit;
    measure.innerHTML = sanitizePdfHtml(html);
    const h = Math.ceil(measure.getBoundingClientRect().height || measure.scrollHeight || measure.offsetHeight);
    if (measureCache.size > 4000) measureCache.clear();
    measureCache.set(html, h);
    return h;
  };


  const splitOversized = (section: PdfSection): { html: string; height: number }[] => {
    const html = renderSectionToHtml(section);
    const height = measureHtml(html);
    if (height <= PAGE_INNER_H) return [{ html, height }];
    const chunks: { html: string; height: number }[] = [];
    const pushChunk = (content: string, type: PdfSection["type"] = section.type) => {
      const h = renderSectionToHtml({ ...section, type, content: content.trim() });
      chunks.push({ html: h, height: measureHtml(h) });
    };
    if (section.type === "list") {
      const lines = section.content.split("\n").filter(l => l.trim());
      let chunk: string[] = [];
      for (const line of lines) {
        const next = [...chunk, line];
        if (chunk.length && measureHtml(renderSectionToHtml({ ...section, content: next.join("\n") })) > PAGE_INNER_H) {
          pushChunk(chunk.join("\n"));
          chunk = [line];
        } else chunk = next;
      }
      if (chunk.length) pushChunk(chunk.join("\n"));
      return chunks;
    }
    const words = section.content.split(/\s+/).filter(Boolean);
    let index = 0;
    while (index < words.length) {
      let low = 1, high = words.length - index, fit = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = words.slice(index, index + mid).join(" ");
        const candidateType = section.type === "heading" || section.type === "subheading" ? "paragraph" : section.type;
        if (measureHtml(renderSectionToHtml({ ...section, type: candidateType, content: candidate })) <= PAGE_INNER_H) {
          fit = mid; low = mid + 1;
        } else high = mid - 1;
      }
      const chunkType = section.type === "heading" || section.type === "subheading" ? "paragraph" : section.type;
      pushChunk(words.slice(index, index + fit).join(" "), chunkType);
      index += fit;
    }
    return chunks;
  };

  try {
    const all: { html: string; height: number }[] = [];
    const titleHtml = buildTitleBlockHtml(title, author);
    if (titleHtml) all.push({ html: titleHtml, height: measureHtml(titleHtml) });
    for (const s of sections) all.push(...splitOversized(s));

    const pages: string[] = [];
    let curHtml = "";
    for (const { html } of all) {
      const candidate = curHtml + html;
      if (curHtml && measureHtml(candidate) > PAGE_INNER_H) {
        pages.push(curHtml);
        curHtml = html;
      } else {
        curHtml = candidate;
      }
    }
    if (curHtml) pages.push(curHtml);
    return pages;
  } finally {
    document.body.removeChild(measure);
  }
};

// Preview mounts at most this many page nodes; export always renders all pages.
const PREVIEW_PAGE_LIMIT = 12;

interface PdfSection {

  id: string;
  type: "heading" | "subheading" | "paragraph" | "quote" | "list" | "divider";
  content: string;
}

const PdfGeneratorView = () => {
  const [rawData, setRawData] = useState("");
  const [sections, setSections] = useState<PdfSection[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState("default");
  const [bgIntensity, setBgIntensity] = useState<"subtle" | "medium" | "bold">("medium");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);


  const wallpaperSrc = WALLPAPERS.find(w => w.key === selectedWallpaper)?.src || wallpaperDefault;

  const bgOpacity = useMemo(() => ({ subtle: 0.25, medium: 0.5, bold: 0.75 }[bgIntensity]), [bgIntensity]);
  const overlayOpacity = useMemo(() => ({ subtle: 0.78, medium: 0.6, bold: 0.42 }[bgIntensity]), [bgIntensity]);
  const pdfSections = useMemo(
    () => sections.length ? sections : (rawData.trim() ? parseTextIntoSections(rawData, 0) : []),
    [sections, rawData]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawData((ev.target?.result as string) || "");
    reader.readAsText(file);
    e.target.value = "";
  };

  // Pure deterministic parser — NO AI. Walks the text LINE BY LINE in the exact
  // order the user typed it. Only blank lines and ASCII decorator lines are removed;
  // every other line becomes its own section, preserving sequence 1:1.
  const parseRawText = useCallback(() => {
    if (!rawData.trim()) return;
    setSections(parseTextIntoSections(rawData));
  }, [rawData]);

  const addSection = (type: PdfSection["type"]) =>
    setSections(prev => [...prev, { id: `s-${Date.now()}`, type, content: "" }]);

  const updateSection = (id: string, content: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));

  const removeSection = (id: string) =>
    setSections(prev => prev.filter(s => s.id !== id));

  // Live-paginated preview pages — debounced so typing never fights the
  // layout engine, and capped so a 200-page book doesn't mount 200 page nodes.
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (cancelled) return;
      const pages = paginateSections(pdfSections, title, author);
      if (cancelled) return;
      setTotalPages(pages.length);
      setPreviewPages(pages.length ? pages.slice(0, PREVIEW_PAGE_LIMIT) : [""]);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pdfSections, title, author]);

  const exportPdf = useCallback(async () => {
    setGenerating(true);
    setExportError(null);
    setProgress(null);
    const scratch: HTMLElement[] = [];
    const mount = (css: string, html: string) => {
      const el = document.createElement("div");
      el.style.cssText = css;
      el.innerHTML = sanitizePdfHtml(html);
      document.body.appendChild(el);
      scratch.push(el);
      return el;
    };

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pages = paginateSections(pdfSections, title, author);
      if (pages.length === 0) pages.push("");
      setProgress({ done: 0, total: pages.length });

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [432, 648], compress: true });

      // Wallpaper must be decoded before rasterization or html2canvas paints an
      // empty plate. Resolve on error too — a missing file degrades to plain ink.
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = wallpaperSrc;
      });

      // ── Background plate: rasterized ONCE and embedded ONCE (jsPDF dedupes by
      // alias). Previously every page re-decoded the wallpaper and stored its own
      // full-bleed JPEG, so a long document meant minutes of work and a file
      // large enough to exhaust the tab before save() was ever reached.
      const bgEl = mount(
        `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#0a0a0a;`,
        `<div style="position:absolute;inset:0;background-image:url(${wallpaperSrc});background-size:cover;background-position:center;opacity:${bgOpacity};"></div>
         <div style="position:absolute;inset:0;background:rgba(10,10,10,${overlayOpacity});"></div>
         <div style="position:absolute;top:${PAGE_PAD_Y - 14}px;left:${PAGE_PAD_X - 14}px;right:${PAGE_PAD_X - 14}px;bottom:${PAGE_PAD_Y - 14}px;border:1px solid rgba(216,200,154,0.45);border-radius:2px;"></div>
         <div style="position:absolute;top:${PAGE_PAD_Y - 8}px;left:${PAGE_PAD_X - 8}px;right:${PAGE_PAD_X - 8}px;bottom:${PAGE_PAD_Y - 8}px;border:1px solid rgba(216,200,154,0.18);"></div>`,
      );
      const bgCanvas = await html2canvas(bgEl, {
        backgroundColor: "#0a0a0a",
        scale: 1.5,
        useCORS: true,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        logging: false,
        imageTimeout: 15000,
      });
      const bgData = bgCanvas.toDataURL("image/jpeg", 0.82);

      for (let i = 0; i < pages.length; i++) {
        // Text layer only — transparent so it composites over the shared plate.
        const pageEl = mount(
          `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:transparent;`,
          `<div style="position:absolute;top:${PAGE_PAD_Y}px;left:${PAGE_PAD_X}px;width:${PAGE_INNER_W}px;height:${PAGE_INNER_H}px;overflow:hidden;word-wrap:break-word;overflow-wrap:break-word;">
             ${pages[i]}
           </div>
           <div style="position:absolute;bottom:${PAGE_PAD_Y - 28}px;left:0;right:0;text-align:center;font-family:${FONT_BODY};font-size:9px;color:#a89968;letter-spacing:0.2em;">— ${i + 1} —</div>`,
        );
        const canvas = await html2canvas(pageEl, {
          backgroundColor: null,
          scale: 1.5,
          useCORS: true,
          windowWidth: PAGE_W,
          windowHeight: PAGE_H,
          logging: false,
          imageTimeout: 15000,
        });
        pageEl.remove();
        scratch.splice(scratch.indexOf(pageEl), 1);

        const inkData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage([432, 648], "portrait");
        pdf.addImage(bgData, "JPEG", 0, 0, 432, 648, "pdfgen-plate", "FAST");
        pdf.addImage(inkData, "PNG", 0, 0, 432, 648, undefined, "FAST");

        setProgress({ done: i + 1, total: pages.length });
        // Yield to the event loop so the progress label paints and the tab
        // stays responsive instead of looking frozen mid-export.
        await new Promise((r) => setTimeout(r, 0));
      }

      const safeTitle = (title || "asherin-document").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      pdf.save(`${safeTitle}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      setExportError(e instanceof Error ? e.message : "Export failed. Try a smaller document or a different background.");
    } finally {
      // Scratch nodes are removed on every path — a thrown render used to leave
      // orphaned 576×864 nodes pinned off-screen for the rest of the session.
      scratch.forEach((el) => el.remove());
      setGenerating(false);
      setProgress(null);
    }
  }, [title, author, pdfSections, wallpaperSrc, bgOpacity, overlayOpacity]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">PDF Generator</h1>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">6×9″ eBook · Manual · No AI</p>
            </div>
          </div>
          <button onClick={exportPdf} disabled={pdfSections.length === 0 || generating}
            aria-busy={generating}
            className="flex items-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {generating
              ? progress?.total
                ? `Rendering ${progress.done}/${progress.total}`
                : "Preparing…"
              : "Export PDF"}
          </button>
        </div>
        {exportError && (
          <p role="alert" className="mt-2 text-[11px] font-light text-destructive">
            {exportError}
          </p>
        )}
      </div>


      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Input Panel */}
        <div className="w-full lg:w-1/2 border-r border-border/10 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Title + Author */}
          <div className="grid grid-cols-2 gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Book title"
              className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author"
              className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
          </div>

          {/* Wallpaper Selector */}
          <div>
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Background</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
              {WALLPAPERS.map(wp => (
                <button key={wp.key} onClick={() => setSelectedWallpaper(wp.key)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all h-12 ${selectedWallpaper === wp.key ? "border-accent/60 ring-1 ring-accent/30" : "border-border/20 hover:border-border/40"}`}>
                  <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/70 to-transparent">
                    <span className="text-[8px] font-light text-white/90">{wp.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase mr-1">Visibility</span>
              {(["subtle", "medium", "bold"] as const).map(v => (
                <button key={v} onClick={() => setBgIntensity(v)}
                  className={`px-2 py-1 rounded text-[9px] uppercase tracking-wider border transition-colors ${
                    bgIntensity === v ? "border-accent/50 text-accent bg-accent/10" : "border-border/20 text-muted-foreground hover:text-foreground"
                  }`}>{v}</button>
              ))}
            </div>
          </div>

          {/* Raw Data Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Raw Text</p>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-3 w-3" /> Upload
                </button>
                <button onClick={parseRawText} disabled={!rawData.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-[10px] text-accent hover:bg-accent/25 transition-colors disabled:opacity-40">
                  <Wand2 className="h-3 w-3" /> Parse Into Sections
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml" onChange={handleFileUpload} />
            <textarea value={rawData} onChange={e => setRawData(e.target.value)}
              placeholder="Paste your text exactly as you want it. Leave blank lines between paragraphs. Use # for headings, > for quotes, - for lists. Nothing is rewritten — your words are preserved 100%."
              className="w-full h-40 bg-card/30 border border-border/20 rounded-xl p-3 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
          </div>

          {/* Sections Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Sections</p>
              <div className="flex gap-1 flex-wrap">
                {(["heading", "subheading", "paragraph", "quote", "list", "divider"] as const).map(type => (
                  <button key={type} onClick={() => addSection(type)}
                    className="flex items-center gap-1 rounded-lg border border-border/20 px-2 py-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-2.5 w-2.5" /> {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sections.map((section) => (
                <div key={section.id} className="rounded-xl border border-border/20 bg-card/20 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-light tracking-[0.1em] text-accent/60 uppercase">{section.type}</span>
                    <button onClick={() => removeSection(section.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {section.type !== "divider" && (
                    <textarea value={section.content} onChange={e => updateSection(section.id, e.target.value)}
                      className="w-full bg-transparent border-none text-xs font-light text-foreground outline-none resize-none min-h-[60px]"
                      placeholder={`Enter ${section.type} content…`} />
                  )}
                </div>
              ))}
              {sections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground/30 text-xs font-light">
                  Paste text above and click "Parse Into Sections", or add sections manually.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Preview Panel — paginated 6×9 ebook pages */}
        <div className="w-full lg:w-1/2 overflow-y-auto p-4 flex flex-col items-center gap-6">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-1 self-start">
            Live Preview · 6×9″ eBook · {Math.max(totalPages, 1)} page{Math.max(totalPages, 1) === 1 ? "" : "s"}
            {totalPages > previewPages.length ? ` · showing first ${previewPages.length}` : ""}
          </p>


          {pdfSections.length === 0 ? (
            <div
              className="relative shadow-2xl rounded-sm overflow-hidden flex flex-col items-center justify-center"
              style={{ width: "100%", maxWidth: PAGE_W, aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaperSrc})`, opacity: bgOpacity }} />
              <div className="absolute inset-0" style={{ background: `rgba(10,10,10, ${overlayOpacity})` }} />
              <div className="relative z-10 flex flex-col items-center text-muted-foreground/30">
                <ImageIcon className="h-10 w-10 mb-3" />
                <p className="text-xs font-light">Your eBook pages will appear here</p>
              </div>
            </div>
          ) : (
            previewPages.map((pageHtml, idx) => (
              <div key={idx} className="w-full flex flex-col items-center">
                <div
                  ref={idx === 0 ? previewRef : undefined}
                  className="relative shadow-2xl rounded-sm overflow-hidden"
                  style={{ width: PAGE_W, height: PAGE_H, maxWidth: "100%", transformOrigin: "top center" }}
                >
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaperSrc})`, opacity: bgOpacity }} />
                  <div className="absolute inset-0" style={{ background: `rgba(10,10,10, ${overlayOpacity})` }} />
                  <div className="absolute pointer-events-none rounded-sm" style={{ top: "5.1%", left: "6.1%", right: "6.1%", bottom: "5.1%", border: "1px solid rgba(216,200,154,0.45)" }} />
                  <div className="absolute pointer-events-none" style={{ top: "5.7%", left: "6.9%", right: "6.9%", bottom: "5.7%", border: "1px solid rgba(216,200,154,0.18)" }} />
                  <div
                    className="absolute z-10 overflow-hidden"
                    style={{ top: PAGE_PAD_Y, left: PAGE_PAD_X, width: PAGE_INNER_W, height: PAGE_INNER_H, wordWrap: "break-word", overflowWrap: "break-word" }}
                    dangerouslySetInnerHTML={{ __html: sanitizePdfHtml(pageHtml) }}
                  />
                  <div className="absolute z-10 left-0 right-0 text-center" style={{ bottom: "3.2%", fontFamily: FONT_BODY, fontSize: 9, color: "#a89968", letterSpacing: "0.2em" }}>
                    — {idx + 1} —
                  </div>
                </div>
                <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase mt-2">
                  Page {idx + 1} of {totalPages || previewPages.length}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfGeneratorView;
