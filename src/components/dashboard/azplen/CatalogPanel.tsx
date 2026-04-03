import { useState, useEffect } from "react";
import { Search, Tag, Clock, Table2, Eye, ExternalLink, Loader2, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import { useAzplenNav } from "./AzplenView";

interface CatalogEntry {
  id: string;
  file_name: string;
  file_type: string;
  row_count: number | null;
  col_count: number | null;
  quality_score: number | null;
  tags: string[];
  description: string;
  branch: string;
  project_name: string;
  created_at: string;
  schema: any[];
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const CatalogPanel = () => {
  const [datasets, setDatasets] = useState<CatalogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();
  const { navigateToTab } = useAzplenNav();

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("asha_datasets")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: false });
      if (data) setDatasets(data as any);
      setLoading(false);
    };
    load();
  }, [user, activeSession]);

  const filtered = search
    ? datasets.filter((c) => {
        const q = search.toLowerCase();
        return c.file_name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)) || c.description?.toLowerCase().includes(q);
      })
    : datasets;

  const totalRows = datasets.reduce((s, c) => s + (c.row_count || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Catalog</h2>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          {datasets.length} datasets · {totalRows.toLocaleString()} total rows
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground/50" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search datasets, tags…" className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
        <span className="text-[10px] text-muted-foreground/40">{filtered.length} results</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-foreground/5 transition-colors" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-light text-foreground truncate">{entry.file_name}</p>
                    <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] text-muted-foreground uppercase">{entry.file_type.split("/").pop()}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/50">
                    {entry.project_name && <span>{entry.project_name}</span>}
                    <span>{entry.branch}</span>
                    <span>{(entry.row_count || 0).toLocaleString()} rows</span>
                    <span>{entry.col_count || 0} cols</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeAgo(entry.created_at)}</span>
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary/30 px-2 py-0.5 text-[9px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {entry.quality_score != null && (
                    <span className={`text-[10px] ${entry.quality_score >= 90 ? "text-emerald-400" : entry.quality_score >= 75 ? "text-amber-400" : "text-destructive"}`}>
                      {entry.quality_score}% quality
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); navigateToTab("table", entry.id); }}
                    className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors">
                    <Table2 className="h-3 w-3" /> View Data
                  </button>
                </div>
              </div>

              {expanded === entry.id && (
                <div className="border-t border-border/20 p-4 space-y-3">
                  {entry.description && <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{entry.description}</p>}
                  {entry.schema && entry.schema.length > 0 && (
                    <div className="space-y-1">
                      {entry.schema.map((col: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="font-mono text-foreground">{col.name}</span>
                          <span className="rounded bg-secondary/50 px-1 py-0.5">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground/40 font-extralight">{datasets.length === 0 ? "No datasets yet. Upload files in the Ingest tab." : "No datasets match your search"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CatalogPanel;
