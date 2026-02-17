import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Play, Clock, GitBranch, Share2, Copy, Trash2, Eye, Edit3, MoreHorizontal, Code, BarChart3, Type, Database, Calendar, Tag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notebook {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  team_id: string | null;
  status: string;
  version: number;
  schedule: string | null;
  last_run_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface NotebookCell {
  id: string;
  notebook_id: string;
  cell_type: string;
  content: string;
  output: string | null;
  position: number;
  config: Record<string, unknown>;
}

const cellTypeIcons: Record<string, React.ElementType> = { text: Type, query: Database, visualization: BarChart3, code: Code, data_source: Database };
const statusColors: Record<string, string> = { draft: "text-amber-400 bg-amber-500/10", published: "text-emerald-400 bg-emerald-500/10", archived: "text-muted-foreground bg-muted/20" };

const NotebooksView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const loadNotebooks = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from as any)("notebooks").select("*").order("updated_at", { ascending: false });
    setNotebooks((data ?? []) as Notebook[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotebooks(); }, [loadNotebooks]);

  const loadCells = useCallback(async (notebookId: string) => {
    const { data } = await (supabase.from as any)("notebook_cells").select("*").eq("notebook_id", notebookId).order("position", { ascending: true });
    setCells((data ?? []) as NotebookCell[]);
  }, []);

  useEffect(() => { if (selectedId) loadCells(selectedId); }, [selectedId, loadCells]);

  const createNotebook = async () => {
    if (!user) return;
    const { data, error } = await (supabase.from as any)("notebooks").insert({ title: newTitle.trim() || "Untitled Notebook", description: newDesc.trim(), owner_id: user.id }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // Add default text cell
    if (data) {
      await (supabase.from as any)("notebook_cells").insert({ notebook_id: data.id, cell_type: "text", content: "# Analysis Notes\n\nStart documenting your findings here.", position: 0 });
      await (supabase.from as any)("notebook_versions").insert({ notebook_id: data.id, version: 1, changed_by: user.id, change_summary: "Initial creation" });
    }
    toast({ title: "Notebook created" });
    setNewTitle(""); setNewDesc(""); setShowCreate(false);
    loadNotebooks();
    if (data) { setSelectedId(data.id); }
  };

  const cloneNotebook = async (nb: Notebook) => {
    if (!user) return;
    const { data: clone } = await (supabase.from as any)("notebooks").insert({ title: `${nb.title} (Clone)`, description: nb.description, owner_id: user.id, tags: nb.tags }).select().single();
    if (clone) {
      const { data: srcCells } = await (supabase.from as any)("notebook_cells").select("*").eq("notebook_id", nb.id).order("position");
      if (srcCells) {
        for (const cell of srcCells) {
          await (supabase.from as any)("notebook_cells").insert({ notebook_id: clone.id, cell_type: cell.cell_type, content: cell.content, output: cell.output, position: cell.position, config: cell.config as Record<string, unknown> });
        }
      }
      toast({ title: "Notebook cloned" });
      loadNotebooks();
    }
  };

  const deleteNotebook = async (id: string) => {
    await (supabase.from as any)("notebooks").delete().eq("id", id);
    if (selectedId === id) { setSelectedId(null); setCells([]); }
    toast({ title: "Notebook deleted" });
    loadNotebooks();
  };

  const addCell = async (type: string) => {
    if (!selectedId || !user) return;
    const pos = cells.length;
    const defaultContent = type === "text" ? "Add notes here…" : type === "query" ? "-- Write your SQL query\nSELECT * FROM data LIMIT 10;" : type === "code" ? "# Python analysis\nimport pandas as pd\n\n# Your code here" : "";
    await (supabase.from as any)("notebook_cells").insert({ notebook_id: selectedId, cell_type: type, content: defaultContent, position: pos });
    // Version bump
    const nb = notebooks.find(n => n.id === selectedId);
    if (nb) {
      const newVer = nb.version + 1;
      await (supabase.from as any)("notebooks").update({ version: newVer }).eq("id", selectedId);
      await (supabase.from as any)("notebook_versions").insert({ notebook_id: selectedId, version: newVer, changed_by: user.id, change_summary: `Added ${type} cell` });
    }
    loadCells(selectedId);
    loadNotebooks();
  };

  const updateCellContent = async (cellId: string, content: string) => {
    await (supabase.from as any)("notebook_cells").update({ content }).eq("id", cellId);
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, content } : c));
  };

  const deleteCell = async (cellId: string) => {
    await (supabase.from as any)("notebook_cells").delete().eq("id", cellId);
    if (selectedId) loadCells(selectedId);
  };

  const selectedNb = notebooks.find(n => n.id === selectedId);

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="text-sm font-extralight tracking-widest text-muted-foreground animate-pulse">Loading notebooks…</div></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-border/20">
        <div>
          <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">INTELLIGENCE NOTEBOOKS</h1>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Shared analysis sessions with versioning and scheduling</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-xs font-light transition-colors">
          <Plus className="h-4 w-4" /> New Notebook
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Notebook list */}
        <div className="w-72 border-r border-border/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {notebooks.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-8">No notebooks yet.</p>}
              {notebooks.map(nb => (
                <div key={nb.id} className={`group relative rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${selectedId === nb.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`} onClick={() => setSelectedId(nb.id)}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-light truncate ${selectedId === nb.id ? "text-foreground" : "text-muted-foreground"}`}>{nb.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${statusColors[nb.status]}`}>{nb.status}</span>
                        <span className="text-[9px] text-muted-foreground/50">v{nb.version}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); cloneNotebook(nb); }} className="p-1 rounded hover:bg-foreground/10"><Copy className="h-3 w-3 text-muted-foreground" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }} className="p-1 rounded hover:bg-red-500/10"><Trash2 className="h-3 w-3 text-red-400" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Notebook editor */}
        <ScrollArea className="flex-1">
          {selectedNb ? (
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extralight tracking-wide text-foreground">{selectedNb.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedNb.description || "No description"} • Version {selectedNb.version}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1.5 text-[10px] font-light transition-colors">
                    <Play className="h-3 w-3" /> Run All
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-3 py-1.5 text-[10px] font-light transition-colors">
                    <Share2 className="h-3 w-3" /> Share
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl bg-card/30 hover:bg-card/50 text-muted-foreground px-3 py-1.5 text-[10px] font-light transition-colors">
                    <Calendar className="h-3 w-3" /> Schedule
                  </button>
                </div>
              </div>

              {/* Tags */}
              {selectedNb.tags.length > 0 && (
                <div className="flex gap-1.5">
                  {selectedNb.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent"><Tag className="h-2.5 w-2.5 inline mr-1" />{tag}</span>
                  ))}
                </div>
              )}

              {/* Cells */}
              <div className="space-y-3">
                {cells.map(cell => {
                  const CellIcon = cellTypeIcons[cell.cell_type] ?? FileText;
                  return (
                    <div key={cell.id} className="rounded-xl border border-border/10 bg-card/20 overflow-hidden group">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border/10 bg-card/10">
                        <div className="flex items-center gap-2">
                          <CellIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-light text-muted-foreground capitalize">{cell.cell_type}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingCell(editingCell === cell.id ? null : cell.id)} className="p-1 rounded hover:bg-foreground/10"><Edit3 className="h-3 w-3 text-muted-foreground" /></button>
                          {cell.cell_type === "query" && <button className="p-1 rounded hover:bg-emerald-500/10"><Play className="h-3 w-3 text-emerald-400" /></button>}
                          <button onClick={() => deleteCell(cell.id)} className="p-1 rounded hover:bg-red-500/10"><Trash2 className="h-3 w-3 text-red-400" /></button>
                        </div>
                      </div>
                      <div className="p-4">
                        {editingCell === cell.id ? (
                          <textarea
                            value={cell.content}
                            onChange={e => updateCellContent(cell.id, e.target.value)}
                            className="w-full min-h-[100px] bg-transparent text-xs font-light text-foreground outline-none resize-none font-mono"
                            onBlur={() => setEditingCell(null)}
                            autoFocus
                          />
                        ) : (
                          <pre className="text-xs font-light text-foreground/80 whitespace-pre-wrap font-mono">{cell.content}</pre>
                        )}
                        {cell.output && (
                          <div className="mt-3 pt-3 border-t border-border/10">
                            <p className="text-[10px] text-muted-foreground/50 mb-1">Output</p>
                            <pre className="text-xs text-emerald-400/80 font-mono whitespace-pre-wrap">{cell.output}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add cell buttons */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] text-muted-foreground/50">Add cell:</span>
                {["text", "query", "code", "visualization", "data_source"].map(type => {
                  const Icon = cellTypeIcons[type] ?? FileText;
                  return (
                    <button key={type} onClick={() => addCell(type)} className="flex items-center gap-1 rounded-lg bg-card/20 hover:bg-card/40 px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors capitalize">
                      <Icon className="h-3 w-3" /> {type.replace("_", " ")}
                    </button>
                  );
                })}
              </div>

              {/* Version history */}
              <div className="rounded-xl border border-border/10 bg-card/10 p-4 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">Version History</p>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: Math.min(selectedNb.version, 5) }, (_, i) => selectedNb.version - i).map(v => (
                    <div key={v} className="flex items-center gap-3 text-[10px]">
                      <span className="text-muted-foreground/50 w-8">v{v}</span>
                      <div className="h-2 w-2 rounded-full bg-accent/40" />
                      <span className="text-muted-foreground">{v === selectedNb.version ? "Current version" : `Version ${v}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center h-full">
              <div className="text-center space-y-3">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-extralight text-muted-foreground">Select or create a notebook</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border/20 bg-card/90 backdrop-blur-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-extralight tracking-wide text-foreground">New Notebook</h3>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Notebook title" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={createNotebook} className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-xs font-light transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebooksView;
