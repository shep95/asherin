import { useState } from "react";
import { Plus, ChevronDown, Trash2, Pencil, Check, X, Atom } from "lucide-react";
import type { ZaliProject } from "./types";

interface Props {
  projects: ZaliProject[];
  activeProject: ZaliProject | null;
  onSelect: (project: ZaliProject) => void;
  onCreate: (name: string, designType: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const DESIGN_TYPES = [
  { value: "product", label: "Physical Product" },
  { value: "material", label: "Material / Chemical" },
  { value: "biological", label: "Biological / Medical" },
  { value: "software", label: "Software System" },
  { value: "architecture", label: "Architecture / Building" },
  { value: "electrical", label: "Electrical / Electronic" },
  { value: "mechanical", label: "Mechanical System" },
  { value: "general", label: "General Design" },
];

const ZaliProjectSelector = ({ projects, activeProject, onSelect, onCreate, onDelete, onRename }: Props) => {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("general");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newType);
    setNewName("");
    setNewType("general");
    setShowCreate(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 px-3 py-1.5 hover:bg-card/50 transition-colors"
      >
        <Atom className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-light text-foreground max-w-[120px] sm:max-w-[160px] truncate">
          {activeProject ? activeProject.name : "No Project"}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); setRenamingId(null); }} />
          <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1 z-50 w-72 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-1.5">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors group ${
                    activeProject?.id === p.id ? "bg-foreground/10" : "hover:bg-foreground/5"
                  }`}
                >
                  {renamingId === p.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renameValue.trim()) { onRename(p.id, renameValue.trim()); setRenamingId(null); }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 bg-background/50 border border-border/20 rounded px-2 py-1 text-xs text-foreground outline-none focus:border-accent/30"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={() => { if (renameValue.trim()) onRename(p.id, renameValue.trim()); setRenamingId(null); }} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { onSelect(p); setOpen(false); }} className="flex-1 text-left min-w-0">
                        <p className="text-xs font-light text-foreground truncate">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground/50">{p.designType} · {p.phase}</p>
                      </button>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenameValue(p.name); }} className="p-1 rounded text-muted-foreground/40 hover:text-foreground">
                          <Pencil className="h-3 w-3" />
                        </button>
                        {activeProject?.id !== p.id && (
                          <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} className="p-1 rounded text-muted-foreground/40 hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {projects.length === 0 && !showCreate && (
                <p className="text-[10px] text-muted-foreground/40 text-center py-4">No projects yet</p>
              )}
            </div>

            <div className="border-t border-border/20 p-2">
              {showCreate ? (
                <div className="space-y-2 p-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                      if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                    }}
                    placeholder="Project name…"
                    className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30"
                    autoFocus
                  />
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-accent/30 appearance-none"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {DESIGN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 rounded-lg bg-accent/20 py-1.5 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); setNewName(""); }}
                      className="rounded-lg border border-border/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-light text-accent hover:bg-accent/10 transition-colors"
                >
                  <Plus className="h-3 w-3" /> New Project
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ZaliProjectSelector;