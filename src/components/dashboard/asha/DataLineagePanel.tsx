import { useState, useEffect } from "react";
import { GitBranch, Eye, Database, Filter, Calculator, FileOutput, Clock, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

interface LineageNode { id: string; type: "source" | "transform" | "aggregate" | "filter" | "output"; label: string; description: string; timestamp?: string; valuesAfter?: string; }
interface LineageChain { id: string; metricName: string; currentValue: string; chain: LineageNode[]; }

const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = { source: Database, transform: Calculator, aggregate: Calculator, filter: Filter, output: FileOutput };
const nodeColors: Record<string, string> = { source: "border-accent/30 bg-accent/10 text-accent", transform: "border-amber-500/30 bg-amber-500/10 text-amber-400", aggregate: "border-purple-500/30 bg-purple-500/10 text-purple-400", filter: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400", output: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" };

const DataLineagePanel = () => {
  const [chains, setChains] = useState<LineageChain[]>([]);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    const load = async () => {
      const { data: datasets } = await supabase.from("asha_datasets").select("*").eq("user_id", user.id).eq("status", "ready").eq("session_id", activeSession.id).order("created_at", { ascending: false });
      if (datasets && datasets.length > 0) {
        const lineageChains: LineageChain[] = datasets.map((ds: any) => {
          const schema = ds.schema || [];
          const issues = ds.issues || [];
          const chain: LineageNode[] = [];
          chain.push({ id: `${ds.id}-src`, type: "source", label: ds.file_name, description: `Raw ${ds.file_type} (${(ds.file_size / 1024).toFixed(1)}KB)`, timestamp: new Date(ds.created_at).toLocaleString(), valuesAfter: `${ds.row_count || 0} rows, ${ds.col_count || 0} cols` });
          const piiCols = schema.filter((c: any) => c.isPII);
          if (piiCols.length > 0) chain.push({ id: `${ds.id}-pii`, type: "filter", label: "PII Detection", description: `${piiCols.length} PII columns: ${piiCols.map((c: any) => c.name).join(", ")}` });
          chain.push({ id: `${ds.id}-types`, type: "transform", label: "Schema Inference", description: schema.slice(0, 5).map((c: any) => `${c.name}(${c.type})`).join(", ") });
          if (issues.length > 0) chain.push({ id: `${ds.id}-quality`, type: "filter", label: "Quality Assessment", description: issues.map((i: any) => i.description).join("; "), valuesAfter: `Score: ${ds.quality_score}%` });
          chain.push({ id: `${ds.id}-out`, type: "output", label: "Analysis Ready", description: "Available for queries, reports, entity resolution", timestamp: new Date(ds.updated_at).toLocaleString() });
          return { id: ds.id, metricName: ds.file_name, currentValue: `${ds.row_count || 0} rows · ${ds.quality_score || 0}%`, chain };
        });
        setChains(lineageChains);
        if (lineageChains.length > 0) setExpandedChain(lineageChains[0].id);
      }
      setLoading(false);
    };
    load();
  }, [user, activeSession]);

  const filtered = search ? chains.filter(c => c.metricName.toLowerCase().includes(search.toLowerCase())) : chains;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div><div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-accent" /><h2 className="text-lg font-extralight tracking-wide text-foreground">Data Lineage</h2></div><p className="text-xs font-extralight text-muted-foreground mt-1">Trace every dataset from upload through analysis.</p></div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search datasets…" className="w-full bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
      <div className="space-y-3">
        {filtered.map(chain => {
          const isOpen = expandedChain === chain.id;
          return (
            <div key={chain.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <button onClick={() => setExpandedChain(isOpen ? null : chain.id)} className="w-full flex items-center gap-4 p-4 hover:bg-foreground/5 transition-colors text-left">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-light text-foreground">{chain.metricName}</p><p className="text-[10px] text-muted-foreground/50 mt-0.5">{chain.chain.length} steps</p></div>
                <span className="text-sm font-extralight text-foreground tabular-nums">{chain.currentValue}</span>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border/20 p-4">
                  <div className="relative space-y-0">
                    {chain.chain.map((node, idx) => {
                      const Icon = nodeIcons[node.type] || Database;
                      const colors = nodeColors[node.type] || "";
                      return (
                        <div key={node.id} className="relative flex gap-4">
                          {idx < chain.chain.length - 1 && <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-border/20" />}
                          <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors}`}><Icon className="h-3.5 w-3.5" /></div>
                          <div className="flex-1 pb-5">
                            <div className="flex items-center gap-2"><p className="text-xs font-light text-foreground">{node.label}</p><span className="text-[9px] text-muted-foreground/40 uppercase">{node.type}</span></div>
                            <p className="text-[10px] font-extralight text-muted-foreground mt-0.5">{node.description}</p>
                            {node.timestamp && <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground/40"><Clock className="h-2.5 w-2.5" /> {node.timestamp}</div>}
                            {node.valuesAfter && <p className="text-[10px] text-accent/70 mt-1 font-mono">{node.valuesAfter}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12"><GitBranch className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" /><p className="text-xs text-muted-foreground/40 font-extralight">No datasets. Upload data to see lineage.</p></div>}
      </div>
    </div>
  );
};

export default DataLineagePanel;
