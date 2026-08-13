import { useState, useEffect, useCallback } from "react";
import { FolderPlus, Layers, Trash2, Loader2, Globe, Lock, Target, FileText, Brain, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  listProjects, setProjectMode, loadScopeCounts, getActiveScope, setActiveScope, onScopeChange,
  type Project, type ProjectMode, type ProjectScope, type ScopeCounts,
} from "@/lib/projects/scope";
import { useIsV2 } from "@/lib/dashboardUiContext";
import { V2Action, v2ActionClass } from "@/components/dashboard/v2/V2PageShell";


const MODE_COPY: Record<ProjectMode, { label: string; detail: string; icon: typeof Lock }> = {
  isolated: {
    label: "Isolated sources",
    detail: "Answers may only use this project's files and notes. Anything outside the corpus is returned as unsure.",
    icon: Lock,
  },
  web: {
    label: "Web + corpus",
    detail: "Project files stay primary, but the model may also reach live sources and must label which is which.",
    icon: Globe,
  },
};

const ProjectsView = () => {
  const v2 = useIsV2();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, ScopeCounts>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [scope, setScope] = useState<ProjectScope | null>(() => getActiveScope());

  useEffect(() => onScopeChange(setScope), []);

  const refreshCounts = useCallback(async (rows: Project[]) => {
    if (!user) return;
    const entries = await Promise.all(
      rows.map(async (p) => [p.id, await loadScopeCounts(user.id, p.id)] as const),
    );
    setCounts(Object.fromEntries(entries));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listProjects(user.id).then((rows) => {
      if (!alive) return;
      setProjects(rows);
      setLoading(false);
      void refreshCounts(rows);
    });
    return () => { alive = false; };
  }, [user, refreshCounts]);

  const createProject = async () => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase.from("projects")
      .insert({ user_id: user.id, name: name.trim(), description: desc.trim(), mode: "isolated" } as never)
      .select("id,name,description,mode,created_at").single();
    if (error) { toast.error("Could not create project: " + error.message); return; }
    const created = data as unknown as Project;
    setProjects((prev) => [created, ...prev]);
    setCounts((prev) => ({ ...prev, [created.id]: { files: 0, filesReadable: 0, memories: 0 } }));
    setName(""); setDesc(""); setCreating(false);
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error("Could not delete project: " + error.message); return; }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (scope?.projectId === id) setActiveScope(null);
  };

  const toggleMode = async (p: Project) => {
    const next: ProjectMode = p.mode === "isolated" ? "web" : "isolated";
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, mode: next } : x)));
    try {
      await setProjectMode(p.id, next);
    } catch {
      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, mode: p.mode } : x)));
      toast.error("Could not change the answer mode.");
    }
  };

  const activate = (p: Project) => {
    if (scope?.projectId === p.id) { setActiveScope(null); return; }
    setActiveScope({ projectId: p.id, name: p.name, mode: p.mode });
    toast.success(`Chat, Library and Memory are now scoped to ${p.name}.`);
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
            <p className="text-sm font-extralight text-muted-foreground">
              A project scopes chat, library files and memory to one body of work — and can refuse to answer outside it.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-2.5 text-sm font-light text-foreground hover:bg-foreground/5 transition-colors">
            <FolderPlus className="h-4 w-4" /> Create First Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {v2 ? (
          <V2Action>
            <button onClick={() => setCreating(true)} className={v2ActionClass}>
              <FolderPlus className="h-3.5 w-3.5" /> new project
            </button>
          </V2Action>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extralight tracking-wide text-foreground">Projects</h2>
              <p className="text-sm font-extralight text-muted-foreground mt-1">
                One active scope at a time. Nothing from another project is ever read.
              </p>
            </div>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/5 transition-colors">
              <FolderPlus className="h-4 w-4" /> New Project
            </button>
          </div>
        )}

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
          {projects.map((p) => {
            const active = scope?.projectId === p.id;
            const c = counts[p.id];
            const mode = MODE_COPY[p.mode];
            const ModeIcon = mode.icon;
            return (
              <div key={p.id} className={`group rounded-xl border bg-card/20 backdrop-blur-sm p-4 space-y-3 transition-colors ${active ? "border-accent/40" : "border-border/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-light text-foreground flex items-center gap-2">
                      {p.name}
                      {active && <span className="text-[9px] uppercase tracking-widest text-accent">active scope</span>}
                    </p>
                    {p.description && <p className="text-xs font-extralight text-muted-foreground mt-0.5">{p.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/50">
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c ? `${c.filesReadable}/${c.files} files readable` : "…"}</span>
                      <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> {c ? `${c.memories} scoped memories` : "…"}</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => activate(p)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-light transition-colors ${
                        active ? "border-accent/40 text-accent" : "border-border/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active ? <Check className="h-3 w-3" /> : <Target className="h-3 w-3" />}
                      {active ? "Scoped" : "Use scope"}
                    </button>
                    <button onClick={() => deleteProject(p.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => toggleMode(p)}
                  className="w-full text-left rounded-lg border border-border/20 bg-card/20 px-3 py-2 hover:bg-foreground/5 transition-colors"
                >
                  <span className="flex items-center gap-2 text-[11px] font-light text-foreground">
                    <ModeIcon className="h-3.5 w-3.5" /> {mode.label}
                    <span className="ml-auto text-[10px] text-muted-foreground/50">switch</span>
                  </span>
                  <span className="block text-[10px] font-extralight text-muted-foreground/70 mt-1">{mode.detail}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectsView;
