// deterministic check evaluation.
//
// Separated from the browser on purpose: given observations from a real run
// and the answers a dom probe returned, this decides pass or fail with no
// side effects, so it can be tested without a frame.

import type { ArtifactCheck, CheckResult, RunObservation } from "./types";

export interface ProbeAnswer {
  checkId: string;
  ok: boolean | null;
  detail?: string;
}

export const CHECK_KIND_LABEL: Record<ArtifactCheck["kind"], string> = {
  no_runtime_error: "no runtime error occurred",
  no_console_error: "nothing was logged as an error",
  console_contains: "a log line contains the expected text",
  dom_selector_exists: "an element matching the selector exists",
  dom_text_contains: "the visible text contains the expected text",
};

/** Which checks need to ask the running frame a question. */
export function probeQueries(checks: ArtifactCheck[]): Array<{ id: string; kind: ArtifactCheck["kind"]; value: string }> {
  return checks
    .filter((c) => c.enabled && (c.kind === "dom_selector_exists" || c.kind === "dom_text_contains"))
    .map((c) => ({ id: c.id, kind: c.kind, value: c.expectation }));
}

export function evaluateChecks(
  checks: ArtifactCheck[],
  observations: RunObservation[],
  probes: ProbeAnswer[] = [],
): CheckResult[] {
  const errors = observations.filter((o) => o.channel === "runtime_error");
  const consoleErrors = observations.filter((o) => o.channel === "console" && o.level === "error");
  const logs = observations.filter((o) => o.channel === "console");

  return checks
    .filter((c) => c.enabled)
    .map<CheckResult>((c) => {
      switch (c.kind) {
        case "no_runtime_error":
          return {
            checkId: c.id,
            name: c.name,
            status: errors.length === 0 ? "passed" : "failed",
            detail: errors.length ? errors[0].message : "no runtime error was reported",
          };
        case "no_console_error":
          return {
            checkId: c.id,
            name: c.name,
            status: consoleErrors.length === 0 ? "passed" : "failed",
            detail: consoleErrors.length ? consoleErrors[0].message : "nothing was logged as an error",
          };
        case "console_contains": {
          const hit = logs.find((l) => c.expectation !== "" && l.message.includes(c.expectation));
          return {
            checkId: c.id,
            name: c.name,
            status: c.expectation === "" ? "inconclusive" : hit ? "passed" : "failed",
            detail:
              c.expectation === ""
                ? "this check has no expected text, so nothing can be compared"
                : hit
                  ? hit.message
                  : `no log line contained “${c.expectation}”`,
          };
        }
        case "dom_selector_exists":
        case "dom_text_contains": {
          const answer = probes.find((p) => p.checkId === c.id);
          if (!answer || answer.ok === null) {
            return {
              checkId: c.id,
              name: c.name,
              status: "inconclusive",
              detail: answer?.detail ?? "the running artifact did not answer this question",
            };
          }
          return {
            checkId: c.id,
            name: c.name,
            status: answer.ok ? "passed" : "failed",
            detail: answer.detail ?? (answer.ok ? "found" : "not found"),
          };
        }
        default:
          return { checkId: c.id, name: c.name, status: "inconclusive", detail: "unknown check kind" };
      }
    });
}

export function runStatus(results: CheckResult[]): "passed" | "failed" | "unavailable" {
  if (!results.length) return "unavailable";
  if (results.some((r) => r.status === "failed")) return "failed";
  if (results.every((r) => r.status === "passed")) return "passed";
  // some question went unanswered: the run proved nothing either way.
  return "unavailable";
}
