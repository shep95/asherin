// owner-scoped persistence for the software artifact domain.
//
// Every read and write goes through row level security. Ownership is set by a
// database trigger from the authenticated session, so an id supplied by a
// browser can never take effect — the values sent here are for typing only.

import { supabase } from "@/integrations/supabase/client";
import { appRoute, nextPosition } from "./navigation";
import type { Json } from "@/integrations/supabase/types";
import {
  LEAST_PRIVILEGE,
  canTransition,
  containsCredentialMaterial,
  type ArtifactEvent,
  type ArtifactEventType,
  type ArtifactLifecycleStatus,
  type ArtifactRole,
  type ArtifactType,

  type ArtifactVisibility,
  type CapabilityKey,
  type Installation,
  type IntegrationContract,
  type NavigationItem,
  type PermissionManifest,
  type SoftwareArtifact,
  type SoftwareVersion,
} from "./types";

const j = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json;

type Loose = Record<string, unknown>;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toPermission(v: unknown): PermissionManifest {
  const o = obj(v);
  if (!Array.isArray(o.granted)) return { ...LEAST_PRIVILEGE };
  return {
    granted: (o.granted as CapabilityKey[]).filter(Boolean),
    rationale: obj(o.rationale) as PermissionManifest["rationale"],
    networkAllowList: arr<string>(o.networkAllowList),
  };
}

function mapArtifact(row: Loose): SoftwareArtifact {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    displayName: String(row.display_name ?? "untitled artifact"),
    slug: (row.slug as string) ?? null,
    description: (row.description as string) ?? null,
    icon: (row.icon as string) ?? null,
    type: row.artifact_type as ArtifactType,
    lifecycle: row.lifecycle_status as ArtifactLifecycleStatus,
    visibility: row.visibility as ArtifactVisibility,
    currentVersionId: (row.current_version_id as string) ?? null,
    runtimeSessionId: (row.runtime_session_id as string) ?? null,
    entrypoint: (row.entrypoint as string) ?? null,
    runtimeType: (row.runtime_type as SoftwareArtifact["runtimeType"]) ?? "client_browser",
    releaseStatus: (row.release_status as SoftwareArtifact["releaseStatus"]) ?? "draft",
    runtimeRequirements: obj(row.runtime_requirements),
    compatibilityRequirements: obj(row.compatibility_requirements),
    capabilities: arr<CapabilityKey>(row.capabilities),
    permissionManifest: toPermission(row.permission_manifest),
    integrationManifest: arr<IntegrationContract>(row.integration_manifest),
    dependencyManifest: arr(row.dependency_manifest),
    dataManifest: obj(row.data_manifest),
    provenanceManifest: obj(row.provenance_manifest),
    distributionManifest: obj(row.distribution_manifest),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: (row.published_at as string) ?? null,
    parentArtifactId: (row.parent_artifact_id as string) ?? null,
    parentVersionId: (row.parent_version_id as string) ?? null,
    forkedAt: (row.forked_at as string) ?? null,
    forkSource: (row.fork_source as string) ?? null,
  };
}

function mapVersion(row: Loose): SoftwareVersion {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    ordinal: Number(row.ordinal ?? 0),
    displayVersion: String(row.display_version ?? "0.1.0"),
    parentVersionId: (row.parent_version_id as string) ?? null,
    sourceRef: obj(row.source_ref),
    stateRef: obj(row.state_ref),
    changeSummary: (row.change_summary as string) ?? null,
    label: (row.label as string) ?? null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    validationStatus: row.validation_status as SoftwareVersion["validationStatus"],
    releaseStatus: row.release_status as SoftwareVersion["releaseStatus"],
    rollbackEligible: Boolean(row.rollback_eligible),
  };
}

function mapNav(row: Loose): NavigationItem {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    artifactId: (row.artifact_id as string) ?? null,
    installationId: (row.installation_id as string) ?? null,
    source: row.source as NavigationItem["source"],
    section: (row.section as NavigationItem["section"]) ?? "installed",
    displayName: String(row.display_name),
    icon: (row.icon as string) ?? null,
    route: String(row.route),
    position: Number(row.position ?? 0),
    enabled: Boolean(row.enabled),
    visibility: row.visibility as ArtifactVisibility,
    configuration: obj(row.configuration),
  };
}

function mapInstall(row: Loose): Installation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    artifactId: String(row.artifact_id),
    artifactVersionId: (row.artifact_version_id as string) ?? null,
    navigationItemId: (row.navigation_item_id as string) ?? null,
    installedName: String(row.installed_name),
    enabled: Boolean(row.enabled),
    configuration: obj(row.configuration),
    permissionGrants: toPermission(row.permission_grants),
    updateState: row.update_state as Installation["updateState"],
    installedAt: String(row.installed_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Loose): ArtifactEvent {
  return {
    id: String(row.id),
    artifactId: String(row.artifact_id),
    versionId: (row.version_id as string) ?? null,
    actorUserId: String(row.actor_user_id),
    type: String(row.event_type),
    result: row.result as ArtifactEvent["result"],
    metadata: obj(row.metadata),
    createdAt: String(row.created_at),
  };
}

/* ── events ───────────────────────────────────────────────────────────── */

/** Metadata is scrubbed before it is stored: history explains, it never leaks. */
export function safeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/key|token|secret|password|credential|authorization/i.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = containsCredentialMaterial(v) ? "[redacted]" : v;
  }
  return out;
}

export async function recordEvent(input: {
  artifactId: string;
  type: ArtifactEventType | string;
  result?: ArtifactEvent["result"];
  versionId?: string | null;
  metadata?: Record<string, unknown>;
  actorUserId: string;
}): Promise<void> {
  await supabase.from("software_artifact_event").insert({
    artifact_id: input.artifactId,
    version_id: input.versionId ?? null,
    actor_user_id: input.actorUserId,
    event_type: input.type,
    result: input.result ?? "ok",
    metadata: j(safeMetadata(input.metadata ?? {})),
  });
}

export async function listEvents(artifactId: string, limit = 50): Promise<ArtifactEvent[]> {
  const { data } = await supabase
    .from("software_artifact_event")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => mapEvent(r as Loose));
}

/* ── artifacts ────────────────────────────────────────────────────────── */

export async function listArtifacts(): Promise<SoftwareArtifact[]> {
  const { data, error } = await supabase
    .from("software_artifact")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapArtifact(r as Loose));
}

export async function getArtifact(id: string): Promise<SoftwareArtifact | null> {
  const { data, error } = await supabase.from("software_artifact").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapArtifact(data as Loose) : null;
}

export async function createArtifact(input: {
  userId: string;
  displayName: string;
  description?: string;
  type?: ArtifactType;
  permissionManifest?: PermissionManifest;
}): Promise<SoftwareArtifact> {
  const { data, error } = await supabase
    .from("software_artifact")
    .insert({
      owner_user_id: input.userId,
      display_name: input.displayName.trim() || "untitled artifact",
      description: input.description?.trim() || null,
      artifact_type: input.type ?? "application",
      lifecycle_status: "draft",
      visibility: "private",
      permission_manifest: j(input.permissionManifest ?? LEAST_PRIVILEGE),
    })
    .select("*")
    .single();
  if (error) throw error;
  const artifact = mapArtifact(data as Loose);
  await recordEvent({
    artifactId: artifact.id,
    type: "artifact.created",
    actorUserId: input.userId,
    metadata: { type: artifact.type },
  });
  return artifact;
}

/** A rename touches the label only. Identity, routes and history do not move. */
export async function renameArtifact(id: string, displayName: string, actorUserId: string): Promise<SoftwareArtifact> {
  const { data, error } = await supabase
    .from("software_artifact")
    .update({ display_name: displayName.trim() || "untitled artifact" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await recordEvent({ artifactId: id, type: "artifact.renamed", actorUserId, metadata: { displayName } });
  return mapArtifact(data as Loose);
}

export async function updateArtifact(
  id: string,
  patch: Partial<{
    description: string | null;
    icon: string | null;
    visibility: ArtifactVisibility;
    permissionManifest: PermissionManifest;
    integrationManifest: IntegrationContract[];
    dependencyManifest: SoftwareArtifact["dependencyManifest"];
    runtimeRequirements: Record<string, unknown>;
    currentVersionId: string | null;
    runtimeSessionId: string | null;
    entrypoint: string | null;
    runtimeType: SoftwareArtifact["runtimeType"];
    releaseStatus: SoftwareArtifact["releaseStatus"];
    dataManifest: Record<string, unknown>;
  }>,
  actorUserId: string,
): Promise<SoftwareArtifact> {
  const row: Record<string, unknown> = {};
  if ("description" in patch) row.description = patch.description;
  if ("icon" in patch) row.icon = patch.icon;
  if ("visibility" in patch) row.visibility = patch.visibility;
  if (patch.permissionManifest) row.permission_manifest = j(patch.permissionManifest);
  if (patch.integrationManifest) {
    if (patch.integrationManifest.some((i) => containsCredentialMaterial(i))) {
      throw new Error("an integration contract may hold a credential reference, never a credential");
    }
    row.integration_manifest = j(patch.integrationManifest);
  }
  if (patch.dependencyManifest) row.dependency_manifest = j(patch.dependencyManifest);
  if (patch.runtimeRequirements) row.runtime_requirements = j(patch.runtimeRequirements);
  if ("currentVersionId" in patch) row.current_version_id = patch.currentVersionId;
  if ("runtimeSessionId" in patch) row.runtime_session_id = patch.runtimeSessionId;
  if ("entrypoint" in patch) row.entrypoint = patch.entrypoint;
  if (patch.runtimeType) row.runtime_type = patch.runtimeType;
  if (patch.releaseStatus) row.release_status = patch.releaseStatus;
  if (patch.dataManifest) row.data_manifest = j(patch.dataManifest);

  const { data, error } = await supabase.from("software_artifact").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  if (patch.permissionManifest) {
    await recordEvent({ artifactId: id, type: "artifact.permission_changed", actorUserId });
  } else {
    await recordEvent({ artifactId: id, type: "artifact.updated", actorUserId, metadata: { fields: Object.keys(row) } });
  }
  return mapArtifact(data as Loose);
}

/** Refused locally as well as in the database, so the UI never offers a dead move. */
export async function setLifecycle(
  id: string,
  from: ArtifactLifecycleStatus,
  to: ArtifactLifecycleStatus,
  actorUserId: string,
  reason?: string,
): Promise<SoftwareArtifact> {
  if (!canTransition(from, to)) {
    throw new Error(`cannot move an artifact from ${from} to ${to}`);
  }
  const { data, error } = await supabase
    .from("software_artifact")
    .update({ lifecycle_status: to })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await recordEvent({
    artifactId: id,
    type: to === "validated" ? "artifact.validated" : "artifact.updated",
    result: to === "failed" ? "failed" : "ok",
    actorUserId,
    metadata: { from, to, reason: reason ?? null },
  });
  return mapArtifact(data as Loose);
}

export async function deleteArtifact(id: string): Promise<void> {
  const { error } = await supabase.from("software_artifact").delete().eq("id", id);
  if (error) throw error;
}

/* ── versions ─────────────────────────────────────────────────────────── */

export async function listVersions(artifactId: string): Promise<SoftwareVersion[]> {
  const { data, error } = await supabase
    .from("software_artifact_version")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("ordinal", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapVersion(r as Loose));
}

/** The next display version, derived from the parent. Never overwrites. */
export function nextDisplayVersion(previous: string | undefined, kind: "patch" | "minor" | "major" = "minor"): string {
  const [maj, min, pat] = (previous ?? "0.0.0").split(".").map((n) => Number.parseInt(n, 10) || 0);
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "patch") return `${maj}.${min}.${pat + 1}`;
  return `${maj}.${min + 1}.0`;
}

export async function createVersion(input: {
  artifactId: string;
  userId: string;
  changeSummary?: string;
  label?: string;
  sourceRef?: Record<string, unknown>;
  stateRef?: Record<string, unknown>;
  checkpoint?: boolean;
  bump?: "patch" | "minor" | "major";
}): Promise<SoftwareVersion> {
  const existing = await listVersions(input.artifactId);
  const parent = existing[0] ?? null;
  const { data, error } = await supabase
    .from("software_artifact_version")
    .insert({
      artifact_id: input.artifactId,
      owner_user_id: input.userId,
      created_by: input.userId,
      ordinal: (parent?.ordinal ?? 0) + 1,
      display_version: nextDisplayVersion(parent?.displayVersion, input.bump ?? "minor"),
      parent_version_id: parent?.id ?? null,
      source_ref: j(input.sourceRef ?? {}),
      state_ref: j(input.stateRef ?? {}),
      change_summary: input.changeSummary ?? null,
      label: input.label?.trim() || null,
      release_status: input.checkpoint ? "checkpoint" : "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  const version = mapVersion(data as Loose);
  await supabase.from("software_artifact").update({ current_version_id: version.id }).eq("id", input.artifactId);
  await recordEvent({
    artifactId: input.artifactId,
    type: "artifact.version_created",
    versionId: version.id,
    actorUserId: input.userId,
    metadata: { displayVersion: version.displayVersion, checkpoint: !!input.checkpoint },
  });
  return version;
}

/** A restore is a forward move: the old version stays, a new one points at it. */
export async function restoreVersion(input: {
  artifactId: string;
  userId: string;
  version: SoftwareVersion;
}): Promise<SoftwareVersion> {
  if (!input.version.rollbackEligible) {
    throw new Error("this version is not eligible for rollback");
  }
  const restored = await createVersion({
    artifactId: input.artifactId,
    userId: input.userId,
    changeSummary: `restored ${input.version.displayVersion}`,
    sourceRef: input.version.sourceRef,
    stateRef: input.version.stateRef,
    checkpoint: true,
    bump: "patch",
  });
  await supabase.from("software_artifact_version").update({ release_status: "rolled_back" }).eq("id", input.version.id);
  await recordEvent({
    artifactId: input.artifactId,
    type: "artifact.rollback",
    versionId: restored.id,
    actorUserId: input.userId,
    metadata: { restoredFrom: input.version.displayVersion },
  });
  return restored;
}

/* ── navigation registry ──────────────────────────────────────────────── */

export async function listNavigationItems(): Promise<NavigationItem[]> {
  const { data, error } = await supabase
    .from("software_navigation_item")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapNav(r as Loose));
}

export async function upsertNavigationItem(input: {
  userId: string;
  artifactId: string;
  displayName: string;
  route: string;
  icon?: string | null;
  position?: number;
  enabled?: boolean;
  section?: NavigationItem["section"];
  installationId?: string | null;
}): Promise<NavigationItem> {
  const { data, error } = await supabase
    .from("software_navigation_item")
    .insert({
      owner_user_id: input.userId,
      artifact_id: input.artifactId,
      source: "installed",
      display_name: input.displayName,
      route: input.route,
      icon: input.icon ?? null,
      position: input.position ?? 0,
      enabled: input.enabled ?? true,
      section: input.section ?? "installed",
      installation_id: input.installationId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapNav(data as Loose);
}

export async function setNavigationEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("software_navigation_item").update({ enabled }).eq("id", id);
  if (error) throw error;
}

/**
 * A rename touches the label and nothing else — not the route, not the
 * artifact, not the installation. Identity is the id.
 */
export async function renameNavigationItem(id: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  if (!name) throw new Error("a name cannot be empty");
  const { error } = await supabase.from("software_navigation_item").update({ display_name: name }).eq("id", id);
  if (error) throw error;
}

export async function setNavigationIcon(id: string, icon: string | null): Promise<void> {
  const { error } = await supabase.from("software_navigation_item").update({ icon }).eq("id", id);
  if (error) throw error;
}

export async function setNavigationSection(id: string, section: NavigationItem["section"]): Promise<void> {
  const { error } = await supabase.from("software_navigation_item").update({ section }).eq("id", id);
  if (error) throw error;
}

/** Persist a whole order in one pass so no row is left with a stale slot. */
export async function persistNavigationOrder(items: NavigationItem[]): Promise<void> {
  for (const [index, item] of items.entries()) {
    const { error } = await supabase
      .from("software_navigation_item")
      .update({ position: index })
      .eq("id", item.id);
    if (error) throw error;
  }
}

export async function deleteNavigationItem(id: string): Promise<void> {
  const { error } = await supabase.from("software_navigation_item").delete().eq("id", id);
  if (error) throw error;
}

/* ── installations ────────────────────────────────────────────────────── */

export async function listInstallations(): Promise<Installation[]> {
  const { data, error } = await supabase.from("software_installation").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => mapInstall(r as Loose));
}

export async function installArtifact(input: {
  userId: string;
  artifact: SoftwareArtifact;
  versionId: string | null;
  installedName?: string;
  grants?: PermissionManifest;
  addToNavigation?: boolean;
  section?: NavigationItem["section"];
  icon?: string | null;
  configuration?: Record<string, unknown>;
}): Promise<Installation> {
  const name = input.installedName?.trim() || input.artifact.displayName;
  let navId: string | null = null;
  if (input.addToNavigation) {
    const existing = await listNavigationItems();
    const nav = await upsertNavigationItem({
      userId: input.userId,
      artifactId: input.artifact.id,
      displayName: name,
      route: appRoute(input.artifact.id),
      icon: input.icon ?? input.artifact.icon,
      section: input.section ?? "installed",
      position: nextPosition(existing, input.section ?? "installed"),
    });
    navId = nav.id;
  }
  const { data, error } = await supabase
    .from("software_installation")
    .insert({
      user_id: input.userId,
      artifact_id: input.artifact.id,
      artifact_version_id: input.versionId,
      navigation_item_id: navId,
      installed_name: name,
      configuration: j(input.configuration ?? {}),
      permission_grants: j(input.grants ?? input.artifact.permissionManifest),
    })
    .select("*")
    .single();
  if (error) throw error;
  if (navId) {
    await supabase
      .from("software_navigation_item")
      .update({ installation_id: (data as Loose).id as string })
      .eq("id", navId);
  }
  await recordEvent({
    artifactId: input.artifact.id,
    type: "artifact.installed",
    versionId: input.versionId,
    actorUserId: input.userId,
    metadata: { navigation: !!navId },
  });
  return mapInstall(data as Loose);
}

export async function uninstallArtifact(input: {
  installation: Installation;
  actorUserId: string;
}): Promise<void> {
  if (input.installation.navigationItemId) {
    await deleteNavigationItem(input.installation.navigationItemId);
  }
  const { error } = await supabase.from("software_installation").delete().eq("id", input.installation.id);
  if (error) throw error;
  await recordEvent({
    artifactId: input.installation.artifactId,
    type: "artifact.uninstalled",
    actorUserId: input.actorUserId,
  });
}

export async function setInstallationEnabled(installation: Installation, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("software_installation").update({ enabled }).eq("id", installation.id);
  if (error) throw error;
  if (installation.navigationItemId) await setNavigationEnabled(installation.navigationItemId, enabled);
}

/** The label a person chose for their copy. Identity is untouched. */
export async function renameInstallation(installation: Installation, name: string): Promise<void> {
  const next = name.trim();
  if (!next) throw new Error("a name cannot be empty");
  const { error } = await supabase
    .from("software_installation")
    .update({ installed_name: next })
    .eq("id", installation.id);
  if (error) throw error;
  if (installation.navigationItemId) await renameNavigationItem(installation.navigationItemId, next);
}

/** Installation-specific settings. Never a place for a credential. */
export async function updateInstallationConfiguration(
  installation: Installation,
  configuration: Record<string, unknown>,
): Promise<void> {
  if (containsCredentialMaterial(configuration)) {
    throw new Error("settings cannot hold a key or password — connect an integration instead");
  }
  const { error } = await supabase
    .from("software_installation")
    .update({ configuration: j(configuration) })
    .eq("id", installation.id);
  if (error) throw error;
}

/** A new capability is never granted quietly — the caller has already asked. */
export async function grantInstallationPermissions(
  installation: Installation,
  grants: PermissionManifest,
  actorUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from("software_installation")
    .update({ permission_grants: j(grants), update_state: "current" })
    .eq("id", installation.id);
  if (error) throw error;
  await recordEvent({
    artifactId: installation.artifactId,
    type: "artifact.permission_changed",
    actorUserId,
    metadata: { granted: grants.granted },
  });
}

/** Deletes every row an artifact stored for itself. Nothing outside it. */
export async function deleteArtifactData(artifactId: string): Promise<number> {
  const { data, error } = await supabase
    .from("software_artifact_data")
    .delete()
    .eq("artifact_id", artifactId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/**
 * The caller's membership role on an artifact they do not own.
 * Returns null when there is no membership row — visibility alone grants nothing.
 */
export async function getMemberRole(artifactId: string, userId: string): Promise<ArtifactRole | null> {
  const { data, error } = await supabase
    .from("software_artifact_member")
    .select("role")
    .eq("artifact_id", artifactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role as ArtifactRole;
}
