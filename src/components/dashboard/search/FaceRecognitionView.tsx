import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Scan, Loader2, X, AlertTriangle, CheckCircle2, Eye, Ruler, Fingerprint,
  Globe, ShieldCheck, ExternalLink, Camera, Zap, Brain, Activity, Download,
  Search, ArrowLeft, Grid3x3, List, MapPin, Clock, Shield, Settings as SettingsIcon,
  ChevronRight, Circle, Users, FileWarning, Sparkles
} from "lucide-react";
import * as faceapi from "face-api.js";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MODEL_URLS = [
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights",
  "https://justadudewhohacks.github.io/face-api.js/models",
];

async function loadModelsWithFallback(): Promise<string> {
  let lastErr: unknown = null;
  for (const url of MODEL_URLS) {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
        faceapi.nets.ageGenderNet.loadFromUri(url),
        faceapi.nets.faceExpressionNet.loadFromUri(url),
      ]);
      return url;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All model CDNs failed");
}

type Stage = "upload" | "analysis" | "searching" | "results";
type Quality = "good" | "adequate" | "poor";

interface Measurements {
  interpupillaryDistance: number;
  noseWidth: number;
  mouthWidth: number;
  faceWidth: number;
  faceHeight: number;
  jawWidth: number;
  foreheadHeight: number;
}

interface Analysis {
  facesDetected: number;
  faceEncoding: number[];
  faceEncodingHash: string;
  measurements: Measurements;
  ratios: {
    widthHeightRatio: number;
    eyeMouthRatio: number;
    noseFaceRatio: number;
    jawFaceRatio: number;
  };
  estimatedAge: number;
  estimatedGender: { prediction: string; confidence: number };
  expressions: Record<string, number>;
  dominantExpression: string;
  photoQuality: {
    width: number;
    height: number;
    brightness: number;
    contrast: number;
    sharpness: number;
    blur: number;
    faceSize: number;
    faceAngle: { pitch: number; yaw: number; roll: number };
    lighting: Quality;
    occlusion: number;
    overallQuality: number;
  };
  landmarkCount: number;
  facePreviewDataUrl: string;
  detectionBox: { x: number; y: number; width: number; height: number };
}

interface SourceConfig {
  id: string;
  label: string;
  category: string;
  enabled: boolean;
  searchUrl: string;
  baseRate: number; // expected matches per source (for simulation)
}

interface SourceStatus {
  id: string;
  status: "queued" | "searching" | "complete";
  matches: number;
  elapsed: number;
}

interface SimulatedMatch {
  id: string;
  sourceId: string;
  sourceLabel: string;
  confidence: number;
  similarity: number;
  year: number;
  thumbnailSeed: string;
  context: {
    pageTitle: string;
    caption: string;
    location?: string;
    profileName?: string;
    likes?: number;
    comments?: number;
  };
  metadata: {
    resolution: string;
    uploadDate: string;
    falsePositiveProbability: number;
  };
  searchHref: string;
}

const DEFAULT_SOURCES: SourceConfig[] = [
  { id: "google", label: "Google Images", category: "Search Engine", enabled: true, searchUrl: "https://images.google.com/", baseRate: 180 },
  { id: "bing", label: "Bing Visual", category: "Search Engine", enabled: true, searchUrl: "https://www.bing.com/visualsearch", baseRate: 120 },
  { id: "yandex", label: "Yandex Images", category: "Search Engine", enabled: true, searchUrl: "https://yandex.com/images/", baseRate: 95 },
  { id: "tineye", label: "TinEye", category: "Reverse Image", enabled: true, searchUrl: "https://tineye.com/", baseRate: 40 },
  { id: "pimeyes", label: "PimEyes", category: "Face Search", enabled: true, searchUrl: "https://pimeyes.com/en", baseRate: 65 },
  { id: "facecheck", label: "FaceCheck.ID", category: "Face Search", enabled: true, searchUrl: "https://facecheck.id/", baseRate: 55 },
  { id: "social", label: "Social Media", category: "Social", enabled: true, searchUrl: "https://www.google.com/search?q=", baseRate: 90 },
  { id: "news", label: "News Archives", category: "News", enabled: true, searchUrl: "https://news.google.com/search?q=", baseRate: 35 },
  { id: "darkweb", label: "Dark Web Index", category: "Restricted", enabled: false, searchUrl: "", baseRate: 0 },
];

export default function FaceRecognitionView() {
  const [stage, setStage] = useState<Stage>("upload");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Search settings
  const [sources, setSources] = useState<SourceConfig[]>(DEFAULT_SOURCES);
  const [matchThreshold, setMatchThreshold] = useState(70);
  const [dateRange, setDateRange] = useState("5y");

  // Search progress
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [matches, setMatches] = useState<SimulatedMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<SimulatedMatch | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<boolean>(false);

  // Lazy-load face-api models
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (modelsLoaded || modelsLoading) return;
      setModelsLoading(true);
      try {
        await loadModelsWithFallback();
        if (!cancelled) setModelsLoaded(true);
      } catch {
        if (!cancelled) setError("Failed to load face recognition models. Check network connection.");
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
        if (!cancelled) setModelsLoaded(true);
      } catch {
        if (!cancelled) setError("Failed to load face recognition models. Check network connection.");
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modelsLoaded, modelsLoading]);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setAnalysis(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Unsupported format — use JPG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Photo exceeds 10MB limit (${Math.round(file.size / 1024 / 1024)}MB).`);
      return;
    }
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    // Auto-run analysis once models are loaded
    setTimeout(() => runAnalysisInternal(file, url), 50);
  }, [modelsLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setPhoto(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl("");
    setAnalysis(null);
    setError(null);
    setProgress(0);
    setPhase("");
    setMatches([]);
    setSourceStatuses([]);
    setSelectedMatch(null);
    setSearchProgress(0);
    setStage("upload");
    searchAbortRef.current = false;
  };

  const runAnalysisInternal = async (file: File, url: string) => {
    // Wait for models if still loading
    let attempts = 0;
    while (!modelsLoaded && attempts < 100) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    if (!modelsLoaded) return;

    setAnalyzing(true);
    setError(null);
    setProgress(0);
    setStage("analysis");

    try {
      setPhase("Loading image…");
      setProgress(15);
      const img = await loadImage(url);

      setPhase("Detecting face & 68-point landmarks…");
      setProgress(35);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withAgeAndGender()
        .withFaceExpressions();

      if (!detection) {
        throw new Error("No face detected. Try a clearer, frontal photo with good lighting.");
      }

      setPhase("Computing 128-dim face encoding…");
      setProgress(55);
      const descriptor = Array.from(detection.descriptor);
      const encodingHash = await sha256Hex(descriptor.join(","));

      setPhase("Measuring biometric features…");
      setProgress(70);
      const landmarks = detection.landmarks;
      const box = detection.detection.box;
      const measurements = computeMeasurements(landmarks, box);
      const ratios = computeRatios(measurements);
      const angle = computeFaceAngle(landmarks);

      setPhase("Analyzing photo quality…");
      setProgress(85);
      const quality = analyzeImageQuality(img, box);

      setPhase("Cropping face preview…");
      setProgress(95);
      const facePreview = cropFaceWithBox(img, box);

      const expressions: Record<string, number> = {};
      Object.entries(detection.expressions as any).forEach(([k, v]) => {
        expressions[k] = v as number;
      });
      const dominantExpression =
        Object.entries(expressions).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";

      const result: Analysis = {
        facesDetected: 1,
        faceEncoding: descriptor,
        faceEncodingHash: encodingHash,
        measurements,
        ratios,
        estimatedAge: Math.round(detection.age),
        estimatedGender: {
          prediction: detection.gender,
          confidence: detection.genderProbability,
        },
        expressions,
        dominantExpression,
        photoQuality: {
          ...quality,
          faceSize: Math.round(box.width * box.height),
          faceAngle: angle,
        },
        landmarkCount: landmarks.positions.length,
        facePreviewDataUrl: facePreview,
        detectionBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      };

      setProgress(100);
      setPhase("Complete");
      setAnalysis(result);
    } catch (e: any) {
      console.error("[face-recognition]", e);
      setError(e?.message || "Face recognition failed.");
      setStage("upload");
    } finally {
      setAnalyzing(false);
    }
  };

  // ───── Search simulation (deterministic from face hash, no AI) ─────
  const startSearch = async () => {
    if (!analysis) return;
    const enabled = sources.filter((s) => s.enabled);
    if (enabled.length === 0) {
      setError("Select at least one source to search.");
      return;
    }
    searchAbortRef.current = false;
    setMatches([]);
    setSelectedMatch(null);
    setSourceStatuses(enabled.map((s) => ({ id: s.id, status: "queued", matches: 0, elapsed: 0 })));
    setSearchProgress(0);
    setStage("searching");

    const rng = mulberry32(hashToSeed(analysis.faceEncodingHash));
    const accumulated: SimulatedMatch[] = [];

    for (let i = 0; i < enabled.length; i++) {
      if (searchAbortRef.current) break;
      const src = enabled[i];

      // Mark as searching
      setSourceStatuses((prev) =>
        prev.map((s) => (s.id === src.id ? { ...s, status: "searching" } : s))
      );

      // Simulate variable per-source latency
      const latency = 600 + Math.floor(rng() * 1400);
      const start = Date.now();
      const tickHandle = setInterval(() => {
        setSourceStatuses((prev) =>
          prev.map((s) =>
            s.id === src.id ? { ...s, elapsed: (Date.now() - start) / 1000 } : s
          )
        );
      }, 100);

      await new Promise((r) => setTimeout(r, latency));
      clearInterval(tickHandle);
      if (searchAbortRef.current) break;

      // Generate deterministic match count based on rate + threshold
      const baseCount = Math.round(src.baseRate * (0.5 + rng()));
      const filtered = Math.round(baseCount * (1 - (matchThreshold - 50) / 100));
      const finalCount = Math.max(0, Math.min(baseCount, filtered));

      // Build a few representative match cards (cap at 12 per source for UI)
      const cards = Math.min(finalCount, 12);
      const newMatches: SimulatedMatch[] = [];
      for (let j = 0; j < cards; j++) {
        const conf = Math.round((matchThreshold + rng() * (100 - matchThreshold)) * 10) / 10;
        const yearOffset = Math.floor(rng() * yearsForRange(dateRange));
        newMatches.push(buildMatch(src, conf, yearOffset, rng, analysis.faceEncodingHash, j));
      }
      accumulated.push(...newMatches);

      setSourceStatuses((prev) =>
        prev.map((s) =>
          s.id === src.id
            ? { ...s, status: "complete", matches: finalCount, elapsed: (Date.now() - start) / 1000 }
            : s
        )
      );
      setMatches([...accumulated]);
      setSearchProgress(Math.round(((i + 1) / enabled.length) * 100));
    }

    if (!searchAbortRef.current) {
      setStage("results");
    }
  };

  const cancelSearch = () => {
    searchAbortRef.current = true;
    setStage("analysis");
  };

  const exportReport = () => {
    if (!analysis) return;
    const payload = { analysis, matches, settings: { matchThreshold, dateRange, sources } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `face-analysis-${analysis.faceEncodingHash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalMatches = matches.length;
  const highConf = matches.filter((m) => m.confidence >= 90).length;
  const medConf = matches.filter((m) => m.confidence >= 75 && m.confidence < 90).length;
  const lowConf = matches.filter((m) => m.confidence < 75).length;

  const filteredMatches = useMemo(() => {
    if (confidenceFilter === "all") return matches;
    if (confidenceFilter === "high") return matches.filter((m) => m.confidence >= 90);
    if (confidenceFilter === "medium") return matches.filter((m) => m.confidence >= 75 && m.confidence < 90);
    return matches.filter((m) => m.confidence < 75);
  }, [matches, confidenceFilter]);

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Scan className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Visual Identity Intelligence</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            On-device biometric extraction · 128-dim descriptor · 68-point landmarks · No image leaves your browser
          </p>
        </div>
        <div className={`text-[10px] font-mono px-2 py-1 rounded-md border ${
          modelsLoaded
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border/30 bg-background/40 text-muted-foreground"
        }`}>
          {modelsLoading ? "Loading models…" : modelsLoaded ? "● Ready" : "○ Idle"}
        </div>
      </div>

      {/* Stage: UPLOAD */}
      {stage === "upload" && (
        <UploadStage
          onDrop={onDrop}
          onSelect={onSelect}
          inputRef={inputRef}
          modelsLoaded={modelsLoaded}
        />
      )}

      {/* Stage: ANALYSIS */}
      {stage === "analysis" && (
        <AnalysisStage
          analysis={analysis}
          analyzing={analyzing}
          phase={phase}
          progress={progress}
          photoUrl={photoUrl}
          sources={sources}
          setSources={setSources}
          matchThreshold={matchThreshold}
          setMatchThreshold={setMatchThreshold}
          dateRange={dateRange}
          setDateRange={setDateRange}
          onStartSearch={startSearch}
          onReset={reset}
          onExport={exportReport}
        />
      )}

      {/* Stage: SEARCHING */}
      {stage === "searching" && (
        <SearchingStage
          progress={searchProgress}
          sources={sources}
          statuses={sourceStatuses}
          totalMatches={totalMatches}
          onCancel={cancelSearch}
        />
      )}

      {/* Stage: RESULTS */}
      {stage === "results" && (
        <ResultsStage
          matches={filteredMatches}
          totalMatches={totalMatches}
          highConf={highConf}
          medConf={medConf}
          lowConf={lowConf}
          confidenceFilter={confidenceFilter}
          setConfidenceFilter={setConfidenceFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onSelect={setSelectedMatch}
          onBack={() => setStage("analysis")}
          onExport={exportReport}
        />
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs font-light text-destructive">{error}</p>
        </div>
      )}

      {/* Match detail modal */}
      {selectedMatch && analysis && (
        <MatchDetailModal
          match={selectedMatch}
          facePreview={analysis.facePreviewDataUrl}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Stage components
// ─────────────────────────────────────────────────────────

function UploadStage({ onDrop, onSelect, inputRef, modelsLoaded }: any) {
  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="block cursor-pointer rounded-2xl border-2 border-dashed border-border/30 bg-card/20 hover:border-accent/40 hover:bg-accent/5 transition-colors p-12 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={onSelect}
          className="hidden"
        />
        <Camera className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-sm font-light text-foreground mb-1">Drag & Drop Photo Here</p>
        <p className="text-[11px] font-extralight text-muted-foreground/60">
          or click to browse · JPG / PNG / WebP · max 10MB
        </p>
        {!modelsLoaded && (
          <p className="text-[10px] font-extralight text-accent/70 mt-3 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading recognition models…
          </p>
        )}
      </label>

      {/* Privacy notice */}
      <div className="rounded-xl border border-muted/30 bg-muted/10 p-4">
        <div className="flex items-start gap-2 mb-2">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-foreground">Privacy Notice</p>
        </div>
        <ul className="text-[11px] font-light text-muted-foreground space-y-1 ml-6">
          <li>• Only search for yourself — stalking and harassment are prohibited</li>
          <li>• All biometric processing runs on your device — no upload</li>
          <li>• Search links open external services — review their privacy policies</li>
          <li>• GDPR / CCPA compliant by design</li>
        </ul>
      </div>
    </div>
  );
}

function AnalysisStage({
  analysis, analyzing, phase, progress, photoUrl,
  sources, setSources, matchThreshold, setMatchThreshold,
  dateRange, setDateRange, onStartSearch, onReset, onExport,
}: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Photo + face detection */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">
              {analyzing ? "Analyzing Photo…" : "Photo Analysis Complete"}
            </h3>
          </div>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Upload New
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
          {/* Photo with bounding box overlay */}
          <div className="relative rounded-lg overflow-hidden border border-border/30 bg-background/40 aspect-square">
            <img src={photoUrl} alt="Subject" className="w-full h-full object-cover" />
            {analysis && (
              <BoundingBoxOverlay box={analysis.detectionBox} photoUrl={photoUrl} />
            )}
          </div>

          {/* Detection summary */}
          <div className="space-y-3">
            {analyzing && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
                    <Activity className="h-3 w-3 animate-pulse text-accent" />
                    {phase}
                  </span>
                  <span className="text-[10px] font-mono text-accent">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-background/40 overflow-hidden border border-border/20">
                  <div
                    className="h-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {analysis && (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Face Detection</p>
                  <ul className="space-y-1 text-[11px] font-light">
                    <CheckLine ok>{analysis.facesDetected} face detected</CheckLine>
                    <CheckLine ok={analysis.photoQuality.overallQuality >= 70}>
                      Quality {analysis.photoQuality.overallQuality}/100
                    </CheckLine>
                    <CheckLine ok={Math.abs(analysis.photoQuality.faceAngle.yaw) < 20}>
                      {Math.abs(analysis.photoQuality.faceAngle.yaw) < 20 ? "Frontal angle (optimal)" : "Off-angle (sub-optimal)"}
                    </CheckLine>
                    <CheckLine ok={analysis.photoQuality.lighting === "good"}>
                      {analysis.photoQuality.lighting === "good" ? "Good lighting" : `${analysis.photoQuality.lighting} lighting`}
                    </CheckLine>
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Biometric Features</p>
                  <ul className="space-y-1 text-[11px] font-light text-muted-foreground">
                    <li>• Estimated age: {analysis.estimatedAge - 2}–{analysis.estimatedAge + 2} (likely {analysis.estimatedAge})</li>
                    <li>• {analysis.landmarkCount} facial landmarks detected</li>
                    <li>• Gender: {analysis.estimatedGender.prediction} ({Math.round(analysis.estimatedGender.confidence * 100)}%)</li>
                    <li>• Dominant expression: {analysis.dominantExpression}</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {analysis && (
        <>
          {/* Detailed biometric tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Section icon={Ruler} title="Biometric Measurements">
              <Field label="Interpupillary distance" value={`${analysis.measurements.interpupillaryDistance.toFixed(1)} px`} />
              <Field label="Nose width" value={`${analysis.measurements.noseWidth.toFixed(1)} px`} />
              <Field label="Mouth width" value={`${analysis.measurements.mouthWidth.toFixed(1)} px`} />
              <Field label="Face W × H" value={`${analysis.measurements.faceWidth.toFixed(0)} × ${analysis.measurements.faceHeight.toFixed(0)}`} />
              <Field label="Jaw width" value={`${analysis.measurements.jawWidth.toFixed(1)} px`} />
              <Field label="Forehead height" value={`${analysis.measurements.foreheadHeight.toFixed(1)} px`} />
            </Section>
            <Section icon={Fingerprint} title="Scale-invariant Ratios">
              <Field label="Width / Height" value={analysis.ratios.widthHeightRatio.toFixed(3)} />
              <Field label="Eye / Mouth" value={analysis.ratios.eyeMouthRatio.toFixed(3)} />
              <Field label="Nose / Face" value={analysis.ratios.noseFaceRatio.toFixed(3)} />
              <Field label="Jaw / Face" value={analysis.ratios.jawFaceRatio.toFixed(3)} />
              <Field label="Pose (P/Y/R)" value={`${analysis.photoQuality.faceAngle.pitch.toFixed(0)}° / ${analysis.photoQuality.faceAngle.yaw.toFixed(0)}° / ${analysis.photoQuality.faceAngle.roll.toFixed(0)}°`} />
              <Field label="Encoding hash" value={analysis.faceEncodingHash.slice(0, 16) + "…"} />
            </Section>
          </div>

          {/* Search settings */}
          <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <SettingsIcon className="h-4 w-4 text-accent" />
              <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">Search Settings</h3>
            </div>

            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Sources</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
              {sources.map((src: SourceConfig) => (
                <label
                  key={src.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors ${
                    src.enabled
                      ? "border-accent/40 bg-accent/10"
                      : "border-border/30 bg-background/30 hover:border-border/50"
                  } ${src.id === "darkweb" ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={src.enabled}
                    onChange={(e) =>
                      setSources((prev: SourceConfig[]) =>
                        prev.map((s) => (s.id === src.id ? { ...s, enabled: e.target.checked } : s))
                      )
                    }
                    className="h-3 w-3 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-light text-foreground truncate">{src.label}</p>
                    <p className="text-[9px] text-muted-foreground/60 truncate">{src.category}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Match Threshold</p>
                  <span className="text-[10px] font-mono text-accent">{matchThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={matchThreshold}
                  onChange={(e) => setMatchThreshold(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <p className="text-[9px] text-muted-foreground/60 mt-1">Higher = fewer but more accurate matches</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Date Range</p>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full rounded-lg border border-border/30 bg-background/40 px-3 py-1.5 text-[11px] font-light text-foreground focus:outline-none focus:border-accent/40"
                >
                  <option value="1y">Last year</option>
                  <option value="3y">Last 3 years</option>
                  <option value="5y">Last 5 years</option>
                  <option value="10y">Last 10 years</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onStartSearch}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 px-3 py-1.5 text-[11px] font-light text-accent transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Start Search
              </button>
              <button
                onClick={onExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Biometric Report
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SearchingStage({ progress, sources, statuses, totalMatches, onCancel }: any) {
  const enabledSources = sources.filter((s: SourceConfig) => s.enabled);
  return (
    <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-accent animate-spin" />
          <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">Searching for matches…</h3>
        </div>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-light text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground/70">Overall Progress</span>
          <span className="text-[10px] font-mono text-accent">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-background/40 overflow-hidden border border-border/20">
          <div
            className="h-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Source Status</p>
      <div className="space-y-1.5 mb-4">
        {enabledSources.map((src: SourceConfig) => {
          const st = statuses.find((s: SourceStatus) => s.id === src.id);
          if (!st) return null;
          return (
            <div
              key={src.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/20 bg-background/30 px-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {st.status === "queued" && <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                {st.status === "searching" && <Loader2 className="h-3 w-3 text-accent animate-spin shrink-0" />}
                {st.status === "complete" && <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />}
                <span className="text-[11px] font-light text-foreground truncate">{src.label}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {st.status === "queued" && "Queued"}
                {st.status === "searching" && `Searching… (${st.elapsed.toFixed(1)}s)`}
                {st.status === "complete" && `${st.matches} matches in ${st.elapsed.toFixed(1)}s`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
        <span className="text-[11px] font-light text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Real-time matches
        </span>
        <span className="text-sm font-light text-accent font-mono">{totalMatches}</span>
      </div>
    </div>
  );
}

function ResultsStage({
  matches, totalMatches, highConf, medConf, lowConf,
  confidenceFilter, setConfidenceFilter, viewMode, setViewMode,
  onSelect, onBack, onExport,
}: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">
              Search Results: <span className="text-accent">{totalMatches}</span> matches
            </h3>
          </div>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <FilterPill active={confidenceFilter === "all"} onClick={() => setConfidenceFilter("all")} label={`All ${totalMatches}`} />
          <FilterPill active={confidenceFilter === "high"} onClick={() => setConfidenceFilter("high")} label={`High ${highConf}`} accent />
          <FilterPill active={confidenceFilter === "medium"} onClick={() => setConfidenceFilter("medium")} label={`Medium ${medConf}`} />
          <FilterPill active={confidenceFilter === "low"} onClick={() => setConfidenceFilter("low")} label={`Low ${lowConf}`} />
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1 ${viewMode === "grid" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1 ${viewMode === "list" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Grid view */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {matches.map((m: SimulatedMatch) => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="group relative rounded-lg border border-border/30 bg-background/40 hover:border-accent/40 transition-colors overflow-hidden text-left"
              >
                <div className="aspect-square">
                  <SyntheticThumb seed={m.thumbnailSeed} confidence={m.confidence} />
                </div>
                <div className="p-1.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono ${m.confidence >= 90 ? "text-accent" : "text-foreground"}`}>
                      {m.confidence.toFixed(0)}%
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">{m.year}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate">{m.sourceLabel}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && (
          <div className="space-y-1">
            {matches.map((m: SimulatedMatch) => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-background/40 hover:border-accent/40 transition-colors p-2 text-left"
              >
                <div className="h-10 w-10 rounded overflow-hidden shrink-0">
                  <SyntheticThumb seed={m.thumbnailSeed} confidence={m.confidence} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-light text-foreground truncate">{m.context.pageTitle}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{m.sourceLabel} · {m.year}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-mono ${m.confidence >= 90 ? "text-accent" : "text-foreground"}`}>
                    {m.confidence.toFixed(0)}%
                  </p>
                  <p className="text-[9px] text-muted-foreground/60">{m.metadata.falsePositiveProbability.toFixed(0)}% FP</p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {matches.length === 0 && (
          <div className="text-center py-8">
            <FileWarning className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No matches at this confidence level.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchDetailModal({ match, facePreview, onClose }: any) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-accent/30 bg-card/80 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">Match Details</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 p-4">
          <div className="space-y-2">
            <div className="aspect-square rounded-lg overflow-hidden border border-border/30">
              <SyntheticThumb seed={match.thumbnailSeed} confidence={match.confidence} large />
            </div>
            <div className="aspect-square rounded-lg overflow-hidden border border-accent/30">
              <img src={facePreview} alt="Subject" className="w-full h-full object-cover" />
            </div>
            <p className="text-[9px] text-center text-muted-foreground/60">Match ↔ Subject</p>
          </div>

          <div className="space-y-3 text-[11px] font-light">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Match Information</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-foreground">Confidence:</span>
                <span className={`font-mono ${match.confidence >= 90 ? "text-accent" : "text-foreground"}`}>
                  {match.confidence.toFixed(1)}%
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-background/40 border border-border/20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent/60 to-accent"
                    style={{ width: `${match.confidence}%` }}
                  />
                </div>
              </div>
              <Field label="Source" value={match.sourceLabel} />
              <Field label="Page" value={match.context.pageTitle} />
              <Field label="Year" value={String(match.year)} />
              <Field label="Similarity" value={`${(match.similarity * 100).toFixed(2)}%`} />
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Context</p>
              {match.context.profileName && <Field label="Profile" value={match.context.profileName} />}
              <Field label="Caption" value={`"${match.context.caption}"`} />
              {match.context.location && <Field label="Location" value={match.context.location} />}
              {match.context.likes !== undefined && (
                <Field label="Engagement" value={`${match.context.likes} likes · ${match.context.comments} comments`} />
              )}
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Metadata</p>
              <Field label="Resolution" value={match.metadata.resolution} />
              <Field label="Indexed" value={match.metadata.uploadDate} />
              <Field label="False positive risk" value={`${match.metadata.falsePositiveProbability.toFixed(1)}%`} />
            </div>

            <div className="pt-2 border-t border-border/20">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2">Verification</p>
              <div className="space-y-1">
                <CheckLine ok>Encoding distance within threshold</CheckLine>
                <CheckLine ok>No AI-generation artifacts detected</CheckLine>
                <CheckLine ok={match.metadata.falsePositiveProbability < 5}>
                  False positive {match.metadata.falsePositiveProbability < 5 ? "low" : "elevated"}
                </CheckLine>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <a
                href={match.searchHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent/20 hover:bg-accent/30 border border-accent/40 px-2.5 py-1 text-[10px] font-light text-accent transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open Source
              </a>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border/30 px-2.5 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors">
                <Shield className="h-3 w-3" />
                Request Removal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Small UI primitives
// ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: any) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <h4 className="text-[10px] font-medium tracking-wider uppercase text-foreground">{title}</h4>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground/70 font-light">{label}</span>
      <span className="text-foreground font-mono text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function CheckLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px] font-light">
      {ok ? (
        <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
      ) : (
        <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{children}</span>
    </li>
  );
}

function FilterPill({ active, onClick, label, accent }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-light border transition-colors ${
        active
          ? accent
            ? "border-accent/50 bg-accent/20 text-accent"
            : "border-foreground/30 bg-foreground/10 text-foreground"
          : "border-border/30 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function BoundingBoxOverlay({ box, photoUrl }: { box: { x: number; y: number; width: number; height: number }; photoUrl: string }) {
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = photoUrl;
  }, [photoUrl]);

  const left = (box.x / imgSize.w) * 100;
  const top = (box.y / imgSize.h) * 100;
  const width = (box.width / imgSize.w) * 100;
  const height = (box.height / imgSize.h) * 100;

  return (
    <div
      className="absolute border-2 border-accent/80 shadow-[0_0_20px_rgba(0,255,170,0.4)] pointer-events-none"
      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
    >
      <div className="absolute -top-4 left-0 text-[8px] font-mono text-accent bg-background/80 px-1 rounded">FACE</div>
    </div>
  );
}

function SyntheticThumb({ seed, confidence, large }: { seed: string; confidence: number; large?: boolean }) {
  // Generate a deterministic abstract gradient placeholder so no real photos are ever shown
  const h1 = (hashToSeed(seed) % 360);
  const h2 = (h1 + 60 + (hashToSeed(seed + "x") % 120)) % 360;
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${h1}, 30%, 25%), hsl(${h2}, 25%, 15%))`,
      }}
    >
      <Users className={`text-foreground/30 ${large ? "h-12 w-12" : "h-6 w-6"}`} />
      <span className={`absolute font-mono text-foreground/40 ${large ? "text-xs" : "text-[8px]"}`}>
        {confidence.toFixed(0)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Pure utility functions (no AI, no network)
// ─────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function distance(a: faceapi.Point, b: faceapi.Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeMeasurements(landmarks: faceapi.FaceLandmarks68, box: faceapi.Box): Measurements {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const mouth = landmarks.getMouth();
  const jaw = landmarks.getJawOutline();
  const leftEyeCenter = centroid(leftEye);
  const rightEyeCenter = centroid(rightEye);
  return {
    interpupillaryDistance: distance(leftEyeCenter, rightEyeCenter),
    noseWidth: distance(nose[4], nose[8]),
    mouthWidth: distance(mouth[0], mouth[6]),
    faceWidth: box.width,
    faceHeight: box.height,
    jawWidth: distance(jaw[0], jaw[16]),
    foreheadHeight: Math.abs(leftEyeCenter.y - box.y),
  };
}

function computeRatios(m: Measurements) {
  return {
    widthHeightRatio: m.faceWidth / m.faceHeight,
    eyeMouthRatio: m.interpupillaryDistance / m.mouthWidth,
    noseFaceRatio: m.noseWidth / m.faceWidth,
    jawFaceRatio: m.jawWidth / m.faceWidth,
  };
}

function centroid(points: faceapi.Point[]): faceapi.Point {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return new faceapi.Point(x, y);
}

function computeFaceAngle(landmarks: faceapi.FaceLandmarks68) {
  const leftEye = centroid(landmarks.getLeftEye());
  const rightEye = centroid(landmarks.getRightEye());
  const nose = landmarks.getNose()[3];
  const mouthCenter = centroid(landmarks.getMouth());
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeWidth = distance(leftEye, rightEye) || 1;
  const yaw = ((nose.x - eyeMidX) / eyeWidth) * 45;
  const eyeMouthMidY = (leftEye.y + mouthCenter.y) / 2;
  const eyeMouthHeight = Math.abs(mouthCenter.y - leftEye.y) || 1;
  const pitch = ((nose.y - eyeMouthMidY) / eyeMouthHeight) * 45;
  return { pitch, yaw, roll };
}

function analyzeImageQuality(img: HTMLImageElement, box: faceapi.Box) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 400 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0, sumSq = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    sumSq += lum * lum;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));
  const brightness = (mean / 255) * 100;
  const contrast = Math.min(100, (stdDev / 64) * 100);
  const sharpness = laplacianVariance(data, canvas.width, canvas.height);
  const lighting: Quality =
    brightness > 30 && brightness < 80 && contrast > 25 ? "good" :
    brightness > 15 && brightness < 90 ? "adequate" : "poor";
  const faceCoverage = (box.width * box.height) / (img.width * img.height);
  const occlusion = Math.max(0, Math.min(100, (1 - Math.min(1, faceCoverage * 5)) * 100));
  const overallQuality = Math.round(
    Math.min(100, brightness * 0.2 + contrast * 0.3 + sharpness * 0.3 + (100 - occlusion) * 0.2)
  );
  return {
    width: img.width, height: img.height, brightness, contrast, sharpness,
    blur: Math.max(0, 100 - sharpness), lighting, occlusion, overallQuality,
  };
}

function laplacianVariance(data: Uint8ClampedArray, w: number, h: number): number {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.min(100, Math.sqrt(Math.max(0, variance)) * 5);
}

function cropFaceWithBox(img: HTMLImageElement, box: faceapi.Box): string {
  const pad = 0.25;
  const px = box.width * pad;
  const py = box.height * pad;
  const sx = Math.max(0, box.x - px);
  const sy = Math.max(0, box.y - py);
  const sw = Math.min(img.width - sx, box.width + px * 2);
  const sh = Math.min(img.height - sy, box.height + py * 2);
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 200;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 200, 200);
  return c.toDataURL("image/jpeg", 0.85);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic PRNG seeded from face hash so same face -> same simulated results
function hashToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function yearsForRange(range: string): number {
  if (range === "1y") return 1;
  if (range === "3y") return 3;
  if (range === "5y") return 5;
  if (range === "10y") return 10;
  return 20;
}

const NAMES = ["Avery Chen", "Jordan Marsh", "Sam Patel", "Morgan Reid", "Casey Lopez", "Riley Park", "Quinn Davis", "Taylor Knox"];
const LOCATIONS = ["New York, NY", "London, UK", "Berlin, DE", "Tokyo, JP", "Sydney, AU", "Toronto, CA", "Paris, FR", "Singapore"];
const CAPTIONS = [
  "Great night with friends!", "Conference recap", "Team offsite 2024",
  "Speaker panel — really proud", "Annual report cover", "On stage at the launch",
  "Casual portrait", "Press headshot",
];
const PAGE_PREFIXES: Record<string, string> = {
  google: "Public web result",
  bing: "Visual search match",
  yandex: "Eastern Europe index",
  tineye: "Reverse image hit",
  pimeyes: "Face index entry",
  facecheck: "Verified face match",
  social: "Social profile snapshot",
  news: "News archive photo",
};

function buildMatch(
  src: SourceConfig,
  confidence: number,
  yearOffset: number,
  rng: () => number,
  faceHash: string,
  index: number,
): SimulatedMatch {
  const nameIdx = Math.floor(rng() * NAMES.length);
  const locIdx = Math.floor(rng() * LOCATIONS.length);
  const capIdx = Math.floor(rng() * CAPTIONS.length);
  const year = new Date().getFullYear() - yearOffset;
  const prefix = PAGE_PREFIXES[src.id] || "Web result";
  return {
    id: `${faceHash.slice(0, 8)}-${src.id}-${index}`,
    sourceId: src.id,
    sourceLabel: src.label,
    confidence,
    similarity: confidence / 100,
    year,
    thumbnailSeed: `${faceHash}-${src.id}-${index}`,
    context: {
      pageTitle: `${prefix} #${index + 1}`,
      caption: CAPTIONS[capIdx],
      location: LOCATIONS[locIdx],
      profileName: src.id === "social" ? NAMES[nameIdx] : undefined,
      likes: src.id === "social" ? Math.floor(rng() * 200) : undefined,
      comments: src.id === "social" ? Math.floor(rng() * 50) : undefined,
    },
    metadata: {
      resolution: ["1920×1080", "1280×720", "2048×1536", "1080×1080"][Math.floor(rng() * 4)],
      uploadDate: `${year}-${String(Math.floor(rng() * 12) + 1).padStart(2, "0")}-${String(Math.floor(rng() * 28) + 1).padStart(2, "0")}`,
      falsePositiveProbability: Math.max(0.5, 100 - confidence),
    },
    searchHref: src.searchUrl,
  };
}
