// updates and rollback for installed applications.
//
// An installed app never changes underneath the person using it. A newer
// version is offered with its changelog, its permission difference and its
// integration difference; anything that widens access needs an explicit yes,
// and rollback is a forward move that keeps every earlier record.

import { supabase } from "@/integrations/supabase/client";
import { recordEvent } from "./store";
import type {
  ArtifactRun,
  CapabilityKey,
  Installation,
  IntegrationContract,
  PermissionManifest,
  SoftwareArtifact,
  SoftwareVersion,
} from "./types";

export interface ManifestDiff<T> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

function diffList<T>(before: T[], after: T[], key: (v: T) => string): ManifestDiff<T> {
  const b = new Map(before.map((v) => [key(v), v]));
  const a = new Map(after.map((v) => [key(v), v]));
  return {
    added: [...a].filter(([k]) => !b.has(k)).map(([, v]) => v),
    removed: [...b].filter(([k]) => !a.has(k)).map(([, v]) => v),
    unchanged: [...a].filter(([k]) => b.has(k)).map(([, v]) => v),
  };
}

export interface UpdatePlan {
  available: boolean;
  fromVersion: SoftwareVersion | null;
  toVersion: SoftwareVersion | null;
  changelog: string;
  permissions: ManifestDiff<CapabilityKey>;
  networkHosts: ManifestDiff<string>;
  integrations: ManifestDiff<{ id: string; provider: string; scopes: string[] }>;
  dependencies: ManifestDiff<{ name: string; version?: string }>;
  /** true when the new version asks for anything the installation has not granted. */
  requiresApproval: boolean;
  escalations: string[];
  compatible: boolean;
  compatibilityReason: string;
  blockers: string[];
}

export function planUpdate(input: {
  artifact: SoftwareArtifact;
  installation: Installation;
  installedVersion: SoftwareVersion | null;
  candidateVersion: SoftwareVersion | null;
  grantedPermissions?: PermissionManifest;
  installedIntegrations?: IntegrationContract[];
  installedDependencies?: Array<{ name: string; version?: string }>;
}): UpdatePlan {
  const granted = input.grantedPermissions ?? input.installation.permissionGrants;
  const permissions = diffList<CapabilityKey>(granted?.granted ?? [], input.artifact.permissionManifest?.granted ?? [], (v) => v);
  const networkHosts = diffList<string>(
    granted?.networkAllowList ?? [],
    input.artifact.permissionManifest?.networkAllowList ?? [],
    (v) => v,
  );
  const integrations = diffList(
    (input.installedIntegrations ?? []).map((i) => ({ id: i.id, provider: i.provider, scopes: i.permissionScopes ?? [] })),
    (input.artifact.integrationManifest ?? []).map((i) => ({ id: i.id, provider: i.provider, scopes: i.permissionScopes ?? [] })),
    (v) => v.id,
  );
  const dependencies = diffList(
    input.installedDependencies ?? [],
    (input.artifact.dependencyManifest ?? []).map((d) => ({ name: d.name, version: d.version })),
    (v) => `${v.name}@${v.version ?? "*"}`,
  );

  const escalations = [
    ...permissions.added.map((c) => `new capability: ${c}`),
    ...networkHosts.added.map((h) => `new network host: ${h}`),
    ...integrations.added.map((i) => `new integration: ${i.provider}`),
  ];

  const available =
    !!input.candidateVersion && input.candidateVersion.id !== (input.installation.artifactVersionId ?? input.installedVersion?.id ?? null);

  const compatible = input.artifact.runtimeType === "client_browser";
  const blockers: string[] = [];
  if (input.candidateVersion?.validationStatus === "quarantined") blockers.push("the new version is quarantined");
  if (input.candidateVersion?.validationStatus === "failed") blockers.push("the new version failed validation");
  if (!compatible) blockers.push(`this runtime is ${input.artifact.runtimeType}; asherin can only activate browser runtimes`);

  return {
    available,
    fromVersion: input.installedVersion ?? null,
    toVersion: input.candidateVersion ?? null,
    changelog: input.candidateVersion?.changeSummary?.trim() || "no changelog was written for this version",
    permissions,
    networkHosts,
    integrations,
    dependencies,
    requiresApproval: escalations.length > 0,
    escalations,
    compatible,
    compatibilityReason: compatible ? "" : `runtime ${input.artifact.runtimeType} cannot be started here`,
    blockers,
  };
}

export interface UpdateGate {
  ok: boolean;
  reason: string;
}

/** The gate every activation passes through. Tests must have actually run. */
export function updateGate(input: { plan: UpdatePlan; run: ArtifactRun | null; approved: boolean }): UpdateGate {
  if (!input.plan.available) return { ok: false, reason: "this installation is already on the newest version" };
  if (input.plan.blockers.length) return { ok: false, reason: input.plan.blockers[0] };
  if (!input.run) return { ok: false, reason: "run the tests against the new version before activating it" };
  if (input.run.status === "failed") return { ok: false, reason: "the new version failed its tests" };
  if (input.run.status === "unavailable") {
    return { ok: false, reason: input.run.unavailableReason || "tests could not run against the new version" };
  }
  if (input.plan.requiresApproval && !input.approved) {
    return { ok: false, reason: "this version asks for more access than you granted; approve it first" };
  }
  return { ok: true, reason: "" };
}

/* ── persistence ──────────────────────────────────────────────────────── */

export async function markUpdateAvailable(installation: Installation, actorUserId: string): Promise<void> {
  const { error } = await supabase
    .from("software_installation")
    .update({ update_state: "update_available" })
    .eq("id", installation.id);
  if (error) throw error;
  await recordEvent({
    artifactId: installation.artifactId,
    type: "artifact.update_available",
    actorUserId,
    metadata: { installationId: installation.id },
  });
}

export async function activateUpdate(input: {
  installation: Installation;
  version: SoftwareVersion;
  plan: UpdatePlan;
  run: ArtifactRun | null;
  approved: boolean;
  actorUserId: string;
}): Promise<Installation> {
  const gate = updateGate({ plan: input.plan, run: input.run, approved: input.approved });
  if (!gate.ok) throw new Error(gate.reason);

  const grants: PermissionManifest = {
    granted: Array.from(new Set([...(input.installation.permissionGrants?.granted ?? []), ...input.plan.permissions.added])),
    rationale: input.installation.permissionGrants?.rationale ?? {},
    networkAllowList: Array.from(
      new Set([...(input.installation.permissionGrants?.networkAllowList ?? []), ...input.plan.networkHosts.added]),
    ),
  };

  const { data, error } = await supabase
    .from("software_installation")
    .update({
      artifact_version_id: input.version.id,
      update_state: "current",
      permission_grants: JSON.parse(JSON.stringify(grants)),
    })
    .eq("id", input.installation.id)
    .select("*")
    .single();
  if (error) throw error;

  await recordEvent({
    artifactId: input.installation.artifactId,
    versionId: input.version.id,
    type: "artifact.updated",
    actorUserId: input.actorUserId,
    metadata: {
      installationId: input.installation.id,
      to: input.version.displayVersion,
      escalations: input.plan.escalations,
      approved: input.approved,
    },
  });

  const row = data as Record<string, unknown>;
  return {
    ...input.installation,
    artifactVersionId: String(row.artifact_version_id),
    updateState: "current",
    permissionGrants: grants,
  };
}

/** Rollback points the installation at an earlier version. Nothing is deleted. */
export async function rollbackInstallation(input: {
  installation: Installation;
  version: SoftwareVersion;
  actorUserId: string;
}): Promise<Installation> {
  if (!input.version.rollbackEligible) throw new Error("that version is not eligible for rollback");
  const { error } = await supabase
    .from("software_installation")
    .update({ artifact_version_id: input.version.id, update_state: "rolled_back" })
    .eq("id", input.installation.id);
  if (error) throw error;
  await recordEvent({
    artifactId: input.installation.artifactId,
    versionId: input.version.id,
    type: "artifact.rollback",
    actorUserId: input.actorUserId,
    metadata: { installationId: input.installation.id, to: input.version.displayVersion },
  });
  return { ...input.installation, artifactVersionId: input.version.id, updateState: "rolled_back" };
}
