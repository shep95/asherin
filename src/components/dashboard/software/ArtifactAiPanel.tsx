// Asherin, working on this artifact.
//
// The model is told about the artifact it is in, not about everything you own:
// the manifest, the files that look relevant, what you have selected and what
// the artifact last reported. It proposes a change first — files, reason,
// expected behaviour — and writes nothing until that proposal is accepted.
//
// If a file moved under the proposal, that file is a conflict and stays yours.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Send, X } from "lucide-react";
import { callAsherCodeAi, extractJsonBlock, type EditPlan } from "@/lib/asherCode/aiClient";
import {
  detectConflicts,
  selectContextFiles,
  snapshot,
  type ProposedChange,
} from "@/lib/software/workspace";
import { diffStats, mergeText } from "@/lib/software/patch";
import { recordAction } from "@/lib/software/actions";
import { useAuth } from "@/contexts/AuthContext";
import type { SoftwareArtifact } from "@/lib/software/types";
import type { SoftwareWorkspace } from "@/hooks/useSoftwareWorkspace";
import DiffView from "./DiffView";

interface Proposal {
  intent: string;
  summary: string;
  changes: ProposedChange[];
  omitted: string[];
}

const ArtifactAiPanel = ({
  artifact,
  ws,
  canWrite,
  implicated,
  onApplied,
}: {
  artifact: SoftwareArtifact;
  ws: SoftwareWorkspace;
  canWrite: boolean;
  /** paths named by current errors or failed checks. */
  implicated: string[];
  onApplied: (paths: string[]) => void;
}) => {
  const [instruction, setInstruction] = useState("");
  const [thinking, setThinking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [choices, setChoices] = useState<Record<string, "apply" | "keep" | "merge">>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const { user } = useAuth();

  const errors = useMemo(
    () => ws.log.filter((l) => l.level === "error").slice(-5).map((l) => l.message),
    [ws.log],
  );

  const plan = async () => {
    const text = instruction.trim();
    if (!text) return;
    setThinking(true);
    setFailure(null);
    setProposal(null);
    try {
      const context = selectContextFiles({
        instruction: text,
        files: ws.workingFiles,
        pinned: [ws.activePath, ws.selection?.path].filter((p): p is string => !!p),
        implicated,
      });

      const brief = [
        `artifact: ${artifact.displayName} (${artifact.type}, lifecycle ${artifact.lifecycle})`,
        artifact.description ? `description: ${artifact.description}` : null,
        `granted capabilities: ${artifact.permissionManifest.granted.join(", ") || "ui only"}`,
        `runtime: a cross-origin browser sandbox — no network, no package installation, no server`,
        ws.selection ? `the person has selected this in ${ws.selection.path}:\n${ws.selection.text}` : null,
        errors.length ? `recently reported problems:\n- ${errors.join("\n- ")}` : null,
        context.omitted.length ? `files not shown to you: ${context.omitted.join(", ")}` : null,
        `change the existing artifact. do not restart it as a new project.`,
        `instruction: ${text}`,
      ]
        .filter(Boolean)
        .join("\n");

      const base = snapshot(ws.workingFiles);
      const baseContent = Object.fromEntries(ws.workingFiles.map((f) => [f.path, f.content]));

      const result = await callAsherCodeAi({
        mode: "edit_plan",
        instruction: brief,
        contextFiles: context.files,
      });
      const parsed = extractJsonBlock<EditPlan>(result.reply ?? "");
      if (!parsed || !Array.isArray(parsed.edits) || parsed.edits.length === 0) {
        setFailure("the model did not return a change plan for this request — try describing the change more concretely.");
        return;
      }

      const changes = detectConflicts({ edits: parsed.edits, base, baseContent, current: ws.workingFiles });
      setProposal({ intent: text, summary: parsed.summary ?? "", changes, omitted: context.omitted });
      setChoices(
        Object.fromEntries(changes.map((c) => [c.path, c.status === "conflict" ? "keep" : "apply"] as const)),
      );
      ws.note({ channel: "ai", level: "info", message: `proposed changes to ${changes.map((c) => c.path).join(", ")}` });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "the model could not be reached");
    } finally {
      setThinking(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    const accepted = proposal.changes.filter(
      (c) => (choices[c.path] === "apply" || choices[c.path] === "merge") && c.status !== "identical",
    );
    if (accepted.length === 0) return;
    setApplying(true);
    try {
      let conflictLines = 0;
      const writes = accepted.map((c) => {
        if (choices[c.path] !== "merge") return { path: c.path, content: c.proposedContent };
        const merged = mergeText(c.baseContent, c.currentContent, c.proposedContent);
        conflictLines += merged.conflictLines;
        return { path: c.path, content: merged.text ?? c.currentContent };
      });
      await ws.applyAiContent(writes);
      if (user) {
        await Promise.all(
          accepted.map((c) =>
            recordAction({
              action: c.status === "new" ? "create_file" : "edit_file",
              actor: "ai",
              artifactId: artifact.id,
              actorUserId: user.id,
              target: c.path,
              detail: { resolution: choices[c.path], ...diffStats(c.currentContent, c.proposedContent) },
            }).catch(() => undefined),
          ),
        );
      }
      if (conflictLines > 0) {
        ws.note({
          channel: "ai",
          level: "warn",
          message: `${conflictLines} line(s) could not be merged automatically and are marked in the file`,
        });
      }
      onApplied(accepted.map((c) => c.path));
      setProposal(null);
      setInstruction("");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "the change could not be written");
    } finally {
      setApplying(false);
    }
  };

  const conflicts = proposal?.changes.filter((c) => c.status === "conflict") ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/15 px-3 py-2">
        <h2 className="text-xs tracking-wide text-foreground">asherin</h2>
        <p className="text-[11px] text-muted-foreground">
          working on this artifact — {ws.files.length} file(s), {artifact.type}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {failure && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive/90">
            {failure}
          </div>
        )}

        {!proposal && !thinking && (
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <p>describe the change you want. examples:</p>
            <ul className="space-y-1">
              {["add a settings screen", "make the layout work on a phone", "fix the error in the table"].map((s) => (
                <li key={s}>
                  <button onClick={() => setInstruction(s)} className="text-left hover:text-foreground">
                    “{s}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {thinking && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> planning the change…
          </p>
        )}

        {proposal && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/20 p-3">
              <p className="text-[11px] text-foreground/90">{proposal.summary || proposal.intent}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {proposal.changes.length} file(s) affected · nothing is written until you accept
              </p>
              {proposal.omitted.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  not shown to the model: {proposal.omitted.length} file(s)
                </p>
              )}
            </div>

            {conflicts.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {conflicts.length} file(s) changed after this plan was made. your edits are kept unless you choose
                  otherwise.
                </span>
              </div>
            )}

            <ul className="space-y-2">
              {proposal.changes.map((c) => (
                <li key={c.path} className="rounded-lg border border-border/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/90">{c.path}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        c.status === "conflict"
                          ? "border-amber-500/40 text-amber-200/90"
                          : c.status === "new"
                            ? "border-emerald-500/40 text-emerald-200/90"
                            : "border-border/30 text-muted-foreground"
                      }`}
                    >
                      {c.status === "conflict" ? "changed since the plan" : c.status}
                    </span>
                  </div>
                  {c.rationale && <p className="mt-1 text-[11px] text-muted-foreground">{c.rationale}</p>}
                  {(() => {
                    const st = diffStats(c.currentContent, c.proposedContent);
                    return (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        +{st.additions} / −{st.removals} line{st.additions + st.removals === 1 ? "" : "s"}
                      </p>
                    );
                  })()}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <button
                      onClick={() => setExpanded(expanded === c.path ? null : c.path)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {expanded === c.path ? "hide comparison" : "compare"}
                    </button>
                    {c.status !== "identical" && (
                      <>
                        <button
                          onClick={() => setChoices((p) => ({ ...p, [c.path]: "keep" }))}
                          className={`rounded border px-2 py-0.5 ${
                            choices[c.path] === "keep" ? "border-primary/50 text-primary" : "border-border/30 text-muted-foreground"
                          }`}
                        >
                          keep mine
                        </button>
                        <button
                          onClick={() => setChoices((p) => ({ ...p, [c.path]: "apply" }))}
                          className={`rounded border px-2 py-0.5 ${
                            choices[c.path] === "apply" ? "border-primary/50 text-primary" : "border-border/30 text-muted-foreground"
                          }`}
                        >
                          apply this
                        </button>
                        {c.status === "conflict" && (
                          <button
                            onClick={() => setChoices((p) => ({ ...p, [c.path]: "merge" }))}
                            className={`rounded border px-2 py-0.5 ${
                              choices[c.path] === "merge" ? "border-primary/50 text-primary" : "border-border/30 text-muted-foreground"
                            }`}
                          >
                            merge
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {expanded === c.path && (
                    <div className="mt-2">
                      <DiffView
                        before={c.currentContent}
                        after={c.proposedContent}
                        label={`${c.path} — yours vs proposed`}
                        maxHeight={220}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void apply()}
                disabled={!canWrite || applying || !Object.values(choices).includes("apply")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-[11px] text-primary disabled:opacity-40 hover:bg-primary/10"
              >
                {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} apply
                accepted changes
              </button>
              <button
                onClick={() => setProposal(null)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> discard proposal
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/15 p-2">
        {ws.selection && (
          <p className="mb-1 truncate text-[10px] text-muted-foreground">
            including your selection in {ws.selection.path}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void plan();
            }}
            rows={2}
            placeholder={canWrite ? "what should change?" : "you have read-only access to this artifact"}
            aria-label="describe the change you want"
            disabled={!canWrite}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-border/25 bg-background/40 p-2 text-[11px] text-foreground outline-none focus:border-primary/40 disabled:opacity-50"
          />
          <button
            onClick={() => void plan()}
            disabled={!canWrite || thinking || !instruction.trim()}
            aria-label="plan this change"
            className="rounded-lg border border-border/30 p-2 text-muted-foreground disabled:opacity-40 hover:text-foreground"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArtifactAiPanel;
