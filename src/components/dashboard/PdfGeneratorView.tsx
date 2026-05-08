import { useState, useRef, useCallback, useMemo } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileText, Upload, Download, Image as ImageIcon, Loader2, Trash2, Plus, Wand2 } from "lucide-react";
import { ALL_WALLPAPERS as WALLPAPERS } from "@/lib/wallpapers";
const wallpaperDefault = WALLPAPERS[0].src;

// Standard ebook trim size: 6" × 9" @ 96dpi → 576 × 864 px (preview)
// jsPDF uses points: 6" × 9" = 432pt × 648pt
const PAGE_W = 576;
const PAGE_H = 864;

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
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const wallpaperSrc = WALLPAPERS.find(w => w.key === selectedWallpaper)?.src || wallpaperDefault;

  const bgOpacity = useMemo(() => ({ subtle: 0.25, medium: 0.5, bold: 0.75 }[bgIntensity]), [bgIntensity]);
  const overlayOpacity = useMemo(() => ({ subtle: 0.78, medium: 0.6, bold: 0.42 }[bgIntensity]), [bgIntensity]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawData((ev.target?.result as string) || "");
    reader.readAsText(file);
    e.target.value = "";
  };

  // Pure deterministic parser — NO AI. Splits text into sections by structure only.
  const parseRawText = useCallback(() => {
    if (!rawData.trim()) return;
    const blocks = rawData.replace(/\r\n/g, "\n").split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
    const out: PdfSection[] = [];
    blocks.forEach((block, i) => {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      // Markdown headings
      if (/^#{1,2}\s/.test(lines[0])) {
        out.push({ id: `s-${i}-${Date.now()}`, type: "heading", content: lines[0].replace(/^#{1,2}\s+/, "") });
        if (lines.length > 1) out.push({ id: `s-${i}b-${Date.now()}`, type: "paragraph", content: lines.slice(1).join(" ") });
        return;
      }
      if (/^#{3,6}\s/.test(lines[0])) {
        out.push({ id: `s-${i}-${Date.now()}`, type: "subheading", content: lines[0].replace(/^#{3,6}\s+/, "") });
        if (lines.length > 1) out.push({ id: `s-${i}b-${Date.now()}`, type: "paragraph", content: lines.slice(1).join(" ") });
        return;
      }
      // Bullet list
      if (lines.every(l => /^[-•*]\s/.test(l) || /^\d+[.)]\s/.test(l))) {
        out.push({ id: `s-${i}-${Date.now()}`, type: "list", content: lines.join("\n") });
        return;
      }
      // Blockquote
      if (lines.every(l => /^>\s?/.test(l))) {
        out.push({ id: `s-${i}-${Date.now()}`, type: "quote", content: lines.map(l => l.replace(/^>\s?/, "")).join(" ") });
        return;
      }
      // Short standalone line → heading
      if (lines.length === 1 && lines[0].length < 80 && !/[.!?]$/.test(lines[0])) {
        out.push({ id: `s-${i}-${Date.now()}`, type: "heading", content: lines[0] });
        return;
      }
      // Default paragraph
      out.push({ id: `s-${i}-${Date.now()}`, type: "paragraph", content: lines.join(" ") });
    });
    setSections(out);
  }, [rawData]);

  const addSection = (type: PdfSection["type"]) =>
    setSections(prev => [...prev, { id: `s-${Date.now()}`, type, content: "" }]);

  const updateSection = (id: string, content: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));

  const removeSection = (id: string) =>
    setSections(prev => prev.filter(s => s.id !== id));

  const exportPdf = useCallback(async () => {
    setGenerating(true);
    try {
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const PAGE_PAD_Y = 56;
      const PAGE_PAD_X = 48;
      const INNER_H = PAGE_H - PAGE_PAD_Y * 2;

      // Build offscreen measuring container at exact page width
      const measure = document.createElement("div");
      measure.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_W - PAGE_PAD_X * 2}px;visibility:hidden;`;
      document.body.appendChild(measure);

      // Render the title block + each section into individual elements to measure
      const sectionEls: HTMLElement[] = [];
      const renderToHtml = (s: PdfSection): string => {
        const t = String(s.content ?? "").replace(/</g, "&lt;");
        switch (s.type) {
          case "heading":
            return `<h2 style="font-family:${FONT_HEAD};font-size:26px;font-weight:700;line-height:1.15;margin:28px 0 14px;color:#f5f1e8;letter-spacing:-0.01em;">${t}</h2>`;
          case "subheading":
            return `<h3 style="font-family:${FONT_HEAD};font-size:17px;font-weight:600;font-style:italic;margin:20px 0 8px;color:#e8dfc9;">${t}</h3>`;
          case "paragraph":
            return `<p style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.75;margin-bottom:14px;color:#e8e3d6;text-align:justify;text-indent:1.2em;">${t}</p>`;
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

      // Title block (only on first page)
      let titleBlockHtml = "";
      if (title || author) {
        titleBlockHtml = `<div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:1px solid rgba(216,200,154,0.25);">
          ${title ? `<div style="font-family:${FONT_HEAD};font-size:22px;font-weight:700;color:#f5f1e8;letter-spacing:0.02em;">${title}</div>` : ""}
          ${author ? `<div style="font-family:${FONT_HEAD};font-style:italic;font-size:11px;color:#d8c89a;margin-top:6px;letter-spacing:0.15em;text-transform:uppercase;">${author}</div>` : ""}
        </div>`;
      }

      // Measure each section's height
      const all: { html: string; height: number }[] = [];
      if (titleBlockHtml) {
        measure.innerHTML = titleBlockHtml;
        all.push({ html: titleBlockHtml, height: measure.offsetHeight });
      }
      for (const s of sections) {
        const html = renderToHtml(s);
        measure.innerHTML = html;
        all.push({ html, height: measure.offsetHeight });
      }
      document.body.removeChild(measure);

      // Paginate by accumulating heights
      const pages: string[] = [];
      let curHtml = "";
      let curH = 0;
      for (const { html, height } of all) {
        if (height > INNER_H) {
          // Oversized single block — flush current and place alone (will be clipped, but better than overlap)
          if (curHtml) { pages.push(curHtml); curHtml = ""; curH = 0; }
          pages.push(html);
          continue;
        }
        if (curH + height > INNER_H) {
          pages.push(curHtml);
          curHtml = html;
          curH = height;
        } else {
          curHtml += html;
          curH += height;
        }
      }
      if (curHtml) pages.push(curHtml);
      if (pages.length === 0) pages.push("");

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [432, 648] });

      for (let i = 0; i < pages.length; i++) {
        // Build a real page DOM with wallpaper + overlay + content
        const pageEl = document.createElement("div");
        pageEl.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#0a0a0a;`;
        pageEl.innerHTML = `
          <div style="position:absolute;inset:0;background-image:url(${wallpaperSrc});background-size:cover;background-position:center;opacity:${bgOpacity};"></div>
          <div style="position:absolute;inset:0;background:rgba(10,10,10,${overlayOpacity});"></div>
          <div style="position:absolute;inset:12px;border:1px solid rgba(255,255,255,0.1);border-radius:2px;pointer-events:none;"></div>
          <div style="position:relative;z-index:10;padding:${PAGE_PAD_Y}px ${PAGE_PAD_X}px;height:${PAGE_H}px;box-sizing:border-box;overflow:hidden;">
            ${pages[i]}
            <div style="position:absolute;bottom:18px;left:0;right:0;text-align:center;font-family:${FONT_BODY};font-size:9px;color:#a89968;letter-spacing:0.2em;">${i + 1}</div>
          </div>
        `;
        document.body.appendChild(pageEl);

        // Wait for background image to load
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = wallpaperSrc;
        });

        const canvas = await html2canvas(pageEl, {
          backgroundColor: "#0a0a0a",
          scale: 2,
          useCORS: true,
          windowWidth: PAGE_W,
        });
        document.body.removeChild(pageEl);

        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage([432, 648], "portrait");
        pdf.addImage(imgData, "PNG", 0, 0, 432, 648, undefined, "FAST");
      }

      const safeTitle = (title || "aureon-document").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      pdf.save(`${safeTitle}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
    }
    setGenerating(false);
  }, [title, author, sections, wallpaperSrc, bgOpacity, overlayOpacity]);

  // Modern fancy typography (Playfair display headings + Lora body)
  const FONT_HEAD = "'Playfair Display', 'Cormorant Garamond', Georgia, serif";
  const FONT_BODY = "'Lora', Georgia, 'Times New Roman', serif";

  const renderSectionPreview = (section: PdfSection) => {
    const text = String(section.content ?? "");
    switch (section.type) {
      case "heading":
        return (
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 700, lineHeight: 1.15,
            margin: "28px 0 14px", color: "#f5f1e8", letterSpacing: "-0.01em",
          }}>{text}</h2>
        );
      case "subheading":
        return (
          <h3 style={{
            fontFamily: FONT_HEAD, fontSize: 17, fontWeight: 600, fontStyle: "italic",
            margin: "20px 0 8px", color: "#e8dfc9", letterSpacing: "0.01em",
          }}>{text}</h3>
        );
      case "paragraph":
        return (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 400, lineHeight: 1.75,
            marginBottom: 14, color: "#e8e3d6", textAlign: "justify", textIndent: "1.2em",
          }}>{text}</p>
        );
      case "quote":
        return (
          <blockquote style={{
            fontFamily: FONT_HEAD, fontSize: 14, fontStyle: "italic", lineHeight: 1.7,
            margin: "20px 28px", padding: "8px 0 8px 18px", color: "#d8c89a",
            borderLeft: "2px solid rgba(216, 200, 154, 0.6)",
          }}>"{text}"</blockquote>
        );
      case "list":
        return (
          <ul style={{ paddingLeft: 22, margin: "10px 0 16px", listStyle: "none" }}>
            {text.split("\n").filter(l => l.trim()).map((item, i) => (
              <li key={i} style={{
                fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 400, lineHeight: 1.7,
                color: "#e8e3d6", marginBottom: 6, position: "relative", paddingLeft: 14,
              }}>
                <span style={{ position: "absolute", left: 0, color: "#d8c89a" }}>◆</span>
                {item.replace(/^([-•*]|\d+[.)])\s*/, "")}
              </li>
            ))}
          </ul>
        );
      case "divider":
        return (
          <div style={{ display: "flex", justifyContent: "center", margin: "24px 0", color: "#a89968" }}>
            <span style={{ fontFamily: FONT_HEAD, fontSize: 16, letterSpacing: "1em" }}>◈ ◈ ◈</span>
          </div>
        );
      default:
        return null;
    }
  };

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
          <button onClick={exportPdf} disabled={sections.length === 0 || generating}
            className="flex items-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export PDF
          </button>
        </div>
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

        {/* Right: Preview Panel — fixed 6×9 ebook page */}
        <div className="w-full lg:w-1/2 overflow-y-auto p-4 flex flex-col items-center">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-3 self-start">
            Live Preview · 6×9″ eBook Page
          </p>
          <div
            className="relative shadow-2xl rounded-sm overflow-hidden"
            style={{ width: "100%", maxWidth: PAGE_W, aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
          >
            {/* Visible background image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${wallpaperSrc})`, opacity: bgOpacity }}
            />
            {/* Subtle dark overlay for text legibility */}
            <div className="absolute inset-0" style={{ background: `rgba(10,10,10, ${overlayOpacity})` }} />
            {/* Decorative inner frame */}
            <div className="absolute inset-3 border border-white/10 rounded-sm pointer-events-none" />

            <div ref={previewRef} className="relative z-10 h-full overflow-hidden"
              style={{ padding: "56px 48px", width: PAGE_W }}>
              {/* Title block */}
              {(title || author) && (
                <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 18, borderBottom: "1px solid rgba(216, 200, 154, 0.25)" }}>
                  {title && (
                    <div style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, color: "#f5f1e8", letterSpacing: "0.02em" }}>
                      {title}
                    </div>
                  )}
                  {author && (
                    <div style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontSize: 11, color: "#d8c89a", marginTop: 6, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                      {author}
                    </div>
                  )}
                </div>
              )}
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground/20">
                  <ImageIcon className="h-10 w-10 mb-3" />
                  <p className="text-xs font-light">Your eBook page will appear here</p>
                </div>
              ) : (
                sections.map(section => (
                  <div key={section.id}>{renderSectionPreview(section)}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfGeneratorView;
