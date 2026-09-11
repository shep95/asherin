// What actually happened, in order.
//
// Two sources only: what the running artifact reported to us, and what the
// workspace itself did. Nothing is inferred. When a channel could not observe
// anything, it says so rather than showing an empty success.

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { RunObservation } from "@/lib/software/types";
import type { WorkspaceLogEntry } from "@/hooks/useSoftwareWorkspace";

export interface ConsoleLine {
  key: string;
  source: "artifact" | "workspace";
  channel: string;
  level: "info" | "warn" | "error";
  message: string;
  at: string;
}

export function mergeConsole(observations: RunObservation[], log: WorkspaceLogEntry[]): ConsoleLine[] {
  const a: ConsoleLine[] = observations.map((o, i) => ({
    key: `o${i}-${o.at}`,
    source: "artifact",
    channel: o.channel,
    level: o.level,
    message: o.message,
    at: o.at,
  }));
  const b: ConsoleLine[] = log.map((l) => ({
    key: l.id,
    source: "workspace",
    channel: l.channel,
    level: l.level,
    message: l.message,
    at: l.at,
  }));
  return [...a, ...b].sort((x, y) => x.at.localeCompare(y.at));
}

const ArtifactConsole = ({
  lines,
  open,
  onToggle,
  onClear,
  running,
}: {
  lines: ConsoleLine[];
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  running: boolean;
}) => {
  const errors = lines.filter((l) => l.level === "error").length;

  return (
    <div className="border-t border-border/15 bg-card/10">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />} console
        </button>
        <span className="text-[11px] text-muted-foreground">{lines.length} entries</span>
        {errors > 0 && <span className="text-[11px] text-destructive/90">{errors} error(s)</span>}
        {!running && (
          <span className="text-[11px] text-muted-foreground">
            artifact not running — nothing is being observed from it right now
          </span>
        )}
        <div className="flex-1" />
        <button onClick={onClear} aria-label="clear the console" className="text-muted-foreground hover:text-foreground">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {open && (
        <div className="max-h-52 overflow-y-auto border-t border-border/10 px-3 py-2 font-mono text-[11px]">
          {lines.length === 0 ? (
            <p className="text-muted-foreground">nothing observed yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {lines.map((l) => (
                <li
                  key={l.key}
                  className={
                    l.level === "error"
                      ? "text-destructive/90"
                      : l.level === "warn"
                        ? "text-amber-300/90"
                        : "text-muted-foreground"
                  }
                >
                  <span className="text-muted-foreground/50">{new Date(l.at).toLocaleTimeString()} </span>
                  <span className="text-foreground/60">
                    [{l.source === "artifact" ? "artifact" : "workspace"}·{l.channel}]{" "}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactConsole;
