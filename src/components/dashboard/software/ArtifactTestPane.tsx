// checks written by hand, run against the artifact as it really behaved.
//
// A run loads the artifact in the sandbox, waits for it to settle, asks it the
// questions the checks need answered, and records the outcome. A question the
// artifact never answered is recorded as inconclusive, never as a pass.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CHECK_KIND_LABEL, evaluateChecks, runStatus } from "@/lib/software/checks";
import { addCheck, deleteCheck, listChecks, listRuns, recordRun } from "@/lib/software/files";
import { SANDBOX_ATTR } from "@/lib/software/preview";
import type { ArtifactCheck, ArtifactCheckKind, ArtifactRun } from "@/lib/software/types";
import type { ArtifactSandbox } from "@/hooks/useArtifactSandbox";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";
const KINDS: ArtifactCheckKind[] = [
  "no_runtime_error",
  "no_console_error",
  "console_contains",
  "dom_selector_exists",
  "dom_text_contains",
];

const ArtifactTestPane = ({
  artifactId,
  versionId,
  sandbox,
  readOnly,
  onRuns,
}: {
  artifactId: string;
  versionId: string | null;
  sandbox: ArtifactSandbox;
  readOnly: boolean;
  /** lets the workspace see what failed, so repairs can be scoped to it. */
  onRuns?: (runs: ArtifactRun[]) => void;
}) => {
  const { user } = useAuth();
  const [checks, setChecks] = useState<ArtifactCheck[]>([]);
  const [runs, setRuns] = useState<ArtifactRun[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ArtifactCheckKind>("no_runtime_error");
  const [expectation, setExpectation] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([listChecks(artifactId), listRuns(artifactId)]);
    setChecks(c);
    setRuns(r);
    onRuns?.(r);
  }, [artifactId, onRuns]);

  useEffect(() => {
    void load();
  }, [load]);

  /** which checks a run covers: everything, only the last failures, or a pick. */
  const scope = useCallback(
    (which: "all" | "failed" | "selected"): ArtifactCheck[] => {
      if (which === "all") return checks;
      if (which === "selected") return checks.filter((c) => selected.includes(c.id));
      const lastFailed = new Set(
        (runs[0]?.results ?? []).filter((r) => r.status !== "passed").map((r) => r.checkId),
      );
      return checks.filter((c) => lastFailed.has(c.id));
    },
    [checks, runs, selected],
  );

  const run = async (which: "all" | "failed" | "selected" = "all") => {
    if (!user) return;
    const scoped = scope(which);
    setBusy(true);
    try {
      if (!sandbox.build.ok) {
        const recorded = await recordRun({
          artifactId,
          userId: user.id,
          versionId,
          status: "unavailable",
          results: [],
          observations: [],
          unavailableReason: sandbox.build.unavailableReason ?? "the artifact could not be prepared to run",
        });
        setRuns((prev) => {
          const next = [recorded, ...prev];
          onRuns?.(next);
          return next;
        });
        toast.error("could not run", { description: recorded.unavailableReason ?? undefined });
        return;
      }
      if (!scoped.length) {
        toast.error(which === "all" ? "add at least one check first" : "no checks match that selection");
        return;
      }
      sandbox.start();
      // let the frame load, execute and paint before it is questioned.
      await new Promise((r) => window.setTimeout(r, 1200));
      const probes = await sandbox.probe(scoped);
      const observations = sandbox.snapshot();
      const results = evaluateChecks(scoped, observations, probes);
      const recorded = await recordRun({
        artifactId,
        userId: user.id,
        versionId,
        status: runStatus(results),
        results,
        observations,
      });
      setRuns((prev) => {
        const next = [recorded, ...prev];
        onRuns?.(next);
        return next;
      });
      toast[recorded.status === "passed" ? "success" : "error"](`run ${recorded.status}`);
    } catch (e) {
      toast.error("the run failed", { description: e instanceof Error ? e.message : "unknown failure" });
    } finally {
      setBusy(false);
    }
  };

  const needsExpectation = kind !== "no_runtime_error" && kind !== "no_console_error";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* the frame the checks are answered by. hidden, but genuinely running. */}
      {sandbox.running && sandbox.build.ok && (
        <iframe
          key={sandbox.runKey}
          ref={sandbox.frameRef}
          title="artifact under test"
          sandbox={SANDBOX_ATTR}
          srcDoc={sandbox.build.srcDoc}
          className="h-0 w-0 border-0"
          aria-hidden
        />
      )}

      <section className={`${card} p-5`}>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm tracking-wide text-foreground">checks</h2>
          <div className="flex-1" />
          <button
            onClick={() => void run("failed")}
            disabled={busy || !runs[0]}
            className="rounded-lg border border-border/30 px-2.5 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
          >
            rerun failed
          </button>
          <button
            onClick={() => void run("selected")}
            disabled={busy || selected.length === 0}
            className="rounded-lg border border-border/30 px-2.5 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
          >
            run selected
          </button>
          <button
            onClick={() => void run("all")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-[11px] text-primary disabled:opacity-50 hover:bg-primary/10"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} run all
          </button>
        </div>


        {checks.length === 0 ? (
          <p className="text-xs text-muted-foreground">no checks yet — a run proves nothing until you state what should be true.</p>
        ) : (
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/15 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-foreground">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {CHECK_KIND_LABEL[c.kind]}
                    {c.expectation && ` — “${c.expectation}”`}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    aria-label={`delete check ${c.name}`}
                    onClick={async () => {
                      await deleteCheck(c.id);
                      await load();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="mt-4 space-y-2 border-t border-border/15 pt-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="what should be true"
              aria-label="check name"
              className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ArtifactCheckKind)}
              aria-label="check kind"
              className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {CHECK_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            {needsExpectation && (
              <input
                value={expectation}
                onChange={(e) => setExpectation(e.target.value)}
                placeholder={kind === "dom_selector_exists" ? "#root canvas" : "expected text"}
                aria-label="expected value"
                className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
              />
            )}
            <button
              disabled={!name.trim() || (needsExpectation && !expectation.trim()) || !user}
              onClick={async () => {
                await addCheck({ artifactId, userId: user!.id, name, kind, expectation });
                setName("");
                setExpectation("");
                await load();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
            >
              <Plus className="h-3.5 w-3.5" /> add check
            </button>
          </div>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-3 text-sm tracking-wide text-foreground">runs</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">nothing has been run yet.</p>
        ) : (
          <ul className="space-y-3">
            {runs.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/15 px-3 py-2">
                <p className="text-xs">
                  <span
                    className={
                      r.status === "passed" ? "text-primary" : r.status === "failed" ? "text-destructive/90" : "text-amber-400/90"
                    }
                  >
                    {r.status}
                  </span>
                  <span className="ml-2 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </p>
                {r.unavailableReason && <p className="mt-1 text-[11px] text-muted-foreground">{r.unavailableReason}</p>}
                <ul className="mt-1 space-y-0.5">
                  {r.results.map((res) => (
                    <li key={res.checkId} className="text-[11px] text-muted-foreground">
                      <span
                        className={
                          res.status === "passed"
                            ? "text-primary"
                            : res.status === "failed"
                              ? "text-destructive/90"
                              : "text-amber-400/90"
                        }
                      >
                        {res.status}
                      </span>{" "}
                      {res.name} — {res.detail}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ArtifactTestPane;
