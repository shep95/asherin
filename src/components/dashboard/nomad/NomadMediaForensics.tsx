import { useState } from "react";
import {
  Image, Search, Upload, MapPin, Eye, Camera, Film,
  ChevronRight, AlertTriangle, Check, Hash, Globe
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MediaArtifact {
  id: string;
  type: "image" | "video" | "document";
  filename: string;
  metadata: Record<string, string>;
  reverseSearchResults: { platform: string; url: string; confidence: number }[];
  locationClues: string[];
  candidateLocations: { name: string; confidence: number }[];
  compressionArtifacts: string[];
  addedAt: number;
}

const STORAGE_KEY = "nomad_media_forensics";

function loadArtifacts(): MediaArtifact[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveArtifacts(a: MediaArtifact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

const IMAGE_TO_LOCATION_STEPS = [
  { step: 1, label: "Extract Clues", desc: "Identify text, signs, vegetation, architecture, shadows, weather" },
  { step: 2, label: "Candidate Locations", desc: "Generate 3-5 possible locations based on clues" },
  { step: 3, label: "Compare Overlays", desc: "Cross-reference with satellite/street view imagery" },
  { step: 4, label: "Confidence Score", desc: "Rate match quality and document reasoning" },
  { step: 5, label: "Evidence Pack", desc: "Bundle all findings into exportable evidence" },
];

const NomadMediaForensics = () => {
  const [artifacts, setArtifacts] = useState<MediaArtifact[]>(loadArtifacts);
  const [activeStep, setActiveStep] = useState(1);
  const [tab, setTab] = useState<"artifacts" | "location" | "clusters">("artifacts");
  const [clues, setClues] = useState("");
  const [candidates, setCandidates] = useState<{ name: string; confidence: number }[]>([]);
  const [newCandidate, setNewCandidate] = useState("");

  const addDemoArtifact = () => {
    const artifact: MediaArtifact = {
      id: crypto.randomUUID(),
      type: "image",
      filename: `artifact_${Date.now()}.jpg`,
      metadata: {
        "Camera": "Unknown",
        "Resolution": "1920x1080",
        "EXIF GPS": "Not available",
        "Date Taken": new Date().toISOString(),
        "File Size": "2.4 MB",
        "Compression": "JPEG 85%",
      },
      reverseSearchResults: [],
      locationClues: [],
      candidateLocations: [],
      compressionArtifacts: [],
      addedAt: Date.now(),
    };
    const updated = [...artifacts, artifact];
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
                <button onClick={addDemoArtifact} className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent">
                  <Upload className="h-3 w-3" /> Add Artifact
                </button>
              </div>

              {artifacts.length === 0 && (
                <div className="text-center py-12">
                  <Image className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-[11px] text-muted-foreground/40 font-light">Upload media for reverse-search, metadata extraction, and forensic analysis.</p>
                </div>
              )}

              {artifacts.map(a => (
                <div key={a.id} className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {a.type === "image" ? <Camera className="h-4 w-4 text-accent/50" /> : <Film className="h-4 w-4 text-accent/50" />}
                    <span className="text-xs text-foreground/70 font-light">{a.filename}</span>
                    <span className="text-[9px] text-muted-foreground/30 ml-auto">{new Date(a.addedAt).toLocaleString()}</span>
                  </div>

                  {/* Metadata */}
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Metadata</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(a.metadata).map(([k, v]) => (
                        <div key={k} className="text-[10px]">
                          <span className="text-muted-foreground/40">{k}: </span>
                          <span className="text-foreground/60 font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reverse Search placeholder */}
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Reverse Search</p>
                    {a.reverseSearchResults.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/30 italic">No results yet. Run reverse image search.</p>
                    ) : (
                      a.reverseSearchResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <Globe className="h-2.5 w-2.5 text-muted-foreground/30" />
                          <span className="text-foreground/60">{r.platform}</span>
                          <span className="text-muted-foreground/30">{r.confidence}%</span>
                        </div>
                      ))
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

              {/* Stepper */}
              <div className="flex items-center gap-1 mb-6">
                {IMAGE_TO_LOCATION_STEPS.map(s => (
                  <button key={s.step} onClick={() => setActiveStep(s.step)} className={`flex-1 text-center py-2 rounded-lg text-[9px] transition-colors ${activeStep === s.step ? "bg-accent/15 text-accent border border-accent/20" : activeStep > s.step ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground/30 border border-border/15"}`}>
                    <span className="block font-mono text-[8px]">Step {s.step}</span>
                    <span className="block mt-0.5">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Step Content */}
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
                        <MapPin className="h-3 w-3 text-accent/50" />
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
                  <button onClick={() => setActiveStep(Math.min(5, activeStep + 1))} disabled={activeStep === 5} className="text-[10px] text-accent hover:text-accent/80 disabled:opacity-30">Next →</button>
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
