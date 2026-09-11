// build providers for software artifacts.
//
// A build is a separate concern from a runtime: resolving dependencies,
// installing them, compiling, bundling, emitting static assets and starting a
// server are all capabilities a provider either has or does not have. The
// workspace has exactly one real provider today — a static assembler that
// concatenates the artifact's own html, css and javascript in the browser.
// Everything else is declared unavailable, with the reason, and never faked.

import { buildPreview } from "./preview";
import { detectDependencies, type DependencyRecord } from "./dependencies";
import type { ArtifactFile } from "./types";

export type BuildCapability =
  | "dependency_resolution"
  | "dependency_install"
  | "compile"
  | "bundle"
  | "static_assets"
  | "server_start"
  | "health";

export type CapabilityState = "available" | "configuration_required" | "unavailable";

export interface CapabilityReport {
  capability: BuildCapability;
  state: CapabilityState;
  /** plain language: what happens, or why nothing happens. */
  detail: string;
}

export interface BuildOutcome {
  ok: boolean;
  providerId: string;
  /** the assembled document, when the provider produces one. */
  output: string | null;
  errors: string[];
  warnings: string[];
  dependencies: DependencyRecord[];
  /** set whenever the build did not run at all. */
  unavailableReason: string | null;
  finishedAt: string;
}

export interface BuildProvider {
  id: string;
  label: string;
  state: CapabilityState;
  capabilities: CapabilityReport[];
  /** resolves what the artifact asks for. never fetches anything. */
  resolve(files: ArtifactFile[]): DependencyRecord[];
  build(files: ArtifactFile[]): BuildOutcome;
  /** liveness of the provider itself, not of a running artifact. */
  health(): { ok: boolean; detail: string };
}

function cap(capability: BuildCapability, state: CapabilityState, detail: string): CapabilityReport {
  return { capability, state, detail };
}

/**
 * The only build that actually happens here: the artifact's own files are
 * assembled into a single sandboxed document. No packages, no compiler.
 */
export const staticAssemblyProvider: BuildProvider = {
  id: "static_assembly",
  label: "static assembly",
  state: "available",
  capabilities: [
    cap("dependency_resolution", "available", "declared imports are read from the files and reported, never fetched"),
    cap("dependency_install", "unavailable", "nothing is installed — an external package host would be needed"),
    cap("compile", "unavailable", "typescript and jsx are not compiled here; write html, css and javascript"),
    cap("bundle", "available", "the artifact's own files are inlined into one sandboxed document"),
    cap("static_assets", "available", "css and javascript held in the artifact are emitted with it"),
    cap("server_start", "unavailable", "no server process can be started from this workspace"),
    cap("health", "available", "the assembler runs in this browser tab and reports its own result"),
  ],
  resolve: (files) => detectDependencies(files.map((f) => ({ path: f.path, content: f.content }))),
  build(files) {
    const dependencies = detectDependencies(files.map((f) => ({ path: f.path, content: f.content })));
    const built = buildPreview(files);
    const warnings = dependencies
      .filter((d) => d.installationRequirement !== "not_required")
      .map((d) => `${d.name} is referenced but cannot be installed here`);
    return {
      ok: built.ok,
      providerId: this.id,
      output: built.ok ? built.srcDoc : null,
      errors: built.errors,
      warnings,
      dependencies,
      unavailableReason: built.unavailableReason,
      finishedAt: new Date().toISOString(),
    };
  },
  health: () => ({ ok: true, detail: "static assembly is available in this browser" }),
};

function unavailableProvider(id: string, label: string, reason: string, state: CapabilityState): BuildProvider {
  const all: BuildCapability[] = [
    "dependency_resolution",
    "dependency_install",
    "compile",
    "bundle",
    "static_assets",
    "server_start",
    "health",
  ];
  return {
    id,
    label,
    state,
    capabilities: all.map((c) => cap(c, state, reason)),
    resolve: () => [],
    build: (files) => ({
      ok: false,
      providerId: id,
      output: null,
      errors: [],
      warnings: [],
      dependencies: detectDependencies(files.map((f) => ({ path: f.path, content: f.content }))),
      unavailableReason: reason,
      finishedAt: new Date().toISOString(),
    }),
    health: () => ({ ok: false, detail: reason }),
  };
}

export const toolchainBuildProvider = unavailableProvider(
  "toolchain_build",
  "package + compile toolchain",
  "installing packages and compiling a project needs an external build service, which is not configured for this workspace",
  "configuration_required",
);

export const serverBuildProvider = unavailableProvider(
  "server_build",
  "server build and start",
  "no server runtime is configured, so a built server cannot be started or health-checked",
  "configuration_required",
);

export const BUILD_PROVIDERS: BuildProvider[] = [
  staticAssemblyProvider,
  toolchainBuildProvider,
  serverBuildProvider,
];

/** The provider that can actually build these files, or the honest fallback. */
export function selectBuildProvider(files: ArtifactFile[]): BuildProvider {
  const needsToolchain = files.some((f) => /\.(tsx?|jsx)$/.test(f.path));
  if (needsToolchain) return toolchainBuildProvider;
  return staticAssemblyProvider;
}

/** One line a person can read about where a build stands. */
export function summarizeBuild(outcome: BuildOutcome): string {
  if (outcome.unavailableReason) return outcome.unavailableReason;
  if (!outcome.ok) return outcome.errors[0] ?? "the build did not produce anything runnable";
  const deps = outcome.dependencies.length;
  return deps > 0
    ? `assembled — ${deps} declared dependency(ies) reported, none installed`
    : "assembled from the artifact's own files";
}
