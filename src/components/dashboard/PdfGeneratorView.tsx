import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { FileText, Upload, Download, Sparkles, Image, Type, Loader2, Trash2, Plus } from "lucide-react";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_WALLPAPERS as WALLPAPERS } from "@/lib/wallpapers";
const wallpaperDefault = WALLPAPERS[0].src;

interface PdfSection {
  id: string;
  type: "heading" | "paragraph" | "diagram" | "table" | "list";
  content: string;
}

const PdfGeneratorView = () => {
  const { user } = useAuth();
  const [rawData, setRawData] = useState("");
  const [sections, setSections] = useState<PdfSection[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState("default");
  const [generating, setGenerating] = useState(false);
  const [aiStructuring, setAiStructuring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const wallpaperSrc = WALLPAPERS.find(w => w.key === selectedWallpaper)?.src || wallpaperDefault;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawData(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const structureWithAI = useCallback(async () => {
    if (!rawData.trim()) return;
    setAiStructuring(true);
    let result = "";
    try {
      await streamChat({
        messages: [{
          role: "user",
          content: `You are a strict copy-editor. Your ONLY job is to fix grammar, spelling, punctuation, and capitalization in the text below. You MUST NOT rewrite, paraphrase, summarize, restructure, or change the author's wording, voice, or meaning in any way. Preserve every sentence and paragraph break exactly as written — only correct mechanical errors.

Then split the corrected text into sections by its existing paragraph/heading breaks. Detect type per block:
- "heading": a short standalone line (under ~12 words) that titles content below it
- "list": consecutive lines starting with "-", "*", "•", or numbered bullets
- "table": markdown-style pipe tables
- "paragraph": everything else

Return ONLY a valid JSON array. Each element: { "type": "heading"|"paragraph"|"list"|"table", "content": "..." }. The "content" must be the grammar-corrected version of the original block, verbatim otherwise. No markdown wrapping, no commentary.

TEXT:
${rawData.slice(0, 12000)}`
        }],
        mode: "chat",
        onDelta: (chunk) => { result += chunk; },
        onDone: () => {
          try {
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as PdfSection[];
              setSections(parsed.map((s, i) => ({ ...s, id: `s-${i}-${Date.now()}` })));
            }
          } catch {
            setSections([{ id: `s-0-${Date.now()}`, type: "paragraph", content: result }]);
          }
          setAiStructuring(false);
        },
      });
    } catch {
      setAiStructuring(false);
    }
  }, [rawData]);

  const addSection = (type: PdfSection["type"]) => {
    setSections(prev => [...prev, { id: `s-${Date.now()}`, type, content: "" }]);
  };

  const updateSection = (id: string, content: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const exportPdf = useCallback(async () => {
    if (!previewRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#0a0a0a",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("aureon-document.pdf");
    } catch (e) {
      console.error("PDF export error:", e);
    }
    setGenerating(false);
  }, []);

  const renderSectionPreview = (section: PdfSection) => {
    const text = typeof section.content === "string" ? section.content : String(section.content ?? "");
    switch (section.type) {
      case "heading":
        return <h2 style={{ fontSize: 20, fontWeight: 300, letterSpacing: "0.05em", margin: "24px 0 12px", color: "#f0f0f0" }}>{text}</h2>;
      case "paragraph":
        return <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, marginBottom: 16, color: "#d0d0d0" }}>{text}</p>;
      case "diagram":
        return (
          <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, margin: "16px 0", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Architecture Diagram</div>
            <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, color: "#d0d0d0", whiteSpace: "pre-wrap" }}>{text}</p>
          </div>
        );
      case "table":
        return <div style={{ fontSize: 13, fontWeight: 300, color: "#d0d0d0", whiteSpace: "pre-wrap" }}>{text.replace(/\|/g, " │ ")}</div>;
      case "list":
        return (
          <ul style={{ paddingLeft: 20, margin: "12px 0" }}>
            {text.split("\n").filter(l => l.trim()).map((item, i) => (
              <li key={i} style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, color: "#d0d0d0" }}>{item.replace(/^[-•*]\s*/, "")}</li>
            ))}
          </ul>
        );
      default:
        return <p style={{ color: "#d0d0d0" }}>{text}</p>;
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
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">AI-Structured Document Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportPdf} disabled={sections.length === 0 || generating}
              className="flex items-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Input Panel */}
        <div className="w-full lg:w-1/2 border-r border-border/10 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Wallpaper Selector */}
          <div>
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">Background Theme</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
              {WALLPAPERS.map(wp => (
                <button key={wp.key} onClick={() => setSelectedWallpaper(wp.key)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all h-12 ${selectedWallpaper === wp.key ? "border-accent/50 ring-1 ring-accent/20" : "border-border/20 hover:border-border/40"}`}>
                  <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-[8px] font-light text-white/90">{wp.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Raw Data Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Raw Data</p>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-3 w-3" /> Upload File
                </button>
                <button onClick={structureWithAI} disabled={!rawData.trim() || aiStructuring}
                  className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-[10px] text-accent hover:bg-accent/25 transition-colors disabled:opacity-40">
                  {aiStructuring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Fix Grammar Only
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml" onChange={handleFileUpload} />
            <textarea value={rawData} onChange={e => setRawData(e.target.value)}
              placeholder="Paste or upload your text here… AI will only fix grammar, spelling and punctuation — your wording is preserved exactly."
              className="w-full h-40 bg-card/30 border border-border/20 rounded-xl p-3 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none" />
          </div>

          {/* Sections Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase">Document Sections</p>
              <div className="flex gap-1">
                {(["heading", "paragraph", "diagram", "list"] as const).map(type => (
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
                  <textarea value={section.content} onChange={e => updateSection(section.id, e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-light text-foreground outline-none resize-none min-h-[60px]"
                    placeholder={`Enter ${section.type} content…`} />
                </div>
              ))}
              {sections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground/30 text-xs font-light">
                  Paste data above and click "Structure with AI" or add sections manually
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div className="w-full lg:w-1/2 overflow-y-auto p-4">
          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-3">Live Preview</p>
          <div className="relative rounded-xl overflow-hidden border border-border/20 min-h-[500px]">
            <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${wallpaperSrc})` }} />
            <div className="absolute inset-0 bg-background/85" />
            <div ref={previewRef} className="relative z-10 p-8 sm:p-12">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground/20">
                  <Image className="h-10 w-10 mb-3" />
                  <p className="text-xs font-light">Document preview will appear here</p>
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
