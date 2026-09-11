// patch-based editing for artifact files.
//
// An ai edit is a change set against a known base. If the base moved because a
// human edited the file, the change set is stale and the user decides — a
// human edit is never overwritten silently.

export interface FilePatch {
  path: string;
  baseHash: string | null;
  before: string | null;
  after: string | null;
  operation: "create" | "edit" | "delete";
}

export interface PatchStats {
  additions: number;
  removals: number;
}

export interface ChangeSet {
  id: string;
  intent: string;
  reason: string;
  expectedBehaviour: string;
  patches: FilePatch[];
  testsAffected: string[];
  capabilitiesAffected: string[];
  createdAt: string;
}

export function diffStats(before: string | null, after: string | null): PatchStats {
  const a = (before ?? "").split("\n");
  const b = (after ?? "").split("\n");
  const bSet = new Map<string, number>();
  for (const line of b) bSet.set(line, (bSet.get(line) ?? 0) + 1);
  let removals = 0;
  for (const line of a) {
    const n = bSet.get(line) ?? 0;
    if (n > 0) bSet.set(line, n - 1);
    else removals += 1;
  }
  let additions = 0;
  for (const n of bSet.values()) additions += n;
  return { additions, removals };
}

export function changeSetStats(change: ChangeSet): PatchStats {
  return change.patches.reduce<PatchStats>(
    (acc, p) => {
      const s = diffStats(p.before, p.after);
      return { additions: acc.additions + s.additions, removals: acc.removals + s.removals };
    },
    { additions: 0, removals: 0 },
  );
}

export type PatchState = "clean" | "stale" | "missing_base";

export interface PatchStatus {
  path: string;
  state: PatchState;
  currentHash: string | null;
}

/** Compares each patch against the file as it stands right now. */
export function inspectPatches(
  change: ChangeSet,
  current: Map<string, { hash: string }>,
): PatchStatus[] {
  return change.patches.map((p) => {
    const now = current.get(p.path) ?? null;
    if (p.operation === "create") {
      return { path: p.path, state: now ? "stale" : "clean", currentHash: now?.hash ?? null };
    }
    if (!now) return { path: p.path, state: "missing_base", currentHash: null };
    return { path: p.path, state: now.hash === p.baseHash ? "clean" : "stale", currentHash: now.hash };
  });
}

export type PatchChoice = "keep_mine" | "apply_ai" | "merge" | "cancel";

export interface MergeOutcome {
  text: string | null;
  merged: boolean;
  conflictLines: number;
}

/**
 * Line-level three-way merge. Lines both sides changed are kept as an explicit
 * conflict block rather than being quietly resolved in either direction.
 */
export function mergeText(base: string, mine: string, theirs: string): MergeOutcome {
  if (mine === theirs) return { text: mine, merged: true, conflictLines: 0 };
  if (mine === base) return { text: theirs, merged: true, conflictLines: 0 };
  if (theirs === base) return { text: mine, merged: true, conflictLines: 0 };

  const b = base.split("\n");
  const m = mine.split("\n");
  const t = theirs.split("\n");
  const max = Math.max(b.length, m.length, t.length);
  const out: string[] = [];
  let conflictLines = 0;

  for (let i = 0; i < max; i += 1) {
    const bl = b[i];
    const ml = m[i];
    const tl = t[i];
    if (ml === tl) {
      if (ml !== undefined) out.push(ml);
    } else if (ml === bl) {
      if (tl !== undefined) out.push(tl);
    } else if (tl === bl) {
      if (ml !== undefined) out.push(ml);
    } else {
      conflictLines += 1;
      out.push("<<<<<<< yours");
      if (ml !== undefined) out.push(ml);
      out.push("=======");
      if (tl !== undefined) out.push(tl);
      out.push(">>>>>>> asherin");
    }
  }
  return { text: out.join("\n"), merged: conflictLines === 0, conflictLines };
}

export function resolvePatch(
  patch: FilePatch,
  choice: PatchChoice,
  currentText: string | null,
): { write: boolean; text: string | null; conflictLines: number } {
  switch (choice) {
    case "keep_mine":
      return { write: false, text: currentText, conflictLines: 0 };
    case "apply_ai":
      return { write: true, text: patch.after, conflictLines: 0 };
    case "merge": {
      const merged = mergeText(patch.before ?? "", currentText ?? "", patch.after ?? "");
      return { write: true, text: merged.text, conflictLines: merged.conflictLines };
    }
    default:
      return { write: false, text: currentText, conflictLines: 0 };
  }
}
