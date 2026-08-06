import { describe, it, expect } from "vitest";
import { hasMaximumAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { MAXIMUM_VIEWS } from "@/hooks/useAccess";

// Live gating contract for the $399/mo Maximum tier surface.
describe("Cloud Intelligence Mesh — maximum tier gate", () => {
  it("registers the mesh as a maximum-tier view", () => {
    expect(MAXIMUM_VIEWS).toContain("google");
  });

  it("opens only for the $399 Asherin Pro subscription and its one-time equivalent", () => {
    expect(hasMaximumAccess("monthly_pro")).toBe(true);
    expect(hasMaximumAccess("pro")).toBe(true);
  });

  it("stays closed for every tier below maximum", () => {
    for (const tier of ["chat", "monthly_aureon", "aureon"] as const) {
      expect(hasMaximumAccess(tier)).toBe(false);
    }
  });

  it("does not leak to grandfathered lifetime/algorithm holders that pro-tier checks admit", () => {
    expect(hasProAccess("lifetime")).toBe(true);
    expect(hasProAccess("algorithm")).toBe(true);
    expect(hasMaximumAccess("lifetime")).toBe(false);
    expect(hasMaximumAccess("algorithm")).toBe(false);
  });

  it("stays closed with no subscription at all", () => {
    expect(hasMaximumAccess(null)).toBe(false);
  });
});
