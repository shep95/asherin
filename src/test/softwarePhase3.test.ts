import { describe, expect, it } from "vitest";
import { detectDependencies, assessDependencies } from "@/lib/software/dependencies";
import { diffStats, inspectPatches, mergeText, resolvePatch, type ChangeSet } from "@/lib/software/patch";
import { planTests, compareRuns, failedCheckIds } from "@/lib/software/testSelection";
import { planRepair, judgeRepair } from "@/lib/software/repair";
import { validateDataContract, emptyContract, readContract } from "@/lib/software/dataContract";
import { preflight } from "@/lib/software/install";
import { providerForClass, browserSandboxProvider } from "@/lib/software/runtime";
import { requiresApproval, isMutating } from "@/lib/software/actions";
import { LEAST_PRIVILEGE, type ArtifactCheck, type ArtifactFile, type SoftwareArtifact } from "@/lib/software/types";

const file = (path: string, content: string): ArtifactFile => ({
  id: path,
  artifactId: "a",
  path,
  content,
  mime: "text/plain",
  origin: "user",
  deletedAt: null,
  updatedAt: "2026-01-01T00:00:00Z",
});

const check = (id: string, kind: ArtifactCheck["kind"], expectation = ""): ArtifactCheck => ({
  id,
  artifactId: "a",
  name: id,
  kind,
  expectation,
  enabled: true,
});

const artifact: SoftwareArtifact = {
  id: "a",
  ownerUserId: "u",
  displayName: "inventory",
  slug: null,
  description: null,
  icon: null,
  type: "application",
  lifecycle: "draft",
  visibility: "private",
  currentVersionId: null,
  runtimeSessionId: null,
  entrypoint: "index.html",
  runtimeType: "client_browser",
  releaseStatus: "draft",
  runtimeRequirements: {},
  compatibilityRequirements: {},
  capabilities: [],
  permissionManifest: LEAST_PRIVILEGE,
  integrationManifest: [],
  dependencyManifest: [],
  dataManifest: {},
  provenanceManifest: {},
  distributionManifest: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  publishedAt: null,
};

describe("dependencies", () => {
  it("reads packages and remote scripts out of the source", () => {
    const deps = detectDependencies([
      file("main.js", 'import React from "react";\nimport "./local.css";'),
      file("index.html", '<script src="https://cdn.example.com/x.js"></script>'),
    ]);
    expect(deps.map((d) => d.name)).toEqual(["https://cdn.example.com/x.js", "react"]);
    expect(deps.every((d) => !d.declared)).toBe(true);
  });

  it("refuses to claim a package can be installed here", () => {
    const deps = detectDependencies([file("main.js", 'import z from "zod";')]);
    const verdict = assessDependencies(deps, false);
    expect(verdict.runnableInSandbox).toBe(false);
    expect(verdict.notes.join(" ")).toContain("external build provider");
  });
});

describe("patches", () => {
  it("counts additions and removals", () => {
    expect(diffStats("a\nb", "a\nb\nc")).toEqual({ additions: 1, removals: 0 });
  });

  it("marks a patch stale when the file moved underneath it", () => {
    const change: ChangeSet = {
      id: "c",
      intent: "i",
      reason: "r",
      expectedBehaviour: "b",
      testsAffected: [],
      capabilitiesAffected: [],
      createdAt: "now",
      patches: [{ path: "main.js", baseHash: "h1", before: "a", after: "b", operation: "edit" }],
    };
    expect(inspectPatches(change, new Map([["main.js", { hash: "h2" }]]))[0].state).toBe("stale");
    expect(inspectPatches(change, new Map([["main.js", { hash: "h1" }]]))[0].state).toBe("clean");
  });

  it("never writes over a human edit when the choice is keep mine", () => {
    const patch = { path: "a.js", baseHash: null, before: "base", after: "ai", operation: "edit" as const };
    expect(resolvePatch(patch, "keep_mine", "mine")).toEqual({ write: false, text: "mine", conflictLines: 0 });
  });

  it("merges disjoint edits and marks the rest as a conflict", () => {
    expect(mergeText("a\nb\nc", "a\nB\nc", "a\nb\nC")).toEqual({ text: "a\nB\nC", merged: true, conflictLines: 0 });
    const clash = mergeText("a", "mine", "theirs");
    expect(clash.merged).toBe(false);
    expect(clash.text).toContain("<<<<<<< yours");
  });
});

describe("test selection", () => {
  const files = [file("index.html", "<div id=root></div>"), file("style.css", "body{}"), file("logic.js", "")];
  const checks = [check("c1", "no_runtime_error"), check("c2", "dom_selector_exists", "#root")];

  it("runs everything when the entry file changed", () => {
    expect(planTests({ checks, changedPaths: ["index.html"], files }).scope).toBe("all");
  });

  it("puts appearance checks first for a style-only change", () => {
    const plan = planTests({ checks, changedPaths: ["style.css"], files });
    expect(plan.focused.map((c) => c.id)).toEqual(["c2"]);
    expect(plan.regression.map((c) => c.id)).toEqual(["c1"]);
  });

  it("always re-runs a check that failed last time", () => {
    const plan = planTests({ checks, changedPaths: ["style.css"], files, previousFailures: ["c1"] });
    expect(plan.focused.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });

  it("compares two runs", () => {
    const before = [{ checkId: "c1", name: "c1", status: "failed" as const, detail: "" }];
    const after = [{ checkId: "c1", name: "c1", status: "passed" as const, detail: "" }];
    expect(compareRuns(before, after).fixed).toEqual(["c1"]);
    expect(failedCheckIds(before)).toEqual(["c1"]);
  });
});

describe("repair", () => {
  const files = [file("index.html", ""), file("src/logic.js", "")];
  const defect = {
    checkId: "c1",
    name: "renders",
    defectClass: "missing_output" as const,
    expected: "#root",
    observed: "nothing",
    scope: ["src/logic.js"],
    repairHint: "",
  };

  it("keeps the first attempt local and widens on repeat failure", () => {
    expect(planRepair({ defect, files, attempt: 0, testsToRerun: [] }).scope).toBe("local");
    const second = planRepair({ defect, files, attempt: 1, testsToRerun: [] });
    expect(second.scope).toBe("module");
    expect(second.escalated).toBe(true);
  });

  it("refuses to repair when nothing ran", () => {
    const plan = planRepair({ defect: { ...defect, defectClass: "unavailable" }, files, attempt: 0, testsToRerun: [] });
    expect(plan.blocked).toBe(true);
  });

  it("only calls a repair verified when a run says so", () => {
    expect(judgeRepair({ ranAfterRepair: false, targetPassed: true, regressionBroke: [] }).outcome).toBe("unverified");
    expect(judgeRepair({ ranAfterRepair: true, targetPassed: true, regressionBroke: ["x"] }).outcome).toBe("regressed");
    expect(judgeRepair({ ranAfterRepair: true, targetPassed: true, regressionBroke: [] }).outcome).toBe("verified");
  });
});

describe("data contracts", () => {
  it("rejects a shape that is not owned by the artifact owner", () => {
    const problems = validateDataContract({
      version: 1,
      entities: [
        {
          name: "Items",
          fields: [],
          relations: [{ to: "ghost", kind: "one_to_many" }],
          constraints: [],
          indexes: [],
          ownership: "artifact_owner",
          retention: "until_deleted",
          access: "owner_only",
        },
      ],
    });
    expect(problems.map((p) => p.problem)).toEqual([
      "entity names must be lowercase words joined by underscores",
      "an entity needs at least one field",
      "relation points at “ghost”, which is not declared",
    ]);
  });

  it("reads an empty contract from an empty manifest", () => {
    expect(readContract({})).toEqual(emptyContract());
  });
});

describe("runtime providers", () => {
  it("offers the browser sandbox and refuses to pretend about the rest", () => {
    expect(browserSandboxProvider.availability).toBe("available");
    expect(browserSandboxProvider.capabilities.sessionAccess).toBe(false);
    expect(providerForClass("isolated_server").availability).toBe("configuration_required");
    expect(providerForClass("native").prepare([]).unavailableReason).toBeTruthy();
  });
});

describe("install preflight", () => {
  it("holds back installation until there is evidence", () => {
    const report = preflight({
      artifact,
      files: [file("index.html", "<h1>hi</h1>")],
      lastRun: null,
      runtimeClass: "client_browser",
    });
    expect(report.eligible).toBe(false);
    expect(report.items.find((i) => i.id === "tests")?.state).toBe("unavailable");
  });

  it("blocks a bundle that carries a credential", () => {
    const report = preflight({
      artifact,
      files: [file("index.html", "<h1>hi</h1>"), file("config.js", 'const apiKey = "abc";')],
      lastRun: {
        id: "r",
        artifactId: "a",
        versionId: null,
        status: "passed",
        results: [{ checkId: "c", name: "c", status: "passed", detail: "" }],
        observations: [],
        unavailableReason: null,
        provider: "browser_sandbox",
        scope: "all",
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
      runtimeClass: "client_browser",
    });
    expect(report.eligible).toBe(false);
    expect(report.items.find((i) => i.id === "secrets")?.state).toBe("fail");
  });
});

describe("actions", () => {
  it("requires a person to confirm the destructive ones", () => {
    expect(requiresApproval("delete_file")).toBe(true);
    expect(requiresApproval("inspect_file")).toBe(false);
    expect(isMutating("edit_file")).toBe(true);
  });
});
