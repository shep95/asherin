import { useState, useRef } from "react";
import { Upload, MapPin, Target, Shield, Eye, Loader2, Copy, Check, AlertTriangle, X, Crosshair, Clock, Compass, User, Search, Users, GitBranch, ChevronRight, CheckCircle2, Info, ExternalLink, Globe, Navigation, Sun, ListChecks, Layers, ShieldQuestion } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractExifFacts, type ExifFacts } from "@/lib/imagine/exif";
import LocationMapPanel from "./search/LocationMapPanel";
import LinkedImageryMap, { type ImageryDataPoint } from "./search/LinkedImageryMap";

// ─── GEO ANALYSIS TYPES ───
interface PersonAnalysis {
  person_id: number;
  facing_direction: string;
  travel_direction: string;
  confidence: number;
  description: string;
}

interface TimeEstimation {
  estimated_local_time: string;
  time_confidence: number;
  shadow_analysis: string;
  shadow_direction?: string | null;
  estimated_season: string;
  sun_position: string;
  capture_date_estimate?: string | null;
}

// ─── EVIDENCE PIPELINE TYPES (Imagine v2) ───
type EvidenceWeight = "decisive" | "strong" | "moderate" | "weak";

interface Observable {
  where: string;
  reading: string;
  inference: string;
  weight: EvidenceWeight;
}

interface Correlation {
  observable: string;
  referent: string;
  eliminates: string;
  strength: EvidenceWeight;
  pivot_query?: string | null;
}

interface Hypothesis {
  label: string;
  latitude: number;
  longitude: number;
  probability: number;
  supporting_observables?: number[];
  wrong_if?: string;
  next_check?: string;
}

interface SolarVerification {
  checked: boolean;
  consistent: boolean | null;
  confidenceDelta: number;
  sunElevationDeg?: number;
  sunAzimuthDeg?: number;
  expectedShadowBearingDeg?: number;
  claimedShadowBearingDeg?: number;
  bearingErrorDeg?: number;
  verdict: string;
}

interface AnalysisResult {
  status: "SUCCESS" | "AMBIGUOUS" | "FAILURE";
  estimated_location: { latitude: number; longitude: number };
  confidence_score: number;
  error_radius_meters: number;
  most_probable_macro_region: string;
  rationale: string[];
  identified_features: { type: string; detail: string }[];
  potential_alternative_locations: { region: string; confidence: number }[];
  address_estimate?: string | null;
  time_estimation?: TimeEstimation;
  person_analysis?: PersonAnalysis[];
  insufficient_data?: boolean;
  insufficient_data_reason?: string;
  observables?: Observable[];
  correlations?: Correlation[];
  hypotheses?: Hypothesis[];
  self_consistency?: string;
  solar_verification?: SolarVerification;
  adjudication_notes?: string[];
  location_source?: "exif_gps" | "visual_inference";
}

// ─── FACE SEARCH TYPES ───
interface MatchSource {
  platform: string;
  url: string;
  confidence: number;
  data_type: string;
}

interface MatchProfile {
  full_name?: string;
  occupation?: string;
  education?: string;
  languages?: string[];
  interests?: string[];
  social_presence?: string[];
  bio?: string;
  photo_description?: string;
}

interface FaceMatch {
  match_id: number;
  name_alias?: string;
  similarity_score: number;
  genetic_similarity?: number;
  location: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  estimated_relationship: string;
  ancestry_overlap: number;
  age_similarity: number;
  estimated_age_range?: string;
  shared_features: string[];
  generation_gap: number;
  family_branch: string;
  profile_summary?: string;
  profile?: MatchProfile;
  sources?: MatchSource[];
  photo_url?: string;
}

interface InterMatchConnection {
  match_a_id: number;
  match_b_id: number;
  connection_type: string;
  shared_genetic_markers: number;
  evidence: string;
  confidence: number;
}

interface RealSource {
  title: string;
  url: string;
  snippet: string;
  relevance?: string;
}

interface FaceSearchResult {
  status: "SUCCESS" | "INVALID_PHOTO";
  reason?: string;
  tips?: string[];
  subject_analysis?: {
    estimated_age_range: string;
    estimated_ethnicity: string;
    distinctive_features: string[];
    face_quality_score: number;
    face_symmetry: number;
    genetic_markers?: string[];
    heritage_indicators?: string;
  };
  matches?: FaceMatch[];
  inter_match_connections?: InterMatchConnection[];
  heritage_narrative?: string;
  real_sources?: RealSource[];
  family_tree?: {
    common_ancestor_estimate: string;
    probable_origin_region?: string;
    migration_pattern?: string;
    branches: {
      branch_name: string;
      region: string;
      match_count: number;
      avg_similarity: number;
      heritage_note?: string;
    }[];
  };
  search_metadata?: {
    region_searched: string;
    web_sources_found?: number;
    images_found?: number;
    total_faces_scanned?: number;
    matches_found?: number;
    scan_time_ms?: number;
    databases_checked?: string[];
    search_queries_used?: string[];
    genetic_databases_checked?: number;
    cross_reference_passes?: number;
  };
}

const statusConfig = {
  SUCCESS: { color: "text-emerald-400 bg-emerald-500/10", icon: Target },
  AMBIGUOUS: { color: "text-amber-400 bg-amber-500/10", icon: AlertTriangle },
  FAILURE: { color: "text-red-400 bg-red-500/10", icon: X },
};

const featureTypeColors: Record<string, string> = {
  architecture: "bg-blue-500/20 text-blue-400",
  vegetation: "bg-emerald-500/20 text-emerald-400",
  infrastructure: "bg-amber-500/20 text-amber-400",
  signage: "bg-purple-500/20 text-purple-400",
  terrain: "bg-orange-500/20 text-orange-400",
  climate: "bg-cyan-500/20 text-cyan-400",
  vehicle: "bg-pink-500/20 text-pink-400",
  default: "bg-muted/30 text-muted-foreground",
};

const relationshipColors: Record<string, string> = {
  "sibling-like": "text-red-400 bg-red-500/10",
  "1st cousin": "text-orange-400 bg-orange-500/10",
  "2nd-3rd cousin": "text-amber-400 bg-amber-500/10",
  "distant relative": "text-blue-400 bg-blue-500/10",
  "unrelated lookalike": "text-muted-foreground bg-muted/20",
};

const OracleLocusView = () => {
  const { toast } = useToast();

  // ── GEO TAB STATE ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("image/jpeg");
  // Stage 1 (STRIP): metadata read on-device before anything is sent upstream.
  const [exifFacts, setExifFacts] = useState<ExifFacts | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<{ image: string; result: AnalysisResult }[]>([]);
  // Slide-out dark-theme map (with directions) — opened from the coordinates block.
  const [mapDestination, setMapDestination] = useState<string | null>(null);
  // Persistent multi-image data points plotted on the Linked Imagery mini-map.
  const [dataPoints, setDataPoints] = useState<ImageryDataPoint[]>([]);

  // ── FACE SEARCH STATE ──
  const faceInputRef = useRef<HTMLInputElement>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [faceBase64, setFaceBase64] = useState<string | null>(null);
  const [faceType, setFaceType] = useState<string>("image/jpeg");
  const [targetLocation, setTargetLocation] = useState("");
  const [faceStep, setFaceStep] = useState<"upload" | "location" | "consent" | "analyzing" | "results">("upload");
  const [faceResult, setFaceResult] = useState<FaceSearchResult | null>(null);
  const [consentChecked, setConsentChecked] = useState({ facial: false, match: false });
  const [selectedMatch, setSelectedMatch] = useState<FaceMatch | null>(null);

  // ── SHARED HELPERS ──
  const processImageFile = (file: File, target: "geo" | "face") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (target === "geo") {
        setImagePreview(dataUrl);
        setImageBase64(base64);
        setImageType(file.type);
        setResult(null);
        setExifFacts(null);
        // Fire-and-forget: EXIF never blocks the preview, and a parse failure
        // degrades to content-only analysis instead of breaking the upload.
        void extractExifFacts(file)
          .then(setExifFacts)
          .catch(() => setExifFacts(null));
      } else {
        setFacePreview(dataUrl);
        setFaceBase64(base64);
        setFaceType(file.type);
        setFaceStep("location");
        setFaceResult(null);
        setSelectedMatch(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── GEO HANDLERS ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file, "geo");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file, "geo");
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processImageFile(file, "geo");
        return;
      }
    }
  };

  const analyzeImage = async () => {
    if (!imageBase64) return;
    setAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-locus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          image_type: imageType,
          // Stage 1 evidence travels with the frame so the adjudicator can rank
          // hard metadata above its own inference.
          exif: exifFacts
            ? {
                hasExif: exifFacts.hasExif,
                gps: exifFacts.gps,
                capturedAtLocal: exifFacts.capturedAtLocal,
                capturedAtUtc: exifFacts.capturedAtUtc,
                make: exifFacts.make,
                model: exifFacts.model,
                software: exifFacts.software,
                focalLengthMm: exifFacts.focalLengthMm,
                orientation: exifFacts.orientation,
                notes: exifFacts.notes,
              }
            : null,
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      if (imagePreview) {
        setHistory(prev => [{ image: imagePreview, result: data }, ...prev].slice(0, 20));
        // Plot this analysis on the Linked Imagery mini-map (if coords are present)
        const lat = data?.estimated_location?.latitude;
        const lon = data?.estimated_location?.longitude;
        if (typeof lat === "number" && typeof lon === "number" && !data.insufficient_data) {
          // Try to extract city/region/country from address_estimate ("City, Region, Country")
          const parts = (data.address_estimate || data.most_probable_macro_region || "")
            .split(",").map((s: string) => s.trim()).filter(Boolean);
          const country = parts[parts.length - 1];
          const region  = parts.length >= 2 ? parts[parts.length - 2] : undefined;
          const city    = parts.length >= 3 ? parts[parts.length - 3] : (parts.length === 2 ? parts[0] : undefined);
          setDataPoints(prev => {
            const next: ImageryDataPoint = {
              id: `pt-${Date.now()}`,
              imageDataUrl: imagePreview,
              latitude: lat,
              longitude: lon,
              city, region, country,
              address: data.address_estimate ?? null,
              confidence: data.confidence_score,
              timestamp: Date.now(),
              label: `Image ${prev.length + 1}`,
            };
            return [...prev, next];
          });
        }
      }
    } catch (err) {
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── FACE SEARCH HANDLERS ──
  const handleFaceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file, "face");
  };

  const handleFaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file, "face");
  };

  const handleFacePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processImageFile(file, "face");
        return;
      }
    }
  };

  const startFaceSearch = async () => {
    if (!faceBase64 || !targetLocation.trim()) return;
    setFaceStep("analyzing");
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-face-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ image_base64: faceBase64, image_type: faceType, target_location: targetLocation }),
      });
      if (!res.ok) throw new Error("Face search failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFaceResult(data);
      setFaceStep("results");
    } catch (err) {
      toast({ title: "Face search failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setFaceStep("consent");
    }
  };

  const resetFaceSearch = () => {
    setFacePreview(null);
    setFaceBase64(null);
    setTargetLocation("");
    setFaceStep("upload");
    setFaceResult(null);
    setConsentChecked({ facial: false, match: false });
    setSelectedMatch(null);
    if (faceInputRef.current) faceInputRef.current.value = "";
  };

  const hasCoords = !!result?.estimated_location && typeof result.estimated_location.latitude === "number" && typeof result.estimated_location.longitude === "number";
  const coordsText = hasCoords ? `${result!.estimated_location.latitude.toFixed(6)}, ${result!.estimated_location.longitude.toFixed(6)}` : "";
  const googleMapsUrl = hasCoords ? `https://www.google.com/maps?q=${result!.estimated_location.latitude},${result!.estimated_location.longitude}` : "";

  return (
    <div className="flex flex-1 flex-col h-full" tabIndex={0}>
      {/* Modern minimal header — matches Zophiel theme */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
              <Crosshair className="h-4 w-4 text-accent" />
              <div className="absolute inset-0 rounded-xl bg-accent/10 blur-md -z-10" />
            </div>
            <div>
              <h1 className="text-sm font-light tracking-[0.2em] text-foreground uppercase">Imagine Intelligence</h1>
              <p className="text-[10px] font-extralight text-muted-foreground/70 tracking-wide mt-0.5">
                Geo-locate · Extract metadata · Forensic visual analysis
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-1">
            <Shield className="h-3 w-3 text-emerald-400/80" />
            <span className="text-[9px] text-emerald-300/80 tracking-[0.15em] uppercase font-light">Secure</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="geo" className="flex flex-1 flex-col min-h-0">
        {/* Face Intel removed — geo is the only public mode */}
        <TabsList className="hidden">
          <TabsTrigger value="geo">Geo</TabsTrigger>
          <TabsTrigger value="face">Face</TabsTrigger>
        </TabsList>

        {/* ════════════════ GEO ANALYSIS TAB ════════════════ */}
        <TabsContent value="geo" className="flex-1 min-h-0 mt-0" onPaste={handlePaste}>
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* Upload Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="relative rounded-2xl border-2 border-dashed border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden transition-colors hover:border-accent/30"
              >
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Target subject uploaded for locus analysis" className="w-full max-h-[400px] object-contain bg-black/20" />
                    <button onClick={clearImage} className="absolute top-3 right-3 rounded-lg bg-card/80 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                    {!analyzing && !result && (
                      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                        <button onClick={analyzeImage} className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-sm font-light tracking-wider hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                          <Eye className="h-4 w-4" />ANALYZE LOCATION
                        </button>
                      </div>
                    )}
                    {analyzing && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <p className="text-sm font-extralight text-foreground tracking-wider">RUNNING GEO-ANALYSIS…</p>
                        <p className="text-[10px] text-muted-foreground">Scanning visual features · Cross-referencing database</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-20 flex flex-col items-center gap-4 cursor-pointer">
                    <Upload className="h-12 w-12 text-muted-foreground/20" />
                    <div className="text-center">
                      <p className="text-sm font-extralight text-muted-foreground">Drop, paste (Ctrl+V), or click to upload an image</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">JPG, PNG, WebP · Max 20MB · Clipboard paste supported</p>
                    </div>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>

              {/* ─── LINKED IMAGERY MINI-MAP ─────────────────────────────
                  Every analyzed image is plotted as a numbered data point with
                  thumbnail + city / region / country. Points are connected in
                  chronological order so the operator can see the link pattern. */}
              <LinkedImageryMap points={dataPoints} height={300} />

              {/* Quick controls — add another image to the link chain, or reset */}
              {dataPoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => { clearImage(); fileInputRef.current?.click(); }}
                    className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-[11px] font-light tracking-[0.18em] uppercase text-accent hover:bg-accent/20 transition-colors flex items-center gap-2"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Add Another Image
                  </button>
                  <button
                    onClick={() => setDataPoints([])}
                    className="rounded-xl border border-border/30 bg-card/10 px-4 py-2 text-[11px] font-light tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear Map
                  </button>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {dataPoints.length} linked data point{dataPoints.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                  {result.insufficient_data && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-amber-500/10 p-2.5"><AlertTriangle className="h-5 w-5 text-amber-400" /></div>
                        <div>
                          <p className="text-sm font-light text-foreground">Insufficient Geographic Data</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Oracle-Locus could not extract enough visual cues</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-card/20 p-4">
                        <p className="text-xs font-light text-foreground/80 leading-relaxed">{result.insufficient_data_reason || "The uploaded image does not contain enough identifiable geographic features for analysis."}</p>
                      </div>
                      <div className="rounded-xl bg-card/10 p-3">
                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-2">For best results, use images containing:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Buildings", "Street signs", "Roads", "Landscapes", "Vehicles", "Vegetation", "Infrastructure"].map(tip => (
                            <span key={tip} className="text-[10px] px-2 py-1 rounded-lg bg-accent/10 text-accent">{tip}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={clearImage} className="w-full rounded-xl border border-border/20 bg-card/10 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors tracking-wider">TRY ANOTHER IMAGE</button>
                    </div>
                  )}

                  {!result.insufficient_data && (
                    <>
                      {/* Status & Coordinates */}
                      <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {(() => { const S = statusConfig[result.status]; return <S.icon className={`h-4 w-4 ${S.color.split(" ")[0]}`} />; })()}
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg ${statusConfig[result.status].color}`}>{result.status}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{result.most_probable_macro_region}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-card/30 p-3 text-center">
                            <p className="text-2xl font-extralight text-foreground">{result.confidence_score}%</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Confidence</p>
                          </div>
                          <div className="rounded-xl bg-card/30 p-3 text-center">
                            <p className="text-2xl font-extralight text-foreground">{result.error_radius_meters < 1000 ? `${result.error_radius_meters}m` : `${(result.error_radius_meters / 1000).toFixed(1)}km`}</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Error Radius</p>
                          </div>
                          <div className="rounded-xl bg-card/30 p-3 text-center">
                            <p className="text-2xl font-extralight text-foreground">{result.identified_features.length}</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Features Found</p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/10 bg-card/10 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-accent" />
                              <span className="text-xs font-light text-foreground">Estimated Coordinates</span>
                            </div>
                            <button onClick={() => copyToClipboard(coordsText, "coords")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                              {copied === "coords" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              {copied === "coords" ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-lg font-mono font-extralight text-foreground tracking-wider">{coordsText}</p>
                          {result.address_estimate && <p className="text-xs text-muted-foreground">{result.address_estimate}</p>}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={() => setMapDestination(result.address_estimate || coordsText)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/25 bg-foreground/[0.08] hover:bg-foreground/[0.14] hover:border-foreground/40 px-2.5 py-1 text-[10px] font-light text-foreground transition-colors"
                              title="View on dark-theme map · Get directions from your location"
                            >
                              <Navigation className="h-3 w-3" /> View map · Directions
                            </button>
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border/25 bg-card/40 hover:bg-foreground/[0.06] hover:border-border/40 px-2.5 py-1 text-[10px] font-light text-muted-foreground/80 hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" /> Google Maps
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* ── EVIDENCE PIPELINE: STAGE 1 STRIP ── */}
                      {(exifFacts || result.location_source) && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Stage 1 · Metadata Strip</p>
                            {result.location_source === "exif_gps" && (
                              <span className="rounded-md border border-foreground/20 bg-foreground/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-foreground/80">Hard GPS fix</span>
                            )}
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {exifFacts?.gps && (
                              <p className="text-[11px] font-light text-foreground/80">GPS · {exifFacts.gps.latitude.toFixed(6)}, {exifFacts.gps.longitude.toFixed(6)}</p>
                            )}
                            {exifFacts?.capturedAtUtc && <p className="text-[11px] font-light text-foreground/70">Captured (UTC) · {exifFacts.capturedAtUtc}</p>}
                            {exifFacts?.capturedAtLocal && <p className="text-[11px] font-light text-foreground/70">Captured (local) · {exifFacts.capturedAtLocal}</p>}
                            {(exifFacts?.make || exifFacts?.model) && (
                              <p className="text-[11px] font-light text-foreground/70">Device · {[exifFacts?.make, exifFacts?.model].filter(Boolean).join(" ")}</p>
                            )}
                            {exifFacts?.focalLengthMm && <p className="text-[11px] font-light text-foreground/70">Focal length · {exifFacts.focalLengthMm} mm</p>}
                          </div>
                          {(exifFacts?.notes || []).map((n, i) => (
                            <p key={i} className="text-[10px] font-light text-muted-foreground/80 leading-relaxed">{n}</p>
                          ))}
                        </div>
                      )}

                      {/* ── STAGE 2: CITED OBSERVABLES ── */}
                      {Array.isArray(result.observables) && result.observables.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Stage 2 · Cited Observables</p>
                            <span className="text-[10px] font-mono text-muted-foreground/60">{result.observables.length}</span>
                          </div>
                          <div className="space-y-2">
                            {result.observables.map((o, i) => (
                              <div key={i} className="rounded-xl border border-border/10 bg-background/30 p-3 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[9px] font-mono text-muted-foreground/60">{String(i).padStart(2, "0")}</span>
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                                    o.weight === "decisive" ? "bg-foreground/[0.12] text-foreground"
                                    : o.weight === "strong" ? "bg-foreground/[0.08] text-foreground/85"
                                    : o.weight === "moderate" ? "bg-foreground/[0.05] text-foreground/70"
                                    : "bg-foreground/[0.03] text-muted-foreground"}`}>{o.weight}</span>
                                  <span className="text-[10px] font-light text-muted-foreground/70">{o.where}</span>
                                </div>
                                <p className="text-xs font-light text-foreground/85 leading-relaxed">{o.reading}</p>
                                <p className="text-[11px] font-light text-muted-foreground/80 leading-relaxed">→ {o.inference}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── STAGE 3: CORRELATIONS ── */}
                      {Array.isArray(result.correlations) && result.correlations.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Stage 3 · Correlation Bridge</p>
                          </div>
                          <div className="space-y-2">
                            {result.correlations.map((c, i) => (
                              <div key={i} className="rounded-xl border border-border/10 bg-background/30 p-3 space-y-1">
                                <p className="text-xs font-light text-foreground/85">{c.observable} <span className="text-muted-foreground/50">→</span> {c.referent}</p>
                                <p className="text-[10px] font-light text-muted-foreground/75">Eliminates · {c.eliminates}</p>
                                {c.pivot_query && (
                                  <p className="text-[10px] font-mono text-foreground/70">Pivot · {c.pivot_query}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── STAGE 4: RANKED HYPOTHESES ── */}
                      {Array.isArray(result.hypotheses) && result.hypotheses.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldQuestion className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Stage 4 · Ranked Hypotheses</p>
                          </div>
                          <div className="space-y-2">
                            {result.hypotheses.map((h, i) => (
                              <div key={i} className={`rounded-xl border p-3 space-y-1.5 ${i === 0 ? "border-foreground/25 bg-foreground/[0.05]" : "border-border/10 bg-background/30"}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-light text-foreground">{i + 1}. {h.label}</p>
                                  <span className="text-xs font-mono text-foreground/85">{h.probability}%</span>
                                </div>
                                <p className="text-[10px] font-mono text-muted-foreground/70">{Number(h.latitude).toFixed(5)}, {Number(h.longitude).toFixed(5)}</p>
                                {h.wrong_if && <p className="text-[11px] font-light text-muted-foreground/85 leading-relaxed">Wrong if · {h.wrong_if}</p>}
                                {h.next_check && <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">Next check · {h.next_check}</p>}
                                <button
                                  onClick={() => setMapDestination(`${h.latitude},${h.longitude}`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/25 bg-card/40 hover:bg-foreground/[0.06] px-2.5 py-1 text-[10px] font-light text-muted-foreground/80 hover:text-foreground transition-colors"
                                >
                                  <Navigation className="h-3 w-3" /> Plot this hypothesis
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── STAGE 5: ASTRONOMICAL VALIDATION ── */}
                      {result.solar_verification?.checked && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-2">
                          <div className="flex items-center gap-2">
                            <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Stage 5 · Astronomical Validation</p>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                              result.solar_verification.consistent === true ? "bg-foreground/[0.1] text-foreground"
                              : result.solar_verification.consistent === false ? "bg-destructive/15 text-destructive"
                              : "bg-foreground/[0.04] text-muted-foreground"}`}>
                              {result.solar_verification.consistent === true ? "Consistent" : result.solar_verification.consistent === false ? "Contradicted" : "Marginal"}
                            </span>
                          </div>
                          <div className="grid gap-1 sm:grid-cols-3">
                            <p className="text-[11px] font-light text-muted-foreground/80">Sun elevation · {result.solar_verification.sunElevationDeg}°</p>
                            <p className="text-[11px] font-light text-muted-foreground/80">Sun azimuth · {result.solar_verification.sunAzimuthDeg}°</p>
                            {result.solar_verification.expectedShadowBearingDeg !== undefined && (
                              <p className="text-[11px] font-light text-muted-foreground/80">Expected shadow · {result.solar_verification.expectedShadowBearingDeg}°</p>
                            )}
                          </div>
                          <p className="text-[11px] font-light text-foreground/80 leading-relaxed">{result.solar_verification.verdict}</p>
                        </div>
                      )}

                      {/* ── ADJUDICATION AUDIT TRAIL ── */}
                      {Array.isArray(result.adjudication_notes) && result.adjudication_notes.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-2">
                          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Adjudication Audit Trail</p>
                          {result.adjudication_notes.map((n, i) => (
                            <p key={i} className="text-[11px] font-light text-muted-foreground/85 leading-relaxed">· {n}</p>
                          ))}
                        </div>
                      )}

                      {result.self_consistency && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-2">
                          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Overhead Self-Consistency</p>
                          <p className="text-xs font-light text-foreground/80 leading-relaxed">{result.self_consistency}</p>
                        </div>
                      )}

                      {/* Rationale */}
                      <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Analysis Rationale</p>
                        <div className="space-y-2">
                          {result.rationale.map((r, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="text-[9px] text-accent font-mono mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                              <p className="text-xs font-light text-foreground/80 leading-relaxed">{r}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Identified Features */}
                      {result.identified_features.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Identified Features</p>
                          <div className="flex flex-wrap gap-2">
                            {result.identified_features.map((f, i) => (
                              <div key={i} className={`rounded-lg px-3 py-1.5 text-[10px] ${featureTypeColors[f.type] || featureTypeColors.default}`}>
                                <span className="uppercase tracking-wider opacity-60">{f.type}</span>
                                <span className="mx-1.5 opacity-30">·</span>
                                <span>{f.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Time Estimation */}
                      {result.time_estimation && result.time_estimation.time_confidence > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-accent" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Time & Shadow Analysis</p>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-card/30 p-3 text-center">
                              <p className="text-lg font-mono font-extralight text-foreground">{result.time_estimation.estimated_local_time}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">Est. Local Time</p>
                            </div>
                            <div className="rounded-xl bg-card/30 p-3 text-center">
                              <p className="text-lg font-extralight text-foreground">{result.time_estimation.time_confidence}%</p>
                              <p className="text-[9px] text-muted-foreground mt-1">Time Confidence</p>
                            </div>
                            <div className="rounded-xl bg-card/30 p-3 text-center">
                              <p className="text-lg font-extralight text-foreground">{result.time_estimation.estimated_season}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">Season</p>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/10 bg-card/10 p-3 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Sun Position</p>
                            <p className="text-xs font-light text-foreground/80">{result.time_estimation.sun_position}</p>
                          </div>
                          <div className="rounded-xl border border-border/10 bg-card/10 p-3 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Shadow Analysis</p>
                            <p className="text-xs font-light text-foreground/80 leading-relaxed">{result.time_estimation.shadow_analysis}</p>
                          </div>
                        </div>
                      )}

                      {/* Person Direction Analysis */}
                      {result.person_analysis && result.person_analysis.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Compass className="h-3.5 w-3.5 text-accent" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Person Direction Analysis ({result.person_analysis.length})</p>
                          </div>
                          <div className="space-y-2">
                            {result.person_analysis.map((p) => (
                              <div key={p.person_id} className="rounded-xl border border-border/10 bg-card/10 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-light text-foreground">Person {p.person_id}</span>
                                    <span className="text-[10px] text-muted-foreground">{p.confidence}% conf.</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-lg bg-card/30 px-3 py-2">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Facing</p>
                                    <p className="text-sm font-mono font-extralight text-foreground">{p.facing_direction}</p>
                                  </div>
                                  <div className="rounded-lg bg-card/30 px-3 py-2">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Traveling</p>
                                    <p className="text-sm font-mono font-extralight text-foreground">{p.travel_direction}</p>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground/70 mt-2">{p.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternative Locations */}
                      {result.potential_alternative_locations.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3">
                          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Alternative Locations</p>
                          <div className="space-y-2">
                            {result.potential_alternative_locations.map((alt, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl bg-card/20 px-4 py-2.5">
                                <span className="text-xs font-light text-foreground">{alt.region}</span>
                                <span className="text-[10px] text-muted-foreground">{alt.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button onClick={clearImage} className="w-full rounded-xl border border-border/20 bg-card/10 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors tracking-wider">ANALYZE NEW IMAGE</button>
                    </>
                  )}
                </div>
              )}

              {/* History */}
              {history.length > 0 && !result && !imagePreview && (
                <div className="space-y-3">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Recent Analyses</p>
                  <div className="grid grid-cols-2 gap-3">
                    {history.map((h, i) => (
                      <button key={i} onClick={() => { setImagePreview(h.image); setImageBase64(h.image.split(",")[1]); setResult(h.result); }}
                        className="rounded-xl border border-border/10 bg-card/10 overflow-hidden hover:border-accent/20 transition-colors text-left">
                        <img src={h.image} alt="Previous locus analysis target" className="w-full h-24 object-cover" />
                        <div className="p-2.5">
                          <p className="text-[10px] text-foreground truncate">{h.result.most_probable_macro_region}</p>
                          <p className="text-[9px] text-muted-foreground">{h.result.confidence_score}% · {h.result.status}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ════════════════ FACE SEARCH TAB ════════════════ */}
        <TabsContent value="face" className="flex-1 min-h-0 mt-0" onPaste={handleFacePaste}>
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">

              {/* Step Progress Bar */}
              <div className="flex items-center gap-1">
                {(["upload", "location", "consent", "analyzing", "results"] as const).map((step, i) => {
                  const labels = ["Photo", "Location", "Consent", "Scan", "Results"];
                  const stepOrder = ["upload", "location", "consent", "analyzing", "results"];
                  const currentIdx = stepOrder.indexOf(faceStep);
                  const isActive = i === currentIdx;
                  const isDone = i < currentIdx;
                  return (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`flex items-center gap-1.5 flex-1 rounded-lg px-2 py-1.5 text-[10px] tracking-wider transition-colors ${isActive ? "bg-accent/20 text-accent" : isDone ? "bg-emerald-500/10 text-emerald-400" : "bg-card/10 text-muted-foreground/40"}`}>
                        {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-mono">{i + 1}</span>}
                        <span className="hidden sm:inline">{labels[i]}</span>
                      </div>
                      {i < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground/20 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* STEP 1: Upload Photo */}
              {faceStep === "upload" && (
                <div
                  onDrop={handleFaceDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="relative rounded-2xl border-2 border-dashed border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden transition-colors hover:border-accent/30"
                >
                  <button onClick={() => faceInputRef.current?.click()} className="w-full py-20 flex flex-col items-center gap-4 cursor-pointer">
                    <div className="rounded-2xl bg-accent/10 p-6">
                      <User className="h-12 w-12 text-accent/60" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-extralight text-foreground">Upload a clear photo for facial intelligence scan</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">Locate matching profiles & lookalikes in any target region</p>
                    </div>
                    <div className="rounded-xl bg-card/20 px-4 py-2 mt-2">
                      <p className="text-[10px] text-muted-foreground">📸 Best results: Front-facing · Good lighting · No sunglasses</p>
                    </div>
                    <div className="rounded-xl bg-accent/5 border border-accent/10 px-4 py-2 mt-1 max-w-sm">
                      <p className="text-[10px] text-muted-foreground/70">◎ Cross-reference facial features against open-source intelligence databases worldwide</p>
                    </div>
                  </button>
                  <input ref={faceInputRef} type="file" accept="image/*" onChange={handleFaceFileSelect} className="hidden" />
                </div>
              )}

              {/* STEP 2: Enter Location */}
              {faceStep === "location" && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                  {facePreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-border/10">
                      <img src={facePreview} alt="Your photo" className="w-full max-h-[250px] object-contain bg-black/20" />
                      <button onClick={resetFaceSearch} className="absolute top-3 right-3 rounded-lg bg-card/80 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-3 left-3 rounded-lg bg-emerald-500/10 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 tracking-wider">PHOTO ACCEPTED</span>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-accent" />
                      <p className="text-sm font-light text-foreground">Where should we search?</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Enter a country, region, or city to target the facial match scan.</p>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                      <input
                        type="text"
                        value={targetLocation}
                        onChange={(e) => setTargetLocation(e.target.value)}
                        placeholder="e.g. Ireland, Germany, New York..."
                        className="w-full rounded-xl border border-border/20 bg-card/10 pl-10 pr-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => targetLocation.trim() && setFaceStep("consent")}
                      disabled={!targetLocation.trim()}
                      className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-sm font-light tracking-wider hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <ChevronRight className="h-4 w-4" />CONTINUE
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Consent */}
              {faceStep === "consent" && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-500/10 p-2.5">
                        <Shield className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-light text-foreground">Legal Consent Required</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Facial recognition analysis requires explicit consent</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-card/10 p-4 space-y-3 text-xs font-light text-foreground/70 leading-relaxed">
                      <p>By proceeding, you acknowledge and agree to the following:</p>
                      <ul className="space-y-2 ml-2">
                        <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">•</span>Your facial data will be processed by AI for similarity analysis</li>
                        <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">•</span>Results are AI-generated estimates, not verified identities</li>
                        <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">•</span>No facial data is stored permanently after the session</li>
                        <li className="flex gap-2"><span className="text-amber-400 flex-shrink-0">•</span>This tool is for intelligence and investigative purposes</li>
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <button type="button" className="flex items-start gap-3 cursor-pointer group text-left w-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConsentChecked(p => ({ ...p, facial: !p.facial })); }}>
                        <div className={`mt-0.5 h-5 w-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-colors ${consentChecked.facial ? "bg-accent border-accent" : "border-border/40 bg-card/10"}`}>
                          {consentChecked.facial && <Check className="h-3 w-3 text-accent-foreground" />}
                        </div>
                        <span className="text-xs font-light text-foreground/80">I consent to facial recognition analysis of my uploaded photo</span>
                      </button>
                      <button type="button" className="flex items-start gap-3 cursor-pointer group text-left w-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConsentChecked(p => ({ ...p, match: !p.match })); }}>
                        <div className={`mt-0.5 h-5 w-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-colors ${consentChecked.match ? "bg-accent border-accent" : "border-border/40 bg-card/10"}`}>
                          {consentChecked.match && <Check className="h-3 w-3 text-accent-foreground" />}
                        </div>
                        <span className="text-xs font-light text-foreground/80">I understand results are AI-generated estimates and should not be used for identification</span>
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setFaceStep("location")} className="flex-1 rounded-xl border border-border/20 bg-card/10 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors tracking-wider">BACK</button>
                      <button
                        onClick={startFaceSearch}
                        disabled={!consentChecked.facial || !consentChecked.match}
                        className="flex-1 rounded-xl bg-accent text-accent-foreground py-3 text-xs font-light tracking-wider hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />BEGIN SCAN
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Analyzing */}
              {faceStep === "analyzing" && (
                <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-10 flex flex-col items-center gap-4 animate-in fade-in-0 duration-300">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-accent" />
                    <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-accent/10" />
                  </div>
                  <p className="text-sm font-extralight text-foreground tracking-wider">FACIAL INTELLIGENCE SCAN IN PROGRESS…</p>
                  <div className="space-y-1 text-center">
                    <p className="text-[10px] text-muted-foreground animate-pulse">Extracting biometric markers · Cross-referencing OSINT databases</p>
                    <p className="text-[10px] text-muted-foreground/60">Target region: {targetLocation}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">Analyzing inter-match connections…</p>
                  </div>
                  <div className="w-full max-w-xs mt-4">
                    <div className="h-1 rounded-full bg-card/30 overflow-hidden">
                      <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: "65%" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5-10: Results */}
              {faceStep === "results" && faceResult && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                  {/* Invalid photo */}
                  {faceResult.status === "INVALID_PHOTO" && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-red-500/10 p-2.5"><AlertTriangle className="h-5 w-5 text-red-400" /></div>
                        <div>
                          <p className="text-sm font-light text-foreground">Photo Quality Issue</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{faceResult.reason}</p>
                        </div>
                      </div>
                      {faceResult.tips && (
                        <div className="rounded-xl bg-card/10 p-3 space-y-1">
                          {faceResult.tips.map((tip, i) => (
                            <p key={i} className="text-[10px] text-muted-foreground flex gap-2"><span className="text-accent">→</span>{tip}</p>
                          ))}
                        </div>
                      )}
                      <button onClick={resetFaceSearch} className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-xs font-light tracking-wider hover:bg-accent/90 transition-colors">TRY ANOTHER PHOTO</button>
                    </div>
                  )}

                  {/* Success Results */}
                  {faceResult.status === "SUCCESS" && (
                    <>
                      {/* Subject Analysis */}
                      {faceResult.subject_analysis && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                          <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Subject Analysis</p>
                          <div className="flex gap-4">
                            {facePreview && (
                              <img src={facePreview} alt="Subject" className="h-20 w-20 rounded-xl object-cover border border-border/10 flex-shrink-0" />
                            )}
                            <div className="space-y-2 flex-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-card/30 px-3 py-2">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Age Range</p>
                                  <p className="text-sm font-extralight text-foreground">{faceResult.subject_analysis.estimated_age_range}</p>
                                </div>
                                <div className="rounded-lg bg-card/30 px-3 py-2">
                                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Face Quality</p>
                                  <p className="text-sm font-extralight text-foreground">{faceResult.subject_analysis.face_quality_score}%</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {faceResult.subject_analysis.distinctive_features.map((f, i) => (
                                  <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-accent/10 text-accent">{f}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Genetic Markers */}
                          {faceResult.subject_analysis.genetic_markers && faceResult.subject_analysis.genetic_markers.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/10">
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Genetic Markers Detected</p>
                              <div className="flex flex-wrap gap-1.5">
                                {faceResult.subject_analysis.genetic_markers.map((m, i) => (
                                  <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">◈ {m}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Regional Indicators */}
                          {faceResult.subject_analysis.heritage_indicators && (
                            <div className="space-y-2 pt-2 border-t border-border/10">
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Regional Origin Analysis</p>
                              <p className="text-xs font-light text-foreground/80 leading-relaxed">{faceResult.subject_analysis.heritage_indicators}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Intelligence Narrative */}
                      {faceResult.heritage_narrative && (
                        <div className="rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-sm p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <Search className="h-3.5 w-3.5 text-accent" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-accent uppercase">Intelligence Briefing</p>
                          </div>
                          <p className="text-sm font-light text-foreground/90 leading-relaxed italic">"{faceResult.heritage_narrative}"</p>
                        </div>
                      )}

                      {/* Search Metadata */}
                      {faceResult.search_metadata && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                            <p className="text-xl font-extralight text-foreground">{faceResult.search_metadata.matches_found}</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Matches</p>
                          </div>
                          <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                            <p className="text-xl font-extralight text-foreground">{(faceResult.search_metadata.total_faces_scanned / 1000).toFixed(1)}k</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Scanned</p>
                          </div>
                          <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                            <p className="text-xl font-extralight text-foreground">{(faceResult.search_metadata.scan_time_ms / 1000).toFixed(1)}s</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Time</p>
                          </div>
                          <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                            <p className="text-xl font-extralight text-foreground truncate text-xs">{faceResult.search_metadata.region_searched}</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Region</p>
                          </div>
                          {faceResult.search_metadata.genetic_databases_checked && (
                            <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                              <p className="text-xl font-extralight text-foreground">{faceResult.search_metadata.genetic_databases_checked}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">Databases</p>
                            </div>
                          )}
                          {faceResult.search_metadata.cross_reference_passes && (
                            <div className="rounded-xl bg-card/20 border border-border/10 p-3 text-center">
                              <p className="text-xl font-extralight text-foreground">{faceResult.search_metadata.cross_reference_passes}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">X-Ref Passes</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Family Tree Visualization */}
                      {faceResult.family_tree && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-accent" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Connection Map</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-card/10 border border-border/10 p-4 text-center">
                              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Common Ancestor</p>
                              <p className="text-sm font-extralight text-foreground">{faceResult.family_tree.common_ancestor_estimate}</p>
                            </div>
                            {faceResult.family_tree.probable_origin_region && (
                              <div className="rounded-xl bg-card/10 border border-border/10 p-4 text-center">
                                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Probable Origin</p>
                                <p className="text-sm font-extralight text-foreground">{faceResult.family_tree.probable_origin_region}</p>
                              </div>
                            )}
                          </div>

                          {faceResult.family_tree.migration_pattern && (
                            <div className="rounded-xl bg-card/10 border border-border/10 p-3 space-y-1.5">
                              <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">Migration Pattern</p>
                              <p className="text-xs font-light text-foreground/80 leading-relaxed">{faceResult.family_tree.migration_pattern}</p>
                            </div>
                          )}

                          {/* Tree branches visual */}
                          <div className="relative">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/20" />
                            <div className="space-y-3">
                              {faceResult.family_tree.branches.map((branch, i) => (
                                <div key={i} className={`flex items-center gap-4 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                                  <div className={`flex-1 rounded-xl border border-border/10 bg-card/10 p-3 ${i % 2 === 0 ? "text-right" : "text-left"}`}>
                                    <p className="text-xs font-light text-foreground">{branch.branch_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{branch.region}</p>
                                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                                      <span className="text-[10px] text-accent">{branch.match_count} matches</span>
                                      <span className="text-[10px] text-muted-foreground/50">·</span>
                                      <span className="text-[10px] text-muted-foreground">{branch.avg_similarity}% avg</span>
                                    </div>
                                    {branch.heritage_note && (
                                      <p className="text-[9px] text-muted-foreground/60 mt-1 italic">{branch.heritage_note}</p>
                                    )}
                                  </div>
                                  <div className="h-3 w-3 rounded-full bg-accent/30 border-2 border-accent flex-shrink-0 z-10" />
                                  <div className="flex-1" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Match Results */}
                      {faceResult.matches && faceResult.matches.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Genetic Matches</p>
                            <span className="text-[10px] text-accent">{faceResult.matches.length} found</span>
                          </div>

                          {/* Map-like region summary */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Array.from(new Set(faceResult.matches.map(m => m.location.city))).map(city => {
                              const cityMatches = faceResult.matches!.filter(m => m.location.city === city);
                              const best = Math.max(...cityMatches.map(m => m.similarity_score));
                              return (
                                <div key={city} className="rounded-xl bg-card/10 border border-border/10 p-3 text-center hover:border-accent/20 transition-colors">
                                  <MapPin className="h-3.5 w-3.5 text-accent mx-auto mb-1" />
                                  <p className="text-xs font-light text-foreground">{city}</p>
                                  <p className="text-[10px] text-muted-foreground">{cityMatches.length} match{cityMatches.length > 1 ? "es" : ""}</p>
                                  <p className="text-[10px] text-accent mt-0.5">Best: {best}%</p>
                                </div>
                              );
                            })}
                          </div>

                          {/* Individual matches */}
                          <div className="space-y-2">
                            {faceResult.matches
                              .sort((a, b) => b.similarity_score - a.similarity_score)
                              .map((match) => (
                <button
                                  key={match.match_id}
                                  onClick={() => setSelectedMatch(selectedMatch?.match_id === match.match_id ? null : match)}
                                  className={`w-full rounded-xl border p-4 text-left transition-all ${selectedMatch?.match_id === match.match_id ? "border-accent/30 bg-accent/5" : "border-border/10 bg-card/10 hover:border-border/20"}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {match.photo_url ? (
                                        <img src={match.photo_url} alt={match.name_alias || "Match"} className="h-11 w-11 rounded-xl object-cover border border-border/20" />
                                      ) : (
                                        <div className="h-11 w-11 rounded-xl bg-card/30 flex items-center justify-center">
                                          <User className="h-5 w-5 text-muted-foreground/40" />
                                        </div>
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-extralight text-foreground">{match.profile?.full_name || match.name_alias || `Match #${match.match_id}`}</span>
                                          <span className="text-[10px] text-muted-foreground/50">·</span>
                                          <span className="text-xs font-extralight text-accent">{match.similarity_score}%</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-lg ${relationshipColors[match.estimated_relationship.toLowerCase()] || "bg-muted/20 text-muted-foreground"}`}>
                                            {match.estimated_relationship}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{match.location.city}, {match.location.region}, {match.location.country}{match.estimated_age_range ? ` · Age: ${match.estimated_age_range}` : ""}</p>
                                        {match.profile?.occupation && (
                                          <p className="text-[10px] text-accent/70 mt-0.5">{match.profile.occupation}</p>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronRight className={`h-4 w-4 text-muted-foreground/30 transition-transform ${selectedMatch?.match_id === match.match_id ? "rotate-90" : ""}`} />
                                  </div>

                                  {/* Expanded details */}
                                  {selectedMatch?.match_id === match.match_id && (
                                    <div className="mt-4 pt-4 border-t border-border/10 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                                      {/* Photo + Bio card */}
                                      {match.profile && (
                                        <div className="flex gap-4">
                                          {match.photo_url && (
                                            <img src={match.photo_url} alt={match.profile.full_name || "Match"} className="h-24 w-24 rounded-xl object-cover border border-border/20 flex-shrink-0" />
                                          )}
                                          <div className="flex-1 space-y-2">
                                            {match.profile.bio && (
                                              <p className="text-[11px] text-foreground/80 leading-relaxed italic">"{match.profile.bio}"</p>
                                            )}
                                            {match.profile.education && (
                                              <p className="text-[10px] text-muted-foreground"><span className="text-foreground/60">Education:</span> {match.profile.education}</p>
                                            )}
                                            {match.profile.languages && match.profile.languages.length > 0 && (
                                              <p className="text-[10px] text-muted-foreground"><span className="text-foreground/60">Languages:</span> {match.profile.languages.join(", ")}</p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Interests */}
                                      {match.profile?.interests && match.profile.interests.length > 0 && (
                                        <div>
                                          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5">Interests</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {match.profile.interests.map((interest, i) => (
                                              <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-card/30 text-foreground/70">{interest}</span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Social Presence */}
                                      {match.profile?.social_presence && match.profile.social_presence.length > 0 && (
                                        <div className="flex items-center gap-2">
                                          <p className="text-[10px] text-muted-foreground/70">Found on:</p>
                                          {match.profile.social_presence.map((platform, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-accent/10 text-accent">{platform}</span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Similarity stats */}
                                      <div className="grid grid-cols-4 gap-2">
                                        <div className="rounded-lg bg-card/30 px-3 py-2 text-center">
                                          <p className="text-lg font-extralight text-foreground">{match.similarity_score}%</p>
                                          <p className="text-[9px] text-muted-foreground">Facial</p>
                                        </div>
                                        <div className="rounded-lg bg-card/30 px-3 py-2 text-center">
                                          <p className="text-lg font-extralight text-foreground">{match.genetic_similarity || match.similarity_score}%</p>
                                          <p className="text-[9px] text-muted-foreground">Genetic</p>
                                        </div>
                                        <div className="rounded-lg bg-card/30 px-3 py-2 text-center">
                                          <p className="text-lg font-extralight text-foreground">{match.ancestry_overlap}%</p>
                                          <p className="text-[9px] text-muted-foreground">Regional</p>
                                        </div>
                                        <div className="rounded-lg bg-card/30 px-3 py-2 text-center">
                                          <p className="text-lg font-extralight text-foreground">{match.age_similarity}%</p>
                                          <p className="text-[9px] text-muted-foreground">Age</p>
                                        </div>
                                      </div>

                                      {match.profile_summary && (
                                        <div className="rounded-lg bg-card/20 border border-border/10 p-3">
                                          <p className="text-[10px] text-foreground/70 leading-relaxed italic">{match.profile_summary}</p>
                                        </div>
                                      )}

                                      <div>
                                        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1.5">Shared Features</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {match.shared_features.map((f, i) => (
                                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-accent/10 text-accent">{f}</span>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-muted-foreground">Family Branch: <span className="text-foreground">{match.family_branch}</span></span>
                                        <span className="text-muted-foreground">Generation Gap: <span className="text-foreground">{match.generation_gap}</span></span>
                                      </div>

                                      {/* Sources / Intelligence Links */}
                                      {match.sources && match.sources.length > 0 && (
                                        <div className="rounded-lg border border-accent/10 bg-accent/5 p-3 space-y-2">
                                          <p className="text-[10px] text-accent uppercase tracking-wider font-light">Intelligence Sources</p>
                                          <div className="space-y-1.5">
                                            {match.sources.map((source, i) => (
                                              <a
                                                key={i}
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between rounded-lg bg-card/20 border border-border/10 px-3 py-2 hover:border-accent/20 transition-colors group"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <ExternalLink className="h-3 w-3 text-accent/60 group-hover:text-accent" />
                                                  <div>
                                                    <p className="text-[11px] text-foreground/80 group-hover:text-accent transition-colors">{source.platform}</p>
                                                    <p className="text-[9px] text-muted-foreground">{source.data_type}</p>
                                                  </div>
                                                </div>
                                                <span className="text-[10px] text-accent/60">{source.confidence}%</span>
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      <a
                                        href={`https://www.google.com/maps?q=${match.location.latitude},${match.location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[10px] text-accent hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MapPin className="h-3 w-3" /> View on Google Maps
                                      </a>
                                    </div>
                                  )}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Inter-Match Connections */}
                      {faceResult.inter_match_connections && faceResult.inter_match_connections.length > 0 && (
                        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm p-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-purple-300 uppercase">Cross-Match Connections</p>
                            <span className="text-[9px] text-purple-400/60 ml-auto">Matches that may know each other</span>
                          </div>
                          <div className="space-y-3">
                            {faceResult.inter_match_connections.map((conn, i) => {
                              const matchA = faceResult.matches?.find(m => m.match_id === conn.match_a_id);
                              const matchB = faceResult.matches?.find(m => m.match_id === conn.match_b_id);
                              return (
                                <div key={i} className="rounded-xl border border-purple-500/10 bg-card/10 p-4 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <User className="h-4 w-4 text-purple-400/60" />
                                      </div>
                                      <span className="text-xs font-light text-foreground">{matchA?.name_alias || `#${conn.match_a_id}`}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="h-px w-12 bg-purple-500/30" />
                                      <span className="text-[9px] text-purple-400">{conn.shared_genetic_markers}% genetic</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                      <span className="text-xs font-light text-foreground">{matchB?.name_alias || `#${conn.match_b_id}`}</span>
                                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <User className="h-4 w-4 text-purple-400/60" />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300`}>{conn.connection_type}</span>
                                    <span className="text-[10px] text-muted-foreground">{conn.confidence}% confidence</span>
                                  </div>
                                  <p className="text-[10px] text-foreground/60 leading-relaxed">{conn.evidence}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Real Sources from Web Search */}
                      {faceResult.real_sources && faceResult.real_sources.length > 0 && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm p-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-emerald-400" />
                            <p className="text-[10px] font-light tracking-[0.15em] text-emerald-300 uppercase">Verified Web Sources</p>
                            <span className="text-[9px] text-emerald-400/60 ml-auto">{faceResult.real_sources.length} sources found</span>
                          </div>
                          <div className="space-y-2">
                            {faceResult.real_sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl border border-emerald-500/10 bg-card/10 p-3 hover:border-emerald-500/30 transition-colors group"
                              >
                                <div className="flex items-start gap-2">
                                  <ExternalLink className="h-3 w-3 text-emerald-400/60 group-hover:text-emerald-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 space-y-1">
                                    <p className="text-[11px] text-foreground/80 group-hover:text-emerald-300 transition-colors leading-snug">{src.title}</p>
                                    <p className="text-[9px] text-muted-foreground/60 leading-relaxed">{src.snippet}</p>
                                    {src.relevance && <p className="text-[9px] text-emerald-400/50 italic">{src.relevance}</p>}
                                    <p className="text-[8px] text-muted-foreground/40 truncate">{src.url}</p>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search Metadata */}
                      {faceResult.search_metadata && (
                        <div className="rounded-xl border border-border/10 bg-card/10 p-4 space-y-2">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Search Intelligence</p>
                          <div className="grid grid-cols-2 gap-2">
                            {faceResult.search_metadata.web_sources_found != null && (
                              <div className="text-[10px]"><span className="text-muted-foreground">Web sources:</span> <span className="text-foreground">{faceResult.search_metadata.web_sources_found}</span></div>
                            )}
                            {faceResult.search_metadata.images_found != null && (
                              <div className="text-[10px]"><span className="text-muted-foreground">Images found:</span> <span className="text-foreground">{faceResult.search_metadata.images_found}</span></div>
                            )}
                            {faceResult.search_metadata.databases_checked && (
                              <div className="col-span-2 text-[10px]"><span className="text-muted-foreground">Databases:</span> <span className="text-foreground">{faceResult.search_metadata.databases_checked.join(", ")}</span></div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="rounded-xl border border-border/10 bg-card/10 p-4 flex items-start gap-3">
                        <Info className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                          Results combine AI facial analysis with real web search data. Photos and links come from live internet searches. They do not represent verified family relationships. This tool is for heritage exploration. No facial data is stored after your session.
                        </p>
                      </div>

                      {/* New Search */}
                      <button onClick={resetFaceSearch} className="w-full rounded-xl border border-border/20 bg-card/10 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors tracking-wider">NEW HERITAGE SEARCH</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Slide-out dark-theme map with directions (geolocation + travel modes) */}
      {mapDestination && (
        <LocationMapPanel query={mapDestination} onClose={() => setMapDestination(null)} />
      )}
    </div>
  );
};

export default OracleLocusView;
