import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, FileCode, FileText, Image, Database, Settings, Pencil } from "lucide-react";
import IdeDeleteConfirm from "./IdeDeleteConfirm";

export interface IdeFile {
  id: string;
  name: string;
  type: "file" | "folder";
  language?: string;
  content?: string;
  children?: IdeFile[];
  parentId?: string | null;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  tsx: FileCode, ts: FileCode, jsx: FileCode, js: FileCode,
  css: FileText, html: FileText, md: FileText, json: Settings,
  png: Image, jpg: Image, svg: Image,
  sql: Database,
};

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] || File;
}

function getLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    css: "css", html: "html", json: "json", md: "markdown",
    sql: "sql", py: "python", rs: "rust", go: "go",
  };
  return map[ext] || "plaintext";
}

interface Props {
  files: IdeFile[];
  activeFileId: string | null;
  onSelectFile: (file: IdeFile) => void;
  onCreateFile: (parentId: string | null, name: string, type: "file" | "folder") => void;
  onDeleteFile: (id: string) => void;
  onRenameFile?: (id: string, newName: string) => void;
}

function TreeNode({ node, depth, activeFileId, onSelectFile, onRequestDelete, onRenameFile }: {
  node: IdeFile; depth: number; activeFileId: string | null;
  onSelectFile: (f: IdeFile) => void; onRequestDelete: (f: IdeFile) => void;
  onRenameFile?: (id: string, newName: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const Icon = node.type === "folder" ? (expanded ? FolderOpen : Folder) : getFileIcon(node.name);
  const isActive = node.id === activeFileId;

  const commitRename = () => {
    if (renameName.trim() && renameName !== node.name) {
      onRenameFile?.(node.id, renameName.trim());
    }
    setRenaming(false);
  };

  return (
    <div>
      <button
        onClick={() => node.type === "folder" ? setExpanded(!expanded) : onSelectFile(node)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onRenameFile) {
            setRenameName(node.name);
            setRenaming(true);
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-light rounded-md transition-colors group ${
          isActive ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === "folder" && (
          expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-accent" : "text-muted-foreground/60"}`} />
        {renaming ? (
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-[11px] font-light outline-none border-b border-accent/30 min-w-0"
          />
        ) : (
          <span className="truncate flex-1 text-left">{node.name}</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onRenameFile && !renaming && (
            <Pencil
              onClick={(e) => { e.stopPropagation(); setRenameName(node.name); setRenaming(true); }}
              className="h-2.5 w-2.5 text-muted-foreground/50 hover:text-foreground"
            />
          )}
          <Trash2
            onClick={(e) => { e.stopPropagation(); onRequestDelete(node); }}
            className="h-3 w-3 hover:text-destructive"
          />
        </div>
      </button>
      {node.type === "folder" && expanded && node.children?.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} activeFileId={activeFileId} onSelectFile={onSelectFile} onRequestDelete={onRequestDelete} onRenameFile={onRenameFile} />
      ))}
    </div>
  );
}

const IdeFileTree = ({ files, activeFileId, onSelectFile, onCreateFile, onDeleteFile, onRenameFile }: Props) => {
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<IdeFile | null>(null);

  const handleCreate = () => {
    if (!newName.trim() || !creating) return;
    onCreateFile(null, newName.trim(), creating);
    setNewName("");
    setCreating(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <span className="text-[10px] font-light tracking-widest text-muted-foreground/60 uppercase">Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCreating("file")} className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors" title="New file">
            <Plus className="h-3 w-3" />
          </button>
          <button onClick={() => setCreating("folder")} className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors" title="New folder">
            <Folder className="h-3 w-3" />
          </button>
        </div>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-border/10">
          <div className="flex items-center gap-1.5">
            {creating === "folder" ? <Folder className="h-3 w-3 text-muted-foreground/50" /> : <File className="h-3 w-3 text-muted-foreground/50" />}
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(null); }}
              onBlur={handleCreate}
              placeholder={creating === "folder" ? "folder name" : "filename.tsx"}
              className="flex-1 bg-transparent text-[11px] font-light text-foreground outline-none placeholder:text-muted-foreground/30 min-w-0"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <p className="px-3 py-4 text-[10px] text-muted-foreground/40 text-center">No files yet. Create one above.</p>
        ) : (
          files.map(f => (
            <TreeNode
              key={f.id}
              node={f}
              depth={0}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
              onRequestDelete={(node) => setDeleteTarget(node)}
              onRenameFile={onRenameFile}
            />
          ))
        )}
      </div>

      <IdeDeleteConfirm
        open={!!deleteTarget}
        fileName={deleteTarget?.name ?? ""}
        onConfirm={() => { if (deleteTarget) onDeleteFile(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export { getLanguage };
export default IdeFileTree;
