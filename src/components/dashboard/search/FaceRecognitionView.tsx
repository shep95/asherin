import { useState, useRef, useCallback, useEffect } from "react";
import {
  Scan, Loader2, X, AlertTriangle, CheckCircle2, Eye, Ruler, Fingerprint,
  Globe, ShieldCheck, ExternalLink, Camera, Zap, Brain, Activity, Download
} from "lucide-react";
import * as faceapi from "face-api.js";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

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
  faceEncoding: number[]; // 128-D descriptor
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
  searchLinks: { label: string; url: string; category: string }[];
}

export default function FaceRecognitionView() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load face-api models on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (modelsLoaded || modelsLoading) return;
      setModelsLoading(true);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (!cancelled) setModelsLoaded(true);
      } catch (e: any) {
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
      setError(`Photo exceeds 8MB limit (${Math.round(file.size / 1024 / 1024)}MB).`);
      return;
    }
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  }, []);

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
  };

  const runAnalysis = async () => {
    if (!photo || !modelsLoaded) return;
    setAnalyzing(true);
    setAnalysis(null);
    setError(null);
    setProgress(0);

    try {
      // Load image
      setPhase("Loading image…");
      setProgress(10);
      const img = await loadImage(photoUrl);

      // Detect face + landmarks + descriptor + age/gender + expressions
      setPhase("Detecting face & 68-point landmarks…");
      setProgress(25);
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
      setProgress(45);
      const descriptor = Array.from(detection.descriptor);
      const encodingHash = await sha256Hex(descriptor.join(","));

      setPhase("Measuring biometric features…");
      setProgress(60);
      const landmarks = detection.landmarks;
      const box = detection.detection.box;
      const measurements = computeMeasurements(landmarks, box);
      const ratios = computeRatios(measurements);
      const angle = computeFaceAngle(landmarks);

      setPhase("Analyzing photo quality…");
      setProgress(75);
      const quality = analyzeImageQuality(img, box);

      setPhase("Cropping face preview…");
      setProgress(85);
      const facePreview = cropFace(img, box);

      setPhase("Building reverse-search links…");
      setProgress(95);
      const searchLinks = buildSearchLinks();

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
        searchLinks,
      };

      setProgress(100);
      setPhase("Complete");
      setAnalysis(result);
    } catch (e: any) {
      console.error("[face-recognition]", e);
      setError(e?.message || "Face recognition failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const exportReport = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `face-analysis-${analysis.faceEncodingHash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Scan className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Face Recognition Engine — On-Device</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            100% client-side biometric extraction · TinyFaceDetector + 68-point landmarks + 128-dim descriptor · No data leaves your browser
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

      {!photo && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="block cursor-pointer rounded-2xl border-2 border-dashed border-border/30 bg-card/20 hover:border-accent/40 hover:bg-accent/5 transition-colors p-10 text-center"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={onSelect}
            className="hidden"
          />
          <Camera className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-light text-foreground">Drop a photo or click to upload</p>
          <p className="text-[11px] font-extralight text-muted-foreground/60 mt-1">
            JPG · PNG · WebP · max 8MB · best results with frontal, well-lit photos
          </p>
        </label>
      )}

      {photo && (
        <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
          <div className="flex items-start gap-4">
            <img
              src={photoUrl}
              alt="Subject"
              className="h-32 w-32 object-cover rounded-xl border border-border/30 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-light text-foreground truncate">{photo.name}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {Math.round(photo.size / 1024)} KB · {photo.type}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
                Analysis runs entirely on-device using face-api.js (TensorFlow.js). No image is uploaded.
                After analysis, use the generated reverse-image-search links to manually search the web.
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={runAnalysis}
                disabled={analyzing || !modelsLoaded}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 px-3 py-1.5 text-[11px] font-light text-accent transition-colors disabled:opacity-30"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {analyzing ? "Analyzing…" : modelsLoaded ? "Run Recognition" : "Loading models…"}
              </button>
              <button
                onClick={reset}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          {analyzing && (
            <div className="mt-4">
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
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs font-light text-destructive">{error}</p>
        </div>
      )}

      {analysis && <AnalysisReport analysis={analysis} onExport={exportReport} />}
    </div>
  );
}

function AnalysisReport({ analysis, onExport }: { analysis: Analysis; onExport: () => void }) {
  const m = analysis.measurements;
  const r = analysis.ratios;
  const q = analysis.photoQuality;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">Biometric Signature</h3>
          </div>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Export JSON
          </button>
        </div>
        <div className="flex items-start gap-4">
          <img
            src={analysis.facePreviewDataUrl}
            alt="Detected face"
            className="h-24 w-24 object-cover rounded-lg border border-accent/30"
          />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[10px] text-muted-foreground/70">
              Face encoding (SHA-256 of 128-dim descriptor)
            </p>
            <p className="text-[10px] font-mono text-accent break-all">
              {analysis.faceEncodingHash}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              {analysis.landmarkCount} facial landmarks · descriptor norm:{" "}
              {Math.sqrt(analysis.faceEncoding.reduce((a, b) => a + b * b, 0)).toFixed(3)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard icon={Scan} label="Faces Detected" value={analysis.facesDetected} />
        <StatCard icon={Eye} label="Landmarks" value={analysis.landmarkCount} />
        <StatCard icon={CheckCircle2} label="Quality Score" value={`${q.overallQuality}/100`} accent />
        <StatCard icon={ShieldCheck} label="Search Links" value={analysis.searchLinks.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section icon={Ruler} title="Biometric Measurements">
          <Field label="Interpupillary distance" value={`${m.interpupillaryDistance.toFixed(1)} px`} />
          <Field label="Nose width" value={`${m.noseWidth.toFixed(1)} px`} />
          <Field label="Mouth width" value={`${m.mouthWidth.toFixed(1)} px`} />
          <Field label="Face width / height" value={`${m.faceWidth.toFixed(0)} × ${m.faceHeight.toFixed(0)} px`} />
          <Field label="Jaw width" value={`${m.jawWidth.toFixed(1)} px`} />
          <Field label="Forehead height" value={`${m.foreheadHeight.toFixed(1)} px`} />
        </Section>

        <Section icon={Fingerprint} title="Facial Ratios (scale-invariant)">
          <Field label="Width / Height" value={r.widthHeightRatio.toFixed(3)} />
          <Field label="Eye-to-mouth ratio" value={r.eyeMouthRatio.toFixed(3)} />
          <Field label="Nose / Face width" value={r.noseFaceRatio.toFixed(3)} />
          <Field label="Jaw / Face width" value={r.jawFaceRatio.toFixed(3)} />
          <Field label="Estimated age" value={`${analysis.estimatedAge} years`} />
          <Field
            label="Gender"
            value={`${analysis.estimatedGender.prediction} · ${Math.round(analysis.estimatedGender.confidence * 100)}%`}
          />
        </Section>

        <Section icon={Eye} title="Photo Quality">
          <Field label="Resolution" value={`${q.width} × ${q.height}`} />
          <Field label="Overall quality" value={`${q.overallQuality}/100`} />
          <Field label="Lighting" value={q.lighting} />
          <Field label="Brightness" value={`${Math.round(q.brightness)}%`} />
          <Field label="Contrast" value={`${Math.round(q.contrast)}%`} />
          <Field label="Sharpness" value={`${Math.round(q.sharpness)}%`} />
          <Field label="Face area" value={`${q.faceSize.toLocaleString()} px²`} />
          <Field
            label="Pose (pitch/yaw/roll)"
            value={`${q.faceAngle.pitch.toFixed(0)}° / ${q.faceAngle.yaw.toFixed(0)}° / ${q.faceAngle.roll.toFixed(0)}°`}
          />
        </Section>

        <Section icon={Activity} title="Expression Analysis">
          <Field label="Dominant" value={analysis.dominantExpression} />
          {Object.entries(analysis.expressions)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <Field key={k} label={k} value={`${(v * 100).toFixed(1)}%`} />
            ))}
        </Section>
      </div>

      {/* Reverse-image search links */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">
            Reverse-Image & Face-Search Engines
          </h3>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mb-3 leading-relaxed">
          Open these in a new tab and upload your photo to search across the web. All searches happen on third-party engines —
          no data is sent through this app.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {analysis.searchLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/40 hover:bg-accent/10 hover:border-accent/40 px-3 py-2 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-xs font-light text-foreground truncate">{link.label}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">{link.category}</p>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-accent shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`rounded-lg border ${
      accent ? "border-accent/40 bg-accent/10" : "border-border/30 bg-card/30"
    } backdrop-blur-xl px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${accent ? "text-accent" : "text-muted-foreground"}`} />
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
      </div>
      <p className={`text-sm font-light ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

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
      <span className="text-foreground font-mono text-right">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Pure utility functions (real math, no AI calls)
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
  const nose = landmarks.getNose()[3]; // nose tip
  const mouthCenter = centroid(landmarks.getMouth());

  // Roll: angle of eye line vs horizontal
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

  // Yaw: nose horizontal offset from eye midpoint
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeWidth = distance(leftEye, rightEye) || 1;
  const yaw = ((nose.x - eyeMidX) / eyeWidth) * 45;

  // Pitch: nose vertical offset from eye-mouth midpoint
  const eyeMouthMidY = (leftEye.y + mouthCenter.y) / 2;
  const eyeMouthHeight = Math.abs(mouthCenter.y - leftEye.y) || 1;
  const pitch = ((nose.y - eyeMouthMidY) / eyeMouthHeight) * 45;

  return { pitch, yaw, roll };
}

function analyzeImageQuality(img: HTMLImageElement, box: faceapi.Box) {
  const canvas = document.createElement("canvas");
  // Downsample for speed
  const scale = Math.min(1, 400 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let sum = 0;
  let sumSq = 0;
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

  // Sharpness via Laplacian variance on luminance
  const sharpness = laplacianVariance(data, canvas.width, canvas.height);

  const lighting: Quality =
    brightness > 30 && brightness < 80 && contrast > 25 ? "good" :
    brightness > 15 && brightness < 90 ? "adequate" : "poor";

  // Occlusion proxy: how much of the image the face covers (smaller = more likely occluded/distant)
  const faceCoverage = (box.width * box.height) / (img.width * img.height);
  const occlusion = Math.max(0, Math.min(100, (1 - Math.min(1, faceCoverage * 5)) * 100));

  const overallQuality = Math.round(
    Math.min(100, brightness * 0.2 + contrast * 0.3 + sharpness * 0.3 + (100 - occlusion) * 0.2)
  );

  return {
    width: img.width,
    height: img.height,
    brightness,
    contrast,
    sharpness,
    blur: Math.max(0, 100 - sharpness),
    lighting,
    occlusion,
    overallQuality,
  };
}

function laplacianVariance(data: Uint8ClampedArray, w: number, h: number): number {
  // Convert to grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - w] +
        gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Normalize: variance > 500 is sharp, <100 is blurry
  return Math.min(100, Math.sqrt(Math.max(0, variance)) * 5);
}

function cropFace(img: HTMLImageElement, box: faceapi.Box): string {
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
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildSearchLinks() {
  return [
    { label: "Google Images", url: "https://images.google.com/", category: "Search Engine" },
    { label: "Google Lens", url: "https://lens.google.com/", category: "Search Engine" },
    { label: "Bing Visual Search", url: "https://www.bing.com/visualsearch", category: "Search Engine" },
    { label: "Yandex Images", url: "https://yandex.com/images/", category: "Search Engine" },
    { label: "TinEye", url: "https://tineye.com/", category: "Reverse Image" },
    { label: "PimEyes", url: "https://pimeyes.com/en", category: "Face Search" },
    { label: "FaceCheck.ID", url: "https://facecheck.id/", category: "Face Search" },
    { label: "Search4Faces", url: "https://search4faces.com/", category: "Face Search" },
    { label: "Karma Decay (Reddit)", url: "http://karmadecay.com/", category: "Social" },
    { label: "Berify", url: "https://berify.com/", category: "Reverse Image" },
    { label: "ImageRaider", url: "https://infringement.report/", category: "Reverse Image" },
    { label: "SauceNAO", url: "https://saucenao.com/", category: "Reverse Image" },
  ];
}
