// One artifact's working state: its files, the edits not yet written, which
// files are open, what the workspace has actually done, and whether anything
// is unsaved.
//
// Everything here is real: a file only reads as saved once the write returned,
// and typed work is mirrored into a draft so a reload never eats it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteFile,
  duplicateFile,
  listFiles,
  listRecycledFiles,
  moveFile,
  restoreRecycledFile,
  saveFile,
} from "@/lib/software/files";
import { clearDraft, loadDraft, saveDraft, type SaveState } from "@/lib/software/drafts";
import type { ArtifactFile } from "@/lib/software/types";

export interface WorkspaceLogEntry {
  id: string;
  channel: "workspace" | "build" | "test" | "ai";
  level: "info" | "warn" | "error";
  message: string;
  at: string;
}

export interface SoftwareWorkspace {
  files: ArtifactFile[];
  recycled: ArtifactFile[];
  loading: boolean;
  error: string | null;
  /** unsaved edits, by path. */
  drafts: Record<string, string>;
  dirtyPaths: string[];
  saveState: SaveState;
  openPaths: string[];
  activePath: string | null;
  /** what the person has highlighted, offered to the model as context. */
  selection: { path: string; text: string } | null;
  log: WorkspaceLogEntry[];
  contentOf: (path: string) => string;
  /** files as they would be if every unsaved edit were applied — what runs. */
  workingFiles: ArtifactFile[];

  reload: () => Promise<void>;
  open: (path: string) => void;
  close: (path: string) => void;
  setActivePath: (path: string | null) => void;
  edit: (path: string, content: string) => void;
  revert: (path: string) => void;
  setSelection: (s: { path: string; text: string } | null) => void;
  save: (path: string) => Promise<void>;
  saveAll: () => Promise<void>;
  create: (path: string, content?: string) => Promise<void>;
  rename: (file: ArtifactFile, toPath: string) => Promise<void>;
  duplicate: (file: ArtifactFile) => Promise<void>;
  remove: (file: ArtifactFile) => Promise<void>;
  restore: (file: ArtifactFile) => Promise<void>;
  /** writes model-authored content and marks its origin honestly. */
  applyAiContent: (changes: Array<{ path: string; content: string }>) => Promise<void>;
  note: (entry: Omit<WorkspaceLogEntry, "id" | "at">) => void;
  clearLog: () => void;
}

const DRAFT_DEBOUNCE_MS = 1200;

export function useSoftwareWorkspace(artifactId: string, canWrite: boolean): SoftwareWorkspace {
  const { user } = useAuth();
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [recycled, setRecycled] = useState<ArtifactFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ path: string; text: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [log, setLog] = useState<WorkspaceLogEntry[]>([]);
  const draftTimer = useRef<number | null>(null);

  const note = useCallback((entry: Omit<WorkspaceLogEntry, "id" | "at">) => {
    setLog((prev) =>
      [...prev, { ...entry, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: new Date().toISOString() }].slice(
        -300,
      ),
    );
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const reload = useCallback(async () => {
    try {
      const [live, gone] = await Promise.all([listFiles(artifactId), listRecycledFiles(artifactId)]);
      setFiles(live);
      setRecycled(gone);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load this artifact's files");
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  // first load: files, then whatever was left unsaved last time.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      await reload();
      if (!alive || !user) return;
      try {
        const draft = await loadDraft(artifactId, user.id);
        if (!alive || draft.length === 0) return;
        setDrafts(Object.fromEntries(draft.map((d) => [d.path, d.content])));
        setSaveState("unsaved");
        note({ channel: "workspace", level: "warn", message: `restored ${draft.length} unsaved file edit(s) from your last session` });
      } catch {
        /* a missing draft is not a failure worth surfacing */
      }
    })();
    return () => {
      alive = false;
    };
  }, [artifactId, user, reload, note]);

  const dirtyPaths = useMemo(
    () => Object.keys(drafts).filter((p) => drafts[p] !== (files.find((f) => f.path === p)?.content ?? "")),
    [drafts, files],
  );

  // drafts are mirrored server-side, debounced. metadata only — never a version.
  useEffect(() => {
    if (!user || !canWrite) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    const payload = dirtyPaths.map((p) => ({ path: p, content: drafts[p] }));
    draftTimer.current = window.setTimeout(() => {
      void (payload.length === 0 ? clearDraft(artifactId, user.id) : saveDraft(artifactId, user.id, payload)).catch(() => {
        setSaveState("save_failed");
      });
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [drafts, dirtyPaths, artifactId, user, canWrite]);

  useEffect(() => {
    setSaveState((s) => (dirtyPaths.length > 0 ? (s === "saving" ? s : "unsaved") : s === "save_failed" ? s : "saved"));
  }, [dirtyPaths.length]);

  // a browser-level guard: closing the tab mid-edit should cost a confirmation.
  useEffect(() => {
    if (dirtyPaths.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyPaths.length]);

  const contentOf = useCallback(
    (path: string) => drafts[path] ?? files.find((f) => f.path === path)?.content ?? "",
    [drafts, files],
  );

  const workingFiles = useMemo(
    () => files.map((f) => (f.path in drafts ? { ...f, content: drafts[f.path] } : f)),
    [files, drafts],
  );

  const open = useCallback((path: string) => {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActivePath(path);
  }, []);

  const close = useCallback(
    (path: string) => {
      setOpenPaths((prev) => {
        const next = prev.filter((p) => p !== path);
        setActivePath((cur) => (cur === path ? next[next.length - 1] ?? null : cur));
        return next;
      });
    },
    [],
  );

  const edit = useCallback((path: string, content: string) => {
    setDrafts((prev) => ({ ...prev, [path]: content }));
  }, []);

  const revert = useCallback((path: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const save = useCallback(
    async (path: string) => {
      if (!user || !canWrite) return;
      const content = drafts[path];
      if (content === undefined) return;
      setSaveState("saving");
      try {
        await saveFile({ artifactId, userId: user.id, path, content, origin: "user" });
        revert(path);
        await reload();
        setSaveState("saved");
        note({ channel: "workspace", level: "info", message: `saved ${path}` });
      } catch (e) {
        setSaveState("save_failed");
        note({ channel: "workspace", level: "error", message: `could not save ${path}: ${message(e)}` });
        throw e;
      }
    },
    [artifactId, canWrite, drafts, note, reload, revert, user],
  );

  const saveAll = useCallback(async () => {
    for (const path of dirtyPaths) {
      // sequential on purpose: one failure should not orphan the rest silently.
      // eslint-disable-next-line no-await-in-loop
      await save(path);
    }
  }, [dirtyPaths, save]);

  const create = useCallback(
    async (path: string, content = "") => {
      if (!user || !canWrite) return;
      const file = await saveFile({ artifactId, userId: user.id, path, content, origin: "user" });
      await reload();
      open(file.path);
      note({ channel: "workspace", level: "info", message: `created ${file.path}` });
    },
    [artifactId, canWrite, note, open, reload, user],
  );

  const rename = useCallback(
    async (file: ArtifactFile, toPath: string) => {
      if (!canWrite) return;
      const moved = await moveFile({ file, toPath, livePaths: files.map((f) => f.path) });
      setDrafts((prev) => {
        if (!(file.path in prev)) return prev;
        const next = { ...prev };
        next[moved.path] = next[file.path];
        delete next[file.path];
        return next;
      });
      setOpenPaths((prev) => prev.map((p) => (p === file.path ? moved.path : p)));
      setActivePath((cur) => (cur === file.path ? moved.path : cur));
      await reload();
      note({ channel: "workspace", level: "info", message: `moved ${file.path} → ${moved.path}` });
    },
    [canWrite, files, note, reload],
  );

  const duplicate = useCallback(
    async (file: ArtifactFile) => {
      if (!user || !canWrite) return;
      const copy = await duplicateFile({ file, userId: user.id, livePaths: files.map((f) => f.path) });
      await reload();
      open(copy.path);
      note({ channel: "workspace", level: "info", message: `duplicated ${file.path} → ${copy.path}` });
    },
    [canWrite, files, note, open, reload, user],
  );

  const remove = useCallback(
    async (file: ArtifactFile) => {
      if (!canWrite) return;
      await deleteFile(file.id);
      revert(file.path);
      close(file.path);
      await reload();
      note({ channel: "workspace", level: "warn", message: `recycled ${file.path} — it can be restored from files` });
    },
    [canWrite, close, note, reload, revert],
  );

  const restore = useCallback(
    async (file: ArtifactFile) => {
      if (!user || !canWrite) return;
      const back = await restoreRecycledFile({ file, userId: user.id, livePaths: files.map((f) => f.path) });
      await reload();
      open(back.path);
      note({ channel: "workspace", level: "info", message: `restored ${back.path}` });
    },
    [canWrite, files, note, open, reload, user],
  );

  const applyAiContent = useCallback(
    async (changes: Array<{ path: string; content: string }>) => {
      if (!user || !canWrite) return;
      for (const c of changes) {
        // eslint-disable-next-line no-await-in-loop
        await saveFile({ artifactId, userId: user.id, path: c.path, content: c.content, origin: "ai" });
      }
      await reload();
      note({
        channel: "ai",
        level: "info",
        message: `applied model changes to ${changes.map((c) => c.path).join(", ")}`,
      });
    },
    [artifactId, canWrite, note, reload, user],
  );

  return {
    files,
    recycled,
    loading,
    error,
    drafts,
    dirtyPaths,
    saveState,
    openPaths,
    activePath,
    selection,
    log,
    contentOf,
    workingFiles,
    reload,
    open,
    close,
    setActivePath,
    edit,
    revert,
    setSelection,
    save,
    saveAll,
    create,
    rename,
    duplicate,
    remove,
    restore,
    applyAiContent,
    note,
    clearLog,
  };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "unknown failure";
}
