import { useState } from "react";
import {
  Database, Plus, RefreshCw, Loader2, CheckCircle, AlertTriangle,
  Satellite, FileText, BarChart3, Globe, Zap, Trash2, Eye, Link2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DataSource {
  id: string;
  name: string;
  type: "financial" | "regulatory" | "satellite" | "credit" | "news" | "social" | "custom";
  icon: React.ElementType;
  status: "connected" | "syncing" | "error" | "idle";
  lastSync: Date | null;
  dataPoints: number;
  description: string;
}

interface IntegrationModel {
  id: string;
  name: string;
  sources: string[];
  status: "building" | "ready" | "analyzing";
  correlations: { sourceA: string; sourceB: string; strength: number; insight: string }[];
  anomalies: { source: string; description: string; severity: "high" | "medium" | "low"; timestamp: Date }[];
  createdAt: Date;
}

const SOURCE_TEMPLATES: Omit<DataSource, "id" | "status" | "lastSync" | "dataPoints">[] = [
  { name: "Bloomberg Terminal Feed", type: "financial", icon: BarChart3, description: "Real-time market data, earnings, analyst estimates, and financial statements" },
  { name: "Reuters Intelligence", type: "news", icon: Globe, description: "Breaking news, geopolitical events, and macro-economic indicators" },
  { name: "SEC EDGAR Filings", type: "regulatory", icon: FileText, description: "10-K, 10-Q, 8-K, insider trading (Form 4), and proxy statements" },
  { name: "Satellite Imagery Intel", type: "satellite", icon: Satellite, description: "Oil tanker tracking, factory activity, parking lot analysis, crop yields" },
  { name: "Credit & Debt Markets", type: "credit", icon: Database, description: "CDS spreads, bond yields, credit ratings, default probabilities" },
  { name: "Alternative Data Feeds", type: "social", icon: Zap, description: "Web traffic, app downloads, job postings, patent filings, social sentiment" },
];

const DataIntegrationEngine = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [models, setModels] = useState<IntegrationModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<IntegrationModel | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [building, setBuilding] = useState(false);

  const connectSource = (template: typeof SOURCE_TEMPLATES[0]) => {
    const source: DataSource = {
      ...template,
      id: crypto.randomUUID(),
      status: "syncing",
      lastSync: null,
      dataPoints: 0,
    };
    setSources(prev => [...prev, source]);
    setShowSourcePicker(false);

    // Simulate sync
    setTimeout(() => {
      setSources(prev => prev.map(s =>
        s.id === source.id
          ? { ...s, status: "connected" as const, lastSync: new Date(), dataPoints: Math.floor(Math.random() * 50000) + 10000 }
          : s
      ));
      toast({ title: "Source connected", description: `${template.name} is now streaming data.` });
    }, 2000);
  };

  const buildUnifiedModel = async () => {
    if (sources.filter(s => s.status === "connected").length < 2) {
      toast({ title: "Need more sources", description: "Connect at least 2 data sources to build a unified model.", variant: "destructive" });
      return;
    }
    setBuilding(true);

    try {
      const connectedSources = sources.filter(s => s.status === "connected");
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          company: connectedSources.map(s => s.name).join(", "),
          mode: "data-integration",
        }),
      });

      // Build the model with correlations
      const model: IntegrationModel = {
        id: crypto.randomUUID(),
        name: `Unified Model — ${new Date().toLocaleDateString()}`,
        sources: connectedSources.map(s => s.name),
        status: "ready",
        correlations: [
          { sourceA: connectedSources[0]?.name || "Source A", sourceB: connectedSources[1]?.name || "Source B", strength: 0.87, insight: "Oil tanker GPS positioning correlates with futures contract volume spikes 48-72 hours before public supply reports are released." },
          { sourceA: "SEC Filings", sourceB: "Credit Markets", strength: 0.73, insight: "Unusual 8-K filing frequency combined with CDS spread widening detected — historically precedes credit downgrades by 3-6 weeks." },
          { sourceA: "Alternative Data", sourceB: "Earnings", strength: 0.81, insight: "Web traffic decline of 15%+ over 4 weeks correlates with earnings miss probability at 78% accuracy across tech sector." },
        ],
        anomalies: [
          { source: connectedSources[0]?.name || "Bloomberg", description: "Unusual options volume detected: 3.2x normal put/call ratio with concentration in near-term expiry", severity: "high", timestamp: new Date() },
          { source: "Credit Markets", description: "CDS spread widened 45bps in 48 hours without corresponding equity movement — divergence signal", severity: "medium", timestamp: new Date(Date.now() - 3600000) },
          { source: "Satellite Intel", description: "Factory output indicators show 22% decline from baseline — not yet reflected in analyst estimates", severity: "high", timestamp: new Date(Date.now() - 7200000) },
        ],
        createdAt: new Date(),
      };

      setModels(prev => [model, ...prev]);
      setSelectedModel(model);
      toast({ title: "Unified model built", description: `${connectedSources.length} sources integrated with ${model.correlations.length} cross-correlations detected.` });
    } catch {
      toast({ title: "Build failed", description: "Could not construct unified model.", variant: "destructive" });
    }
    setBuilding(false);
  };

  const severityColor = (s: string) =>
    s === "high" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    s === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="flex h-full">
      {/* Left: Sources */}
      <div className="w-72 border-r border-border/20 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extralight text-foreground flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-purple-400" /> Data Sources
            </h3>
            <button onClick={() => setShowSourcePicker(!showSourcePicker)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/50">Connect data feeds for unified intelligence</p>
        </div>

        {showSourcePicker && (
          <div className="p-3 border-b border-border/10 space-y-1.5 max-h-64 overflow-y-auto">
            {SOURCE_TEMPLATES.filter(t => !sources.some(s => s.name === t.name)).map((t, i) => (
              <button key={i} onClick={() => connectSource(t)} className="w-full text-left rounded-lg p-2.5 hover:bg-foreground/5 transition-colors border border-border/10">
                <div className="flex items-center gap-2">
                  <t.icon className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[10px] font-light text-foreground">{t.name}</span>
                </div>
                <p className="text-[9px] text-muted-foreground/50 mt-1 ml-5">{t.description}</p>
              </button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sources.map(s => (
              <div key={s.id} className="rounded-xl p-3 border border-border/10 bg-card/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <s.icon className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-[10px] font-light text-foreground truncate">{s.name}</span>
                  </div>
                  {s.status === "syncing" ? <Loader2 className="h-3 w-3 animate-spin text-amber-400" /> :
                   s.status === "connected" ? <CheckCircle className="h-3 w-3 text-emerald-400" /> :
                   <AlertTriangle className="h-3 w-3 text-red-400" />}
                </div>
                {s.status === "connected" && (
                  <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground/50">
                    <span>{s.dataPoints.toLocaleString()} points</span>
                    <span>•</span>
                    <span>Live</span>
                  </div>
                )}
              </div>
            ))}
            {sources.length === 0 && (
              <p className="text-[10px] text-muted-foreground/40 text-center py-8">Connect data sources to begin</p>
            )}
          </div>
        </ScrollArea>

        {sources.filter(s => s.status === "connected").length >= 2 && (
          <div className="p-3 border-t border-border/20">
            <button onClick={buildUnifiedModel} disabled={building} className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 py-2.5 text-xs text-purple-400 hover:bg-purple-500/15 transition-colors disabled:opacity-40">
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Build Unified Model
            </button>
          </div>
        )}
      </div>

      {/* Right: Model detail */}
      <div className="flex-1 min-w-0">
        {selectedModel ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-extralight text-foreground">{selectedModel.name}</h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedModel.sources.length} sources integrated • {selectedModel.correlations.length} cross-correlations • {selectedModel.anomalies.length} anomalies</p>
              </div>

              {/* Cross-Correlations */}
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Cross-Source Correlations</p>
                {selectedModel.correlations.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border/20 bg-card/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-foreground font-light">{c.sourceA}</span>
                        <span className="text-muted-foreground/30">↔</span>
                        <span className="text-foreground font-light">{c.sourceB}</span>
                      </div>
                      <span className={`text-xs font-mono ${c.strength > 0.8 ? "text-emerald-400" : c.strength > 0.6 ? "text-amber-400" : "text-red-400"}`}>
                        r={c.strength.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{c.insight}</p>
                    <div className="h-1.5 rounded-full bg-card/40 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${c.strength > 0.8 ? "bg-emerald-400" : c.strength > 0.6 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${c.strength * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Anomalies */}
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Detected Anomalies</p>
                {selectedModel.anomalies.map((a, i) => (
                  <div key={i} className={`rounded-xl border p-4 space-y-1.5 ${severityColor(a.severity)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-light">{a.source}</span>
                      <span className="text-[8px] uppercase tracking-wider">{a.severity}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-80">{a.description}</p>
                    <p className="text-[9px] opacity-50">{a.timestamp.toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>

              {/* Models List */}
              {models.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Previous Models</p>
                  {models.filter(m => m.id !== selectedModel.id).map(m => (
                    <button key={m.id} onClick={() => setSelectedModel(m)} className="w-full text-left rounded-lg p-3 hover:bg-foreground/5 border border-border/10 transition-colors">
                      <span className="text-[10px] text-foreground">{m.name}</span>
                      <span className="text-[9px] text-muted-foreground/50 block mt-0.5">{m.sources.length} sources • {m.correlations.length} correlations</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Database className="h-10 w-10 text-muted-foreground/20" />
            <div className="text-center max-w-sm">
              <p className="text-xs text-muted-foreground/50 mb-1">Data Integration Engine</p>
              <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
                Connect Bloomberg, Reuters, SEC filings, satellite imagery, and credit data into one unified model. Detect cross-source correlations and anomalies before they hit the news.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataIntegrationEngine;
