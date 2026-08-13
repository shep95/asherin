import { useState, useEffect } from "react";
import { Brain, Trash2, Edit3, Download, Plus, X, Check, Loader2, Shield, Eye, EyeOff, AlertTriangle, FileText, MessageSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { emitPull } from "@/lib/connect/emitPull";
import { MEMORY_KINDS, guardMemoryContent, memoryLabel, type MemoryKind } from "@/lib/memory/memoryKinds";
import { getActiveScope, onScopeChange, type ProjectScope } from "@/lib/projects/scope";
import { useIsV2 } from "@/lib/dashboardUiContext";
import { V2Action, v2ActionClass } from "@/components/dashboard/v2/V2PageShell";

interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  created_at: string;
  source?: string;
  reason?: string;
  enabled?: boolean;
  kind?: MemoryKind;
  project_id?: string | null;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  conversation: MessageSquare,
  manual: Edit3,
  system: Shield,
  file: FileText,
};

const MemoryCenterView = () => {
  const v2 = useIsV2();
  const { user } = useAuth();
  const { toast } = useToast();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMode, setAddingMode] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newKind, setNewKind] = useState<MemoryKind>("prefer");
  const [scopeToProject, setScopeToProject] = useState(true);
  const [scope, setScope] = useState<ProjectScope | null>(() => getActiveScope());
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);

  useEffect(() => onScopeChange(setScope), []);

  useEffect(() => {
    if (!user) return;
    supabase.from("memory_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setMemories((data ?? []).map(m => ({
          ...m,
          source: (m as any).source || "manual",
          reason: (m as any).reason || "Manually added",
          enabled: (m as any).enabled !== false,
          kind: ((m as any).kind || "general") as MemoryKind,
          project_id: (m as any).project_id ?? null,
        })));
        setLoading(false);
      });
  }, [user]);

  const addMemory = async () => {
    if (!user) return;
    // Credentials never enter memory — Guardian Vault is the only place for those.
    const guard = guardMemoryContent(newContent);
    if (!guard.ok) {
      toast({ title: "Not stored", description: guard.reason, variant: "destructive" });
      void emitPull({
        organ: "memory", capability: "learn", fromSurface: "memory", status: "fail",
        quote: `${newKind}: refused`, meta: { reason: guard.reason ?? "refused" },
      });
      return;
    }
    const projectId = scopeToProject && scope ? scope.projectId : null;
    const { data, error } = await supabase.from("memory_entries")
      .insert({ user_id: user.id, content: newContent.trim(), category: newCategory, kind: newKind, project_id: projectId } as never)
      .select().single();
    if (error || !data) {
      toast({ title: "Save failed", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    setMemories((prev) => [{ ...(data as any), source: "manual", reason: "Manually added", enabled: true, kind: newKind, project_id: projectId }, ...prev]);
    void emitPull({
      organ: "memory", capability: "learn", fromSurface: "memory", status: "ok",
      quote: memoryLabel(newKind, newContent), meta: { kind: newKind, project_id: projectId ?? "" },
    });
    setNewContent(""); setNewCategory("general"); setNewKind("prefer"); setAddingMode(false);
  };


  const deleteMemory = async (id: string) => {
    const target = memories.find((m) => m.id === id);
    const { error } = await supabase.from("memory_entries").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setMemories((prev) => prev.filter((m) => m.id !== id));
    void emitPull({
      organ: "memory", capability: "forget", fromSurface: "memory", status: "ok",
      quote: target ? memoryLabel((target.kind ?? "general") as MemoryKind, target.content) : "memory removed",
    });
  };


  const saveEdit = async (id: string) => {
    const trimmed = editContent.trim();
    const guard = guardMemoryContent(trimmed);
    if (!guard.ok) {
      toast({ title: "Not saved", description: guard.reason, variant: "destructive" });
      return;
    }
    setEditId(null);
    const { error } = await supabase.from("memory_entries").update({ content: trimmed }).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, content: trimmed } : m));
  };

  const toggleEnabled = async (id: string) => {
    const target = memories.find(m => m.id === id);
    if (!target) return;
    const next = !target.enabled;
    setMemories(prev => prev.map(m => m.id === id ? { ...m, enabled: next } : m));
    const { error } = await (supabase.from("memory_entries") as any)
      .update({ enabled: next }).eq("id", id);
    if (error) {
      // Roll back on failure so the UI doesn't lie.
      setMemories(prev => prev.map(m => m.id === id ? { ...m, enabled: !next } : m));
      toast({ title: "Toggle failed", description: error.message, variant: "destructive" });
    }
  };

  const wipeAll = async () => {
    if (!user) return;
    await supabase.from("memory_entries").delete().eq("user_id", user.id);
    setMemories([]);
    toast({ title: "All memories wiped" });
  };

  const exportAll = () => {
    const json = JSON.stringify(memories, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "asherin-memories.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const categories = [...new Set(memories.map(m => m.category))];
  const enabledCount = memories.filter(m => m.enabled).length;
  const disabledCount = memories.filter(m => !m.enabled).length;

  const filtered = memories.filter(m => {
    if (!showDisabled && !m.enabled) return false;
    if (filterCategory && m.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || (m.reason || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      {v2 ? (
        // v.2: destructive wipe is not a header peer of export — it stays in
        // the list footer, out of the accidental-click path.
        <V2Action>
          <button onClick={exportAll} className={v2ActionClass} title="Export every memory as json">
            <Download className="h-3.5 w-3.5" /> export
          </button>
        </V2Action>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extralight tracking-wide text-foreground">Memory</h2>
            <p className="text-sm font-extralight text-muted-foreground mt-1">
              Every rule asherin carries is listed here, with its origin — and can be deleted. Credentials are refused: those live in Guardian Vault.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportAll} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors" title="Export all">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={wipeAll} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-2 text-destructive hover:text-destructive/80 transition-colors" title="Wipe all">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {v2 && (
        <div className="flex justify-end">
          <button onClick={wipeAll} className="text-[10px] font-light text-destructive/70 hover:text-destructive transition-colors">
            wipe every memory
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[10px] font-light text-muted-foreground/50">
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {enabledCount} active</span>
        <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> {disabledCount} disabled</span>
        <span>{memories.length} total</span>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>
        <select
          value={filterCategory || ""}
          onChange={e => setFilterCategory(e.target.value || null)}
          className="text-xs bg-card/20 border border-border/20 rounded-xl px-2 py-2 text-foreground outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowDisabled(!showDisabled)}
          className={`px-2 py-2 rounded-xl border border-border/20 text-xs transition-colors ${showDisabled ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50"}`}
        >
          {showDisabled ? "Hide Disabled" : "Show Disabled"}
        </button>
      </div>

      {/* Add memory */}
      {addingMode ? (
        <div className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-3">
          <input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="What rule should asherin follow?" className="w-full bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none" />
          <div className="flex flex-wrap gap-1.5">
            {MEMORY_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setNewKind(k.id)}
                title={k.hint}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-light transition-colors ${
                  newKind === k.id ? "border-foreground/40 text-foreground bg-foreground/10" : "border-border/20 text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          {scope && (
            <label className="flex items-center gap-2 text-[10px] font-light text-muted-foreground">
              <input type="checkbox" checked={scopeToProject} onChange={(e) => setScopeToProject(e.target.checked)} className="accent-current" />
              Only apply inside project “{scope.name}”
            </label>
          )}
          <div className="flex items-center gap-2">
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="text-xs bg-background/50 border border-border/20 rounded-lg px-2 py-1 text-foreground outline-none">
              <option value="general">General</option>
              <option value="preferences">Preferences</option>
              <option value="context">Context</option>
              <option value="technical">Technical</option>
            </select>
            <button onClick={addMemory} className="text-xs bg-foreground text-background px-3 py-1 rounded-lg">Save</button>
            <button onClick={() => setAddingMode(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground/50">
            No api keys, passwords, tokens or seed phrases — those are refused here on purpose.
          </p>
        </div>
      ) : (

        <button onClick={() => setAddingMode(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/30 bg-card/10 p-3 text-sm font-light text-muted-foreground hover:text-foreground hover:border-border/50 transition-all">
          <Plus className="h-4 w-4" /> Add Memory Manually
        </button>
      )}

      {/* Memory list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          {searchQuery ? "No memories match your search." : "No memories stored yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const SourceIcon = SOURCE_ICONS[m.source || "manual"] || Brain;
            return (
              <div key={m.id} className={`group rounded-xl border bg-card/20 backdrop-blur-sm p-4 transition-all ${
                m.enabled ? "border-border/20" : "border-border/10 opacity-50"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <SourceIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      {editId === m.id ? (
                        <div className="flex items-center gap-2">
                          <input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-border/30" />
                          <button onClick={() => saveEdit(m.id)}><Check className="h-3.5 w-3.5 text-foreground" /></button>
                          <button onClick={() => setEditId(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </div>
                      ) : (
                        <p className={`text-sm font-light ${m.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>{m.content}</p>
                      )}
                      {/* Proof row: source, reason, category, date */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-light text-foreground/70 rounded-full border border-border/30 px-2 py-0.5 uppercase tracking-wider">{m.kind ?? "general"}</span>
                        <span className="text-[10px] font-light text-muted-foreground/60 rounded-full border border-border/20 px-2 py-0.5">{m.category}</span>
                        {m.project_id && <span className="text-[10px] font-light text-muted-foreground/60 rounded-full border border-border/20 px-2 py-0.5">project-scoped</span>}

                        <span className="text-[10px] text-muted-foreground/40">{new Date(m.created_at).toLocaleDateString()}</span>
                        <span className="text-[9px] text-muted-foreground/30">•</span>
                        <span className="text-[10px] text-muted-foreground/40 italic">Source: {m.source || "manual"}</span>
                      </div>
                      {/* Reason / provenance */}
                      {m.reason && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <AlertTriangle className="h-3 w-3 text-muted-foreground/30" />
                          <span className="text-[10px] text-muted-foreground/40 font-light">{m.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => toggleEnabled(m.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      title={m.enabled ? "Disable this memory" : "Enable this memory"}
                    >
                      {m.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => { setEditId(m.id); setEditContent(m.content); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMemory(m.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
};

export default MemoryCenterView;
