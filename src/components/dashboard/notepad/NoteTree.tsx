import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Plus, FolderTree, FileText, Pencil, Check, X } from "lucide-react";
import type { NotepadData, NoteBranch, NoteItem } from "./types";
import { genId } from "./types";

interface NoteTreeProps {
  data: NotepadData;
  onChange: (data: NotepadData) => void;
}

const NoteTree = ({ data, onChange }: NoteTreeProps) => {
  const [newNote, setNewNote] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const addNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    const note: NoteItem = { id: genId(), content: trimmed, createdAt: Date.now() };
    onChange({ ...data, unsorted: [...data.unsorted, note] });
    setNewNote("");
  };

  const addBranch = () => {
    const trimmed = newBranch.trim();
    if (!trimmed) return;
    const branch: NoteBranch = { id: genId(), name: trimmed, notes: [], collapsed: false };
    onChange({ ...data, branches: [...data.branches, branch] });
    setNewBranch("");
    setShowAddBranch(false);
  };

  const toggleBranch = (branchId: string) => {
    onChange({
      ...data,
      branches: data.branches.map(b =>
        b.id === branchId ? { ...b, collapsed: !b.collapsed } : b
      ),
    });
  };

  const deleteNote = (noteId: string, branchId?: string) => {
    if (branchId) {
      onChange({
        ...data,
        branches: data.branches.map(b =>
          b.id === branchId ? { ...b, notes: b.notes.filter(n => n.id !== noteId) } : b
        ),
      });
    } else {
      onChange({ ...data, unsorted: data.unsorted.filter(n => n.id !== noteId) });
    }
  };

  const deleteBranch = (branchId: string) => {
    const branch = data.branches.find(b => b.id === branchId);
    if (!branch) return;
    // Move notes back to unsorted
    onChange({
      ...data,
      unsorted: [...data.unsorted, ...branch.notes],
      branches: data.branches.filter(b => b.id !== branchId),
    });
  };

  const startEdit = (note: NoteItem) => {
    setEditingNote(note.id);
    setEditText(note.content);
  };

  const saveEdit = (noteId: string, branchId?: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    if (branchId) {
      onChange({
        ...data,
        branches: data.branches.map(b =>
          b.id === branchId
            ? { ...b, notes: b.notes.map(n => n.id === noteId ? { ...n, content: trimmed } : n) }
            : b
        ),
      });
    } else {
      onChange({
        ...data,
        unsorted: data.unsorted.map(n => n.id === noteId ? { ...n, content: trimmed } : n),
      });
    }
    setEditingNote(null);
  };

  const renderNote = (note: NoteItem, branchId?: string) => (
    <div key={note.id} className="group flex items-start gap-1.5 py-1 px-1 rounded-md hover:bg-muted/20 transition-colors">
      <FileText className="h-3 w-3 text-amber-500/50 mt-0.5 shrink-0" />
      {editingNote === note.id ? (
        <div className="flex-1 flex items-start gap-1">
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="flex-1 bg-muted/20 rounded px-1.5 py-0.5 text-[11px] text-foreground outline-none resize-none font-light"
            rows={2}
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit(note.id, branchId);
              if (e.key === "Escape") setEditingNote(null);
            }}
          />
          <button onClick={() => saveEdit(note.id, branchId)} className="p-0.5 text-emerald-500/70 hover:text-emerald-500"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditingNote(null)} className="p-0.5 text-muted-foreground/50 hover:text-foreground"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-[11px] font-light text-foreground/80 whitespace-pre-wrap break-words leading-relaxed cursor-pointer" onClick={() => startEdit(note)}>
            {note.content}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => startEdit(note)} className="p-0.5 text-muted-foreground/40 hover:text-foreground"><Pencil className="h-2.5 w-2.5" /></button>
            <button onClick={() => deleteNote(note.id, branchId)} className="p-0.5 text-destructive/40 hover:text-destructive"><Trash2 className="h-2.5 w-2.5" /></button>
          </div>
        </>
      )}
    </div>
  );

  const totalNotes = data.unsorted.length + data.branches.reduce((s, b) => s + b.notes.length, 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Note input */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 border-b border-border/10">
        <input
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addNote(); }}
          placeholder="Add a note…"
          className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
        />
        <button onClick={addNote} className="p-1 rounded text-amber-500/60 hover:text-amber-500 transition-colors" title="Add note">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {/* Branches */}
        {data.branches.map(branch => (
          <div key={branch.id} className="rounded-lg">
            <div className="flex items-center gap-1 py-1 px-1 rounded-md hover:bg-muted/10 cursor-pointer group">
              <button onClick={() => toggleBranch(branch.id)} className="p-0.5">
                {branch.collapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
              </button>
              <FolderTree className="h-3 w-3 text-amber-500/60" />
              <span className="text-[11px] font-medium text-foreground/70 flex-1">{branch.name}</span>
              <span className="text-[9px] text-muted-foreground/30">{branch.notes.length}</span>
              <button onClick={() => deleteBranch(branch.id)} className="p-0.5 opacity-0 group-hover:opacity-100 text-destructive/40 hover:text-destructive transition-all" title="Delete branch (notes move to unsorted)">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
            {!branch.collapsed && (
              <div className="ml-5 border-l border-border/10 pl-1.5">
                {branch.notes.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/25 italic pl-1">Empty branch</span>
                )}
                {branch.notes.map(n => renderNote(n, branch.id))}
              </div>
            )}
          </div>
        ))}

        {/* Unsorted */}
        {data.unsorted.length > 0 && (
          <div className="rounded-lg">
            <div className="flex items-center gap-1.5 py-1 px-1">
              <FileText className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider">Unsorted</span>
              <span className="text-[9px] text-muted-foreground/30">{data.unsorted.length}</span>
            </div>
            <div className="ml-1">
              {data.unsorted.map(n => renderNote(n))}
            </div>
          </div>
        )}

        {totalNotes === 0 && data.branches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/25">
            <FolderTree className="h-6 w-6 mb-2" />
            <span className="text-[11px] font-light">Add notes above</span>
          </div>
        )}
      </div>

      {/* Add branch */}
      <div className="px-3 py-1.5 border-t border-border/10">
        {showAddBranch ? (
          <div className="flex items-center gap-1.5">
            <input
              value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addBranch(); if (e.key === "Escape") setShowAddBranch(false); }}
              placeholder="Branch name…"
              className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
              autoFocus
            />
            <button onClick={addBranch} className="p-0.5 text-emerald-500/70 hover:text-emerald-500"><Check className="h-3 w-3" /></button>
            <button onClick={() => setShowAddBranch(false)} className="p-0.5 text-muted-foreground/50 hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button onClick={() => setShowAddBranch(true)} className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Plus className="h-3 w-3" /> New branch
          </button>
        )}
      </div>
    </div>
  );
};

export default NoteTree;
