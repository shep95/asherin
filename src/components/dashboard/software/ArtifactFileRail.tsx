// The artifact's files: what exists, what is open, what was recycled.
//
// Folders are implied by paths, so moving a file is renaming it. A delete is
// reversible — recycled files stay listed until the person restores or leaves
// them.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, FilePlus, FileText, FolderPlus, RotateCcw, Search, Trash2 } from "lucide-react";
import { buildTree, searchFiles, type TreeNode } from "@/lib/software/workspace";
import type { ArtifactFile } from "@/lib/software/types";
import type { SoftwareWorkspace } from "@/hooks/useSoftwareWorkspace";

const STARTER: Record<string, string> = {
  "index.html": `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>artifact</title></head>
  <body>
    <div id="root"></div>
    <script src="main.js"></script>
  </body>
</html>`,
  "main.js": `document.getElementById("root").textContent = "hello";
console.log("ready");`,
};

const ArtifactFileRail = ({
  ws,
  canWrite,
  onError,
}: {
  ws: SoftwareWorkspace;
  canWrite: boolean;
  onError: (label: string, e: unknown) => void;
}) => {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showRecycled, setShowRecycled] = useState(false);

  const tree = useMemo(() => buildTree(ws.files.map((f) => f.path)), [ws.files]);
  const hits = useMemo(() => (query.trim() ? searchFiles(ws.workingFiles, query, 60) : []), [query, ws.workingFiles]);
  const byPath = useMemo(() => new Map(ws.files.map((f) => [f.path, f])), [ws.files]);

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      onError(label, e);
    }
  };

  const createAt = async (folder: string) => {
    const name = window.prompt(folder ? `new file inside ${folder}` : "new file (for example index.html)")?.trim();
    if (!name) return;
    const path = folder ? `${folder}/${name}` : name;
    await run("could not create that file", () => ws.create(path, STARTER[name] ?? ""));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.kind === "folder") {
      const isCollapsed = collapsed[node.path];
      return (
        <li key={`d:${node.path}`}>
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 10 }}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [node.path]: !isCollapsed }))}
              className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="truncate">{node.name}</span>
            </button>
            {canWrite && (
              <button
                onClick={() => createAt(node.path)}
                aria-label={`new file in ${node.path}`}
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <FilePlus className="h-3 w-3" />
              </button>
            )}
          </div>
          {!isCollapsed && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
        </li>
      );
    }

    const file = byPath.get(node.path);
    if (!file) return null;
    const dirty = ws.dirtyPaths.includes(file.path);
    const active = ws.activePath === file.path;
    return (
      <li key={file.id} className="group flex items-center gap-1" style={{ paddingLeft: depth * 10 + 4 }}>
        <button
          onClick={() => ws.open(file.path)}
          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] ${
            active ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate">{node.name}</span>
          {dirty && (
            <span className="shrink-0 text-amber-400/90" title="unsaved changes">
              •
            </span>
          )}
          {file.origin === "ai" && (
            <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/70">ai</span>
          )}
        </button>
        {canWrite && (
          <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              aria-label={`move or rename ${file.path}`}
              onClick={() => {
                const to = window.prompt("move or rename to", file.path)?.trim();
                if (!to || to === file.path) return;
                void run("could not move that file", () => ws.rename(file, to));
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              ↦
            </button>
            <button
              aria-label={`duplicate ${file.path}`}
              onClick={() => void run("could not duplicate that file", () => ws.duplicate(file))}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              aria-label={`delete ${file.path}`}
              onClick={() => {
                if (!window.confirm(`recycle ${file.path}? you can restore it from this list.`)) return;
                void run("could not delete that file", () => ws.remove(file));
              }}
              className="text-destructive/70 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search files"
          aria-label="search across files"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {canWrite && (
          <>
            <button onClick={() => createAt("")} aria-label="new file" className="text-muted-foreground hover:text-foreground">
              <FilePlus className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="new folder"
              title="a folder appears as soon as a file is created inside it"
              onClick={() => {
                const folder = window.prompt("new folder path (for example src/ui)")?.trim();
                if (!folder) return;
                void createAt(folder.replace(/\/+$/, ""));
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {query.trim() ? (
          hits.length === 0 ? (
            <p className="px-1 text-[11px] text-muted-foreground">nothing matches “{query}”.</p>
          ) : (
            <ul className="space-y-1">
              {hits.map((h, i) => (
                <li key={`${h.path}:${h.line}:${i}`}>
                  <button
                    onClick={() => ws.open(h.path)}
                    className="w-full truncate rounded px-1 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-foreground/80">{h.path}</span>
                    <span className="text-muted-foreground/60">:{h.line}</span> {h.text}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : ws.files.length === 0 ? (
          <div className="space-y-3 px-1 py-2">
            <p className="text-[11px] text-muted-foreground">no files yet.</p>
            {canWrite && (
              <button
                onClick={() =>
                  void run("could not create the starter files", async () => {
                    for (const [path, content] of Object.entries(STARTER)) {
                      // eslint-disable-next-line no-await-in-loop -- html before script
                      await ws.create(path, content);
                    }
                  })
                }
                className="rounded-lg border border-border/30 px-2.5 py-1.5 text-[11px] hover:bg-card/40"
              >
                start with a page and a script
              </button>
            )}
          </div>
        ) : (
          <ul>{tree.map((n) => renderNode(n, 0))}</ul>
        )}
      </div>

      {ws.recycled.length > 0 && (
        <div className="border-t border-border/15 px-3 py-2">
          <button
            onClick={() => setShowRecycled((v) => !v)}
            className="flex w-full items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            aria-expanded={showRecycled}
          >
            {showRecycled ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            recycled ({ws.recycled.length})
          </button>
          {showRecycled && (
            <ul className="mt-1 space-y-1">
              {ws.recycled.map((f: ArtifactFile) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/70">{f.path}</span>
                  {canWrite && (
                    <button
                      aria-label={`restore ${f.path}`}
                      onClick={() => void run("could not restore that file", () => ws.restore(f))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactFileRail;
