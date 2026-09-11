// runtime providers for software artifacts.
//
// The browser sandbox is one provider, not the whole architecture. Every other
// runtime class is declared here as unavailable with the reason it is
// unavailable — asherin never claims to run something it cannot run.

import { buildPreview, SANDBOX_ATTR, SANDBOX_LIMITS, type PreviewBuild } from "./preview";
import type { ArtifactFile, RunObservation } from "./types";

export type RuntimeClass = "client_browser" | "isolated_server" | "full_build" | "native" | "unavailable";

export type RuntimeAvailability = "available" | "configuration_required" | "unavailable";

export interface RuntimeCapabilities {
  /** the artifact executes inside the user's browser, in a cross-origin frame. */
  clientExecution: boolean;
  /** a server process is started for the artifact. */
  serverExecution: boolean;
  /** dependencies can be installed and compiled. */
  packageInstall: boolean;
  /** the artifact may reach the network. */
  network: boolean;
  /** the artifact can read the signed-in session. never true. */
  sessionAccess: boolean;
}

export interface PreparedRuntime {
  ok: boolean;
  srcDoc: string;
  errors: string[];
  refusedDependencies: string[];
  unavailableReason: string | null;
}

export interface RuntimeProvider {
  id: string;
  runtimeClass: RuntimeClass;
  label: string;
  availability: RuntimeAvailability;
  /** plain-language description of what this provider will and will not do. */
  limitations: string[];
  capabilities: RuntimeCapabilities;
  prepare(files: ArtifactFile[]): PreparedRuntime;
}

const NO_CAPABILITIES: RuntimeCapabilities = {
  clientExecution: false,
  serverExecution: false,
  packageInstall: false,
  network: false,
  sessionAccess: false,
};

function unavailable(
  id: string,
  runtimeClass: RuntimeClass,
  label: string,
  reason: string,
  availability: RuntimeAvailability = "unavailable",
): RuntimeProvider {
  return {
    id,
    runtimeClass,
    label,
    availability,
    limitations: [reason],
    capabilities: { ...NO_CAPABILITIES },
    prepare: () => ({ ok: false, srcDoc: "", errors: [], refusedDependencies: [], unavailableReason: reason }),
  };
}

export const browserSandboxProvider: RuntimeProvider = {
  id: "browser_sandbox",
  runtimeClass: "client_browser",
  label: "browser sandbox",
  availability: "available",
  limitations: [
    "html, css and plain javascript only",
    "no package install and no build step",
    `frame permissions are limited to ${SANDBOX_LIMITS.join(", ")}`,
    "network is denied by default and the signed-in session is never reachable",
  ],
  capabilities: {
    clientExecution: true,
    serverExecution: false,
    packageInstall: false,
    network: false,
    sessionAccess: false,
  },
  prepare(files: ArtifactFile[]): PreparedRuntime {
    const built: PreviewBuild = buildPreview(files);
    return {
      ok: built.ok,
      srcDoc: built.srcDoc,
      errors: built.errors,
      refusedDependencies: built.refusedDependencies,
      unavailableReason: built.unavailableReason,
    };
  },
};

export const isolatedServerProvider = unavailable(
  "isolated_server",
  "isolated_server",
  "isolated server runtime",
  "no isolated server runtime is configured for this workspace, so server-side artifacts cannot be started here",
  "configuration_required",
);

export const fullBuildProvider = unavailable(
  "full_build",
  "full_build",
  "full build runtime",
  "installing packages and compiling a project needs an external build provider, which is not configured",
  "configuration_required",
);

export const nativeProvider = unavailable(
  "native",
  "native",
  "native runtime",
  "native execution is outside what this workspace can do",
);

export const RUNTIME_PROVIDERS: RuntimeProvider[] = [
  browserSandboxProvider,
  isolatedServerProvider,
  fullBuildProvider,
  nativeProvider,
];

export function providerForClass(runtimeClass: RuntimeClass): RuntimeProvider {
  return (
    RUNTIME_PROVIDERS.find((p) => p.runtimeClass === runtimeClass) ??
    unavailable("unknown", "unavailable", "unknown runtime", "this artifact declares a runtime asherin does not know")
  );
}

export { SANDBOX_ATTR, SANDBOX_LIMITS };
