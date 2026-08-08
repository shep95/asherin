import { describe, it, expect } from "vitest";
import { hasAureonAccess, hasMaximumAccess, hasProAccess } from "@/contexts/SubscriptionContext";
import { CONNECTED_ACCOUNT_VIEWS } from "@/hooks/useAccess";

// Live gating contract for the connected-account (Google Cloud Intelligence)
// surface, now bundled with the $18/mo Asherin subscription and above.
describe("Cloud Intelligence Mesh — connected-account gate", () => {
  it("registers the mesh as a connected-account view", () => {
    expect(CONNECTED_ACCOUNT_VIEWS).toContain("google");
  });

  it("opens for the $18 Asherin subscription (monthly + 6-month term) and above", () => {
    expect(hasAureonAccess("monthly_aureon")).toBe(true);
    expect(hasAureonAccess("aureon")).toBe(true);
    expect(hasAureonAccess("monthly_pro")).toBe(true);
    expect(hasAureonAccess("pro")).toBe(true);
  });

  it("stays closed for chat-only accounts and for no subscription at all", () => {
    expect(hasAureonAccess("chat")).toBe(false);
    expect(hasAureonAccess(null)).toBe(false);
  });

  it("keeps the maximum ladder intact for surfaces that still need it", () => {
    expect(hasProAccess("lifetime")).toBe(true);
    expect(hasMaximumAccess("lifetime")).toBe(false);
    expect(hasMaximumAccess("monthly_pro")).toBe(true);
  });
});
