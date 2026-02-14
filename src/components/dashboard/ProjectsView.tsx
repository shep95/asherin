import { useState, useEffect } from "react";
import { FolderPlus, Layers, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const ProjectsView = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setProjects(data ?? []); setLoading(false); });
  }, [user]);

  const createProject = async () => {
    if (!user || !name.trim()) return;
    const { data } = await supabase.from("projects")
      .insert({ user_id: user.id, name: name.trim(), description: desc.trim() })
      .select().single();
    if (data) { setProjects((prev) => [data, ...prev]); setName(""); setDesc(""); setCreating(false); }
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (projects.length === 0 && !creating) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-md space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm flex items-center justify-center">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-extralight tracking-wide text-foreground mb-2">Projects</h2>
            <p className="text-sm font-extralight text-muted-foreground">Organize your work into dedicated workspaces.</p>
          </div>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-2.5 text-sm font-light text-foreground hover:bg-foreground/5 transition-colors">
            <FolderPlus className="h-4 w-4" /> Create First Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extralight tracking-wide text-foreground">Projects</h2>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
          <FolderPlus className="h-4 w-4" /> New Project
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="w-full bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-transparent text-xs font-extralight text-muted-foreground placeholder:text-muted-foreground/50 outline-none" />
          <div className="flex gap-2">
            <button onClick={createProject} className="text-xs bg-foreground text-background px-3 py-1 rounded-lg">Create</button>
            <button onClick={() => setCreating(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="group rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-light text-foreground">{p.name}</p>
              {p.description && <p className="text-xs font-extralight text-muted-foreground mt-0.5">{p.description}</p>}
              <p className="text-[10px] text-muted-foreground/40 mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => deleteProject(p.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectsView;
