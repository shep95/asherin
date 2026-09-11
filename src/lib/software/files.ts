// artifact source files, saved checks and check runs.
//
// A file is real content owned by an artifact, not a label. Checks are
// assertions the person wrote; a run records what was actually observed when
// the artifact executed. Nothing here invents a result: if the artifact cannot
// run, the run is recorded as unavailable with the reason.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ArtifactFile, ArtifactCheck, ArtifactCheckKind, ArtifactRun, CheckResult, RunObservation } from "./types";

const j = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json;
type Loose = Record<string, unknown>;

function mapFile(row: Loose): ArtifactFile {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    path: String(row.path),
    content: String(row.content ?? ""),
    mime: String(row.mime ?? "text/plain"),
    updatedAt: String(row.updated_at),
    origin: (row.origin as ArtifactFile["origin"]) ?? "user",
    deletedAt: (row.deleted_at as string) ?? null,
  };
}


function mapCheck(row: Loose): ArtifactCheck {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    name: String(row.name),
    kind: row.kind as ArtifactCheckKind,
    expectation: String(row.expectation ?? ""),
    enabled: Boolean(row.enabled),
  };
}

function mapRun(row: Loose): ArtifactRun {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    versionId: (row.version_id as string) ?? null,
    status: row.status as ArtifactRun["status"],
    results: Array.isArray(row.results) ? (row.results as unknown as CheckResult[]) : [],
    observations: Array.isArray(row.observations) ? (row.observations as unknown as RunObservation[]) : [],
    unavailableReason: (row.unavailable_reason as string) ?? null,
    createdAt: String(row.created_at),
  };
}

/* ── files ────────────────────────────────────────────────────────────── */

export function mimeForPath(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (/\.(m?jsx?|tsx?)$/.test(path)) return "text/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

/** A path must be relative, plain and free of traversal. Refused before the db. */
export function normalisePath(path: string): string {
  const clean = path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("..") || clean.length > 240) {
    throw new Error("that file name is not allowed — use a simple relative path");
  }
  return clean;
}

export async function listFiles(artifactId: string): Promise<ArtifactFile[]> {
  const { data, error } = await supabase
    .from("software_artifact_file")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("path", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapFile(r as Loose));
}

export async function saveFile(input: {
  artifactId: string;
  userId: string;
  path: string;
  content: string;
}): Promise<ArtifactFile> {
  const path = normalisePath(input.path);
  const { data, error } = await supabase
    .from("software_artifact_file")
    .upsert(
      {
        artifact_id: input.artifactId,
        owner_user_id: input.userId,
        path,
        content: input.content,
        mime: mimeForPath(path),
      },
      { onConflict: "artifact_id,path" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapFile(data as Loose);
}

export async function deleteFile(id: string): Promise<void> {
  const { error } = await supabase.from("software_artifact_file").delete().eq("id", id);
  if (error) throw error;
}

/* ── checks ───────────────────────────────────────────────────────────── */

export async function listChecks(artifactId: string): Promise<ArtifactCheck[]> {
  const { data, error } = await supabase
    .from("software_artifact_check")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapCheck(r as Loose));
}

export async function addCheck(input: {
  artifactId: string;
  userId: string;
  name: string;
  kind: ArtifactCheckKind;
  expectation?: string;
}): Promise<ArtifactCheck> {
  const { data, error } = await supabase
    .from("software_artifact_check")
    .insert({
      artifact_id: input.artifactId,
      owner_user_id: input.userId,
      name: input.name.trim() || "unnamed check",
      kind: input.kind,
      expectation: input.expectation?.trim() ?? "",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapCheck(data as Loose);
}

export async function deleteCheck(id: string): Promise<void> {
  const { error } = await supabase.from("software_artifact_check").delete().eq("id", id);
  if (error) throw error;
}

/* ── runs ─────────────────────────────────────────────────────────────── */

export async function listRuns(artifactId: string, limit = 10): Promise<ArtifactRun[]> {
  const { data, error } = await supabase
    .from("software_artifact_run")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapRun(r as Loose));
}

export async function recordRun(input: {
  artifactId: string;
  userId: string;
  versionId?: string | null;
  status: ArtifactRun["status"];
  results: CheckResult[];
  observations: RunObservation[];
  unavailableReason?: string | null;
}): Promise<ArtifactRun> {
  const { data, error } = await supabase
    .from("software_artifact_run")
    .insert({
      artifact_id: input.artifactId,
      owner_user_id: input.userId,
      version_id: input.versionId ?? null,
      status: input.status,
      results: j(input.results),
      observations: j(input.observations.slice(-200)),
      unavailable_reason: input.unavailableReason ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRun(data as Loose);
}

/**
 * Puts a checkpoint's files back. Files the checkpoint carried are written
 * over the current ones; files it never held are left alone, so a restore
 * cannot silently destroy work that has no counterpart in the past.
 */
export async function restoreFiles(input: {
  artifactId: string;
  userId: string;
  sourceRef: Record<string, unknown>;
}): Promise<ArtifactFile[]> {
  const carried = Array.isArray((input.sourceRef as { files?: unknown }).files)
    ? ((input.sourceRef as { files: Array<{ path?: unknown; content?: unknown }> }).files)
    : [];
  for (const f of carried) {
    if (typeof f?.path !== "string") continue;
    // sequential on purpose: paths are unique and order keeps failures legible.
    // eslint-disable-next-line no-await-in-loop
    await saveFile({
      artifactId: input.artifactId,
      userId: input.userId,
      path: f.path,
      content: typeof f.content === "string" ? f.content : "",
    });
  }
  return listFiles(input.artifactId);
}
