import { useState, useRef } from "react";
import {
  Image, Search, Upload, MapPin, Eye, Camera, Film,
  ChevronRight, AlertTriangle, Check, Hash, Globe, Loader2, Trash2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaArtifact {
  id: string;
  type: "image" | "video" | "document";
  filename: string;
  fileSize: string;
  metadata: Record<string, string>;
  aiAnalysis?: string;
  locationClues: string[];
  candidateLocations: { name: string; confidence: number }[];
  addedAt: number;
}

interface NomadMediaForensicsProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string }[];
}

const STORAGE_KEY = "nomad_media_forensics";

function loadArtifacts(): MediaArtifact[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveArtifacts(a: MediaArtifact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_TO_LOCATION_STEPS = [
  { step: 1, label: "Extract Clues", desc: "Identify text, signs, vegetation, architecture, shadows, weather" },
  { step: 2, label: "Candidate Locations", desc: "Generate 3-5 possible locations based on clues" },
  { step: 3, label: "Compare Overlays", desc: "Cross-reference with satellite/street view imagery" },
  { step: 4, label: "Confidence Score", desc: "Rate match quality and document reasoning" },
  { step: 5, label: "Evidence Pack", desc: "Bundle all findings into exportable evidence" },
];

const NomadMediaForensics = ({ entities, investigations }: NomadMediaForensicsProps) => {
  const [artifacts, setArtifacts] = useState<MediaArtifact[]>(loadArtifacts);
  const [activeStep, setActiveStep] = useState(1);
  const [tab, setTab] = useState<"artifacts" | "location" | "clusters">("artifacts");
  const [clues, setClues] = useState("");
  const [candidates, setCandidates] = useState<{ name: string; confidence: number }[]>([]);
  const [newCandidate, setNewCandidate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real file upload with metadata extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const type = file.type.startsWith("image/") ? "image" as const
        : file.type.startsWith("video/") ? "video" as const
        : "document" as const;

      // Extract real metadata
      const metadata: Record<string, string> = {
        "File Name": file.name,
        "File Size": formatFileSize(file.size),
        "MIME Type": file.type,
        "Last Modified": new Date(file.lastModified).toISOString(),
      };

      // For images, extract dimensions
      if (type === "image") {
        try {
          const dims = await getImageDimensions(file);
          metadata["Resolution"] = `${dims.width}x${dims.height}`;
          metadata["Aspect Ratio"] = (dims.width / dims.height).toFixed(2);
        } catch { /* ignore */ }
      }

      const artifact: MediaArtifact = {
        id: crypto.randomUUID(),
        type,
        filename: file.name,
        fileSize: formatFileSize(file.size),
        metadata,
        locationClues: [],
        candidateLocations: [],
        addedAt: Date.now(),
      };

      const updated = [...artifacts, artifact];
      setArtifacts(updated);
      saveArtifacts(updated);

      // Auto-analyze with AI
      analyzeArtifact(artifact.id, file.name, metadata);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => { resolve({ width: img.width, height: img.height }); URL.revokeObjectURL(img.src); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const analyzeArtifact = async (artifactId: string, filename: string, metadata: Record<string, string>) => {
    setAnalyzing(artifactId);
    try {
      const metaStr = Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join("\n");
      const entityContext = entities.slice(0, 20).map(e => `${e.type}: ${e.value}`).join(", ");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `MEDIA FORENSIC ANALYSIS for file: "${filename}"

Metadata:
${metaStr}

Related investigation entities: ${entityContext || "None yet"}

Provide forensic analysis:
1. What can we infer from the filename pattern?
2. What does the file metadata reveal about origin?
3. Any timestamp anomalies or manipulation indicators?
4. Potential geolocation clues from filename/metadata
5. Suggested next steps for deeper analysis
6. Cross-reference potential with known investigation entities`,
              },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error("Analysis failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { break; }
        }
      }

      setArtifacts(prev => {
        const updated = prev.map(a => a.id === artifactId ? { ...a, aiAnalysis: fullContent } : a);
        saveArtifacts(updated);
        return updated;
      });
    } catch (e) {
      console.error("Analysis error:", e);
    } finally {
      setAnalyzing(null);
    }
  };

  const removeArtifact = (id: string) => {
    const updated = artifacts.filter(a => a.id !== id);
    setArtifacts(updated);
    saveArtifacts(updated);
  };

  const addCandidate = () => {
    if (!newCandidate.trim()) return;
    setCandidates(prev => [...prev, { name: newCandidate.trim(), confidence: 50 }]);
    setNewCandidate("");
  };

  const updateCandidateConfidence = (idx: number, confidence: number) => {
    setCandidates(prev => prev.map((c, i) => i === idx ? { ...c, confidence } : c));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20">
        {([
          { id: "artifacts" as const, label: "Media Artifacts" },
          { id: "location" as const, label: "Image → Location" },
          { id: "clusters" as const, label: "Similar Clusters" },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${tab === t.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "artifacts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Media Artifacts ({artifacts.length})</h3>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground disabled:opacity-30"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload File
                  </button>
                </div>
              </div>

              {artifacts.length === 0 && (
                <div className="text-center py-12">
                  <Image className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-[11px] text-muted-foreground/40 font-light">Upload media files for metadata extraction, AI forensic analysis, and geolocation.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-4 py-2 rounded-xl border border-border/25 text-[10px] text-accent hover:bg-foreground/[0.06] transition-colors"
                  >
                    <Upload className="h-3 w-3 inline mr-1.5" />
                    Upload Files
                  </button>
                </div>
              )}

              {artifacts.map(a => (
                <div key={a.id} className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {a.type === "image" ? <Camera className="h-4 w-4 text-foreground/50" /> : a.type === "video" ? <Film className="h-4 w-4 text-foreground/50" /> : <Hash className="h-4 w-4 text-foreground/50" />}
                    <span className="text-xs text-foreground/70 font-light flex-1 truncate">{a.filename}</span>
                    <span className="text-[9px] text-muted-foreground/30">{a.fileSize}</span>
                    <button onClick={() => removeArtifact(a.id)} className="text-muted-foreground/20 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Real Metadata */}
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Extracted Metadata</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(a.metadata).map(([k, v]) => (
                        <div key={k} className="text-[10px]">
                          <span className="text-muted-foreground/40">{k}: </span>
                          <span className="text-foreground/60 font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">AI Forensic Analysis</p>
                    {analyzing === a.id ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-3 w-3 animate-spin text-accent" />
                        <span className="text-[10px] text-accent animate-pulse">Analyzing…</span>
                      </div>
                    ) : a.aiAnalysis ? (
                      <div className="text-[10px] text-foreground/60 font-light whitespace-pre-wrap leading-relaxed">
                        {a.aiAnalysis}
                      </div>
                    ) : (
                      <button
                        onClick={() => analyzeArtifact(a.id, a.filename, a.metadata)}
                        className="text-[10px] text-foreground/50 hover:text-foreground"
                      >
                        Run AI analysis →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "location" && (
            <div className="space-y-4">
              <h3 className="text-sm font-light text-foreground">Image-to-Location Workflow</h3>
              <p className="text-[10px] text-muted-foreground/40 mb-4">Systematic geolocation: extract clues → candidate locations → compare overlays → confidence score → evidence pack.</p>

              <div className="flex items-center gap-1 mb-6">
                {IMAGE_TO_LOCATION_STEPS.map(s => (
                  <button key={s.step} onClick={() => setActiveStep(s.step)} className={`flex-1 text-center py-2 rounded-lg text-[9px] transition-colors ${activeStep === s.step ? "bg-foreground/[0.08] text-accent border border-border/25" : activeStep > s.step ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground/30 border border-border/15"}`}>
                    <span className="block font-mono text-[8px]">Step {s.step}</span>
                    <span className="block mt-0.5">{s.label}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border/20 bg-card/20 p-4">
                <h4 className="text-xs font-light text-foreground mb-1">{IMAGE_TO_LOCATION_STEPS[activeStep - 1].label}</h4>
                <p className="text-[10px] text-muted-foreground/40 mb-3">{IMAGE_TO_LOCATION_STEPS[activeStep - 1].desc}</p>

                {activeStep === 1 && (
                  <textarea
                    value={clues}
                    onChange={e => setClues(e.target.value)}
                    placeholder="List visual clues: text on signs, vegetation type, architecture style, shadow angles, weather conditions..."
                    rows={4}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 outline-none border border-border/20 rounded-lg p-2 resize-none"
                  />
                )}

                {activeStep === 2 && (
                  <div className="space-y-2">
                    {candidates.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-foreground/50" />
                        <span className="text-xs text-foreground/70 flex-1">{c.name}</span>
                        <input type="range" min={0} max={100} value={c.confidence} onChange={e => updateCandidateConfidence(i, Number(e.target.value))} className="w-20 h-1 accent-accent" />
                        <span className="text-[9px] text-muted-foreground/40 w-8">{c.confidence}%</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newCandidate} onChange={e => setNewCandidate(e.target.value)} onKeyDown={e => e.key === "Enter" && addCandidate()} placeholder="Add candidate location" className="flex-1 bg-transparent text-xs text-foreground outline-none border-b border-border/20 pb-1" />
                      <button onClick={addCandidate} className="text-[10px] text-accent">Add</button>
                    </div>
                  </div>
                )}

                {activeStep >= 3 && activeStep <= 5 && (
                  <p className="text-[10px] text-muted-foreground/30 italic">Complete previous steps to continue the workflow.</p>
                )}

                <div className="flex justify-between mt-4">
                  <button onClick={() => setActiveStep(Math.max(1, activeStep - 1))} disabled={activeStep === 1} className="text-[10px] text-muted-foreground/40 hover:text-foreground disabled:opacity-30">← Previous</button>
                  <button onClick={() => setActiveStep(Math.min(5, activeStep + 1))} disabled={activeStep === 5} className="text-[10px] text-accent hover:text-foreground/70 disabled:opacity-30">Next →</button>
                </div>
              </div>
            </div>
          )}

          {tab === "clusters" && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-[11px] text-muted-foreground/40 font-light">Upload multiple media files to auto-detect similar clusters based on visual features and metadata patterns.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadMediaForensics;
