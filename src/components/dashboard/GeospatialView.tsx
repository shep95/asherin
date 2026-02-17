import { useState } from "react";
import { MapPin, Layers, TrendingUp, Navigation, AlertTriangle, BarChart3, Target, Search, Filter, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock geospatial data for demonstration
const mockLocations = [
  { id: "1", name: "HQ - San Francisco", lat: 37.7749, lng: -122.4194, type: "office", value: 2400000, status: "active" },
  { id: "2", name: "NYC Office", lat: 40.7128, lng: -74.0060, type: "office", value: 1800000, status: "active" },
  { id: "3", name: "London Branch", lat: 51.5074, lng: -0.1278, type: "office", value: 1200000, status: "active" },
  { id: "4", name: "Singapore Hub", lat: 1.3521, lng: 103.8198, type: "warehouse", value: 890000, status: "active" },
  { id: "5", name: "Customer Cluster A", lat: 34.0522, lng: -118.2437, type: "cluster", value: 5600000, status: "hot" },
  { id: "6", name: "Customer Cluster B", lat: 41.8781, lng: -87.6298, type: "cluster", value: 3200000, status: "warm" },
  { id: "7", name: "Supply Chain Node", lat: 31.2304, lng: 121.4737, type: "warehouse", value: 640000, status: "monitoring" },
  { id: "8", name: "Emerging Market", lat: -23.5505, lng: -46.6333, type: "prospect", value: 0, status: "prospect" },
];

const heatmapRegions = [
  { region: "West Coast US", density: 94, revenue: "$12.4M", growth: "+18%" },
  { region: "East Coast US", density: 82, revenue: "$9.8M", growth: "+12%" },
  { region: "Western Europe", density: 71, revenue: "$7.2M", growth: "+22%" },
  { region: "Asia Pacific", density: 58, revenue: "$4.1M", growth: "+34%" },
  { region: "South America", density: 23, revenue: "$890K", growth: "+67%" },
];

const routeAnalysis = [
  { route: "SF → NYC", distance: "2,571 mi", efficiency: 92, cost: "$4,200", suggestion: "Optimal" },
  { route: "NYC → London", distance: "3,459 mi", efficiency: 78, cost: "$12,800", suggestion: "Consider sea freight" },
  { route: "London → Singapore", distance: "6,761 mi", efficiency: 65, cost: "$18,400", suggestion: "Route deviation detected" },
];

const typeColors: Record<string, string> = { office: "bg-blue-500", warehouse: "bg-amber-500", cluster: "bg-emerald-500", prospect: "bg-purple-500" };
const statusBadge: Record<string, string> = { active: "text-emerald-400 bg-emerald-500/10", hot: "text-red-400 bg-red-500/10", warm: "text-amber-400 bg-amber-500/10", monitoring: "text-blue-400 bg-blue-500/10", prospect: "text-purple-400 bg-purple-500/10" };

const GeospatialView = () => {
  const [activeTab, setActiveTab] = useState<"map" | "heatmap" | "routes" | "territories">("map");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { id: "map" as const, label: "Location Map", icon: MapPin },
    { id: "heatmap" as const, label: "Density Heatmap", icon: Layers },
    { id: "routes" as const, label: "Route Analysis", icon: Navigation },
    { id: "territories" as const, label: "Territories", icon: Target },
  ];

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">GEOSPATIAL INTELLIGENCE</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Spatial-temporal analysis and location intelligence</p>
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-light transition-colors ${activeTab === tab.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}>
              <tab.icon className="h-3 w-3" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Map/visualization area */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div className="p-6">
              {activeTab === "map" && (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-4 py-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search locations…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
                  </div>

                  {/* Map placeholder with grid visualization */}
                  <div className="rounded-2xl border border-border/10 bg-card/10 overflow-hidden">
                    <div className="aspect-[16/9] relative bg-gradient-to-br from-card/40 to-card/20 flex items-center justify-center">
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                      {/* Plot locations */}
                      {mockLocations.map(loc => {
                        const x = ((loc.lng + 180) / 360) * 100;
                        const y = ((90 - loc.lat) / 180) * 100;
                        return (
                          <div key={loc.id} className="absolute group" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}>
                            <div className={`h-3 w-3 rounded-full ${typeColors[loc.type]} shadow-lg shadow-current/30 animate-pulse`} />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              <div className="rounded-lg bg-card/95 backdrop-blur-sm border border-border/20 px-2.5 py-1.5 text-[9px] text-foreground shadow-lg">
                                <p className="font-medium">{loc.name}</p>
                                <p className="text-muted-foreground">{loc.value > 0 ? `$${(loc.value / 1000000).toFixed(1)}M` : "Prospect"}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="text-center z-10">
                        <MapPin className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                        <p className="text-xs text-muted-foreground/40 mt-2">Interactive map — upload location data to activate</p>
                      </div>
                    </div>
                  </div>

                  {/* Location table */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Locations ({mockLocations.length})</p>
                    {mockLocations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-card/20 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${typeColors[loc.type]}`} />
                          <div>
                            <p className="text-xs font-light text-foreground">{loc.name}</p>
                            <p className="text-[10px] text-muted-foreground">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-foreground/70">{loc.value > 0 ? `$${(loc.value / 1000).toFixed(0)}K` : "—"}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded capitalize ${statusBadge[loc.status]}`}>{loc.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "heatmap" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Customer Density by Region</p>
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
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${r.density}%`, background: `linear-gradient(90deg, hsl(var(--accent) / 0.3), hsl(var(--accent)))` }} />
                      </div>
                      <p className="text-[9px] text-muted-foreground/50">Density score: {r.density}/100</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "routes" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Logistics Route Analysis</p>
                  {routeAnalysis.map(r => (
                    <div key={r.route} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-3.5 w-3.5 text-accent" />
                          <p className="text-xs font-light text-foreground">{r.route}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{r.distance}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[9px] text-muted-foreground">Efficiency</p>
                          <p className={`text-xs font-medium ${r.efficiency >= 80 ? "text-emerald-400" : r.efficiency >= 60 ? "text-amber-400" : "text-red-400"}`}>{r.efficiency}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">Cost</p>
                          <p className="text-xs text-foreground">{r.cost}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] text-muted-foreground">Suggestion</p>
                          <p className={`text-xs ${r.suggestion === "Optimal" ? "text-emerald-400" : "text-amber-400"}`}>{r.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "territories" && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Sales Territory Analysis</p>
                  {["West Region", "East Region", "International"].map((territory, i) => {
                    const perf = [92, 78, 65][i];
                    const reps = [12, 8, 5][i];
                    const customers = [340, 220, 140][i];
                    return (
                      <div key={territory} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-light text-foreground">{territory}</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded ${perf >= 80 ? "text-emerald-400 bg-emerald-500/10" : perf >= 60 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>{perf}% target</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-card/20 p-2 text-center">
                            <p className="text-lg font-extralight text-foreground">{reps}</p>
                            <p className="text-[9px] text-muted-foreground">Reps</p>
                          </div>
                          <div className="rounded-lg bg-card/20 p-2 text-center">
                            <p className="text-lg font-extralight text-foreground">{customers}</p>
                            <p className="text-[9px] text-muted-foreground">Customers</p>
                          </div>
                          <div className="rounded-lg bg-card/20 p-2 text-center">
                            <p className="text-lg font-extralight text-foreground">${(customers * 28).toLocaleString()}K</p>
                            <p className="text-[9px] text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default GeospatialView;
