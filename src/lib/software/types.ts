// asherin software domain — phase 1 foundation.
//
// An artifact is a durable thing a person made. Its identity is the uuid and
// nothing else: renaming it changes a label, never a route, a permission, a
// version or a history record.
//
// Everything here is a contract. Nothing in this file claims a runtime
// capability — capability is declared per artifact and reported honestly by
// the surfaces that read it.

export type ArtifactType =
  | "application"
  | "component"
  | "workflow"
  | "pattern_package"
  | "integration_package"
  | "mcp_connector"
  | "other";

export type ArtifactLifecycleStatus =
  | "draft"
  | "building"
  | "running"
  | "testing"
  | "failed"
  | "repairing"
  | "validated"
  | "installed"
  | "update_available"
  | "validating_update"
  | "disabled"
  | "archived"
  | "published";

export type ArtifactVisibility = "private" | "shared" | "unlisted" | "public";

export type ArtifactRole = "owner" | "admin" | "collaborator" | "viewer";

export type VersionValidationStatus = "unvalidated" | "validating" | "validated" | "failed" | "quarantined";
export type VersionReleaseStatus = "draft" | "checkpoint" | "released" | "rolled_back" | "superseded";
export type InstallationUpdateState = "current" | "update_available" | "validating_update" | "failed" | "rolled_back";

/**
 * The lifecycle is a state machine, not a set of booleans. It is mirrored
 * exactly by a database trigger, so an illegal move is refused server side
 * even if a client tries it.
 */
export const LIFECYCLE_TRANSITIONS: Record<ArtifactLifecycleStatus, ArtifactLifecycleStatus[]> = {
  draft: ["building", "archived", "disabled", "draft"],
  building: ["running", "testing", "failed", "validated", "draft", "archived"],
  running: ["testing", "failed", "validated", "disabled", "archived", "building"],
  testing: ["validated", "failed", "repairing", "running", "archived"],
  failed: ["repairing", "building", "draft", "archived", "disabled"],
  repairing: ["building", "testing", "failed", "validated", "archived"],
  validated: ["installed", "published", "building", "testing", "archived", "disabled", "draft"],
  installed: ["update_available", "disabled", "archived", "validated", "published"],
  update_available: ["validating_update", "installed", "disabled", "archived"],
  validating_update: ["installed", "failed", "update_available", "archived"],
  published: ["validated", "installed", "disabled", "archived", "update_available"],
  disabled: ["draft", "validated", "installed", "archived"],
  archived: ["draft", "disabled"],
};

export function canTransition(from: ArtifactLifecycleStatus, to: ArtifactLifecycleStatus): boolean {
  return (LIFECYCLE_TRANSITIONS[from] ?? []).includes(to);
}

/** Human wording for a status. Used everywhere, so it never drifts per screen. */
export const LIFECYCLE_LABEL: Record<ArtifactLifecycleStatus, string> = {
  draft: "draft",
  building: "building",
  running: "running",
  testing: "testing",
  failed: "build failed",
  repairing: "repairing",
  validated: "validated",
  installed: "installed",
  update_available: "update available",
  validating_update: "validating update",
  disabled: "disabled",
  archived: "archived",
  published: "published",
};

/* ── capability / permission boundary ─────────────────────────────────── */

export type CapabilityKey =
  | "ui"
  | "artifact_storage"
  | "project_access"
  | "user_data"
  | "workspace_data"
  | "network"
  | "integrations"
  | "mcp"
  | "privileged_actions";

export interface PermissionManifest {
  /** every capability defaults to denied. A grant is always explicit. */
  granted: CapabilityKey[];
  /** why each grant exists, so an audit can explain it later. */
  rationale: Partial<Record<CapabilityKey, string>>;
  /** hosts an artifact is allowed to reach, when `network` is granted. */
  networkAllowList: string[];
}

export const LEAST_PRIVILEGE: PermissionManifest = {
  granted: ["ui"],
  rationale: { ui: "an artifact must be able to draw itself" },
  networkAllowList: [],
};

export function hasCapability(manifest: PermissionManifest | null | undefined, key: CapabilityKey): boolean {
  return !!manifest?.granted?.includes(key);
}

/* ── integration contract ─────────────────────────────────────────────── */

export type IntegrationKind = "api" | "mcp" | "internal_service" | "other";
export type IntegrationHealth = "unconfigured" | "configured" | "connected" | "failed" | "unavailable";

export interface IntegrationContract {
  id: string;
  provider: string;
  kind: IntegrationKind;
  requiredCapabilities: CapabilityKey[];
  /** true when the provider needs credentials. The credential itself is NEVER here. */
  authenticationRequired: boolean;
  /** name of the secure credential reference, never its value. */
  credentialRef?: string | null;
  permissionScopes: string[];
  inputs: string[];
  outputs: string[];
  events: string[];
  health: IntegrationHealth;
  healthReason?: string;
  version?: string | null;
  compatibility?: string | null;
}

/** Anything credential-shaped is refused before it can reach the database. */
const CREDENTIAL_SHAPE =
  /\b(sk|pk|rk)[-_][A-Za-z0-9][A-Za-z0-9_-]{14,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|-----BEGIN[^-]{0,40}PRIVATE KEY-----/;

export function containsCredentialMaterial(value: unknown): boolean {
  return CREDENTIAL_SHAPE.test(typeof value === "string" ? value : JSON.stringify(value ?? ""));
}

/* ── records ──────────────────────────────────────────────────────────── */

export interface SoftwareArtifact {
  id: string;
  ownerUserId: string;
  displayName: string;
  slug: string | null;
  description: string | null;
  icon: string | null;
  type: ArtifactType;
  lifecycle: ArtifactLifecycleStatus;
  visibility: ArtifactVisibility;
  currentVersionId: string | null;
  runtimeSessionId: string | null;
  runtimeRequirements: Record<string, unknown>;
  compatibilityRequirements: Record<string, unknown>;
  capabilities: CapabilityKey[];
  permissionManifest: PermissionManifest;
  integrationManifest: IntegrationContract[];
  dependencyManifest: Array<{ name: string; version?: string; source?: string }>;
  dataManifest: Record<string, unknown>;
  provenanceManifest: Record<string, unknown>;
  distributionManifest: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface SoftwareVersion {
  id: string;
  artifactId: string;
  ordinal: number;
  displayVersion: string;
  parentVersionId: string | null;
  sourceRef: Record<string, unknown>;
  stateRef: Record<string, unknown>;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
  validationStatus: VersionValidationStatus;
  releaseStatus: VersionReleaseStatus;
  rollbackEligible: boolean;
}

export interface NavigationItem {
  id: string;
  ownerUserId: string;
  artifactId: string | null;
  source: "user" | "installed";
  displayName: string;
  icon: string | null;
  route: string;
  position: number;
  enabled: boolean;
  visibility: ArtifactVisibility;
  configuration: Record<string, unknown>;
}

export interface Installation {
  id: string;
  userId: string;
  artifactId: string;
  artifactVersionId: string | null;
  navigationItemId: string | null;
  installedName: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  permissionGrants: PermissionManifest;
  updateState: InstallationUpdateState;
  installedAt: string;
  updatedAt: string;
}

export type ArtifactEventType =
  | "artifact.created"
  | "artifact.updated"
  | "artifact.renamed"
  | "artifact.version_created"
  | "artifact.build_started"
  | "artifact.build_failed"
  | "artifact.test_started"
  | "artifact.test_failed"
  | "artifact.validated"
  | "artifact.installed"
  | "artifact.uninstalled"
  | "artifact.shared"
  | "artifact.published"
  | "artifact.forked"
  | "artifact.rollback"
  | "artifact.integration_connected"
  | "artifact.integration_failed"
  | "artifact.permission_changed";

export interface ArtifactEvent {
  id: string;
  artifactId: string;
  versionId: string | null;
  actorUserId: string;
  type: ArtifactEventType | string;
  result: "ok" | "failed" | "pending" | "unavailable";
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** The workspace panes. Later phases fill them in; this phase declares them. */
export type WorkspacePane = "build" | "code" | "preview" | "test" | "data" | "files" | "history" | "settings";

export const WORKSPACE_PANES: WorkspacePane[] = [
  "build",
  "code",
  "preview",
  "test",
  "data",
  "files",
  "history",
  "settings",
];

/* ── files, checks and runs ───────────────────────────────────────────── */

export interface ArtifactFile {
  id: string;
  artifactId: string;
  path: string;
  content: string;
  mime: string;
  updatedAt: string;
}

export type ArtifactCheckKind =
  | "no_runtime_error"
  | "no_console_error"
  | "console_contains"
  | "dom_selector_exists"
  | "dom_text_contains";

export interface ArtifactCheck {
  id: string;
  artifactId: string;
  name: string;
  kind: ArtifactCheckKind;
  expectation: string;
  enabled: boolean;
}

/** Something the running artifact actually reported. Never synthesised. */
export interface RunObservation {
  channel: "runtime_error" | "console" | "render" | "performance" | "build";
  level: "info" | "warn" | "error";
  message: string;
  at: string;
}

export interface CheckResult {
  checkId: string;
  name: string;
  status: "passed" | "failed" | "inconclusive";
  detail: string;
}

export interface ArtifactRun {
  id: string;
  artifactId: string;
  versionId: string | null;
  status: "running" | "passed" | "failed" | "unavailable";
  results: CheckResult[];
  observations: RunObservation[];
  unavailableReason: string | null;
  createdAt: string;
}

/** The route an installed artifact is reachable at. Derived from identity only. */
export function artifactRoute(artifactId: string): string {
  return `/dashboard/software/${artifactId}`;
}
