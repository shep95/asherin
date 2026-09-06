import { describe, expect, it } from "vitest";
import { scoreSensitivity, tierFromScore } from "../../supabase/functions/_shared/discover/sensitivity";
import { isProbeableHost } from "../../supabase/functions/_shared/discover/urlPatterns";
import { expandPivot, type IdentifierKind } from "../../supabase/functions/_shared/discover/pivot";

describe("sensitivity scoring", () => {
  it("ranks credentials above archives", () => {
    expect(scoreSensitivity("credential")).toBeGreaterThan(scoreSensitivity("archive"));
  });
  it("lifts the score when a real key appears in the evidence", () => {
    const plain = scoreSensitivity("config", "DEBUG=true");
    const keyed = scoreSensitivity("config", "AKIAIOSFODNN7EXAMPLE");
    expect(keyed).toBeGreaterThan(plain);
  });
  it("stays inside 0..100", () => {
    const s = scoreSensitivity("credential", "AKIAIOSFODNN7EXAMPLE aws_secret_access_key ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { live: true });
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });
  it("maps scores to tiers", () => {
    expect(tierFromScore(95)).toBe("critical");
    expect(tierFromScore(10)).toBe("low");
  });
});

describe("probe host guard", () => {
  it("blocks loopback, private ranges and metadata hosts", () => {
    for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.9.9", "169.254.169.254", "metadata.google.internal", "box.local"]) {
      expect(isProbeableHost(h)).toBe(false);
    }
  });
  it("allows ordinary public hostnames", () => {
    expect(isProbeableHost("example.com")).toBe(true);
    expect(isProbeableHost("api.staging.example.com")).toBe(true);
  });
});

describe("pivot expansion", () => {
  it("caps depth, node count and fanout, and never revisits a node", async () => {
    let calls = 0;
    const nodes = await expandPivot(
      { identifier: "seed@example.com", kind: "email" },
      async (node) => {
        calls++;
        return Array.from({ length: 20 }, (_, i) => ({
          identifier: `${node.identifier}-${i}`,
          kind: "username" as IdentifierKind,
        }));
      },
      { maxDepth: 2, maxNodes: 10, maxFanoutPerNode: 3 },
    );
    expect(nodes.length).toBeLessThanOrEqual(10);
    expect(Math.max(...nodes.map((n) => n.depth))).toBeLessThanOrEqual(2);
    expect(new Set(nodes.map((n) => n.identifier)).size).toBe(nodes.length);
    expect(calls).toBeGreaterThan(0);
  });

  it("survives a resolver that throws", async () => {
    const nodes = await expandPivot(
      { identifier: "x@example.com", kind: "email" },
      async () => { throw new Error("upstream down"); },
    );
    expect(nodes).toHaveLength(1);
  });
});
