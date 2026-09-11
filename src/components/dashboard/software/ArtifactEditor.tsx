// Direct editing of artifact files.
//
// A manual edit is a first-class change: it is held as a draft, marked unsaved,
// mirrored so a reload cannot eat it, and written with the person as its
// author. Selection is offered to the model as context; nothing is sent unless
// they ask for it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { Replace, RotateCcw, Save, X } from "lucide-react";
import { mimeForPath } from "@/lib/software/files";
import { replaceInText } from "@/lib/software/workspace";
import type { SoftwareWorkspace } from "@/hooks/useSoftwareWorkspace";

const langFor = (path: string): string => {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (/\.tsx?$/.test(path)) return "typescript";
  if (/\.m?jsx?$/.test(path)) return "javascript";
  return "plaintext";
};

let themeRegistered = false;
function registerTheme(monaco: Monaco) {
  if (themeRegistered) return;
  themeRegistered = true;
  monaco.editor.defineTheme("asherin-artifact", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "d4d4d4" },
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "string", foreground: "a3a3a3" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#e5e5e5",
      "editorLineNumber.foreground": "#4b5563",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.selectionBackground": "#ffffff15",
      "editorCursor.foreground": "#ffffff",
      "scrollbarSlider.background": "#ffffff10",
      "minimap.background": "#00000000",
    },
  });
}

const ArtifactEditor = ({
  ws,
  canWrite,
  onError,
}: {
  ws: SoftwareWorkspace;
  canWrite: boolean;
  onError: (label: string, e: unknown) => void;
}) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");

  const activePath = ws.activePath;
  const active = useMemo(() => ws.files.find((f) => f.path === activePath) ?? null, [ws.files, activePath]);
  const dirty = !!activePath && ws.dirtyPaths.includes(activePath);
  const value = activePath ? ws.contentOf(activePath) : "";

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      registerTheme(monaco);
      monaco.editor.setTheme("asherin-artifact");
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const path = ws.activePath;
        if (path && canWrite) void ws.save(path).catch((e) => onError("could not save", e));
      });
      editor.onDidChangeCursorSelection(() => {
        const model = editor.getModel();
        const sel = editor.getSelection();
        const path = ws.activePath;
        if (!model || !sel || !path || sel.isEmpty()) {
          ws.setSelection(null);
          return;
        }
        ws.setSelection({ path, text: model.getValueInRange(sel).slice(0, 4000) });
      });
    },
    [canWrite, onError, ws],
  );

  // keyboard save outside the editor surface too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canWrite && ws.dirtyPaths.length > 0) void ws.saveAll().catch((err) => onError("could not save", err));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canWrite, onError, ws]);

  const applyReplace = () => {
    if (!activePath || !canWrite) return;
    const { text, count } = replaceInText(value, find, replaceWith);
    if (count === 0) {
      ws.note({ channel: "workspace", level: "warn", message: `“${find}” does not appear in ${activePath}` });
      return;
    }
    ws.edit(activePath, text);
    ws.note({ channel: "workspace", level: "info", message: `replaced ${count} occurrence(s) in ${activePath}` });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/15 px-2">
        {ws.openPaths.length === 0 ? (
          <span className="px-2 py-2 text-[11px] text-muted-foreground">open a file from the list to edit it.</span>
        ) : (
          ws.openPaths.map((p) => (
            <span
              key={p}
              className={`flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[11px] ${
                p === activePath ? "border-primary/60 text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <button onClick={() => ws.setActivePath(p)} className="max-w-[160px] truncate">
                {p.split("/").pop()}
                {ws.dirtyPaths.includes(p) && <span className="ml-1 text-amber-400/90">•</span>}
              </button>
              <button onClick={() => ws.close(p)} aria-label={`close ${p}`} className="hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {activePath && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/15 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="truncate text-foreground/80">{activePath}</span>
          <span>{mimeForPath(activePath)}</span>
          {active?.origin === "ai" && <span>last written by the model</span>}
          {dirty && <span className="text-amber-400/90">unsaved</span>}
          <div className="flex-1" />
          <button onClick={() => setReplaceOpen((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground">
            <Replace className="h-3 w-3" /> replace
          </button>
          {dirty && (
            <button
              onClick={() => ws.revert(activePath)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> discard
            </button>
          )}
          {canWrite && (
            <button
              disabled={!dirty}
              onClick={() => void ws.save(activePath).catch((e) => onError("could not save", e))}
              className="inline-flex items-center gap-1 rounded border border-border/30 px-2 py-1 disabled:opacity-40 hover:bg-card/40"
            >
              <Save className="h-3 w-3" /> save
            </button>
          )}
        </div>
      )}

      {replaceOpen && activePath && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/15 px-3 py-2">
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="find in this file"
            aria-label="find in this file"
            className="min-w-0 flex-1 rounded border border-border/25 bg-background/40 px-2 py-1 text-[11px] outline-none"
          />
          <input
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="replace with"
            aria-label="replace with"
            className="min-w-0 flex-1 rounded border border-border/25 bg-background/40 px-2 py-1 text-[11px] outline-none"
          />
          <button
            onClick={applyReplace}
            disabled={!canWrite || !find}
            className="rounded border border-border/30 px-2 py-1 text-[11px] disabled:opacity-40 hover:bg-card/40"
          >
            replace all
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {!activePath ? (
          <p className="p-4 text-[11px] text-muted-foreground">nothing open.</p>
        ) : (
          <Editor
            height="100%"
            path={activePath}
            language={langFor(activePath)}
            value={value}
            onMount={handleMount}
            theme="asherin-artifact"
            onChange={(v) => canWrite && ws.edit(activePath, v ?? "")}
            options={{
              readOnly: !canWrite,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              minimap: { enabled: false },
              wordWrap: "on",
              tabSize: 2,
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "line",
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ArtifactEditor;
