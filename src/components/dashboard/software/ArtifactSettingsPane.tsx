// What this artifact is, and what it is allowed to do.
//
// Identity is the id and never the name. Permissions are least privilege and a
// grant is explicit. Anything not enforceable yet is stated as unavailable
// rather than displayed as a switch that does nothing.

import { useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import type {
  ArtifactType,
  ArtifactVisibility,
  Installation,
  SoftwareArtifact,
  SoftwareVersion,
} from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const VISIBILITIES: ArtifactVisibility[] = ["private", "shared", "unlisted", "public"];

const ArtifactSettingsPane = ({
  artifact,
  currentVersion,
  installation,
  busy,
  canWrite,
  isOwner,
  onSaveDetails,
  onInstall,
  onToggleInstall,
  onUninstall,
  onDelete,
}: {
  artifact: SoftwareArtifact;
  currentVersion: SoftwareVersion | null;
  installation: Installation | null;
  busy: boolean;
  canWrite: boolean;
  isOwner: boolean;
  onSaveDetails: (patch: { description: string | null; icon: string | null; visibility: ArtifactVisibility }) => void;
  onInstall: () => void;
  onToggleInstall: () => void;
  onUninstall: () => void;
  onDelete: () => void;
}) => {
  const [description, setDescription] = useState(artifact.description ?? "");
  const [icon, setIcon] = useState(artifact.icon ?? "");
  const [visibility, setVisibility] = useState<ArtifactVisibility>(artifact.visibility);

  const dirty =
    description !== (artifact.description ?? "") || icon !== (artifact.icon ?? "") || visibility !== artifact.visibility;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="mb-3 text-sm tracking-wide text-foreground">details</h2>
        <label className="block text-[11px] text-muted-foreground">
          description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={!canWrite}
            className="mt-1 w-full resize-none rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
          />
        </label>
        <label className="mt-3 block text-[11px] text-muted-foreground">
          icon (a single character or short symbol)
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 4))}
            disabled={!canWrite}
            className="mt-1 w-24 rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
          />
        </label>
        <label className="mt-3 block text-[11px] text-muted-foreground">
          visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ArtifactVisibility)}
            disabled={!canWrite}
            className="mt-1 block rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none disabled:opacity-50"
          >
            {VISIBILITIES.map((v) => (
              <option key={v} value={v} className="bg-background">
                {v}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[11px] text-muted-foreground">
          sharing, publishing and downloads are not implemented yet — visibility records intent only.
        </p>
        {canWrite && dirty && (
          <button
            disabled={busy}
            onClick={() => onSaveDetails({ description: description || null, icon: icon || null, visibility })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/30 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-card/40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} save details
          </button>
        )}

        <dl className="mt-5 space-y-1 text-[11px] text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>type</dt>
            <dd className="text-foreground/80">{artifact.type satisfies ArtifactType}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>current version</dt>
            <dd className="text-foreground/80">{currentVersion ? `v${currentVersion.displayVersion}` : "none yet"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>lifecycle</dt>
            <dd className="text-foreground/80">{artifact.lifecycle}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>dependencies declared</dt>
            <dd className="text-foreground/80">{artifact.dependencyManifest.length}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>integrations declared</dt>
            <dd className="text-foreground/80">{artifact.integrationManifest.length}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>created</dt>
            <dd className="text-foreground/80">{new Date(artifact.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          identity {artifact.id} · renaming changes the label only, never this id, its route, its permissions or its
          history
        </p>
      </section>

      <div className="space-y-4">
        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-sm tracking-wide text-foreground">permissions</h2>
          <p className="mb-2 text-xs text-muted-foreground">least privilege by default. a grant is always explicit.</p>
          <ul className="space-y-1 text-[11px]">
            {artifact.permissionManifest.granted.map((g) => (
              <li key={g} className="flex items-center gap-2 text-foreground/80">
                <Check className="h-3 w-3 text-primary" /> {g}
                {artifact.permissionManifest.rationale?.[g] && (
                  <span className="text-muted-foreground">— {artifact.permissionManifest.rationale[g]}</span>
                )}
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
                  onClick={onToggleInstall}
                  className="rounded-lg border border-border/30 px-3 py-1.5 text-xs hover:bg-card/40"
                >
                  {installation.enabled ? "disable" : "enable"}
                </button>
                <button
                  disabled={busy}
                  onClick={onUninstall}
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
                disabled={busy || !isOwner}
                onClick={onInstall}
                className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary disabled:opacity-40 hover:bg-primary/10"
              >
                install and add to my sidebar
              </button>
            </div>
          )}

          {isOwner && (
            <button
              disabled={busy}
              onClick={onDelete}
              className="mt-6 inline-flex items-center gap-2 text-[11px] text-destructive/80 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> delete this artifact and everything under it
            </button>
          )}
        </section>
      </div>
    </div>
  );
};

export default ArtifactSettingsPane;
