import { useState, useEffect } from "react";
import { Brain, Trash2, Edit3, Download, Plus, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  created_at: string;
}

const MemoryCenterView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMode, setAddingMode] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("memory_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setMemories(data ?? []); setLoading(false); });
  }, [user]);

  const addMemory = async () => {
    if (!user || !newContent.trim()) return;
    const { data } = await supabase.from("memory_entries")
      .insert({ user_id: user.id, content: newContent.trim(), category: newCategory })
      .select().single();
    if (data) { setMemories((prev) => [data, ...prev]); setNewContent(""); setNewCategory("general"); setAddingMode(false); }
  };

  const deleteMemory = async (id: string) => {
    await supabase.from("memory_entries").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const saveEdit = async (id: string) => {
    await supabase.from("memory_entries").update({ content: editContent }).eq("id", id);
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, content: editContent } : m));
    setEditId(null);
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
    const a = document.createElement("a"); a.href = url; a.download = "zialiel-memories.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extralight tracking-wide text-foreground">Memory Control Center</h2>
          <p className="text-sm font-extralight text-muted-foreground mt-1">Full control over what Aureon remembers about you.</p>
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

      {addingMode ? (
        <div className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-3">
          <input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="What should Aureon remember?" className="w-full bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none" />
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
        </div>
      ) : (
        <button onClick={() => setAddingMode(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/30 bg-card/10 p-3 text-sm font-light text-muted-foreground hover:text-foreground hover:border-border/50 transition-all">
          <Plus className="h-4 w-4" /> Add Memory Manually
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : memories.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No memories stored yet.</p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div key={m.id} className="group rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 flex items-start justify-between">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Brain className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  {editId === m.id ? (
                    <div className="flex items-center gap-2">
                      <input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-border/30" />
                      <button onClick={() => saveEdit(m.id)}><Check className="h-3.5 w-3.5 text-foreground" /></button>
                      <button onClick={() => setEditId(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <p className="text-sm font-light text-foreground">{m.content}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-light text-muted-foreground/60 rounded-full border border-border/20 px-2 py-0.5">{m.category}</span>
                    <span className="text-[10px] text-muted-foreground/40">{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => { setEditId(m.id); setEditContent(m.content); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => deleteMemory(m.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoryCenterView;
