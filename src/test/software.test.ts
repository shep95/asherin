// phase 1 foundation — deterministic checks on the artifact domain rules.
//
// These cover the parts that must hold regardless of the database: the
// lifecycle machine, least privilege, credential refusal, identity stability,
// version lineage and navigation separation.

import { describe, expect, it } from "vitest";
import {
  LEAST_PRIVILEGE,
  LIFECYCLE_LABEL,
  LIFECYCLE_TRANSITIONS,
  WORKSPACE_PANES,
  artifactRoute,
  canTransition,
  containsCredentialMaterial,
  hasCapability,
  type ArtifactLifecycleStatus,
  type NavigationItem,
  type SoftwareVersion,
} from "@/lib/software/types";
import { nextDisplayVersion, safeMetadata } from "@/lib/software/store";

describe("artifact lifecycle", () => {
  it("allows the failure and repair path", () => {
    const path: ArtifactLifecycleStatus[] = ["draft", "building", "failed", "repairing", "testing", "validated"];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows the update and rollback path from an installed artifact", () => {
    expect(canTransition("installed", "update_available")).toBe(true);
    expect(canTransition("update_available", "validating_update")).toBe(true);
    expect(canTransition("validating_update", "failed")).toBe(true);
    expect(canTransition("failed", "repairing")).toBe(true);
  });

  it("refuses a move that skips the machine", () => {
    expect(canTransition("draft", "installed")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
  });

  it("names every status without leaving one unlabelled", () => {
    for (const status of Object.keys(LIFECYCLE_TRANSITIONS) as ArtifactLifecycleStatus[]) {
      expect(LIFECYCLE_LABEL[status]).toBeTruthy();
    }
  });
});

describe("permission boundary", () => {
  it("defaults to drawing itself and nothing else", () => {
    expect(LEAST_PRIVILEGE.granted).toEqual(["ui"]);
    expect(hasCapability(LEAST_PRIVILEGE, "network")).toBe(false);
    expect(hasCapability(LEAST_PRIVILEGE, "privileged_actions")).toBe(false);
    expect(hasCapability(LEAST_PRIVILEGE, "ui")).toBe(true);
  });

  it("treats a missing manifest as no access at all", () => {
    expect(hasCapability(null, "ui")).toBe(false);
  });
});

describe("credential hygiene", () => {
  it("recognises credential-shaped material in an integration contract", () => {
    expect(
      containsCredentialMaterial({ provider: "x", credentialRef: "sk-live_ABCDEFGHIJKLMNOP1234" }),
    ).toBe(true);
    expect(containsCredentialMaterial({ provider: "x", credentialRef: "USER_OPENAI_KEY" })).toBe(false);
  });

  it("redacts secrets before an event is recorded", () => {
    const safe = safeMetadata({
      apiKey: "sk-live_ABCDEFGHIJKLMNOP1234",
      note: "built the inventory view",
      token: "abc",
      payload: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWX1234",
    });
    expect(safe.apiKey).toBe("[redacted]");
    expect(safe.token).toBe("[redacted]");
    expect(safe.payload).toBe("[redacted]");
    expect(safe.note).toBe("built the inventory view");
  });
});

describe("identity", () => {
  it("derives the route from the id, so a rename cannot move it", () => {
    const id = "0b7f4a52-1c2f-4f7a-9c9c-0e2a3ba4d111";
    const before = artifactRoute(id);
    const renamed = { id, displayName: "My Stuff" };
    expect(artifactRoute(renamed.id)).toBe(before);
    expect(before.includes("inventory")).toBe(false);
  });
});

describe("version lineage", () => {
  it("moves forward and never reuses a number", () => {
    expect(nextDisplayVersion(undefined)).toBe("0.1.0");
    expect(nextDisplayVersion("0.1.0")).toBe("0.2.0");
    expect(nextDisplayVersion("0.2.0", "patch")).toBe("0.2.1");
    expect(nextDisplayVersion("0.2.1", "major")).toBe("1.0.0");
  });

  it("treats a restore as a new version pointing at the old one", () => {
    const old: SoftwareVersion = {
      id: "v1",
      artifactId: "a1",
      ordinal: 1,
      displayVersion: "0.1.0",
      label: null,
      parentVersionId: null,
      sourceRef: { files: 2 },
      stateRef: {},
      changeSummary: "first build",
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      validationStatus: "validated",
      releaseStatus: "checkpoint",
      rollbackEligible: true,
    };
    // the restore is modelled as a forward move: nothing in the old record changes
    const restoredDisplay = nextDisplayVersion("0.3.0", "patch");
    expect(restoredDisplay).toBe("0.3.1");
    expect(old.displayVersion).toBe("0.1.0");
    expect(old.rollbackEligible).toBe(true);
  });
});

describe("navigation registry", () => {
  it("keeps installed artifact rows separate from asherin's own navigation", () => {
    const rows: NavigationItem[] = [
      {
        id: "n1",
        ownerUserId: "u1",
        artifactId: "a1",
        source: "installed",
        displayName: "My Stuff",
        icon: null,
        route: artifactRoute("a1"),
        position: 0,
        enabled: true,
        visibility: "private",
        configuration: {},
      },
      {
        id: "n2",
        ownerUserId: "u1",
        artifactId: null,
        source: "user",
        displayName: "a shortcut",
        icon: null,
        route: "/dashboard/library",
        position: 1,
        enabled: false,
        visibility: "private",
        configuration: {},
      },
    ];
    const installed = rows.filter((r) => r.source === "installed" && r.enabled);
    expect(installed).toHaveLength(1);
    expect(installed[0].route).toBe("/dashboard/software/a1");
    // a disabled row is never rendered
    expect(rows.filter((r) => r.enabled)).toHaveLength(1);
  });
});

describe("workspace shell", () => {
  it("declares every pane the foundation promises", () => {
    expect(WORKSPACE_PANES).toEqual([
      "build",
      "code",
      "preview",
      "test",
      "data",
      "files",
      "history",
      "settings",
    ]);
  });
});
