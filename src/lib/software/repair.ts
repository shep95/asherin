// the repair loop.
//
// A failed check becomes a defect, a defect becomes a scoped repair plan, and
// a repair is only ever called verified when a later run says so. Repeated
// failure on the same defect widens the scope instead of retrying blindly.

import type { ArtifactFile } from "./types";
import type { Defect } from "./workspace";
import { entryPoints } from "./workspace";

export type RepairScope = "local" | "module" | "entry" | "artifact";

export interface RepairPlan {
  defectId: string;
  scope: RepairScope;
  files: string[];
  attempt: number;
  instruction: string;
  testsToRerun: string[];
  escalated: boolean;
  /** true when nothing can be repaired because nothing ran. */
  blocked: boolean;
  blockedReason: string | null;
}

const ORDER: RepairScope[] = ["local", "module", "entry", "artifact"];

function widen(scope: RepairScope): RepairScope {
  const i = ORDER.indexOf(scope);
  return ORDER[Math.min(i + 1, ORDER.length - 1)];
}

function filesForScope(scope: RepairScope, defect: Defect, files: ArtifactFile[]): string[] {
  const entries = entryPoints(files);
  switch (scope) {
    case "local":
      return defect.scope.length ? defect.scope : entries;
    case "module": {
      const dirs = new Set((defect.scope.length ? defect.scope : entries).map((p) => p.split("/").slice(0, -1).join("/")));
      const inDirs = files.filter((f) => dirs.has(f.path.split("/").slice(0, -1).join("/"))).map((f) => f.path);
      return inDirs.length ? inDirs : entries;
    }
    case "entry":
      return [...new Set([...entries, ...defect.scope])];
    default:
      return files.map((f) => f.path);
  }
}

/**
 * Builds the plan for the next repair attempt. `attempt` counts previous
 * failed attempts against the same defect.
 */
export function planRepair(input: {
  defect: Defect;
  files: ArtifactFile[];
  attempt: number;
  testsToRerun: string[];
}): RepairPlan {
  const { defect, files } = input;
  if (defect.defectClass === "unavailable") {
    return {
      defectId: defect.checkId,
      scope: "local",
      files: [],
      attempt: input.attempt,
      instruction: "the artifact did not run, so there is nothing to repair — get it running first",
      testsToRerun: input.testsToRerun,
      escalated: false,
      blocked: true,
      blockedReason: defect.observed,
    };
  }

  let scope: RepairScope = "local";
  for (let i = 0; i < input.attempt; i += 1) scope = widen(scope);
  const scoped = filesForScope(scope, defect, files);

  return {
    defectId: defect.checkId,
    scope,
    files: scoped,
    attempt: input.attempt + 1,
    escalated: input.attempt > 0,
    blocked: false,
    blockedReason: null,
    testsToRerun: input.testsToRerun,
    instruction: [
      `repair “${defect.name}”.`,
      `expected: ${defect.expected}.`,
      `observed: ${defect.observed}.`,
      `change only ${scoped.join(", ") || "the entry file"}.`,
      input.attempt > 0
        ? `attempt ${input.attempt + 1}: the previous repair did not hold, so the scope widened to ${scope}.`
        : "keep the change as small as the defect.",
    ].join(" "),
  };
}

export type RepairOutcome = "verified" | "still_failing" | "regressed" | "unverified";

/** Never reports success from an intention — only from a later run. */
export function judgeRepair(input: {
  ranAfterRepair: boolean;
  targetPassed: boolean;
  regressionBroke: string[];
}): { outcome: RepairOutcome; detail: string } {
  if (!input.ranAfterRepair) {
    return { outcome: "unverified", detail: "the repair was applied but no run has confirmed it yet" };
  }
  if (input.regressionBroke.length > 0) {
    return { outcome: "regressed", detail: `the repair broke ${input.regressionBroke.join(", ")}` };
  }
  if (!input.targetPassed) return { outcome: "still_failing", detail: "the check still fails after the repair" };
  return { outcome: "verified", detail: "the check passes and nothing else broke" };
}
