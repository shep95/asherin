import { useState, useRef, useCallback } from "react";
import {
  Upload, X, Crosshair, Shield, Cpu, Search, Database, Code2, Globe, Lock,
  AlertTriangle, CheckCircle, ChevronRight, Copy, Download, MessageSquare,
  Send, Loader2, Sparkles, FileText, ArrowLeft, BarChart3, Workflow,
  Eye, HardDrive, Wrench, RefreshCw, Info, Video, Film, Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

interface TechStackItem { category: string; technology: string; confidence: number; evidence: string; }
interface TableColumn { name: string; type: string; constraints: string; }
interface DBTable { name: string; columns: TableColumn[]; relationships: string[]; }
interface APIEndpoint { method: string; path: string; description: string; auth_required: boolean; params: { name: string; type: string; required: boolean }[]; response_shape: string; confidence: number; }
interface Feature { name: string; description: string; complexity: string; confidence: number; }
interface WorkflowDiagram { name: string; description: string; mermaid_diagram: string; }
interface SecurityFinding { severity: string; title: string; description: string; remediation: string; cve_reference: string | null; }
interface HardwareComponent { name: string; type: string; manufacturer: string; confidence: number; }
interface RebuildStep { phase: string; description: string; duration_hours: number; }
interface FrameAnalysis { frame_index: number; timestamp_seconds: number; description: string; state_changes: string; key_observations: string[]; }

interface AnalysisResult {
  executive_summary: {
    overall_confidence: number; total_features: number; total_tables: number;
    total_endpoints: number; total_security_issues: number; analysis_depth: string;
    analysis_type: string; media_type?: string; frames_analyzed?: number | null;
  };
  tech_stack: TechStackItem[];
  architecture: { pattern: string; confidence: number; description: string; mermaid_diagram: string; };
  database_schema: { confidence: number; tables: DBTable[]; sql_schema: string; erd_mermaid: string; };
  api_endpoints: APIEndpoint[];
  features: Feature[];
  workflows: WorkflowDiagram[];
  security_findings: SecurityFinding[];
  hardware_analysis: { components: HardwareComponent[]; protocols: string[]; power_specs: string; connections_mermaid: string; };
  rebuild_guide: { estimated_hours: number; team_size: number; steps: RebuildStep[]; recommended_stack: string; };
  frame_analysis?: FrameAnalysis[];
}

interface QAMessage { id: string; role: "user" | "assistant"; content: string; }
interface ExtractedFrame { base64: string; mimeType: string; timestamp: number; preview: string; }

type AnalysisType = "competitor" | "hardware" | "security";
type DepthMode = "standard" | "deep";
type Stage = "upload" | "processing" | "report";
type FocusArea = "architecture" | "database" | "security" | "workflows" | "api" | "hardware";
type MediaType = "image" | "video";

const FOCUS_OPTIONS: { id: FocusArea; label: string; icon: React.ElementType }[] = [
  { id: "architecture", label: "Architecture", icon: Globe },
  { id: "database", label: "Database", icon: Database },
  { id: "security", label: "Security", icon: Shield },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "api", label: "API Endpoints", icon: Code2 },
  { id: "hardware", label: "Hardware", icon: HardDrive },
];

const PROCESSING_STEPS = [
  "Extracting visual features…",
  "Running UI/UX framework detection…",
  "Analyzing architecture patterns…",
  "Reconstructing database schema…",
  "Mapping API endpoints…",
  "Scanning for security vulnerabilities…",
  "Building workflow diagrams…",
  "Cross-validating findings…",
  "Generating rebuild guide…",
  "Compiling final report…",
];

const VIDEO_PROCESSING_STEPS = [
  "Extracting video frames…",
  "Analyzing frame-by-frame transitions…",
  "Running UI/UX framework detection…",
  "Tracking state changes across timeline…",
  "Reconstructing navigation flows…",
  "Mapping API endpoints from interactions…",
  "Detecting data mutations…",
  "Scanning for security vulnerabilities…",
  "Building temporal workflow diagrams…",
  "Cross-validating across all frames…",
  "Generating rebuild guide…",
  "Compiling final report…",
];

const SEVERITY_COLORS: Record<string, string> = { critical: "text-red-500", high: "text-orange-500", medium: "text-yellow-500", low: "text-blue-400", info: "text-muted-foreground" };
const SEVERITY_BG: Record<string, string> = { critical: "bg-red-500/10 border-red-500/30", high: "bg-orange-500/10 border-orange-500/30", medium: "bg-yellow-500/10 border-yellow-500/30", low: "bg-blue-400/10 border-blue-400/30", info: "bg-muted/30 border-border/20" };
const METHOD_COLORS: Record<string, string> = { GET: "text-emerald-400", POST: "text-blue-400", PUT: "text-yellow-400", DELETE: "text-red-400", PATCH: "text-purple-400" };

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? "text-emerald-400" : value >= 70 ? "text-yellow-400" : "text-orange-400";
  return <span className={`text-[10px] font-mono ${color}`}>{value}%</span>;
}

function copyToClipboard(text: string) { navigator.clipboard.writeText(text); }

/** Extract N frames from a video file using canvas */
async function extractFramesFromVideo(file: File, maxFrames = 15): Promise<{ frames: ExtractedFrame[]; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || duration < 0.5) { reject(new Error("Video too short")); return; }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Cap resolution to limit payload size
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const frameCount = Math.min(maxFrames, Math.max(4, Math.floor(duration)));
      const interval = duration / (frameCount + 1);
      const frames: ExtractedFrame[] = [];

      const seekToTime = (t: number): Promise<void> => {
        return new Promise((res) => {
          video.currentTime = Math.min(t, duration - 0.1);
          video.onseeked = () => res();
        });
      };

      try {
        for (let i = 1; i <= frameCount; i++) {
          const timestamp = interval * i;
          await seekToTime(timestamp);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          const base64 = dataUrl.split(",")[1];
          frames.push({ base64, mimeType: "image/jpeg", timestamp, preview: dataUrl });
        }
        URL.revokeObjectURL(url);
        resolve({ frames, duration });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load video")); };
  });
}

// ── Main Component ─────────────────────────────────────────────────────────

const ReverseEngineerView = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload stage
  const [stage, setStage] = useState<Stage>("upload");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mimeType: string; name: string; preview: string } | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<{ name: string; size: number; preview: string } | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [extractingFrames, setExtractingFrames] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("competitor");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [depthMode, setDepthMode] = useState<DepthMode>("standard");
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(["architecture", "database", "security", "workflows"]);

  // Processing stage
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Report stage
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  // Q&A
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);

  // ── File Upload ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];
    const videoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"];

    if (imageTypes.includes(file.type)) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 20MB per image.", variant: "destructive" });
        return;
      }
      setMediaType("image");
      setUploadedVideo(null);
      setExtractedFrames([]);
      const reader = new FileReader();
      reader.onload = () => {
        const base64Full = reader.result as string;
        const base64 = base64Full.split(",")[1];
        setUploadedImage({ base64, mimeType: file.type, name: file.name, preview: base64Full });
      };
      reader.readAsDataURL(file);
    } else if (videoTypes.includes(file.type)) {
      if (file.size > 100 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 100MB per video.", variant: "destructive" });
        return;
      }
      setMediaType("video");
      setUploadedImage(null);
      setExtractingFrames(true);

      const videoPreview = URL.createObjectURL(file);
      setUploadedVideo({ name: file.name, size: file.size, preview: videoPreview });

      try {
        const { frames, duration } = await extractFramesFromVideo(file, 15);
        setExtractedFrames(frames);
        setVideoDuration(duration);
        toast({ title: "Frames extracted", description: `${frames.length} frames from ${duration.toFixed(1)}s video` });
      } catch (err: any) {
        toast({ title: "Frame extraction failed", description: err.message, variant: "destructive" });
        setUploadedVideo(null);
      } finally {
        setExtractingFrames(false);
      }
    } else {
      toast({ title: "Unsupported file type", description: "Upload an image (PNG, JPEG, WebP) or video (MP4, WebM, MOV).", variant: "destructive" });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  }, [handleFileSelect]);

  const toggleFocus = (area: FocusArea) => {
    setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const clearMedia = () => {
    setUploadedImage(null);
    setUploadedVideo(null);
    setExtractedFrames([]);
    setVideoDuration(0);
  };

  const hasMedia = !!uploadedImage || (!!uploadedVideo && extractedFrames.length > 0);

  // ── Start Analysis ──
  const startAnalysis = async () => {
    if (!hasMedia) return;

    const steps = mediaType === "video" ? VIDEO_PROCESSING_STEPS : PROCESSING_STEPS;
    setStage("processing");
    setProcessingStep(0);
    setProcessingProgress(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => prev < steps.length - 1 ? prev + 1 : prev);
      setProcessingProgress(prev => Math.min(prev + Math.random() * 10, 92));
    }, 2800);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const payload: any = {
        mediaType,
        analysisType,
        company: company || undefined,
        notes: notes || undefined,
        depthMode,
        focusAreas,
      };

      if (mediaType === "image" && uploadedImage) {
        payload.imageBase64 = uploadedImage.base64;
        payload.imageMimeType = uploadedImage.mimeType;
      } else if (mediaType === "video" && extractedFrames.length > 0) {
        payload.frames = extractedFrames.map(f => ({ base64: f.base64, mimeType: f.mimeType, timestamp: f.timestamp }));
        payload.videoDuration = videoDuration;
        payload.frameCount = extractedFrames.length;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reis-analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(payload),
        }
      );

      clearInterval(stepInterval);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error || "Analysis failed");
      }

      const data = await resp.json();
      setProcessingProgress(100);
      setProcessingStep(steps.length - 1);
      await new Promise(r => setTimeout(r, 600));

      setAnalysis(data.analysis);
      setStage("report");
      toast({ title: "Analysis Complete", description: `${data.analysis.executive_summary?.overall_confidence || 0}% overall confidence` });
    } catch (err: any) {
      clearInterval(stepInterval);
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
      setStage("upload");
    }
  };

  // ── Q&A ──
  const sendQuestion = async () => {
    if (!qaInput.trim() || !analysis || qaLoading) return;
    const userMsg: QAMessage = { id: crypto.randomUUID(), role: "user", content: qaInput.trim() };
    setQaMessages(prev => [...prev, userMsg]);
    setQaInput("");
    setQaLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reis-analyze`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ question: userMsg.content, previousAnalysis: JSON.stringify(analysis) }) }
      );
      if (!resp.ok) throw new Error("Q&A failed");
      const data = await resp.json();
      setQaMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.answer || "No response." }]);
    } catch {
      setQaMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Error processing question. Please try again." }]);
    } finally { setQaLoading(false); }
  };

  const resetAnalysis = () => {
    setStage("upload"); clearMedia(); setAnalysis(null); setQaMessages([]); setCompany(""); setNotes("");
    setProcessingStep(0); setProcessingProgress(0);
  };

  const exportReport = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reis-analysis-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported" });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: UPLOAD STAGE
  // ═══════════════════════════════════════════════════════════════════════════

  if (stage === "upload") {
    return (
      <ScrollArea className="flex-1 h-full">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Reverse Engineering Intelligence</h1>
            </div>
            <p className="text-xs font-extralight text-muted-foreground">
              Upload a screenshot or screen recording — Aureon analyzes every frame to deconstruct the entire architecture with 89-98% confidence.
            </p>
          </div>

          {/* Step 1: Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-accent tracking-widest">STEP 1</span>
              <span className="text-xs font-light text-foreground">UPLOAD IMAGE OR VIDEO</span>
            </div>

            {/* Media preview */}
            {uploadedImage ? (
              <div className="relative rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
                <img src={uploadedImage.preview} alt="Uploaded" className="w-full max-h-64 object-contain bg-black/30" />
                <button onClick={clearMedia} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-foreground/80 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
                <div className="p-3 border-t border-border/10 flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-light text-muted-foreground truncate">{uploadedImage.name}</p>
                </div>
              </div>
            ) : uploadedVideo ? (
              <div className="relative rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
                {extractingFrames ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-10">
                    <Loader2 className="h-8 w-8 text-accent animate-spin" />
                    <p className="text-xs font-light text-muted-foreground">Extracting frames from video…</p>
                  </div>
                ) : (
                  <>
                    {/* Frame strip preview */}
                    <div className="flex overflow-x-auto gap-1 p-2 bg-black/40">
                      {extractedFrames.map((frame, i) => (
                        <div key={i} className="relative shrink-0">
                          <img src={frame.preview} alt={`Frame ${i + 1}`} className="h-20 w-auto rounded object-cover" />
                          <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono bg-black/70 text-foreground/80 px-1 rounded">
                            {frame.timestamp.toFixed(1)}s
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={clearMedia} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-foreground/80 hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                    <div className="p-3 border-t border-border/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video className="h-3 w-3 text-accent" />
                        <p className="text-xs font-light text-muted-foreground truncate">{uploadedVideo.name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1"><Film className="h-3 w-3" />{extractedFrames.length} frames</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{videoDuration.toFixed(1)}s</span>
                        <span>{(uploadedVideo.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/30 bg-card/10 backdrop-blur-sm p-10 cursor-pointer hover:border-accent/40 hover:bg-card/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <Video className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-light text-foreground/70">Drag & Drop Image or Video</p>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPEG, WebP · MP4, WebM, MOV · Images max 20MB · Videos max 100MB</p>
                  <p className="text-[10px] text-accent/60 mt-1">Videos are analyzed frame-by-frame by Aureon AI</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Step 2: Context */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-accent tracking-widest">STEP 2</span>
              <span className="text-xs font-light text-foreground">CONTEXT (Optional)</span>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-light text-muted-foreground">What are you analyzing?</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: "competitor" as AnalysisType, label: "Competitor Software", icon: Search },
                  { id: "hardware" as AnalysisType, label: "Hardware System", icon: Cpu },
                  { id: "security" as AnalysisType, label: "Security Audit", icon: Shield },
                ]).map((opt) => (
                  <button key={opt.id} onClick={() => setAnalysisType(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light border transition-all ${
                      analysisType === opt.id ? "border-accent/50 bg-accent/10 text-accent" : "border-border/20 bg-card/10 text-muted-foreground hover:border-border/40"
                    }`}>
                    <opt.icon className="h-3 w-3" />{opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-light text-muted-foreground block mb-1">Company / Product</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Slack, Stripe"
                  className="w-full bg-card/20 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40" />
              </div>
              <div>
                <label className="text-[10px] font-light text-muted-foreground block mb-1">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context…"
                  className="w-full bg-card/20 border border-border/20 rounded-lg px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40" />
              </div>
            </div>
          </div>

          {/* Step 3: Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-accent tracking-widest">STEP 3</span>
              <span className="text-xs font-light text-foreground">SETTINGS</span>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-light text-muted-foreground">Analysis Depth</p>
              <div className="flex gap-2">
                <button onClick={() => setDepthMode("standard")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light border transition-all ${
                    depthMode === "standard" ? "border-accent/50 bg-accent/10 text-accent" : "border-border/20 bg-card/10 text-muted-foreground hover:border-border/40"
                  }`}>Standard</button>
                <button onClick={() => setDepthMode("deep")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light border transition-all ${
                    depthMode === "deep" ? "border-accent/50 bg-accent/10 text-accent" : "border-border/20 bg-card/10 text-muted-foreground hover:border-border/40"
                  }`}>
                  <Sparkles className="h-3 w-3" />Deep
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-light text-muted-foreground">Focus Areas</p>
              <div className="flex gap-2 flex-wrap">
                {FOCUS_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => toggleFocus(opt.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-light border transition-all ${
                      focusAreas.includes(opt.id) ? "border-accent/50 bg-accent/10 text-accent" : "border-border/20 bg-card/10 text-muted-foreground hover:border-border/40"
                    }`}>
                    <opt.icon className="h-3 w-3" />{opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={startAnalysis} disabled={!hasMedia || extractingFrames}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-light tracking-wide hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              {mediaType === "video" ? "Analyze Video" : "Start Analysis"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PROCESSING STAGE
  // ═══════════════════════════════════════════════════════════════════════════

  if (stage === "processing") {
    const steps = mediaType === "video" ? VIDEO_PROCESSING_STEPS : PROCESSING_STEPS;
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-accent animate-spin" />
            <h2 className="text-sm font-extralight tracking-wide text-foreground">
              {mediaType === "video" ? `Analyzing ${extractedFrames.length} frames…` : "Analyzing…"}
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{steps[processingStep]}</span>
              <span>{Math.round(processingProgress)}%</span>
            </div>
            <Progress value={processingProgress} className="h-1.5" />
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i < processingStep ? <CheckCircle className="h-3 w-3 text-emerald-500" /> :
                  i === processingStep ? <Loader2 className="h-3 w-3 text-accent animate-spin" /> :
                  <div className="h-3 w-3 rounded-full border border-border/30" />}
                <span className={`text-[10px] font-light ${i <= processingStep ? "text-foreground" : "text-muted-foreground/40"}`}>{step}</span>
              </div>
            ))}
          </div>

          {/* Preview: show frame strip for video, image for images */}
          {mediaType === "video" && extractedFrames.length > 0 ? (
            <div className="flex overflow-x-auto gap-1 rounded-lg border border-border/10 p-1 bg-black/20">
              {extractedFrames.slice(0, 6).map((f, i) => (
                <img key={i} src={f.preview} alt={`Frame ${i}`} className="h-12 w-auto rounded object-cover shrink-0" />
              ))}
              {extractedFrames.length > 6 && (
                <div className="h-12 w-12 rounded bg-card/20 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                  +{extractedFrames.length - 6}
                </div>
              )}
            </div>
          ) : uploadedImage ? (
            <div className="rounded-lg border border-border/10 overflow-hidden">
              <img src={uploadedImage.preview} alt="Analyzing" className="w-full max-h-32 object-contain bg-black/20" />
            </div>
          ) : null}

          <button onClick={resetAnalysis} className="w-full py-2 rounded-lg border border-border/20 text-xs font-light text-muted-foreground hover:text-foreground hover:border-border/40 transition-all">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: REPORT STAGE
  // ═══════════════════════════════════════════════════════════════════════════

  if (!analysis) return null;

  const summary = analysis.executive_summary || {} as AnalysisResult["executive_summary"];
  const criticalFindings = (analysis.security_findings || []).filter(f => f.severity === "critical").length;
  const highFindings = (analysis.security_findings || []).filter(f => f.severity === "high").length;
  const mediumFindings = (analysis.security_findings || []).filter(f => f.severity === "medium").length;
  const hasFrameAnalysis = (analysis.frame_analysis || []).length > 0;

  // Build tab list dynamically
  const tabList = [
    { id: "summary", label: "Summary", icon: BarChart3 },
    ...(hasFrameAnalysis ? [{ id: "frames", label: `Frames (${analysis.frame_analysis!.length})`, icon: Film }] : []),
    { id: "architecture", label: "Architecture", icon: Globe },
    { id: "database", label: "Database", icon: Database },
    { id: "api", label: "API", icon: Code2 },
    { id: "security", label: "Security", icon: Shield },
    { id: "workflows", label: "Workflows", icon: Workflow },
    { id: "rebuild", label: "Rebuild", icon: Wrench },
    { id: "qa", label: "Q&A", icon: MessageSquare },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Report Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 bg-card/5 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={resetAnalysis} className="p-1.5 rounded-lg hover:bg-card/30 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Eye className="h-4 w-4 text-accent" />
          <span className="text-sm font-extralight tracking-wide text-foreground">Analysis Report</span>
          {summary.media_type === "video" && <Video className="h-3.5 w-3.5 text-accent/60" />}
          <span className="text-[10px] font-mono text-accent">{summary.overall_confidence || 0}% confidence</span>
          {summary.frames_analyzed && <span className="text-[10px] font-mono text-muted-foreground">{summary.frames_analyzed} frames</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light border border-border/20 bg-card/10 text-muted-foreground hover:text-foreground hover:border-border/40 transition-all">
            <Download className="h-3 w-3" />Export
          </button>
          <button onClick={resetAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light border border-border/20 bg-card/10 text-muted-foreground hover:text-foreground hover:border-border/40 transition-all">
            <RefreshCw className="h-3 w-3" />New Analysis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 bg-card/10 border border-border/10 rounded-xl p-0.5 h-auto flex-wrap justify-start shrink-0">
          {tabList.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}
              className="flex items-center gap-1.5 text-[10px] font-light px-3 py-1.5 data-[state=active]:bg-accent/10 data-[state=active]:text-accent rounded-lg">
              <tab.icon className="h-3 w-3" />{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-4">
          {/* ── Summary Tab ── */}
          <TabsContent value="summary" className="mt-0 space-y-4">
            <div className="rounded-xl border border-border/20 bg-card/10 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-foreground">Overall Confidence</span>
                <span className="text-sm font-mono text-accent">{summary.overall_confidence || 0}%</span>
              </div>
              <Progress value={summary.overall_confidence || 0} className="h-2" />
              {summary.media_type === "video" && (
                <p className="text-[10px] text-accent/70 flex items-center gap-1"><Video className="h-3 w-3" />Video analysis · {summary.frames_analyzed || 0} frames analyzed frame-by-frame</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Features", value: summary.total_features || 0, icon: Sparkles },
                { label: "Tables", value: summary.total_tables || 0, icon: Database },
                { label: "Endpoints", value: summary.total_endpoints || 0, icon: Code2 },
                { label: "Security Issues", value: summary.total_security_issues || 0, icon: AlertTriangle },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/20 bg-card/10 p-3 space-y-1">
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-lg font-extralight text-foreground">{stat.value}</p>
                  <p className="text-[10px] font-light text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
              <h3 className="text-xs font-light text-foreground tracking-wide">Tech Stack</h3>
              <div className="space-y-2">
                {(analysis.tech_stack || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-16">{item.category}</span>
                      <span className="text-xs font-light text-foreground">{item.technology}</span>
                    </div>
                    <ConfidenceBadge value={item.confidence} />
                  </div>
                ))}
              </div>
            </div>

            {(analysis.security_findings || []).length > 0 && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                <h3 className="text-xs font-light text-foreground tracking-wide">Security Overview</h3>
                <div className="flex gap-4 text-[10px] font-light">
                  {criticalFindings > 0 && <span className="text-red-500">🔴 {criticalFindings} Critical</span>}
                  {highFindings > 0 && <span className="text-orange-500">🟠 {highFindings} High</span>}
                  {mediumFindings > 0 && <span className="text-yellow-500">🟡 {mediumFindings} Medium</span>}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
              <h3 className="text-xs font-light text-foreground tracking-wide">Detected Features</h3>
              <div className="space-y-2">
                {(analysis.features || []).map((feat, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/10 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-light text-foreground">{feat.name}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{feat.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                        feat.complexity === "high" ? "border-red-500/30 text-red-400" :
                        feat.complexity === "medium" ? "border-yellow-500/30 text-yellow-400" :
                        "border-emerald-500/30 text-emerald-400"
                      }`}>{feat.complexity}</span>
                      <ConfidenceBadge value={feat.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Frame Analysis Tab (Video only) ── */}
          <TabsContent value="frames" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">Frame-by-Frame Analysis</h3>
              <span className="text-[10px] font-mono text-muted-foreground">{(analysis.frame_analysis || []).length} frames</span>
            </div>

            {(analysis.frame_analysis || []).map((frame, i) => (
              <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center text-[10px] font-mono text-accent">
                      {frame.frame_index + 1}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{frame.timestamp_seconds.toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Show extracted frame preview if available */}
                {extractedFrames[frame.frame_index] && (
                  <img src={extractedFrames[frame.frame_index].preview} alt={`Frame ${frame.frame_index + 1}`}
                    className="w-full max-h-48 object-contain rounded-lg bg-black/20 border border-border/10" />
                )}

                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground mb-0.5">DESCRIPTION</p>
                    <p className="text-xs font-light text-foreground leading-relaxed">{frame.description}</p>
                  </div>
                  {frame.state_changes && (
                    <div>
                      <p className="text-[10px] font-mono text-yellow-400/80 mb-0.5">STATE CHANGES</p>
                      <p className="text-xs font-light text-foreground/80 leading-relaxed">{frame.state_changes}</p>
                    </div>
                  )}
                  {frame.key_observations?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono text-accent/80 mb-0.5">KEY OBSERVATIONS</p>
                      <ul className="space-y-0.5">
                        {frame.key_observations.map((obs, j) => (
                          <li key={j} className="text-[10px] font-light text-muted-foreground flex items-start gap-1.5">
                            <Crosshair className="h-2.5 w-2.5 mt-0.5 text-accent/50 shrink-0" />
                            {obs}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(analysis.frame_analysis || []).length === 0 && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-6 text-center">
                <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs font-light text-muted-foreground">No frame-by-frame analysis available. Upload a video for temporal analysis.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Architecture Tab ── */}
          <TabsContent value="architecture" className="mt-0 space-y-4">
            <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-light text-foreground tracking-wide">Architecture Pattern</h3>
                <ConfidenceBadge value={analysis.architecture?.confidence || 0} />
              </div>
              <p className="text-sm font-mono text-accent">{analysis.architecture?.pattern || "Unknown"}</p>
              <p className="text-xs font-light text-muted-foreground leading-relaxed">{analysis.architecture?.description}</p>
            </div>
            {analysis.architecture?.mermaid_diagram && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-light text-foreground tracking-wide">Architecture Diagram</h3>
                  <button onClick={() => { copyToClipboard(analysis.architecture.mermaid_diagram); toast({ title: "Copied" }); }}
                    className="p-1 rounded hover:bg-card/30 text-muted-foreground"><Copy className="h-3 w-3" /></button>
                </div>
                <pre className="text-[10px] font-mono text-muted-foreground bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                  {analysis.architecture.mermaid_diagram}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* ── Database Tab ── */}
          <TabsContent value="database" className="mt-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-light text-foreground tracking-wide">Database Schema</h3>
              </div>
              <ConfidenceBadge value={analysis.database_schema?.confidence || 0} />
            </div>
            {(analysis.database_schema?.tables || []).map((table, i) => (
              <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                <h4 className="text-xs font-mono text-accent">{table.name}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="border-b border-border/20">
                      <th className="text-left py-1 font-light text-muted-foreground">Column</th>
                      <th className="text-left py-1 font-light text-muted-foreground">Type</th>
                      <th className="text-left py-1 font-light text-muted-foreground">Constraints</th>
                    </tr></thead>
                    <tbody>
                      {table.columns.map((col, j) => (
                        <tr key={j} className="border-b border-border/5">
                          <td className="py-1 font-mono text-foreground">{col.name}</td>
                          <td className="py-1 font-mono text-muted-foreground">{col.type}</td>
                          <td className="py-1 text-muted-foreground">{col.constraints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.relationships.length > 0 && (
                  <div className="text-[9px] text-muted-foreground/60 space-y-0.5">
                    {table.relationships.map((rel, j) => <p key={j}>→ {rel}</p>)}
                  </div>
                )}
              </div>
            ))}
            {analysis.database_schema?.sql_schema && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-light text-foreground">Reconstructed SQL</h4>
                  <button onClick={() => { copyToClipboard(analysis.database_schema.sql_schema); toast({ title: "SQL copied" }); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors">
                    <Copy className="h-3 w-3" />Copy SQL
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-emerald-400/80 bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
                  {analysis.database_schema.sql_schema}
                </pre>
              </div>
            )}
            {analysis.database_schema?.erd_mermaid && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-light text-foreground">ERD Diagram (Mermaid)</h4>
                  <button onClick={() => { copyToClipboard(analysis.database_schema.erd_mermaid); toast({ title: "Copied" }); }}
                    className="p-1 rounded hover:bg-card/30 text-muted-foreground"><Copy className="h-3 w-3" /></button>
                </div>
                <pre className="text-[10px] font-mono text-muted-foreground bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                  {analysis.database_schema.erd_mermaid}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* ── API Tab ── */}
          <TabsContent value="api" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">API Endpoints ({(analysis.api_endpoints || []).length} detected)</h3>
            </div>
            {(analysis.api_endpoints || []).map((ep, i) => (
              <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-medium ${METHOD_COLORS[ep.method] || "text-foreground"}`}>{ep.method}</span>
                    <span className="text-xs font-mono text-foreground">{ep.path}</span>
                    {ep.auth_required && <Lock className="h-3 w-3 text-yellow-500" />}
                  </div>
                  <ConfidenceBadge value={ep.confidence} />
                </div>
                <p className="text-[10px] text-muted-foreground">{ep.description}</p>
                {ep.params.length > 0 && (
                  <div className="text-[9px] space-y-0.5">
                    {ep.params.map((p, j) => (
                      <span key={j} className="inline-flex items-center gap-1 mr-2 text-muted-foreground">
                        <span className="font-mono text-foreground/70">{p.name}</span>
                        <span className="text-muted-foreground/50">: {p.type}</span>
                        {p.required && <span className="text-red-400">*</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {/* ── Security Tab ── */}
          <TabsContent value="security" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">Security Findings ({(analysis.security_findings || []).length})</h3>
            </div>
            {(analysis.security_findings || []).length === 0 ? (
              <div className="rounded-xl border border-border/20 bg-card/10 p-6 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-light text-muted-foreground">No security issues detected.</p>
              </div>
            ) : (
              (analysis.security_findings || []).map((finding, i) => (
                <div key={i} className={`rounded-xl border p-4 space-y-2 ${SEVERITY_BG[finding.severity] || SEVERITY_BG.info}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-3.5 w-3.5 ${SEVERITY_COLORS[finding.severity] || ""}`} />
                      <span className={`text-[10px] font-mono uppercase ${SEVERITY_COLORS[finding.severity] || ""}`}>{finding.severity}</span>
                    </div>
                    {finding.cve_reference && <span className="text-[9px] font-mono text-muted-foreground">{finding.cve_reference}</span>}
                  </div>
                  <h4 className="text-xs font-light text-foreground">{finding.title}</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{finding.description}</p>
                  <div className="border-t border-border/10 pt-2">
                    <p className="text-[10px] text-emerald-400/80"><span className="font-medium">Remediation:</span> {finding.remediation}</p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ── Workflows Tab ── */}
          <TabsContent value="workflows" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">Workflow Diagrams</h3>
            </div>
            {(analysis.workflows || []).map((wf, i) => (
              <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-light text-foreground">{wf.name}</h4>
                  <button onClick={() => { copyToClipboard(wf.mermaid_diagram); toast({ title: "Copied" }); }}
                    className="p-1 rounded hover:bg-card/30 text-muted-foreground"><Copy className="h-3 w-3" /></button>
                </div>
                <p className="text-[10px] text-muted-foreground">{wf.description}</p>
                <pre className="text-[10px] font-mono text-muted-foreground bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{wf.mermaid_diagram}</pre>
              </div>
            ))}
            {(analysis.workflows || []).length === 0 && (
              <div className="rounded-xl border border-border/20 bg-card/10 p-6 text-center">
                <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs font-light text-muted-foreground">No workflow diagrams generated.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Rebuild Tab ── */}
          <TabsContent value="rebuild" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">Rebuild Guide</h3>
            </div>
            {analysis.rebuild_guide && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/20 bg-card/10 p-3 text-center">
                    <p className="text-lg font-extralight text-foreground">{analysis.rebuild_guide.estimated_hours || 0}h</p>
                    <p className="text-[10px] text-muted-foreground">Estimated Hours</p>
                  </div>
                  <div className="rounded-xl border border-border/20 bg-card/10 p-3 text-center">
                    <p className="text-lg font-extralight text-foreground">{analysis.rebuild_guide.team_size || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Team Size</p>
                  </div>
                  <div className="rounded-xl border border-border/20 bg-card/10 p-3 text-center">
                    <p className="text-lg font-extralight text-foreground">{(analysis.rebuild_guide.steps || []).length}</p>
                    <p className="text-[10px] text-muted-foreground">Phases</p>
                  </div>
                </div>
                {analysis.rebuild_guide.recommended_stack && (
                  <div className="rounded-xl border border-border/20 bg-card/10 p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Recommended Stack</p>
                    <p className="text-xs font-light text-foreground">{analysis.rebuild_guide.recommended_stack}</p>
                  </div>
                )}
                <div className="space-y-2">
                  {(analysis.rebuild_guide.steps || []).map((step, i) => (
                    <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-3 flex items-start gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center text-[10px] font-mono text-accent">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-light text-foreground">{step.phase}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{step.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{step.duration_hours}h</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Q&A Tab ── */}
          <TabsContent value="qa" className="mt-0 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-light text-foreground tracking-wide">Ask Questions About This System</h3>
            </div>
            <div className="space-y-3 min-h-[200px]">
              {qaMessages.length === 0 && (
                <div className="rounded-xl border border-border/20 bg-card/10 p-6 text-center space-y-3">
                  <p className="text-xs font-light text-muted-foreground">Ask anything about the analyzed system.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["How does authentication work?", "Security vulnerabilities?", "How to rebuild this?", "User registration flow?"].map((suggestion) => (
                      <button key={suggestion} onClick={() => setQaInput(suggestion)}
                        className="text-[10px] font-light px-3 py-1.5 rounded-lg border border-border/20 bg-card/5 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {qaMessages.map((msg) => (
                <div key={msg.id} className={`rounded-xl p-3 ${msg.role === "user" ? "bg-accent/10 border border-accent/20 ml-8" : "bg-card/20 border border-border/20 mr-8"}`}>
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">{msg.role === "user" ? "YOU" : "AUREON REIS"}</p>
                  <div className="text-xs font-light text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              ))}
              {qaLoading && (
                <div className="rounded-xl bg-card/20 border border-border/20 p-3 mr-8">
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">AUREON REIS</p>
                  <Loader2 className="h-4 w-4 text-accent animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-2 sticky bottom-0">
              <input value={qaInput} onChange={(e) => setQaInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendQuestion()}
                placeholder="Ask about the analyzed system…"
                className="flex-1 bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40" />
              <button onClick={sendQuestion} disabled={!qaInput.trim() || qaLoading}
                className="p-2.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-30 transition-all">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default ReverseEngineerView;
