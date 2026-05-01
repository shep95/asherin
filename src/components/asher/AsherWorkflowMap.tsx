// ─── ASHER IDE · WORKFLOW MAP ──────────────────────────────────────────
// A live "work tree" diagram for the Asher IDE swarm:
//   • LIVE AGENTS         — every currently-running per-file agent
//   • FILE WORKFLOW TREE  — every file the swarm has ever touched, grouped
//                           by directory, with success/fail badges and the
//                           number of fix attempts per file
//   • TIMELINE            — chronological event log (spawn / done / failed /
//                           pass start) so the user can replay the run
//
// All rendering is presentational. State is owned by AsherCodeModule and
// passed in as props — this component never mutates anything.

import { useMemo } from "react";
import { Loader2, X, GitBranch, Activity, ListTree, Clock } from "lucide-react";

export type SwarmAgent = {
  id: string;
  file: string;
  issueCount: number;
  pass: number;
  status: "working" | "done" | "failed";
};

export type WorkflowEvent = {
  id: string;
  ts: number;
  kind: "pass" | "spawn" | "done" | "failed";
  file?: string;
  pass?: number;
  issueCount?: number;
};

export type FileWorkflowStat = {
  path: string;
  attempts: number;
  successes: number;
  failures: number;
  lastStatus: "working" | "done" | "failed";
  lastTs: number;
};

interface Props {
  liveAgents: SwarmAgent[];
  events: WorkflowEvent[];
  fileStats: FileWorkflowStat[];
}

function timeAgo(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  if (d < 1000) return "now";
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

function groupByDir(stats: FileWorkflowStat[]) {
  const tree: Record<string, FileWorkflowStat[]> = {};
  for (const s of stats) {
    const parts = s.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
    (tree[dir] ||= []).push(s);
  }
  return Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));
}

const AsherWorkflowMap = ({ liveAgents, events, fileStats }: Props) => {
  const tree = useMemo(() => groupByDir(fileStats), [fileStats]);
  const recentEvents = useMemo(() => events.slice(-200).reverse(), [events]);
  const working = liveAgents.filter(a => a.status === "working").length;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-card/10 to-background/40">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/15">
        <GitBranch className="h-3.5 w-3.5 text-foreground/70" />
        <h2 className="text-[11px] font-light tracking-[0.3em] uppercase text-foreground/85">
          Workflow Map
        </h2>
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/60">
          {working} live · {liveAgents.length} swarm · {fileStats.length} files · {events.length} events
        </span>
      </div>

      {/* ─── LIVE AGENTS ─── */}
      <section className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/15">
          <Activity className="h-3 w-3 text-foreground/70" />
          <span className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground/80">
            Live Agents
          </span>
          {working > 0 && (
            <span className="relative flex h-1.5 w-1.5 ml-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
            </span>
          )}
        </div>
        <div className="p-3">
          {liveAgents.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 italic">
              No agents running. The swarm spawns one agent per broken file when Auto-Debug fires.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {liveAgents.map(a => (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[10px] font-mono transition-opacity ${
                    a.status === "working"
                      ? "bg-card/60 border-border/30 text-foreground/85"
                      : a.status === "done"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300/90 opacity-75"
                      : "bg-destructive/10 border-destructive/30 text-destructive/90 opacity-75"
                  }`}
                >
                  {a.status === "working" ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  ) : a.status === "done" ? (
                    <span className="text-[11px] leading-none">◉</span>
                  ) : (
                    <X className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate flex-1" title={a.file}>{a.file}</span>
                  <span className="opacity-50 shrink-0">p{a.pass}</span>
                  <span className="opacity-50 shrink-0">· {a.issueCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── FILE WORKFLOW TREE ─── */}
      <section className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/15">
          <ListTree className="h-3 w-3 text-foreground/70" />
          <span className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground/80">
            File Workflow Tree
          </span>
        </div>
        <div className="p-3 space-y-3">
          {tree.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 italic">
              No files have been worked on yet.
            </p>
          ) : (
            tree.map(([dir, files]) => (
              <div key={dir}>
                <div className="text-[9px] font-mono text-muted-foreground/60 mb-1 tracking-wider">
                  ◇ {dir}
                </div>
                <div className="ml-3 border-l border-border/20 pl-3 space-y-1">
                  {files
                    .sort((a, b) => b.lastTs - a.lastTs)
                    .map(f => {
                      const name = f.path.split("/").pop() || f.path;
                      return (
                        <div
                          key={f.path}
                          className="flex items-center gap-2 text-[10px] font-mono"
                          title={f.path}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                              f.lastStatus === "working"
                                ? "bg-foreground animate-pulse"
                                : f.lastStatus === "done"
                                ? "bg-emerald-400"
                                : "bg-destructive"
                            }`}
                          />
                          <span className="text-foreground/85 truncate flex-1">{name}</span>
                          <span className="text-muted-foreground/60 shrink-0">
                            {f.attempts}× · ◉{f.successes} · ✗{f.failures}
                          </span>
                          <span className="text-muted-foreground/40 shrink-0 w-[60px] text-right">
                            {timeAgo(f.lastTs)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ─── TIMELINE ─── */}
      <section className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/15">
          <Clock className="h-3 w-3 text-foreground/70" />
          <span className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground/80">
            Timeline
          </span>
          <span className="ml-auto text-[9px] font-mono text-muted-foreground/50">
            most recent first
          </span>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {recentEvents.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 italic p-3">
              Timeline empty. Events appear as agents spawn, finish, or fail.
            </p>
          ) : (
            <ol className="relative">
              {recentEvents.map((e) => {
                const tone =
                  e.kind === "done"
                    ? "text-emerald-300/85"
                    : e.kind === "failed"
                    ? "text-destructive/90"
                    : e.kind === "spawn"
                    ? "text-foreground/85"
                    : "text-muted-foreground/80";
                const dot =
                  e.kind === "done"
                    ? "bg-emerald-400"
                    : e.kind === "failed"
                    ? "bg-destructive"
                    : e.kind === "spawn"
                    ? "bg-foreground"
                    : "bg-muted-foreground/60";
                const label =
                  e.kind === "pass"
                    ? `Swarm pass ${e.pass} began`
                    : e.kind === "spawn"
                    ? `Spawned agent → ${e.file} (${e.issueCount} issue${e.issueCount === 1 ? "" : "s"})`
                    : e.kind === "done"
                    ? `Fixed → ${e.file}`
                    : `Failed → ${e.file}`;
                return (
                  <li
                    key={e.id}
                    className="flex items-start gap-2 px-3 py-1 border-b border-border/10 last:border-b-0"
                  >
                    <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className={`text-[10px] font-mono flex-1 ${tone}`}>{label}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">
                      {timeAgo(e.ts)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
};

export default AsherWorkflowMap;
