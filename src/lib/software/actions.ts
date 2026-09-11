// the auditable action vocabulary of the software workspace.
//
// Every meaningful thing done to an artifact — by the person or by asherin —
// is one of these, is attributed to an actor, and is recorded against the
// artifact and its version.

import { recordEvent, safeMetadata } from "./store";

export const ARTIFACT_ACTIONS = [
  "inspect_file",
  "inspect_directory",
  "create_file",
  "edit_file",
  "delete_file",
  "rename_file",
  "move_file",
  "create_component",
  "modify_component",
  "create_data_model",
  "modify_data_model",
  "create_route",
  "modify_route",
  "create_test",
  "run_build",
  "run_preview",
  "run_test",
  "inspect_error",
  "create_checkpoint",
  "compare_versions",
  "restore_version",
  "prepare_installation",
] as const;

export type ArtifactActionName = (typeof ARTIFACT_ACTIONS)[number];

export type ActionActor = "user" | "ai" | "system";

/** Actions that change the artifact rather than only reading it. */
export const MUTATING_ACTIONS: ArtifactActionName[] = [
  "create_file",
  "edit_file",
  "delete_file",
  "rename_file",
  "move_file",
  "create_component",
  "modify_component",
  "create_data_model",
  "modify_data_model",
  "create_route",
  "modify_route",
  "create_test",
  "create_checkpoint",
  "restore_version",
  "prepare_installation",
];

/** Actions a person must confirm before asherin performs them. */
export const APPROVAL_REQUIRED: ArtifactActionName[] = [
  "delete_file",
  "modify_data_model",
  "restore_version",
  "prepare_installation",
];

export function requiresApproval(action: ArtifactActionName): boolean {
  return APPROVAL_REQUIRED.includes(action);
}

export function isMutating(action: ArtifactActionName): boolean {
  return MUTATING_ACTIONS.includes(action);
}

export interface ActionRecord {
  action: ArtifactActionName;
  actor: ActionActor;
  artifactId: string;
  versionId?: string | null;
  actorUserId: string;
  target?: string;
  result?: "ok" | "failed" | "unavailable";
  detail?: Record<string, unknown>;
}

/** Writes the action to the artifact event log. Credentials never reach it. */
export async function recordAction(record: ActionRecord): Promise<void> {
  await recordEvent({
    artifactId: record.artifactId,
    versionId: record.versionId ?? null,
    type: isMutating(record.action) ? "artifact.updated" : "artifact.inspected",
    result: record.result ?? "ok",
    actorUserId: record.actorUserId,
    metadata: safeMetadata({
      action: record.action,
      actor: record.actor,
      target: record.target ?? null,
      ...(record.detail ?? {}),
    }),
  });
}
