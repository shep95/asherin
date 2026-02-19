import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Eye, Edit3, Trash2, UserPlus, FileText, Search, Filter, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuditEntry {
  id: string;
  user_id: string;
  team_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const actionIcons: Record<string, React.ElementType> = {
  team_created: UserPlus,
  invite_sent: UserPlus,
  invite_accepted: UserPlus,
  member_removed: Trash2,
  notebook_created: FileText,
  data_viewed: Eye,
  data_modified: Edit3,
};

const actionColors: Record<string, string> = {
  team_created: "text-emerald-400",
  invite_sent: "text-blue-400",
  invite_accepted: "text-emerald-400",
  member_removed: "text-red-400",
  notebook_created: "text-purple-400",
  data_viewed: "text-muted-foreground",
  data_modified: "text-amber-400",
};

const AuditLogView = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from as any)("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    setEntries((data ?? []) as AuditEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filtered = entries.filter(e => {
    if (!search) return true;
    return e.action.includes(search.toLowerCase()) || e.resource_type.includes(search.toLowerCase());
  });

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="text-sm font-extralight tracking-widest text-muted-foreground animate-pulse">Loading audit log…</div></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">AUDIT TRAIL</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">Complete access and activity log for compliance</p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-card/30 hover:bg-card/50 text-muted-foreground px-4 py-2 text-xs font-light transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-4 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search audit log…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-extralight text-muted-foreground">No audit entries yet. Actions will be logged here.</p>
            </div>
          )}
          {filtered.map(entry => {
            const Icon = actionIcons[entry.action] ?? Shield;
            const color = actionColors[entry.action] ?? "text-muted-foreground";
            const time = new Date(entry.created_at);
            return (
              <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border/10 bg-card/20 px-4 py-3">
                <div className={`mt-0.5 ${color}`}><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-light text-foreground capitalize">{entry.action.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-muted-foreground/50">{time.toLocaleDateString()} {time.toLocaleTimeString()}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {entry.resource_type}{entry.resource_id ? ` • ${entry.resource_id.slice(0, 8)}…` : ""}
                    {entry.details && Object.keys(entry.details).length > 0 && ` • ${JSON.stringify(entry.details).slice(0, 60)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AuditLogView;
