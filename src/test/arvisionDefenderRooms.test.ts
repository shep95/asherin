import { describe, it, expect } from "vitest";
import { analyseFrame, sceneGeoVerdict, visualLevel, CANNOT_RESOLVE } from "@/lib/arvision/frameIntel";
import { v2TitleFor } from "@/lib/dashboard/v2Titles";
import { NAV_INTENTS } from "@/lib/navIntents";

function solid(w: number, h: number, v: number) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = 255;
  }
  return buf;
}

describe("arvision frame intel", () => {
  it("reads luma from a flat frame without any model", () => {
    const { intel } = analyseFrame(solid(8, 8, 255), 8, 8, null);
    expect(intel.luma).toBeCloseTo(1, 2);
    expect(intel.edges).toBeCloseTo(0, 3);
  });

  it("reports zero motion on the first frame and real motion on a change", () => {
    const first = analyseFrame(solid(8, 8, 0), 8, 8, null);
    expect(first.intel.motion).toBe(0);
    const second = analyseFrame(solid(8, 8, 255), 8, 8, first.gray);
    expect(second.intel.motion).toBeGreaterThan(0.9);
  });

  it("finds edges on a split frame", () => {
    const w = 8, h = 8;
    const buf = solid(w, h, 0);
    for (let y = 0; y < h; y++) {
      for (let x = 4; x < w; x++) {
        const p = (y * w + x) * 4;
        buf[p] = buf[p + 1] = buf[p + 2] = 255;
      }
    }
    const { intel } = analyseFrame(buf, w, h, null);
    expect(intel.edges).toBeGreaterThan(0);
  });

  it("refuses a scene geolocation under three visual votes", () => {
    expect(sceneGeoVerdict(0)).toBe("CANNOT_RESOLVE");
    expect(sceneGeoVerdict(2)).toBe("CANNOT_RESOLVE");
    expect(sceneGeoVerdict(3)).toBe("resolved");
    expect(visualLevel(1)).toBe("L1");
    expect(visualLevel(5)).toBe("L5");
  });

  it("prints the things it will not fake", () => {
    expect(CANNOT_RESOLVE.join(" ")).toMatch(/thermal/);
    expect(CANNOT_RESOLVE.join(" ")).toMatch(/through walls/);
  });
});

describe("rooms are registered", () => {
  it("carries lowercase product titles", () => {
    expect(v2TitleFor("asherin-defender").title).toBe("asherin.defender");
    expect(v2TitleFor("asherin-arvision").title).toBe("asherin.arvision");
    expect(v2TitleFor("asherin-arvision").canvas).toBe(true);
  });

  it("sits in the rail as its own room", () => {
    const views = NAV_INTENTS.map((i) => i.view);
    expect(views).toContain("asherin-defender");
    expect(views).toContain("asherin-arvision");
  });
});
