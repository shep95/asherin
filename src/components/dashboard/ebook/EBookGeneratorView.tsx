import { useState, useRef, useCallback } from "react";
import { BookOpen, Upload, FileText, Sparkles, Download, Loader2, ArrowRight, ArrowLeft, Settings2, Eye, ChevronDown, ChevronUp, Trash2, GripVertical, Plus } from "lucide-react";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";
import { jsPDF } from "jspdf";
import type { EBookChapter, EBookMetadata, EBookSettings, EBookStep } from "./types";

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

const PAGE_SIZES = {
  a4: { w: 595.28, h: 841.89, label: "A4 (210×297mm)" },
  letter: { w: 612, h: 792, label: "US Letter (8.5×11\")" },
  paperback: { w: 432, h: 648, label: "6×9\" Paperback" },
};

const DEFAULT_METADATA: EBookMetadata = {
  title: "",
  subtitle: "",
  author: "",
  description: "",
  dedication: "",
  copyright: "",
  aboutAuthor: "",
};

const DEFAULT_SETTINGS: EBookSettings = {
  wallpaper: "default",
  pageSize: "a4",
  fontSize: 12,
  lineSpacing: 1.5,
  chapterCount: "auto",
  tone: "formal",
  includeTableOfContents: true,
  includeChapterSummaries: true,
  includeDedication: false,
  includeAboutAuthor: false,
  includeCopyright: true,
  rewriteForConsistency: true,
  fixGrammar: true,
  removeDuplicates: true,
};

const EBookGeneratorView = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<EBookStep>("upload");
  const [rawText, setRawText] = useState("");
  const [metadata, setMetadata] = useState<EBookMetadata>({ ...DEFAULT_METADATA });
  const [settings, setSettings] = useState<EBookSettings>({ ...DEFAULT_SETTINGS });
  const [chapters, setChapters] = useState<EBookChapter[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wallpaperSrc = WALLPAPERS.find(w => w.key === settings.wallpaper)?.src || heroBgDefault;
  const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 250));
  const readingTime = Math.ceil(wordCount / 200);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const promises = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string || "");
        reader.readAsText(file);
      });
    });
    Promise.all(promises).then(texts => {
      setRawText(prev => prev + (prev ? "\n\n" : "") + texts.join("\n\n---\n\n"));
    });
    e.target.value = "";
  };

  const structureBook = useCallback(async () => {
    if (!rawText.trim() || !metadata.title.trim()) return;
    setProcessing(true);
    setProgress("Analyzing content structure…");
    setChapters([]);

    const chapterCountInstruction = settings.chapterCount === "auto"
      ? "Automatically determine the optimal number of chapters based on topic shifts and content volume."
      : `Create exactly ${settings.chapterCount} chapters.`;

    const toneMap = { formal: "formal and professional", casual: "conversational and approachable", technical: "technical and precise", narrative: "narrative and storytelling" };

    let result = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `You are a professional book editor and author. Your task is to take raw, unstructured text and organize it into a complete, well-structured book.

BOOK TITLE: "${metadata.title}"
BOOK DESCRIPTION: "${metadata.description}"
TONE: ${toneMap[settings.tone]}

INSTRUCTIONS:
1. ${chapterCountInstruction}
2. ${settings.removeDuplicates ? "Remove duplicate content and merge similar sections." : "Keep all content as-is."}
3. ${settings.rewriteForConsistency ? "Rewrite content for consistency in tone, style, and voice throughout." : "Preserve original wording as much as possible."}
4. ${settings.fixGrammar ? "Fix all grammar, spelling, and punctuation errors." : "Keep original grammar."}
5. ${settings.includeChapterSummaries ? "Write a brief 2-3 sentence summary for each chapter." : "No chapter summaries needed."}
6. Each chapter must have a compelling title.
7. Organize content logically — group related topics, ensure flow between chapters.
8. Ensure each chapter has substantial content (minimum 500 words per chapter).

OUTPUT FORMAT: Return ONLY a valid JSON array. Each element:
{
  "title": "Chapter Title",
  "content": "Full chapter text with proper paragraphs...",
  "summary": "Brief chapter summary (if requested)"
}

Do NOT wrap in markdown. Return ONLY the JSON array.

RAW TEXT TO STRUCTURE:
${rawText.slice(0, 100000)}`,
        }],
        mode: "chat",
        onDelta: (chunk) => {
          result += chunk;
          // Update progress based on content length
          if (result.length > 500) setProgress("Organizing chapters…");
          if (result.length > 2000) setProgress("Writing chapter content…");
          if (result.length > 5000) setProgress("Refining and polishing…");
        },
        onDone: () => {
          try {
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as EBookChapter[];
              setChapters(parsed.map((ch, i) => ({
                ...ch,
                id: `ch-${i}-${Date.now()}`,
              })));
              setProgress("");
              setStep("preview");
            } else {
              setProgress("Failed to parse — trying again…");
            }
          } catch {
            setProgress("Error parsing AI response. Please try again.");
          }
          setProcessing(false);
        },
      });
    } catch {
      setProcessing(false);
      setProgress("Error connecting to AI. Please try again.");
    }
  }, [rawText, metadata, settings]);

  const addChapter = () => {
    setChapters(prev => [...prev, {
      id: `ch-new-${Date.now()}`,
      title: `Chapter ${prev.length + 1}`,
      content: "",
      summary: "",
    }]);
  };

  const updateChapter = (id: string, field: keyof EBookChapter, value: string) => {
    setChapters(prev => prev.map(ch => ch.id === id ? { ...ch, [field]: value } : ch));
  };

  const removeChapter = (id: string) => {
    setChapters(prev => prev.filter(ch => ch.id !== id));
  };

  const moveChapter = (id: string, direction: "up" | "down") => {
    setChapters(prev => {
      const idx = prev.findIndex(ch => ch.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  // ── PDF Export with multi-page support ──
  const exportPdf = useCallback(async () => {
    if (chapters.length === 0) return;
    setExporting(true);

    try {
      const ps = PAGE_SIZES[settings.pageSize];
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [ps.w, ps.h] });
      const margin = { top: 72, bottom: 72, left: 54, right: 54 };
      const contentW = ps.w - margin.left - margin.right;
      const bodyFontSize = settings.fontSize;
      const headingFontSize = bodyFontSize + 8;
      const chapterTitleSize = bodyFontSize + 14;
      const lineH = bodyFontSize * settings.lineSpacing;
      let pageNum = 0;
      const pageNumbers: { page: number; label: string }[] = [];

      const addPage = () => {
        if (pageNum > 0) pdf.addPage();
        pageNum++;
        return pageNum;
      };

      const drawPageNumber = (num: number) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        const text = `${num}`;
        const tw = pdf.getTextWidth(text);
        pdf.text(text, (ps.w - tw) / 2, ps.h - 36);
      };

      const drawHeader = (leftText: string, rightText: string) => {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(160);
        pdf.text(leftText, margin.left, 40);
        const rw = pdf.getTextWidth(rightText);
        pdf.text(rightText, ps.w - margin.right - rw, 40);
      };

      // ── COVER PAGE ──
      addPage();
      // Draw wallpaper as cover background
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => {
            pdf.addImage(img, "JPEG", 0, 0, ps.w, ps.h);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = wallpaperSrc;
        });
      } catch { /* skip bg */ }
      // Overlay
      pdf.setFillColor(0, 0, 0);
      pdf.setGState(new (pdf as any).GState({ opacity: 0.65 }));
      pdf.rect(0, 0, ps.w, ps.h, "F");
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(36);
      pdf.setTextColor(240);
      const titleLines = pdf.splitTextToSize(metadata.title, contentW);
      let titleY = ps.h * 0.35;
      titleLines.forEach((line: string) => {
        const tw = pdf.getTextWidth(line);
        pdf.text(line, (ps.w - tw) / 2, titleY);
        titleY += 44;
      });

      // Subtitle
      if (metadata.subtitle) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(18);
        pdf.setTextColor(200);
        const subtitleLines = pdf.splitTextToSize(metadata.subtitle, contentW);
        subtitleLines.forEach((line: string) => {
          const tw = pdf.getTextWidth(line);
          pdf.text(line, (ps.w - tw) / 2, titleY + 10);
          titleY += 26;
        });
      }

      // Author
      if (metadata.author) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(16);
        pdf.setTextColor(180);
        const aw = pdf.getTextWidth(metadata.author);
        pdf.text(metadata.author, (ps.w - aw) / 2, ps.h * 0.7);
      }

      // ── COPYRIGHT PAGE ──
      if (settings.includeCopyright) {
        addPage();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(80);
        const copyrightText = metadata.copyright || `© ${new Date().getFullYear()} ${metadata.author || "Author"}. All rights reserved.\n\nNo part of this publication may be reproduced, distributed, or transmitted in any form without prior written permission.`;
        const copyrightLines = pdf.splitTextToSize(copyrightText, contentW);
        pdf.text(copyrightLines, margin.left, ps.h * 0.6);
      }

      // ── DEDICATION PAGE ──
      if (settings.includeDedication && metadata.dedication.trim()) {
        addPage();
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(14);
        pdf.setTextColor(100);
        const dedLines = pdf.splitTextToSize(metadata.dedication, contentW * 0.6);
        const dedY = ps.h * 0.4;
        dedLines.forEach((line: string, i: number) => {
          const tw = pdf.getTextWidth(line);
          pdf.text(line, (ps.w - tw) / 2, dedY + i * 22);
        });
      }

      // ── TABLE OF CONTENTS ──
      let tocStartPage = 0;
      if (settings.includeTableOfContents) {
        tocStartPage = addPage();
        drawPageNumber(pageNum);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(24);
        pdf.setTextColor(30);
        pdf.text("Table of Contents", margin.left, margin.top + 30);

        let tocY = margin.top + 80;
        chapters.forEach((ch, i) => {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(12);
          pdf.setTextColor(60);
          const label = `${i + 1}.  ${ch.title}`;
          pdf.text(label, margin.left + 20, tocY);
          tocY += 28;
          if (tocY > ps.h - margin.bottom) {
            addPage();
            drawPageNumber(pageNum);
            tocY = margin.top + 30;
          }
        });
      }

      // ── CHAPTERS ──
      chapters.forEach((chapter, chIdx) => {
        // Each chapter starts on a new page
        const chapterPage = addPage();
        pageNumbers.push({ page: chapterPage, label: chapter.title });

        // Chapter number
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(160);
        const chNumText = `CHAPTER ${chIdx + 1}`;
        const cnw = pdf.getTextWidth(chNumText);
        pdf.text(chNumText, (ps.w - cnw) / 2, margin.top + 60);

        // Chapter title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(chapterTitleSize);
        pdf.setTextColor(30);
        const chTitleLines = pdf.splitTextToSize(chapter.title, contentW);
        let cy = margin.top + 95;
        chTitleLines.forEach((line: string) => {
          const tw = pdf.getTextWidth(line);
          pdf.text(line, (ps.w - tw) / 2, cy);
          cy += chapterTitleSize + 6;
        });

        // Decorative line
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.5);
        pdf.line(ps.w * 0.3, cy + 10, ps.w * 0.7, cy + 10);
        cy += 35;

        // Chapter summary
        if (settings.includeChapterSummaries && chapter.summary) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(bodyFontSize - 1);
          pdf.setTextColor(120);
          const summaryLines = pdf.splitTextToSize(chapter.summary, contentW - 40);
          summaryLines.forEach((line: string) => {
            if (cy > ps.h - margin.bottom) {
              addPage();
              drawHeader(metadata.title, chapter.title);
              drawPageNumber(pageNum);
              cy = margin.top + 20;
            }
            pdf.text(line, margin.left + 20, cy);
            cy += lineH;
          });
          cy += lineH;
        }

        // Body text
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(bodyFontSize);
        pdf.setTextColor(40);

        const paragraphs = chapter.content.split(/\n\n+/);
        paragraphs.forEach((para) => {
          const trimmed = para.trim();
          if (!trimmed) return;

          const lines = pdf.splitTextToSize(trimmed, contentW);
          lines.forEach((line: string, li: number) => {
            if (cy > ps.h - margin.bottom) {
              addPage();
              drawHeader(metadata.title, chapter.title);
              drawPageNumber(pageNum);
              cy = margin.top + 20;
            }
            // First line indent
            const xOff = li === 0 ? 20 : 0;
            pdf.text(line, margin.left + xOff, cy);
            cy += lineH;
          });
          cy += lineH * 0.5; // paragraph spacing
        });

        drawPageNumber(pageNum);
      });

      // ── ABOUT THE AUTHOR ──
      if (settings.includeAboutAuthor && metadata.aboutAuthor.trim()) {
        addPage();
        drawPageNumber(pageNum);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.setTextColor(30);
        pdf.text("About the Author", margin.left, margin.top + 40);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(bodyFontSize);
        pdf.setTextColor(60);
        const aboutLines = pdf.splitTextToSize(metadata.aboutAuthor, contentW);
        let ay = margin.top + 80;
        aboutLines.forEach((line: string) => {
          if (ay > ps.h - margin.bottom) {
            addPage();
            drawPageNumber(pageNum);
            ay = margin.top + 20;
          }
          pdf.text(line, margin.left, ay);
          ay += lineH;
        });
      }

      pdf.save(`${metadata.title.replace(/[^a-zA-Z0-9]/g, "_")}_ebook.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
    }
    setExporting(false);
  }, [chapters, metadata, settings, wallpaperSrc]);

  // ── STATS ──
  const totalChapterWords = chapters.reduce((sum, ch) => sum + ch.content.split(/\s+/).filter(Boolean).length, 0);
  const totalChapterPages = Math.max(1, Math.ceil(totalChapterWords / 250));

  // ── RENDER STEPS ──
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="space-y-3">
        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Book Details</p>
        <input value={metadata.title} onChange={e => setMetadata(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Book Title *" className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30" />
        <input value={metadata.subtitle} onChange={e => setMetadata(prev => ({ ...prev, subtitle: e.target.value }))}
          placeholder="Subtitle (optional)" className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30" />
        <div className="grid grid-cols-2 gap-3">
          <input value={metadata.author} onChange={e => setMetadata(prev => ({ ...prev, author: e.target.value }))}
            placeholder="Author Name" className="bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30" />
          <input value={metadata.copyright} onChange={e => setMetadata(prev => ({ ...prev, copyright: e.target.value }))}
            placeholder="Copyright Notice" className="bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30" />
        </div>
        <textarea value={metadata.description} onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Book Description — what's this book about? (helps AI organize content)" rows={3}
          className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
      </div>

      {/* Raw Text Upload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Raw Content</p>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="h-3 w-3" /> Upload Files
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" accept=".txt,.md,.csv,.json,.xml,.html,.rtf" onChange={handleFileUpload} />
        <textarea value={rawText} onChange={e => setRawText(e.target.value)}
          placeholder="Paste or upload all your raw text content here… Aureon will analyze, deduplicate, organize, and transform it into a structured book with chapters."
          rows={12}
          className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
        {rawText.trim() && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50 font-light">
            <span>{wordCount.toLocaleString()} words</span>
            <span>~{estimatedPages} pages</span>
            <span>~{readingTime} min read</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-6">
      {/* Cover Wallpaper */}
      <div>
        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Cover Wallpaper</p>
        <div className="grid grid-cols-7 gap-2">
          {WALLPAPERS.map(wp => (
            <button key={wp.key} onClick={() => setSettings(prev => ({ ...prev, wallpaper: wp.key }))}
              className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-[3/4] ${settings.wallpaper === wp.key ? "border-accent/50 ring-1 ring-accent/20" : "border-border/20 hover:border-border/40"}`}>
              <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-[7px] font-light text-white/90">{wp.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Page Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Page Size</p>
          <select value={settings.pageSize} onChange={e => setSettings(prev => ({ ...prev, pageSize: e.target.value as any }))}
            className="w-full bg-card/30 border border-border/20 rounded-xl px-3 py-2 text-xs font-light text-foreground outline-none">
            {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Font Size</p>
          <select value={settings.fontSize} onChange={e => setSettings(prev => ({ ...prev, fontSize: Number(e.target.value) as any }))}
            className="w-full bg-card/30 border border-border/20 rounded-xl px-3 py-2 text-xs font-light text-foreground outline-none">
            <option value={10}>10pt</option><option value={12}>12pt</option><option value={14}>14pt</option>
          </select>
        </div>
        <div>
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Line Spacing</p>
          <select value={settings.lineSpacing} onChange={e => setSettings(prev => ({ ...prev, lineSpacing: Number(e.target.value) as any }))}
            className="w-full bg-card/30 border border-border/20 rounded-xl px-3 py-2 text-xs font-light text-foreground outline-none">
            <option value={1}>Single</option><option value={1.5}>1.5×</option><option value={2}>Double</option>
          </select>
        </div>
        <div>
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Tone</p>
          <select value={settings.tone} onChange={e => setSettings(prev => ({ ...prev, tone: e.target.value as any }))}
            className="w-full bg-card/30 border border-border/20 rounded-xl px-3 py-2 text-xs font-light text-foreground outline-none">
            <option value="formal">Formal</option><option value="casual">Casual</option><option value="technical">Technical</option><option value="narrative">Narrative</option>
          </select>
        </div>
      </div>

      {/* Chapters */}
      <div>
        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Chapter Count</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setSettings(prev => ({ ...prev, chapterCount: "auto" }))}
            className={`rounded-lg px-4 py-2 text-xs font-light transition-colors ${settings.chapterCount === "auto" ? "bg-accent/20 text-accent" : "bg-card/30 text-muted-foreground border border-border/20"}`}>
            Auto-detect
          </button>
          <input type="number" min={1} max={50} value={settings.chapterCount === "auto" ? "" : settings.chapterCount}
            placeholder="Custom #"
            onChange={e => setSettings(prev => ({ ...prev, chapterCount: e.target.value ? Number(e.target.value) : "auto" }))}
            className="w-24 bg-card/30 border border-border/20 rounded-xl px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Content Processing</p>
        {[
          { key: "rewriteForConsistency" as const, label: "Rewrite for consistency" },
          { key: "fixGrammar" as const, label: "Fix grammar & spelling" },
          { key: "removeDuplicates" as const, label: "Remove duplicates" },
          { key: "includeTableOfContents" as const, label: "Table of Contents" },
          { key: "includeChapterSummaries" as const, label: "Chapter summaries" },
          { key: "includeCopyright" as const, label: "Copyright page" },
          { key: "includeDedication" as const, label: "Dedication page" },
          { key: "includeAboutAuthor" as const, label: "About the Author page" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-8 h-4 rounded-full transition-colors relative ${settings[key] ? "bg-accent/60" : "bg-border/30"}`}
              onClick={() => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-foreground transition-all ${settings[key] ? "left-4.5" : "left-0.5"}`} />
            </div>
            <span className="text-xs font-light text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          </label>
        ))}
      </div>

      {/* Optional fields */}
      {settings.includeDedication && (
        <textarea value={metadata.dedication} onChange={e => setMetadata(prev => ({ ...prev, dedication: e.target.value }))}
          placeholder="Dedication text…" rows={2}
          className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
      )}
      {settings.includeAboutAuthor && (
        <textarea value={metadata.aboutAuthor} onChange={e => setMetadata(prev => ({ ...prev, aboutAuthor: e.target.value }))}
          placeholder="About the Author…" rows={3}
          className="w-full bg-card/30 border border-border/20 rounded-xl px-4 py-3 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
      )}
    </div>
  );

  const renderProcessingStep = () => (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="relative">
        <Loader2 className="h-12 w-12 text-accent animate-spin" />
        <BookOpen className="h-5 w-5 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-light text-foreground">Aureon is writing your book…</p>
        <p className="text-xs font-light text-muted-foreground/60">{progress}</p>
      </div>
      <div className="w-64 h-1 bg-border/20 rounded-full overflow-hidden">
        <div className="h-full bg-accent/50 rounded-full animate-pulse" style={{ width: "60%" }} />
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Chapters", value: chapters.length },
          { label: "Words", value: totalChapterWords.toLocaleString() },
          { label: "Est. Pages", value: totalChapterPages },
          { label: "Reading Time", value: `${Math.ceil(totalChapterWords / 200)}m` },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/20 bg-card/20 p-3 text-center">
            <p className="text-lg font-extralight text-foreground">{s.value}</p>
            <p className="text-[9px] font-light tracking-[0.1em] text-muted-foreground/50 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chapter List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Chapters</p>
          <button onClick={addChapter} className="flex items-center gap-1 rounded-lg border border-border/20 px-2 py-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-2.5 w-2.5" /> Add Chapter
          </button>
        </div>
        {chapters.map((ch, i) => (
          <div key={ch.id} className="rounded-xl border border-border/20 bg-card/20 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setExpandedChapter(expandedChapter === ch.id ? null : ch.id)}>
              <GripVertical className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[9px] font-light text-accent/60 w-6">#{i + 1}</span>
              <span className="flex-1 text-xs font-light text-foreground truncate">{ch.title}</span>
              <span className="text-[9px] text-muted-foreground/40">{ch.content.split(/\s+/).filter(Boolean).length} words</span>
              <div className="flex items-center gap-1">
                <button onClick={e => { e.stopPropagation(); moveChapter(ch.id, "up"); }} className="text-muted-foreground/30 hover:text-foreground p-0.5"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={e => { e.stopPropagation(); moveChapter(ch.id, "down"); }} className="text-muted-foreground/30 hover:text-foreground p-0.5"><ChevronDown className="h-3 w-3" /></button>
                <button onClick={e => { e.stopPropagation(); removeChapter(ch.id); }} className="text-muted-foreground/30 hover:text-destructive p-0.5"><Trash2 className="h-3 w-3" /></button>
              </div>
              {expandedChapter === ch.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
            </div>
            {expandedChapter === ch.id && (
              <div className="border-t border-border/10 p-3 space-y-2">
                <input value={ch.title} onChange={e => updateChapter(ch.id, "title", e.target.value)}
                  className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground outline-none" placeholder="Chapter Title" />
                {ch.summary !== undefined && (
                  <textarea value={ch.summary || ""} onChange={e => updateChapter(ch.id, "summary", e.target.value)}
                    className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-[11px] font-light text-muted-foreground outline-none resize-none" rows={2} placeholder="Chapter Summary" />
                )}
                <textarea value={ch.content} onChange={e => updateChapter(ch.id, "content", e.target.value)}
                  className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground outline-none resize-none min-h-[200px]" placeholder="Chapter Content" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cover Preview */}
      <div>
        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Cover Preview</p>
        <div className="relative rounded-xl overflow-hidden border border-border/20 aspect-[3/4] max-w-[200px]">
          <img src={wallpaperSrc} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-center">
            <p className="text-sm font-light text-white/90 leading-tight">{metadata.title || "Untitled"}</p>
            {metadata.subtitle && <p className="text-[9px] font-light text-white/60 mt-1">{metadata.subtitle}</p>}
            {metadata.author && <p className="text-[8px] font-light text-white/50 mt-4 italic">{metadata.author}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  const steps: { id: EBookStep; label: string; icon: React.ElementType }[] = [
    { id: "upload", label: "Content", icon: Upload },
    { id: "settings", label: "Settings", icon: Settings2 },
    { id: "processing", label: "Generate", icon: Sparkles },
    { id: "preview", label: "Preview", icon: Eye },
  ];

  const canProceed = () => {
    if (step === "upload") return rawText.trim().length > 50 && metadata.title.trim().length > 0;
    if (step === "settings") return true;
    return false;
  };

  const handleNext = () => {
    if (step === "upload") setStep("settings");
    else if (step === "settings") {
      setStep("processing");
      structureBook();
    }
  };

  const handleBack = () => {
    if (step === "settings") setStep("upload");
    if (step === "preview") setStep("settings");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">E-Book Generator</h1>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">AI-Powered Book Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === "preview" && (
              <button onClick={exportPdf} disabled={chapters.length === 0 || exporting}
                className="flex items-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export PDF
              </button>
            )}
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${steps.findIndex(st => st.id === step) >= i ? "bg-accent/40" : "bg-border/20"}`} />}
              <button
                onClick={() => {
                  if (s.id === "upload" || s.id === "settings") setStep(s.id);
                  if (s.id === "preview" && chapters.length > 0) setStep(s.id);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition-colors ${
                  step === s.id ? "bg-accent/20 text-accent" : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}>
                <s.icon className="h-3 w-3" />
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          {step === "upload" && renderUploadStep()}
          {step === "settings" && renderSettingsStep()}
          {step === "processing" && renderProcessingStep()}
          {step === "preview" && renderPreviewStep()}
        </div>
      </div>

      {/* Footer Nav */}
      {step !== "processing" && (
        <div className="flex-shrink-0 border-t border-border/20 bg-card/20 backdrop-blur-sm px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <button onClick={handleBack} disabled={step === "upload"}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            {(step === "upload" || step === "settings") && (
              <button onClick={handleNext} disabled={!canProceed()}
                className="flex items-center gap-2 rounded-lg bg-accent/20 px-5 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">
                {step === "settings" ? (
                  <><Sparkles className="h-3.5 w-3.5" /> Generate Book</>
                ) : (
                  <><ArrowRight className="h-3.5 w-3.5" /> Next</>
                )}
              </button>
            )}
            {step === "preview" && (
              <button onClick={() => { setStep("settings"); }} className="flex items-center gap-2 rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Sparkles className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EBookGeneratorView;
