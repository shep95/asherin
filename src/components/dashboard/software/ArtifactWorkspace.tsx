// The software workspace: one artifact, one room, several ways to work on it.
//
// It is not an IDE clone. The model is the easiest way to build here, and the
// editor is there for when you want your own hands on it. What runs is what is
// on screen — including your unsaved edits — and nothing claims to have run,
// passed or been saved unless it actually did.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useArtifactWorkspace, useSoftwareRegistry } from "@/contexts/SoftwareContext";
import { useArtifactSandbox } from "@/hooks/useArtifactSandbox";
import { useSoftwareWorkspace } from "@/hooks/useSoftwareWorkspace";
import { restoreFiles, listRuns } from "@/lib/software/files";
import {
  createVersion,
  deleteArtifact,
  installArtifact,
  renameArtifact,
  restoreVersion,
  setInstallationEnabled,
  uninstallArtifact,
  updateArtifact,
} from "@/lib/software/store";
import { WORKSPACE_PANES, type ArtifactRun, type SoftwareVersion, type WorkspacePane } from "@/lib/software/types";
import ArtifactStatusBadge from "./ArtifactStatusBadge";
import ArtifactAiPanel from "./ArtifactAiPanel";
import ArtifactBuildPane from "./ArtifactBuildPane";
import { preflight } from "@/lib/software/install";
import { providerForClass, type RuntimeController, type RuntimeSession } from "@/lib/software/runtime";
import { recordAction } from "@/lib/software/actions";
import ArtifactConsole, { mergeConsole } from "./ArtifactConsole";
import ArtifactDataPane from "./ArtifactDataPane";
import ArtifactEditor from "./ArtifactEditor";
import ArtifactFileRail from "./ArtifactFileRail";
import ArtifactHistoryPane from "./ArtifactHistoryPane";
import ArtifactPreviewPane from "./ArtifactPreviewPane";
import ArtifactSettingsPane from "./ArtifactSettingsPane";
import ArtifactTestPane from "./ArtifactTestPane";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const SAVE_LABEL: Record<string, string> = {
  saved: "saved",
  saving: "saving…",
  unsaved: "unsaved changes",
  save_failed: "save failed",
};

const ArtifactWorkspace = ({
  artifactId,
  mode,
  onMode,
  onBack,
}: {
  artifactId: string;
  mode?: string;
  onMode: (mode: WorkspacePane) => void;
  onBack: () => void;
}) => {
  const { user } = useAuth();
  const { refresh } = useSoftwareRegistry();
  const ctx = useArtifactWorkspace(artifactId);
  const { artifact, versions, currentVersion, events, installation, role } = ctx;

  const canWrite = role === "owner" || role === "admin" || role === "collaborator";
  const isOwner = role === "owner";

  const ws = useSoftwareWorkspace(artifactId, canWrite);
  const sandbox = useArtifactSandbox(ws.workingFiles);

  const pane: WorkspacePane = (WORKSPACE_PANES as readonly string[]).includes(mode ?? "")
    ? (mode as WorkspacePane)
    : "build";

  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [runs, setRuns] = useState<ArtifactRun[]>([]);
  const [session, setSession] = useState<RuntimeSession | null>(null);

  // the runtime is reached through its provider, never by poking the frame.
  const runtime = useMemo(() => providerForClass(artifact?.runtimeType ?? "client_browser"), [artifact?.runtimeType]);
  const controller: RuntimeController = useMemo(
    () => ({
      start: sandbox.start,
      stop: sandbox.stop,
      observations: sandbox.snapshot,
      running: () => sandbox.running,
    }),
    [sandbox],
  );
  const health = useMemo(
    () => runtime.health(session, controller),
    // observations move as the artifact talks, so health is re-read with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, session, controller, sandbox.observations, sandbox.running],
  );

  useEffect(() => {
    let alive = true;
    listRuns(artifactId)
      .then((r) => alive && setRuns(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [artifactId]);

  const onError = useCallback(
    (label: string, e: unknown) => {
      const detail = e instanceof Error ? e.message : "unknown failure";
      toast.error(label, { description: detail });
      ws.note({ channel: "workspace", level: "error", message: `${label}: ${detail}` });
    },
    [ws],
  );

  const guard = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        await ctx.reload();
        await refresh();
      } catch (e) {
        onError(label, e);
      } finally {
        setBusy(false);
      }
    },
    [ctx, onError, refresh],
  );

  // a checkpoint captures the files as saved, so a restore brings work back
  // rather than a label of it. unsaved edits are written first, deliberately.
  const checkpoint = useCallback(
    (summary: string, label?: string) =>
      guard("could not create a checkpoint", async () => {
        if (ws.dirtyPaths.length > 0) await ws.saveAll();
        const files = await (async () => {
          await ws.reload();
          return ws.workingFiles;
        })();
        await createVersion({
          artifactId,
          userId: user!.id,
          changeSummary: summary,
          label,
          checkpoint: true,
          sourceRef: { files: files.map((f) => ({ path: f.path, content: f.content })) },
        });
        toast.success("checkpoint saved");
      }),
    [artifactId, guard, user, ws],
  );

  const restore = useCallback(
    (v: SoftwareVersion) =>
      guard("restore failed", async () => {
        await restoreVersion({ artifactId, userId: user!.id, version: v });
        await restoreFiles({ artifactId, userId: user!.id, sourceRef: v.sourceRef });
        await ws.reload();
        toast.success(`restored v${v.displayVersion} as a new version — nothing was erased`);
      }),
    [artifactId, guard, user, ws],
  );

  const installPreflight = useMemo(
    () =>
      artifact
        ? preflight({
            artifact,
            files: ws.workingFiles,
            lastRun: runs[0] ?? null,
            runtimeClass: artifact.runtimeType ?? "client_browser",
          })
        : null,
    [artifact, runs, ws.workingFiles],
  );

  const startRuntime = useCallback(() => {
    const prepared = runtime.build(ws.workingFiles);
    const started = runtime.start(prepared, controller);
    if (!started) {
      ws.note({
        channel: "build",
        level: "error",
        message: prepared.unavailableReason ?? prepared.errors[0] ?? "the artifact could not be prepared to run",
      });
      setConsoleOpen(true);
      return;
    }
    setSession(started);
    if (user) {
      void recordAction({
        action: "run_preview",
        actor: "user",
        artifactId,
        versionId: currentVersion?.id ?? null,
        actorUserId: user.id,
        target: runtime.id,
      }).catch(() => undefined);
    }
  }, [artifactId, controller, currentVersion?.id, runtime, user, ws]);

  const stopRuntime = useCallback(() => {
    if (!session) return;
    setSession(runtime.stop(session, controller));
  }, [controller, runtime, session]);

  const consoleLines = useMemo(() => mergeConsole(sandbox.observations, ws.log), [sandbox.observations, ws.log]);
  const implicated = useMemo(
    () =>
      runs
        .flatMap((r) => r.results)
        .filter((r) => r.status === "failed")
        .map((r) => r.name),
    [runs],
  );

  if (ctx.loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> back to software
        </button>
        <div className={`${card} p-6 text-sm text-muted-foreground`}>
          {ctx.error ?? "this artifact does not exist, or you do not have access to it"}
        </div>
      </div>
    );
  }

  const displayName = name ?? artifact.displayName;
  const showRails = pane === "code" || pane === "files" || pane === "build";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* top bar — what this is, where it stands, and the three verbs. */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border/15 px-4 py-2.5">
        <button
          onClick={onBack}
          aria-label="back to software"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> software
        </button>
        <span aria-hidden className="text-base">
          {artifact.icon ?? "◈"}
        </span>
        <input
          value={displayName}
          onChange={(e) => setName(e.target.value)}
          aria-label="artifact name"
          className="min-w-[8rem] max-w-[16rem] flex-1 bg-transparent text-sm font-extralight tracking-wide text-foreground outline-none focus:underline"
        />
        {name !== null && name.trim() && name.trim() !== artifact.displayName && (
          <button
            disabled={busy}
            onClick={() =>
              guard("rename failed", async () => {
                await renameArtifact(artifact.id, name, user!.id);
                setName(null);
              })
            }
            className="rounded-lg border border-border/30 px-2 py-1 text-[11px] hover:bg-card/40"
          >
            save name
          </button>
        )}
        <ArtifactStatusBadge status={artifact.lifecycle} />
        <span className="text-[11px] text-muted-foreground">
          {currentVersion ? `v${currentVersion.displayVersion}` : "no version yet"}
        </span>
        <span
          className={`text-[11px] ${
            ws.saveState === "save_failed"
              ? "text-destructive/90"
              : ws.saveState === "saved"
                ? "text-muted-foreground"
                : "text-amber-300/90"
          }`}
        >
          {SAVE_LABEL[ws.saveState]}
        </span>
        <div className="flex-1" />
        {canWrite && (
          <>
            <button
              disabled={busy || ws.dirtyPaths.length === 0}
              onClick={() => void ws.saveAll().catch((e) => onError("could not save", e))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-[11px] disabled:opacity-40 hover:bg-card/40"
            >
              <Save className="h-3.5 w-3.5" /> save
            </button>
            <button
              disabled={busy}
              onClick={() => void checkpoint("manual checkpoint")}
              className="rounded-lg border border-border/30 px-2.5 py-1 text-[11px] disabled:opacity-40 hover:bg-card/40"
            >
              checkpoint
            </button>
          </>
        )}
        <button
          onClick={() => {
            onMode("preview");
            startRuntime();
          }}
          disabled={!sandbox.build.ok}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1 text-[11px] text-primary disabled:border-border/30 disabled:text-muted-foreground hover:bg-primary/10"
        >
          <Play className="h-3.5 w-3.5" /> run
        </button>
      </header>

      {/* modes */}
      <nav aria-label="workspace modes" className="flex flex-wrap gap-1.5 border-b border-border/10 px-4 py-2">
        {WORKSPACE_PANES.map((p) => (
          <button
            key={p}
            onClick={() => onMode(p)}
            aria-current={pane === p ? "page" : undefined}
            className={`rounded-lg border px-2.5 py-1 text-[11px] tracking-wide transition-colors ${
              pane === p
                ? "border-primary/50 text-primary"
                : "border-border/25 text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {showRails && (
            <aside className="w-full shrink-0 border-b border-border/10 lg:w-64 lg:border-b-0 lg:border-r">
              <ArtifactFileRail ws={ws} canWrite={canWrite} onError={onError} />
            </aside>
          )}

          <main className="min-h-0 flex-1 overflow-y-auto">
            {pane === "build" && (
              <ArtifactBuildPane
                artifact={artifact}
                files={ws.workingFiles}
                dirtyCount={ws.dirtyPaths.length}
                versions={versions}
                lastRun={runs[0] ?? null}
                health={health}
                busy={busy}
                canWrite={canWrite}
                onCheckpoint={(label) => void checkpoint(label, label)}
              />
            )}

            {(pane === "code" || pane === "files") && (
              <ArtifactEditor ws={ws} canWrite={canWrite} onError={onError} />
            )}

            {pane === "preview" && (
              <div className="p-4">
                <ArtifactPreviewPane sandbox={sandbox} health={health} onStart={startRuntime} onStop={stopRuntime} />
              </div>
            )}

            {pane === "test" && (
              <div className="p-4">
                <ArtifactTestPane
                  artifactId={artifact.id}
                  versionId={currentVersion?.id ?? null}
                  sandbox={sandbox}
                  readOnly={!canWrite}
                  files={ws.workingFiles}
                  changedPaths={ws.dirtyPaths}
                  onRuns={setRuns}
                />
              </div>
            )}

            {pane === "data" && (
              <div className="p-4">
                <ArtifactDataPane artifact={artifact} runs={runs} canWrite={canWrite} />
              </div>
            )}

            {pane === "history" && (
              <div className="p-4">
                <ArtifactHistoryPane
                  versions={versions}
                  currentVersionId={currentVersion?.id ?? null}
                  events={events}
                  busy={busy}
                  canWrite={canWrite}
                  onCheckpoint={() => void checkpoint("manual checkpoint")}
                  onRestore={(v) => void restore(v)}
                />
              </div>
            )}

            {pane === "settings" && (
              <div className="p-4">
                <ArtifactSettingsPane
                  preflight={installPreflight}
                  artifact={artifact}
                  currentVersion={currentVersion}
                  installation={installation}
                  busy={busy}
                  canWrite={canWrite}
                  isOwner={isOwner}
                  onSaveDetails={(patch) =>
                    void guard("could not save details", async () => {
                      await updateArtifact(artifact.id, patch, user!.id);
                      toast.success("details saved");
                    })
                  }
                  onInstall={() =>
                    void guard("install failed", async () => {
                      if (!installPreflight.eligible) {
                        toast.error(installPreflight.summary);
                        return;
                      }
                      await installArtifact({
                        userId: user!.id,
                        artifact,
                        versionId: currentVersion?.id ?? null,
                        addToNavigation: true,
                      });
                      toast.success("installed and added to your sidebar");
                    })
                  }
                  onToggleInstall={() =>
                    void guard("could not change this installation", async () => {
                      await setInstallationEnabled(installation!, !installation!.enabled);
                    })
                  }
                  onUninstall={() =>
                    void guard("could not uninstall", async () => {
                      await uninstallArtifact({ installation: installation!, actorUserId: user!.id });
                      toast.success("uninstalled — the artifact and its versions are kept");
                    })
                  }
                  onDelete={() =>
                    void guard("delete failed", async () => {
                      if (!window.confirm("delete this artifact, its files, versions and history? this cannot be undone.")) return;
                      await deleteArtifact(artifact.id);
                      toast.success("artifact deleted");
                      onBack();
                    })
                  }
                />
              </div>
            )}
          </main>

          {(pane === "build" || pane === "code") && (
            <aside className="w-full shrink-0 border-t border-border/10 lg:w-[22rem] lg:border-l lg:border-t-0">
              <ArtifactAiPanel
                artifact={artifact}
                ws={ws}
                canWrite={canWrite}
                implicated={implicated}
                onApplied={(paths) => {
                  paths.forEach((p) => ws.open(p));
                  setConsoleOpen(true);
                }}
              />
            </aside>
          )}
        </div>

        <ArtifactConsole
          lines={consoleLines}
          open={consoleOpen}
          onToggle={() => setConsoleOpen((v) => !v)}
          onClear={() => {
            ws.clearLog();
            sandbox.clear();
          }}
          running={sandbox.running}
        />
      </div>
    </div>
  );
};

export default ArtifactWorkspace;
