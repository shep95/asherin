// The shell an installed application lives in.
//
// Asherin owns the frame around the app: its header, its state, its settings,
// its removal. The app itself runs through the artifact runtime provider — the
// browser sandbox — because that is the only place untrusted code can be given
// a page without being given the dashboard. A crash inside it is contained
// here and never takes the shell down.

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Play,
  Settings2,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSoftwareRegistry } from "@/contexts/SoftwareContext";
import { useArtifactSandbox } from "@/hooks/useArtifactSandbox";
import { listFiles } from "@/lib/software/files";
import {
  deleteArtifact,
  deleteArtifactData,
  deleteNavigationItem,
  installArtifact,
  listEvents,
  listVersions,
  persistNavigationOrder,
  renameInstallation,
  setInstallationEnabled,
  setNavigationIcon,
  setNavigationSection,
  uninstallArtifact,
} from "@/lib/software/store";
import {
  REMOVAL_SEMANTICS,
  appRoute,
  launchState,
  reorder,
  type RemovalAction,
} from "@/lib/software/navigation";
import { providerForClass } from "@/lib/software/runtime";
import type { ArtifactEvent, ArtifactFile, SoftwareVersion } from "@/lib/software/types";
import { toast } from "sonner";
import ArtifactIntegrationsPane from "./ArtifactIntegrationsPane";
import ArtifactUpdatePane from "./ArtifactUpdatePane";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

/** A crash inside an installed app stops here. */
class AppErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`${card} m-4 p-5 text-xs`}>
        <p className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> this application stopped working
        </p>
        <p className="mt-2 text-muted-foreground">{this.state.error.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">asherin itself is unaffected.</p>
        <button
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
          className="mt-3 rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
        >
          try again
        </button>
      </div>
    );
  }
}

type Tab = "app" | "settings";

const InstalledAppHost = ({ artifactId, onBack }: { artifactId: string; onBack: () => void }) => {
  const { user } = useAuth();
  const { artifacts, installations, navigation, refresh } = useSoftwareRegistry();
  const artifact = artifacts.find((a) => a.id === artifactId) ?? null;
  const installation = installations.find((i) => i.artifactId === artifactId) ?? null;
  const navItem = navigation.find((n) => n.artifactId === artifactId) ?? null;

  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [versions, setVersions] = useState<SoftwareVersion[]>([]);
  const [events, setEvents] = useState<ArtifactEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("app");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [confirmAction, setConfirmAction] = useState<RemovalAction | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, v, e] = await Promise.all([listFiles(artifactId), listVersions(artifactId), listEvents(artifactId, 20)]);
      setFiles(f.filter((x) => !x.deletedAt));
      setVersions(v);
      setEvents(e);
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setName(installation?.installedName ?? artifact?.displayName ?? "");
  }, [installation?.installedName, artifact?.displayName]);

  const sandbox = useArtifactSandbox(files);
  const state = useMemo(() => launchState({ artifact, installation }), [artifact, installation]);
  const provider = providerForClass(artifact?.runtimeType === "client_browser" ? "client_browser" : "client_browser");
  const currentVersion = versions[0] ?? null;
  const lastError = sandbox.observations.filter((o) => o.level === "error").slice(-1)[0] ?? null;

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : label);
    } finally {
      setBusy(false);
    }
  };

  if (!artifact) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        this application no longer exists.{" "}
        <button onClick={onBack} className="text-primary underline">
          back to your software
        </button>
      </div>
    );
  }

  const semantics = confirmAction ? REMOVAL_SEMANTICS[confirmAction] : null;

  const runRemoval = async (action: RemovalAction) => {
    if (!user) return;
    await guard("that action did not complete", async () => {
      if (action === "remove_from_dashboard") {
        if (navItem) await deleteNavigationItem(navItem.id);
        toast.success("removed from your sidebar — still installed");
      } else if (action === "disable") {
        if (installation) await setInstallationEnabled(installation, !installation.enabled);
      } else if (action === "uninstall") {
        if (installation) await uninstallArtifact({ installation, actorUserId: user.id });
        toast.success("uninstalled — the application and its data are kept");
      } else if (action === "delete_application") {
        await deleteArtifact(artifact.id);
        toast.success("application deleted");
        onBack();
      } else {
        const rows = await deleteArtifactData(artifact.id);
        await deleteArtifact(artifact.id);
        toast.success(`application deleted along with ${rows} saved row(s)`);
        onBack();
      }
    });
    setConfirmAction(null);
    setConfirmText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/20 px-4 py-2.5">
        <button onClick={onBack} aria-label="back" className="rounded-lg border border-border/25 p-1.5 hover:bg-card/40">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-sm text-foreground">
          {navItem?.icon || artifact.icon || "◈"} {installation?.installedName ?? artifact.displayName}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {currentVersion ? `v${currentVersion.displayVersion}` : "no version"} ·{" "}
          {state.state === "open" ? (sandbox.running ? "running" : "ready") : state.state}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {state.state === "open" &&
            (sandbox.running ? (
              <button
                onClick={sandbox.stop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-[11px] hover:bg-card/40"
              >
                <Square className="h-3 w-3" /> stop
              </button>
            ) : (
              <button
                onClick={sandbox.start}
                disabled={!sandbox.build.ok}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1 text-[11px] text-primary disabled:opacity-40 hover:bg-primary/10"
              >
                <Play className="h-3 w-3" /> run
              </button>
            ))}
          <button
            onClick={() => setTab(tab === "settings" ? "app" : "settings")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-[11px] hover:bg-card/40"
          >
            <Settings2 className="h-3 w-3" /> {tab === "settings" ? "app" : "settings"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> opening {artifact.displayName}
        </div>
      ) : tab === "app" ? (
        <AppErrorBoundary onReset={() => void load()}>
          <div className="min-h-0 flex-1 p-4">
            {state.state !== "open" ? (
              <div className={`${card} p-5 text-xs text-muted-foreground`}>{state.reason}</div>
            ) : !sandbox.build.ok ? (
              <div className={`${card} p-5 text-xs text-amber-400/90`}>
                {sandbox.build.unavailableReason ?? sandbox.build.errors[0] ?? "this application has nothing to run yet"}
              </div>
            ) : (
              <div className={`${card} h-full overflow-hidden`}>
                <iframe
                  key={sandbox.runKey}
                  ref={sandbox.frameRef}
                  title={installation?.installedName ?? artifact.displayName}
                  sandbox="allow-scripts"
                  srcDoc={sandbox.running ? sandbox.build.srcDoc : undefined}
                  className="h-full min-h-[420px] w-full bg-white"
                />
              </div>
            )}
            {sandbox.observations.length > 0 && (
              <ul className="mt-3 max-h-32 overflow-y-auto text-[11px] text-muted-foreground">
                {sandbox.observations.slice(-20).map((o, i) => (
                  <li key={i} className={o.level === "error" ? "text-destructive" : undefined}>
                    {o.channel} · {o.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AppErrorBoundary>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={`${card} p-5`}>
              <h2 className="mb-3 text-sm tracking-wide text-foreground">this installation</h2>
              <label className="block text-[11px] text-muted-foreground">
                name on your dashboard
                <input
                  value={name}
                  aria-label="installed app name"
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none focus:border-primary/40"
                />
              </label>
              <button
                disabled={busy || !installation || name.trim() === (installation?.installedName ?? "")}
                onClick={() =>
                  void guard("could not rename", async () => {
                    await renameInstallation(installation!, name);
                    toast.success("renamed — its address, data and history are unchanged");
                  })
                }
                className="mt-2 rounded-lg border border-border/30 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-card/40"
              >
                save name
              </button>
              {navItem && (
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] text-muted-foreground">sidebar row</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={navItem.icon ?? ""}
                      aria-label="sidebar icon"
                      onChange={(e) =>
                        void guard("could not change the icon", () =>
                          setNavigationIcon(navItem.id, e.target.value.slice(0, 4) || null),
                        )
                      }
                      className="w-16 rounded-lg border border-border/25 bg-background/40 p-1.5 text-center text-xs outline-none focus:border-primary/40"
                    />
                    <button
                      disabled={busy}
                      aria-label="move up"
                      onClick={() =>
                        void guard("could not reorder", () =>
                          saveOrder(navigation, navItem.id, Math.max(0, navItem.position - 1)),
                        )
                      }
                      className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40"
                    >
                      move up
                    </button>
                    <button
                      disabled={busy}
                      aria-label="move down"
                      onClick={() => void guard("could not reorder", () => saveOrder(navigation, navItem.id, navItem.position + 1))}
                      className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40"
                    >
                      move down
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void guard("could not move it", () =>
                          setNavigationSection(navItem.id, navItem.section === "installed" ? "shared" : "installed"),
                        )
                      }
                      className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40"
                    >
                      move to {navItem.section === "installed" ? "shared with you" : "your apps"}
                    </button>
                  </div>
                </div>
              )}
              <dl className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>address</dt>
                  <dd className="text-foreground/80">{appRoute(artifact.id)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>identity</dt>
                  <dd className="truncate text-foreground/80">{artifact.id}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>installation</dt>
                  <dd className="truncate text-foreground/80">{installation?.id ?? "not installed"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>runtime</dt>
                  <dd className="text-foreground/80">{provider.label}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>last error</dt>
                  <dd className="text-foreground/80">{lastError ? lastError.message : "none this session"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>data</dt>
                  <dd className="text-foreground/80">only its own rows</dd>
                </div>
              </dl>
            </section>

            <section className={`${card} p-5`}>
              <h2 className="mb-3 text-sm tracking-wide text-foreground">updates</h2>
              <ArtifactUpdatePane
                artifact={artifact}
                installation={installation}
                versions={versions}
                onChanged={refresh}
              />
            </section>

            <section className={`${card} p-5`}>
              <h2 className="mb-3 flex items-center gap-2 text-sm tracking-wide text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> permissions and integrations
              </h2>
              <ul className="space-y-1 text-[11px] text-foreground/80">
                {(installation?.permissionGrants.granted ?? []).length === 0 ? (
                  <li>nothing granted — least privilege</li>
                ) : (
                  installation!.permissionGrants.granted.map((g) => <li key={g}>{g}</li>)
                )}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {artifact.integrationManifest.length
                  ? `${artifact.integrationManifest.length} integration(s) declared`
                  : "no integrations"}
                . a new capability in a later update has to be approved by you before it applies.
              </p>
              <div className="mt-4 border-t border-border/20 pt-4">
                <h3 className="mb-2 text-[11px] text-muted-foreground">outside services this app may use</h3>
                <ArtifactIntegrationsPane
                  artifactId={artifact.id}
                  artifactName={artifact.displayName}
                  installationId={installation?.id ?? null}
                />
              </div>
              <h3 className="mt-4 text-[11px] text-muted-foreground">recent activity</h3>
              <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                {events.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    {e.type} · {e.result} · {new Date(e.createdAt).toLocaleString()}
                  </li>
                ))}
                {events.length === 0 && <li>nothing recorded yet</li>}
              </ul>
            </section>

            <section className={`${card} p-5 lg:col-span-2`}>
              <h2 className="mb-3 flex items-center gap-2 text-sm tracking-wide text-foreground">
                <Activity className="h-3.5 w-3.5" /> removing this app
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(REMOVAL_SEMANTICS) as RemovalAction[]).map((a) => {
                  const s = REMOVAL_SEMANTICS[a];
                  const disabled =
                    busy ||
                    (a === "remove_from_dashboard" && !navItem) ||
                    ((a === "disable" || a === "uninstall") && !installation);
                  const label = a === "disable" && installation && !installation.enabled ? "enable" : s.label;
                  return (
                    <button
                      key={a}
                      disabled={disabled}
                      onClick={() => (s.requiresTypedConfirmation ? setConfirmAction(a) : void runRemoval(a))}
                      className={`rounded-lg border p-3 text-left text-[11px] disabled:opacity-40 ${
                        s.destructive
                          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                          : "border-border/25 text-foreground/80 hover:bg-card/40"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {s.destructive && <Trash2 className="h-3 w-3" />} {label}
                      </span>
                      <span className="mt-1 block text-muted-foreground">{s.consequence}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {semantics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" role="dialog" aria-modal="true">
          <div className={`${card} w-full max-w-md bg-background/95 p-5`}>
            <h3 className="text-sm text-destructive">{semantics.label}</h3>
            <p className="mt-2 text-xs text-muted-foreground">{semantics.consequence}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              type <span className="text-foreground">delete</span> to confirm.
            </p>
            <input
              value={confirmText}
              aria-label="type delete to confirm"
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none focus:border-destructive/50"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmAction(null);
                  setConfirmText("");
                }}
                className="rounded-lg border border-border/25 px-3 py-1.5 text-xs hover:bg-card/40"
              >
                cancel
              </button>
              <button
                disabled={confirmText.trim().toLowerCase() !== "delete" || busy}
                onClick={() => void runRemoval(semantics.action)}
                className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive disabled:opacity-40 hover:bg-destructive/10"
              >
                {busy ? "working…" : semantics.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstalledAppHost;

/** Re-exported so the sidebar can reorder without importing the store twice. */
export async function saveOrder(items: Parameters<typeof persistNavigationOrder>[0], id: string, toIndex: number) {
  await persistNavigationOrder(reorder(items, id, toIndex));
}

/** Installing again after an uninstall keeps the artifact and its data. */
export const reinstall = installArtifact;
