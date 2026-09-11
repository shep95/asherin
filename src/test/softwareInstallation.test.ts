// Phase 4 — installation and navigation registry semantics.
//
// These prove the rules a person depends on: a rename is only a label, a
// removal does exactly what its wording says, and one app can never read
// another's data.

import { describe, expect, it } from "vitest";
import {
  REMOVAL_SEMANTICS,
  appRoute,
  artifactIdFromRoute,
  dataNamespace,
  launchState,
  namespaceAllows,
  nextPosition,
  permissionDelta,
  renameItem,
  reorder,
  visibleItems,
} from "@/lib/software/navigation";
import type { Installation, NavigationItem, SoftwareArtifact } from "@/lib/software/types";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function item(over: Partial<NavigationItem> = {}): NavigationItem {
  return {
    id: "nav-1",
    ownerUserId: "user-1",
    artifactId: ID_A,
    installationId: "install-1",
    source: "installed",
    section: "installed",
    displayName: "My Inventory",
    icon: "◈",
    route: appRoute(ID_A),
    position: 0,
    enabled: true,
    visibility: "private",
    configuration: {},
    ...over,
  };
}

describe("app routes", () => {
  it("addresses an app by identity, never by name", () => {
    expect(appRoute(ID_A)).toBe(`/dashboard/app/${ID_A}`);
    expect(artifactIdFromRoute(appRoute(ID_A))).toBe(ID_A);
  });

  it("refuses a path that is not an app route", () => {
    expect(artifactIdFromRoute("/dashboard/software/" + ID_A)).toBeNull();
    expect(artifactIdFromRoute("/dashboard/app/not-a-uuid")).toBeNull();
  });
});

describe("rename identity rule", () => {
  it("changes the label and nothing else", () => {
    const before = item();
    const after = renameItem(before, "Stock Room");
    expect(after.displayName).toBe("Stock Room");
    expect(after.route).toBe(before.route);
    expect(after.artifactId).toBe(before.artifactId);
    expect(after.installationId).toBe(before.installationId);
    expect(after.id).toBe(before.id);
    expect(artifactIdFromRoute(after.route)).toBe(ID_A);
  });

  it("rejects an empty name", () => {
    expect(() => renameItem(item(), "   ")).toThrow();
  });
});

describe("ordering", () => {
  const rows = [
    item({ id: "a", position: 0, displayName: "A" }),
    item({ id: "b", position: 1, displayName: "B" }),
    item({ id: "c", position: 2, displayName: "C" }),
  ];

  it("moves one row and renumbers the rest", () => {
    const next = reorder(rows, "c", 0);
    expect(next.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(next.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it("clamps an out of range target", () => {
    expect(reorder(rows, "a", 99).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("gives a new install the next free slot in its own section", () => {
    expect(nextPosition(rows, "installed")).toBe(3);
    expect(nextPosition(rows, "shared")).toBe(0);
  });

  it("hides disabled rows and keeps sections apart", () => {
    const mixed = [...rows, item({ id: "d", enabled: false }), item({ id: "e", section: "shared" })];
    expect(visibleItems(mixed, "installed").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(visibleItems(mixed, "shared").map((r) => r.id)).toEqual(["e"]);
  });
});

describe("launching", () => {
  const artifact = { id: ID_A } as SoftwareArtifact;
  const installation = { id: "install-1", artifactId: ID_A, enabled: true } as Installation;

  it("opens an enabled installation at its identity route", () => {
    expect(launchState({ artifact, installation })).toEqual({ state: "open", route: appRoute(ID_A) });
  });

  it("explains a disabled app instead of pretending it ran", () => {
    const s = launchState({ artifact, installation: { ...installation, enabled: false } });
    expect(s.state).toBe("disabled");
  });

  it("explains a missing installation", () => {
    expect(launchState({ artifact, installation: null }).state).toBe("missing");
    expect(launchState({ artifact: null, installation }).state).toBe("missing");
  });
});

describe("permissions on update", () => {
  it("requires approval for anything newly requested", () => {
    const d = permissionDelta({ granted: ["storage"], requested: ["storage", "network"] });
    expect(d.added).toEqual(["network"]);
    expect(d.requiresApproval).toBe(true);
  });

  it("does not require approval when an update asks for less", () => {
    const d = permissionDelta({ granted: ["storage", "network"], requested: ["storage"] });
    expect(d.removed).toEqual(["network"]);
    expect(d.requiresApproval).toBe(false);
  });
});

describe("removal semantics", () => {
  it("keeps data for everything short of an explicit delete", () => {
    for (const action of ["remove_from_dashboard", "disable", "uninstall"] as const) {
      const s = REMOVAL_SEMANTICS[action];
      expect(s.keepsArtifact).toBe(true);
      expect(s.keepsData).toBe(true);
      expect(s.destructive).toBe(false);
      expect(s.requiresTypedConfirmation).toBe(false);
    }
  });

  it("keeps the installation when only the sidebar row is removed", () => {
    expect(REMOVAL_SEMANTICS.remove_from_dashboard.keepsInstallation).toBe(true);
    expect(REMOVAL_SEMANTICS.uninstall.keepsInstallation).toBe(false);
  });

  it("makes both delete paths destructive and typed", () => {
    for (const action of ["delete_application", "delete_application_and_data"] as const) {
      expect(REMOVAL_SEMANTICS[action].destructive).toBe(true);
      expect(REMOVAL_SEMANTICS[action].requiresTypedConfirmation).toBe(true);
      expect(REMOVAL_SEMANTICS[action].keepsData).toBe(false);
    }
  });
});

describe("data isolation", () => {
  it("scopes an app to its own namespace", () => {
    expect(namespaceAllows(dataNamespace(ID_A), ID_A)).toBe(true);
    expect(namespaceAllows(dataNamespace(ID_B), ID_A)).toBe(false);
    expect(namespaceAllows("public", ID_A)).toBe(false);
  });
});
