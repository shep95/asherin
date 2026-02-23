import { useState, useEffect, useMemo } from "react";
import { GitBranch, Lock, Plus, Trash2, AlertTriangle, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Branch {
  id: string;
  name: string;
  parent_id: string | null;
  is_main: boolean;
  is_protected: boolean;
  transform_count: number;
  conflicts: number;
  created_at: string;
}

interface DatasetHit {
  id: string;
  file_name: string;
  tags: string[];
  created_at: string;
}

const BranchPanel = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Deep-search source generator state
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<DatasetHit[]>([]);
  const [sourceSearching, setSourceSearching] = useState(false);
  const [selectedSources, setSelectedSources] = useState<DatasetHit[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("asha_branches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setBranches(data as any);
        const main = data.find((b: any) => b.is_main);
        setActiveBranch(main?.id || data[0].id);
      } else {
        const mainBranch = { user_id: user.id, name: "MAIN", is_main: true, is_protected: true };
        const rawBranch = { user_id: user.id, name: "RAW ARCHIVE", is_main: false, is_protected: true };
        const { data: created } = await supabase.from("asha_branches").insert([mainBranch, rawBranch]).select();
        if (created) {
          setBranches(created as any);
          setActiveBranch(created[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Deep search datasets by name, tags, or description
  useEffect(() => {
    if (!sourceQuery.trim() || !user) {
      setSourceResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSourceSearching(true);
      const q = sourceQuery.trim().toLowerCase();
      const { data } = await supabase
        .from("asha_datasets")
        .select("id, file_name, tags, created_at")
        .eq("user_id", user.id)
        .ilike("file_name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      setSourceResults((data ?? []) as DatasetHit[]);
      setSourceSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [sourceQuery, user]);

  const toggleSource = (ds: DatasetHit) => {
    setSelectedSources((prev) =>
      prev.find((s) => s.id === ds.id) ? prev.filter((s) => s.id !== ds.id) : [...prev, ds]
    );
  };

  const createBranch = async () => {
    if (!newName.trim() || !user) return;
    const { data } = await supabase.from("asha_branches").insert({
      user_id: user.id,
      name: newName.trim().toLowerCase().replace(/\s+/g, "-"),
      parent_id: newParent || null,
      is_main: false,
      is_protected: false,
    }).select().single();

    if (data) {
      setBranches((prev) => [...prev, data as any]);
      setActiveBranch(data.id);
    }
    setShowNew(false);
    setNewName("");
    setSourceQuery("");
    setSourceResults([]);
    setSelectedSources([]);
  };

  const deleteBranch = async (id: string) => {
    await supabase.from("asha_branches").delete().eq("id", id);
    setBranches((prev) => prev.filter((b) => b.id !== id));
    if (activeBranch === id) {
      const main = branches.find((b) => b.is_main);
      if (main) setActiveBranch(main.id);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Branches</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Git-style version control for your data</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
          <Plus className="h-3.5 w-3.5" />New Branch
        </button>
      </div>

      {showNew && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Branch name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Branch from:</label>
            <select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none w-full">
              <option value="">None</option>
              {branches.filter((b) => b.is_main || b.is_protected).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Deep Search Source Generator */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Source Generator — search datasets</label>
            <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <input
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="e.g. 2023 infrastructure update…"
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              {sourceSearching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {sourceQuery && !sourceSearching && (
                <button onClick={() => { setSourceQuery(""); setSourceResults([]); }} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              )}
            </div>

            {sourceResults.length > 0 && (
              <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-border/10 bg-card/10 divide-y divide-border/10">
                {sourceResults.map((ds) => {
                  const selected = selectedSources.some((s) => s.id === ds.id);
                  return (
                    <button key={ds.id} onClick={() => toggleSource(ds)} className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${selected ? "bg-accent/10 text-accent" : "text-foreground hover:bg-foreground/5"}`}>
                      <span className="truncate">{ds.file_name}</span>
                      {selected && <span className="text-[9px] text-accent shrink-0 ml-2">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedSources.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedSources.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent text-[9px] px-2 py-0.5">
                    {s.file_name}
                    <button onClick={() => toggleSource(s)}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={createBranch} className="rounded-lg bg-foreground/10 px-4 py-2 text-xs text-foreground hover:bg-foreground/15 transition-colors">Create</button>
            <button onClick={() => { setShowNew(false); setSourceQuery(""); setSourceResults([]); setSelectedSources([]); }} className="rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {branches.map((branch) => (
          <div key={branch.id} onClick={() => !branch.is_protected && setActiveBranch(branch.id)} className={`rounded-xl border p-4 transition-colors cursor-pointer ${activeBranch === branch.id ? "border-accent/30 bg-accent/5" : "border-border/20 bg-card/20 hover:bg-foreground/5"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {branch.is_protected ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <GitBranch className="h-3.5 w-3.5 text-accent" />}
                <span className="text-sm font-light text-foreground">{branch.name}</span>
                {activeBranch === branch.id && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[9px] text-accent">Active</span>}
              </div>
              {!branch.is_protected && (
                <div className="flex items-center gap-1">
                  {branch.conflicts > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />{branch.conflicts} conflicts
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deleteBranch(branch.id); }} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/50">
              {branch.is_protected ? (
                <span>{branch.is_main ? "Protected — merge required" : "Original files — immutable"}</span>
              ) : (
                <>
                  <span>{branch.transform_count} transforms</span>
                  <span>Created {new Date(branch.created_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BranchPanel;
