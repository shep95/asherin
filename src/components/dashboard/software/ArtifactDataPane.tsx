// Data that belongs to this artifact — and only this artifact.
//
// An artifact never sees your account's data. What it has is what it declared
// in its data manifest and what its own runs recorded. When it has neither,
// this pane says so plainly instead of drawing an empty table.

import type { ArtifactRun, SoftwareArtifact } from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const ArtifactDataPane = ({ artifact, runs }: { artifact: SoftwareArtifact; runs: ArtifactRun[] }) => {
  const declared = Object.entries(artifact.dataManifest ?? {});
  const storageGranted = artifact.permissionManifest.granted.includes("artifact_storage");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">declared data</h2>
        {declared.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            this artifact declares no data of its own. it cannot read your account data — that boundary is not a
            setting.
          </p>
        ) : (
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {declared.map(([k, v]) => (
              <li key={k}>
                <span className="text-foreground/80">{k}</span>: {typeof v === "string" ? v : JSON.stringify(v)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          artifact-owned storage is {storageGranted ? "granted but not provisioned yet" : "not granted"}; the sandbox
          keeps nothing between runs.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">data this artifact produced</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">no runs have recorded anything yet.</p>
        ) : (
          <ul className="space-y-1.5 text-[11px]">
            {runs.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3">
                <span className="text-foreground/80">
                  {r.status} · {r.results.length} check result(s) · {r.observations.length} observation(s)
                </span>
                <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ArtifactDataPane;
