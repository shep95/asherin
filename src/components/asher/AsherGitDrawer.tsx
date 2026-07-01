import { useMemo } from "react";
import { X } from "lucide-react";
import IdeGitPanel from "@/components/dashboard/ide/IdeGitPanel";
import type { IdeFile } from "@/components/dashboard/ide/IdeFileTree";
import type { AsherCodeFile } from "@/lib/asherCode/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  branchId: string | null;
  files: AsherCodeFile[];
  dirty: Record<string, string>;
  onImported: (created: AsherCodeFile[]) => void;
}

// Convert flat Asher files → nested IdeFile[] (path-based tree)
function toIdeTree(files: { path: string; content: string }[]): IdeFile[] {
  const root: IdeFile[] = [];
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      let node = cur.find(n => n.name === name && n.type === (isFile ? "file" : "folder"));
      if (!node) {
        node = isFile
          ? { id: `af-${f.path}`, name, type: "file", content: f.content }
          : { id: `ad-${parts.slice(0, i + 1).join("/")}`, name, type: "folder", children: [] };
        cur.push(node);
      }
      if (!isFile) cur = node.children!;
    }
  }
  return root;
}

// Flatten IdeFile[] back into { path, content }
function flattenIde(nodes: IdeFile[], prefix = ""): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  for (const n of nodes) {
    const p = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.type === "file" && n.content !== undefined) out.push({ path: p, content: n.content });
    if (n.children) out.push(...flattenIde(n.children, p));
  }
  return out;
}

const AsherGitDrawer = ({ open, onClose, projectId, branchId, files, dirty, onImported }: Props) => {
  const ideFiles = useMemo(
    () => toIdeTree(files.map(f => ({ path: f.path, content: dirty[f.id] ?? f.content }))),
    [files, dirty]
  );

  const handleImport = async (imported: IdeFile[]) => {
    const flat = flattenIde(imported);
    if (!flat.length) return;
    if (!confirm(`Clone ${flat.length} file(s) from GitHub into this project? Files with the same path will be overwritten.`)) return;

    const created: AsherCodeFile[] = [];
    const existing = new Map(files.map(f => [f.path, f]));

    for (const entry of flat) {
      const ext = entry.path.split(".").pop() || "";
      const lang = ({ js: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", py: "python", html: "html", css: "css", json: "json", md: "markdown" } as Record<string, string>)[ext] || "plaintext";
      const prev = existing.get(entry.path);
      if (prev) {
        const { data, error } = await supabase.from("asher_code_files")
          .update({ content: entry.content, language: lang })
          .eq("id", prev.id).select().single();
        if (!error && data) created.push(data as AsherCodeFile);
      } else {
        const { data, error } = await supabase.from("asher_code_files")
          .insert({ project_id: projectId, branch_id: branchId, path: entry.path, content: entry.content, language: lang })
          .select().single();
        if (!error && data) created.push(data as AsherCodeFile);
      }
    }
    onImported(created);
    toast.success(`Imported ${created.length} file(s) from GitHub`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-card border-l border-border/30 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
          <span className="text-[11px] font-light tracking-[0.25em] uppercase text-muted-foreground">GitHub</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-hidden">
          <IdeGitPanel files={ideFiles} onImportFiles={handleImport} />
        </div>
      </div>
    </div>
  );
};

export default AsherGitDrawer;
