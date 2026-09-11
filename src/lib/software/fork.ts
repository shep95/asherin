// forking and upstream tracking.
//
// A fork is a new artifact with a new identity. It remembers its parent, it
// never inherits it: routes, installations, data, members and future versions
// belong to the fork alone. Upstream changes are offered, never applied behind
// a person's back.

import { supabase } from "@/integrations/supabase/client";
import { createArtifact, createVersion, recordEvent } from "./store";
import { listFiles, saveFile } from "./files";
import { mergeText } from "./patch";
import type { ArtifactFile, SoftwareArtifact, SoftwareVersion } from "./types";

/* ── three-way comparison ─────────────────────────────────────────────── */

export type FileChange = "added" | "removed" | "modified" | "unchanged";

export interface FileComparison {
  path: string;
  upstream: FileChange;
  local: FileChange;
  conflicted: boolean;
}

export interface UpstreamComparison {
  files: FileComparison[];
  changedUpstream: string[];
  changedLocally: string[];
  conflicts: string[];
  cleanlyApplicable: string[];
  summary: string;
}

type Snapshot = Record<string, string>;

export function snapshot(files: ArtifactFile[]): Snapshot {
  const out: Snapshot = {};
  for (const f of files) if (!f.deletedAt) out[f.path] = f.content;
  return out;
}

function classify(ancestor: string | undefined, side: string | undefined): FileChange {
  if (ancestor === undefined && side === undefined) return "unchanged";
  if (ancestor === undefined) return "added";
  if (side === undefined) return "removed";
  return ancestor === side ? "unchanged" : "modified";
}

/**
 * Compares upstream and local against the common ancestor the fork was taken
 * from. A file only conflicts when both sides moved it differently.
 */
export function compareToUpstream(input: {
  ancestor: Snapshot;
  local: Snapshot;
  upstream: Snapshot;
}): UpstreamComparison {
  const paths = Array.from(new Set([...Object.keys(input.ancestor), ...Object.keys(input.local), ...Object.keys(input.upstream)])).sort();
  const files: FileComparison[] = paths.map((path) => {
    const up = classify(input.ancestor[path], input.upstream[path]);
    const loc = classify(input.ancestor[path], input.local[path]);
    const conflicted =
      up !== "unchanged" && loc !== "unchanged" && input.upstream[path] !== input.local[path];
    return { path, upstream: up, local: loc, conflicted };
  });
  const changedUpstream = files.filter((f) => f.upstream !== "unchanged").map((f) => f.path);
  const changedLocally = files.filter((f) => f.local !== "unchanged").map((f) => f.path);
  const conflicts = files.filter((f) => f.conflicted).map((f) => f.path);
  const cleanlyApplicable = changedUpstream.filter((p) => !conflicts.includes(p));
  return {
    files,
    changedUpstream,
    changedLocally,
    conflicts,
    cleanlyApplicable,
    summary: changedUpstream.length
      ? `${changedUpstream.length} file${changedUpstream.length === 1 ? "" : "s"} changed upstream, ${conflicts.length} conflicting with your own edits`
      : "nothing has changed upstream",
  };
}

export type ConflictChoice = "keep_local" | "take_upstream" | "merge";

export interface MergeCandidate {
  path: string;
  choice: ConflictChoice;
  content: string;
  clean: boolean;
  note: string;
}

/** Produces the candidate content for every file an update would touch. */
export function buildMergeCandidates(input: {
  ancestor: Snapshot;
  local: Snapshot;
  upstream: Snapshot;
  comparison: UpstreamComparison;
  choices: Record<string, ConflictChoice>;
}): MergeCandidate[] {
  const out: MergeCandidate[] = [];
  for (const path of input.comparison.changedUpstream) {
    const conflicted = input.comparison.conflicts.includes(path);
    const upstream = input.upstream[path] ?? "";
    if (!conflicted) {
      out.push({ path, choice: "take_upstream", content: upstream, clean: true, note: "applies cleanly" });
      continue;
    }
    const choice = input.choices[path] ?? "merge";
    if (choice === "keep_local") {
      out.push({ path, choice, content: input.local[path] ?? "", clean: true, note: "your version kept" });
    } else if (choice === "take_upstream") {
      out.push({ path, choice, content: upstream, clean: true, note: "upstream version taken, your edits replaced" });
    } else {
      const merged = mergeText(input.ancestor[path] ?? "", input.local[path] ?? "", upstream);
      out.push({
        path,
        choice,
        content: merged.text,
        clean: merged.clean,
        note: merged.clean ? "merged automatically" : "merged with conflict markers — review before activating",
      });
    }
  }
  return out;
}

/** An update is never activated while a candidate still carries a conflict. */
export function updateIsSafeToActivate(candidates: MergeCandidate[]): { ok: boolean; reason: string } {
  const dirty = candidates.filter((c) => !c.clean);
  if (dirty.length) return { ok: false, reason: `${dirty.length} file(s) still contain unresolved conflicts` };
  if (!candidates.length) return { ok: false, reason: "there is nothing to apply" };
  return { ok: true, reason: "" };
}

/* ── persistence ──────────────────────────────────────────────────────── */

export async function forkArtifact(input: {
  source: SoftwareArtifact;
  sourceVersion: SoftwareVersion | null;
  userId: string;
  name?: string;
}): Promise<SoftwareArtifact> {
  const fork = await createArtifact({
    userId: input.userId,
    displayName: input.name?.trim() || `${input.source.displayName} (fork)`,
    description: input.source.description ?? undefined,
    type: input.source.type,
    permissionManifest: input.source.permissionManifest,
  });

  const { error } = await supabase
    .from("software_artifact")
    .update({
      parent_artifact_id: input.source.id,
      parent_version_id: input.sourceVersion?.id ?? null,
      forked_at: new Date().toISOString(),
      fork_source: "asherin_artifact",
      runtime_type: input.source.runtimeType,
      entrypoint: input.source.entrypoint,
      runtime_requirements: JSON.parse(JSON.stringify(input.source.runtimeRequirements ?? {})),
      compatibility_requirements: JSON.parse(JSON.stringify(input.source.compatibilityRequirements ?? {})),
      dependency_manifest: JSON.parse(JSON.stringify(input.source.dependencyManifest ?? [])),
      data_manifest: JSON.parse(JSON.stringify(input.source.dataManifest ?? {})),
      provenance_manifest: JSON.parse(
        JSON.stringify({ ...(input.source.provenanceManifest ?? {}), forkedFrom: input.source.id }),
      ),
    })
    .eq("id", fork.id);
  if (error) throw error;

  const files = await listFiles(input.source.id);
  for (const file of files) {
    await saveFile({ artifactId: fork.id, userId: input.userId, path: file.path, content: file.content, origin: "system" });
  }

  await createVersion({
    artifactId: fork.id,
    userId: input.userId,
    changeSummary: `forked from ${input.source.displayName}`,
    label: "fork point",
    bump: "minor",
    sourceRef: {
      upstreamArtifactId: input.source.id,
      upstreamVersionId: input.sourceVersion?.id ?? null,
      ancestor: snapshot(files),
    },
  });

  await recordEvent({
    artifactId: input.source.id,
    type: "artifact.forked",
    actorUserId: input.userId,
    metadata: { forkArtifactId: fork.id },
  });

  return { ...fork, parentArtifactId: input.source.id, parentVersionId: input.sourceVersion?.id ?? null };
}

/** The snapshot the fork was taken from, used as the merge ancestor. */
export function ancestorFromVersion(version: SoftwareVersion | null | undefined): Snapshot {
  const ref = (version?.sourceRef ?? {}) as Record<string, unknown>;
  const anc = ref.ancestor;
  if (anc && typeof anc === "object" && !Array.isArray(anc)) {
    const out: Snapshot = {};
    for (const [k, v] of Object.entries(anc as Record<string, unknown>)) out[k] = String(v ?? "");
    return out;
  }
  return {};
}
