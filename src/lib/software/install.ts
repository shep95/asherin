// installation preflight.
//
// An artifact becomes installable only when the evidence says so. Preflight
// reports facts, it never installs, and a missing capability is a blocker
// rather than an assumption.

import { assessDependencies, detectDependencies, type DependencyRecord } from "./dependencies";
import { providerForClass, type RuntimeClass } from "./runtime";
import { containsCredentialMaterial, type ArtifactFile, type ArtifactRun, type SoftwareArtifact } from "./types";

export type PreflightState = "pass" | "fail" | "unavailable";

export interface PreflightItem {
  id: string;
  label: string;
  state: PreflightState;
  detail: string;
}

export interface PreflightReport {
  eligible: boolean;
  items: PreflightItem[];
  summary: string;
}

const SECRET_LIKE = /(api[_-]?key|secret|password|private[_-]?key|bearer\s+[A-Za-z0-9._-]{12,})/i;

export function preflight(input: {
  artifact: SoftwareArtifact;
  files: ArtifactFile[];
  lastRun: ArtifactRun | null;
  runtimeClass: RuntimeClass;
  declaredDependencies?: DependencyRecord[];
}): PreflightReport {
  const items: PreflightItem[] = [];
  const live = input.files.filter((f) => !f.deletedAt);

  items.push(
    live.length > 0
      ? { id: "files", label: "the artifact has files", state: "pass", detail: `${live.length} file${live.length === 1 ? "" : "s"}` }
      : { id: "files", label: "the artifact has files", state: "fail", detail: "nothing has been created yet" },
  );

  const hasEntry = live.some((f) => /^(index\.html|main\.|app\.)/i.test(f.path));
  items.push({
    id: "entrypoint",
    label: "a starting file exists",
    state: hasEntry ? "pass" : "fail",
    detail: hasEntry ? "found a starting file" : "add an index.html or a main file so the artifact knows where to start",
  });

  items.push(
    input.artifact.displayName.trim().length > 0
      ? { id: "manifest", label: "the details are filled in", state: "pass", detail: input.artifact.displayName }
      : { id: "manifest", label: "the details are filled in", state: "fail", detail: "give the artifact a name" },
  );

  const provider = providerForClass(input.runtimeClass);
  items.push({
    id: "runtime",
    label: "the runtime is known",
    state: provider.availability === "available" ? "pass" : "unavailable",
    detail: provider.availability === "available" ? provider.label : provider.limitations[0],
  });

  const deps = detectDependencies(live.map((f) => ({ path: f.path, content: f.content })), input.declaredDependencies ?? []);
  const verdict = assessDependencies(deps, input.artifact.permissionManifest.granted.includes("network"));
  items.push({
    id: "dependencies",
    label: "dependencies are resolvable",
    state: deps.length === 0 ? "pass" : verdict.runnableInSandbox ? "pass" : "unavailable",
    detail: deps.length === 0 ? "no external dependency" : verdict.notes.join("; ") || `${deps.length} declared`,
  });

  const secretFile = live.find((f) => SECRET_LIKE.test(f.content));
  items.push({
    id: "secrets",
    label: "no secrets in the bundle",
    state: secretFile ? "fail" : "pass",
    detail: secretFile ? `${secretFile.path} looks like it holds a credential — move it to a connected integration` : "nothing credential-shaped found",
  });

  const integrationLeak = input.artifact.integrationManifest.some((i) => containsCredentialMaterial(i));
  items.push({
    id: "integrations",
    label: "integrations are declared safely",
    state: integrationLeak ? "fail" : "pass",
    detail: integrationLeak ? "an integration holds a credential instead of a reference" : `${input.artifact.integrationManifest.length} declared`,
  });

  items.push({
    id: "permissions",
    label: "permissions are declared",
    state: "pass",
    detail: input.artifact.permissionManifest.granted.length
      ? input.artifact.permissionManifest.granted.join(", ")
      : "least privilege — nothing granted",
  });

  const run = input.lastRun;
  items.push(
    !run
      ? { id: "tests", label: "checks have been run", state: "unavailable", detail: "no run has happened yet" }
      : run.status === "passed"
        ? { id: "tests", label: "checks have been run", state: "pass", detail: `${run.results.length} check${run.results.length === 1 ? "" : "s"} passed` }
        : run.status === "unavailable"
          ? { id: "tests", label: "checks have been run", state: "unavailable", detail: run.unavailableReason ?? "the last run could not report" }
          : { id: "tests", label: "checks have been run", state: "fail", detail: `${run.results.filter((r) => r.status === "failed").length} check(s) failed` },
  );

  const failed = items.filter((i) => i.state === "fail");
  const unavailable = items.filter((i) => i.state === "unavailable");
  const eligible = failed.length === 0 && unavailable.length === 0;

  return {
    eligible,
    items,
    summary: eligible
      ? "everything preflight can check is satisfied — this artifact can be installed"
      : failed.length
        ? `${failed.length} thing${failed.length === 1 ? "" : "s"} must be fixed before installing`
        : `${unavailable.length} thing${unavailable.length === 1 ? "" : "s"} could not be confirmed, so installing is held back`,
  };
}
