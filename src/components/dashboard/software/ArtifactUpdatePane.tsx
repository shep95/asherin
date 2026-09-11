// Updates for an installed application.
//
// An installed app is not upgraded quietly. What changed, what it now asks for
// and whether it passed its checks are all shown first. Anything that widens
// access needs an explicit yes. Rolling back is a forward move — history stays.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listRuns } from "@/lib/software/files";
import { activateUpdate, planUpdate, rollbackInstallation, updateGate } from "@/lib/software/updates";
import type { ArtifactRun, Installation, SoftwareArtifact, SoftwareVersion } from "@/lib/software/types";

const chip = "rounded-lg border border-border/20 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground";

const ArtifactUpdatePane = ({
  artifact,
  installation,
  versions,
  onChanged,
}: {
  artifact: SoftwareArtifact;
  installation: Installation | null;
  versions: SoftwareVersion[];
  onChanged: () => void | Promise<void>;
}) => {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ArtifactRun[]>([]);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await listRuns(artifact.id, 20);
        if (alive) setRuns(r);
      } catch {
        if (alive) setRuns([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [artifact.id]);

  const installedVersion = useMemo(
    () => versions.find((v) => v.id === installation?.artifactVersionId) ?? null,
    [versions, installation?.artifactVersionId],
  );
  const candidate = versions[0] ?? null;

  const plan = useMemo(() => {
    if (!installation) return null;
    return planUpdate({ artifact, installation, installedVersion, candidateVersion: candidate });
  }, [artifact, installation, installedVersion, candidate]);

  const run = useMemo(
    () => runs.find((r) => candidate && r.versionId === candidate.id) ?? null,
    [runs, candidate],
  );

  const gate = plan ? updateGate({ plan, run, approved }) : { ok: false, reason: "this app is not installed" };

  const guard = useCallback(async (fallback: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!installation) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> checking for updates
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={chip}>installed: {installedVersion?.displayVersion ?? "unknown"}</span>
        <span className={chip}>newest: {candidate?.displayVersion ?? "none"}</span>
        <span className={chip}>{plan?.available ? "update available" : "up to date"}</span>
      </div>

      {plan?.available && (
        <>
          <p className="mb-3 text-muted-foreground">{plan.changelog}</p>

          <dl className="mb-3 grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">permissions added</dt>
              <dd className="text-foreground/80">{plan.permissions.added.join(", ") || "none"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">network hosts added</dt>
              <dd className="text-foreground/80">{plan.networkHosts.added.join(", ") || "none"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">integrations added</dt>
              <dd className="text-foreground/80">{plan.integrations.added.map((i) => i.provider).join(", ") || "none"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">dependencies added</dt>
              <dd className="text-foreground/80">{plan.dependencies.added.map((d) => d.name).join(", ") || "none"}</dd>
            </div>
          </dl>

          <p className="mb-3 text-muted-foreground">
            checks on the new version:{" "}
            {run ? run.status : "not run yet — the update cannot be activated until they run"}
          </p>

          {plan.requiresApproval && (
            <label className="mb-3 flex items-start gap-2 text-foreground/80">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5" />
              <span>
                approve the wider access this version asks for: {plan.escalations.join("; ")}
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !gate.ok || !candidate}
              title={gate.ok ? "" : gate.reason}
              onClick={() =>
                void guard("the update could not be activated", async () => {
                  await activateUpdate({
                    installation,
                    version: candidate!,
                    plan,
                    run,
                    approved,
                    actorUserId: user!.id,
                  });
                  await onChanged();
                  toast.success("updated — health is watched from here, and rollback stays available");
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-primary disabled:opacity-40 hover:bg-primary/10"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> update
            </button>
          </div>
          {!gate.ok && <p className="mt-2 text-[11px] text-amber-400/90">{gate.reason}</p>}
        </>
      )}

      <h3 className="mt-5 mb-2 tracking-wide text-foreground">roll back</h3>
      <ul className="space-y-1">
        {versions
          .filter((v) => v.id !== installation.artifactVersionId)
          .slice(0, 6)
          .map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/15 px-3 py-2">
              <span className="text-foreground/80">
                {v.displayVersion}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {v.rollbackEligible ? "eligible" : "not eligible for rollback"}
                </span>
              </span>
              <button
                disabled={busy || !v.rollbackEligible}
                onClick={() =>
                  void guard("rollback failed", async () => {
                    await rollbackInstallation({ installation, version: v, actorUserId: user!.id });
                    await onChanged();
                    toast.success("rolled back — every earlier version is still there");
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/25 px-2 py-1 text-[11px] text-foreground/80 disabled:opacity-40 hover:bg-foreground/5"
              >
                <RotateCcw className="h-3 w-3" /> roll back
              </button>
            </li>
          ))}
        {versions.length <= 1 && <li className="text-[11px] text-muted-foreground">there is only one version so far</li>}
      </ul>
    </div>
  );
};

export default ArtifactUpdatePane;
