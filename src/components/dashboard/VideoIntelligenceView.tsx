import { useState, useRef, useCallback } from "react";
import {
  Upload, Shield, Eye, Loader2, AlertTriangle, X, Video, Clock, User, Activity, Brain, Mic, Globe, Target, ChevronRight, ChevronDown, FileText, Download, BarChart3, Crosshair, Scan, Users, Gauge, Zap, CheckCircle2, XCircle, Info, Play, Pause, SkipForward,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { triggerByokRequired } from "@/components/ByokRequiredDialog";

// ─── TYPES ───
interface MicroExpression {
  timestamp: string;
  emotion: string;
  duration_ms: number;
  action_units: string[];
  suppressed: boolean;
  confidence: number;
  deception_indicator: boolean;
  description: string;
}

interface GestureDetected {
  timestamp: string;
  gesture: string;
  category: string;
  interpretation: string;
  deception_relevance: number;
}

interface TimelineMoment {
  timestamp: string;
  transcript_snippet: string | null;
  deception_score: number;
  deception_level: string;
  active_indicators: { channel: string; indicator: string; contribution_percent: number }[];
  confidence: number;
  baseline_deviation: number;
  is_hotspot: boolean;
  notes: string;
}

interface PersonalityTrait {
  score: number;
  level: string;
  indicators: string[];
}

interface VoicePause {
  timestamp: string;
  duration_seconds: number;
  context: string;
  suspicious: boolean;
}

interface PersonAnalysisItem {
  person_id: number;
  facing_direction: string;
  travel_direction: string;
  description: string;
  primary_subject: boolean;
}

interface VideoAnalysisResult {
  status: string;
  overall_assessment: {
    deception_score: number;
    deception_level: string;
    confidence: number;
    confidence_level: string;
    summary: string;
    disclaimer: string;
  };
  baseline: {
    established: boolean;
    blink_rate_per_min: number | null;
    resting_expression: string;
    default_posture: string;
    habitual_gestures: string[];
    baseline_stress_level: string;
    notes: string;
  };
  micro_expressions: MicroExpression[];
  body_language: {
    overall_openness: number;
    gestures_detected: GestureDetected[];
    posture_analysis: {
      dominant_posture: string;
      lean_direction: string;
      tension_level: number;
      changes: string[];
    };
    fidgeting: {
      frequency: string;
      instances: number;
      types: string[];
      baseline_deviation: number;
    };
    gaze_patterns: {
      eye_contact_percentage: number;
      aversion_direction: string | null;
      blink_rate_deviation: number;
      pupil_indicators: string | null;
    };
  };
  voice_analysis: {
    pitch_variation: {
      baseline: string;
      deviations: { timestamp: string; change_percent: number; indicator: string }[];
    };
    speech_rate: {
      baseline_wpm: number | null;
      changes: { timestamp: string; change: string }[];
    };
    pauses: VoicePause[];
    filler_words: {
      count: number;
      frequency: string;
      baseline_deviation: number;
    };
  };
  personality_profile: {
    available: boolean;
    minimum_duration_met: boolean;
    traits: {
      openness: PersonalityTrait;
      conscientiousness: PersonalityTrait;
      extraversion: PersonalityTrait;
      agreeableness: PersonalityTrait;
      neuroticism: PersonalityTrait;
    };
    personality_deception_adjustment: string;
    behavioral_pattern: string;
  };
  environment: {
    setting_type: string;
    lighting_quality: string;
    camera_angle: string;
    subject_awareness: boolean;
    authority_presence: boolean;
    cultural_context: string | null;
    environmental_stress_factors: string[];
    accuracy_impact: string;
    geo_analysis: {
      estimated_location: { latitude: number | null; longitude: number | null };
      confidence_score: number;
      macro_region: string | null;
      identified_features: { type: string; detail: string }[];
      address_estimate: string | null;
    };
  };
  timeline: TimelineMoment[];
  person_analysis: PersonAnalysisItem[];
  comparison_data: {
    available: boolean;
    behavioral_consistency: number;
    notable_shifts: string[];
  };
  recommendations: string[];
  legal_disclaimer: string;
  insufficient_data_reason: string | null;
}

// ─── HELPERS ───
const deceptionColor = (level: string) => {
  switch (level) {
    case "LOW": return "text-emerald-400";
    case "MODERATE": return "text-amber-400";
    case "HIGH": return "text-orange-400";
    case "VERY_HIGH": return "text-red-400";
    default: return "text-muted-foreground";
  }
};

const deceptionBg = (level: string) => {
  switch (level) {
    case "LOW": return "bg-emerald-500/20";
    case "MODERATE": return "bg-amber-500/20";
    case "HIGH": return "bg-orange-500/20";
    case "VERY_HIGH": return "bg-red-500/20";
    default: return "bg-muted/20";
  }
};

const confidenceColor = (level: string) => {
  switch (level) {
    case "LOW": return "text-red-400";
    case "MODERATE": return "text-amber-400";
    case "HIGH": return "text-emerald-400";
    case "VERY_HIGH": return "text-emerald-300";
    default: return "text-muted-foreground";
  }
};

const traitColor = (score: number) => {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-blue-500";
  if (score >= 25) return "bg-amber-500";
  return "bg-red-500";
};

const VideoIntelligenceView = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("image/jpeg");
  const [isVideo, setIsVideo] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [analysisMode, setAnalysisMode] = useState<string>("full");
  const [consentGiven, setConsentGiven] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [history, setHistory] = useState<{ preview: string; result: VideoAnalysisResult }[]>([]);

  const processFile = (file: File) => {
    const isVid = file.type.startsWith("video/");
    const isImg = file.type.startsWith("image/");
    if (!isVid && !isImg) {
      toast({ title: "Invalid file", description: "Upload a video or image file.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB for video analysis.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setMediaPreview(dataUrl);
      setMediaBase64(base64);
      setMediaType(file.type);
      setIsVideo(isVid);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/") || items[i].type.startsWith("video/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processFile(file);
        return;
      }
    }
  };

  const analyzeMedia = async () => {
    if (!mediaBase64 || !consentGiven) return;
    setAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-intelligence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          video_base64: mediaBase64,
          video_type: mediaType,
          analysis_mode: analysisMode,
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      if (mediaPreview) {
        setHistory(prev => [{ preview: mediaPreview, result: data }, ...prev].slice(0, 10));
      }
    } catch (err) {
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const clearMedia = () => {
    setMediaPreview(null);
    setMediaBase64(null);
    setResult(null);
    setConsentGiven(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportReport = () => {
    if (!result) return;
    const reportData = JSON.stringify(result, null, 2);
    const blob = new Blob([reportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-intelligence-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col h-full" tabIndex={0} onPaste={handlePaste}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Scan className="h-4 w-4 text-accent" />
              <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">VIDEO INTELLIGENCE</h1>
            </div>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Behavioral Analysis · Deception Detection · Personality Profiling</p>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button onClick={exportReport} className="flex items-center gap-1.5 rounded-lg bg-card/30 border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <Download className="h-3 w-3" />EXPORT
              </button>
            )}
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-500/70" />
              <span className="text-[10px] text-emerald-500/70 tracking-wider">CLASSIFIED</span>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">

          {/* ═══ UPLOAD ZONE ═══ */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-2xl border-2 border-dashed border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden transition-colors hover:border-accent/30"
          >
            {mediaPreview ? (
              <div className="relative">
                {isVideo ? (
                  <video src={mediaPreview} controls className="w-full max-h-[400px] bg-black/20" />
                ) : (
                  <img src={mediaPreview} alt="Analysis target" className="w-full max-h-[400px] object-contain bg-black/20" />
                )}
                <button onClick={clearMedia} className="absolute top-3 right-3 rounded-lg bg-card/80 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>

                {!analyzing && !result && (
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent space-y-3">
                    {/* Consent */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-0.5 rounded border-border/40 bg-card/20" />
                      <span className="text-[10px] text-foreground/70 leading-relaxed">
                        I have consent from all individuals in this media for biometric analysis. I understand results are ~70% accurate and should not be used as sole evidence for any decisions.
                      </span>
                    </label>
                    {/* Analysis Mode Selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { id: "full", label: "Full Analysis", icon: Scan },
                        { id: "deception", label: "Deception Focus", icon: Eye },
                        { id: "personality", label: "Personality", icon: Brain },
                        { id: "environment", label: "Environment", icon: Globe },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setAnalysisMode(m.id)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] tracking-wider transition-colors ${
                            analysisMode === m.id
                              ? "bg-accent text-accent-foreground"
                              : "bg-card/30 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <m.icon className="h-3 w-3" />{m.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={analyzeMedia}
                      disabled={!consentGiven}
                      className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-sm font-light tracking-wider hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Scan className="h-4 w-4" />ANALYZE BEHAVIOR
                    </button>
                  </div>
                )}

                {analyzing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-accent" />
                    <p className="text-sm font-extralight text-foreground tracking-wider">RUNNING BEHAVIORAL ANALYSIS…</p>
                    <div className="space-y-1 text-center">
                      <p className="text-[10px] text-muted-foreground">Extracting micro-expressions · Mapping body language</p>
                      <p className="text-[10px] text-muted-foreground">Establishing baseline · Computing deception indicators</p>
                      <p className="text-[10px] text-muted-foreground">Profiling personality · Analyzing environment</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-20 flex flex-col items-center gap-4 cursor-pointer">
                <Video className="h-12 w-12 text-muted-foreground/20" />
                <div className="text-center">
                  <p className="text-sm font-extralight text-muted-foreground">Drop, paste, or click to upload video or image</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">MP4, WebM, MOV, JPG, PNG · Max 50MB · Video preferred for full analysis</p>
                </div>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={handleFileSelect} className="hidden" />
          </div>

          {/* ═══ INSUFFICIENT DATA ═══ */}
          {result && result.status === "INSUFFICIENT_DATA" && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/10 p-2.5"><AlertTriangle className="h-5 w-5 text-amber-400" /></div>
                <div>
                  <p className="text-sm font-light text-foreground">Insufficient Data for Analysis</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{result.insufficient_data_reason || "The uploaded media does not contain enough behavioral data for analysis."}</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ RESULTS ═══ */}
          {result && result.status === "SUCCESS" && (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

              {/* ─── OVERALL ASSESSMENT ─── */}
              <div className="rounded-2xl border border-border/20 bg-card/10 backdrop-blur-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" />
                    <span className="text-sm font-light tracking-wider text-foreground">OVERALL ASSESSMENT</span>
                  </div>
                  <div className={`rounded-lg px-3 py-1 text-[10px] tracking-wider font-medium ${deceptionBg(result.overall_assessment.deception_level)} ${deceptionColor(result.overall_assessment.deception_level)}`}>
                    {result.overall_assessment.deception_level} DECEPTION
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Deception Score */}
                  <div className="rounded-xl bg-card/20 p-4 space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-wider">DECEPTION SCORE</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-extralight ${deceptionColor(result.overall_assessment.deception_level)}`}>
                        {result.overall_assessment.deception_score}%
                      </span>
                    </div>
                    <Progress value={result.overall_assessment.deception_score} className="h-1.5" />
                  </div>
                  {/* Confidence */}
                  <div className="rounded-xl bg-card/20 p-4 space-y-2">
                    <p className="text-[10px] text-muted-foreground tracking-wider">ANALYSIS CONFIDENCE</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-extralight ${confidenceColor(result.overall_assessment.confidence_level)}`}>
                        {result.overall_assessment.confidence}%
                      </span>
                    </div>
                    <Progress value={result.overall_assessment.confidence} className="h-1.5" />
                  </div>
                </div>

                <p className="text-xs font-light text-foreground/80 leading-relaxed">{result.overall_assessment.summary}</p>

                {/* Legal Disclaimer */}
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[9px] text-amber-400/80 leading-relaxed">{result.legal_disclaimer}</p>
                </div>
              </div>

              {/* ─── ANALYSIS TABS ─── */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-card/20 border border-border/10 rounded-xl flex-wrap h-auto gap-0.5 p-1">
                  {[
                    { id: "overview", label: "Timeline", icon: Clock },
                    { id: "facial", label: "Facial", icon: Scan },
                    { id: "body", label: "Body", icon: Users },
                    { id: "voice", label: "Voice", icon: Mic },
                    { id: "personality", label: "Personality", icon: Brain },
                    { id: "environment", label: "Environment", icon: Globe },
                    { id: "baseline", label: "Baseline", icon: Activity },
                  ].map(tab => (
                    <TabsTrigger key={tab.id} value={tab.id} className="rounded-lg text-[10px] tracking-wider data-[state=active]:bg-accent data-[state=active]:text-accent-foreground px-2.5 py-1.5">
                      <tab.icon className="h-3 w-3 mr-1" />{tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ════ TIMELINE TAB ════ */}
                <TabsContent value="overview" className="mt-4 space-y-3">
                  <p className="text-[10px] text-muted-foreground tracking-wider mb-3">MOMENT-BY-MOMENT DECEPTION TIMELINE</p>
                  {result.timeline && result.timeline.length > 0 ? result.timeline.map((moment, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 space-y-2 transition-colors cursor-pointer ${
                        moment.is_hotspot ? "border-red-500/30 bg-red-500/5" : "border-border/15 bg-card/10"
                      }`}
                      onClick={() => setExpandedTimeline(expandedTimeline === moment.timestamp ? null : moment.timestamp)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground">{moment.timestamp}</span>
                          {moment.is_hotspot && <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full tracking-wider">HOTSPOT</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-light ${deceptionColor(moment.deception_level)}`}>{moment.deception_score}%</span>
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedTimeline === moment.timestamp ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      {moment.transcript_snippet && (
                        <p className="text-xs text-foreground/70 italic">"{moment.transcript_snippet}"</p>
                      )}
                      {expandedTimeline === moment.timestamp && (
                        <div className="space-y-2 pt-2 border-t border-border/10">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-card/20 p-2">
                              <p className="text-[9px] text-muted-foreground">Confidence</p>
                              <p className="text-xs text-foreground">{moment.confidence}%</p>
                            </div>
                            <div className="rounded-lg bg-card/20 p-2">
                              <p className="text-[9px] text-muted-foreground">Baseline Deviation</p>
                              <p className="text-xs text-foreground">{moment.baseline_deviation > 0 ? "+" : ""}{moment.baseline_deviation}%</p>
                            </div>
                          </div>
                          {moment.active_indicators && moment.active_indicators.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] text-muted-foreground tracking-wider">ACTIVE INDICATORS</p>
                              {moment.active_indicators.map((ind, j) => (
                                <div key={j} className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-accent/20 text-accent px-1.5 py-0.5 text-[8px] tracking-wider uppercase">{ind.channel}</span>
                                    <span className="text-foreground/80">{ind.indicator}</span>
                                  </div>
                                  <span className="text-muted-foreground">+{ind.contribution_percent}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {moment.notes && <p className="text-[10px] text-muted-foreground">{moment.notes}</p>}
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground text-center py-6">No timeline data available</p>
                  )}
                </TabsContent>

                {/* ════ FACIAL / MICRO-EXPRESSIONS TAB ════ */}
                <TabsContent value="facial" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">MICRO-EXPRESSION ANALYSIS (FACS)</p>
                  {result.micro_expressions && result.micro_expressions.length > 0 ? (
                    <div className="space-y-2">
                      {result.micro_expressions.map((me, i) => (
                        <div key={i} className={`rounded-xl border p-3 ${me.deception_indicator ? "border-red-500/20 bg-red-500/5" : "border-border/15 bg-card/10"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{me.timestamp}</span>
                              <span className="text-xs font-light text-foreground">{me.emotion}</span>
                              {me.suppressed && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">SUPPRESSED</span>}
                              {me.deception_indicator && <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">DECEPTION</span>}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{me.duration_ms}ms · {me.confidence}%</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{me.description}</p>
                          {me.action_units.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {me.action_units.map((au, j) => (
                                <span key={j} className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{au}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">No micro-expressions detected</p>
                  )}

                  {/* Gaze Patterns */}
                  {result.body_language?.gaze_patterns && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">GAZE PATTERNS</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Eye Contact</p>
                          <p className="text-sm text-foreground">{result.body_language.gaze_patterns.eye_contact_percentage}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Blink Rate Deviation</p>
                          <p className="text-sm text-foreground">{result.body_language.gaze_patterns.blink_rate_deviation > 0 ? "+" : ""}{result.body_language.gaze_patterns.blink_rate_deviation}%</p>
                        </div>
                        {result.body_language.gaze_patterns.aversion_direction && (
                          <div>
                            <p className="text-[9px] text-muted-foreground">Aversion Direction</p>
                            <p className="text-sm text-foreground">{result.body_language.gaze_patterns.aversion_direction}</p>
                          </div>
                        )}
                        {result.body_language.gaze_patterns.pupil_indicators && (
                          <div>
                            <p className="text-[9px] text-muted-foreground">Pupil Indicators</p>
                            <p className="text-sm text-foreground">{result.body_language.gaze_patterns.pupil_indicators}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ════ BODY LANGUAGE TAB ════ */}
                <TabsContent value="body" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">BODY LANGUAGE ANALYSIS</p>

                  {/* Overall Openness */}
                  <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground tracking-wider">OVERALL BODY OPENNESS</p>
                      <span className="text-sm text-foreground">{result.body_language?.overall_openness ?? 0}%</span>
                    </div>
                    <Progress value={result.body_language?.overall_openness ?? 0} className="h-1.5" />
                  </div>

                  {/* Posture */}
                  {result.body_language?.posture_analysis && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">POSTURE ANALYSIS</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Dominant Posture</p>
                          <p className="text-xs text-foreground">{result.body_language.posture_analysis.dominant_posture}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Lean Direction</p>
                          <p className="text-xs text-foreground">{result.body_language.posture_analysis.lean_direction}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Tension Level</p>
                          <p className="text-xs text-foreground">{result.body_language.posture_analysis.tension_level}%</p>
                        </div>
                      </div>
                      {result.body_language.posture_analysis.changes?.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <p className="text-[9px] text-muted-foreground">Changes</p>
                          {result.body_language.posture_analysis.changes.map((c, i) => (
                            <p key={i} className="text-[10px] text-foreground/70">• {c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gestures */}
                  {result.body_language?.gestures_detected && result.body_language.gestures_detected.length > 0 && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">GESTURES DETECTED</p>
                      <div className="space-y-2">
                        {result.body_language.gestures_detected.map((g, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] rounded-lg bg-card/20 p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-muted-foreground">{g.timestamp}</span>
                              <span className="text-foreground">{g.gesture}</span>
                              <span className="rounded bg-accent/10 text-accent px-1.5 py-0.5 text-[8px] uppercase">{g.category}</span>
                            </div>
                            <span className={`${g.deception_relevance > 60 ? "text-red-400" : "text-muted-foreground"}`}>{g.deception_relevance}% relevance</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fidgeting */}
                  {result.body_language?.fidgeting && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">FIDGETING</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Frequency</p>
                          <p className="text-xs text-foreground">{result.body_language.fidgeting.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Instances</p>
                          <p className="text-xs text-foreground">{result.body_language.fidgeting.instances}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Baseline Deviation</p>
                          <p className="text-xs text-foreground">{result.body_language.fidgeting.baseline_deviation > 0 ? "+" : ""}{result.body_language.fidgeting.baseline_deviation}%</p>
                        </div>
                      </div>
                      {result.body_language.fidgeting.types?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {result.body_language.fidgeting.types.map((t, i) => (
                            <span key={i} className="text-[8px] bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ════ VOICE TAB ════ */}
                <TabsContent value="voice" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">VOICE STRESS ANALYSIS</p>

                  {/* Pitch Variation */}
                  {result.voice_analysis?.pitch_variation && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">PITCH VARIATION</p>
                      <p className="text-xs text-foreground/70">Baseline: {result.voice_analysis.pitch_variation.baseline}</p>
                      {result.voice_analysis.pitch_variation.deviations?.length > 0 && (
                        <div className="space-y-1">
                          {result.voice_analysis.pitch_variation.deviations.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] rounded-lg bg-card/20 p-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-muted-foreground">{d.timestamp}</span>
                                <span className="text-foreground">{d.indicator}</span>
                              </div>
                              <span className={`${Math.abs(d.change_percent) > 20 ? "text-red-400" : "text-amber-400"}`}>
                                {d.change_percent > 0 ? "+" : ""}{d.change_percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speech Rate */}
                  {result.voice_analysis?.speech_rate && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">SPEECH RATE</p>
                      {result.voice_analysis.speech_rate.baseline_wpm && (
                        <p className="text-xs text-foreground/70">Baseline: ~{result.voice_analysis.speech_rate.baseline_wpm} WPM</p>
                      )}
                      {result.voice_analysis.speech_rate.changes?.length > 0 && (
                        <div className="space-y-1">
                          {result.voice_analysis.speech_rate.changes.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <span className="font-mono text-muted-foreground">{c.timestamp}</span>
                              <span className="text-foreground/80">{c.change}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pauses */}
                  {result.voice_analysis?.pauses && result.voice_analysis.pauses.length > 0 && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">SIGNIFICANT PAUSES</p>
                      <div className="space-y-1">
                        {result.voice_analysis.pauses.map((p, i) => (
                          <div key={i} className={`flex items-center justify-between text-[10px] rounded-lg p-2 ${p.suspicious ? "bg-red-500/5 border border-red-500/10" : "bg-card/20"}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-muted-foreground">{p.timestamp}</span>
                              <span className="text-foreground/80">{p.context}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{p.duration_seconds}s</span>
                              {p.suspicious && <AlertTriangle className="h-3 w-3 text-red-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filler Words */}
                  {result.voice_analysis?.filler_words && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4">
                      <p className="text-[10px] text-muted-foreground tracking-wider mb-2">FILLER WORDS</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Count</p>
                          <p className="text-sm text-foreground">{result.voice_analysis.filler_words.count}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Frequency</p>
                          <p className="text-sm text-foreground">{result.voice_analysis.filler_words.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Baseline Deviation</p>
                          <p className="text-sm text-foreground">{result.voice_analysis.filler_words.baseline_deviation > 0 ? "+" : ""}{result.voice_analysis.filler_words.baseline_deviation}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ════ PERSONALITY TAB ════ */}
                <TabsContent value="personality" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">BIG FIVE PERSONALITY PROFILE (OCEAN)</p>

                  {result.personality_profile?.available ? (
                    <>
                      {!result.personality_profile.minimum_duration_met && (
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 flex items-start gap-2">
                          <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-amber-400/80">Video duration is short. Personality estimates may be less reliable. 5+ minutes recommended.</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {(["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"] as const).map(trait => {
                          const t = result.personality_profile.traits[trait];
                          if (!t) return null;
                          return (
                            <div key={trait} className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-light text-foreground capitalize">{trait}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-light text-foreground">{t.score}/100</span>
                                  <span className="text-[9px] text-muted-foreground">({t.level})</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-card/30 overflow-hidden">
                                <div className={`h-full rounded-full ${traitColor(t.score)} transition-all duration-700`} style={{ width: `${t.score}%` }} />
                              </div>
                              {t.indicators?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {t.indicators.map((ind, i) => (
                                    <span key={i} className="text-[8px] bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">{ind}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {result.personality_profile.personality_deception_adjustment && (
                        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
                          <p className="text-[10px] text-blue-400 tracking-wider mb-1">PERSONALITY × DECEPTION ADJUSTMENT</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{result.personality_profile.personality_deception_adjustment}</p>
                        </div>
                      )}

                      {result.personality_profile.behavioral_pattern && (
                        <div className="rounded-xl border border-border/15 bg-card/10 p-4">
                          <p className="text-[10px] text-muted-foreground tracking-wider mb-1">BEHAVIORAL PATTERN</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{result.personality_profile.behavioral_pattern}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Personality profile not available — requires longer video with clear behavioral data</p>
                  )}
                </TabsContent>

                {/* ════ ENVIRONMENT TAB ════ */}
                <TabsContent value="environment" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">ENVIRONMENTAL CONTEXT & GEO-INTELLIGENCE</p>

                  {result.environment && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Setting", value: result.environment.setting_type },
                          { label: "Lighting", value: result.environment.lighting_quality },
                          { label: "Camera Angle", value: result.environment.camera_angle },
                          { label: "Subject Aware", value: result.environment.subject_awareness ? "Yes" : "No" },
                          { label: "Authority Present", value: result.environment.authority_presence ? "Yes" : "No" },
                          { label: "Cultural Context", value: result.environment.cultural_context || "Not determined" },
                        ].map((item, i) => (
                          <div key={i} className="rounded-xl border border-border/15 bg-card/10 p-3">
                            <p className="text-[9px] text-muted-foreground">{item.label}</p>
                            <p className="text-xs text-foreground mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {result.environment.environmental_stress_factors?.length > 0 && (
                        <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                          <p className="text-[10px] text-muted-foreground tracking-wider">STRESS FACTORS</p>
                          <div className="flex flex-wrap gap-1">
                            {result.environment.environmental_stress_factors.map((f, i) => (
                              <span key={i} className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.environment.accuracy_impact && (
                        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
                          <p className="text-[10px] text-blue-400 tracking-wider mb-1">ACCURACY IMPACT</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{result.environment.accuracy_impact}</p>
                        </div>
                      )}

                      {/* Geo Analysis from environment */}
                      {result.environment.geo_analysis && result.environment.geo_analysis.confidence_score > 0 && (
                        <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Crosshair className="h-3.5 w-3.5 text-accent" />
                            <p className="text-[10px] text-muted-foreground tracking-wider">GEO-INTELLIGENCE (ORACLE-LOCUS)</p>
                          </div>
                          {result.environment.geo_analysis.macro_region && (
                            <p className="text-xs text-foreground">{result.environment.geo_analysis.macro_region}</p>
                          )}
                          {result.environment.geo_analysis.address_estimate && (
                            <p className="text-xs text-foreground/70">{result.environment.geo_analysis.address_estimate}</p>
                          )}
                          {result.environment.geo_analysis.estimated_location.latitude && (
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {result.environment.geo_analysis.estimated_location.latitude?.toFixed(4)}, {result.environment.geo_analysis.estimated_location.longitude?.toFixed(4)}
                              <span className="ml-2">· {result.environment.geo_analysis.confidence_score}% confidence</span>
                            </p>
                          )}
                          {result.environment.geo_analysis.identified_features?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.environment.geo_analysis.identified_features.map((f, i) => (
                                <span key={i} className="text-[8px] bg-muted/20 text-muted-foreground px-2 py-0.5 rounded-full">{f.type}: {f.detail}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Person Analysis */}
                  {result.person_analysis && result.person_analysis.length > 0 && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">PERSON ANALYSIS</p>
                      {result.person_analysis.map((p, i) => (
                        <div key={i} className="rounded-lg bg-card/20 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <User className="h-3.5 w-3.5 text-accent" />
                            <div>
                              <p className="text-xs text-foreground">{p.description}</p>
                              <p className="text-[9px] text-muted-foreground">Facing: {p.facing_direction} · Moving: {p.travel_direction}</p>
                            </div>
                          </div>
                          {p.primary_subject && <span className="text-[8px] bg-accent/20 text-accent px-2 py-0.5 rounded-full">PRIMARY</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ════ BASELINE TAB ════ */}
                <TabsContent value="baseline" className="mt-4 space-y-4">
                  <p className="text-[10px] text-muted-foreground tracking-wider">BEHAVIORAL BASELINE</p>

                  {result.baseline && (
                    <>
                      <div className={`rounded-xl border p-4 ${result.baseline.established ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {result.baseline.established ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                          )}
                          <span className="text-xs text-foreground">
                            Baseline {result.baseline.established ? "Established" : "Not Fully Established"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{result.baseline.notes}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/15 bg-card/10 p-3">
                          <p className="text-[9px] text-muted-foreground">Blink Rate</p>
                          <p className="text-xs text-foreground">{result.baseline.blink_rate_per_min ?? "N/A"}/min</p>
                        </div>
                        <div className="rounded-xl border border-border/15 bg-card/10 p-3">
                          <p className="text-[9px] text-muted-foreground">Stress Level</p>
                          <p className="text-xs text-foreground">{result.baseline.baseline_stress_level}</p>
                        </div>
                        <div className="rounded-xl border border-border/15 bg-card/10 p-3">
                          <p className="text-[9px] text-muted-foreground">Resting Expression</p>
                          <p className="text-xs text-foreground">{result.baseline.resting_expression}</p>
                        </div>
                        <div className="rounded-xl border border-border/15 bg-card/10 p-3">
                          <p className="text-[9px] text-muted-foreground">Default Posture</p>
                          <p className="text-xs text-foreground">{result.baseline.default_posture}</p>
                        </div>
                      </div>

                      {result.baseline.habitual_gestures?.length > 0 && (
                        <div className="rounded-xl border border-border/15 bg-card/10 p-4">
                          <p className="text-[10px] text-muted-foreground tracking-wider mb-2">HABITUAL GESTURES</p>
                          <div className="flex flex-wrap gap-1">
                            {result.baseline.habitual_gestures.map((g, i) => (
                              <span key={i} className="text-[9px] bg-muted/20 text-muted-foreground px-2 py-1 rounded-lg">{g}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Comparison Data */}
                  {result.comparison_data && result.comparison_data.available && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">COMPARISON DATA</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-foreground">Behavioral Consistency</p>
                        <span className="text-sm text-foreground">{result.comparison_data.behavioral_consistency}%</span>
                      </div>
                      <Progress value={result.comparison_data.behavioral_consistency} className="h-1.5" />
                      {result.comparison_data.notable_shifts?.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <p className="text-[9px] text-muted-foreground">Notable Shifts</p>
                          {result.comparison_data.notable_shifts.map((s, i) => (
                            <p key={i} className="text-[10px] text-foreground/70">• {s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="rounded-xl border border-border/15 bg-card/10 p-4 space-y-2">
                      <p className="text-[10px] text-muted-foreground tracking-wider">ANALYST RECOMMENDATIONS</p>
                      {result.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ChevronRight className="h-3 w-3 text-accent mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-foreground/80">{r}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* ═══ PRIVACY & ETHICS NOTICE ═══ */}
          {!result && !analyzing && (
            <div className="rounded-2xl border border-border/10 bg-card/5 backdrop-blur-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-light text-foreground tracking-wider">PRIVACY & ETHICS</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-muted-foreground">
                <div className="space-y-1.5">
                  <p className="text-foreground/80 font-medium">◇ Legal Requirements</p>
                  <p>• BIPA: $1,000–$5,000 per violation</p>
                  <p>• GDPR: Up to 4% of revenue in fines</p>
                  <p>• CCPA: $2,500–$7,500 per violation</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-foreground/80 font-medium">✓ Required Safeguards</p>
                  <p>• Explicit consent from all subjects</p>
                  <p>• Auto-delete after 90 days</p>
                  <p>• Full access logging & encryption</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-foreground/80 font-medium">◈ Accuracy Disclaimer</p>
                  <p>• Best systems achieve 70-75% accuracy</p>
                  <p>• NOT 100% — false positives occur</p>
                  <p>• Cultural and personality adjustments applied</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-foreground/80 font-medium">◎ Best Results With</p>
                  <p>• Clear, well-lit video (2+ minutes)</p>
                  <p>• Full face and upper body visible</p>
                  <p>• Natural conversation setting</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ANALYSIS HISTORY ═══ */}
          {history.length > 0 && !result && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground tracking-wider">RECENT ANALYSES</p>
              <div className="grid grid-cols-3 gap-3">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setResult(h.result); setMediaPreview(h.preview); }}
                    className="rounded-xl border border-border/15 bg-card/10 p-2 hover:bg-card/20 transition-colors text-left"
                  >
                    <div className="aspect-video rounded-lg overflow-hidden bg-black/20 mb-2">
                      <img src={h.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${deceptionColor(h.result.overall_assessment?.deception_level)}`}>
                        {h.result.overall_assessment?.deception_score ?? 0}%
                      </span>
                      <span className="text-[9px] text-muted-foreground">{h.result.overall_assessment?.confidence ?? 0}% conf</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default VideoIntelligenceView;
