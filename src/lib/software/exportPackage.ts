// download and export for software artifacts.
//
// An export is only ever built from what the artifact itself owns. Credentials,
// tokens, session material, other people's rows and unrelated workspace data
// are never gathered, and a format that this runtime cannot honestly produce is
// labelled unavailable instead of being faked.

import { supabase } from "@/integrations/supabase/client";
import { recordEvent } from "./store";
import {
  containsCredentialMaterial,
  type ArtifactFile,
  type ExportRecord,
  type SoftwareArtifact,
  type SoftwareVersion,
} from "./types";

export type ExportFormat =
  | "source_project"
  | "artifact_package"
  | "standalone_web_app"
  | "manifest"
  | "data_schema"
  | "documentation"
  | "integration_manifest"
  | "pattern_dependencies";

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  source_project: "source project",
  artifact_package: "asherin artifact package",
  standalone_web_app: "standalone web app",
  manifest: "manifest and configuration",
  data_schema: "data schema",
  documentation: "documentation",
  integration_manifest: "integration manifest",
  pattern_dependencies: "pattern dependencies",
};

export interface FormatAvailability {
  format: ExportFormat;
  available: boolean;
  reason: string;
}

/**
 * A standalone build only exists when the artifact runs in the browser from
 * files it already contains. Anything needing a compiler or a server cannot be
 * produced here, and says so.
 */
export function formatAvailability(artifact: SoftwareArtifact, files: ArtifactFile[]): FormatAvailability[] {
  const live = files.filter((f) => !f.deletedAt);
  const hasHtml = live.some((f) => f.path.toLowerCase().endsWith(".html"));
  return [
    { format: "source_project", available: live.length > 0, reason: live.length ? "" : "this artifact has no files yet" },
    { format: "artifact_package", available: true, reason: "" },
    {
      format: "standalone_web_app",
      available: artifact.runtimeType === "client_browser" && hasHtml,
      reason:
        artifact.runtimeType === "client_browser"
          ? hasHtml
            ? ""
            : "a standalone build needs an html entry file"
          : "a standalone build needs a browser runtime; this artifact declares " + artifact.runtimeType,
    },
    { format: "manifest", available: true, reason: "" },
    {
      format: "data_schema",
      available: Object.keys(artifact.dataManifest ?? {}).length > 0,
      reason: "this artifact has not declared a data schema",
    },
    { format: "documentation", available: true, reason: "" },
    {
      format: "integration_manifest",
      available: (artifact.integrationManifest ?? []).length > 0,
      reason: "this artifact requests no integrations",
    },
    {
      format: "pattern_dependencies",
      available: (artifact.dependencyManifest ?? []).length > 0,
      reason: "this artifact declares no dependencies",
    },
  ];
}

/* ── validation scans ─────────────────────────────────────────────────── */

export type ScanSeverity = "pass" | "warn" | "block";

export interface ScanFinding {
  scan: "secrets" | "private_data" | "dependencies" | "license" | "manifest";
  severity: ScanSeverity;
  detail: string;
  path?: string;
}

const PRIVATE_MARKERS = [
  /sb-[a-z0-9]+-auth-token/i,
  /supabase[_-]?service[_-]?role/i,
  /\bauthorization:\s*bearer\s+\S+/i,
  /"access_token"\s*:/i,
  /"refresh_token"\s*:/i,
];

const ENV_ASSIGNMENT = /^[A-Z][A-Z0-9_]{3,}\s*=\s*\S{8,}$/;

export function scanExport(input: {
  artifact: SoftwareArtifact;
  files: ArtifactFile[];
}): { findings: ScanFinding[]; blocked: boolean } {
  const findings: ScanFinding[] = [];
  const live = input.files.filter((f) => !f.deletedAt);

  for (const file of live) {
    if (containsCredentialMaterial(file.content)) {
      findings.push({
        scan: "secrets",
        severity: "block",
        detail: "this file contains something shaped like a key or token",
        path: file.path,
      });
      continue;
    }
    const envLine = file.content.split("\n").find((l) => ENV_ASSIGNMENT.test(l.trim()));
    if (envLine) {
      findings.push({
        scan: "secrets",
        severity: "warn",
        detail: "this file assigns an environment-style value; check it is not a credential",
        path: file.path,
      });
    }
    if (PRIVATE_MARKERS.some((re) => re.test(file.content))) {
      findings.push({
        scan: "private_data",
        severity: "block",
        detail: "this file references private asherin session data",
        path: file.path,
      });
    }
  }

  for (const dep of input.artifact.dependencyManifest ?? []) {
    if (!dep.version) {
      findings.push({ scan: "dependencies", severity: "warn", detail: `${dep.name} has no pinned version` });
    }
    if (dep.source && !/^https:\/\//.test(dep.source) && dep.source !== "bundled" && dep.source !== "cdn") {
      findings.push({ scan: "dependencies", severity: "warn", detail: `${dep.name} comes from an unverified source` });
    }
  }

  const provenance = input.artifact.provenanceManifest ?? {};
  if (!provenance.license) {
    findings.push({ scan: "license", severity: "warn", detail: "no license is recorded for this artifact" });
  }

  if (!input.artifact.displayName?.trim()) {
    findings.push({ scan: "manifest", severity: "block", detail: "the artifact has no name" });
  }
  if (live.length === 0) {
    findings.push({ scan: "manifest", severity: "warn", detail: "the package contains no files" });
  }

  if (findings.length === 0) {
    findings.push({ scan: "manifest", severity: "pass", detail: "manifest, files, dependencies and provenance all read clean" });
  }

  return { findings, blocked: findings.some((f) => f.severity === "block") };
}

/* ── package assembly ─────────────────────────────────────────────────── */

export interface PackageManifest {
  artifactId: string;
  name: string;
  version: string | null;
  versionId: string | null;
  type: string;
  provenance: Record<string, unknown>;
  lineage: { parentArtifactId: string | null; parentVersionId: string | null; forkedAt: string | null };
  dependencies: Array<{ name: string; version?: string; source?: string }>;
  runtimeRequirements: Record<string, unknown>;
  runtimeType: string;
  permissions: { granted: string[]; networkAllowList: string[] };
  integrations: Array<{ id: string; provider: string; kind: string; scopes: string[] }>;
  compatibility: Record<string, unknown>;
  license: unknown;
  exportedAt: string;
  format: ExportFormat;
}

export function buildManifest(input: {
  artifact: SoftwareArtifact;
  version: SoftwareVersion | null;
  format: ExportFormat;
  now?: string;
}): PackageManifest {
  const a = input.artifact;
  return {
    artifactId: a.id,
    name: a.displayName,
    version: input.version?.displayVersion ?? null,
    versionId: input.version?.id ?? null,
    type: a.type,
    provenance: a.provenanceManifest ?? {},
    lineage: { parentArtifactId: a.parentArtifactId, parentVersionId: a.parentVersionId, forkedAt: a.forkedAt },
    dependencies: a.dependencyManifest ?? [],
    runtimeRequirements: a.runtimeRequirements ?? {},
    runtimeType: a.runtimeType,
    permissions: {
      granted: a.permissionManifest?.granted ?? [],
      networkAllowList: a.permissionManifest?.networkAllowList ?? [],
    },
    // credential references are names of secrets, never their values, and are
    // deliberately dropped from anything that leaves asherin.
    integrations: (a.integrationManifest ?? []).map((i) => ({
      id: i.id,
      provider: i.provider,
      kind: i.kind,
      scopes: i.permissionScopes ?? [],
    })),
    compatibility: a.compatibilityRequirements ?? {},
    license: (a.provenanceManifest ?? {}).license ?? null,
    exportedAt: input.now ?? new Date().toISOString(),
    format: input.format,
  };
}

export interface ExportPackage {
  filename: string;
  mime: string;
  content: string;
  manifest: PackageManifest;
  findings: ScanFinding[];
}

function documentation(artifact: SoftwareArtifact, files: ArtifactFile[], manifest: PackageManifest): string {
  const live = files.filter((f) => !f.deletedAt);
  return [
    `# ${artifact.displayName}`,
    "",
    artifact.description ?? "no description was written for this artifact.",
    "",
    `- type: ${artifact.type}`,
    `- runtime: ${artifact.runtimeType}`,
    `- version: ${manifest.version ?? "unversioned"}`,
    `- entrypoint: ${artifact.entrypoint ?? "not set"}`,
    "",
    "## files",
    ...live.map((f) => `- ${f.path}`),
    "",
    "## permissions",
    ...(manifest.permissions.granted.length ? manifest.permissions.granted.map((p) => `- ${p}`) : ["- none beyond drawing itself"]),
    "",
    "## integrations",
    ...(manifest.integrations.length
      ? manifest.integrations.map((i) => `- ${i.provider} (${i.kind}) scopes: ${i.scopes.join(", ") || "none"}`)
      : ["- none"]),
  ].join("\n");
}

function standalone(files: ArtifactFile[], entrypoint: string | null): string {
  const live = files.filter((f) => !f.deletedAt);
  const html = live.find((f) => f.path === entrypoint) ?? live.find((f) => f.path.toLowerCase().endsWith(".html"));
  if (!html) throw new Error("a standalone build needs an html entry file");
  const css = live.filter((f) => f.path.endsWith(".css")).map((f) => `<style>\n${f.content}\n</style>`).join("\n");
  const js = live.filter((f) => f.path.endsWith(".js")).map((f) => `<script>\n${f.content}\n</script>`).join("\n");
  return html.content.includes("</body>")
    ? html.content.replace("</body>", `${css}\n${js}\n</body>`)
    : `${html.content}\n${css}\n${js}`;
}

const safeName = (s: string) => (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact");

export function buildExport(input: {
  artifact: SoftwareArtifact;
  version: SoftwareVersion | null;
  files: ArtifactFile[];
  format: ExportFormat;
  now?: string;
}): ExportPackage {
  const availability = formatAvailability(input.artifact, input.files).find((f) => f.format === input.format);
  if (availability && !availability.available) {
    throw new Error(availability.reason || "that format is not available for this artifact");
  }
  const scan = scanExport({ artifact: input.artifact, files: input.files });
  if (scan.blocked) {
    throw new Error("export blocked: " + scan.findings.filter((f) => f.severity === "block")[0].detail);
  }
  const manifest = buildManifest({ artifact: input.artifact, version: input.version, format: input.format, now: input.now });
  const live = input.files.filter((f) => !f.deletedAt).map((f) => ({ path: f.path, mime: f.mime, content: f.content }));
  const base = safeName(input.artifact.displayName);

  switch (input.format) {
    case "standalone_web_app":
      return {
        filename: `${base}.html`,
        mime: "text/html",
        content: standalone(input.files, input.artifact.entrypoint),
        manifest,
        findings: scan.findings,
      };
    case "documentation":
      return {
        filename: `${base}-readme.md`,
        mime: "text/markdown",
        content: documentation(input.artifact, input.files, manifest),
        manifest,
        findings: scan.findings,
      };
    case "manifest":
      return { filename: `${base}-manifest.json`, mime: "application/json", content: JSON.stringify(manifest, null, 2), manifest, findings: scan.findings };
    case "data_schema":
      return {
        filename: `${base}-data-schema.json`,
        mime: "application/json",
        content: JSON.stringify(input.artifact.dataManifest ?? {}, null, 2),
        manifest,
        findings: scan.findings,
      };
    case "integration_manifest":
      return {
        filename: `${base}-integrations.json`,
        mime: "application/json",
        content: JSON.stringify(manifest.integrations, null, 2),
        manifest,
        findings: scan.findings,
      };
    case "pattern_dependencies":
      return {
        filename: `${base}-dependencies.json`,
        mime: "application/json",
        content: JSON.stringify(manifest.dependencies, null, 2),
        manifest,
        findings: scan.findings,
      };
    case "source_project":
      return {
        filename: `${base}-source.json`,
        mime: "application/json",
        content: JSON.stringify({ manifest, files: live }, null, 2),
        manifest,
        findings: scan.findings,
      };
    case "artifact_package":
    default:
      return {
        filename: `${base}-artifact.json`,
        mime: "application/json",
        content: JSON.stringify(
          {
            manifest,
            files: live,
            versions: input.version ? [{ id: input.version.id, displayVersion: input.version.displayVersion, label: input.version.label }] : [],
          },
          null,
          2,
        ),
        manifest,
        findings: scan.findings,
      };
  }
}

/* ── persistence and delivery ─────────────────────────────────────────── */

export async function recordExport(input: {
  artifactId: string;
  versionId: string | null;
  actorUserId: string;
  format: ExportFormat;
  status: ExportRecord["status"];
  manifest: Record<string, unknown>;
  findings: ScanFinding[];
}): Promise<void> {
  const { error } = await supabase.from("software_artifact_export").insert({
    artifact_id: input.artifactId,
    version_id: input.versionId,
    actor_user_id: input.actorUserId,
    format: input.format,
    status: input.status,
    manifest: JSON.parse(JSON.stringify(input.manifest)),
    scan: JSON.parse(JSON.stringify({ findings: input.findings })),
  });
  if (error) throw error;
  await recordEvent({
    artifactId: input.artifactId,
    versionId: input.versionId,
    type: "artifact.exported",
    actorUserId: input.actorUserId,
    result: input.status === "created" ? "ok" : "failed",
    metadata: { format: input.format, findings: input.findings.length },
  });
}

export function downloadPackage(pkg: ExportPackage): void {
  const blob = new Blob([pkg.content], { type: pkg.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pkg.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
