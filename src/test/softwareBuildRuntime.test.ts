// build providers and the runtime lifecycle: what they claim must match what
// they do, and an unavailable capability must stay unavailable.
import { describe, expect, it } from "vitest";
import {
  BUILD_PROVIDERS,
  selectBuildProvider,
  staticAssemblyProvider,
  summarizeBuild,
  toolchainBuildProvider,
} from "@/lib/software/build";
import {
  browserSandboxProvider,
  providerForClass,
  type RuntimeController,
} from "@/lib/software/runtime";
import type { ArtifactFile, RunObservation } from "@/lib/software/types";

const file = (path: string, content: string): ArtifactFile => ({
  id: path,
  artifactId: "a1",
  path,
  content,
  mime: "text/plain",
  updatedAt: "2026-01-01T00:00:00Z",
  origin: "user",
  deletedAt: null,
});

const html = [file("index.html", "<div id='root'>hi</div>"), file("main.js", "console.log('ready')")];

describe("build providers", () => {
  it("assembles plain files and reports no install", () => {
    const out = staticAssemblyProvider.build(html);
    expect(out.ok).toBe(true);
    expect(out.output).toContain("root");
    expect(summarizeBuild(out)).toContain("assembled");
  });

  it("routes typescript to the toolchain provider, which cannot build", () => {
    const provider = selectBuildProvider([file("app.tsx", "export const A = () => null;")]);
    expect(provider.id).toBe("toolchain_build");
    const out = provider.build([file("app.tsx", "x")]);
    expect(out.ok).toBe(false);
    expect(out.unavailableReason).toBeTruthy();
    expect(provider.health().ok).toBe(false);
  });

  it("never claims a capability it does not have", () => {
    for (const p of BUILD_PROVIDERS) {
      for (const c of p.capabilities) {
        if (c.state !== "available") expect(c.detail.length).toBeGreaterThan(10);
      }
    }
    expect(toolchainBuildProvider.capabilities.every((c) => c.state !== "available")).toBe(true);
  });

  it("reports declared dependencies without installing them", () => {
    const deps = staticAssemblyProvider.resolve([file("main.js", "import x from 'lodash'")]);
    expect(deps.map((d) => d.name)).toContain("lodash");
    expect(deps[0].installationRequirement).toBe("external_build_provider");
  });
});

describe("runtime lifecycle", () => {
  const make = () => {
    let running = false;
    const obs: RunObservation[] = [];
    const controller: RuntimeController = {
      start: () => {
        running = true;
        obs.push({ channel: "console", level: "info", message: "ready", at: "2026-01-01T00:00:00Z" });
      },
      stop: () => {
        running = false;
      },
      observations: () => obs,
      running: () => running,
    };
    return controller;
  };

  it("prepares, starts, observes, logs and stops", () => {
    const controller = make();
    const prepared = browserSandboxProvider.build(html);
    expect(prepared.ok).toBe(true);
    const session = browserSandboxProvider.start(prepared, controller);
    expect(session).not.toBeNull();
    expect(browserSandboxProvider.health(session, controller).state).toBe("running");
    expect(browserSandboxProvider.collectObservations(session!, controller)).toHaveLength(1);
    expect(browserSandboxProvider.getLogs(session!, controller)[0].message).toBe("ready");
    const stopped = browserSandboxProvider.stop(session!, controller);
    expect(stopped.stoppedAt).toBeTruthy();
    expect(browserSandboxProvider.health(stopped, controller).state).toBe("stopped");
  });

  it("refuses to start when there is nothing runnable", () => {
    const prepared = browserSandboxProvider.build([]);
    expect(prepared.ok).toBe(false);
    expect(browserSandboxProvider.start(prepared)).toBeNull();
  });

  it("declares unsupported runtime classes unavailable rather than starting them", () => {
    for (const cls of ["isolated_server", "full_build", "native"] as const) {
      const p = providerForClass(cls);
      expect(p.capabilities.clientExecution).toBe(false);
      expect(p.start(p.build(html))).toBeNull();
      expect(p.health(null).state).toBe("unavailable");
    }
  });

  it("never grants session access to any runtime", () => {
    expect(browserSandboxProvider.capabilities.sessionAccess).toBe(false);
  });
});
