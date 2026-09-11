// The software workspace shell.
//
// It is not an IDE. It is the room an artifact lives in: what it is, what it
// can do, what happened to it, and which version is current. Panes that later
// phases fill in say so plainly instead of drawing an empty imitation.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useArtifactWorkspace, useSoftwareRegistry } from "@/contexts/SoftwareContext";
import { useArtifactSandbox } from "@/hooks/useArtifactSandbox";
import { listFiles } from "@/lib/software/files";
import type { ArtifactFile } from "@/lib/software/types";
import ArtifactCodePane from "./ArtifactCodePane";
import ArtifactPreviewPane from "./ArtifactPreviewPane";
import ArtifactTestPane from "./ArtifactTestPane";
import {
  createVersion,
  deleteArtifact,
  installArtifact,
  renameArtifact,
  restoreVersion,
  setInstallationEnabled,
  uninstallArtifact,
} from "@/lib/software/store";
import { WORKSPACE_PANES, type WorkspacePane } from "@/lib/software/types";
import ArtifactStatusBadge from "./ArtifactStatusBadge";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

/** What each pane can honestly do today. No pane pretends. */
const PANE_STATE: Record<WorkspacePane, string> = {
  build: "the model builds artifacts from chat today. this pane becomes the guided build surface in the next phase.",
  code: "",
  preview: "",
  test: "",
  data: "artifact-scoped storage is declared in the data manifest and is not provisioned in this phase.",
  files: "",
  history: "",
  settings: "",
};

const ArtifactWorkspace = ({ artifactId, onBack }: { artifactId: string; onBack: () => void }) => {
  const { user } = useAuth();
  const { refresh } = useSoftwareRegistry();
  const ctx = useArtifactWorkspace(artifactId);
  const [pane, setPane] = useState<WorkspacePane>("build");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const sandbox = useArtifactSandbox(files);

  useEffect(() => {
    let alive = true;
    listFiles(artifactId)
      .then((f) => alive && setFiles(f))
      .catch(() => alive && setFiles([]));
    return () => {
      alive = false;
    };
  }, [artifactId]);

  const { artifact, versions, currentVersion, events, installation, role, permissions, runtime } = ctx;

  const guard = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        await ctx.reload();
        await refresh();
      } catch (e) {
        toast.error(label, { description: e instanceof Error ? e.message : "unknown failure" });
      } finally {
        setBusy(false);
      }
    },
    [ctx, refresh],
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

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> software
      </button>

      <header className={`${card} mb-4 p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xl font-extralight tracking-wide text-foreground outline-none"
            aria-label="artifact name"
          />
          <ArtifactStatusBadge status={artifact.lifecycle} />
          <span className="text-[11px] text-muted-foreground">
            {currentVersion ? `v${currentVersion.displayVersion}` : "no version yet"}
          </span>
          <span className="text-[11px] text-muted-foreground">{artifact.visibility}</span>
          <span className="text-[11px] text-muted-foreground">{role ?? "no access"}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          identity {artifact.id} · renaming changes the label only, never this id, its route, its permissions or its history
        </p>
        {name !== null && name.trim() !== artifact.displayName && (
          <button
            disabled={busy}
            onClick={() =>
              guard("rename failed", async () => {
                await renameArtifact(artifact.id, name, user!.id);
                setName(null);
                toast.success("renamed");
              })
            }
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
          >
            <Save className="h-3.5 w-3.5" /> save name
          </button>
        )}
      </header>

      <nav className="mb-4 flex flex-wrap gap-2">
        {WORKSPACE_PANES.map((p) => (
          <button
            key={p}
            onClick={() => setPane(p)}
            className={`rounded-lg border px-3 py-1.5 text-xs tracking-wide transition-colors ${
              pane === p ? "border-primary/50 text-primary" : "border-border/25 text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </nav>

      {pane === "history" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-sm tracking-wide text-foreground">versions</h2>
            <button
              disabled={busy}
              onClick={() =>
                guard("could not create a checkpoint", async () => {
                  await createVersion({
                    artifactId: artifact.id,
                    userId: user!.id,
                    changeSummary: "manual checkpoint",
                    checkpoint: true,
                  });
                  toast.success("checkpoint saved");
                })
              }
              className="mb-3 rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
            >
              save a checkpoint
            </button>
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground">no versions yet — a checkpoint captures the current state.</p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-lg border border-border/15 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-foreground">
                        v{v.displayVersion}
                        {v.id === currentVersion?.id && <span className="ml-2 text-primary">current</span>}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {v.changeSummary ?? "no summary"} · {v.validationStatus} · {v.releaseStatus}
                      </p>
                    </div>
                    {v.rollbackEligible && v.id !== currentVersion?.id && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          guard("restore failed", async () => {
                            await restoreVersion({ artifactId: artifact.id, userId: user!.id, version: v });
                            toast.success(`restored v${v.displayVersion} as a new version`);
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-border/30 px-2 py-1 text-[11px] hover:bg-card/40"
                      >
                        <RotateCcw className="h-3 w-3" /> restore
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-sm tracking-wide text-foreground">activity</h2>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">nothing recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="text-foreground/80">{e.type}</span>
                    <span className="text-muted-foreground">
                      {e.result} · {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              credentials, tokens and prompt content are never written to this history.
            </p>
          </section>
        </div>
      ) : pane === "settings" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-sm tracking-wide text-foreground">permissions</h2>
            <p className="mb-2 text-xs text-muted-foreground">least privilege by default. a grant is always explicit.</p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {permissions.granted.map((g) => (
                <li key={g} className="flex items-center gap-2 text-foreground/80">
                  <Check className="h-3 w-3 text-primary" /> {g}
                  {permissions.rationale?.[g] && <span className="text-muted-foreground">— {permissions.rationale[g]}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              network, storage, integrations, mcp and privileged actions stay denied until a later phase can enforce them
              at run time.
            </p>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-sm tracking-wide text-foreground">installation</h2>
            {installation ? (
              <div className="space-y-3">
                <p className="text-xs text-foreground/80">
                  installed as “{installation.installedName}” · {installation.updateState.replace("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      guard("could not change this installation", async () => {
                        await setInstallationEnabled(installation, !installation.enabled);
                      })
                    }
                    className="rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
                  >
                    {installation.enabled ? "disable" : "enable"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      guard("could not uninstall", async () => {
                        await uninstallArtifact({ installation, actorUserId: user!.id });
                        toast.success("uninstalled — the artifact and its versions are kept");
                      })
                    }
                    className="rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
                  >
                    uninstall
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  installing is a deliberate step. nothing you build appears in your sidebar until you put it there.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    guard("install failed", async () => {
                      await installArtifact({
                        userId: user!.id,
                        artifact,
                        versionId: currentVersion?.id ?? null,
                        addToNavigation: true,
                      });
                      toast.success("installed and added to your sidebar");
                    })
                  }
                  className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
                >
                  install and add to my sidebar
                </button>
              </div>
            )}

            <button
              disabled={busy}
              onClick={() =>
                guard("delete failed", async () => {
                  await deleteArtifact(artifact.id);
                  toast.success("artifact deleted");
                  onBack();
                })
              }
              className="mt-6 inline-flex items-center gap-2 text-[11px] text-destructive/80 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> delete this artifact and everything under it
            </button>
          </section>
        </div>
      ) : (
        <section className={`${card} p-5`}>
          <h2 className="mb-2 text-sm tracking-wide text-foreground">{pane}</h2>
          <p className="text-xs text-muted-foreground">{PANE_STATE[pane]}</p>
          {pane === "preview" && (
            <p className="mt-3 text-[11px] text-muted-foreground">runtime: unavailable — {runtime.reason}</p>
          )}
          {pane === "build" && (
            <div className="mt-4 space-y-2 text-[11px] text-muted-foreground">
              <p>type: {artifact.type}</p>
              <p>integrations declared: {artifact.integrationManifest.length}</p>
              <p>dependencies declared: {artifact.dependencyManifest.length}</p>
              <p>{ctx.pendingChanges ? "no version has been captured yet" : `${versions.length} version(s) recorded`}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ArtifactWorkspace;
