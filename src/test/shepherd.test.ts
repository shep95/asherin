import { describe, expect, it } from "vitest";
import { parseSeed, strongestGeo } from "@/components/dashboard/shepherd/seed";
import {
  TIER_CEILING,
  absence,
  buildFinding,
  chainFor,
  corroborate,
  jointConfidence,
  openConflict,
} from "@/components/dashboard/shepherd/engine";
import type { Tier, Token } from "@/components/dashboard/shepherd/types";

function tok(id: string, tier: Tier | null, parents: string[] = [], weight = 0.5, sourceId = id): Token {
  return {
    id,
    type: "keyword",
    value: id,
    key: id,
    originTier: tier,
    originSourceId: sourceId,
    originSourceName: sourceId,
    parents,
    weight,
    corroborations: [],
    conflicts: [],
    layer: 1,
  };
}

describe("shepherd seed parser", () => {
  const seed = parseSeed("who is jane q analyst, ~20, broward county florida @janeq");

  it("extracts a full name token", () => {
    expect(seed.names[0]?.value.toLowerCase()).toContain("jane");
  });

  it("types geography by precision and prefers the tighter one", () => {
    expect(seed.geo.some((g) => g.precision === "county")).toBe(true);
    expect(strongestGeo(seed)?.precision).toBe("county");
  });

  it("turns an approximate age into a birth-year range, not a data point", () => {
    expect(seed.ages[0]?.key).toMatch(/^dob:\d{4}-\d{4}$/);
  });

  it("captures a handle as a provisional lateral", () => {
    expect(seed.handles.some((h) => h.value.toLowerCase() === "janeq")).toBe(true);
  });

  it("gives every seed token provisional weight and no source tier", () => {
    for (const t of seed.tokens) {
      expect(t.originTier).toBeNull();
      expect(t.weight).toBeLessThan(0.6);
    }
  });
});

describe("shepherd weight rules", () => {
  it("clamps a T4 token to its tier ceiling however many aggregators agree", () => {
    const a = tok("a", 4, [], 0.18, "agg1");
    const map = new Map<string, Token>([["a", a]]);
    for (let i = 0; i < 10; i += 1) {
      const other = tok(`echo${i}`, 4, [], 0.18, `agg${i + 2}`);
      map.set(other.id, other);
      corroborate(a, other, "identical", map);
    }
    expect(a.weight).toBeLessThanOrEqual(TIER_CEILING[4]);
  });

  it("refuses corroboration from a downstream child", () => {
    const parent = tok("p", 2, [], 0.5, "s1");
    const child = tok("c", 3, ["p"], 0.4, "s2");
    const map = new Map([
      ["p", parent],
      ["c", child],
    ]);
    expect(corroborate(parent, child, "identical", map)).toBe(false);
    expect(parent.corroborations).toHaveLength(0);
  });

  it("multiplies weights along the dependency chain", () => {
    const a = tok("a", 1, [], 0.9, "s1");
    const b = tok("b", 2, ["a"], 0.5, "s2");
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    const chain = chainFor("b", map);
    expect(chain).toEqual(["a", "b"]);
    expect(jointConfidence(chain, map)).toBeCloseTo(0.45, 3);
  });

  it("never marks a finding confirmed when anything upstream is unconfirmed", () => {
    const seedTok = tok("seed", null, [], 0.4, "analyst");
    const gov = tok("gov", 1, ["seed"], 0.9, "fl-voter");
    const map = new Map([
      ["seed", seedTok],
      ["gov", gov],
    ]);
    const f = buildFinding({
      id: "f1",
      category: "government",
      label: "record",
      detail: "",
      sourceId: "fl-voter",
      sourceName: "voter",
      tier: 1,
      tokenId: "gov",
      byId: map,
    });
    expect(f.certainty).toBe("conditional");
    expect(f.notice).toBeTruthy();
  });

  it("keeps conflicts open instead of letting the higher tier win", () => {
    const a = tok("a", 1, [], 0.9, "s1");
    const b = tok("b", 4, [], 0.2, "s2");
    const entry = openConflict(a, b, "a newer T1 record");
    expect(a.conflicts).toContain("b");
    expect(b.conflicts).toContain("a");
    expect(entry.resolvedBy).toBeTruthy();
  });

  it("grades absence by the tier that produced the null", () => {
    expect(absence("x", "state voter index", 1, "q").meaning).toContain("confirmed absence");
    expect(absence("y", "spokeo", 4, "q").meaning).toContain("not meaningful");
  });
});
