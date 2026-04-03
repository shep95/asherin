import { useState, useEffect } from "react";
import { GitBranch, Lock, Plus, Merge, Trash2, AlertTriangle, Loader2 } from "lucide-react";
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

const BranchPanel = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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
        // Auto-create MAIN and RAW branches
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

  const createBranch = async () => {
    if (!newName.trim() || !user) return;
    const { data, error } = await supabase.from("asha_branches").insert({
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
          <div className="flex gap-2">
            <button onClick={createBranch} className="rounded-lg bg-foreground/10 px-4 py-2 text-xs text-foreground hover:bg-foreground/15 transition-colors">Create</button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
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
