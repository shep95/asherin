// the artifact, actually running.
//
// It executes in a cross-origin frame with scripts only: no access to your
// session, no package installation, no network by default. When it cannot run,
// this pane says why and shows nothing rather than a convincing empty box.

import { Play, RotateCcw, Square } from "lucide-react";
import { SANDBOX_ATTR, SANDBOX_LIMITS } from "@/lib/software/preview";
import type { ArtifactSandbox } from "@/hooks/useArtifactSandbox";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const ArtifactPreviewPane = ({ sandbox }: { sandbox: ArtifactSandbox }) => {
  const { build, observations, running, runKey, frameRef, start, stop } = sandbox;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center gap-2 border-b border-border/15 px-4 py-2.5">
          <h2 className="text-sm tracking-wide text-foreground">preview</h2>
          <div className="flex-1" />
          {running ? (
            <>
              <button onClick={start} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> restart
              </button>
              <button onClick={stop} className="ml-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
                <Square className="h-3.5 w-3.5" /> stop
              </button>
            </>
          ) : (
            <button
              onClick={start}
              disabled={!build.ok}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-[11px] text-primary disabled:border-border/30 disabled:text-muted-foreground hover:bg-primary/10"
            >
              <Play className="h-3.5 w-3.5" /> run
            </button>
          )}
        </div>

        {!build.ok ? (
          <div className="space-y-2 p-5">
            <p className="text-xs text-muted-foreground">runtime unavailable — {build.unavailableReason}</p>
            {build.refusedDependencies.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                refused imports: {build.refusedDependencies.join(", ")}
              </p>
            )}
          </div>
        ) : running ? (
          <iframe
            key={runKey}
            ref={frameRef}
            title="artifact preview"
            sandbox={SANDBOX_ATTR}
            srcDoc={build.srcDoc}
            className="h-[460px] w-full bg-black"
          />
        ) : (
          <div className="p-5 text-xs text-muted-foreground">not running. press run to execute this artifact.</div>
        )}
      </section>

      <section className={`${card} p-4`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">what it reported</h2>
        {observations.length === 0 ? (
          <p className="text-xs text-muted-foreground">nothing observed yet.</p>
        ) : (
          <ul className="max-h-[380px] space-y-1 overflow-y-auto">
            {observations.map((o, i) => (
              <li
                key={`${o.at}-${i}`}
                className={`text-[11px] leading-relaxed ${
                  o.level === "error" ? "text-destructive/90" : o.level === "warn" ? "text-amber-400/90" : "text-muted-foreground"
                }`}
              >
                <span className="text-foreground/60">{o.channel}</span> · {o.message}
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-4 space-y-1 border-t border-border/15 pt-3 text-[10px] text-muted-foreground">
          {SANDBOX_LIMITS.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ArtifactPreviewPane;
