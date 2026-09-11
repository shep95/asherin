// The workspace decisions that quietly corrupt someone's work when wrong:
// whose edit wins, what the model is shown, what a failure means, and where a
// duplicated file lands.

import { describe, expect, it } from "vitest";
import {
  buildTree,
  classifyDefect,
  detectConflicts,
  entryPoints,
  hashContent,
  replaceInText,
  resolve,
  searchFiles,
  selectContextFiles,
  snapshot,
} from "@/lib/software/workspace";
import { uniquePath } from "@/lib/software/files";
import type { ArtifactCheck, ArtifactFile, CheckResult, RunObservation } from "@/lib/software/types";

const file = (path: string, content: string): ArtifactFile => ({
  id: path,
  artifactId: "a",
  path,
  content,
  mime: "text/plain",
  origin: "user",
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("conflict detection", () => {
  const base = [file("index.html", "<h1>one</h1>"), file("main.js", "console.log(1)")];

  it("applies cleanly when nothing moved under the proposal", () => {
    const changes = detectConflicts({
      edits: [{ path: "main.js", new_content: "console.log(2)", rationale: "bump" }],
      base: snapshot(base),
      baseContent: Object.fromEntries(base.map((f) => [f.path, f.content])),
      current: base,
    });
    expect(changes[0].status).toBe("clean");
  });

  it("refuses to overwrite a file the person edited after the plan was made", () => {
    const edited = [base[0], file("main.js", "console.log('mine')")];
    const changes = detectConflicts({
      edits: [{ path: "main.js", new_content: "console.log(2)", rationale: "bump" }],
      base: snapshot(base),
      baseContent: Object.fromEntries(base.map((f) => [f.path, f.content])),
      current: edited,
    });
    expect(changes[0].status).toBe("conflict");
    // keeping mine writes nothing at all.
    expect(resolve(changes[0], "keep_mine")).toBeNull();
    expect(resolve(changes[0], "apply_theirs")).toBe("console.log(2)");
  });

  it("marks a no-op proposal as identical rather than a change", () => {
    const changes = detectConflicts({
      edits: [{ path: "main.js", new_content: "console.log(1)", rationale: "none" }],
      base: snapshot(base),
      baseContent: Object.fromEntries(base.map((f) => [f.path, f.content])),
      current: base,
    });
    expect(changes[0].status).toBe("identical");
  });

  it("hashes content stably and distinguishes different content", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });
});

describe("model context selection", () => {
  const files = [
    file("index.html", "<div id=root></div>"),
    file("game/snake.js", "const snake = []"),
    file("docs/notes.md", "unrelated prose"),
  ];

  it("prefers the files the instruction and the person point at", () => {
    const sel = selectContextFiles({ instruction: "fix the snake speed", files, pinned: ["index.html"] });
    expect(sel.files.map((f) => f.path)).toContain("game/snake.js");
    expect(sel.files.map((f) => f.path)).toContain("index.html");
  });

  it("never ships the whole artifact when a budget cannot hold it", () => {
    const big = [file("a.js", "x".repeat(5000)), file("b.js", "y".repeat(5000))];
    const sel = selectContextFiles({ instruction: "x y", files: big, budgetChars: 6000 });
    expect(sel.omitted.length).toBeGreaterThan(0);
    expect(sel.totalChars).toBeLessThanOrEqual(6000);
  });
});

describe("defect classification", () => {
  const check: ArtifactCheck = {
    id: "c1",
    artifactId: "a",
    name: "canvas renders",
    kind: "dom_selector_exists",
    expectation: "canvas",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("scopes a repair to the files named in the error", () => {
    const result: CheckResult = { checkId: "c1", name: check.name, status: "failed", detail: "no match" };
    const observations: RunObservation[] = [
      { channel: "runtime", level: "error", message: "TypeError in game/snake.js", at: "2026-01-01T00:00:00.000Z" },
    ];
    const defect = classifyDefect({ check, result, observations, files: [file("game/snake.js", "")] });
    expect(defect?.defectClass).toBe("missing_output");
    expect(defect?.scope).toEqual(["game/snake.js"]);
  });

  it("does not call an unrun artifact a defect to repair", () => {
    const result: CheckResult = { checkId: "c1", name: check.name, status: "inconclusive", detail: "no answer" };
    const defect = classifyDefect({ check, result, observations: [], files: [] });
    expect(defect?.defectClass).toBe("unavailable");
    expect(defect?.repairHint).toContain("did not run");
  });

  it("returns nothing for a passing check", () => {
    const result: CheckResult = { checkId: "c1", name: check.name, status: "passed", detail: "ok" };
    expect(classifyDefect({ check, result, observations: [], files: [] })).toBeNull();
  });
});

describe("tree, search and paths", () => {
  it("implies folders from paths and puts folders first", () => {
    const tree = buildTree(["main.js", "src/app.ts", "src/ui/button.ts"]);
    expect(tree[0].kind).toBe("folder");
    expect(tree[0].name).toBe("src");
    expect(tree[0].children.map((c) => c.name)).toEqual(["ui", "app.ts"]);
  });

  it("finds a term with its line number", () => {
    const hits = searchFiles([file("a.js", "one\ntwo\nthree")], "two");
    expect(hits).toEqual([{ path: "a.js", line: 2, text: "two" }]);
  });

  it("never collides a duplicate onto an existing path", () => {
    expect(uniquePath("src/app.ts", [], "copy")).toBe("src/app.copy.ts");
    expect(uniquePath("src/app.ts", ["src/app.copy.ts"], "copy")).toBe("src/app.copy-2.ts");
  });

  it("counts replacements honestly", () => {
    expect(replaceInText("a-a-a", "a", "b")).toEqual({ text: "b-b-b", count: 3 });
    expect(replaceInText("abc", "", "x").count).toBe(0);
  });

  it("recognises entry points", () => {
    expect(entryPoints([file("index.html", ""), file("notes.md", "")])).toEqual(["index.html"]);
  });
});
