// Pure workspace reasoning: what changed, what collides, what the model is
// allowed to see, and what a failed check actually means.
//
// Nothing here touches the network or the database. It is deliberately
// testable on its own, because these are the decisions that quietly corrupt a
// person's work when they are wrong.

import type { ArtifactCheck, ArtifactFile, CheckResult, RunObservation } from "./types";
import type { EditPlanItem } from "@/lib/asherCode/aiClient";

/* ── content identity ─────────────────────────────────────────────────── */

/** FNV-1a. Not a security hash — an identity for "is this the same text". */
export function hashContent(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type BaseSnapshot = Record<string, string>;

export function snapshot(files: ArtifactFile[]): BaseSnapshot {
  const out: BaseSnapshot = {};
  for (const f of files) out[f.path] = hashContent(f.content);
  return out;
}

/* ── conflicts ────────────────────────────────────────────────────────── */

export type ChangeStatus =
  /** the file is untouched since the model read it — safe to apply. */
  | "clean"
  /** the file did not exist when the plan was made and still does not. */
  | "new"
  /** someone edited the file after the model read it. never auto-applied. */
  | "conflict"
  /** the proposed content is already what the file holds. */
  | "identical";

export interface ProposedChange {
  path: string;
  rationale: string;
  /** what the file held when the model read it. */
  baseContent: string;
  /** what the file holds right now. */
  currentContent: string;
  proposedContent: string;
  status: ChangeStatus;
}

/**
 * A proposal is compared against the base it was planned from, never against
 * a blank slate. If a person typed into a file in the meantime, that file is a
 * conflict and the choice is theirs.
 */
export function detectConflicts(input: {
  edits: EditPlanItem[];
  base: BaseSnapshot;
  baseContent: Record<string, string>;
  current: ArtifactFile[];
}): ProposedChange[] {
  const live = new Map(input.current.map((f) => [f.path, f.content]));
  return input.edits.map((e) => {
    const path = e.path;
    const currentContent = live.get(path) ?? "";
    const existedAtPlanTime = path in input.base;
    const changedSincePlan = existedAtPlanTime && input.base[path] !== hashContent(currentContent);
    const createdSincePlan = !existedAtPlanTime && live.has(path);
    let status: ChangeStatus;
    if (currentContent === e.new_content) status = "identical";
    else if (changedSincePlan || createdSincePlan) status = "conflict";
    else if (!existedAtPlanTime) status = "new";
    else status = "clean";
    return {
      path,
      rationale: e.rationale ?? "",
      baseContent: input.baseContent[path] ?? "",
      currentContent,
      proposedContent: e.new_content,
      status,
    };
  });
}

export type ConflictResolution = "keep_mine" | "apply_theirs";

/** Resolves a change to the content that should be written, or null for none. */
export function resolve(change: ProposedChange, choice: ConflictResolution): string | null {
  if (choice === "keep_mine") return null;
  return change.proposedContent;
}

/* ── model context ────────────────────────────────────────────────────── */

export interface ContextSelection {
  files: Array<{ path: string; content: string }>;
  omitted: string[];
  totalChars: number;
}

const WORD = /[a-z0-9_]+/gi;

/**
 * Chooses the smallest set of files that can answer the instruction. The whole
 * artifact is never shipped by default: a large project would drown the useful
 * files and cost the person tokens for nothing.
 */
export function selectContextFiles(input: {
  instruction: string;
  files: ArtifactFile[];
  /** files the person has open or selected — always included when they fit. */
  pinned?: string[];
  /** paths named in current errors or failed checks. */
  implicated?: string[];
  budgetChars?: number;
}): ContextSelection {
  const budget = input.budgetChars ?? 60_000;
  const terms = new Set((input.instruction.toLowerCase().match(WORD) ?? []).filter((w) => w.length > 2));
  const pinned = new Set(input.pinned ?? []);
  const implicated = new Set(input.implicated ?? []);

  const scored = input.files.map((f) => {
    let score = 0;
    if (pinned.has(f.path)) score += 1000;
    if (implicated.has(f.path)) score += 500;
    const lowerPath = f.path.toLowerCase();
    for (const t of terms) {
      if (lowerPath.includes(t)) score += 40;
      if (f.content.toLowerCase().includes(t)) score += 6;
    }
    // entry points matter disproportionately in a browser artifact.
    if (/^(index\.html|main\.(t|j)sx?|app\.(t|j)sx?)$/i.test(f.path)) score += 60;
    // smaller files are cheaper to include at equal usefulness.
    score -= Math.floor(f.content.length / 20_000);
    return { file: f, score };
  });

  scored.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));

  const files: ContextSelection["files"] = [];
  const omitted: string[] = [];
  let total = 0;
  for (const { file, score } of scored) {
    const cost = file.content.length + file.path.length;
    if (score <= 0 && files.length > 0 && !pinned.has(file.path)) {
      omitted.push(file.path);
      continue;
    }
    if (total + cost > budget && files.length > 0) {
      omitted.push(file.path);
      continue;
    }
    files.push({ path: file.path, content: file.content });
    total += cost;
  }
  return { files, omitted, totalChars: total };
}

/* ── defects ──────────────────────────────────────────────────────────── */

export type DefectClass = "runtime_error" | "console_error" | "missing_output" | "wrong_output" | "unavailable";

export interface Defect {
  checkId: string;
  name: string;
  defectClass: DefectClass;
  expected: string;
  observed: string;
  /** the files most likely to hold the cause. a local defect is repaired locally. */
  scope: string[];
  repairHint: string;
}

/**
 * Turns a failed check into something a repair can be scoped against. It
 * reports what was observed; it never guesses that a fix worked.
 */
export function classifyDefect(input: {
  check: ArtifactCheck;
  result: CheckResult;
  observations: RunObservation[];
  files: ArtifactFile[];
}): Defect | null {
  if (input.result.status === "passed") return null;
  const errors = input.observations.filter((o) => o.level === "error");
  let defectClass: DefectClass;
  if (input.result.status === "inconclusive") defectClass = "unavailable";
  else if (input.check.kind === "no_runtime_error") defectClass = "runtime_error";
  else if (input.check.kind === "no_console_error") defectClass = "console_error";
  else if (input.check.kind.startsWith("dom_")) defectClass = "missing_output";
  else defectClass = "wrong_output";

  const mentioned = input.files
    .filter((f) => errors.some((e) => e.message.includes(f.path)))
    .map((f) => f.path);
  const scope = mentioned.length > 0 ? mentioned : entryPoints(input.files);

  return {
    checkId: input.check.id,
    name: input.check.name,
    defectClass,
    expected: input.check.expectation || describeExpectation(input.check),
    observed: input.result.detail || (errors[0]?.message ?? "nothing was observed for this check"),
    scope,
    repairHint:
      defectClass === "unavailable"
        ? "the artifact did not run, so there is nothing to repair yet — fix the run first"
        : `repair is scoped to ${scope.join(", ") || "the entry file"} — the rest of the artifact is left alone`,
  };
}

function describeExpectation(check: ArtifactCheck): string {
  switch (check.kind) {
    case "no_runtime_error":
      return "no uncaught runtime error";
    case "no_console_error":
      return "no console error";
    case "console_contains":
      return `console output containing “${check.expectation}”`;
    case "dom_selector_exists":
      return `an element matching ${check.expectation}`;
    case "dom_text_contains":
      return `page text containing “${check.expectation}”`;
    default:
      return check.expectation;
  }
}

export function entryPoints(files: ArtifactFile[]): string[] {
  return files.filter((f) => /^(index\.html|main\.|app\.)/i.test(f.path)).map((f) => f.path);
}

/* ── file tree ────────────────────────────────────────────────────────── */

export interface TreeNode {
  name: string;
  path: string;
  kind: "folder" | "file";
  children: TreeNode[];
}

/** Folders exist because paths imply them; there is no separate folder record. */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "folder", children: [] };
  for (const path of [...paths].sort()) {
    const parts = path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part && c.kind === (isLeaf ? "file" : "folder"));
      if (!child) {
        child = { name: part, path: childPath, kind: isLeaf ? "file" : "folder", children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const order = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1))
      .map((n) => ({ ...n, children: order(n.children) }));
  return order(root.children);
}

/* ── search ───────────────────────────────────────────────────────────── */

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export function searchFiles(files: ArtifactFile[], query: string, limit = 200): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const f of files) {
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        hits.push({ path: f.path, line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

/** Replace across one file's text, returning the new content and a count. */
export function replaceInText(text: string, find: string, replaceWith: string): { text: string; count: number } {
  if (!find) return { text, count: 0 };
  const parts = text.split(find);
  return { text: parts.join(replaceWith), count: parts.length - 1 };
}
