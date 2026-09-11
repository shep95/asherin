// files and editing for one artifact.
//
// Plain text editing over real stored files. Unsaved work is held in local
// state and is visibly marked, so nothing a person typed disappears quietly.

import { useEffect, useMemo, useState } from "react";
import { FilePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { deleteFile, listFiles, mimeForPath, saveFile } from "@/lib/software/files";
import type { ArtifactFile } from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

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

const ArtifactCodePane = ({
  artifactId,
  files,
  onFilesChanged,
  readOnly,
}: {
  artifactId: string;
  files: ArtifactFile[];
  onFilesChanged: (files: ArtifactFile[]) => void;
  readOnly: boolean;
}) => {
  const { user } = useAuth();
  const [activePath, setActivePath] = useState<string | null>(files[0]?.path ?? null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activePath && files.length) setActivePath(files[0].path);
  }, [files, activePath]);

  const active = useMemo(() => files.find((f) => f.path === activePath) ?? null, [files, activePath]);
  const dirty = draft !== null && active !== null && draft !== active.content;

  const reload = async () => onFilesChanged(await listFiles(artifactId));

  const write = async (path: string, content: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await saveFile({ artifactId, userId: user.id, path, content });
      await reload();
      setDraft(null);
      setActivePath(path);
      toast.success(`saved ${path}`);
    } catch (e) {
      toast.error("could not save", { description: e instanceof Error ? e.message : "unknown failure" });
    } finally {
      setBusy(false);
    }
  };

  const addFile = async () => {
    const name = window.prompt("file name (for example index.html)")?.trim();
    if (!name) return;
    await write(name, STARTER[name] ?? "");
  };

  const addStarter = async () => {
    for (const [path, content] of Object.entries(STARTER)) {
      // eslint-disable-next-line no-await-in-loop -- order matters: html before script
      await write(path, content);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <section className={`${card} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm tracking-wide text-foreground">files</h2>
          {!readOnly && (
            <button onClick={addFile} disabled={busy} className="text-muted-foreground hover:text-foreground" aria-label="add a file">
              <FilePlus className="h-4 w-4" />
            </button>
          )}
        </div>
        {files.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">no files yet.</p>
            {!readOnly && (
              <button
                onClick={addStarter}
                disabled={busy}
                className="rounded-lg border border-border/30 px-3 py-1.5 text-[11px] hover:bg-card/40"
              >
                start with a page and a script
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.id} className="group flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setActivePath(f.path);
                    setDraft(null);
                  }}
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-xs ${
                    f.path === activePath ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.path}
                </button>
                {!readOnly && (
                  <button
                    aria-label={`delete ${f.path}`}
                    onClick={async () => {
                      if (!window.confirm(`delete ${f.path}? this cannot be undone.`)) return;
                      setBusy(true);
                      try {
                        await deleteFile(f.id);
                        await reload();
                        if (activePath === f.path) setActivePath(null);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} p-4`}>
        {!active ? (
          <p className="text-xs text-muted-foreground">select a file to edit it.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs text-foreground/80">{active.path}</span>
              <span className="text-[11px] text-muted-foreground">{mimeForPath(active.path)}</span>
              {dirty && <span className="text-[11px] text-amber-400/90">unsaved</span>}
              <div className="flex-1" />
              {!readOnly && (
                <button
                  disabled={!dirty || busy}
                  onClick={() => write(active.path, draft ?? active.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} save
                </button>
              )}
            </div>
            <textarea
              value={draft ?? active.content}
              readOnly={readOnly}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label={`contents of ${active.path}`}
              className="h-[420px] w-full resize-none rounded-lg border border-border/20 bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary/40"
            />
          </>
        )}
      </section>
    </div>
  );
};

export default ArtifactCodePane;
