import { useState, useMemo } from "react";
import {
  Shield, Star, AlertTriangle, Clock, RefreshCw, Search, Globe,
  Eye, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Hash, Download
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SourceRecord {
  id: string;
  domain: string;
  accuracy: number; // 0-100
  biasVector: string;
  originality: number; // 0-100
  recency: string;
  overallScore: number;
  usageCount: number;
  notes: string;
  isDarkPattern: boolean;
  darkPatternReason?: string;
  lastUsed: number;
}

interface QueryRecord {
  id: string;
  query: string;
  filters: string;
  sources: string;
  timestamp: number;
  resultCount: number;
}

interface NomadSourceIntelProps {
  investigations: { query: string; findings: string; created_at: string; sources_checked: string[] }[];
}

const STORAGE_KEY = "nomad_source_intel";

function loadData(): { sources: SourceRecord[]; queries: QueryRecord[] } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"sources":[],"queries":[]}'); } catch { return { sources: [], queries: [] }; }
}
function saveData(d: { sources: SourceRecord[]; queries: QueryRecord[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

const NomadSourceIntel = ({ investigations }: NomadSourceIntelProps) => {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState<"sources" | "queries" | "dark">("sources");
  const [search, setSearch] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newAccuracy, setNewAccuracy] = useState(50);
  const [newBias, setNewBias] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = (newData: typeof data) => { setData(newData); saveData(newData); };

  // Auto-build query records from investigations
  const queryRecords = useMemo(() => {
    const existing = new Set(data.queries.map(q => q.query));
    const newQueries: QueryRecord[] = [];
    for (const inv of investigations) {
      if (!existing.has(inv.query)) {
        newQueries.push({
          id: crypto.randomUUID(),
          query: inv.query,
          filters: "default",
          sources: (inv.sources_checked || []).join(", "),
          timestamp: new Date(inv.created_at).getTime(),
          resultCount: 0,
        });
      }
    }
    return [...data.queries, ...newQueries];
  }, [data.queries, investigations]);

  const addSource = () => {
    if (!newDomain.trim()) return;
    const source: SourceRecord = {
      id: crypto.randomUUID(),
      domain: newDomain.trim(),
      accuracy: newAccuracy,
      biasVector: newBias || "unknown",
      originality: 50,
      recency: "current",
      overallScore: newAccuracy,
      usageCount: 0,
      notes: "",
      isDarkPattern: false,
      lastUsed: Date.now(),
    };
    save({ ...data, sources: [...data.sources, source] });
    setNewDomain("");
    setNewBias("");
    setAddingSource(false);
  };

  const updateSource = (id: string, updates: Partial<SourceRecord>) => {
    save({ ...data, sources: data.sources.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const toggleDarkPattern = (id: string, reason: string = "") => {
    save({
      ...data,
      sources: data.sources.map(s =>
        s.id === id ? { ...s, isDarkPattern: !s.isDarkPattern, darkPatternReason: reason } : s
      ),
    });
  };

  const replayQuery = (query: QueryRecord) => {
    // Copy query details to clipboard for manual re-run
    navigator.clipboard.writeText(`Query: ${query.query}\nFilters: ${query.filters}\nSources: ${query.sources}`);
  };

  const darkPatternSources = data.sources.filter(s => s.isDarkPattern);
  const filteredSources = search.trim()
    ? data.sources.filter(s => s.domain.toLowerCase().includes(search.toLowerCase()))
    : data.sources;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20">
        {(["sources", "queries", "dark"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            {t === "sources" ? `Reliability (${data.sources.length})` : t === "queries" ? `Query Replay (${queryRecords.length})` : `Dark Patterns (${darkPatternSources.length})`}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "sources" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-1.5">
                  <Search className="h-3 w-3 text-muted-foreground/40" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources..." className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" />
                </div>
                <button onClick={() => setAddingSource(true)} className="text-[10px] text-foreground/50 hover:text-foreground">+ Add</button>
              </div>

              {addingSource && (
                <div className="rounded-xl border border-border/20 bg-card/20 p-3 space-y-2 mb-3">
                  <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="Domain (e.g. reuters.com)" className="w-full bg-transparent text-xs text-foreground outline-none border-b border-border/20 pb-1" autoFocus />
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground/40">Accuracy:</span>
                    <input type="range" min={0} max={100} value={newAccuracy} onChange={e => setNewAccuracy(Number(e.target.value))} className="w-24 h-1 accent-accent" />
                    <span className="text-[10px] text-foreground/60">{newAccuracy}%</span>
                  </div>
                  <input value={newBias} onChange={e => setNewBias(e.target.value)} placeholder="Bias vector (e.g. left-center, corporate)" className="w-full bg-transparent text-[11px] text-foreground outline-none border-b border-border/20 pb-1" />
                  <div className="flex gap-2">
                    <button onClick={addSource} className="text-[10px] text-accent">Save</button>
                    <button onClick={() => setAddingSource(false)} className="text-[10px] text-muted-foreground/40">Cancel</button>
                  </div>
                </div>
              )}

              {filteredSources.map(s => (
                <div key={s.id} className="rounded-xl border border-border/15 bg-card/10 p-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground/40" />
                    <span className="text-xs text-foreground/80 font-light flex-1">{s.domain}</span>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] ${s.overallScore >= 70 ? "bg-emerald-500/15 text-emerald-400" : s.overallScore >= 40 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                      {s.overallScore}/100
                    </div>
                    {s.isDarkPattern && <AlertTriangle className="h-3 w-3 text-red-400" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground/40">
                    <span>Accuracy: {s.accuracy}%</span>
                    <span>Bias: {s.biasVector}</span>
                    <span>Originality: {s.originality}%</span>
                    <button onClick={() => toggleDarkPattern(s.id, "Manual flag")} className="ml-auto hover:text-red-400">
                      {s.isDarkPattern ? "Unflag" : "Flag dark pattern"}
                    </button>
                  </div>
                </div>
              ))}
              {filteredSources.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground/40">No sources tracked yet. Add sources to build your reliability database.</p>
                </div>
              )}
            </div>
          )}

          {tab === "queries" && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/40 mb-3">Re-run any previous search with identical parameters to reproduce findings.</p>
              {queryRecords.map(q => (
                <div key={q.id} className="rounded-xl border border-border/15 bg-card/10 p-3 group">
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs text-foreground/70 font-light flex-1 truncate">{q.query}</span>
                    <button onClick={() => replayQuery(q)} className="flex items-center gap-1 text-[9px] text-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <RefreshCw className="h-3 w-3" /> Replay
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground/30">
                    <span>{new Date(q.timestamp).toLocaleString()}</span>
                    <span>Sources: {q.sources || "default"}</span>
                  </div>
                </div>
              ))}
              {queryRecords.length === 0 && (
                <div className="text-center py-8">
                  <Search className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground/40">No queries recorded yet.</p>
                </div>
              )}
            </div>
          )}

          {tab === "dark" && (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground/40 mb-3">Sources flagged as SEO spam, scraped mirrors, or content farms. Shows canonical source candidates when available.</p>
              {darkPatternSources.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground/40">No dark patterns flagged.</p>
                </div>
              ) : darkPatternSources.map(s => (
                <div key={s.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs text-foreground/70 font-light">{s.domain}</span>
                  </div>
                  {s.darkPatternReason && <p className="text-[10px] text-red-400/60 mt-1">{s.darkPatternReason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadSourceIntel;
