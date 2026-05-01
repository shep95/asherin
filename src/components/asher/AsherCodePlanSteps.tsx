// ============================================================
// AsherCodePlanSteps — auto-approved todo / plan strip
// ------------------------------------------------------------
// On every new user message, Asher Code generates a small plan
// (3–6 atomic steps) derived from the user's prompt + routed
// goal intent, and renders it as a checklist that ticks off
// while the agent works. Mirrors the "todo list" behavior of
// the Lovable agent — auto-approved, no confirm clicks.
//
// State is fully owned by the parent (AsherCodeModule). This
// file only renders + animates. Steps are advanced by the
// parent calling `advancePlan` / `completePlan` on the
// returned controller.
// ============================================================

import { Check, Loader2, Circle } from "lucide-react";

export type PlanStepStatus = "pending" | "running" | "done";

export interface PlanStep {
  id: string;
  label: string;
  status: PlanStepStatus;
}

export interface AsherCodePlan {
  id: string;
  prompt: string;
  intent: "swarm_fix" | "build_all" | "edit_file" | "chat";
  steps: PlanStep[];
  startedAt: number;
}

export function AsherCodePlanStepsView({ plan }: { plan: AsherCodePlan | null }) {
  if (!plan || plan.steps.length === 0) return null;
  const doneCount = plan.steps.filter((s) => s.status === "done").length;
  const allDone = doneCount === plan.steps.length;
  return (
    <div className="rounded-lg px-2.5 py-2 text-[11px] font-light bg-card/40 border border-border/20 backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground/80">
          <span className="text-foreground/70">◈</span> Plan · auto-approved
        </div>
        <div className="text-[9px] font-mono text-muted-foreground/70">
          {doneCount}/{plan.steps.length}
        </div>
      </div>
      <ul className="space-y-1">
        {plan.steps.map((s) => (
          <li
            key={s.id}
            className={`flex items-start gap-2 transition-opacity ${
              s.status === "done" ? "opacity-60" : "opacity-100"
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {s.status === "done" ? (
                <Check className="h-3 w-3 text-emerald-400/90" />
              ) : s.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin text-foreground/80" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground/50" />
              )}
            </span>
            <span
              className={`text-[10.5px] leading-tight ${
                s.status === "done"
                  ? "line-through text-muted-foreground/70"
                  : s.status === "running"
                  ? "text-foreground/95"
                  : "text-foreground/70"
              }`}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ul>
      {allDone && (
        <div className="mt-1.5 text-[9px] tracking-[0.2em] uppercase text-emerald-400/80">
          ◉ Plan complete
        </div>
      )}
    </div>
  );
}

// ── Plan generator ────────────────────────────────────────
// Pure function — produces 3–6 atomic steps from the prompt.
// Heuristic only (no AI call): keeps the UI instant and
// offline-safe. Steps are intentionally generic-but-specific
// so they read as a real engineer's plan, not boilerplate.
export function generatePlanSteps(
  prompt: string,
  intent: "swarm_fix" | "build_all" | "edit_file" | "chat",
  ctx: { activeFileName?: string; projectName?: string }
): PlanStep[] {
  const mk = (label: string): PlanStep => ({
    id: Math.random().toString(36).slice(2, 9),
    label,
    status: "pending",
  });
  const file = ctx.activeFileName;
  const proj = ctx.projectName || "project";

  if (intent === "build_all") {
    return [
      mk(`Inventory existing files in ${proj}`),
      mk("Draft architecture & file tree"),
      mk("Generate / extend each missing file"),
      mk("Wire imports and run validators"),
      mk("Auto-fix any red lines until clean"),
    ];
  }
  if (intent === "swarm_fix") {
    return [
      mk(`Scan every file in ${proj} for errors`),
      mk("Spawn one debugger agent per broken file"),
      mk("Apply fixes in parallel"),
      mk("Re-validate until zero red lines"),
    ];
  }
  if (intent === "edit_file") {
    return [
      mk(`Read ${file || "target file"} and surrounding context`),
      mk("Plan the minimal change"),
      mk("Apply edit and verify syntax"),
    ];
  }
  // chat — short reasoning plan
  const short = prompt.trim().slice(0, 60).replace(/\s+/g, " ");
  return [
    mk(`Parse request: "${short}${prompt.length > 60 ? "…" : ""}"`),
    mk(file ? `Inspect ${file} for relevant context` : "Gather relevant context"),
    mk("Reason through the answer"),
    mk("Reply"),
  ];
}
