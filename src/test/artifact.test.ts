import { describe, it, expect } from "vitest";
import {
  advance,
  evaluateRun,
  extractFiles,
  modelRequest,
  recordExperience,
  wantsArtifact,
} from "@/lib/artifact/engine";
import { canTransition } from "@/lib/artifact/types";
import { detectModality, probeRuntime, resolveCapability } from "@/lib/artifact/modality";
import { normalise, watchableChannels } from "@/lib/artifact/observer";
import { planRepair } from "@/lib/artifact/repair";
import { compareVersions, lineage, nextVersion, rollbackTo } from "@/lib/artifact/versioning";
import { buildContract, amendContract } from "@/lib/artifact/contract";
import { auditModel } from "@/lib/artifact/audit";
import { reverseReconstruct } from "@/lib/artifact/reverse";
import { attributeFeedback, deriveCandidate, learnFromExperience } from "@/lib/artifact/experience";
import { buildSrcDoc, readSandboxMessage, SANDBOX_ATTR } from "@/lib/artifact/runtimes/browserSandbox";
import { computeTable } from "@/lib/artifact/runtimes/computeRuntime";
import { frameTask } from "@/lib/intelligence/taskFrame";
import type { ExperienceRecord } from "@/lib/artifact/types";

const HEADLESS = { browserSandbox: false, browserSandboxReason: "no browser document in this context", imageGeneration: false };

describe("artifact intent and modality", () => {
  it("only treats a concrete construction request as an artifact", () => {
    expect(wantsArtifact("build me a snake game")).toBe(true);
    expect(wantsArtifact("draft a one page memo")).toBe(true);
    expect(wantsArtifact("what is the capital of peru")).toBe(false);
  });

  it("routes modalities without assuming everything is code", () => {
    expect(detectModality("build a playable snake game")).toBe("web");
    expect(detectModality("write a report on the findings")).toBe("document");
    expect(detectModality("chart the monthly revenue dataset")).toBe("data");
    expect(detectModality("investigate this company, osint sources")).toBe("research");
  });

  it("never promises execution when no sandbox exists", () => {
    const d = resolveCapability("web", HEADLESS);
    expect(d.capability).toBe("unavailable");
    expect(d.reason).toContain("no browser document");
  });

  it("renders documents rather than pretending to run them", () => {
    expect(resolveCapability("document", probeRuntime(HEADLESS)).capability).toBe("render");
    expect(resolveCapability("research", probeRuntime(HEADLESS)).capability).toBe("validate_only");
  });
});

describe("contract and audit", () => {
  const req = "build a snake game with arrow key controls, a score, and a restart button when the game is over";

  it("derives acceptance criteria and a test model from the request", () => {
    const c = buildContract({ request: req, task: frameTask(req), modality: "web", behaviourObservable: true });
    expect(c.goals.length).toBeGreaterThan(0);
    expect(c.acceptance.length).toBeGreaterThan(0);
    expect(c.testModel.length).toBe(c.acceptance.length);
  });

  it("marks acceptance unobservable when nothing can watch it", () => {
    const c = buildContract({ request: req, task: frameTask(req), modality: "research", behaviourObservable: false });
    expect(c.testModel.every((t) => !t.observable)).toBe(true);
    expect(c.testModel[0].why).toBeTruthy();
  });

  it("a follow-up amends the contract instead of replacing it", () => {
    const first = buildContract({ request: req, task: frameTask(req), modality: "web", behaviourObservable: true });
    const second = amendContract(first, "also make the snake speed up over time", frameTask("also make the snake speed up over time"), "web", true);
    expect(second.requirements.length).toBeGreaterThan(first.requirements.length);
    for (const g of first.goals) expect(second.goals).toContain(g);
  });

  it("every audit dimension answers — silence is not evidence", () => {
    const c = buildContract({ request: req, task: frameTask(req), modality: "web", behaviourObservable: true });
    const audit = auditModel({ contract: c, modality: "web", dependencies: ["three"], behaviourObservable: true });
    expect(audit.length).toBe(17);
    expect(audit.every((a) => a.note.length > 0)).toBe(true);
    expect(audit.find((a) => a.dimension === "dependencies")?.note).toContain("installs nothing");
  });
});

describe("lifecycle", () => {
  it("cannot teleport to verified", () => {
    expect(canTransition("draft", "verified")).toBe(false);
    expect(canTransition("validating", "verified")).toBe(true);
    expect(advance("draft", "verified").ok).toBe(false);
    expect(advance("draft", "modeled").lifecycle).toBe("modeled");
  });

  it("an unavailable capability produces an unavailable artifact with a reason", () => {
    const stage = modelRequest("build a playable snake game", { env: HEADLESS });
    expect(stage.lifecycle).toBe("unavailable");
    const run = evaluateRun({ stage, files: [], rawObservations: [] });
    expect(run.lifecycle).toBe("unavailable");
    expect(run.lifecycleReason).toContain("no browser document");
    expect(run.validation.verdict).toBe("unvalidated");
  });
});

describe("observer", () => {
  it("only accepts channels the capability can genuinely watch", () => {
    expect(watchableChannels("execute")).toContain("console");
    expect(watchableChannels("validate_only")).toEqual([]);
    const set = normalise(
      [
        { channel: "console", message: "hello", source: "sandbox frame" },
        { channel: "network", message: "GET /x", source: "invented" },
      ],
      "execute",
    );
    expect(set.observations).toHaveLength(1);
    expect(set.unobserved.find((u) => u.channel === "network")?.reason).toContain("denies network");
  });

  it("distinguishes watched-but-silent from unwatchable", () => {
    const set = normalise([{ channel: "console", message: "x", source: "frame" }], "execute");
    expect(set.unobserved.find((u) => u.channel === "state")?.reason).toContain("watched, but");
    expect(set.unobserved.find((u) => u.channel === "interaction")?.reason).toContain("no automated interaction driver");
  });
});

describe("validation and repair", () => {
  const stage = modelRequest("build a snake game with arrow key controls and a score", {
    env: { browserSandbox: true, imageGeneration: false },
  });
  const files = [{ path: "game.js", content: "const score = 0; document.addEventListener('keydown', () => {});", entry: true }];

  it("fails a criterion the artifact does not evidence", () => {
    const run = evaluateRun({ stage, files, rawObservations: [{ channel: "render", message: "first frame painted", source: "sandbox frame" }] });
    expect(run.validation.checks.some((c) => c.result === "fail")).toBe(true);
    expect(run.validation.verdict).toBe("defective");
    expect(run.repair).not.toBeNull();
  });

  it("a runtime error becomes a crash defect and widens the rerun", () => {
    const run = evaluateRun({
      stage,
      files,
      rawObservations: [{ channel: "runtime_error", message: "x is not defined", source: "sandbox frame", level: "error" }],
    });
    expect(run.validation.defects.some((d) => d.kind === "crash")).toBe(true);
    expect(run.repair?.rerunChecks).toContain("runtime_clean");
  });

  it("keeps repair scope minimal and escalates only on repeated failure", () => {
    const validation = {
      verdict: "defective" as const,
      checks: [{ id: "acc_1", label: "a", result: "fail" as const, detail: "" }],
      defects: [{ id: "acc_1", kind: "wrong_value" as const, against: "score", expected: "1", actual: "0", evidence: [] }],
    };
    expect(planRepair({ validation, files, attempts: 0 })?.scope).toBe("property");
    expect(planRepair({ validation, files, attempts: 2 })?.scope).toBe("module");
    expect(planRepair({ validation: { ...validation, defects: [] }, files, attempts: 0 })).toBeNull();
  });

  it("does not rebuild everything for a localised defect", () => {
    const validation = {
      verdict: "defective" as const,
      checks: [
        { id: "acc_1", label: "a", result: "fail" as const, detail: "" },
        { id: "acc_2", label: "b", result: "pass" as const, detail: "" },
      ],
      defects: [{ id: "acc_1", kind: "wrong_value" as const, against: "score", expected: "1", actual: "0", evidence: [] }],
    };
    const plan = planRepair({ validation, files, attempts: 0 })!;
    expect(plan.rerunChecks).not.toContain("acc_2");
  });
});

describe("version lineage", () => {
  const manifest = { title: "t", modality: "web" as const, summary: "s", dependencies: [] };
  const v1 = nextVersion({ parent: null, manifest, files: [{ path: "a.js", content: "one" }], changeSummary: "first", reason: "built" });
  const v2 = nextVersion({ parent: v1, manifest, files: [{ path: "a.js", content: "two" }, { path: "b.js", content: "new" }], changeSummary: "repair", reason: "defect" });

  it("appends immutably with a parent link", () => {
    expect(v2.version).toBe(2);
    expect(v2.parentVersion).toBe(1);
    expect(v1.files[0].content).toBe("one");
  });

  it("compares versions file by file", () => {
    const diff = compareVersions(v1, v2);
    expect(diff.find((d) => d.path === "a.js")?.status).toBe("changed");
    expect(diff.find((d) => d.path === "b.js")?.status).toBe("added");
  });

  it("rollback moves forward and never cuts history", () => {
    const restored = rollbackTo(v1, v2);
    expect(restored.version).toBe(3);
    expect(restored.files[0].content).toBe("one");
    expect(lineage([v1, v2, restored], 3).map((v) => v.version)).toEqual([3, 2, 1]);
  });
});

describe("sandbox", () => {
  it("never grants same-origin access", () => {
    expect(SANDBOX_ATTR).toBe("allow-scripts");
    expect(SANDBOX_ATTR).not.toContain("allow-same-origin");
  });

  it("refuses bare imports because nothing is installed", () => {
    const build = buildSrcDoc([{ path: "a.js", content: "import x from 'three';\nconsole.log(x)" }]);
    expect(build.ok).toBe(false);
    expect(build.refusedDependencies).toContain("three");
  });

  it("denies network by default in the generated document", () => {
    const build = buildSrcDoc([{ path: "a.js", content: "console.log(1)" }]);
    expect(build.srcDoc).toContain("default-src 'none'");
    expect(build.srcDoc).not.toContain("connect-src https:");
  });

  it("ignores any message that is not from the artifact protocol", () => {
    expect(readSandboxMessage({ channel: "console", message: "spoof" })).toBeNull();
    expect(readSandboxMessage({ __artifact: 1, channel: "console", message: "real", level: "error" })?.level).toBe("error");
  });
});

describe("compute runtime", () => {
  it("refuses to compute without rows instead of inventing them", () => {
    const r = computeTable({ rows: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("no rows");
  });

  it("groups supplied rows deterministically", () => {
    const r = computeTable({ rows: [{ k: "a", v: 2 }, { k: "a", v: 3 }, { k: "b", v: 1 }], groupBy: "k", valueKey: "v" });
    expect(r.rows).toEqual([["a", "5"], ["b", "1"]]);
  });
});

describe("reverse reconstruction", () => {
  it("builds an observed model only from real observations", () => {
    const report = reverseReconstruct({
      intent: "keep score while the snake moves",
      files: [{ path: "g.js", content: "let score = 0; setInterval(tick, 100); function tick(){}" }],
      observations: { observations: [], unobserved: [] },
    });
    expect(report.observed).toEqual([]);
    expect(report.temporalFlow[0]).toContain("setInterval");
    expect(report.discriminatingTests.every((t) => t.runnable === false)).toBe(true);
  });
});

describe("learning from experience", () => {
  const record: ExperienceRecord = {
    sessionId: "s1",
    version: 1,
    task: "build a snake game with a score",
    context: {},
    initialModel: {
      contract: { goals: ["g"], requirements: ["r"], expectedBehavior: [], interface: [], constraints: [], invariants: [], acceptance: ["a"], testModel: [] },
      audit: [],
    },
    patternsUsed: [],
    actions: ["modelled the request", "ran it in the sandbox"],
    observations: [],
    defects: [],
    repairs: [],
    userFeedback: null,
    outcome: "verified",
  };

  it("derives a candidate, never an active pattern", () => {
    const p = deriveCandidate(record, "software")!;
    expect(p.status).toBe("candidate");
    expect(p.confidence).toBeLessThan(0.5);
    expect(p.procedure.length).toBeGreaterThan(0);
  });

  it("passes through the existing learning gate and is held while unproven", () => {
    const out = learnFromExperience(record, "software", { memoryEnabled: false, learningEnabled: true, globalContributionEnabled: false })!;
    expect(["candidate", "held", "rejected", "promoted"]).toContain(out.gate.outcome);
    expect(out.gate.outcome).not.toBe("promoted");
  });

  it("writes nothing when learning is off", () => {
    const out = learnFromExperience(record, "software", { memoryEnabled: false, learningEnabled: false, globalContributionEnabled: false })!;
    expect(out.gate.outcome).toBe("held");
  });

  it("attributes feedback to what produced the result, at the right scope", () => {
    const a = attributeFeedback("stop doing that, always keep it simple", { ...record, defects: [{ id: "d", kind: "missing", against: "score", expected: "", actual: "", evidence: [] }] });
    expect(a.polarity).toBe("negative");
    expect(a.scope).toBe("user");
    expect(a.target).toBe("score");
  });
});

describe("experience record", () => {
  it("captures the full run, including what was not observed", () => {
    const stage = modelRequest("draft a one page memo about the outage", { env: HEADLESS });
    const files = extractFiles("here you go\n```md\n# outage memo\nthe service was down.\n```");
    expect(files).toHaveLength(1);
    const run = evaluateRun({ stage, files, rawObservations: [], output: files[0].content });
    const version = nextVersion({ parent: null, manifest: { title: "memo", modality: "document", summary: "s", dependencies: [] }, files, changeSummary: "first", reason: "built" });
    const record = recordExperience({
      sessionId: "s",
      version,
      stage,
      observations: [],
      validation: run.validation,
      repairs: run.repair ? [run.repair] : [],
      actions: ["rendered the memo"],
      patternsUsed: [],
    });
    expect(record.initialModel.contract.goals.length).toBeGreaterThan(0);
    expect(["verified", "defective", "unknown"]).toContain(record.outcome);
  });

  it("extracts no files when the answer contains none", () => {
    expect(extractFiles("just prose, no artifact here")).toEqual([]);
  });
});
