// choosing which checks to run.
//
// A small change runs the checks it can affect first, then the regression set
// the runtime shares. A full sweep is used only when the change is broad
// enough to warrant it.

import type { ArtifactCheck, ArtifactFile, CheckResult } from "./types";
import { entryPoints } from "./workspace";

export type TestScope = "focused" | "regression" | "all";

export interface TestPlan {
  scope: TestScope;
  focused: ArtifactCheck[];
  regression: ArtifactCheck[];
  skipped: ArtifactCheck[];
  reason: string;
}

const RUNTIME_KINDS: Array<ArtifactCheck["kind"]> = ["no_runtime_error", "no_console_error"];

/**
 * Any executed file feeds one document in the sandbox, so a change to a
 * script or markup file can affect every dom check; a change confined to
 * styles cannot change runtime errors.
 */
export function planTests(input: {
  checks: ArtifactCheck[];
  changedPaths: string[];
  files: ArtifactFile[];
  previousFailures?: string[];
  force?: TestScope;
}): TestPlan {
  const enabled = input.checks.filter((c) => c.enabled);
  const skipped = input.checks.filter((c) => !c.enabled);

  if (input.force === "all" || enabled.length === 0) {
    return {
      scope: "all",
      focused: enabled,
      regression: [],
      skipped,
      reason: input.force === "all" ? "you asked for the full set" : "there is nothing to narrow down",
    };
  }

  const changed = input.changedPaths.map((p) => p.toLowerCase());
  if (changed.length === 0) {
    return { scope: "all", focused: enabled, regression: [], skipped, reason: "no change was recorded, so everything runs" };
  }

  const touchesBehaviour = changed.some((p) => /\.(html|m?jsx?|ts|tsx)$/.test(p));
  const touchesStyleOnly = changed.every((p) => /\.css$/.test(p));
  const touchesEntry = changed.some((p) => entryPoints(input.files).some((e) => e.toLowerCase() === p));

  if (touchesEntry) {
    return { scope: "all", focused: enabled, regression: [], skipped, reason: "the entry file changed, so every check applies" };
  }

  const failedIds = new Set(input.previousFailures ?? []);
  const focused = enabled.filter((c) => {
    if (failedIds.has(c.id)) return true;
    if (touchesStyleOnly) return c.kind === "dom_selector_exists";
    if (touchesBehaviour) return true;
    return false;
  });
  const regression = enabled.filter((c) => !focused.includes(c) && RUNTIME_KINDS.includes(c.kind));

  return {
    scope: focused.length === enabled.length ? "all" : "focused",
    focused,
    regression,
    skipped,
    reason: touchesStyleOnly
      ? "only styles changed, so appearance checks run first"
      : `${changed.length} file${changed.length === 1 ? "" : "s"} changed — the checks they can affect run first`,
  };
}

export function failedCheckIds(results: CheckResult[]): string[] {
  return results.filter((r) => r.status === "failed").map((r) => r.checkId);
}

/** Compares two runs so a person can see what a change actually moved. */
export interface RunComparison {
  fixed: string[];
  broken: string[];
  unchanged: string[];
  appeared: string[];
  disappeared: string[];
}

export function compareRuns(before: CheckResult[], after: CheckResult[]): RunComparison {
  const b = new Map(before.map((r) => [r.checkId, r]));
  const a = new Map(after.map((r) => [r.checkId, r]));
  const fixed: string[] = [];
  const broken: string[] = [];
  const unchanged: string[] = [];
  const appeared: string[] = [];
  const disappeared: string[] = [];

  for (const [id, res] of a) {
    const prev = b.get(id);
    if (!prev) {
      appeared.push(res.name);
      continue;
    }
    if (prev.status === res.status) unchanged.push(res.name);
    else if (res.status === "passed") fixed.push(res.name);
    else broken.push(res.name);
  }
  for (const [id, res] of b) if (!a.has(id)) disappeared.push(res.name);
  return { fixed, broken, unchanged, appeared, disappeared };
}
