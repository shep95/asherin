import { useState } from "react";
import { Database, TrendingUp, AlertTriangle, Search, ArrowUpDown, Beaker, Layers, CheckCircle2, XCircle, BarChart3, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock material intelligence data
const MATERIALS_DB = [
  { name: "Carbon Fiber (T300)", category: "composite", timesUsed: 127, successRate: 94, avgCost: 67, trend: "+12%", topUse: "Drone frames, prosthetics", failureMode: "Impact fracture" },
  { name: "Aluminum 6061-T6", category: "metal", timesUsed: 203, successRate: 91, avgCost: 23, trend: "+3%", topUse: "Structural components", failureMode: "Fatigue cracks" },
  { name: "PEEK Polymer", category: "plastic", timesUsed: 56, successRate: 97, avgCost: 320, trend: "+34%", topUse: "High-temp enclosures", failureMode: "UV degradation" },
  { name: "Titanium Grade 5", category: "metal", timesUsed: 89, successRate: 96, avgCost: 45, trend: "+8%", topUse: "Medical implants, aerospace", failureMode: "Galling" },
  { name: "Graphene Oxide Composite", category: "nanomaterial", timesUsed: 18, successRate: 88, avgCost: 890, trend: "+340%", topUse: "Sensors, batteries", failureMode: "Delamination" },
  { name: "Polycarbonate (PC)", category: "plastic", timesUsed: 312, successRate: 87, avgCost: 8, trend: "-2%", topUse: "Enclosures, lenses", failureMode: "Yellowing" },
  { name: "Stainless Steel 316L", category: "metal", timesUsed: 178, successRate: 93, avgCost: 15, trend: "+1%", topUse: "Marine, food equipment", failureMode: "Pitting corrosion" },
  { name: "Bio-PLA", category: "bioplastic", timesUsed: 67, successRate: 72, avgCost: 12, trend: "+220%", topUse: "Biodegradable packaging", failureMode: "Brittle in cold" },
];

const TRENDING = [
  { name: "Graphene Oxide Composites", growth: "+340%", reason: "Battery & sensor applications" },
  { name: "Bio-PLA Alternatives", growth: "+220%", reason: "Sustainability mandates" },
  { name: "Transparent Aluminum Oxide", growth: "+180%", reason: "Aerospace optics" },
  { name: "Shape Memory Alloys (NiTi)", growth: "+95%", reason: "Medical devices, soft robotics" },
];

const FAILURE_ALERTS = [
  { material: "ABS Plastic", context: "High-temperature applications", failRate: "67%", recommendation: "Use PEEK or Polycarbonate instead" },
  { material: "PLA", context: "Outdoor/UV exposure", failRate: "78%", recommendation: "Use ASA or UV-stabilized PETG" },
  { material: "Brass", context: "Seawater contact", failRate: "54%", recommendation: "Use 316L Stainless or Titanium" },
];

const MaterialIntelligencePanel = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"success" | "usage" | "cost" | "trend">("success");
  const [tab, setTab] = useState<"library" | "trends" | "failures" | "substitutions">("library");

  const filtered = MATERIALS_DB.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) || m.category.includes(search.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === "success") return b.successRate - a.successRate;
    if (sortBy === "usage") return b.timesUsed - a.timesUsed;
    if (sortBy === "cost") return a.avgCost - b.avgCost;
    return 0;
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Material Intelligence Database</h2>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50">
            <Sparkles className="h-3 w-3 text-accent/50" />
            <span>{MATERIALS_DB.reduce((s, m) => s + m.timesUsed, 0).toLocaleString()} total uses tracked</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(["library", "trends", "failures", "substitutions"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors capitalize ${
                tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <>
            {/* Search & Sort */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials..."
                  className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-2 text-[10px] text-foreground font-light outline-none"
              >
                <option value="success">Sort: Success Rate</option>
                <option value="usage">Sort: Most Used</option>
                <option value="cost">Sort: Lowest Cost</option>
              </select>
            </div>

            {/* Material cards */}
            <div className="grid gap-2.5">
              {filtered.map((mat) => (
                <div key={mat.name} className="rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm p-4 hover:border-border/30 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-[11px] font-light text-foreground">{mat.name}</h3>
                      <span className="text-[9px] text-muted-foreground/50 capitalize">{mat.category}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-light ${mat.successRate >= 90 ? "text-emerald-400" : mat.successRate >= 80 ? "text-amber-400" : "text-red-400"}`}>
                        {mat.successRate}% success
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Used</p>
                      <p className="text-[11px] text-foreground">{mat.timesUsed}x</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Avg Cost</p>
                      <p className="text-[11px] text-foreground">${mat.avgCost}/kg</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Trend</p>
                      <p className={`text-[11px] ${mat.trend.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>{mat.trend}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">Top Use</p>
                      <p className="text-[11px] text-foreground truncate">{mat.topUse}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/10 flex items-center gap-1.5">
                    <AlertTriangle className="h-2.5 w-2.5 text-amber-400/60" />
                    <span className="text-[9px] text-muted-foreground/50">Common failure: {mat.failureMode}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "trends" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-light text-foreground">Trending Materials (2026)</h3>
              </div>
              <div className="space-y-3">
                {TRENDING.map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between p-3 rounded-lg bg-card/30 border border-border/10">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-light text-muted-foreground/40">#{i + 1}</span>
                      <div>
                        <p className="text-[11px] font-light text-foreground">{t.name}</p>
                        <p className="text-[9px] text-muted-foreground/50">{t.reason}</p>
                      </div>
                    </div>
                    <span className="text-xs font-light text-emerald-400">{t.growth}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/15 bg-card/20 p-4">
              <p className="text-[10px] text-muted-foreground/50">
                Trends are calculated from usage growth across all ZALI projects. Materials with 50%+ growth are flagged as emerging.
              </p>
            </div>
          </div>
        )}

        {tab === "failures" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h3 className="text-xs font-light text-foreground">Known Failure Patterns</h3>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-4">
                ZALI automatically warns you when your design uses a material in a context known to fail.
              </p>
              <div className="space-y-3">
                {FAILURE_ALERTS.map((f) => (
                  <div key={f.material + f.context} className="rounded-lg border border-red-500/15 bg-card/30 p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-light text-foreground">{f.material}</span>
                      <span className="text-[10px] text-red-400">{f.failRate} failure rate</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50 mb-2">Context: {f.context}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-emerald-400/80">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{f.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "substitutions" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpDown className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-light text-foreground">Material Substitution Engine</h3>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mb-4">
                Find cheaper or better alternatives for any material. ZALI compares properties, cost, and historical success rates.
              </p>
              <div className="rounded-lg border border-border/15 bg-card/30 p-4">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-2">Example: Titanium Grade 5 ($45/kg)</p>
                <div className="space-y-2">
                  {[
                    { name: "Carbon Fiber", cost: "$32/kg", savings: "-29%", strength: "+15%", risk: "3% lower", badge: "text-emerald-400", riskBadge: "✅" },
                    { name: "Aluminum 7075-T6", cost: "$8/kg", savings: "-84%", strength: "-40%", risk: "12% higher", badge: "text-amber-400", riskBadge: "⚠️" },
                    { name: "Magnesium AZ31B", cost: "$12/kg", savings: "-73%", strength: "-52%", risk: "18% higher", badge: "text-red-400", riskBadge: "⚠️" },
                  ].map(alt => (
                    <div key={alt.name} className="flex items-center justify-between p-2.5 rounded-lg bg-background/30 border border-border/10">
                      <div>
                        <p className="text-[11px] font-light text-foreground">{alt.name}</p>
                        <p className="text-[9px] text-muted-foreground/50">{alt.cost} · {alt.savings} cost · {alt.strength} strength</p>
                      </div>
                      <span className={`text-[10px] ${alt.badge}`}>{alt.riskBadge} {alt.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default MaterialIntelligencePanel;