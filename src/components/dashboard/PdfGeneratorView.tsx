import { useState, useRef, useCallback } from "react";
import { FileText, Upload, Download, Sparkles, Image, Type, Loader2, Trash2, Plus } from "lucide-react";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";
import wallpaperDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";

const WALLPAPERS = [
  { key: "default", label: "Original", src: wallpaperDefault },
  { key: "raven", label: "Raven", src: wallpaperRaven },
  { key: "eclipse", label: "Eclipse", src: wallpaperEclipse },
  { key: "glitch", label: "Glitch", src: wallpaperGlitch },
];

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
          content: `You are a document architect. Take this raw data and structure it into a professional PDF document. Return ONLY a valid JSON array of sections. Each section has: type ("heading" | "paragraph" | "diagram" | "table" | "list"), content (string - for diagram type, describe the architecture in text that could be visualized; for table use markdown table format; for list use bullet points with "- " prefix).

Raw data:
${rawData.slice(0, 8000)}

Return ONLY the JSON array, no markdown wrapping.`
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
      // Use browser print for PDF generation
      const printWindow = window.open("", "_blank");
      if (!printWindow) { setGenerating(false); return; }
      
      const content = previewRef.current.innerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Aureon Document</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #e5e5e5; }
            .page { position: relative; min-height: 100vh; padding: 60px; overflow: hidden; }
            .bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.15; z-index: 0; }
            .overlay { position: absolute; inset: 0; background: rgba(10,10,10,0.85); z-index: 1; }
            .content { position: relative; z-index: 2; }
            h1 { font-size: 28px; font-weight: 200; letter-spacing: 0.1em; margin-bottom: 24px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
            h2 { font-size: 20px; font-weight: 300; letter-spacing: 0.05em; margin: 24px 0 12px; color: #f0f0f0; }
            p { font-size: 13px; font-weight: 300; line-height: 1.8; margin-bottom: 16px; color: #d0d0d0; }
            .diagram { border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 16px 0; background: rgba(255,255,255,0.03); }
            .diagram-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.4); margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
            th, td { padding: 10px 14px; border: 1px solid rgba(255,255,255,0.1); text-align: left; }
            th { background: rgba(255,255,255,0.05); font-weight: 400; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; }
            ul { padding-left: 20px; margin: 12px 0; }
            li { font-size: 13px; font-weight: 300; line-height: 1.8; color: #d0d0d0; margin-bottom: 4px; }
            .footer { position: fixed; bottom: 30px; right: 40px; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="bg" style="background-image: url(${wallpaperSrc})"></div>
            <div class="overlay"></div>
            <div class="content">${content}</div>
            <div class="footer">Generated by AUREON</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); setGenerating(false); }, 500);
    } catch {
      setGenerating(false);
    }
  }, [wallpaperSrc]);

  const renderSectionPreview = (section: PdfSection) => {
    switch (section.type) {
      case "heading":
        return <h2 style={{ fontSize: 20, fontWeight: 300, letterSpacing: "0.05em", margin: "24px 0 12px", color: "#f0f0f0" }}>{section.content}</h2>;
      case "paragraph":
        return <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, marginBottom: 16, color: "#d0d0d0" }}>{section.content}</p>;
      case "diagram":
        return (
          <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, margin: "16px 0", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Architecture Diagram</div>
            <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, color: "#d0d0d0", whiteSpace: "pre-wrap" }}>{section.content}</p>
          </div>
        );
      case "table":
        return <div style={{ fontSize: 13, fontWeight: 300, color: "#d0d0d0", whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: section.content.replace(/\|/g, " │ ") }} />;
      case "list":
        return (
          <ul style={{ paddingLeft: 20, margin: "12px 0" }}>
            {section.content.split("\n").filter(l => l.trim()).map((item, i) => (
              <li key={i} style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.8, color: "#d0d0d0" }}>{item.replace(/^[-•*]\s*/, "")}</li>
            ))}
          </ul>
        );
      default:
        return <p style={{ color: "#d0d0d0" }}>{section.content}</p>;
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
            <div className="flex gap-2">
              {WALLPAPERS.map(wp => (
                <button key={wp.key} onClick={() => setSelectedWallpaper(wp.key)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all w-16 h-10 ${selectedWallpaper === wp.key ? "border-accent/50 ring-1 ring-accent/20" : "border-border/20 hover:border-border/40"}`}>
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
                  Structure with AI
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml" onChange={handleFileUpload} />
            <textarea value={rawData} onChange={e => setRawData(e.target.value)}
              placeholder="Paste or upload your raw data here… The AI will structure it into a professional PDF document."
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
