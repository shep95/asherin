import { describe, it, expect } from "vitest";
import { hasZophielAccess, hasAureonAccess } from "@/contexts/SubscriptionContext";
import { ZOPHIEL_VIEWS } from "@/hooks/useAccess";

// Live gating contract: the entire Zophiel Search Intelligence tab ships with
// the $18/mo Asherin subscription and its 6-month term (both resolve to the
// `monthly_aureon` tier key).
describe("Zophiel Search Intelligence — $18 Asherin entitlement", () => {
  it("covers the whole Zophiel surface, not just the search tab", () => {
    expect(ZOPHIEL_VIEWS).toEqual(
      expect.arrayContaining(["search", "imagine-intelligence", "file-scrapper", "cipher"]),
    );
  });

  it("opens for the $18 monthly and 6-month Asherin subscription", () => {
    expect(hasZophielAccess("monthly_aureon")).toBe(true);
    expect(hasAureonAccess("monthly_aureon")).toBe(true);
  });

  it("stays open for every tier above $18", () => {
    for (const t of ["aureon", "monthly_pro", "pro", "lifetime", "algorithm"] as const) {
      expect(hasZophielAccess(t)).toBe(true);
    }
  });

  it("never removes access legacy chat holders already had", () => {
    expect(hasZophielAccess("chat")).toBe(true);
  });

  it("stays closed with no subscription at all", () => {
    expect(hasZophielAccess(null)).toBe(false);
  });
});
