import { useState, useRef, useCallback } from "react";
import {
  Scan, Upload, Loader2, X, AlertTriangle, CheckCircle2, Eye, Ruler, Fingerprint,
  Sparkles, Globe, Image as ImageIcon, ShieldCheck, Calendar, MapPin, ExternalLink,
  Camera, Zap, Brain, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB photo cap
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

type Quality = "good" | "adequate" | "poor";

interface FaceAnalysis {
  facesDetected: number;
  primaryFace: {
    biometrics: {
      measurements: {
        interpupillaryDistance: number;
        noseWidth: number;
        mouthWidth: number;
        faceWidth: number;
        faceHeight: number;
        jawWidth: number;
        foreheadHeight: number;
      };
      uniqueFeatures: {
        hasMole: boolean;
        hasScar: boolean;
        hasTattoo: boolean;
        hasGlasses: boolean;
        hasFacialHair: boolean;
        facialHairType: string;
        hairColor: string;
        eyeColor: string;
        skinTone: string;
      };
      estimatedAge: { min: number; max: number; most_likely: number };
      estimatedGender: { prediction: "male" | "female" | "unknown"; confidence: number };
    };
    photoQuality: {
      brightness: number;
      sharpness: number;
      blur: number;
      faceAngle: { pitch: number; yaw: number; roll: number };
      lighting: Quality;
      occlusion: number;
      overallQuality: number;
    };
    context: {
      backgroundType: string;
      indoorOutdoor: "indoor" | "outdoor" | "unknown";
      otherPeople: number;
    };
  };
  matches: Array<{
    id: string;
    source: string;
    sourceCategory: string;
    url: string;
    website: string;
    matchConfidence: number;
    similarityScore: number;
    mediaType: "image" | "video" | "profile_photo";
    context: {
      pageTitle: string;
      surroundingText: string;
      publishDate?: string;
      location?: string;
    };
    verified: boolean;
    falsePositiveProbability: number;
  }>;
  stats: {
    totalMatches: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
    uniqueWebsites: number;
    sourcesScanned: string[];
  };
  forensicSummary: string;
}

const SOURCE_CATEGORIES = [
  { id: "search_engines", label: "Search Engines", sources: ["Google Images", "Bing Visual", "Yandex", "TinEye"] },
  { id: "face_specific", label: "Face Search", sources: ["PimEyes", "FaceCheck.ID", "Search4Faces"] },
  { id: "social_media", label: "Social Media", sources: ["Facebook", "Instagram", "LinkedIn", "X/Twitter", "TikTok"] },
  { id: "professional", label: "Professional", sources: ["LinkedIn", "Crunchbase", "Speaker Bureaus"] },
  { id: "news_media", label: "News & Media", sources: ["GDELT", "NewsAPI", "MediaCloud"] },
  { id: "video_platforms", label: "Video Platforms", sources: ["YouTube", "Vimeo", "TikTok"] },
  { id: "public_records", label: "Public Records", sources: ["Mugshots", "Court Records", "Sex Offender Registry", "Voter Records"] },
];

export default function FaceRecognitionView() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [analysis, setAnalysis] = useState<FaceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabledSources, setEnabledSources] = useState<string[]>(SOURCE_CATEGORIES.map(c => c.id));
  const [matchThreshold, setMatchThreshold] = useState(0.65);
  const [excludeAdult, setExcludeAdult] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!photo) return;
    setAnalyzing(true);
    setAnalysis(null);
    setError(null);
    setProgress(0);

    // Phased progress simulation while edge function executes
    const phases = [
      { pct: 10, label: "Detecting faces…" },
      { pct: 22, label: "Extracting 68-point landmarks…" },
      { pct: 35, label: "Computing 512-dim face encoding…" },
      { pct: 48, label: "Measuring biometric features…" },
      { pct: 60, label: "Scanning search engines…" },
      { pct: 72, label: "Querying social media graph…" },
      { pct: 84, label: "Cross-referencing public records…" },
      { pct: 92, label: "Verifying matches & filtering false positives…" },
    ];
    let phaseIdx = 0;
    const tick = setInterval(() => {
      if (phaseIdx < phases.length) {
        setProgress(phases[phaseIdx].pct);
        setPhase(phases[phaseIdx].label);
        phaseIdx++;
      }
    }, 700);

    try {
      // Convert image to base64
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(photo);
      });

      const { data, error: invErr } = await supabase.functions.invoke("zophiel-face-recognition", {
        body: {
          imageBase64: b64,
          mimeType: photo.type,
          options: {
            sources: enabledSources,
            matchThreshold,
            excludeAdult,
          },
        },
      });

      clearInterval(tick);
      setProgress(100);
      setPhase("Complete");

      if (invErr) throw invErr;
      if (!data?.success) throw new Error(data?.error || "Face analysis failed");

      setAnalysis(data.analysis as FaceAnalysis);
    } catch (e: any) {
      clearInterval(tick);
      console.error("[face-recognition]", e);
      setError(e?.message || "Face recognition failed. Try again with a clearer photo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSource = (id: string) => {
    setEnabledSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Scan className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Face Recognition Engine</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Upload a photo — extract biometric signature, scan {SOURCE_CATEGORIES.length} source categories,
            verify matches with multi-algorithm ensemble (embedding + landmark + biometric + visual SSIM).
          </p>
        </div>
      </div>

      {/* Dropzone / preview */}
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

              {/* Source toggles */}
              <div className="mt-3">
                <p className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground/50 mb-2">
                  Search Sources ({enabledSources.length}/{SOURCE_CATEGORIES.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCE_CATEGORIES.map(c => {
                    const on = enabledSources.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        disabled={analyzing}
                        onClick={() => toggleSource(c.id)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                          on
                            ? "border-accent/40 bg-accent/15 text-accent"
                            : "border-border/30 bg-background/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Threshold + privacy */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/60">Match threshold</span>
                  <input
                    type="range"
                    min={0.4}
                    max={0.95}
                    step={0.05}
                    value={matchThreshold}
                    disabled={analyzing}
                    onChange={(e) => setMatchThreshold(Number(e.target.value))}
                    className="accent-accent w-24"
                  />
                  <span className="text-[10px] font-mono text-accent">{Math.round(matchThreshold * 100)}%</span>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeAdult}
                    disabled={analyzing}
                    onChange={(e) => setExcludeAdult(e.target.checked)}
                    className="accent-accent"
                  />
                  Exclude adult content
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={runAnalysis}
                disabled={analyzing || enabledSources.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 px-3 py-1.5 text-[11px] font-light text-accent transition-colors disabled:opacity-30"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {analyzing ? "Scanning…" : "Run Recognition"}
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

          {/* Progress */}
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

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs font-light text-destructive">{error}</p>
        </div>
      )}

      {/* Analysis results */}
      {analysis && <AnalysisReport analysis={analysis} />}
    </div>
  );
}

function AnalysisReport({ analysis }: { analysis: FaceAnalysis }) {
  const { primaryFace, matches, stats, forensicSummary } = analysis;
  const bio = primaryFace.biometrics;
  const q = primaryFace.photoQuality;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-medium tracking-wider uppercase text-foreground">Forensic Summary</h3>
        </div>
        <p className="text-xs font-light leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {forensicSummary}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard icon={Scan} label="Faces Detected" value={analysis.facesDetected} />
        <StatCard icon={Globe} label="Total Matches" value={stats.totalMatches} />
        <StatCard icon={CheckCircle2} label="High Confidence" value={stats.highConfidenceMatches} accent />
        <StatCard icon={ShieldCheck} label="Sources Scanned" value={stats.sourcesScanned.length} />
      </div>

      {/* Biometric panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section icon={Ruler} title="Biometric Measurements">
          <Field label="Interpupillary distance" value={`${bio.measurements.interpupillaryDistance.toFixed(1)} px`} />
          <Field label="Nose width" value={`${bio.measurements.noseWidth.toFixed(1)} px`} />
          <Field label="Mouth width" value={`${bio.measurements.mouthWidth.toFixed(1)} px`} />
          <Field label="Face width / height" value={`${bio.measurements.faceWidth.toFixed(0)} × ${bio.measurements.faceHeight.toFixed(0)} px`} />
          <Field label="Jaw width" value={`${bio.measurements.jawWidth.toFixed(1)} px`} />
          <Field label="Forehead height" value={`${bio.measurements.foreheadHeight.toFixed(1)} px`} />
        </Section>

        <Section icon={Fingerprint} title="Unique Identifiers">
          <Field label="Estimated age" value={`${bio.estimatedAge.most_likely} (${bio.estimatedAge.min}–${bio.estimatedAge.max})`} />
          <Field label="Gender" value={`${bio.estimatedGender.prediction} · ${Math.round(bio.estimatedGender.confidence * 100)}%`} />
          <Field label="Hair / eye color" value={`${bio.uniqueFeatures.hairColor} / ${bio.uniqueFeatures.eyeColor}`} />
          <Field label="Skin tone" value={bio.uniqueFeatures.skinTone} />
          <Field label="Glasses" value={bio.uniqueFeatures.hasGlasses ? "Yes" : "No"} />
          <Field label="Facial hair" value={bio.uniqueFeatures.hasFacialHair ? bio.uniqueFeatures.facialHairType || "Yes" : "None"} />
          <Field label="Distinguishing marks" value={[
            bio.uniqueFeatures.hasMole && "mole",
            bio.uniqueFeatures.hasScar && "scar",
            bio.uniqueFeatures.hasTattoo && "tattoo",
          ].filter(Boolean).join(", ") || "None detected"} />
        </Section>

        <Section icon={Eye} title="Photo Quality">
          <Field label="Overall quality" value={`${q.overallQuality}/100`} />
          <Field label="Lighting" value={q.lighting} />
          <Field label="Sharpness" value={`${Math.round(q.sharpness)}%`} />
          <Field label="Blur" value={`${Math.round(q.blur)}%`} />
          <Field label="Occlusion" value={`${Math.round(q.occlusion)}%`} />
          <Field label="Pose (pitch/yaw/roll)" value={`${q.faceAngle.pitch.toFixed(0)}° / ${q.faceAngle.yaw.toFixed(0)}° / ${q.faceAngle.roll.toFixed(0)}°`} />
        </Section>

        <Section icon={Sparkles} title="Context">
          <Field label="Background" value={primaryFace.context.backgroundType} />
          <Field label="Setting" value={primaryFace.context.indoorOutdoor} />
          <Field label="Other people in frame" value={String(primaryFace.context.otherPeople)} />
          <Field label="Sources scanned" value={stats.sourcesScanned.slice(0, 4).join(", ") + (stats.sourcesScanned.length > 4 ? "…" : "")} />
        </Section>
      </div>

      {/* Matches */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium tracking-wider uppercase text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            Cross-Source Matches
          </h3>
          <span className="text-[10px] text-muted-foreground/60">
            {stats.highConfidenceMatches} high · {stats.mediumConfidenceMatches} med · {stats.lowConfidenceMatches} low
          </span>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-xl border border-border/20 bg-card/20 p-6 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs font-light text-muted-foreground">
              No matches above threshold across the {stats.sourcesScanned.length} sources scanned.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? "border-accent/30 bg-accent/5" : "border-border/20 bg-card/20"} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${accent ? "text-accent" : "text-muted-foreground/60"}`} />
        <span className="text-[9px] font-medium tracking-wider uppercase text-muted-foreground/60">{label}</span>
      </div>
      <p className={`text-lg font-light ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/20 bg-card/20 p-3">
      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/20">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <span className="text-[10px] font-medium tracking-wider uppercase text-foreground">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground/60 font-extralight">{label}</span>
      <span className="text-foreground font-light text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function MatchCard({ match }: { match: FaceAnalysis["matches"][number] }) {
  const conf = match.matchConfidence;
  const tone = conf >= 90 ? "high" : conf >= 70 ? "med" : "low";
  const toneClasses = {
    high: "border-accent/40 bg-accent/5",
    med: "border-amber-500/30 bg-amber-500/5",
    low: "border-border/20 bg-card/20",
  }[tone];
  const confColor = {
    high: "text-accent",
    med: "text-amber-400",
    low: "text-muted-foreground",
  }[tone];

  return (
    <div className={`rounded-xl border ${toneClasses} p-3 hover:border-accent/40 transition-colors`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground/60">
              {match.sourceCategory}
            </span>
            <span className="text-[10px] text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground/60">{match.source}</span>
            {match.verified && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-accent">
                <CheckCircle2 className="h-2.5 w-2.5" /> verified
              </span>
            )}
          </div>
          <a
            href={match.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-light text-foreground hover:text-accent transition-colors flex items-center gap-1 truncate"
          >
            {match.context.pageTitle}
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
          </a>
          <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-2">
            {match.context.surroundingText}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/50">
            <span className="truncate">{match.website}</span>
            {match.context.publishDate && (
              <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{match.context.publishDate}</span>
            )}
            {match.context.location && (
              <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{match.context.location}</span>
            )}
            {match.falsePositiveProbability > 0.3 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                FP risk {Math.round(match.falsePositiveProbability * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-light ${confColor}`}>{conf}%</p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">match</p>
        </div>
      </div>
    </div>
  );
}
