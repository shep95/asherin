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

/** A started artifact. The provider owns it; the caller only asks it things. */
export interface RuntimeSession {
  id: string;
  providerId: string;
  startedAt: string;
  stoppedAt: string | null;
}

export type RuntimeHealth = { state: "running" | "stopped" | "failed" | "unavailable"; detail: string };

/**
 * What a runtime is driven by. The browser sandbox implements this with a real
 * frame; every other provider answers honestly that it cannot.
 */
export interface RuntimeController {
  start: () => void;
  stop: () => void;
  observations: () => RunObservation[];
  running: () => boolean;
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
  /** the build step this runtime needs before it can start. */
  build(files: ArtifactFile[]): PreparedRuntime;
  start(prepared: PreparedRuntime, controller?: RuntimeController): RuntimeSession | null;
  stop(session: RuntimeSession, controller?: RuntimeController): RuntimeSession;
  collectObservations(session: RuntimeSession, controller?: RuntimeController): RunObservation[];
  getLogs(session: RuntimeSession, controller?: RuntimeController): RunObservation[];
  health(session: RuntimeSession | null, controller?: RuntimeController): RuntimeHealth;
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
    build: () => ({ ok: false, srcDoc: "", errors: [], refusedDependencies: [], unavailableReason: reason }),
    start: () => null,
    stop: (session) => ({ ...session, stoppedAt: new Date().toISOString() }),
    collectObservations: () => [],
    getLogs: () => [],
    health: () => ({ state: "unavailable", detail: reason }),
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
  build(files: ArtifactFile[]): PreparedRuntime {
    // assembly is the build for this runtime; there is no separate compile.
    return this.prepare(files);
  },
  start(prepared: PreparedRuntime, controller?: RuntimeController): RuntimeSession | null {
    if (!prepared.ok) return null;
    controller?.start();
    return {
      id: `run_${Date.now().toString(36)}`,
      providerId: "browser_sandbox",
      startedAt: new Date().toISOString(),
      stoppedAt: null,
    };
  },
  stop(session: RuntimeSession, controller?: RuntimeController): RuntimeSession {
    controller?.stop();
    return { ...session, stoppedAt: session.stoppedAt ?? new Date().toISOString() };
  },
  collectObservations(_session: RuntimeSession, controller?: RuntimeController): RunObservation[] {
    return controller?.observations() ?? [];
  },
  getLogs(session: RuntimeSession, controller?: RuntimeController): RunObservation[] {
    return this.collectObservations(session, controller).filter((o) => o.channel === "console");
  },
  health(session: RuntimeSession | null, controller?: RuntimeController): RuntimeHealth {
    if (!session) return { state: "stopped", detail: "the artifact is not running" };
    if (session.stoppedAt) return { state: "stopped", detail: `stopped at ${session.stoppedAt}` };
    if (controller && !controller.running()) return { state: "failed", detail: "the frame is no longer reporting" };
    const errs = (controller?.observations() ?? []).filter((o) => o.level === "error").length;
    return errs > 0
      ? { state: "running", detail: `running — ${errs} error(s) reported by the artifact` }
      : { state: "running", detail: "running — no errors reported" };
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
