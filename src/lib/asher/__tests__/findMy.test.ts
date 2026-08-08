import { describe, it, expect } from "vitest";
import { fusePosition, deriveState, rssiToMetres, haversineM } from "@/lib/asher/findMy";

/** Real rows returned by locate_owned_device() for FINDMY-TEST-FP-001. */
const fixes = [
  { seen_at: "2026-08-08T02:49:41.172193+00:00", lat: 40.7135, lng: -74.0072, accuracy_m: 18, rssi: -74, distance_m: 12.5 },
  { seen_at: "2026-08-08T02:29:41.172193+00:00", lat: 40.71293, lng: -74.00605, accuracy_m: 9, rssi: -57, distance_m: 2 },
  { seen_at: "2026-08-08T02:14:41.172193+00:00", lat: 40.7129, lng: -74.0061, accuracy_m: 12, rssi: -61, distance_m: 3.4 },
];
const NOW = Date.parse("2026-08-08T02:55:00Z");

describe("Find-My fusion", () => {
  it("fuses the recent cluster and never claims sub-metre precision", () => {
    const f = fusePosition(fixes, NOW)!;
    expect(f).toBeTruthy();
    expect(f.fixCount).toBe(3);
    expect(f.radiusM).toBeGreaterThanOrEqual(5);
    // Centroid must sit inside the bounding box of the contributing fixes.
    expect(f.lat).toBeGreaterThan(40.7128); expect(f.lat).toBeLessThan(40.7136);
    expect(f.lng).toBeLessThan(-74.0059); expect(f.lng).toBeGreaterThan(-74.0073);
    // The halo must actually cover the newest observation.
    expect(haversineM(f, fixes[0])).toBeLessThanOrEqual(f.radiusM * 3);
    expect(f.caption).toMatch(/sightings fused/);
  });

  it("degrades honestly on a single sighting", () => {
    const f = fusePosition([fixes[0]], NOW)!;
    expect(f.fixCount).toBe(1);
    expect(f.radiusM).toBeGreaterThanOrEqual(18);
    expect(f.caption).toMatch(/1 sighting/);
  });

  it("returns null rather than a fake pin with no data", () => {
    expect(fusePosition([], NOW)).toBeNull();
    expect(fusePosition([{ ...fixes[0], lat: NaN, lng: NaN }], NOW)).toBeNull();
  });

  it("does not average across a distant stale fix", () => {
    const far = [{ ...fixes[0] }, { ...fixes[1], lat: 41.9, lng: -87.6 }];
    const f = fusePosition(far, NOW)!;
    expect(f.fixCount).toBe(1);
    expect(f.lat).toBeCloseTo(40.7135, 3);
  });

  it("maps RSSI to a bounded range estimate", () => {
    expect(rssiToMetres(-59)).toBeCloseTo(1, 1);
    expect(rssiToMetres(-100)).toBeLessThanOrEqual(120);
    expect(rssiToMetres(null)).toBeGreaterThan(0);
  });
});

describe("state machine", () => {
  const base = { state: "nominal", missing_after_minutes: 60 } as any;
  it("silence becomes missing, presence stays nominal", () => {
    expect(deriveState(base, 5)).toBe("nominal");
    expect(deriveState(base, 500)).toBe("missing");
    expect(deriveState(base, null)).toBe("missing");
  });
  it("a declared theft outranks a fresh sighting", () => {
    expect(deriveState({ ...base, state: "stolen" }, 1)).toBe("stolen");
  });
});
