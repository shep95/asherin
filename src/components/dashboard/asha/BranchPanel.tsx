import { useState } from "react";
import { GitBranch, Lock, Plus, Merge, Trash2, AlertTriangle, ChevronRight } from "lucide-react";
import type { DataBranch } from "./types";

const MOCK_BRANCHES: DataBranch[] = [
  { id: "main", name: "MAIN", parentId: null, isMain: true, isProtected: true, transformCount: 0, createdAt: new Date(Date.now() - 7200000) },
  { id: "raw", name: "RAW ARCHIVE", parentId: null, isMain: false, isProtected: true, transformCount: 0, createdAt: new Date(Date.now() - 86400000 * 10) },
  { id: "q4", name: "q4-analysis", parentId: "main", isMain: false, isProtected: false, transformCount: 3, createdAt: new Date(Date.now() - 86400000 * 5) },
  { id: "seg", name: "customer-segmentation", parentId: "main", isMain: false, isProtected: false, transformCount: 7, createdAt: new Date(Date.now() - 86400000 * 10), conflicts: 2 },
  { id: "fin", name: "finance-recon", parentId: "main", isMain: false, isProtected: false, transformCount: 1, createdAt: new Date(Date.now() - 86400000 * 12) },
];

const BranchPanel = () => {
  const [branches, setBranches] = useState(MOCK_BRANCHES);
  const [activeBranch, setActiveBranch] = useState("q4");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("main");

  const createBranch = () => {
    if (!newName.trim()) return;
    const branch: DataBranch = {
      id: crypto.randomUUID(),
      name: newName.trim().toLowerCase().replace(/\s+/g, "-"),
      parentId: newParent,
      isMain: false,
      isProtected: false,
      transformCount: 0,
      createdAt: new Date(),
    };
    setBranches((prev) => [...prev, branch]);
    setActiveBranch(branch.id);
    setShowNew(false);
    setNewName("");
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Branches</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Git-style version control for your data</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          New Branch
        </button>
      </div>

      {/* New branch form */}
      {showNew && (
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-3">
          <h3 className="text-xs font-light text-foreground">New Branch</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Branch name…" className="w-full bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Branch from:</label>
            <select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none w-full">
              {branches.filter((b) => b.isMain || b.isProtected).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={createBranch} className="rounded-lg bg-foreground/10 px-4 py-2 text-xs text-foreground hover:bg-foreground/15 transition-colors">Create</button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-border/20 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Branch list */}
      <div className="space-y-2">
        {branches.map((branch) => (
          <div
            key={branch.id}
            onClick={() => !branch.isProtected && setActiveBranch(branch.id)}
            className={`rounded-xl border p-4 transition-colors cursor-pointer ${
              activeBranch === branch.id
                ? "border-accent/30 bg-accent/5"
                : "border-border/20 bg-card/20 hover:bg-foreground/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {branch.isProtected ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <GitBranch className="h-3.5 w-3.5 text-accent" />}
                <span className="text-sm font-light text-foreground">{branch.name}</span>
                {activeBranch === branch.id && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[9px] text-accent">Active</span>}
              </div>
              {!branch.isProtected && (
                <div className="flex items-center gap-1">
                  {branch.conflicts && branch.conflicts > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />{branch.conflicts} conflicts
                    </span>
                  )}
                  <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Merge className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/50">
              {branch.isProtected ? (
                <span>{branch.isMain ? "Protected — merge required" : "Original files — immutable"}</span>
              ) : (
                <>
                  <span>{branch.transformCount} transforms applied</span>
                  <span>Created {branch.createdAt.toLocaleDateString()}</span>
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
