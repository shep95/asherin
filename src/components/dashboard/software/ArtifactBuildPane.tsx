// build mode — the default way to work on an artifact.
//
// It states what the runtime here can and cannot do, what the code reaches for
// that this runtime cannot supply, and whether the artifact is ready to be
// installed. Every line is derived from the artifact as it stands; none of it
// is a promise.

import { useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, Loader2, Sparkles, XCircle } from "lucide-react";
import { assessDependencies, detectDependencies } from "@/lib/software/dependencies";
import { preflight } from "@/lib/software/install";
import { providerForClass } from "@/lib/software/runtime";
import type { ArtifactFile, ArtifactRun, SoftwareArtifact, SoftwareVersion } from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const STATE_ICON = {
  pass: <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />,
  fail: <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/90" />,
  unavailable: <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" />,
} as const;

const ArtifactBuildPane = ({
  artifact,
  files,
  dirtyCount,
  versions,
  lastRun,
  busy,
  canWrite,
  onCheckpoint,
}: {
  artifact: SoftwareArtifact;
  files: ArtifactFile[];
  dirtyCount: number;
  versions: SoftwareVersion[];
  lastRun: ArtifactRun | null;
  busy: boolean;
  canWrite: boolean;
  onCheckpoint: (label: string) => void;
}) => {
  const [label, setLabel] = useState("");

  const provider = useMemo(() => providerForClass(artifact.runtimeType), [artifact.runtimeType]);
  const deps = useMemo(
    () => detectDependencies(files.map((f) => ({ path: f.path, content: f.content }))),
    [files],
  );
  const verdict = useMemo(
    () => assessDependencies(deps, artifact.permissionManifest.granted.includes("network")),
    [deps, artifact.permissionManifest.granted],
  );
  const report = useMemo(
    () => preflight({ artifact, files, lastRun, runtimeClass: artifact.runtimeType }),
    [artifact, files, lastRun],
  );

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <section className={`${card} p-5 lg:col-span-2`}>
        <h2 className="mb-1 flex items-center gap-2 text-sm tracking-wide text-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> build
        </h2>
        <p className="text-xs text-muted-foreground">
          describe what you want in the panel on the right. asherin reads this artifact — its files, what you have
          selected and what it last reported — and shows the change before writing anything.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <li>{files.length} file{files.length === 1 ? "" : "s"}</li>
          <li>{dirtyCount} unsaved</li>
          <li>{versions.length} version{versions.length === 1 ? "" : "s"}</li>
          <li>starting file: {artifact.entrypoint ?? files.find((f) => /^index\.html$/i.test(f.path))?.path ?? "none yet"}</li>
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">runtime</h2>
        <p className="text-xs">
          <span className={provider.availability === "available" ? "text-primary" : "text-amber-400/90"}>
            {provider.label}
          </span>
          <span className="ml-2 text-muted-foreground">{provider.availability.replace(/_/g, " ")}</span>
        </p>
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {provider.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">dependencies</h2>
        {deps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            this artifact reaches for nothing outside itself, so nothing has to be installed.
          </p>
        ) : (
          <>
            <ul className="space-y-1 text-[11px]">
              {deps.map((d) => (
                <li key={d.name} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-foreground/80">{d.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {d.source} · {d.declared ? "declared" : "undeclared"} · {d.securityStatus}
                  </span>
                </li>
              ))}
            </ul>
            {verdict.notes.map((n) => (
              <p key={n} className="mt-2 text-[11px] text-amber-400/90">
                {n}
              </p>
            ))}
          </>
        )}
      </section>

      <section className={`${card} p-5 lg:col-span-2`}>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-sm tracking-wide text-foreground">installation preflight</h2>
          <span className={`text-[11px] ${report.eligible ? "text-primary" : "text-muted-foreground"}`}>
            {report.summary}
          </span>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {report.items.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-[11px]">
              {STATE_ICON[i.state]}
              <span>
                <span className="text-foreground/80">{i.label}</span>
                <span className="text-muted-foreground"> — {i.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {canWrite && (
        <section className={`${card} p-5 lg:col-span-2`}>
          <h2 className="mb-2 text-sm tracking-wide text-foreground">checkpoint</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">
            a checkpoint keeps the files exactly as they are now under a name you will recognise later. it cannot be
            edited afterwards.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="working login"
              aria-label="checkpoint name"
              className="min-w-[12rem] flex-1 rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
            />
            <button
              disabled={busy || !label.trim()}
              onClick={() => {
                onCheckpoint(label.trim());
                setLabel("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-[11px] text-primary disabled:border-border/30 disabled:text-muted-foreground hover:bg-primary/10"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} save checkpoint
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default ArtifactBuildPane;
