// The artifact's history: what was captured, when, by whom, and how it ended.
//
// A restore never erases anything. It writes the old state forward as a new
// version, so the path back is always visible.

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ArtifactEvent, SoftwareVersion } from "@/lib/software/types";
import DiffView from "./DiffView";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

function filesOf(version: SoftwareVersion): Array<{ path: string; content: string }> {
  const raw = (version.sourceRef as { files?: unknown }).files;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is { path: string; content?: string } => !!f && typeof (f as { path?: unknown }).path === "string")
    .map((f) => ({ path: f.path, content: String(f.content ?? "") }));
}

const ArtifactHistoryPane = ({
  versions,
  currentVersionId,
  events,
  busy,
  canWrite,
  onCheckpoint,
  onRestore,
}: {
  versions: SoftwareVersion[];
  currentVersionId: string | null;
  events: ArtifactEvent[];
  busy: boolean;
  canWrite: boolean;
  onCheckpoint: () => void;
  onRestore: (version: SoftwareVersion) => void;
}) => {
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);

  const comparison = useMemo(() => {
    const a = versions.find((v) => v.id === left);
    const b = versions.find((v) => v.id === right);
    if (!a || !b) return null;
    const fa = new Map(filesOf(a).map((f) => [f.path, f.content]));
    const fb = new Map(filesOf(b).map((f) => [f.path, f.content]));
    const paths = [...new Set([...fa.keys(), ...fb.keys()])].sort();
    return {
      a,
      b,
      files: paths
        .map((p) => ({ path: p, before: fa.get(p) ?? "", after: fb.get(p) ?? "" }))
        .filter((f) => f.before !== f.after),
    };
  }, [left, right, versions]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm tracking-wide text-foreground">versions</h2>
          <div className="flex-1" />
          {canWrite && (
            <button
              disabled={busy}
              onClick={onCheckpoint}
              className="rounded-lg border border-border/30 px-3 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
            >
              save a checkpoint
            </button>
          )}
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            no versions yet — a checkpoint captures the files exactly as they stand.
          </p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="rounded-lg border border-border/15 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground">
                      v{v.displayVersion}
                      {v.id === currentVersionId && <span className="ml-2 text-primary">current</span>}
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {v.changeSummary ?? "no summary"} · {v.validationStatus} · {v.releaseStatus} ·{" "}
                      {filesOf(v).length} file(s)
                    </p>
                  </div>
                  {canWrite && v.rollbackEligible && v.id !== currentVersionId && (
                    <button
                      disabled={busy}
                      onClick={() => onRestore(v)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/30 px-2 py-1 text-[11px] hover:bg-card/40"
                    >
                      <RotateCcw className="h-3 w-3" /> restore
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                  <button
                    onClick={() => setLeft(v.id)}
                    className={left === v.id ? "text-primary" : "hover:text-foreground"}
                  >
                    compare from
                  </button>
                  <button
                    onClick={() => setRight(v.id)}
                    className={right === v.id ? "text-primary" : "hover:text-foreground"}
                  >
                    compare to
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {comparison && (
          <div className="mt-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              v{comparison.a.displayVersion} → v{comparison.b.displayVersion}
              {comparison.files.length === 0 && " — no file differences were captured between these two"}
            </p>
            {comparison.files.map((f) => (
              <DiffView key={f.path} before={f.before} after={f.after} label={f.path} maxHeight={220} />
            ))}
          </div>
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
  );
};

export default ArtifactHistoryPane;
