import { describe, expect, it } from "vitest";
import { buildPreview, readProbeReply } from "@/lib/software/preview";
import { evaluateChecks, probeQueries, runStatus } from "@/lib/software/checks";
import { mimeForPath, normalisePath } from "@/lib/software/files";
import type { ArtifactCheck, ArtifactFile, RunObservation } from "@/lib/software/types";

const file = (path: string, content: string): ArtifactFile => ({
  id: path,
  artifactId: "a",
  path,
  content,
  mime: mimeForPath(path),
  origin: "user",
  deletedAt: null,
  updatedAt: new Date().toISOString(),
});

const check = (id: string, kind: ArtifactCheck["kind"], expectation = ""): ArtifactCheck => ({
  id,
  artifactId: "a",
  name: id,
  kind,
  expectation,
  enabled: true,
});

const obs = (channel: RunObservation["channel"], level: RunObservation["level"], message: string): RunObservation => ({
  channel,
  level,
  message,
  at: new Date().toISOString(),
});

describe("file paths", () => {
  it("refuses traversal and absolute paths but keeps simple relative ones", () => {
    expect(normalisePath("/index.html")).toBe("index.html");
    expect(normalisePath("src/main.js")).toBe("src/main.js");
    expect(() => normalisePath("../secrets.env")).toThrow();
    expect(() => normalisePath("   ")).toThrow();
  });

  it("labels content types from the path", () => {
    expect(mimeForPath("a.html")).toBe("text/html");
    expect(mimeForPath("a.js")).toBe("text/javascript");
    expect(mimeForPath("notes.txt")).toBe("text/plain");
  });
});

describe("preview build", () => {
  it("is unavailable with a reason when there are no files", () => {
    const b = buildPreview([]);
    expect(b.ok).toBe(false);
    expect(b.unavailableReason).toContain("no files");
  });

  it("is unavailable when nothing is executable in a browser", () => {
    const b = buildPreview([file("notes.md", "# hello")]);
    expect(b.ok).toBe(false);
    expect(b.unavailableReason).toContain("html, css and plain javascript");
  });

  it("builds a runnable document and installs the probe listener", () => {
    const b = buildPreview([file("index.html", "<html><head></head><body><div id='root'></div></body></html>")]);
    expect(b.ok).toBe(true);
    expect(b.srcDoc).toContain("__probe");
    expect(b.srcDoc).toContain("Content-Security-Policy");
  });

  it("refuses packages instead of pretending they install", () => {
    const b = buildPreview([file("main.js", "import x from 'lodash';\nconsole.log(x);")]);
    expect(b.ok).toBe(false);
    expect(b.refusedDependencies).toContain("lodash");
  });
});

describe("check evaluation", () => {
  it("passes a clean run and fails a run that threw", () => {
    const checks = [check("c1", "no_runtime_error")];
    expect(evaluateChecks(checks, [])[0].status).toBe("passed");
    expect(evaluateChecks(checks, [obs("runtime_error", "error", "x is not defined")])[0].status).toBe("failed");
  });

  it("separates console errors from thrown errors", () => {
    const results = evaluateChecks(
      [check("c", "no_console_error")],
      [obs("console", "error", "bad state")],
    );
    expect(results[0].status).toBe("failed");
    expect(results[0].detail).toBe("bad state");
  });

  it("matches expected log text", () => {
    const checks = [check("c", "console_contains", "ready")];
    expect(evaluateChecks(checks, [obs("console", "info", "ready")])[0].status).toBe("passed");
    expect(evaluateChecks(checks, [obs("console", "info", "loading")])[0].status).toBe("failed");
  });

  it("treats an unanswered dom question as inconclusive, never as a pass", () => {
    const checks = [check("c", "dom_selector_exists", "#root canvas")];
    expect(evaluateChecks(checks, [])[0].status).toBe("inconclusive");
    expect(evaluateChecks(checks, [], [{ checkId: "c", ok: true }])[0].status).toBe("passed");
    expect(evaluateChecks(checks, [], [{ checkId: "c", ok: false }])[0].status).toBe("failed");
  });

  it("only asks the frame about dom checks", () => {
    const q = probeQueries([check("a", "no_runtime_error"), check("b", "dom_text_contains", "score")]);
    expect(q).toHaveLength(1);
    expect(q[0].id).toBe("b");
  });

  it("summarises a run without claiming an unproven pass", () => {
    expect(runStatus([])).toBe("unavailable");
    expect(runStatus([{ checkId: "1", name: "n", status: "passed", detail: "" }])).toBe("passed");
    expect(
      runStatus([
        { checkId: "1", name: "n", status: "passed", detail: "" },
        { checkId: "2", name: "m", status: "inconclusive", detail: "" },
      ]),
    ).toBe("unavailable");
    expect(runStatus([{ checkId: "1", name: "n", status: "failed", detail: "" }])).toBe("failed");
  });
});

describe("probe replies", () => {
  it("ignores anything that is not a probe answer", () => {
    expect(readProbeReply({ hello: 1 })).toBeNull();
    expect(readProbeReply({ __artifact: 1, channel: "console", message: "hi" })).toBeNull();
  });

  it("reads answers, keeping an unknown answer unknown", () => {
    const r = readProbeReply({ __artifact: 1, channel: "probe", results: [{ checkId: "c", ok: null }] });
    expect(r?.[0]).toEqual({ checkId: "c", ok: null, detail: undefined });
  });
});

describe("html artifacts in the sandbox", () => {
  const page = file(
    "index.html",
    "<html><head><link rel='stylesheet' href='style.css'></head><body><div id='root'></div><script src='main.js'></script></body></html>",
  );

  it("inlines the artifact's own script and stylesheet, since the frame has no file server", () => {
    const b = buildPreview([page, file("main.js", "console.log('ready')"), file("style.css", "body{color:red}")]);
    expect(b.ok).toBe(true);
    expect(b.srcDoc).toContain("console.log('ready')");
    expect(b.srcDoc).toContain("body{color:red}");
    expect(b.srcDoc).not.toContain('src=\'main.js\'');
  });

  it("carries the observation bridge and the render ping into a hand-written page", () => {
    const b = buildPreview([page, file("main.js", "1")]);
    expect(b.srcDoc).toContain("__artifact");
    expect(b.srcDoc).toContain("first frame painted");
    expect(b.srcDoc).toContain("__probe");
  });

  it("reports a reference it cannot load instead of showing a blank page", () => {
    const b = buildPreview([page]);
    expect(b.ok).toBe(false);
    expect(b.unavailableReason).toContain("main.js");
  });
});
