import { useState, useEffect, useCallback } from "react";
import { MapPin, Layers, Navigation, Target, Search, Loader2, Upload, Database } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LocationPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  value: number;
  status: string;
}

interface HeatmapRegion {
  region: string;
  density: number;
  revenue: string;
  growth: string;
}

interface RouteEntry {
  route: string;
  distance: string;
  efficiency: number;
  cost: string;
  suggestion: string;
}

interface AnalysisResult {
  locations?: LocationPoint[];
  heatmap?: HeatmapRegion[];
  routes?: RouteEntry[];
  territories?: { name: string; performance: number; reps: number; customers: number; revenue: string }[];
}

const typeColors: Record<string, string> = { office: "bg-blue-500", warehouse: "bg-amber-500", cluster: "bg-emerald-500", prospect: "bg-purple-500", default: "bg-accent" };
const statusBadge: Record<string, string> = { active: "text-emerald-400 bg-emerald-500/10", hot: "text-red-400 bg-red-500/10", warm: "text-amber-400 bg-amber-500/10", monitoring: "text-blue-400 bg-blue-500/10", prospect: "text-purple-400 bg-purple-500/10" };

const GeospatialView = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"map" | "heatmap" | "routes" | "territories">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [datasets, setDatasets] = useState<{ id: string; file_name: string }[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const tabs = [
    { id: "map" as const, label: "Location Map", icon: MapPin },
    { id: "heatmap" as const, label: "Density Heatmap", icon: Layers },
    { id: "routes" as const, label: "Route Analysis", icon: Navigation },
    { id: "territories" as const, label: "Territories", icon: Target },
  ];

  const loadDatasets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("asha_datasets")
      .select("id, file_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDatasets((data ?? []) as { id: string; file_name: string }[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadDatasets(); }, [loadDatasets]);

  const runAnalysis = async (datasetId: string) => {
    if (!user) return;
    setSelectedDataset(datasetId);
    setAnalyzing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const _geoToken = session?.session?.access_token;
      if (!_geoToken) throw new Error("Sign in required.");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${_geoToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ query: `[GEOSPATIAL ANALYSIS] Analyze dataset ${datasetId} for geospatial intelligence. Return ONLY valid JSON: {"locations":[{"id":"1","name":"Name","lat":0,"lng":0,"type":"office|warehouse|cluster|prospect","value":0,"status":"active|hot|warm|monitoring|prospect"}],"heatmap":[{"region":"Name","density":0,"revenue":"$0","growth":"+0%"}],"routes":[{"route":"A → B","distance":"0 mi","efficiency":0,"cost":"$0","suggestion":"text"}],"territories":[{"name":"Name","performance":0,"reps":0,"customers":0,"revenue":"$0"}]}` }),
      });
      if (res.ok) {
        const result = await res.json();
        const jsonMatch = (result.response || "").match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setAnalysis(parsed);
          setAnalyzing(false);
          return;
        }
      }
      throw new Error("Analysis failed");
    } catch {
      setAnalysis(null);
      setAnalyzing(false);
    }
  };

  const locations = analysis?.locations ?? [];
  const heatmapRegions = analysis?.heatmap ?? [];
  const routeData = analysis?.routes ?? [];
  const territories = analysis?.territories ?? [];

  const filteredLocations = locations.filter(l =>
    !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">GEOSPATIAL INTELLIGENCE</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Spatial-temporal analysis from your uploaded datasets</p>
          </div>
          {datasets.length > 0 && (
            <Select value={selectedDataset ?? ""} onValueChange={(val) => { if (val) runAnalysis(val); }}>
              <SelectTrigger className="w-[200px] rounded-xl border-border/20 bg-card/30 backdrop-blur-sm text-xs text-foreground">
                <SelectValue placeholder="Select dataset…" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/20 bg-card backdrop-blur-xl">
                {datasets.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.file_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {analysis && (
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-light transition-colors ${activeTab === tab.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}>
                <tab.icon className="h-3 w-3" /> {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div className="p-6">
              {/* No datasets */}
              {datasets.length === 0 && !analyzing && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-extralight text-muted-foreground">No datasets available</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Upload location data via Azplen to activate geospatial analysis</p>
                </div>
              )}

              {/* Dataset selected but no analysis yet */}
              {datasets.length > 0 && !analysis && !analyzing && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Database className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-extralight text-muted-foreground">Select a dataset to analyze</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Choose from your uploaded datasets above</p>
                </div>
              )}

              {/* Analyzing */}
              {analyzing && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                  <p className="text-sm font-extralight text-muted-foreground">Running geospatial analysis…</p>
                </div>
              )}

              {/* Results */}
              {analysis && !analyzing && (
                <>
                  {activeTab === "map" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-4 py-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search locations…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
                      </div>

                      {locations.length > 0 && (
                        <div className="rounded-2xl border border-border/10 bg-card/10 overflow-hidden">
                          <div className="aspect-[16/9] relative bg-gradient-to-br from-card/40 to-card/20">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                            {filteredLocations.map(loc => {
                              const x = ((loc.lng + 180) / 360) * 100;
                              const y = ((90 - loc.lat) / 180) * 100;
                              return (
                                <div key={loc.id} className="absolute group" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
                                  <div className={`h-3 w-3 rounded-full ${typeColors[loc.type] || typeColors.default} shadow-lg shadow-current/30 animate-pulse`} />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    <div className="rounded-lg bg-card/95 backdrop-blur-sm border border-border/20 px-2.5 py-1.5 text-[9px] text-foreground shadow-lg">
                                      <p className="font-medium">{loc.name}</p>
                                      <p className="text-muted-foreground">{loc.value > 0 ? `$${(loc.value / 1000000).toFixed(1)}M` : "Prospect"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Locations ({filteredLocations.length})</p>
                        {filteredLocations.map(loc => (
                          <div key={loc.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-card/20 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full ${typeColors[loc.type] || typeColors.default}`} />
                              <div>
                                <p className="text-xs font-light text-foreground">{loc.name}</p>
                                <p className="text-[10px] text-muted-foreground">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-foreground/70">{loc.value > 0 ? `$${(loc.value / 1000).toFixed(0)}K` : "—"}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded capitalize ${statusBadge[loc.status] || "text-muted-foreground bg-muted/20"}`}>{loc.status}</span>
                            </div>
                          </div>
                        ))}
                        {filteredLocations.length === 0 && <p className="text-[10px] text-muted-foreground/40 text-center py-4">No locations found in analysis.</p>}
                      </div>
                    </div>
                  )}

                  {activeTab === "heatmap" && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Density by Region</p>
                      {heatmapRegions.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No regional data available from this dataset.</p>}
                      {heatmapRegions.map(r => (
                        <div key={r.region} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-light text-foreground">{r.region}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-foreground/70">{r.revenue}</span>
                              <span className="text-[10px] text-emerald-400">{r.growth}</span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-card/40 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.density}%`, background: `linear-gradient(90deg, hsl(var(--accent) / 0.3), hsl(var(--accent)))` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground/50">Density score: {r.density}/100</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "routes" && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Logistics Route Analysis</p>
                      {routeData.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No route data available from this dataset.</p>}
                      {routeData.map(r => (
                        <div key={r.route} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Navigation className="h-3.5 w-3.5 text-accent" />
                              <p className="text-xs font-light text-foreground">{r.route}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{r.distance}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div><p className="text-[9px] text-muted-foreground">Efficiency</p><p className={`text-xs font-medium ${r.efficiency >= 80 ? "text-emerald-400" : r.efficiency >= 60 ? "text-amber-400" : "text-red-400"}`}>{r.efficiency}%</p></div>
                            <div><p className="text-[9px] text-muted-foreground">Cost</p><p className="text-xs text-foreground">{r.cost}</p></div>
                            <div className="flex-1"><p className="text-[9px] text-muted-foreground">Suggestion</p><p className={`text-xs ${r.suggestion === "Optimal" ? "text-emerald-400" : "text-amber-400"}`}>{r.suggestion}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "territories" && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Territory Analysis</p>
                      {territories.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-8">No territory data available from this dataset.</p>}
                      {territories.map(t => (
                        <div key={t.name} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-light text-foreground">{t.name}</p>
                            <span className={`text-[9px] px-2 py-0.5 rounded ${t.performance >= 80 ? "text-emerald-400 bg-emerald-500/10" : t.performance >= 60 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>{t.performance}% target</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg bg-card/20 p-2 text-center">
                              <p className="text-lg font-extralight text-foreground">{t.reps}</p>
                              <p className="text-[9px] text-muted-foreground">Reps</p>
                            </div>
                            <div className="rounded-lg bg-card/20 p-2 text-center">
                              <p className="text-lg font-extralight text-foreground">{t.customers}</p>
                              <p className="text-[9px] text-muted-foreground">Customers</p>
                            </div>
                            <div className="rounded-lg bg-card/20 p-2 text-center">
                              <p className="text-lg font-extralight text-foreground">{t.revenue}</p>
                              <p className="text-[9px] text-muted-foreground">Revenue</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default GeospatialView;
