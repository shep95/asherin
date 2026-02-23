import { useState, useRef } from "react";
import { Upload, MapPin, Target, Shield, Eye, Loader2, Copy, Check, AlertTriangle, X, Crosshair, Clock, Compass, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  estimated_season: string;
  sun_position: string;
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

const OracleLocusView = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<{ image: string; result: AnalysisResult }[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB.", variant: "destructive" });
      return;
    }
    setImageType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
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
        body: JSON.stringify({ image_base64: imageBase64, image_type: imageType }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      if (imagePreview) {
        setHistory(prev => [{ image: imagePreview, result: data }, ...prev].slice(0, 20));
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

  const coordsText = result ? `${result.estimated_location.latitude.toFixed(6)}, ${result.estimated_location.longitude.toFixed(6)}` : "";
  const googleMapsUrl = result ? `https://www.google.com/maps?q=${result.estimated_location.latitude},${result.estimated_location.longitude}` : "";

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-accent" />
              <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">ORACLE-LOCUS</h1>
            </div>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Geo-Intelligence Analysis · Image → Coordinates</p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-500/70" />
            <span className="text-[10px] text-emerald-500/70 tracking-wider">LEVEL 20 CLEARANCE</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <ScrollArea className="flex-1 h-full">
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative rounded-2xl border-2 border-dashed border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden transition-colors hover:border-accent/30"
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Target" className="w-full max-h-[400px] object-contain bg-black/20" />
                  <button onClick={clearImage} className="absolute top-3 right-3 rounded-lg bg-card/80 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                  {!analyzing && !result && (
                    <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                      <button onClick={analyzeImage} className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-sm font-light tracking-wider hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                        <Eye className="h-4 w-4" />
                        ANALYZE LOCATION
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
                    <p className="text-sm font-extralight text-muted-foreground">Drop an image or click to upload</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">JPG, PNG, WebP · Max 20MB · No metadata required</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Results */}
            {result && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                {/* Status & Coordinates */}
                <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => { const S = statusConfig[result.status]; return <S.icon className={`h-4 w-4 ${S.color.split(" ")[0]}`} />; })()}
                      <span className={`text-[10px] px-2 py-0.5 rounded ${statusConfig[result.status].color}`}>{result.status}</span>
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

                  {/* Coordinates */}
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
                    {result.address_estimate && (
                      <p className="text-xs text-muted-foreground">{result.address_estimate}</p>
                    )}
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] text-accent hover:underline mt-1">
                      <MapPin className="h-3 w-3" /> Open in Google Maps
                    </a>
                  </div>
                </div>

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

                {/* New Analysis */}
                <button onClick={clearImage} className="w-full rounded-xl border border-border/20 bg-card/10 py-3 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-card/20 transition-colors tracking-wider">
                  ANALYZE NEW IMAGE
                </button>
              </div>
            )}

            {/* History */}
            {history.length > 0 && !result && !imagePreview && (
              <div className="space-y-3">
                <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Recent Analyses</p>
                <div className="grid grid-cols-2 gap-3">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setImagePreview(h.image);
                        setImageBase64(h.image.split(",")[1]);
                        setResult(h.result);
                      }}
                      className="rounded-xl border border-border/10 bg-card/10 overflow-hidden hover:border-accent/20 transition-colors text-left"
                    >
                      <img src={h.image} alt="Previous" className="w-full h-24 object-cover" />
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
      </div>
    </div>
  );
};

export default OracleLocusView;
